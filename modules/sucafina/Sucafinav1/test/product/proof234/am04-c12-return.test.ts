import { expect, test } from "bun:test"
import { rm } from "node:fs/promises"
import { createC12Fixture, prepareC12Change, readReviewDigest } from "../c12-receipt-recovery/fixture.ts"
import { observeC12 } from "../c12-receipt-recovery/consumer.ts"
import { object, rows } from "../../../runtime/contract.ts"

/**
 * Original Procurement Requests.save, C08 transactionAll and C12 HTTP actions.
 * The only injected fault is loss of the return after the REAL durable receipt.
 * alice/bob in the pre-existing fixture are NOT corporate installed identities.
 * This test cannot attest AM04's model turn, provider, or native principal.
 * Depends on closure230 SRC-01..03 and REG-01..03 being consumed by owner211.
 */
test("proof234 AM04 distinguishes denied unreviewed apply from a lost committed return and exactly-once recovery", async () => {
  let fixture = await createC12Fixture("proof234-am04-c12-original", "https://local.invalid")
  const directory = fixture.directory
  let open = true
  try {
    const prepared = await prepareC12Change(fixture)
    expect(prepared.change.operation.command).toMatchObject({
      page: "Requests", action: "save", id: "PR-1", version: 0,
      values: { pr: { estAmount: 150 } },
    })
    const withoutReview = await fixture.http("decision-apply", prepared.request, "alice", "proof234-no-review")
    expect(withoutReview.response.status).not.toBe(200)
    expect(rows((await observeC12(fixture)).domain.request.history)).toHaveLength(0)

    const reviewed = await fixture.http("decision-review",
      { purpose: "review", ...prepared.request }, "alice", "proof234-source-review")
    expect(reviewed.response.status).toBe(200)
    const reviewDigest = readReviewDigest(reviewed.body)
    fixture.afterReceiptCommit(async () => {
      throw new Error("PROOF234_LOST_RETURN_AFTER_ORIGINAL_C08_COMMIT")
    })
    const interrupted = await fixture.http("decision-apply",
      { ...prepared.request, reviewDigest }, "alice", "proof234-original-human-apply")
    expect(interrupted.response.status).toBe(503)
    expect(interrupted.body).toEqual({ status: "unavailable", reason: "domain-application-unavailable" })

    const committed = await observeC12(fixture)
    expect(object(committed.domain.request.pr).estAmount).toBe(150)
    expect(rows(committed.domain.request.history)).toHaveLength(1)
    expect(committed.receipts).toHaveLength(1)
    expect(committed.decision.receipts).toEqual([])
    expect(fixture.receiptCommits).toHaveLength(1)
    const original = committed.receipts[0]!
    expect(original).toMatchObject({
      principalRef: "alice", surface: "procurement",
      idempotencyKey: prepared.change.idempotencyKey,
      commandDigest: prepared.change.operation.commandDigest,
      targetIncarnation: prepared.change.target.incarnation,
      result: { ok: true },
    })

    const retained = { directory, caseId: fixture.caseId }
    await fixture.dispose(false)
    open = false
    fixture = await createC12Fixture("proof234-am04-durable-reopen", "https://local.invalid", retained)
    open = true
    expect(await observeC12(fixture)).toEqual(committed)
    const recovery = { purpose: "recover", ...prepared.request }
    const resumed = await fixture.http("decision-recover", recovery, "alice", "proof234-resume-1")
    expect(resumed.response.status).toBe(200)
    expect(object(resumed.body.value)).toMatchObject({ receiptId: original.id, outcome: "applied" })
    const reconciled = await observeC12(fixture)
    expect(reconciled.receipts).toEqual(committed.receipts)
    expect(reconciled.domain).toEqual(committed.domain)
    expect(reconciled.decision.receipts).toEqual(committed.receipts)
    expect(rows(reconciled.domain.request.history)).toHaveLength(1)
    expect(fixture.receiptCommits).toHaveLength(0)

    const retry = await fixture.http("decision-recover", recovery, "alice", "proof234-resume-1")
    expect(retry.body).toEqual(resumed.body)
    expect(await observeC12(fixture)).toEqual(reconciled)
    fixture.revoke("alice")
    const revoked = await fixture.http("decision-recover", recovery, "alice", "proof234-revoked")
    expect(revoked.response.status).not.toBe(200)
    expect(await observeC12(fixture)).toEqual(reconciled)
    console.info("SF_PROOF234_AM04_COMPONENT", JSON.stringify({
      originalReceiptId: original.id, c12DraftCommand: "Procurement Requests.save",
      sqliteReopen: true, domainEffects: 1, duplicateEffect: false,
      processRestart: "NOT_RUN", nativeModel: "NOT_RUN", installedPrincipal: "NOT_RUN",
    }))
  } finally {
    if (open) await fixture.dispose(false)
    await rm(directory, { recursive: true, force: true })
  }
}, 120_000)
