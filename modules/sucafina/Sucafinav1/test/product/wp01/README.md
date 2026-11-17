# WP01 hosted browser leases

Product tests run only in GitHub Actions through the campaign's CI request. Do not execute this selection locally. Historical receipts retain their original selections and results; these leases supersede their launch mechanism for new runs.

Bun owns the file order of an admitted selection: the CI-SF suite is a whole-tree manifest selection of several hundred files that Bun runs concurrently and in an order that is neither the argument order nor alphabetical (measured: 910 selected files, first executed file at argument position 908). A browser therefore cannot be shared across files by position, and no file can be first or last. Every lease owns one Chromium:

- `launchWp01Browser()` starts the published WP02 Node browser driver through `AppProcess`, connects over the existing private Unix pipe, and returns the browser. Two files, or two tests, may hold a lease at the same time.
- `closeWp01Browser(browser)` closes that lease's pages and contexts, closes the driver scope, observes the disconnected event and the exit of the actual Chromium PID obtained through CDP, and returns the evidence. A second release of the same lease is a contract violation, never a no-op.
- `startWp01BrowserPool()` starts one Chromium without taking a lease; `browser-startup.test.ts` uses it to prove a fresh launch and then releases it.

The browser-startup test declares `expectSpawn(import.meta.path)` in its body and starts the driver for its own launch. Each acquisition has a 30-second deadline covering preparation, launch, connection and CDP PID acquisition; Node receives that deadline and recomputes the remaining launch time after its imports. The startup test allows 35 seconds. Other driver consumers retain their default and maximum acquisition budget of 15 seconds.

Failed startup cancels and awaits its owned AppProcess scope, then observes the known Node and browser PIDs using one shared five-second cleanup window measured from cancellation. `SF_BROWSER_DRIVER_STARTUP_CANCEL_CLEANUP` is a separate failure receipt, never a clean bridge or successful lifecycle proof. If the scope itself exceeds the window, its ownership is still awaited, the receipt is incomplete and no late probes claim an in-budget cleanup. Missing PIDs, observation errors and processes still present keep the failure. This deadline coordination does not establish or cure the cause of an operating-system I/O stall.

Each release retains the assertions for exactly one launch, one lease per release, no active context, the disconnected event and exit of the actual browser PID. It also requires the published driver to confirm clean Node, browser and transport shutdown. The driver's proof is emitted only after the release's assertions pass. These are test-browser observations; they do not prove native residents, models, business effect-once behavior or global integration. A process-exit handler terminates the browser PID of a lease whose test died, as a last-resort reaper only: it is never a lifecycle proof.

## Lease consumers

These 24 direct consumers identify the fixture's dependents. Select the consumers whose behavior changed or whose concrete failure needs resolution; file order no longer matters. Preserve independently affected product tests in that surgical request; do not run the whole group or add an equivalent browser run just because it leases a browser.

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

`preview-browser.test.ts` also has an independently owned Node driver for its in-flight command test. `personal-views.test.ts` uses its own published driver and does not lease this fixture. Their original spawn expectations and assertions remain separate.
