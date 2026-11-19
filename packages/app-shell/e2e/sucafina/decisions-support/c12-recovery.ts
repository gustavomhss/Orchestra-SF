import { expect, type Browser, type Page, type TestInfo } from "@playwright/test"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { asRecord } from "./journey"
import { createC12Installation, enterC12Shell, withC12Host } from "./c12-installation"
import type { C12Ready } from "./c12-protocol"

const isMode = (url: string, mode: string) => {
  const value = new URL(url)
  return value.pathname === "/sucafina/procurement" && value.searchParams.get("sf") === mode
}
const changeURL = (origin: string, host: C12Ready) => origin + "/orchestra/sf-decisions/" +
  encodeSfRouteRef(host.caseRef) + "/changes/" + encodeSfRouteRef(host.prepared.change.id)

async function readProducerReview(page: Page) {
  // The native S03 confirmation exists only after the producer review, instead
  // of the retired HTML checkbox. Before that review no Apply can be submitted.
  await expect(page.getByRole("button", { name: "Apply reviewed change", exact: true })).toHaveCount(0)
  const read = page.waitForResponse((response) => isMode(response.url(), "decision-review"))
  await page.getByRole("button", { name: "Read producer review", exact: true }).click()
  expect((await read).status()).toBe(200)
  const button = page.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Apply reviewed change", exact: true })
  await expect(button).toBeEnabled()
  return button
}

async function dropApplication(page: Page) {
  const lost = Promise.withResolvers<number>()
  await page.route(/\/sucafina\/procurement\?sf=decision-apply$/, async (route) => {
    try {
      const response = await route.fetch({ maxRetries: 0 })
      lost.resolve(response.status())
      await response.dispose()
      await route.abort("failed")
    } catch (error) { lost.reject(error); throw error }
  }, { times: 1 })
  const failed = page.waitForEvent("requestfailed", { predicate: (request) => isMode(request.url(), "decision-apply") })
  return { status: lost.promise, failed }
}

/** Capture and forward the same original response before the chapter rereads C08. */
async function recover(page: Page) {
  const captured = Promise.withResolvers<{ status: number; body: unknown }>()
  await page.route(/\/sucafina\/procurement\?sf=decision-recover$/, async (route) => {
    try {
      expect(route.request().method()).toBe("POST")
      const response = await route.fetch({ maxRetries: 0 })
      try {
        const observed = { status: response.status(), body: await response.json() }
        await route.fulfill({ response })
        captured.resolve(observed)
      } finally { await response.dispose() }
    } catch (error) { captured.reject(error); throw error }
  }, { times: 1 })
  const projected = page.waitForResponse((response) => response.request().method() === "GET" &&
    new URL(response.url()).pathname === "/sucafina/api/ui/projections/case")
  await page.getByRole("button", { name: "Recover recorded receipt", exact: true }).click()
  const response = await captured.promise
  expect(response.status).toBe(200)
  expect((await projected).status()).toBe(200)
  await expect(page.locator("dt").filter({ hasText: /^Producer state$/ }).locator("+ dd")).toHaveText("applied")
  return response
}

function reviewDigest(body: Record<string, unknown>) {
  const value = asRecord(body.value).reviewDigest
  expect(value).toMatch(/^[a-f0-9]{64}$/)
  if (typeof value !== "string") throw new Error("Original review digest missing")
  return value
}

