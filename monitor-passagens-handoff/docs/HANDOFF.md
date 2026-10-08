# Handoff para Devin — Monitor de Passagens

## Como usar

O desenvolvimento vai em 10 tarefas pequenas, uma por sessão do Devin, cada uma terminando num pull request revisável. Agentes rendem mais com escopo fechado e critério de aceite claro do que com o PRD inteiro de uma vez.

1. Crie o repositório vazio no GitHub e conecte-o ao Devin.
2. Exporte a aba principal (PRD) como Markdown e salve no repositório em `docs/PRD.md`; salve esta aba como `docs/HANDOFF.md`.
3. Abra a primeira sessão com o prompt inicial abaixo, trocando o número da tarefa.
4. Revise e faça o merge de cada PR antes de abrir a próxima sessão. Tarefas posteriores dependem das anteriores.
5. Segredos nunca vão no chat nem no código: cadastre-os nos segredos do GitHub, da Vercel e do Devin.

**Referência visual.** As telas do MVP estão no [canvas de design](https://claude.ai/artifact/1jCkC5UVpzv3SA275akXia): no desktop, Início, Painel da rota, Calendário de promoções e Alertas; no celular, a versão 2 (App · Mapa de rotas, App · Rota, App · Promoções), com mapa escuro e painel branco por cima. A tela "Painel da rota — celular (v1)" fica só como histórico. O código de cada tela também está em `docs/design/`. Os valores nas telas são de exemplo. Tokens a seguir no código:

| Token | Valor | Uso |
| --- | --- | --- |
| Fundo | `#F2F3F0` | fundo das páginas |
| Tinta | `#0E1A2B` | texto, cabeçalho, botões secundários |
| Destaque | `#D9581C` (texto `#B5410F`) | apenas quedas de preço, promoções e CTA principal |
| Faixa normal | `#DCE5F5` | banda de preço normal nos gráficos |
| Séries | LATAM `#2457C5`, TAP `#0B7A6C`, Azul `#7B3FB0` | linhas por companhia |
| Fontes | Bricolage Grotesque (títulos), IBM Plex Sans (texto), IBM Plex Mono (preços e códigos IATA) | Google Fonts |

Nas tarefas T8, T9 e T10, o Devin deve reproduzir layout, hierarquia e comportamento responsivo dessas telas.

## Prompt inicial da sessão

```markdown
Você vai implementar uma parte do projeto "Monitor de Passagens", um app que coleta preços de passagens aéreas diariamente, guarda o histórico e detecta promoções das companhias.

Antes de codar, leia docs/PRD.md (visão de produto) e docs/HANDOFF.md (stack, estrutura, schema, regras). Siga a estrutura de pastas e as regras do HANDOFF à risca.

Tarefa desta sessão: T[NÚMERO] — [TÍTULO DA TAREFA], conforme a tabela de tarefas do HANDOFF.

Entregue:
- um pull request só com o escopo desta tarefa;
- testes automatizados cobrindo os critérios de aceite;
- descrição do PR com o que foi feito, como testar localmente e qualquer decisão que fugiu do HANDOFF.

Se algo no HANDOFF estiver ambíguo ou impedir a tarefa, pare e pergunte em vez de assumir.
```

## Estrutura do repositório

Monorepo com o app Next.js e os coletores Python lado a lado, compartilhando o mesmo banco Supabase.

```
monitor-passagens/
├── apps/
│   └── web/                  # Next.js (App Router), deploy na Vercel
│       ├── app/              # páginas: /, /rota/[origem]-[destino], /promocoes, /alertas
│       ├── app/api/          # rotas de API (leitura) + cron leve
│       ├── components/       # gráficos, cards, selo comprar/esperar
│       └── lib/supabase.ts
├── collectors/               # Python 3.12, rodado pelo GitHub Actions
│   ├── sources/
│   │   ├── google_flights.py # fast-flights (+ fallback SerpApi)
│   │   ├── travelpayouts.py
│   │   └── anac.py           # ingestão mensal dos microdados
│   ├── pipeline/
│   │   ├── normalize.py      # moeda, taxas, rota, companhia
│   │   ├── store.py          # grava bruto no Storage e linhas no Postgres
│   │   └── detect.py         # faixa normal, z-score, eventos de promoção
│   ├── alerts/
│   │   ├── telegram.py
│   │   └── email.py          # Resend
│   ├── config/routes.yaml    # rotas e antecedências monitoradas
│   ├── tests/
│   └── pyproject.toml
├── supabase/
│   └── migrations/           # SQL versionado
├── .github/workflows/
│   ├── collect.yml           # cron 3x/dia
│   ├── anac-monthly.yml      # cron mensal
│   └── ci.yml                # testes e lint em todo PR
└── docs/
    ├── PRD.md
    └── HANDOFF.md
```

## Variáveis de ambiente e segredos

| Variável | Usada em | Onde cadastrar | Obrigatória no MVP |
| --- | --- | --- | --- |
| `SUPABASE_URL` | web, collectors | Vercel, GitHub Secrets | Sim |
| `SUPABASE_ANON_KEY` | web (cliente) | Vercel | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | collectors, rotas de servidor | GitHub Secrets, Vercel (só server) | Sim |
| `TRAVELPAYOUTS_TOKEN` | collectors | GitHub Secrets | Sim |
| `SERPAPI_KEY` | collectors (fallback) | GitHub Secrets | Não |
| `TELEGRAM_BOT_TOKEN` | alerts | GitHub Secrets | Sim |
| `RESEND_API_KEY` | alerts | GitHub Secrets | Sim |
| `CRON_SECRET` | web (protege rota de cron) | Vercel | Sim |

O repositório deve ter um `.env.example` com todas as variáveis vazias. A chave `SERVICE_ROLE` nunca pode ir para o cliente do navegador.

## Schema do banco

Migração inicial para `supabase/migrations/0001_init.sql`. Preços em centavos (inteiro) para evitar erro de arredondamento; toda observação aponta para o arquivo bruto que a originou.

```sql
create table routes (
  id            bigint generated always as identity primary key,
  origin        char(3) not null,          -- IATA
  destination   char(3) not null,
  kind          text not null check (kind in ('domestic','international')),
  priority      smallint not null default 2, -- 1 = coleta 3x/dia, 2 = 1x/dia
  active        boolean not null default true,
  unique (origin, destination)
);

create table fare_observations (
  id              bigint generated always as identity primary key,
  route_id        bigint not null references routes(id),
  airline         text not null,             -- código IATA da companhia (LA, G3, AD...)
  collected_at    timestamptz not null,
  depart_date     date not null,
  return_date     date,                      -- null = só ida
  advance_days    integer not null,
  price_cents     integer not null,
  currency        char(3) not null,
  price_brl_cents integer not null,
  stops           smallint,
  source          text not null check (source in ('google_flights','serpapi','travelpayouts')),
  raw_path        text not null              -- caminho no Supabase Storage
);
create index on fare_observations (route_id, airline, advance_days, collected_at desc);

create table anac_fares (
  year        smallint not null,
  month       smallint not null,
  airline     text not null,
  origin      char(4) not null,             -- ICAO na base da ANAC
  destination char(4) not null,
  fare_cents  integer not null,
  seats       integer not null
);
create index on anac_fares (origin, destination, year, month);

create table promo_events (
  id                bigint generated always as identity primary key,
  airline           text not null,
  started_at        date not null,
  ended_at          date,                    -- null = em andamento
  routes_affected   bigint[] not null,
  avg_discount_pct  numeric(5,2),
  signal_source     text                     -- 'price' ou 'price+announcement'
);

create table alerts (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  route_id        bigint not null references routes(id),
  kind            text not null check (kind in ('target_price','promo')),
  target_price_cents integer,
  channel         text not null check (channel in ('email','telegram')),
  telegram_chat_id text,
  active          boolean not null default true,
  last_sent_at    timestamptz
);

-- RLS: leitura pública de routes, fare_observations, anac_fares e promo_events;
-- alerts visível e editável só pelo próprio usuário.
```

## Tarefas

Dez tarefas em ordem de dependência: T1–T5 formam a fundação de dados (fase 0 do PRD) e devem rodar 30 dias antes de o app ser divulgado; T6–T10 entregam o MVP.

| ID | Tarefa | Critérios de aceite |
| --- | --- | --- |
| T1 | Esqueleto do monorepo | Estrutura de pastas conforme o HANDOFF; Next.js sobe localmente; pacote Python instala com `pip install -e collectors`; `ci.yml` roda lint (ruff, eslint) e testes em todo PR; `.env.example` completo |
| T2 | Migração do banco | `0001_init.sql` aplica num projeto Supabase limpo; RLS configurada; seed de `routes` a partir de `config/routes.yaml`; teste que insere e lê uma observação |
| T3 | Coletor Google Flights | Para uma rota e uma data, retorna menor preço por companhia; grava JSON bruto no Storage e linhas em `fare_observations`; fallback SerpApi se fast-flights falhar; intervalo aleatório de 5–20 s entre requisições; testes com respostas gravadas (sem rede) |
| T4 | Coletor Travelpayouts | Mesma interface do T3, usando a Data API; marca `source = travelpayouts`; trata rota sem dados sem quebrar o lote |
| T5 | Agendamento | `collect.yml` roda 3x/dia para prioridade 1 e 1x/dia para prioridade 2; lotes em paralelo (matrix); resumo da execução nos logs; falha total abre issue automática |
| T6 | Ingestão ANAC | Script baixa e importa microdados de tarifas domésticas desde 2002 para `anac_fares`; idempotente (reexecutar não duplica); `anac-monthly.yml` agendado |
| T7 | Motor de detecção | `detect.py` calcula mediana e MAD de 28 dias por rota × companhia × antecedência; marca z ≤ −2 e z ≤ −3; agrupa em `promo_events` quando ≥ 30% das rotas da companhia disparam no mesmo dia; testes com séries sintéticas |
| T8 | Painel da rota (web) | Página `/rota/[origem]-[destino]` com gráfico de menor preço por dia de coleta (uma linha por companhia, faixa normal sombreada), curva de antecedência e selo comprar/esperar; responsivo; carrega em < 2 s com 90 dias de dados |
| T9 | Calendário de promoções | Página `/promocoes` com linha do tempo de `promo_events` por companhia, filtros por companhia e período |
| T10 | Alertas | Login por link mágico; usuário cria alerta de preço-alvo ou promoção; envio por e-mail (Resend) e Telegram após o `detect.py`; no máximo 1 alerta por rota por dia por usuário; link de descadastro |

## Regras para o agente

- Nunca contornar CAPTCHA, bloqueio de IP ou sistemas anti-bot; ao receber bloqueio, registrar e parar aquela fonte no lote.
- Não implementar scraping direto de sites de companhias aéreas ou de brokers (Skyscanner, Decolar); as fontes permitidas são as listadas na seção de dados do PRD.
- Respeitar limites: no máximo uma busca por combinação rota × data × antecedência por execução; intervalos aleatórios entre requisições.
- Sempre gravar o bruto antes de normalizar; nunca apagar arquivos brutos.
- Nenhum segredo em código, logs ou commits; ler tudo de variáveis de ambiente.
- Um PR por tarefa, com testes; não alterar o schema fora de uma nova migração numerada.
- Código e comentários em inglês; textos da interface em português do Brasil.
- O app não vende passagens: não integrar APIs de reserva, checkout ou pagamento; a compra é sempre um link para o site externo. Em dúvida sobre produto, perguntar em vez de inventar regra de negócio.

## Antes de começar

- [ ] Criar o repositório no GitHub e conectar ao Devin
- [ ] Criar projeto no Supabase (banco + Storage + Auth)
- [ ] Criar projeto na Vercel ligado ao repositório (raiz `apps/web`)
- [ ] Criar conta de afiliado na Travelpayouts e gerar o token da Data API
- [ ] Criar bot no Telegram (BotFather) e conta no Resend com domínio verificado
- [ ] (Opcional) Conta gratuita no SerpApi para o fallback
- [ ] Definir as 30 rotas iniciais em `config/routes.yaml` e quais são prioridade 1
- [ ] Cadastrar todos os segredos no GitHub, na Vercel e no Devin
- [ ] Exportar o PRD e este handoff para `docs/`
