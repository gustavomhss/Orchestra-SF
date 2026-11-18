# Private browser enrollment HTTP failure

Verdict: the shard log plus the auth/local handler do not prove which non-2xx Chrome rejected. No handler change. No fixture change. Landing stays `/`.

## Evidence

Cited run [44329483839](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44329483839) on tested SHA `2e5839eebb859969851b81aaa29f4f71b4c49d71`. Failure map: `origin/sf-failure-map` `2f30a186fb`. This note was written on `origin/sf-red-clusters` `109dcdd6a39f565c95a487f566f665df1523a4a2`.

Artifacts, no other log:

- `sf-shard-failure-CI-SF-2` — `test/product/wp05/sensitivity-integration.test.ts` (2), `test/local-controls-browser.test.ts`, `test/product/wp05/procurement-stages.test.ts`
- `sf-shard-failure-CI-SF-8` — `test/form-layout.test.ts`, `test/product/wp05/planner-origins.test.ts`
- `sf-shard-failure-CI-SF-7` — `test/product/wp05/contributions-browser.test.ts`

`local-browser.ts`, `operator-identity.ts`, `local/entry.ts`, and `runtime/application.ts` are unchanged between the tested SHA and this base. The stack in each artifact is the current file: the catch at `modules/sucafina/Sucafinav1/test/fixture/local-browser.ts:196`.

Every failure is the same line, with a 64-hex `code`:

```
error: Private test browser enrollment failed: goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at http://localhost:4110/sucafina/auth/local?code=…
Call log:
  - navigating to "http://localhost:4110/sucafina/auth/local?code=…", waiting until "domcontentloaded"
```

The group contains `browser fixture: private enrollment navigation` and then cleanup. It has no status, no `Location`, no response body, and no server stack. The status check at line 197 never runs, because `Promise.all` rejects inside the catch and drops `waitForResponse`.

Playwright's Chromium delegate reports `Page.navigate` as `` `${errorText} at ${url}` ``, and `url` is the argument to `page.goto`, not the hop that returned the error. `net::ERR_HTTP_RESPONSE_CODE_FAILURE` means some document in that navigation was status >= 400. The printed URL does not say which one.

## What that request can return

The logged request is `GET http://localhost:4110/sucafina/auth/local?code=<64 hex>`. The fixture reached navigation, so `createLocalInstallation` had already accepted that origin. The operator GET path in `local/entry.ts:283-287` does not 403 that request before `identity.handle`.

`operator-identity.ts` then has two exits that are both empty and both >= 400 or a redirect Chrome will follow:

- `secrets.take` misses, or the seal does not validate: 403 (`operator-identity.ts:94-97`)
- redemption succeeds: 303, `Location: /`, null body (`operator-identity.ts:109-111`)

`/` is outside the mount. `createApplication` returns undefined (`runtime/application.ts:56`). Native projections do not match `/`. `identity.handle` returns undefined. `local/entry.ts` returns that undefined response. The fixture listener is:

```ts
await installation.handler(request) ?? new Response(null, { status: 404 })
```

(`local-browser.ts:65`). A followed 303 therefore loads an empty 404. An empty 4xx is the same Chrome error this repository already records for an empty 403 and an empty 503.

Those two responses produce the same logged line:

1. `/sucafina/auth/local` itself returns 403.
2. `/sucafina/auth/local` returns 303 to `/`, and the fixture returns 404 for `/`.

The log does not say which. The handler does not say which ran.

## Stop

Do not point `Location` at `/dashboard`. Do not change the expected landing from `/` to `/dashboard`. Do not weaken the 303 check. No `bun test`, Playwright, e2e, `bun run test:ci`, or workflow was run.
