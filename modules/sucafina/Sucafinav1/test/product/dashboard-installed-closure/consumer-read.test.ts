import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import type { Locator, Page, Response, Route } from "@playwright/test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { enrollNativeBrowser } from "../native-ui-browser/session.ts"
import { launchBrowserDriver } from "../wp02/browser-driver-fixture.ts"
import { createConsumerReadFixture, initialCaseRef } from "./ownhost-fixture.ts"

const currentLoaded = "Current version loaded. Compare the differences and confirm the base before saving your values."
const savedMessage = "Draft saved. It can be included in a case choice before preparation."
const confirmationLabel = "I reviewed the current proposal and want to keep my values."
const modeResponse = (mode: string) => (response: Response) => response.request().method() === "POST" && new URL(response.url()).searchParams.get("sf") === mode
const modeUrl = (mode: string) => (url: URL) => url.pathname === "/sucafina/dashboard" && url.searchParams.get("sf") === mode

async function openWorkbench(page: Page, origin: string) {
  await page.goto(`${origin}/orchestra/sf-dashboard/hot-topics`)
  await page.getByRole("link", { name: "Private follow-up proposals", exact: true }).click()
  const panel = page.getByRole("region", { name: "Private follow-up proposals", exact: true })
  const [response] = await Promise.all([
    page.waitForResponse(modeResponse("dashboard-workbench")),
    panel.getByRole("button", { name: "Load options", exact: true }).click(),
  ])
  expect(response.status()).toBe(200)
  expect(object(await response.json()).status).toBe("ok")
  await panel.getByText("Options loaded.", { exact: false }).waitFor()
  expect(await panel.textContent()).not.toContain("Unrelated confidential case")
  return panel
}

async function chooseNew(panel: Locator) {
  await panel.getByRole("combobox", { name: "Case", exact: true }).selectOption({ label: "Review the action" })
  await panel.getByRole("combobox", { name: "Proposal", exact: true }).selectOption("new")
  await panel.getByRole("combobox", { name: "Source Hot Topic", exact: true }).selectOption({ label: "Original action" })
}

async function saveDraft(page: Page, panel: Locator) {
  const [written, discovered] = await Promise.all([
    page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
    page.waitForResponse(modeResponse("dashboard-workbench")),
    panel.getByRole("button", { name: "Save private draft", exact: true }).click(),
  ])
  expect(written.status()).toBe(200)
  expect(object(await written.json()).status).toBe("ok")
  expect(discovered.status()).toBe(200)
  expect(object(await discovered.json()).status).toBe("ok")
  await panel.getByText(savedMessage, { exact: true }).waitFor()
  return written.request().postDataJSON() as Record<string, unknown>
}

