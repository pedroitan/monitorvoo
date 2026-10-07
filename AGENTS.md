# monitorvoo

## Preferencias do usuario

- Commits SEM assinatura/rodape de ferramenta (nada de "Generated with Devin" ou Co-Authored-By).

## Comandos

- Instalar deps do coletor: `pip install -r collectors/requirements.txt`
- Smoke test (1 chamada real, sem delay): `python -m collectors.collect --route GRU-SSA --leads 30 --trips one-way --max-calls 1 --no-delay`
- Coleta completa: `python -m collectors.collect` (sem credenciais Supabase, grava so JSON em `raw/`)
- Backfill de brutos locais -> Supabase: `python -m collectors.backfill`
- Ingestao ANAC (tarifas historicas): `python -m collectors.anac --months 24`
- Deteccao de promocoes: `python -m collectors.detect --verbose`
- App: `cd app && npm run dev` (porta 3000)

## Supabase

- Projeto: `rieafhwaldqpwhoywstw` (regiao sa-east-1)
- Migrations: `supabase/migrations/*.sql` (aplicar via SQL Editor ou pooler)
- Bucket `raw/` guarda o JSON bruto de cada coleta
- App le com anon key (RLS libera SELECT nas tabelas de mercado); escrita so service role

## Dados

- ANAC domesticas = BRL, internacionais = USD (ver coluna `currency` em anac_fares)
- ANAC usa codigos ICAO (SBGR) — mapeamento IATA<->ICAO em `collectors/anac.py`
- fast-flights 3.x: API nova (`create_query`/`FlightQuery`), sem selo low/typical/high
- `airline` em fare_observations = primeira cia da opcao; lista completa fica no JSON bruto
