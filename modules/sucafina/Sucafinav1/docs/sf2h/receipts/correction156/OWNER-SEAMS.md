# Mission 156 — precise inert owner seams (not deployed)

Epoch: `ux-native-n10-e2-browser156`. Source-ready N10 consumer lives in **PR #147**; neither seam below has been written into its owner paths. The existing route/host definitions remain authoritative. Integrator **132** coordinates; **153/A12** owns the transport adaptation. This note is a concrete change proposal, not an approved API, successful request, installed host or validation receipt.

## A. PRE-R01-146-003 — preserve the same producer, move free text from URI to bounded POST body

**Verified preimages (unchanged by 156):**

- `packages/schema/src/sucafina/operation-registry.ts`: blob `e18f1fa448b7fcff8a2691dd1b0778640b3f6a84` (in `sf2-stack` and N10). The `projection.search` metadata is `GET`, path `{mount}/api/ui/projections/search`, effect `read`.
- `apps/cli/src/sucafina-product/native-ui/work.ts`: blob `402b8a4599807d403065e561a427e230ae5981cb`, query() currently accepts GET/HEAD and search reads `q` from URL.
- `packages/client/src/sucafina/transport.ts`: blob `ff509a7b742b81939a15f0439ca7f4a3d4b858e9`; for GET, operationUrl() serializes `q` to URLSearchParams; for POST-read, it already uses JSON body and generates a single Idempotency-Key.
- `packages/schema/src/sucafina/work.ts`: blob `0fa4c0cd2fc8a7c2d4b5502cd2ccfbb1d0fbe77b`, `SfProjectionSearch.Input` is the closed `{ q: string }` input; its real producer remains `sf_knowledge_search`.

**Exact metadata replacement for 132/153** (no alternative path, same operationId, read effect, response shape):

```diff
-  "projection.search": {"method":"GET","pathTemplate":"{mount}/api/ui/projections/search","effect":"read","responseMode":"json"},
+  "projection.search": {"method":"POST","pathTemplate":"{mount}/api/ui/projections/search","effect":"read","responseMode":"json","maxRequestBytes":4096},
```

**Server-side patch to incorporate into 153's canonical `work.ts`**: keep `request` original throughout `ui.admit/revalidate/finish`, keep `sf_knowledge_search` dispatch and decoded output unchanged, and never use `request.url.searchParams` for search. This full bounded input reader uses only existing `failure()` and `SfNativeHostDependencies`:

```ts
async function privateSearchInput(
  request: Request, deps: SfNativeHostDependencies,
): Promise<string | Response> {
  const url = new URL(request.url)
  if (url.origin !== deps.origin ||
      url.pathname !== String(deps.mount).replace(/\/$/, "") + "/api/ui/projections/search" ||
      url.search !== "" || url.hash !== "" ||
      request.headers.get("sec-fetch-site") === "cross-site" ||
      request.signal.aborted) return failure(request, "denied")
  if (request.method !== "POST" ||
      request.headers.get("content-type") !== "application/json" ||
      !/^[A-Za-z0-9._:-]{8,128}$/.test(request.headers.get("idempotency-key") ?? "") ||
      !request.body) return failure(request, "invalid")
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const part = await reader.read()
      if (part.done) break
      length += part.value.byteLength
      if (length > 4096) {
        await reader.cancel()
        return failure(request, "invalid")
      }
      chunks.push(part.value)
      if (request.signal.aborted) return failure(request, "unavailable")
    }
  } catch {
    return failure(request, "invalid")
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const part of chunks) {
    bytes.set(part, offset)
    offset += part.byteLength
  }
  let value: unknown
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch {
    return failure(request, "invalid")
  }
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== 1 || !("q" in value) ||
      typeof value.q !== "string" || !value.q.trim() ||
      value.q.length > 500) return failure(request, "invalid")
  return value.q
}
```

**Exact call-site replacements** in `apps/cli/src/sucafina-product/native-ui/work.ts`:

```diff
 const keys: Readonly<Record<WorkProjection, readonly string[]>> = {
   home: [],
-  search: ["q"],
+  search: [],
   work: ["selectionRef", "start", "end"],
   "work-selection": ["start", "end"],
 }
```

At the top of the existing synchronous `query(request,deps,mode)`, reject search as an uncallable GET fallback:

```ts
if (mode === "search") return failure(request, "invalid")
```

Delete the now-dead `if (mode === "search" && !(url.searchParams.get("q") ?? "").trim())` check from `query`. Change `search(request,runtime,params: URLSearchParams)` to `search(request,runtime,q: string)` and replace its `decodeSfOperationInput` argument with `{ query: q, limit: 20 }` (all authorization/digest/revalidation and response mapping remain byte-for-byte unchanged). In the registered `handle: async (request) => { ... }` body replace the current `const parsed = query(request,deps,mode)` with:

```ts
const parsed = mode === "search"
  ? await privateSearchInput(request, deps)
  : query(request, deps, mode)
if (parsed instanceof Response) return parsed
const runtime = currentHost(deps)
if (!runtime) return failure(request, "unavailable")
try {
  if (mode === "search") {
    if (typeof parsed !== "string") return failure(request, "invalid")
    return await search(request, runtime, parsed)
  }
  if (typeof parsed === "string") return failure(request, "invalid")
  if (mode === "home") return await home(request, runtime)
  if (mode === "work") return await work(request, runtime, parsed)
  return await workSelection(request, runtime, parsed)
} catch {
  return failure(request, "unavailable")
}
```

Keep return list `handler("home"), handler("search"), handler("work"), handler("work-selection")`. **Do not** create a second REST endpoint, replace the producer with mock data, put free text in a GET query, store a search query in URL/localStorage or log the request body. The current N10 UI only sends `{ q }` when the installed registry advertises POST-read, the exact existing path, no fixed query, no fixed body discriminator, and a bounded body size between 2048 and 8192 bytes. It deliberately fails closed against current GET.

