# WP00 — compatibilidade do baseline histórico

**Estado: revisão de fonte; baseline temporal NÃO_EXECUTADO.** Nenhum teste, servidor, alteração de runtime ou publicação foi feito nesta investigação. Não há aceite de desempenho ou afirmação de impossibilidade universal.

Referência B: `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`. A árvore do módulo histórico foi inspecionada integralmente: `d7a1e895945e8fe39ff4968229bc79d16ced24d0`, 133 entradas, sem truncamento.

## Instalação histórica e primeiro impedimento

A [fábrica histórica](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/local/entry.ts), linhas 28–78, verifica configuração e isolamento, abre `business-local`, cria identidade de operador, inicia jobs e compõe `createModule`. Não chama `createHostRuntime` ou `createResidentAiBundle`. **A falha C15 observada no candidato não explica a ausência de medição de B.**

[Enrollment](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/local/enroll.ts) e [SQLite](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/runtime/local-store.ts) são implementações reais. Os campos de snapshot e a assinatura `transaction(surface, work)` usados pelo preparo atual existem em B. O corpus sintético pode ser preparado por esse adapter sem dados privados; compatibilidade de fonte não equivale a preparo executado.

O **CLI do próprio B não oferece o loader necessário**:

- [commands.ts:492–502](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/apps/cli/src/commands/commands.ts) não declara `serve --installation`.
- [serve.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/apps/cli/src/commands/handlers/serve.ts) não carrega a fábrica local.
- [host.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/apps/cli/src/host.ts) compõe Maestro, Continuity, ClaudeCode e Dock, sem Sucafina. O diretório de binding `apps/cli/src/sucafina-product` usado pelo candidato não fornece seus loaders nesse SHA.

O [start.command histórico](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/local/start.command) recebe um checkout externo Orchestra e executa o CLI desse checkout com `--installation`. Também seleciona artefatos Omni Darwin. O [README](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/local/README.md) nomeia `orchestra-local-installation`, mas não fornece seu commit. Para reproduzir essa montagem, falta identificar e pinar o host compatível, verificar seu loader e declarar os artefatos/runtime usados. O launcher Mac não é, por si só, um launcher Linux qualificado.

## O protocolo de CI existe

B já contém [test-ci.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/script/test-ci.ts), [validador](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/script/test-ci-request.ts) e [workflow](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/.github/workflows/test-ci.yml). Eles admitem package `app`, runner Playwright, configuração de produção e specs explícitos; o workflow instala Chromium. O uploader confere a árvore e cria S com um único pai W.

É possível estruturar S histórico sobre W histórico com harness/fixtures próprios, sem modificar `test-ci.yml`. Isso não acrescenta o loader ausente. Portanto o protocolo W/S não é o bloqueio, e repetir o comando CLI atual sobre B não produziria a interface.

## Compatibilidade dos sete fluxos

A tabela descreve fonte e oportunidade, sem observações temporais:

| Fluxo atual | Compatibilidade com B |
| --- | --- |
| `dashboard-budget-filter` | Filtro e totais existem; gráfico/tabela históricos representam flat /12 e têm labels diferentes. A conclusão atual de orçamento mensal efetivo não é o mesmo resultado. |
| `procurement-volume-open` | A tabela de requisições existe. A célula histórica imprime somente o número, sem `USD`; o locator atual não corresponde ao HTML antigo. |
| `planner-scenario-compare` | **Oportunidade concreta.** Controles de seleção/comparação, métricas e identidades de versões existem. Corpus compatível em forma; requer execução no host declarado. |
| `procurement-sourcing-rank` | Existem campos e seleção de propostas; não existe a tabela atual de FX, scores e rank exigida pelo fluxo. |
| `report-search-docx` | **Oportunidade concreta.** All Projects gera um bullet por registro e o Word script conserva todos. Não há corte em 12 nesse caminho. |
| `report-search-pptx` | O renderer histórico corta tabela/bullets em 12. O resultado exigido de 100 nomes não pode passar honestamente. |
| `import-preview-exact-reimport` | Há imports legados; não há o painel, endpoints e manifestos C04 atuais. A árvore histórica não contém `product/`. |

Fontes dos outcomes: [Dashboard](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/runtime/dashboard-budget.ts), [Planner](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/runtime/planner.ts), [Procurement](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/runtime/procurement.ts), [relatórios](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/runtime/reports.ts), [Word](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/src/surfaces.ts) e [imports legados](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/runtime/application.ts).

A matriz atual não é integralmente comparável. Não remover assertions ou mudar outcomes silenciosamente para obter 30 sucessos. Uma medição isolada de Planner/DOCX pode ser útil, com escopo declarado; não substitui as 42 configurações.

## Composição host W8 + módulo B

**Tecnicamente possível por análise de assinatura, ainda NÃO_EXECUTADA.** O [loader do host candidato em `d456bdd9cb4c8d921648b8c885d49cf71e592402`](https://github.com/gustavomhss/Orchestra-SF/blob/d456bdd9cb4c8d921648b8c885d49cf71e592402/apps/cli/src/sucafina-product/installation.ts), blob `30ffcb8353cdf478808fbb8d6bc67b48b10a6109`, chama a fábrica com `{ origin, createHostRuntime }`. A fábrica histórica aceita `origin` e não utiliza o segundo campo. Isso não modifica C15 do candidato.

Essa composição tem **dupla proveniência**, não é o checkout exato B. Antes de usá-la como referência, deve-se preservar/verificar o módulo B com todos os imports transitivos, dependências e artefatos; registrar host SHA, módulo SHA/tree, harness e snapshot S; demonstrar isolamento sem sobrescrever o runtime candidato; e estabelecer corpus, ambiente, método e outcomes comparáveis. O recibo atual de um único `productCommit` não descreve sozinho essa composição. Não substituir o baseline exato nem declarar aceite antes dessas verificações.

As fixtures browser históricas não resolvem isso: [local-browser.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/test/fixture/local-browser.ts) usa scanner simulado e Chrome direto; [operator-browser.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/test/operator-browser.test.ts) usa identidade/SQLite reais, mas monta Bun.serve, lança Chrome diretamente e não contém matriz ou medições. Não foram executadas nem propostas como substitutas.

O [protocolo de medição](../../../product-campaign/wp00/oracles/measurement-protocol.md) continua aplicável: baseline não medido, comparação indisponível e nenhuma regressão, melhoria ou aceitação inferida.
