import { expect, test } from "bun:test"
import type { Response as BrowserResponse } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { object, rows } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { receiptProofTransactionKey, receiptReviewBinding } from "../../../product/decisions/receipt-review-binding.ts"
import type { CommandReceipt } from "../../../product/contracts/context.ts"
import type { PreparedChange } from "../../../product/contracts/decisions.ts"
import { launchBrowserDriver } from "../wp02/browser-driver-fixture.ts"
import { mountC12NativeConsumer } from "../c12-receipt-recovery/native-consumer.ts"
import { interleaveC12CaseEdit, observeC12 } from "./c12-consumer.ts"
import { changedReviewDigest, createC12Fixture, prepareC12Change, readReviewDigest } from "./c12-fixture.ts"

type Fixture = Awaited<ReturnType<typeof createC12Fixture>>

async function receiptEvidence(fixture: Fixture, change: PreparedChange, receipt: CommandReceipt) {
  const observed = await fixture.authority.state.read(fixture.request(), "receipts", (state) => structuredClone({
    receipt: state.receipts[receipt.id],
    proof: state.transactions[receiptProofTransactionKey("alice", change.target.id, change.idempotencyKey)],
  }))
  if (observed.status !== "ok" || !observed.value.proof || !observed.value.receipt)
    throw new Error("Original receipt and its durable review binding are unavailable")
  return { storageVersion: observed.storageVersion, incarnation: observed.incarnation,
    receipt: observed.value.receipt, proof: observed.value.proof }
}

function isCaseProjection(response: BrowserResponse) {
  return response.request().method() === "GET" &&
    new URL(response.url()).pathname === "/sf/api/ui/projections/case"
}

async function expectProjectedReceipt(response: BrowserResponse, caseId: string, receiptId: string) {
  expect(response.status()).toBe(200)
  const body = object(await response.json())
  expect(body.status).toBe("ok")
  const decision = object(object(object(body.value).projection).case)
  expect(decision.id).toBe(caseId)
  expect(rows(decision.receipts).map((receipt) => receipt.id)).toEqual([receiptId])
}

