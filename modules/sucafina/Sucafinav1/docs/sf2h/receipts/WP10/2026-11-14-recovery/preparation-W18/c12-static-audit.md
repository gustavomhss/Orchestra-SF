# C12 PR35 delta — static builder audit

This is a short source/dependency audit requested after C17 composition. It is not an independent campaign review. No repository file was changed for C12, and no product test, typecheck, build, browser or remote mutation was executed.

## Result

The published delta causally addresses the stale C08 storage-version reuse: W17 `apply.ts` reads `cases` before domain execution, while the unchanged `prepared-apply.ts` commits the domain receipt with `additionalNamespaces: cases`. C08 increments that namespace's storage version even when the physical case object has not changed. W17 then tries to reconcile using the old `current.storageVersion`, so the successful domain mutation can be followed by `case-reconciliation-pending`.

PR35 `92f6d97d2df5ebf53cd845f4cfe93355d10b0f6f` reopens the authorized case after the receipt and reconciles against the reopened storage version. It preserves unrelated case fields from that current case, requires the prepared change to remain exact, and correlates the already committed receipt. It also reserves an application attempt durably before dispatch. This prevents missing/unknown receipts from authorizing a second dispatch, including a concurrent collaborator or a restarted host.

The foreign source introduces a final lease fence gap described below. The root subsequently implemented an own host wrapper and final `withCase` revalidation, and this builder inspected their source. They close the identified return-path gap in the mounted Procurement/Dashboard composition, but the prepared counterproof still requires hosted execution and independent review. This is a static composition conclusion, not runtime acceptance.

## Minimal selected files

All four candidates come from the same immutable published commit. The root reports exact intake 15 for these files; this audit made no repository changes.

| Path tail | Git blob | Purpose |
|---|---|---|
| `product/decisions/apply.ts` | `964a53310c340f4496d7410d66f8b852270b75f1` | Reservation and receipt-first case reconciliation. |
| `product/decisions/application-attempt.ts` | `d7ef49df787cc4b058f0992b1fbbdc5c0cb6634e` | New required runtime dependency; identity is global to case incarnation/change, even though C08 transaction receipts are actor-scoped. |
| `test/product/wp11/execution-reconciliation.test.ts` | `b6499c30a3a2482cd96c72e3b4b6bf9b2a04c72e` | Nine real-store/producer modes covering normal execution, lost response, revocation, receipt removal/replacement/collision and late variants. |
| `test/product/wp11/cross-domain-execution.test.ts` | `3cf9948e4fefbeceb4c2e99b04dc47b4e29ad816` | Ordered Planner success and Procurement conflict, durable partial reconciliation and replay after reopen without repeated effects. |

`prepared-apply.ts` already matches published blob `90c3e981d8418c562342660bd3d56d03f9995383` exactly, SHA256 `e5fe2ce6591d04a8289a895418225c8fd4ce2e0a58bf789fd4657145ae6d689c`. No replacement is necessary. The base W17 `apply.ts` is blob `fed7feb25d9af2fecebba8d2b1d2e2a6b1a3e0ac`; its complete difference is saved as `diffs/c12-apply.w17.diff`. `c12-selection.json` records full paths, commits, source blobs, SHA256 and selection reasons.

The current public `PreparedApplyPort` and `createPreparedExecution` constructor contracts remain unchanged. The attempt is stored in the existing C08 transaction-value structure, not a new public protocol or a new state namespace. The helper's imports already exist. The two selected tests have their referenced runtime files in the current composition.

The additionally fetched `application-indeterminate.test.ts`, blob `d13ec6d28ff5eb89bb00e8db39ef9065aab394a2`, is **not a closed minimal test selection**. It imports absent `product/decisions/application-status.ts` and exercises a new `applicationStatus` argument and `decision-application-status` HTTP route not present in the current `decisions/http.ts`. Keep it archived unless those exact same-pin dependencies are independently inspected/composed; do not copy it alone or change its assertions to fit the old host.

## Preserved execution safeguards

- Initial dispatch still requires current UI/human authority, exact physical case identity and membership, exact case version, a valid review digest, actual producer revalidation and explicit human confirmation.
- Reservation occurs before `executePrepared`. It compares the whole freshly authorized case, principal/access/policy, and absence of any existing change-wide attempt under the C08 transaction lock. A replayed transaction result cannot dispatch again because the invocation must have executed and successfully committed its own reservation callback.
- A lost response, missing receipt or crash after reservation stays unresolved. The attempt does not claim an effect; only the authoritative receipt permits reconciliation. A crash before dispatch may therefore require manual reconciliation. This is a deliberate fail-closed availability limit.
- Existing/found receipts are tied to the same target incarnation, command/idempotency identity, principal and review proof. The canonical receipt is reread after asynchronous case callbacks. Reconciliation checks current prepared-change equality, receipt collisions, current C08 authority and the exact case digest before writing.
- Reconciliation preserves unrelated current case fields and increments the physical case version once. A different prepared change, replacement incarnation, membership loss, receipt mismatch or changed authoritative receipt does not obtain a new domain mutation.

