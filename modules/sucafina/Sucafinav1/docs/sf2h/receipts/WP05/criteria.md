# WP05 — matriz final independente dos 108 critérios

**Aceite integral: NOT_ACCEPTED.** Os estados abaixo distinguem comportamento comprovado em escopo delimitado, prova parcial e dependência externa. Nenhum resultado de harness é chamado de PASS integral do critério.

S2: [43519544728](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43519544728), produto `fe75fd8b5daa25647bc4938025c82dbfc287a0a1`, snapshot `988877105aff091ee9881a812282d677c63be5bb`. Foram executados exatamente **103 casos em 34 arquivos: 102 passaram e 1 falhou**. A conclusão do run é **failure**. A equivalência de árvore confirma somente `.ci-run.json` diferente entre W2 e S2.

Log do job `132210062303`: SHA-256 `d3c528bc952649e8743cbfa5d844b72476333b839c0cb245eaeecdc436ded686`. Todos os nomes/outcomes/linhas dos 103 casos foram reconciliados com esse log. Nenhum teste de produto foi executado localmente por este revisor.

| Estado | Quantidade | Significado |
|---|---:|---|
| VERIFIED_SCOPED | 43 | Comportamento específico demonstrado no escopo declarado; não equivale a aceite instalado/integral. |
| PARTIAL | 27 | Há prova executada, mas falta um discriminante ou parte explícita do requisito. |
| BLOCKED_EXTERNAL | 38 | Requisito depende de composição/runtime de outro owner ou de origem que efetivamente falhou. |
| NOT_PROVED | 0 | Sem prova executada suficiente; nenhuma linha precisou ocultar prova parcial sob esse estado. |

## Limites decisivos

- Only dashboard-integration fails: the seed Dashboard producer drops milestone:p:undated:date in scope.ts and port.ts; the assertion is retained.
- The passing consumer-dashboard regression covers a real C02 store/port plus UI dispatcher, Chromium brush and a real page-level C17 resolver in a harness. It does not install eight exact-detail destinations.
- The 55000 boundary is proved by the canonical known-subtotal solver/previews. Persisted integrated sensitivity remains conditioned/sampled 40000–70000 with threshold null; no exact complete BI threshold is claimed.
- Training omission/revision uses real engine/stores and proves knownSubtotal 210000→250000 and ordered advantage 30000→−10000. Coverage still pending; total remains null. Before/after fixtures use separate stores and do not prove a same-case immutable human ChoiceRecord.
- The three new semantic cases prove only renderer behavior for Top N/other, current ticket status versus supplied periods, and projected date non-inference. They do not certify upstream aggregation, individual ticket event production or financial-date rules.
- No actual installed native/MCP/provider-bound execution or durable resident artifact consumption witness exists. Inherited proof refs and callbacks are not counted as such execution.
- Canonical typecheck fails with 184 diagnostics: 141 external inherited, 39 seed-owned contract/cascade and 4 new cascade diagnostics. The two newly authored fixture diagnostics were removed; no typecheck PASS is claimed.

**Gates separados dos invariantes:** check3 `43520127151`, no commit documental D1 `a87c526d29106efc295dfeade1b1d754e2617783`, confirma os mesmos 184 diagnósticos de typecheck, sem adição/remoção. Guards: **78 regras, 605 paths, 0 gates, 11 avisos, 0 erros — success**. O run continua failure por typecheck. Artefato check3 `14081743852` baixado, com SHA-256 `4b89aef56a9df3b21aff85c529d374464eedc0036c88f9530bf3aeee9c9f34f5` conferido. A lane Bun de testes não publicou artefato Playwright; seus logs, request e metadados de Actions constituem a evidência de execução.

## Consumidores e escopos

Os códigos U apontam os consumidores concretos inspecionados. O JSON preserva paths/entrypoints/produtores, discriminantes obrigatórios, casos completos e limites por critério. **P** significa componente/adapter com callbacks ou Chromium isolado; **D** significa motor/port/store real no harness; **H** assinala obrigação de host/native instalada ainda ausente.

| Código | Consumidor | Limite |
|---|---|---|
| U01 | Catálogo BI e factory do consumidor | A composição instalada em product/integration/bi-http.ts continua Dashboard-only; fontes de testes não são registro do host. |
| U02 | Marca/tabela → destino exato C17 → retorno | consumer-dashboard exercita BI01/C17 de página em harness; os demais destinos e retorno instalado permanecem externos. |
| U03 | Refs persistidas de cenário/comparação/sensibilidade → BI09–11 | Há harness de motor/store real; os testes devem distinguir valores calculados, coverage caracterizada e renderização isolada de uma prova instalada. |
| U04 | Consumidor ContextualBI de escolha humana e artefatos | Os leitores de escolha/artefato são callbacks nos testes; reload/persistência do artefato BI e consumo residente permanecem a cargo de WP10. |
| U05 | Dados do produtor → geometria/semântica de componentes | Funções puras e browser isolado; apropriado a invariantes locais, insuficiente a critérios que exigem consumidores de domínio. |
| U06 | Trajetória/waterfall consumidos de Planner ou Dashboard | Planner é executado em harness com seleção/autoridade de teste; o entrypoint instalado ainda não liga todas estas visões. |
| U07 | C16 sf_bi_view → dispatcher → readBiView | Há autoridade UI e dispatcher reais em testes selecionados, sem execução native/MCP do provedor instalado. |
| U08 | WP10/revisor consome recibos de WP05 | Recibos registram obrigações e evidências; não são execução de produto ou substituto de CI. |
| U09 | Painéis alinhados FTE/custo BI04 | O harness usa Planner real; o browser de componentes usa projeções fornecidas. Não há afirmação de produtividade ou custo unitário. |
| U10 | Painel de contribuições BI03 | Browser isolado prova exibição/seleção; Top N/outros e destino real requerem discriminantes próprios. |
| U11 | Coleção Procurement → estoque/aging BI05/BI06 | O port/registry real executa no harness; filtros reais do host e sequência etapa→pedido não estão registrados no entrypoint instalado. |
| U12 | Dashboard IT Operations → tickets BI07 | O produtor atual fornece observações mensais; o teste não transforma esses agregados em eventos de tickets individuais. |
| U13 | Agenda do Dashboard → timeline BI08 | O seed do produtor descarta marco sem data; a correção WP02 pinada precisa ser consumida para a prova real desse caso. |

## Critérios