// d81dc320a82044009dd4c39f2e5d062ad46719a9 preserves fresh reconciliation.
// 99a688c0ab76baf0832b23745dd2aeb826f0aa87 reserves 409 for material choice replacement.
// The historical impasse oracle is replaced with exact receipt-first preservation,
// while the post-COMMIT interruption and material-conflict controls remain below.
test("I-OPS-02 preserves unrelated concurrent edits through receipt-first UI retry reload and reopened SQLite services", async () => {
  expectSpawn(import.meta.path)
  const consumer = await mountC12NativeConsumer(createC12Fixture, prepareC12Change)
  const driver = await launchBrowserDriver("host-response-recovery").catch(async (error) => { await consumer.close(); throw error })
  try {
    const page = await driver.browser.newPage({ extraHTTPHeaders: { Authorization: "Bearer alice" } })
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    expect((await page.goto(consumer.url))?.status()).toBe(200)
    const review = page.getByRole("button", { name: "Read producer review", exact: true })
    const apply = page.getByRole("button", { name: "Apply reviewed change", exact: true })
    await review.and(page.locator(":enabled")).waitFor()
    expect(await page.locator(".sf-u18-change-list > li").count()).toBe(1)
    expect(await apply.count()).toBe(0)
    expect(consumer.traffic.filter((item) => item.mode === "decision-apply")).toEqual([])
    const reviewed = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-review")
    await review.click()
    expect((await reviewed).status()).toBe(200)
    await apply.and(page.locator(":enabled")).waitFor()
    const proof = readReviewDigest(consumer.traffic.find((item) => item.mode === "decision-review")!.result)
    expect(await page.locator('[data-component="sf-change-review"]').getByText(proof, { exact: true }).isVisible()).toBe(true)
    expect(consumer.traffic.filter((item) => item.mode === "decision-apply")).toEqual([])
    const before = await observeC12(consumer.current())
    const change = before.decision.preparedChanges[0]!
    interleaveC12CaseEdit(consumer.current())

    // The original producer returns its real committed receipt. Lose only that
    // completed HTTP reply so the actual native UI offers its exact-intent retry.
    const lost = Promise.withResolvers<number>()
    await page.route(/\/sf\/procurement\?sf=decision-apply$/, async (route) => {
      try {
        const response = await route.fetch({ maxRetries: 0 })
        lost.resolve(response.status())
        await response.dispose()
        await route.abort("failed")
      } catch (error) { lost.reject(error); throw error }
    }, { times: 1 })
    const failed = page.waitForEvent("requestfailed", { predicate: (request) => new URL(request.url()).searchParams.get("sf") === "decision-apply" })
    await apply.click()
    await failed
    expect(await lost.promise).toBe(200)
    const retry = page.getByRole("button", { name: "Retry same application", exact: true })
    await retry.and(page.locator(":enabled")).waitFor()
    const first = consumer.traffic.filter((item) => item.mode === "decision-apply")[0]!
    expect(JSON.parse(first.body)).toEqual({ ...consumer.prepared.request, reviewDigest: proof })
    expect(first.key).toBeTruthy()
    const afterCommit = await observeC12(consumer.current())
    expect(object(afterCommit.domain.request.pr).estAmount).toBe(150)
    expect(afterCommit.domain.version).toMatchObject({ version: 1, by: "alice" })
    expect(afterCommit.domain.request.history).toHaveLength(1)
    expect(afterCommit.decision.objective).toBe("Concurrent authorized case edit")
    expect(afterCommit.decision.version).toBe(before.decision.version + 2)
    expect(afterCommit.decision.choices).toEqual(before.decision.choices)
    expect(afterCommit.decision.preparedChanges[0]?.state).toBe("applied")
    expect(afterCommit.receipts).toHaveLength(1)
    const receipt = afterCommit.receipts[0]!
    expect(receipt).toMatchObject({ principalRef: "alice", surface: "procurement", version: 1,
      targetIncarnation: change.target.incarnation, commandDigest: change.operation.commandDigest, idempotencyKey: change.idempotencyKey })
    expect(afterCommit.decision.receipts).toEqual(afterCommit.receipts)
    expect(afterCommit.decision.preparedChanges[0]?.receipt).toEqual(receipt)
    expect(first.status).toBe(200)
    expect(first.result).toEqual({ status: "ok", value: { receiptId: receipt.id, surface: "procurement", version: 1, outcome: "applied" } })
    const bound = await receiptEvidence(consumer.current(), change, receipt)
    expect(bound.receipt).toEqual(receipt)
    expect(bound.proof.value).toEqual(receipt)
    expect(bound.proof.commandDigest).toBe(receiptReviewBinding(change, proof))
    expect(consumer.current().receiptCommits).toHaveLength(1)
    expect(await apply.and(page.locator(":enabled")).count()).toBe(0)
    expect(await review.and(page.locator(":enabled")).count()).toBe(0)

    const retried = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-apply")
    await retry.click()
    const replay = await retried
    expect(replay.status()).toBe(200)
    expect(await replay.json()).toEqual(first.result)
    await retry.waitFor({ state: "hidden" })
    const attempts = consumer.traffic.filter((item) => item.mode === "decision-apply")
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toEqual({ ...first, status: 200 })
    expect(await observeC12(consumer.current())).toEqual(afterCommit)
    expect(await receiptEvidence(consumer.current(), change, receipt)).toEqual(bound)
    expect(consumer.current().receiptCommits).toHaveLength(1)

    const reloaded = page.waitForResponse(isCaseProjection)
    expect((await page.reload())?.status()).toBe(200)
    await expectProjectedReceipt(await reloaded, afterCommit.decision.id, receipt.id)
    const applied = page.getByRole("button", { name: change.target.id + " · applied · v" + change.expectedVersion, exact: true })
    await applied.waitFor()
    expect(await retry.count()).toBe(0)
    expect(await apply.count()).toBe(0)
    expect(await review.isEnabled()).toBe(false)
    // The native router owns its navigation metadata; it must not retain an
    // application intention or proof in history when the document is rebuilt.
    const historyState = JSON.stringify(await page.evaluate(() => history.state))
    expect(historyState).not.toContain(first.key!)
    expect(historyState).not.toContain(proof)
    expect(consumer.traffic.filter((item) => item.mode === "decision-apply")).toHaveLength(2)
    expect(consumer.traffic.filter((item) => item.mode === "decision-review")).toHaveLength(1)
    expect(await observeC12(consumer.current())).toEqual(afterCommit)

    // Reconstruct the original authority, sources and business services on the
    // retained SQLite store. This remains a reopen, not a process restart.
    await consumer.reopen()
    const reopened = page.waitForResponse(isCaseProjection)
    expect((await page.reload())?.status()).toBe(200)
    await expectProjectedReceipt(await reopened, afterCommit.decision.id, receipt.id)
    await applied.waitFor()
    expect(await retry.count()).toBe(0)
    expect(await apply.count()).toBe(0)
    expect(await review.isEnabled()).toBe(false)
    expect(await observeC12(consumer.current())).toEqual(afterCommit)
    const exact = await consumer.current().http("decision-apply", JSON.parse(first.body), "alice", first.key!)
    expect(exact.response.status).toBe(200)
    expect(exact.body).toEqual(first.result)
    expect(await observeC12(consumer.current())).toEqual(afterCommit)
    expect(await receiptEvidence(consumer.current(), change, receipt)).toEqual(bound)
    expect(consumer.current().receiptCommits).toHaveLength(0)
    expect(errors).toEqual([])
    console.info("SF_OPERATIONS_C12_RECONCILIATION", JSON.stringify({
      finding: "I-OPS-02", classification: "unrelated-edit-reconciled", firstStatus: first.status,
      retryStatus: attempts[1]!.status, reopenExactStatus: exact.response.status,
      sameBody: attempts[1]!.body === first.body, sameKey: attempts[1]!.key === first.key,
      originalCaseVersion: consumer.prepared.request.caseRef.version, reconciledCaseVersion: afterCommit.decision.version,
      receiptId: receipt.id, financialEffects: rows(afterCommit.domain.request.history).length,
      durableReceipts: afterCommit.receipts.length, caseReceiptCount: afterCommit.decision.receipts.length,
      runtimeReconstructed: true, sqliteReopened: true, processRestarted: false,
    }))
  } finally { try { await driver.close() } finally { await consumer.close() } }
  driver.report()
}, 60_000)

