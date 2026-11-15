import { expect, type Page } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

// Runs only against the C-matched, authenticated installed host. No fake
// "confirmed" evidence, no HTTP mocking and no speculative financial total.
test.describe("N27/U24 — native document/evidence/scenario journeys", () => {
  test.describe.configure({ retries: 0 })

  const required = (key: string) => {
    const value = process.env[key]
    if (!value?.trim()) throw new Error("U24_REAL_INSTALLED_SEED_REQUIRED:" + key)
    return value
  }
  const token = (ref: string) => "r_" + Buffer.from(ref, "utf8").toString("base64url")
  const visit = async (page: Page, origin: string, path: string) => {
    const url = new URL(path, origin)
    if (url.origin !== origin) throw new Error("U24_CROSS_OWNER_ROUTE_REJECTED")
    await page.goto(url.href)
  }
  const actualSurface = () => {
    const value = required("SF_NATIVE_DOCUMENT_SURFACE")
    if (value !== "dashboard" && value !== "procurement")
      throw new Error("U24_INVALID_REAL_SOURCE_SURFACE")
    return value
  }

  test("UI58 authorized document catalog does not expose unconfirmed business effects", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "U24-AC01; U24-AC02; UI58 search and source admission" })
    await visit(page, nativeHarness.manifest.target.shellOrigin, "/orchestra/sf-documents")
    const leaf = page.locator('[data-sf-leaf="u24"][data-sf-surface="UI58"]')
    await expect(leaf).toBeVisible()
    await expect(leaf.getByRole("searchbox")).toBeVisible()
    await expect(leaf.getByRole("button", { name: /Open document/ })).toBeDisabled()
    await expect(leaf.locator('[data-sf-confirmation="review"]')).toHaveCount(0)
    await expect(leaf.locator('[data-sf-scenario="preview"]')).toHaveCount(0)
  })

  test("UI59 extracted candidate requires opening the actual source before confirmation", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "U24-AC01; source text and explicit confirmation" })
    const documentRef = required("SF_NATIVE_DOCUMENT_REF")
    const candidateId = required("SF_NATIVE_DOCUMENT_EXTRACTED_CANDIDATE_ID")
    await visit(page, nativeHarness.manifest.target.shellOrigin,
      "/orchestra/sf-documents/" + token(documentRef) + "/evidence")
    const leaf = page.locator('[data-sf-leaf="u24"][data-sf-surface="UI59"]')
    await expect(leaf).toBeVisible()
    await leaf.getByRole("combobox").filter({ has: page.locator('option[value="' + actualSurface() + '"]') }).selectOption(actualSurface())
    await leaf.getByRole("button", { name: /Refresh sources/ }).click()
    const item = leaf.locator('[data-sf-evidence-id="' + candidateId + '"][data-sf-evidence-state="extracted"]')
    await expect(item).toBeVisible()
    await expect(item.getByRole("button", { name: /Confirm selection|Confirmar seleção/ })).toBeDisabled()
    await item.getByRole("button", { pressed: false }).filter({ hasText: /extracted/ }).click()
    await expect(leaf.getByRole("blockquote")).toHaveCount(0) // the source is presented as an element, not a role
    await expect(leaf.locator("blockquote")).toBeVisible()
    await item.getByRole("button", { name: /Confirm selection|Confirmar seleção/ }).click()
    await expect(leaf.locator('[data-sf-confirmation="review"]')).toBeVisible()
    await expect(leaf.locator('[data-sf-scenario="preview"]')).toHaveCount(0)
  })

  test("UI60 refuses scenario before a real confirmed evidenceRef and a chosen destination", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "U24-AC01; U24-AC02; same confirmed evidenceRef into Planner" })
    const documentRef = required("SF_NATIVE_DOCUMENT_REF")
    const candidateId = required("SF_NATIVE_DOCUMENT_CONFIRMED_CANDIDATE_ID")
    const surface = actualSurface()
    await visit(page, nativeHarness.manifest.target.shellOrigin,
      "/orchestra/sf-documents/" + token(documentRef) + "/scenario")
    const leaf = page.locator('[data-sf-leaf="u24"][data-sf-surface="UI60"]')
    await expect(leaf).toBeVisible()
    await leaf.getByRole("combobox").selectOption(surface)
    await leaf.getByRole("button", { name: /Refresh sources/ }).click()
    await expect(leaf.locator('[data-sf-scenario="preview"]')).toHaveCount(0)
    const confirmed = leaf.locator('[data-sf-evidence-id="' + candidateId + '"][data-sf-evidence-state="confirmed"]')
    await expect(confirmed).toBeVisible()
    await confirmed.getByRole("button", { name: /Use confirmed amount in a scenario/ }).click()
    await expect(leaf.getByRole("button", { name: /Preview scenario/ })).toBeDisabled()
    await expect(leaf.locator('[data-sf-scenario="preview"]')).toHaveCount(0)
  })

  test("UI58 at frozen widths remains navigable without clipping or horizontal scroll", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "U24-AC03; widths 320/768/1024/1280/1440" })
    await visit(page, nativeHarness.manifest.target.shellOrigin, "/orchestra/sf-documents")
    const leaf = page.locator('[data-sf-leaf="u24"][data-sf-surface="UI58"]')
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(leaf.getByRole("searchbox")).toBeVisible()
      await expect(leaf.getByRole("button", { name: /Search/, exact: true })).toBeVisible()
      const dimensions = await leaf.evaluate((node) => ({ width: node.clientWidth, full: node.scrollWidth }))
      expect(dimensions.full).toBeLessThanOrEqual(dimensions.width + 1)
    }
  })
})
