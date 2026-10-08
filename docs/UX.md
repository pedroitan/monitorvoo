# UX — Monitor de Passagens

Especificação de experiência derivada do PRD v2 (`monitor-passagens-handoff/docs/PRD.md`) e das telas de referência (`monitor-passagens-handoff/docs/design/`). Referência visual: https://claude.ai/artifact/1jCkC5UVpzv3SA275akXia

## 1. Modelo mental

O objeto central do produto é a **rota monitorada**, não o voo. O usuário não vem buscar "passagem para Lisboa dia 12" — isso os buscadores já fazem. Ele vem responder uma pergunta que nenhum buscador responde:

> **"O preço dessa rota está bom agora, ou vale esperar?"**

Toda a interface é organizada para responder essa pergunta em camadas de profundidade:

1. **Selo** — resposta binária em uma palavra ("Bom momento para comprar")
2. **Medidor de posição** — onde o preço de hoje está dentro da distribuição histórica
3. **Contexto** — por quê: promoção ativa, época do ano, antecedência
4. **Evidência** — o gráfico histórico e a tabela por companhia

O produto **não vende**: a compra é sempre um link externo ("Ver na LATAM"). Essa neutralidade é parte da proposta de valor e aparece repetida em todas as telas.

## 2. Vocabulário visual (unidades atômicas)

Cinco elementos reutilizáveis carregam toda a comunicação. Eles têm que significar a mesma coisa em qualquer tela:

| Componente | O que diz | Regra de dados |
|---|---|---|
| **Selo de status** | `Abaixo do normal` / `Normal` / `Acima do normal` | Posição do menor preço de hoje na distribuição dos últimos 28 dias da mesma série |
| **Selo de decisão** | `Bom momento para comprar` / `Preço normal` / `Vale esperar` | Versão acionável do selo; só aparece com histórico suficiente |
| **Medidor de posição** | régua min → faixa normal → max, marcador "hoje" | p25–p75 = faixa normal; min/max = extremos dos últimos 28–90 dias |
| **Sparkline** | tendência dos últimos ~30 dias | menor preço por dia de coleta, uma linha |
| **Card de promoção** | companhia, desconto médio, nº de rotas, início | `promo_events` com `ended_at` nulo ou recente |

Regras de cor: laranja `#D9581C`/`#B5410F` **só** para queda de preço, promoção e CTA principal — nunca decoração. Faixa normal `#DCE5F5`, promoção `#FBE3D4`. Números sempre em IBM Plex Mono (tabular).

## 3. Jornadas do usuário

### J1 — Primeira visita ("está caro?")

1. Cai na home → vê hero + busca origem/destino + promoções em andamento
2. Busca ou clica numa rota do grid (card com sparkline + selo + menor preço)
3. No painel da rota: selo responde na hora; medidor mostra *por quê*; gráfico dá evidência
4. Se o preço estiver ruim → descobre a curva de antecedência ("comprar com ~2 meses sai mais barato") e a sazonalidade
5. Saída natural: "Ver no site" da companhia — ou criar alerta para voltar depois

**Momento de auth adiado:** o login só aparece quando o usuário tenta criar alerta — depois de já ter percebido valor. Nunca antes.

### J2 — Usuário com alerta ("me avisaram")

1. Recebe e-mail/Telegram: "SSA→LIS caiu para R$ 2.960 (−20% vs. normal)"
2. Deep link direto no painel da rota, já com a série correta selecionada
3. Vê o selo + card de promoção ativa (quantas rotas, desde quando, duração média histórica → urgência real: "campanhas da LATAM duram ~4 dias")
4. Decide: "Ver na LATAM" (converte) ou espera o alerta seguinte

Este é o loop de retenção do produto: o alerta só é bom se a página de destino confirmar a oportunidade em 3 segundos.

### J3 — Explorador de padrões ("quando a GOL solta promoção?")

1. Home → "Ver calendário completo" → página de promoções
2. Linha do tempo por companhia mostra ritmo e duração das campanhas
3. Tabela "padrão de cada companhia" responde: quantas nos últimos 90 dias, duração média, desconto médio, **dia que costuma começar**
4. CTA: "criar alerta de promoção" — transforma curiosidade em retenção

