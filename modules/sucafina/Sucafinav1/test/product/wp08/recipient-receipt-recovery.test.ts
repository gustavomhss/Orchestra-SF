import { expect, test } from "bun:test"
import { object } from "../../../runtime/contract.ts"
import { available } from "./relations-fixture.ts"
import { createThreadActorsFixture } from "./thread-actors-fixture.ts"
import { receiptQuestion, receiptState, replyIntent, replyWith, transactionKey } from "./recipient-receipt-fixture.ts"

test("recipient receipt lost response survives SQLite reopen and fresh admission without another append", async () => {
  const f = await createThreadActorsFixture()
  try {
    const thread = await receiptQuestion(f)
    const intent = await replyIntent(f, thread.id)
    if (!f.port.recipientActions) throw new Error("Recipient actions unavailable")
    const admission = await f.admit("reader-b", "collaboration.thread.reply", intent)
    // Discard the actual producer response; expected identity comes only from C08.
    await f.port.recipientActions.reply(intent.id, intent.body, intent.mutation, admission)
    f.human.finish(admission)
    const before = await receiptState(f, thread.id)
    expect(before.thread.messages).toHaveLength(2)
    const durable = before.transactions[transactionKey(f, intent)]!.value
    expect(durable).toMatchObject({ kind: "recipient-thread-action-v1", action: "reply" })
    const closed = await f.reopen()
    await expect(closed.transaction("dashboard", async () => ({ commit: false, value: true }))).rejects.toThrow("disposed")
    const port = f.compose()
    expect(await f.human.authorize(admission, "collaboration.thread.reply", intent)).toBe(false)
    expect(durable).toEqual(available(await replyWith(f, intent, port)).mutationReceipt)
    expect(await receiptState(f, thread.id)).toEqual(before)
    // This fixture retains the full intent in test memory; browser reload recovery is a separate UI obligation.
  } finally { await f.dispose() }
}, 120000)

test("recipient receipt replay after thread resolution returns the original receipt without reopening", async () => {
  const f = await createThreadActorsFixture()
  try {
    const thread = await receiptQuestion(f)
    const intent = await replyIntent(f, thread.id)
    const original = available(await replyWith(f, intent)).mutationReceipt
    if (!f.port.recipientActions) throw new Error("Recipient actions unavailable")
    const mutation = { expectedStorageVersion: available(await f.port.storageVersion("threads", f.recipient)), idempotencyKey: "recipient-receipt-resolve" }
    available(await f.port.recipientActions.resolve(thread.id, mutation, await f.admit("reader-b", "collaboration.thread.resolve", { id: thread.id, mutation })))
    const before = await receiptState(f, thread.id)
    expect(before.thread.state).toBe("resolved")
    const result = available(await replyWith(f, intent))
    expect(result.mutationReceipt).toEqual(original)
    expect(result.state).toBe("resolved")
    expect(await receiptState(f, thread.id)).toEqual(before)
  } finally { await f.dispose() }
}, 120000)

test("recipient receipt legacy Boolean remains inconclusive and is not backfilled", async () => {
  const f = await createThreadActorsFixture()
  try {
    const thread = await receiptQuestion(f)
    const intent = await replyIntent(f, thread.id)
    available(await replyWith(f, intent))
    // Explicit legacy compatibility fixture: retain the real appended message
    // and C08 envelope, replacing only its saved value with the old Boolean.
    // This is not claimed as an execution of the prior producer.
    await f.persistence.transaction("dashboard", async (snapshot) => {
      const transactions = object(object(snapshot.data.__sfProductV1).transactions)
      const stored = object(transactions[transactionKey(f, intent)])
      if (stored.value === undefined) throw new Error("Original transaction unavailable")
      stored.value = true
      return { commit: true, value: undefined }
    })
    const before = await receiptState(f, thread.id)
    expect(before.transactions[transactionKey(f, intent)]!.value).toBe(true)
    expect(await replyWith(f, intent)).toEqual({ status: "unavailable", reason: "thread-mutation-receipt-unavailable" })
    expect(await receiptState(f, thread.id)).toEqual(before)
  } finally { await f.dispose() }
}, 120000)

test("recipient receipt an edited message version cannot replace the exact original version", async () => {
  const f = await createThreadActorsFixture()
  try {
    const thread = await receiptQuestion(f)
    const intent = await replyIntent(f, thread.id)
    const receipt = available(await replyWith(f, intent)).mutationReceipt
    if (receipt.action !== "reply" || !f.port.threadHistory) throw new Error("Reply history unavailable")
    const edit = { id: thread.id, messageId: receipt.reply.id, expectedVersion: receipt.reply.version, body: `${intent.body} Revised.`, mutation: { expectedStorageVersion: available(await f.port.storageVersion("threads", f.recipient)), idempotencyKey: "recipient-receipt-edit" } }
    available(await f.port.threadHistory.edit(edit.id, edit.messageId, edit.expectedVersion, edit.body, edit.mutation, await f.admit("reader-b", "collaboration.thread.edit", edit)))
    const before = await receiptState(f, thread.id)
    expect(before.thread.messages.find((message) => message.id === receipt.reply.id)).toMatchObject({ incarnation: receipt.reply.incarnation, version: receipt.reply.version + 1, body: edit.body })
    expect(before.transactions[transactionKey(f, intent)]!.value).toEqual(receipt)
    expect(await replyWith(f, intent)).toEqual({ status: "unavailable", reason: "thread-mutation-receipt-unavailable" })
    expect(await receiptState(f, thread.id)).toEqual(before)
  } finally { await f.dispose() }
}, 120000)
