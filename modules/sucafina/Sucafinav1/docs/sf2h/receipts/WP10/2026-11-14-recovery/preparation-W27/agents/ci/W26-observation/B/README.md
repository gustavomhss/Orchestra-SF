# W26 B — hosted calculation observation

The immutable W26 calculation run completed with **38 pass / 2 fail**, 40 tests across seven whole files, 533 expectations and 1420.51 seconds. No additional unhandled error was reported. WP10 owns 28 passes and one failure; WP11 owns ten passes and one failure. The run remains FAILURE.

The own `calculation-ancestry-composition.test.ts` reached its existing 105000 ms cooperative deadline during `produce-outer`: 101691 ms in that phase, 373 actual `readForCalculation` calls and 373 completions, aborted true. `produce-inner` completed in 3270 ms with 14 calls. Outer success, reopened ancestry, persisted-cycle refusal and final revocation were not reached. Counts are API invocations, not unique results or physical I/O.

The foreign `calculation-persistence.test.ts` reported Bun timeout after 180000 ms, with named-test duration 188985.84 ms. Its source directly composes the Planner calculation producer, result/request stores and WP05 fixture, without `createSfBusinessServices`. Its internal timeout phase is unknown. Similar nested-ancestry timeouts do not alone prove a single shared defect or justify assigning both exclusively to an own wrapper.

The other files passed: WP11 scenario-batch 9/9 and calculation-history 1/1; own planner-recorded-history 2/2, calculation-case-scope 5/5 and planner-calculation 21/21. Omni positive control passed with 23 declaring tests, 46 spawns and zero delegations. This is not native-inference or global acceptance.

W `a1434e7ea7340aa1d1c8ce6bb48958b724218170`; snapshot `edc61b259cc0479d1916a7dd3a2e2ee89d7724a9`; run 43620440087; test job 132524715232. Cleanup job 132531826661 and snapshot-branch deletion succeeded. GitHub returned zero artifacts. Raw UTF-8/LF bytes, complete metadata and strict normalized inventory/counts are preserved. No source was changed, no product was executed locally and no remote mutation occurred.
