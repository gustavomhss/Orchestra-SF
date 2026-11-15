/**
 * N25/U22: installed decision BI proof hooks. No synthetic BI data, no fake
 * producer statuses, no browser math, no local dispatch; 120 owns execution.
 */
import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

test.use({ trace: "off" })
test.describe.configure({ retries: 0 })

test("U22-AC01 — BI09, BI10 and BI11 preserve original charts, tables and source navigation", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "dependency", description:
    "Requires real authorized A08 selectionRefs, BI09/10/11 stored producer projections and U21's installed catalog links" })
  const { shellOrigin, chapterHref } = nativeHarness.manifest.target
  await page.goto(new URL(chapterHref, shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]').first())
  for (const viewId of ["BI09", "BI10", "BI11"] as const) {
    const link = page.locator('a[href*="/sf-bi/"][href$="/' + viewId + '"]').first()
    await expect(link).toBeVisible()
    await link.click()
    const figure = page.locator('[data-sf-bi-view="' + viewId + '"]')
    await expect(figure).toBeVisible()
    await expect(figure.locator(".sf-chart-frame")).toBeVisible()
    await expect(figure.getByRole("table").first()).toBeVisible()
    if (viewId === "BI11") {
      await expect(figure.getByRole("heading", { name: "Sensitivity points" })).toBeVisible()
      await expect(figure.getByRole("columnheader", { name: /Parameter/ })).toBeVisible()
    }
    if (viewId === "BI10") {
      await expect(figure.getByRole("heading", { name: "Timeline" })).toBeVisible()
    }
    await page.goto(new URL(chapterHref, shellOrigin).toString())
  }
})

test("U22-AC02 — producer unavailable and missing data never become inferred zero", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "dependency", description:
    "Real BI options/selection with missing or unavailable values; never stub the server" })
  const { shellOrigin, chapterHref } = nativeHarness.manifest.target
  await page.goto(new URL(chapterHref, shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]').first())
  const link = page.locator('a[href*="/sf-bi/"][href$="/BI11"]').first()
  await expect(link).toBeVisible()
  await link.click()
  const figure = page.locator('[data-sf-bi-view="BI11"]')
  await expect(figure).toBeVisible()
  const table = figure.getByRole("table").first()
  await expect(table).toBeVisible()
  await expect(figure.getByText("Not available from the producer").or(table.locator("td").filter({ hasText: /^0$/ })).first()).toBeVisible()
})

test("U22-AC03 — decision figures reflow at 320/768/1024/1280/1440, dark/light", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "proof-limit", description:
    "Requires 120's full real installed 200%/400% zoom visual oracle for final acceptance" })
  const { shellOrigin, chapterHref } = nativeHarness.manifest.target
  await page.goto(new URL(chapterHref, shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]').first())
  const link = page.locator('a[href*="/sf-bi/"][href$="/BI09"]').first()
  await expect(link).toBeVisible()
  await link.click()
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(page.locator('[data-sf-bi-view="BI09"]')).toBeVisible()
      await expect(page.locator('[data-sf-bi-view="BI09"] .sf-chart-frame')).toBeVisible()
      await expect(page.locator('[data-sf-bi-view="BI09"]').getByRole("table").first()).toBeVisible()
    }
  }
  await page.setViewportSize({ width: 320, height: 900 })
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
  await expect(page.locator('[data-sf-bi-view="BI09"]').getByRole("table").first()).toBeVisible()
})
