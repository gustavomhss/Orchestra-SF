# WP05 — matriz da retomada de 14/11/2026

**DRAFT / BLOCKED. 108 critérios; 49 VERIFIED_SCOPED, 22 PARTIAL, 37 BLOCKED_EXTERNAL. Todos108 NOT_ACCEPTED integralmente.**

Produto verificado: `8f8a1a72dec4065c4cfb798d6d48ca13ca6d5760`. Full35 [43535162840](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43535162840): **114 PASS / 3 FAIL**. Target3 [43534686609](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534686609), mesmo produto: **7 PASS / 0 FAIL**. Check [43534688410](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534688410): **183 diagnósticos, typecheck FAIL; guards PASS**.

Esta matriz acrescenta a avaliação da retomada sem reescrever os recibos anteriores. Os108 IDs e requisitos textuais são idênticos ao pack `dbf9547211d9b0fade619790de7c19c0869b7c7d`. VERIFIED_SCOPED registra apenas o discriminante no escopo declarado; não significa aceite integral, catálogo instalado ou execução native/MCP. O [JSON correspondente](criteria-resume-20261114.json) conserva os discriminantes, escopos, decisões e o mapeamento histórico completo.

## Resultado que limita as promoções

- Marco sem data: assert Dashboard real falha porque o seed não fornece `milestone:p:undated:date`.
- Capacidade finance: prazo60s durante importação/renderização/transporte antes dos asserts; limpeza também falha. Causa interna não isolada. Seu PASS no Target3 não é PASS do Full35.
- Pedido mais antigo do approver: falha em criar a página no fixture compartilhado antes do corpo. Seu PASS no Target3 não é PASS do Full35.

Seis promoções delimitadas: WP05.T01.CMP.01, WP05.T01.CMP.02, WP05.T03.CMP.01, WP05.T03.CHK.01, WP05.T03.CHK.04, WP05.T05.CHK.03. WP05.T03.CMP.02 muda de bloqueado externo para parcial. **WP05.T02.DOD.02 e WP05.T03.SUC.02 ficam PARTIAL.**

## Grupos de novas provas

| Grupo | O que verifica | Full35 | Casos Full35 | Target3 | Casos Target3 |
| --- | --- | --- | --- | --- | --- |
| P01 | Contribuição zero de Planner real: início=fim, círculo/linha horizontal, tooltip e ambas as tabelas mostram 0; mantém reconciliação fornecida. | PASS | F041 | PASS | T002 |
| P02 | Na mesma marca financeira real, clique, Enter e botão da tabela emitem seleção igual com ref, contexto, período visual e zero; actual ausente conserva indisponibilidade. | PASS | F040 | PASS | T001 |
| P03 | Planner real, sentinelas de nome/salário, FTE0.5 e custo HC ausente; filtro fev–mar, contexto/alinhamento/refs iguais e ausência das sentinelas em bundle, HTML e seleção. Não há dois painéis numéricos. | MIXED | F042, F043 | PASS | T003, T004 |
| P04 | Mesmo requester restrito: registry+port+dispatcher reais, stock/aging renderizados juntos, igualdade de todas as linhas, marcas e refs; hidden e seus dados ausentes; 2dias versus idade indisponível; revogação recusa releitura. | PASS | F058 | PASS | T005 |
| P05 | Comandos reais persistidos percorrem 10 estados abertos; rejeição/ressubmissão em PR, sourcing e PO preservam o mesmo pedido, contagem1, refs e ausência de coorte; po_issued/cancelled excluídos. factory.dispatchPresentation consome a lease. | PASS | F116 | PASS | T006 |
| P06 | Dois pedidos por comandos reais com idades10/2 e um legado sem evento:null; browser tem duas marcas/denominador3/indisponível1; clique no10 abre port.read real e confirma idade, holder, status e ref. | FAIL | F117 | PASS | T007 |
| P07 | Training0 confirmado versus null/absent no Planner, assessment, resultado persistido e BI; ambos preservam knownSubtotal210000, coverage pending, total/threshold null e resultado conditioned. | PASS | F110 | NOT_SELECTED | — |
| P08 | Revoga uma fonte mantendo sessão/caso válidos: coverage unavailable, resultados cenário/histórico/comparação e BI denied, sem nova leitura da projeção. | PASS | F111 | NOT_SELECTED | — |
| P09 | Todas as linhas de componentes e pontos de sensibilidade iguais ao resultado real persistido; todas as marcas finitas preservam valores/ref; clique, Enter e tabela retornam o mesmo resultRef; ausência/zero distintos. Destino callback, não abertura instalada. | PASS | F091 | NOT_SELECTED | — |
| P10 | Snapshots e cópias isolam seleção aprovada e refs resolvidas de mutações durante awaits; callback adulterado é recusado, seleção autorizada permanece preservada. | PASS | F005, F006, F007 | NOT_SELECTED | — |
| P11 | Isola caseRef, seleção e artefatos antes de awaits/callbacks; detecta alterações materiais e impede mutação posterior de filtros/refs compartilhados. | PASS | F022, F023, F024, F025, F026 | NOT_SELECTED | — |

## Matriz por ID

Fxxx é caso da seleção completa final; Txxx é caso da seleção dirigida final. A referência a um caso FAIL permanece visível e não se converte em prova positiva. Requisitos conservados em VERIFIED_SCOPED podem ter evidência histórica além da nova execução; as limitações e o JSON distinguem essa origem.

### WP05

