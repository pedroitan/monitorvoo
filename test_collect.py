"""Smoke test: coleta real no Google Flights via fast-flights."""
from datetime import date, timedelta

from fast_flights import FlightQuery, Passengers, create_query, get_flights

departure = date.today() + timedelta(days=30)

q = create_query(
    flights=[FlightQuery(date=departure, from_airport="GRU", to_airport="SSA")],
    trip="one-way",
    seat="economy",
    passengers=Passengers(adults=1),
    language="pt-BR",
    currency="BRL",
)

print(f"Buscando GRU->SSA em {departure} (one-way, economy, 1 adulto)...")
result = get_flights(q)

print(f"opcoes retornadas: {len(result)}\n")

for opt in result[:10]:
    legs = opt.flights
    first, last = legs[0], legs[-1]
    airlines = ", ".join(opt.airlines)
    dep = "%02d:%02d" % first.departure.time
    arr = "%02d:%02d" % last.arrival.time
    dur = sum(l.duration for l in legs)
    print(
        f"{airlines:<28} R$ {opt.price:>6}  "
        f"{dep} -> {arr}  ~{dur}min  "
        f"trechos: {len(legs)} ({first.from_airport.code}-{last.to_airport.code})"
    )

best = min(result, key=lambda o: o.price)
print(f"\nMENOR PRECO: R$ {best.price} ({', '.join(best.airlines)})")
print(f"airlines vistas no resultado: {[a.name for a in result.metadata.airlines]}")
