import path from "node:path"
import { mkdir, writeFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { setupCompactNavigation } from "../orchestra/compact-navigation.fixture"

// The real production Orchestra UI is mounted with a synthetic, non-secret API fixture.
// The identity, original glass CSS, navigation and native Home components are not mocked.
test.use({
  viewport: { width: 1672, height: 941 },
  deviceScaleFactor: 1,
  serviceWorkers: "block",
  timezoneId: "UTC",
})

const cases = [
  { id: "dark", scheme: "dark" },
  { id: "light", scheme: "light" },
  { id: "graphite", scheme: "dark" },
  { id: "nord", scheme: "dark" },
  { id: "github", scheme: "light" },
] as const

for (const theme of cases) {
  test(`Sucafina native shell using unmodified Orchestra ${theme.id} palette`, async ({ page }) => {
    const out = process.env.ORCHESTRA_VISUAL_OUT
    if (!out) throw new Error("ORCHESTRA_VISUAL_OUT must be set")
    await mkdir(out, { recursive: true })
    await setupCompactNavigation(page, { locale: "en", scheme: theme.scheme, selected: true, projectName: "Sucafina" })
    await page.addInitScript((palette) => {
      localStorage.setItem("orchestra-palette", palette)
    }, theme.id)
    await page.goto("/")
    await expect(page.locator("html")).toHaveAttribute("data-orchestra-brand", "sucafina")
    await expect(page.locator("html")).toHaveAttribute("data-color-scheme", theme.scheme)
    if (theme.id !== "dark" && theme.id !== "light") {
      await expect(page.locator("html")).toHaveAttribute("data-orchestra-palette", theme.id)
      await expect(page.locator("#orchestra-palette")).toHaveCount(1)
    }
    const sidebar = page.locator('[data-component="orchestra-sidebar"]')
    await expect(sidebar).toBeVisible()
    await expect(sidebar).toHaveCSS("width", "230px")
    await expect(page.locator('[data-slot="titlebar-v2"]')).toHaveCSS("height", "45px")
    await expect(sidebar.getByRole("img", { name: "Sucafina" })).toBeVisible()
    await expect(page.locator(".orchestra-home-dashboard")).toBeVisible()
    await expect(page.locator(".home-kpi").first()).toBeVisible()
    await expect(page.locator('[data-slot="orchestra-titlebar-breadcrumb"]')).toContainText("Sucafina")
    await expect(page.locator('[data-slot="orchestra-titlebar-breadcrumb"]')).not.toContainText("Orchestra")
    await expect(page.locator(".home-foot")).not.toContainText("Orchestra")
    await page.evaluate(() => document.fonts.ready)
    const file = `sucafina-shell-${theme.id}.png`
    await page.screenshot({ path: path.join(out, file), animations: "disabled" })
    const details = await page.evaluate(() => {
      const box = (selector: string) => {
        const e = document.querySelector(selector)
        if (!e) return null
        const r = e.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      }
      return {
        brand: document.documentElement.dataset.orchestraBrand,
        scheme: document.documentElement.dataset.colorScheme,
        palette: document.documentElement.dataset.orchestraPalette ?? null,
        sidebar: box('[data-component="orchestra-sidebar"]'),
        titlebar: box('[data-slot="titlebar-v2"]'),
        brandSlot: box('[data-component="orchestra-sidebar"] .sucafina-logo'),
        title: document.title,
      }
    })
    await writeFile(path.join(out, `manifest-${theme.id}.json`), JSON.stringify({
      ...details, file, sha: test.info().config.metadata.source,
      note: "Actual compiled Orchestra home UI with synthetic API fixture, not live Sucafina tenant data.",
    }, null, 2) + "\n")
  })
}