| Critério e requisito canônico | Estado delimitado | Casos atuais | Limites remanescentes |
| --- | --- | --- | --- |
| **WP05.DOD.01** — Os oito gráficos têm pergunta explícita, eixos/unidades, fonte C02, comportamento de ausência e drilldown exportado, com evidências verificáveis para cada um. | PARTIAL | F028, F040, F041, F058, F093, F107 | Não há cobertura real completa dos oito; o produtor omite undated e seu teste falha. |
| **WP05.DOD.02** — Os gráficos são consumidores do C02 real: o pacote não calcula salários, OPEX/CAPEX, alçadas, ranking, aging ou métricas de tickets a partir de dados brutos. | VERIFIED_SCOPED | F040, F041, F058, F108, F109 | Aceitação limitada à ausência de regra de negócio nos consumidores exercitados e à inspeção dos adapters; não é catálogo instalado. |
| **WP05.DOD.03** — A entrega inclui tabela equivalente, operações por teclado e recibo de filtros/referências; WP10 verifica os gráficos nos entrypoints comuns com os produtores reais. | BLOCKED_EXTERNAL | F027, F107, F112 | WP10 ainda deve verificar entrada comum e retorno dos gráficos com seus produtores/destinos reais. |
| **WP05.DOD.04** — Oito perguntas analíticas originais e três perguntas de decisão funcionam com o motor canônico, suas fontes e tabelas equivalentes; não basta renderizar novos gráficos vazios. | BLOCKED_EXTERNAL | F028, F040, F041, F042, F043, F058, F090, F093, F108, F109 | Onze perguntas não estão compostas no host; undated, completude e limiar admitido continuam bloqueados. |
| **WP05.DOD.20** — BI e tabela consomem coverage/result refs reais junto às marcas. | PARTIAL | F090, F092, F109, F091 | Falta abertura real de coverage/result refs no destino instalado com o caso/contexto preservado. |
| **WP05.DOD.10** — As entregas residentes atribuídas a WP05 têm produção, consumo e provas reais completos. | BLOCKED_EXTERNAL | F018, F019, F020, F021, F099, F005, F006, F007, F022, F023, F024, F025, F026 | Faltam consumo residente durável, reabertura instalada e execução native/MCP real. |
| **WP05.INV.01** — A mesma seleção contextual do domínio produz os mesmos valores no gráfico e no detalhe; moeda, período, versão e recorte autorizado não mudam silenciosamente no drilldown. | BLOCKED_EXTERNAL | F080, F100, F112, F040, F042, F043, F058, F117, F005, F006, F007, F022, F023, F024, F025, F026; dirigido: T001, T003, T004, T005, T007 | Pares/destinos instalados completos, foco/retorno e autoridade native permanecem sem prova. |
| **WP05.INV.02** — Ausente não é zero, estoque não é funil/coorte, prazo planejado não é conclusão real e idade sem evento comprovado não é duração conhecida. | VERIFIED_SCOPED | F039, F059, F064, F081, F094, F104, F107, F041, F042, F043, F116, F117, F110, F111, F091; dirigido: T002, T003, T004, T006, T007 | Nenhum PASS autoriza completar coverage/total/limiar no BI ou declarar integração instalada. |
| **WP05.INV.03** — Componentes financeiros são os fornecidos por C02; diferenças não reconciliadas ficam visíveis e não são escondidas por uma parcela de ajuste criada no BI. | VERIFIED_SCOPED | F041, F068, F097, F098 | Escopo de geometria e adapter do motor, sem novo cálculo financeiro no BI. |
| **WP05.INV.20** — Gráfico não calcula completude nem converte lacuna em zero, ganho confirmado ou ajuste residual. | VERIFIED_SCOPED | F071, F074, F078, F079, F107, F108, F109, F041, F042, F043, F116, F117, F110, F111, F091; dirigido: T002, T003, T004, T006, T007 | Nenhum PASS autoriza completar coverage/total/limiar no BI ou declarar integração instalada. |
| **WP05.INV.10** — WP05 conserva autoridade, dados oficiais e ownership; não assume identidade técnica ou novo acesso empresarial. | VERIFIED_SCOPED | F008, F011, F058, F099, F101, F103, F111, F005, F006, F007, F022, F023, F024, F025, F026 | Permanece limitado a callbacks/UI/adapter/domínio exercitados; não é identidade nova, concessão empresarial ou execução native. |
| **WP05.QLT.01** — Cada gráfico permite responder uma pergunta concreta sem depender apenas de cor, hover ou memória da escala. | PARTIAL | F027, F090, F096, F107 | A leitura de cada um dos oito gráficos no produto composto não foi avaliada integralmente. |
| **WP05.QLT.02** — Sinais, unidades, eixos, arredondamento e granularidade ficam claros; FTE e moeda usam painéis alinhados em vez de um eixo duplo que sugira equivalência. | VERIFIED_SCOPED | F027, F038, F042, F043, F084, F085, F086, F090, F106 | A prova cobre a formatação direta dos valores fornecidos, sem arredondamento financeiro ou produtividade inferida. |
| **WP05.QLT.03** — Estados vazio, parcial, indisponível e restrito são distintos e não inventam números para preencher espaço. | PARTIAL | F012, F017, F071, F081, F096, F107, F042, F043, F111, F091; dirigido: T003, T004 | Falta demonstração integrada dos quatro estados visíveis vazio/parcial/indisponível/restrito no catálogo. |
| **WP05.QLT.20** — Rótulo de condicionado acompanha valor/limiar e a lista acessível explica categorias sem quantificação. | VERIFIED_SCOPED | F071, F075, F090, F107, F108, F041, F042, F043, F116, F117, F110, F111, F091; dirigido: T002, T003, T004, T006, T007 | Nenhum PASS autoriza completar coverage/total/limiar no BI ou declarar integração instalada. |
| **WP05.QLT.10** — Interfaces são concretas, versões/digests são verificáveis e falhas possuem causa e estado explícitos. | BLOCKED_EXTERNAL | F018, F021, F065, F067, F100, F102, F005, F006, F007, F022, F023, F024, F025, F026 | O pacote ainda não typechecka: faltam contratos WP00 e há 183 diagnósticos herdados/cascata. |
| **WP05.CMP.01** — Cobrir os oito gráficos, seus filtros e caminhos de drilldown, incluindo dados parciais, negativos, nulos e séries/tempos indisponíveis. | PARTIAL | F027, F033, F039, F094, F096, F107, F113 | Não há cobertura final de todos os filtros/destinos dos oito gráficos em composição. |
| **WP05.CMP.02** — Cobrir navegação por teclado, tabela equivalente, foco/retorno e contexto de dados restritos em cada par de gráficos. | BLOCKED_EXTERNAL | F001, F027, F096, F107, F112, F040, F042, F043, F058, F117, F005, F006, F007, F022, F023, F024, F025, F026; dirigido: T001, T003, T004, T005, T007 | Pares/destinos instalados completos, foco/retorno e autoridade native permanecem sem prova. |
| **WP05.CMP.03** — Identificar o produtor C02 e a referência de origem de cada marca ou agregado; fixtures de contrato não substituem a prova final com consumidores reais. | BLOCKED_EXTERNAL | F028, F040, F041, F058, F093, F112 | Fixtures e harness não substituem a prova final de consumidores instalados por marca/agregado. |
| **WP05.CMP.04** — Oito perguntas analíticas originais e três perguntas de decisão funcionam com o motor canônico, suas fontes e tabelas equivalentes; não basta renderizar novos gráficos vazios. | BLOCKED_EXTERNAL | F040, F041, F042, F043, F058, F090, F093, F108, F109 | As onze perguntas com motor/fonte/tabela não estão verificadas no host comum. |
| **WP05.CMP.20** — Cobrir omissão inteira, pending, zero confirmado, fonte restrita e atualização que inverte a diferença. | PARTIAL | F071, F073, F109, F110, F111, F091 | Falta atualização/revisão persistida do mesmo caso com histórico preservado. Coverage permanece pending e total null; não chamar knownSubtotal de total completo. |
| **WP05.CMP.10** — Todas as obrigações 5/18/8/C17 desta frente têm task, owner, paths, consumidor e negativos discriminantes. | PARTIAL | F018, F021, F099, F100, F103, F005, F006, F007, F022, F023, F024, F025, F026 | Obrigações residentes/nativas ainda não têm consumidor e provas reais completos. |
| **WP05.SUC.01** — Nos roteiros, o usuário identifica desvio, contribuição, capacidade ou pendência e abre os registros que explicam o resultado sem refazer filtros. | BLOCKED_EXTERNAL | F001, F027, F112 | Os roteiros reais de desvio, capacidade e pendência até seus registros ainda faltam. |
| **WP05.SUC.02** — Mudar os valores projetados pelo domínio muda as marcas correspondentes; inserir um cálculo divergente, zero fictício ou registro fora do recorte faz uma verificação falhar. | VERIFIED_SCOPED | F058, F069, F081, F104, F112 | Verificação de comportamento no renderer/harness, sem afirmar implantação do catálogo. |
| **WP05.SUC.03** — Oito visualizações funcionam com dados disponíveis e degradam honestamente quando o C02 não suporta uma série, componente ou data. | BLOCKED_EXTERNAL | F012, F028, F031, F039, F094, F096, F107 | Funcionamento dos oito com C02 real não fecha: undated falha upstream e catálogo host está incompleto. |
| **WP05.SUC.20** — Usuário encontra a categoria que muda a comparação e abre sua origem com o mesmo contexto. | BLOCKED_EXTERNAL | F107, F109, F091 | Falta jornada instalada origem→retorno com mesmo caso/contexto/ChoiceRecord. |
| **WP05.SUC.10** — O consumidor integrado utiliza a saída de produção sem substituto fictício e o revisor consegue reproduzir o resultado. | BLOCKED_EXTERNAL | F090, F092, F112 | Não há prova final do consumidor integrado residente/native e catálogo comum. |

