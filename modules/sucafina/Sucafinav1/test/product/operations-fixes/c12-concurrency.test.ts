import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { object, rows } from "../../../runtime/contract.ts"
import { launchBrowserDriver } from "../wp02/browser-driver-fixture.ts"
import { createC12Consumer, interleaveC12CaseEdit, observeC12 } from "./c12-consumer.ts"
import { changedReviewDigest, createC12Fixture, prepareC12Change, readReviewDigest } from "./c12-fixture.ts"

// Counterexample, not an acceptance test: a green run proves the pinned consumer
// remains blocked after the real H05 commit. It must not be counted as recovery PASS.
test("I-OPS-02 reproduces H05 through real UI retry reload and reopened SQLite services", async () => {
  expectSpawn(import.meta.path)
  const consumer = await createC12Consumer()
  const driver = await launchBrowserDriver("host-response-recovery").catch(async (error) => { await consumer.close(); throw error })
  try {
    const page = await driver.browser.newPage({ extraHTTPHeaders: { Authorization: "Bearer alice" } })
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    expect((await page.goto(consumer.url))?.status()).toBe(200)
    const article = page.locator("[data-decision-apply]")
    expect(await article.count()).toBe(1)
    const review = article.getByRole("button", { name: "Review current changes", exact: true })
    const confirm = article.getByRole("checkbox", { name: "I reviewed these changes and want to apply them", exact: true })
    const apply = article.getByRole("button", { name: "Apply reviewed change", exact: true })
    expect(await confirm.isEnabled()).toBe(false)
    expect(await apply.isEnabled()).toBe(false)
    const reviewed = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-review")
    await review.click()
    expect((await reviewed).status()).toBe(200)
    const proof = readReviewDigest(consumer.traffic[0]!.result)
    await confirm.check()
    interleaveC12CaseEdit(consumer.current())
    const firstResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-apply")
    await apply.click()
    expect((await firstResponse).status()).toBe(409)
    await article.getByText("The application returned a conflict", { exact: false }).waitFor()
    const first = consumer.traffic.filter((item) => item.mode === "decision-apply")[0]!
    expect(first.result).toEqual({ status: "stale", reason: "case-changed-after-application" })
    expect(JSON.parse(first.body)).toEqual({ ...consumer.prepared.request, reviewDigest: proof })
    expect(first.key).toBeTruthy()
    expect(await review.isEnabled()).toBe(false)
    expect(await confirm.isEnabled()).toBe(false)
    const afterCommit = await observeC12(consumer.current())
    expect(object(afterCommit.domain.request.pr).estAmount).toBe(150)
    expect(afterCommit.domain.request.history).toHaveLength(1)
    expect(afterCommit.decision.objective).toBe("Concurrent authorized case edit")
    expect(afterCommit.decision.preparedChanges[0]?.state).toBe("planned")
    expect(afterCommit.decision.receipts).toEqual([])
    expect(afterCommit.receipts).toHaveLength(1)
    expect(afterCommit.receipts[0]).toMatchObject({ principalRef: "alice", surface: "procurement", version: 1 })
    expect(afterCommit.receipts[0]).toMatchObject({ targetIncarnation: afterCommit.decision.preparedChanges[0]!.target.incarnation, commandDigest: afterCommit.decision.preparedChanges[0]!.operation.commandDigest, idempotencyKey: afterCommit.decision.preparedChanges[0]!.idempotencyKey })
    expect(consumer.current().receiptCommits).toHaveLength(1)

    const retry = article.getByRole("button", { name: "Retry same application", exact: true })
    expect(await retry.isEnabled()).toBe(true)
    const retried = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-apply")
    await retry.click()
    expect((await retried).status()).toBe(409)
    const attempts = consumer.traffic.filter((item) => item.mode === "decision-apply")
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toMatchObject({ body: first.body, key: first.key, result: { status: "stale", reason: "prepared-case-changed" } })
    expect(await observeC12(consumer.current())).toEqual(afterCommit)

    // Reload constructs the real renderer again, with the current authorized case.
    expect((await page.reload())?.status()).toBe(200)
    expect(await retry.count()).toBe(0)
    expect(await apply.isEnabled()).toBe(false)
    expect(await review.isEnabled()).toBe(true)
    expect(await page.evaluate(() => history.state)).toBeNull()
    expect(consumer.traffic.filter((item) => item.mode === "decision-apply")).toHaveLength(2)
    const reviewedAgain = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-review")
    await review.click()
    expect((await reviewedAgain).status()).toBe(409)
    await article.getByText("Current change unavailable or stale.", { exact: false }).waitFor()
    expect(await confirm.isEnabled()).toBe(false)
    expect(await apply.isEnabled()).toBe(false)

    // Close the SQLite driver and reconstruct authority, sources and business services.
    // The Bun process remains alive: this proves runtime/store reopen, not process restart.
    await consumer.reopen()
    expect((await page.reload())?.status()).toBe(200)
    expect(await retry.count()).toBe(0)
    expect(await apply.isEnabled()).toBe(false)
    expect(await observeC12(consumer.current())).toEqual(afterCommit)
    const exact = await consumer.current().http("decision-apply", JSON.parse(first.body), "alice", first.key!)
    expect(exact.response.status).toBe(409)
    expect(exact.body).toEqual({ status: "stale", reason: "prepared-case-changed" })
    expect(await observeC12(consumer.current())).toEqual(afterCommit)
    expect(consumer.current().receiptCommits).toHaveLength(0)
    expect(errors).toEqual([])
    console.info("SF_OPERATIONS_C12_REPRODUCTION", JSON.stringify({ finding: "I-OPS-02", classification: "reproduced-consumer-impasse", firstStatus: first.status, retryStatus: attempts[1]!.status, reopenExactStatus: exact.response.status, sameBody: attempts[1]!.body === first.body, sameKey: attempts[1]!.key === first.key, originalCaseVersion: consumer.prepared.request.caseRef.version, concurrentCaseVersion: afterCommit.decision.version, receiptId: afterCommit.receipts[0]!.id, financialEffects: rows(afterCommit.domain.request.history).length, durableReceipts: afterCommit.receipts.length, caseReceiptCount: afterCommit.decision.receipts.length, runtimeReconstructed: true, sqliteReopened: true, processRestarted: false, recoveryAccepted: false }))
  } finally { try { await driver.close() } finally { await consumer.close() } }
  driver.report()
}, 60_000)

