import { test } from "bun:test"
import { expect } from "@playwright/test"
import { localBrowser } from "./fixture/local-browser.ts"

test("business polling reflects another session without replacing unsaved edits or overlapping requests", async () => {
  const fixture = await localBrowser()
  try {
    const page = fixture.page
    const url = "http://localhost:4110/sucafina/procurement?page=Settings"
    await page.goto(url)
    page.on("dialog", (dialog) => dialog.accept())
    await page.getByText("Reset settings", { exact: true }).first().click()
    const [reset] = await Promise.all([page.waitForResponse((response) => response.request().method() === "POST"), page.locator('form[data-command="reset"] button[type="submit"]').click()])
    expect(reset.status()).toBe(200)
    await page.clock.install()
    await page.reload()
    const other = await page.context().newPage()
    await other.goto(url)
    const save = other.locator('form[data-command="save"]')
    await save.locator('[name="currency"]').fill("EUR")
    const [response] = await Promise.all([
      other.waitForResponse((response) => response.request().method() === "POST"),
      save.locator('button[type="submit"]').click(),
    ])
    expect(response.status(), JSON.stringify(await response.json())).toBe(200)
    await page.bringToFront()
    await page.clock.runFor(30001)
    await expect(page.locator('form[data-command="save"] [name="currency"]')).toHaveValue("EUR")
    const currency = page.locator('form[data-command="save"] [name="currency"]')
    await currency.fill("CHF")
    await page.locator("h1").click()
    await page.clock.runFor(30001)
    await expect(currency).toHaveValue("CHF")
    const requests: string[] = []
    const held = { release: undefined as (() => void) | undefined }
    await page.route(url, async (route) => {
      if (route.request().method() !== "GET") return route.continue()
      requests.push(route.request().url())
      if (requests.length > 1) return route.continue()
      const previous = await route.fetch()
      await new Promise<void>((resolve) => { held.release = resolve })
      await route.fulfill({ response: previous }).catch(() => undefined)
    })
    await page.clock.runFor(30001)
    await expect.poll(() => requests.length).toBe(1)
    await page.evaluate(() => {
      const refresh = (window as unknown as { sucafinaRefresh: () => Promise<void> }).sucafinaRefresh
      void refresh(); void refresh()
    })
    await page.clock.runFor(1000)
    expect(requests).toHaveLength(1)
    const [saved] = await Promise.all([page.waitForResponse((response) => response.request().method() === "POST"), page.locator('form[data-command="save"] button[type="submit"]').click()])
    expect(saved.status(), JSON.stringify(await saved.json())).toBe(200)
    held.release?.()
    await expect.poll(() => requests.length).toBe(2)
    await expect(page.locator('form[data-command="save"] [name="currency"]')).toHaveValue("CHF")
    await page.unrouteAll({ behavior: "wait" })
    expect(fixture.errors).toEqual([])
  } finally { await fixture.dispose() }
})