### J4 — Viajante flexível ("quando vale voar?")

1. Painel da rota → "Época do ano" (ANAC): meses acima/abaixo da média
2. Curva de antecedência: qual janela de compra sai mais barato
3. Combina os dois: "voar em novembro, comprando em setembro"

## 4. Arquitetura de informação

```
/                  Home: busca + promoções ativas + rotas monitoradas
/rota/SSA-LIS      Painel da rota (a tela principal do produto)
/promocoes         Calendário de promoções
/alertas           Login (magic link) + criar/gerenciar alertas
```

**Decisão: uma só experiência.** Mobile e desktop usam a mesma estética e os mesmos componentes — o celular é a versão compacta das mesmas telas, não um paradigma diferente. O mapa escuro das referências mobile fica descartado; o que se mantém da referência mobile é a bottom nav pill (Rotas · Promoções · Alertas + busca), que é um bom padrão de navegação por polegar e combina com a linguagem visual.

Nav desktop: header escuro `#0E1A2B` | logo · Rotas · Promoções · Meus alertas | Entrar
Nav mobile: mesmo header escuro compacto (logo + Entrar) + bottom pill fixa com as 3 seções

## 5. Telas

### 5.1 Home (`/`)

Blocos em ordem:

1. **Hero escuro** — headline "Saiba se o preço da passagem está bom antes de comprar" + form de busca (Origem, Destino, Ida e volta/Só ida → "Ver histórico"). A busca é **seleção entre rotas monitoradas**, não busca aberta — autocomplete sobre a lista de rotas.
2. **Promoções em andamento** — cards por companhia: desconto médio, nº de rotas afetadas, "desde quando". Badge "Em andamento" vs "Encerrada". Se não houver nenhuma: estado vazio honesto ("Nenhuma promoção ativa agora — acompanhe a linha do tempo").
3. **Rotas monitoradas** — grid de cards: código IATA, nome da rota, sparkline 30d, menor preço hoje + companhia, selo de status. Filtros: Todas / Nacionais / Internacionais / Saindo de [origem].
4. **Faixa de confiança** — 3 colunas: não vendemos / de onde vêm os dados / preço de referência.

### 5.2 Painel da rota (`/rota/[origem]-[destino]`)

Hierarquia:

1. **Header** — breadcrumb, `SSA → LIS` grande, "ida e volta, 7 dias · tarifa básica, 1 adulto", CTA "Criar alerta para esta rota"
2. **Seletores** — Antecedência (7/14/30/60/90/180d) × Período do gráfico (30d/90d/1ano). A antecedência troca a **série inteira** — cada combinação é uma série temporal própria.
3. **Faixa de situação** (3 cards):
   - Card escuro: selo de decisão + menor preço hoje + "X% abaixo da mediana de 28 dias, na LATAM"
   - Medidor de posição: régua com faixa normal sombreada e marcador "hoje"
   - Card de promoção ativa na rota (se houver): desconto, companhia, rotas afetadas, duração média histórica → link pro calendário
4. **Gráfico principal** — menor preço por dia de coleta, uma linha por companhia, faixa normal sombreada, períodos de promoção destacados em laranja claro com etiquetas
5. **Quando comprar** — barras de preço médio por antecedência; a melhor janela em destaque laranja + frase de leitura ("comprar com ~2 meses costuma sair mais barato")
6. **Época do ano** — 12 barras de tarifa média mensal vs. média anual (fonte ANAC) + frase de leitura
7. **Por companhia hoje** — tabela: menor hoje, mediana 28d, diferença %, voo (direto/escalas/duração), link "Ver no site". Rodapé: "coletados hoje às 06:12 · não vendemos passagens"

### 5.3 Promoções (`/promocoes`)

1. Explicação do critério em uma frase ("marcamos quando várias rotas da mesma companhia caem bem abaixo do normal no mesmo dia")
2. Filtros: companhia + período
3. **Linha do tempo** — uma linha por companhia, barras = eventos (preenchida = encerrada, contorno = em andamento), click vai pra rota
4. **Padrão de cada companhia** — tabela: nº de promoções, duração média, desconto médio, "costuma começar" (dia da semana)
5. CTA escuro: criar alerta de promoção

