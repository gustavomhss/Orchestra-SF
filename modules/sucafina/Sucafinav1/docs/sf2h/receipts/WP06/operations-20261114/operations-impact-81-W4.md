# WP06 — fechamento de impacto dos 81 arquivos em W4

Produto `644324778e4a21d22424515dd698d5b8d6c01893`, árvore `6ec8797d360ecec89f1734031b0d1e3e98dd3605`.

As comparações MCP W1→W4, W2→W4 e W3→W4 são completas, com merge-base igual à origem. A classificação abaixo reutiliza observações com fronteiras explícitas e mantém os resultados pendentes.

| Grupo | Arquivos | Observações |
|---|---:|---|
| Histórico com closure demonstrado |31|137 passes e2 skips, sem alteração nas100 fontes verificadas|
| Casos individuais W1 preservados após revisão de símbolos C12 |26|63 passes; o run completo W1 continua falho|
| Nativo W3 preservado |1|2 passes,123 asserts; Omni não aplicável|
| Selecionados novamente no Bun24 W4 |22|Pendentes; não promovidos|
| Consumidor Atlas do owner |1|Patch e validação ainda exigidos|

Bun24 também inclui WP04/host-integration e WP11/case-port, fora do corpus histórico81. Seu snapshot é `6108eafea9a35ba15968271f0aed76b1498d5ac4`, árvore `4936290eef233ef027c5d6a2e85098bd700aaf78`; o request exato está no JSON.

## Browser W2 preservável

Run43580401528, snapshot `26726f85ce39819fcfa376daf1e6ebea203188b2`, produtoW2 `5e0c79ee7013ea84329ff1fab8b32ab04ebdc2c3`: os14 casos de imports e8 casos de Procurement permanecem reutilizáveis. Workbench, scripts, shell/CSP, configurações e fixture real de Procurement estão intactos. A fixture real monta apenas Application/Procurement e a queueView; não monta CLI dossiê nem HTTP C12. Os8 casos de documentos serão revalidados pelo consumidor e spec alterados.

## Exceções simbólicas limitadas

- **E-C12-LAZY** — The listed non-C12 tests only. createPreparedExecution and createDecisionPreparedReview return async callbacks; createSfPreparedApply constructs read/execute methods. Added digest/revalidation logic runs only when the returned C12 operations are invoked. No module-level registration or eager dispatch is introduced. Caller-specific proofs are recorded per row; this exemption does not cover the five selected C12 consumers.
- **E-DOSSIER-FACTORIES** — Selections that do not import/mount CLI createSfDossierServices/sfDossierWorkbench. Business services retains its canonical product/routines producer. The owner changes only the separate CLI consumer factories. Native/import and non-dossier fixtures do not initialize CLI bootstrap or these consumers. Dossier-runtime and the documents browser spec are explicitly revalidated.
- **E-BACKUP-TYPE** — product/imports/dashboard.ts only. The sole W1-to-W4 file delta replaces a preview return-type annotation with typeof simulateBackup. No executable statement changes. The exact patch provenance is in composition-decisions.md.
- **E-UI-NARROWING** — decision-host reviewDigestFor, W2-to-W4 only. The new context.kind === ui is a runtime guard, not type erasure. current(context) returns held only if held.context === context. The only active.set occurs in apply after context.kind !== ui is rejected, so held already implies ui for reachable calls. The unchanged browser host additionally exposes no C12 review/apply endpoint.
- **E-NONPRODUCT** — Changed receipts, independent test files and astra-operations-check workflow. No test-ci runner, package manifest/lock, browser config or production module is changed by these paths. New tests are file-isolated selections; check workflow only controls package typecheck/guard execution.

A guarda `context.kind === ui` é código runtime; sua redundância foi demonstrada pelo único `active.set` após a guarda de UI e pela identidade exigida em `current(context)`. Não foi chamada de mudança apenas de tipo. O fix do adapter backup, por sua vez, altera somente a anotação apagada.

## Todos os arquivos

| Arquivo | Estado W4 |
|---|---|
| `Sucafinav1/test/product/wp06/imports/analysis-options.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp06/native/documents.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/dashboard-import.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/parity-legacy-workbooks.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/parity-planner.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/planner-runtime.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp01/personal-views.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp01/workbench-analysis.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp02/confirmation.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp03/monthly-host.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp03/parity-matrix.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp03/persistence.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp03/port.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp04/prepared-production.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/dashboard-import.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/documents/candidates.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/documents/docx.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/documents/dossier-runtime.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/documents/egress-fences.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/documents/extraction-reuse.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/documents/pdf-digital.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/documents/pdf-empty.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/documents/request-selection.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/documents/resolver.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/documents/runtime-e2e.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp06/documents/scenario-consumer.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp06/documents/schemas.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/documents/source-fence.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/imports/admission-boundaries.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/imports/atomic-rejection.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/imports/changes.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/imports/dashboard-backup-e2e.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp06/imports/dashboard-command.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/imports/dashboard-provenance.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/imports/dashboard-unchanged.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/imports/dashboard.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/imports/detail-coverage.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/imports/detail.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/imports/end-to-end.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp06/imports/export-download-privacy.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/imports/files.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/imports/financial-impact.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/imports/html-policy.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/imports/planner-options-runtime.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/imports/planner-roundtrip-runtime.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/imports/planner-unchanged.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/imports/planner.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/imports/preview-privacy.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/imports/receipt.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/imports/roster-runtime.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/imports/roster-save-race.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp06/imports/source-fences.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp06/imports/sqlite-planner.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp06/imports/staged-files.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/imports/workbook-provenance-edge.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/imports/workbook-provenance.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp07/review-port.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp08/confirmation-integration.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp08/hot-topic-host.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp08/persistence.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp08/reissue.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp10/integration/blob-generations.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp10/integration/product-authority.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp10/integration/source-lifecycle.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp10/native-host/native-host.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp11/analysis-acceptance-adversarial.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp11/analysis-acceptance.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp11/coverage-access.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp11/planner-apply.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp11/prepared-apply.test.ts` | PENDING_EXACT_BUN24_RESULT |
| `Sucafinav1/test/product/wp12/author-reader.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp13/handoff.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp13/portfolio.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp13/sensitivity-units-boundary.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp14/source-access-atlas.test.ts` | OWNER_ATLAS_CONSUMER_PATCH_AND_VALIDATION_REQUIRED |
| `Sucafinav1/test/product/wp14/source-access-procurement.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/workbooks.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/local-store.test.ts` | REUSE_HISTORICAL_SCOPED_CLOSURE |
| `Sucafinav1/test/product/wp06/import-runtime.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp06/imports/dashboard-runtime.test.ts` | REUSE_W1_INDIVIDUAL_PASSES_AFTER_C12_SCOPE_REVIEW |
| `Sucafinav1/test/product/wp06/native/import-analysis.test.ts` | REUSE_W3_NATIVE_COMPONENT_PASS |

Os JSONs anteriores preservam textos completos dos140 critérios, AMs, tarefas e evidências não qualificadas. Este fechamento não aceita o WP integralmente. Não houve execução local de produto.
