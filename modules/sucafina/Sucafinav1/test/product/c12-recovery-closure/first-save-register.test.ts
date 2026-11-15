import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { object, rows } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { HotTopicDraftRequest } from "../../../product/decisions/hot-topic-draft.ts"
import { firstSavePeriod, openFirstSaveFixture } from "./first-save-fixture.ts"

const caseInput = { objective: "Recover a first operational draft", horizon: firstSavePeriod, currency: "USD", criteria: ["Operational action"], sourceRefs: [] }

test("C12 first case save reopens the original C08 creation after its committed acknowledgement is lost", async () => {
  let fixture = await openFirstSaveFixture()
  try {
    const key = randomUUID()
    fixture.loseNextCommitAcknowledgement("cases", key)
    const lost = await fixture.draftCase(caseInput, key)
    expect(lost).toEqual({ status: "unavailable", reason: "product-state-unavailable" })
    expect(fixture.acknowledgements).toHaveLength(1)
    const original = fixture.acknowledgements[0]!.value
    const persisted = await fixture.state()
    expect(Object.values(persisted.cases)).toEqual([original])
    expect(Object.keys(persisted.transactions)).toHaveLength(1)
    expect(Object.values(persisted.receipts)).toHaveLength(0)
    const beforeReopen = await fixture.durable()
    const retained = fixture.retained
    const oldAuthority = fixture.authority
    await fixture.close(false)
    fixture = await openFirstSaveFixture(retained)
    expect(fixture.authority).not.toBe(oldAuthority)
    expect(await fixture.durable()).toEqual(beforeReopen)

    const recovered = await fixture.draftCase(caseInput, key)
    expect(recovered).toEqual({ status: "ok", value: original })
    expect(await fixture.draftCase(caseInput, key)).toEqual(recovered)
    expect(await fixture.durable()).toEqual(beforeReopen)
    expect(await fixture.draftCase({ ...caseInput, objective: "Mutated first intent" }, key))
      .toEqual({ status: "conflict", reason: "idempotency-content-changed" })
    fixture.revoke("alice")
    expect((await fixture.draftCase(caseInput, key)).status).toBe("denied")
    expect(await fixture.durable()).toEqual(beforeReopen)
    fixture.restore("alice")
    expect(await fixture.draftCase(caseInput, key)).toEqual(recovered)
    expect(await fixture.durable()).toEqual(beforeReopen)
    console.info("SF_C12_FIRST_CASE_SAVE", JSON.stringify({ caseId: object(original).id, version: object(original).version,
      originalResultDigest: digestSfValue(original), durableCaseCount: 1, mutationCount: 1, reopen: "SQLite-and-services", reseeded: false }))
  } finally { await fixture.close() }
})