### WP05.T01

| Critério e requisito canônico | Estado delimitado | Casos atuais | Limites remanescentes |
| --- | --- | --- | --- |
| **WP05.T01.DOD.01** — Trajetória e waterfall estão exportados com tabela equivalente e produtor C02 identificável. | VERIFIED_SCOPED | F040, F041, F107 | Aceitação de exports e consumidor exercitado; destino instalado é tratado em CHK.05. |
| **WP05.T01.DOD.02** — Granularidade, lacunas e reconciliação têm resultados esperados e falhas demonstráveis. | VERIFIED_SCOPED | F033, F035, F037, F082, F085, F097, F106 | Escopo de semântica/geometria e admissão da apresentação. |
| **WP05.T01.INV.01** — Nenhum mês, realizado ou contribuição é fabricado para completar a visualização. | VERIFIED_SCOPED | F033, F037, F040, F082, F085 | Não declara uma distribuição mensal onde o produtor só forneceu total anual. |
| **WP05.T01.INV.02** — O waterfall usa valores de domínio e não recalcula a semântica do cenário. | VERIFIED_SCOPED | F035, F041, F097, F098 | A regra financeira permanece no C02; a prova é do consumo e da geometria. |
| **WP05.T01.QLT.01** — Competência, moeda, referência e cenário ficam legíveis na própria visualização. | PARTIAL | F096, F106, F107, F112 | Não há assert/roteiro completo de legibilidade da identificação do cenário em toda trajetória. |
| **WP05.T01.QLT.02** — Lacunas e contribuições negativas preservam significado em cor e texto. | VERIFIED_SCOPED | F027, F033, F035, F104, F107 | Não depende apenas de cor; zero confirmado permanece distinto. |
| **WP05.T01.CMP.01** — Cobrir trajetória completa/parcial/anual e waterfall com aumentos, reduções, zero e falha de reconciliação. | VERIFIED_SCOPED | F035, F040, F082, F085, F097, F106, F041; dirigido: T002 | Escopo de adapter/renderer e Planner real no harness; não certifica destino instalado. |
| **WP05.T01.CMP.02** — Cobrir seleção por mouse/teclado e equivalência entre marcas e tabela. | VERIFIED_SCOPED | F080, F096, F107, F040; dirigido: T001 | Seleção exportada está provada; abertura/retorno do host pertencem a CHK.05 e seguem ausentes. |
| **WP05.T01.SUC.01** — O usuário distingue o que é orçamento, realizado disponível e outlook sem tratar previsão como realizado. | PARTIAL | F040, F082, F096, F112 | A distinção visível orçamento/realizado/outlook ainda não tem roteiro completo no consumidor real. |
| **WP05.T01.SUC.02** — O usuário explica o delta de um cenário por seus componentes e acessa sua origem com o contexto preservado. | BLOCKED_EXTERNAL | F041, F100, F107 | A origem de Planner no host e o retorno contextual instalado não foram executados. |
| **WP05.T01.CHK.01** — Receber apenas total anual sem distribuição mensal: a trajetória não gera 12 pontos por divisão/interpolação; informa granularidade disponível e não aparenta conhecer um perfil mensal. | VERIFIED_SCOPED | F037, F082, F085 | É discriminante da transformação do consumidor, não prova de distribuição mensal do produtor. |
| **WP05.T01.CHK.02** — Dado actual desconhecido em uma competência e zero confirmado em outra: o primeiro produz lacuna/indisponibilidade, o segundo marca zero; os dois casos não compartilham tooltip/representação. | VERIFIED_SCOPED | F033, F040, F081, F096, F104, F112 | Inclui placeholder999 marcado absent e uma projeção real de Planner/Dashboard. |
| **WP05.T01.CHK.03** — Usar cenário C02 com referência 100, contribuições +20 e -5 e final 115: waterfall termina em 115 e cada seleção preserva seu componente; trocar o final para 116 deve sinalizar não reconciliação, não criar '+1 ajuste'. | VERIFIED_SCOPED | F068, F097, F107 | O oracle de apresentação é separado da prova de motor590000→602000. |
| **WP05.T01.CHK.04** — Alterar moeda, competência ou versão entre contexto e projeção: o gráfico recusa a mistura ou apresenta grupos explicitamente separados conforme C02, sem sobrepor valores incompatíveis. | VERIFIED_SCOPED | F009, F029, F044, F045, F083, F085, F086, F106 | Nenhum reetiquetamento silencioso de moeda ou mistura temporal foi aceito. |
| **WP05.T01.CHK.05** — Abrir uma contribuição por teclado: destino recebe a referência e os filtros exatos e retorna mantendo foco; componente sem autorização nunca aparece no gráfico ou na tabela. | BLOCKED_EXTERNAL | F100, F107, F112 | Contribuição de Planner até detalhe restrito e retorno de foco no host ainda faltam. |

### WP05.T02

| Critério e requisito canônico | Estado delimitado | Casos atuais | Limites remanescentes |
| --- | --- | --- | --- |
| **WP05.T02.DOD.01** — Contribuições e FTE/custo estão exportados com eixos, unidades, tabelas e referências reais. | VERIFIED_SCOPED | F027, F041, F042, F043, F044 | Prova de exports/componentes e C02 no harness; não do detalhe instalado. |
| **WP05.T02.DOD.02** — A entrega documenta a origem de agrupamentos e o tratamento de componentes restritos/ausentes. | PARTIAL | F027, F042, F043, F113; dirigido: T003, T004 | A prova relevante passou no Target3, mas falhou no Full35 do mesmo produto; a instabilidade composta ainda não está resolvida. Não prova duas séries numéricas filtradas, nem abertura instalada. |
| **WP05.T02.INV.01** — Sinal da contribuição e unidade de cada medida não são alterados por ordenação ou formatação. | VERIFIED_SCOPED | F027, F033, F113 | Escopo de formatação/geometria recebida, sem sorter ou agregação financeira local. |
| **WP05.T02.INV.02** — FTE e custo permanecem medidas distintas e os dados pessoais ausentes do C02 não são reconstruídos. | VERIFIED_SCOPED | F027, F042, F043, F081; dirigido: T003, T004 | FTE e custo não são convertidos entre si; a nova prova contém custo ausente, não duas medidas numéricas. |
| **WP05.T02.QLT.01** — As maiores contribuições positivas e negativas são comparáveis sem um gráfico visualmente dominado por valores absolutos. | VERIFIED_SCOPED | F027, F033, F038 | Escopo da apresentação de contribuição fornecida, sem inferir magnitude absoluta como desvio. |
| **WP05.T02.QLT.02** — Painéis alinhados mostram o mesmo recorte e usam escalas explícitas sem eixo duplo enganoso. | VERIFIED_SCOPED | F027, F038, F042, F043, F084; dirigido: T003, T004 | FTE e custo não são convertidos entre si; a nova prova contém custo ausente, não duas medidas numéricas. |
| **WP05.T02.CMP.01** — Cobrir positivos, negativos, zero, desconhecido, Top N parcial e agrupamento reconciliado. | VERIFIED_SCOPED | F027, F033, F081, F113 | A cobertura é de componentes/semântica recebida; agregado do teste não certifica cálculo upstream. |
| **WP05.T02.CMP.02** — Cobrir recorte agregado e restrito, filtro conjunto e drilldown autorizado dos dois painéis. | BLOCKED_EXTERNAL | F027, F042, F043, F112; dirigido: T003, T004 | Falta drilldown autorizado dos dois painéis no host real; o custo indisponível não prova painel numérico. |
| **WP05.T02.SUC.01** — O usuário localiza quem aumenta e quem reduz o desvio e consegue abrir o componente correspondente. | BLOCKED_EXTERNAL | F027, F100, F113 | Abertura do componente de contribuição no destino instalado segue ausente. |
| **WP05.T02.SUC.02** — O usuário compara capacidade e custo sem inferir produtividade ou custo unitário que o domínio não fornece. | VERIFIED_SCOPED | F027, F042, F043 | É verificação da apresentação e dos valores de Planner no harness, sem afirmar avaliação humana instalada. |
| **WP05.T02.CHK.01** — Projetar contribuições +40 e -30: mostrar ambas com sinais corretos e delta 10 somente quando fornecido/reconciliado pelo C02; usar valor absoluto ou omitir a contribuição negativa deve falhar. | VERIFIED_SCOPED | F027, F033, F113 | Quando há plano reconciliado, o resultado é o recebido do produtor da fixture. |
| **WP05.T02.CHK.02** — Receber Top N sem agregado do restante: não apresentar o subtotal como total; com 'outros' C02, a marca e o drilldown preservam os componentes definidos pelo produtor. | VERIFIED_SCOPED | F113 | A seleção C17 foi preservada no renderer; não se afirma resolução instalada ou cálculo upstream do agregado. |
| **WP05.T02.CHK.03** — No mesmo recorte, FTE confirmado como zero e custo ausente: mostrar zero de FTE e custo indisponível, sem converter nenhum deles no outro ou presumir custo zero. | VERIFIED_SCOPED | F027, F042, F043, F081; dirigido: T003, T004 | FTE e custo não são convertidos entre si; a nova prova contém custo ausente, não duas medidas numéricas. |
| **WP05.T02.CHK.04** — Aplicar um filtro/período: ambos os painéis usam o mesmo contexto, mantendo unidades e escalas separadas; nomes/custos pessoais removidos pelo C02 não podem aparecer em tooltip, tabela ou referência. | PARTIAL | F027, F042, F043, F096, F112; dirigido: T003, T004 | Ainda falta exercitar dois painéis numéricos filtrados e suas escalas separadas com produtor real; os checks existentes de escala permanecem separados deste fluxo. |
| **WP05.T02.CHK.05** — Navegar categoria por teclado e abrir detalhe: manter grupo, período, moeda, versão e retorno de foco; nenhuma seleção depende exclusivamente de hover. | BLOCKED_EXTERNAL | F027, F100, F112 | Jornada de categoria até detalhe real e retorno instalado ainda não existe. |

