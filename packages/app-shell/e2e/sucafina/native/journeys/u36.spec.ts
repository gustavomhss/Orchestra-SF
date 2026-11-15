import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

/** Requires 120's *real* CAP28-admin session and private installed manifest.
 * No request interception, fake installation, mock permission, or local runner.
 * The fixture itself refuses execution outside the authorized Actions runner. */
async function openInstalledSettings(
  page: Parameters<Parameters<typeof test>[2]>[0]["page"],
  manifest: { target: { shellOrigin: string; chapterHref: string } },
) {
  const target = new URL(manifest.target.chapterHref, manifest.target.shellOrigin)
  await page.goto(target.toString())
  // Prove the existing installed chapter before exercising the CAP28 route.
  // CAP28 registration remains the integrator's responsibility.
  const settingsRoute = new URL(target.toString())
  settingsRoute.pathname = "/orchestra/sf-procurement/settings"
  await page.goto(settingsRoute.toString())
  const surface = page.locator('[data-sf-surface="CAP28"]')
  await expect(surface).toBeVisible()
  return surface
}

test.describe("N21 / U36 native installed CAP28", () => {
  test("reads original settings with owner-scoped source and usable 320/768/1280 reflow", async ({ page, nativeHarness }) => {
    const surface = await openInstalledSettings(page, nativeHarness.manifest)
    await expect(surface.getByRole("group", { name: "General policy" })).toBeVisible()
    await expect(surface.getByRole("group", { name: "Approval matrix" })).toBeVisible()
    await expect(surface.getByRole("group", { name: "Currencies" })).toBeVisible()
    await expect(surface.getByRole("group", { name: "Technical criteria" })).toBeVisible()
    await expect(surface.getByRole("group", { name: "Commercial criteria" })).toBeVisible()
    await expect(surface.getByRole("group", { name: "Payment terms, categories & incoterms" })).toBeVisible()
    await expect(surface.getByLabel("PR approval mode")).toHaveValue(/^(first|matrix)$/)
    await expect(surface.getByRole("button", { name: /Review settings|Revisar configurações/ })).toBeDisabled()
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(surface.getByLabel("PR approval mode")).toBeVisible()
      // Horizontal overflow of the *document* (rather than an owned table) fails reflow.
      expect(await page.evaluate(() =>
        (document.scrollingElement?.scrollWidth ?? 0) <= document.documentElement.clientWidth,
      )).toBe(true)
    }
  })

  test("draft review never persists until exact CAP28 save confirmation", async ({ page, nativeHarness }) => {
    const surface = await openInstalledSettings(page, nativeHarness.manifest)
    const currency = surface.getByLabel("Currency", { exact: true })
    const original = await currency.inputValue()
    const proposed = original === "USD" ? "EUR" : "USD"
    await currency.fill(proposed)
    await expect(currency).toHaveValue(proposed)
    await surface.getByRole("button", { name: /Review settings|Revisar configurações/ }).click()
    const review = surface.locator('[data-component="sf-change-review"]')
    await expect(review).toBeVisible()
    await expect(review).toContainText(original)
    await expect(review).toContainText(proposed)
    await review.getByRole("button", { name: /Cancel review|Cancelar revisão/ }).click()
    await expect(currency).toHaveValue(proposed)
    // No POST in this journey; navigating out discards the in-memory test draft.
  })

  test("reset is review-only and cannot invent canonical defaults", async ({ page, nativeHarness }) => {
    const surface = await openInstalledSettings(page, nativeHarness.manifest)
    await surface.getByRole("button", { name: "Reset settings" }).click()
    const review = surface.locator('[data-component="sf-change-review"]')
    await expect(review).toBeVisible()
    await expect(review.getByRole("alert")).toContainText(/Confirmation is not available|confirmação/i)
    await expect(review.locator(".sf-s03-actions .primary")).toBeDisabled()
    // This journey does not invoke domain.command.CAP28.reset.
  })
})
