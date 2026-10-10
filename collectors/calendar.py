"""Coleta de calendario de precos para rotas prioritarias.

Busca todas as datas de partida numa janela (padrao 30 dias), tanto so ida
quanto ida e volta (volta = partida + 7 dias), para um grupo pequeno de rotas.
Objetivo: construir uma grade completa de precos por data e acompanhar mudancas
intradiarias da companhias.
"""
from __future__ import annotations

import argparse
import random
import sys
import time
from datetime import date, datetime, timedelta, timezone

from dotenv import load_dotenv

from . import db, storage
from .models import RouteSpec, TRIP_TYPES
from .sources import google_flights

WINDOW_DAYS = 30
ROUND_TRIP_DAYS = 7
DELAY = (3, 6)
RETRIES = 2

CALENDAR_ROUTES = [
    ("SSA", "GRU", "nacional"),
    ("GRU", "SSA", "nacional"),
    ("GRU", "BOG", "internacional"),
    ("BOG", "GRU", "internacional"),
    ("GRU", "SID", "internacional"),
    ("SID", "GRU", "internacional"),
    ("GRU", "MAD", "internacional"),
    ("MAD", "GRU", "internacional"),
]


def calendar_routes() -> list[RouteSpec]:
    return [RouteSpec(origin=o, destination=d, kind=k, priority=10) for o, d, k in CALENDAR_ROUTES]


def run(window: int = WINDOW_DAYS, max_calls: int | None = None, dry: bool = False) -> int:
    load_dotenv()
    client = None
    if not dry:
        try:
            client = db.get_client()
        except Exception as exc:
            print(f"Supabase indisponivel ({exc}); gravando localmente", file=sys.stderr)

    today = date.today()
    routes = calendar_routes()
    calls = 0
    skipped_no_results = 0

    for spec in routes:
        route_id = db.ensure_route(client, spec) if client else None
        for days_ahead in range(1, window + 1):
            outbound = today + timedelta(days=days_ahead)
            for trip in TRIP_TYPES:
                if max_calls is not None and calls >= max_calls:
                    print(f"Limite de {max_calls} chamadas atingido.")
                    return calls

                inbound = outbound + timedelta(days=ROUND_TRIP_DAYS) if trip == "round-trip" else None
                label = f"{spec.code} {trip} {outbound.isoformat()}"

                payload = None
                for attempt in range(RETRIES + 1):
                    try:
                        payload = google_flights.fetch_calendar(
                            spec.origin, spec.destination, outbound, trip, inbound
                        )
                        break
                    except RuntimeError as exc:
                        is_rate = "no flights found" in str(exc)
                        if attempt < RETRIES:
                            sleep = random.uniform(20, 45) if is_rate else random.uniform(5, 10)
                            print(f"  retry {label} ({exc}; esperando {sleep:.0f}s)", file=sys.stderr)
                            time.sleep(sleep)
                            continue
                        print(f"  ERRO {label}: {exc}", file=sys.stderr)
                    except Exception as exc:
                        if attempt < RETRIES:
                            sleep = random.uniform(5, 10)
                            print(f"  retry {label} ({exc}; esperando {sleep:.0f}s)", file=sys.stderr)
                            time.sleep(sleep)
                            continue
                        print(f"  ERRO {label}: {exc}", file=sys.stderr)

                if payload is None:
                    calls += 1
                elif not payload["options"]:
                    print(f"  sem resultados {label}")
                    skipped_no_results += 1
                    calls += 1
                else:
                    payload["collected_at"] = datetime.now(timezone.utc).isoformat()
                    raw_ref = storage.save_raw(payload, client)
                    if client:
                        rows = db.normalize_observations(route_id, payload, raw_ref)
                        db.insert_observations(client, rows)

                    best = min(
                        (o["price"] for o in payload["options"] if o["price"] is not None),
                        default=None,
                    )
                    print(f"  ok {label}: {len(payload['options'])} opcoes, menor R$ {best}")
                    calls += 1

                if max_calls is None or calls < max_calls:
                    time.sleep(random.uniform(*DELAY))

    print(f"Total: {calls} chamadas, {skipped_no_results} sem resultados")
    return calls


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--window", type=int, default=WINDOW_DAYS, help="dias de janela de partida")
    parser.add_argument("--max-calls", type=int, default=None, help="limite de chamadas (teste)")
    parser.add_argument("--dry", action="store_true", help="nao grava no Supabase")
    args = parser.parse_args()
    return run(args.window, args.max_calls, args.dry)


if __name__ == "__main__":
    main()
