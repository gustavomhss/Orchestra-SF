# Reconciliação externa atual — WP03/WP05/WP11

A inspeção externa fica fixada em **Compose `ed10a3806a4ffdf6ad5891e2065d93a4c91412cf`**, tree `57ce597f3ebe8ddb543f9d71d34d20f789c76e33`, e **Interface `cccd00c568aea65bb0c1b5cb4a82c2a236c7e775`**, tree `b33c50679fa6c2a36a0e309064e1fa57ee4b0a0e`. O avanço observado **Interface `4bd1f807e449d040e3db61c4d2b1e177b205ac69`**, tree `2459923b94c080688a31a1138e73ddf30c5be744`, foi examinado somente quanto aos namespaces pertinentes e aos três arquivos mensais. Seu intake amplo de Collaboration não recebe aceitação nesta revisão.

O [refresh independente congelado](reviews/latest-external-refresh.md), observado em **2026-11-14 11:39:51 UTC**, contém as leituras GitHub MCP das fontes, compares e logs concluídos dos owners; seu [JSON](reviews/latest-external-refresh.json) fixa 36 pins, requests, W/S, jobs e limites. Esta consolidação leu esses recibos e os metadados publicados pelo coordenador; **não repetiu consultas remotas, execução de produto ou CI**. O [JSON central](external-reconciliation.json) conserva integralmente a inspeção anterior, inclusive o Markdown anterior, sob `historicalInspections`. Nada no histórico é atribuído retroativamente aos novos heads.

O pin Finance observado no fechamento é **W26 `0c4a2545a63b4903c7eedb00d3f0989eb74ed398`**, tree **`8325d52877c8fdd5bf317b244b81b0bb45736fce`**, conforme o ledger de publicação do coordenador. A [reconciliação remota](remote-reconciliation.json) distingue fonte consumida, fonte apenas inspecionada e integração ainda pendente. Não há declaração READY/DONE, aceite nativo, C/D ou aceite do bundle.

## PR40 consumida; commits de origem preservados

