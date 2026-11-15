# Mission52 — independent review of P4 v3 case-route proposal

This is a static source-contract review. No product execution, compilation, local test, hosted dispatch or repository mutation was performed. It supersedes the original adapter's incomplete locked-edit assessment in `m52-p4-route-independent-review.md`.

Reviewed proposal: `/workspace/scratch/fec39c0682b3/m52-work/p4-route-material-v3.json`.
Proposal SHA256: `d8e4ee501303cc6ebf2c036e416993acc9f4b317d0c1c840d89279d1d9c661af`.
Source pin for canonical contracts: C23 `25ed395829f9ec5f06a80c70467c23b25376f853`; root separately confirms the relevant paths are unchanged by C24's owned Procurement53 integration.

## Finding

No new blocking mismatch was found in v3's admission, actual service delegation, context cleanup or locked edit fence. The addition resolves the specific gap identified by the separate pack_criteria review: native source fences omit the C08 aggregate, and a cases namespace storage version alone cannot detect a concurrent document or other C08 namespace change. The new aggregate fence is conservative and does not modify domain policy or actor grants.

This is not a security certification, typecheck result, journey PASS, or permission to integrate shared paths. The proposed shared adapter and host binding still require their owner/integrator delivery process and the original nominal runtime qualification.

## Exact reviewed postimages

| Path | Original Git blob | Proposed Git blob |
| --- | --- | --- |
| `modules/sucafina/Sucafinav1/product/decisions/http.ts` | `596512b4e12c094fd178ea845f4b560bbf23a348` | `a77da76589ece60a6925bdd20731efbc8f19b597` |
| `apps/cli/src/sucafina-product/decision-case-http.ts` | `new file` | `13188a92ace68e6730bd22f8ee87872af2c1dea1` |
| `apps/cli/src/sucafina-product/host-context.ts` | `b19c56fdd21fe829fd3bbbb3e377b6fbe0a5825b` | `36ad71ccbeacc42382dcc2d0f35ee7f707981790` |
| `apps/cli/src/sucafina-product/portfolio-http.ts` | `6cbfc373ea72a90351e4f9997f65663e0f5fc775` | `8a15b3ac6c14a2cb4b5cfa9075ec75320884dd90` |

## Four route bindings retained from the first review

- GET `decision-list`: explicit `sf_case_read` UI admission, exactly one `ui.validate`, then canonical case-management list. That list checks participant membership, authorized readable evidence, a state reread and final authority. `finishList` deletes the lease. The generated digest binds this private list purpose and surface; it does not dispatch a fabricated case-read payload.
- POST `decision-edit`: existing `decisions.edit` human grant and complete decoded payload, actual case-management edit inside `business.withCase`, canonical operation identity and idempotent historical retry. There is no selection/approval substitution.
- POST `decision-compare`: existing `decisions.portfolio.read` action, actual `portfolio.compare`, exact case scope. The human authority API is `admit`; it already performs UI validation. The comparison service reopens criteria, alternative results and their sources.
- POST `decision-portfolio-catalog`: existing `decisions.portfolio.read`, actual `portfolio.product.http.catalog`. This is the canonical multicase method: it authorizes each supplied case ref and delegates the real contribution catalog. It intentionally does not establish a singleton case scope. Missing product remains unavailable.

The factory intercepts only those four literal names and keeps exact path/origin, one query key, method, cross-site, abort, JSON and closed-payload checks. Host dispatch still invokes CurrentChoice first. The optional `purpose:"results"` change accepts only that literal or the original bare caseRef payload, retains the entire body in the admission digest and delegates the original product list authorization.

## Added locked edit sequence

1. Canonical case-management clones the incoming edit and calls `authorizeEdit` before it reads and validates the proposed evidence.
2. The adapter deletes any prior capture for that exact context, obtains the private authenticated Request, and captures binding and payload digests. It calls the real `portfolio.intent.authorize`, which captures the existing native source fences and checks exact human intent.
3. A real `authority.state.read(source, "cases", ...)` verifies actor principal, policy version and access revision against the admitted context. After host/request revalidation, the adapter records the read's C08 `incarnation` and global `aggregateRevision` in a private WeakMap keyed by that context.
4. Canonical case-management performs its normal current evidence and case checks, then executes its actual state transaction. It still uses the cases namespace expected storage version and case incarnation/version predicates.
5. Inside that transaction's locked callback, the adapter compares the captured Request, non-aborted signal, binding digest, payload digest, C08 incarnation and global revision, then requires the canonical native `intent.verify` as well. Any missing capture, lock metadata or changed epoch denies commit.
6. The canonical transaction increments the global C08 revision only after the work callback has accepted the mutation. Therefore the locked callback sees the exact pre-commit epoch, not the proposed edit's newly incremented revision.

