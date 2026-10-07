# monitorvoo

## Preferencias do usuario

- Commits SEM assinatura/rodape de ferramenta (nada de "Generated with Devin" ou Co-Authored-By).

## Comandos

- Instalar deps do coletor: `pip install -r collectors/requirements.txt`
- Smoke test (1 chamada real, sem delay): `python -m collectors.collect --route GRU-SSA --leads 30 --trips one-way --max-calls 1 --no-delay`
- Coleta completa: `python -m collectors.collect` (sem credenciais Supabase, grava so JSON em `raw/`)
- Schema do banco: aplicar `supabase/migrations/0001_init.sql` no projeto Supabase