test("I-OPS-02 current-version API control preserves receipt binding and rejects altered proof revocation and replacement", async () => {
  const fixture = await createC12Fixture("I-OPS-02-receipt-fences", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    const application = { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) }
    interleaveC12CaseEdit(fixture)
    expect((await fixture.http("decision-apply", application, "alice", "c12-original")).response.status).toBe(409)
    const committed = await observeC12(fixture)
    expect(committed.receipts).toHaveLength(1)
    const current = { ...application, caseRef: { ...application.caseRef, version: committed.decision.version } }
    const altered = await fixture.http("decision-apply", { ...current, reviewDigest: changedReviewDigest(current.reviewDigest) }, "alice", "c12-current-control")
    expect(altered.response.status).toBe(409)
    expect(altered.body).toEqual({ status: "conflict", reason: "review-proof-mismatch" })
    expect(await observeC12(fixture)).toEqual(committed)
    // This producer control is deliberately not called by the UI. It shows why
    // the proposed receipt-only endpoint must distinguish recovery from application.
    const reconciled = await fixture.http("decision-apply", current, "alice", "c12-current-control")
    expect(reconciled.response.status).toBe(200)
    expect(object(reconciled.body.value).receiptId).toBe(committed.receipts[0]!.id)
    const recovered = await observeC12(fixture)
    expect(recovered.domain).toEqual(committed.domain)
    expect(recovered.receipts).toEqual(committed.receipts)
    expect(recovered.decision.objective).toBe(committed.decision.objective)
    expect(recovered.decision.receipts).toHaveLength(1)
    expect(recovered.decision.preparedChanges[0]?.state).toBe("applied")
    expect(fixture.receiptCommits).toHaveLength(1)

    fixture.revoke("alice")
    const revoked = await fixture.http("decision-apply", current, "alice", "c12-current-control")
    expect(revoked.response.status).toBe(403)
    expect(revoked.body.status).toBe("denied")
    expect(await fixture.material()).toEqual(recovered.domain)
    expect(fixture.receiptCommits).toHaveLength(1)
    // Administrative fixture input restores authentication; it is not a self-grant API.
    fixture.restoreFixtureAccess("alice")
    const reauthorized = await fixture.http("decision-apply", current, "alice", "c12-current-control")
    expect(reauthorized.response.status).toBe(200)
    expect(reauthorized.body).toEqual(reconciled.body)
    expect(await observeC12(fixture)).toEqual(recovered)

    await fixture.persistence.transaction("procurement", async (snapshot) => {
      delete object(object(snapshot.data.store).requests)["PR-1"]
      return { commit: true, value: undefined }
    })
    await fixture.persistence.transaction("procurement", async (snapshot) => {
      object(object(snapshot.data.store).requests)["PR-1"] = { request: recovered.domain.request, version: 1, by: "alice" }
      return { commit: true, value: undefined }
    })
    const beforeRejected = await observeC12(fixture)
    const replaced = await fixture.http("decision-apply", current, "alice", "c12-current-control")
    expect(replaced.response.status).toBe(403)
    expect(replaced.body.status).toBe("denied")
    expect(await observeC12(fixture)).toEqual(beforeRejected)
    expect(fixture.receiptCommits).toHaveLength(1)
    console.info("SF_OPERATIONS_C12_PRODUCER_CONTROL", JSON.stringify({ alteredDigestStatus: altered.response.status, currentVersionControlStatus: reconciled.response.status, receiptId: committed.receipts[0]!.id, replacedTargetStatus: replaced.response.status, revokedStatus: revoked.response.status, uiRecoveryProven: false, explicitRecoveryEndpointProven: false }))
  } finally { await fixture.dispose() }
}, 60_000)