W25 **`c99d6dfb4f443b8f626010e78276874ae842f370`**, tree **`d6f28f45ac55c5d345b0694d02441849a2cf27d7`**, consumiu a [PR40 em `65509f0b8c435b88fb0ec9949299571f011d2347`](https://github.com/gustavomhss/Orchestra-SF/tree/65509f0b8c435b88fb0ec9949299571f011d2347) como parent adicional. Os commits novos `a12f29ce64018740a1c1a1135daa3fb0e37770de` e `65509f0b8c435b88fb0ec9949299571f011d2347` permanecem na ancestralidade, somando **41 commits de origem únicos**, com PR22/PR24 inalteradas nos heads já consumidos. Foram reconciliados 29 paths: seis arquivos próprios adotados exatamente, cinco já idênticos e 18 novos recibos históricos preservados sem transferência de qualificação. [Manifesto integral do intake](intake-reconciliation-pr40-final-65509.md).

Os três produtores Planner e os dois arquivos de batching já correspondiam aos blobs Finance. W25 conserva o calendário explícito da fonte de treinamento, com novembro 40000 e os demais meses 0, sem converter ausência em zero no produto. O novo Hot Topic captura o pedido e, após os últimos callbacks, relê caso, draft histórico e draft ativo em uma observação C08 conjunta. O novo `mutations.ts` difere da correção Finance anterior apenas no comentário: obter `entries` e reassessar pelo produtor canônico continua obrigatório mesmo quando a assessment anterior coincide.

## BI: seleção inversa e navegação já implementadas; execução delimitada pendente

O finding antigo **“`advantageComparisonRef` ausente” está superado**. [Compose ed10](https://github.com/gustavomhss/Orchestra-SF/tree/ed10a3806a4ffdf6ad5891e2065d93a4c91412cf) contém:

| Consumidor | Blob |
| --- | --- |
| `bi-selections.ts` | `3e1d2ec43831e689c19c5178a0ff370e60001e40` |
| `bi-services.ts` | `f2f25da7875267f722d88cfa36820b5daa6c6c74` |
| `extended-bi-options.ts` | `865eb0ca54fce9dd9c85ea227b0bc6e947f9e170` |

O parser corresponde à proposta delimitada; o host adiciona igualdade integral dos quatro refs, vínculo à Request e ao binding, proteção contra mutação dos inputs e revalidação após awaits. As opções apresentam comparações inversas **já persistidas**, do mesmo caso e com endpoints exatamente invertidos. Cada seleção exige escolha humana. Nenhum “primeiro/mais recente” é escolhido automaticamente e nenhuma diferença financeira é recalculada pelo BI. O limite operacional de 300 escolhas não altera qualquer threshold financeiro aprovado.

O fluxo real agora liga browser → HTTP `bi-decision` → nova admissão/dispatch C16 → caso escolhido → leitores canônicos de resultado/cobertura/pergunta/caso/BCS. Os seis destinos usam pertença à projeção exata e releitura antes da entrega. Origem/evidência exige identidade física única, `currentRef` e estado fresh. Voltar restaura foco depois de opções e dados reautorizados; logout, revogação e pagehide removem dados privados e abortam leituras; BFCache exige reabertura. [Pins e análise dos consumidores](reviews/latest-external-refresh.md).

Os novos `bi-advantage-selection.test.ts` e `bi-decision-navigation.test.ts` **não integram a seleção de 18 arquivos** do run Compose observado. O check do head registra **TS2345 em `wp10/integration/bi-advantage-selection.test.ts:116:104`**, onde `TrustedDomainContext` é passado a uma API que exige `TrustedUiContext`. O owner deve corrigir essa tipagem e validar os novos consumidores no composto exato. O host continua anunciando `decision-bi-waterfall-plan-unavailable` e `decision-bi-timeline-plan-unavailable`; os callbacks de navegação não fecham os planos canônicos BI09/BI10. Destinos físicos, retorno/foco e jornada instalada continuam sem aceitação completa.

## Planner mensal: proposta de três arquivos ainda não adotada

Os três blobs do [delta mensal delimitado](../../WP03/finance-20261114/monthly-consumer-proposal.diff.txt) permanecem iguais em Compose ed10, Interface cccd e no drift relevante Interface 4bd1:

| Arquivo relativo ao package | Blob |
| --- | --- |
| `product/contracts/host-context.ts` | `920fda293db553096f4d8ab7004fcd9652a69291` |
| `product/interface/planner-http.ts` | `2befb1d4c7964b30830311abe1c93c7c575b8f70` |
| `product/ui/planner-monthly.ts` | `3adef2d68f54f2e04f9532751f5ddc9bed7e4b60` |

O owner precisa reconciliar antes/depois canônicos, annual/spread/reset, rebase explícito e retenção de body/key quando a resposta é incerta. O HTTP real é `product/interface/planner-http.ts`. Os dois casos mensais aprovados no run antigo W10c não provam esse delta ainda ausente, nem substituem as jornadas completas mensal/HR/catálogos/comparações e concorrência entre operadores.

## C17: preservar o caminho histórico delimitado e seus limites

O finding genérico “falta leitor histórico” está superado. Os quatro blobs C17 são idênticos ao COMPOSE6: `planner-calculation-history.ts` `9805676b50cb5d12f37a4a91350f01ba227a168f`, `planner-calculation-services.ts` `bc224c0b2830fe54a02c3b2bc356cb6bf2b1c327`, `business-services.ts` `4b02413b5a98e750187fa8f5fa54f3cb2415f4e3` e `product/host-binding/business-context.ts` `5cca27ce239c92a8e3c9f9f92f816f5224562904`. Há readers históricos explícitos, seleção pelo ledger persistido, replay do request canônico e comparação de uma captura Atlas protegida anterior. A referência original continua histórica depois de avanço apenas do caso; não se torna observação corrente ou permissão de escrita. Os escopos por chamada e as observações finais de fonte/Request/binding permanecem. [Análise e fontes exatas](reviews/latest-external-refresh.md).

Permanecem sem qualificação a primeira captura Atlas somente **depois** do avanço, sem capture protegido anterior; ancestry aninhado/misto; assumptions, mudança material e substituição de refs. A closure record-only/prior-capture não cobre essas condições. Os stores externos ainda anteriores devem ser compostos com as cercas Finance atuais. O run Compose estava em andamento no instante observado; presença estática não equivale a sucesso de BCS/Atlas/HTTP instalado, sessão residente, C/D ou epic.

## Threshold e N/A/shared exigem provas distintas

A inspeção anterior dos quatro produtores WP13 permanece no histórico; o compare completo 35b9→ed10 não altera esses paths. O delta principal `parameterOperation`, fronteira canônica, observação adjacente IEEE, escopo de subtotal conhecido e validator comum de writer/replay já existe no owner. O patch COMPOSE4 continua histórico. Ainda é necessário demonstrar **55000/15000 persistidos e reproduzidos** no candidato composto, preservando training omitido/40000/zero/null, moeda/FX, metadata e fonte.

`portfolio-coverage.ts` **`d8a668281ea9cac6a3a04c6bea19811ee8954808`** continua recusando toda baseline com `status === "not-applicable"`. A correção de promoção Finance não remove esse gate. O owner precisa demonstrar a rota de classificação humana e a prova canônica de aplicabilidade; categorias compartilhadas all-inclusive não comprovam essa rota. Não apagar N/A, fabricar shared, deduzir zero de ausência ou relaxar autorização.

## Preservar os pins Finance mais novos na integração

Compose ed10 ainda fixa Finance `6016a70` e WP11 `11261a57` em seu intake. Esses snapshots antecedem as cercas finais e as correções próprias posteriores.

| Fonte própria | Blob a preservar | Blob Compose observado |
| --- | --- | --- |
| `decisions/apply.ts` | `964a53310c340f4496d7410d66f8b852270b75f1` | `229e64c2d8109b413a7667bbe1b208ffa3ab0a73` |
| `decisions/result-store.ts` | `bc32bfb39e8b6012230ee0d136bed142340e5d89` | `d7d8eb3ca267551797b191ccfb1d037149757898` |
| `decisions/scenario-request-store.ts` | `368a7f2e207c4f551ac3c6f77424797c97f794f3` | `0d677d2d0b3a9df7127f13b25fe3968757f0dceb` |
| `decisions/mutations.ts` | `e0840d775274ea73c6b938711764c69593dadca0` | `922358d17c470c16b43076510bdf04744e2306e4` |
| `decisions/hot-topic-draft.ts` | `d8a151c558227b3bd2612dbb6caba993efa85783` | `dc480a2e1e343e7f2a8844a3c23ec9f06582d5ad` |
| `analytics/decision-view.ts` | `bb4e49ccf5eb0ea8957400322fb3a75e8e2ce5f8` | Correção SVG Finance posterior ao intake |

O apply conserva tentativa durável, CAS renovado depois do domínio, cópias das observações, releitura autoritativa do receipt e cercas de receipt/proof/unicidade na transação e no retry. Os **nove casos** de `execution-reconciliation.test.ts` passaram no [S12, run 43587138878](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43587138878), W `92f6d97`, S `0faf62c7`; **o run inteiro falhou: 17 pass / 5 fail**. Essa prova limitada não se transfere a outra tree nem prova aplicação real de domínio em host instalado.

No [S14, run 43589528126](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43589528126), W `cfbf7c8` / S `ee532360`, passaram os sete casos de aquisição/reassessment de cobertura e o caso da superfície Dashboard de Hot Topic. **O run inteiro falhou: 22 pass / 5 fail**. Os novos seis casos de snapshot e seis de proof de W25 são incrementos distintos; nenhum resultado anterior os aprova. Promoção de alternativa, rascunho e simulação continuam distintos de ChoiceRecord aplicado e persistido.

## Procurement: consumir a closure canônica publicada

A falha S12 ocorre antes do primeiro comando cross-domain: o issuer Finance inclui `approvalStage`, mas o antigo projector de integração usa outro inventário de campos. O owner já publicou a delegação canônica, sem mudança desde COMPOSE6:

| Arquivo relativo a `product/` | Blob |
| --- | --- |
| `integration/procurement-projections.ts` | `3e8830c3dddc8b9609f583f877b2fe7458eccd28` |
| `procurement/source-projection.ts` | `ab9814817d11c0b477636ee54d1b2763d365f405` |
| `procurement/confirmation-fields.ts` | `a1e45e803105e76f147e695a7e92246257de9b16` |
| `procurement/monetary.ts` | `5ed7b1c7e8f140c2820d9e3095a7427374d10f69` |

O [recibo de dependências](procurement-projection-dependency.md) delimita o fechamento. A integração deve consumir esses bytes canônicos e executar os casos afetados de aplicação, receipt, recuperação e replay. Finance não reproduz fórmula, política financeira ou autorização do produtor e não introduz projector especial de fixture.

## Resultados externos: manter W/S e observação temporal

| Evidência | Resultado no pin observado |
| --- | --- |
| [Compose produto 43589763353](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43589763353), job 132431793223; W ed10, S `564d04391d009b89718b10e67175d710d9e6b9c9` | Em andamento às 11:39:51 UTC; 18 arquivos. Nenhuma contagem ou conclusão inferida. |
| [Compose check 43589766495](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43589766495), job 132431802351; W ed10, S `83c2c898fa9fc0be57afd2cb4cd6a95269c4e8ce` | **FAIL**, 15 TS, 0 nos namespaces Finance; inclui a tipagem do novo teste BI. CLI/Atlas/geração/spawn/guards passaram. |
| [Interface produto 43589003673](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43589003673), job 132429524784; W cccd, S `d9db098201c0362bea0f0ff1611d0e5816908f73` | **36 PASS / 1 FAIL**, 635 assertions, 97,63 s. Captura na página original e primeira estabilidade financeira passaram; C05 após mudança canônica ainda 403 `access-unavailable`, esperado 200. |
| [Interface check 43589005251](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43589005251), job 132429529927; W/head cccd | **PASS** nos dois typechecks e guards: 78 regras, 750 paths, 37 warnings, 0 errors. |

O refresh independente verificou W/S dos dois runs de produto: exatamente um commit, somente `.ci-run.json`. O browser Interface registra Omni PASS, um spawn, zero delegações e harness físico Node/Chrome. Isso prova a execução Actions descrita, sem aceitar a jornada instalada/residente completa. O novo renderer My work é passivo, com testes de metadata e escaping aprovados nesse pin; mostrar um pin não concede leitura ou aplicação. C05 permanece aberto, assim como a prova C12 de aplicação persistida, reabertura e retry sem novo efeito. Os runs Interface 4bd1 foram registrados apenas como metadados em andamento no momento observado.

Finance S14 e S15 são falhos nos recibos do coordenador. Segundo a atualização do coordenador recebida por esta consolidação, S16 e S17 foram submetidos e ainda não tinham conclusão atribuída; nenhum resultado é inferido aqui. Os resultados posteriores pertencem a `product-tests.json` e ao handoff do coordenador, que conservam W/S e a seleção exata. S0 mantém a revisão/integração, as provas nativas, revisões finais independentes, C/G7, D/G8 e o epic de todo o bundle.