Cada referência Cnnn corresponde a um testcase real do S2, listado após a matriz. As linhas que citam C020 incluem a falha upstream; nenhuma linha VERIFIED_SCOPED cita esse caso. Todos os critérios mantêm `acceptance_status: NOT_ACCEPTED` para aceite integral.

### WP05

| Critério | Estado | Consumidor / escopo | Casos S2 | Comprovado e limite restante |
|---|---|---|---|---|
| WP05.DOD.01 | PARTIAL | U01 / P/D | C032, C033, C049, C083, C097, C020 | Perguntas, unidades, tabela, estados e seleções exportadas têm provas em componentes e produtores específicos. Limite: Não há cobertura real completa dos oito; o produtor omite undated e seu teste falha. |
| WP05.DOD.02 | VERIFIED_SCOPED | U01 / D | C032, C033, C049, C098, C099 | Adapters recebem resultados reais de Planner/Procurement/stores; analytics conserva números e idade fornecidos. Limite: Aceitação limitada à ausência de regra de negócio nos consumidores exercitados e à inspeção dos adapters; não é catálogo instalado. |
| WP05.DOD.03 | BLOCKED_EXTERNAL | U02 / P/D/H | C019, C097, C100 | Tabela, teclado e seleção após brush funcionam; BI01 chega ao C17 de página no harness. Limite: WP10 ainda deve verificar entrada comum e retorno dos gráficos com seus produtores/destinos reais. |
| WP05.DOD.04 | BLOCKED_EXTERNAL | U01 / P/D/H | C032, C033, C034, C049, C081, C083, C098, C099, C020 | Vários produtores reais e as apresentações de decisão foram executados. Limite: Onze perguntas não estão compostas no host; undated, completude e limiar admitido continuam bloqueados. |
| WP05.DOD.20 | PARTIAL | U03 / P/D | C081, C082, C099 | Cenário/comparação/sensibilidade persistidos são lidos por refs e preservados no bundle BI. Limite: Abertura de coverage/result refs junto às marcas no host real não foi demonstrada. |
| WP05.DOD.10 | BLOCKED_EXTERNAL | U04 / P/D/H | C015, C016, C017, C018, C089 | Escolha/aprovação, artefatos reabertos por callbacks e descriptor/lease UI têm contraprovas. Limite: Faltam consumo residente durável, reabertura instalada e execução native/MCP real. |
| WP05.INV.01 | BLOCKED_EXTERNAL | U02 / P/D/H | C071, C090, C100 | BI01 preserva valor, contexto original, visualPeriod, ref e versão até o C17 real de página. Limite: Esse harness não demonstra a invariância de detalhe nos demais destinos instalados. |
| WP05.INV.02 | VERIFIED_SCOPED | U05 / P | C072, C084, C031, C050, C055, C094, C097 | Ausente≠zero, estoque≠coorte, planned≠completed e idade sem evento indisponível passaram. Limite: A falha upstream undated impede recebimento da linha, mas não demonstra data artificial no renderer. |
| WP05.INV.03 | VERIFIED_SCOPED | U06 / P/D | C033, C059, C087, C088 | Endpoints e componentes permanecem do produtor; final116 vira unreconciled sem parcela+1. Limite: Escopo de geometria e adapter do motor, sem novo cálculo financeiro no BI. |
| WP05.INV.20 | VERIFIED_SCOPED | U03 / P/D | C062, C065, C069, C070, C098, C099, C097 | Subtotal conhecido não promove completude; pending/ausente não gera zero, ganho completo ou residual. Limite: Não declara corrigido o assessment upstream que continua pending. |
| WP05.INV.10 | VERIFIED_SCOPED | U07 / P | C005, C008, C089, C091, C093, C049 | Concessão única, recusa de direto/clone/reuso, revogação e estabilidade do produtor foram exercitadas. Limite: Escopo UI/adapter/domínio exercitado e ownership revisado; não é concessão ou identidade native nova. |
| WP05.QLT.01 | PARTIAL | U05 / P | C019, C086, C097, C081 | Texto, unidades, formas, tabela e teclado tornam vários componentes independentes de hover/cor. Limite: A leitura de cada um dos oito gráficos no produto composto não foi avaliada integralmente. |
| WP05.QLT.02 | VERIFIED_SCOPED | U05 / P/D | C019, C030, C034, C075, C076, C077, C081, C096 | Sinais, unidades, granularidade e escalas separadas/alinhadas de FTE/custo foram verificados. Limite: A prova cobre a formatação direta dos valores fornecidos, sem arredondamento financeiro ou produtividade inferida. |
| WP05.QLT.03 | PARTIAL | U01 / P | C009, C014, C062, C072, C086, C097 | Readers distinguem denied/unavailable/stale; componentes conservam vazio, parcial e ausência. Limite: Falta demonstração integrada dos quatro estados visíveis, inclusive restrito, sem mensagens ambíguas. |
| WP05.QLT.20 | VERIFIED_SCOPED | U03 / P/D | C062, C066, C081, C097, C098 | Qualificação conditioned acompanha o limiar/valor; categorias pendentes aparecem em lista acessível. Limite: O limiar real recebido pode ser sampled/indisponível; não se afirma exact admitido. |
| WP05.QLT.10 | BLOCKED_EXTERNAL | U07 / P | C056, C058, C090, C092, C015, C018 | Refs/digests/versões e reasons falham diante de mudança material; observedAt sozinho não muda identidade. Limite: O pacote ainda não typechecka: faltam contratos WP00 e há 184 diagnósticos herdados/cascata. |
| WP05.CMP.01 | PARTIAL | U01 / P/H | C019, C025, C031, C084, C086, C097, C101 | Casos específicos cobrem sinais, ausência, parcialidade, filtros e seleção dos componentes. Limite: Não há cobertura final de todos os filtros/destinos dos oito gráficos em composição. |
| WP05.CMP.02 | BLOCKED_EXTERNAL | U02 / P/D/H | C001, C019, C086, C097, C100 | Teclado/tabela/foco são exercitados e o harness BI01 conserva seleção até detalhe C17. Limite: Cada par real, seu recorte restrito e retorno instalado ainda dependem de WP10. |
| WP05.CMP.03 | BLOCKED_EXTERNAL | U01 / D/H | C032, C033, C049, C083, C100, C020 | Planner/Procurement/Dashboard do harness têm produtor e refs identificáveis. Limite: Fixtures e harness não substituem a prova final de consumidores instalados por marca/agregado. |
| WP05.CMP.04 | BLOCKED_EXTERNAL | U01 / P/D/H | C032, C033, C034, C049, C081, C083, C098, C099 | Há outputs canônicos não vazios em múltiplas perguntas e decisão persistida. Limite: As onze perguntas com motor/fonte/tabela não estão verificadas no host comum. |
| WP05.CMP.20 | PARTIAL | U03 / P/D | C062, C064, C099 | Omissão inteira e revisão training40000 produzem a inversão dos subtotais no motor. Limite: Faltam training0 confirmado versus null/fonte restrita, completude e revisão no mesmo caso. |
| WP05.CMP.10 | PARTIAL | U08 / P/H | C015, C018, C089, C090, C093 | Matriz/ledger mapeiam tasks, owners, paths, consumidores e negativos; callbacks/leases têm contraprovas. Limite: Obrigações residentes/nativas ainda não têm consumidor e provas reais completos. |
| WP05.SUC.01 | BLOCKED_EXTERNAL | U02 / P/D/H | C001, C019, C100 | Usuário de harness seleciona contribuição/pendência e BI01 conserva filtro até C17. Limite: Os roteiros reais de desvio, capacidade e pendência até seus registros ainda faltam. |
| WP05.SUC.02 | VERIFIED_SCOPED | U01 / P/D | C060, C072, C094, C049, C100 | Mutação canônica0→37 altera resultado; ausência numérica, ref adulterada e pedido hidden são discriminados. Limite: Verificação de comportamento no renderer/harness, sem afirmar implantação do catálogo. |
| WP05.SUC.03 | BLOCKED_EXTERNAL | U01 / P/D/H | C009, C023, C031, C084, C086, C097, C020 | Componentes degradam honestamente quando faltam série/plano/valor/data. Limite: Funcionamento dos oito com C02 real não fecha: undated falha upstream e catálogo host está incompleto. |
| WP05.SUC.20 | BLOCKED_EXTERNAL | U03 / P/D/H | C097, C099 | Categoria/condição é exibida e o motor calcula a inversão conhecida. Limite: Não há abertura real de sua origem conservando o caso/contexto instalado. |
| WP05.SUC.10 | BLOCKED_EXTERNAL | U01 / P/D/H | C081, C082, C100 | Saídas reais de stores/ports são consumidas por harness reproduzível no SHA S2. Limite: Não há prova final do consumidor integrado residente/native e catálogo comum. |

