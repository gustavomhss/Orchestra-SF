import { expect, test } from "bun:test"
import type { Page, Response as BrowserResponse } from "@playwright/test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { object, rows } from "../../../runtime/contract.ts"
import { launchBrowserDriver } from "../wp02/browser-driver-fixture.ts"
import { interruptC12AfterCommit, observeC12 } from "./consumer.ts"
import { createC12NativeConsumer } from "./native-consumer.ts"
import { readReviewDigest } from "./fixture.ts"

/** Read the real response before UI39 receives it and rereads projection.case. */
async function captureRecoveryResponse(page: Page) {
  const captured = Promise.withResolvers<{ status: number; body: unknown }>()
  await page.route(/\/sf\/procurement\?sf=decision-recover$/, async (route) => {
    try {
      expect(route.request().method()).toBe("POST")
      const response = await route.fetch({ maxRetries: 0 })
      let observed: { status: number; body: unknown }
      try {
        observed = { status: response.status(), body: await response.json() }
        // Forward the original response without replacing its status, headers or
        // bytes. The native consumer still performs its original case projection read.
        await route.fulfill({ response })
      } finally { await response.dispose() }
      captured.resolve(observed)
    } catch (error) { captured.reject(error); throw error }
  }, { times: 1 })
  return { response: captured.promise }
}

function isCaseProjection(response: BrowserResponse) {
  return response.request().method() === "GET" &&
    new URL(response.url()).pathname === "/sf/api/ui/projections/case"
}

async function expectRecoveredProjection(response: BrowserResponse, caseId: string, receiptId: string) {
  expect(response.status()).toBe(200)
  const body = object(await response.json())
  expect(body.status).toBe("ok")
  const projected = object(object(object(body.value).projection).case)
  expect(projected.id).toBe(caseId)
  expect(rows(projected.receipts).map((receipt) => receipt.id)).toContain(receiptId)
}

