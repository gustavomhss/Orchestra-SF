import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import { requireApplicationAttempts } from "../application-attempt-fixture.ts"
import { openPlannerRecoveryFixture } from "./planner-fixture.ts"

test("C12 recovery refuses material or choice replacement even when the original claimed digests and keys are retained", async () => {
  let fixture = await openPlannerRecoveryFixture()
  try {
    const ready = await fixture.prepare()
    expect(ready.change.requiredAuthority).toContain("finance")
    fixture.faults.afterReceiptCommit = () => { throw new Error("C12_LOST_RESPONSE_FOR_ADVERSARIAL_RECOVERY") }
    expect((await fixture.apply(ready.original)).status).toBe("unavailable")
    const committed = await fixture.observe()
    const original = Object.values(committed.state.receipts)[0]!
    expect(original.result.ok).toBe(true)
    const retained = { directory: fixture.directory, caseRef: ready.request.caseRef }
    await fixture.close(false)
    fixture = await openPlannerRecoveryFixture(retained)
    const mutations: { name: string; edit: (value: DecisionCase) => void; reason: string }[] = [
      { name: "command-values", edit: (value) => { value.preparedChanges[0]!.operation.command.values.f0 = 777 }, reason: "original-intent-mismatch" },
      { name: "expected-version", edit: (value) => { value.preparedChanges[0]!.expectedVersion++ }, reason: "original-intent-mismatch" },
      { name: "required-authority", edit: (value) => { value.preparedChanges[0]!.requiredAuthority = [] }, reason: "original-intent-mismatch" },
      { name: "choice-content", edit: (value) => { value.choices[0]!.reason = "Replacement choice after the actual effect" }, reason: "original-intent-mismatch" },
      { name: "duplicate-choice", edit: (value) => { value.choices = [...value.choices, structuredClone(value.choices[0]!)] }, reason: "prepared-change-unavailable" },
      { name: "duplicate-change", edit: (value) => { value.preparedChanges = [...value.preparedChanges, structuredClone(value.preparedChanges[0]!)] }, reason: "prepared-change-unavailable" },
    ]
    for (const mutation of mutations) {
      await fixture.editCase(mutation.edit)
      const attacked = await fixture.observe()
      expect(attacked.decision!.preparedChanges[0]!.operation.commandDigest).toBe(ready.change.operation.commandDigest)
      expect(attacked.decision!.preparedChanges[0]!.idempotencyKey).toBe(ready.change.idempotencyKey)
      const refused = await fixture.apply(ready.original, { mode: "recover", operationId: `c12-${mutation.name}` })
      expect(refused).toEqual({ status: mutation.reason === "original-intent-mismatch" ? "conflict" : "unavailable", reason: mutation.reason })
      expect("value" in refused).toBe(false)
      expect(await fixture.observe()).toEqual(attacked)
      expect(attacked.decision!.receipts).toHaveLength(0)
      await fixture.editCase((value) => ({ ...structuredClone(committed.decision!), version: value.version + 1 }))
    }
    await fixture.editCase((value) => { value.preparedChanges[0]!.idempotencyKey += "-other"; value.preparedChanges[0]!.operation.idempotencyKey = value.preparedChanges[0]!.idempotencyKey })
    const changedKey = await fixture.observe()
    expect(await fixture.apply(ready.original, { mode: "recover" })).toEqual({ status: "unavailable", reason: "original-receipt-unavailable" })
    expect(await fixture.apply(ready.original)).toEqual({ status: "unavailable", reason: "application-indeterminate-reconciliation-required" })
    expect(await fixture.observe()).toEqual(changedKey)
    await fixture.editCase((value) => ({ ...structuredClone(committed.decision!), version: value.version + 1 }))
    await fixture.editCase((value) => { value.preparedChanges[0]!.target.incarnation += "-recreated" })
    const changedTarget = await fixture.observe()
    expect((await fixture.apply(ready.original, { mode: "recover" })).status).toBe("denied")
    expect(await fixture.observe()).toEqual(changedTarget)
    await fixture.editCase((value) => ({ ...structuredClone(committed.decision!), version: value.version + 1 }))
    const restored = await fixture.observe()
    for (const authority of ["policy", "revision"] as const) {
      fixture.access[authority] = "2"
      const refused = await fixture.apply(ready.original, { mode: "recover" })
      expect(refused.status).toBe("denied")
      expect("value" in refused).toBe(false)
      expect(await fixture.observe()).toEqual(restored)
      fixture.access[authority] = "1"
    }
    const wrongVersion = { ...ready.original, caseRef: { ...ready.original.caseRef, version: ready.original.caseRef.version + 1 } }
    expect(await fixture.apply(wrongVersion, { mode: "recover" })).toEqual({ status: "conflict", reason: "original-intent-mismatch" })
    expect(await fixture.observe()).toEqual(restored)
    expect(await fixture.apply(ready.original, { mode: "recover" })).toEqual({ status: "ok", value: original })
    const result = await fixture.observe()
    expect(result.domain).toEqual(committed.domain)
    expect(result.state.receipts).toEqual(committed.state.receipts)
    expect(result.decision!.receipts).toEqual([original])
    expect(fixture.counters).toMatchObject({ dispatch: 0, domainExecutions: 0, receiptCommits: 0, reservationCommits: 0, caseReconciliations: 1 })
    console.info("SF_C12_ORIGINAL_INTENT", JSON.stringify({ cases: [...mutations.map((value) => value.name), "domain-key", "target-incarnation", "policy", "access-revision"], originalRequestVersionBound: true, originalReceiptDigest: digestSfValue(original), redispatches: 0, allRefusalsBeforeReconciliation: true }))
  } finally { await fixture.close() }
}, 180000)

