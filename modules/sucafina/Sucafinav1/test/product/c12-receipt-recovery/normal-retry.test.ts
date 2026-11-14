import { expect, test } from "bun:test"
import { object } from "../../../runtime/contract.ts"
import { createC12Fixture, prepareC12Change, readReviewDigest } from "./fixture.ts"
import { editC12Case, interruptC12AfterCommit, observeC12 } from "./consumer.ts"

// This control intentionally keeps the ordinary Apply CAS rejection separate
// from recovery-ui.test.ts, which proves receipt-only recovery succeeds.
test("C12 normal Apply rejects the historical case version after an interrupted domain response", async () => {
  const fixture = await createC12Fixture("c12-normal-apply-cas", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    const application = { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) }
    interruptC12AfterCommit(fixture)
    const first = await fixture.http("decision-apply", application, "alice", "unchanged-apply-intention")
    expect(first.response.status).toBe(503)
    expect(first.body).toEqual({ status: "unavailable", reason: "domain-application-unavailable" })
    const committed = await observeC12(fixture)
    expect(committed.receipts).toHaveLength(1)
    expect(object(committed.domain.request.pr).estAmount).toBe(150)
    expect(committed.decision.receipts).toEqual([])
    const retried = await fixture.http("decision-apply", application, "alice", "unchanged-apply-intention")
    expect(retried.response.status).toBe(409)
    expect(retried.body).toEqual({ status: "stale", reason: "prepared-case-changed" })
    expect(await observeC12(fixture)).toEqual(committed)
    expect(fixture.receiptCommits).toHaveLength(1)
  } finally { await fixture.dispose() }
}, 60_000)

test("C12 receipt recovery refuses a second case edit during reconciliation and preserves both commits", async () => {
  const fixture = await createC12Fixture("c12-recovery-cas-race", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    interruptC12AfterCommit(fixture)
    expect((await fixture.http("decision-apply", { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) })).response.status).toBe(503)
    const committed = await observeC12(fixture)
    // Host preflight, executor lookup and classification precede the fresh case read.
    // The fourth receipt read confirms that capture; edit only after its lock releases.
    fixture.afterReceiptRead(() => editC12Case(fixture, "Second authorized edit during recovery"), 4)
    const rejected = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request })
    expect(fixture.receiptReads.interleavings).toBe(1)
    expect(rejected.response.status).toBe(503)
    expect(rejected.body).toEqual({ status: "unavailable", reason: "case-reconciliation-pending" })
    const concurrent = await observeC12(fixture)
    expect(concurrent.decision.objective).toBe("Second authorized edit during recovery")
    expect(concurrent.decision.version).toBe(committed.decision.version + 1)
    expect(concurrent.decision.receipts).toEqual([])
    expect(concurrent.domain).toEqual(committed.domain)
    expect(concurrent.receipts).toEqual(committed.receipts)
    const recovered = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request })
    expect(recovered.response.status).toBe(200)
    expect(object(recovered.body.value).receiptId).toBe(committed.receipts[0]!.id)
    const after = await observeC12(fixture)
    expect(after.decision.objective).toBe(concurrent.decision.objective)
    expect(after.domain).toEqual(committed.domain)
    expect(after.receipts).toEqual(committed.receipts)
    expect(fixture.receiptCommits).toHaveLength(1)
    console.info("SF_C12_RECOVERY_CONCURRENT_EDIT", JSON.stringify({ refusedStatus: rejected.response.status, recoveredStatus: recovered.response.status, editsPreserved: true, originalReceipt: committed.receipts[0]!.id, duplicateEffects: 0 }))
  } finally { await fixture.dispose() }
}, 90_000)

