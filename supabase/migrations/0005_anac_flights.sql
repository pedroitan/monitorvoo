-- ANAC Voo Regular Ativo (VRA): todos os voos regulares no Brasil, agregados
-- por mes x companhia x trecho. Fonte publica, mensal (~6 semanas de defasagem).

create table if not exists anac_flights (
  year int not null,
  month int not null,
  airline text not null,               -- ICAO da cia (TAM, GLO, AZU...)
  airline_name text,
  origin text not null,                -- IATA (ICAO quando nao ha IATA)
  destination text not null,
  origin_icao text not null,
  destination_icao text not null,
  line_type text not null check (line_type in ('N', 'I')),  -- nacional / internacional
  planned int not null,                -- voos previstos
  flown int not null,                  -- realizados
  cancelled int not null,
  delayed15 int not null,              -- partidas com mais de 15 min de atraso
  avg_delay_min numeric,
  by_hour int[] not null,              -- realizados por hora da partida prevista (0..23, Brasilia)
  by_weekday int[] not null,           -- realizados por dia da semana (seg..dom)
  flight_numbers text[] not null,
  primary key (year, month, airline, origin_icao, destination_icao, line_type)
);

create index if not exists anac_flights_route on anac_flights (origin, destination, year, month);

alter table anac_flights enable row level security;
create policy "public read anac flights" on anac_flights for select using (true);

-- Malha do mes mais recente publicado: um trecho por linha, todas as cias somadas.
create or replace view anac_routes_latest with (security_invoker = on) as
with last as (
  select year, month from anac_flights order by year desc, month desc limit 1
)
select f.origin, f.destination, f.line_type,
  sum(f.flown) as flights,
  count(distinct f.airline) as airlines,
  array_agg(distinct coalesce(f.airline_name, f.airline)) as airline_names,
  min(f.year * 100 + f.month) as ym
from anac_flights f join last using (year, month)
group by f.origin, f.destination, f.line_type;