// Each test launches the existing Node-owned BrowserDriver and mounts the actual
// product over real SQLite. No HTML replacement or synthesized positive response
// substitutes for the domain, operator, source issuer or authority.
test("Dashboard reads the current source and active private proposal while preserving dirty values until explicit review", async () => {
  expectSpawn(import.meta.path)
  const f = await createConsumerReadFixture()
  const driver = await launchBrowserDriver("host-draft-conflict").catch(async (error) => { await f.close(); throw error })
  const failures: unknown[] = []
  try {
    const { expect: browserExpect } = await import("@playwright/test")
    const context = await driver.browser.newContext()
    context.setDefaultTimeout(10000)
    context.setDefaultNavigationTimeout(15000)
    const page = await context.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await enrollNativeBrowser(context, f.origin, () => f.identity.enroll())
    const panel = await openWorkbench(page, f.origin)
    await chooseNew(panel)
    await panel.getByLabel("Action", { exact: true }).fill("Initially saved proposal")
    await panel.getByLabel("Notes", { exact: true }).fill("Initially saved private context")
    await saveDraft(page, panel)
    const listed = await f.read((trusted) => f.decisions.drafts.list({ caseRef: initialCaseRef }, trusted))
    if (listed.status !== "ok" || listed.value.length !== 1) throw new Error("Saved private draft unavailable")
    const initial = await f.read((trusted) => f.decisions.drafts.readCurrent({ caseRef: initialCaseRef, draftRef: listed.value[0]!.draftRef }, trusted))
    if (initial.status !== "ok") throw new Error("Saved private draft identity unavailable")
    const original = structuredClone(initial.value)
    await panel.getByRole("combobox", { name: "Case", exact: true }).selectOption({ label: "Review the action" })
    await panel.getByRole("combobox", { name: "Proposal", exact: true }).selectOption({ label: "Initially saved proposal" })
    await panel.getByLabel("Action", { exact: true }).fill("My retained action")
    await panel.getByLabel("Notes", { exact: true }).fill("My retained explanation")

    const other = await context.newPage()
    other.on("pageerror", (error) => errors.push(error.message))
    const otherPanel = await openWorkbench(other, f.origin)
    await otherPanel.getByRole("combobox", { name: "Case", exact: true }).selectOption({ label: "Review the action" })
    await otherPanel.getByRole("combobox", { name: "Proposal", exact: true }).selectOption({ label: "Initially saved proposal" })
    await otherPanel.getByLabel("Action", { exact: true }).fill("Active proposal from another page")
    await otherPanel.getByLabel("Notes", { exact: true }).fill("Current private proposal context")
    const secondWrite = await saveDraft(other, otherPanel)
    expect(secondWrite.expectedVersion).toBe(1)

    // Before changing the source, a real stale write proves that the first page
    // still submits its original proposal identity/version. No mutation is replayed.
    const [stale] = await Promise.all([
      page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
      panel.getByRole("button", { name: "Save private draft", exact: true }).click(),
    ])
    expect(stale.status()).toBe(409)
    expect(stale.request().postDataJSON()).toMatchObject({ draftRef: original.draftRef, expectedVersion: 1, targetEvidence: original.targetEvidence })
    await panel.getByText("The draft changed.", { exact: false }).waitFor()

    const activeKey = `sf:proposal-coverage:hot-topic:active:${digestSfValue(original.id)}`
    const active = await f.authority.state.read(f.request(), "preferences", (state) => state.preferences[activeKey])
    expect(active.status === "ok" && active.value).toMatchObject({ id: original.id, incarnation: original.incarnation, version: 2,
      fields: { action: "Active proposal from another page", notes: "Current private proposal context" } })
    const changed = await page.request.post(`${f.origin}/sucafina/dashboard`, { headers: { origin: f.origin }, data: {
      page: "Hot Topics & Actions", action: "save", id: "topic", version: 0,
      values: { action: "Current materially changed source", notes: "Current source context" },
    } })
    expect(changed.status()).toBe(200)
    expect(object(await changed.json()).ok).toBe(true)

    const [discovered, checked] = await Promise.all([
      page.waitForResponse(modeResponse("dashboard-workbench")),
      page.waitForResponse(modeResponse("dashboard-draft-read")),
      panel.getByRole("button", { name: "Load current version and keep my edits", exact: true }).click(),
    ])
    expect(discovered.status()).toBe(200)
    expect(checked.status()).toBe(200)
    expect(checked.request().postDataJSON()).toEqual({ caseRef: original.caseRef, targetEvidence: original.targetEvidence, draftRef: original.draftRef })
    const checkedBody = object(await checked.json())
    expect(checkedBody.status).toBe("ok")
    const current = object(checkedBody.value), proposal = object(current.draft)
    expect(current.originalSource).toEqual({ refId: original.targetEvidence.refId, refDigest: original.targetEvidence.refDigest })
    expect(current.currentSource).not.toEqual(original.targetEvidence)
    expect(proposal).toMatchObject({ id: original.id, incarnation: original.incarnation, version: 2,
      fields: { action: "Active proposal from another page", notes: "Current private proposal context" } })
    expect(object(object(current.source).draft).fields).toMatchObject({ action: "Current materially changed source", notes: "Current source context" })
    await panel.getByText(currentLoaded, { exact: true }).waitFor()
    const tables = panel.getByRole("region", { name: "Current proposal comparison", exact: true }).getByRole("table")
    expect(await tables.count()).toBe(2)
    expect(await tables.nth(0).locator("th").allTextContents()).toEqual(["Field", "Previous version", "Current version", "My values"])
    expect(await tables.nth(0).getByRole("row").filter({ has: page.getByRole("cell", { name: "Action", exact: true }) }).locator("td").allTextContents())
      .toEqual(["Action", "Initially saved proposal", "Active proposal from another page", "My retained action"])
    expect(await tables.nth(1).locator("th").allTextContents()).toEqual(["Field", "Current authorized source"])
    expect(await tables.nth(1).textContent()).toContain("Current materially changed source")
    expect(await panel.getByLabel("Notes", { exact: true }).inputValue()).toBe("My retained explanation")
    expect(await panel.getByLabel(confirmationLabel, { exact: true }).isChecked()).toBe(false)
    await browserExpect(panel.getByRole("button", { name: "Save private draft", exact: true })).toBeDisabled()
    const beforeReview = await f.authority.state.read(f.request(), "preferences", (state) => state.preferences[activeKey])
    expect(beforeReview.status === "ok" && beforeReview.value).toEqual(active.status === "ok" && active.value)

    await panel.getByLabel(confirmationLabel, { exact: true }).check()
    const reviewedWrite = await saveDraft(page, panel)
    expect(reviewedWrite.expectedVersion).toBe(2)
    expect(reviewedWrite.draftRef).toBe(proposal.draftRef)
    expect(reviewedWrite.targetEvidence).toEqual(current.currentSource)
    expect(reviewedWrite.sourceRefs).toEqual([current.currentSource])
    const latest = await f.read((trusted) => f.decisions.drafts.list({ caseRef: initialCaseRef }, trusted))
    if (latest.status !== "ok" || latest.value.length !== 1) throw new Error("Reviewed draft unavailable")
    const retained = await f.read((trusted) => f.decisions.drafts.readCurrent({ caseRef: initialCaseRef, draftRef: latest.value[0]!.draftRef }, trusted))
    expect(retained.status === "ok" && retained.value).toMatchObject({ id: original.id, incarnation: original.incarnation, version: 3,
      fields: { action: "My retained action", notes: "My retained explanation" }, targetEvidence: current.currentSource })
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0] })))
      .toMatchObject({ action: "Current materially changed source", notes: "Current source context" })
    expect(initial.value).toEqual(original)
    expect(errors).toEqual([])
  } catch (error) {
    failures.push(error)
    console.error("SF_DASHBOARD_CONSUMER_READ_FAILURE", error)
    console.error("SF_DASHBOARD_CONSUMER_READ_TRACE", JSON.stringify(f.httpTrace))
  } finally {
    for (const closed of await Promise.allSettled([driver.close(), f.close()])) if (closed.status === "rejected") failures.push(closed.reason)
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) throw new AggregateError(failures, "Dashboard private draft read and cleanup failed")
  driver.report()
}, 60000)