test("C12 UI recovers the original receipt after lost response concurrent edit reload and a new SQLite composition", async () => {
  expectSpawn(import.meta.path)
  const consumer = await createC12NativeConsumer()
  const driver = await launchBrowserDriver("host-response-recovery").catch(async (error) => { await consumer.close(); throw error })
  try {
    const session = await driver.browser.newContext({ extraHTTPHeaders: { Authorization: "Bearer alice" } })
    const page = await session.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    expect((await page.goto(consumer.url))?.status()).toBe(200)
    const review = page.getByRole("button", { name: "Read producer review", exact: true })
    const apply = page.getByRole("button", { name: "Apply reviewed change", exact: true })
    await review.waitFor()
    expect(await page.locator(".sf-u18-change-list > li").count()).toBe(1)
    // UI39 uses a producer review followed by an explicit confirmation button.
    // No Apply control or request exists before that original review succeeds.
    expect(await apply.count()).toBe(0)
    expect(await page.locator('[data-component="sf-change-review"]').count()).toBe(0)
    expect(consumer.traffic.filter((item) => item.mode === "decision-apply")).toEqual([])
    const reviewed = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-review")
    await review.click()
    expect((await reviewed).status()).toBe(200)
    await apply.and(page.locator(":enabled")).waitFor()
    expect(await apply.isEnabled()).toBe(true)
    const proof = readReviewDigest(consumer.traffic.find((item) => item.mode === "decision-review")!.result)
    expect(await page.locator('[data-component="sf-change-review"]').getByText(proof, { exact: true }).isVisible()).toBe(true)
    expect(consumer.traffic.filter((item) => item.mode === "decision-apply")).toEqual([])
    const choiceBefore = structuredClone((await observeC12(consumer.current())).decision.choices)
    interruptC12AfterCommit(consumer.current())

    // The real domain commits before its return path is interrupted, leaving a
    // genuinely unlinked receipt. Drop the completed HTTP response as a second
    // transport failure; no receipt, status or domain response is fabricated.
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
    expect(await lost.promise).toBe(503)
    const retry = page.getByRole("button", { name: "Retry same application", exact: true })
    await retry.and(page.locator(":enabled")).waitFor()
    expect(await retry.isEnabled()).toBe(true)
    const first = consumer.traffic.find((item) => item.mode === "decision-apply")!
    expect(JSON.parse(first.body)).toEqual({ ...consumer.prepared.request, reviewDigest: proof })
    expect(first.result).toEqual({ status: "unavailable", reason: "domain-application-unavailable" })
    expect(first.key).toBeTruthy()
    const committed = await observeC12(consumer.current())
    expect(object(committed.domain.request.pr).estAmount).toBe(150)
    expect(committed.domain.version).toMatchObject({ version: 1, by: "alice" })
    expect(rows(committed.domain.request.history)).toHaveLength(1)
    expect(rows(committed.domain.request.history)[0]).toMatchObject({ action: "Saved", by: "alice" })
    expect(committed.receipts).toHaveLength(1)
    expect(committed.receipts[0]).toMatchObject({
      principalRef: "alice", surface: "procurement", version: 1,
      targetIncarnation: consumer.prepared.change.target.incarnation,
      idempotencyKey: consumer.prepared.change.idempotencyKey,
      commandDigest: consumer.prepared.change.operation.commandDigest,
    })
    expect(committed.decision.objective).toBe("Concurrent authorized case edit")
    expect(committed.decision.choices).toEqual(choiceBefore)
    expect(committed.decision.preparedChanges[0]?.state).toBe("planned")
    expect(committed.decision.receipts).toEqual([])
    expect(consumer.current().receiptCommits).toHaveLength(1)

    // The explicit retry preserves the original intention; normal Apply's CAS
    // still refuses the historical case version instead of applying a new effect.
    const retried = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-apply")
    await retry.click()
    expect((await retried).status()).toBe(409)
    const applications = consumer.traffic.filter((item) => item.mode === "decision-apply")
    expect(applications).toHaveLength(2)
    expect(applications[1]).toMatchObject({ body: first.body, key: first.key })
    expect(await observeC12(consumer.current())).toEqual(committed)
    expect((await page.reload())?.status()).toBe(200)
    await page.getByRole("button", { name: "Recover recorded receipt", exact: true }).and(page.locator(":enabled")).waitFor()
    expect(await page.getByRole("button", { name: "Recover recorded receipt", exact: true }).isEnabled()).toBe(true)
    expect(consumer.traffic.filter((item) => item.mode === "decision-apply")).toHaveLength(2)

    // No previous page, JS closure, sessionStorage or host review cache survives.
    await session.close()
    await consumer.reopen()
    expect(await observeC12(consumer.current())).toEqual(committed)
    const fresh = await driver.browser.newContext({ extraHTTPHeaders: { Authorization: "Bearer alice" } })
    const reopened = await fresh.newPage()
    reopened.on("pageerror", (error) => errors.push(error.message))
    expect((await reopened.goto(consumer.url))?.status()).toBe(200)
    expect(await reopened.evaluate(() => ({ session: sessionStorage.length, local: localStorage.length }))).toEqual({ session: 0, local: 0 })
    await reopened.getByRole("button", { name: "Recover recorded receipt", exact: true }).and(reopened.locator(":enabled")).waitFor()
    expect(await reopened.getByRole("button", { name: "Recover recorded receipt", exact: true }).isEnabled()).toBe(true)
    const recoveryCapture = await captureRecoveryResponse(reopened)
    const recoveredResponse = reopened.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-recover")
    const reloaded = reopened.waitForResponse(isCaseProjection)
    await reopened.getByRole("button", { name: "Recover recorded receipt", exact: true }).click()
    const response = await recoveredResponse
    expect(response.status()).toBe(200)
    const recoveredBody = await recoveryCapture.response
    expect(recoveredBody.status).toBe(response.status())
    const result = object(recoveredBody.body)
    expect(object(result.value)).toMatchObject({ receiptId: committed.receipts[0]!.id, surface: "procurement", version: 1, outcome: "applied" })
    await expectRecoveredProjection(await reloaded, committed.decision.id, committed.receipts[0]!.id)
    await reopened.getByRole("button", {
      name: consumer.prepared.change.target.id + " · applied · v" + consumer.prepared.change.expectedVersion,
      exact: true,
    }).waitFor()
    const recoverTraffic = consumer.traffic.filter((item) => item.mode === "decision-recover")
    expect(recoverTraffic).toHaveLength(1)
    expect(JSON.parse(recoverTraffic[0]!.body)).toEqual({
      purpose: "recover", caseRef: { id: committed.decision.id, incarnation: committed.decision.incarnation, version: committed.decision.version },
      choiceId: consumer.prepared.request.choiceId, changeId: consumer.prepared.request.changeId,
    })
    expect(recoverTraffic[0]!.key).toBeTruthy()
    expect(recoverTraffic[0]!.key).not.toBe(first.key)
    const reconciled = await observeC12(consumer.current())
    expect(reconciled.domain).toEqual(committed.domain)
    expect(reconciled.receipts).toEqual(committed.receipts)
    expect(reconciled.decision.objective).toBe(committed.decision.objective)
    expect(reconciled.decision.choices).toEqual(choiceBefore)
    expect(reconciled.decision.version).toBe(committed.decision.version + 1)
    expect(reconciled.decision.receipts).toEqual(committed.receipts)
    expect(reconciled.decision.preparedChanges[0]?.receipt).toEqual(committed.receipts[0])
    expect(consumer.current().receiptCommits).toEqual([])

    // Another explicit recovery after success is observational, including CAS/audit.
    await reopened.getByRole("button", { name: "Recover recorded receipt", exact: true }).and(reopened.locator(":enabled")).waitFor()
    expect(await reopened.getByRole("button", { name: "Recover recorded receipt", exact: true }).isEnabled()).toBe(true)
    const repeatedCapture = await captureRecoveryResponse(reopened)
    const again = reopened.waitForResponse((reply) => new URL(reply.url()).searchParams.get("sf") === "decision-recover")
    const navigated = reopened.waitForResponse(isCaseProjection)
    await reopened.getByRole("button", { name: "Recover recorded receipt", exact: true }).click()
    const repeated = await again
    expect(repeated.status()).toBe(200)
    const repeatedBody = await repeatedCapture.response
    expect(repeatedBody.status).toBe(repeated.status())
    expect(repeatedBody.body).toEqual(result)
    await expectRecoveredProjection(await navigated, committed.decision.id, committed.receipts[0]!.id)
    expect(await observeC12(consumer.current())).toEqual(reconciled)
    expect(consumer.traffic.filter((item) => item.mode === "decision-apply")).toHaveLength(2)
    expect(consumer.traffic.filter((item) => item.mode === "decision-review")).toHaveLength(1)
    expect(errors).toEqual([])
    console.info("SF_C12_RECOVERY_POSITIVE", JSON.stringify({
      receiptId: committed.receipts[0]!.id, firstInternalStatus: first.status, lostResponse: true,
      retryStatus: applications[1]!.status, recoveryStatus: response.status(), repeatedStatus: repeated.status(),
      sameReceipt: true, financialEffects: rows(reconciled.domain.request.history).length,
      originalCaseVersion: consumer.prepared.request.caseRef.version, concurrentCaseVersion: committed.decision.version, reconciledCaseVersion: reconciled.decision.version,
      newBrowserContext: true, emptyBrowserStorage: true, newAdmission: true, servicesReconstructed: true, sqliteReopened: true, processRestarted: false,
    }))
  } finally { try { await driver.close() } finally { await consumer.close() } }
  driver.report()
}, 120_000)

