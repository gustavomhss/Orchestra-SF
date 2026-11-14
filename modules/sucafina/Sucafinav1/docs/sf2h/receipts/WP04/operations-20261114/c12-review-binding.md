# WP04 TS-29 / TS-30 — C12 review proof binding

Status: candidate implementation and adversarial cases prepared; GitHub Actions validation pending. No local product tests or typechecks ran.

## Inputs and ownership

- Finding: astra-compose commit `5866bcb2ed610f80138aaabc261acac4acf709cd`, `owner-findings/findings.json`, TS-29 and TS-30.
- Consumer base: operations `08588f4122ac57bb7915ef70ad619edfea5570b4`.
- Producer intake: Finance PR #35 at `981ad44102b2e2e67d31bfc8fb7d97208e390e5b`; exact published `prepared-review.ts`, `prepared-apply.ts`, `apply.ts`, `receipt-review-binding.ts`. No human-authority API change is required.
- Four owned paths and their before/after blobs are in `change-manifest.json`; `wp04-review-binding.patch` preserves the exact delta.

## Behavior

The Procurement review cache now retains the real `review.value.reviewDigest` produced by WP11. The human Apply payload and its grant include that digest. The HTTP adapter accepts a closed body with `caseRef`, `choiceId`, `changeId` and a valid 64-character hexadecimal `reviewDigest`; omitted, malformed or extra fields are rejected.

A private `ReviewDigestFor` callback requires the same active trusted context, request and reviewed proposal, plus the exact human UI intent. It cannot be supplied by a capability caller. The proposal comparison excludes only state and receipt, which WP11 changes during successful reconciliation; every other proposal field remains bound.

Before the first application, the host requires its observed review, matching digest and unchanged prepared change within the existing five-minute window. `createPreparedExecution` then calls the real `readReview` producer and compares the result to the admitted digest. Current producer changes stop the first application. Receipt retries consult WP11's persistent review binding before any requirement to recreate the old domain view. The same proof can recover an already committed receipt after the in-memory review cache is cleared; a different proof conflicts. Current actor, grant, principal, case and physical target continuity checks remain active during replay.

No purchasing policy, approval threshold, scoring, state meaning or engine changed.

## Focused validation

Owned minimum selectors:

- `test/product/wp04/host-integration.test.ts`: six published scenarios remain, now carrying the actual review digest. Two additional scenarios exercise altered proof, altered human payload, expiry and a real source mutation after target capture but before first application. The lost-response scenario also rejects another digest under the same idempotency key and recovers with the original proof after clearing the review cache. Existing revocation and physical-replacement replay cases remain.
- `test/product/wp04/prepared-production.test.ts`: both published real SQLite mutation scenarios remain. Their scoped fixture obtains the domain fields/source from `bridge.reviewDomain`, derives the proof with WP11's canonical `proposalReviewDigest`, and binds the callback to context, request and prepared change.

Producer-owned direct consumers requiring their published fixture intake are `test/product/wp11/prepared-apply.test.ts` and `test/product/wp11/planner-apply.test.ts`. These are separate from the owned selectors. C06 confirmation files have no dependency on this C12 source delta; preserve their valid results or the W1 affected run rather than duplicate them solely for these findings.

The expiry scenario constructs the actual owned host with a controlled clock and the real business ports, human grants, source fences and SQLite persistence. It supplies no simulated review or application result. The cache-clear recovery scenario does **not** claim a full process restart, reopened storage or native acceptance.

## Remaining integration boundary

The shared `product/ui/decision-apply.ts` must retain the real review digest and resend the same payload/key on receipt retry. Its current published variants omit that field. Owner patch OPS-CONSUMER-03 is prepared against astra-compose's current UI blob; no out-of-ownership UI edit was applied here. Until its owner consumes and validates the patch, the composed browser flow is not accepted. Native/human obligations and S0 global acceptance remain separate.
