import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import { login, observation, readManifest } from "./runtime"
import { openRequest, queueIdentity } from "./procurement"

/** Literal J04 oracle; no test-side scoring or currency formula. */
export async function procurementComparison(page: Page, info: TestInfo) {
  const account = await login(page, "first", "comparison")
  const manifest = await readManifest()
  const id = manifest.records.comparison
  const detail = await openRequest(page, account, id)
  const sourcing = detail.locator('section[id="' + id + '-sourcing"]')
  const comparison = sourcing.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Base amount / FX", exact: true }) })
  await expect(comparison).toHaveCount(1)
  const proposals = [
    ["Browser quote A", "Eligible", "32400 USD", "32400 USD", "32400 USD (base: 1)", "87.0", "93.3", "89.3", "87.9", "1"],
    ["Browser quote B", "Eligible", "28000 EUR", "28000 EUR", "30240 USD (submitted FX: 1.08)", "77.0", "100.0", "97.0", "85.0", "2"],
    ["Browser quote C", "Not compliant", "29000 USD", "29000 USD", "29000 USD (base: 1)", "Unavailable", "Unavailable", "Unavailable", "Unavailable", "Unavailable"],
  ]
  for (const expected of proposals) {
    const row = comparison.getByRole("row").filter({ has: page.getByRole("cell", { name: expected[0]!, exact: true }) })
    await expect(row).toHaveCount(1)
    await expect(row.getByRole("cell")).toHaveText(expected)
  }
  await expect(comparison.getByRole("row")).toHaveCount(4)
  await expect(sourcing).toContainText("Rank 1: Browser quote A")
  await expect(sourcing).toContainText("2160 USD (7.14%) above the lowest eligible proposal")
  await expect(sourcing).toContainText("Selection: Browser quote A. Reason: Recorded technical preference")
  await expect(detail.locator("[data-request-summary]")).toContainText("Sourcing approval")
  await expect(detail.locator("[data-request-summary]")).toContainText("32400 USD")
  await expect(sourcing.getByRole("button", { name: "Submit sourcing", exact: true })).toBeDisabled()
  const queue = await queueIdentity(page, account, id, "32400 USD")
  const link = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Value basis", exact: true }) }).getByRole("link", { name: id, exact: true })
  const opened = page.waitForURL((url) => url.searchParams.get("request") === id && decodeURIComponent(url.hash.slice(1)) === id)
  await link.click()
  await opened
  await expect(page.locator('details[id="' + id + '"]')).toHaveAttribute("open", "")
  await expect(page.locator('[data-request-summary="' + id + '"]')).toContainText("32400 USD")
  await observation(info, "operations-j04-comparison", { recordId: id, queue, literalOracle: { selected: "A", originalB: "28000 EUR", submittedRateB: 1.08, baseB: "30240 USD", rank: ["A", "B"], excluded: ["C"], premium: "2160 USD (7.14%)" }, c06MaterialConfirmation: "NOT_EXERCISED" })
}
