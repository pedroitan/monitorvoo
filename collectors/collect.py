"""Orquestrador da coleta diaria.

Uso:
    python -m collectors.collect                          # tudo
    python -m collectors.collect --route GRU-SSA          # uma rota
    python -m collectors.collect --leads 7,30 --trips one-way
    python -m collectors.collect --max-calls 3 --no-delay # smoke test
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timezone

from dotenv import load_dotenv

from . import db, storage
from .models import TRIP_TYPES, RouteSpec, load_routes
from .sources import google_flights

SOURCES = {"google_flights": google_flights.fetch}


def parse_csv(value: str, cast=str):
    return [cast(v.strip()) for v in value.split(",") if v.strip()]


def collect_route(
    spec: RouteSpec,
    client,
    leads: list[int] | None,
    trips: list[str] | None,
    delay: tuple[float, float] | None,
    max_calls: int,
    calls: int,
) -> int:
    route_id = db.ensure_route(client, spec) if client else None

    for lead in leads or list(spec.lead_times):
        for trip in trips or list(TRIP_TYPES):
            if calls >= max_calls:
                return calls
            label = f"{spec.code} {trip} {lead}d"
            payload = None
            for attempt in range(2):
                try:
                    payload = SOURCES["google_flights"](
                        spec.origin, spec.destination, lead, trip
                    )
                    break
                except RuntimeError as exc:
                    is_rate = "no flights found" in str(exc)
                    if attempt == 0:
                        sleep = random.uniform(25, 55) if is_rate else random.uniform(5, 15)
                        print(f"  retry {label} ({exc}; esperando {sleep:.0f}s)", file=sys.stderr)
                        time.sleep(sleep)
                    else:
                        print(f"  ERRO {label}: {exc}", file=sys.stderr)
                except Exception as exc:
                    if attempt == 0:
                        sleep = random.uniform(5, 15)
                        print(f"  retry {label} ({exc}; esperando {sleep:.0f}s)", file=sys.stderr)
                        time.sleep(sleep)
                    else:
                        print(f"  ERRO {label}: {exc}", file=sys.stderr)
            if payload is None:
                calls += 1
                continue

            payload["collected_at"] = datetime.now(timezone.utc).isoformat()
            raw_ref = storage.save_raw(payload, client)
            if client:
                try:
                    rows = db.normalize_observations(route_id, payload, raw_ref)
                    db.insert_observations(client, rows)
                except Exception as exc:
                    # bruto ja esta salvo; falha de escrita nao derruba o lote
                    print(f"  ERRO DB {label}: {exc}", file=sys.stderr)

            best = min((o["price"] for o in payload["options"]), default=None)
            print(f"  ok {label}: {len(payload['options'])} opcoes, menor R$ {best} -> {raw_ref}")
            calls += 1

            if delay and calls < max_calls:
                time.sleep(random.uniform(*delay))
    return calls


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--route", help="codigo da rota, ex.: GRU-SSA")
    parser.add_argument("--leads", help="antecedencias em dias, ex.: 7,30")
    parser.add_argument("--trips", help="tipos, ex.: one-way,round-trip")
    parser.add_argument("--priority", type=int, default=10, help="coletar rotas com prioridade <= N")
    parser.add_argument("--max-calls", type=int, default=10**9)
    parser.add_argument("--no-delay", action="store_true")
    args = parser.parse_args()

    load_dotenv()
    client = db.get_client()
    print("Modo:", "Supabase" if client else "local (so JSON bruto)")

    routes = [r for r in load_routes() if r.priority <= args.priority]
    if args.route:
        routes = [r for r in routes if r.code == args.route.upper()]
        if not routes:
            print(f"Rota {args.route} nao encontrada em routes.json", file=sys.stderr)
            return 1

    leads = parse_csv(args.leads, int) if args.leads else None
    trips = parse_csv(args.trips) if args.trips else None
    delay = None if args.no_delay else (
        float(os.environ.get("COLLECT_DELAY_MIN", 5)),
        float(os.environ.get("COLLECT_DELAY_MAX", 15)),
    )

    calls = 0
    started = time.time()
    for spec in routes:
        calls = collect_route(spec, client, leads, trips, delay, args.max_calls, calls)
        if calls >= args.max_calls:
            break

    print(f"\n{calls} chamadas em {time.time() - started:.0f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
