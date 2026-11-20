import { afterAll, beforeAll, expect } from "bun:test"
import type { Browser, BrowserContext, Page } from "@playwright/test"
import { object, rows } from "../../../runtime/contract.ts"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"
import { createMicrosoftComponentFixture } from "./microsoft-component-fixture.ts"

// Registered once by browser-selection.test.ts; importing this source registers no tests.
export function registerPoolTests(test: typeof import("bun:test").test) {
  let browser: Browser
  beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
  afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

  async function withWorkbench(check: (fixture: {
    page: Page
    context: BrowserContext
    origin: string
    url: string
    persistence: Awaited<ReturnType<typeof createMicrosoftComponentFixture>>["persistence"]
    delivery: { loseNextSave: boolean; posts: number }
  }) => Promise<void>) {
    const host = await createMicrosoftComponentFixture({ names: ["Refresh reviewer", "Other reviewer"] })
    const { origin, persistence } = host
    const delivery = { loseNextSave: false, posts: 0 }
    host.routing.handle = async (request) => {
      const command = request.method === "POST" && new URL(request.url).pathname === "/sucafina/dashboard" ? object(await request.clone().json()) : {}
      if (command.action === "save-deviation") delivery.posts++
      const response = await host.dispatch(request)
      // Only delivery is damaged, after the real authenticated mutation commits.
      if (command.action === "save-deviation" && delivery.loseNextSave && response.ok) {
        delivery.loseNextSave = false
        return new Response("{", { headers: { "Content-Type": "application/json" } })
      }
      return response
    }
    let context: BrowserContext | undefined
    let failure: unknown
    try {
      await persistence.initializeSources("dashboard")
      await persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.opexOwners = [{ id: "owner-1", name: "Operations", budget: 1200 }]
        snapshot.data.opexEntries = [{ id: "jan", ownerId: "owner-1", year: 2026, month: 1, budget: 100, actual: 25, forecast: 90 }]
        return { commit: true, value: undefined }
      })
      context = await host.newContext(browser)
      const page = await context.newPage()
      const errors: string[] = []
      page.setDefaultTimeout(10_000)
      page.on("pageerror", (error) => errors.push(error.message))
      page.on("dialog", (dialog) => dialog.accept())
      expect((await host.loginPage(page))?.status()).toBe(200)
      const url = `${origin}/sucafina/dashboard?page=OPEX+Detail&year=2026`
      expect((await page.goto(url))?.status()).toBe(200)
      // Observe the shell's event without claiming it or installing a replacement
      // BI consumer. Retention plus authorized BI re-read belongs to WP10's test.
      await page.evaluate(() => {
        document.documentElement.dataset.refreshObservations = "[]"
        document.addEventListener("sucafina:main-refresh", (event) => {
          const observations = JSON.parse(document.documentElement.dataset.refreshObservations || "[]")
          observations.push({ page: event.target instanceof HTMLElement ? event.target.dataset.page : null,
            cancelable: event.cancelable, bubbles: event.bubbles, detail: event instanceof CustomEvent ? event.detail : null })
          document.documentElement.dataset.refreshObservations = JSON.stringify(observations)
        }, { capture: true })
      })
      await check({ page, context, origin, url, persistence, delivery })
      expect(errors).toEqual([])
    } catch (error) { failure = error; throw error }
    finally {
      const failures: unknown[] = []
      try { await context?.close() } catch (error) { failures.push(error) }
      try { await host.close() } catch (error) { failures.push(error) }
      if (failures.length) throw new AggregateError([...(failure ? [failure] : []), ...failures], "Shell component fixture cleanup failed")
    }
  }

  async function observations(page: Page) {
    return page.evaluate(() => JSON.parse(document.documentElement.dataset.refreshObservations || "[]"))
  }

  async function refresh(page: Page) {
    await page.evaluate(() => (window as unknown as { sucafinaRefresh: () => Promise<void> }).sucafinaRefresh())
  }

  async function openMonthly(page: Page) {
    const form = page.locator('form[data-command="save-entry"][data-record="jan"]')
    await page.locator("tr").filter({ has: form }).getByRole("button", { name: "Edit", exact: true }).click()
    await form.locator("..").locator("summary").click()
    return form
  }

  test("the real 30-second refresh authorizes the page, offers the lifecycle event and replaces unclaimed content", async () => {
    await withWorkbench(async (fixture) => {
      const old = await fixture.page.locator("main").elementHandle()
      expect(old).not.toBeNull()
      await fixture.persistence.transaction("dashboard", async (snapshot) => {
        rows(snapshot.data.opexEntries)[0]!.budget = 321
        return { commit: true, value: undefined }
      })
      const periodic = await fixture.page.waitForResponse((response) => response.url() === fixture.url && response.request().method() === "GET", { timeout: 35_000 })
      expect(periodic.status()).toBe(200)
      await fixture.page.waitForFunction(() => document.querySelector<HTMLInputElement>('form[data-command="save-entry"][data-record="jan"] input[name="budget"]')?.value === "321")
      expect(await observations(fixture.page)).toEqual([{ page: "OPEX Detail", cancelable: true, bubbles: false, detail: null }])
      expect(await old!.evaluate((element) => element.isConnected)).toBe(false)
      await old!.dispose()
      await refresh(fixture.page)
      expect(await observations(fixture.page)).toHaveLength(2)
      const form = await openMonthly(fixture.page)
      expect(await form.getByLabel("Budget", { exact: true }).inputValue()).toBe("321")
      expect(fixture.delivery.posts).toBe(0)
    })
  }, 45_000)

  test("dirty forms block the lifecycle handoff while real logout still purges the authorized page", async () => {
    await withWorkbench(async (fixture) => {
      const form = await openMonthly(fixture.page)
      await form.getByLabel("Budget", { exact: true }).fill("222")
      await refresh(fixture.page)
      expect(await observations(fixture.page)).toEqual([])
      expect(await form.getByLabel("Budget", { exact: true }).inputValue()).toBe("222")
      expect(await form.getAttribute("data-dirty")).toBe("true")
      expect((await fixture.context.request.post(`${fixture.origin}/sucafina/auth/logout`, { headers: { origin: fixture.origin } })).status()).toBe(204)
      await refresh(fixture.page)
      await fixture.page.getByRole("heading", { name: "Your session has expired" }).waitFor()
      expect(await observations(fixture.page)).toEqual([])
      expect(await fixture.page.locator("form, input, dialog").count()).toBe(0)
      expect(await fixture.page.locator("main[data-access-unavailable]").count()).toBe(1)
      expect(fixture.delivery.posts).toBe(0)
    })
  }, 30_000)

  test("a committed save with lost delivery cannot hand its uncertain form to a page refresh or replay it", async () => {
    await withWorkbench(async (fixture) => {
      await openMonthly(fixture.page)
      const form = fixture.page.locator('form[data-command="save-deviation"][data-record="owner-1"]').first()
      await form.locator("..").locator("summary").click()
      await form.getByLabel("Deviation notes").fill("PRIVATE-REFRESH-ATTEMPT")
      fixture.delivery.loseNextSave = true
      await form.getByRole("button", { name: "Save deviation", exact: true }).click()
      await fixture.page.getByText("The save response was lost or could not be verified.", { exact: false }).waitFor()
      await form.getByLabel("Deviation notes").fill("PRIVATE-LATER-EDIT")
      await refresh(fixture.page)
      expect(await observations(fixture.page)).toEqual([])
      expect(await form.getAttribute("data-result-uncertain")).toBe("true")
      expect(await form.getByLabel("Deviation notes").inputValue()).toBe("PRIVATE-LATER-EDIT")
      expect(fixture.delivery.posts).toBe(1)
      const snapshot = await fixture.persistence.transaction("dashboard", async (stored) => ({ commit: false, value: structuredClone(stored) }))
      expect(object(snapshot.data.deviations)["opex-owner-1-2026-1"]).toMatchObject({ text: "PRIVATE-REFRESH-ATTEMPT" })
      expect(snapshot.versions["deviations:opex-owner-1-2026-1"]?.version).toBe(1)
      expect(snapshot.audit.filter((entry) => entry.record === "deviations:opex-owner-1-2026-1")).toHaveLength(1)
    })
  }, 30_000)
}
