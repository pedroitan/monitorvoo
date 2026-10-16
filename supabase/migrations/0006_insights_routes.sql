-- Ajustes das views de /achados apos a entrada de rotas nacionais no painel A.
-- security_invoker = on: as views respeitam o RLS das tabelas (SELECT publico).

-- ida e volta x duas so ida (mesma rodada do painel).
-- Versao nova: casa a "so ida" com a DATA da ida e a "so volta" com a data do
-- retorno, em vez de deduzir o sentido pelo aeroporto. Necessario para pares
-- Brasil-Brasil (SSA-CGH), onde os dois lados sao aeroportos brasileiros e a
-- versao anterior classificava os dois como "ida".
create or replace view insight_rt_vs_ow with (security_invoker = on) as
with a as (
  select batch_id, slot, trip_type, min_price, flight_date, return_date,
    least(origin, destination) as lo,
    greatest(origin, destination) as hi,
    origin, destination
  from collection_runs
  where layer = 'A' and status = 'ok' and min_price is not null
    and run_at > now() - interval '30 days'
),
rt as (
  select batch_id, slot, lo, hi, origin, destination,
    flight_date as dep, return_date as ret, min_price as rt
  from a where trip_type = 'round-trip'
),
ow as (
  select batch_id, slot, lo, hi, flight_date, min_price
  from a where trip_type = 'one-way'
),
b as (
  select rt.batch_id, rt.slot, rt.origin, rt.destination, rt.dep, rt.ret, rt.rt,
    max(o.min_price) as ow_out,
    max(v.min_price) as ow_back
  from rt
  left join ow o on o.batch_id = rt.batch_id and o.slot = rt.slot
    and o.lo = rt.lo and o.hi = rt.hi and o.flight_date = rt.dep
  left join ow v on v.batch_id = rt.batch_id and v.slot = rt.slot
    and v.lo = rt.lo and v.hi = rt.hi and v.flight_date = rt.ret
  group by rt.batch_id, rt.slot, rt.origin, rt.destination, rt.dep, rt.ret, rt.rt
)
select slot, origin, destination, dep, ret, count(*) as n,
  percentile_cont(0.5) within group (order by rt) as rt_median,
  percentile_cont(0.5) within group (order by ow_out + ow_back) as two_ow_median,
  percentile_cont(0.5) within group (order by ow_out) as ow_out_median,
  percentile_cont(0.5) within group (order by ow_back) as ow_back_median,
  count(*) filter (where rt < ow_out + ow_back) as rt_cheaper
from b
where rt is not null and ow_out is not null and ow_back is not null
group by slot, origin, destination, dep, ret;

-- ida e volta / so ida por rota, em TODAS as fontes (painel, grade, coletor
-- classico, malha). 2,0 = sem desconto de ida e volta; < 2,0 = desconto.
-- Nao precisa dos dois sentidos: compara o menor preco ida e volta com o menor
-- so ida do mesmo trecho, mesma data de voo, mesmo dia de coleta.
create or replace view insight_route_rt with (security_invoker = on) as
with d as (
  select route_id, flight_date, trip_type,
    (collected_at at time zone 'America/Sao_Paulo')::date as day,
    min(price_brl) as lo
  from fare_observations
  where price_brl is not null
    and collected_at > now() - interval '30 days'
  group by 1, 2, 3, 4
),
p as (
  select r.origin, r.destination, r.kind, d.flight_date, d.day,
    max(d.lo) filter (where d.trip_type = 'round-trip') as rt,
    max(d.lo) filter (where d.trip_type = 'one-way') as ow
  from d join routes r on r.id = d.route_id
  group by 1, 2, 3, 4, 5
)
select origin, destination, kind, count(*) as days,
  percentile_cont(0.5) within group (order by rt::float / ow) as rt_ow_ratio,
  percentile_cont(0.5) within group (order by rt) as rt_median,
  percentile_cont(0.5) within group (order by ow) as ow_median
from p
where rt is not null and ow is not null
group by 1, 2, 3
having count(*) >= 2;
