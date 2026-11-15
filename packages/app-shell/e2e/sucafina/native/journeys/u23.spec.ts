import { expect, type Page } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

// Installed host only. No request interception, fake auth, mock documents,
// self-issued "clean" scan, or retry of a mutation after a lost response.
test.describe("N27/U23 — real native import and export leaves", () => {
  test.describe.configure({ retries: 0 })

  const visit = async (page: Page, origin: string, path: string) => {
    const destination = new URL(path, origin)
    if (destination.origin !== origin) throw new Error("U23_CROSS_OWNER_ROUTE_REJECTED")
    await page.goto(destination.href)
  }
  const required = (key: string) => {
    const value = process.env[key]
    if (!value?.trim()) throw new Error("U23_REAL_INSTALLED_SEED_REQUIRED:" + key)
    return value
  }
  const token = (ref: string) => "r_" + Buffer.from(ref, "utf8").toString("base64url")
  const noOverflow = async (page: Page) => {
    const dimensions = await page.locator('[data-sf-leaf="u23"]').evaluate((leaf) => ({
      width: leaf.clientWidth, content: leaf.scrollWidth,
    }))
    expect(dimensions.content, "The files leaf must reflow without horizontal overflow").toBeLessThanOrEqual(dimensions.width + 1)
  }

  test("UI55 requires an authorized target and file before a preview; no Apply or receipt on load", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "U23-AC01; U23-AC02; file/target/options admission" })
    await visit(page, nativeHarness.manifest.target.shellOrigin, "/orchestra/sf-imports/new")
    const leaf = page.locator('[data-sf-leaf="u23"][data-sf-surface="UI55"]')
    await expect(leaf).toBeVisible()
    await expect(leaf.locator('input[type="file"]')).toBeVisible()
    await expect(leaf.getByRole("button", { name: /Generate preview|Gerar prévia/ })).toBeDisabled()
    await expect(leaf.getByRole("button", { name: /Apply reviewed import/ })).toHaveCount(0)
    await expect(leaf.locator('[data-sf-receipt="producer"]')).toHaveCount(0)
    await expect(leaf.locator('[data-sf-phase="submitting"]')).toHaveCount(0)
  })

  test("UI56/57 current-base review and receipt are different routes; receipt load never applies", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "U23-AC01; U23-AC02; manifest-source fence" })
    const id = required("SF_NATIVE_IMPORT_MANIFEST_REF")
    const surface = required("SF_NATIVE_IMPORT_SURFACE")
    if (surface !== "planner" && surface !== "dashboard") throw new Error("U23_INVALID_REAL_SURFACE")
    const encoded = token(id)
    const origin = nativeHarness.manifest.target.shellOrigin
    await visit(page, origin, "/orchestra/sf-imports/" + encoded + "/preview")
    const preview = page.locator('[data-sf-leaf="u23"][data-sf-surface="UI56"]')
    await expect(preview).toBeVisible()
    await preview.getByRole("combobox").selectOption(surface)
    await preview.getByRole("button", { name: /Refresh receipt/ }).click()
    await expect(preview.locator(".sf-files-change").or(preview.getByRole("heading", { name: /Domain impact/ }))).toBeVisible()
    await expect(preview.getByRole("button", { name: /Apply reviewed import/ })).toHaveCount(0)

    const receiptId = required("SF_NATIVE_IMPORT_RECEIPT_MANIFEST_REF")
    await visit(page, origin, "/orchestra/sf-imports/" + token(receiptId) + "/receipt")
    const receipt = page.locator('[data-sf-leaf="u23"][data-sf-surface="UI57"]')
    await expect(receipt).toBeVisible()
    await receipt.getByRole("combobox").selectOption(surface)
    await receipt.getByRole("button", { name: /Refresh receipt/ }).click()
    await expect(receipt.locator('[data-sf-receipt="producer"]')).toBeVisible()
    await expect(receipt.getByRole("button", { name: /Apply reviewed import/ })).toHaveCount(0)
  })

  test("UI68 consumes actual byte exports and exposes one producer-backed download", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "U23-AC01; UI68 authorized byte download" })
    await visit(page, nativeHarness.manifest.target.shellOrigin, "/orchestra/sf-imports/exports")
    const leaf = page.locator('[data-sf-leaf="u23"][data-sf-surface="UI68"]')
    await expect(leaf).toBeVisible()
    await expect(leaf.getByRole("combobox")).toHaveValue("xlsx")
    await expect(leaf.locator('[data-sf-export="authorized-bytes"]')).toHaveCount(0)
    await page.getByRole("button", { name: /Exportar|Export/, exact: true }).click()
    const link = leaf.locator('[data-sf-export="authorized-bytes"]')
    await expect(link).toBeVisible()
    const downloaded = page.waitForEvent("download")
    await link.click()
    expect((await downloaded).suggestedFilename()).toMatch(/\.xlsx$/)
  })

  test("UI55 responsive source fields and actions remain reachable at all frozen widths", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "U23-AC03; 320/768/1024/1280/1440" })
    await visit(page, nativeHarness.manifest.target.shellOrigin, "/orchestra/sf-imports/new")
    const leaf = page.locator('[data-sf-leaf="u23"][data-sf-surface="UI55"]')
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(leaf.locator('input[type="file"]')).toBeVisible()
      await expect(leaf.getByRole("button", { name: /Find destinations/ })).toBeVisible()
      await noOverflow(page)
    }
  })
})