test("I-OPS-02 exact-intent API replay preserves receipt binding and rejects altered proof version revocation and replacement", async () => {
  const fixture = await createC12Fixture("I-OPS-02-receipt-fences", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    const application = { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) }
    const before = await observeC12(fixture)
    const change = before.decision.preparedChanges[0]!
    interleaveC12CaseEdit(fixture)
    const first = await fixture.http("decision-apply", application, "alice", "c12-original")
    expect(first.response.status).toBe(200)
    const committed = await observeC12(fixture)
    expect(committed.receipts).toHaveLength(1)
    const receipt = committed.receipts[0]!
    expect(first.body).toEqual({ status: "ok", value: { receiptId: receipt.id, surface: "procurement", version: 1, outcome: "applied" } })
    expect(committed.decision.objective).toBe("Concurrent authorized case edit")
    expect(committed.decision.version).toBe(before.decision.version + 2)
    expect(committed.decision.choices).toEqual(before.decision.choices)
    expect(committed.decision.receipts).toEqual(committed.receipts)
    expect(committed.decision.preparedChanges[0]?.receipt).toEqual(receipt)
    expect(committed.decision.preparedChanges[0]?.state).toBe("applied")
    expect(object(committed.domain.request.pr).estAmount).toBe(150)
    expect(rows(committed.domain.request.history)).toHaveLength(1)
    expect(fixture.receiptCommits).toHaveLength(1)
    const bound = await receiptEvidence(fixture, change, receipt)
    expect(bound.receipt).toEqual(receipt)
    expect(bound.proof.value).toEqual(receipt)
    expect(bound.proof.commandDigest).toBe(receiptReviewBinding(change, application.reviewDigest))

    // Each probe changes one field of the retained original intention. The
    // host rejects it before receipt replay; a new HTTP key cannot rebind it.
    const altered = await fixture.http("decision-apply", { ...application, reviewDigest: changedReviewDigest(application.reviewDigest) }, "alice", "c12-current-control")
    expect(altered.response.status).toBe(409)
    expect(altered.body).toEqual({ status: "conflict", reason: "application-intent-mismatch" })
    expect(await observeC12(fixture)).toEqual(committed)
    expect(await receiptEvidence(fixture, change, receipt)).toEqual(bound)
    const current = { ...application, caseRef: { ...application.caseRef, version: committed.decision.version } }
    const changedVersion = await fixture.http("decision-apply", current, "alice", "c12-current-control")
    expect(changedVersion.response.status).toBe(409)
    expect(changedVersion.body).toEqual({ status: "conflict", reason: "application-intent-mismatch" })
    expect(await observeC12(fixture)).toEqual(committed)
    expect(await receiptEvidence(fixture, change, receipt)).toEqual(bound)

    const replay = await fixture.http("decision-apply", application, "alice", "c12-original")
    expect(replay.response.status).toBe(200)
    expect(replay.body).toEqual(first.body)
    expect(await observeC12(fixture)).toEqual(committed)
    // A current case selector belongs to the named receipt-only recovery. The
    // producer recovers the persisted original admission instead of replacing it.
    const recovery = await fixture.http("decision-recover", { purpose: "recover", caseRef: current.caseRef,
      choiceId: application.choiceId, changeId: application.changeId }, "alice", "c12-current-recovery")
    expect(recovery.response.status).toBe(200)
    expect(recovery.body).toEqual(first.body)
    expect(await observeC12(fixture)).toEqual(committed)
    expect(await receiptEvidence(fixture, change, receipt)).toEqual(bound)
    expect(fixture.receiptCommits).toHaveLength(1)

    fixture.revoke("alice")
    const revoked = await fixture.http("decision-apply", application, "alice", "c12-original")
    expect(revoked.response.status).toBe(403)
    expect(revoked.body.status).toBe("denied")
    expect(await fixture.material()).toEqual(committed.domain)
    expect(fixture.receiptCommits).toHaveLength(1)
    // Administrative fixture input restores authentication; it is not a self-grant API.
    fixture.restoreFixtureAccess("alice")
    const reauthorized = await fixture.http("decision-apply", application, "alice", "c12-original")
    expect(reauthorized.response.status).toBe(200)
    expect(reauthorized.body).toEqual(first.body)
    expect(await observeC12(fixture)).toEqual(committed)
    expect(await receiptEvidence(fixture, change, receipt)).toEqual(bound)

    await fixture.persistence.transaction("procurement", async (snapshot) => {
      delete object(object(snapshot.data.store).requests)["PR-1"]
      return { commit: true, value: undefined }
    })
    await fixture.persistence.transaction("procurement", async (snapshot) => {
      object(object(snapshot.data.store).requests)["PR-1"] = { request: committed.domain.request, version: 1, by: "alice" }
      return { commit: true, value: undefined }
    })
    const beforeRejected = await observeC12(fixture)
    const replaced = await fixture.http("decision-apply", application, "alice", "c12-original")
    expect(replaced.response.status).toBe(403)
    expect(replaced.body.status).toBe("denied")
    expect(await observeC12(fixture)).toEqual(beforeRejected)
    expect(await receiptEvidence(fixture, change, receipt)).toEqual(bound)
    expect(fixture.receiptCommits).toHaveLength(1)
    console.info("SF_OPERATIONS_C12_PRODUCER_CONTROL", JSON.stringify({
      alteredDigestStatus: altered.response.status, changedVersionStatus: changedVersion.response.status,
      exactReplayStatus: replay.response.status, recoveryStatus: recovery.response.status,
      receiptId: receipt.id, replacedTargetStatus: replaced.response.status, revokedStatus: revoked.response.status,
      uiRecoveryProven: false, explicitRecoveryEndpointProven: true,
    }))
  } finally { await fixture.dispose() }
}, 60_000)

