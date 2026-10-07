# PRD — Monitor de Preços de Passagens Aéreas

Oct 6, 2026 · @Itan

## Visão geral

O produto é um monitor de tarifas aéreas que coleta preços diariamente nas principais rotas nacionais e internacionais saindo do Brasil, guarda o histórico e mostra quando comprar. O diferencial não é buscar o voo mais barato de hoje (isso os buscadores já fazem), e sim revelar padrões ao longo do tempo: sazonalidade, antecedência ideal e janelas de promoção de cada companhia.

**Problema.** Buscadores como Google Flights, Skyscanner e Decolar mostram o preço do momento, com histórico curto ou nenhum. O viajante não sabe se R$ 1.200 para Salvador–Lisboa é caro ou barato, nem se a LATAM costuma soltar promoção nessa rota às terças.

**Proposta de valor.** Para cada rota: gráfico de preço por data de coleta, faixa normal de preço, alertas quando o valor cai abaixo dessa faixa e um calendário de promoções detectadas por companhia.

**O que o produto não faz.** O app não vende passagens nem intermedeia compras. Ele monitora, analisa e avisa; para comprar, o usuário é direcionado ao site da companhia ou do buscador.

**Público-alvo.**

- Viajantes de lazer flexíveis em data, que podem esperar a hora certa
- Profissionais que viajam com frequência entre capitais (ex.: Salvador–São Paulo)
- Criadores de conteúdo e perfis de "alerta de passagem barata"
- Agências pequenas e analistas de mercado (versão B2B, fase posterior)

## Objetivos e métricas de sucesso

O MVP é bem-sucedido se acumular 90 dias de histórico confiável em pelo menos 30 rotas e gerar alertas que os usuários considerem úteis.

| Objetivo | Métrica | Meta MVP (proposta) |
| --- | --- | --- |
| Cobertura | Rotas monitoradas com coleta diária | 30 rotas (20 nacionais, 10 internacionais) |
| Confiabilidade | % de coletas agendadas concluídas | ≥ 95% |
| Profundidade | Dias de histórico contínuo por rota | ≥ 90 dias |
| Precisão | Diferença entre preço exibido e preço real no site da companhia | ≤ 5% em amostragem manual |
| Utilidade | Alertas clicados / alertas enviados | ≥ 20% |
| Retenção | Usuários ativos na 4ª semana | ≥ 30% |

As metas são pontos de partida para calibrar depois do primeiro mês de dados.

## Escopo

O MVP cobre as três maiores companhias nacionais, as estrangeiras das rotas internacionais e um conjunto fixo de rotas de alto volume, coletadas em várias antecedências.

**Companhias.** LATAM, GOL, Azul (nacionais) e, nas rotas internacionais, as estrangeiras que aparecerem nas fontes (TAP, Air France, American, Copa etc.).

**Rotas nacionais (exemplo inicial).** GRU/CGH–SDU/GIG, GRU–SSA, GRU–REC, GRU–FOR, GRU–BSB, GRU–POA, GRU–CNF, SSA–BSB, SSA–REC, GIG–SSA, BSB–REC, GRU–MAO, GRU–BEL, GRU–FLN, VCP–SSA (Azul).

**Rotas internacionais (exemplo inicial).** GRU–LIS, GRU–MIA, GRU–MCO, GRU–EZE, GRU–SCL, GRU–CDG, GRU–MAD, GRU–JFK, SSA–LIS, REC–LIS.

**Antecedências coletadas por rota.** Partida em 7, 14, 30, 60, 90 e 180 dias, ida e volta de 7 dias e só ida. Cada combinação vira uma série temporal própria.

**Fora do escopo do MVP.** Bagagem e assento, programas de milhas, rotas com conexão longa como foco principal.

## Funcionalidades e requisitos funcionais

O MVP entrega quatro telas: busca de rota, painel da rota, calendário de promoções e alertas.

| ID | Funcionalidade | Descrição | Prioridade |
| --- | --- | --- | --- |
| F1 | Painel da rota | Gráfico de linha do menor preço por dia de coleta, uma linha por companhia, com faixa normal (percentis 25–75) sombreada | MVP |
| F2 | Curva de antecedência | Preço médio por dias até o voo (7 a 180), mostrando a janela mais barata para comprar | MVP |
| F3 | Calendário de promoções | Linha do tempo com os dias em que cada companhia teve queda anômala, com duração e rotas afetadas | MVP |
| F4 | Alertas de preço | Usuário define rota e preço-alvo, ou pede "me avise de promoção"; envio por e-mail, push ou Telegram | MVP |
| F5 | Indicador "bom momento?" | Selo comprar / esperar, baseado na posição do preço atual na distribuição histórica | MVP |
| F6 | Mapa de calor por data de voo | Grade dia de partida × preço, para escolher datas flexíveis | v2 |
| F7 | Comparativo entre companhias | Diferença média de preço e frequência de promoções por companhia | v2 |
| F8 | Previsão de preço | Modelo que estima tendência dos próximos 7–14 dias | v2 |
| F9 | API / exportação B2B | CSV e API para agências e imprensa | v3 |