test("C12 lost first Hot Topic register recovers its exact original result after reopen without choosing a later identical draft", async () => {
  let fixture = await openFirstSaveFixture()
  try {
    const created = await fixture.draftCase(caseInput, randomUUID())
    if (created.status !== "ok") throw new Error(`Real case creation failed: ${created.reason}`)
    const caseRef = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
    expect(created.value.choices).toHaveLength(0)
    expect(created.value.receipts).toHaveLength(0)
    const issued = await fixture.http("dashboard-hot-topic-source", { recordId: "topic", period: firstSavePeriod })
    expect(issued.status).toBe(200)
    const source = object(issued.body.value)
    if (!source.target || !source.targetEvidence) throw new Error("Real Dashboard source producer did not issue a target")
    const draft: HotTopicDraftRequest = { caseRef, target: source.target as HotTopicDraftRequest["target"],
      targetEvidence: source.targetEvidence as HotTopicDraftRequest["targetEvidence"], sourceRefs: [source.targetEvidence as HotTopicDraftRequest["targetEvidence"]],
      fields: { action: "Two explicit intents with identical text", owner: "Operations", due: "2026-12-01", priority: "normal", notes: "Private operational rationale" }, expectedVersion: 0 }
    const official = await fixture.durable()
    const key = randomUUID()
    fixture.loseNextCommitAcknowledgement("preferences", key)
    const lost = await fixture.http("dashboard-hot-topic-draft", draft, key)
    expect(lost).toEqual({ status: 503, body: { status: "unavailable", reason: "hot-topic-draft-unavailable" } })
    expect(fixture.acknowledgements).toHaveLength(1)
    const original = object(fixture.acknowledgements[0]!.value)
    expect(original.version).toBe(1)
    if (typeof original.draftRef !== "string") throw new Error("The real commit did not persist a draft identity")
    const originalDraftRef = original.draftRef
    const afterFirst = await fixture.state()
    const firstTransaction = Object.values(afterFirst.transactions).filter((item) => item.namespace === "preferences")
    expect(firstTransaction).toHaveLength(1)
    expect(firstTransaction[0]!.value).toEqual(original)
    expect(afterFirst.cases[caseRef.id]).toEqual(created.value)
    expect(Object.values(afterFirst.receipts)).toHaveLength(0)

    // A different explicitly submitted key creates a different real registration.
    // Recovery of the original key must not select this later, equal-looking draft.
    const second = await fixture.http("dashboard-hot-topic-draft", draft, randomUUID())
    expect(second.status).toBe(200)
    expect(object(second.body.value).draftRef).not.toBe(originalDraftRef)
    const durable = await fixture.durable()
    expect(rows(durable.dashboard.data.hotTopics)).toEqual(rows(official.dashboard.data.hotTopics))
    expect(durable.dashboard.versions).toEqual(official.dashboard.versions)
    expect(durable.dashboard.audit).toEqual(official.dashboard.audit)
    const retained = fixture.retained
    const oldAuthority = fixture.authority
    await fixture.close(false)
    fixture = await openFirstSaveFixture(retained)
    expect(fixture.authority).not.toBe(oldAuthority)
    expect(await fixture.durable()).toEqual(durable)

    expect(await fixture.http("dashboard-hot-topic-draft", { ...draft, fields: { ...draft.fields, notes: "Changed original body" } }, key))
      .toEqual({ status: 409, body: { status: "conflict", reason: "idempotency-content-changed" } })
    expect((await fixture.http("dashboard-hot-topic-draft", draft, key, "bob")).status).toBe(403)
    fixture.revoke("alice")
    expect((await fixture.http("dashboard-hot-topic-draft", draft, key)).status).toBe(403)
    expect(await fixture.durable()).toEqual(durable)
    fixture.restore("alice")

    const recovered = await fixture.http("dashboard-hot-topic-draft", draft, key)
    expect(recovered).toEqual({ status: 200, body: { status: "ok", value: original } })
    expect(await fixture.http("dashboard-hot-topic-draft", draft, key)).toEqual(recovered)
    const read = await fixture.read((context) => fixture.business.dashboardDecisions.drafts.readCurrent({ caseRef, draftRef: originalDraftRef }, context))
    expect(read).toMatchObject({ status: "ok", value: { draftRef: originalDraftRef, version: 1, fields: draft.fields, principalRef: "alice" } })
    const listed = await fixture.read((context) => fixture.business.dashboardDecisions.drafts.list({ caseRef }, context))
    if (listed.status !== "ok") throw new Error(`Authorized draft list failed: ${listed.reason}`)
    expect(listed.value).toHaveLength(2)
    expect(listed.value.filter((item) => item.draftRef === originalDraftRef)).toHaveLength(1)
    const after = await fixture.state()
    expect(Object.values(after.transactions).filter((item) => item.namespace === "preferences")).toHaveLength(2)
    expect(after.cases[caseRef.id]).toEqual(created.value)
    expect(Object.values(after.receipts)).toHaveLength(0)
    expect(await fixture.durable()).toEqual(durable)
    // This proves exact retained-body recovery at the producer/HTTP boundary.
    // The historical UI retains only caseRef/key before draftRef; its missing
    // lookup is an external owner proposal, not a capability supplied by this test.
    console.info("SF_C12_FIRST_REGISTER", JSON.stringify({ caseRef, originalDraftRef, originalResultDigest: digestSfValue(original),
      originalIntentEffects: 1, separateIntentEffects: 1, extraEffectsFromRecovery: 0, receipts: 0,
      reopen: "SQLite-and-services", reseeded: false, originalBodyRetained: true, minimalLookupQualified: false }))
  } finally { await fixture.close() }
})
