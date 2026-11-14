import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { HotTopicIntent } from "../../../../product/dashboard/hot-topics.ts"
import { sfSourceIdentity } from "../../../../product/integration/source-lifecycle.ts"
import { sourceFixture } from "./source-fixture.ts"

type Fixture = Awaited<ReturnType<typeof sourceFixture>>
const fields = { action: "Review infrastructure", owner: "Authenticated operator", due: "2026-12-15", priority: "normal" as const, notes: "" }
const period = { start: "2026-01-01", end: "2026-12-31" }
async function intent(f: Fixture, correlationKey: string): Promise<HotTopicIntent> {
  const source = await f.runtime.issue({ page: "Portfolio Dashboard", recordType: "projects", recordId: "project-1", fields: ["name"], period })
  if (source.status !== "ok") throw new Error(`Real source unavailable: ${source.reason}`)
  return { ...fields, correlationKey, sourceRefs: [source.value] }
}
async function existingAction(f: Fixture) {
  const response = await f.runtime.command({ page: "Hot Topics & Actions", action: "save", version: 0, values: fields })
  expect(response?.status).toBe(200)
  expect(await response!.json()).toMatchObject({ ok: true })
  const stored = await f.runtime.inspect()
  expect(stored.topics).toHaveLength(1)
  const id = String(stored.topics[0]!.id)
  const refs = (await intent(f, "read")).sourceRefs
  const result = await f.runtime.read({ id }, (context) => f.runtime.topics.read(id, refs, context))
  if (result.status !== "ok") throw new Error(`Canonical action unavailable: ${result.reason}`)
  return result.value
}
async function identity(f: Fixture, id: string) {
  const result = await f.runtime.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "hotTopics", id) }))
  if (!result) throw new Error("Real source producer did not issue physical identity")
  return result
}
async function replace(f: Fixture, id: string, version: number) {
  const removed = await f.runtime.command({ page: "Hot Topics & Actions", action: "delete", id, version, values: {}, confirmed: true })
  expect(removed?.status).toBe(200)
  expect(await removed!.json()).toMatchObject({ ok: true })
  // Fixture input reuses the public ID; the real lifecycle must allocate the incarnation.
  await f.runtime.persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.hotTopics = [{ id, ...fields, action: "Replacement action", status: "open" }]
    return { commit: true, value: undefined }
  })
}
async function seedReceipt(f: Fixture, request: HotTopicIntent, id: string, targetIncarnation?: string) {
  // Legacy/bound receipts are explicit fixture inputs, never proof of successful atomic CREATE.
  const prior = await f.runtime.authority.state.read(f.runtime.request(), "relations", () => null)
  const key = `sf:hot-topic:${digestSfValue({ correlationKey: request.correlationKey })}`
  const receipt = { id, digest: digestSfValue({ principal: f.principalRef, ...fields, sourceRefs: request.sourceRefs }), ...(targetIncarnation ? { targetIncarnation } : {}) }
  const seeded = await f.runtime.authority.state.transaction(f.runtime.request(), {
    namespace: "relations", expectedStorageVersion: prior.status === "ok" ? prior.storageVersion : 0,
    targetRef: f.runtime.authority.creationTarget.ref, targetIncarnation: f.runtime.authority.creationTarget.incarnation,
    idempotencyKey: `fixture-receipt:${request.correlationKey}`, commandDigest: digestSfValue(receipt),
  }, async (state) => { state.relations[key] = receipt; return { commit: true, value: true } })
  expect(seeded.status).toBe("ok")
  return key
}

test("CREATE without an atomic lifecycle seam refuses before any durable effect, including exact retry and reopen", async () => {
  const f = await sourceFixture()
  try {
    const request = await intent(f, "atomic-create-unavailable"), before = await f.runtime.inspect(), other = await f.runtime.otherSurfaces()
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await f.runtime.create(request)).toEqual({ status: "unavailable", reason: "action-create-identity-unavailable" })
      expect(await f.runtime.inspect()).toEqual(before)
    }
    await f.reopen()
    expect(await f.runtime.create(request)).toEqual({ status: "unavailable", reason: "action-create-identity-unavailable" })
    expect(await f.runtime.inspect()).toEqual(before)
    expect(await f.runtime.otherSurfaces()).toBe(other)
    console.log("UI_SOURCE_CREATE", JSON.stringify({ result: "SAFE_REFUSAL", domainEffects: 0, correlations: 0, reopened: true, atomicCreateAccepted: false }))
  } finally { await f.close() }
}, 60000)

