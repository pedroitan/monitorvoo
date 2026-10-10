"""Adapter do Google Flights via fast-flights (v3).

Retorna dict JSON-serializavel pronto para salvar como resposta bruta.
Diferente do parser padrao da fast-flights, este extrai tambem o numero do voo
(campo `flight` de cada trecho), que a biblioteca descarta.
"""
from __future__ import annotations

import json
from datetime import date, timedelta

from fast_flights import FlightQuery, Passengers, create_query, fetch_flights_html
from selectolax.lexbor import LexborHTMLParser

SOURCE = "google_flights"
ROUND_TRIP_DAYS = 7


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


def _parse_google_flights(html: str) -> list[dict]:
    parser = LexborHTMLParser(html)
    script = parser.css_first(r"script.ds\:1")
    if not script:
        raise RuntimeError("bloco de dados do Google Flights nao encontrado")

    # O script contem `var ... data:{...}, sideChannel:{...};`
    # O parser original faz split em "data:" e rsplit em ",", 1)[0]
    raw = script.text().split("data:", 1)[1].rsplit(",", 1)[0]
    if raw.endswith("errorHasStatus: true"):
        raise RuntimeError("no flights found; received error")

    payload = json.loads(raw)
    if payload[3][0] is None:
        return []

    options = []
    for k in payload[3][0]:
        flight = k[0]
        price = k[1][0][1]
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

        extras = flight[22]
        options.append(
            {
                "price": price,
                "airlines": airlines,
                "type": typ,
                "legs": legs,
                "carbon_emission_g": extras[7] if extras else None,
                "typical_carbon_emission_g": extras[8] if extras else None,
            }
        )

    return options


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
    html = fetch_flights_html(query)
    options = _parse_google_flights(html)

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
        "metadata": {},
    }
