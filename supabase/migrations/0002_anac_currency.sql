-- Tarifas internacionais da ANAC sao publicadas em USD; domesticas em BRL
alter table anac_fares add column if not exists currency text not null default 'BRL';
