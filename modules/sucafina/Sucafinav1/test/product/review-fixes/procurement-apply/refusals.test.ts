import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { object, rows } from "../../../../runtime/contract.ts"
import { domain } from "../../../../runtime/procurement.ts"
import { prepareProcurementMutation } from "../../../../product/procurement/prepared.ts"
import { createProcurementPreparedReview } from "../../../../product/procurement/prepared-review.ts"
import { actor, at, createFixture, period } from "./fixture.ts"
import type { Fixture } from "./fixture.ts"
import { prepare, replaceChanges, seedChoice, seedLegacyChange } from "./choice.ts"

test("OPS-REV-02 canonical po_draft refuses ignored PR preparation, review and HTTP Apply", async () => {
  const fixture = await createFixture("po_draft")
  try {
    const before = await fixture.material()
    expect(before.request).toMatchObject({ status: "po_draft", createdBy: "alice", buyerId: "alice", pr: { estAmount: 100 }, po: { currency: "USD", lines: [{ qty: 1, unitPrice: 100 }] } })
    const input = await preparationInput(fixture, { estAmount: 150 })
    // The unchanged real runtime still accepts a PO-stage save and ignores PR.
    // This control distinguishes the stage defect from fixture normalization errors.
    const ignored = structuredClone(input.snapshot)
    expect(domain.execute(ignored, actor, input.command, input.environment).ok).toBe(true)
    const ignoredRequest = object(object(object(object(ignored.data.store).requests)["PR-1"]).request)
    expect(ignoredRequest.pr).toEqual(before.request.pr)
    expect(ignored.versions["requests:PR-1"]?.version).toBe(before.version.version + 1)
    expect(rows(ignoredRequest.history)).toHaveLength(rows(before.request.history).length + 1)
    expect(prepareProcurementMutation(input)).toBeUndefined()
    fixture.authority.ui.finish(input.context)
    const chosen = await seedChoice(fixture)
    const rejected = await fixture.http("decision-prepare-changes", chosen)
    expect(rejected.response.status).toBe(400)
    expect(rejected.body).toEqual({ status: "needs-input", reason: "requisition-stage-not-editable" })
    expect((await fixture.storedCase()).value.preparedChanges).toEqual([])
    expect(await fixture.material()).toEqual(before)
    const legacy = await seedLegacyChange(fixture, 150)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...legacy.request })
    expect(reviewed.response.status).toBe(400)
    expect(reviewed.body).toEqual({ status: "needs-input", reason: "requisition-stage-not-editable" })
    expect(object(reviewed.body.value).reviewDigest).toBeUndefined()
    // This is a negative input, never a claimed producer proof or historical receipt.
    const applied = await fixture.http("decision-apply", { ...legacy.request, reviewDigest: "a".repeat(64) })
    expect(applied.response.status).toBe(403)
    expect(applied.body).toEqual({ status: "denied", reason: "prepared-review-required" })
    expect(await fixture.material()).toEqual(before)
    expect(await fixture.receipts()).toEqual({})
    expect((await fixture.storedCase()).value.preparedChanges[0]).toMatchObject({ state: "planned", operation: { command: { values: { pr: { estAmount: 150 } } } } })
  } finally { await fixture.dispose() }
}, 25_000)

test("OPS-REV-02 an equal amount is explicitly non-applicable without Saved, CAS or applied receipt", async () => {
  const fixture = await createFixture("draft")
  try {
    const before = await fixture.material()
    const chosen = await seedChoice(fixture, 100)
    const rejected = await fixture.http("decision-prepare-changes", chosen)
    expect(rejected.response.status).toBe(400)
    expect(rejected.body).toEqual({ status: "needs-input", reason: "requisition-already-matches" })
    const legacy = await seedLegacyChange(fixture, 100)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...legacy.request })
    expect(reviewed.response.status).toBe(400)
    expect(reviewed.body).toEqual({ status: "needs-input", reason: "requisition-already-matches" })
    expect(object(reviewed.body.value).reviewDigest).toBeUndefined()
    expect((await fixture.http("decision-apply", { ...legacy.request, reviewDigest: "b".repeat(64) })).response.status).toBe(403)
    expect(await fixture.material()).toEqual(before)
    expect(await fixture.receipts()).toEqual({})
    expect((await fixture.storedCase()).value.preparedChanges[0]?.state).toBe("planned")
  } finally { await fixture.dispose() }
}, 25_000)

