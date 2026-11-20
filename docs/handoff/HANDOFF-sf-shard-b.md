# HANDOFF — sf-shard-b

## SHA e estado

- Estado: **PARTIAL — shard 4 enumerado; shard 5 interrompido; shard 6 em execução.**
- Base imutável: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` (`sf-join-four`).
- Branch: `sf-shard-b`; checkpoint anterior: `3c600f1a6830275e074854f01bbf611274ccf245`. Esta revisão continua documental: nenhum fix de código aplicado.
- Escopo: CI-SF shards 4, 5 e 6 de 8; apenas GitHub; verificação por Actions.
- `sf-ci` não foi executado. Não há declaração de GO ou de shard verde.

## Por shard

| Shard | Run | SHA testado | N pass / M fail | Estado |
| --- | --- | --- | --- | --- |
| 4 | [44645900692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645900692) | `dd45d888617943df40e02815d58b59f88d8a18f7` | **497 pass / 14 fail** | 511 testes, todos os 118 arquivos; Omni PASS, 428 spawns |
| 5 | [44645913808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645913808) | `f0bccdc48b42a9d000f3bda6565fa3d88286c845` | **≥576 pass / ≥21 fail observados, sem sumário final** | job cancelado no limite de 45 minutos; 105 de 119 arquivos iniciados |
| 6 | [44651628624](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44651628624) | `204a74491764dcde4da22ebe558efc318e04a777` | indisponível | Run tests em andamento; 109 arquivos selecionados |

No shard 5 há 576 marcadores pass (um concatenado ao final de uma linha Received de HTML), 20 marcadores fail e uma asserção adicional visível em `work-bridge.test.ts:386`, cujo marcador fail não consta depois da linha longa. Há um skip Windows/DACL pré-existente em Linux. Esses números são limites observados, não uma reconstrução do sumário ausente. A checagem Omni final não chegou a executar.

## Falhas do shard 4

Caminhos abaixo relativos a `modules/sucafina/Sucafinav1/test/product/`. As 14 falhas permanecem na base; correções indicadas como preparadas ainda não foram publicadas nem verificadas.

| File:line | Casos | Observação | Classificação / encaminhamento |
| --- | ---: | --- | --- |
| wp13/handoff-persistence.test.ts:95 | 1 | `ok` → `stale` | em análise — preparação/revalidação WP13 |
| wp13/coverage-sensitivity-integration.test.ts:115 | 1 | mutação de input aceita (`false` → `true`) | shared-security-input-mutation — `product/portfolio/verification.ts:203-205`; requer PR shared |
| wp13/handoff-domain-integration.test.ts:392 | 1 | preparação canônica indisponível | fixture sem `confirmed: false` (:391); correção preparada |
| wp13/handoff-c08-predispatch.test.ts:242 | 1 | replay retorna `conflict`, esperado `ok` | em análise — identidade do replay |
| wp13/handoff-canonical-integration.test.ts:176 | 1 | replay retorna `conflict`, esperado `ok` | em análise — identidade do replay |
| proof234/am04-c12-return.test.ts:78 → c12-receipt-recovery/consumer.ts:81 | 1 | leitura de receipts negada após revogação | fixture observa como Alice revogada; observação por Bob já autorizado preparada |
| wp12/native-execution-reevaluation.test.ts → wp12/native-portfolio-preparation.ts:150 | 1 | esperado total null, recebido 240000 | fixture confunde fonte sem operações com hipótese; correção específica em preparação |
| wp12/native-execution-purchase.test.ts → wp12/native-procurement-preparation.ts:193 | 2 | pending/complete: esperado total null, recebido 240000 | mesma causa de classificação da fonte; preservar null em hipóteses e cobertura incompleta |
| wp07/browser-ui.test.ts:242 | 1 | inscrição redireciona a `/`, ausente na fixture isolada | correção do cliente de inscrição preparada; componente existente permanece |
| ui-split/ui-source/draft-replay.test.ts:32 | 1 | replay exato após avanço legítimo: 403, esperado 200 | shared-draft-replay — `product/decisions/hot-topic-draft.ts:94-101,206-207`; requer PR shared |
| ui-split/ui-work/guards.test.ts:23 | 1 | exit 1 após 90011 ms | unbound — orçamento do subprocesso :19; somente WARN, nenhum finding de gate observado |
| integrated-proofs/am01/portfolio-recall-proof.test.ts:19 | 1 | timeout 240000 ms; 579798,97 ms observados | unbound — lifecycle do host; catálogo instalado vazio, sem inferência; limite :148 |
| integrated-proofs/am01/recall-five-profiles.test.ts:31 | 1 | SF_PRODUCT_AUTHORITY_CONFIG_INVALID | fixture duplica operações na linha 28; deduplicação preparada |

## Falhas observadas do shard 5

Mesmo prefixo de caminhos. Diagnóstico em curso; nenhum resultado dos arquivos não iniciados é presumido.

| File:line | Casos | Observação | Classificação / encaminhamento |
| --- | ---: | --- | --- |
| installed-bi-closure/sensitivity-history.test.ts:19,66 | 3 | deadlines cooperativos de 165000 ms | unbound — desempenho/lifecycle; sem aumentar limite por palpite |
| similarity217/installed.test.ts:53,99,137 | 3 | `ok` → `unavailable` | em análise — memória/Atlas instalados |
| wp12/native-execution-bi.test.ts:85 | 2 | predicado esperado true, recebido false | em análise — contrato de fonte nativa |
| wp11/source-promotion-coverage.test.ts:182 | 1 | ordem de evaluatedSourceRefs diverge | em análise — ordem da observação real |
| wp01/planner-monthly.test.ts:44 | 1 | inscrição seguida de navegação a console retirado | contrato de UI legado — usa `?page=OPEX`; não restaurar console |
| wp00/contract-freeze.test.ts:19 | 1 | hash de `product/contracts/decisions.ts` diverge | contract-freeze-drift — não atualizar hash somente para verde |
| wp10/integration/portfolio-promotion.test.ts:227 → :43 | 1 | deadline cooperativo de 285000 ms | unbound — desempenho/lifecycle |
| wp10/integration/review-portfolio-http.test.ts:271 | 1 | `denied` → `unavailable` | em análise — fronteira de autoridade |
| wp10/integration/review-access-browser-fixture.ts:29 | 1 | WP10_REVIEW_BROWSER_TRANSPORT_DEADLINE | unbound — deadline de transporte da fixture |
| wp10/integration/bi-lifecycle.test.ts:202 | 4 | inscrição redireciona a `/` não servida | contrato de shell legado; quatro casos de lifecycle, sem restaurar console |
| wp10/integration/portfolio-exact-threshold.test.ts:43 → :213 | 1 | denied/criterion-result-access-unavailable | em análise — acesso ao resultado de critério |
| wp10/integration/planner-calculation.test.ts:615 | 1 | 0 resoluções observadas, esperado 1 | em análise — instrumentação/recall Atlas |
| wp10/integration/work-bridge.test.ts:386 | ≥1 erro de asserção adicional | HTML não contém `page=All+Projects`; marcador fail ausente após linha longa | contrato de navegação legado — não restaurar URL para satisfazer teste |

O cancelamento ocorreu durante `wp10/integration/planner-calculation.test.ts:684`, na chamada de recall em `:694`. Os testes seguintes em `:718` e `:738` não foram alcançados. A cauda desse arquivo e os 14 arquivos abaixo ficam **unbound — não enumerados por limite do job**:

- `Sucafinav1/test/product/integrated-proofs/am06/correlate.test.ts`
- `Sucafinav1/test/product/review-fixes/finance-resume-performance/historical-batch.test.ts`
- `Sucafinav1/test/product/ui-split/ui-recovery/recovery.test.ts`
- `Sucafinav1/test/product/wp06/documents/dossier-runtime.test.ts`
- `Sucafinav1/test/product/wp06/imports/atomic-rejection.test.ts`
- `Sucafinav1/test/product/wp06/imports/dashboard-runtime.test.ts`
- `Sucafinav1/test/product/wp06/imports/dashboard-unchanged.test.ts`
- `Sucafinav1/test/product/wp06/imports/dashboard.test.ts`
- `Sucafinav1/test/product/wp06/imports/financial-impact.test.ts`
- `Sucafinav1/test/product/wp06/imports/receipt.test.ts`
- `Sucafinav1/test/product/wp06/imports/source-fences.test.ts`
- `Sucafinav1/test/product/wp10/analysis-composition/decision-controls.test.ts`
- `Sucafinav1/test/product/wp10/analysis-composition/decision-domain.test.ts`
- `Sucafinav1/test/product/wp10/atlas-business/case-event-continuity.test.ts`

## Feito e justificativas

1. Branch de trabalho criada exatamente na base; nenhuma outra branch de trabalho foi rebaseada.
2. Lidos AGENTS.md, contrato do runner, manifesto e seletor canônico. Nenhum shell ou teste local utilizado.
3. Inventário: 924 arquivos, menos 40 do harness ordenado e 1 release-only = 883 elegíveis. Partição e requests conferidos independentemente; shards 4/5/6 têm 118/119/109 arquivos. Nenhum arquivo foi removido.
4. O pedido literal fornecido não é admitido pelo runner da base:
   - `.github/workflows/test-ci.yml:30-37`: exige branch `ci-run-linux-*`.
   - `script/test-ci-request.ts:96-98`: exige `args`.
   - `script/test-ci-request.ts:12-15,133-140` e workflow `:144-159`: não permitem env `SF_*`.
   - `script/test-ci-package.ts:21-35`: resolve alias `sucafina`, não `modules/sucafina`.
5. Usados `package: sucafina`, `directory: modules/sucafina`, `runner: bun`, `args: [--timeout, 30000, ...todos os caminhos exatos do shard]`, env Omni=1. Branches de enumeração: `ci-run-linux-sfb-4r1`, `ci-run-linux-sfb-5r1`, `ci-run-linux-sfb-6`.
6. `runtime/application.ts:76-81,91-95,382` foi somente lido. HTML legado continua descomissionado. Nenhuma navegação de browser a :4110.
7. Correções conservadoras de fixture estão sendo preparadas por causa; gates somente após fix concreto. Falhas reais de produtor não serão convertidas em expectativas de erro.

## Incidentes de admissão — zero testes de produto

- Runs 44645786965 e 44645800154 foram disparados na criação das branches no SHA base antes de existir `.ci-run.json`; falharam com ENOENT no passo Read request.
- Runs 44645789826 e 44645801987 receberam os arquivos exatos, mas falharam com `TEST_PACKAGE_NOT_FOUND:modules/sucafina` em `script/test-ci-package.ts:35`.
- As quatro execuções terminaram sem executar testes. Elas não são contadas como falhas de produto.
- Houve sobreposição transitória desses runs de admissão acima do limite de dois; não se declara cumprimento retroativo desse limite.
- Correção de publicação: criar árvore e commit completos via Git Data API ANTES de criar a ref `ci-run-linux-*`. Cada novo pedido passa a disparar somente um workflow. Pedidos seguintes usam o alias registrado e no máximo duas execuções ativas.
- As duas execuções involuntárias no SHA base repetiram o mesmo bloqueio de admissão ENOENT e ficam classificadas como `unbound`, sem testes de produto. Após corrigir a publicação e o alias de pacote, não houve repetição de pedido idêntico sem mudança.

## Limite da evidência

São execuções cirúrgicas de todos os arquivos dos shards, no Actions. O `test-ci` não produz o recibo completo de `sf-ci`, não executa sua verificação de cobertura e usa Omni no escopo `declared` para seleções explícitas. Não há alegação de baseline, coverage, digest de execução ou GO. Os hashes de seleção são cálculos de inventário, não recibos.


## Pendente / como retomar

1. Aguardar e enumerar o run 44651628624; não repetir gates sem mudança.
2. Concluir classificações pendentes; shard 5 não tem total final e não pode ser anunciado completo.
3. Publicar cada causa corrigida em commit separado de `sf-shard-b`; fazer um gate focado nos testes afetados do shard, no máximo dois ativos. Não converter a passagem de um recorte em passagem do shard inteiro.
4. Preservar as asserções de segurança e negócio. Qualquer correção fora de `Sucafinav1/test/**` deve ir a PR separado com título `shared:`.
5. Atualizar falhas, commits, gates e estado final deste handoff.

## Ordem de merge

Ainda não há correções ou PR compartilhado. As mudanças publicadas até este checkpoint são apenas este handoff. Não integrar como resultado verde.