export async function interruptedC12Recovery(browser: Browser, info: TestInfo) {
  const installation = await createC12Installation()
  const errors: string[] = []
  try {
    const saved = await withC12Host(installation, info, "initial", async (host) => {
      const session = await browser.newContext()
      try {
        expect(await session.storageState()).toEqual({ cookies: [], origins: [] })
        const page = await session.newPage()
        page.on("pageerror", (error) => errors.push(error.message))
        await enterC12Shell(page, installation, host)
        expect((await page.goto(changeURL(installation.origin, host)))?.status()).toBe(200)
        await expect(page.getByRole("button", { name: "Read producer review", exact: true })).toHaveCount(1)
        const apply = await readProducerReview(page)
        const reviewed = await host.control()
        expect(reviewed.traffic.filter((item) => item.mode === "decision-apply")).toHaveLength(0)
        const proof = reviewDigest(reviewed.traffic.find((item) => item.mode === "decision-review")!.result)
        const choiceBefore = structuredClone(reviewed.observation.decision.choices)
        await host.control("interrupt")
        const lost = await dropApplication(page)
        await apply.click()
        await lost.failed
        expect(await lost.status).toBe(503)
        const retry = page.getByRole("button", { name: "Retry same application", exact: true })
        await expect(retry).toBeEnabled()
        const observed = await host.control()
        const first = observed.traffic.find((item) => item.mode === "decision-apply")!
        expect(JSON.parse(first.body)).toEqual({ ...host.prepared.request, reviewDigest: proof })
        expect(first.result).toEqual({ status: "unavailable", reason: "domain-application-unavailable" })
        expect(first.key).toBeTruthy()
        const committed = observed.observation
        expect(asRecord(committed.domain.request.pr).estAmount).toBe(150)
        expect(committed.domain.version).toMatchObject({ version: 1, by: host.actorId })
        expect(committed.domain.request.history).toHaveLength(1)
        expect(Array.isArray(committed.domain.request.history) ? committed.domain.request.history[0] : undefined)
          .toMatchObject({ action: "Saved", by: host.actorId })
        expect(committed.receipts).toHaveLength(1)
        expect(committed.receipts[0]).toMatchObject({ principalRef: host.actorId, surface: "procurement", version: 1,
          targetIncarnation: host.prepared.change.target.incarnation, idempotencyKey: host.prepared.change.idempotencyKey,
          commandDigest: host.prepared.change.operation.commandDigest })
        expect(committed.decision.objective).toBe("Concurrent authorized case edit")
        expect(committed.decision.choices).toEqual(choiceBefore)
        expect(committed.decision.preparedChanges[0]?.state).toBe("planned")
        expect(committed.decision.receipts).toEqual([])
        expect(observed.receiptCommits).toHaveLength(1)

        const retried = page.waitForResponse((response) => isMode(response.url(), "decision-apply"))
        await retry.click()
        expect((await retried).status()).toBe(409)
        const afterRetry = await host.control()
        const applications = afterRetry.traffic.filter((item) => item.mode === "decision-apply")
        expect(applications).toHaveLength(2)
        expect(applications[1]).toMatchObject({ body: first.body, key: first.key })
        expect(afterRetry.observation).toEqual(committed)
        expect((await page.reload())?.status()).toBe(200)
        await expect(page.getByRole("button", { name: "Recover recorded receipt", exact: true })).toBeEnabled()
        const beforeClose = await host.control()
        expect(beforeClose.traffic.filter((item) => item.mode === "decision-apply")).toHaveLength(2)
        return { committed, choiceBefore, first, proof, traffic: beforeClose.traffic, prepared: host.prepared }
      } finally { await session.close() }
    })

    // New process and SQLite composition; no old review cache or browser closure survives.
    await withC12Host(installation, info, "reopened", async (host) => {
      expect((await host.control()).observation).toEqual(saved.committed)
      const fresh = await browser.newContext()
      try {
        expect(await fresh.storageState()).toEqual({ cookies: [], origins: [] })
        const page = await fresh.newPage()
        page.on("pageerror", (error) => errors.push(error.message))
        await enterC12Shell(page, installation, host)
        expect((await page.goto(changeURL(installation.origin, host)))?.status()).toBe(200)
        await expect(page.getByRole("button", { name: "Recover recorded receipt", exact: true })).toBeEnabled()
        // Normal shell server/project preferences are allowed. No original
        // C12 receipt, review digest or command body may be rehydrated from them.
        const retainedPrivateState = await page.evaluate((values) => {
          const stored = JSON.stringify({
            local: Object.fromEntries(Object.entries(localStorage)), session: Object.fromEntries(Object.entries(sessionStorage)),
          })
          return values.map((value) => stored.includes(value))
        }, [saved.proof, saved.committed.receipts[0]!.id, saved.first.body])
        expect(retainedPrivateState).toEqual([false, false, false])
        const recovered = await recover(page)
        const result = asRecord(recovered.body)
        expect(asRecord(result.value)).toMatchObject({ receiptId: saved.committed.receipts[0]!.id,
          surface: "procurement", version: 1, outcome: "applied" })
        const after = await host.control()
        const recovery = after.traffic.filter((item) => item.mode === "decision-recover")
        expect(recovery).toHaveLength(1)
        expect(JSON.parse(recovery[0]!.body)).toEqual({ purpose: "recover", caseRef: {
          id: saved.committed.decision.id, incarnation: saved.committed.decision.incarnation, version: saved.committed.decision.version,
        }, choiceId: saved.prepared.request.choiceId, changeId: saved.prepared.request.changeId })
        expect(recovery[0]!.key).toBeTruthy()
        expect(recovery[0]!.key).not.toBe(saved.first.key)
        const reconciled = after.observation
        expect(reconciled.domain).toEqual(saved.committed.domain)
        expect(reconciled.receipts).toEqual(saved.committed.receipts)
        expect(reconciled.decision.objective).toBe(saved.committed.decision.objective)
        expect(reconciled.decision.choices).toEqual(saved.choiceBefore)
        expect(reconciled.decision.version).toBe(saved.committed.decision.version + 1)
        expect(reconciled.decision.receipts).toEqual(saved.committed.receipts)
        expect(reconciled.decision.preparedChanges[0]?.receipt).toEqual(saved.committed.receipts[0])
        expect(after.receiptCommits).toEqual([])

        await expect(page.getByRole("button", { name: "Recover recorded receipt", exact: true })).toBeEnabled()
        const repeated = await recover(page)
        expect(repeated.body).toEqual(result)
        const final = await host.control()
        expect(final.observation).toEqual(reconciled)
        const traffic = [...saved.traffic, ...final.traffic]
        expect(traffic.filter((item) => item.mode === "decision-apply")).toHaveLength(2)
        expect(traffic.filter((item) => item.mode === "decision-review")).toHaveLength(1)
        expect(errors).toEqual([])
        console.info("SF_C12_RECOVERY_POSITIVE", JSON.stringify({ receiptId: saved.committed.receipts[0]!.id,
          firstInternalStatus: saved.first.status, lostResponse: true, retryStatus: 409,
          recoveryStatus: recovered.status, repeatedStatus: repeated.status, sameReceipt: true, financialEffects: 1,
          originalCaseVersion: saved.prepared.request.caseRef.version, concurrentCaseVersion: saved.committed.decision.version,
          reconciledCaseVersion: reconciled.decision.version, newBrowserContext: true, initiallyEmptyBrowserStorage: true,
          privateRecoveryStateAbsent: true, newAdmission: true, servicesReconstructed: true, sqliteReopened: true, processRestarted: true }))
      } finally { await fresh.close() }
    })
  } finally { await installation.dispose() }
}