test("Dashboard keeps dirty values through interrupted reads and fences write withdrawal between admissions before purging actual read loss", async () => {
  expectSpawn(import.meta.path)
  const f = await createConsumerReadFixture()
  const driver = await launchBrowserDriver("host-write-authority").catch(async (error) => { await f.close(); throw error })
  const failures: unknown[] = []
  try {
    const { expect: browserExpect } = await import("@playwright/test")
    const context = await driver.browser.newContext()
    context.setDefaultTimeout(10000)
    context.setDefaultNavigationTimeout(15000)
    const page = await context.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await enrollNativeBrowser(context, f.origin, () => f.identity.enroll())
    const panel = await openWorkbench(page, f.origin)
    await chooseNew(panel)
    await panel.getByLabel("Action", { exact: true }).fill("Private retained operator action")
    await panel.getByLabel("Notes", { exact: true }).fill("Private retained operator context")
    expect(await panel.getByRole("button", { name: "Save private draft", exact: true }).isEnabled()).toBe(true)

    const readUrl = modeUrl("dashboard-draft-read")
    const interrupted = Promise.withResolvers<{ status: number; body: unknown }>()
    const abortRead = async (route: Route) => {
      try {
        // The real admitted read completes; only delivery is interrupted. Neither
        // the HTTP body nor the authority result is synthesized by this fixture.
        const response = await route.fetch(), body: unknown = await response.json()
        await route.abort("aborted")
        interrupted.resolve({ status: response.status(), body })
      } catch (error) { interrupted.reject(error); await route.abort().catch(() => {}) }
    }
    await page.route(readUrl, abortRead)
    const [observed] = await Promise.all([interrupted.promise, panel.getByRole("button", { name: "Load options", exact: true }).click()])
    expect(observed.status).toBe(200)
    expect(object(observed.body).status).toBe("ok")
    await browserExpect(panel.getByRole("button", { name: "Load options", exact: true })).toBeEnabled()
    await page.unroute(readUrl, abortRead)
    expect(await panel.getByLabel("Action", { exact: true }).inputValue()).toBe("Private retained operator action")
    expect(await panel.getByLabel("Notes", { exact: true }).inputValue()).toBe("Private retained operator context")
    expect(await panel.getByRole("region", { name: "Private proposal fields", exact: true }).getAttribute("data-dirty")).toBe("true")
    expect(await panel.getByRole("button", { name: "Save private draft", exact: true }).isEnabled()).toBe(false)
    expect(await page.locator('[data-sf-f01="denied"]').count()).toBe(0)

    const [retried] = await Promise.all([
      page.waitForResponse(modeResponse("dashboard-draft-read")),
      panel.getByRole("button", { name: "Load options", exact: true }).click(),
    ])
    expect(retried.status()).toBe(200)
    await panel.getByText("Options refreshed. Your form changes were retained.", { exact: false }).waitFor()
    expect(await panel.getByRole("button", { name: "Save private draft", exact: true }).isEnabled()).toBe(true)
    expect(await panel.getByLabel("Action", { exact: true }).inputValue()).toBe("Private retained operator action")

    const workbenchUrl = modeUrl("dashboard-workbench")
    const priorWrite = Promise.withResolvers<unknown>()
    const withdrawWrite = async (route: Route) => {
      try {
        const response = await route.fetch(), body: unknown = await response.json()
        expect(response.status()).toBe(200)
        // First admission completed with write authority. The second must admit
        // again under the real restricted policy before the consumer enables work.
        f.policy.writable = false
        await route.fulfill({ response })
        priorWrite.resolve(body)
      } catch (error) { priorWrite.reject(error); await route.abort().catch(() => {}) }
    }
    await page.route(workbenchUrl, withdrawWrite)
    const [prior, restricted] = await Promise.all([
      priorWrite.promise,
      page.waitForResponse(modeResponse("dashboard-draft-read")),
      panel.getByRole("button", { name: "Load options", exact: true }).click(),
    ])
    await page.unroute(workbenchUrl, withdrawWrite)
    expect(object(object(object(prior).value).decisions).permissions).toMatchObject({ draft: true })
    expect(restricted.status()).toBe(200)
    const restrictedValue = object(object(await restricted.json()).value)
    expect(restrictedValue.permissions).toMatchObject({ draft: false, prepare: false, apply: false, capture: false, preserve: false })
    const originalScope = object(object(restricted.request().postDataJSON()).targetEvidence)
    const currentScope = object(restrictedValue.currentSource)
    expect(restrictedValue.originalSource).toEqual({ refId: originalScope.refId, refDigest: originalScope.refDigest })
    expect(object(currentScope.target)).toMatchObject({ surface: "dashboard", recordType: "hotTopics", recordId: object(originalScope.target).recordId })
    expect(object(currentScope.target).incarnation).not.toBe(object(originalScope.target).incarnation)
    await panel.getByText(currentLoaded, { exact: true }).waitFor()
    expect(await panel.getByLabel(confirmationLabel, { exact: true }).isChecked()).toBe(false)
    expect(await panel.getByRole("button", { name: "Save private draft", exact: true }).isEnabled()).toBe(false)
    expect(await panel.getByLabel("Action", { exact: true }).isEnabled()).toBe(false)
    expect(await panel.getByLabel("Action", { exact: true }).inputValue()).toBe("Private retained operator action")
    expect(await panel.getByLabel("Notes", { exact: true }).inputValue()).toBe("Private retained operator context")
    await panel.getByRole("combobox", { name: "Record to preserve", exact: true }).selectOption({ label: "Original action" })
    expect(await panel.getByRole("button", { name: "Preserve snapshot", exact: true }).isEnabled()).toBe(false)
    expect(await page.locator('[data-sf-f01="denied"]').count()).toBe(0)
    const preferences = await f.authority.state.read(f.request(), "preferences", (state) => Object.keys(state.preferences).filter((key) => key.startsWith("sf:proposal-coverage:hot-topic:")))
    expect(preferences.status === "ok" && preferences.value).toEqual([])

    const beforeReadLoss = Promise.withResolvers<void>()
    const actualDenial = Promise.withResolvers<{ status: number; body: unknown }>()
    const observeDenial = async (route: Route) => {
      try {
        const response = await route.fetch(), body: unknown = await response.json()
        await route.fulfill({ response })
        actualDenial.resolve({ status: response.status(), body })
      } catch (error) { actualDenial.reject(error); await route.abort().catch(() => {}) }
    }
    const withdrawRead = async (route: Route) => {
      try {
        const response = await route.fetch()
        expect(response.status()).toBe(200)
        f.policy.readable = false
        await route.fulfill({ response })
        beforeReadLoss.resolve()
      } catch (error) { beforeReadLoss.reject(error); await route.abort().catch(() => {}) }
    }
    await page.route(workbenchUrl, withdrawRead)
    await page.route(readUrl, observeDenial)
    const [, revoked, denial] = await Promise.all([
      beforeReadLoss.promise,
      page.waitForResponse(modeResponse("dashboard-draft-read")),
      actualDenial.promise,
      panel.getByRole("button", { name: "Load options", exact: true }).click(),
    ])
    await page.unroute(workbenchUrl, withdrawRead)
    await page.unroute(readUrl, observeDenial)
    expect(revoked.status()).toBe(403)
    // Observe the genuine server body before forwarding it, then require the
    // actual F01 purge and a denied history navigation.
    expect(denial.status).toBe(403)
    expect(object(denial.body).status).toBe("denied")
    await page.locator('[data-sf-f01="denied"]').waitFor()
    expect(await page.getByRole("region", { name: "Private follow-up proposals", exact: true }).count()).toBe(0)
    expect(await page.locator("body").textContent()).not.toContain("Private retained operator")
    const browserState = await page.evaluate(() => history.state)
    expect(JSON.stringify(browserState)).not.toContain("Private retained operator")
    expect(JSON.stringify(browserState)).not.toContain("targetEvidence")
    expect(JSON.stringify(browserState)).not.toContain("idempotencyKey")
    await page.goBack()
    await page.locator('[data-sf-f01="denied"]').waitFor()
    expect(await page.getByRole("region", { name: "Private follow-up proposals", exact: true }).count()).toBe(0)
    expect(await page.locator("body").textContent()).not.toContain("Private retained operator")
    expect(errors).toEqual([])
  } catch (error) {
    failures.push(error)
    console.error("SF_DASHBOARD_CONSUMER_ACCESS_FAILURE", error)
    console.error("SF_DASHBOARD_CONSUMER_ACCESS_TRACE", JSON.stringify(f.httpTrace))
  } finally {
    for (const closed of await Promise.allSettled([driver.close(), f.close()])) if (closed.status === "rejected") failures.push(closed.reason)
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) throw new AggregateError(failures, "Dashboard interrupted read and cleanup failed")
  driver.report()
}, 60000)
