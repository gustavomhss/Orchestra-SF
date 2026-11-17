import path from "node:path"
import { mkdir, writeFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { setupCompactNavigation } from "../orchestra/compact-navigation.fixture"

// Production Orchestra UI, not a design mock. A synthetic API fixture supplies only
// the server responses needed to mount the actual app and its original navigation.
test.use({
  viewport: { width: 1672, height: 941 },
  deviceScaleFactor: 1,
  serviceWorkers: "block",
  timezoneId: "UTC",
})

test("Sucafina production shell across unchanged Orchestra palettes", async ({ page }) => {
  const out = process.env.ORCHESTRA_VISUAL_OUT
  if (!out) throw new Error("ORCHESTRA_VISUAL_OUT must be set")
  await mkdir(out, { recursive: true })
  await setupCompactNavigation(page, { locale: "en", scheme: "dark", selected: true, projectName: "Sucafina" })
  await page.goto("/")
  await expect(page.locator('[data-component="orchestra-sidebar"]')).toBeVisible()
  await expect(page.getByRole("img", { name: "Sucafina" }).first()).toBeVisible()
  await expect(page.locator("html")).toHaveAttribute("data-orchestra-brand", "sucafina")

  const cases = [
    { id: "dark", scheme: "dark" },
    { id: "light", scheme: "light" },
    { id: "graphite", scheme: "dark" },
    { id: "nord", scheme: "dark" },
    { id: "github", scheme: "light" },
  ] as const
  const records: unknown[] = []
  for (const theme of cases) {
    await page.evaluate((selection) => {
      localStorage.setItem("orchestra-palette", selection.id)
      localStorage.setItem("orchestra-color-scheme", selection.scheme)
    }, theme)
    await page.reload()
    await expect(page.locator("html")).toHaveAttribute("data-orchestra-brand", "sucafina")
    await expect(page.locator("html")).toHaveAttribute("data-color-scheme", theme.scheme)
    if (theme.id !== "dark" && theme.id !== "light") {
      await expect(page.locator("html")).toHaveAttribute("data-orchestra-palette", theme.id)
      await expect(page.locator("#orchestra-palette")).toHaveCount(1)
    }
    const rail = page.locator('[data-component="orchestra-sidebar"]')
    await expect(rail).toBeVisible()
    await expect(page.getByRole("img", { name: "Sucafina" }).first()).toBeVisible()
    await expect(rail).toHaveCSS("width", "230px")
    await expect(page.locator('[data-slot="titlebar-v2"]')).toHaveCSS("height", "45px")
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(180)
    const file = `sucafina-shell-${theme.id}.png`
    await page.screenshot({ path: path.join(out, file), animations: "disabled", fullPage: false })
    const measured = await page.evaluate(() => {
      const box = (selector: string) => {
        const element = document.querySelector(selector)
        if (!element) return null
        const b = element.getBoundingClientRect()
        return { x: b.x, y: b.y, width: b.width, height: b.height }
      }
      return {
        brand: document.documentElement.dataset.orchestraBrand,
        scheme: document.documentElement.dataset.colorScheme,
        palette: document.documentElement.dataset.orchestraPalette ?? null,
        sidebar: box('[data-component="orchestra-sidebar"]'),
        toolbar: box('[data-slot="titlebar-v2"]'),
        logo: box('[data-component="orchestra-sidebar"] .sucafina-logo'),
        images: [...document.querySelectorAll('.sucafina-logo img')].map((image) => ({
          src: (image as HTMLImageElement).src,
          naturalWidth: (image as HTMLImageElement).naturalWidth,
        })),
      }
    })
    records.push({ file, source: test.info().config.metadata.source, ...measured })
  }
  await writeFile(path.join(out, "manifest.json"), JSON.stringify({
    note: "Screenshots of actual production Orchestra-SF Reactivity/SolidJS app shell with synthetic server responses; not a deployed Sucafina tenant.",
    files: records,
  }, null, 2) + "\n")
})
