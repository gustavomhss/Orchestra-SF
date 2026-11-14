import { expect, test } from "bun:test"
import { object, rows } from "../../../../runtime/contract.ts"
import { digestSfEvidenceRef } from "../../../../product/contracts/canonical.ts"
import { createFixture } from "./fixture.ts"
import { prepare, readReviewDigest } from "./choice.ts"

for (const stage of ["draft", "pr_rejected"] as const) test(`OPS-REV-02 real HTTP ${stage} reviews and applies exactly 100 to 150 once`, async () => {
  const fixture = await createFixture(stage)
  try {
    const before = await fixture.material()
    const prepared = await prepare(fixture)
    expect(prepared.change.operation.command).toEqual({ page: "Requests", action: "save", id: "PR-1", version: before.version.version, values: { pr: { estAmount: 150 } } })
    expect(prepared.change.target).toMatchObject({ incarnation: fixture.evidence.target.incarnation, version: fixture.evidence.target.version, fields: fixture.evidence.target.fields })
    expect(fixture.evidence.refDigest).toBe(digestSfEvidenceRef(fixture.evidence))
    expect(prepared.change.operation.preview.context.currency).toBe("USD")
    expect(prepared.change.operation.preview.values.every((value) => value.sourceRefs.length === 1 && value.sourceRefs[0]?.refDigest === fixture.evidence.refDigest)).toBe(true)
    expect(await fixture.material()).toEqual(before)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    expect(object(reviewed.body.value).fields).toContainEqual({ field: "originalAmount", before: 100, after: 150, beforeCurrency: "USD", afterCurrency: "USD" })
    const application = { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) }
    const wrongDigest = `${application.reviewDigest[0] === "0" ? "1" : "0"}${application.reviewDigest.slice(1)}`
    const refused = await fixture.http("decision-apply", { ...application, reviewDigest: wrongDigest })
    expect(refused.response.status).toBe(409)
    expect(refused.body).toEqual({ status: "conflict", reason: "prepared-review-proof-mismatch" })
    expect((await fixture.http("decision-apply", application, "bob")).response.status).toBe(403)
    expect(await fixture.material()).toEqual(before)
    expect(await fixture.receipts()).toEqual({})
    const applied = await fixture.http("decision-apply", application, "alice", "apply-exactly-once")
    expect(applied.response.status).toBe(200)
    expect(applied.body).toMatchObject({ status: "ok", value: { outcome: "applied", version: before.version.version + 1 } })
    const after = await fixture.material()
    expect(object(after.request.pr)).toEqual({ ...object(before.request.pr), estAmount: 150 })
    expect(after.request.status).toBe(stage)
    expect(after.request.createdBy).toBe("alice")
    expect(after.settings).toEqual(before.settings)
    expect(after.version).toMatchObject({ version: before.version.version + 1, by: "alice" })
    expect(rows(after.request.history)).toHaveLength(rows(before.request.history).length + 1)
    expect(rows(after.request.history).at(-1)).toMatchObject({ action: "Saved", by: "alice" })
    const receipts = await fixture.receipts()
    expect(Object.values(receipts)).toHaveLength(1)
    expect(Object.values(receipts)[0]).toMatchObject({ principalRef: "alice", surface: "procurement", commandDigest: prepared.change.operation.commandDigest, idempotencyKey: prepared.change.idempotencyKey, result: { ok: true, value: { status: "applied" } } })
    const retried = await fixture.http("decision-apply", application, "alice", "apply-exactly-once")
    expect(retried.response.status).toBe(200)
    expect(retried.body).toEqual(applied.body)
    expect(await fixture.material()).toEqual(after)
    expect(await fixture.receipts()).toEqual(receipts)
    expect((await fixture.storedCase()).value).toMatchObject({ state: "applied", receipts: [expect.objectContaining({ commandDigest: prepared.change.operation.commandDigest })] })
    fixture.revoke()
    expect((await fixture.http("decision-apply", application, "alice", "apply-exactly-once")).response.status).toBe(403)
    expect(await fixture.material()).toEqual(after)
    expect(await fixture.receipts()).toEqual(receipts)
  } finally { await fixture.dispose() }
}, 45_000)

test("OPS-REV-02 real Apply refuses a changed source and preserves its newer CAS", async () => {
  const fixture = await createFixture("draft")
  try {
    const prepared = await prepare(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    const application = { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) }
    await fixture.edit({ estAmount: 125 })
    const concurrent = await fixture.material()
    const rejected = await fixture.http("decision-apply", application)
    expect(rejected.response.status).toBe(409)
    expect(rejected.body.status).toBe("stale")
    expect(object(concurrent.request.pr).estAmount).toBe(125)
    expect(concurrent.version.version).toBe(prepared.change.expectedVersion + 1)
    expect(await fixture.material()).toEqual(concurrent)
    expect(await fixture.receipts()).toEqual({})
    expect((await fixture.storedCase()).value.preparedChanges[0]?.state).toBe("planned")
  } finally { await fixture.dispose() }
}, 25_000)
