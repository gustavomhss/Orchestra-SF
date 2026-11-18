# mixed-recorded-fallback cooperative deadline

Run `44329483839` job `sf/test-CI-SF-2` (`134890490763`), head `2e5839eebb859969851b81aaa29f4f71b4c49d71`. This branch is `f88dd671b3`, which contains that commit. `recorded-fallback.test.ts` and `composition-test-deadline.ts` are identical at both SHAs.

The failing test is the first one in `test/product/mixed-source-contracts/recorded-fallback.test.ts`. Bun printed `mixed-recorded-fallback exceeded its 165000ms cooperative deadline` and the stack of the `Error` constructed at `composition-test-deadline.ts:5` (caller `recorded-fallback.test.ts:11`). That stack is the construction site, not the throw site. `deadline.close()` throws `AggregateError([deadlineError], "... deadline or cleanup failed")` when elapsed time is already over the budget. The runner prints the inner error, so the log does not distinguish `signal.throwIfAborted()` from `close()`.

Phase log (aborted false on every return):

| phase | elapsed at return | phaseMs |
| --- | ---: | ---: |
| real-mixed-producers | 713 | 713 |
| actual-capture | 3313 | 2466 |
| historical-amount-fallback | 17099 | 13695 |
| historical-base-fallback | 48918 | 22338 |
| installed-case-read | 113677 | 64748 |

`SF_MIXED_RECORDED_PROOF` for `real-planner-archive-current-procurement` was written at about 165497ms, 16ms before the error, and the test was marked fail at 165514.16ms. That proof is the last statement of the `try`, after `await f.preview()` (`recorded-fallback.test.ts:60`) and `await f.audit()` (`recorded-fallback.test.ts:62`). Both of those awaits settled. `deadline.close()` then ran and failed the test because `performance.now() - started >= 165000`. Cleanup did not hang: the next test in the file started in the same millisecond as the fail line.

No phase await was still pending. The 165000ms mark falls in the unphased gap after `installed-case-read` returned (51323ms of a 51820ms gap). The only awaits in that gap are `f.preview()` and `f.audit()`. Which of those two had not returned at 165000ms is not in the log. `f.audit()` is three read-only persistence transactions; the earlier unphased gap that contains two audits, `setForecast`, and two context resolves is only 9481ms. `f.preview()` is `withCase`, whose first await is another `cases.read` (`apps/cli/src/sucafina-product/business-services.ts:274`) followed by `simulateScenario`. The phased `cases.read` just before it took 64748ms, so `await f.preview()` is the likely in-flight await, but that is not a proof, and the inner await inside preview is not identified. Neither await failed to settle: the proof ran.

The deadline was not raised. The product test was not re-run. No `test:ci` and no workflow dispatch.
