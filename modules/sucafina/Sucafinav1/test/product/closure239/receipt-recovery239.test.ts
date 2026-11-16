import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import { createC12Fixture, prepareC12Change, readReviewDigest, changedReviewDigest } from "../c12-receipt-recovery/fixture.ts"
import { interruptC12AfterCommit, observeC12 } from "../c12-receipt-recovery/consumer.ts"

// Uses the real C08 SQLite producer/receipt and HTTP handlers with synthetic actors;
// no invented enterprise authorization or claimed locally executed run.
test("C12 original receipt is unique across lost response, stale Apply, digest collision and repeated recovery", async () => {
  const fixture = await createC12Fixture("closure239-c12-lost-response", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    const application = { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) }
    const before = await observeC12(fixture)
    expect(object(before.domain.request.pr).estAmount).toBe(100)
    expect(before.receipts).toHaveLength(0)

    const absent = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request })
    expect(absent.response.status).toBe(503)
    expect(absent.body.value).toBeUndefined()
    expect(await observeC12(fixture)).toEqual(before)
    expect(fixture.receiptCommits).toHaveLength(0)

    interruptC12AfterCommit(fixture)
    const interrupted = await fixture.http("decision-apply", application, "alice", "closure239-same-attempt")
    expect(interrupted.response.status).toBe(503)
    expect(interrupted.body).toEqual({ status: "unavailable", reason: "domain-application-unavailable" })
    const committed = await observeC12(fixture)
    expect(object(committed.domain.request.pr).estAmount).toBe(150)
    expect(rows(committed.domain.request.history)).toHaveLength(1)
    expect(rows(committed.domain.request.history)[0]).toMatchObject({ action: "Saved", by: "alice" })
    expect(committed.receipts).toHaveLength(1)
    expect(committed.receipts[0]).toMatchObject({
      principalRef: "alice", surface: "procurement", idempotencyKey: prepared.change.idempotencyKey,
      commandDigest: prepared.change.operation.commandDigest,
    })
    expect(fixture.receiptCommits).toHaveLength(1)

    const retry = await fixture.http("decision-apply", application, "alice", "closure239-same-attempt")
    expect(retry.response.status).toBe(409)
    expect(retry.body.value).toBeUndefined()
    expect(await observeC12(fixture)).toEqual(committed)
    expect(fixture.receiptCommits).toHaveLength(1)

    const collision = await fixture.http("decision-recover", {
      ...application, reviewDigest: changedReviewDigest(application.reviewDigest),
    })
    expect(collision.response.status).toBe(409)
    expect(collision.body.value).toBeUndefined()
    expect(await observeC12(fixture)).toEqual(committed)

    const recovered = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request })
    expect(recovered.response.status).toBe(200)
    expect(object(recovered.body.value).receiptId).toBe(committed.receipts[0]!.id)
    const once = await observeC12(fixture)
    const repeated = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request })
    expect(repeated.response.status).toBe(200)
    expect(repeated.body).toEqual(recovered.body)
    expect(await observeC12(fixture)).toEqual(once)
    expect(once.domain).toEqual(committed.domain)
    expect(once.receipts).toEqual(committed.receipts)
    expect(fixture.receiptCommits).toHaveLength(1)
  } finally {
    await fixture.dispose()
  }
}, 90_000)
