import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

// U46 / N18 — real installed host only, not a fixture-generated financial
// response or synthetic permission. 120 owns the candidate-bound run.
test.use({ trace: "off" })

type Target = Readonly<{
  shellOrigin: string; chapterHref: string; serverKey: string; projectId: string; installationId: string; mount: string
}>
function href(target: Target, leaf: "versions" | "compare") {
  const url = new URL("/orchestra/sf-planner/versions" + (leaf === "compare" ? "/compare" : ""), target.shellOrigin)
  url.searchParams.set("server", target.serverKey)
  url.searchParams.set("project", target.projectId)
  url.searchParams.set("installation", target.installationId)
  return url.toString()
}
async function mounted(page: import("@playwright/test").Page, target: Target) {
  await page.goto(href(target, "versions"))
  await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
  await expect(page.getByRole("heading", { name: /Versions|Versões/ })).toBeVisible()
}

test("U46 — official and lock state comes from the version projection", async ({ page, nativeHarness }, info) => {
  test.setTimeout(180_000)
  const target = nativeHarness.manifest.target
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  await mounted(page, target)
  const surface = page.locator('[data-sf-surface="CAP23"]')
  await expect(surface).toBeVisible()
  const table = surface.getByRole("table")
  await expect(table).toBeVisible()
  await expect(table.getByRole("columnheader", { name: "Version" })).toBeVisible()
  await expect(table.getByRole("columnheader", { name: "Year" })).toBeVisible()
  await expect(table.getByRole("columnheader", { name: "State" })).toBeVisible()

  // Where the source supplies official versions, their destructive controls
  // must remain denied, even when the current actor may copy that version.
  const officialRows = table.getByRole("row").filter({ hasText: /Official/ })
  const count = await officialRows.count()
  for (let index = 0; index < count; index++) {
    const row = officialRows.nth(index)
    await expect(row.getByRole("button", { name: "delete", exact: true })).toBeDisabled()
    await expect(row.getByRole("button", { name: "unlock", exact: true })).toBeDisabled()
  }
  await info.attach("u46-installed-versions.png", {
    body: await page.screenshot({ fullPage: true }), contentType: "image/png",
  })
})

test("U46 — reviewing copy/official/lock never writes before explicit confirmation", async ({ page, nativeHarness }) => {
  test.setTimeout(180_000)
  const target = nativeHarness.manifest.target
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const posts: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === target.mount + "/planner")
      posts.push(request.url())
  })
  await mounted(page, target)
  const surface = page.locator('[data-sf-surface="CAP23"]')
  const table = surface.getByRole("table")
  const actionable = table.getByRole("button", { name: "copy", exact: true })
  await expect(actionable).not.toHaveCount(0)
  let authorizedRow: number | undefined
  for (let index = 0; index < await actionable.count(); index++) {
    if (await actionable.nth(index).isVisible() && await actionable.nth(index).isEnabled()) {
      authorizedRow = index
      break
    }
  }
  expect(authorizedRow, "F04 must provide a real actor allowed to copy a version").toBeDefined()
  await actionable.nth(authorizedRow!).click()
  const review = surface.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  await expect(review.getByRole("button", { name: /Confirm/i })).toBeEnabled()
  expect(posts).toEqual([])
  await review.getByRole("button", { name: /Cancel review|Cancelar revisão/ }).click()
  await expect(review).toHaveCount(0)
  expect(posts).toEqual([])
})

test("U46 — comparison is read-only and refuses a cross-year default", async ({ page, nativeHarness }, info) => {
  test.setTimeout(180_000)
  const target = nativeHarness.manifest.target
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const posts: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === target.mount + "/planner")
      posts.push(request.url())
  })
  await page.goto(href(target, "compare"))
  const surface = page.locator('[data-sf-surface="CAP23-compare"]')
  await expect(surface).toBeVisible()
  const left = surface.locator("#sf-u46-base")
  const right = surface.locator("#sf-u46-candidate")
  await expect(left).toBeVisible()
  await expect(right).toBeVisible()
  const sources = await left.locator("option").allTextContents()
  if (sources.length >= 2) {
    await expect(right).toBeEnabled()
    const monthly = surface.locator("table.sf-u46-monthly")
    await expect(monthly).toBeVisible()
    await expect(monthly.locator("tbody tr")).toHaveCount(12)
    // The same exact source ref cannot be selected twice.
    const selectedRef = await left.inputValue()
    const disabledDuplicate = await right.locator("option").evaluateAll(
      (options, ref) => options.some((element) =>
        (element as HTMLOptionElement).value === ref && (element as HTMLOptionElement).disabled), selectedRef,
    )
    expect(disabledDuplicate).toBe(true)
    expect(selectedRef).not.toBe(await right.inputValue())
  } else {
    await expect(right).toBeDisabled()
    await expect(surface.getByText(/comparison plan is unavailable|não há/i)).toBeVisible()
  }
  expect(posts).toEqual([])
  await info.attach("u46-installed-comparison.png", {
    body: await page.screenshot({ fullPage: true }), contentType: "image/png",
  })
})

test("U46 — an empty installed planner can review its first version without dispatch", async ({ page, nativeHarness }) => {
  test.setTimeout(180_000)
  const target = nativeHarness.manifest.target
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const requestUrl = new URL(href(target, "versions"))
  requestUrl.pathname += "/new"
  const writes: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === target.mount + "/planner")
      writes.push(request.url())
  })
  await page.goto(requestUrl.toString())
  const surface = page.locator('[data-sf-surface="CAP23"]')
  await expect(surface).toBeVisible()
  const first = surface.getByRole("button", { name: /Create first version/i })
  await expect(first).toHaveCount(1)
  await expect(first).toBeEnabled()
  await first.click()
  const review = surface.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  await expect(review.getByRole("button", { name: /Confirm/i })).toBeEnabled()
  expect(writes).toEqual([])
  await review.getByRole("button", { name: /Cancel review|Cancelar revisão/ }).click()
  expect(writes).toEqual([])
})

test("U46 — comparison controls reflow at 320 CSSpx and 200% text without a command", async ({ page, nativeHarness }, info) => {
  test.setTimeout(180_000)
  const target = nativeHarness.manifest.target
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const writes: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === target.mount + "/planner")
      writes.push(request.url())
  })
  await page.goto(href(target, "compare"))
  const surface = page.locator('[data-sf-surface="CAP23-compare"]')
  await expect(surface).toBeVisible()
  const source = surface.locator("#sf-u46-base")
  const candidate = surface.locator("#sf-u46-candidate")
  for (const width of [320, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 850 })
    await expect(source).toBeVisible()
    await expect(candidate).toBeVisible()
    await expect.poll(async () => surface.evaluate((element) =>
      element.scrollWidth <= element.clientWidth), {
      message: "Comparison content reflows; wide monthly tables scroll in their own container",
    }).toBe(true)
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
  await page.setViewportSize({ width: 320, height: 800 })
  await expect.poll(async () => surface.evaluate((element) =>
    element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(writes).toEqual([])
  await info.attach("u46-installed-comparison-200pct.png", {
    body: await page.screenshot({ fullPage: true }), contentType: "image/png",
  })
})
