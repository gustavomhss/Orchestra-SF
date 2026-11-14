# WP10 / PR59 — alcance do gate financeiro

**Revisão estática de W28 `90f2c4f81f74edc26a1783bfda7891638b429fa6`.** Fontes consultadas pelo GitHub MCP. Nenhum teste de produto, typecheck ou run novo foi executado nesta análise.

## Conclusão

Os três arquivos financeiros propostos não executam o mecanismo alterado por PR59. Seus números são calculados pelos produtores Planner reais, mas os seletores de fonte vêm de implementações explícitas de `PlannerSourceHost` nas fixtures. Essas implementações não passam por `createSfPlannerSourceHost` nem por `readScopedSourcePrepared`.

Assim, repetir esses três arquivos não discrimina a hipótese de reduzir quatro envelopes de transação de fonte para dois. Eles permanecem pendências financeiras globais, com seus requests e resultados anteriores preservados. Não recebem PASS nem são removidos da matriz.

O teste próprio `portfolio-exact-threshold.test.ts` atravessa os dois arquivos alterados e constitui o corte longo com hipótese nova, depois dos gates curtos de observação e fences aprovados. Seus budgets de **285.000 ms cooperativos / 300.000 ms externos** devem permanecer intactos.

## Arquivos alterados e mecanismo

Todos os paths abaixo, salvo os de CLI, são relativos a `modules/sucafina/Sucafinav1/`.

| Arquivo | Blob W27 | Blob W28 |
|---|---|---|
| `product/integration/source-lifecycle.ts` | `65867a3e6aa9b5b85266bb637fb22cf1c6c6d539` | `d43a630254142bc5e5fb3589d1120a328abf2d1c` |
| `product/integration/planner-sources.ts` | `6230f22e7dd66fec1103f28cc9a7937b2dca1449` | `02d75207b2978cc5c05368cc7e3517efeb3ce3ce` |

`createSfSourcePersistence` acrescenta a capacidade opcional `readScopedSourcePrepared`: preparação sobre clone do snapshot e o kernel existente de observação dividem um envelope. `createSfPlannerSourceHost` usa essa capacidade quando presente. As observações `current` e `again` continuam independentes; o fallback anterior permanece disponível.

A redução **4→2** descreve envelopes de fonte no resolver bem-sucedido. Não mede redução de tempo integral, não elimina os produtores/verificadores financeiros e não prova que a jornada completa caberá no deadline.

## Rotas dos três arquivos financeiros

| Arquivo e blob W28 | Rota de construção | Alcance de PR59 |
|---|---|---|
| `test/product/wp13/coverage-sensitivity-integration.test.ts` — `1a0dc5a9bc71923aafd3ec5eaf476f7a3f780bdc` | Casos 1 e 3: `createPortfolioCoverageFixture → createWp05ComparisonFixture → PlannerSourceHost literal → createPlannerPort`. Caso 2: `createRenewalChoiceHistory → createRenewalSourceFixture`; a revisão posterior usa `createRenewalQuoteRevision`. | Nenhum dos três casos passa pela observação preparada. A fonte inicial faz lookup de referências da fixture; a revisão lê o store e chama `projectPlannerSource` diretamente. |
| `test/product/wp11/composite-coverage.test.ts` — `b4da64e28c6a207311859595b0a36e07e0c5151b` | `createWp05SensitivityFixture → createWp05ComparisonFixture → PlannerSourceHost literal → createPlannerPort / createPlannerExactThreshold`. | Nenhum dos dois casos passa pelo adapter alterado. |
| `test/product/wp13/threshold-recertification.test.ts` — `42ddb74c93873d0dec1e9d255ba90a2ae71cab7d` | `createWp13SensitivityRuntimeFixture → createWp13AnalysisFixture → createWp13PortfolioFixture → PlannerSourceHost literal com ref v0 → createPlannerPort / validatePlannerThreshold`. | Não usa o mecanismo alterado. Conserva valor como prova numérica/estrutural de intervalo, testemunhas adjacentes e substituição de um ULP. |

Essas fixtures abrem SQLite real e chamam produtores reais. O limite relevante é específico: a porta de seleção de fontes usada por elas contorna a capacidade que mudou. Não se infere dessa constatação que seus cálculos sejam fictícios.

### Pins das fixtures

| Fixture | Blob W28 |
|---|---|
| `test/product/wp05/engine-fixture.ts` | `608b1a95b491740041f8689a41b4a064c7254b24` |
| `test/product/wp13/coverage-preview-fixture.ts` | `6e56a64ee1b76422706d685e2f646a156a8ade39` |
| `test/product/wp13/sensitivity-fixture.ts` | `5b868fdcb3cc9371a6592b000f33ba0b357329c5` |
| `test/product/wp11/renewal-choice-fixture.ts` | `2da82bf379910826f4558b5b330c97cdaf6806df` |
| `test/product/wp11/renewal-source-fixture.ts` | `3c1caeff08728b3e0c2aed8ae916c0754ad6318d` |
| `test/product/wp11/renewal-coverage-fixture.ts` | `d1b8c7b91c071ee970ff217c3a2745d84b99486b` |

## Rota que efetivamente alcança a mudança

