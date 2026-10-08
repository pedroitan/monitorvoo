# Telas de referência

Mockups das telas do MVP. Servem de referência visual e de estrutura para as tarefas T8, T9 e T10 do `docs/HANDOFF.md`. Não são código de produção: reimplemente em Next.js (App Router) com componentes React.

Visualização interativa: canvas de design em https://claude.ai/artifact/1jCkC5UVpzv3SA275akXia

| Arquivo | Tela | Rota no app |
| --- | --- | --- |
| `desktop-inicio.dc.html` | Início (busca, promoções em andamento, rotas monitoradas) | `/` |
| `desktop-rota.dc.html` | Painel da rota (selo comprar/esperar, faixa normal, gráfico por companhia, curva de antecedência, sazonalidade, tabela por companhia) | `/rota/[origem]-[destino]` |
| `desktop-promocoes.dc.html` | Calendário de promoções (linha do tempo + padrão por companhia) | `/promocoes` |
| `desktop-alertas.dc.html` | Novo alerta + lista de alertas | `/alertas` |
| `mobile-mapa.dc.html` | Celular: mapa escuro com as rotas + painel com a lista | `/` em telas estreitas |
| `mobile-rota.dc.html` | Celular: rota com arco no topo e painel com gráfico e colunas | `/rota/...` em telas estreitas |
| `mobile-promocoes.dc.html` | Celular: promoções com mapa de aeroportos e lista | `/promocoes` em telas estreitas |

## Como ler os arquivos

- O layout está em HTML com estilos inline dentro de `<x-dc>`; ignore as tags `<x-dc>`, `<helmet>` e o `support.js`, que são do editor de design.
- `<sc-for list="{{x}}">` é um laço sobre a lista `x`; os dados de exemplo ficam no `renderVals()` do `<script>` no fim de cada arquivo. No app, esses dados vêm do Supabase.
- Todos os preços e percentuais são de exemplo.
- Na barra de navegação do celular, "Rotas", "Promoções" e "Alertas" são as três seções do app; a lupa abre a busca de rota.

## Tokens

| Token | Valor | Uso |
| --- | --- | --- |
| Fundo claro | `#F2F3F0` | páginas desktop |
| Fundo escuro | `#0A1322` | topo/mapa no celular |
| Tinta | `#0E1A2B` | texto, cabeçalho |
| Destaque | `#D9581C` (texto `#B5410F`; sobre fundo escuro `#F07B3F`) | só quedas de preço, promoções e CTA principal |
| Rota normal | `#6F93D9` | arcos de rotas com preço normal (mapa) |
| Rota acima do normal | `#4A5B7A` | arcos de rotas caras (mapa) |
| Faixa normal | `#DCE5F5` | banda nos gráficos |
| Promoção (fundo) | `#FBE3D4` | períodos de promoção nos gráficos |
| Séries | LATAM `#2457C5`, TAP `#0B7A6C`, Azul `#7B3FB0` | linhas por companhia |
| Fontes | Bricolage Grotesque (títulos), IBM Plex Sans (texto), IBM Plex Mono (preços, códigos IATA) | Google Fonts |

Regras: alvos de toque ≥ 44 px; contraste de texto ≥ 4,5:1; o destaque laranja nunca é usado para decoração.
