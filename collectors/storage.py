"""Persistencia da resposta bruta de cada coleta.

Com SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY configurados, sobe para o bucket
`raw/` do Supabase Storage. Sem credenciais, grava em ./raw/ local — util para
desenvolvimento e testes.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from uuid import uuid4

RAW_DIR = Path(__file__).resolve().parent.parent / "raw"


def save_raw(payload: dict, supabase_client=None) -> str:
    """Salva o payload bruto e retorna a referencia (key/caminho)."""
    day = payload["collected_at"][:10]
    key = f"{day}/{payload['origin']}-{payload['destination']}-{payload['trip_type']}-{payload['lead_days']}d-{uuid4().hex[:8]}.json"
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    if supabase_client is not None:
        supabase_client.storage.from_("raw").upload(key, data, {"content-type": "application/json"})
        return f"raw/{key}"

    path = RAW_DIR / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return str(path)