### WP05.T03

| Critério e requisito canônico | Estado delimitado | Casos atuais | Limites remanescentes |
| --- | --- | --- | --- |
| **WP05.T03.DOD.01** — Estoque e aging consomem as projeções reais de Procurement e têm drilldown para os pedidos correspondentes. | BLOCKED_EXTERNAL | F001, F058, F059, F117; dirigido: T005, T007 | Falta destino instalado correspondente, sequência etapa→pedido e retorno/contexto no host. A abertura de um ponto no harness não fecha toda a obrigação. |
| **WP05.T03.DOD.02** — Estoque/coorte e idade comprovada/indisponível estão diferenciados na UI e nas contraprovas. | VERIFIED_SCOPED | F001, F058, F059, F064 | Escopo do port em harness e da UI de componente; não certifica instalação no catálogo. |
| **WP05.T03.INV.01** — A quantidade em etapas atuais não é convertida em taxa de conversão, abandono ou produtividade. | VERIFIED_SCOPED | F058, F064 | Invariante do adapter/renderer que consome as projeções examinadas. |
| **WP05.T03.INV.02** — Analytics não inventa idade nem exclui do universo os pedidos sem evento confiável. | VERIFIED_SCOPED | F001, F058, F059, F063 | Analytics não recorre ao savedAt nem ao histórico bruto para preencher idade. |
| **WP05.T03.QLT.01** — Título e legenda deixam claro que a primeira visualização é estoque e a segunda é tempo na etapa. | VERIFIED_SCOPED | F001, F059, F064 | Prova de componentes renderizados e metadados da apresentação. |
| **WP05.T03.QLT.02** — Responsável desconhecido, idade indisponível e prazo informado são distinguíveis sem uso exclusivo de cor. | PARTIAL | F001, F059, F107, F058, F117; dirigido: T005, T007 | Falta caso positivo de SLA/prazo com política e origem explícitas. |
| **WP05.T03.CMP.01** — Cobrir todas as etapas abertas e aprovações, holder ausente, rejeição/ressubmissão e histórico insuficiente. | VERIFIED_SCOPED | F058, F059, F060, F061, F062, F116; dirigido: T005, T006 | Comandos, persistência, registry e port reais em harness; não é execução instalada. |
| **WP05.T03.CMP.02** — Cobrir filtros por papel e reconciliação entre agregado, pontos e lista autorizada. | PARTIAL | F001, F058, F117; dirigido: T005, T007 | O caso approver falhou antes do corpo no Full35; seu sucesso Target3 não é sucesso composto. A composição final do host e a amplitude dos filtros por papel não foram demonstradas; não promover a VERIFIED_SCOPED por inferência. |
| **WP05.T03.SUC.01** — O gestor identifica concentração de trabalho e abre seus pedidos sem inferir uma conversão inexistente. | BLOCKED_EXTERNAL | F001, F058, F064 | Jornada de gestor abrindo pedidos pelo destino instalado permanece sem prova. |
| **WP05.T03.SUC.02** — O aprovador encontra o pedido mais antigo dentre os tempos comprovados e vê quantos não podem ser comparados. | PARTIAL | F001, F058, F059, F117; dirigido: T007 | A prova relevante passou no Target3, mas falhou no Full35 do mesmo produto; a instabilidade composta ainda não está resolvida. Renderização e port.read em harness; não certifica navegação/retorno instalados. |
| **WP05.T03.CHK.01** — Dado estoque com 7 PRs, 2 sourcings e 3 POs distintos: mostrar contagens atuais sem taxas entre barras, abandono ou conversão; rejeição/retorno muda a etapa de um pedido sem criar uma coorte histórica. | VERIFIED_SCOPED | F058, F064, F116; dirigido: T006 | 7/2/3 é o oracle de componente C055; ciclo de estado é outro caso real. Não apresentar 7/2/3 como execução deste novo fixture. |
| **WP05.T03.CHK.02** — Receber do C02 pedido ressubmetido há 2 dias e salvo hoje: aging continua 2 dias; analytics não recalcula pelo save nem lê o histórico bruto. | VERIFIED_SCOPED | F058, F059 | Prova do consumidor do port real; não se usa timestamp de save como idade. |
| **WP05.T03.CHK.03** — Dois pedidos sem entrada comprovada: ambos aparecem no grupo 'idade indisponível' e no denominador autorizado; não entram em zero dias ou numa média fabricada. | VERIFIED_SCOPED | F001, F059, F107 | O discriminante de denominador e seleção foi exercitado no renderer Chromium. |
| **WP05.T03.CHK.04** — Filtrar por requester restrito: contagem das barras, pontos e tabela corresponde exatamente aos pedidos visíveis no domínio; pedido alheio não vaza por agregado ou drilldown. | VERIFIED_SCOPED | F001, F058; dirigido: T005 | Escopo do requester e consumidor real no harness; não é aceite de todos os papéis ou catálogo instalado. |
| **WP05.T03.CHK.05** — Clicar numa etapa e depois num pedido mantém o filtro e abre a referência correta; linha de SLA só existe se recebida com política/origem explícita, não pelo mero uso de uma cor vermelha. | BLOCKED_EXTERNAL | F001, F059, F100, F117; dirigido: T007 | Faltam etapa→pedido→retorno instalado e SLA positivo com política/origem; o novo teste não inicia pela etapa. |

