# PRD — Monitor de Preços de Passagens Aéreas (V3)

Oct 11, 2026 · @Itan · substitui as prioridades da V2 (a V2 continua como referência de fontes, riscos e arquitetura)

## 1. O que muda na V3

A V2 tentou cobrir 30 rotas com uma coleta de baixa frequência e uma interface centrada em "a rota está boa?". Na prática, os dados ainda não permitem afirmar nada com segurança: a coleta é irregular, as falhas não são registradas e não há cobertura de madrugada.

A V3 muda o foco para **qualidade e volume de dados num recorte pequeno**, com um estudo de caso: **Brasil → Colômbia**.

1. **Dados primeiro.** Uma grade de coleta planejada, auditável e contínua (inclusive de madrugada), antes de novas telas.
2. **Busca tradicional.** O usuário escolhe destino e datas de ida e volta, e o site mostra a forma mais barata e acessível de entrar na Colômbia, comparando as opções entre si.
3. **Laboratório de comportamento de preço.** Telas que respondem, com evidência, como as companhias variam o preço.

## 2. Perguntas que o produto precisa responder

| # | Pergunta | Dado necessário | Quando dá para responder |
|---|---|---|---|
| Q1 | Como o preço varia ao longo do dia, inclusive de madrugada? | A mesma busca repetida de hora em hora, 24×/dia | Com ≥ 14 dias de painel horário |
| Q2 | Com que antecedência o preço é menor e com qual é maior? | Grade de datas de partida coletada todo dia | Leitura transversal: imediata. Leitura da mesma data ao longo do tempo: com ≥ 4–6 semanas |
| Q3 | Existe dia da semana mais barato? | (a) dia da semana **do voo**: grade de datas; (b) dia da semana **da compra**: coleta diária contínua | (a) imediato; (b) com ≥ 4 semanas |
| Q4 | Ida e volta combinada vs. dois trechos só ida: qual é mais barato? | Para as mesmas datas: ida e volta (IV), só ida de ida (SO↑) e só ida de volta (SO↓) | Imediato, para cada busca; padrão geral com ≥ 2 semanas |
| Q5 | Qual é a entrada mais barata e acessível na Colômbia para as minhas datas? | Mesmas datas para todos os aeroportos colombianos e para as duas origens | Imediato, assim que a grade cobrir as datas |

## 3. Escopo do estudo de caso Colômbia

- **Origens:** Salvador (SSA) e São Paulo (GRU e CGH).
- **Destinos:** Bogotá (BOG), Medellín (MDE), Cartagena (CTG), Cali (CLO), Barranquilla (BAQ), Santa Marta (SMR), Pereira (PEI).
- **Sentidos:** ida (BR → CO) e volta (CO → BR), para permitir a comparação IV × 2 só ida.
- **Total:** 3 origens × 7 destinos × 2 sentidos = **42 rotas direcionais**.
- **Janela de viagem:** partida de D+30 a D+120 (flexível), mais uma faixa curta de D+7 a D+29 para a curva de antecedência. A janela cobre a alta temporada (dezembro/janeiro).
- **Tarifa de referência:** econômica básica, 1 adulto, BRL, sem bagagem despachada.
- **Ida e volta:** sempre nas datas exatas escolhidas pelo usuário (não há duração fixa no produto). Só o painel horário usa pares de datas fixos.

As 30 rotas da V2 (nacionais e internacionais) **saem do foco**: continuam no Actions 2×/dia, sem nova funcionalidade.

## 4. Plano de coleta

### 4.1 Onde roda

Na **máquina local (Windows Task Scheduler)**, que hoje não sofre bloqueio do Google. O GitHub Actions fica só com as rotas da V2.

Requisitos para a madrugada ter cobertura:

- Desativar a suspensão do PC (ou habilitar "acordar o computador para executar esta tarefa").
- Tarefa a cada hora, com "executar o quanto antes se um horário for perdido".
- Toda hora perdida aparece como lacuna registrada (ver 4.4), nunca como silêncio.

Risco aceito: com o PC desligado, não há coleta. Se a cobertura horária ficar abaixo da meta por duas semanas, migrar para o Proxmox (LXC) ou adicionar um proxy (o código já aceita `HTTP_PROXY`).

### 4.2 Camadas de coleta

