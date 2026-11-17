/**
 * Sucafina corporate white-label visual proof on the REAL installed F04 host.
 * This is NOT the Orchestra generic Home, a static fixture, the legacy /sucafina HTML,
 * or a mocked identity/transport. The existing authenticated host owns the browser.
 *
 * Run only under the Q02 installed-native Playwright environment with a SYNTHETIC
 * corporate dataset approved for screenshots. Never upload private production records.
 */
import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { nativeInstalledFixture as test } from "./fixture.ts"

test.use({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", trace: "off", video: "off" })
test.describe.configure({ mode: "default", retries: 0 })

const chapters = [
  { id: "sf-dashboard", route: "/orchestra/sf-dashboard/executive", title: "Executive Dashboard" },
  { id: "sf-planner", route: "/orchestra/sf-planner/overview", title: "Overview" },
  { id: "sf-procurement", route: "/orchestra/sf-procurement/contracts", title: "Vendor Contracts" },
] as const

async function selectRealPalette(page: Page, origin: string, palette: "dark" | "light") {
  const response = await page.goto(new URL("/orchestra/settings?section=general", origin).href)
  expect(response?.status(), "Installed Orchestra Settings must answer on real shell origin").toBe(200)
  const picker = page.locator('[data-action="settings-palette"]')
  await expect(picker).toBeVisible()
  const option = picker.locator(`button[role="radio"][data-palette="${palette}"]`)
  await expect(option).toHaveCount(1)
  await option.click()
  await expect(option).toHaveAttribute("aria-checked", "true")
  await expect(page.locator("html")).toHaveAttribute("data-color-scheme", palette)
}

for (const palette of ["dark", "light"] as const) {
  for (const chapter of chapters) {
    test(`SF-WL installed ${chapter.id} with Sucafina identity / Orchestra ${palette}`, async ({ page, nativeHarness }, testInfo) => {
      if (process.env.SF_BRAND_VISUAL_SYNTHETIC_DATASET !== "1")
        throw new Error("SF_BRAND_VISUAL_REQUIRES_APPROVED_SYNTHETIC_DATASET")
      const { target } = nativeHarness.manifest

      const mounted = await page.goto(new URL(target.chapterHref, target.shellOrigin).href)
      expect(mounted?.status(), "Original F04 installed shell must answer").toBe(200)
      const observed = await nativeHarness.proveWeb(page.getByRole("main"))
      expect(observed.proofClass).toBe("WEB_INSTALLED_CONTEXT_OBSERVED")
      expect(observed.candidateSha).toBe(nativeHarness.manifest.candidateSha)
      expect(nativeHarness.componentFixture).toBe("NOT_INSTALLED_PROOF")

      await expect(page.locator("html")).toHaveAttribute("data-orchestra-brand", "sucafina")
      await selectRealPalette(page, target.shellOrigin, palette)

      const response = await page.goto(new URL(chapter.route, target.shellOrigin).href)
      expect(response?.status(), "Native SF route must resolve on the real installed shell").toBe(200)
      const frame = page.locator('[data-sf-frame="page"]')
      await expect(frame, "Do not capture an Orchestra Home or legacy/Sucafinav1 page").toBeVisible()
      await expect(frame.getByRole("heading", { level: 1, name: chapter.title, exact: true })).toBeVisible()
      await expect(frame.locator('[aria-busy="true"]')).toHaveCount(0)
      await expect(page.locator("html")).toHaveAttribute("data-color-scheme", palette)
      await expect(page.locator("html")).toHaveAttribute("data-orchestra-brand", "sucafina")

      const sidebar = page.locator('[data-component="orchestra-sidebar"]')
      await expect(sidebar).toBeVisible()
      await expect(sidebar.locator(".sucafina-logo")).toBeVisible()
      await expect(sidebar).toHaveCSS("width", "230px")
      await expect(page.locator('[data-slot="titlebar-v2"]')).toHaveCSS("height", "45px")
      await expect(page.locator('[data-slot="orchestra-titlebar-breadcrumb"]')).toContainText("Sucafina")
      await expect(page.locator(".orchestra-sidebar-footer")).toHaveCount(0)

      const logo = sidebar.locator('.sucafina-logo img[data-slot="orchestra-brand-logo-' + (palette === "dark" ? "dark" : "light") + '"]').first()
      await expect(logo).toBeVisible()
      expect(await logo.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      await page.evaluate(() => document.fonts.ready)

      // Only after authentic identity, installation, route, native frame and asset checks.
      const screenshot = await page.screenshot({ animations: "disabled", fullPage: false })
      await testInfo.attach(`sf-real-${chapter.id}-${palette}.png`, { body: screenshot, contentType: "image/png" })
      await testInfo.attach("provenance.json", {
        body: Buffer.from(JSON.stringify({
          schema: "sucafina-installed-white-label-visual-v1",
          class: "AUTHENTIC_INSTALLED_UI_VISUAL_NOT_DOMAIN_OR_BRAND_APPROVAL",
          candidateSha: observed.candidateSha,
          chapter: chapter.id,
          palette,
          nativeFrame: true,
          syntheticDatasetOperatorAttested: true,
          viewport: { width: 1440, height: 900 },
        })),
        contentType: "application/json",
      })
    })
  }
}
