import { expect, test } from "bun:test"
import { protectSfReviewReads } from "../../../../../../apps/cli/src/sucafina-product/review-read-integrity.ts"
import type { SfProductStatePort } from "../../../product/contracts/state.ts"
import { object } from "../../../runtime/contract.ts"
import { available } from "../wp08/relations-fixture.ts"
import { receiptQuestion } from "../wp08/recipient-receipt-fixture.ts"
import { createReviewReadBoundaryFixture } from "./review-read-boundary-fixture.ts"

/** Actual installed wrapper over the fixture's real C05 reader, C08 receipt,
 * SQLite, authenticated Request and host. Failure seams replace only negative
 * I/O results after the underlying read; no successful proof is manufactured.
 */
async function createInstalledIntegrityFixture(localSnapshotReaders: boolean) {
  const f = await createReviewReadBoundaryFixture()
  const raw: { calls: number; unavailableAt?: number; afterRead?: () => Promise<void> } = { calls: 0 }
  const proof: { calls: number; unavailableAt?: number; afterProof?: () => Promise<void> } = { calls: 0 }
  const read = f.services.reviews.read.bind(f.services.reviews)
  const reviews = { ...f.services.reviews, read: async (...args: Parameters<typeof read>) => {
    const ordinal = ++raw.calls
    const result = await read(...args)
    if (result.status === "ok") await raw.afterRead?.()
    return ordinal === raw.unavailableAt ? { status: "unavailable" as const, reason: "test-integrity-read-unavailable" } : result
  } }
  const state: typeof f.fixture.state = { ...f.fixture.state, read: async (request, namespace, inspect) => {
    const result = await f.fixture.state.read(request, namespace, inspect)
    if (namespace !== "reviews") return result
    const ordinal = ++proof.calls
    await proof.afterProof?.()
    return ordinal === proof.unavailableAt ? { status: "unavailable", reason: "test-integrity-proof-unavailable" } : result
  } }
  const scope = protectSfReviewReads({ authority: { host: f.fixture.host, state, creationTarget: f.fixture.creationTarget }, reviews, localSnapshotReaders })
  const request = f.fixture.host.requestFor(f.fixture.author)
  if (!request) throw new Error("Actual admitted C05 Request unavailable")
  return { f, raw, proof, read: () => scope.run(request, () => reviews.read(f.fixture.review.id, f.fixture.author)),
    removeReceipt: () => f.fixture.persistence.transaction("dashboard", async (snapshot) => {
      const transactions = object(object(snapshot.data.__sfProductV1).transactions)
      let removed = 0
      for (const [key, entry] of Object.entries(transactions)) {
        const transaction = object(entry), value = object(transaction.value)
        if (transaction.namespace === "reviews" && (value.reviewRef === f.fixture.review.id || value.id === f.fixture.review.id)) {
          delete transactions[key]; removed += 1
        }
      }
      if (!removed) throw new Error("Actual C08 review receipt unavailable")
      return { commit: true, value: undefined }
    }),
    dispose: f.dispose,
  }
}

test("installed legacy integrity reader preserves unavailable from its second canonical read", async () => {
  const f = await createInstalledIntegrityFixture(false)
  try {
    f.raw.unavailableAt = 2
    expect(await f.read()).toEqual({ status: "unavailable", reason: "test-integrity-read-unavailable" })
    expect(f.raw.calls).toBe(2)
    f.raw.unavailableAt = undefined
    expect(await f.read()).toEqual({ status: "ok", value: f.f.fixture.review })
  } finally { await f.dispose() }
}, 120000)

test("installed snapshot integrity reader preserves an unavailable after-read C08 proof", async () => {
  const f = await createInstalledIntegrityFixture(true)
  try {
    f.proof.unavailableAt = 2
    expect(await f.read()).toEqual({ status: "unavailable", reason: "test-integrity-proof-unavailable" })
    expect(f.raw.calls).toBe(1)
    expect(f.proof.calls).toBe(2)
    f.proof.unavailableAt = undefined
    expect(await f.read()).toEqual({ status: "ok", value: f.f.fixture.review })
  } finally { await f.dispose() }
}, 120000)

test("installed snapshot integrity reader reports recoverable drift during two authorized replies", async () => {
  const f = await createInstalledIntegrityFixture(true)
  try {
    const fixture = f.f.fixture
    const question = await receiptQuestion(fixture)
    let replies = 0
    f.raw.afterRead = async () => {
      const body = `Concurrent authorized integrity reply ${++replies}`
      const mutation = { expectedStorageVersion: available(await fixture.port.storageVersion("threads", fixture.author)), idempotencyKey: `reports48-integrity-${crypto.randomUUID()}` }
      const intent = { id: question.id, body, mutation }
      const result = await fixture.port.threads.reply(question.id, body, mutation, await fixture.admit("person", "collaboration.thread.reply", intent))
      expect(result.status).toBe("ok")
    }
    expect(await f.read()).toEqual({ status: "stale", reason: "review-read-changed" })
    expect(replies).toBe(2)
    const thread = available(await fixture.port.threads.read(question.id, fixture.author))
    expect(thread.messages.slice(-2).map((message) => message.body)).toEqual(["Concurrent authorized integrity reply 1", "Concurrent authorized integrity reply 2"])
    f.raw.afterRead = undefined
    expect(await f.read()).toEqual({ status: "ok", value: fixture.review })
  } finally { await f.dispose() }
}, 120000)

for (const local of [false, true]) {
  test(`installed integrity reader local=${local} gives real revocation precedence over unavailable proof`, async () => {
    const f = await createInstalledIntegrityFixture(local)
    try {
      f.proof.unavailableAt = 1
      f.proof.afterProof = async () => { f.f.fixture.actors.person!.enabled = false }
      const result = await f.read()
      expect(result).toEqual({ status: "denied", reason: "review-integrity-unavailable" })
      expect(result).not.toHaveProperty("value")
    } finally { await f.dispose() }
  }, 120000)

  test(`installed integrity reader local=${local} denies an actually removed C08 receipt`, async () => {
    const f = await createInstalledIntegrityFixture(local)
    try {
      expect(await f.read()).toEqual({ status: "ok", value: f.f.fixture.review })
      // Deliberate hostile storage lifecycle, not an authorized C05 mutation.
      await f.removeReceipt()
      const result = await f.read()
      expect(result).toEqual({ status: "denied", reason: "review-integrity-unavailable" })
      expect(result).not.toHaveProperty("value")
    } finally { await f.dispose() }
  }, 120000)
}
