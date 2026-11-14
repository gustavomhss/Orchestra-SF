# WP01 hosted browser selection

Product tests run only in GitHub Actions through the campaign's CI request. Do not execute this selection locally. Historical receipts retain their original selections and results; this lifecycle supersedes their launch mechanism for new runs.

The selection must name `./Sucafinav1/test/product/wp01/browser-startup.test.ts` first and `./Sucafinav1/test/product/wp01/browser-lifecycle.test.ts` last, with at least one consumer between them. Paths are relative to the `modules/sucafina` package. Automatic discovery, filters, reordered or parallel execution, sharding and isolated module caches are rejected. Only the existing `--timeout` option is accepted in addition to exact test paths.

The startup test declares `expectSpawn(import.meta.path)` in its body and starts the published WP02 Node browser driver through `AppProcess`. The driver keeps its process scope open until the finalizer closes it. Bun connects through the existing private Unix pipe and does not own Chromium's extra stdio descriptors. The pool has one 30-second acquisition deadline covering preparation, launch, connection and CDP PID acquisition; Node receives that deadline and recomputes the remaining launch time after its imports. The named startup test allows 35 seconds. Other driver consumers retain their default and maximum acquisition budget of 15 seconds.

Failed startup cancels and awaits its owned AppProcess scope, then observes the known Node and browser PIDs using one shared five-second cleanup window measured from cancellation. `SF_BROWSER_DRIVER_STARTUP_CANCEL_CLEANUP` is a separate failure receipt, never a clean bridge or successful lifecycle proof. If the scope itself exceeds the window, its ownership is still awaited, the receipt is incomplete and no late probes claim an in-budget cleanup. Missing PIDs, observation errors and processes still present keep the failure. This deadline coordination does not establish or cure the cause of an operating-system I/O stall.

Consumers acquire exclusive leases of that one browser and create fresh contexts. Releasing a lease closes its pages and contexts, without closing Chromium. A failed acquisition, unexpected disconnect or failed release poisons the pool; no replacement browser is launched.

The finalizer retains the assertions for exactly one launch, at least one lease, balanced acquisition/release counts, no active lease, zero contexts, the disconnected event and exit of the actual browser PID obtained through CDP. It also requires the published driver to confirm clean Node, browser and transport shutdown. The driver's proof is emitted only after the finalizer's assertions pass. These are test-browser observations; they do not prove native residents, models, business effect-once behavior or global integration.

## Pool consumer dependencies

These 24 direct consumers identify the pool's dependents. Select the consumers whose behavior changed or whose concrete failure needs resolution, with startup first and finalizer last. Preserve independently affected product tests in that surgical request; do not run the whole group or add an equivalent browser run just because it uses the pool.

For the shared startup deadline/cancellation change, the causal selection is `browser-startup.test.ts`, `question-recipients.test.ts`, `browser-lifecycle.test.ts`: startup exercises the changed boundary, both recipient bodies remain unexecuted after W15's acquisition failure, and the finalizer retains physical cleanup and lease assertions. No other consumer body changed with that harness increment.

```text
./Sucafinav1/test/product/wp01/preview-browser.test.ts
./Sucafinav1/test/product/wp01/bi-browser.test.ts
./Sucafinav1/test/product/wp01/case-work-selection.test.ts
./Sucafinav1/test/product/wp01/contextual-decision.test.ts
./Sucafinav1/test/product/wp01/decision-conflict-recovery.test.ts
./Sucafinav1/test/product/wp01/decision-mutations.test.ts
./Sucafinav1/test/product/wp01/edit-recovery.test.ts
./Sucafinav1/test/product/wp01/http.test.ts
./Sucafinav1/test/product/wp01/import-receipt-browser.test.ts
./Sucafinav1/test/product/wp01/meeting-number.test.ts
./Sucafinav1/test/product/wp01/planner-monthly.test.ts
./Sucafinav1/test/product/wp01/portfolio-recovery.test.ts
./Sucafinav1/test/product/wp01/question-recipients.test.ts
./Sucafinav1/test/product/wp01/record-search.test.ts
./Sucafinav1/test/product/wp01/shell-recovery.test.ts
./Sucafinav1/test/product/wp01/shell-refresh.test.ts
./Sucafinav1/test/product/wp01/shell-state.test.ts
./Sucafinav1/test/product/wp01/thread-recovery.test.ts
./Sucafinav1/test/product/wp01/two-actor-conflict.test.ts
./Sucafinav1/test/product/wp01/unavailable-views.test.ts
./Sucafinav1/test/product/wp01/view-recovery.test.ts
./Sucafinav1/test/product/wp01/work-destination-recovery.test.ts
./Sucafinav1/test/form-layout.test.ts
./Sucafinav1/test/visual-layout.test.ts
```

`preview-browser.test.ts` also has an independently owned Node driver for its in-flight command test. `personal-views.test.ts` uses its own published driver and does not lease this pool. Their original spawn expectations and assertions remain separate.
