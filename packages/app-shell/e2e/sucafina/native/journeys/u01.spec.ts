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

test("UI29 resumes an authorized real case by keyboard and restores focus on return", async ({ page, nativeHarness }) => {
  const installed = new URL(nativeHarness.manifest.target.chapterHref, nativeHarness.manifest.target.shellOrigin)
  await page.goto(installed.toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const homeUrl = new URL(installed)
  homeUrl.pathname = "/orchestra/sf-home"
  await page.goto(homeUrl.toString())
  const home = page.locator('[data-sf-home="authorized"]')
  await expect(home).toBeVisible()
  const resumes = home.getByRole("button", { name: /^(Resume case|Retomar caso):/ })
  await expect(resumes, "Fixture must expose a real authorized case and the F01 navigation port").not.toHaveCount(0)
  // Choose the first source-backed case intentionally, not a fallback guessed from its title.
  const action = resumes.nth(0)
  const accessibleName = await action.getAttribute("aria-label")
  expect(accessibleName).toBeTruthy()
  await action.focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/orchestra\/sf-decisions\/r_[A-Za-z0-9_-]+(?:\?|$)/)
  await page.goBack()
  await expect(home).toBeVisible()
  await expect(home.getByRole("button", { name: accessibleName! })).toBeFocused()
})
