-- Achados do estudo Colombia: views agregadas lidas pela pagina /achados.
-- security_invoker = on: a view respeita o RLS das tabelas (SELECT publico).
-- Janela padrao: ultimos 30 dias (antecedencia usa 180 dias).

create index if not exists fare_observations_layer_time on fare_observations (layer, collected_at);
create index if not exists fare_observations_run on fare_observations (run_id);

-- ---------- painel A: uma linha por chamada, com o preco anterior da mesma serie ----------
create or replace view insight_panel_steps with (security_invoker = on) as
select
  concat_ws('|', slot, origin, destination, trip_type, flight_date, return_date) as series,
  slot, origin, destination, trip_type, flight_date, return_date, run_at,
  extract(hour from run_at at time zone 'America/Sao_Paulo')::int as hour_brt,
  (run_at at time zone 'America/Sao_Paulo')::date as day_brt,
  min_price,
  lag(min_price) over w as prev,
  row_number() over w as rn
from collection_runs
where layer = 'A' and status = 'ok' and min_price is not null
  and run_at > now() - interval '30 days'
window w as (partition by slot, origin, destination, trip_type, flight_date, return_date order by run_at);

-- mudancas de preco por hora do dia (BRT); >= 2% = mudanca de tarifa, < 2% = ruido/cambio
create or replace view insight_hourly with (security_invoker = on) as
select
  hour_brt as hour,
  count(*) filter (where prev is not null) as pairs,
  count(*) filter (where prev is not null and abs(min_price - prev) / prev >= 0.02) as big_changes,
  count(*) filter (where prev is not null and min_price <> prev and abs(min_price - prev) / prev < 0.02) as small_changes
from insight_panel_steps
group by hour_brt;

create or replace view insight_intraday with (security_invoker = on) as
with big as (
  select series, rn, prev from insight_panel_steps
  where prev is not null and abs(min_price - prev) / prev >= 0.02
),
rev as (
  select b.series, b.rn, bool_or(abs(n.min_price - b.prev) / b.prev < 0.02) as reverted
  from big b
  join insight_panel_steps n on n.series = b.series and n.rn between b.rn + 1 and b.rn + 6
  group by b.series, b.rn
),
days as (
  select series, day_brt, min(min_price) as lo,
         (max(min_price) - min(min_price)) / min(min_price) * 100 as amp
  from insight_panel_steps
  group by series, day_brt
  having count(*) >= 12
),
inter as (
  select series, (max(lo) - min(lo)) / min(lo) * 100 as amp
  from days group by series having count(*) >= 2
)
select
  (select count(distinct series) from insight_panel_steps) as series,
  (select min(run_at) from insight_panel_steps) as since,
  (select count(*) from insight_panel_steps where prev is not null) as pairs,
  (select count(*) from insight_panel_steps where prev is not null and min_price <> prev) as changes,
  (select count(*) from big) as big_changes,
  (select count(*) from rev where reverted) as reverted,
  (select count(*) from days) as days,
  (select percentile_cont(0.5) within group (order by amp) from days) as day_amp_median,
  (select avg((amp > 5)::int) from days) as day_amp_over5_share,
  (select percentile_cont(0.5) within group (order by amp) from inter) as inter_day_median;

-- quanto o menor preco capturado fica acima do real se coletassemos a cada k coletas
create or replace view insight_sampling with (security_invoker = on) as
with lo as (
  select series, min(min_price) as lo from insight_panel_steps
  group by series having count(*) >= 24
),
k as (select unnest(array[1, 2, 3, 6, 12, 24]) as k),
sub as (
  select k.k, s.series, (s.rn - 1) % k.k as off, min(s.min_price) as m
  from insight_panel_steps s cross join k
  group by k.k, s.series, (s.rn - 1) % k.k
),
per as (
  select sub.k, sub.series, avg((sub.m - lo.lo) / lo.lo * 100) as loss
  from sub join lo using (series)
  group by sub.k, sub.series
)
select k as every, avg(loss) as avg_loss_pct, max(loss) as max_loss_pct, count(*) as series
from per group by k;

