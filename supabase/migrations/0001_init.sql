-- Monitor de precos de passagens — schema inicial (PRD secao "Arquitetura tecnica")

create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  origin text not null,
  destination text not null,
  kind text not null check (kind in ('nacional', 'internacional')),
  priority int not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (origin, destination)
);

create table if not exists fare_observations (
  id bigint generated always as identity primary key,
  route_id uuid not null references routes (id),
  airline text not null,
  collected_at timestamptz not null,
  flight_date date not null,
  return_date date,
  lead_days int not null,
  trip_type text not null check (trip_type in ('one-way', 'round-trip')),
  price numeric not null,
  currency text not null default 'BRL',
  price_brl numeric not null,
  stops int,
  source text not null,
  raw_ref text
);

create index if not exists fare_observations_route_airline_time
  on fare_observations (route_id, airline, collected_at);
create index if not exists fare_observations_flight_date
  on fare_observations (route_id, flight_date);

create table if not exists anac_fares (
  id bigint generated always as identity primary key,
  year int not null,
  month int not null,
  airline text not null,
  origin text not null,
  destination text not null,
  fare numeric not null,
  seats int,
  unique (year, month, airline, origin, destination)
);

create table if not exists promo_events (
  id uuid primary key default gen_random_uuid(),
  airline text not null,
  started_at date not null,
  ended_at date,
  affected_routes uuid[],
  avg_discount_pct numeric,
  signal_source text,
  created_at timestamptz not null default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  route_id uuid not null references routes (id) on delete cascade,
  target_price numeric,
  kind text not null check (kind in ('price', 'promo')),
  channel text not null check (channel in ('email', 'telegram', 'push')),
  channel_target text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  preferences jsonb not null default '{}',
  lgpd_consent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table alerts enable row level security;
alter table profiles enable row level security;

create policy "users manage own alerts"
  on alerts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Leitura publica dos dados de mercado; escrita so via service role (coletores)
alter table routes enable row level security;
alter table fare_observations enable row level security;
alter table promo_events enable row level security;
alter table anac_fares enable row level security;

create policy "public read routes" on routes for select using (true);
create policy "public read observations" on fare_observations for select using (true);
create policy "public read promo events" on promo_events for select using (true);
create policy "public read anac" on anac_fares for select using (true);

-- Bucket para respostas brutas das coletas
insert into storage.buckets (id, name, public)
values ('raw', 'raw', false)
on conflict (id) do nothing;