### WP05.T04

| Critério e requisito canônico | Estado delimitado | Casos atuais | Limites remanescentes |
| --- | --- | --- | --- |
| **WP05.T04.DOD.01** — Tickets e agenda estão exportados e o catálogo identifica os oito gráficos, produtores e destinos reais. | BLOCKED_EXTERNAL | F002, F028, F031, F039, F093, F094 | Catálogo de oito destinos reais não está composto; Dashboard omite o marco sem data e falha. |
| **WP05.T04.DOD.02** — O recibo de interação/ausência/restrição permite a WP10 verificar composição sem descobrir contratos novos. | PARTIAL | F002, F003, F004, F099, F100, F112 | WP10 ainda não consumiu esses contratos em composição instalada. |
| **WP05.T04.DOD.18** — Descritores C16 de sf_bi_view são implementados e consumidos por T06 com referências reais. | BLOCKED_EXTERNAL | F031, F099, F102, F112 | Consumo T06 instalado e superfícies native/MCP reais permanecem ausentes. |
| **WP05.T04.INV.01** — Fotografia atual não se transforma em histórico de tickets e data planejada não se transforma em conclusão. | VERIFIED_SCOPED | F039, F093, F094, F095, F114 | Inclui mudança isolada de status atual sem reescrever os agregados fornecidos; não prova geração upstream de eventos individuais. |
| **WP05.T04.INV.02** — Nenhum marco sem data recebe data artificial e nenhuma fonte restrita é recuperada fora do C02. | VERIFIED_SCOPED | F039, F058, F093, F107 | O produtor Dashboard ainda não entrega a linha undated no caso integrado; esse bloqueio é registrado em CHK.03. |
| **WP05.T04.INV.18** — Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo. | VERIFIED_SCOPED | F011, F013, F014, F015, F058, F099, F101, F103, F111, F005, F006, F007, F022, F023, F024, F025, F026 | Permanece limitado a callbacks/UI/adapter/domínio exercitados; não é identidade nova, concessão empresarial ou execução native. |
| **WP05.T04.QLT.01** — A operação distingue entrada, conclusão, planejamento e desconhecido com texto, formas e unidades claros. | VERIFIED_SCOPED | F039, F093, F094, F095, F107, F114 | Prova visual/semântica dos componentes e dos agregados de ticket fornecidos. |
| **WP05.T04.QLT.02** — Os oito gráficos têm interação equivalente por teclado/tabela e retorno contextual previsível. | BLOCKED_EXTERNAL | F001, F027, F096, F107, F112 | Equivalência e retorno previsível dos oito gráficos no catálogo instalado não foram demonstrados. |
| **WP05.T04.QLT.18** — Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP. | BLOCKED_EXTERNAL | F008, F009, F010, F065, F067, F099, F100, F102, F005, F006, F007, F022, F023, F024, F025, F026 | Contratos WP00 não estão integrados no seed; typecheck falha e comparação UI/native/MCP real está ausente. |
| **WP05.T04.CMP.01** — Cobrir tickets com série válida e só fotografia, além de marcos planejados, concluídos e sem data. | BLOCKED_EXTERNAL | F028, F039, F093, F094, F095, F107 | O caso com produtor real de marcos falha porque a fonte elimina o registro sem data. |
| **WP05.T04.CMP.02** — Fechar o catálogo de oito gráficos com estados vazio/parcial/restrito, filtros e drilldowns verificáveis. | BLOCKED_EXTERNAL | F002, F012, F017, F058, F096, F112 | Falta fechamento dos oito gráficos com restrição/filtros/drilldowns instalados. |
| **WP05.T04.CMP.18** — Cobrir todos os exports desta task (1), caso autorizado, direto proibido, stale e indisponível. | BLOCKED_EXTERNAL | F008, F011, F012, F099, F100, F102, F112, F005, F006, F007, F022, F023, F024, F025, F026 | A cobertura pedida nas superfícies reais T06/native/MCP ainda não existe. |
| **WP05.T04.SUC.01** — O time identifica o que entrou/foi concluído quando há evidência e localiza os marcos do horizonte sem interpretar planejado como entregue. | BLOCKED_EXTERNAL | F028, F039, F093, F094, F095, F107, F114 | A jornada real perde marco sem data no produtor WP02; não há prova de equipe usando o horizonte completo instalado. |
| **WP05.T04.SUC.02** — WP10 compõe o catálogo e verifica os consumidores reais sem refazer cálculo financeiro ou aceitar uma demonstração desconectada como entrega. | BLOCKED_EXTERNAL | F031, F032, F040, F041, F058, F093, F112 | WP10 ainda deve registrar o catálogo e os destinos concretos; o harness não substitui essa composição. |
| **WP05.T04.SUC.18** — O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais. | BLOCKED_EXTERNAL | F099, F101, F112 | Não há execução native/MCP real comparável para demonstrar igualdade e ausência de efeitos extras. |
| **WP05.T04.CHK.01** — Receber apenas contagem/status atual de tickets sem eventos ou agregados datados: mostrar fotografia com data de referência, sem série semanal nem taxa de resolução inventada; ao fornecer série C02 válida, os pontos reproduzem cada período. | VERIFIED_SCOPED | F093, F094, F095, F114 | Cobre produtor Dashboard no harness e renderer de série fornecida, não derivação de eventos individuais. |
| **WP05.T04.CHK.02** — Ticket aberto num período e fechado em outro segue os eventos/projeção do produtor; mover apenas status atual não deve retroativamente reescrever uma série histórica fornecida. | PARTIAL | F093, F114 | Produtor disponível não expõe eventos individuais de abertura/fecho; essa semântica upstream não foi demonstrada. |
| **WP05.T04.CHK.03** — Marco planejado, marco concluído e marco sem data: os dois primeiros são distinguíveis e o terceiro permanece listado sem receber hoje, primeiro dia do mês ou outro fallback. | BLOCKED_EXTERNAL | F028, F039, F107 | FAIL real em dashboard-integration:87: scope.ts e port.ts seed removem milestone:p:undated:date antes de BI. |
| **WP05.T04.CHK.04** — Para os oito gráficos, abrir por teclado uma marca/agregado com filtro, voltar e comparar com o detalhe: referência, versão, período, moeda, recorte e foco são preservados; falhar se o destino cair num overview sem a seleção. | BLOCKED_EXTERNAL | F027, F096, F100, F107, F112 | Faltam oito detalhes instalados com seleção e retorno/foco; página BI01 não certifica todos os destinos. |
| **WP05.T04.CHK.05** — Injetar valor ausente, componente restrito e série parcial nos consumidores reais de C02: nenhum aparece como zero ou dado completo em marca, tooltip ou tabela; registrar qual produtor/caso foi usado. | PARTIAL | F040, F042, F043, F058, F093, F104, F107, F112, F110, F091; dirigido: T001, T003, T004, T005 | A mesma jornada para todos os produtores, inclusive Dashboard/T04 bloqueado, não foi demonstrada. |
| **WP05.T04.CHK.06** — No handoff, cada gráfico aponta seu produtor real e check de composição WP10; um stub/fixture sem produtor identificável impede classificar o gráfico como integrado. | BLOCKED_EXTERNAL | F002, F031, F040, F041, F058, F093, F112 | WP10 não executou o catálogo completo; nenhum stub/fixture recebe classificação de integrado. |
| **WP05.T04.CHK.18** — Executar sf_bi_view pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino. | BLOCKED_EXTERNAL | F008, F011, F058, F099, F101, F112, F005, F006, F007, F022, F023, F024, F025, F026 | Igualdade de handler, resultado e versão entre UI/native/MCP não foi executada nas superfícies reais. |

