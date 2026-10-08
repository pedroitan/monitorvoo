# Monitor de Passagens

App que coleta diariamente preços de passagens aéreas nas principais rotas saindo do Brasil, guarda o histórico e detecta promoções das companhias. O app não vende passagens: para comprar, o usuário é levado ao site da companhia ou do buscador.

## Documentação

- `docs/PRD.md` — visão de produto, fontes de dados, estratégia de coleta, detecção de promoções, arquitetura e roadmap.
- `docs/HANDOFF.md` — especificação para desenvolvimento: estrutura do repositório, variáveis de ambiente, schema SQL, as 10 tarefas com critérios de aceite e as regras para o agente.
- `docs/design/` — telas de referência (desktop e celular) e tokens visuais.

## Stack

Next.js na Vercel (app, API, alertas) · coletores Python 3.12 agendados no GitHub Actions · Supabase (Postgres, Storage, Auth).

## Status

Somente documentação. O desenvolvimento começa pela tarefa T1 do `docs/HANDOFF.md`.
