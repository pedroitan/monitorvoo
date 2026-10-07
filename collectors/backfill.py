"""Reprocessa JSONs brutos locais (raw/AAAA-MM-DD/*.json) para o Supabase.

Util para popular o banco com coletas feitas em modo local ou reprocessar
o historico quando a normalizacao mudar.

    python -m collectors.backfill
"""
from __future__ import annotations

import json
import sys

from dotenv import load_dotenv

from . import db
from .models import load_routes
from .storage import RAW_DIR


def main() -> int:
    load_dotenv()
    client = db.get_client()
    if client is None:
        print("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1

    routes = {r.code: r for r in load_routes()}
    route_ids: dict[str, str] = {}
    files = sorted(RAW_DIR.rglob("*.json"))
    total = 0

    for f in files:
        payload = json.loads(f.read_text(encoding="utf-8"))
        code = f"{payload['origin']}-{payload['destination']}"
        if code not in routes:
            print(f"  {f.name}: rota {code} fora do seed, pulando")
            continue
        if code not in route_ids:
            route_ids[code] = db.ensure_route(client, routes[code])

        key = f"{payload['collected_at'][:10]}/{f.name}"
        client.storage.from_("raw").upload(
            key,
            f.read_bytes(),
            {"content-type": "application/json", "upsert": "true"},
        )
        rows = db.normalize_observations(route_ids[code], payload, f"raw/{key}")
        db.insert_observations(client, rows)
        total += len(rows)
        print(f"  {f.name}: {len(rows)} obs")

    print(f"\n{len(files)} arquivos -> {total} observacoes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
