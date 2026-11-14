# Owner handoff — NOT_APPLIED

These files are proposals stored inside the UI writer's receipt namespace. Neither producer source path was modified. They are not a new published API, a compiled implementation, or a passing integration result.

## G03: exact published intake

`g03-published-intake.NOT_APPLIED.patch` carries the exact published delta from base blob `ec80e2916c8a06cbb471cf02e30bb1cb5ebd9cc0` to Collaboration blob `cd9a67887f41986243809672572c972440c832ec`. The latter is present at inspected head `0d9820924b33a8fc7b145f54a675aeef76c98489`.

The UI already recognizes `409 / conflict / selection-not-committed` as a proven precommit rejection. The retained producer maps real C08 `conflict / product-state-changed` to `503 / selection-unavailable`, so the UI must retain uncertainty and the original request. The proposed intake preserves the producer's existing preview classification and adds the ordinary CAS mapping.

Reproduction: `selection-recovery.test.ts`, named case `G03 acceptance requires the real precommit CAS conflict and preserves the reviewed selection`. Its browser route admits a competing selection through the actual shared HTTP producer before continuing the original POST. It never creates a synthetic conflict response. The acceptance assertion remains HTTP 409. After owner intake the same test must proceed through explicit review, reread of the case/version, and a fresh save while retaining case, sources and March period.

Owner: Collaboration + Composition. Integrate the exact blob with its producer proof, then run this UI consumer on the composed candidate. Do not reuse a green from the producer's branch as UI acceptance.

## C03: persist an exact recipient mutation outcome

`c03-recipient-receipt.NOT_APPLIED.patch` is an additive contract proposal against published `recipient-actions.ts` blob `496df344b314df69e5e4d9896aa794ffc84f3cc1`. It stores the message ID, incarnation and version in the C08 operation outcome, alongside the request key and command digest. Replay returns the stored outcome, not the newly generated candidate IDs from the replay invocation. The response still requires a fresh authorized read and context revalidation.

The current producer stores `true` and returns a new current conversation read. Even one equal-author/equal-body append is not a receipt for this request. The current UI therefore keeps the original request and text locked. It does not consume the proposed `mutationReceipt` field before the producer contract is actually published and verified.

Existing persisted Boolean outcomes cannot be upgraded by guessing a message from position, text or author. The proposal leaves them explicitly unavailable. Owner review must decide the supported legacy outcome/reconciliation path and validate replay after later state transitions; this patch does not claim to solve those additional cases.

Reproduction: `reply-identity.test.ts`, named case `shared recipient current projections stay unconfirmed across exact retries, reload and fresh distinct-recipient admission`. A previous answer, the submitted answer and a subsequent competing answer share the same author/body. Real C08 state verifies no duplicate on replay; the browser never reports an exact ACK from the current projection. The direct C08 snapshot case in the same file separately proves successful exact acknowledgement after lost delivery.

Required owner proofs before accepting the new contract: same-key/same-payload replay; same-key/different-payload rejection; simultaneous identical text by the same author; postcommit delivery loss; changed, removed or substituted message; revocation before return; fresh recipient admission; persisted Boolean legacy outcome; replay after thread resolution. Keep existing C05 history, source fences and deadlines unchanged.

After publication, the UI owner can validate the returned request identity and exact message identity against the frozen request. No producer edit or speculative receipt handling is included in this PR.

## C03-HOST composition boundary

The new browser fixture uses the actual shared Collaboration HTTP router, actual source issuers, UI admissions, C03/C06/C08 and SQLite. Its actor authenticator and recipient lease are explicit boundaries inherited from published Collaboration fixtures. It creates and reads a real authorized case, while question linkage is seeded test corpus. The final decision-answer attachment is deliberately unmounted and yields 404; that observation describes the fixture, not a newly discovered defect of the installed host.

Composition must run the exact message selection and confirmed answer reuse through the installed case/question attachment mount with the distinct recipient's real session. This lease does not authorize host/source/provider changes or a replacement success handler. The prior C03-HOST finding remains open until that proof exists.
