import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { object, rows } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createC12Fixture, prepareC12Change, readReviewDigest } from "../c12-receipt-recovery/fixture.ts"
import { observeC12 } from "../c12-receipt-recovery/consumer.ts"

test("C12 recovery refuses a material choice edit after canonical admission but before executor capture", async () => {
  const fixture = await createC12Fixture("c12-composed-admission-choice-race", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    const applied = await fixture.http("decision-apply", {
      ...prepared.request, reviewDigest: readReviewDigest(reviewed.body),
    }, "alice", "c12-admission-original-application")
    expect(applied.response.status).toBe(200)
    const committed = await observeC12(fixture)
    expect(committed.receipts).toHaveLength(1)
    expect(committed.decision.receipts).toEqual(committed.receipts)
    const originalChoice = committed.decision.choices.find((choice) => choice.id === prepared.request.choiceId)!
    const materialChoice = {
      ...originalChoice,
      reason: "Choice materially replaced after the original intent was admitted",
      scenario: { ...originalChoice.scenario, operations: originalChoice.scenario.operations.map((operation) => ({ ...operation, amount: 900 })) },
    }
    const reads = fixture.receiptReads.count
    // Read1 is the host's receipt preflight after readApplicationIntent has
    // validated the original choice. The executor has not captured its case yet.
    fixture.afterReceiptRead(async () => {
      const current = await fixture.storedCase()
      const changed = {
        ...current.value,
        version: current.value.version + 1,
        objective: "Concurrent admission-window edit remains visible",
        choices: current.value.choices.map((choice) => choice.id === materialChoice.id ? materialChoice : choice),
      }
      const saved = await fixture.authority.state.transaction(fixture.request(), {
        namespace: "cases", expectedStorageVersion: current.storageVersion,
        targetRef: changed.id, targetIncarnation: changed.incarnation,
        idempotencyKey: randomUUID(), commandDigest: digestSfValue(changed),
      }, async (state) => {
        state.cases[changed.id] = changed
        return { commit: true, value: true }
      })
      expect(saved.status).toBe("ok")
    }, 1)
    const recovery = await fixture.http("decision-recover", {
      purpose: "recover", ...prepared.request,
      caseRef: { id: committed.decision.id, incarnation: committed.decision.incarnation, version: committed.decision.version },
    }, "alice", "c12-admission-race-recovery")
    const recoveryReads = fixture.receiptReads.count - reads
    const observed = await observeC12(fixture)
    expect(fixture.receiptReads.interleavings).toBe(1)
    expect(fixture.receiptCommits).toHaveLength(1)
    expect(observed.domain).toEqual(committed.domain)
    expect(object(observed.domain.request.pr).estAmount).toBe(150)
    expect(observed.domain.version).toEqual({ version: 1, by: "alice" })
    expect(rows(observed.domain.request.history)).toHaveLength(1)
    expect(rows(observed.domain.request.history)[0]).toMatchObject({ action: "Saved", by: "alice" })
    expect(observed.receipts).toEqual(committed.receipts)
    expect(observed.receipts[0]!.principalRef).toBe("alice")
    expect(observed.decision.version).toBe(committed.decision.version + 1)
    expect(observed.decision.objective).toBe("Concurrent admission-window edit remains visible")
    expect(observed.decision.choices.find((choice) => choice.id === originalChoice.id)).toEqual(materialChoice)
    expect(observed.decision.ledger).toEqual(committed.decision.ledger)
    expect(observed.decision.preparedChanges).toEqual(committed.decision.preparedChanges)
    expect(observed.decision.receipts).toEqual(committed.decision.receipts)
    console.info("SF_C12_ADMISSION_INTERLEAVING_OBSERVED", JSON.stringify({
      status: recovery.response.status, result: recovery.body,
      receiptReads: recoveryReads, interleavings: fixture.receiptReads.interleavings,
      effects: fixture.receiptCommits.length, receipts: observed.receipts.length,
      beforeCaseVersion: committed.decision.version, afterCaseVersion: observed.decision.version,
      choicePreserved: digestSfValue(observed.decision.choices.find((choice) => choice.id === originalChoice.id)) === digestSfValue(materialChoice),
    }))
    expect(recovery.response.status).toBe(403)
    expect(recovery.body).toEqual({ status: "denied", reason: "case-access-unavailable" })
    expect(recovery.body.value).toBeUndefined()
    expect(JSON.stringify(recovery.body)).not.toContain(committed.receipts[0]!.id)
    expect(recoveryReads).toBe(1)
    const durable = await fixture.durable()
    const repeated = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request })
    expect(repeated.response.status).toBe(409)
    expect(repeated.body).toEqual({ status: "conflict", reason: "application-intent-mismatch" })
    expect(await fixture.durable()).toEqual(durable)
    expect(await observeC12(fixture)).toEqual(observed)
    expect(fixture.receiptCommits).toHaveLength(1)
  } finally { await fixture.dispose() }
}, 90_000)

