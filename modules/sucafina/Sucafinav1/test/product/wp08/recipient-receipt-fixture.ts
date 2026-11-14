import type { ThreadSourceContext } from "../../../product/collaboration/thread-context.ts"
import { isThread } from "../../../product/collaboration/threads.ts"
import type { createThreadActorsFixture } from "./thread-actors-fixture.ts"
import { available } from "./relations-fixture.ts"

export type RecipientReceiptFixture = Awaited<ReturnType<typeof createThreadActorsFixture>>
export type ReplyIntent = { id: string; body: string; mutation: { expectedStorageVersion: number; idempotencyKey: string } }

/** Real C03/C08/SQLite; actor authentication and recipient leases remain fixture boundaries. */
export async function receiptQuestion(f: RecipientReceiptFixture, basis?: ThreadSourceContext) {
  const source = basis ? undefined : await f.issueProject(f.author)
  const draft = {
    kind: "clarification" as const,
    ...(basis ?? { sourceRef: source!.refId, sourceIncarnation: source!.target.incarnation, observedVersion: source!.target.version, period: f.period, evidenceRefs: [source!] }),
    recipientRef: "reader-b", body: "Explain this exact source.",
  }
  const mutation = { expectedStorageVersion: available(await f.port.storageVersion("threads", f.author)), idempotencyKey: "recipient-receipt-question" }
  return available(await f.port.threads.create(draft, mutation, await f.admit("person", "collaboration.thread.create", { draft, mutation })))
}

export async function replyIntent(f: RecipientReceiptFixture, id: string, idempotencyKey = "recipient-receipt-first", body = "Exact recipient contribution."): Promise<ReplyIntent> {
  return { id, body, mutation: { expectedStorageVersion: available(await f.port.storageVersion("threads", f.recipient)), idempotencyKey } }
}

export async function replyWith(f: RecipientReceiptFixture, intent: ReplyIntent, port = f.port) {
  if (!port.recipientActions) throw new Error("Recipient actions unavailable")
  return port.recipientActions.reply(intent.id, intent.body, intent.mutation, await f.admit("reader-b", "collaboration.thread.reply", intent))
}

export function transactionKey(f: RecipientReceiptFixture, intent: ReplyIntent) {
  return JSON.stringify(["reader-b", "threads", f.creationTarget.ref, intent.mutation.idempotencyKey])
}

export async function receiptState(f: RecipientReceiptFixture, id: string) {
  const stored = await f.state.read(f.request("person"), "threads", (state) => ({ thread: state.threads[id], threads: state.threads, transactions: state.transactions }))
  if (stored.status !== "ok" || !isThread(stored.value.thread)) throw new Error("Canonical receipt state unavailable")
  return { ...stored.value, thread: stored.value.thread, storageVersion: stored.storageVersion, aggregateRevision: stored.aggregateRevision }
}
