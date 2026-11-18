import { expect, test } from "bun:test"
import { rm } from "node:fs/promises"
import { object, rows } from "../../../runtime/contract.ts"
import { createC12Fixture, prepareC12Change, readReviewDigest, changedReviewDigest } from "../../c12-receipt-recovery/fixture.ts"
import { observeC12 } from "../../c12-receipt-recovery/consumer.ts"

// An actual Procurement Requests.save and its original CommandReceipt commit in
// SQLite transactionAll. The fault is AFTER the durable domain commit and BEFORE
// the public HTTP handler returns or the case can reconcile. No receipt, result,
// grant or authorization is supplied by this test. The Request principals are
// deliberately synthetic *fixture* authorities, not installed corporate grants.
test("AM04 genuine domain-commit/return interruption recovers one receipt across SQLite reopen with human review and no second effect", async () => {
  let fixture = await createC12Fixture("am04-domain-return-loss", "https://local.invalid")
  const directory = fixture.directory
  let currentOpen = true
  try {
    const prepared = await prepareC12Change(fixture)
    expect(prepared.change.operation.command).toMatchObject({
      page: "Requests", action: "save", id: "PR-1", version: 0,
      values: { pr: { estAmount: 150 } },
    })
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    const reviewDigest = readReviewDigest(reviewed.body)
    const humanApply = { ...prepared.request, reviewDigest }
    let interrupted = 0
    fixture.afterReceiptCommit(async () => {
      interrupted++
      throw new Error("AM04_CONTROLLED_LOST_RETURN_AFTER_DURABLE_DOMAIN_COMMIT")
    })
    const first = await fixture.http("decision-apply", humanApply, "alice", "am04-human-apply-original")
    expect(interrupted).toBe(1)
    expect(first.response.status).toBe(503)
    expect(first.body).toEqual({ status: "unavailable", reason: "domain-application-unavailable" })
    const committed = await observeC12(fixture)
    expect(object(committed.domain.request.pr).estAmount).toBe(150)
    expect(committed.domain.version).toMatchObject({ version: 1, by: "alice" })
    expect(rows(committed.domain.request.history)).toHaveLength(1)
    expect(committed.receipts).toHaveLength(1)
    const receipt = committed.receipts[0]!
    expect(receipt).toMatchObject({
      surface: "procurement", principalRef: "alice", version: 1,
      idempotencyKey: prepared.change.idempotencyKey,
      commandDigest: prepared.change.operation.commandDigest,
      targetIncarnation: prepared.change.target.incarnation,
      result: { ok: true },
    })
    expect(committed.decision.preparedChanges[0]).toMatchObject({ state: "planned" })
    expect(committed.decision.receipts).toEqual([])
    expect(fixture.receiptCommits).toHaveLength(1)

    // A changed review proof with the SAME public command key must not be
    // accepted as a substitute for the original human authorization.
    // The canonical commandDigest is immutable in the stored PreparedChange;
    // direct digest-collision cases remain in C12's original recovery tests.
    const changed = await fixture.http("decision-apply",
      { ...prepared.request, reviewDigest: changedReviewDigest(reviewDigest) },
      "alice", "am04-human-apply-original")
    expect(changed.response.status).not.toBe(200)
    expect(changed.body.status).not.toBe("ok")
    expect(await observeC12(fixture)).toEqual(committed)
    expect(fixture.receiptCommits).toHaveLength(1)

    const retained = { directory, caseId: fixture.caseId }
    await fixture.dispose(false)
    currentOpen = false
    fixture = await createC12Fixture("am04-genuine-sqlite-reopen", "https://local.invalid", retained)
    currentOpen = true
    const reopened = await observeC12(fixture)
    expect(reopened).toEqual(committed)
    expect(fixture.receiptCommits).toHaveLength(0)
    const recoveryInput = { purpose: "recover", ...prepared.request }
    const originalRecovery = await fixture.http("decision-recover", recoveryInput, "alice", "am04-receipt-recovery")
    expect(originalRecovery.response.status).toBe(200)
    expect(object(originalRecovery.body.value)).toMatchObject({
      receiptId: receipt.id, surface: "procurement", version: 1, outcome: "applied",
    })
    const reconciled = await observeC12(fixture)
    expect(reconciled.receipts).toEqual(committed.receipts)
    expect(reconciled.domain).toEqual(committed.domain)
    expect(reconciled.decision.preparedChanges[0]).toMatchObject({ state: "applied", receipt: { id: receipt.id } })
    expect(reconciled.decision.receipts).toEqual(committed.receipts)
    expect(reconciled.decision.version).toBe(committed.decision.version + 1)
    expect(rows(reconciled.domain.request.history)).toHaveLength(1)

    const replay = await fixture.http("decision-recover", recoveryInput, "alice", "am04-receipt-recovery")
    expect(replay.response.status).toBe(200)
    expect(replay.body).toEqual(originalRecovery.body)
    expect(await observeC12(fixture)).toEqual(reconciled)
    expect(fixture.receiptCommits).toHaveLength(0)
    fixture.revoke("alice")
    const revoked = await fixture.http("decision-recover", recoveryInput, "alice", "am04-revoked-recovery")
    expect(revoked.response.status).not.toBe(200)
    expect(revoked.body.status).not.toBe("ok")
    fixture.restoreFixtureAccess("alice")
    expect(await observeC12(fixture)).toEqual(reconciled)
    console.info("SF_AM04_DOMAIN_RETURN_COMPONENT", JSON.stringify({
      publicAction: "decision-apply", humanReview: true,
      actualDomainCommand: "Procurement Requests.save",
      committedDomainVersion: 1, receiptId: receipt.id,
      responseInterruptedAfterAtomicCommit: true,
      firstHttpStatus: first.response.status, changedHumanProofStatus: changed.response.status,
      durableReopen: true, recoveryStatus: originalRecovery.response.status,
      sameRecoveryKeyResult: true, sourceHistoryEffects: rows(reconciled.domain.request.history).length,
      duplicateReceiptCommits: 0, revocationAfterRecoveryDenied: true,
      processRestarted: false, modelTurn: "NOT_RUN", installedIdentity: "NOT_RUN",
    }))
  } finally {
    if (currentOpen) await fixture.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 120_000)
