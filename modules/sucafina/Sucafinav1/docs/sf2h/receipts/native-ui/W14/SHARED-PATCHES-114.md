# W14 → 114 · Shared integration fragments (DO NOT apply blindly)

W14 did not edit any shared registry, package export map, router, generated SDK or host composition. The integrator **114 only** applies after validating pre/post images against its live HEAD, F01/F02 contractual implementation and per-output admission. Do not cherry-pick a shared patch without reconciling later edits.

## 1. Schema export map — insert exact entry (at current W14 preimage)

Preimage path: `packages/schema/package.json`, blob `adc53ecfa8f4ac83fee37854db2dc0ec2bb9136a`

```diff
--- a/packages/schema/package.json
+++ b/packages/schema/package.json
@@
   "exports": {
     ".": "./src/index.ts",
+    "./sucafina/domain": "./src/sucafina/domain.ts",
```

Postcondition: same export map as current 114 HEAD plus one uniquely keyed leaf `./sucafina/domain`; no wildcard. Resolve duplicate-key or drift conflicts before applying.

## 2. Client export map — insert exact entry (at current W14 preimage)

Preimage path: `packages/client/package.json`, blob `4cd0244e98ff18b5e65d3c2808196705095b6691`

```diff
--- a/packages/client/package.json
+++ b/packages/client/package.json
@@
   "exports": {
     ".": "./src/index.ts",
+    "./sucafina/domain": "./src/sucafina/domain.ts",
```

Postcondition: only the A01 client path added to existing 114 export map, preserving later entries.

## 3. I00 schema operation bindings — insert 57 concrete codecs, NOT an all-allow fallback

At the first W14 source HEAD, `packages/schema/src/sucafina/index.ts` has **no preimage**; F02/I00 must create and own it. Never invent a patch hunk for a missing file. Import `SfDomain` from `./domain.ts` and register **exactly the keys of `SfDomain.operations`** using each same-name operation's input/output codec and method/headers/responseMode metadata from pinned catalog `31dbec1726fd8147156b01dc545726650ffd49e1`. Decode unknown request and response strictly with no excess properties; no generic JSON fallback; absent F01/F02 stays `contract-unavailable`.

## 4. I00 CLI host composition

At W14 source HEAD, `apps/cli/src/sucafina-product/native-ui/router.ts` has **no preimage**. Its owner 114/F02 must provide normative `SfNativeHostDependencies` and `SfProjectionHandler` as frozen in `CONTRACTS.md§6.1`. Then compose exactly once:

```ts
import { createSfDomainProjectionHandlers } from "./native-ui/domain.ts"

const domainHandlers = createSfDomainProjectionHandlers({
  origin, mount, application, runtime, readContext,
})
// Append ...domainHandlers to the single 114-owned
// mountSfNativeProjections(...handlers) list (not a new dispatcher).
```

A01 handlers: ten GET paths `{mount}/api/ui/pages/CAPxx` and one `{mount}/api/ui/projections/local-admin`. F01 `readContext(request)` must bind to current identity + owner, run real bootstrap/auth and admission on the same ORIGINAL Request. F02 transport applies *fixed* POST legacy `{mount}/dashboard` page/action or sf query discriminators, with idempotency policy and source results preserved. Do not call legacy handler via a constructed Request.

## 5. Producer port blocker: local-admin

`projection.local-admin` is cataloged but operator's `jobs.inbox`, `backups.list`, `jobs.status`, durable snapshot version, and `identity.person` are private to `modules/sucafina/Sucafinav1/local/entry.ts`. No such reader is in the frozen `SfNativeHostDependencies`; W14 returns a typed 503 unavailable for authorized local operator, typed 403 denied for others. 114 must obtain an **explicit, source-authorized private read adapter** from the existing entry (or reconcile contract/admission) with real operator identity, no path/bytes/secret and current recheck before replacing the 503 branch. No synthetic empty list, generic handler forwarding, HTML parsing, duplicate persistence instance, or separate operator backend.

## 6. Typecheck / Actions

119 owns compiler + guards, and should verify Effect v4 Schema type compatibility, schema package export reconciliation, no Core/server references in browser and all 57 input/output bindings. 120 owns surgical `test:ci/request` for `modules/sucafina/Sucafinav1/test/native-ui-contract/domain.test.ts`, deduping selections; these are component tests only. Compose F01/F02/I00 first for installed-flow proofs. W14 performed **no local tests, merge, deploy or Azure**.

Source delta and implementation evidence: `SOURCE-DELTA.json`, `HANDOFF.json`. 
