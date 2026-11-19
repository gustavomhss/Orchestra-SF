import { expect, test, type Locator, type Page, type Response, type Route } from "@playwright/test"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical"
import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
import { createProposalInstallation, enterProposalShell, withProposalHost } from "../proposals-support/installation"
import type { ProposalObservation } from "../proposals-support/protocol"

test.use({ trace: "off", screenshot: "off", video: "off" })
const currentLoaded = "Current proposal and source loaded. Review both before saving."
const retainedMessage = "Current options loaded. Your edits were retained."
const savedMessage = "The original producer saved this private proposal."
const confirmationLabel = "I reviewed the current proposal and source; keep my values against this base."
const reloadLabel = "Load current version and keep my edits"
const modeResponse = (mode: string) => (response: Response) => response.request().method() === "POST" &&
  new URL(response.url()).pathname === "/sucafina/dashboard" && new URL(response.url()).searchParams.get("sf") === mode
const modeUrl = (mode: string) => (url: URL) => url.pathname === "/sucafina/dashboard" && url.searchParams.get("sf") === mode

async function openProposal(page: Page, origin: string, reference = "new") {
  if (reference === "new") {
    expect((await page.goto(origin + "/orchestra/sf-dashboard/hot-topics?year=2026"))?.status()).toBe(200)
    const create = page.getByRole("button", { name: "New private proposal", exact: true })
    await expect(create).toBeEnabled()
    const [response] = await Promise.all([
      page.waitForResponse(modeResponse("dashboard-workbench")), create.click(),
    ])
    expect(response.status()).toBe(200)
    expect(object(await response.json()).status).toBe("ok")
  } else {
    const [response] = await Promise.all([
      page.waitForResponse(modeResponse("dashboard-workbench")),
      page.goto(origin + "/orchestra/sf-dashboard/hot-topics/proposals/" + encodeSfRouteRef(reference)),
    ])
    expect(response.status()).toBe(200)
    expect(object(await response.json()).status).toBe("ok")
  }
  const panel = page.locator("[data-sf-private-proposal]")
  await expect(panel).toBeVisible()
  await expect(panel).not.toContainText("Unrelated confidential case")
  return panel
}
async function chooseNew(panel: Locator) {
  await panel.getByLabel("Select case", { exact: true }).selectOption({ label: "Review the action" })
  await panel.getByLabel("Select source record", { exact: true }).selectOption({ label: "Original action" })
}
async function saveDraft(page: Page, panel: Locator) {
  const [written, discovered] = await Promise.all([
    page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
    page.waitForResponse(modeResponse("dashboard-workbench")),
    panel.getByRole("button", { name: "Save proposal", exact: true }).click(),
  ])
  expect(written.status()).toBe(200)
  expect(object(await written.json()).status).toBe("ok")
  expect(discovered.status()).toBe(200)
  expect(object(await discovered.json()).status).toBe("ok")
  await expect(panel.getByText(savedMessage, { exact: true })).toBeVisible()
  return written.request().postDataJSON() as Record<string, unknown>
}
function onlyDraft(observation: ProposalObservation) {
  expect(observation.preferences.status).toBe("ok")
  expect(observation.preferences.value?.drafts).toHaveLength(1)
  const draft = observation.preferences.value?.drafts[0]
  if (!draft) throw new Error("Original C08 private draft unavailable")
  return draft
}

