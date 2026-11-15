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

/**
 * Host-backed causal regressions. CI150 provisions reauthorized, distinct persisted reviews
 * and their exact environment references; these are not mock payloads or local-run assertions.
 * The installed provider must prove the data identities before reporting any PASS.
 */
async function openAuthorizedPair(
  page: import("@playwright/test").Page,
  target: { shellOrigin: string; chapterHref: string },
  previous: string,
  current: string,
) {
  expect(previous).not.toBe(current)
  await page.goto(nativeUrl(target, "/orchestra/sf-reviews/compare"))
  const comparison = page.locator('[data-sf-surface="UI49"]')
  await expect(comparison).toBeVisible()
  const fields = comparison.getByRole("textbox")
  await expect(fields).toHaveCount(2)
  await fields.nth(0).fill(previous)
  await fields.nth(1).fill(current)
  await comparison.getByRole("button", { name: /Read and compare authorized reviews|Ler e comparar revisões autorizadas/ }).click()
  return comparison
}

for (const boundary of ["INSTALLATION", "PROJECT"] as const) {
  test(`U32 does not join preserved financial values across ${boundary.toLowerCase()} scopes`, async ({ page, nativeHarness }) => {
    const previous = requiredRef(`SF_N28_${boundary}_BEFORE_REVIEW_REF`)
    const current = requiredRef(`SF_N28_${boundary}_AFTER_REVIEW_REF`)
    const comparison = await openAuthorizedPair(page, nativeHarness.manifest.target, previous, current)
    // Both independently readable but different scopes => incompatible; a revoked read => denied.
    await expect(page.locator('[data-sf-comparison-compatibility="incompatible"], [data-sf-surface="UI49"][data-sf-compare-state="denied"]')).toBeVisible()
    await expect(comparison.locator("[data-sf-comparison-diff]")).toHaveCount(0)
  })
}

test("U32 labels currency and evidence changes without attributing an FX or numeric change", async ({ page, nativeHarness }) => {
  const comparison = await openAuthorizedPair(page, nativeHarness.manifest.target,
    requiredRef("SF_N28_CURRENCY_BEFORE_REVIEW_REF"), requiredRef("SF_N28_CURRENCY_AFTER_REVIEW_REF"))
  await expect(comparison.locator("[data-sf-comparison-compatibility]")).toHaveAttribute(
    "data-sf-comparison-compatibility", "compatible")
  const id = requiredRef("SF_N28_CURRENCY_VALUE_ID")
  const row = comparison.locator("tr[data-sf-value-id]").filter({ has: page.getByText(id, { exact: true }) })
  await expect(row).toHaveCount(1)
  await expect(row).toHaveAttribute("data-change-value", "false")
  await expect(row).toHaveAttribute("data-change-numeric", "false")
  await expect(row).toHaveAttribute("data-change-attributes", "true")
  const cells = row.locator("td")
  await expect(cells.nth(0)).toContainText("100")
  await expect(cells.nth(0)).toContainText("USD")
  await expect(cells.nth(0)).toContainText("confirmed")
  await expect(cells.nth(1)).toContainText("100")
  await expect(cells.nth(1)).toContainText("EUR")
  await expect(cells.nth(1)).toContainText("estimated")
  await expect(row).toContainText(/Declared source completeness|Completude declarada da origem/)
})

test("U32 distinguishes zero, explicit null and an absent value without coercion", async ({ page, nativeHarness }) => {
  const comparison = await openAuthorizedPair(page, nativeHarness.manifest.target,
    requiredRef("SF_N28_ZERO_BEFORE_REVIEW_REF"), requiredRef("SF_N28_ZERO_AFTER_REVIEW_REF"))
  await expect(comparison.locator("[data-sf-comparison-compatibility]")).toHaveAttribute(
    "data-sf-comparison-compatibility", "compatible")
  const id = requiredRef("SF_N28_ZERO_VALUE_ID")
  const row = comparison.locator("tr[data-sf-value-id]").filter({ has: page.getByText(id, { exact: true }) })
  await expect(row).toHaveCount(1)
  await expect(row).toHaveAttribute("data-change-value", "true")
  await expect(row).toHaveAttribute("data-change-numeric", "false")
  const cells = row.locator("td")
  await expect(cells.nth(0).locator("strong")).toHaveText("0")
  await expect(cells.nth(1)).toContainText(/Explicit null value|Valor nulo explícito/)
})

