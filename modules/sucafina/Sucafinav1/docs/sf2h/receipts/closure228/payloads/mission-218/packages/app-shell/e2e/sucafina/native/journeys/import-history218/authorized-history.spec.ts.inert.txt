import { expect, type Page } from "@playwright/test"
import { armHeldResponse, nativeInstalledFixture as test } from "../../fixture"

test.describe("218 / S1-R1-207-002 — authorized import receipt history", () => {
  test.describe.configure({ retries: 0 })
  const required = (key: string) => {
    const value = process.env[key]
    if (!value?.trim()) throw new Error("SF218_REAL_INSTALLED_INPUT_REQUIRED:" + key)
    return value
  }
  const route = "/orchestra/sf-imports"
  const leaf = (page: Page) => page.locator('[data-sf-leaf="u23"][data-sf-surface="UI57"]')
  const chooseSurface = async (page: Page) => {
    const surface = required("SF_NATIVE_IMPORT_SURFACE")
    if (surface !== "planner" && surface !== "dashboard") throw new Error("SF218_REAL_SURFACE_INVALID")
    await leaf(page).getByRole("combobox").selectOption(surface)
    return surface
  }
  const open = async (page: Page, shellOrigin: string) => {
    const href = new URL(route, shellOrigin)
    if (href.origin !== shellOrigin) throw new Error("SF218_CROSS_OWNER_ROUTE")
    await page.goto(href.href)
    await expect(leaf(page)).toBeVisible()
    await expect(leaf(page).locator('[data-sf-history="authorized-reference"]')).toBeVisible()
  }
  const lookup = async (page: Page, ref: string) => {
    await leaf(page).getByRole("textbox", { name: "importPreviewRef" }).fill(ref)
    await leaf(page).getByRole("button", { name: /Refresh receipt|Atualizar|reconcile/i }).first().click()
  }

  test("original persisted receipt and domain drilldown; history never issues import-admit/preview/apply", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "finding", description: "S1-R1-207-002 / U23-AC01 / U23-AC02 / WP06.T04" })
    const ref = required("SF_NATIVE_IMPORT_RECEIPT_MANIFEST_REF")
    const calls: string[] = []
    page.on("request", (request) => {
      const sf = new URL(request.url()).searchParams.get("sf")
      if (sf) calls.push(sf)
    })
    await open(page, nativeHarness.manifest.target.shellOrigin)
    await chooseSurface(page)
    await expect(leaf(page).locator('[data-sf-receipt="producer"]')).toHaveCount(0)
    await lookup(page, ref)
    await expect(leaf(page).locator('[data-sf-receipt="producer"]')).toBeVisible()
    await expect(leaf(page)).toHaveAttribute("data-sf-read-state", "ready")
    await expect(leaf(page).getByRole("button", { name: /Apply reviewed import/ })).toHaveCount(0)
    expect(calls).toContain("import-reference")
    expect(calls).toContain("import-detail")
    expect(calls).not.toContain("import-apply")
    expect(calls).not.toContain("import-admit")
    expect(calls).not.toContain("import-preview")
    const receipt = leaf(page).getByRole("link", { name: /View result|Consultar resultado/ })
    await expect(receipt).toBeVisible()
    await receipt.click()
    await expect(leaf(page).locator('[data-sf-receipt="producer"]')).toHaveCount(0)
    await leaf(page).getByRole("button", { name: /Refresh receipt|Atualizar|reconcile/i }).click()
    await expect(leaf(page).locator('[data-sf-receipt="producer"]')).toBeVisible()
    await leaf(page).getByRole("link", { name: /Return to list|Voltar.*lista/ }).click()
    await expect(leaf(page).locator('[data-sf-history="authorized-reference"]')).toBeVisible()
    await expect(leaf(page).locator('[data-sf-receipt="producer"]')).toHaveCount(0)
  })

  test("producer-denied reference never yields a receipt or incorrectly reports an empty collection", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "finding", description: "S1-R1-207-002 / READ-01 denied vs removed vs empty" })
    const ref = required("SF218_DENIED_IMPORT_MANIFEST_REF")
    await open(page, nativeHarness.manifest.target.shellOrigin)
    await chooseSurface(page)
    await lookup(page, ref)
    await expect(leaf(page)).toHaveAttribute("data-sf-read-state", "denied")
    await expect(leaf(page).locator('[data-sf-receipt="producer"]')).toHaveCount(0)
    await expect(leaf(page).locator(".sf-files-change")).toHaveCount(0)
    await expect(leaf(page)).not.toHaveAttribute("data-sf-read-state", "empty")
    await expect(leaf(page)).not.toHaveAttribute("data-sf-read-state", "not-found")
  })

  test("a held original detail reply cannot restore the old selection after surface switch", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "finding", description: "S1-R1-207-002 / U23-AC02 / real late response" })
    const ref = required("SF_NATIVE_IMPORT_RECEIPT_MANIFEST_REF")
    await open(page, nativeHarness.manifest.target.shellOrigin)
    const surface = await chooseSurface(page)
    const held = await armHeldResponse(page, {
      origin: nativeHarness.manifest.target.publicOrigin,
      pathname: nativeHarness.manifest.target.mount + "/" + surface,
      method: "GET", query: { sf: "import-detail" },
    })
    try {
      const requested = page.waitForRequest((request) => {
        const url = new URL(request.url())
        return url.origin === nativeHarness.manifest.target.publicOrigin &&
          url.searchParams.get("sf") === "import-detail"
      })
      await lookup(page, ref)
      await requested
      await leaf(page).getByRole("combobox").selectOption(surface === "planner" ? "dashboard" : "planner")
      held.release()
      await expect(leaf(page).locator('[data-sf-receipt="producer"]')).toHaveCount(0)
      await expect(leaf(page).locator('[data-sf-history="authorized-reference"] input[type="text"]')).toHaveValue("")
    } finally { await held.dispose() }
  })

  test("320/768/1024/1280/1440, 200% and 400% text reflow keep real history selection usable", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "finding", description: "S1-R1-207-002 / U23-AC03" })
    await open(page, nativeHarness.manifest.target.shellOrigin)
    const history = leaf(page).locator('[data-sf-history="authorized-reference"]')
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(history.getByRole("combobox")).toBeVisible()
      await expect(history.getByRole("textbox", { name: "importPreviewRef" })).toBeVisible()
      await expect(history.getByRole("button", { name: /Refresh receipt|Atualizar|reconcile/i })).toBeVisible()
      const bounds = await leaf(page).evaluate((node) => ({ available: node.clientWidth, content: node.scrollWidth }))
      expect(bounds.content).toBeLessThanOrEqual(bounds.available + 1)
    }
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" })
    await expect(history.getByRole("textbox", { name: "importPreviewRef" })).toBeVisible()
    await page.addStyleTag({ content: "html { font-size: 400% !important; }" })
    await page.setViewportSize({ width: 320, height: 900 })
    await expect(history.getByRole("combobox")).toBeVisible()
    await expect(history.getByRole("textbox", { name: "importPreviewRef" })).toBeVisible()
    await expect(history.getByRole("button", { name: /Refresh receipt|Atualizar|reconcile/i })).toBeVisible()
    const bounds = await leaf(page).evaluate((node) => ({ available: node.clientWidth, content: node.scrollWidth }))
    expect(bounds.content).toBeLessThanOrEqual(bounds.available + 1)
  })
})