test("C12 a lost reservation without a receipt remains indeterminate and never redispatches after reopen", async () => {
  let fixture = await openPlannerRecoveryFixture()
  try {
    const ready = await fixture.prepare()
    const initial = await fixture.observe()
    expect(await fixture.apply(ready.original, { mode: "recover" })).toEqual({ status: "unavailable", reason: "original-receipt-unavailable" })
    expect(await fixture.observe()).toEqual(initial)
    fixture.faults.afterReservationCommit = () => { throw new Error("C12_LOST_RESERVATION_ACK_BEFORE_DOMAIN_DISPATCH") }
    expect(await fixture.apply(ready.original)).toEqual({ status: "unavailable", reason: "application-indeterminate-reconciliation-required" })
    const reserved = await fixture.observe()
    expect(await fixture.readProduct((state, authority) => requireApplicationAttempts(state, ready.request, authority))).toHaveLength(1)
    expect(reserved.domain).toEqual(initial.domain)
    expect(reserved.decision).toEqual(initial.decision)
    expect(Object.values(reserved.state.receipts)).toHaveLength(0)
    expect(fixture.counters).toMatchObject({ dispatch: 0, domainExecutions: 0, receiptCommits: 0, reservationCommits: 1, caseReconciliations: 0 })
    const retained = { directory: fixture.directory, caseRef: ready.request.caseRef }
    await fixture.close(false)
    fixture = await openPlannerRecoveryFixture(retained)
    expect(await fixture.observe()).toEqual(reserved)
    for (const operationId of ["c12-original-key-retry", "c12-another-ui-key"]) {
      expect(await fixture.apply(ready.original, { operationId })).toEqual({ status: "unavailable", reason: "application-indeterminate-reconciliation-required" })
      expect(await fixture.apply(ready.original, { mode: "recover", operationId })).toEqual({ status: "unavailable", reason: "original-receipt-unavailable" })
    }
    expect((await fixture.apply(ready.original, { principal: "other" })).status).toBe("denied")
    expect(await fixture.observe()).toEqual(reserved)
    expect(fixture.counters).toMatchObject({ dispatch: 0, domainExecutions: 0, receiptCommits: 0, reservationCommits: 0, caseReconciliations: 0 })
    console.info("SF_C12_INDETERMINATE", JSON.stringify({ attempts: 1, receipts: 0, domainEffects: 0, redispatches: 0, recoveryOutcome: "original-receipt-unavailable", reopened: true }))
  } finally { await fixture.close() }
}, 180000)