test("U32 surfaces source-only revision, incarnation and observation without a value change", async ({ page, nativeHarness }) => {
  const comparison = await openAuthorizedPair(page, nativeHarness.manifest.target,
    requiredRef("SF_N28_SOURCE_BEFORE_REVIEW_REF"), requiredRef("SF_N28_SOURCE_AFTER_REVIEW_REF"))
  await expect(comparison.locator("[data-sf-comparison-compatibility]")).toHaveAttribute(
    "data-sf-comparison-compatibility", "compatible")
  const id = requiredRef("SF_N28_SOURCE_VALUE_ID")
  const row = comparison.locator("tr[data-sf-value-id]").filter({ has: page.getByText(id, { exact: true }) })
  await expect(row).toHaveCount(1)
  await expect(row).toHaveAttribute("data-change-value", "false")
  await expect(row).toHaveAttribute("data-change-numeric", "false")
  await expect(row).toHaveAttribute("data-change-source", "true")
  await expect(row).toContainText(/Source provenance changed|Proveniência da origem alterada/)
  await expect(row).toContainText(/Source revision|Revisão da origem/)
  await expect(row).toContainText(/Source incarnation|Encarnação da origem/)
  await expect(comparison.locator("[data-sf-comparison-diff]")).toBeVisible()
})

test("U32 also preserves an explicit null followed by recorded zero", async ({ page, nativeHarness }) => {
  const comparison = await openAuthorizedPair(page, nativeHarness.manifest.target,
    requiredRef("SF_N28_NULL_BEFORE_REVIEW_REF"), requiredRef("SF_N28_NULL_AFTER_REVIEW_REF"))
  await expect(comparison.locator("[data-sf-comparison-compatibility]")).toHaveAttribute(
    "data-sf-comparison-compatibility", "compatible")
  const id = requiredRef("SF_N28_NULL_VALUE_ID")
  const row = comparison.locator("tr[data-sf-value-id]").filter({ has: page.getByText(id, { exact: true }) })
  await expect(row).toHaveCount(1)
  await expect(row).toHaveAttribute("data-change-value", "true")
  await expect(row).toHaveAttribute("data-change-numeric", "false")
  const cells = row.locator("td")
  await expect(cells.nth(0)).toContainText(/Explicit null value|Valor nulo explícito/)
  await expect(cells.nth(1).locator("strong")).toHaveText("0")
})

test("U32 exposes source-only section observation changes without a fabricated delta", async ({ page, nativeHarness }) => {
  const comparison = await openAuthorizedPair(page, nativeHarness.manifest.target,
    requiredRef("SF_N28_SECTION_SOURCE_BEFORE_REVIEW_REF"),
    requiredRef("SF_N28_SECTION_SOURCE_AFTER_REVIEW_REF"))
  await expect(comparison.locator("[data-sf-comparison-compatibility]")).toHaveAttribute(
    "data-sf-comparison-compatibility", "compatible")
  const row = comparison.locator('tr[data-change-source="true"]').filter({
    has: page.getByRole("rowheader", { name: /Section source lineage|Linhagem das origens da seção/ }),
  })
  await expect(row).toHaveCount(1)
  const cells = row.locator("td")
  await expect(cells.nth(0)).toContainText(requiredRef("SF_N28_SECTION_SOURCE_BEFORE_OBSERVED_AT"))
  await expect(cells.nth(1)).toContainText(requiredRef("SF_N28_SECTION_SOURCE_AFTER_OBSERVED_AT"))
  await expect(row).toContainText(/Source incarnation|Encarnação da origem/)
  await expect(row).toContainText(/Source revision|Revisão da origem/)
  await expect(comparison.locator("[data-sf-comparison-diff]")).toBeVisible()
})