`test/product/wp10/integration/portfolio-exact-threshold.test.ts`, blob `fa4bdf61e69af2498b5668a5dfceb9286613d0bd`, chama a composição instalada:

1. `financialCompositionFixture`, blob `febb795303b8c4ada5fb6f39d6373667ee71dac1`, cria `createSfSourcePersistence` sobre o driver e passa essa mesma persistência para autoridade e serviços.
2. `apps/cli/src/sucafina-product/business-services.ts`, blob `385dd1998ec3fb73b32f77ab3dec9c93beb440d1`, chama `createPlannerProduct({ host, scopedSources: input.persistence, ... })`.
3. `product/planner/product.ts`, blob `4d34958a4acec914ec848df7bbfcfda3f03eeb0e`, cria `createSfPlannerSourceHost` e injeta a porta nos produtores Planner.
4. `product/integration/planner-sources.ts` chama `readScopedSourcePrepared` em cada observação independente.
5. `product/integration/source-lifecycle.ts` executa preparação e observação no envelope real do driver.

**Hipótese discriminante:** reduzir envelopes nessa rota efetiva pode permitir a conclusão de evaluate/store e das caudas de cold-read, retry e revogação sob os mesmos budgets. O teste mantém os resultados, a persistência, as leituras canônicas e as assertions financeiras.

**Limites:** o caminho conserva cinco verificações de binding de sensibilidade; X27 chegou somente à primeira. Contagem estrutural menor não prova ganho total. Se o novo run ainda terminar no deadline, preserve a falha e não repita sem outra hipótese causal. Somente assertions alcançadas recebem crédito.

## Correção do histórico B26

**B26 não selecionou `wp11/composite-coverage.test.ts`.**

O run [43620440087](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620440087), job `132524715232`, usou W `a1434e7ea7340aa1d1c8ce6bb48958b724218170` e S `edc61b259cc0479d1916a7dd3a2e2ee89d7724a9`. Resultado preservado: **38 pass / 2 fail / 40 testes / sete arquivos / 533 expects / 1.420,51 s**.

A falha estrangeira foi:

- `test/product/wp11/calculation-persistence.test.ts`, blob `04185fa8e4e3c9c2c25d7bf4e898831f4f891ea7`.
- Caso: “nested C17 calculations reopen through persisted canonical requests and replay every ancestor”.
- Timeout Bun: **180.000 ms**; duração observada: **188.985,84 ms**.
- Composição direta de produtores com a fixture WP05; sem `createSfBusinessServices` ou adapters próprios instalados.
- Fase específica desconhecida: o teste estrangeiro não tinha phase trace.

A falha própria foi `calculation-ancestry-composition.test.ts`, durante `produce-outer`, no deadline cooperativo de **105.000 ms**, com **373 leituras canônicas de resultados iniciadas e concluídas**. Esses são contadores de invocações da API, não commits físicos. Não há prova de causa comum entre os dois timeouts.

Fonte durável: `docs/sf2h/receipts/WP10/2026-11-14-recovery/preparation-W27/agents/ci/W26-observation/B/triage.json`.

## P27, Q27 e D22

**P27** permanece request preservado para `wp13/coverage-sensitivity-integration.test.ts`. **Q27** permanece request preservado para `wp13/persistence-recovery.test.ts`, `wp13/sensitivity-retry-boundary.test.ts` e `wp13/threshold-recertification.test.ts`. Nenhum terminal PASS desses requests é atribuído por esta revisão. Os outros dois arquivos de Q27 não foram alvo deste exame de alcance.

**D22** é evidência parcial cancelada, sem Bun summary completo:

- Run [43610668152](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43610668152), job `132494810814`.
- W `4bc9c7220f04f113609393aaba38934a7e69878b`; S `c00c167bdf368d89273d60ca29e5eb24c01dc577`.
- Cleanup `132507288922`: success.
- Log SHA256 `98e1ca1414d36cccbe9a52f881dfc2f92c77c851ba830451647dae109b1654b5`.
- Em `coverage-sensitivity-integration.test.ts`, observou duas falhas nomeadas, zero passes e nenhum resultado integral do arquivo.
- O blob executado era `5b4579143250700a313744cc2240741f1bc15237`; o atual é `1a0dc5a9bc71923aafd3ec5eaf476f7a3f780bdc`.
- As durações observadas das falhas foram `757097.89` e `1383750.72` ms. Não se infere delas causa de cancelamento ou resultado atual.

Fonte: `docs/sf2h/receipts/WP10/2026-11-14-recovery/preparation-W26/W22-D-partial/evidence/W22/normalized/D-portfolio-finance-partial/test-observations.json`.

Não foi identificada, nos recibos delimitados consultados, uma prova histórica de sucesso reutilizável para as três seleções exatas. A identidade dos produtores numéricos não substitui a prova do adapter de fontes alterado.

## Disposição para a continuação

Os três arquivos permanecem pendentes financeiros globais. O root decidiu não dispará-los como gate de PR59 sem hipótese discriminante. Depois de C29 e F29 verdes, X29 será o único novo run longo para a hipótese 4→2, com tracing e budgets preservados. Essa decisão não transforma o estado “executando” de C29 em aprovação.

Esta nota qualifica o alcance de gates existentes; não cria novo planejamento, implementação concorrente, merge, release ou aceite global.

