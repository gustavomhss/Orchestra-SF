import { expect, test } from "bun:test"
import { available } from "./relations-fixture.ts"
import { createReviewAnswersFixture } from "./review-answers-fixture.ts"

test("a C05 request uses the recipient's current review lease, preserves exact retry and denies a homonym or revoked lease", async () => {
  const f = await createReviewAnswersFixture()
  try {
    const draft = { kind: "clarification" as const, ...f.basis, recipientRef: "reader-b", body: "RECIPIENT-C05: clarify the original preserved project." }
    const mutation = { expectedStorageVersion: available(await f.port.storageVersion("threads", f.author)), idempotencyKey: "review-recipient-create" }
    const context = await f.admit("person", "collaboration.thread.create", { draft, mutation })
    const created = available(await f.port.threads.create(draft, mutation, context))
    expect(created.recipientRef).toBe("reader-b")
    expect(created.messages[0]!.sourceContext).toEqual(f.basis)
    expect(available(await f.port.threadReads.read(created.id, f.recipient)).messages).toEqual(created.messages)
    const version = available(await f.port.storageVersion("threads", f.author))
    expect(available(await f.port.threads.create(draft, mutation, await f.admit("person", "collaboration.thread.create", { draft, mutation })))).toEqual(created)
    expect(available(await f.port.storageVersion("threads", f.author))).toBe(version)
    const homonymDraft = { ...draft, recipientRef: "reader-c" }
    const homonymMutation = { expectedStorageVersion: version, idempotencyKey: "review-recipient-homonym" }
    const denied = await f.port.threads.create(homonymDraft, homonymMutation, await f.admit("person", "collaboration.thread.create", { draft: homonymDraft, mutation: homonymMutation }))
    expect(denied.status).not.toBe("ok")
    expect(JSON.stringify(denied)).not.toContain(draft.body)
    expect(available(await f.port.storageVersion("threads", f.author))).toBe(version)
    expect((await f.port.threadReads.read(created.id, f.homonym)).status).not.toBe("ok")

    // Revocation happens immediately before the real protected write callback.
    const transaction = f.state.transaction
    const raceMutation = { expectedStorageVersion: version, idempotencyKey: "review-recipient-race" }
    const raceDraft = { ...draft, body: "C05-LEASE-RACE: must not commit." }
    let entered = false
    f.state.transaction = (request, command, work) => transaction(request, command, async (state, authority, snapshot) => {
      if (command.idempotencyKey === raceMutation.idempotencyKey) { entered = true; f.access["reader-b"] = false }
      return work(state, authority, snapshot)
    })
    try {
      const raced = await f.port.threads.create(raceDraft, raceMutation, await f.admit("person", "collaboration.thread.create", { draft: raceDraft, mutation: raceMutation }))
      expect(entered).toBe(true)
      expect(raced.status).not.toBe("ok")
    } finally { f.state.transaction = transaction }
    expect(available(await f.port.storageVersion("threads", f.author))).toBe(version)
    const retry = await f.port.threads.create(draft, mutation, await f.admit("person", "collaboration.thread.create", { draft, mutation }))
    expect(retry.status).not.toBe("ok")
    expect(JSON.stringify(retry)).not.toContain(draft.body)
    const hidden = await f.port.threadReads.read(created.id, f.recipient)
    expect(hidden.status).not.toBe("ok")
    expect(JSON.stringify(hidden)).not.toContain(draft.body)

    // A restored current review grant permits the same historical intent; no
    // new thread, source period, pin or recipient identity is substituted.
    f.access["reader-b"] = true
    expect(available(await f.port.threads.create(draft, mutation, await f.admit("person", "collaboration.thread.create", { draft, mutation })))).toEqual(created)
    expect(available(await f.port.storageVersion("threads", f.author))).toBe(version)

    // A later permissive method is not the authority that prepared the lease.
    const recipientAuthority = f.options.reviewRecipientAuthority
    if (!recipientAuthority) throw new Error("Recipient authority missing")
    const originalCheck = recipientAuthority.checkAtCommit
    const swapMutation = { expectedStorageVersion: version, idempotencyKey: "review-recipient-provider-swap" }
    const swapDraft = { ...draft, body: "C05-PROVIDER-SWAP: must not commit." }
    let swapped = false
    f.state.transaction = (request, command, work) => transaction(request, command, async (state, authority, snapshot) => {
      if (command.idempotencyKey === swapMutation.idempotencyKey) { swapped = true; recipientAuthority.checkAtCommit = () => true }
      return work(state, authority, snapshot)
    })
    try {
      const refused = await f.port.threads.create(swapDraft, swapMutation, await f.admit("person", "collaboration.thread.create", { draft: swapDraft, mutation: swapMutation }))
      expect(swapped).toBe(true)
      expect(refused.status).not.toBe("ok")
      expect(JSON.stringify(refused)).not.toContain(swapDraft.body)
    } finally { f.state.transaction = transaction; recipientAuthority.checkAtCommit = originalCheck }
    expect(available(await f.port.storageVersion("threads", f.author))).toBe(version)
  } finally { await f.dispose() }
}, 120000)
