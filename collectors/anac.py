"""Ingestao dos microdados de tarifas ANAC -> tabela anac_fares.

Baixa os CSVs mensais (domesticas + internacionais) do servidor publico da
ANAC, filtra os pares de aeroportos monitorados e grava a tarifa media
ponderada por assentos, por cia/rota/mes.

    python -m collectors.anac                # ultimos 12 meses
    python -m collectors.anac --months 36
    python -m collectors.anac --from 2022-01 --to 2025-12
"""
from __future__ import annotations

import argparse
import csv
import random
import sys
import time
from collections import defaultdict
from datetime import date
from pathlib import Path

import httpx
from dotenv import load_dotenv

from . import db
from .models import load_routes
from .storage import RAW_DIR

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) monitorvoo-data"
CACHE_DIR = RAW_DIR / "anac"

# Aeroportos das rotas monitoradas (IATA -> ICAO, como vem na ANAC)
IATA_ICAO = {
    "GRU": "SBGR", "CGH": "SBSP", "SDU": "SBRJ", "GIG": "SBGL",
    "SSA": "SBSV", "REC": "SBRF", "FOR": "SBFZ", "BSB": "SBBR",
    "POA": "SBPA", "CNF": "SBCF", "MAO": "SBEG", "BEL": "SBBE",
    "FLN": "SBFL", "VCP": "SBKP",
    "LIS": "LPPT", "MIA": "KMIA", "MCO": "KMCO", "EZE": "SAEZ",
    "SCL": "SCEL", "CDG": "LFPG", "MAD": "LEMD", "JFK": "KJFK",
}
ICAO_IATA = {v: k for k, v in IATA_ICAO.items()}

# ICAO da cia -> nome usado em fare_observations
AIRLINE_NAMES = {
    "GLO": "Gol", "TAM": "LATAM", "AZU": "Azul", "ADN": "Azul",
    "TPL": "Tap Air Portugal", "AAL": "American", "UAL": "United",
    "IBE": "Iberia", "AFR": "Air France", "AEA": "Air Europa",
    "ARG": "Aerolineas Argentinas", "CMP": "COPA", "AVA": "Avianca",
    "ACA": "Air Canada", "KLM": "KLM", "SWR": "SWISS", "THY": "Turkish Airlines",
    "ITY": "ITA", "AMX": "Aeromexico", "VIR": "Virgin Atlantic",
    "DLH": "Lufthansa", "BAW": "British Airways", "UAE": "Emirates",
    "QTR": "Qatar Airways", "ETH": "Ethiopian", "SAA": "South African",
    "BOL": "BoA", "LAN": "LATAM", "LPE": "LATAM", "PUC": "JetSmart",
    "SKU": "Sky Airline", "FBZ": "Flybondi", "JAT": "JetSMART",
}


def monitored_icao_pairs() -> set[tuple[str, str]]:
    """Pares ICAO (ambas as direcoes) das rotas do seed."""
    pairs = set()
    for r in load_routes():
        o, d = IATA_ICAO.get(r.origin), IATA_ICAO.get(r.destination)
        if o and d:
            pairs.add((o, d))
            pairs.add((d, o))
    return pairs


def file_url(domestic: bool, year: int, month: int) -> str:
    if domestic:
        return f"https://sas.anac.gov.br/sas/tarifadomestica/{year}/{year}{month:02d}.csv"
    return f"https://sas.anac.gov.br/sas/tarifainternacional/{year}/Internacional_{year}-{month:02d}.csv"


def download(url: str, dest: Path, client: httpx.Client, retries: int = 4) -> bool:
    if dest.exists() and dest.stat().st_size > 0:
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(retries):
        try:
            resp = client.get(url)
            if resp.status_code == 200:
                dest.write_bytes(resp.content)
                return True
            if resp.status_code == 404:
                return False
        except httpx.HTTPError:
            pass
        time.sleep(5 * (attempt + 1) + random.uniform(0, 5))
    return False


