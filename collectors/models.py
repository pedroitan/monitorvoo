from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

LEAD_TIMES = (7, 14, 30, 60, 90, 180)
TRIP_TYPES = ("one-way", "round-trip")

ROUTES_FILE = Path(__file__).parent / "routes.json"


@dataclass(frozen=True)
class RouteSpec:
    origin: str
    destination: str
    kind: str  # "nacional" | "internacional"
    priority: int = 1
    lead_times: tuple[int, ...] = LEAD_TIMES

    @property
    def code(self) -> str:
        return f"{self.origin}-{self.destination}"


def load_routes() -> list[RouteSpec]:
    data = json.loads(ROUTES_FILE.read_text(encoding="utf-8"))
    return [
        RouteSpec(
            origin=r["origin"],
            destination=r["destination"],
            kind=r["kind"],
            priority=r.get("priority", 1),
            lead_times=tuple(r.get("lead_times", LEAD_TIMES)),
        )
        for r in data
    ]
