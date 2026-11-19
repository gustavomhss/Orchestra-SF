import { expect, type Page, type TestInfo } from "@playwright/test"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
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
    ["Browser quote A", "32400 USD (base: 1)", "Browser quote A · USD 32400"],
    ["Browser quote B", "30240 USD (submitted FX: 1.08)", "Browser quote B · EUR 28000"],
    ["Browser quote C", "29000 USD (base: 1)", "Browser quote C · USD 29000"],
  ] as const
  for (const expected of quotes) {
    const row = table.getByRole("row").filter({ hasText: expected[0] })
    await expect(row).toHaveCount(1)
    await expect(row.getByRole("cell", { name: expected[1], exact: true })).toHaveCount(1)
    await expect(comparison.getByRole("combobox", { name: "Selected quotation", exact: true }).locator("option").filter({ hasText: expected[2] })).toHaveCount(1)
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
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  await expect(page.getByRole("status", { name: "Sourcing is not editable in the current request stage.", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Submit sourcing", exact: true })).toHaveCount(0)
  await page.goto("/orchestra/sf-procurement/requests")
  const queue = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Value basis", exact: true }) })
  await expect(queue).toHaveCount(1)
  const link = queue.getByRole("link", { name: id, exact: true })
  await expect(link).toHaveAttribute("href", `?request=${id}#${id}`)
  await expect(queue.getByRole("row").filter({ has: link }).getByRole("cell", { name: "pending-approval", exact: true })).toHaveCount(1)
  await link.click()
  await expect(page).toHaveURL((url) => url.searchParams.get("request") === id && decodeURIComponent(url.hash.slice(1)) === id)
  await expect(page.getByText("Current request value: 32400 USD; base value: 32400 USD; FX: 1 (base).", { exact: true })).toHaveCount(1)
  await observation(info, "operations-j04-comparison", { recordId: id, literalOracle: { selected: "A", originalB: "28000 EUR", submittedRateB: 1.08, baseB: "30240 USD", rank: ["A", "B"], premium: "2160 USD (7.14%)" }, c06MaterialConfirmation: "NOT_EXERCISED" })
}
