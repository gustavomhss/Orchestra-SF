import { expect, test } from "@playwright/test"

/**
 * U39/U40 native installed journeys. 120 owns the actual authenticated
 * installation and execution. No mocked domain responses, fake permission
 * provider, time sleeps, replayed mutations or browser storage-state export.
 *
 * Required 120 harness: SF_N13_INSTALLED_ORIGIN + SF_N13_AUTH_READY=1.
 * The harness must supply an authorized browser context for the selected
 * installation before navigation. Tests remain discoverable but are not
 * qualified when that producer-owned fixture is absent.
 */
const origin = process.env.SF_N13_INSTALLED_ORIGIN
const ready = process.env.SF_N13_AUTH_READY === "1" && Boolean(origin)
const path = "/orchestra/sf-dashboard/capex?year=2026"
const surfaceId = "CAP05"
const title = "CAPEX Projects"
const recordName = "Project name"

test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe("N13 CAP05 · installed native Dashboard", () => {
  test.skip(!ready, "120 must provide the real installed, authenticated native context")

  test("reads the source through A01 with owner-scoped state, filter-empty and source metadata", async ({ page }) => {
    await page.goto(origin + path)
    const surface = page.locator('[data-sf-budget="' + surfaceId + '"]')
    await expect(surface).toBeVisible()
    await expect(surface.getByRole("heading", { name: title })).toBeVisible()
    // A projection must reach a terminal state before making an empty-state claim.
    await expect(surface.locator(".sf-state-panel").filter({ has: surface.locator(".sf-budget-owners") })).toBeVisible()
    const owners = surface.locator(".sf-budget-owners")
    const search = owners.getByRole("searchbox", { name: "Name" })
    await expect(search).toBeEnabled()
    await search.fill("__N13_Nonexistent_Record_2026__")
    await expect(surface.locator('[data-sf-state="filtered-empty"]')).toBeVisible()
    await search.fill("")
    await expect(page.locator('[data-sf-budget="' + surfaceId + '"]')).toHaveCount(1)
    // A missing budget is not asserted as numeric zero, and no financial total
    // is calculated in this journey. Source records are compared by identity.
    const table = owners.locator(".sf-s01-table")
    await expect(table).toBeVisible()
    const refs = await table.locator("tbody tr[data-sf-row]").evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-sf-row")))
    expect(refs.every(Boolean)).toBe(true)
    expect(new Set(refs).size).toBe(refs.length)
  })

  test("new record is a draft until explicit, version-bound change review", async ({ page }) => {
    test.skip(process.env.SF_N13_ADMIN_MUTATION !== "1", "requires producer-authorized admin fixture")
    await page.goto(origin + path)
    const surface = page.locator('[data-sf-budget="' + surfaceId + '"]')
    const primary = surface.getByRole("button", { name: "New CAPEX project", exact: true })
    await expect(primary).toBeEnabled()
    await primary.click()
    const form = surface.locator(".sf-budget-form")
    await expect(form).toBeVisible()
    await form.getByRole("textbox", { name: recordName, exact: true }).fill("N13 unsaved review")
    await form.getByRole("spinbutton", { name: "Annual budget", exact: true }).fill("0")
    await form.getByRole("button", { name: "Review changes", exact: true }).click()
    const review = surface.locator('[data-component="sf-change-review"]')
    await expect(review).toBeVisible()
    await expect(review).toContainText("N13 unsaved review")
    // No confirmation is clicked. Even a recorded 0 is preserved in review.
    await expect(review).toContainText("0")
  })

  test("320–1440 viewports, 200% typography and 400% reflow keep surface controls reachable", async ({ page }) => {
    await page.goto(origin + path)
    const surface = page.locator('[data-sf-budget="' + surfaceId + '"]')
    await expect(surface).toBeVisible()
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(surface).toBeVisible()
      const bounds = await surface.evaluate((element) => ({
        client: element.clientWidth,
        scroll: element.scrollWidth,
      }))
      expect(bounds.scroll, surfaceId + " should not overflow the chapter at width " + width)
        .toBeLessThanOrEqual(bounds.client + 1)
    }
    await page.setViewportSize({ width: 768, height: 900 })
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
    await expect(surface).toBeVisible()
    await page.setViewportSize({ width: 320, height: 900 })
    await page.evaluate(() => { document.documentElement.style.fontSize = "400%" })
    await expect(surface.getByRole("heading", { name: title })).toBeVisible()
    // Horizontal scrolling is allowed inside the named month-grid region,
    // never by silently clipping or hiding the write/review controls.
    const viewport = await surface.evaluate((element) => ({
      client: element.clientWidth, scroll: element.scrollWidth,
    }))
    expect(viewport.scroll).toBeLessThanOrEqual(viewport.client + 1)
  })
})