These are source observations. The prepared tests still require hosted execution and must not be counted as passing evidence.

## C12-FINAL-C08-LEASE-EGRESS

The new `retainReceipt()` performs `input.state.read(source, "cases", ...)` **after** the surrounding code's final `host.revalidate(context)`. Its return condition checks the abort signal and the C08 result, but not `host.requestFor(context)` or the context lease again. It is used in the already-reconciled success path and after newly successful reconciliation.

The current C08 provider authenticates a Request and compares principal/access/policy around its read. The UI authority separately retains context admissions; `ui.finish(context)` deletes that admission without aborting the original Request or revoking its principal. A lease can therefore be lost during the final C08 await while C08 still returns the same authenticated actor. `retainReceipt` can then return true and release the receipt without a final live-context check. This is a concrete source control-flow gap, not an executed exploit claim.

The pre-mitigation hosts did not close it: `business.withCase` only awaited the action and released its private scope in `finally`; Procurement HTTP and generic Decision HTTP delegated to that scope. The own Dashboard apply method also returned the producer result directly before deleting its admission record.

The root's implemented own composition was inspected without modifying a foreign contract:

1. An own shared `prepared-application-egress.ts` captures the complete admitted apply payload (including review digest), its digest, the immutable Request and trusted binding before calling the actual producer.
2. After the producer returns, it reauthorizes the exact `decisions.apply` human intent and revalidates the actual host context. Immediately after the last await, it checks the original Request identity, non-aborted signal, unchanged trusted binding and admitted payload before releasing any result.
3. Apply this wrapper to the Procurement host's public `.apply` and the own Dashboard apply/execute composition. Strengthen the generic own `withCase` egress as well, retaining the original scope/Request/binding identity while allowing legitimate case version advancement caused by an admitted mutation.
4. Do not add current-case version equality to final `withCase`: that would reject valid mutations and conflict with the C17 lifecycle separation. Case/output consistency remains the producer's separately fenced responsibility.

A meaningful hosted counterproof should use the real host/authority, prepared mutation, SQLite receipt and C08 read. Capture the actual `decisions.apply` admission and finish its lease while the last real `cases` read is retaining an already committed receipt. Keep the Request alive and principal authorized. Require the temporal hook to be reached, exactly one actual domain effect/receipt, a denied response with no receipt disclosure, and receipt-only recovery after a fresh admission without repeating the domain effect. Repeat for the already-reconciled retry path. Do not replace the producer with a permissive callback or invent a receipt.

The root implemented the helper as `apps/cli/src/sucafina-product/prepared-application-egress.ts`. Its `current()` predicate is checked around the final human authorization and host revalidation; no await follows its final Request/binding/intent checks. Both mounted apply routes use it. The strengthened `withCase` also checks the same original scope and selected payload after host revalidation without demanding equality with the now-current case version. The C17 private historical selection remains separate.

The prepared Dashboard counterproof first executes and replays a real positive application. It then counts actual boolean C08 receipt-retention reads, repeats the same replay, and finishes the actual human lease at the last observed read. It requires `denied/application-authority-changed`, unchanged case bytes and a later authorized replay of the same receipt. The Analysis run-context suite separately finishes a real lease during a C08 case read and requires final `withCase` denial. Both are causal source-level tests and remain unexecuted in this audit. This builder recommended additionally comparing real domain snapshots and the global receipt collection across the Dashboard replays, so the claim of no new effects is not based only on the copied case's receipt count.

An import/call-site search found the two mounted CLI apply compositions above. The additional generic `decisions/product.ts` constructor is not instantiated directly by the current CLI composition; its generic Decision HTTP consumer is fenced by the strengthened `withCase`. `portfolio-preparation.ts` constructs a Procurement host only for command preparation and does not expose its apply method. Raw foreign factory reuse outside these wrapped host paths retains the foreign limitation.

## WP04 H05 incompatibility

The current foreign `test/product/wp04/host-integration.test.ts` H05 expects an unrelated authorized objective edit after the domain receipt to produce HTTP 409, `stale/case-changed-after-application`, and leave the case's prepared change planned with no correlated case receipt. It also expects the retry to keep returning 409.

The new producer explicitly preserves that unrelated versioned edit, correlates the authentic receipt and returns `ok` without another domain effect. Those are incompatible expected outcomes. This audit did not alter H05 or weaken any assertion. The owner/S0 must reconcile the semantic expectation or retain precise failing compatibility evidence. A passing new producer test does not establish that the existing WP04 consumer contract has been accepted.

## Remaining evidence

The four exact candidate files, own egress mitigation and real host counterproof need one frozen successor and surgical hosted CI. Both the final lease finding and H05 discrepancy remain visible until that evidence and the required independent review exist. No C12 native/global acceptance, no merge and no deploy is claimed.