### WP05.T05

| Critério e requisito canônico | Estado delimitado | Casos atuais | Limites remanescentes |
| --- | --- | --- | --- |
| **WP05.T05.DOD.01** — As três perguntas analíticas novas e as oito antigas são respondidas com produtores reais e valores reconciliados. | BLOCKED_EXTERNAL | F028, F040, F041, F042, F043, F058, F090, F093, F108, F109 | Onze perguntas não estão compostas; undated upstream e coverage pending impedem fechamento integrado. |
| **WP05.T05.DOD.20** — BI e tabela consomem coverage/result refs reais junto às marcas. | PARTIAL | F090, F092, F107, F108, F109, F091 | Falta abertura real de coverage/result refs no destino instalado com o caso/contexto preservado. |
| **WP05.T05.INV.01** — Geometria usa o resultado do motor; visualização não recalcula regra de negócio nem estima probabilidades ausentes. | VERIFIED_SCOPED | F034, F035, F072, F075, F076, F090, F108, F109 | O solver canônico direto não é apresentado como limiar exato quando o produtor integrado retorna sampled. |
| **WP05.T05.INV.20** — Gráfico não calcula completude nem converte lacuna em zero, ganho confirmado ou ajuste residual. | VERIFIED_SCOPED | F071, F074, F078, F079, F090, F108, F109, F041, F042, F043, F116, F117, F110, F111, F091; dirigido: T002, T003, T004, T006, T007 | Nenhum PASS autoriza completar coverage/total/limiar no BI ou declarar integração instalada. |
| **WP05.T05.QLT.01** — Rótulos legíveis, sinais/unidades claros, comparação no mesmo horizonte e dados acessíveis por tabela e teclado. | VERIFIED_SCOPED | F038, F090, F106, F107 | Escopo renderer Chromium e sensibilidade persistida no harness; não afirma navegação instalada completa. |
| **WP05.T05.QLT.20** — Rótulo de condicionado acompanha valor/limiar e a lista acessível explica categorias sem quantificação. | VERIFIED_SCOPED | F071, F075, F090, F107, F108, F109, F041, F042, F043, F116, F117, F110, F111, F091; dirigido: T002, T003, T004, T006, T007 | Nenhum PASS autoriza completar coverage/total/limiar no BI ou declarar integração instalada. |
| **WP05.T05.CMP.01** — Cobrir custo incerto, componente ausente, moeda, limite atingido/não atingido, cenário inviável e referência removida. | PARTIAL | F045, F067, F072, F075, F076, F077, F090, F108, F111, F091 | Cenário real inviável e todos os tipos de referência removida continuam faltando; não extrapolar uma revogação para a cobertura toda. |
| **WP05.T05.CMP.20** — Cobrir omissão inteira, pending, zero confirmado, fonte restrita e atualização que inverte a diferença. | PARTIAL | F071, F073, F078, F109, F110, F111, F091 | Falta atualização/revisão persistida do mesmo caso com histórico preservado. Coverage permanece pending e total null; não chamar knownSubtotal de total completo. |
| **WP05.T05.SUC.01** — Usuário identifica qual componente ou premissa inverte a escolha e abre sua origem sem perder o caso. | BLOCKED_EXTERNAL | F090, F107, F108, F109, F091 | Falta jornada instalada origem→retorno com mesmo caso/contexto/ChoiceRecord. |
| **WP05.T05.SUC.20** — Usuário encontra a categoria que muda a comparação e abre sua origem com o mesmo contexto. | BLOCKED_EXTERNAL | F107, F109, F091 | Falta jornada instalada origem→retorno com mesmo caso/contexto/ChoiceRecord. |
| **WP05.T05.CHK.01** — Com outros custos 165 mil e referência 240 mil/meta 20 mil, limiteimplantação 55 mil provém do engine. | PARTIAL | F090, F108 | Sensibilidade persistida permanece conditioned/sampled 40000–70000 e threshold null por coverage upstream; BI não exibe limiar exato admitido. |
| **WP05.T05.CHK.02** — Atraso sem regra financeira não inventa economia ou obrigação eliminada. | VERIFIED_SCOPED | F115 | Contraprova de não-inferência do renderer; não executa lei financeira de datas no motor upstream. |
| **WP05.T05.CHK.03** — Tabela e marcas retornam exatamente os mesmos valores autorizados. | VERIFIED_SCOPED | F090, F107, F108, F109, F112, F091 | Escopo dos resultados exercitados zero/null e sensibilidade persistida; callback não é destino de origem instalado. |
| **WP05.T05.CHK.20** — A mesma revisão de AI-RENEWAL-OMITTED-CATEGORY aparece no gráfico e tabela: pending sem barra zero; training = 40000 altera total210000→250000 e diferença 30000→-10000, com fontes e snapshot histórico preservados. | PARTIAL | F073, F107, F109, F110, F111, F091 | Não há mesma revisão de AI-RENEWAL-OMITTED-CATEGORY em gráfico/tabela e snapshot histórico humano preservado no mesmo caso; o teste before/after ainda cria dois stores. |

## Registro Full35 final —117 casos

Run [43535162840](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43535162840), job132262274583. A linha é do log combinado baixado; offsets da UI podem diferir. Todos os caminhos são relativos a `modules/sucafina/Sucafinav1/test/product/wp05/`.