| Camada | Objetivo | O que coleta | Frequência | Chamadas/dia |
|---|---|---|---|---|
| **A — Painel horário** | Q1, Q4 | 4 pares fixos (GRU-BOG, GRU-MDE, GRU-CTG, SSA-BOG) × 3 pares de datas fixos (ida D+21/volta D+28, ida D+60/volta D+67 e um par de alta temporada, 18/12 → 04/01) × 3 buscas (IV, SO↑, SO↓). Os pares relativos são renovados a cada 4 semanas | **24×/dia** (a cada hora) | ~864 |
| **B — Grade de datas** | Q2, Q3, Q5 e o calendário | 42 rotas × datas de partida D+7..D+120, só ida. D+7..D+30 atualizado a cada 2 dias; D+31..D+120 a cada 4 dias | Distribuída ao longo do dia (~60 chamadas/h) | ~1.450 |
| **C — Fila sob demanda** | Q4/Q5 nas datas do usuário | Ida e volta nas datas exatas buscadas no site e ainda sem dado (tabela `search_requests`) | A cada hora, até 50/dia | ≤ 50 |
| **D — Rotas V2** | Manter o histórico existente | 30 rotas × antecedências fixas | Actions, 2×/dia | ~360 |

**Teto local:** ~2.400 chamadas/dia (≈ 1,7 por minuto), com intervalo aleatório de 5–15 s e no máximo 2 retentativas. Se aparecerem 3 bloqueios seguidos, o coletor pausa a hora corrente e registra o status `blocked`. Na primeira semana a camada B roda com metade do volume; o volume só sobe se a taxa de `blocked` ficar abaixo de 2%.

### 4.3 Por que essa grade responde as perguntas

- **Q1:** a camada A repete exatamente a mesma busca 24×/dia. A variação entre horas é a variação imposta pela companhia, não ruído de amostra diferente.
- **Q2:** a camada B dá, todo dia, o preço por antecedência (corte transversal). Como as mesmas datas são recoletadas, também dá a trajetória de cada data conforme o voo se aproxima (corte longitudinal).
- **Q3:** o dia da semana do voo sai da grade B. O dia da semana da compra sai da repetição diária das camadas A e B.
- **Q4:** as camadas A e C coletam IV, SO↑ e SO↓ para as mesmas datas. A métrica é `spread = IV − (SO↑ + SO↓)`.
- **Q5:** a camada B cobre todos os destinos e as duas origens nas mesmas datas, o que permite ranquear as entradas.

## 5. Qualidade de dados (requisitos)

| ID | Requisito | Situação hoje |
|---|---|---|
| DQ1 | **Registro de cada chamada** numa tabela `collection_runs`: camada, rota, datas, tipo, status (`ok` / `empty` / `error` / `blocked` / `missed`), nº de opções, duração, horário | Não existe; erros só aparecem no log do processo |
| DQ2 | **Fuso horário correto**: partida e chegada no horário local do aeroporto (sem rotular como UTC) | Bug: hora local gravada como `+00:00` |
| DQ3 | **Identidade do itinerário**: chave = números de voo de todos os trechos + partida. Base para deduplicar e seguir o mesmo voo no tempo | Parcial (só o 1º trecho) |
| DQ4 | **Parser robusto**: eliminar o erro `'NoneType' object is not subscriptable` (visto em SID-GRU e em 180d da Colômbia) e registrá-lo como `error` com o HTML salvo | Erro recorrente |
| DQ5 | **Completude das opções**: verificar se capturamos todas as opções que o Google mostra (melhores + outras), não só um bloco | A verificar |
| DQ6 | **Semântica de preço IV**: deixar explícito que o preço de IV é o total da viagem de ida e volta | A documentar no modelo |
| DQ7 | **JSON bruto compactado (gzip)** no Storage, para caber no plano | Sem compressão; ~650 MB/mês no volume da V3 |
| DQ8 | **Validação de outliers**: marcar (não apagar) preços fora de bounds por rota/IQR | Não existe |

**Painel de qualidade (`/qualidade`)** passa a mostrar, para a Colômbia:

- grade esperado × coletado por hora (últimos 7 dias), por camada;
- % de status por camada (`ok` / `empty` / `error` / `blocked` / `missed`);
- idade do dado por data da grade B ("atualizado há X h");
- alerta visual se alguma hora ficou sem coleta.

## 6. Interface (nova priorização visual)

### 6.1 Prioridade 1 — Busca Colômbia (`/` e `/busca`)

Formulário tradicional:

- Origem: Salvador / São Paulo.
- Destino: "Colômbia — qualquer aeroporto" ou um aeroporto específico.
- Ida e volta: data de ida + data de volta (ou só ida).

A data é obrigatória. O calendário de preços (o recurso mais bem avaliado até agora) aparece no próprio seletor de datas, com o menor preço por dia.

**Resultado**, em ordem:

