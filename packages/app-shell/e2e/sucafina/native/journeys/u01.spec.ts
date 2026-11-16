/**
 * N10/U01 installed web journey. No mocked host/projections/authorization.
 * 120 owns surgical execution after 125 integrates the real producer and route.
 */
import { expect } from "@playwright/test"
import { armHeldResponse, nativeInstalledFixture as test } from "../fixture"

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
  await expect(page.locator(".sf-n24-metadata"), "UI34 must complete its original authorized case read").toBeVisible()
  await page.goBack()
  await expect(home).toBeVisible()
  await expect(home.getByRole("button", { name: accessibleName! })).toBeFocused()
})

test("UI29 pointer action resumes the original case and renders admitted UI34", async ({ page, nativeHarness }) => {
  const installed = new URL(nativeHarness.manifest.target.chapterHref, nativeHarness.manifest.target.shellOrigin)
  await page.goto(installed.toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const homeUrl = new URL(installed)
  homeUrl.pathname = "/orchestra/sf-home"
  await page.goto(homeUrl.toString())
  const home = page.locator('[data-sf-home="authorized"]')
  await expect(home).toBeVisible()
  const resumes = home.getByRole("button", { name: /^(Resume case|Retomar caso):/ })
  await expect(resumes, "Original source must expose an authorized existing case").not.toHaveCount(0)
  await resumes.nth(0).click()
  await expect(page).toHaveURL(/\/orchestra\/sf-decisions\/r_[A-Za-z0-9_-]+(?:\?|$)/)
  await expect(page.locator(".sf-n24-metadata")).toBeVisible()
})

test("UI29 cancels an original late case preflight after leaving Today", async ({ page, nativeHarness }) => {
  const installed = new URL(nativeHarness.manifest.target.chapterHref, nativeHarness.manifest.target.shellOrigin)
  await page.goto(installed.toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const homeUrl = new URL(installed)
  homeUrl.pathname = "/orchestra/sf-home"
  await page.goto(homeUrl.toString())
  const home = page.locator('[data-sf-home="authorized"]')
  await expect(home).toBeVisible()
  const resumes = home.getByRole("button", { name: /^(Resume case|Retomar caso):/ })
  await expect(resumes).not.toHaveCount(0)

  const source = new URL(nativeHarness.manifest.target.mount + "/api/ui/projections/case",
    nativeHarness.manifest.target.publicOrigin)
  // Fetches ONE original producer reply and holds delivery. No route.fulfill fake.
  const held = await armHeldResponse(page, {
    origin: source.origin, pathname: source.pathname, method: "GET",
  })
  try {
    await resumes.nth(0).click()
    await expect.poll(() => held.observations().attempts, {
      message: "Real producer must have returned the held case projection",
    }).toBe(1)
    const departure = new URL(homeUrl)
    departure.pathname = "/orchestra/sf-home/context"
    await page.goto(departure.toString(), { waitUntil: "domcontentloaded" })
    held.release()
    await expect(page).toHaveURL(departure.toString())
    await expect(page.locator(".sf-n24-metadata")).not.toBeVisible()
  } finally {
    await held.dispose()
  }
})

test("UI29 preserves read states and focusable actions during source reflow", async ({ page, nativeHarness }) => {
  const installed = new URL(nativeHarness.manifest.target.chapterHref, nativeHarness.manifest.target.shellOrigin)
  await page.goto(installed.toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const homeUrl = new URL(installed)
  homeUrl.pathname = "/orchestra/sf-home"
  await page.goto(homeUrl.toString())
  const home = page.locator('[data-sf-home="authorized"]')
  await expect(home).toBeVisible()
  for (const width of [768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(home.getByRole("heading", { name: /Cases|Casos/ })).toBeVisible()
    await expect(home.getByRole("heading", { name: /Meetings|Reuniões/ })).toBeVisible()
  }
  await page.setViewportSize({ width: 640, height: 900 })
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
  await expect(home.getByRole("heading", { name: /Cases|Casos/ })).toBeVisible()
  await expect(home.locator('section[aria-labelledby="sf-u01-meetings"] [data-sf-state="unavailable"]')).toBeVisible()
  // 400% browser zoom at 1280px yields a 320 CSS-pixel reflow viewport.
  await page.evaluate(() => { document.documentElement.style.fontSize = "" })
  await page.setViewportSize({ width: 320, height: 900 })
  await expect(home.getByRole("heading", { name: /Cases|Casos/ })).toBeVisible()
  const resumes = home.getByRole("button", { name: /^(Resume case|Retomar caso):/ })
  await expect(resumes).not.toHaveCount(0)
  await resumes.nth(0).focus()
  await expect(resumes.nth(0)).toBeFocused()
})