**Owner proof still required:** 153 verifies actual source request admission and the same exact closed body decoder; 132 publishes the registry/codec as a coherent unit; D01 desktop broker maps the existing operationId to POST body without URL reflection; 149 compile and 150/Q01/Q02 capture HTTP/desktop *request URI, Referer, intermediary/host diagnostics* and verify redaction and no raw text. Never claim response `no-store` alone solves URI privacy. An operator may choose another source-admitted path only via a new frozen owner contract and matching N10 consumer; this text does not authorize such an alternative.

## B. PRE-R01-146-005 — I00/F01 owner-aware case resume/return/focus

**Verified existing sources:** `SfProjectionHome.Output.value.cases.items[]` includes `caseRef,title,version` (`work.ts` above). `packages/app-shell/src/orchestra/chapters/sucafina/route-registry.ts` blob `c70c68fee7eb3e944c432ad636ef9ba30571b425` recognizes `UI34:entry` at `/orchestra/sf-decisions/:caseRef`; `navigation-state/index.ts` blob `dc264d8c97163922134d09285e1c8d3a38027760` publishes `encodeSfRouteRef`, `requestNativeTransition`, `rememberReturn`, `consumeReturn`, `remember`, `restore`. **However** F01's current `SfContextHandle` (`context/contracts.ts` blob `592eef8206c665a1fc908934e258b286fe85609e`) exposes no builder, transition callback or resume action to a leaf. Thus N10 cannot honestly navigate until 132 wires the port.

The **precise consumer signature**, already exported by `home/index.tsx` and guarded with `hasResumePort(owner)`, is:

```ts
type ResumeRequest = Readonly<{
  caseRef: string                 // authorized original projection caseRef, never title
  sourceVersion: number           // observed case version, never a grant
  ownerKey: SfOwnerKey            // current F01 ownerKey, not a client-made token
  sourceStamp: SfContextStamp     // current installation/project/host/principal/policy/access revision
  returnRoute: SfResolvedRoute<"UI29"> // current validated same-owner route
  focusCaseRef: string            // original caseRef, in-memory return focus identity
}>
type ResumeResult = Readonly<{
  status: "committed" | "aborted" | "kept-editing" | "denied" |
    "not-found" | "invalid-link" | "unavailable"
}>
type SfTodayResumePort = Readonly<{
  resumeCase(request: ResumeRequest, signal: AbortSignal): Promise<ResumeResult>
}>
```

**132 implementation contract (proposed owner-side adapter, not an approved export):**

1. Publish a typed F01/I00 navigation port on the current `SfContextHandle` (the N10 leaf checks for its existence before showing any action). Keep the frozen `SfSurfaceProps<"UI29">` unchanged: only `{surfaceId,route}`. Do not add a separate route to N10, add arbitrary leaf props, or use `window.location.assign`.
2. For a request, check `ownerKey` still current and `sourceStamp` equals fresh selected server/project/installation/principal/access revision/policy; compare `request.returnRoute` to the same owner selection. The observed `sourceVersion` is not permission. Verify source caseRef access **now** via existing authorized `sf_case_read`/UI34 admission, and distinguish only producer-confirmed removal from denied/unavailable.
3. Use I00's canonical `sfNativeRouteSpecs` **UI34/entry** route builder, F01 `encodeSfRouteRef(caseRef)`, `URLSearchParams` for the exact validated owner tuple `server,project,installation`, and an explicit *same-owner* resolver. Never concatenate a destination in the leaf, never derive caseRef from title, never move principal/grants/private text into URL.
4. Mint `returnRef = navigation.rememberReturn(currentOwnerKey, request.returnRoute.href)` in ephemeral owner memory. Associate it with history navigation state (not new unapproved query params); remember `focusCaseRef` (plus scroll, if authorized) using `navigation.remember` under current owner/accessRevision/scope. Transition with `navigation.requestNativeTransition(destination, "link")`. Map actual `committed/aborted/denied/unavailable/invalid-link/kept-editing` results; `not-found` only on authoritative confirmed removed.
5. On back/close, use `consumeReturn(returnRef, currentOwnerKey)` and `restore(currentOwnerKey,...currentAccessRevision...)`. Restore focus by **caseRef match on the newly authorized list**, not DOM order or title; if case removed, focus the Cases heading/list instead. Owner change/revocation purges return and focus; target denial removes its private title/version from the N10 in-memory list.
6. Preserve current native route resolver's dirty-draft guard, owner invalidation before new commit, 320px keyboard behavior, and return route regardless of title changes. Do not turn a denied/removed case into a different case or fall back to another owner.

N10 source already renders an accessible, labeled `Resume case: {title}` button **only** when the real owner port exists, preserves the frozen surface props, passes actual `caseRef/sourceVersion/ownerKey/stamp/returnRoute/focusCaseRef`, fences late callbacks by generation/abort, and scrubs a denied/removed case from the local projection. Without owner port it renders an explicit unavailable status; this is **BLOCKED_OWNER** for end-to-end functionality, **not** an approved 005 resolution.

## Pre/post and review

N10 source+spec diff is the actual commit `683c1ae0f7e8c602a2c982b52f93ed444057c11a`, whose tree is `297486844c581dabe98c9abae8cda8149a7aa818`. 132 must cherry-pick/integrate the existing **PR #147** through its own protocol; 153 owns foreign transport/registry edits. 149 performs compiler checks, 150 the only surgical CI. This file has no executable authority outside `receipts/correction156/` and cannot replace source review or independent integration gates.