test("C12 UI recovers a successful committed Apply whose 200 response was lost", async () => {
  expectSpawn(import.meta.path)
  const consumer = await createC12NativeConsumer()
  const driver = await launchBrowserDriver("host-response-recovery").catch(async (error) => { await consumer.close(); throw error })
  try {
    const page = await driver.browser.newPage({ extraHTTPHeaders: { Authorization: "Bearer alice" } })
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    expect((await page.goto(consumer.url))?.status()).toBe(200)
    const reviewed = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-review")
    const review = page.getByRole("button", { name: "Read producer review", exact: true })
    await review.waitFor()
    expect(await page.getByRole("button", { name: "Apply reviewed change", exact: true }).count()).toBe(0)
    expect(consumer.traffic.filter((item) => item.mode === "decision-apply")).toEqual([])
    await review.click()
    expect((await reviewed).status()).toBe(200)
    await page.getByRole("button", { name: "Apply reviewed change", exact: true }).and(page.locator(":enabled")).waitFor()
    const proof = readReviewDigest(consumer.traffic.find((item) => item.mode === "decision-review")!.result)
    expect(await page.locator('[data-component="sf-change-review"]').getByText(proof, { exact: true }).isVisible()).toBe(true)
    expect(consumer.traffic.filter((item) => item.mode === "decision-apply")).toEqual([])
    const lost = Promise.withResolvers<number>()
    await page.route(/\/sf\/procurement\?sf=decision-apply$/, async (route) => {
      try { const response = await route.fetch({ maxRetries: 0 }); lost.resolve(response.status()); await response.dispose(); await route.abort("failed") }
      catch (error) { lost.reject(error); throw error }
    }, { times: 1 })
    const failed = page.waitForEvent("requestfailed", { predicate: (request) => new URL(request.url()).searchParams.get("sf") === "decision-apply" })
    await page.getByRole("button", { name: "Apply reviewed change", exact: true }).click()
    await failed
    expect(await lost.promise).toBe(200)
    await page.getByRole("button", { name: "Recover recorded receipt", exact: true }).and(page.locator(":enabled")).waitFor()
    expect(await page.getByRole("button", { name: "Recover recorded receipt", exact: true }).isEnabled()).toBe(true)
    const committed = await observeC12(consumer.current())
    expect(committed.receipts).toHaveLength(1)
    expect(committed.decision.receipts).toEqual(committed.receipts)
    expect(rows(committed.domain.request.history)).toHaveLength(1)
    const recoveryCapture = await captureRecoveryResponse(page)
    const recovered = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-recover")
    const navigated = page.waitForResponse(isCaseProjection)
    await page.getByRole("button", { name: "Recover recorded receipt", exact: true }).click()
    const response = await recovered
    expect(response.status()).toBe(200)
    const recoveredBody = await recoveryCapture.response
    expect(recoveredBody.status).toBe(response.status())
    expect(object(object(recoveredBody.body).value).receiptId).toBe(committed.receipts[0]!.id)
    await expectRecoveredProjection(await navigated, committed.decision.id, committed.receipts[0]!.id)
    expect(await observeC12(consumer.current())).toEqual(committed)
    expect(consumer.traffic.filter((item) => item.mode === "decision-apply")).toHaveLength(1)
    expect(consumer.current().receiptCommits).toHaveLength(1)
    expect(errors).toEqual([])
    console.info("SF_C12_COMMITTED_200_LOSS", JSON.stringify({ internalStatus: 200, lostResponse: true, recoveryStatus: response.status(), receiptId: committed.receipts[0]!.id, financialEffects: 1 }))
  } finally { try { await driver.close() } finally { await consumer.close() } }
  driver.report()
}, 90_000)

