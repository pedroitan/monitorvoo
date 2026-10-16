"""Coletor do estudo de caso Colombia (PRD V3, secao 4).

Feito para rodar de hora em hora (Task Scheduler). Cada execucao:
  A — painel horario: mesmas buscas toda hora (ida e volta + 2 so ida)
  C — fila sob demanda: datas buscadas no site (search_requests)
  D — malha Brasil: trechos com voo ~diario na ANAC VRA, algumas antecedencias;
      o volume por hora sobe devagar e cai pela metade a cada bloqueio
  B — grade de datas: fatia da grade que vence nesta hora
      * so ida, todos os pares e sentidos, D+7..D+120
      * so ida, pares principais, D+121..D+270 (ferias de julho)
      * ida e volta, pares principais, D+7..D+120, estadias de 7/10/14 dias

Toda chamada vira uma linha em collection_runs (ok/empty/error/blocked).

Uso:
    python -m collectors.study                 # execucao horaria normal
    python -m collectors.study --plan          # so mostra o que faria
    python -m collectors.study --layers A --max-calls 3
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import random
import sys
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv

from . import db, storage
from .models import RouteSpec
from .sources import google_flights
from .sources.google_flights import BlockedError

BRT = timezone(timedelta(hours=-3))
ROOT = Path(__file__).resolve().parent.parent

ORIGINS = ("SSA", "GRU", "CGH")
DESTINATIONS = ("BOG", "MDE", "CTG", "CLO", "BAQ", "SMR", "PEI")
# Pares do painel horario: 4 Colombia + SSA-CGH para comparar o comportamento nacional.
PANEL_PAIRS = (("GRU", "BOG"), ("GRU", "MDE"), ("GRU", "CTG"), ("SSA", "BOG"), ("SSA", "CGH"))

# Os pares de datas do painel ficam fixos por ciclo de 4 semanas, para que a
# mesma viagem seja observada hora a hora (Q1) e conforme o voo se aproxima.
PANEL_EPOCH = date(2026, 10, 11)
PANEL_CYCLE_DAYS = 28
GRID_EPOCH = datetime(2026, 10, 11, tzinfo=BRT)
GRID_DAYS = (7, 120)
GRID_SHORT_UNTIL = 30          # D+7..D+30 atualizado com mais frequencia
GRID_PERIOD_H = {"short": 48, "long": 96, "far": 168, "rt": 120}
GRID_FAR_DAYS = (121, 270)
RT_STAYS = (7, 10, 14)
# Pares com mais procura: recebem horizonte longo e ida e volta na grade.
MAIN_PAIRS = tuple((o, d) for o in ("GRU", "SSA") for d in ("BOG", "MDE", "CTG"))
# Pares em que ~20-95% das buscas voltam sem voo (analise de out/2026): 3x mais espacados.
LOW_YIELD = {
    frozenset(p) for p in (
        ("SSA", "BAQ"), ("SSA", "SMR"), ("SSA", "PEI"), ("SSA", "CLO"),
        ("CGH", "BAQ"), ("CGH", "SMR"), ("CGH", "PEI"),
    )
}
LOW_YIELD_FACTOR = 3
BRAZIL_LEADS = (7, 21, 45, 90)
BRAZIL_MIN_FLIGHTS = 30        # voos realizados no mes (VRA) para entrar na malha (~1/dia)
BRAZIL_BUDGET = {"start": 10, "min": 4, "step": 2}
BRAZIL_PRIORITY = 3            # rotas da malha nao aparecem na home do site
CATCHUP_HOURS = 12
MAX_GRID_PER_RUN = 180         # teto da grade por execucao (cabe em ~45 min com o painel)
MAX_REQUESTS_PER_HOUR = 2
MAX_RUNTIME_S = 50 * 60
MAX_CONSECUTIVE_BLOCKS = 3
DELAY = (5, 15)

log = logging.getLogger("study")


@dataclass(frozen=True)
class Query:
    layer: str
    origin: str
    destination: str
    out: date
    ret: date | None = None
    slot: str | None = None
    request_id: int | None = None
    kind: str | None = None        # "nacional"/"internacional" (camada D, vindo da VRA)

    @property
    def trip(self) -> str:
        return "round-trip" if self.ret else "one-way"

    @property
    def label(self) -> str:
        ret = f"/{self.ret}" if self.ret else ""
        return f"[{self.layer}] {self.origin}-{self.destination} {self.trip} {self.out}{ret}"


def today_brt() -> date:
    return datetime.now(BRT).date()


def panel_slots(today: date) -> list[tuple[str, date, date]]:
    cycle = PANEL_EPOCH + timedelta(days=(today - PANEL_EPOCH).days // PANEL_CYCLE_DAYS * PANEL_CYCLE_DAYS)
    peak_year = today.year if today <= date(today.year, 12, 11) else today.year + 1
    return [
        ("curto", cycle + timedelta(days=35), cycle + timedelta(days=42)),
        ("medio", cycle + timedelta(days=74), cycle + timedelta(days=81)),
        ("alta", date(peak_year, 12, 18), date(peak_year + 1, 1, 4)),
    ]


def layer_a(today: date) -> list[Query]:
    out = []
    for slot, dep, ret in panel_slots(today):
        for o, d in PANEL_PAIRS:
            out += [
                Query("A", o, d, dep, ret, slot),
                Query("A", o, d, dep, None, slot),
                Query("A", d, o, ret, None, slot),
            ]
    return out


def _bucket(key: str, period: int) -> int:
    return int(hashlib.md5(key.encode()).hexdigest(), 16) % period


def grid_hour(now: datetime) -> int:
    return int((now - GRID_EPOCH).total_seconds() // 3600)


def layer_b(now: datetime, slowdown: int, last_hour: int | None = None) -> list[Query]:
    """Fatia da grade que vence nesta hora: cada (rota, data) cai num balde
    fixo dentro do periodo, entao a carga fica espalhada ao longo do dia.
    Com `last_hour`, inclui tambem os baldes das horas perdidas desde entao
    (PC dormindo), ate CATCHUP_HOURS para tras."""
    hour_index = grid_hour(now)
    first = hour_index if last_hour is None else max(last_hour + 1, hour_index - CATCHUP_HOURS + 1)
    hours = range(min(first, hour_index), hour_index + 1)
    today = now.date()
    out = []

    def due(key: str, period: int) -> bool:
        period *= slowdown
        bucket = _bucket(key, period)
        return any(h % period == bucket for h in hours)

    for origin in ORIGINS:
        for dest in DESTINATIONS:
            factor = LOW_YIELD_FACTOR if frozenset((origin, dest)) in LOW_YIELD else 1
            main = (origin, dest) in MAIN_PAIRS
            for o, d in ((origin, dest), (dest, origin)):
                last = GRID_FAR_DAYS[1] if main else GRID_DAYS[1]
                for n in range(GRID_DAYS[0], last + 1):
                    dep = today + timedelta(days=n)
                    kind = "short" if n <= GRID_SHORT_UNTIL else "long" if n <= GRID_DAYS[1] else "far"
                    if due(f"{o}-{d}-{dep}", GRID_PERIOD_H[kind] * factor):
                        out.append(Query("B", o, d, dep))
            if main:
                for n in range(GRID_DAYS[0], GRID_DAYS[1] + 1):
                    dep = today + timedelta(days=n)
                    for stay in RT_STAYS:
                        if due(f"{origin}-{dest}-{dep}-rt{stay}", GRID_PERIOD_H["rt"]):
                            out.append(Query("B", origin, dest, dep, dep + timedelta(days=stay), f"rt{stay}"))
    random.shuffle(out)
    return out[:MAX_GRID_PER_RUN]


STATE_FILE = ROOT / "logs" / "study.state"


def read_state() -> dict:
    """{"grid_hour": int, "brazil_budget": int}. Aceita o formato antigo (so o inteiro)."""
    try:
        raw = STATE_FILE.read_text().strip()
    except OSError:
        return {}
    try:
        data = json.loads(raw)
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {"grid_hour": int(data)}


def write_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(exist_ok=True)
    STATE_FILE.write_text(json.dumps(state))


def brazil_max() -> int:
    return int(os.environ.get("STUDY_BRAZIL_MAX", "120"))


def next_brazil_budget(budget: int, stats: dict[str, int], timed_out: bool) -> int:
    """Sobe devagar enquanto o Google aceita; corta pela metade no primeiro bloqueio."""
    calls = sum(stats.values())
    blocked = sum(v for k, v in stats.items() if k.endswith(":blocked"))
    errors = sum(v for k, v in stats.items() if k.endswith(":error"))
    if blocked:
        return max(BRAZIL_BUDGET["min"], budget // 2)
    if calls and errors / calls > 0.2:
        return max(BRAZIL_BUDGET["min"], int(budget * 0.8))
    if timed_out:
        return budget
    return min(brazil_max(), budget + BRAZIL_BUDGET["step"])


def layer_d(client, now: datetime, budget: int) -> list[Query]:
    """Malha Brasil: trechos com voo ~diario na VRA x BRAZIL_LEADS, so ida.
    Cada (trecho, antecedencia) cai num balde; o numero de baldes e ajustado
    para que ~`budget` buscas vencam por hora."""
    if client is None or budget <= 0:
        return []
    try:
        rows = (
            client.table("anac_routes_latest").select("origin, destination, line_type, flights")
            .gte("flights", BRAZIL_MIN_FLIGHTS).execute().data
        )
    except Exception as exc:
        log.warning("malha Brasil indisponivel (migration 0005 / ingestao VRA?): %s", exc)
        return []
    study = {frozenset((o, d)) for o in ORIGINS for d in DESTINATIONS}
    routes = sorted(
        (r["origin"], r["destination"], "nacional" if r["line_type"] == "N" else "internacional")
        for r in rows
        if len(r["origin"]) == 3 and len(r["destination"]) == 3
        and frozenset((r["origin"], r["destination"])) not in study
    )
    items = [(o, d, k, lead) for o, d, k in routes for lead in BRAZIL_LEADS]
    if not items:
        return []
    period = max(1, -(-len(items) // budget))
    hour = grid_hour(now)
    today = now.date()
    out = [
        Query("D", o, d, today + timedelta(days=lead), slot=f"d{lead}", kind=kind)
        for o, d, kind, lead in items
        if hour % period == _bucket(f"D-{o}-{d}-{lead}", period)
    ]
    random.shuffle(out)
    return out


def layer_c(client) -> list[Query]:
    if client is None:
        return []
    rows = (
        client.table("search_requests").select("*").eq("status", "pending")
        .order("requested_at").limit(MAX_REQUESTS_PER_HOUR).execute().data
    )
    out = []
    for r in rows:
        dep = date.fromisoformat(r["out_date"])
        ret = date.fromisoformat(r["ret_date"]) if r["ret_date"] else None
        out.append(Query("C", r["origin"], r["destination"], dep, ret, request_id=r["id"]))
        if ret:
            out.append(Query("C", r["origin"], r["destination"], dep, request_id=r["id"]))
            out.append(Query("C", r["destination"], r["origin"], ret, request_id=r["id"]))
    return out


class Runner:
    def __init__(self, client, batch_id: str):
        self.client = client
        self.batch_id = batch_id
        self.route_ids: dict[str, str] = {}
        self.blocks_in_row = 0
        self.stats: dict[str, int] = {}

    def route_id(self, q: "Query") -> str | None:
        if self.client is None:
            return None
        code = f"{q.origin}-{q.destination}"
        if code not in self.route_ids:
            # rota existente mantem prioridade/tipo (nao rebaixa as do coletor classico)
            found = (
                self.client.table("routes").select("id").eq("origin", q.origin)
                .eq("destination", q.destination).limit(1).execute().data
            )
            if found:
                self.route_ids[code] = found[0]["id"]
            else:
                kind = q.kind or ("nacional" if {q.origin, q.destination} <= {"SSA", "GRU", "CGH"} else "internacional")
                priority = BRAZIL_PRIORITY if q.layer == "D" else 2
                self.route_ids[code] = db.ensure_route(
                    self.client, RouteSpec(q.origin, q.destination, kind, priority=priority)
                )
        return self.route_ids[code]

    def fetch(self, q: Query) -> tuple[str, dict | None, str | None]:
        for attempt in range(2):
            try:
                payload = google_flights.fetch_calendar(q.origin, q.destination, q.out, q.trip, q.ret)
                return ("ok" if payload["options"] else "empty"), payload, None
            except BlockedError as exc:
                status, error, wait = "blocked", str(exc), random.uniform(30, 60)
            except Exception as exc:
                status, error, wait = "error", f"{type(exc).__name__}: {exc}", random.uniform(5, 10)
            if attempt == 0:
                log.warning("retry %s (%s; %.0fs)", q.label, error, wait)
                time.sleep(wait)
        return status, None, error

    def run(self, q: Query) -> str:
        started = time.monotonic()
        status, payload, error = self.fetch(q)
        duration_ms = int((time.monotonic() - started) * 1000)
        route_id = self.route_id(q)

        raw_ref = None
        prices = [o["price"] for o in (payload or {}).get("options", []) if o["price"] is not None]
        if payload:
            payload["collected_at"] = datetime.now(timezone.utc).isoformat()
            payload["layer"] = q.layer
            payload["slot"] = q.slot
            raw_ref = storage.save_raw(payload, self.client, compress=True)

        if self.client is not None:
            run = self.client.table("collection_runs").insert({
                "batch_id": self.batch_id,
                "layer": q.layer,
                "slot": q.slot,
                "route_id": route_id,
                "origin": q.origin,
                "destination": q.destination,
                "flight_date": q.out.isoformat(),
                "return_date": q.ret.isoformat() if q.ret else None,
                "trip_type": q.trip,
                "status": status,
                "n_options": len(payload["options"]) if payload else None,
                "min_price": min(prices) if prices else None,
                "duration_ms": duration_ms,
                "error": error,
                "raw_ref": raw_ref,
            }).execute().data[0]
            if status == "ok":
                rows = db.normalize_observations(route_id, payload, raw_ref)
                for r in rows:
                    r.update(run_id=run["id"], layer=q.layer)
                db.insert_observations(self.client, rows)

        self.blocks_in_row = self.blocks_in_row + 1 if status == "blocked" else 0
        self.stats[f"{q.layer}:{status}"] = self.stats.get(f"{q.layer}:{status}", 0) + 1
        best = f"menor R$ {min(prices):.0f}" if prices else ""
        log.info("%-7s %s %s", status, q.label, best)
        return status


def acquire_lock() -> Path | None:
    lock = ROOT / "logs" / "study.lock"
    lock.parent.mkdir(exist_ok=True)
    if lock.exists() and time.time() - lock.stat().st_mtime < MAX_RUNTIME_S + 300:
        return None
    lock.write_text(str(os.getpid()))
    return lock


def setup_logging() -> None:
    logs = ROOT / "logs"
    logs.mkdir(exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%Y-%m-%d %H:%M:%S")
    file = logging.FileHandler(logs / f"study-{today_brt()}.log", encoding="utf-8")
    console = logging.StreamHandler(sys.stdout)
    for h in (file, console):
        h.setFormatter(fmt)
        log.addHandler(h)
    log.setLevel(logging.INFO)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--layers", default="ACBD", help="camadas e ordem, ex.: A, AB, ACBD")
    parser.add_argument("--max-calls", type=int, default=None)
    parser.add_argument("--plan", action="store_true", help="so lista as buscas, sem coletar")
    parser.add_argument("--no-delay", action="store_true")
    args = parser.parse_args()

    load_dotenv(ROOT / ".env")
    setup_logging()
    slowdown = int(os.environ.get("STUDY_GRID_SLOWDOWN", "1"))
    now = datetime.now(BRT)
    client = db.get_client()  # no --plan so le (malha Brasil); nada e gravado
    state = read_state()
    budget = int(state.get("brazil_budget", BRAZIL_BUDGET["start"]))

    builders = {
        "A": lambda: layer_a(now.date()),
        "B": lambda: layer_b(now, slowdown, state.get("grid_hour")),
        "C": lambda: [] if args.plan else layer_c(client),
        "D": lambda: layer_d(client, now, budget),
    }
    queries = [q for layer in args.layers.upper() for q in builders[layer]()]
    if args.max_calls is not None:
        queries = queries[: args.max_calls]

    if args.plan:
        for layer in "ABCD":
            print(layer, sum(q.layer == layer for q in queries))
        print(f"  D: orcamento atual {budget}/h (max {brazil_max()})")
        b = [q for q in queries if q.layer == "B"]
        far = sum(1 for q in b if not q.ret and (q.out - now.date()).days > GRID_DAYS[1])
        print(f"  B: so ida {len(b) - sum(1 for q in b if q.ret)} (D+121+: {far}),",
              ", ".join(f"ida e volta {s} dias: {sum(q.slot == f'rt{s}' for q in b)}" for s in RT_STAYS))
        for q in queries[:20]:
            print(" ", q.label, q.slot or "")
        return 0

    lock = acquire_lock()
    if lock is None:
        log.warning("outra execucao em andamento; saindo")
        return 0

    batch_id = str(uuid4())
    runner = Runner(client, batch_id)
    started = time.monotonic()
    log.info("batch %s: %d buscas (%s), grade x%d, malha %d/h", batch_id[:8], len(queries),
             args.layers, slowdown, budget)
    done_requests: set[int] = set()
    timed_out = False
    try:
        for i, q in enumerate(queries):
            if time.monotonic() - started > MAX_RUNTIME_S:
                timed_out = True
                log.warning("limite de tempo atingido; %d buscas ficaram para a proxima hora", len(queries) - i)
                break
            status = runner.run(q)
            if q.request_id and client is not None and q.request_id not in done_requests:
                done_requests.add(q.request_id)
                client.table("search_requests").update(
                    {"status": "done" if status in ("ok", "empty") else "error"}
                ).eq("id", q.request_id).execute()
            if runner.blocks_in_row >= MAX_CONSECUTIVE_BLOCKS:
                log.error("%d bloqueios seguidos; pausando ate a proxima hora", runner.blocks_in_row)
                break
            if not args.no_delay and i < len(queries) - 1:
                time.sleep(random.uniform(*DELAY))
    finally:
        if args.max_calls is None:
            if "B" in args.layers.upper():
                state["grid_hour"] = grid_hour(now)
            if "D" in args.layers.upper():
                state["brazil_budget"] = next_brazil_budget(budget, runner.stats, timed_out)
            write_state(state)
        lock.unlink(missing_ok=True)

    log.info("fim batch %s em %.0fs: %s; malha %d -> %d/h", batch_id[:8], time.monotonic() - started,
             runner.stats, budget, state.get("brazil_budget", budget))
    return 0


if __name__ == "__main__":
    sys.exit(main())
