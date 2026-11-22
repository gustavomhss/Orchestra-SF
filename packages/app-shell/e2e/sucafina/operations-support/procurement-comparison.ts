import { expect, type Page, type TestInfo } from "@playwright/test"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { queueIdentity } from "./procurement"
import { login, observation, readManifest } from "./runtime"

/** Literal J04 oracle; no test-side scoring or currency formula. */
export async function procurementComparison(page: Page, info: TestInfo) {
  const account = await login(page, "first", "comparison")
  const manifest = await readManifest()
  const id = manifest.records.comparison
  expect(id).toMatch(/^PR-2026-\d+$/)
  const encoded = encodeSfRouteRef(id)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing/compare`)
  await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === `/orchestra/sf-procurement/requests/${encoded}/sourcing/compare`)
  const comparison = page.locator("section.sf-u12-comparison")
  const table = comparison.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Base amount / FX", exact: true }) })
  await expect(table).toHaveCount(1)
  await expect(table.getByRole("row")).toHaveCount(4)
  const quotes = [
    { label: "Browser quote A · USD 32400", cells: ["Browser quote A", "Eligible", "USD", "32400", "32400 USD (base: 1)", "87.0", "93.3", "89.3", "87.9", "1", ""] },
    { label: "Browser quote B · EUR 28000", cells: ["Browser quote B", "Eligible", "EUR", "28000", "30240 USD (submitted FX: 1.08)", "77.0", "100.0", "97.0", "85.0", "2", ""] },
    { label: "Browser quote C · USD 29000", cells: ["Browser quote C", "Not compliant", "USD", "29000", "29000 USD (base: 1)", "Unavailable", "Unavailable", "Unavailable", "Unavailable", "", "Technically ineligible"] },
  ] as const
  for (const expected of quotes) {
    const row = table.getByRole("row").filter({ has: page.getByRole("cell", { name: expected.cells[0], exact: true }) })
    await expect(row).toHaveCount(1)
    for (const [index, cell] of expected.cells.entries()) await expect(row.getByRole("cell").nth(index)).toHaveText(cell)
    await expect(comparison.getByRole("combobox", { name: "Selected quotation", exact: true }).locator("option").filter({ hasText: expected.label })).toHaveCount(1)
  }
  await expect(comparison.getByRole("status").filter({ hasText: "Rank 1: Browser quote A" })).toHaveText("Rank 1: Browser quote A")
  await expect(comparison.getByRole("status").filter({ hasText: "2160 USD (7.14%) above the lowest eligible proposal" })).toHaveText("2160 USD (7.14%) above the lowest eligible proposal")
  const selected = comparison.getByRole("combobox", { name: "Selected quotation", exact: true })
  await expect(selected.locator("option:checked")).toHaveText("Browser quote A · USD 32400")
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}`)
  const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  await expect(detail).toHaveCount(1)
  await expect(detail.locator("p").filter({ hasText: /^Request identity:/ })).toHaveText(`Request identity: ${id}`)
  await expect(detail.locator("p").filter({ hasText: /^Status:/ })).toHaveText("Status: src_pending")
  await expect(detail.locator("p").filter({ hasText: /^Current source version:/ })).toHaveText(/^Current source version: [1-9]\d*$/)
  await expect(detail.locator("[data-request-summary]")).toContainText("Sourcing approval")
  await expect(detail.locator("[data-request-summary]")).toContainText("32400 USD")
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  await expect(page.getByRole("status").filter({ hasText: /^Sourcing is not editable in the current request stage\.$/ })).toBeVisible()
  await expect(page.getByRole("button", { name: "Submit sourcing", exact: true })).toHaveCount(0)
  const queue = await queueIdentity(page, account, id, "Current request value: 32400 USD; base value: 32400 USD; FX: 1 (base).", "pending-approval")
  expect(queue).toMatchObject({ selectedQuoteId: "A", selectionJustification: "Recorded technical preference" })
  await observation(info, "operations-j04-comparison", { recordId: id, queue, literalOracle: { selected: "A", originalB: "28000 EUR", submittedRateB: 1.08, baseB: "30240 USD", rank: ["A", "B"], excluded: ["C"], premium: "2160 USD (7.14%)" }, c06MaterialConfirmation: "NOT_EXERCISED" })
}
