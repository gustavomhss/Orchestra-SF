# Operator browser dashboard never becomes ready

Verdict: the URL that timed out is `http://localhost:4110/sucafina/dashboard`. The job log does not record the URL Chrome was on. No wait change. No redirect change. No handler change.

## Evidence

Cited run [44329483839](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44329483839), job `sf/test-CI-SF-7` (`134890490891`), tested SHA `2e5839eebb859969851b81aaa29f4f71b4c49d71`. This note is on `sf-operator-browser` from `origin/sf-red-clusters` `f88dd671b3bedf4ffffa50eafaec78068fc33cb3`. These files are identical between the two SHAs: `modules/sucafina/Sucafinav1/test/operator-browser.test.ts`, `local/enroll.ts`, `runtime/operator-identity.ts`, `local/entry.ts`, `runtime/local-configuration.ts`.

The only failure in that test file is:

```
29 |     await page.goto(pathToFileURL(access.artifact).href)
30 |     await page.waitForURL("http://localhost:4110/sucafina/dashboard")
TimeoutError: forURL: Timeout 30000ms exceeded.
waiting for navigation to "http://localhost:4110/sucafina/dashboard" until "load"
(fail) Chrome follows the private enrollment gateway into actual HTML screens without Microsoft [49531.08ms]
```

`page.goto` on the file artifact returned. The 30000ms wait is Playwright's `waitForURL` default, not the 60000ms test budget. The log has no `page.url()`, no status, and no `Location`.

## What the source does instead of that URL

`prepareOperatorAccess` writes `open-local.html` whose script is `location.replace` of `` `${config.mount}/auth/local?code=` `` (`local/enroll.ts`). `prepareLocalConfiguration` fixes origin `http://localhost:4110` and mount `/sucafina` (`runtime/local-configuration.ts`). The artifact therefore navigates to `http://localhost:4110/sucafina/auth/local?code=<64 hex>`, not to `/sucafina/dashboard`.

`createOperatorIdentity` handles only paths under `/sucafina/auth/`. A valid one-time code redeems to `303` with `Location: /` (`runtime/operator-identity.ts`). The comment there says enrollment opens the Orchestra shell and `/sucafina/*` stays a legacy console. A missing or invalid code is `403` with body `Local authentication unavailable`, still on `/sucafina/auth/local`.

`GET /` does not start with `/sucafina/auth/`, so `identity.handle` returns undefined. The test listener is `installation.handler(request) ?? new Response(null, { status: 404 })` (`test/operator-browser.test.ts`). Neither a 403 on auth/local nor a 303 to `/` is `http://localhost:4110/sucafina/dashboard`.

## Stop

The landed URL is unproven. Do not retarget `waitForURL`. Do not point `Location` at `/sucafina/dashboard`. Do not raise the 30000ms timeout. No `bun test`, Playwright, e2e, `bun run test:ci`, or workflow was run.
