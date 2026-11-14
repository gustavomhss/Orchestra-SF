import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createCollaborationHttp } from "../../../product/collaboration/http.ts"
import type { RecipientMutationResult } from "../../../product/collaboration/recipient-actions.ts"
import { available } from "./relations-fixture.ts"
import { createThreadActorsFixture } from "./thread-actors-fixture.ts"
import { receiptQuestion, receiptState, replyIntent, replyWith, transactionKey } from "./recipient-receipt-fixture.ts"

test("recipient receipt initial reply returns the original C08 value with one exact append", async () => {
  const f = await createThreadActorsFixture()
  try {
    const thread = await receiptQuestion(f)
    const intent = await replyIntent(f, thread.id)
    const before = await receiptState(f, thread.id)
    const http = createCollaborationHttp({ origin: "https://example.test", mount: "/product", host: f.port, human: f.human, admitRead: async () => ({ status: "denied", reason: "read-route-not-selected" }), finishRead: () => {} })
    const response = await http(new Request("https://example.test/product?sf=collaboration-thread-reply", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json", actor: "reader-b" }, body: JSON.stringify(intent) }))
    if (!response) throw new Error("Recipient reply HTTP route unavailable")
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    const result = available(await response.json() as RecipientMutationResult)
    const after = await receiptState(f, thread.id)
    const receipt = result.mutationReceipt
    expect(after.transactions[transactionKey(f, intent)]!.value).toEqual(receipt)
    expect(receipt).toMatchObject({ kind: "recipient-thread-action-v1", action: "reply", threadId: thread.id, principalRef: "reader-b", idempotencyKey: intent.mutation.idempotencyKey, commandDigest: digestSfValue({ id: intent.id, action: { kind: "reply", body: intent.body } }), intentDigest: digestSfValue(intent) })
    if (receipt.action !== "reply") throw new Error("Reply receipt missing")
    const exact = after.thread.messages.filter((message) => message.id === receipt.reply.id && message.incarnation === receipt.reply.incarnation && message.version === receipt.reply.version)
    expect(exact).toHaveLength(1)
    expect(exact[0]).toMatchObject({ body: intent.body, authorRef: "reader-b", sourceContext: { sourceIncarnation: receipt.sourceIncarnation } })
    expect(after.thread.messages).toHaveLength(before.thread.messages.length + 1)
    expect(before.thread.messages).toEqual(after.thread.messages.slice(0, before.thread.messages.length))
    expect(after.storageVersion).toBe(before.storageVersion + 1)
    expect(after.aggregateRevision).toBe(before.aggregateRevision + 1)
  } finally { await f.dispose() }
}, 120000)

test("recipient receipt equal author and text retain distinct identities and replay the earlier message", async () => {
  const f = await createThreadActorsFixture()
  try {
    const thread = await receiptQuestion(f)
    const first = await replyIntent(f, thread.id)
    const one = available(await replyWith(f, first)).mutationReceipt
    const second = await replyIntent(f, thread.id, "recipient-receipt-second", first.body)
    const two = available(await replyWith(f, second)).mutationReceipt
    if (one.action !== "reply" || two.action !== "reply") throw new Error("Reply receipts missing")
    expect(one.reply.id).not.toBe(two.reply.id)
    expect(one.reply.incarnation).not.toBe(two.reply.incarnation)
    const before = await receiptState(f, thread.id)
    expect(before.thread.messages.filter((message) => message.authorRef === "reader-b" && message.body === first.body)).toHaveLength(2)
    expect(available(await replyWith(f, first)).mutationReceipt).toEqual(one)
    expect(await receiptState(f, thread.id)).toEqual(before)
    expect(before.transactions[transactionKey(f, first)]!.value).toEqual(one)
    expect(before.transactions[transactionKey(f, second)]!.value).toEqual(two)
  } finally { await f.dispose() }
}, 120000)

test("recipient receipt same key with changed body or expected storage version conflicts without a write", async () => {
  const f = await createThreadActorsFixture()
  try {
    const thread = await receiptQuestion(f)
    const intent = await replyIntent(f, thread.id)
    const receipt = available(await replyWith(f, intent)).mutationReceipt
    const before = await receiptState(f, thread.id)
    for (const changed of [{ ...intent, body: `${intent.body} Different intent.` }, { ...intent, mutation: { ...intent.mutation, expectedStorageVersion: before.storageVersion } }]) {
      expect(await replyWith(f, changed)).toEqual({ status: "conflict", reason: "idempotency-content-changed" })
      expect(await receiptState(f, thread.id)).toEqual(before)
    }
    expect(available(await replyWith(f, intent)).mutationReceipt).toEqual(receipt)
    expect(await receiptState(f, thread.id)).toEqual(before)
  } finally { await f.dispose() }
}, 120000)
