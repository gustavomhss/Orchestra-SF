import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture.ts"

/** The runner supplies real producer references, never synthetic review payloads. */
function requiredRef(name: string): string {
  const value = process.env[name]
  if (!value || !value.trim()) throw new Error("N28_REAL_PRESERVED_REFERENCE_REQUIRED: " + name)
  return value
}

function nativeUrl(target: { shellOrigin: string; chapterHref: string }, pathname: string): string {
  const url = new URL(target.chapterHref, target.shellOrigin)
  url.pathname = pathname
  return url.toString()
}

test("U32 reads the original preserved review and shows exact identity and section sequence", async ({ page, nativeHarness }) => {
  const ref = requiredRef("SF_N28_PRESERVED_REVIEW_REF")
  const segment = "r_" + Buffer.from(ref, "utf8").toString("base64url")
  await page.goto(nativeUrl(nativeHarness.manifest.target, "/orchestra/sf-reviews/reviews/" + segment))
  const review = page.locator('[data-sf-surface="UI48"]')
  await expect(review).toBeVisible()
  const source = review.locator("[data-review-ref]")
  await expect(source).toHaveAttribute("data-review-ref", ref)
  await expect(source).toHaveAttribute("data-review-version", /^[0-9]+$/)
  await expect(source.locator("[data-section-id]").first()).toBeVisible()
  for (const width of [320, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(source).toBeVisible()
  }
  await page.getByRole("button", { name: /Present review|Apresentar revisão/ }).click()
  await expect(review).toHaveAttribute("data-sf-presentation", "true")
  await expect(source).toBeVisible()
})

test("U32 compares two producer-reopened reviews without inventing totals", async ({ page, nativeHarness }) => {
  const previous = requiredRef("SF_N28_PREVIOUS_REVIEW_REF")
  const current = requiredRef("SF_N28_CURRENT_REVIEW_REF")
  expect(previous).not.toBe(current)
  await page.goto(nativeUrl(nativeHarness.manifest.target, "/orchestra/sf-reviews/compare"))
  const comparison = page.locator('[data-sf-surface="UI49"]')
  await expect(comparison).toBeVisible()
  const fields = comparison.getByRole("textbox")
  await expect(fields).toHaveCount(2)
  await fields.nth(0).fill(previous)
  await fields.nth(1).fill(current)
  await comparison.getByRole("button", { name: /Read and compare authorized reviews|Ler e comparar revisões autorizadas/ }).click()
  const proof = comparison.locator("[data-sf-comparison-compatibility]")
  await expect(proof).toHaveAttribute("data-sf-comparison-compatibility", /^(compatible|incompatible)$/)
  // Compatible snapshots show only saved source fields and recorded versions.
  // An incompatible result is explicit; neither path calculates financial deltas.
})