-- ---------- ida e volta x duas so ida (mesma rodada do painel) ----------
create or replace view insight_rt_vs_ow with (security_invoker = on) as
with a as (
  select batch_id, slot, trip_type, min_price, flight_date, return_date,
    origin in ('GRU', 'SSA', 'CGH') as outbound,
    case when origin in ('GRU', 'SSA', 'CGH') then origin else destination end as br,
    case when origin in ('GRU', 'SSA', 'CGH') then destination else origin end as co
  from collection_runs
  where layer = 'A' and status = 'ok' and min_price is not null
    and run_at > now() - interval '30 days'
),
b as (
  select batch_id, slot, br, co,
    max(flight_date) filter (where trip_type = 'round-trip') as dep,
    max(return_date) filter (where trip_type = 'round-trip') as ret,
    max(min_price) filter (where trip_type = 'round-trip') as rt,
    max(min_price) filter (where trip_type = 'one-way' and outbound) as ow_out,
    max(min_price) filter (where trip_type = 'one-way' and not outbound) as ow_back
  from a group by batch_id, slot, br, co
)
select slot, br as origin, co as destination, dep, ret, count(*) as n,
  percentile_cont(0.5) within group (order by rt) as rt_median,
  percentile_cont(0.5) within group (order by ow_out + ow_back) as two_ow_median,
  percentile_cont(0.5) within group (order by ow_out) as ow_out_median,
  percentile_cont(0.5) within group (order by ow_back) as ow_back_median,
  count(*) filter (where rt < ow_out + ow_back) as rt_cheaper
from b
where rt is not null and ow_out is not null and ow_back is not null
group by slot, br, co, dep, ret;

-- entrar por uma cidade e sair por outra (soma de dois so ida da mesma rodada)
create or replace view insight_open_jaw with (security_invoker = on) as
with a as (
  select batch_id, slot, origin, destination, flight_date, min_price
  from collection_runs
  where layer = 'A' and status = 'ok' and trip_type = 'one-way' and min_price is not null
    and run_at > now() - interval '30 days'
)
select o.slot, o.origin, o.destination as entry, r.origin as exit,
  o.flight_date as dep, r.flight_date as ret, count(*) as n,
  percentile_cont(0.5) within group (order by o.min_price + r.min_price) as total_median
from a o
join a r on r.batch_id = o.batch_id and r.slot = o.slot and r.destination = o.origin
where o.origin in ('GRU', 'SSA', 'CGH')
group by o.slot, o.origin, o.destination, r.origin, o.flight_date, r.flight_date;

-- ---------- grade B: valor mais recente de cada (par, data, tipo) ----------
create or replace view insight_grid_latest with (security_invoker = on) as
select distinct on (origin, destination, flight_date, trip_type, return_date)
  origin, destination, flight_date, return_date, trip_type, slot, run_at, min_price
from collection_runs
where layer = 'B' and status = 'ok' and min_price is not null
  and run_at > now() - interval '30 days'
order by origin, destination, flight_date, trip_type, return_date, run_at desc;

create or replace view insight_destinations with (security_invoker = on) as
select origin, destination, count(*) as dates,
  percentile_cont(0.5) within group (order by min_price) as median_price,
  min(min_price) as min_price
from insight_grid_latest
where trip_type = 'one-way'
group by origin, destination;

-- preco relativo a mediana do par, por dia da semana e por mes do voo (Brasil -> Colombia)
create or replace view insight_weekday with (security_invoker = on) as
select extract(isodow from g.flight_date)::int as dow,
  avg(g.min_price / d.median_price) as rel, count(*) as n
from insight_grid_latest g join insight_destinations d using (origin, destination)
where g.trip_type = 'one-way' and g.origin in ('GRU', 'SSA', 'CGH')
group by 1;

create or replace view insight_month with (security_invoker = on) as
select to_char(g.flight_date, 'YYYY-MM') as month,
  avg(g.min_price / d.median_price) as rel, count(*) as n
