# WP02 historical / C12 implementation handoff

## Reviewed revisions and ownership

- WP02 input: `astra-wp02`, `855c17f66fd71964d88a63ca53fd90240159eb08`.
- WP10 producer read: `sf2-host-ready`, `dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f`.
- WP11 producer read: `sf2-decisions-ready`, `ba2822bb06a8ad741ecbcf0d47654d1a86a3a95b`.
- All remote reads used GitHub MCP. No remote writes or test execution by this agent.
- Product edits remain within `modules/sucafina/Sucafinav1/product/dashboard/**` and `test/product/wp02/**`.
- The WP10 patch is a proposed text delta, not an applied integration or native proof.

## Changed implementation

| File / producer | Behavior | Concrete verification file |
| --- | --- | --- |
| `product/dashboard/confirmation.ts#prepareHistoricalReissue` | Current observation records use the current observation window; dated records retain the original competence. Includes current security fields. Physical replacement, authority loss, source changes after observation and forged evidence remain refused. | `test/product/wp02/historical-reissue.test.ts` |
| `product/dashboard/historical-bindings.ts#createDashboardHistoricalBindings` | Produces a single-record capture receipt plus an atomic authorization fence; reopens only a protected durable capture. Final protected receipt lookup, digest equality, current authority and source fence share one transactionAll lock. Preserved fact, author and capture time remain historical. | `test/product/wp02/historical-bindings.test.ts` |
| `product/dashboard/hot-topic-draft.ts#prepareHotTopicDraft` | Validates private draft/choice binding, uses real domain preview, prepares its exact mutation scope, and rechecks private binding when executing. Returns PreparedCommand, prepared mutation, mutation scope and base/preview digests for protected host persistence. | `test/product/wp02/prepared-review.test.ts` |
| `product/dashboard/prepared-review.ts#createDashboardPreparedReview` | Re-simulates the stored C12 Hot Topic command under the reviewer's domain authority. Requires protected prepared binding verification inside both transactionAll reads. Returns scalar before/after, reviewer evidence and original target digest; never returns executable command. | `test/product/wp02/prepared-review.test.ts` |

Existing `confirmation-issuer.ts` and `hot-topic-draft.test.ts` are unchanged.

## Discriminating tests written

- Historical material edit and next day reopen preserves original fact; revoked access and delete/recreate refuse the fact.
- Capture replacement and removal after the initial read refuse egress even when current domain access remains valid; final protected read is observed inside transactionAll.
- Altering a prepared capture invalidates its transactional fence.
- Dated OPEX January 2026 evidence remains reissuable in 2027 with the original competence.
- Current security action, incident and campaign evidence from 2026 can be revalidated in 2027 using the current observation window.
- C12 canonical completed Hot Topic is prepared, independently reviewed, applied through the domain mutation, and remains completed; receipt version increments.
- Forged preview; consistently forged command plus preview retaining commandDigest; absent protected verifier; concurrent material source edit; revoked authority; and changed private choice binding fail closed.

These are domain adapter tests using real local-store, source lifecycle, projectors, issuer and command engine. Their identity/draft/receipt callbacks are explicit host fixtures. They do not prove native admission, durable C08/WP11 draft registration, a UI review grant, or the integrated C12 receipt pipeline.

## Exact WP10 composition delta

`inputs/wp02-wp10-business-services.patch` targets `apps/cli/src/sucafina-product/business-services.ts` at the WP10 revision above. It constructs and exposes the actual Dashboard C06 issuer/observer and record host, and exposes `bindDashboardPreparedReview(verifyPreparedBinding)` as a factory that requires the private verifier. It does not instantiate an unchecked reviewer or introduce a model-callable apply operation.

Current WP10 `createSfBusinessServices` has the C02 Dashboard source/record host and capabilities, but no C06/C12/Hot Topic draft composition. The patch only exposes the missing domain producers; the following authoritative wiring remains WP10/WP11 owner work.

## WP11 / WP10 C12 wiring required

1. Compose current WP11 `product/decisions/hot-topic-draft.ts#createHotTopicDraftStore` with its real state authority, case authorization, source checks, operation identity and `proposalCoverageWrites` protection. The draft lives in protected preferences (`sf:proposal-coverage:hot-topic:active:*` and `history:*`) and never grants a mutation on its own.
2. Route external Hot Topic operations through WP02 `resolveHotTopicDraftOperation`, loading `readCurrent` from that store and issuing the current canonical target through the real C06 issuer.
3. At C08 preparation, invoke WP02 `prepareHotTopicDraft`; its `verifyDraftBinding` must call current WP11 `verifyHotTopicDraftBinding(state, caseRef, choice.id, operation, draft)` on the CURRENT locked product state. Check the current authority/source fences as part of the host transaction. A previously read state copy is insufficient.
4. Store the exact PreparedCommand and its private DashboardMutationScope/baseDigest/previewDigest with the selected protected prepared change. Do not accept these objects from browser/MCP request arguments. Reconstruct only through `createDashboardPreparedMutation` with the protected scope and real projector; retain the draft/choice fence at final apply.
5. Route `product/decisions/prepared-review.ts#createDecisionPreparedReview.reviewDomain` for Dashboard commands to the bound WP02 reviewer. `verifyPreparedBinding` must identify exactly one current prepared change/operation under the transactionAll lock, compare its full canonical command (including commandDigest, idempotency key, expected domain version and preview), verify current case incarnation/version, choice and authorized participant, and refuse a revoked/replaced prepared record. Matching commandDigest alone is insufficient. The callback accepts `boolean | Promise<boolean>` and is awaited inside both all-surface transactions, allowing real `SfProductStatePort.read` / case authorization through nested readonly reads rather than raw state decoding.
6. Route current WP11 `createSfPreparedApply.resolveMutation` to the protected Dashboard mutation; route `receiptVersion` to `hotTopicReceiptVersion`. Preserve `confirmHuman`, `verifyGrant`, `reviewDigestFor`, and the atomic receipt/state transaction. `receipt-review-binding.ts#proposalReviewDigest`, `receiptReviewBinding`, `receiptProofKey` and `receiptProofTransactionKey` remain WP11-owned. The current review digest must remain bound to the selected change/choice and final receipt, including retries after lost responses.
7. Host UI/native/MCP consumer tests must exercise the actual admission and protected stores before claiming WP02.T04 end-to-end or C12 native completion.

## Historical owner seam

`createDashboardHistoricalBindings.prepare` is not persistence. Its output receipt must be saved exactly once in the protected host capture/review store only while its returned fence passes within the SAME atomic transaction. Egress loads captures through `readProtectedCapture`, which must authorize current access, be reentrant for readonly calls inside transactionAll, and read the same durable store protected by that lock. Browser/model-supplied capture payloads are never accepted.

The adapter deliberately supports one canonical record only and refuses `dashboard-page`. A page's old aggregate payload can contain deleted rows or fields that no longer belong to the current visible set. A reissued current page reference alone does not prove authorization of that preserved content. Multi-row historical review/export requires WP07/WP10 protected per-source capture/dependency receipts and ACL coverage; that integration is blocked, not manufactured from a self-hash.

## CI / evidence status

The prepared-review fixture supplies an async verifier; both acceptance and refusal exercise its awaited result. No test was executed locally. Parent owns the published commit, hosted surgical CI and status matrix. Add the three changed/new test paths above to the exact hosted command. Unit/domain green must not upgrade the external host/native obligations to complete.
