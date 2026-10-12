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
- Estudo Colombia (PRD V3), coleta horaria local: `python -m collectors.study` (`--plan` lista as buscas sem coletar; `--layers A --max-calls 3` para teste)
- Agendar o estudo no Windows (toda hora, acorda o PC): `.\scripts\register_study_task.ps1`; logs em `logs/study-AAAA-MM-DD.log`
- `STUDY_GRID_SLOWDOWN` no `.env`: 2 = grade B com metade do volume (rampa da 1a semana), 1 = volume cheio

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
- Google Flights devolve 2 blocos: payload[2] (melhores) e payload[3] (outros); o parser le os dois (o mais barato costuma estar so no [2])
- `departure`/`arrival` = horario LOCAL do aeroporto (timestamp sem fuso, migration 0003); no app usar `formatLocalTime`, e `formatCollected` (America/Sao_Paulo) para `collected_at`
- Toda chamada do estudo vira linha em `collection_runs` (ok/empty/error/blocked); o GitHub Actions sofre bloqueio do Google, a coleta do estudo roda local
- Os endpoints internos do Google Flights (`GetShoppingResults`, `GetCalendarGraph`, usados pela lib `fli`) exigem header assinado (`x-goog-batchexecute-bgr`) desde ago/2026 — nao funcionam fora da pagina. A unica fonte viavel e a pagina HTML via fast-flights (~300 KB gz por busca). Ate o proprio `fli` voltou a baixar a pagina.

## App / visual

- Referencia de design: `Monitor de Passagens — TelasV2.html` na raiz (telas "v3": Busca, Melhor preco da data, Comportamento das companhias, versoes mobile)
- Tokens da paleta V3 em `app/app/globals.css` (fundo #F4F4F1, tinta #111318, link #2B4BF2, bom preco #E3F4EA/#0B7A48, acima #FBE7E5/#B3261E, borda #E4E4DF)
- Fontes: Geist + Geist Mono via next/font (`--font-geist`, `--font-geist-mono`)
- `/pesquisa`: pagina de exploracao do banco — variacao de preco por horario de coleta e todos os voos do trecho