This ordering rejects a concurrent C08 mutation after capture, whether before, during or after the evidence reads. A later return to the same content still changes the global revision, so A→B→A is not hidden. A concurrent mutation in an unrelated C08 namespace can also reject the edit conservatively; this is the explicit tradeoff of an aggregate fence and does not authorize a write that the narrower canonical checks would deny.

## Canonical evidence for that ordering

- `product/decisions/host-product.ts`, blob `f6e3d0473338553dc71340fe632d3de59b08deb9`, line39 requires `verifyEditSourcesLocked`; line76 combines matching human intent with that additional under-lock source predicate. This is why native intent fences alone were insufficient in the original adapter.
- `product/decisions/case-management.ts`, blob `5140fee739f874a5c2d8dfeaf95c3bbb3d6ff585`, line41 invokes edit authorization; line60 performs evidence verification; lines61–64 enter the actual state transaction and apply `verifyEdit` before assigning the new case. Idempotent replay at lines50–55 retains its established receipt semantics and does not commit another edit.
- `product/host-binding/state-provider.ts`, blob `71ce2ba1b04d3c7f63f7c444ca23dd084a8e2b0c`, line69 returns namespace `storageVersion` separately from global `aggregateRevision` and `incarnation`. Line117 compares namespace versions; line120 invokes the callback; line168 increments the aggregate revision, and lines170–172 store/return it. Lines174–177 use `transactionAll` when a domain surface is selected; case edit selects planner.
- `product/decisions/intent-fences.ts`, blob `24051e0a30b53e09b387ac575a658f30e098cf0a`, lines17–28 capture the native source fences only after matching current human intent; lines31–36 require the same payload/intent and locked native fences. V3 retains these checks rather than replacing them with the new aggregate epoch.
- The host's new `lockedProductRevision` callback uses the existing `currentSnapshots()` entry point, reads only the locked dashboard product state's schema/incarnation/revision and returns two scalar metadata fields. It returns undefined without the lock view or with malformed metadata. No mutable product-state object, evidence ref, Request or new authority is exposed to the browser.

## Context lifetime and scope

List leases are closed by `finishList`; human leases are closed by `human.finish` in the factory's finally; `business.withCase` releases its own scope in finally. The edit capture uses WeakMap, is replaced on every edit authorization attempt and cannot resurrect authority after finish because all verification also requires `host.requestFor(call)` and a valid exact intent. The capture does not persist a grant or command across requests.

The existing payload validators still accept general supported evidence refs, including C08-backed refs; v3 addresses that accepted scope through the aggregate guard rather than shrinking the schema or changing assertions. It preserves read-only historical evidence for listing and current evidence for editing. No financial approval policy, financial route, CurrentChoice handler, Reports path or workflow is modified by this review or by the four reviewed route files.

Hosted checks remain a separate evidence channel. The known source workflow checks modules/sucafina and guards; it does not independently typecheck all CLI/app-shell/E2E files or prove an isolated composed shared patch. No such wider result is claimed here.

## C25 query-boundary follow-up (v4)

Root and composition_audit inspected the actual C25 UI and installed handler. The UI supplies `procurement=attached` during both discovery and inspection, but the handler's GET allowlist omitted that key. The additional complete proposal admits only that optional literal, retains duplicate/unknown-key rejection, method, origin, UI read admission and all existing producers. Preimage `5cb8e4e45c1e68af4c59ec096b499ed0907f6c66`; postimage `e91191ec5fa37da12db4d92e973e9105c00be4e5`. Exact v4 packet SHA256 `5e4578284004f32b65f6f3970d034c5a694addb6e0dce1684d7df355d1e82db2`. Static review is not runtime evidence; nominal05 is selected unchanged to qualify this composed proposal.