**Requisitos não funcionais.** Coleta agendada diária (rotas prioritárias 2–4 vezes ao dia), histórico imutável com data e hora da coleta, fonte registrada em cada preço, interface responsiva em português, conformidade com LGPD para dados de usuários (e-mail, alertas).

## Fontes de dados gratuitas e acessíveis

A melhor combinação gratuita é: ANAC para o histórico longo (anos de tarifas reais vendidas), Travelpayouts para preços recentes de alta cobertura, e Google Flights (via biblioteca ou SerpApi) para a coleta diária própria. Nenhuma fonte gratuita entrega sozinha "preço ofertado hoje, por companhia, todo dia" — esse histórico o produto precisa construir.

| Fonte | O que entrega | Custo / limite | Uso no produto |
| --- | --- | --- | --- |
| [ANAC – microdados de tarifas comercializadas](https://monitormercantil.com.br/anac-abre-microdados-das-tarifas-aereas-de-maio/) | Tarifas efetivamente vendidas a adultos, por empresa, rota e mês; domésticas desde 2002 e internacionais desde 2011. Exclui milhas, pacotes e tarifas corporativas | Gratuito, dados abertos oficiais | Histórico de sazonalidade e preço médio por rota/companhia desde o dia 1. Granularidade mensal e com defasagem, não serve para promoção do dia |
| Pacote R [flightsbr](https://erised.las.iastate.edu/CRAN/web/packages/flightsbr/flightsbr.pdf) | Leitura programática das bases da ANAC (tarifas, voos, aeródromos) | Gratuito, open source | Atalho para ingerir a ANAC sem baixar arquivos à mão |
| [Travelpayouts / Aviasales Data API](https://support.travelpayouts.com/hc/en-us/articles/204529267-FAQ-about-Aviasales-API) | Preços em cache das buscas reais de usuários dos últimos 2 a 7 dias; calendário de preços por mês, preços mais recentes, rotas populares | Gratuito com token de afiliado; uso sujeito ao acordo de parceria | Segunda fonte diária, boa para rotas internacionais e para detectar quedas. Cache é por mercado: buscas do site .ru não aparecem no mercado BR |
| [fast-flights](https://pypi.org/project/fast-flights) (Google Flights) | Voos e preços do Google Flights, sem chave de API, inclusive o selo low/typical/high do Google | Gratuito, mas é scraping não oficial; Google pode mudar a página e bloquear IPs | Coleta diária principal no MVP, com volume moderado |
| [SerpApi – Google Flights API](https://scrapegraphai.com/blog/serpapi-pricing) | JSON estruturado do Google Flights | 250 buscas/mês grátis; planos pagos a partir de US$ 25/mês por 1.000 buscas | Fallback confiável quando o fast-flights falhar; validação de amostras |
| [Duffel](https://us.fitgap.com/products/010868/duffel) | Ofertas ao vivo para venda de passagens (NDC, GDS, low-cost) | Cadastro grátis; buscas cobradas só acima da razão 1.500 buscas por reserva (US$ 0,005 cada excedente) | Não usar: é uma API para vender passagens, fora do propósito do produto; sem reservas, toda busca vira custo |
| [Ignav](https://ignav.com/docs/amadeus-self-service-shutdown) | API self-service de tarifas ao vivo e links de reserva | 1.000 requisições grátis, depois US$ 2 por 1.000 | Alternativa paga de baixo custo ao scraping |

**O que não está mais disponível.** A [Amadeus desativou as APIs Self-Service em 17 de julho de 2026](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers); hoje só o acesso Enterprise, por contrato, continua. A [API do Skyscanner exige aprovação manual como parceiro](https://supergood.ai/api-report-card/skyscanner-api), voltada a sites com audiência relevante, e proíbe guardar os preços em cache, o que inviabiliza um histórico próprio a partir dela.

## Estratégias de coleta

Recomendação: começar por fontes com acesso permitido (ANAC, Travelpayouts, Google Flights via SerpApi ou fast-flights em baixo volume) e tratar scraping direto de companhias e brokers como último recurso, de baixa frequência e só depois de avaliar os termos de uso.

| Estratégia | Como funciona | Vantagens | Riscos e limites |
| --- | --- | --- | --- |
| 1. Dados abertos e APIs de parceiros | Ingerir ANAC mensalmente; consultar Travelpayouts e SerpApi por agendamento | Legal, estável, sem bloqueio | ANAC é mensal; Travelpayouts depende do volume de buscas de terceiros na rota |
| 2. Metabuscador Google Flights | fast-flights monta a URL codificada em protobuf e lê o JSON embutido na página | Cobre todas as companhias de uma vez, inclusive LATAM, GOL e Azul | Não oficial; quebra quando o Google muda a página; o próprio projeto recomenda checar os termos do Google antes de usar em escala |
| 3. Sites das companhias (LATAM, GOL, Azul) | O site carrega preços por chamadas internas em JSON (visíveis na aba Rede do navegador); um navegador automatizado (Playwright) reproduz a busca | Preço "oficial" e tarifas exclusivas do site | Sistemas anti-bot fortes; endpoints mudam sem aviso; termos de uso costumam vedar acesso automatizado. Contornar CAPTCHA ou bloqueios não deve fazer parte do plano |
| 4. Brokers (Skyscanner, Decolar, 123milhas etc.) | Mesma técnica do item 3 nas páginas de resultado | Compara OTAs além das companhias | O [termo do Skyscanner](https://www.skyscanner.com.mx/terms-of-service) proíbe acesso automatizado e prevê medidas técnicas e legais; risco jurídico e de bloqueio maior que nas companhias |
| 5. Sinais de promoção públicos | Monitorar páginas "Promoções" das companhias, newsletters (inscrição com e-mail do projeto), perfis oficiais e canais de ofertas | Captura o anúncio da campanha, que o preço sozinho não explica | Dado qualitativo; precisa de extração de texto (datas, rotas, % de desconto) |
| 6. Contribuição dos usuários (fase 2) | Extensão de navegador opcional que registra, com consentimento, o preço que o próprio usuário viu | Escala sem scraping central; cobre rotas de nicho | Exige LGPD (consentimento, anonimização) e controle de qualidade |

**Boas práticas para qualquer coleta automatizada.** Respeitar robots.txt e termos de uso; poucas requisições por rota por dia, com intervalos aleatórios; identificar o bot no user-agent quando possível; guardar a resposta bruta para reprocessar sem recoletar; parar ao receber bloqueio em vez de insistir. Para escala comercial, o caminho sustentável é acordo de dados com uma companhia, um broker ou um provedor pago.

**Nota jurídica.** O Brasil não tem lei específica sobre scraping; os riscos práticos são quebra contratual dos termos de uso, proteção de bases de dados e concorrência desleal. Vale validar com um advogado antes de lançar com coleta direta em sites de terceiros.

## Detecção de promoções e tendências

Uma promoção é marcada quando o menor preço de uma companhia cai bem abaixo do seu próprio padrão recente na mesma rota e antecedência, e o sinal fica mais forte quando várias rotas da mesma companhia caem no mesmo dia.

1. **Série base.** Para cada combinação rota × companhia × antecedência, guardar o menor preço por coleta.
2. **Padrão esperado.** Mediana móvel de 28 dias, ajustada por dia da semana e mês (sazonalidade estimada com a ANAC).
3. **Anomalia por rota.** Desvio robusto (z-score pela mediana e MAD):
   - z ≤ −2 → "preço baixo"
   - z ≤ −3 ou queda ≥ 30% vs. mediana → "possível promoção"
4. **Confirmação por campanha.** Se ≥ 30% das rotas monitoradas da mesma companhia disparam no mesmo dia, o evento vira "campanha" no calendário (F3).
5. **Fim do evento.** A campanha termina quando o preço volta para dentro da faixa normal por 2 coletas seguidas; registrar início, fim, duração, rotas e desconto médio.
6. **Enriquecimento.** Cruzar com sinais públicos (página de promoções, newsletter) para nomear a campanha.

```latex
z = \frac{p_t - \mathrm{mediana}_{28d}}{1{,}4826 \cdot \mathrm{MAD}_{28d}}
```

**Tendências exibidas.** Curva de antecedência (preço médio por dias até o voo), sazonalidade mensal, dia da semana mais barato para comprar e voar, frequência e duração média das campanhas por companhia. Previsão de preço (F8) fica para a v2, quando houver pelo menos 6 meses de série própria.

## Arquitetura técnica e modelo de dados

Stack escolhida (opção B): Next.js na Vercel para app, API e alertas; coletores em Python agendados no GitHub Actions; Supabase como banco, autenticação e armazenamento das respostas brutas. O mesmo código Python migra para um servidor próprio (opção C) quando o volume de rotas justificar.

&#91;embedded content: arquitetura · fontes → coleta → séries → detecção → app\]

A resposta bruta de cada coleta é guardada no Supabase Storage antes da normalização, para reprocessar o histórico quando a lógica mudar sem coletar de novo. Cloudflare R2 fica como opção futura se o volume de arquivos encarecer o Supabase.

**Stack por camada.**

| Camada | Escolha | Observação |
| --- | --- | --- |
| Coleta | Python 3.12: fast-flights (Google Flights), httpx (Travelpayouts, SerpApi como fallback) | Playwright só para validação manual, fora do agendamento |
| Agendador | GitHub Actions (cron 3x/dia) | Jobs em paralelo por lote de rotas; falha gera issue/alerta |
| Banco | Supabase Postgres | TimescaleDB opcional; começar com índices em (route\_id, companhia, data\_coleta) |
| Bruto | Supabase Storage (bucket `raw/AAAA-MM-DD/`) | JSON compactado por coleta |
| Processamento | Script Python pós-coleta (pandas) + views SQL | Calcula faixa normal, z-score e eventos de promoção |
| App e API | Next.js (App Router) na Vercel, Recharts ou ECharts, PWA | Lê do Supabase; cron diário da Vercel só para tarefas leves |
| Autenticação | Supabase Auth (link mágico por e-mail) | Necessária só para criar alertas |
| Alertas | Telegram Bot API e Resend (e-mail) | Disparados pelo script de processamento |

**Opções avaliadas.**

| Opção | Composição | Por que não / quando usar |
| --- | --- | --- |
| A | Tudo em Next.js na Vercel | Sem fast-flights, depende de APIs com cota; cron 1x/dia no plano gratuito. Bom só para protótipo |
| **B (escolhida)** | Vercel + coletores Python no GitHub Actions + Supabase | Custo quase zero, coleta flexível. Limite: atrasos do Actions e IPs compartilhados |
| C | Vercel + serviço Python sempre ligado (Railway, Fly.io ou VPS) | Evolução natural quando passar de \~100 rotas ou precisar de coleta mais frequente |

| Tabela | Campos principais |
| --- | --- |
| routes | id, origem (IATA), destino (IATA), tipo (nacional/internacional), prioridade |
| fare\_observations | id, route\_id, companhia, data\_coleta (timestamp), data\_voo, data\_volta, antecedência\_dias, preço, moeda, preço\_brl, escalas, fonte, raw\_ref |
| anac\_fares | ano, mês, companhia, origem, destino, tarifa, assentos |
| promo\_events | id, companhia, início, fim, rotas\_afetadas, desconto\_médio\_%, origem\_sinal |
| alerts | id, user\_id, route\_id, preço\_alvo, tipo (preço/promoção), canal, ativo |
| users | id, e-mail, preferências, consentimento LGPD |

## Roadmap

Três fases, cada uma liberada só quando a anterior prova valor com dados reais.

| Fase | Duração estimada | Entregas | Critério para avançar |
| --- | --- | --- | --- |
| 0 – Fundação de dados | 3–4 semanas | Ingestão da ANAC (2002→hoje); coletor diário Google Flights + Travelpayouts para 30 rotas; banco de séries | 30 dias de coleta com ≥ 95% de sucesso |
| 1 – MVP público | 6–8 semanas | Painel da rota (F1), curva de antecedência (F2), selo comprar/esperar (F5), alertas por e-mail/Telegram (F4), calendário de promoções (F3) | 500 usuários com alerta ativo; taxa de clique ≥ 20% |
| 2 – Inteligência | 3 meses | Mapa de calor (F6), comparativo entre companhias (F7), previsão (F8), extensão colaborativa, sinais de newsletters | 6 meses de série própria; previsão melhor que "comprar já" em backtest |
| 3 – B2B | a definir | API e exportação (F9), relatórios para agências e imprensa, acordo de dados com provedor pago | Primeiros clientes pagantes |

## Riscos e questões em aberto

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Bloqueio ou mudança no Google Flights | Coleta diária para | Fallback SerpApi/Ignav; resposta bruta guardada; alertas de falha |
| Termos de uso de companhias e brokers | Risco jurídico e de bloqueio | Priorizar fontes permitidas; parecer jurídico antes de coleta direta |
| Preço exibido ≠ preço final (taxas, bagagem) | Perda de confiança | Padronizar tarifa "básica, 1 adulto, sem bagagem"; amostragem manual semanal |
| Cache da Travelpayouts fraco em rotas BR | Lacunas na série | Usar como fonte secundária; medir cobertura por rota no mês 1 |
| Custo de escala ao crescer o número de rotas | Orçamento | Coletar rotas de cauda longa com menos frequência; rotas sob demanda dos alertas |

**Questões em aberto.**

- [ ] Modelo de negócio: gratuito com links de afiliado para o site de compra (comissão por clique ou reserva, sem vender), freemium com alertas premium, ou B2B?
- [ ] Ida e volta ou só ida como série principal?
- [ ] Quais 30 rotas entram no MVP — priorizar Salvador como origem?
- [ ] Incluir milhas (Smiles, LATAM Pass, TudoAzul) numa fase futura?
- [ ] Web primeiro ou app nativo (PWA cobre alertas push no Android e iOS recentes)?

Especificação técnica para desenvolvimento: Handoff Devin