# Arquivos antigos (<=2024) usam nomes curtos; novos usam nr_*/sg_*
COL_ALIASES = {
    "year": ("nr_ano_referencia", "ANO"),
    "month": ("nr_mes_referencia", "MES"),
    "airline": ("sg_empresa_icao", "EMPRESA"),
    "origin": ("sg_icao_origem", "ORIGEM"),
    "destination": ("sg_icao_destino", "DESTINO"),
    "fare": ("nr_tarifa", "TARIFA"),
    "seats": ("nr_assentos", "ASSENTOS"),
}


def parse_month(path: Path, pairs: set[tuple[str, str]], currency: str) -> list[dict]:
    """Agrega (cia, origem, destino) -> tarifa media ponderada, assentos."""
    acc: dict[tuple[str, str, str], list[float]] = defaultdict(lambda: [0.0, 0])
    year = month = None
    with open(path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f, delimiter=";")
        cols = {
            k: next((c for c in aliases if c in (reader.fieldnames or [])), None)
            for k, aliases in COL_ALIASES.items()
        }
        if not all(cols.values()):
            raise ValueError(f"colunas nao reconhecidas em {path.name}: {reader.fieldnames}")
        for row in reader:
            year, month = int(row[cols["year"]]), int(row[cols["month"]])
            key = (row[cols["airline"]], row[cols["origin"]], row[cols["destination"]])
            if (key[1], key[2]) not in pairs:
                continue
            try:
                fare = float(row[cols["fare"]].replace(",", "."))
                seats = int(float((row[cols["seats"]] or "0").replace(",", ".")))
            except ValueError:
                continue
            acc[key][0] += fare * seats
            acc[key][1] += seats

    return [
        {
            "year": year,
            "month": month,
            "airline": AIRLINE_NAMES.get(cia, cia),
            "origin": ICAO_IATA[orig],
            "destination": ICAO_IATA[dest],
            "fare": round(total / seats, 2),
            "seats": seats,
            "currency": currency,
        }
        for (cia, orig, dest), (total, seats) in acc.items()
        if seats > 0
    ]


def month_range(start: date, end: date) -> list[tuple[int, int]]:
    out = []
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        out.append((y, m))
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


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
    if args.start:
        start = date(int(args.start[:4]), int(args.start[5:7]), 1)
    else:
        m = today.month - args.months + 1
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        start = date(y, m, 1)
    if args.end:
        end = date(int(args.end[:4]), int(args.end[5:7]), 1)
    else:
        # defasagem tipica de ~2-3 meses na publicacao
        m = today.month - 3
        y = today.year
        if m <= 0:
            m += 12
            y -= 1
        end = date(y, m, 1)

    pairs = monitored_icao_pairs()
    months = month_range(start, end)
    print(f"Periodo: {start:%Y-%m} a {end:%Y-%m} ({len(months)} meses x 2 arquivos)")

    inserted = 0
    misses = 0
    with httpx.Client(headers={"User-Agent": UA}, timeout=300, follow_redirects=True) as http:
        for y, m in months:
            for domestic in (True, False):
                url = file_url(domestic, y, m)
                path = CACHE_DIR / url.rsplit("/", 1)[-1]
                try:
                    ok = download(url, path, http)
                except httpx.HTTPError as exc:
                    print(f"  ERRO {url}: {exc}", file=sys.stderr)
                    ok = False
                if not ok:
                    misses += 1
                    print(f"  -- {y}-{m:02d} {'dom' if domestic else 'int'}: nao disponivel")
                    if misses > 6 and (y, m) == months[-1]:
                        print("  (fim dos dados publicados)")
                    continue
                misses = 0
                rows = parse_month(path, pairs, "BRL" if domestic else "USD")
                if rows:
                    supa.table("anac_fares").upsert(
                        rows, on_conflict="year,month,airline,origin,destination"
                    ).execute()
                    inserted += len(rows)
                print(f"  ok {y}-{m:02d} {'dom' if domestic else 'int'}: {len(rows)} linhas")
                time.sleep(random.uniform(1.5, 4))

    print(f"\n{inserted} linhas agregadas em anac_fares")
    return 0


if __name__ == "__main__":
    sys.exit(main())
