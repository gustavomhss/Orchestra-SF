# WP04 impact and selection — astra-operations

Candidate W: de6959db82dbe48bd59e3d012ff668a86347a6cd; tree: e7c36171c132009e34d4f870e5d300bab4a1c82a. Group qualification remains pending.
Historical corpus: 257 Bun passes in 53 files (run 43534137756), plus 10 browser passes in 2 specs (run 43534795463), all on product dae18b4f43f0daecf46264e876810025684a919d.

## Selection

35 Bun files require affected hosted CI; 18 preserve historical scoped evidence. Procurement browser: rerun 8 real-host cases. Sourcing controller: reuse 2 unchanged controlled-transport cases.

The four symbol-level exclusions retain the full change disclosure: source-lifecycle.ts changed only the clone inside createSfSourcePersistence.guard. comparison-review, projection, sources and finance-material never construct that wrapper; they use unchanged digest/projection/monetary functions and fake persistence. All remaining inspected runtime imports and top-level initialization are unchanged.

## Complete per-file map

| Runner | File | Decision | Material witness or reuse boundary |
| --- | --- | --- | --- |
| bun | Sucafinav1/test/product/wp04/capabilities.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp04/comparison-review.test.ts | REUSE_SCOPED_UNCHANGED_BEHAVIOR | Explicit unaffected digest/projection/monetary call path; changed wrapper never invoked. |
| bun | Sucafinav1/test/product/wp04/confirmation-cross-actor.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp04/confirmation.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp04/contracts.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp04/money.test.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |
| bun | Sucafinav1/test/product/wp04/prepared-production.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp04/projection.test.ts | REUSE_SCOPED_UNCHANGED_BEHAVIOR | Explicit unaffected digest/projection/monetary call path; changed wrapper never invoked. |
| bun | Sucafinav1/test/product/wp04/reissue.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp04/sources.test.ts | REUSE_SCOPED_UNCHANGED_BEHAVIOR | Explicit unaffected digest/projection/monetary call path; changed wrapper never invoked. |
| bun | Sucafinav1/test/product/wp04/finance-material.test.ts | REUSE_SCOPED_UNCHANGED_BEHAVIOR | Explicit unaffected digest/projection/monetary call path; changed wrapper never invoked. |
| bun | Sucafinav1/test/product/wp04/finance-prepared-alias.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp04/queue-lifecycle.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp04/queue-view.test.ts | RUN_AFFECTED | apps/cli/src/sucafina-product/business-services.ts |
| bun | Sucafinav1/test/product/wp04/ui-guidance.test.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |
| bun | Sucafinav1/test/product/wp04/ui-queues.test.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |
| bun | Sucafinav1/test/product/wp04/ui-supplier.test.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |
| bun | Sucafinav1/test/parity-procurement.test.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |
| bun | Sucafinav1/test/procurement-runtime.test.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |
| bun | porta/codigo.test.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |
| bun | porta/linha.test.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |
| bun | porta/s3.test.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |
| bun | Sucafinav1/test/product/wp01/personal-views.test.ts | RUN_AFFECTED |  |
| bun | Sucafinav1/test/product/wp03/parity-matrix.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp06/imports/end-to-end.test.ts | RUN_AFFECTED |  |
| bun | Sucafinav1/test/product/wp06/imports/sqlite-planner.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp07/review-port.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp08/confirmation-integration.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp10/integration/blob-generations.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp10/integration/product-authority.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp11/analysis-acceptance-adversarial.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/product/integration/human-authority.ts |
| bun | Sucafinav1/test/product/wp11/coverage-access.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp12/author-reader.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/product/host-binding/business-context.ts |
| bun | Sucafinav1/test/product/wp13/sensitivity-units-boundary.test.ts | RUN_AFFECTED |  |
| bun | Sucafinav1/test/product/wp03/port.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/product/planner/headcount.ts |
| bun | Sucafinav1/test/product/wp03/monthly-host.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp11/planner-apply.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp03/persistence.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp13/handoff.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/product/portfolio/port.ts |
| bun | Sucafinav1/test/product/wp06/imports/dashboard-backup-e2e.test.ts | RUN_AFFECTED |  |
| bun | Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts | RUN_AFFECTED | apps/cli/src/sucafina-product/business-services.ts |
| bun | Sucafinav1/test/product/wp04/ui-browser-selection.test.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |
| bun | Sucafinav1/test/product/wp04/ui-conflict.test.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |
| bun | Sucafinav1/test/product/wp04/host-integration.test.ts | RUN_AFFECTED | apps/cli/src/sucafina-product/business-services.ts |
| bun | Sucafinav1/test/product/wp01/workbench-analysis.test.ts | RUN_AFFECTED | apps/cli/src/sucafina-product/host-context.ts |
| bun | Sucafinav1/test/product/wp06/documents/runtime-e2e.test.ts | RUN_AFFECTED |  |
| bun | Sucafinav1/test/product/wp10/acceptance/state-provider.test.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |
| bun | Sucafinav1/test/product/wp10/atlas-business/business-context.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/product/host-binding/business-context.ts |
| bun | Sucafinav1/test/product/wp10/atlas-business/atlas-store.test.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |
| bun | Sucafinav1/test/product/wp11/prepared-apply.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/runtime/local-store.ts |
| bun | Sucafinav1/test/product/wp14/source-access-procurement.test.ts | RUN_AFFECTED |  |
| bun | Sucafinav1/test/product/wp00/contracts.test.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |
| bun | Sucafinav1/test/product/wp04/ui-sourcing-analysis.test.ts | RUN_AFFECTED | modules/sucafina/Sucafinav1/product/interface/http.ts |
| playwright | e2e/sucafina/wp04/procurement.spec.ts | RUN_AFFECTED | packages/app-shell/e2e/sucafina/wp04/host.ts → modules/sucafina/Sucafinav1/runtime/application.ts |
| playwright | e2e/sucafina/wp04/sourcing-controller.spec.ts | REUSE_IDENTICAL_CLOSURE | Exact test and inspected runtime closure unchanged. |

## Boundaries

- No local product tests or typecheck executed.
- No new CI dispatched by this reviewer.
- No native, human or global criterion status promoted.
- WP04 historical 10 native blockers and 4 human observations remain unchanged.
- W remains pending affected hosted CI and current required typecheck/guards.
- Three independent global reviews and final epic belong to S0.
- The four symbol-scope exclusions are explicit; the source lifecycle module itself is changed and is exercised by other affected files.

Every direct import, recursive runtime path, source blob, original run receipt and remote comparison reference is preserved in impact-inspection.json. No fixture execution or group PASS is implied by source inspection.