| ID | Arquivo | Caso | Resultado | Linha do log |
| --- | --- | --- | --- | ---: |
| F001 | aging-browser.test.ts | unavailable ages remain in the selected population and retain request drilldown | **PASS** | 828 |
| F002 | approved-catalog.test.ts | catalog requires explicit valid host view definitions | **PASS** | 831 |
| F003 | approved-catalog.test.ts | resolution forwards only approved selection and preserves host references | **PASS** | 832 |
| F004 | approved-catalog.test.ts | resolution fails closed for unapproved inputs, changed authority, and missing host references | **PASS** | 833 |
| F005 | approved-catalog.test.ts | selection is captured before asynchronous authority validation | **PASS** | 834 |
| F006 | approved-catalog.test.ts | host cannot mutate the approved callback selection before resolution or during the final fence | **PASS** | 835 |
| F007 | approved-catalog.test.ts | resolved references are captured before final authority validation | **PASS** | 836 |
| F008 | capability.test.ts | read requires current authorization before and after reading | **PASS** | 839 |
| F009 | capability.test.ts | read rejects a projection from a different principal or period | **PASS** | 840 |
| F010 | capability.test.ts | presentation rejects references absent from the authorized projection | **PASS** | 841 |
| F011 | capability.test.ts | descriptor refuses an unconsumed direct call before reading the domain | **PASS** | 842 |
| F012 | capability.test.ts | an unregistered view is explicitly unavailable | **PASS** | 843 |
| F013 | capability.test.ts | a receipt bound to another principal is denied before source access | **PASS** | 844 |
| F014 | capability.test.ts | a receipt for another input is denied before source access | **PASS** | 845 |
| F015 | capability.test.ts | a receipt from another UI request cannot read the projection | **PASS** | 846 |
| F016 | capability.test.ts | duplicate value identifiers are unavailable instead of targeting the wrong detail | **PASS** | 847 |
| F017 | capability.test.ts | decision views require persisted decision metadata in the projection | **PASS** | 848 |
| F018 | contextual.test.ts | contextual BI preserves the complete DashboardReadRequest and rejects missing fields | **PASS** | 851 |
| F019 | contextual.test.ts | contextual selection passes host-owned refs and denies revoked authority | **PASS** | 852 |
| F020 | contextual.test.ts | host must verify references and cannot return a different principal or unlisted evidence | **PASS** | 853 |
| F021 | contextual.test.ts | stored contextual selection reopens both references and detects a changed human choice | **PASS** | 854 |
| F022 | contextual.test.ts | contextual readers keep the original case while initial authority validation is pending | **PASS** | 855 |
| F023 | contextual.test.ts | selection callbacks cannot change the case they are authorizing | **PASS** | 856 |
| F024 | contextual.test.ts | stored selection detects a projection changed while its table reference is opening | **PASS** | 857 |
| F025 | contextual.test.ts | artifact verification cannot mutate a caller's case or authorize a different case | **PASS** | 858 |
| F026 | contextual.test.ts | verification callbacks cannot mutate contextual evidence after successful delivery | **PASS** | 859 |
| F027 | contributions-browser.test.ts | contribution and capacity panels preserve signs, missing values, selection and focus | **PASS** | 879 |
| F028 | dashboard-integration.test.ts | authorized dashboard source reaches BI through the real UI dispatcher | **FAIL** | 1234 |
| F029 | dashboard.test.ts | dashboard adapter refuses metadata after the source version changes | **PASS** | 1237 |
| F030 | dashboard.test.ts | dashboard binding forwards the original selection and period to the domain | **PASS** | 1238 |
| F031 | factory.test.ts | composition exposes the shared descriptor and rejects invalid or duplicate routes | **PASS** | 1241 |
| F032 | factory.test.ts | overlapping producer routes require a host selection and reject unregistered producers | **PASS** | 1242 |
| F033 | geometry.test.ts | geometry preserves missing values, observed zero, signs and the selected period | **PASS** | 1245 |
| F034 | geometry.test.ts | sensitivity never interpolates missing points | **PASS** | 1246 |
| F035 | geometry.test.ts | waterfall geometry uses supplied endpoints and leaves missing endpoints blank | **PASS** | 1247 |
| F036 | geometry.test.ts | timeline positions only declared dates and reports unavailable or clipped periods | **PASS** | 1248 |
| F037 | geometry.test.ts | temporal position preserves a missing month as space instead of interpolation | **PASS** | 1249 |
| F038 | geometry.test.ts | shared scale keeps equal values at equal positions | **PASS** | 1250 |
| F039 | milestones.test.ts | planned, confirmed and undated milestones remain distinct | **PASS** | 1253 |
| F040 | planner-integration.test.ts | real planner projection reaches BI with distinct missing and zero values | **PASS** | 1277 |
| F041 | planner-integration.test.ts | real planner comparison supplies the same reconciled waterfall to BI and dispatcher | **PASS** | 1299 |
| F042 | planner-integration.test.ts | real planner capacity preserves aligned filtered panels and personal-data absence for finance | **FAIL** | 1365 |
| F043 | planner-integration.test.ts | real planner capacity preserves aligned filtered panels and personal-data absence for viewer | **PASS** | 1387 |
| F044 | planner-projected.test.ts | planner-projected adapter forwards producer projection and detects a changed revision | **PASS** | 1390 |
| F045 | planner-projected.test.ts | planner-projected adapter refuses mixed currency or principal before presentation | **PASS** | 1391 |
| F046 | planner.test.ts | planner adapter returns the selected canonical projection and rejects a changed base | **PASS** | 1394 |
| F047 | planner.test.ts | planner binding refuses a resolved comparison outside the selected period | **PASS** | 1395 |
| F048 | portfolio.test.ts | portfolio presentation keeps conditional coverage and unknown values without calculating totals | **PASS** | 1398 |
| F049 | portfolio.test.ts | portfolio bundle is withheld when authorization changes after the domain read | **PASS** | 1399 |
| F050 | portfolio.test.ts | portfolio binding rejects a different horizon before evaluation | **PASS** | 1400 |
| F051 | portfolio.test.ts | C16 portfolio source rejects metadata after its projection changes | **PASS** | 1401 |
| F052 | portfolio.test.ts | concurrent portfolio reads keep each request-local bundle isolated | **PASS** | 1402 |
| F053 | portfolio.test.ts | portfolio source passes the expected projection to host revalidation | **PASS** | 1403 |
| F054 | portfolio.test.ts | an eligible-complete claim with absent components is not displayed as complete | **PASS** | 1404 |
| F055 | portfolio.test.ts | eligible portfolio without coverage references is not displayed as complete | **PASS** | 1405 |
| F056 | portfolio.test.ts | portfolio source rejects a legacy projection without canonical decision metadata | **PASS** | 1406 |
| F057 | portfolio.test.ts | stored portfolio binding retains the persisted reference and rejects a different result | **PASS** | 1407 |
| F058 | procurement-integration.test.ts | real procurement registry and port supply scoped BI stock and deny revoked access | **PASS** | 1431 |
| F059 | procurement.test.ts | aging uses producer values and preserves an unknown age and request reference | **PASS** | 1434 |
| F060 | procurement.test.ts | unknown request status is not asserted to be open | **PASS** | 1435 |
| F061 | procurement.test.ts | an aging row is refused when procurement-request evidence disagrees on version or record identity | **PASS** | 1436 |
| F062 | procurement.test.ts | an aging row is refused when its request drilldown names another incarnation | **PASS** | 1437 |
| F063 | procurement.test.ts | an aging row keeps every producer value when other evidence accompanies one request | **PASS** | 1438 |
| F064 | procurement.test.ts | stock snapshot preserves producer stage counts without inventing a conversion | **PASS** | 1439 |
| F065 | projection.test.ts | observation timestamps do not create stale data, while source and value changes do | **PASS** | 1442 |
| F066 | projection.test.ts | nested decision source observation times are ignored without ignoring material changes | **PASS** | 1443 |
| F067 | projection.test.ts | sensitivity requires its paired persisted reference | **PASS** | 1444 |
| F068 | review-chart.test.ts | review capture keeps producer values, endpoints and reconciliation without residuals | **PASS** | 1447 |
| F069 | review-chart.test.ts | review capture rejects dangling series and does not promote absent values | **PASS** | 1448 |
| F070 | review-chart.test.ts | review capture does not advertise absent charts or misaligned capacity | **PASS** | 1449 |
| F071 | scenario.test.ts | conditioned results retain missing category and never invent a total | **PASS** | 1452 |
| F072 | scenario.test.ts | sensitivity leaves missing and nonfinite results as gaps | **PASS** | 1453 |
| F073 | scenario.test.ts | a later resolved revision changes displayed totals without mutating the earlier snapshot | **PASS** | 1454 |
| F074 | scenario.test.ts | an inconsistent complete comparison cannot promote a conditioned result | **PASS** | 1455 |
| F075 | scenario.test.ts | sampled sensitivity never claims an exact threshold | **PASS** | 1456 |
| F076 | scenario.test.ts | an exact threshold requires matching finite engine evidence | **PASS** | 1457 |
| F077 | scenario.test.ts | missing sensitivity provenance cannot be presented as complete | **PASS** | 1458 |
| F078 | scenario.test.ts | a result claiming completeness with an absent component cannot display a full total | **PASS** | 1459 |
| F079 | scenario.test.ts | a comparison without coverage references cannot be displayed as complete | **PASS** | 1460 |
| F080 | selection.test.ts | selection retains authorized context, source, projection version and zero | **PASS** | 1463 |
| F081 | selection.test.ts | a numeric placeholder marked absent is not displayed as observed zero | **PASS** | 1464 |
| F082 | semantics.test.ts | producer supplies roles, unresolved values remain visible and no months are inferred | **PASS** | 1467 |
| F083 | semantics.test.ts | rejects unknown references and mixed currencies in one series | **PASS** | 1468 |
| F084 | semantics.test.ts | alignment keys must uniquely identify every provided value | **PASS** | 1469 |
| F085 | semantics.test.ts | annual and monthly financial points cannot be blended into one series | **PASS** | 1470 |
| F086 | semantics.test.ts | a producer cannot relabel a currency as another currency | **PASS** | 1471 |
| F087 | semantics.test.ts | ticket categories cannot masquerade as consecutive monthly points | **PASS** | 1472 |
| F088 | semantics.test.ts | a numeric point with missing currency cannot share a priced series | **PASS** | 1473 |
| F089 | semantics.test.ts | series identifiers must be unique | **PASS** | 1474 |
| F090 | sensitivity-integration.test.ts | BI consumes the persisted Planner sensitivity and rejects a changed criterion | **PASS** | 1498 |
| F091 | sensitivity-integration.test.ts | persisted zero and unknown training keep every component and sensitivity point equal in marks, table and navigation | **PASS** | 1541 |
| F092 | stored-scenario.test.ts | stored scenario and comparison flow through one C08 projection and fail after revocation | **PASS** | 1544 |
| F093 | tickets-integration.test.ts | real Dashboard ticket observations reach BI with source evidence and deny changed selection or revoked authority | **PASS** | 1547 |
| F094 | tickets.test.ts | ticket snapshot remains a snapshot and preserves missing values | **PASS** | 1550 |
| F095 | tickets.test.ts | ticket history requires producer supplied dated aggregates | **PASS** | 1551 |
| F096 | view-browser.test.ts | chart and equivalent table preserve selection through keyboard and period brush | **PASS** | 1571 |
| F097 | waterfall.test.ts | projected endpoints reconcile without inventing a residual | **PASS** | 1574 |
| F098 | waterfall.test.ts | the producer must attest financial reconciliation | **PASS** | 1575 |
| F099 | consumer.test.ts | consumer goes through the real UI lease and dispatcher, rejects direct calls and reuse | **PASS** | 1578 |
| F100 | consumer.test.ts | exact mark destination revalidates identity, version and C17 evidence without a collection fallback | **PASS** | 1579 |
| F101 | consumer.test.ts | checked projections are detached from callback mutation and access is fenced at egress | **PASS** | 1580 |
| F102 | consumer.test.ts | a new projection between dispatch and presentation is stale | **PASS** | 1581 |
| F103 | factory-selection.test.ts | producer selection cannot switch between read and revalidation in one bound call | **PASS** | 1584 |
| F104 | projection-validation.test.ts | absent evidence cannot affect geometry even when its numeric field remains populated | **PASS** | 1587 |
| F105 | projection-validation.test.ts | financial and ticket series refuse overlapping or backwards competencies | **PASS** | 1588 |
| F106 | projection-validation.test.ts | waterfall retains supplied endpoints and refuses incompatible context instead of relabelling it | **PASS** | 1589 |
| F107 | render-completion-browser.test.ts | BI components preserve endpoints, undated rows and unknown ages through keyboard navigation | **PASS** | 1592 |
| F108 | engine-coverage.test.ts | Planner's canonical known-subtotal solver proves the 55000 boundary; its integrated sensitivity still discloses pending coverage | **PASS** | 1595 |
| F109 | engine-coverage.test.ts | real Planner results retain omitted training as unknown, then include its 40000 source without mutating the original result | **PASS** | 1596 |
| F110 | engine-coverage.test.ts | real Planner and persisted BI distinguish explicit zero training from an unresolved price | **PASS** | 1597 |
| F111 | engine-coverage.test.ts | source-specific revocation with a valid UI session withholds persisted BI values and coverage | **PASS** | 1598 |
| F112 | consumer-dashboard.test.ts | C02 consumer and table reopen the authorized C17 page and reject changed sources and revoked roles | **PASS** | 1601 |
| F113 | semantic-discriminants.test.ts | Top N stays partial; a producer-supplied other group preserves its contribution and C17 component references | **PASS** | 1604 |
| F114 | semantic-discriminants.test.ts | changing only current ticket status cannot rewrite supplied opening and closing periods | **PASS** | 1605 |
| F115 | semantic-discriminants.test.ts | a projected date change moves the timeline but cannot create savings or remove supplied obligations | **PASS** | 1606 |
| F116 | procurement-stages.test.ts | real request commands traverse every open procurement stage without historical cohort counts | **PASS** | 1609 |
| F117 | procurement-stages.test.ts | approver opens the oldest proven request while a missing age stays visible | **FAIL** | 1637 |

