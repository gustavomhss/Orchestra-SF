/**
 * U08 surgical installed Headcount journeys. Always run by 120 against the
 * real authenticated SF producer; the fixture refuses to run without a bound
 * GitHub Actions candidate and private host manifest.
 */
import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

test.use({ trace: "off" })
const headcountUrl = (shellOrigin: string, chapterHref: string) => {
  const url = new URL(chapterHref, shellOrigin)
  url.pathname = "/orchestra/sf-planner/headcount"
  return url.toString()
}

test("CAP20 installed position table and privacy survives responsive reflow", async ({ page, nativeHarness }, testInfo) => {
  const host = nativeHarness.manifest.target
  const writes: string[] = []
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/planner"))
      writes.push(request.url())
  })
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto(headcountUrl(host.shellOrigin, host.chapterHref))
  const headcount = page.locator('[data-sf-surface="CAP20"]')
  await expect(headcount, "Native CAP20 must load from the real authorized context").toBeVisible()
  await expect(headcount.getByRole("heading", { name: "Positions", exact: true })).toBeVisible()
  await expect(headcount.getByRole("columnheader", { name: "FTE", exact: true })).toBeVisible()
  await testInfo.attach("u08-headcount-320.png", {
    body: await page.screenshot({ fullPage: true }), contentType: "image/png",
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(headcount.getByRole("table")).toHaveCount(1)
  await testInfo.attach("u08-headcount-1440.png", {
    body: await page.screenshot({ fullPage: true }), contentType: "image/png",
  })
  expect(writes, "Observing headcount must not dispatch an HR mutation").toEqual([])
  expect(errors).toEqual([])
})

test("CAP20 opening a position draft does not sync roster or save salary", async ({ page, nativeHarness }) => {
  const host = nativeHarness.manifest.target
  await page.goto(headcountUrl(host.shellOrigin, host.chapterHref))
  const surface = page.locator('[data-sf-surface="CAP20"]')
  await expect(surface).toBeVisible()
  const writes: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/planner"))
      writes.push(request.url())
  })
  const positionTable = surface.getByRole("table").filter({ has: surface.getByRole("columnheader", { name: "FTE", exact: true }) })
  const sourceNames = await positionTable.getByRole("rowheader").allTextContents()
  expect(sourceNames.length).toBeGreaterThan(0)
  const chosen = sourceNames[0]!
  const selected = positionTable.getByRole("row").filter({ has: positionTable.getByRole("rowheader", { name: chosen, exact: true }) })
  await selected.getByRole("button", { name: "Show details" }).click()
  await expect(surface.getByRole("heading", { name: "Positions", exact: true })).toBeVisible()
  expect(writes, "Opening a draft alone must not mutate source").toEqual([])
})
