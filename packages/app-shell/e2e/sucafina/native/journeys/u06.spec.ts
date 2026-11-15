import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

// U06 / N18 — installed native tests only. Never fake the producer, ACL or body.
// 120 owns execution against the candidate-bound F04 real installation.
test.use({ trace: "off" })

const overviewHref = (target: {
  shellOrigin: string; serverKey: string; projectId: string; installationId: string
}, year?: number) => {
  const url = new URL("/orchestra/sf-planner/overview", target.shellOrigin)
  url.searchParams.set("server", target.serverKey)
  url.searchParams.set("project", target.projectId)
  url.searchParams.set("installation", target.installationId)
  if (year !== undefined) url.searchParams.set("year", String(year))
  return url.toString()
}

test("U06 — real owner-bound overview, authorized money and twelve months", async ({ page, nativeHarness }, info) => {
  test.setTimeout(180_000)
  const target = nativeHarness.manifest.target
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.name))
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  const nativeChapter = page.locator('[data-sf-frame="page"]')
  const proof = await nativeHarness.proveWeb(nativeChapter)
  expect(proof.candidateSha).toBe(nativeHarness.manifest.candidateSha)

  await page.goto(overviewHref(target))
  const surface = page.locator('[data-sf-surface="CAP17"]')
  await expect(surface).toBeVisible()
  await expect(page.getByRole("heading", { name: /Overview|Visão do Planner/ })).toBeVisible()

  // A chart without its accessible source table is insufficient proof.
  const chart = surface.locator(".sf-chart-frame")
  await expect(chart).toBeVisible()
  const monthly = chart.locator("table.sf-chart-table")
  await expect(monthly).toBeVisible()
  await expect(monthly.locator("tbody tr")).toHaveCount(12)
  await expect(monthly.getByRole("columnheader", { name: /Budget USD/ })).toBeVisible()
  await expect(monthly.getByRole("columnheader", { name: /Actual USD/ })).toBeVisible()
  await expect(monthly.getByRole("columnheader", { name: /Outlook USD/ })).toBeVisible()

  // Zero is a producer-known amount; missing is explicit and must not be
  // reformatted into 0. Check rendered cells, not a fabricated fixture total.
  const actualCells = monthly.locator("tbody tr td:nth-child(3)")
  await expect(actualCells).toHaveCount(12)
  for (const item of await actualCells.all()) {
    const text = (await item.innerText()).trim()
    expect(text.length).toBeGreaterThan(0)
    if (/missing|unpriced|unavailable|indisponível/i.test(text))
      expect(text).not.toMatch(/^\$?0(?:[.,]00)?$/)
  }

  await expect(surface.getByRole("button", { name: /Compare versions|Comparar versões/ })).toBeVisible()
  expect(errors).toEqual([])
  await info.attach("u06-installed-overview.png", {
    body: await page.screenshot({ fullPage: true }), contentType: "image/png",
  })
})

test("U06 — read, comparison filters and 320 CSSpx do not submit a domain mutation", async ({ page, nativeHarness }, info) => {
  test.setTimeout(180_000)
  const target = nativeHarness.manifest.target
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const posts: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === target.mount + "/planner")
      posts.push(request.url())
  })
  await page.goto(overviewHref(target))
  const surface = page.locator('[data-sf-surface="CAP17"]')
  await expect(surface).toBeVisible()
  const selector = surface.locator("#sf-u06-compare-filter")
  await expect(selector).toBeVisible()
  await page.setViewportSize({ width: 320, height: 800 })
  await expect.poll(async () => surface.evaluate((element) => element.scrollWidth <= element.clientWidth),
    { message: "Overview reflows; only its tables scroll locally" }).toBe(true)
  await page.reload()
  await expect(page.locator('[data-sf-surface="CAP17"]')).toBeVisible()
  expect(posts).toEqual([])
  await info.attach("u06-installed-320.png", {
    body: await page.screenshot({ fullPage: true }), contentType: "image/png",
  })
})