1. **Ranking de entradas na Colômbia:** um card por aeroporto com o menor preço total da viagem, companhia, escalas, duração e horário da coleta.
2. **IV × 2 só ida, lado a lado em cada card:** "Comprar 2 trechos separados economiza R$ X" ou "Ida e volta combinada economiza R$ X". Se a IV ainda não foi coletada para essas datas, mostrar "buscando ida e volta, pronto em até 1 h" (camada C).
3. **Flexibilidade ±3 dias:** faixa com os preços dos dias vizinhos para ida e volta.
4. **Contexto do preço:** "está abaixo/acima do normal para essa antecedência", melhor antecedência observada e melhor dia da semana da rota, só quando houver dado suficiente (seguindo as regras de honestidade da UX).
5. **Detalhe por aeroporto:** lista de voos e horários (reusa `DailyFlights`) e link para comprar no site da companhia.

### 6.2 Prioridade 2 — Laboratório Colômbia (`/colombia/estudo`)

Uma seção por pergunta, cada uma com o nº de dias de dado e o tamanho da amostra:

- **Q1 Variação intradiária:** heatmap hora × dia e curva média por hora (com a madrugada destacada), por companhia.
- **Q2 Antecedência:** curva de preço por dias até o voo, com a melhor e a pior janela.
- **Q3 Dia da semana:** barras por dia do voo e por dia da compra.
- **Q4 IV × 2 só ida:** distribuição do spread por rota e companhia; % de casos em que cada opção vence.
- **Q5 Entradas:** comparação dos 7 aeroportos ao longo do tempo.

### 6.3 Prioridade 3 — Qualidade (`/qualidade`)

Conforme a seção 5. É a tela de confiança interna: deve ser consultada antes de qualquer conclusão.

### 6.4 Mantido sem evolução / adiado

- Páginas de rota (`/rota/...`) e calendário: mantidos, servem de detalhe a partir da busca.
- Home de rotas V2, promoções, alertas e classificador comprar/esperar: **adiados** até a Fase 3.

## 7. Modelo de dados (mudanças)

| Tabela | Mudança |
|---|---|
| `collection_runs` (nova) | id, run_at, layer (A/B/C/D), route_id, flight_date, return_date, trip_type, status, n_options, duration_ms, error, raw_ref |
| `fare_observations` | + `run_id`, + `itinerary_key`, + `layer`; `departure`/`arrival` como horário local (`timestamp` sem fuso) + `departure_tz` |
| `search_requests` (nova) | id, origin, destination, out_date, ret_date, requested_at, status, run_id |
| `panel_queries` (nova) | definição dos pares fixos da camada A e seu ciclo de validade |

## 8. Roadmap

| Fase | Entregas | Critério para avançar |
|---|---|---|
| **0 — Fundação de dados** (agora) | DQ1–DQ4 e DQ7; coletor local com camadas A, B e C; agendamento horário no Task Scheduler; `/qualidade` com grade esperado × coletado | 7 dias seguidos com ≥ 95% das horas da camada A em `ok` e ≥ 90% das datas da grade B atualizadas em ≤ 72h |
| **1 — Busca Colômbia** | `/busca` com ranking de entradas, IV × 2 só ida, flexibilidade ±3 dias, fila sob demanda | Busca respondendo para qualquer par de datas em D+30..D+120 |
| **2 — Laboratório** | Q4 e Q5 logo de início; Q1 após 14 dias; Q2 longitudinal e Q3 (compra) após 4–6 semanas | Conclusões com amostra mínima declarada na tela |
| **3 — Retomar V2** | Alertas por preço-alvo, voo específico, classificador comprar/esperar, novos destinos | Padrões da Colômbia validados |

## 9. Riscos

| Risco | Mitigação |
|---|---|
| PC desligado ou suspenso → lacunas, principalmente de madrugada | Configuração de energia; lacunas registradas como `missed`; migrar para Proxmox/proxy se a cobertura ficar < 95% |
| Bloqueio do Google no IP residencial | Teto de 2.400/dia, rampa na 1ª semana, intervalos aleatórios, pausa automática ao detectar bloqueio |
| CGH não tem voos internacionais | Os resultados de CGH são sempre com conexão doméstica; servem para comparar com GRU (pode ser mais barato sair de CGH) |
| Storage do Supabase estourar | JSON bruto em gzip; revisar retenção do bruto após 90 dias |
| Rotas SSA → Colômbia sem voo direto (muitas escalas e opções caras) | Registrar como `empty`/`ok` normalmente; mostrar escalas e duração no ranking |
| Conclusões precipitadas com pouco dado | Cada gráfico do laboratório mostra dias de coleta e tamanho de amostra; selo "dados insuficientes" abaixo do mínimo |

## 10. Questões em aberto

- [x] São Paulo: GRU e CGH.
- [x] Destinos: os 7 aeroportos colombianos.
- [x] Painel horário inclui um par de datas de alta temporada.
- [ ] Depois da Colômbia, qual é o próximo estudo de caso (Madri, Cabo Verde)?
