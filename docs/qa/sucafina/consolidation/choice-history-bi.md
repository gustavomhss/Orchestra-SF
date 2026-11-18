# Choice-history BI timeout

Proven from run `44329483839` job `sf/test-CI-SF-8` (job `134890490924`, local log `/tmp/ci-sf8.log`) on SHA `2e5839eebb859969851b81aaa29f4f71b4c49d71`. `local-browser.ts`, `browser.ts`, and `choice-history-bi.test.ts` are unchanged from base `f88dd671b3`. No writer edit. Timeouts were not raised.

## What failed

`same-case BI preserves the human choice while the confirmed training revision changes its current source result and table` in `modules/sucafina/Sucafinav1/test/product/wp05/choice-history-bi.test.ts:42` timed out after 180000ms.

The group starts at `15:07:32.055`. Renewal prepare finishes at `15:07:37.960` (`prepare:transition-omitted:complete`, 5893ms). The next lines are `WP05 browser phase` `same-case before training` / `fixture-setup`, then `browser fixture: direct pipe Chrome launch` at `15:07:38.576`. The test timeout is `15:10:32.062` (`180001.15ms`). No `module-import` phase is logged. The BI table assertions never start.

## Unsettled await

`modules/sucafina/Sucafinav1/test/fixture/local-browser.ts:70`

```ts
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
```

Call path: `choice-history-bi.test.ts:63` `await renderObservation(...)` → `browser.ts:8` `await localBrowser()` → `localBrowser` line 70. The console line immediately above the await is the last progress line before the silence.

## Why it does not settle

Chrome pid 3556 was launched and exited 0 in that same second. The Playwright call log, printed only when the launch promise later rejects, records:

- `<launched> pid=3556` at `1118/150738.605972`
- `devtools_pipe_handler.cc:188` `Connection terminated while reading from pipe` at `150738.697179`
- `<process did exit: exitCode=0, signal=null>` at `150738.711`

The launch promise does not reject on that exit. It stays pending until Playwright's default 180000ms launch timeout. That rejection is logged at `15:10:48.911`, `elapsedMs: 190369`, as `TimeoutError: launch: Timeout 180000ms exceeded`, stack `localBrowser` `local-browser.ts:70:36`, inside the `browser.ts:8` catch. The test timeout at line 110 is also 180000ms and fires first, so bun reports a timeout while this await is still pending. It settles about 16s later, during a later test, not when Chrome exits.

## Not run

No `bun test`, `bun run test:ci`, `gh workflow run`, or new CI. `planner-sensitivity.ts` was not edited.