### WP05.T01

| Critério | Estado | Consumidor / escopo | Casos S2 | Comprovado e limite restante |
|---|---|---|---|---|
| WP05.T01.DOD.01 | VERIFIED_SCOPED | U06 / P/D | C032, C033, C097 | Trajetória/waterfall exportados recebem Planner real no harness e possuem tabela/seleções de componente. Limite: Aceitação de exports e consumidor exercitado; destino instalado é tratado em CHK.05. |
| WP05.T01.DOD.02 | VERIFIED_SCOPED | U06 / P | C025, C027, C029, C073, C076, C087, C096 | Granularidade, lacuna, endpoints e falha de reconciliação têm resultados e negativos executados. Limite: Escopo de semântica/geometria e admissão da apresentação. |
| WP05.T01.INV.01 | VERIFIED_SCOPED | U06 / P/D | C025, C029, C032, C073, C076 | Não surgem meses/actual/contribuições extras: série anual e lacunas conservam cardinalidade e valores. Limite: Não declara uma distribuição mensal onde o produtor só forneceu total anual. |
| WP05.T01.INV.02 | VERIFIED_SCOPED | U06 / P/D | C027, C033, C087, C088 | Waterfall usa endpoints/projeção do motor e exige atestado de reconciliação. Limite: A regra financeira permanece no C02; a prova é do consumo e da geometria. |
| WP05.T01.QLT.01 | PARTIAL | U06 / P/D | C086, C096, C097, C100 | Período, moeda, versão e ref conservam-se na visualização/seleção financeira. Limite: Não há assert/roteiro completo de legibilidade da identificação do cenário em toda trajetória. |
| WP05.T01.QLT.02 | VERIFIED_SCOPED | U05 / P | C019, C025, C027, C094, C097 | Negativo conserva sinal/texto e posição; ausência conserva lacuna e texto indisponível. Limite: Não depende apenas de cor; zero confirmado permanece distinto. |
| WP05.T01.CMP.01 | PARTIAL | U06 / P/D | C027, C032, C073, C076, C087, C096 | Trajetória anual/parcial e waterfall positivo/negativo/ausente/não reconciliado passaram. Limite: Falta discriminante explícito de contribuição zero no waterfall, além do zero em trajetória/geometria. |
| WP05.T01.CMP.02 | PARTIAL | U05 / P | C071, C086, C097 | Enter e tabela preservam identidade/valores das marcas. Limite: Não foi comparada a seleção por clique direto e por teclado na mesma marca financeira. |
| WP05.T01.SUC.01 | PARTIAL | U06 / P/D | C032, C073, C086, C100 | Roles budget/actual/forecast e limitação sobre forecast registrado foram verificados. Limite: A distinção visível orçamento/realizado/outlook ainda não tem roteiro completo no consumidor real. |
| WP05.T01.SUC.02 | BLOCKED_EXTERNAL | U02 / P/D/H | C033, C090, C097 | Delta e componentes do motor são preservados; seleção de contribuição conserva ref. Limite: A origem de Planner no host e o retorno contextual instalado não foram executados. |
| WP05.T01.CHK.01 | VERIFIED_SCOPED | U06 / P | C029, C073, C076 | Entrada anual permanece um valor anual; não há doze pontos fabricados nem mistura mensal/anual. Limite: É discriminante da transformação do consumidor, não prova de distribuição mensal do produtor. |
| WP05.T01.CHK.02 | VERIFIED_SCOPED | U06 / P/D | C025, C032, C072, C086, C094, C100 | Actual desconhecido vira lacuna/indisponível; zero confirmado conserva marca/tabela0. Limite: Inclui placeholder999 marcado absent e uma projeção real de Planner/Dashboard. |
| WP05.T01.CHK.03 | VERIFIED_SCOPED | U06 / P | C059, C087, C097 | 100,+20,−5 termina em115; final116 é unreconciled sem parcela residual. Limite: O oracle de apresentação é separado da prova de motor590000→602000. |
| WP05.T01.CHK.04 | VERIFIED_SCOPED | U06 / P | C006, C021, C035, C036, C074, C076, C077, C096 | Moeda, competência/período e versão incompatíveis são recusados pelos readers/semântica. Limite: Nenhum reetiquetamento silencioso de moeda ou mistura temporal foi aceito. |
| WP05.T01.CHK.05 | BLOCKED_EXTERNAL | U02 / P/D/H | C090, C097, C100 | Seleção financeira por Enter e negativa de ref/contexto foram exercitadas; BI01 conserva brush até C17. Limite: Contribuição de Planner até detalhe restrito e retorno de foco no host ainda faltam. |

