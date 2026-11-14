# work-ack — recipient mutation identity

Status at this candidate: **OWNER_PATCH_READY; RECIPIENT_ACK_DEPENDENCY_OPEN. Hosted checks pending.**

The active Collaboration producer at `dc21cd389de67c2e7fac996b663d9c0aa7d8cae5` still persists a Boolean C08 outcome and returns a fresh `RecipientThread.current` projection. Its blob is `496df344b314df69e5e4d9896aa794ffc84f3cc1`. No durable recipient mutation receipt is published there. The retained UI and all producer paths remain byte-identical to the work-ack base `79ebf5555eddaa4b5b8b57cbe1df7c5ad22b1244`.

## Deliverables

- Two new browser counterexamples in `test/product/work-split/work-ack/recipient-boundary.test.ts`: lost postcommit delivery followed by revoked retry; and current-projection delivery with its marker stripped followed by a Boolean delivery. Both use the real producer and protected SQLite state through unchanged shared fixtures. They are NOT_RUN until the linked hosted receipt is added.
- `c03-recipient-receipt.NOT_APPLIED.patch`: applicable owner proposal against the active preimage, with receipt identity, original C08 outcome replay, and current authorization. It is **NOT_APPLIED / NOT_COMPILED / NOT_RUN**. Text application on an isolated preimage copy was verified; that does not execute or install the producer.
- `INPUTS.json` fixes the norm, branches, read-only dependencies, historical observations and exact limits. `ci-request.01.json` names only the two new browser cases plus the existing mandatory startup/finalization and canonical typecheck/guard gate.

## Intended owner change

Persist the reply ID/incarnation/version, actor, request key, command digest and complete intent digest in the same C08 transaction as the append. Return the original stored receipt on exact retry, even after later messages or resolution, with a fresh authorized thread read and final human/host revalidation. A reused key with changed body or expected-storage input is a conflict. A legacy Boolean cannot be upgraded by guessing a message from author, text or position. A changed message version stays unavailable until an exact historical reader is available.

The proposal does not alter C08, source fences, historical review rules or the active producer. The UI does not consume this proposed contract before owner publication and validation.

## Scope and evidence limits

The three approved journeys from ui-work run [43621603578](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43621603578) are reattached as historical scoped evidence, not rerun and not reassigned to this candidate. That full run had five passes and two failures; it was not globally green.

The current reload path reads with fresh authority and does not submit another reply. It **does not recover the unresolved request's key/body or reconcile its exact ACK**. Seeing matching text in the thread is not proof of the earlier request. Recovery across reload and positive recipient ACK remain dependent on a published receipt/reconciliation path and its UI integration.

Fixtures provide real Collaboration HTTP, C03/C06/C08, source issuers and SQLite. Actor authentication and recipient leases are fixture boundaries; the case-question link is seeded and final answer attachment is not mounted. No installed/native/global acceptance is claimed.

WP01's 75 and WP02's 78 criteria remain intact, as do the full campaign's obligations. This slice exercises only the named reply safety conditions; it does not grant full WP01/WP02/C03/C06 acceptance.