### 5.4 Alertas (`/alertas`)

- **Form "Novo alerta"**: origem/destino (rotas monitoradas), tipo (preço-alvo OU "promoção na rota"), preço-alvo com contexto ("faixa normal hoje: R$ X–Y · menor dos 90 dias: R$ Z"), canais (e-mail/Telegram), promessa "no máximo um aviso por rota por dia"
- **"Meus alertas"**: rota, regra, preço agora, último aviso, pausar/excluir
- **Conectar Telegram** em um clique (bot)

### 5.5 Mobile — mesmas telas, compactas

Mesma estética do desktop (fundo `#F2F3F0`, cards brancos, header escuro), adaptações:

- **Home**: hero comprime (headline ~32px, form empilhado em coluna), promoções e rotas viram lista vertical de cards. Na lista de rotas, cada item pode usar o formato da referência mobile — "% vs normal" em destaque + status + preço — que é mais legível que sparkline em tela estreita.
- **Painel da rota**: ordem vertical fixa — selo/preço → medidor → filtros de antecedência (chips scrolláveis) → gráfico compacto → tabela de companhias (colunas: companhia · hoje · mediana · vs normal) → curva de antecedência → sazonalidade. CTAs "Criar alerta" e "Ver no site" fixos no rodapé.
- **Promoções**: cards de promoções ativas primeiro (com seção "Para você" quando logado), linha do tempo com scroll horizontal depois.
- **Nav**: bottom pill fixa (Rotas · Promoções · Alertas) + botão de busca; header escuro compacto no topo.

## 6. Lógica dos selos e estados de dados

### Decisão (posição do menor preço de hoje na distribuição de 28d da mesma série)

| Condição | Selo de status | Selo de decisão |
|---|---|---|
| z ≤ −2 ou abaixo de p25 | Abaixo do normal | **Bom momento para comprar** |
| p25 ≤ p ≤ p75 | Normal | Preço normal |
| acima de p75 | Acima do normal | Vale esperar |
| poucos dados | — | "Ainda coletando histórico" |

### Honestidade com poucos dados (crítico para credibilidade)

- Menos de ~10 coletas na série → **não mostrar selo nem faixa**; mostrar "coletando desde DD/MM" + gráfico com os pontos existentes
- Falha de coleta no dia → lacuna no gráfico, não interpolar
- O rodapé "coletados às HH:MM" sempre visível — o usuário precisa saber a idade do dado
- Série sem voos retornados (rota sazonal) → estado explícito, não zero

## 7. Priorização por valor de usuário

| Ordem | Peça | Por quê |
|---|---|---|
| 1 | Painel da rota completo (selo + medidor + gráfico + antecedência + sazonalidade + tabela) | É a resposta à pergunta central; todo o resto orbita ela |
| 2 | Home com selos, sparklines e cards de promoção | Entrada e distribuição |
| 3 | Alertas (F4) | Loop de retenção; o único motivo para voltar |
| 4 | Calendário de promoções (F3) | Valor editorial; melhora com meses de dados |
| Descartado | Mapa escuro mobile das referências | Experiências divergentes entre plataformas; o painel compacto entrega o mesmo valor |
| Adiar | "Padrão de cada companhia" (dia da semana etc.) | Precisa de ~90+ dias de eventos |
| Fora | Heatmap por data de voo (F6), previsão (F8), B2B (F9) | v2/v3 conforme PRD |

## 8. Métricas de UX a instrumentar

- Selo → clique em "Ver no site" (conversão da recomendação)
- Alerta enviado → clique no deep link (meta PRD: ≥20%)
- Alertas criados por sessão no painel da rota
- Retorno na 4ª semana (meta PRD: ≥30%)

## 9. Microcopy (pt-BR)

- Headline: "Saiba se o preço da passagem está bom antes de comprar."
- Selo positivo: "Bom momento para comprar" (nunca "compre agora" — não vendemos)
- Confiança: "Não vendemos passagens. Monitoramos e avisamos; a compra é no site da companhia."
- Precisão: "Tarifa básica, 1 adulto, sem bagagem despachada."
- Alerta: "No máximo um aviso por rota por dia. Pause ou cancele quando quiser."
