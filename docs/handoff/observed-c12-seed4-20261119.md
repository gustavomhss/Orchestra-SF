# C12 native4 original seed diagnostic

Run 44615470853; artifact 14575215300. Original failure only; no test rerun.

## test-ci-evidence/playwright-runtime.json named attachment

245 |   if (saved.status !== "ok") throw new Error(`decision fixture persistence unavailable: ${saved.status}`)
247 |   // Surface the real HTTP body, not only Bun\'s status assertion: a 400 can be
249 |   if (prepared.response.status !== 200 || prepared.body.status !== "ok") throw new Error(`real C12 prepare rejected: HTTP ${prepared.response.status}; body=${JSON.stringify(prepared.body)}`)
error: real C12 prepare rejected: HTTP 403; body={"status":"denied","reason":"case-selection-unavailable"}
      at prepareC12Change (/home/runner/work/Orchestra-SF/Orchestra-SF/modules/sucafina/Sucafinav1/test/product/c12-receipt-recovery/fixture.ts:249:84)

