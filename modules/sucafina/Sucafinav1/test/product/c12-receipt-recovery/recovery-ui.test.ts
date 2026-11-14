import { expect, test } from "bun:test"
import type { Page } from "@playwright/test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { object, rows } from "../../../runtime/contract.ts"
import { launchBrowserDriver } from "../wp02/browser-driver-fixture.ts"
import { createC12Consumer, interleaveC12CaseEdit, observeC12 } from "./consumer.ts"
import { readReviewDigest } from "./fixture.ts"

/** Read the real response before the production script receives it and reloads. */
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
        // bytes. The browser still consumes it and performs its normal reload.
        await route.fulfill({ response })
      } finally { await response.dispose() }
      captured.resolve(observed)
    } catch (error) { captured.reject(error); throw error }
  }, { times: 1 })
  return { response: captured.promise }
}

test("C12 UI recovers the original receipt after lost response concurrent edit reload and a new SQLite composition", async () => {
  expectSpawn(import.meta.path)
  const consumer = await createC12Consumer()
  const driver = await launchBrowserDriver("host-response-recovery").catch(async (error) => { await consumer.close(); throw error })
  try {
    const session = await driver.browser.newContext({ extraHTTPHeaders: { Authorization: "Bearer alice" } })
    const page = await session.newPage()
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
    await article.locator("[data-change-confirm]:enabled").waitFor()
    const proof = readReviewDigest(consumer.traffic.find((item) => item.mode === "decision-review")!.result)
    await confirm.check()
    const choiceBefore = structuredClone((await observeC12(consumer.current())).decision.choices)
    interleaveC12CaseEdit(consumer.current())

    // The real request reaches HTTP, C08 and SQLite. Only its completed wire
    // response is dropped; no receipt, status or domain response is fabricated.
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
    expect(await lost.promise).toBe(409)
    const retry = article.getByRole("button", { name: "Retry same application", exact: true })
    await retry.waitFor()
    await article.locator("[data-apply-change]:enabled").waitFor()
    const first = consumer.traffic.find((item) => item.mode === "decision-apply")!
    expect(JSON.parse(first.body)).toEqual({ ...consumer.prepared.request, reviewDigest: proof })
    expect(first.result).toEqual({ status: "stale", reason: "case-changed-after-application" })
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
    await page.locator("[data-recover-change]:enabled").waitFor()
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
    await reopened.locator("[data-recover-change]:enabled").waitFor()
    const recoveryCapture = await captureRecoveryResponse(reopened)
    const recoveredResponse = reopened.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-recover")
    const reloaded = reopened.waitForEvent("framenavigated", { predicate: (frame) => frame === reopened.mainFrame() })
    await reopened.getByRole("button", { name: "Recover recorded receipt", exact: true }).click()
    const response = await recoveredResponse
    expect(response.status()).toBe(200)
    const recoveredBody = await recoveryCapture.response
    expect(recoveredBody.status).toBe(response.status())
    const result = object(recoveredBody.body)
    expect(object(result.value)).toMatchObject({ receiptId: committed.receipts[0]!.id, surface: "procurement", version: 1, outcome: "applied" })
    await reloaded
    await reopened.locator("[data-decision-apply]").getByText("State: applied", { exact: true }).waitFor()
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
    await reopened.locator("[data-recover-change]:enabled").waitFor()
    const repeatedCapture = await captureRecoveryResponse(reopened)
    const again = reopened.waitForResponse((reply) => new URL(reply.url()).searchParams.get("sf") === "decision-recover")
    const navigated = reopened.waitForEvent("framenavigated", { predicate: (frame) => frame === reopened.mainFrame() })
    await reopened.getByRole("button", { name: "Recover recorded receipt", exact: true }).click()
    const repeated = await again
    expect(repeated.status()).toBe(200)
    const repeatedBody = await repeatedCapture.response
    expect(repeatedBody.status).toBe(repeated.status())
    expect(repeatedBody.body).toEqual(result)
    await navigated
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
  const consumer = await createC12Consumer()
  const driver = await launchBrowserDriver("host-response-recovery").catch(async (error) => { await consumer.close(); throw error })
  try {
    const page = await driver.browser.newPage({ extraHTTPHeaders: { Authorization: "Bearer alice" } })
    expect((await page.goto(consumer.url))?.status()).toBe(200)
    const reviewed = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-review")
    await page.getByRole("button", { name: "Review current changes", exact: true }).click()
    expect((await reviewed).status()).toBe(200)
    await page.locator("[data-change-confirm]:enabled").waitFor()
    await page.getByRole("checkbox", { name: "I reviewed these changes and want to apply them", exact: true }).check()
    const lost = Promise.withResolvers<number>()
    await page.route(/\/sf\/procurement\?sf=decision-apply$/, async (route) => {
      try { const response = await route.fetch({ maxRetries: 0 }); lost.resolve(response.status()); await response.dispose(); await route.abort("failed") }
      catch (error) { lost.reject(error); throw error }
    }, { times: 1 })
    const failed = page.waitForEvent("requestfailed", { predicate: (request) => new URL(request.url()).searchParams.get("sf") === "decision-apply" })
    await page.getByRole("button", { name: "Apply reviewed change", exact: true }).click()
    await failed
    expect(await lost.promise).toBe(200)
    await page.locator("[data-recover-change]:enabled").waitFor()
    const committed = await observeC12(consumer.current())
    expect(committed.receipts).toHaveLength(1)
    expect(committed.decision.receipts).toEqual(committed.receipts)
    expect(rows(committed.domain.request.history)).toHaveLength(1)
    const recoveryCapture = await captureRecoveryResponse(page)
    const recovered = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "decision-recover")
    const navigated = page.waitForEvent("framenavigated", { predicate: (frame) => frame === page.mainFrame() })
    await page.getByRole("button", { name: "Recover recorded receipt", exact: true }).click()
    const response = await recovered
    expect(response.status()).toBe(200)
    const recoveredBody = await recoveryCapture.response
    expect(recoveredBody.status).toBe(response.status())
    expect(object(object(recoveredBody.body).value).receiptId).toBe(committed.receipts[0]!.id)
    await navigated
    expect(await observeC12(consumer.current())).toEqual(committed)
    expect(consumer.traffic.filter((item) => item.mode === "decision-apply")).toHaveLength(1)
    expect(consumer.current().receiptCommits).toHaveLength(1)
    console.info("SF_C12_COMMITTED_200_LOSS", JSON.stringify({ internalStatus: 200, lostResponse: true, recoveryStatus: response.status(), receiptId: committed.receipts[0]!.id, financialEffects: 1 }))
  } finally { try { await driver.close() } finally { await consumer.close() } }
  driver.report()
}, 90_000)

