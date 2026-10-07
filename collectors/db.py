"""Camada de banco (Supabase). Opcional: sem credenciais o coletor
funciona em modo "so bruto", gravando JSON em disco.
"""
from __future__ import annotations

import os

from .models import RouteSpec


def get_client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    from supabase import create_client

    return create_client(url, key)


def ensure_route(client, spec: RouteSpec) -> str:
    """Garante que a rota existe em `routes` e retorna o id."""
    res = (
        client.table("routes")
        .upsert(
            {
                "origin": spec.origin,
                "destination": spec.destination,
                "kind": spec.kind,
                "priority": spec.priority,
            },
            on_conflict="origin,destination",
        )
        .execute()
    )
    return res.data[0]["id"]


def insert_observations(client, rows: list[dict]) -> None:
    if rows:
        client.table("fare_observations").insert(rows).execute()


def normalize_observations(route_id: str, payload: dict, raw_ref: str) -> list[dict]:
    """Uma linha por opcao de voo retornada.

    `airline` = primeira companhia da opcao (marketing carrier do 1o trecho);
    a lista completa fica no JSON bruto.
    """
    rows = []
    for opt in payload["options"]:
        if not opt["airlines"] or opt["price"] is None:
            continue
        rows.append(
            {
                "route_id": route_id,
                "airline": opt["airlines"][0],
                "collected_at": payload["collected_at"],
                "flight_date": payload["flight_date"],
                "return_date": payload["return_date"],
                "lead_days": payload["lead_days"],
                "trip_type": payload["trip_type"],
                "price": opt["price"],
                "currency": payload["currency"],
                "price_brl": opt["price"],
                "stops": max(len(opt["legs"]) - 1, 0),
                "source": payload["source"],
                "raw_ref": raw_ref,
            }
        )
    return rows
