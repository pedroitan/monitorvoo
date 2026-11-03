-- insight_route_rt estourava o statement_timeout: varre ~150k linhas de
-- fare_observations sem indice adequado. Indice cobrindo a consulta da view
-- (route_id + janela de 30 dias + colunas usadas no group/agregado).
create index if not exists fare_observations_route_cover
  on fare_observations (route_id, collected_at, flight_date, trip_type, price_brl);