### WP05.T02

| Critério | Estado | Consumidor / escopo | Casos S2 | Comprovado e limite restante |
|---|---|---|---|---|
| WP05.T02.DOD.01 | VERIFIED_SCOPED | U09 / P/D | C019, C033, C034, C035 | Contribuição e FTE/custo têm exports, unidades, tabela e refs; Planner fornece painéis alinhados. Limite: Prova de exports/componentes e C02 no harness; não do detalhe instalado. |
| WP05.T02.DOD.02 | PARTIAL | U10 / P/D | C019, C034, C101 | Origem fornecida e parcialidade de Top N/outros/HR ausente são conservadas e documentadas. Limite: Tratamento visual de agrupamento pessoal restrito ainda não foi demonstrado com o produtor real. |
| WP05.T02.INV.01 | VERIFIED_SCOPED | U10 / P | C019, C025, C101 | +40/−30 e agregado−5 conservam sinal e unidade; não são convertidos em absolutos. Limite: Escopo de formatação/geometria recebida, sem sorter ou agregação financeira local. |
| WP05.T02.INV.02 | VERIFIED_SCOPED | U09 / P/D | C019, C034, C072 | FTE0/0.5 e custo ausente permanecem grandezas separadas; não se reconstrói custo a partir de FTE. Limite: Escopo dos dados removidos/ausentes nos exemplos recebidos; nomes pessoais específicos não foram exercitados. |
| WP05.T02.QLT.01 | VERIFIED_SCOPED | U10 / P | C019, C025, C030 | Escala−30..40 compara contribuições sem ser esmagada pela base1000; sinais são visíveis. Limite: Escopo da apresentação de contribuição fornecida, sem inferir magnitude absoluta como desvio. |
| WP05.T02.QLT.02 | VERIFIED_SCOPED | U09 / P/D | C019, C030, C034, C075 | FTE/custo usam alignmentKeys comuns e escalas/unidades próprias; desalinhamento é recusado. Limite: Painéis não usam eixo duplo que sugira equivalência entre as medidas. |
| WP05.T02.CMP.01 | VERIFIED_SCOPED | U10 / P | C019, C025, C072, C101 | Positivo, negativo, zero, desconhecido, Top N parcial e agregado reconciliado têm discriminantes. Limite: A cobertura é de componentes/semântica recebida; agregado do teste não certifica cálculo upstream. |
| WP05.T02.CMP.02 | BLOCKED_EXTERNAL | U09 / P/D/H | C019, C034, C100 | Alinhamento/seleção e uma jornada de brush BI01 estão comprovados. Limite: Falta recorte restrito e drilldown autorizado dos dois painéis no host real. |
| WP05.T02.SUC.01 | BLOCKED_EXTERNAL | U02 / P/H | C019, C090, C101 | Contribuições positiva/negativa são identificáveis e geram a ref correspondente. Limite: Abertura do componente de contribuição no destino instalado segue ausente. |
| WP05.T02.SUC.02 | VERIFIED_SCOPED | U09 / P/D | C019, C034 | Capacidade e custo são comparados em painéis distintos sem conversão/produtividade inferida. Limite: É verificação da apresentação e dos valores de Planner no harness, sem afirmar avaliação humana instalada. |
| WP05.T02.CHK.01 | VERIFIED_SCOPED | U10 / P | C019, C025, C101 | +40/−30 são preservados; sem resultado fornecido não aparece delta10/total reconciliado. Limite: Quando há plano reconciliado, o resultado é o recebido do produtor da fixture. |
| WP05.T02.CHK.02 | VERIFIED_SCOPED | U10 / P | C101 | Top N fica parcial; outros fornecido conserva−5 e duas refs de componente no C17 emitido. Limite: A seleção C17 foi preservada no renderer; não se afirma resolução instalada ou cálculo upstream do agregado. |
| WP05.T02.CHK.03 | VERIFIED_SCOPED | U09 / P/D | C019, C034, C072 | FTE confirmado0 é marca0 e custo ausente é indisponível; nenhum é convertido no outro. Limite: Combina discriminante visual0/null com projeção real de Planner de custo HR ausente. |
| WP05.T02.CHK.04 | PARTIAL | U09 / P/D | C019, C034, C086, C100 | Unidades/alinhamento e brush/contexto original são preservados em testes específicos. Limite: Falta um teste dos dois painéis filtrados juntos com nomes/custos pessoais removidos no C02 real. |
| WP05.T02.CHK.05 | BLOCKED_EXTERNAL | U02 / P/D/H | C019, C090, C100 | Enter/foco e ref/grupo/moeda/período/versão de componente são preservados nos helpers. Limite: Jornada de categoria até detalhe real e retorno instalado ainda não existe. |

### WP05.T03

