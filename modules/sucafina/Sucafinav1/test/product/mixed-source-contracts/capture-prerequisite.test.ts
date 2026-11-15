import { expect, test } from "bun:test"
import { object } from "../../../runtime/contract.ts"
import { createFixture } from "../review-fixes/procurement-apply/fixture.ts"
import { seedChoice } from "../review-fixes/procurement-apply/choice.ts"

// A successful refusal is not the missing C17 archive positive. This test keeps
// that prerequisite explicit and never inserts history, approval or a grant.
test("real C08 Procurement preparation exposes the M31 blocker and cannot manufacture an original capture", async () => {
  const fixture = await createFixture("draft")
  try {
    const selection = await seedChoice(fixture, 150)
    const sourceCall = await fixture.ui("sf_request_read", { requestRef: fixture.evidence.refId })
    try {
      expect(await fixture.business.individual.resolveForPreparation(fixture.evidence.refId, sourceCall)).toMatchObject({ status: "ok", value: { evidence: fixture.evidence } })
      expect(await fixture.business.procurement.read({ requestRef: fixture.evidence.refId }, sourceCall)).toMatchObject({ status: "ok", value: { values: expect.arrayContaining([expect.objectContaining({ id: "originalAmount", value: 100 })]) } })
    } finally { fixture.authority.ui.finish(sourceCall) }
    const before = await snapshots(fixture)
    const originalKey = `sf:procurement-evidence:${fixture.evidence.refDigest}`
    const privateState = object(before[0]!.data.__sfProductV1)
    expect(object(privateState.preferences)[originalKey]).toBeUndefined()
    const decision = (await fixture.storedCase()).value
    expect(decision.choices).toHaveLength(1)
    expect(decision.choices[0]?.id).toBe(selection.choiceId)
    expect(decision.preparedChanges).toHaveLength(0)

    const admitted = await fixture.authority.human.admit(fixture.request(), "decisions.prepare-changes", selection)
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") throw new Error("Actual preparation admission failed")
    try {
      const result = await fixture.business.procurementDecisions.prepareDomainCommands(selection.caseRef, selection.choiceId, selection.operations, admitted.value)
      expect(result).toEqual({ status: "needs-input", reason: "financial-approval-command-unavailable" })
      expect(Object.hasOwn(result, "value")).toBe(false)
    } finally { fixture.authority.human.finish(admitted.value) }

    const response = await fixture.http("decision-prepare-changes", selection)
    expect(response.response.status).toBe(400)
    expect(response.body).toEqual({ status: "needs-input", reason: "financial-approval-command-unavailable" })
    expect(await snapshots(fixture)).toEqual(before)
    expect((await fixture.storedCase()).value).toEqual(decision)
    expect(await fixture.receipts()).toEqual(object(privateState.receipts))
    const after = object((await snapshots(fixture))[0]!.data.__sfProductV1)
    expect(object(after.preferences)[originalKey]).toBeUndefined()
    expect(Object.keys(object(after.preferences)).filter((key) => key.startsWith("sf:procurement-evidence:"))).toEqual(
      Object.keys(object(privateState.preferences)).filter((key) => key.startsWith("sf:procurement-evidence:")),
    )
    console.info("SF_MIXED_CAPTURE_PREREQUISITE", JSON.stringify({ producer: "prepareDomainCommands", prerequisite: "M31-FINANCIAL-APPROVAL",
      outcome: response.body.status, reason: response.body.reason, httpStatus: response.response.status,
      archiveCountBefore: Object.keys(object(privateState.preferences)).filter((key) => key.startsWith("sf:procurement-evidence:")).length,
      archiveCountAfter: Object.keys(object(after.preferences)).filter((key) => key.startsWith("sf:procurement-evidence:")).length,
      preparedChangeCount: (await fixture.storedCase()).value.preparedChanges.length,
      historicalCaptureCreated: Object.hasOwn(object(after.preferences), originalKey), historicalScopeRotationQualified: false }))
  } finally { await fixture.dispose() }
}, 120_000)

function snapshots(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return Promise.all((["dashboard", "planner", "procurement"] as const).map((surface) =>
    fixture.persistence.transaction(surface, async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))))
}