test("OPS-REV-02 review rejects an amount preview that differs from the prepared intent", async () => {
  const fixture = await createFixture("draft")
  try {
    const prepared = await prepare(fixture)
    const before = await fixture.material()
    await replaceChanges(fixture, [{ ...prepared.change, operation: { ...prepared.change.operation, preview: {
      ...prepared.change.operation.preview,
      values: prepared.change.operation.preview.values.map((value) => value.id === "originalAmount" ? { ...value, value: 140 } : value),
    } } }])
    const current = await fixture.storedCase()
    const selected = { ...prepared.request, caseRef: { id: current.value.id, incarnation: current.value.incarnation, version: current.value.version } }
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...selected })
    expect(reviewed.response.status).toBe(503)
    expect(reviewed.body).toEqual({ status: "unavailable", reason: "prepared-intent-mismatch" })
    expect(object(reviewed.body.value).reviewDigest).toBeUndefined()
    expect((await fixture.http("decision-apply", { ...selected, reviewDigest: "c".repeat(64) })).response.status).toBe(403)
    expect(await fixture.material()).toEqual(before)
    expect(await fixture.receipts()).toEqual({})
  } finally { await fixture.dispose() }
}, 25_000)

test("OPS-REV-02 a mixed intent keeps equal fields and applies the exact changed field", async () => {
  const fixture = await createFixture("draft")
  try {
    const before = await fixture.material()
    const intent = { title: "Requisition fixture", estAmount: 100, justification: "Updated exact justification" }
    const input = await preparationInput(fixture, intent)
    const prepared = prepareProcurementMutation(input)
    expect(prepared).toBeDefined()
    if (!prepared) throw new Error("partial no-op incorrectly rejected the changed justification")
    const review = await createProcurementPreparedReview({ port: fixture.business.procurement, individual: fixture.business.individual })(prepared.command, input.context)
    expect(review).toMatchObject({ status: "ok", value: { fields: [{ field: "reason", before: "Recorded need", after: intent.justification }] } })
    const snapshot = structuredClone(input.snapshot)
    expect(prepared.mutation.execute(snapshot, { ...actor, id: "bob" }, input.environment)).toEqual({ commit: false, value: { status: "denied", reason: "actor-changed" } })
    expect(snapshot).toEqual(input.snapshot)
    expect(prepared.mutation.execute(snapshot, actor, input.environment)).toEqual({ commit: true, value: { status: "applied" } })
    const saved = object(object(object(object(snapshot.data.store).requests)["PR-1"]).request)
    expect(saved.pr).toEqual(intent)
    expect(snapshot.versions["requests:PR-1"]?.version).toBe(before.version.version + 1)
    expect(rows(saved.history)).toHaveLength(rows(before.request.history).length + 1)
    expect(await fixture.material()).toEqual(before)
    fixture.authority.ui.finish(input.context)
  } finally { await fixture.dispose() }
}, 25_000)

async function preparationInput(fixture: Fixture, pr: Record<string, string | number>) {
  const context = await fixture.ui("sf_request_read", { requestRef: fixture.evidence.refId })
  const source = await fixture.business.individual.resolveForPreparation(fixture.evidence.refId, context)
  if (source.status !== "ok") throw new Error(`prepared source unavailable: ${source.reason}`)
  const snapshot = await fixture.persistence.transaction("procurement", async (value) => ({ commit: false, value: structuredClone(value) }))
  const evidence = source.value.evidence
  const target = { surface: "procurement" as const, type: evidence.target.recordType, id: evidence.target.recordId, incarnation: evidence.target.incarnation, version: evidence.target.version, fields: evidence.target.fields, period, observedAt: at }
  return {
    snapshot, actor, context, target, scope: source.value.scope, evidence,
    command: { page: "Requests", action: "save", id: target.id, version: snapshot.versions["requests:PR-1"]!.version, values: { pr } },
    environment: { at, id: randomUUID, directory: [{ id: actor.id, name: "Alice" }] }, operationId: "intent-operation", idempotencyKey: "intent-operation",
  }
}
