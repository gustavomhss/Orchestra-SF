/**
 * N10/U01 installed web journey. No mocked host/projections/authorization.
 * 120 owns surgical execution after 125 integrates the real producer and route.
 */
import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

test("UI29 Today uses installed-authorized case and routine projections", async ({ page, nativeHarness }) => {
  const installed = new URL(nativeHarness.manifest.target.chapterHref, nativeHarness.manifest.target.shellOrigin)
  await page.goto(installed.toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const destination = new URL(installed)
  destination.pathname = "/orchestra/sf-home"
  await page.goto(destination.toString())
  await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
  const home = page.locator('[data-sf-home="authorized"]')
  await expect(home, "Readiness requires the real installed projection; no empty mock").toBeVisible()
  await expect(home.getByRole("heading", { name: /Cases|Casos/ })).toBeVisible()
  await expect(home.getByRole("heading", { name: /Meetings|Reuniões/ })).toBeVisible()
  await expect(home.getByRole("heading", { name: /Material changes|Mudanças materiais/ })).toBeVisible()
  await expect(home.locator('section[aria-labelledby="sf-u01-meetings"] [data-sf-state="unavailable"]')).toBeVisible()
  await expect(home.locator('section[aria-labelledby="sf-u01-changes"] [data-sf-state="unavailable"]')).toBeVisible()
})

test("UI29 Today reflows at 320 CSS px without hiding source states", async ({ page, nativeHarness }) => {
  const installed = new URL(nativeHarness.manifest.target.chapterHref, nativeHarness.manifest.target.shellOrigin)
  await page.goto(installed.toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const destination = new URL(installed)
  destination.pathname = "/orchestra/sf-home"
  await page.setViewportSize({ width: 320, height: 860 })
  await page.goto(destination.toString())
  const home = page.locator('[data-sf-home="authorized"]')
  await expect(home).toBeVisible()
  await expect(home.getByRole("heading", { name: /Resume|Retomar/ })).toBeVisible()
  const size = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, window: window.innerWidth }))
  expect(size.document).toBeLessThanOrEqual(size.window)
})
