# WP09 — retomada de colaboração

O incremento próprio foi publicado em `collab-resume`, PR [#41](https://github.com/gustavomhss/Orchestra-SF/pull/41), preservando [#33](https://github.com/gustavomhss/Orchestra-SF/pull/33) como origem. Produto deste recibo: **`ff557552936197b6734e57f0ecea0c44b19139b1`**, tree **`0349fb1b18315a9c7c0cadb04b738ea499beda05`**. O trabalho próprio ainda não declara WP09 concluído nem execução Relay nativa comprovada.

## O que mudou

`createRoutineSchedule` agora fixa por invocação a identidade e os métodos dos providers usados para owner, autorização, recorrência, C08, ocorrência e resultado. Antes/depois de cada await, recusa uma troca que poderia misturar a autorização de uma origem com o efeito ou resultado de outra. A captura explícita aceita métodos de prototype e preserva seu receiver. Clones, controle de versão e chaves idempotentes existentes continuam no mesmo caminho. A recusa após um efeito não promete rollback: entrega indisponibilidade e conserva a identidade original para recuperação pelo produtor.

Nove casos novos discriminam substituição do authorizer em duas entradas, troca do scheduler, troca do objeto de ocorrência, troca de método no mesmo objeto, troca após dispatch, troca do leitor de resultado, alteração durante listagem e compatibilidade com métodos de classe. Os dois arquivos publicados são `product/routines/schedule.ts` e `test/product/wp09/schedule-boundaries.test.ts`; preimages/postimages exatos estão em [source-reconciliation.json](source-reconciliation.json).

## Trabalho de origem reaproveitado

A PR #30 permanece ancestral: head `1998acb0dcb59e68d41ee924eca4737bccbd5148`, produto `a3dcbb62c88231f95a7c57afb32e975404a3b59c`. O compare até o head inicial `2784daafbb0d3b58b6019822288a07fa38e5c5b0` registra 36 commits à frente, zero atrás. Não houve cópia integral da árvore nem reimplementação das receitas, factory, resultado autenticado, preparadores ou consumidores existentes.

A origem #33 acrescentou revisão autenticada com snapshot completo da pauta, consumidores de confirmação/documento, pinagem nativa de Schedule e outros reforços de fronteira. O inventário registra os 20 arquivos de produto e 36 arquivos de teste WP09 no head inicial, os blobs e os paths próprios alterados desde #30. Os recibos antigos continuam no SHA efetivamente executado.

## Mapa completo, sem redução de escopo

[criteria-112.json](criteria-112.json) conserva os **112 IDs e textos canônicos**, as sete tasks com seu trabalho/entradas/saídas/dependências, os paths de implementação/consumo/testes, provas anteriores, suporte atual e próxima ação por critério. Os IDs e textos foram comparados documentalmente com o pack imutável, sem execução de testes de produto.

| Escopo | Critérios | Suporte histórico preservado | Parcial | Bloqueio externo |
|---|---:|---:|---:|---:|
| WP09 transversal | 22 | 8 | 4 | 10 |
| T01 — ciclo de rotina | 22 | 8 | 2 | 12 |
| T02 — preparação de revisão | 11 | 6 | 3 | 2 |
| T03 — revisão de forecast | 11 | 8 | 1 | 2 |
| T04 — dossiê de sourcing | 14 | 12 | 0 | 2 |
| T05 — encaminhamentos | 8 | 6 | 0 | 2 |
| T06 — recorrência | 16 | 4 | 6 | 6 |
| T07 — análise/continuação de decisão | 8 | 1 | 3 | 4 |
| **Total** | **112** | **53** | **19** | **40** |

“Suporte histórico preservado” retém a qualificação cirúrgica original no produto `a3dcbb`; não a renomeia como green de todo o candidato novo. Evidência posterior é ligada por caso e mantém seus limites. Os 40 critérios externos exigem testemunhos de integração nativa, residente, UI ou rotas reais; os 19 parciais mantêm suas lacunas descritas.

## CI e evidência

Todos os recibos e seleções estão em [evidence.json](evidence.json). Nenhum teste de produto foi executado localmente.

| Evidência | Produto W / snapshot S | Run / job | Resultado e limite |
|---|---|---|---|
| Histórico WP09 | W `a3dcbb62` / S `000761d8` | [43540247856](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43540247856) / `132278872428` | 175 PASS, 0 FAIL, 31 arquivos; prova original preservada |
| Schedule nativo herdado | W `ea5a6f96` / S `c03b06be` | [43584357490](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584357490) / `132415569882` | `schedule-native.test.ts`: 22 PASS. Run agregado falhou em outros WPs. Schedule/SessionInput reais; executor de provider explicitamente substituído |
| Revisão WP09 no W07 | W `2784daaf` / S `528ef232` | [43586213509](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586213509) / `132421137142` | 29 PASS em `review-result` + 1 PASS em `review-product-consumer`. Run agregado: 56 PASS, 2 FAIL WP07. Sem `schedule-result-consumer` nessa seleção |
| Novo delta Schedule | W `ff557552` / S `6f73befe` | [43615514065](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43615514065) / `132509571848` | **42 PASS, 0 FAIL, 111 assertions, 3 arquivos**, 152 ms; controle Omni não aplicável, zero spawns |

O compare completo CI04 → `2784` não muda `schedule-native`, seu teste, runtime/core, contratos, configuração ou fixture de autoridade usados por esse arquivo. O incremento `ff557552` modifica o adapter distinto `schedule.ts`, não importado por esse teste. A prova de Schedule foi reanexada sem rerun duplicado. A troca `review-result.ts` da origem posterior é coberta pelos 29 casos observados no W07.

O typecheck histórico `43540252662` falhou com 78 diagnósticos, zero próprios; seus guards passaram. O check inicial da retomada `43586229183` também falhou e deve ser lido no recibo consolidado do root. Nenhum desses checks é apresentado como green do novo head. A conclusão do novo run foi conferida pelo root; os checks estáticos do candidato são anexados no recibo consolidado final. O timeout WP06 `43540684025` permanece como evidência histórica de falha, sem rerun por WP09.

## Avanços externos reconciliados

Finance `88b9b6bff53a4f64d37d04ddc868f1443cecf5b3` atualizou o CasePort para blob `d43849ba101000eb9eb2a6ddc9a04830b004ccc6`. O método `verifyScenarioOperations` continua obrigatório e é chamado antes da devolução de evidência/acesso do caso. Quando o owner compuser essa API, o consumidor de decisão WP09 deverá receber o verificador real; o incremento atual não inclui fonte financeira nem callback permissivo.

WP12 avançou até `812f8427423dc143cefc2731edc3485eeb8d1f04` com 46 documentos e um teste, sem alteração de implementação. O run `43615955284` já terminou: **2 PASS, 1 FAIL, 446 asserts**. Há PASS delimitado para revisão/relatório/download UI e para Meu Trabalho executivo com reabertura e recusa após remoção; a pergunta Meu Trabalho falhou por timeout. Os logs registram sete catálogos vazios, quatro missões indisponíveis e zero inferência/saída/consumidor nativo. C07, histórico positivo após remoção, rollover e ACL independente de destinatário continuam sem witness suficiente. O caminho público Procurement existe; a dependência `workSignals` é específica da seleção por caso.

Os pins, títulos, blobs e limites estão em [evidence.json](evidence.json) e [owner-deltas.md](owner-deltas.md). Nenhum dos 112 critérios foi promovido por esses avanços externos.

## Pendências reais e próxima ação

[owner-deltas.md](owner-deltas.md) delimita cinco grupos de ação. No host WP10 atual inspecionado, a factory `createSfRoutineServices` já existe, mas a composição não instala `SfRoutineNativePort` e os verificadores de análise ainda recusam saídas de rotina. A próxima integração deve preencher esse hook real e consumir resultado autenticado nas superfícies responsáveis. Não se pede reconstrução da factory.

Continuam necessários o encadeamento C07/Relay real, resultado/arquivo autenticado sob revogação, witness residente com skill e concessão, ligação da ocorrência ao principal/admissão atuais e continuação da decisão com outro run. Metadados de última atualização material e reclassificação de forecast permanecem dependências explícitas do produtor, sem inferir dados ausentes.

S0 deve revisar a PR #41 e os checks do SHA entregue, reconciliar deltas delimitados de owners externos e qualificar os percursos integrados. PRs antigas permanecem abertas; este recibo não autoriza merge nem transforma publicação, prompt durável ou fixture em execução nativa.