| Critério | Estado | Consumidor / escopo | Casos S2 | Comprovado e limite restante |
|---|---|---|---|---|
| WP05.T03.DOD.01 | BLOCKED_EXTERNAL | U11 / P/D/H | C049, C050, C001 | Port/registry real de Procurement fornece estoque e aging autorizados; renderer mantém refs dos pedidos. Limite: Abertura dos pedidos nos destinos instalados de Procurement não foi demonstrada. |
| WP05.T03.DOD.02 | VERIFIED_SCOPED | U11 / P/D | C049, C050, C055, C001 | Estoque atual conserva suas contagens; idades comprovadas e indisponíveis têm apresentação distinta. Limite: Escopo do port em harness e da UI de componente; não certifica instalação no catálogo. |
| WP05.T03.INV.01 | VERIFIED_SCOPED | U11 / P/D | C049, C055 | Contagens de etapa permanecem contagens; não geram taxa de conversão, abandono, coorte ou produtividade. Limite: Invariante do adapter/renderer que consome as projeções examinadas. |
| WP05.T03.INV.02 | VERIFIED_SCOPED | U11 / P/D | C001, C049, C050, C054 | Idade fornecida é preservada e pedidos sem evento confiável continuam no universo autorizado como indisponíveis. Limite: Analytics não recorre ao savedAt nem ao histórico bruto para preencher idade. |
| WP05.T03.QLT.01 | VERIFIED_SCOPED | U11 / P/D | C001, C050, C055 | Títulos, unidade days e limitações distinguem estoque atual de tempo na etapa. Limite: Prova de componentes renderizados e metadados da apresentação. |
| WP05.T03.QLT.02 | PARTIAL | U11 / P/D | C001, C050, C097 | Responsável desconhecido e idade indisponível são representados por texto e não apenas por cor. Limite: Falta contraprova positiva de prazo/SLA fornecido com política e origem explícitas. |
| WP05.T03.CMP.01 | PARTIAL | U11 / P/D | C049, C050, C051, C052, C053 | Harness cobre draft, PR pendente/rejeitada, ressubmissão, holder ausente e histórico insuficiente. Limite: Não percorre todas as etapas abertas de sourcing/PO e suas aprovações. |
| WP05.T03.CMP.02 | BLOCKED_EXTERNAL | U11 / P/D/H | C049, C001 | Port real restringe pedidos ao papel; o componente mantém denominador e refs de suas linhas. Limite: Não há reconciliação de barras, pontos e lista restrita na mesma composição real do host. |
| WP05.T03.SUC.01 | BLOCKED_EXTERNAL | U02 / P/D/H | C049, C055, C001 | Estoque mostra concentração por contagem e seleção exporta a ref autorizada do pedido. Limite: Jornada de gestor abrindo pedidos pelo destino instalado permanece sem prova. |
| WP05.T03.SUC.02 | PARTIAL | U11 / P/D | C001, C049, C050 | UI conserva idades comprovadas e informa o número de pedidos com idade indisponível. Limite: Falta jornada real de aprovador escolhendo o mais antigo entre múltiplos pedidos com idades conhecidas. |
| WP05.T03.CHK.01 | PARTIAL | U11 / P/D | C055, C049 | Fixture de estoque 7/2/3 não cria conversão; port real conserva a etapa atual de pedido rejeitado. Limite: Falta observar o mesmo pedido mudando de etapa por rejeição/retorno sem criar coorte histórica. |
| WP05.T03.CHK.02 | VERIFIED_SCOPED | U11 / D | C049, C050 | Pedido ressubmetido há 2 dias e salvo hoje continua com ageDays 2 fornecido por Procurement. Limite: Prova do consumidor do port real; não se usa timestamp de save como idade. |
| WP05.T03.CHK.03 | VERIFIED_SCOPED | U11 / P | C001, C050, C097 | Dois pedidos sem idade comprovada ficam como indisponíveis no universo de três, sem barra zero nem média inventada. Limite: O discriminante de denominador e seleção foi exercitado no renderer Chromium. |
| WP05.T03.CHK.04 | PARTIAL | U11 / P/D | C049, C001 | Requester restrito não recebe pedido alheio no port real; renderer conserva o universo que recebe. Limite: A projeção restrita real não foi renderizada no mesmo teste para comparar todos os agregados, pontos e tabela. |
| WP05.T03.CHK.05 | BLOCKED_EXTERNAL | U11 / P/D/H | C001, C050, C090 | Seleção conserva pedido/contexto e dados sem política não geram linha SLA inventada. Limite: Faltam sequência instalada etapa→pedido→retorno e caso positivo de SLA com política/origem. |

### WP05.T04