async function expectPreservationWithdrawn(page: Page, origin: string) {
  expect((await page.goto(origin + "/orchestra/sf-reviews/agenda?year=2026"))?.status()).toBe(200)
  const agenda = page.locator('[data-sf-surface="UI47"]')
  await expect(agenda).toBeVisible()
  await agenda.getByLabel("Source dashboard page", { exact: true }).fill("Hot Topics & Actions")
  const found = page.waitForResponse((response) => response.request().method() === "GET" &&
    new URL(response.url()).pathname.endsWith("/api/ui/projections/review") &&
    new URL(response.url()).searchParams.get("page") === "Hot Topics & Actions")
  await agenda.getByRole("button", { name: "Find authorized sections", exact: true }).click()
  const discovery = await found
  expect(discovery.status()).toBe(200)
  const discovered = object(await discovery.json())
  expect(discovered.status).toBe("ok")
  expect(object(discovered.value).items).toHaveLength(1)
  await agenda.getByRole("button", { name: "Add to agenda", exact: true }).click()
  const selected = agenda.locator('[data-sf-agenda-order] [data-sf-record-id="topic"]')
  await expect(selected).toHaveCount(1)
  await expect(selected).toContainText("Original action")
  const pending = page.waitForResponse(modeResponse("dashboard-agenda"))
  await page.getByRole("button", { name: "Review selected sections", exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  const preview = object(await response.json())
  expect(preview.status).toBe("ok")
  const sections = object(preview.value).sections
  expect(sections).toHaveLength(1)
  expect(object((sections as unknown[])[0]).recordCount).toBe(1)
  const shown = agenda.locator("[data-sf-agenda-preview]")
  await expect(shown).toContainText("Original action")
  await expect(shown.getByRole("button", { name: "Confirm preservation", exact: true })).toBeDisabled()
}

// Ports the original consumer-read journeys intact to the installed chapter.
// Every success, conflict and denial comes from the real producer and SQLite.
test("Dashboard reads the current source and active private proposal while preserving dirty values until explicit review", async ({ browser }, info) => {
  const installation = await createProposalInstallation(), errors: string[] = []
  try {
    await withProposalHost(installation, info, async (host) => {
      const context = await browser.newContext()
      context.setDefaultTimeout(10000)
      context.setDefaultNavigationTimeout(15000)
      try {
        const page = await context.newPage()
        page.on("pageerror", (error) => errors.push(error.message))
        await enterProposalShell(page, installation, host)
        const panel = await openProposal(page, installation.origin)
        await chooseNew(panel)
        await panel.getByLabel("Action", { exact: true }).fill("Initially saved proposal")
        await panel.getByLabel("Notes", { exact: true }).fill("Initially saved private context")
        await saveDraft(page, panel)
        const initial = onlyDraft(await host.control())
        const original = structuredClone(initial)
        await panel.getByLabel("Action", { exact: true }).fill("My retained action")
        await panel.getByLabel("Notes", { exact: true }).fill("My retained explanation")

        const other = await context.newPage()
        other.on("pageerror", (error) => errors.push(error.message))
        const otherPanel = await openProposal(other, installation.origin, original.draftRef)
        await otherPanel.getByLabel("Action", { exact: true }).fill("Active proposal from another page")
        await otherPanel.getByLabel("Notes", { exact: true }).fill("Current private proposal context")
        const secondWrite = await saveDraft(other, otherPanel)
        expect(secondWrite.expectedVersion).toBe(1)

        const [stale] = await Promise.all([
          page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
          panel.getByRole("button", { name: "Save proposal", exact: true }).click(),
        ])
        expect(stale.status()).toBe(409)
        expect(stale.request().postDataJSON()).toMatchObject({
          draftRef: original.draftRef, expectedVersion: 1, targetEvidence: original.targetEvidence,
        })
        await expect(panel.getByText("This topic changed. Review the current version before saving.", { exact: true })).toBeVisible()

        const activeKey = "sf:proposal-coverage:hot-topic:active:" + digestSfValue(original.id)
        const observation = await host.control()
        expect(observation.preferences.value?.keys).toContain(activeKey)
        const active = onlyDraft(observation)
        expect(active).toMatchObject({ id: original.id, incarnation: original.incarnation, version: 2,
          fields: { action: "Active proposal from another page", notes: "Current private proposal context" } })
        const changed = await page.request.post(installation.origin + "/sucafina/dashboard", {
          headers: { origin: installation.origin }, data: {
            page: "Hot Topics & Actions", action: "save", id: "topic", version: 0,
            values: { action: "Current materially changed source", notes: "Current source context" },
          },
        })
        expect(changed.status()).toBe(200)
        expect(object(await changed.json()).ok).toBe(true)

        const [discovered, checked] = await Promise.all([
          page.waitForResponse(modeResponse("dashboard-workbench")),
          page.waitForResponse(modeResponse("dashboard-draft-read")),
          panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
        ])
        expect(discovered.status()).toBe(200)
        expect(checked.status()).toBe(200)
        expect(checked.request().postDataJSON()).toEqual({
          caseRef: original.caseRef, targetEvidence: original.targetEvidence, draftRef: original.draftRef,
        })
        const checkedBody = object(await checked.json())
        expect(checkedBody.status).toBe("ok")
        const current = object(checkedBody.value), proposal = object(current.draft)
        expect(current.originalSource).toEqual({ refId: original.targetEvidence.refId, refDigest: original.targetEvidence.refDigest })
        expect(current.currentSource).not.toEqual(original.targetEvidence)
        expect(proposal).toMatchObject({ id: original.id, incarnation: original.incarnation, version: 2,
          fields: { action: "Active proposal from another page", notes: "Current private proposal context" } })
        expect(object(object(current.source).draft).fields).toMatchObject({
          action: "Current materially changed source", notes: "Current source context",
        })
        await expect(panel.getByText(currentLoaded, { exact: true })).toBeVisible()
        const tables = panel.locator("[data-sf-proposal-comparison] table")
        await expect(tables).toHaveCount(2)
        expect(await tables.nth(0).locator("th").allTextContents()).toEqual(["Field", "Original fields", "Current proposal", "My retained values"])
        expect(await tables.nth(0).getByRole("row").filter({ has: page.getByRole("cell", { name: "Action", exact: true }) }).locator("td").allTextContents())
          .toEqual(["Action", "Initially saved proposal", "Active proposal from another page", "My retained action"])
        expect(await tables.nth(1).locator("th").allTextContents()).toEqual(["Field", "Current authorized source"])
        await expect(tables.nth(1)).toContainText("Current materially changed source")
        await expect(panel.getByLabel("Notes", { exact: true })).toHaveValue("My retained explanation")
        await expect(panel.getByLabel(confirmationLabel, { exact: true })).not.toBeChecked()
        await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeDisabled()
        expect(onlyDraft(await host.control())).toEqual(active)

        await panel.getByLabel(confirmationLabel, { exact: true }).check()
        const reviewedWrite = await saveDraft(page, panel)
        expect(reviewedWrite.expectedVersion).toBe(2)
        expect(reviewedWrite.draftRef).toBe(proposal.draftRef)
        expect(reviewedWrite.targetEvidence).toEqual(current.currentSource)
        expect(reviewedWrite.sourceRefs).toEqual([current.currentSource])
        const latest = await host.control()
        expect(onlyDraft(latest)).toMatchObject({ id: original.id, incarnation: original.incarnation, version: 3,
          fields: { action: "My retained action", notes: "My retained explanation" }, targetEvidence: current.currentSource })
        expect(latest.record).toMatchObject({ action: "Current materially changed source", notes: "Current source context" })
        expect(initial).toEqual(original)
        expect(errors).toEqual([])
      } finally { await context.close() }
    })
  } finally { await installation.dispose() }
})

test("Dashboard keeps dirty values through interrupted reads and fences write withdrawal between admissions before purging actual read loss", async ({ browser }, info) => {
  const installation = await createProposalInstallation(), errors: string[] = []
  try {
    await withProposalHost(installation, info, async (host) => {
      const context = await browser.newContext()
      context.setDefaultTimeout(10000)
      context.setDefaultNavigationTimeout(15000)
      try {
        const page = await context.newPage()
        page.on("pageerror", (error) => errors.push(error.message))
        await enterProposalShell(page, installation, host)
        const panel = await openProposal(page, installation.origin)
        await chooseNew(panel)
        await panel.getByLabel("Action", { exact: true }).fill("Private retained operator action")
        await panel.getByLabel("Notes", { exact: true }).fill("Private retained operator context")
        await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeEnabled()
        const readUrl = modeUrl("dashboard-draft-read")
        const interrupted = Promise.withResolvers<{ status: number; body: unknown }>()
        const abortRead = async (route: Route) => {
          try {
            const response = await route.fetch({ maxRetries: 0 }), body: unknown = await response.json()
            await route.abort("aborted")
            interrupted.resolve({ status: response.status(), body })
            await response.dispose()
          } catch (error) { interrupted.reject(error); await route.abort().catch(() => {}) }
        }
        await page.route(readUrl, abortRead)
        const [observed] = await Promise.all([
          interrupted.promise, panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
        ])
        expect(observed.status).toBe(200)
        expect(object(observed.body).status).toBe("ok")
        await expect(panel.getByRole("button", { name: reloadLabel, exact: true })).toBeEnabled()
        await page.unroute(readUrl, abortRead)
        await expect(panel.getByLabel("Action", { exact: true })).toHaveValue("Private retained operator action")
        await expect(panel.getByLabel("Notes", { exact: true })).toHaveValue("Private retained operator context")
        await expect(panel).toHaveAttribute("data-dirty", "true")
        await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeDisabled()
        await expect(panel.getByText("Access to this private proposal was withdrawn. Its local values were cleared.", { exact: true })).toHaveCount(0)

        const [retried] = await Promise.all([
          page.waitForResponse(modeResponse("dashboard-draft-read")),
          panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
        ])
        expect(retried.status()).toBe(200)
        await expect(panel.getByText(retainedMessage, { exact: true })).toBeVisible()
        await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeEnabled()
        await expect(panel.getByLabel("Action", { exact: true })).toHaveValue("Private retained operator action")

        const workbenchUrl = modeUrl("dashboard-workbench")
        const priorWrite = Promise.withResolvers<unknown>()
        const withdrawWrite = async (route: Route) => {
          try {
            const response = await route.fetch({ maxRetries: 0 }), body: unknown = await response.json()
            expect(response.status()).toBe(200)
            await host.control("withdraw-write")
            await route.fulfill({ response })
            priorWrite.resolve(body)
            await response.dispose()
          } catch (error) { priorWrite.reject(error); await route.abort().catch(() => {}) }
        }
        await page.route(workbenchUrl, withdrawWrite)
        const [prior, restricted] = await Promise.all([
          priorWrite.promise, page.waitForResponse(modeResponse("dashboard-draft-read")),
          panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
        ])
        await page.unroute(workbenchUrl, withdrawWrite)
        expect(object(object(object(prior).value).decisions).permissions).toMatchObject({ draft: true })
        expect(restricted.status()).toBe(200)
        const restrictedValue = object(object(await restricted.json()).value)
        expect(restrictedValue.permissions).toMatchObject({ draft: false, prepare: false, apply: false, capture: false, preserve: false })
        await expect(panel.getByText(retainedMessage, { exact: true })).toBeVisible()
        await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeDisabled()
        await expect(panel.getByLabel("Action", { exact: true })).toBeDisabled()
        await expect(panel.getByLabel("Action", { exact: true })).toHaveValue("Private retained operator action")
        await expect(panel.getByLabel("Notes", { exact: true })).toHaveValue("Private retained operator context")
        const preservedRecord = await context.newPage()
        preservedRecord.on("pageerror", (error) => errors.push(error.message))
        await expectPreservationWithdrawn(preservedRecord, installation.origin)
        await preservedRecord.close()
        const preferences = (await host.control()).preferences
        expect(preferences.status).toBe("ok")
        expect(preferences.value?.keys).toEqual([])
        await expect(panel.getByText("Access to this private proposal was withdrawn. Its local values were cleared.", { exact: true })).toHaveCount(0)

        const beforeReadLoss = Promise.withResolvers<void>()
        const actualDenial = Promise.withResolvers<{ status: number; body: unknown }>()
        const observeDenial = async (route: Route) => {
          try {
            const response = await route.fetch({ maxRetries: 0 }), body: unknown = await response.json()
            await route.fulfill({ response })
            actualDenial.resolve({ status: response.status(), body })
            await response.dispose()
          } catch (error) { actualDenial.reject(error); await route.abort().catch(() => {}) }
        }
        const withdrawRead = async (route: Route) => {
          try {
            const response = await route.fetch({ maxRetries: 0 })
            expect(response.status()).toBe(200)
            await host.control("withdraw-read")
            await route.fulfill({ response })
            beforeReadLoss.resolve()
            await response.dispose()
          } catch (error) { beforeReadLoss.reject(error); await route.abort().catch(() => {}) }
        }
        await page.route(workbenchUrl, withdrawRead)
        await page.route(readUrl, observeDenial)
        const [, revoked, denial] = await Promise.all([
          beforeReadLoss.promise, page.waitForResponse(modeResponse("dashboard-draft-read")), actualDenial.promise,
          panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
        ])
        await page.unroute(workbenchUrl, withdrawRead)
        await page.unroute(readUrl, observeDenial)
        expect(revoked.status()).toBe(403)
        expect(denial.status).toBe(403)
        expect(object(denial.body).status).toBe("denied")
        expect(JSON.stringify(denial.body)).not.toContain("Private retained operator")
        await expect(panel.getByText(
          "Access to this private proposal was withdrawn. Its local values were cleared.", { exact: true })).toBeVisible()
        await expect(panel.locator("input, textarea, select")).toHaveCount(0)
        await expect(page.locator("body")).not.toContainText("Private retained operator")
        const browserState = await page.evaluate(() => JSON.stringify({
          history: history.state, local: { ...localStorage }, session: { ...sessionStorage },
        }))
        expect(browserState).not.toContain("Private retained operator action")
        expect(browserState).not.toContain("Private retained operator context")
        expect(errors).toEqual([])
      } finally { await context.close() }
    })
  } finally { await installation.dispose() }
})

test("Dashboard contextual draft retains edits when current write authority is withdrawn", async ({ browser }, info) => {
  const installation = await createProposalInstallation(), errors: string[] = []
  try {
    await withProposalHost(installation, info, async (host) => {
      const context = await browser.newContext()
      context.setDefaultTimeout(10000)
      context.setDefaultNavigationTimeout(15000)
      try {
        const page = await context.newPage()
        page.on("pageerror", (error) => errors.push(error.message))
        await enterProposalShell(page, installation, host)
        const panel = await openProposal(page, installation.origin)
        await chooseNew(panel)
        await panel.getByLabel("Action", { exact: true }).fill("Unsaved operator wording")
        await host.control("withdraw-write")
        const [rejected] = await Promise.all([
          page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
          panel.getByRole("button", { name: "Save proposal", exact: true }).click(),
        ])
        expect(rejected.status()).toBe(403)
        expect(object(await rejected.json()).status).toBe("denied")
        await expect(panel.getByText("Reading is available. The current authority does not permit saving this proposal.", { exact: true })).toBeVisible()
        await expect(panel.getByLabel("Action", { exact: true })).toHaveValue("Unsaved operator wording")
        await expect(panel).toHaveAttribute("data-dirty", "true")
        const [read] = await Promise.all([
          page.waitForResponse(modeResponse("dashboard-draft-read")),
          panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
        ])
        expect(read.status()).toBe(200)
        await expect(panel.getByText(retainedMessage, { exact: true })).toBeVisible()
        await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeDisabled()
        await expect(panel.getByLabel("Action", { exact: true })).toHaveValue("Unsaved operator wording")
        const preservedRecord = await context.newPage()
        preservedRecord.on("pageerror", (error) => errors.push(error.message))
        await expectPreservationWithdrawn(preservedRecord, installation.origin)
        await preservedRecord.close()
        const state = await host.control()
        expect(state.preferences.status).toBe("ok")
        expect(state.preferences.value?.keys).toEqual([])
        const forged = await page.request.post(installation.origin + "/sucafina/dashboard?sf=dashboard-capture", {
          headers: { origin: installation.origin, "idempotency-key": "forged-after-withdrawal" },
          data: { sourceRef: "not-a-grant" },
        })
        expect(forged.status()).toBe(403)
        expect(state.record.action).toBe("Original action")
        expect((await host.control()).record.action).toBe("Original action")
        expect(errors).toEqual([])
      } finally { await context.close() }
    })
  } finally { await installation.dispose() }
})
