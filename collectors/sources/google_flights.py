"""Adapter do Google Flights via fast-flights (v3).

Retorna dict JSON-serializavel pronto para salvar como resposta bruta.
"""
from __future__ import annotations

from datetime import date, timedelta

from fast_flights import FlightQuery, Passengers, create_query, get_flights

SOURCE = "google_flights"
ROUND_TRIP_DAYS = 7


def _dt_iso(sd) -> str:
    y, m, d = sd.date
    hh, mm = sd.time
    return f"{y:04d}-{m:02d}-{d:02d}T{hh:02d}:{mm:02d}"


def fetch(origin: str, destination: str, lead_days: int, trip: str) -> dict:
    """Busca uma combinacao rota x antecedencia x tipo de viagem."""
    outbound = date.today() + timedelta(days=lead_days)
    inbound = outbound + timedelta(days=ROUND_TRIP_DAYS) if trip == "round-trip" else None

    legs = [FlightQuery(date=outbound, from_airport=origin, to_airport=destination)]
    if inbound:
        legs.append(FlightQuery(date=inbound, from_airport=destination, to_airport=origin))

    query = create_query(
        flights=legs,
        trip=trip,
        seat="economy",
        passengers=Passengers(adults=1),
        language="pt-BR",
        currency="BRL",
    )
    result = get_flights(query)

    options = [
        {
            "price": o.price,
            "airlines": o.airlines,
            "legs": [
                {
                    "from": leg.from_airport.code,
                    "to": leg.to_airport.code,
                    "departure": _dt_iso(leg.departure),
                    "arrival": _dt_iso(leg.arrival),
                    "duration_min": leg.duration,
                    "plane": leg.plane_type,
                }
                for leg in o.flights
            ],
        }
        for o in result
    ]

    return {
        "source": SOURCE,
        "origin": origin,
        "destination": destination,
        "trip_type": trip,
        "lead_days": lead_days,
        "flight_date": outbound.isoformat(),
        "return_date": inbound.isoformat() if inbound else None,
        "currency": "BRL",
        "options": options,
        "metadata": {
            "airlines": [a.name for a in result.metadata.airlines],
        },
    }
