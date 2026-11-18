# BI09 installed-browser deadline

Unproven below the phase boundary. No writer edit. Do not raise the 105000ms cooperative deadline.

## Evidence

Run `44329483839`, job `sf/test-CI-SF-7` (`134890490891`), head `2e5839eebb859969851b81aaa29f4f71b4c49d71`. The rendering test and fixture are unchanged from that SHA through `707ce445dc`.

`bi09-installed-browser` phase log:

- `comparison.persist` returned, `phaseMs` 39967, `elapsedMs` 47032, `aborted` false.
- `BI09.dispatch` started at `elapsedMs` 47033.
- `BI09.dispatch` returned at `elapsedMs` 105017, `phaseMs` 57984, `aborted` true.
- No log between those two lines. `browser.bundle` never started.

`bi09-missing-browser` repeats it: dispatch started at `elapsedMs` 47130 and returned aborted at `elapsedMs` 105011, `phaseMs` 57881.

`compositionTestDeadline` logs `returned` only from the phase `finally`, after `await work()` settles. The deadline timer aborts `deadline.signal` at 105000ms. The phase settled because that abort fired, not because dispatch finished.

The Bun frame `rendering.test.ts:20` is the `new Error` construction site inside `compositionTestDeadline`, not an inner await.

## The await that does not settle

`rendering.test.ts:17`:

`await deadline.phase("BI09.dispatch", () => fixture.dispatch())`

That is `fixture.ts:141`:

`return bi.dispatchPresentation(request, await admit(request))`

`admit` (`fixture.ts:135`) is `authority.ui.admit`. It has no queue; it returns when authorize and command identity return. The 58s gap is `bi.dispatchPresentation`.

The fixture selection is `{ scenarioResultRef, comparisonRef }` with no `advantageComparisonRef`, so `bi-services.ts:167` takes `callScope.run(request, call, dispatch)`, and `dispatch` is `dispatchBiPresentation` (`consumer.ts:28` and `:37`). Those two awaits, and every await under the scenario-cost `readView`, are inside the one unphased call. CI does not name which of them was in flight.

## Ruled out as the 58s waiter

- `waitForAdmission` / `retryLock` in `runtime/local-store.ts`. The store lock timeout is 5000ms. A single lock wait would have rejected near elapsed 52s, not 105s.
- `withCase` denies when a scope is already held. It does not wait.
- The portfolio comparison scope returns denied on a recursive read. It does not wait.
- Chromium. Launch is a later phase and never started.

`comparison.persist` did settle. It is `portfolio.compare` plus `calculations.persist` (`fixture.ts:126`). It is not the failed await. It consumed 40s of the 105s budget. That does not explain an await that stays pending until abort.

## Not run

No `bun test`, `bun run test:ci`, `gh workflow run`, or new CI.
