import { expect, test } from "bun:test"
import { object } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createFixture } from "../review-fixes/procurement-apply/fixture.ts"
import { seedChoice } from "../review-fixes/procurement-apply/choice.ts"

// Draft preparation records the actual authorized original; a human choice does
// not approve the requisition, apply its amount, or grant historical access.
test("real C08 Procurement draft preparation captures its authorized original without granting financial approval", async () => {
  const fixture = await createFixture("draft")
  try {
    const selection = await seedChoice(fixture, 150)
    const sourceCall = await fixture.ui("sf_request_read", { requestRef: fixture.evidence.refId })
    try {
      expect(await fixture.business.individual.resolveForPreparation(fixture.evidence.refId, sourceCall)).toMatchObject({ status: "ok", value: { evidence: fixture.evidence } })
      expect(await fixture.business.procurement.read({ requestRef: fixture.evidence.refId }, sourceCall)).toMatchObject({ status: "ok", value: { values: expect.arrayContaining([expect.objectContaining({ id: "originalAmount", value: 100 })]) } })
    } finally { fixture.authority.ui.finish(sourceCall) }
    const before = await snapshots(fixture)
    const beforeMaterial = await fixture.material()
    const originalKey = `sf:procurement-evidence:${fixture.evidence.refDigest}`
    const privateState = object(before[0]!.data.__sfProductV1)
    expect(object(privateState.preferences)[originalKey]).toBeUndefined()
    const decision = (await fixture.storedCase()).value
    expect(decision.choices).toHaveLength(1)
    expect(decision.choices[0]?.id).toBe(selection.choiceId)
    expect(decision.preparedChanges).toHaveLength(0)

    const readOnly = await fixture.ui("sf_request_read", { requestRef: fixture.evidence.refId })
    try {
      expect(await fixture.business.procurementDecisions.prepareDomainCommands(selection.caseRef, selection.choiceId, selection.operations, readOnly))
        .toEqual({ status: "denied", reason: "human-preparation-required" })
    } finally { fixture.authority.ui.finish(readOnly) }
    expect(await snapshots(fixture)).toEqual(before)
    expect((await fixture.storedCase()).value).toEqual(decision)

    const command = { page: "Requests", action: "save", id: "PR-1", version: beforeMaterial.version.version, confirmed: false, values: { pr: { estAmount: 150 } } }
    const transport = fixture.request("alice", "decision-prepare-changes", selection)
    const admitted = await fixture.authority.human.admit(transport, "decisions.prepare-changes", selection)
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") throw new Error(`Actual preparation admission failed: ${admitted.reason}`)
    try {
      expect(await fixture.authority.human.authorize(admitted.value, "decisions.prepare-changes", selection)).toBe(true)
      const result = await fixture.business.procurementDecisions.prepareDomainCommands(selection.caseRef, selection.choiceId, selection.operations, admitted.value)
      expect(result.status).toBe("ok")
      if (result.status !== "ok") throw new Error(`Actual draft preparation failed: ${result.reason}`)
      expect(result.value).toHaveLength(1)
      expect(result.value[0]!.command.command).toEqual(command)
      expect(result.value[0]!.targetEvidence).toEqual(fixture.evidence)
    } finally { fixture.authority.human.finish(admitted.value) }

    const capturedSnapshots = await snapshots(fixture)
    const capturedState = object(capturedSnapshots[0]!.data.__sfProductV1)
    const original = object(object(capturedState.preferences)[originalKey])
    expect(original.schema).toBe("sf-procurement-evidence-v1")
    expect(original.evidence).toEqual(fixture.evidence)
    expect(original.physicalIncarnation).toBe(before[2]!.sfSources?.records[JSON.stringify(["procurement-request", "PR-1"])]?.incarnation)
    expect(typeof original.physicalIncarnation).toBe("string")
    expect(original.projectionDigest).toBe(digestSfValue(original.projection))
    const { proofDigest, ...capture } = original
    expect(proofDigest).toBe(digestSfValue(capture))
    expect(object(original.projection).values).toContainEqual(expect.objectContaining({ id: "originalAmount", value: 100 }))
    const captureReceipts = Object.values(object(capturedState.transactions)).map(object).filter((receipt) =>
      receipt.namespace === "preferences" && receipt.commandDigest === digestSfValue({ action: "capture-procurement-evidence", ref: fixture.evidence, scope: original.scope }))
    expect(captureReceipts).toHaveLength(1)
    expect(captureReceipts[0]).toMatchObject({ principalRef: "alice", value: true })
    expect((await fixture.storedCase()).value).toEqual(decision)
    expect(await fixture.material()).toEqual(beforeMaterial)
    expect(await fixture.receipts()).toEqual(object(privateState.receipts))

    const response = await fixture.http("decision-prepare-changes", selection)
    expect(response.response.status).toBe(200)
    expect(response.body.status).toBe("ok")
    const preparedCase = (await fixture.storedCase()).value
    expect(preparedCase.choices).toEqual(decision.choices)
    expect(preparedCase.preparedChanges).toHaveLength(1)
    expect(preparedCase.preparedChanges[0]).toMatchObject({ state: "planned", choiceId: selection.choiceId, operation: { command } })
    expect(await fixture.material()).toEqual(beforeMaterial)
    expect(beforeMaterial.request.status).toBe("draft")
    expect(await fixture.receipts()).toEqual(object(privateState.receipts))
    const after = await snapshots(fixture)
    const afterState = object(after[0]!.data.__sfProductV1)
    expect(object(afterState.preferences)[originalKey]).toEqual(original)
    expect(Object.keys(object(afterState.preferences)).filter((key) => key.startsWith("sf:procurement-evidence:"))).toEqual([originalKey])
    expect(after.slice(1)).toEqual(before.slice(1))
    expect({ ...after[0], data: { ...after[0]!.data, __sfProductV1: undefined } })
      .toEqual({ ...before[0], data: { ...before[0]!.data, __sfProductV1: undefined } })

    fixture.revoke()
    expect((await fixture.http("decision-prepare-changes", selection)).response.status).toBe(403)
    expect(await snapshots(fixture)).toEqual(after)
    expect(await fixture.receipts()).toEqual(object(privateState.receipts))
    console.info("SF_MIXED_CAPTURE_PREREQUISITE", JSON.stringify({ producer: "prepareDomainCommands",
      outcome: response.body.status, httpStatus: response.response.status,
      archiveCountBefore: Object.keys(object(privateState.preferences)).filter((key) => key.startsWith("sf:procurement-evidence:")).length,
      archiveCountAfter: Object.keys(object(afterState.preferences)).filter((key) => key.startsWith("sf:procurement-evidence:")).length,
      preparedChangeCount: preparedCase.preparedChanges.length, historicalCaptureCreated: Object.hasOwn(object(afterState.preferences), originalKey),
      financialApprovalGranted: beforeMaterial.request.status !== "draft" }))
  } finally { await fixture.dispose() }
}, 120_000)

function snapshots(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return Promise.all((["dashboard", "planner", "procurement"] as const).map((surface) =>
    fixture.persistence.transaction(surface, async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))))
}