## Registro Target3 —7 casos

Run [43534686609](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534686609), job132260696884, mesmo W. Resultado isolado não substitui a seleção completa.

| ID | Arquivo | Caso | Resultado | Linha do log |
| --- | --- | --- | --- | ---: |
| T001 | planner-integration.test.ts | real planner projection reaches BI with distinct missing and zero values | PASS | 832 |
| T002 | planner-integration.test.ts | real planner comparison supplies the same reconciled waterfall to BI and dispatcher | PASS | 854 |
| T003 | planner-integration.test.ts | real planner capacity preserves aligned filtered panels and personal-data absence for finance | PASS | 876 |
| T004 | planner-integration.test.ts | real planner capacity preserves aligned filtered panels and personal-data absence for viewer | PASS | 898 |
| T005 | procurement-integration.test.ts | real procurement registry and port supply scoped BI stock and deny revoked access | PASS | 922 |
| T006 | procurement-stages.test.ts | real request commands traverse every open procurement stage without historical cohort counts | PASS | 925 |
| T007 | procurement-stages.test.ts | approver opens the oldest proven request while a missing age stays visible | PASS | 947 |

## Identidade histórica

Baseline103:102 nomes retidos,15 novos,1 aposentado. **C034 não foi executado sob seu nome antigo**; foi substituído por F042 (finance, FAIL no Full35/PASS no Target3) e F043 (viewer, PASS nas duas seleções). O mapeamento dos103 casos originais, incluindo o resultado e linha históricos, está no JSON. Sua fonte é criteria.json no pin `eff8e9dccae6ed3b2fd7c308d245fa62a11facbd`, blob `bb0f4f36d2dec90c3aebb9fe0a6089e6741d13d3`; o run histórico é43519544728 e o produto histórico é `fe75fd8b5daa25647bc4938025c82dbfc287a0a1`.

## Limites gerais

- Nenhum dos108 critérios recebeu aceite integral.
- O Target3 bem-sucedido não apaga as três falhas do Full35.
- Finance: prazo durante importação/renderização/transporte e falha de limpeza; causa interna não isolada. Não classificar conclusivamente como infraestrutura externa.
- Approver: falha em criar a página do fixture compartilhado antes do corpo.
- Provas de Chromium, adapters, stores e ports reais em harness; catálogo instalado, navegação exata completa, native/MCP e artefatos residentes duráveis continuam sem prova.
- FTE numérico e custo HC ausente nos papéis restritos não provam dois painéis numéricos positivos.
- Training zero/null e revogação exercitados; antes/depois40000 usa stores distintos e falta atualização do mesmo caso com escolha e histórico imutáveis.
- Coverage pending, total e threshold integrados null;55000 pertence ao solver canônico do subtotal conhecido.
- Árvores Git W/S iguais exceto .ci-run.json não provam instalação congelada no test-ci; check usa frozen-lockfile e verifica working tree.

Ver [recibo de validação](resume-validation-20261114.md), [ledger de CI](resume-ci-20261114.json) e [origem das provas](resume-proof-notes-20261114.md).
