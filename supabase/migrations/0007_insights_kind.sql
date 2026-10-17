-- Divide as metricas de intradia do painel por tipo de rota (nacional x
-- internacional), para comparar o comportamento SSA-CGH com a Colombia.
-- security_invoker = on: as views respeitam o RLS das tabelas (SELECT publico).

-- Acrescenta routes.kind a cada passo do painel (coluna nova no fim, compativel
-- com as views que ja consomem insight_panel_steps).
create or replace view insight_panel_steps with (security_invoker = on) as
select
  concat_ws('|', c.slot, c.origin, c.destination, c.trip_type, c.flight_date, c.return_date) as series,
  c.slot, c.origin, c.destination, c.trip_type, c.flight_date, c.return_date, c.run_at,
  extract(hour from c.run_at at time zone 'America/Sao_Paulo')::int as hour_brt,
  (c.run_at at time zone 'America/Sao_Paulo')::date as day_brt,
  c.min_price,
  lag(c.min_price) over w as prev,
  row_number() over w as rn,
  r.kind
from collection_runs c
left join routes r on r.id = c.route_id
where c.layer = 'A' and c.status = 'ok' and c.min_price is not null
  and c.run_at > now() - interval '30 days'
window w as (partition by c.slot, c.origin, c.destination, c.trip_type, c.flight_date, c.return_date order by c.run_at);

-- um resumo por tipo de rota: mesma matematica de insight_intraday, por kind
create or replace view insight_kind_intraday with (security_invoker = on) as
with big as (
  select kind, series, rn, prev from insight_panel_steps
  where prev is not null and abs(min_price - prev) / prev >= 0.02
),
rev as (
  select b.kind, b.series, b.rn, bool_or(abs(n.min_price - b.prev) / b.prev < 0.02) as reverted
  from big b
  join insight_panel_steps n on n.series = b.series and n.rn between b.rn + 1 and b.rn + 6
  group by b.kind, b.series, b.rn
),
days as (
  select kind, series, day_brt,
         (max(min_price) - min(min_price)) / min(min_price) * 100 as amp
  from insight_panel_steps
  group by kind, series, day_brt
  having count(*) >= 12
)
select s.kind,
  count(distinct s.series) as series,
  count(*) filter (where s.prev is not null) as pairs,
  count(*) filter (where s.prev is not null and s.min_price <> s.prev) as changes,
  count(*) filter (where s.prev is not null and abs(s.min_price - s.prev) / s.prev >= 0.02) as big_changes,
  count(*) filter (where s.prev is not null and abs(s.min_price - s.prev) / s.prev >= 0.02 and s.hour_brt < 7) as big_night,
  percentile_cont(0.5) within group (
    order by abs(s.min_price - s.prev) / s.prev * 100
  ) filter (where s.prev is not null and s.min_price <> s.prev) as change_median_pct,
  (select count(*) from rev v where v.kind = s.kind and v.reverted) as reverted,
  (select percentile_cont(0.5) within group (order by d.amp) from days d where d.kind = s.kind) as day_amp_median,
  (select avg((d.amp > 5)::int) from days d where d.kind = s.kind) as day_amp_over5_share
from insight_panel_steps s
group by s.kind;
