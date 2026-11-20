-- Curva de antecedencia medida pelo painel horario (camada A), separada em
-- nacional x internacional: cada coleta e comparada com a mediana da propria
-- serie, entao datas caras (Natal) nao distorcem a conta.
-- bucket = dias entre a coleta e o voo. rel > 1 = mais caro que o normal da viagem.

create or replace view insight_lead_panel with (security_invoker = on) as
with s as (
  select kind, series, flight_date, min_price,
    flight_date - (run_at at time zone 'America/Sao_Paulo')::date as lead
  from insight_panel_steps
  where flight_date is not null and min_price is not null
),
m as (
  select series,
    percentile_cont(0.5) within group (order by min_price) as med
  from s
  group by series
  having count(*) >= 10
)
select s.kind,
  case
    when s.lead < 7 then '0-6'
    when s.lead < 14 then '7-13'
    when s.lead < 21 then '14-20'
    when s.lead < 28 then '21-27'
    when s.lead < 42 then '28-41'
    else '42+'
  end as bucket,
  min(s.lead) as lead_lo,
  max(s.lead) as lead_hi,
  percentile_cont(0.5) within group (order by s.min_price / m.med) as rel,
  count(*) as n,
  count(distinct s.series) as series
from s join m using (series)
group by s.kind, 2
order by s.kind, 1;
