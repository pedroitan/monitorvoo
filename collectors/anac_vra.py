"""Ingestao do Voo Regular Ativo (VRA) da ANAC -> tabela anac_flights.

Todos os voos regulares no Brasil (nacionais e internacionais), um arquivo
CSV por mes. Agrega por mes x cia x trecho: previstos, realizados,
cancelados, atrasos e distribuicao por hora/dia da semana.

    python -m collectors.anac_vra                # ultimos 12 meses publicados
    python -m collectors.anac_vra --months 24
    python -m collectors.anac_vra --from 2025-01 --to 2026-08
"""
from __future__ import annotations

import argparse
import csv
import io
import random
import sys
import time
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from urllib.parse import quote

import httpx
from dotenv import load_dotenv

from . import db
from .anac import AIRLINE_NAMES, UA, download, month_range
from .storage import RAW_DIR

CACHE_DIR = RAW_DIR / "anac" / "vra"
BASE = "https://sistemas.anac.gov.br/dadosabertos/Voos e operações aéreas/Voo Regular Ativo (VRA)"
MONTH_NAMES = ("Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
               "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro")
AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv"
AIRPORTS_MAX_AGE_DAYS = 90
TIME_FMT = "%Y-%m-%d %H:%M:%S"


def vra_url(year: int, month: int) -> str:
    return quote(f"{BASE}/{year}/{month:02d} - {MONTH_NAMES[month - 1]}/VRA_{year}{month}.csv", safe=":/")


def icao_to_iata(http: httpx.Client) -> dict[str, str]:
    """Mapa ICAO -> IATA (OurAirports, dominio publico), em cache local."""
    path = RAW_DIR / "anac" / "airports.csv"
    fresh = path.exists() and (time.time() - path.stat().st_mtime) < AIRPORTS_MAX_AGE_DAYS * 86400
    if not fresh:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(http.get(AIRPORTS_URL).raise_for_status().content)
    out: dict[str, str] = {}
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["iata_code"]:
                for k in (row["icao_code"], row["gps_code"], row["ident"]):
                    if k:
                        out.setdefault(k, row["iata_code"])
    return out


def _ts(value: str) -> datetime | None:
    try:
        return datetime.strptime(value, TIME_FMT)
    except ValueError:
        return None


def parse_month(path: Path, year: int, month: int, iata: dict[str, str]) -> list[dict]:
    text = path.read_bytes().decode("latin-1")
    lines = text.splitlines()
    # 1a linha: "Atualizado em: AAAA-MM-DD"; depois cabecalho e dados
    start = next(i for i, line in enumerate(lines) if line.startswith('"ICAO'))
    acc: dict[tuple, dict] = defaultdict(lambda: {
        "planned": 0, "flown": 0, "cancelled": 0, "delayed15": 0, "delay_sum": 0.0, "delay_n": 0,
        "by_hour": [0] * 24, "by_weekday": [0] * 7, "numbers": set(),
    })
    for r in csv.reader(io.StringIO("\n".join(lines[start + 1:])), delimiter=";"):
        if len(r) < 11 or r[3] not in ("N", "I"):
            continue
        cia, number, _, line, orig, dest, dep_plan, dep_real, _, _, status = r[:11]
        a = acc[(cia, orig, dest, line)]
        planned = _ts(dep_plan)
        if planned:
            a["planned"] += 1
        if status == "CANCELADO":
            a["cancelled"] += 1
            continue
        if status != "REALIZADO":
            continue
        a["flown"] += 1
        a["numbers"].add(number.lstrip("0") or number)
        real = _ts(dep_real)
        if planned:
            a["by_hour"][planned.hour] += 1
            a["by_weekday"][planned.weekday()] += 1
            if real:
                delay = (real - planned).total_seconds() / 60
                a["delay_sum"] += max(delay, 0)
                a["delay_n"] += 1
                a["delayed15"] += delay > 15

    return [
        {
            "year": year, "month": month,
            "airline": cia, "airline_name": AIRLINE_NAMES.get(cia),
            "origin": iata.get(orig, orig), "destination": iata.get(dest, dest),
            "origin_icao": orig, "destination_icao": dest, "line_type": line,
            "planned": a["planned"], "flown": a["flown"], "cancelled": a["cancelled"],
            "delayed15": a["delayed15"],
            "avg_delay_min": round(a["delay_sum"] / a["delay_n"], 1) if a["delay_n"] else None,
            "by_hour": a["by_hour"], "by_weekday": a["by_weekday"],
            "flight_numbers": sorted(a["numbers"]),
        }
        for (cia, orig, dest, line), a in acc.items()
        if a["planned"] or a["flown"]
    ]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--months", type=int, default=12, help="ultimos N meses")
    parser.add_argument("--from", dest="start", help="AAAA-MM inicial")
    parser.add_argument("--to", dest="end", help="AAAA-MM final")
    args = parser.parse_args()

    load_dotenv()
    supa = db.get_client()
    if supa is None:
        print("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1

    today = date.today()
    end = date(int(args.end[:4]), int(args.end[5:7]), 1) if args.end else today.replace(day=1)
    if args.start:
        start = date(int(args.start[:4]), int(args.start[5:7]), 1)
    else:
        y, m = end.year, end.month - args.months
        while m <= 0:
            y, m = y - 1, m + 12
        start = date(y, m, 1)

    total = 0
    with httpx.Client(headers={"User-Agent": UA}, timeout=300, follow_redirects=True) as http:
        iata = icao_to_iata(http)
        for y, m in month_range(start, end):
            path = CACHE_DIR / f"VRA_{y}{m:02d}.csv"
            # o mes corrente/recente pode ser republicado: sempre baixa de novo os 2 ultimos
            if (today.year * 12 + today.month) - (y * 12 + m) <= 2:
                path.unlink(missing_ok=True)
            if not download(vra_url(y, m), path, http):
                print(f"  -- {y}-{m:02d}: nao publicado")
                continue
            rows = parse_month(path, y, m, iata)
            if not rows:
                print(f"  -- {y}-{m:02d}: arquivo vazio")
                path.unlink(missing_ok=True)
                continue
            for i in range(0, len(rows), 500):
                supa.table("anac_flights").upsert(
                    rows[i:i + 500], on_conflict="year,month,airline,origin_icao,destination_icao,line_type"
                ).execute()
            total += len(rows)
            flown = sum(r["flown"] for r in rows)
            print(f"  ok {y}-{m:02d}: {flown:,} voos realizados, {len(rows)} cia x trecho")
            time.sleep(random.uniform(1.5, 4))

    print(f"\n{total} linhas em anac_flights")
    return 0


if __name__ == "__main__":
    sys.exit(main())
