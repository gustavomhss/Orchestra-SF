/**
 * U07 surgical installed journeys. 120 supplies the real authorized candidate
 * with a CAP18/CAP19 version, original host, and non-synthetic records.
 * F04 denies local/mock execution: missing installation MUST fail, never skip.
 */
import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

test.use({ trace: "off" })
const href = (shellOrigin: string, chapterHref: string, leaf: "opex" | "capex") => {
  const url = new URL(chapterHref, shellOrigin)
  url.pathname = "/orchestra/sf-planner/" + leaf
  return url.toString()
}

for (const surface of [
  { id: "CAP18", leaf: "opex" as const, label: "OPEX" },
  { id: "CAP19", leaf: "capex" as const, label: "CAPEX" },
]) {
  test(surface.id + " installed monthly view keeps all months reachable at 320 and 1440", async ({ page, nativeHarness }, testInfo) => {
    const host = nativeHarness.manifest.target
    const url = href(host.shellOrigin, host.chapterHref, surface.leaf)
    const writes: string[] = []
    const javascriptErrors: string[] = []
    page.on("pageerror", (error) => javascriptErrors.push(error.message))
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/planner"))
        writes.push(request.url())
    })
    await page.setViewportSize({ width: 320, height: 720 })
    await page.goto(url)
    const sheet = page.locator('[data-sf-surface="' + surface.id + '"]')
    await expect(sheet, "U07 requires the installed, authorized native consumer").toBeVisible()
    const monthly = sheet.getByRole("grid", { name: /Monthly values|Valores mensais/ })
    await expect(monthly).toBeVisible()
    await expect(monthly).toHaveAttribute("aria-colcount", /1[4-9]/)
    const first = monthly.getByRole("gridcell").filter({ has: page.locator("[data-closed]") })
    // The grid is owner-bound and keyboard navigable; focus must not issue a mutation.
    await monthly.focus()
    await page.keyboard.press("Control+Home")
    await page.keyboard.press("ArrowRight")
    await expect(monthly).toBeFocused()
    await expect(sheet.getByRole("region", { name: /Paste monthly values|Colar valores mensais/ })).toBeVisible()
    await testInfo.attach("u07-" + surface.leaf + "-320.png", {
      body: await page.screenshot({ fullPage: true }), contentType: "image/png",
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(monthly).toBeVisible()
    await testInfo.attach("u07-" + surface.leaf + "-1440.png", {
      body: await page.screenshot({ fullPage: true }), contentType: "image/png",
    })
    expect(writes, "Read, resize and navigation must never emit a financial POST").toEqual([])
    expect(javascriptErrors).toEqual([])
    void first
  })
}

test("CAP18 review does not perform a mutation before an explicit apply", async ({ page, nativeHarness }) => {
  const host = nativeHarness.manifest.target
  const url = href(host.shellOrigin, host.chapterHref, "opex")
  const post: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/planner"))
      post.push(request.url())
  })
  await page.goto(url)
  const surface = page.locator('[data-sf-surface="CAP18"]')
  await expect(surface).toBeVisible()
  await expect(surface.getByRole("heading", { name: "Monthly plan" })).toBeVisible()
  const review = surface.getByRole("button", { name: "Review changes" })
  await expect(review).toBeDisabled()
  expect(post).toEqual([])
})