export async function successfulC12ResponseLoss(browser: Browser, info: TestInfo) {
  const installation = await createC12Installation()
  try {
    await withC12Host(installation, info, "initial", async (host) => {
      const context = await browser.newContext()
      try {
        const page = await context.newPage()
        await enterC12Shell(page, installation, host)
        expect((await page.goto(changeURL(installation.origin, host)))?.status()).toBe(200)
        const apply = await readProducerReview(page)
        expect((await host.control()).traffic.filter((item) => item.mode === "decision-apply")).toHaveLength(0)
        const lost = await dropApplication(page)
        await apply.click()
        await lost.failed
        expect(await lost.status).toBe(200)
        await expect(page.getByRole("button", { name: "Recover recorded receipt", exact: true })).toBeEnabled()
        const before = await host.control()
        const committed = before.observation
        expect(committed.receipts).toHaveLength(1)
        expect(committed.decision.receipts).toEqual(committed.receipts)
        expect(committed.domain.request.history).toHaveLength(1)
        const recovered = await recover(page)
        expect(asRecord(asRecord(recovered.body).value).receiptId).toBe(committed.receipts[0]!.id)
        const after = await host.control()
        expect(after.observation).toEqual(committed)
        expect(after.traffic.filter((item) => item.mode === "decision-apply")).toHaveLength(1)
        expect(after.receiptCommits).toHaveLength(1)
        console.info("SF_C12_COMMITTED_200_LOSS", JSON.stringify({ internalStatus: 200, lostResponse: true,
          recoveryStatus: recovered.status, receiptId: committed.receipts[0]!.id, financialEffects: 1 }))
      } finally { await context.close() }
    })
  } finally { await installation.dispose() }
}
