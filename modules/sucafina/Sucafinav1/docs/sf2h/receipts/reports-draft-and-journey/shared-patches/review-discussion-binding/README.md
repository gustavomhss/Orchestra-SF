# Mission36: proposed shared patch for review discussion recovery

Status: **PROPOSED_NOT_APPLIED**. Owner of consumption: **session33**.

This bundle is based on the coherent C6 commit `52add8433f8ecf9d361ee635cda484142131ef84`, tree `efec3fadd92b1507a1c42bdf5aad48b7e778c17d`, in `gustavomhss/Orchestra-SF`. It preserves the Reports composition delivered by mission25. It does not recreate that composition or change a shared production path.

The complete preimages and postimages are in `preimage/` and `postimage/`. Source images end in `.ts.txt` so TypeScript source globs cannot include them; each manifest `path` retains its real `.ts` application target. The complete unified diff is `review-discussion-binding.patch`. `manifest.json` records every source path, C6 Git blob, postimage Git blob, byte length and SHA256. Each preimage was checked against its recorded Git blob as artifact processing; no tests or application server ran locally.

## Boundary contract

The owned Reports discussion client and this patch share the following contract.

| Item | Exact contract |
| --- | --- |
| Request header | `X-SF-Review-Binding` |
| Value | The unchanged `document.querySelector('meta[name="sf-access-revision"]').content`: a lowercase 64-hex digest. No JSON, base64 or new client principal. |
| Before an operation | If the header is present, the HTTP boundary rejects malformed values or values different from `admitted.value.binding.accessRevision` before calling the route producer. Admission and current producer authorization remain mandatory. |
| Mismatch result | HTTP 403 with `{"status":"denied","reason":"review-discussion-binding-changed"}`. The new identity is not returned on this denial. |
| Successful collaboration result | Echo `X-SF-Review-Binding` from the admitted binding. The new client requires exact agreement with its initial revision and a live view generation before using the result. |
| Successful review context result | The `review-thread-context` branch performs the same expected-binding check and echoes the admitted binding. |
| Existing consumer | A request without the header follows existing C6 admission. This does not broaden existing authority. |
| New client on unpatched C6 | Its mandatory read-only recipients preflight cannot verify the missing echo. It must purge/close before any mutation. This is an explicit shared dependency, not a successful integration result. |

C6 `product/integration/product-authority.ts`, blob `2c82d60d220d8d5365da8322bad648a64bbb62d2`, computes this access revision from installation, project, authenticated principal, surface roles, assigned/domain scope, write ability, namespace/operation/human-action grants and policy version. The browser supplies only an expected value. The server does not turn that value into authority.

C6 `src/screen-shell.ts`, blob `c57e1f01044d12bf5c86bb5d7d68408950a83fc1`, writes the same value to the meta element. DOM `.content` provides the original value after HTML attribute decoding. The extended page already returns it as `X-SF-Access-Revision`.

## Proposed changes

1. `product/collaboration/http.ts` checks the expected binding after real admission and before the producer. Results from a matching admitted request carry the echo. It retains all existing origin, method, shape, human-action, cancellation and finish checks.
2. `product/reviews/http.ts` adds the same check and success echo only to `review-thread-context`, which is called by the same discussion client.
3. `product/collaboration/thread-history.ts` preserves producer/C08 failure results instead of translating them to generic `unavailable`. This makes a real CAS conflict HTTP 409 and an actual denied result HTTP 403. It does not change transaction keys, command digests, storage versions, edit authorization or history writes.
4. `apps/cli/src/sucafina-product/extended-browser.ts` captures the initial meta revision and compares a successful focus probe against `X-SF-Access-Revision`. A changed or missing revision clears the view and dispatches the existing `sf-access-revoked` event. A network failure remains a transport failure, not fabricated proof of revocation.

## Real result semantics

The collaboration HTTP adapter maps successful results to HTTP 200, `needs-input` to 400, `denied` to 403, `stale`/`conflict`/`provider-conflict` to 409, and `unavailable` to 503. A transport exception or lost/invalid body does not prove whether a mutation committed.

C6 `product/host-binding/state-provider.ts`, blob `71ce2ba1b04d3c7f63f7c444ca23dd084a8e2b0c`, indexes durable transactions by `[authenticatedPrincipal, namespace, targetRef, idempotencyKey]`. Replay checks command digest, target incarnation, scope digest and current authority before returning the original durable value. It checks for replay before the expected storage version. The replay does not run the mutation callback.

C05 review threads take the historical thread shape through `thread-reads.ts`, blob `5d3ad37709fff05625877ecd90768d7253ce3735`. That shape omits `current`, so `http-routes.ts`, blob `a266e12bd80a2ff95922c2492225ced86eda3ac3`, selects `threads.reply`, not the separate recipient mutation receipt path. A review reply returns a thread snapshot and an edit returns `{id,messageId,version}`; neither is a public read-only transaction receipt lookup. The separate `RecipientMutationReceipt` must not be invented or assumed for this route.

Consequently the browser must preserve the original intent, exact text, mutation key and serialized payload after an uncertain outcome. An authorized thread reread only reconciles current visible state. It must not infer that its own mutation committed because another message has equal text. A retry is a distinct user action using the original key and payload; the successful producer/C08 response identifies the durable outcome. Nothing in this patch performs an automatic resend.

An exact replay of an edit that has since been edited again can still return `unavailable`: the existing producer checks that its saved version is the current message version. Repeating the original key remains safe against another write, but this patch does not provide a new receipt lookup or falsely claim that recovery is complete.

Existing readers can also return `{"status":"unavailable","reason":"thread-access-unavailable"}` with HTTP 503 when source or recipient authorization cannot be established. An `unavailable` response is not evidence of current access. Generic substring matching of the reason is also unsafe: before this patch, edit CAS failures used that same reason. The owned client/view must treat authenticated denial and a failed authoritative reconciliation separately from a transport error in the original action.

## Consumption and validation

Session33 must compare all preimage blobs against one coherent current candidate before consuming the diff. A different preimage requires explicit reconciliation with that candidate. This bundle is not approval to update a shared production path, merge, deploy, restart or change a principal/provider/ACL.

Required surgical GitHub Actions evidence after consumption:

- A stale expected revision from a different real principal or scope is rejected before producer invocation. Matching requests return the echo. Existing no-header consumers preserve behavior.
- An uncertain reply outcome retains its exact intent/key/payload. Read-only reconciliation sends no mutation. One explicit retry is deduplicated by C08.
- An edit CAS conflict reaches the consumer as conflict. Denial from the initial read, C08 transaction or final reread reaches HTTP 403.
- A scope-changing focus probe purges private DOM and state, and a late async result cannot restore them.
- All four nominal Reports E2Es execute on the real composed candidate. A green browser bundle is not evidence that those E2Es executed.

No local tests, server, full suite, sleeps, timeout increases or assertion removals were used to prepare this bundle. No remote mutation was performed by its author. This bundle does not supply the distinct real recipient or external C05 source authorities still pending in C6.
