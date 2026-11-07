-- insight_airlines / insight_direct / insight_departure estouravam o
-- statement_timeout: as tres liam insight_search_options, que fazia 2 window
-- functions (min over, row_number over) sobre ~140k linhas a cada chamada.
-- Reescritas com group by + join no minimo por run — mesmo resultado, bem mais
-- barato. insight_search_options fica intacta para compatibilidade.
--
-- base comum: opcoes so ida das camadas A/B dos ultimos 30 dias.

create or replace view insight_airlines with (security_invoker = on) as
with s as (
  select run_id, airline, price_brl
  from fare_observations
  where layer in ('A', 'B') and trip_type = 'one-way'
    and collected_at > now() - interval '30 days'
),
m as (
  select run_id, min(price_brl) as mn from s group by run_id
)
select s.airline,
  count(*) filter (where s.price_brl = m.mn) as cheapest,
  count(distinct s.run_id) as present,
  (select count(*) from m) as searches
from s join m using (run_id)
group by s.airline;

create or replace view insight_direct with (security_invoker = on) as
with r as (
  select run_id,
    min(price_brl) filter (where stops = 0) as direct,
    min(price_brl) filter (where stops > 0) as connect
  from fare_observations
  where layer in ('A', 'B') and trip_type = 'one-way'
    and collected_at > now() - interval '30 days'
  group by run_id
)
select count(*) as searches, count(direct) as with_direct,
  (select percentile_cont(0.5) within group (order by direct / connect)
     from r where direct is not null and connect is not null) as direct_ratio
from r;

create or replace view insight_departure with (security_invoker = on) as
with s as (
  select run_id, price_brl,
    case when extract(hour from departure) < 6 then 'madrugada'
         when extract(hour from departure) < 12 then 'manha'
         when extract(hour from departure) < 18 then 'tarde'
         else 'noite' end as period
  from fare_observations
  where layer in ('A', 'B') and trip_type = 'one-way' and departure is not null
    and collected_at > now() - interval '30 days'
),
m as (
  select run_id, min(price_brl) as rm from s group by run_id
),
p as (
  select run_id, period, min(price_brl) as pm from s group by 1, 2
)
select p.period,
  percentile_cont(0.5) within group (order by p.pm / m.rm) as rel,
  count(*) filter (where p.pm = m.rm) as cheapest,
  count(*) as n
from p join m using (run_id)
group by p.period;
