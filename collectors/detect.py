"""Deteccao de promocoes (PRD: "Deteccao de promocoes e tendencias").

Para cada serie rota x cia x antecedencia x tipo:
  z = (preco_t - mediana_28d) / (1.4826 * MAD_28d)
  z <= -2  -> "preco baixo"
  z <= -3 ou queda >= 30% da mediana -> "possivel promocao"

Se >=30% das series da mesma cia disparam no mesmo dia -> campanha
(registrada em promo_events, com inicio/fim/duracao/desconto medio).

    python -m collectors.detect            # avalia a coleta mais recente
    python -m collectors.detect --verbose
"""
from __future__ import annotations

import argparse
import statistics
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

from . import db

WINDOW_DAYS = 28
MIN_POINTS = 10          # minimo de coletas na janela para julgar
CAMPAIGN_SHARE = 0.30    # % das series da cia disparando vira campanha

LOW_Z = -2.0
PROMO_Z = -3.0
PROMO_DROP = 0.30        # queda >= 30% vs mediana


def load_series(client) -> dict[tuple, list[tuple[datetime, float]]]:
    """Agrupa observacoes em series: (route, cia, trip, lead) -> [(ts, min_preco)]."""
    series: dict[tuple, dict[datetime, float]] = defaultdict(dict)
    page = 0
    while True:
        res = (
            client.table("fare_observations")
            .select("route_id, airline, trip_type, lead_days, collected_at, price_brl")
            .range(page * 1000, (page + 1) * 1000 - 1)
            .execute()
        )
        for r in res.data:
            ts = datetime.fromisoformat(r["collected_at"])
            key = (r["route_id"], r["airline"], r["trip_type"], r["lead_days"])
            if ts not in series[key] or r["price_brl"] < series[key][ts]:
                series[key][ts] = r["price_brl"]
        if len(res.data) < 1000:
            break
        page += 1
    return {k: sorted(v.items()) for k, v in series.items()}


def zscore(points: list[tuple[datetime, float]], t: datetime, min_points: int) -> tuple[float, float] | None:
    """z robusto do ponto em t contra a janela de 28d anteriores."""
    base = [p for ts, p in points if t - timedelta(days=WINDOW_DAYS) <= ts < t]
    if len(base) < min_points:
        return None
    med = statistics.median(base)
    mad = statistics.median([abs(p - med) for p in base])
    if mad == 0:
        return None
    price = dict(points)[t]
    return (price - med) / (1.4826 * mad), med


def classify(z: float, price: float, med: float) -> str | None:
    drop = (med - price) / med if med else 0
    if z <= PROMO_Z or drop >= PROMO_DROP:
        return "promo"
    if z <= LOW_Z:
        return "low"
    return None


def detect(client, verbose=False, min_points: int = MIN_POINTS) -> dict:
    series = load_series(client)
    latest_ts = max(ts for pts in series.values() for ts, _ in pts)

    flagged: dict[str, list[tuple]] = defaultdict(list)   # airline -> [(key, price, med)]
    totals: dict[str, int] = defaultdict(int)

    for key, points in series.items():
        airline = key[1]
        totals[airline] += 1
        out = zscore(points, points[-1][0], min_points)
        if out is None:
            continue
        z, med = out
        flag = classify(z, points[-1][1], med)
        if verbose:
            print(f"  {key[0][:8]} {airline:<10} {key[2]:<10} {key[3]:>3}d  "
                  f"z={z:+.2f} med={med:.0f} p={points[-1][1]:.0f} -> {flag or '-'}")
        if flag == "promo":
            flagged[airline].append((key, points[-1][1], med))

    return {"latest_ts": latest_ts, "flagged": flagged, "totals": totals}


def upsert_campaigns(client, result: dict, verbose=False) -> None:
    day = result["latest_ts"].date().isoformat()
    for airline, hits in result["flagged"].items():
        share = len(hits) / result["totals"][airline]
        if share < CAMPAIGN_SHARE:
            continue
        routes = sorted({k[0] for k, _, _ in hits})
        avg_disc = sum((med - p) / med for _, p, med in hits) / len(hits) * 100

        open_ev = (
            client.table("promo_events")
            .select("id")
            .eq("airline", airline)
            .is_("ended_at", "null")
            .execute()
        )
        if open_ev.data:
            client.table("promo_events").update(
                {"affected_routes": routes, "avg_discount_pct": round(avg_disc, 1)}
            ).eq("id", open_ev.data[0]["id"]).execute()
            if verbose:
                print(f"  campanha {airline} atualizada ({len(routes)} rotas)")
        else:
            client.table("promo_events").insert(
                {
                    "airline": airline,
                    "started_at": day,
                    "affected_routes": routes,
                    "avg_discount_pct": round(avg_disc, 1),
                    "signal_source": "zscore",
                }
            ).execute()
            if verbose:
                print(f"  CAMPANHA {airline}: {len(routes)} rotas, -{avg_disc:.0f}%")

    # fecha campanhas de cias sem sinal na coleta mais recente
    open_events = (
        client.table("promo_events").select("id, airline").is_("ended_at", "null").execute()
    )
    for ev in open_events.data:
        if ev["airline"] not in result["flagged"]:
            client.table("promo_events").update({"ended_at": day}).eq("id", ev["id"]).execute()
            if verbose:
                print(f"  campanha {ev['airline']} encerrada")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--min-points", type=int, default=MIN_POINTS)
    args = ap.parse_args()

    load_dotenv()
    client = db.get_client()
    if client is None:
        print("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1

    result = detect(client, args.verbose, args.min_points)
    if not result["flagged"]:
        print(f"Sem promocoes na coleta de {result['latest_ts']:%Y-%m-%d %H:%M} UTC "
              f"(series avaliadas: {sum(result['totals'].values())})")
    else:
        for a, hits in result["flagged"].items():
            print(f"  promo {a}: {len(hits)} series ({len(hits)/result['totals'][a]:.0%})")
    upsert_campaigns(client, result, args.verbose)
    return 0


if __name__ == "__main__":
    sys.exit(main())
