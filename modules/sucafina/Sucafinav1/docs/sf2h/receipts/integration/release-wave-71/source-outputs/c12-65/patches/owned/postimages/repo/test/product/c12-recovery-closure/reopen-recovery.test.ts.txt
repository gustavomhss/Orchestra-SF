import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { applicationAttempts } from "../../../product/decisions/application-attempt.ts"
import { receiptProofTransactionKey } from "../../../product/decisions/receipt-review-binding.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { openPlannerRecoveryFixture } from "./planner-fixture.ts"

test("C12 original domain receipt survives lost response, authority reopen and unrelated case edit without another dispatch", async () => {
  let fixture = await openPlannerRecoveryFixture()
  try {
    const ready = await fixture.prepare()
    const before = await fixture.observe()
    expect(before.decision!.receipts).toHaveLength(0)
    expect(ready.choice.costCoverage.coverageState).toBe("pending")
    fixture.faults.afterReceiptCommit = () => { throw new Error("C12_LOST_RESPONSE_AFTER_DOMAIN_AND_RECEIPT_COMMIT") }
    expect((await fixture.apply(ready.original)).status).toBe("unavailable")
    const committed = await fixture.observe()
    const originals = Object.values(committed.state.receipts)
    expect(originals).toHaveLength(1)
    const original = originals[0]!
    expect(original.result.ok).toBe(true)
    expect(committed.decision!.receipts).toHaveLength(0)
    expect(committed.decision!.preparedChanges[0]!.receipt).toBeUndefined()
    expect(committed.decision).toEqual(before.decision)
    expect(committed.domain.versions["v1:lines:line"]!.version).toBe(1)
    const version = rows(committed.domain.data.versions).find((value) => value.id === "v1")!
    expect((object(rows(version.lines)[0]).f as number[])[0]).toBe(42)
    expect(fixture.counters).toMatchObject({ dispatch: 1, domainExecutions: 1, receiptCommits: 1, reservationCommits: 1, caseReconciliations: 0 })
    expect(applicationAttempts(committed.state, ready.request)).toHaveLength(1)
    const originalProof = committed.state.transactions[receiptProofTransactionKey("finance", ready.change.target.id, ready.change.idempotencyKey)]!
    expect(originalProof.value).toEqual(original)
    const oldContext = await fixture.admitApply(ready.original)
    const retained = { directory: fixture.directory, caseRef: ready.request.caseRef }
    await fixture.close(false)
    fixture = await openPlannerRecoveryFixture(retained)
    expect(await fixture.observe()).toEqual(committed)
    expect((await fixture.execute(ready.request, oldContext, "recover")).status).toBe("denied")
    fixture.access.sourceAllowed = false
    const revoked = await fixture.apply(ready.original, { mode: "recover" })
    expect(revoked.status).toBe("denied")
    expect("value" in revoked).toBe(false)
    expect(await fixture.observe()).toEqual(committed)
    fixture.access.sourceAllowed = true
    expect((await fixture.apply(ready.original, { mode: "recover", principal: "other" })).status).toBe("denied")
    const edited = await fixture.editCase((value) => { value.objective = "Unrelated human case edit retained during recovery" })
    const recovered = await fixture.apply(ready.original, { mode: "recover", operationId: "c12-reopened-human" })
    expect(recovered).toEqual({ status: "ok", value: original })
    const reconciled = await fixture.observe()
    expect(reconciled.domain).toEqual(committed.domain)
    expect(reconciled.state.receipts).toEqual(committed.state.receipts)
    expect(reconciled.state.transactions[receiptProofTransactionKey("finance", ready.change.target.id, ready.change.idempotencyKey)]).toEqual(originalProof)
    expect(reconciled.decision!.objective).toBe(edited.objective)
    expect(reconciled.decision!.version).toBe(edited.version + 1)
    expect(reconciled.decision!.receipts).toEqual([original])
    expect(reconciled.decision!.preparedChanges[0]!.receipt).toEqual(original)
    expect(reconciled.decision!.choices).toEqual(committed.decision!.choices)
    for (const mode of ["recover", "apply"] as const) expect(await fixture.apply(ready.original, { mode, operationId: `c12-repeat-${mode}` })).toEqual(recovered)
    expect(await fixture.observe()).toEqual(reconciled)
    expect(fixture.counters).toMatchObject({ dispatch: 0, domainExecutions: 0, receiptCommits: 0, reservationCommits: 0, caseReconciliations: 1 })
    console.info("SF_C12_DOMAIN_RECOVERY", JSON.stringify({ receiptId: original.id, receiptDigest: digestSfValue(original), originalProofDigest: digestSfValue(originalProof), originalCaseVersion: ready.request.caseRef.version, reconciledCaseVersion: reconciled.decision!.version, domainEffects: 1, receiptCommits: 1, recoveryDispatches: 0, recoveredOriginalBytes: true, reopened: true, reseeded: false, financialApprovalCreated: false }))
  } finally { await fixture.close() }
}, 180000)

test("C12 lost reconciliation response returns the original linked receipt after reopening without another case write", async () => {
  let fixture = await openPlannerRecoveryFixture()
  try {
    const ready = await fixture.prepare()
    fixture.faults.afterCaseReconcile = () => { throw new Error("C12_LOST_RESPONSE_AFTER_CASE_RECONCILIATION") }
    expect(await fixture.apply(ready.original)).toEqual({ status: "unavailable", reason: "case-reconciliation-pending" })
    const committed = await fixture.observe()
    const original = Object.values(committed.state.receipts)[0]!
    expect(original.result.ok).toBe(true)
    expect(committed.decision!.receipts).toEqual([original])
    expect(committed.decision!.preparedChanges[0]!.receipt).toEqual(original)
    expect(fixture.counters).toMatchObject({ dispatch: 1, domainExecutions: 1, receiptCommits: 1, reservationCommits: 1, caseReconciliations: 1 })
    const retained = { directory: fixture.directory, caseRef: ready.request.caseRef }
    await fixture.close(false)
    fixture = await openPlannerRecoveryFixture(retained)
    for (const mode of ["recover", "apply"] as const) expect(await fixture.apply(ready.original, { mode })).toEqual({ status: "ok", value: original })
    expect(await fixture.observe()).toEqual(committed)
    expect(fixture.counters).toMatchObject({ dispatch: 0, domainExecutions: 0, receiptCommits: 0, reservationCommits: 0, caseReconciliations: 0 })
    console.info("SF_C12_RECONCILIATION_RECOVERY", JSON.stringify({ originalReceiptDigest: digestSfValue(original), domainEffects: 1, reconciliations: 1, additionalWrites: 0, reopened: true }))
  } finally { await fixture.close() }
}, 180000)
