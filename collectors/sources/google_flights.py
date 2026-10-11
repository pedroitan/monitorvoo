"""Adapter do Google Flights via fast-flights (v3).

Retorna dict JSON-serializavel pronto para salvar como resposta bruta.
Diferente do parser padrao da fast-flights, este extrai tambem o numero do voo
(campo `flight` de cada trecho), que a biblioteca descarta.
"""
from __future__ import annotations

import json
import os
from datetime import date, timedelta

from fast_flights import FlightQuery, Passengers, create_query, fetch_flights_html
from selectolax.lexbor import LexborHTMLParser

SOURCE = "google_flights"
ROUND_TRIP_DAYS = 7


class BlockedError(RuntimeError):
    """Google devolveu a pagina de erro (tipicamente rate limit/bloqueio do IP)."""


def _proxy() -> str | None:
    return os.environ.get("HTTP_PROXY") or os.environ.get("HTTPS_PROXY") or None


def _parse_time(value: list[int | None] | None) -> tuple[int, int]:
    """Expande o par [hora, minuto] que o Google omite quando zero."""
    padded = [*(value or []), None, None]
    return (padded[0] or 0, padded[1] or 0)


def _flight_number(flight_info: list | None) -> str | None:
    """Monta 'LA3548' a partir de ['LA', '3548', None, 'LATAM']."""
    if not flight_info or len(flight_info) < 2:
        return None
    airline = flight_info[0]
    number = flight_info[1]
    if airline and number:
        return f"{airline}{number}"
    return number


def itinerary_key(legs: list[dict]) -> str:
    """Identidade do itinerario: voos de todos os trechos + partida, ex.:
    'LA8070+LA3290@2026-11-09T14:00'."""
    numbers = "+".join(leg.get("flight_number") or "?" for leg in legs)
    return f"{numbers}@{legs[0]['departure']}" if legs else numbers


def _parse_google_flights(html: str) -> list[dict]:
    parser = LexborHTMLParser(html)
    script = parser.css_first(r"script.ds\:1")
    if not script:
        raise RuntimeError("bloco de dados do Google Flights nao encontrado")

    # O script contem `var ... data:{...}, sideChannel:{...};`
    # O parser original faz split em "data:" e rsplit em ",", 1)[0]
    raw = script.text().split("data:", 1)[1].rsplit(",", 1)[0]
    if raw.endswith("errorHasStatus: true"):
        raise BlockedError("no flights found; received error")

    payload = json.loads(raw)

    # payload[2] = "melhores voos" e payload[3] = "outros voos". A fast-flights
    # le so o [3], e o mais barato muitas vezes esta apenas no [2]. Qualquer
    # um dos dois vem None quando nao ha voos (ex.: data alem da malha).
    entries = [
        (block, k)
        for idx, block in ((2, "best"), (3, "other"))
        if payload[idx] and payload[idx][0]
        for k in payload[idx][0]
    ]

    options = []
    seen = set()
    for block, k in entries:
        flight = k[0]
        price = k[1][0][1] if k[1] and k[1][0] else None
        typ = flight[0]
        airlines = flight[1]

        legs = []
        for single in flight[2]:
            dep_time = _parse_time(single[8])
            arr_time = _parse_time(single[10])
            dep_date = single[20]
            arr_date = single[21]

            departure = f"{dep_date[0]:04d}-{dep_date[1]:02d}-{dep_date[2]:02d}T{dep_time[0]:02d}:{dep_time[1]:02d}"
            arrival = f"{arr_date[0]:04d}-{arr_date[1]:02d}-{arr_date[2]:02d}T{arr_time[0]:02d}:{arr_time[1]:02d}"

            legs.append(
                {
                    "from": single[3],
                    "from_name": single[4],
                    "to": single[6],
                    "to_name": single[5],
                    "departure": departure,
                    "arrival": arrival,
                    "duration_min": single[11],
                    "plane": single[17],
                    "flight_number": _flight_number(single[22]),
                    "airline_code": single[22][0] if single[22] else None,
                    "marketing_airline": single[22][3] if len(single[22]) > 3 else None,
                    "legroom": single[14],
                }
            )

        key = itinerary_key(legs)
        if (key, price) in seen:
            continue
        seen.add((key, price))

        extras = flight[22]
        options.append(
            {
                "price": price,
                "airlines": airlines,
                "type": typ,
                "block": block,
                "itinerary_key": key,
                "legs": legs,
                "carbon_emission_g": extras[7] if extras else None,
                "typical_carbon_emission_g": extras[8] if extras else None,
            }
        )

    return options


def fetch_calendar(
    origin: str,
    destination: str,
    outbound: date,
    trip: str,
    inbound: date | None = None,
) -> dict:
    """Busca uma combinacao rota x data de partida especifica x tipo de viagem."""
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
    html = fetch_flights_html(query, proxy=_proxy())
    options = _parse_google_flights(html)

    return {
        "source": SOURCE,
        "origin": origin,
        "destination": destination,
        "trip_type": trip,
        "lead_days": (outbound - date.today()).days,
        "flight_date": outbound.isoformat(),
        "return_date": inbound.isoformat() if inbound else None,
        "currency": "BRL",
        "options": options,
        "metadata": {},
    }


def fetch(origin: str, destination: str, lead_days: int, trip: str) -> dict:
    """Busca uma combinacao rota x antecedencia x tipo de viagem."""
    outbound = date.today() + timedelta(days=lead_days)
    inbound = outbound + timedelta(days=ROUND_TRIP_DAYS) if trip == "round-trip" else None
    return fetch_calendar(origin, destination, outbound, trip, inbound)
