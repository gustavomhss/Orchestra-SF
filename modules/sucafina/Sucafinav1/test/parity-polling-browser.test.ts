import { test } from "bun:test"
import { expect, type Page, type Response } from "@playwright/test"
import { object } from "../runtime/contract.ts"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { createNativeDashboardFixture } from "./product/wp02/native-browser-fixture.ts"
import { launchBrowserDriver } from "./product/wp02/browser-driver-fixture.ts"

test("business polling reflects another session without replacing unsaved edits or overlapping requests", async () => {
  expectSpawn()
  const fixture = await createNativeDashboardFixture()
  let driver: Awaited<ReturnType<typeof launchBrowserDriver>> | undefined
  let page: Page | undefined
  const errors: string[] = []
  const held: { release?: () => void } = {}
  let phase = "browser"
  let failed: unknown
  try {
    driver = await launchBrowserDriver("wp05-renderer")
    const context = await driver.browser.newContext()
    await context.addCookies([fixture.cookie])
    page = await context.newPage()
    page.on("pageerror", (error) => errors.push(error.message))
    const url = fixture.origin + "/orchestra/sf-procurement/settings"
    const projection = fixture.origin + "/sucafina/api/ui/pages/CAP28"
    const isCommand = (response: Response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/sucafina/procurement"
    phase = "initial-settings"
    expect((await page.goto(url))?.ok()).toBe(true)
    const resetDetails = page.locator("details[data-sf-settings-reset]")
    await resetDetails.locator("summary").click()
    await resetDetails.getByRole("button", { name: "Reset settings", exact: true }).click()
    const [reset] = await Promise.all([
      page.waitForResponse(isCommand),
      page.getByRole("button", { name: "Reset settings", exact: true }).click(),
    ])
    expect(reset.status(), JSON.stringify(await reset.json())).toBe(200)
    await expect(page.locator(".sf-n21-settings-form")).toHaveAttribute("data-version", "1")
    await page.clock.install()
    await page.reload()
    phase = "other-session-save"
    const other = await context.newPage()
    other.on("pageerror", (error) => errors.push(error.message))
    await other.goto(url)
    await other.getByLabel("Currency", { exact: true }).fill("EUR")
    await other.getByRole("button", { name: "Review changes", exact: true }).click()
    const [response] = await Promise.all([
      other.waitForResponse(isCommand),
      other.getByRole("button", { name: "Save", exact: true }).click(),
    ])
    expect(response.status(), JSON.stringify(await response.json())).toBe(200)
    await expect(other.locator(".sf-n21-settings-form")).toHaveAttribute("data-version", "2")
    phase = "poll-clean"
    await page.bringToFront()
    await page.clock.runFor(30001)
    const currency = page.getByLabel("Currency", { exact: true })
    await expect(currency).toHaveValue("EUR")
    phase = "poll-dirty-after-blur"
    await currency.fill("CHF")
    await page.locator("h1").click()
    await page.clock.runFor(30001)
    await expect(currency).toHaveValue("CHF")
    const requests: string[] = []
    await page.route((url) => url.origin + url.pathname === projection, async (route) => {
      if (route.request().method() !== "GET") return route.continue()
      requests.push(route.request().url())
      if (requests.length > 1) return route.continue()
      // Retain the actual authorized response from before the save. Its release
      // must not certify the later POST or replace the retained local draft.
      const previous = await route.fetch()
      await new Promise<void>((resolve) => { held.release = resolve })
      await route.fulfill({ response: previous })
    })
    phase = "held-poll-and-coalesced-refresh"
    await page.clock.runFor(30001)
    await expect.poll(() => requests.length).toBe(1)
    await expect.poll(() => typeof held.release).toBe("function")
    await page.getByRole("button", { name: "Refresh settings", exact: true }).click()
    await page.getByRole("button", { name: "Refresh settings", exact: true }).click()
    await page.clock.runFor(1000)
    expect(requests).toHaveLength(1)
    phase = "save-before-held-read-release"
    await page.getByRole("button", { name: "Review changes", exact: true }).click()
    const [saved] = await Promise.all([
      page.waitForResponse(isCommand),
      page.getByRole("button", { name: "Save", exact: true }).click(),
    ])
    expect(saved.status(), JSON.stringify(await saved.json())).toBe(200)
    expect(requests).toHaveLength(1)
    held.release?.()
    phase = "queued-authoritative-read"
    await expect.poll(() => requests.length).toBe(2)
    await expect(currency).toHaveValue("CHF")
    await expect(page.locator(".sf-n21-settings-form")).toHaveAttribute("data-version", "3")
    const persisted = await fixture.persistence.transaction("procurement", async (snapshot) => ({
      commit: false, value: { settings: object(snapshot.data.store).settings, version: snapshot.versions.settings?.version },
    }))
    expect(persisted.version).toBe(3)
    expect(persisted.settings).toMatchObject({ currency: "CHF" })
    expect(errors).toEqual([])
    phase = "complete"
  } catch (error) {
    failed = error
    console.error("CAP28 parity browser failure", { phase, pageErrors: errors,
      url: page?.url(), editorCount: page ? await page.locator(".sf-n21-settings-form").count().catch(() => -1) : 0 }, error)
  } finally {
    held.release?.()
    const cleanup: unknown[] = []
    try { await page?.unrouteAll({ behavior: "wait" }) } catch (error) { cleanup.push(error) }
    try { await driver?.close() } catch (error) { cleanup.push(error) }
    try { await fixture.close() } catch (error) { cleanup.push(error) }
    if (cleanup.length) throw new AggregateError(failed === undefined ? cleanup : [failed, ...cleanup], "CAP28 parity body or cleanup failed")
  }
  if (failed !== undefined) throw failed
  if (!driver) throw new Error("CAP28 browser driver was not created")
  driver.report()
})
