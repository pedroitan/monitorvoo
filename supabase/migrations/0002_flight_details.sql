-- Detalhes por voo: numero, horarios, aeronave e trechos (JSONB).
-- Permite a tabela /voos mostrar informacoes de cada opcao de voo.

alter table fare_observations
  add column if not exists flight_number text,
  add column if not exists departure timestamptz,
  add column if not exists arrival timestamptz,
  add column if not exists duration_min int,
  add column if not exists plane_type text,
  add column if not exists legs jsonb default '[]'::jsonb;