test("legacy CREATE receipt cannot bind an incarnation from the current row, before or after ID reuse", async () => {
  const f = await sourceFixture()
  try {
    const topic = await existingAction(f), request = await intent(f, "legacy-create"), original = await identity(f, topic.id)
    await seedReceipt(f, request, topic.id)
    for (let attempt = 0; attempt < 2; attempt++) {
      const before = await f.runtime.inspect()
      expect(await f.runtime.create(request)).toMatchObject({ status: "unavailable", reason: "action-identity-unbound" })
      expect(await f.runtime.inspect()).toEqual(before)
      await f.reopen()
    }
    await replace(f, topic.id, topic.version)
    expect((await identity(f, topic.id)).incarnation).not.toBe(original.incarnation)
    const before = await f.runtime.inspect()
    expect(await f.runtime.create(request)).toMatchObject({ status: "unavailable", reason: "action-identity-unbound" })
    expect(await f.runtime.inspect()).toEqual(before)
  } finally { await f.close() }
}, 60000)

test("physically bound CREATE receipt follows the original through update and reopen, but refuses ABA and content reuse", async () => {
  const f = await sourceFixture()
  try {
    const topic = await existingAction(f), request = await intent(f, "bound-create"), original = await identity(f, topic.id)
    await seedReceipt(f, request, topic.id, original.incarnation)
    const update = await f.runtime.update({ id: topic.id, version: topic.version, idempotencyKey: "later-update", sourceRefs: request.sourceRefs, values: { status: "done" } })
    if (update.status !== "ok") throw new Error(`Update rejected: ${update.reason}`)
    await f.reopen()
    const before = await f.runtime.inspect()
    expect(await f.runtime.create(request)).toEqual({ status: "ok", value: { state: "existing", topic: update.value } })
    expect(await f.runtime.create({ ...request, notes: "Changed intent" })).toMatchObject({ status: "conflict", reason: "correlation-reused" })
    expect(await f.runtime.inspect()).toEqual(before)
    await replace(f, topic.id, update.value.version)
    expect((await identity(f, topic.id)).incarnation).not.toBe(original.incarnation)
    await f.reopen()
    const replaced = await f.runtime.inspect()
    expect(await f.runtime.create(request)).toMatchObject({ status: "unavailable", reason: "action-replaced" })
    expect(await f.runtime.inspect()).toEqual(replaced)
  } finally { await f.close() }
}, 60000)

test("UPDATE binds once and returns its original receipt after reopen; replacement and revoked source stay refused", async () => {
  const f = await sourceFixture()
  try {
    const topic = await existingAction(f), request = await intent(f, "source-for-update"), original = await identity(f, topic.id)
    const update = { id: topic.id, version: topic.version, idempotencyKey: "complete-original", sourceRefs: request.sourceRefs, values: { status: "done" } }
    const completed = await f.runtime.update(update)
    if (completed.status !== "ok") throw new Error(`Update rejected: ${completed.reason}`)
    expect(completed.value).toMatchObject({ id: topic.id, status: "done", version: topic.version + 1 })
    const key = `sf:hot-topic:${digestSfValue({ correlationKey: update.idempotencyKey })}`
    expect((await f.runtime.inspect()).relations[key]).toMatchObject({ id: topic.id, targetIncarnation: original.incarnation, result: completed.value })
    const committed = await f.runtime.inspect()
    expect(await f.runtime.update(update)).toEqual(completed)
    expect(await f.runtime.inspect()).toEqual(committed)
    await f.reopen()
    expect(await f.runtime.update(update)).toEqual(completed)
    expect(await f.runtime.inspect()).toEqual(committed)
    await replace(f, topic.id, completed.value.version)
    const replacement = await identity(f, topic.id)
    expect(replacement.incarnation).not.toBe(original.incarnation)
    await f.reopen()
    const before = await f.runtime.inspect()
    expect(await f.runtime.update(update)).toMatchObject({ status: "unavailable", reason: "action-replaced" })
    expect(await f.runtime.inspect()).toEqual(before)
    await f.runtime.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.projects = []; return { commit: true, value: undefined } })
    const revoked = await f.runtime.inspect()
    expect(await f.runtime.create(request)).toMatchObject({ status: "denied", reason: "source-access-unavailable" })
    expect(await f.runtime.update(update)).toMatchObject({ status: "denied", reason: "source-access-unavailable" })
    expect(await f.runtime.inspect()).toEqual(revoked)
    console.log("UI_SOURCE_UPDATE", JSON.stringify({ domainEffects: 1, receiptCount: 1, reopened: true, original: original.incarnation, replacement: replacement.incarnation, aba: "REFUSED", revokedSource: "REFUSED" }))
  } finally { await f.close() }
}, 60000)
