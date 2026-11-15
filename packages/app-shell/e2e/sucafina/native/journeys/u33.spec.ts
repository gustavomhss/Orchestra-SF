import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture.ts"

function reportUrl(shellOrigin: string, chapterHref: string, ref: string): string {
  const url = new URL(chapterHref, shellOrigin)
  url.pathname = "/orchestra/sf-reviews/reports/r_" + Buffer.from(ref, "utf8").toString("base64url")
  return url.toString()
}

test("U33 shows the real preserved 25-record source and never fabricates an Office download", async ({ page, nativeHarness }) => {
  const ref = process.env.SF_N28_25ROW_REVIEW_REF
  if (!ref?.trim()) throw new Error("N28_REAL_25ROW_REVIEW_REQUIRED")
  const { target } = nativeHarness.manifest
  await page.goto(reportUrl(target.shellOrigin, target.chapterHref, ref))
  const report = page.locator('[data-sf-surface="UI50"]')
  await expect(report).toBeVisible()
  await expect(report.locator("[data-preserved-review]")).toHaveAttribute("data-preserved-review", ref)
  const records = await report.locator("[data-source-record-count]").evaluateAll((sections) =>
    sections.reduce((sum, section) => sum + Number(section.getAttribute("data-source-record-count") ?? 0), 0))
  expect(records, "The original producer, not a fixture summary, must cover at least 25 records").toBeGreaterThanOrEqual(25)
  await expect(report.locator("input[type=checkbox]").first()).toBeVisible()
  await expect(report.locator('a[download]')).toHaveCount(0)
  const action = page.getByRole("button", { name: /Generate report|Gerar relatório/ })
  if (await action.isEnabled()) await action.click()
  await expect(report.locator("[data-sf-file-unavailable]")).toBeVisible()
  await expect(report.locator('a[download]')).toHaveCount(0)
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(report.locator("[data-preserved-review]")).toBeVisible()
  }
  // Exact OOXML download, pagination, 25-row output and file provenance remain
  // BLOCKED_CONTRACT until the real Office producer is admitted by 125/120.
})
