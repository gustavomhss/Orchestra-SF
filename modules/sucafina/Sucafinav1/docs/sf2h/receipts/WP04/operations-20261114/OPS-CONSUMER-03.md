# OPS-CONSUMER-03 — review digest in the shared Apply UI

**Proposed owner patch, not applied.** Owner: astra-compose / the shared UI owner. No repository product file was edited and no test was executed or dispatched by this reviewer.

## Exact owner base

- astra-compose commit: `5866bcb2ed610f80138aaabc261acac4acf709cd`.
- Tree: `da48ad2d7d4f72867c4093aa32174f6bf731ebbb`.
- File: `modules/sucafina/Sucafinav1/product/ui/decision-apply.ts`.
- Before blob: `2c9677ab431d90d1295a12099e27b780b860eafb`.
- Proposed after blob: `daded373d54af0f67f42e8e5afb98a7e25c7f548`.

This base contains the owner's latest revocation, request locking and uncertain retry behavior. The earlier operations/finance/collaboration blob `3bee0f4326c1a65d3c0573695c3e4a1609b6c480` must not be used as the patch base because it omits those owner deltas.

## Confirmed incompatibility

WP11 PR #35 W2 `981ad44102b2e2e67d31bfc8fb7d97208e390e5b` publishes the real review producer and `AdmittedApply = PreparedApplyRequest & { reviewDigest: string }`, with lowercase 64-hex validation in `receipt-review-binding.ts`. The operations WP04 HTTP/host consumer is being adapted to that closed request shape.

The current shared UI reads the review response but does not preserve its `reviewDigest`; its Apply JSON contains only caseRef, choiceId and changeId. After the strict HTTP adaptation, this UI request is invalid and cannot reach Apply. A replacement digest calculated in the browser would not prove the user's real review and is not proposed.

## Proposed behavior

The patch accepts a review only if the real response carries a lowercase 64-hex digest. It captures that digest when the existing planned/no-receipt/valid-fields conditions allow confirmation. The first Apply serializes the captured digest alongside the three existing identity fields. Every uncertain retry continues using the already retained `intention.body` and idempotency key byte for byte.

The new digest variable is cleared on a new review, access revocation and definitive first-attempt validation rejection. Existing owner behavior remains: busy/connection guards, timeout, 401/403 and global revocation cleanup, completed/receipted-change refusal, locked requests after uncertainty, and preservation of the original request after a rejected retry. No grant, policy, threshold, scoring, state meaning or domain operation is changed.

## Required hosted proof after owner consumption

- Real review response → checked human confirmation → Apply body includes exactly that producer digest and the unchanged selected case/change/choice.
- Missing, malformed or stale review proof never enables a new application; the server also rejects altered proof.
- Timeout/lost response/conflict retains an identical serialized Apply body and idempotency key, including the same review digest. A second review cannot replace an unresolved intention.
- First-attempt input validation rejection requires a fresh review; a rejected uncertain retry keeps the original request for reconciliation.
- 401/403 or `sf-access-revoked` removes the retained context, digest and intention body and prevents further requests.
- Existing producer/HTTP checks cover changed source, expired review and receipt binding; owner browser proof must exercise the real adapted consumer, not a digest fabricated by a fixture.

Use the owner's explicit existing decision Apply browser/test selection through CI.md and GitHub MCP, plus affected Bun typecheck/guards after consumption. No specific missing test path is invented here. Historical UI receipts for the before blob do not qualify this patch.

`planner-application.ts` was mentioned as a possible consumer based on a PR description, but no such repository path was confirmed. It is not filed as a concrete missing-file finding. The confirmed consumer in this patch is the shared UI above; WP04 HTTP/host adaptation is owned and handled by the operations WP04 agent.

The initial Bun43 run on operations W `de6959db82dbe48bd59e3d012ff668a86347a6cd` can only qualify that old product. The new review binding changes production code and must receive its own affected validation after publication. The prior CLI reuse note covers documentation-only D98dae and the isolated OPS-CONSUMER-02 test patch; it does not qualify this production intake.
