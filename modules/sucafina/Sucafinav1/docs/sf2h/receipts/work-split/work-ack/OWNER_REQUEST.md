# C03 recipient reply receipt — owner request

Status: **NOT_APPLIED / NOT_COMPILED / NOT_RUN**. This is a proposed producer change for the active Collaboration owner. It does not change the producer in work-ack and does not enable an unpublished UI receipt. S0 must review the additive output shape and its consumers before integration.

## Fixed inputs

Repository: `gustavomhss/Orchestra-SF`.
Active producer head observed: `dc21cd389de67c2e7fac996b663d9c0aa7d8cae5` (`collab-resume`, PR #41).
The producer file `modules/sucafina/Sucafinav1/product/collaboration/recipient-actions.ts` is blob `496df344b314df69e5e4d9896aa794ffc84f3cc1`.
Its preimage SHA256 is `70e8c3eaa6b157b8e138e87b650cf5b31a4022bc07808f4e6a8ae04181877ccd`.
The exact source matches the preimage named by the older UI Work proposal; the new head alone did not install that proposal.

Supporting sources at the same producer head:

- `product/host-binding/state-provider.ts`, blob `2fd55c7304add0829d7434917c80664fe86356b9`: C08 transaction identity, durable outcome, replay before CAS and reauthorization.
- `product/collaboration/recipient-thread.ts`, blob `2d5cc3832da8d26ad1e30978f6f49c80191620c3`: currently authorized recipient projection; original message contexts and physical source continuity.
- `product/collaboration/host.ts`, blob `1678fc9d46c36a7da962aeca3b782b395e129c51`: active composition.
- `test/product/wp08/thread-actors-fixture.ts`, blob `2c9012ae49084c9c89d3d6be7779b5a88b8314e1`: real SQLite, C08, human admissions, scoped source issuers and recipient readers. Actor authentication and recipient leases remain explicit fixture boundaries.
- `test/product/wp08/thread-actors.test.ts`, blob `97feec47f26df8f3ce1095b53fb2121200ce67f3`: confirms that source incarnations are scoped to actors and access revisions.

All short paths above are relative to `modules/sucafina/Sucafinav1/`.

## Observed dependency and precise reproduction

The active `recipient-actions.ts` commits `value: true` through C08, then returns `input.read(id, context)`. The read returns the current projection, not the transaction's message identity. Equal text, equal author, a final array position, or an increased message count cannot identify the reply operation.

A real-domain reproduction uses `createThreadActorsFixture()` and these operations:

1. Issue the project source as `fixture.author`; create a review or clarification thread using `fixture.port.threads.create`, human admission for `person`, and recipient `reader-b`.
2. Reply as `reader-b` using `fixture.port.recipientActions.reply`; retain the full payload `{ id, body, mutation: { expectedStorageVersion, idempotencyKey } }`.
3. Read the real C08 record with `fixture.state.read`. Its key is the provider's `JSON.stringify(["reader-b", "threads", fixture.creationTarget.ref, idempotencyKey])`. On the active producer, `transactions[key].value` is Boolean `true`, while the reply result has `current` and no `mutationReceipt`.
4. Append a second independently admitted reply with identical text, then replay the original full payload through a fresh human admission. Check canonical messages, transactions and the threads storage version before/after replay. The projection contains later messages; the Boolean outcome still cannot name the original message.
5. Resolve with a fresh key and retry the original reply. The active producer checks resolved/open state before invoking C08. The earlier proposal retained that ordering, so it did not cover recovery after resolution.

These are reproducible procedures, not an execution claim by this request. The work-ack validation receipt separately records the actual hosted reproductions and their W/S/run identifiers.

## Proposed delta

Apply `c03-recipient-receipt.NOT_APPLIED.patch` only after checking the producer preimage. It changes one producer file and retains its existing new-write source/review/reopen/commit fences.

The durable C08 value becomes a receipt containing action, thread ID, principal, original key, the existing command digest, the full payload intent digest, source incarnation of the committed message context, and exact message ID/incarnation/version for reply. The intent digest includes the frozen expected storage version as well as ID, body and key.

The result is always derived from `saved.value`. It never uses a newly generated receipt as evidence of a replay. Stored transaction presence is only a hint: the replay path invokes C08 with the same namespace/target/scope envelope and a callback incapable of writing. C08 still validates actor, target incarnation, scope digest and command digest before returning the persisted outcome. Review operations retain `sourceFence: "all"` and the reviews check namespace. Recovery occurs before fresh-append open/reopen checks and ID allocation, allowing a known reply to be reconciled after later replies or resolution without reopening the thread.

Malformed outcomes and legacy Booleans remain unavailable. A valid stored receipt whose full intent differs returns `conflict / idempotency-content-changed`. Therefore changing only expectedStorageVersion while retaining the original key/body is not an exact retry. The existing C08 command digest is retained for compatibility; there is no synthetic conversion of legacy outcomes.

The reader selects the message by exact ID/incarnation/version. Body and author validate that selected identity; they are never selectors. An edited later version cannot stand in for the committed version. The proposal deliberately remains inconclusive until an authorized historical version reader is integrated for that additional case.

Source incarnation is checked against that message's stored source context. It must not be compared with `RecipientThread.current.sourceRef.target.incarnation`, because the current ref can be reissued under a new access revision. The real recipient reader continues to prove source continuity and authorization. Human admission and host authority are checked again after the final read and before returning the receipt.

## Required owner witnesses

The owner must add new receipt assertions to a new test in its authorized test area and run them on the applied producer candidate. Existing tests alone do not prove this output contract.

| Case | Required observed result |
| --- | --- |
| Initial reply | Exact receipt equals the C08 stored value; one append; matching message ID/incarnation/version and full payload digest. |
| Equal messages | At least two equal-body/equal-author replies with distinct keys produce distinct message identities. Replay of the earlier key returns its original receipt even when it is no longer the last message. |
| Lost result | Discard the successful response, reconstruct/recompose the real consumer, freshly admit the identical frozen payload and recover the stored receipt; no extra append or storage-version advance. |
| Resolved thread | Resolve after the original reply, then retry its frozen payload. Same receipt and currently resolved projection; no reopen or new append. |
| Changed body | Same key and a different body is a conflict; no write and no receipt promoted to that body. |
| Changed expected version | Same key/body but another expectedStorageVersion is `conflict / idempotency-content-changed`; original transaction stays intact. |
| Legacy outcome | Use a genuine prior-producer Boolean record, or an explicitly declared legacy compatibility fixture; no inferred ACK, no backfilled receipt and no append on replay. |
| Changed message version | Exact original version unavailable in the current projection remains inconclusive; matching ID or text at a newer version is insufficient. |
| Revocation | Revoke before retry and at the final-read boundary; old admission cannot disclose the message/receipt or append. A later valid admission must independently reauthorize all sources. |
| Source and review fences | Physical replacement/revocation fails closed; existing review source/checkNamespaces and new-write source fences remain effective. |

The browser's current reload path does not durably preserve the pending payload/key. Recomposition plus a test-held frozen payload proves producer replay only. The UI reload witness must explicitly account for pending-intent preservation and fresh authorization; this request does not claim that flow completed.

## Prepared regression selection and publication

`owner-regression.ci-request.NOT_RUN.json` is a concrete selection of existing producer tests. It is **NOT_RUN** and does not yet include the new receipt witness. After adding that witness, the owner must extend and validate the request using the canonical validator, pin W and tree, check for an equivalent in-flight/existing run, and create S with only `.ci-run.json` added. Product tests run only on GitHub Actions. No deadlines, assertions, revocations or fences may be removed to obtain green.

Run package `bun typecheck` and repository guards using the existing authorized procedure, reporting existing external failures distinctly. Record W/S, run/jobs, request, actual test counts and Omni outcome. Publish the applied producer delta with those receipts for S0 intake, then validate the consuming UI on the composed candidate. Do not call this unapplied patch, its static inspection, or the baseline fail-closed tests an implemented or accepted positive ACK flow.
