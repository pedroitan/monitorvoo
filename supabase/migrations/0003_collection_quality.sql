-- PRD V3 — qualidade de dados (DQ1–DQ3) e fila sob demanda.

-- DQ1: uma linha por chamada a fonte, inclusive falhas e buscas sem resultado.
create table if not exists collection_runs (
  id bigint generated always as identity primary key,
  batch_id uuid not null,                 -- uma execucao horaria do coletor
  run_at timestamptz not null default now(),
  layer text not null check (layer in ('A', 'B', 'C', 'D')),
  slot text,                              -- ex.: par de datas do painel horario
  route_id uuid references routes (id),
  origin text not null,
  destination text not null,
  flight_date date not null,
  return_date date,
  trip_type text not null check (trip_type in ('one-way', 'round-trip')),
  status text not null check (status in ('ok', 'empty', 'error', 'blocked')),
  n_options int,
  min_price numeric,
  duration_ms int,
  error text,
  raw_ref text
);

create index if not exists collection_runs_time on collection_runs (run_at);
create index if not exists collection_runs_layer_time on collection_runs (layer, run_at);
create index if not exists collection_runs_query
  on collection_runs (origin, destination, flight_date, trip_type, run_at);

-- DQ3: identidade do itinerario e rastreio da chamada que gerou a linha.
alter table fare_observations
  add column if not exists run_id bigint references collection_runs (id),
  add column if not exists itinerary_key text,
  add column if not exists layer text,
  add column if not exists block text;    -- 'best' | 'other' (bloco do Google)

create index if not exists fare_observations_itinerary
  on fare_observations (itinerary_key, collected_at);

-- DQ2: partida/chegada sao horario local do aeroporto. Ate aqui eram gravadas
-- como se fossem UTC; "at time zone 'UTC'" devolve exatamente o relogio local.
alter table fare_observations
  alter column departure type timestamp using (departure at time zone 'UTC'),
  alter column arrival type timestamp using (arrival at time zone 'UTC');

-- Camada C: ida e volta nas datas exatas buscadas no site.
create table if not exists search_requests (
  id bigint generated always as identity primary key,
  origin text not null,
  destination text not null,
  out_date date not null,
  ret_date date,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'done', 'error')),
  run_id bigint references collection_runs (id),
  unique (origin, destination, out_date, ret_date)
);

alter table collection_runs enable row level security;
alter table search_requests enable row level security;

create policy "public read runs" on collection_runs for select using (true);
create policy "public read search requests" on search_requests for select using (true);
create policy "public create search requests" on search_requests
  for insert with check (status = 'pending' and run_id is null);