| Critério | Estado | Consumidor / escopo | Casos S2 | Comprovado e limite restante |
|---|---|---|---|---|
| WP05.T04.DOD.01 | BLOCKED_EXTERNAL | U01 / P/D/H | C002, C023, C083, C084, C031, C020 | Exports/catalog definitions existem e os adapters reais de tickets/marcos foram exercitados. Limite: Catálogo de oito destinos reais não está composto; Dashboard omite o marco sem data e falha. |
| WP05.T04.DOD.02 | PARTIAL | U08 / P/D | C002, C003, C004, C089, C090, C100 | Contrato do consumer, matriz de estados e patch WP10 explicitam refs, revalidação e retorno esperados. Limite: WP10 ainda não consumiu esses contratos em composição instalada. |
| WP05.T04.DOD.18 | BLOCKED_EXTERNAL | U07 / P/D/H | C023, C089, C092, C100 | Descriptor sf_bi_view é consumido pelo dispatcher UI real sob lease e refs de harness. Limite: Consumo T06 instalado e superfícies native/MCP reais permanecem ausentes. |
| WP05.T04.INV.01 | VERIFIED_SCOPED | U12 / P/D | C031, C083, C084, C085, C102 | Snapshot de ticket permanece fotografia; série datada é preservada e planned não vira completed. Limite: Inclui mudança isolada de status atual sem reescrever os agregados fornecidos; não prova geração upstream de eventos individuais. |
| WP05.T04.INV.02 | VERIFIED_SCOPED | U13 / P | C031, C049, C083, C097 | Marco sem data recebido pelo renderer fica listado sem data artificial; domínio recusa fonte não autorizada/revogada. Limite: O produtor Dashboard ainda não entrega a linha undated no caso integrado; esse bloqueio é registrado em CHK.03. |
| WP05.T04.INV.18 | VERIFIED_SCOPED | U07 / P/D | C008, C010, C011, C012, C049, C089, C091, C093 | Transportes exercitados não criam concessão: direto, reuso, revogação e troca de produtor são recusados. Limite: Escopo de UI/adapter/domínio e revisão de ownership; não afirma identidade ou execução native. |
| WP05.T04.QLT.01 | VERIFIED_SCOPED | U12 / P | C031, C083, C084, C085, C097, C102 | Texto, estados, datas/unidades e tabela distinguem entrada, conclusão, planejamento e desconhecido. Limite: Prova visual/semântica dos componentes e dos agregados de ticket fornecidos. |
| WP05.T04.QLT.02 | BLOCKED_EXTERNAL | U02 / P/D/H | C001, C019, C086, C097, C100 | Componentes exercitados têm teclado/tabela/foco; BI01 preserva brush até C17 de página. Limite: Equivalência e retorno previsível dos oito gráficos no catálogo instalado não foram demonstrados. |
| WP05.T04.QLT.18 | BLOCKED_EXTERNAL | U07 / P/H | C005, C006, C007, C056, C058, C089, C090, C092 | Contexto, provenance, ausência e stale têm validação fechada no leitor/consumer exercitado. Limite: Contratos WP00 não estão integrados no seed; typecheck falha e comparação UI/native/MCP real está ausente. |
| WP05.T04.CMP.01 | BLOCKED_EXTERNAL | U12 / P/D | C031, C083, C084, C085, C097, C020 | Snapshot/série de tickets e marcos planejados/concluídos/sem data têm casos específicos. Limite: O caso com produtor real de marcos falha porque a fonte elimina o registro sem data. |
| WP05.T04.CMP.02 | BLOCKED_EXTERNAL | U01 / P/D/H | C002, C009, C014, C049, C086, C100 | Catálogo é allowlist; estados e filtros têm contraprovas específicas em leitores e componentes. Limite: Falta fechamento dos oito gráficos com restrição/filtros/drilldowns instalados. |
| WP05.T04.CMP.18 | BLOCKED_EXTERNAL | U07 / P/D/H | C005, C008, C009, C089, C090, C092, C100 | Export C16 tem casos UI autorizado, direto proibido, stale e indisponível. Limite: A cobertura pedida nas superfícies reais T06/native/MCP ainda não existe. |
| WP05.T04.SUC.01 | BLOCKED_EXTERNAL | U12 / P/D | C031, C083, C084, C085, C097, C102, C020 | Apresentações distinguem eventos fornecidos de fotografia e marcos planned de completed. Limite: A jornada real perde marco sem data no produtor WP02; não há prova de equipe usando o horizonte completo instalado. |
| WP05.T04.SUC.02 | BLOCKED_EXTERNAL | U01 / D/H | C023, C024, C032, C033, C049, C083, C100 | Factory seleciona produtores identificáveis e consumer passa por UI real no harness. Limite: WP10 ainda deve registrar o catálogo e os destinos concretos; o harness não substitui essa composição. |
| WP05.T04.SUC.18 | BLOCKED_EXTERNAL | U07 / D/H | C089, C091, C100 | A superfície UI exercitada conserva autoridade/resultado e recusa concessão inválida. Limite: Não há execução native/MCP real comparável para demonstrar igualdade e ausência de efeitos extras. |
| WP05.T04.CHK.01 | VERIFIED_SCOPED | U12 / P/D | C083, C084, C085, C102 | Fotografia recebe data de referência sem série/taxa inventada; agregados válidos preservam os períodos recebidos. Limite: Cobre produtor Dashboard no harness e renderer de série fornecida, não derivação de eventos individuais. |
| WP05.T04.CHK.02 | PARTIAL | U12 / P/D | C083, C102 | Renderer mantém aberturas de janeiro e fechos de fevereiro ao mudar somente o status atual. Limite: Produtor disponível não expõe eventos individuais de abertura/fecho; essa semântica upstream não foi demonstrada. |
| WP05.T04.CHK.03 | BLOCKED_EXTERNAL | U13 / P | C031, C097, C020 | No renderer, planned/completed são distintos e undated permanece listado sem fallback. Limite: FAIL real em dashboard-integration:87: scope.ts e port.ts seed removem milestone:p:undated:date antes de BI. |
| WP05.T04.CHK.04 | BLOCKED_EXTERNAL | U02 / P/D/H | C019, C086, C090, C097, C100 | Brush mantém ProductContext original/visualPeriod separado; BI01 chega ao C17 de página com ref e versão exatas. Limite: Faltam oito detalhes instalados com seleção e retorno/foco; página BI01 não certifica todos os destinos. |
| WP05.T04.CHK.05 | PARTIAL | U01 / D/H | C032, C034, C049, C083, C094, C097, C100 | Produtores reais preservam zero/ausente/restrição em projeções; componentes recusam promoção de ausência a número. Limite: Falta a mesma jornada renderizando restrição/ausência/parcialidade de todos os produtores em marca, tooltip e tabela. |
| WP05.T04.CHK.06 | BLOCKED_EXTERNAL | U08 / D/H | C002, C023, C032, C033, C049, C083, C100 | Ledger/matriz identificam cada produtor, caminho consumidor e os checks de composição ainda exigidos. Limite: WP10 não executou o catálogo completo; nenhum stub/fixture recebe classificação de integrado. |
| WP05.T04.CHK.18 | BLOCKED_EXTERNAL | U07 / D/H | C005, C008, C049, C089, C091, C100 | UI real no harness executa handler sob concessão; direto/reuso/revogação têm contraprovas. Limite: Igualdade de handler, resultado e versão entre UI/native/MCP não foi executada nas superfícies reais. |

### WP05.T05

| Critério | Estado | Consumidor / escopo | Casos S2 | Comprovado e limite restante |
|---|---|---|---|---|
| WP05.T05.DOD.01 | BLOCKED_EXTERNAL | U01 / P/D/H | C032, C033, C034, C049, C081, C083, C098, C099, C020 | Perguntas têm adapters e várias saídas reais; cenário/sensibilidade persistidos passam pelo consumidor. Limite: Onze perguntas não estão compostas; undated upstream e coverage pending impedem fechamento integrado. |
| WP05.T05.DOD.20 | PARTIAL | U03 / P/D | C081, C082, C098, C099, C097 | Bundle recebe coverage/result refs persistidos e componentes expõem as refs junto às apresentações. Limite: Falta abertura real das refs das marcas/tabela na composição instalada do caso. |
| WP05.T05.INV.01 | VERIFIED_SCOPED | U03 / P/D | C026, C027, C063, C066, C067, C081, C098, C099 | Geometria mantém resultados do motor, lacunas e qualificação; não interpola ausência nem estima probabilidade. Limite: O solver canônico direto não é apresentado como limiar exato quando o produtor integrado retorna sampled. |
| WP05.T05.INV.20 | VERIFIED_SCOPED | U03 / P/D | C062, C065, C069, C070, C081, C098, C099 | Coverage pending/ausente conserva total nulo e subtotal conhecido; não vira zero, completude ou residual. Limite: O BI evidencia, sem corrigir localmente, o bloqueio de categorização do seed WP11. |
| WP05.T05.QLT.01 | VERIFIED_SCOPED | U03 / P/D | C081, C097, C030, C096 | Unidades/sinais, horizonte, tabela, teclado e labels de decisão são preservados nos componentes exercitados. Limite: Escopo renderer Chromium e sensibilidade persistida no harness; não afirma navegação instalada completa. |
| WP05.T05.QLT.20 | VERIFIED_SCOPED | U03 / P/D | C062, C066, C081, C097, C098, C099 | Valor/limiar mantém rótulo conditioned e lista acessível mostra categorias pendentes sem quantificá-las. Limite: Saída real pending continua qualificada; não é promovida a resultado completo. |
| WP05.T05.CMP.01 | PARTIAL | U03 / P/D | C036, C058, C063, C066, C067, C068, C081, C098 | Casos cobrem ausência/incerteza, moeda, provenance e fronteira 55000 atingida versus 55001 ultrapassada. Limite: Faltam cenário real inviável e cada tipo de referência removida no consumidor integrado. |
| WP05.T05.CMP.20 | PARTIAL | U03 / P/D | C062, C064, C069, C099 | Omissão inteira de training fica pending; inclusão 40000 altera o subtotal e inverte a vantagem no motor real. Limite: Training zero confirmado versus null/fonte restrita e revisão no mesmo caso não estão demonstrados. |
| WP05.T05.SUC.01 | BLOCKED_EXTERNAL | U03 / P/D/H | C081, C097, C098, C099 | Apresentação identifica componentes/premissas e seus refs; o motor real mostra a inversão numérica. Limite: Falta abrir origem e retornar preservando o mesmo caso/ChoiceRecord no host instalado. |
| WP05.T05.SUC.20 | BLOCKED_EXTERNAL | U03 / P/D/H | C097, C099 | Training omitido/revisado é identificável e altera a comparação conhecida. Limite: Abertura da origem da categoria no mesmo contexto real do caso não foi executada. |
| WP05.T05.CHK.01 | PARTIAL | U03 / D | C098, C081 | Solver canônico retorna fronteira 55000; previews 55000 e 55001 comprovam o limite de vantagem 20000. Limite: Sensibilidade persistida permanece conditioned/sampled 40000–70000 e threshold null por coverage upstream; BI não exibe limiar exato admitido. |
| WP05.T05.CHK.02 | VERIFIED_SCOPED | U03 / P | C103 | Mudar só a data projetada move a linha temporal e conserva componentes/custos fornecidos, subtotal 30 e diferença 5. Limite: Contraprova de não-inferência do renderer; não executa lei financeira de datas no motor upstream. |
| WP05.T05.CHK.03 | PARTIAL | U03 / P/D | C081, C097, C098, C099, C100 | Componentes preservam valores/refs e sensibilidade usa os resultados persistidos autorizados. Limite: Browser de sensibilidade real verifica unidades/qualificação, sem comparar todos os valores de cada marca e linha da tabela. |
| WP05.T05.CHK.20 | PARTIAL | U03 / P/D | C099, C064, C097 | Motor real conserva training omitido como pending e calcula subtotais 210000→250000 e vantagem 30000→−10000 com training 40000. Limite: Totais completos continuam null; before/after usam stores distintos. Não prova a mesma revisão em gráfico/tabela nem ChoiceRecord humana imutável no mesmo caso. |

