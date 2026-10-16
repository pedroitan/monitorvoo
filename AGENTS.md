# monitorvoo

## Preferencias do usuario

- Commits SEM assinatura/rodape de ferramenta (nada de "Generated with Devin" ou Co-Authored-By).

## Comandos

- Instalar deps do coletor: `pip install -r collectors/requirements.txt`
- Smoke test (1 chamada real, sem delay): `python -m collectors.collect --route GRU-SSA --leads 30 --trips one-way --max-calls 1 --no-delay`
- Coleta completa: `python -m collectors.collect` (sem credenciais Supabase, grava so JSON em `raw/`)
- Backfill de brutos locais -> Supabase: `python -m collectors.backfill`
- Ingestao ANAC (tarifas historicas): `python -m collectors.anac --months 24`
- Ingestao ANAC VRA (todos os voos regulares realizados no Brasil, por mes x cia x trecho -> `anac_flights`): `python -m collectors.anac_vra --months 12` (migration 0005; mes publicado com ~6 semanas de atraso; horarios em Brasilia; ICAO->IATA via OurAirports em cache)
- Maquina dedicada (notebook Ubuntu Server 24.04): `sudo bash deploy/linux/setup.sh` (firewall, SSH so chave, DNS-over-TLS, tampa fechada, systemd isolado); atualizar com `sudo bash /opt/monitorvoo/deploy/linux/update.sh`; logs `journalctl -u monitorvoo-study -f`. Ao migrar, desligar a tarefa do Windows (`Unregister-ScheduledTask MonitorVoo-Study`) para nao coletar em dobro
- Deteccao de promocoes: `python -m collectors.detect --verbose`
- App: `cd app && npm run dev` (porta 3000)
- Estudo Colombia (PRD V3), coleta horaria local: `python -m collectors.study` (`--plan` lista as buscas sem coletar; `--layers A --max-calls 3` para teste); painel A = 5 pares x 3 datas x ida+volta/2 sentidos (45 buscas/h): 4 pares Colombia + SSA-CGH nacional (desde 16/out)
- Agendar o estudo no Windows (toda hora, acorda o PC): `.\scripts\register_study_task.ps1`; logs em `logs/study-AAAA-MM-DD.log`
- `STUDY_GRID_SLOWDOWN` no `.env`: 2 = grade B com metade do volume (rampa da 1a semana), 1 = volume cheio (~110 buscas/h, ~25 min por rodada)
- Grade B: so ida em todos os pares (D+7..D+120), so ida D+121..D+270 nos pares principais (GRU/SSA <-> BOG/MDE/CTG), ida e volta de 7/10/14 dias (slot `rt7`/`rt10`/`rt14`) nos principais; pares que voltam vazios (`LOW_YIELD`) 3x mais espacados
- A tarefa NAO acorda o PC (sem WakeToRun); horas perdidas dormindo sao recuperadas na proxima execucao (`logs/study.state`, ate 12h, teto de 180 buscas de grade)
- Google Flights multi-city ("entra por uma cidade, sai por outra") nao devolve resultados na pagina; open-jaw e calculado somando dois so ida
- Camada D (malha Brasil): trechos com >= 30 voos/mes na view `anac_routes_latest` x antecedencias 7/21/45/90, so ida; orcamento por hora em `logs/study.state` (`brazil_budget`): comeca em 10, +2 por hora limpa, metade a cada bloqueio, teto `STUDY_BRAZIL_MAX`. Rotas novas entram com priority 3 (fora da home). Capacidade x bloqueios em `/qualidade`
- `.env` local: `TRAVELPAYOUTS_TOKEN` e `SERPAPI_KEY` estao VAZIOS (contas nunca criadas)
- `/achados`: conclusoes do estudo, lidas das views `insight_*` (migration 0004, agregam no banco, janela de 30 dias; migration 0006 corrige `insight_rt_vs_ow` para pares BR-BR e adiciona `insight_route_rt` = RT/só ida por rota em todas as fontes)

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
