import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import { createC12Fixture, prepareC12Change, readReviewDigest } from "../c12-receipt-recovery/fixture.ts"
import { editC12Case, interleaveC12CaseEdit, observeC12 } from "../c12-receipt-recovery/consumer.ts"

// Bundle-only proof: uses the integrated Finance executor through real business services.
// The origin's older executor intentionally does not claim this fresh-reconciliation behavior.
test("C12 composed Apply reconciles an unrelated case edit with one original effect and receipt", async () => {
  const fixture = await createC12Fixture("c12-composed-fresh-reconciliation", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    const application = { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) }
    const before = await observeC12(fixture)
    interleaveC12CaseEdit(fixture)
    const first = await fixture.http("decision-apply", application, "alice", "c12-fresh-original-application")
    expect(first.response.status).toBe(200)
    const applied = await observeC12(fixture)
    expect(fixture.receiptCommits).toHaveLength(1)
    expect(applied.receipts).toHaveLength(1)
    const receipt = applied.receipts[0]!
    expect(receipt).toMatchObject({
      principalRef: "alice", surface: "procurement", version: 1,
      targetIncarnation: prepared.change.target.incarnation,
      idempotencyKey: prepared.change.idempotencyKey,
      commandDigest: prepared.change.operation.commandDigest,
    })
    expect(receipt.result.ok).toBe(true)
    expect(first.body).toEqual({ status: "ok", value: { receiptId: receipt.id, surface: "procurement", version: 1, outcome: "applied" } })
    expect(object(applied.domain.request.pr).estAmount).toBe(150)
    expect(applied.domain.version).toEqual({ version: 1, by: "alice" })
    expect(rows(applied.domain.request.history)).toHaveLength(1)
    expect(rows(applied.domain.request.history)[0]).toMatchObject({ action: "Saved", by: "alice" })
    expect(applied.decision.version).toBe(before.decision.version + 2)
    expect(applied.decision.objective).toBe("Concurrent authorized case edit")
    expect(applied.decision.choices).toEqual(before.decision.choices)
    expect(applied.decision.ledger).toEqual(before.decision.ledger)
    expect(applied.decision.participants).toEqual(before.decision.participants)
    expect(applied.decision.alternatives).toEqual(before.decision.alternatives)
    expect(applied.decision.criteria).toEqual(before.decision.criteria)
    expect(applied.decision.assumptions).toEqual(before.decision.assumptions)
    expect(applied.decision.questions).toEqual(before.decision.questions)
    expect(applied.decision.state).toBe("applied")
    expect(applied.decision.receipts).toEqual([receipt])
    expect(applied.decision.preparedChanges).toEqual([{ ...prepared.change, state: "applied", receipt }])
    const durable = await fixture.durable()
    const retry = await fixture.http("decision-apply", application, "alice", "c12-fresh-original-application")
    expect(retry.response.status).toBe(200)
    expect(retry.body).toEqual(first.body)
    expect(await observeC12(fixture)).toEqual(applied)
    expect(await fixture.durable()).toEqual(durable)
    const recovery = await fixture.http("decision-recover", {
      purpose: "recover", ...prepared.request,
      caseRef: { id: applied.decision.id, incarnation: applied.decision.incarnation, version: applied.decision.version },
    }, "alice", "c12-fresh-explicit-recovery")
    expect(recovery.response.status).toBe(200)
    expect(recovery.body).toEqual(first.body)
    expect(await observeC12(fixture)).toEqual(applied)
    expect(await fixture.durable()).toEqual(durable)
    expect(fixture.receiptCommits).toHaveLength(1)
    console.info("SF_C12_FRESH_RECONCILIATION", JSON.stringify({
      firstStatus: first.response.status, retryStatus: retry.response.status, recoveryStatus: recovery.response.status,
      originalCaseVersion: before.decision.version, reconciledCaseVersion: applied.decision.version,
      receiptId: receipt.id, domainVersion: receipt.version, effectCount: fixture.receiptCommits.length,
      choicePreserved: true, concurrentEditPreserved: true, replayDurableMutations: 0,
    }))
  } finally { await fixture.dispose() }
}, 90_000)

test("C12 composed first dispatch requires human review and the current case version", async () => {
  const fixture = await createC12Fixture("c12-composed-normal-apply-cas", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const before = await fixture.durable()
    // This is syntactically valid, not a producer-issued review proof. It cannot create review authority.
    const unreviewed = await fixture.http("decision-apply", { ...prepared.request, reviewDigest: "a".repeat(64) })
    expect(unreviewed.response.status).toBe(403)
    expect(unreviewed.body).toEqual({ status: "denied", reason: "prepared-review-required" })
    expect(await fixture.durable()).toEqual(before)
    expect(fixture.receiptCommits).toEqual([])
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    const application = { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) }
    const current = await observeC12(fixture)
    await editC12Case(fixture, "Authorized edit before the first dispatch")
    const edited = await observeC12(fixture)
    expect(edited.decision.version).toBe(current.decision.version + 1)
    expect(edited.decision.choices).toEqual(current.decision.choices)
    expect(edited.decision.ledger).toEqual(current.decision.ledger)
    const durable = await fixture.durable()
    const stale = await fixture.http("decision-apply", application)
    expect(stale.response.status).toBe(409)
    expect(stale.body).toEqual({ status: "stale", reason: "prepared-case-changed" })
    expect(await fixture.durable()).toEqual(durable)
    // A genuine review digest plus historical case version still cannot recover a receipt that never existed.
    const missing = await fixture.http("decision-recover", application)
    expect(missing.response.status).toBe(503)
    expect(missing.body).toEqual({ status: "unavailable", reason: "original-receipt-unavailable" })
    expect(await fixture.durable()).toEqual(durable)
    expect(await observeC12(fixture)).toEqual(edited)
    expect(edited.decision.objective).toBe("Authorized edit before the first dispatch")
    expect(edited.decision.receipts).toEqual([])
    expect(edited.receipts).toEqual([])
    expect(edited.decision.preparedChanges).toEqual([prepared.change])
    expect(object(edited.domain.request.pr).estAmount).toBe(100)
    expect(edited.domain.version).toEqual({ version: 0, by: "alice" })
    expect(rows(edited.domain.request.history)).toEqual([])
    expect(fixture.receiptCommits).toEqual([])
    console.info("SF_C12_FIRST_DISPATCH_FENCES", JSON.stringify({
      unreviewedStatus: unreviewed.response.status, staleApplyStatus: stale.response.status,
      missingRecoveryStatus: missing.response.status, effects: 0, receipts: 0,
      caseVersion: edited.decision.version, concurrentEditPreserved: true,
    }))
  } finally { await fixture.dispose() }
}, 90_000)

