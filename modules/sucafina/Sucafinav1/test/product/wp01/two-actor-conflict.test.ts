import { afterAll, beforeAll, expect } from "bun:test"
import type { Browser, BrowserContext, Page } from "@playwright/test"
import { object } from "../../../runtime/contract.ts"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"
import { createMicrosoftComponentFixture } from "./microsoft-component-fixture.ts"

// Registered once by browser-selection.test.ts; importing this source registers no tests.
export function registerPoolTests(test: typeof import("bun:test").test) {
  let browser: Browser
  beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
  afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

  async function openDeviation(page: Page) {
    const month = page.locator('form[data-command="save-entry"][data-record="jan"]')
    await page.locator("tr").filter({ has: month }).getByRole("button", { name: "Edit", exact: true }).click()
    const form = page.locator('form[data-command="save-deviation"][data-record="owner-1"]').first()
    await form.locator("..").locator("summary").click()
    return form
  }

  // Each independent Chromium context follows real confidential Microsoft OAuth.
  // Both current principals share a Team and the same domain; no cookies are injected.
  test("two authenticated principals preserve the losing draft and reconcile a real version conflict only after explicit review", async () => {
    const host = await createMicrosoftComponentFixture({ names: ["First reviewer", "Second reviewer"] })
    const { origin, persistence } = host
    const firstId = host.principalRef, secondId = host.otherPrincipalRef
    const writes: { principal: string | undefined; version: unknown; status: number; text: unknown }[] = []
    host.routing.handle = async (request) => {
      const command = request.method === "POST" && new URL(request.url).pathname === "/sucafina/dashboard" ? object(await request.clone().json()) : {}
      const principal = command.action === "save-deviation" ? await host.identity.person(request) : undefined
      const response = await host.dispatch(request)
      if (command.action === "save-deviation") writes.push({ principal: principal?.id, version: command.version, status: response.status, text: object(command.values).text })
      return response
    }
    const contexts: BrowserContext[] = []
    let failure: unknown
    try {
      await persistence.initializeSources("dashboard")
      await persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.opexOwners = [{ id: "owner-1", name: "Operations", budget: 1200 }]
        snapshot.data.opexEntries = [{ id: "jan", ownerId: "owner-1", year: 2026, month: 1, budget: 100, actual: 25, forecast: 90 }]
        return { commit: true, value: undefined }
      })
      const firstContext = await host.newContext(browser)
      contexts.push(firstContext)
      const secondContext = await host.newContext(browser, host.otherPrincipalRef)
      contexts.push(secondContext)
      const firstPage = await firstContext.newPage()
      const secondPage = await secondContext.newPage()
      const errors: string[] = []
      for (const page of [firstPage, secondPage]) {
        page.setDefaultTimeout(10_000)
        page.on("pageerror", (error) => errors.push(error.message))
        page.on("dialog", (dialog) => dialog.accept())
      }
      await host.loginPage(firstPage)
      await host.loginPage(secondPage)
      const url = `${origin}/sucafina/dashboard?page=OPEX+Detail&year=2026`
      expect((await firstPage.goto(url))?.status()).toBe(200)
      expect((await secondPage.goto(url))?.status()).toBe(200)
      const firstForm = await openDeviation(firstPage)
      const secondForm = await openDeviation(secondPage)
      expect(await firstForm.getAttribute("data-version")).toBe("0")
      expect(await secondForm.getAttribute("data-version")).toBe("0")
      const firstText = "January forecast reviewed by the first operator."
      const secondText = "The second operator still needs supplier timing confirmed."
      await firstForm.getByLabel("Deviation notes").fill(firstText)
      await firstForm.getByLabel(/^Flag/).selectOption("dev-green")
      await secondForm.getByLabel("Deviation notes").fill(secondText)
      await secondForm.getByLabel(/^Flag/).selectOption("dev-amber")

      const firstSaved = firstPage.waitForResponse((response) => response.request().method() === "POST" && response.url() === url)
      await firstForm.getByRole("button", { name: "Save deviation", exact: true }).click()
      expect((await firstSaved).status()).toBe(200)
      await firstPage.getByRole("dialog", { name: "Edit record", exact: true }).waitFor({ state: "hidden" })
      const record = "deviations:opex-owner-1-2026-1"
      const afterFirst = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
      expect(afterFirst.versions[record]).toEqual({ version: 1, by: firstId })
      expect(object(afterFirst.data.deviations)["opex-owner-1-2026-1"]).toEqual({ flag: "dev-green", text: firstText })

      const conflict = secondPage.waitForResponse((response) => response.request().method() === "POST" && response.url() === url)
      await secondForm.getByRole("button", { name: "Save deviation", exact: true }).click()
      const rejected = await conflict
      expect(rejected.status()).toBe(409)
      expect(await rejected.json()).toMatchObject({ ok: false, by: firstId, stored: { flag: "dev-green", text: firstText } })
      await secondPage.getByText("This record changed since you opened it.", { exact: false }).waitFor()
      const conflictText = await secondPage.locator("dialog[open] [data-editor-status]").textContent()
      expect(conflictText).toContain(firstText)
      expect(conflictText).toContain(secondText)
      expect(await secondForm.getByLabel("Deviation notes").inputValue()).toBe(secondText)
      expect(await secondForm.getByLabel(/^Flag/).inputValue()).toBe("dev-amber")
      expect(await secondForm.getAttribute("data-version")).toBe("0")
      expect(await secondForm.getAttribute("data-dirty")).toBe("true")
      expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.audit.length }))).toBe(afterFirst.audit.length)

      await secondForm.getByRole("button", { name: "Load current version and keep my edits", exact: true }).click()
      await secondForm.getByText("Current record — review before saving your edits", { exact: true }).waitFor()
      expect(await secondForm.locator("[data-current-revision]").textContent()).toContain(firstText)
      expect(await secondForm.locator("[data-current-revision]").textContent()).toContain("dev-green")
      expect(await secondForm.getByLabel("Deviation notes").inputValue()).toBe(secondText)
      expect(await secondForm.getByLabel(/^Flag/).inputValue()).toBe("dev-amber")
      expect(await secondForm.getAttribute("data-version")).toBe("1")
      expect(writes).toEqual([
        { principal: firstId, version: 0, status: 200, text: firstText },
        { principal: secondId, version: 0, status: 409, text: secondText },
      ])
      expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.audit.length }))).toBe(afterFirst.audit.length)

      const reviewedSave = secondPage.waitForResponse((response) => response.request().method() === "POST" && response.url() === url)
      await secondForm.getByRole("button", { name: "Save deviation", exact: true }).click()
      expect((await reviewedSave).status()).toBe(200)
      await secondPage.getByRole("dialog", { name: "Edit record", exact: true }).waitFor({ state: "hidden" })
      const final = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
      expect(final.versions[record]).toEqual({ version: 2, by: secondId })
      expect(object(final.data.deviations)["opex-owner-1-2026-1"]).toEqual({ flag: "dev-amber", text: secondText })
      const history = final.audit.filter((entry) => entry.record === record)
      expect(history).toHaveLength(2)
      expect(history.map((entry) => ({ who: entry.who, name: entry.name }))).toEqual([{ who: firstId, name: "First reviewer" }, { who: secondId, name: "Second reviewer" }])
      expect(history[1]?.was).toEqual({ flag: "dev-green", text: firstText })
      expect(history[1]?.became).toEqual({ flag: "dev-amber", text: secondText })
      expect(writes).toHaveLength(3)
      expect(writes[2]).toEqual({ principal: secondId, version: 1, status: 200, text: secondText })
      expect(errors).toEqual([])
    } catch (error) { failure = error; throw error }
    finally {
      const closed = await Promise.allSettled(contexts.map((context) => context.close()))
      closed.push(...await Promise.allSettled([host.close()]))
      const failed = closed.filter((result): result is PromiseRejectedResult => result.status === "rejected")
      if (failed.length) throw new AggregateError([...(failure ? [failure] : []), ...failed.map((result) => result.reason)], "Two-actor component contexts did not close")
    }
  }, 60_000)
}
