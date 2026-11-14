# WP06 full historical 81-file reconciliation

Historical W20 `e7fd8ff797441681f360e7775155a8cc2830280c` → W1 `de6959db82dbe48bd59e3d012ff668a86347a6cd` → W2 `5e0c79ee7013ea84329ff1fab8b32ab04ebdc2c3`.

All 81 input test files are accounted for. **31** files outside the existing43 have reusable scoped evidence through100 pinned source modules; neither W2 changed those modules. **31** input files were selected in the existing43 run. **18** further files require conservative surgical revalidation; **one** Atlas consumer belongs to astra-compose. The100 W1 passes and one native deadline failure are preserved as W1 observations. No full WP or global acceptance is asserted.

The source graph covers203 verified blobs. It excludes type-only imports and only the explicitly reviewed symbol/branch scopes listed in the normalized JSON. A conservative module witness is not a claim that the changed branch ran. The18-case-file request preserves that distinction instead of promoting an unproved old green.

## Complete file ledger

| File | W20 receipt | Historical cases | Decision | Witness |
| --- | --- | ---: | --- | --- |
| `Sucafinav1/test/product/wp06/imports/analysis-options.test.ts` | N16 / 43552127199 | 1 | Selected43; reconcile W1 result + W2 delta | test/product/wp06/native/fixture.ts |
| `Sucafinav1/test/product/wp06/native/documents.test.ts` | N16 / 43552127199 | 3 | Selected43; reconcile W1 result + W2 delta | test/product/wp06/native/fixture.ts |
| `Sucafinav1/test/dashboard-import.test.ts` | R18 / 43554658437 | 18 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/parity-legacy-workbooks.test.ts` | R18 / 43554658437 | 3 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/parity-planner.test.ts` | R18 / 43554658437 | 6 | Additional surgical selection | runtime/planner.ts → runtime/contract.ts |
| `Sucafinav1/test/planner-runtime.test.ts` | R18 / 43554658437 | 48 | Additional surgical selection | runtime/planner.ts → runtime/contract.ts |
| `Sucafinav1/test/product/wp01/personal-views.test.ts` | R18 / 43554658437 | 1 | Selected43; reconcile W1 result + W2 delta | product/integration/product-authority.ts |
| `Sucafinav1/test/product/wp01/workbench-analysis.test.ts` | R18 / 43554658437 | 2 | Selected43; reconcile W1 result + W2 delta | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp02/confirmation.test.ts` | R18 / 43554658437 | 1 | Additional surgical selection | product/integration/source-projections.ts → product/integration/procurement-projections.ts |
| `Sucafinav1/test/product/wp03/monthly-host.test.ts` | R18 / 43554658437 | 1 | Selected43; reconcile W1 result + W2 delta | product/planner/monthly-host.ts → runtime/planner.ts → runtime/contract.ts |
| `Sucafinav1/test/product/wp03/parity-matrix.test.ts` | R18 / 43554658437 | 1 | Selected43; reconcile W1 result + W2 delta | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp03/persistence.test.ts` | R18 / 43554658437 | 1 | Selected43; reconcile W1 result + W2 delta | product/host-binding/state-provider.ts |
| `Sucafinav1/test/product/wp03/port.test.ts` | R18 / 43554658437 | 2 | Selected43; reconcile W1 result + W2 delta | product/planner/headcount.ts → product/planner/adapter.ts → runtime/planner.ts → runtime/contract.ts |
| `Sucafinav1/test/product/wp04/prepared-production.test.ts` | R18 / 43554658437 | 2 | Selected43; reconcile W1 result + W2 delta | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/dashboard-import.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/documents/candidates.test.ts` | R18 / 43554658437 | 3 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/documents/docx.test.ts` | R18 / 43554658437 | 3 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/documents/dossier-runtime.test.ts` | R18 / 43554658437 | 3 | Selected43; reconcile W1 result + W2 delta | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/documents/egress-fences.test.ts` | R18 / 43554658437 | 3 | Additional surgical selection | product/procurement/sources.ts |
| `Sucafinav1/test/product/wp06/documents/extraction-reuse.test.ts` | R18 / 43554658437 | 1 | Additional surgical selection | test/product/wp06/runtime-fixture.ts → product/integration/source-projections.ts → product/integration/procurement-projections.ts |
| `Sucafinav1/test/product/wp06/documents/pdf-digital.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/documents/pdf-empty.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/documents/request-selection.test.ts` | R18 / 43554658437 | 3 | Additional surgical selection | product/host-binding/business-context.ts |
| `Sucafinav1/test/product/wp06/documents/resolver.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/documents/runtime-e2e.test.ts` | R18 / 43554658437 | 3 | Selected43; reconcile W1 result + W2 delta | product/integration/product-authority.ts |
| `Sucafinav1/test/product/wp06/documents/scenario-consumer.test.ts` | R18 / 43554658437 | 1 | Selected43; reconcile W1 result + W2 delta | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/documents/schemas.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/documents/source-fence.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/imports/admission-boundaries.test.ts` | R18 / 43554658437 | 2 | Additional surgical selection | test/product/wp06/runtime-fixture.ts → product/integration/source-projections.ts → product/integration/procurement-projections.ts |
| `Sucafinav1/test/product/wp06/imports/atomic-rejection.test.ts` | R18 / 43554658437 | 3 | Additional surgical selection | test/product/wp06/imports/host-fixture.ts → product/planner/port.ts → product/planner/adapter.ts → runtime/planner.ts → runtime/contract.ts |
| `Sucafinav1/test/product/wp06/imports/changes.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/imports/dashboard-backup-e2e.test.ts` | R18 / 43554658437 | 1 | Selected43; reconcile W1 result + W2 delta | product/host-binding/state-provider.ts |
| `Sucafinav1/test/product/wp06/imports/dashboard-command.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/imports/dashboard-provenance.test.ts` | R18 / 43554658437 | 2 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/imports/dashboard-unchanged.test.ts` | R18 / 43554658437 | 3 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/imports/dashboard.test.ts` | R18 / 43554658437 | 3 | Additional surgical selection | runtime/dashboard-backup.ts → runtime/contract.ts |
| `Sucafinav1/test/product/wp06/imports/detail-coverage.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/imports/detail.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/imports/end-to-end.test.ts` | R18 / 43554658437 | 1 | Selected43; reconcile W1 result + W2 delta | product/host-binding/state-provider.ts |
| `Sucafinav1/test/product/wp06/imports/export-download-privacy.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/imports/files.test.ts` | R18 / 43554658437 | 2 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/imports/financial-impact.test.ts` | R18 / 43554658437 | 1 | Additional surgical selection | test/product/wp06/imports/host-fixture.ts → product/planner/port.ts → product/planner/adapter.ts → runtime/planner.ts → runtime/contract.ts |
| `Sucafinav1/test/product/wp06/imports/html-policy.test.ts` | R18 / 43554658437 | 2 | Additional surgical selection | runtime/application.ts |
| `Sucafinav1/test/product/wp06/imports/planner-options-runtime.test.ts` | R18 / 43554658437 | 3 | Additional surgical selection | test/product/wp06/imports/http-fixture.ts → test/product/wp06/runtime-fixture.ts → product/integration/source-projections.ts → product/integration/procurement-projections.ts |
| `Sucafinav1/test/product/wp06/imports/planner-roundtrip-runtime.test.ts` | R18 / 43554658437 | 1 | Additional surgical selection | product/planner/port.ts → product/planner/adapter.ts → runtime/planner.ts → runtime/contract.ts |
| `Sucafinav1/test/product/wp06/imports/planner-unchanged.test.ts` | R18 / 43554658437 | 3 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/imports/planner.test.ts` | R18 / 43554658437 | 8 | Additional surgical selection | runtime/planner.ts → runtime/contract.ts |
| `Sucafinav1/test/product/wp06/imports/preview-privacy.test.ts` | R18 / 43554658437 | 1 | Additional surgical selection | product/planner/port.ts → product/planner/adapter.ts → runtime/planner.ts → runtime/contract.ts |
| `Sucafinav1/test/product/wp06/imports/receipt.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/imports/roster-runtime.test.ts` | R18 / 43554658437 | 1 | Additional surgical selection | test/product/wp06/runtime-fixture.ts → product/integration/source-projections.ts → product/integration/procurement-projections.ts |
| `Sucafinav1/test/product/wp06/imports/roster-save-race.test.ts` | R18 / 43554658437 | 2 | Additional surgical selection | test/product/wp06/imports/host-fixture.ts → product/planner/port.ts → product/planner/adapter.ts → runtime/planner.ts → runtime/contract.ts |
| `Sucafinav1/test/product/wp06/imports/source-fences.test.ts` | R18 / 43554658437 | 5 | Selected43; reconcile W1 result + W2 delta | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/imports/sqlite-planner.test.ts` | R18 / 43554658437 | 1 | Selected43; reconcile W1 result + W2 delta | product/imports/planner.ts → runtime/planner.ts → runtime/contract.ts |
| `Sucafinav1/test/product/wp06/imports/staged-files.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/imports/workbook-provenance-edge.test.ts` | R18 / 43554658437 | 3 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/imports/workbook-provenance.test.ts` | R18 / 43554658437 | 4 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp07/review-port.test.ts` | R18 / 43554658437 | 11 | Selected43; reconcile W1 result + W2 delta | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp08/confirmation-integration.test.ts` | R18 / 43554658437 | 1 | Selected43; reconcile W1 result + W2 delta | product/host-binding/state-provider.ts |
| `Sucafinav1/test/product/wp08/hot-topic-host.test.ts` | R18 / 43554658437 | 1 | Additional surgical selection | product/dashboard/hot-topics.ts → runtime/dashboard-people.ts → runtime/contract.ts |
| `Sucafinav1/test/product/wp08/persistence.test.ts` | R18 / 43554658437 | 4 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp08/reissue.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp10/integration/blob-generations.test.ts` | R18 / 43554658437 | 2 | Selected43; reconcile W1 result + W2 delta | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp10/integration/product-authority.test.ts` | R18 / 43554658437 | 11 | Selected43; reconcile W1 result + W2 delta | product/integration/product-authority.ts |
| `Sucafinav1/test/product/wp10/integration/source-lifecycle.test.ts` | R18 / 43554658437 | 5 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp10/native-host/native-host.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp11/analysis-acceptance-adversarial.test.ts` | R18 / 43554658437 | 2 | Selected43; reconcile W1 result + W2 delta | product/host-binding/state-provider.ts |
| `Sucafinav1/test/product/wp11/analysis-acceptance.test.ts` | R18 / 43554658437 | 1 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp11/coverage-access.test.ts` | R18 / 43554658437 | 2 | Selected43; reconcile W1 result + W2 delta | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp11/planner-apply.test.ts` | R18 / 43554658437 | 1 | Selected43; reconcile W1 result + W2 delta | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp11/prepared-apply.test.ts` | R18 / 43554658437 | 1 | Selected43; reconcile W1 result + W2 delta | product/host-binding/state-provider.ts |
| `Sucafinav1/test/product/wp12/author-reader.test.ts` | R18 / 43554658437 | 1 | Selected43; reconcile W1 result + W2 delta | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp13/handoff.test.ts` | R18 / 43554658437 | 3 | Selected43; reconcile W1 result + W2 delta | product/portfolio/handoff.ts → product/portfolio/result-store.ts → product/decisions/result-store.ts → product/contracts/schema-admission.ts → product/contracts/output-schemas.ts |
| `Sucafinav1/test/product/wp13/portfolio.test.ts` | R18 / 43554658437 | 10 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp13/sensitivity-units-boundary.test.ts` | R18 / 43554658437 | 1 | Selected43; reconcile W1 result + W2 delta | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp14/source-access-atlas.test.ts` | R18 / 43554658437 | 2 | Owner patch + CI | product/host-binding/state-provider.ts |
| `Sucafinav1/test/product/wp14/source-access-procurement.test.ts` | R18 / 43554658437 | 1 | Selected43; reconcile W1 result + W2 delta | product/procurement/sources.ts |
| `Sucafinav1/test/workbooks.test.ts` | R18 / 43554658437 | 22 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/local-store.test.ts` | R19 / 43555674548 | 38 | Reuse scoped evidence | No active changed-module path after recorded exclusions |
| `Sucafinav1/test/product/wp06/import-runtime.test.ts` | U20 / 43557187051 | 1 | Selected43; reconcile W1 result + W2 delta | test/product/wp06/runtime-fixture.ts |
| `Sucafinav1/test/product/wp06/imports/dashboard-runtime.test.ts` | U20 / 43557187051 | 3 | Selected43; reconcile W1 result + W2 delta | test/product/wp06/imports/http-fixture.ts → test/product/wp06/runtime-fixture.ts |
| `Sucafinav1/test/product/wp06/native/import-analysis.test.ts` | U20 / 43557187051 | 2 | Selected43; reconcile W1 result + W2 delta | test/product/wp06/native/fixture.ts |

## Boundaries

The normalized JSON contains the deduplicated source hashes,303 original Bun observations (301 passes, two skips), run pins, exact exclusions and18-file request. It records the failed W1 typecheck separately from its green CLI typecheck and guards. The complete140-criterion map keeps every literal criterion, consumer and AM/native/human/global proof requirement; this impact ledger is an appendix, not a replacement for that map.

Native import analysis is revalidated in a separate fresh process with its existing300000/360000 ms limits and assertions. The timeout diagnosis compares256 matched completed stages with the U20 control and does not classify the failure as a flake. Both WP06 browser specs need revalidation because the shared emitted SCRIPT changed; unchanged test-file blobs alone are not enough.

No product tests, typechecks or guards were run locally. Only source inspection, data normalization and byte/hash comparison were performed.