from insight_grid_latest g join insight_destinations d using (origin, destination)
where g.trip_type = 'one-way' and g.origin in ('GRU', 'SSA', 'CGH')
group by 1;

-- antecedencia SEM efeito de temporada: cada data comparada com a propria media
create or replace view insight_lead with (security_invoker = on) as
with g as (
  select origin, destination, flight_date, min_price,
    flight_date - (run_at at time zone 'America/Sao_Paulo')::date as lead
  from collection_runs
  where layer = 'B' and trip_type = 'one-way' and status = 'ok' and min_price is not null
    and run_at > now() - interval '180 days'
),
m as (
  select origin, destination, flight_date, avg(min_price) as mean
  from g group by origin, destination, flight_date having count(*) >= 2
)
select (g.lead / 15) * 15 as bucket, avg(g.min_price / m.mean) as rel, count(*) as n,
  count(distinct (g.origin, g.destination, g.flight_date)) as dates
from g join m using (origin, destination, flight_date)
group by 1;

-- ida e volta da grade x soma dos dois so ida mais recentes da grade
create or replace view insight_grid_rt with (security_invoker = on) as
select rt.origin, rt.destination, rt.return_date - rt.flight_date as stay, count(*) as n,
  percentile_cont(0.5) within group (order by rt.min_price) as rt_median,
  percentile_cont(0.5) within group (order by o.min_price + b.min_price) as two_ow_median,
  count(*) filter (where rt.min_price < o.min_price + b.min_price) as rt_cheaper
from insight_grid_latest rt
join insight_grid_latest o on o.trip_type = 'one-way' and o.origin = rt.origin
  and o.destination = rt.destination and o.flight_date = rt.flight_date
join insight_grid_latest b on b.trip_type = 'one-way' and b.origin = rt.destination
  and b.destination = rt.origin and b.flight_date = rt.return_date
where rt.trip_type = 'round-trip'
group by 1, 2, 3;

-- buscas que voltam sem nenhum voo
create or replace view insight_empty_pairs with (security_invoker = on) as
select origin, destination, count(*) as calls,
  count(*) filter (where status = 'empty') as empty
from collection_runs
where layer = 'B' and run_at > now() - interval '30 days' and status in ('ok', 'empty')
group by origin, destination;

-- ---------- opcoes individuais (so ida, estudo) ----------
create or replace view insight_search_options with (security_invoker = on) as
select run_id, airline, price_brl, stops,
  extract(hour from departure)::int as dep_hour,
  min(price_brl) over (partition by run_id) as run_min,
  row_number() over (partition by run_id order by price_brl, id) as rk
from fare_observations
where layer in ('A', 'B') and trip_type = 'one-way'
  and collected_at > now() - interval '30 days';

create or replace view insight_airlines with (security_invoker = on) as
select airline,
  count(*) filter (where rk = 1) as cheapest,
  count(distinct run_id) as present,
  (select count(distinct run_id) from insight_search_options) as searches
from insight_search_options
group by airline;

create or replace view insight_direct with (security_invoker = on) as
with r as (
  select run_id,
    min(price_brl) filter (where stops = 0) as direct,
    min(price_brl) filter (where stops > 0) as connect
  from insight_search_options group by run_id
)
select count(*) as searches, count(direct) as with_direct,
  (select percentile_cont(0.5) within group (order by direct / connect)
     from r where direct is not null and connect is not null) as direct_ratio
from r;

create or replace view insight_departure with (security_invoker = on) as
with p as (
  select run_id,
    case when dep_hour < 6 then 'madrugada' when dep_hour < 12 then 'manha'
         when dep_hour < 18 then 'tarde' else 'noite' end as period,
    min(price_brl) as pm, min(run_min) as rm
  from insight_search_options
  where dep_hour is not null
  group by 1, 2
)
select period, percentile_cont(0.5) within group (order by pm / rm) as rel,
  count(*) filter (where pm = rm) as cheapest, count(*) as n
from p group by period;
