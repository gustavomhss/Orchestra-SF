# Recipient reply — durable receipt v1

Producer: `product/collaboration/recipient-actions.ts`. This is an additive output of the existing private Collaboration port/HTTP route. Shared C16 schemas and the UI are unchanged. Validation and exact W/S/run pins are recorded in the adjacent validation receipt after hosted execution.

## Input and output

`recipientActions.reply(id, body, { expectedStorageVersion, idempotencyKey }, context)` requires a newly current human admission for the complete payload:

```ts
{ id, body, mutation: { expectedStorageVersion, idempotencyKey } }
```

The existing successful recipient projection gains `value.mutationReceipt`:

```ts
type RecipientMutationReceipt = {
  kind: "recipient-thread-action-v1"
  threadId: string
  principalRef: string
  idempotencyKey: string
  commandDigest: string
  intentDigest: string
  sourceIncarnation: string
} & (
  | { action: "reply"; reply: { id: string; incarnation: string; version: number } }
  | { action: "resolve" }
)
```

The types are exported from the Collaboration producer. `resolve` retains its projection and receives the analogous additive receipt. The ordinary `threads.reply` producer is outside this change.

The same C08 transaction writes both the thread and this receipt as its return value. The response takes the receipt from `saved.value`, including the replay branch; a newly allocated message is never used to explain an older transaction.

`commandDigest` retains the old C08 digest of `{ id, action: { kind: "reply", body } }`, preserving recognition of existing keys. `intentDigest` is `digestSfValue` of the complete payload above, including the frozen expected storage version. Principal, key, thread and exact message identity are independently checked. C08 continues to bind target incarnation and scope.

## Replay and failure semantics

The saved transaction's presence is only a replay hint. The producer invokes the real C08 transaction with the original namespace/target/scope envelope and a callback that cannot commit. C08 reauthorizes the caller and target and checks command/scope identity before returning its original value. Replay precedes fresh-append resolution/reopen rules and ID allocation.

- Identical intent returns its original receipt, even after later equal-text replies or resolution, provided that exact original message version is still currently authorized and available.
- Replay does not append, advance the threads storage version, reopen a resolved thread or add resolution history.
- Reusing the key with a different body or expected storage version returns `conflict / idempotency-content-changed`.
- Legacy Boolean values, malformed receipts and unavailable original message versions return `unavailable / thread-mutation-receipt-unavailable`; there is no receipt backfill or identity inference.
- IDs, incarnations and versions select the exact message. Body and author only verify that selected identity.
- `sourceIncarnation` refers to the committed message's original source context. Do not compare it with `current.sourceRef.target.incarnation`: scoped references can be reissued for another actor/access revision.
- A positive historical transaction does not override current revocation or physical source replacement.

The producer's final release runs a read-only protected snapshot check. It revalidates human/host authority, review fences when applicable, the complete projected thread, physical source fingerprint and persisted receipt value. C05 prepares actual review ACL leases for both the actor and the selected recipient before C08. Its final synchronous check explicitly bypasses the ordinary self shortcut through the optional internal `requireSelfLease` parameter in Collaboration authority. Missing providers fail closed before a new review write. No host-binding or shared contract implementation changes are required.

Review commands preserve `sourceFence: "all"` and the `reviews` check namespace. Domain projections and source issuance remain outside the protected release callback; the callback reads snapshots/leases and performs no domain write.

## Consumer handoff: work-ack / ui-work

Consume the published producer SHA and the actual receipt field. Preserve the complete pending payload and distinguish its original key/version from a new operation. Re-admit the exact payload under current authority for retry. A fresh projection, equal text/author, an array position, a count or a Boolean is not an ACK.

A current projection accompanying a receipt may contain later messages or a resolved thread. ACK association must use the receipt's intent/principal/key/thread and exact message tuple; it must not promote the newest visible message to the earlier operation.

The producer tests close/reopen the real SQLite file, recompose consumers and use fresh human admission. They retain the complete payload in test memory. They do **not** prove browser persistence of the pending intent, positive UI ACK after reload, attachment/reuse in the case, native execution or end-to-end installation. These remain separate consumer proofs after intake by SHA.

The original C05 proof and all remaining WP07/WP08/WP09 obligations are preserved at `9ec98ac9cdc807d2b95040274f4312df768d932d`. This increment does not declare their aggregate acceptance or GLOBAL_RELEASE.
