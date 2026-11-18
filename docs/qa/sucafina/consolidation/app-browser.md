# CI-APP-BROWSER

Evidence is job `134890490385` of run `44329483839` (`gh run view --repo gustavomhss/Orchestra-SF --job 134890490385 --log-failed`). The job checked out `2e5839eebb`. This lane launched no test, Playwright, e2e, `test:ci`, or workflow.

## The log does not contain the enrollment cause

`8f158cc097` (`test(sf): surface why private browser enrollment never returns`) is an ancestor of that checkout. The job never reached `modules/sucafina/Sucafinav1/test/fixture/local-browser.ts`. The log has no `Private test browser enrollment failed` line, no enrollment status, and no navigation timeout from that fixture.

The suite died first in `packages/app-shell` browser tests and bailed. The repeated error is:

```
SyntaxError: Export named 'Either' not found in module '/home/runner/work/Orchestra-SF/Orchestra-SF/node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/index.js'.
```

Files the log names:

- `packages/app-shell/test-browser/sucafina-native/files-route.test.ts` — unhandled error between tests
- `packages/app-shell/test-browser/sucafina-native/routines-route.test.ts` — same
- `packages/app-shell/test-browser/sucafina-native/memory-route.test.ts` — same
- `packages/app-shell/test-browser/sucafina-native/procurement-draft-leaves.test.ts` — same, then `(fail) procurement draft leaves in the browser lane` because the nested `bun test` exited 1 (`Expected: 0`, `Received: 1`)
- `packages/app-shell/test-browser/sucafina-native/draft-quarantine.test.ts` — same; bail

`transport-contract.test.ts` passed (2). `Ran 7 tests across 6 files. Bailed out after 5 failures.`

## Stop

This lane may edit `local-browser.ts` and the spec the log names. The logged error is an Effect export under `--conditions=browser`, not an enrollment target or an assertion in those files. Enrollment stays on `/`. No assertion was weakened. No patch.
