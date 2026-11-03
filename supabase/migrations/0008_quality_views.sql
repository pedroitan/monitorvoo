-- Agregados prontos para o app: evita baixar a fare_observations inteira
-- (~150k linhas), que estava derrubando a home e /qualidade na Vercel.
-- security_invoker = on: as views respeitam o RLS das tabelas (SELECT publico).
-- Datas de coleta em UTC, igual ao slice(0,10) que o app fazia no cliente.

-- menor preco por rota x data de voo-tipo x antecedencia x dia de coleta
-- (base do sparkline e dos stats da home; o app filtra trip_type + lead_days)
create or replace view route_daily_min with (security_invoker = on) as
select route_id, trip_type, lead_days,
  (collected_at at time zone 'UTC')::date as day,
  min(price_brl) as price,
  count(*) as n
from fare_observations
group by 1, 2, 3, 4;

-- /qualidade: volume por dia de coleta
create or replace view quality_daily with (security_invoker = on) as
select (collected_at at time zone 'UTC')::date as day, count(*) as count
from fare_observations group by 1;

create or replace view quality_airlines with (security_invoker = on) as
select airline, count(*) as count
from fare_observations group by airline;

create or replace view quality_lead_trip with (security_invoker = on) as
select lead_days as lead, trip_type as trip, count(*) as count
from fare_observations group by 1, 2;

-- /qualidade: um resumo por rota (todas, com ou sem dados)
create or replace view quality_routes with (security_invoker = on) as
select r.id as route_id, r.origin, r.destination, r.kind,
  count(o.id) as total,
  min(o.collected_at) as first, max(o.collected_at) as last,
  count(distinct (o.collected_at at time zone 'UTC')::date) as days,
  array_agg(distinct o.airline) filter (where o.airline is not null) as airlines,
  array_agg(distinct o.lead_days) filter (where o.lead_days is not null) as leads,
  count(*) filter (where o.trip_type = 'one-way') as one_way,
  count(*) filter (where o.trip_type = 'round-trip') as round_trip,
  min(o.price_brl) as min, max(o.price_brl) as max,
  percentile_cont(0.5) within group (order by o.price_brl) as median
from routes r
left join fare_observations o on o.route_id = r.id
group by r.id, r.origin, r.destination, r.kind;
