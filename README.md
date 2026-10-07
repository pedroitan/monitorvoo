# monitorvoo

Monitor de precos de passagens aereas — historico, faixa normal e alertas de promocao.
PRD: `PRD — Monitor de Preços de Passagens Aéreas.md`

## Estrutura

- `collectors/` — coletores Python (Google Flights via fast-flights)
- `supabase/migrations/` — schema do banco
- `app/` — Next.js (a criar)
- `raw/` — respostas brutas locais (gitignored; no Supabase vai para o bucket `raw/`)

## Setup do coletor

```bash
pip install -r collectors/requirements.txt
cp .env.example .env   # preencher SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
```

Sem credenciais o coletor roda em modo local: grava so o JSON bruto em `raw/`,
sem escrever no banco.

## Rodar

```bash
# smoke test — 1 chamada, sem delay
python -m collectors.collect --route GRU-SSA --leads 30 --trips one-way --max-calls 1 --no-delay

# coleta completa (todas as rotas x antecedencias x tipos)
python -m collectors.collect
```

No GitHub Actions roda 3x/dia (`.github/workflows/collect.yml`).

## Banco

Aplicar `supabase/migrations/0001_init.sql` no SQL Editor do projeto Supabase
(ou via Supabase CLI). Cria as tabelas e o bucket `raw` no Storage.