## Registro dos casos usados

Run único `43519544728` / job `132210062303`. A coluna linha refere-se ao log combinado baixado, não ao offset por step exibido pelo GitHub. Diretório base dos arquivos: `modules/sucafina/Sucafinav1/test/product/wp05/`.

| Evidência | Arquivo | Testcase efetivo | Resultado | Linha |
|---|---|---|---|---:|
| C001 | aging-browser.test.ts | unavailable ages remain in the selected population and retain request drilldown | PASS | 828 |
| C002 | approved-catalog.test.ts | catalog requires explicit valid host view definitions | PASS | 831 |
| C003 | approved-catalog.test.ts | resolution forwards only approved selection and preserves host references | PASS | 832 |
| C004 | approved-catalog.test.ts | resolution fails closed for unapproved inputs, changed authority, and missing host references | PASS | 833 |
| C005 | capability.test.ts | read requires current authorization before and after reading | PASS | 836 |
| C006 | capability.test.ts | read rejects a projection from a different principal or period | PASS | 837 |
| C007 | capability.test.ts | presentation rejects references absent from the authorized projection | PASS | 838 |
| C008 | capability.test.ts | descriptor refuses an unconsumed direct call before reading the domain | PASS | 839 |
| C009 | capability.test.ts | an unregistered view is explicitly unavailable | PASS | 840 |
| C010 | capability.test.ts | a receipt bound to another principal is denied before source access | PASS | 841 |
| C011 | capability.test.ts | a receipt for another input is denied before source access | PASS | 842 |
| C012 | capability.test.ts | a receipt from another UI request cannot read the projection | PASS | 843 |
| C014 | capability.test.ts | decision views require persisted decision metadata in the projection | PASS | 845 |
| C015 | contextual.test.ts | contextual BI preserves the complete DashboardReadRequest and rejects missing fields | PASS | 848 |
| C016 | contextual.test.ts | contextual selection passes host-owned refs and denies revoked authority | PASS | 849 |
| C017 | contextual.test.ts | host must verify references and cannot return a different principal or unlisted evidence | PASS | 850 |
| C018 | contextual.test.ts | stored contextual selection reopens both references and detects a changed human choice | PASS | 851 |
| C019 | contributions-browser.test.ts | contribution and capacity panels preserve signs, missing values, selection and focus | PASS | 871 |
| C020 | dashboard-integration.test.ts | authorized dashboard source reaches BI through the real UI dispatcher | FAIL | 1226 |
| C021 | dashboard.test.ts | dashboard adapter refuses metadata after the source version changes | PASS | 1229 |
| C023 | factory.test.ts | composition exposes the shared descriptor and rejects invalid or duplicate routes | PASS | 1233 |
| C024 | factory.test.ts | overlapping producer routes require a host selection and reject unregistered producers | PASS | 1234 |
| C025 | geometry.test.ts | geometry preserves missing values, observed zero, signs and the selected period | PASS | 1237 |
| C026 | geometry.test.ts | sensitivity never interpolates missing points | PASS | 1238 |
| C027 | geometry.test.ts | waterfall geometry uses supplied endpoints and leaves missing endpoints blank | PASS | 1239 |
| C029 | geometry.test.ts | temporal position preserves a missing month as space instead of interpolation | PASS | 1241 |
| C030 | geometry.test.ts | shared scale keeps equal values at equal positions | PASS | 1242 |
| C031 | milestones.test.ts | planned, confirmed and undated milestones remain distinct | PASS | 1245 |
| C032 | planner-integration.test.ts | real planner projection reaches BI with distinct missing and zero values | PASS | 1248 |
| C033 | planner-integration.test.ts | real planner comparison supplies the same reconciled waterfall to BI and dispatcher | PASS | 1249 |
| C034 | planner-integration.test.ts | real planner capacity presents aligned FTE and unavailable HR cost without invented values | PASS | 1250 |
| C035 | planner-projected.test.ts | planner-projected adapter forwards producer projection and detects a changed revision | PASS | 1253 |
| C036 | planner-projected.test.ts | planner-projected adapter refuses mixed currency or principal before presentation | PASS | 1254 |
| C049 | procurement-integration.test.ts | real procurement registry and port supply scoped BI stock and deny revoked access | PASS | 1273 |
| C050 | procurement.test.ts | aging uses producer values and preserves an unknown age and request reference | PASS | 1276 |
| C051 | procurement.test.ts | unknown request status is not asserted to be open | PASS | 1277 |
| C052 | procurement.test.ts | an aging row is refused when procurement-request evidence disagrees on version or record identity | PASS | 1278 |
| C053 | procurement.test.ts | an aging row is refused when its request drilldown names another incarnation | PASS | 1279 |
| C054 | procurement.test.ts | an aging row keeps every producer value when other evidence accompanies one request | PASS | 1280 |
| C055 | procurement.test.ts | stock snapshot preserves producer stage counts without inventing a conversion | PASS | 1281 |
| C056 | projection.test.ts | observation timestamps do not create stale data, while source and value changes do | PASS | 1284 |
| C058 | projection.test.ts | sensitivity requires its paired persisted reference | PASS | 1286 |
| C059 | review-chart.test.ts | review capture keeps producer values, endpoints and reconciliation without residuals | PASS | 1289 |
| C060 | review-chart.test.ts | review capture rejects dangling series and does not promote absent values | PASS | 1290 |
| C062 | scenario.test.ts | conditioned results retain missing category and never invent a total | PASS | 1294 |
| C063 | scenario.test.ts | sensitivity leaves missing and nonfinite results as gaps | PASS | 1295 |
| C064 | scenario.test.ts | a later resolved revision changes displayed totals without mutating the earlier snapshot | PASS | 1296 |
| C065 | scenario.test.ts | an inconsistent complete comparison cannot promote a conditioned result | PASS | 1297 |
| C066 | scenario.test.ts | sampled sensitivity never claims an exact threshold | PASS | 1298 |
| C067 | scenario.test.ts | an exact threshold requires matching finite engine evidence | PASS | 1299 |
| C068 | scenario.test.ts | missing sensitivity provenance cannot be presented as complete | PASS | 1300 |
| C069 | scenario.test.ts | a result claiming completeness with an absent component cannot display a full total | PASS | 1301 |
| C070 | scenario.test.ts | a comparison without coverage references cannot be displayed as complete | PASS | 1302 |
| C071 | selection.test.ts | selection retains authorized context, source, projection version and zero | PASS | 1305 |
| C072 | selection.test.ts | a numeric placeholder marked absent is not displayed as observed zero | PASS | 1306 |
| C073 | semantics.test.ts | producer supplies roles, unresolved values remain visible and no months are inferred | PASS | 1309 |
| C074 | semantics.test.ts | rejects unknown references and mixed currencies in one series | PASS | 1310 |
| C075 | semantics.test.ts | alignment keys must uniquely identify every provided value | PASS | 1311 |
| C076 | semantics.test.ts | annual and monthly financial points cannot be blended into one series | PASS | 1312 |
| C077 | semantics.test.ts | a producer cannot relabel a currency as another currency | PASS | 1313 |
| C081 | sensitivity-integration.test.ts | BI consumes the persisted Planner sensitivity and rejects a changed criterion | PASS | 1336 |
| C082 | stored-scenario.test.ts | stored scenario and comparison flow through one C08 projection and fail after revocation | PASS | 1339 |
| C083 | tickets-integration.test.ts | real Dashboard ticket observations reach BI with source evidence and deny changed selection or revoked authority | PASS | 1342 |
| C084 | tickets.test.ts | ticket snapshot remains a snapshot and preserves missing values | PASS | 1345 |
| C085 | tickets.test.ts | ticket history requires producer supplied dated aggregates | PASS | 1346 |
| C086 | view-browser.test.ts | chart and equivalent table preserve selection through keyboard and period brush | PASS | 1366 |
| C087 | waterfall.test.ts | projected endpoints reconcile without inventing a residual | PASS | 1369 |
| C088 | waterfall.test.ts | the producer must attest financial reconciliation | PASS | 1370 |
| C089 | consumer.test.ts | consumer goes through the real UI lease and dispatcher, rejects direct calls and reuse | PASS | 1373 |
| C090 | consumer.test.ts | exact mark destination revalidates identity, version and C17 evidence without a collection fallback | PASS | 1374 |
| C091 | consumer.test.ts | checked projections are detached from callback mutation and access is fenced at egress | PASS | 1375 |
| C092 | consumer.test.ts | a new projection between dispatch and presentation is stale | PASS | 1376 |
| C093 | factory-selection.test.ts | producer selection cannot switch between read and revalidation in one bound call | PASS | 1379 |
| C094 | projection-validation.test.ts | absent evidence cannot affect geometry even when its numeric field remains populated | PASS | 1382 |
| C096 | projection-validation.test.ts | waterfall retains supplied endpoints and refuses incompatible context instead of relabelling it | PASS | 1384 |
| C097 | render-completion-browser.test.ts | BI components preserve endpoints, undated rows and unknown ages through keyboard navigation | PASS | 1387 |
| C098 | engine-coverage.test.ts | Planner's canonical known-subtotal solver proves the 55000 boundary; its integrated sensitivity still discloses pending coverage | PASS | 1390 |
| C099 | engine-coverage.test.ts | real Planner results retain omitted training as unknown, then include its 40000 source without mutating the original result | PASS | 1391 |
| C100 | consumer-dashboard.test.ts | C02 consumer and table reopen the authorized C17 page and reject changed sources and revoked roles | PASS | 1394 |
| C101 | semantic-discriminants.test.ts | Top N stays partial; a producer-supplied other group preserves its contribution and C17 component references | PASS | 1397 |
| C102 | semantic-discriminants.test.ts | changing only current ticket status cannot rewrite supplied opening and closing periods | PASS | 1398 |
| C103 | semantic-discriminants.test.ts | a projected date change moves the timeline but cannot create savings or remove supplied obligations | PASS | 1399 |

## Artefatos e proveniência

- `traceability-final.json`: requisitos completos, 108 decisões, paths verificados, consumidores, discriminantes, 34 arquivos selecionados e 103 casos do run.
- `dependency-ledger.md` e `external-dependencies.json`: inventário de 20 arquivos externos com pins/paths/blobs; ownership não foi alterado pelo revisor.
- `wp10-bi-http.patch`: delta proposto para o consumidor comum; não foi aplicado ao código estrangeiro e não prova instalação.
- `../ci-evidence/test2-summary.json`, `../ci-evidence/snapshot2-equality.json`, `../ci-evidence/check2-triage.json` e `../ci-evidence/check3-triage.json`: recibos de execução/identidade usados nesta avaliação.