test("I-OPS-02 postcommit controls preserve uncertainty and reject replacement of the original choice", async () => {
  for (const mode of ["interrupted", "choice-replaced"] as const) {
    const fixture = await createC12Fixture("I-OPS-02-" + mode, "https://local.invalid")
    try {
      const prepared = await prepareC12Change(fixture)
      const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
      expect(reviewed.response.status).toBe(200)
      const application = { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) }
      const before = await observeC12(fixture)
      const change = before.decision.preparedChanges[0]!
      if (mode === "interrupted") {
        interleaveC12CaseEdit(fixture, () => {
          throw new Error("I-OPS-02 interrupted the return after the durable receipt and concurrent case edit")
        })
      } else {
        fixture.afterReceiptCommit(async () => {
          const current = await fixture.storedCase()
          const changed = { ...current.value, version: current.value.version + 1,
            objective: "Concurrent authorized case edit", choices: current.value.choices.map((choice) =>
              choice.id === prepared.request.choiceId ? { ...choice, reason: "Concurrent authorized choice revision" } : choice) }
          const saved = await fixture.authority.state.transaction(fixture.request(), {
            namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: changed.id,
            targetIncarnation: changed.incarnation, idempotencyKey: randomUUID(), commandDigest: digestSfValue(changed),
          }, async (state) => { state.cases[changed.id] = changed; return { commit: true, value: true } })
          if (saved.status !== "ok") throw new Error("Concurrent real choice edit failed")
        })
      }
      const first = await fixture.http("decision-apply", application, "alice", "c12-postcommit-control")
      expect(first.response.status).toBe(mode === "interrupted" ? 503 : 409)
      expect(first.body).toEqual(mode === "interrupted"
        ? { status: "unavailable", reason: "domain-application-unavailable" }
        : { status: "stale", reason: "prepared-choice-changed" })
      const committed = await observeC12(fixture)
      expect(object(committed.domain.request.pr).estAmount).toBe(150)
      expect(committed.domain.version).toMatchObject({ version: 1, by: "alice" })
      expect(rows(committed.domain.request.history)).toHaveLength(1)
      expect(committed.receipts).toHaveLength(1)
      expect(committed.decision.objective).toBe("Concurrent authorized case edit")
      expect(committed.decision.version).toBe(before.decision.version + 1)
      expect(committed.decision.receipts).toEqual([])
      expect(committed.decision.preparedChanges[0]).toEqual(change)
      if (mode === "interrupted") expect(committed.decision.choices).toEqual(before.decision.choices)
      else expect(committed.decision.choices).toEqual(before.decision.choices.map((choice) =>
        choice.id === prepared.request.choiceId ? { ...choice, reason: "Concurrent authorized choice revision" } : choice))
      const receipt = committed.receipts[0]!
      const bound = await receiptEvidence(fixture, change, receipt)
      expect(bound.proof.value).toEqual(receipt)
      expect(bound.proof.commandDigest).toBe(receiptReviewBinding(change, application.reviewDigest))
      expect(fixture.receiptCommits).toHaveLength(1)

      const retry = await fixture.http("decision-apply", application, "alice", "c12-postcommit-control")
      expect(retry.response.status).toBe(409)
      expect(retry.body).toEqual({ status: "stale", reason: "prepared-case-changed" })
      expect(await observeC12(fixture)).toEqual(committed)
      expect(await receiptEvidence(fixture, change, receipt)).toEqual(bound)
      const reReview = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
      expect(reReview.response.status).toBe(409)
      expect(reReview.body).toEqual({ status: "stale", reason: "prepared-case-changed" })
      expect(await observeC12(fixture)).toEqual(committed)

      const recovery = await fixture.http("decision-recover", { purpose: "recover",
        caseRef: { ...prepared.request.caseRef, version: committed.decision.version },
        choiceId: application.choiceId, changeId: application.changeId }, "alice", "c12-postcommit-recovery")
      if (mode === "choice-replaced") {
        expect(recovery.response.status).toBe(409)
        expect(recovery.body).toEqual({ status: "conflict", reason: "application-intent-mismatch" })
        expect(await observeC12(fixture)).toEqual(committed)
      } else {
        expect(recovery.response.status).toBe(200)
        expect(recovery.body).toEqual({ status: "ok", value: { receiptId: receipt.id, surface: "procurement", version: 1, outcome: "applied" } })
        const reconciled = await observeC12(fixture)
        expect(reconciled.domain).toEqual(committed.domain)
        expect(reconciled.receipts).toEqual(committed.receipts)
        expect(reconciled.decision.objective).toBe(committed.decision.objective)
        expect(reconciled.decision.choices).toEqual(committed.decision.choices)
        expect(reconciled.decision.version).toBe(committed.decision.version + 1)
        expect(reconciled.decision.receipts).toEqual(committed.receipts)
        expect(reconciled.decision.preparedChanges[0]?.receipt).toEqual(receipt)
      }
      expect(await receiptEvidence(fixture, change, receipt)).toEqual(bound)
      expect(fixture.receiptCommits).toHaveLength(1)
    } finally { await fixture.dispose() }
  }
}, 60_000)
