/**
 * Q01.complete: legacy/native compatibility, history, keyboard and reflow.
 * This suite uses the original installed HTTP hosts and real native page frame.
 * It does not mount a second app or replace the legacy router with mock HTML.
 */
import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "./fixture"

function nativeUrl(
  target: { shellOrigin: string; serverKey: string; projectId: string; installationId: string },
  pathname: string,
  extras: Record<string, string> = {},
) {
  const url = new URL(pathname, target.shellOrigin)
  const params = { server: target.serverKey, project: target.projectId,
    installation: target.installationId, ...extras }
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.href
}
async function installedNative(page: import("@playwright/test").Page,
                               harness: import("./fixture").InstalledNativeHarness) {
  await page.goto(new URL(harness.manifest.target.chapterHref, harness.manifest.target.shellOrigin).href)
  const fact = await harness.proveWeb(page.locator('[data-sf-frame="page"]'))
  expect(fact.nativeChapterLocatorVisible).toBe(true)
  expect(fact.candidateSha).toBe(harness.manifest.candidateSha)
}

test.describe("Q01 legacy routes remain distinct from the installed native shell", () => {
  test.describe.configure({ retries: 0 })
  const legacy = [
    { caseId: "Q01-COMPAT-DASHBOARD", path: "/dashboard", page: "Budget Overview" },
    { caseId: "Q01-COMPAT-REQUESTS", path: "/procurement", page: "Requests" },
    { caseId: "Q01-COMPAT-APPROVALS", path: "/procurement", page: "My approvals" },
  ] as const
  for (const spec of legacy) {
    test(spec.caseId + " original renderer survives native registration", async ({ page, nativeHarness }) => {
      const { target } = nativeHarness.manifest
      await installedNative(page, nativeHarness)
      const legacyUrl = new URL(target.mount + spec.path, target.publicOrigin)
      legacyUrl.searchParams.set("page", spec.page)
      const response = await page.request.get(legacyUrl.href, { maxRedirects: 0, maxRetries: 0 })
      expect(response.status(), "Original installed producer must serve " + spec.page).toBe(200)
      expect(response.headers()["content-type"]).toMatch(/^text\/html\b/)
      const original = await response.text()
      expect(original).toContain(spec.page)
      expect(original).not.toContain("sf-native-ui/1:mock")
      // Round-trip back through the *real* Orchestra shell. No SF path is
      // rewritten to /chat or replaced by a legacy page during hydration.
      const returnTo = new URL(target.chapterHref, target.shellOrigin).href
      await page.goto(returnTo)
      await expect(page).toHaveURL(returnTo)
      await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
    })
  }

  test("Q01-COMPAT-HISTORY back/forward/reload retains same-owner validated view state only", async ({ page, nativeHarness }) => {
    const { target } = nativeHarness.manifest
    await installedNative(page, nativeHarness)
    const first = nativeUrl(target, "/orchestra/sf-home/context")
    const second = nativeUrl(target, "/orchestra/sf-home/search", { year: "2027" })
    await page.goto(first)
    await expect(page.locator('[data-sf-context="authorized"]')).toBeVisible()
    await page.goto(second)
    await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
    await page.goBack({ waitUntil: "domcontentloaded" })
    await expect(page).toHaveURL(first)
    await expect(page.locator('[data-sf-context="authorized"]')).toBeVisible()
    await page.goForward({ waitUntil: "domcontentloaded" })
    await expect(page).toHaveURL(second)
    await page.reload()
    await expect(page).toHaveURL(second)
    await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
    expect(page.url()).not.toContain("principalRef")
    expect(page.url()).not.toContain("password")
    expect(page.url()).not.toContain("draft")
  })

  test("Q01-COMPAT-KEYBOARD native links are keyboard reachable and preserve owner selection", async ({ page, nativeHarness }) => {
    const { target } = nativeHarness.manifest
    await installedNative(page, nativeHarness)
    const links = page.locator('[data-sf-frame="page"] a[href^="/orchestra/"]')
    await expect(links, "An installed chapter must expose at least one native keyboard link").not.toHaveCount(0)
    const candidate = links.filter({ visible: true })
    await expect(candidate, "Only a visible, user-activated native link is valid").not.toHaveCount(0)
    const href = await candidate.evaluateAll((nodes) => nodes.map((node) =>
      (node as HTMLAnchorElement).getAttribute("href")!).find((value) =>
        value.startsWith("/orchestra/") && !value.startsWith("//")))
    expect(href).toBeTruthy()
    const link = page.locator('[data-sf-frame="page"] a[href="' + href!.replace(/"/g, '\\"') + '"]') .filter({ visible: true })
    await expect(link).toBeVisible()
    await link.focus()
    await expect(link).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL((url) => url.pathname === new URL(href!, target.shellOrigin).pathname)
    await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
    // The user must not be silently switched to a different installation.
    const query = new URL(page.url()).searchParams
    if (query.has("server") || query.has("project") || query.has("installation")) {
      for (const [name, expected] of Object.entries({
        server: target.serverKey, project: target.projectId, installation: target.installationId,
      })) expect(query.get(name)).toBe(expected)
    }
  })

  for (const width of [320, 768, 1024, 1280, 1440]) {
    test("Q01-COMPAT-VIEWPORT-" + width + " keeps native content and controls readable", async ({ page, nativeHarness }) => {
      const { target } = nativeHarness.manifest
      await page.setViewportSize({ width, height: 900 })
      await installedNative(page, nativeHarness)
      await page.goto(nativeUrl(target, "/orchestra/sf-home/context"))
      const frame = page.locator('[data-sf-frame="page"]')
      await expect(frame).toBeVisible()
      await expect(page.locator('[data-sf-context="authorized"]')).toBeVisible()
      const extent = await frame.evaluate((element) => {
        const box = element.getBoundingClientRect()
        const viewport = document.documentElement.clientWidth
        return { left: box.left, right: box.right, viewport }
      })
      expect(extent.left).toBeGreaterThanOrEqual(-1)
      expect(extent.right).toBeLessThanOrEqual(extent.viewport + 1)
    })
  }

  test("Q01-COMPAT-DOWNLOAD native export is a real same-origin download, never a forged receipt", async ({ page, nativeHarness }) => {
    const { target } = nativeHarness.manifest
    await installedNative(page, nativeHarness)
    await page.goto(nativeUrl(target, "/orchestra/sf-imports/exports"))
    await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
    const exportAction = page.locator('[data-sf-frame="page"]')
      .getByRole("button", { name: /^(Export|Exportar)$/, exact: true })
    await expect(exportAction, "UI68 real export must be authorized, not a staged preview").toBeEnabled()
    // Register BEFORE the single user action. The browser must receive the
    // genuine producer response; attachment metadata alone is not a download.
    const downloaded = page.waitForEvent("download")
    await exportAction.click()
    const asset = await downloaded
    expect(new URL(asset.url()).origin).toBe(target.publicOrigin)
    expect(asset.suggestedFilename()).toMatch(/^[^/\\\r\n]+\.(csv|json|xlsx|pdf)$/i)
    expect(await asset.failure()).toBeNull()
  })

  test("Q01-COMPAT-REFLOW native context remains visible at 200% text size in 320 CSS px", async ({ page, nativeHarness }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await installedNative(page, nativeHarness)
    await page.goto(nativeUrl(nativeHarness.manifest.target, "/orchestra/sf-home/context"))
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
    const frame = page.locator('[data-sf-frame="page"]')
    await expect(frame).toBeVisible()
    await expect(page.locator('[data-sf-context="authorized"]')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, "Reflow cannot require horizontal scrolling of the entire document").toBeLessThanOrEqual(1)
  })
})
