import { randomUUID } from "node:crypto"
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { captureProcurementCommand, login, observation, readManifest } from "./runtime"
import type { Account } from "./runtime"

export async function missingFxRefusal(page: Page, info: TestInfo) {
  const account = await login(page, "first", "validation")
  const supplier = (await readManifest()).records.supplier
  const title = "Operations missing FX " + randomUUID()
  const id = await createRequest(page, account, title)
  const encoded = encodeSfRouteRef(id)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}`)
  const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  await expect(detail).toHaveCount(1)
  await expect(detail.getByRole("heading", { name: title, exact: true })).toBeVisible()
  await expect(detail.getByText(`Request identity: ${id}`, { exact: true })).toBeVisible()
  await expect(detail.getByText("Status: draft", { exact: true })).toBeVisible()
  await expect(detail.getByText("Current source version: 1", { exact: true })).toBeVisible()
  await confirmCommand(page, account, "submit_pr", id, detail.getByRole("button", { name: "Submit requisition", exact: true }), "Confirm action")
  await approveRequest(page, account, id)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  await page.getByRole("textbox", { name: "Evaluator", exact: true }).fill("Synthetic Operations evaluator")
  await page.getByRole("textbox", { name: "Fewer quotations justification", exact: true }).fill("Isolated quotation for an unavailable FX refusal")
  await page.getByRole("textbox", { name: "Selection justification", exact: true }).fill("Selected quotation still requires a configured FX rate")
  await page.getByRole("button", { name: "Add quotation", exact: true }).click()
  const quote = page.locator("fieldset.sf-u12-quote").first()
  await quote.getByRole("textbox", { name: "Supplier", exact: true }).fill("Journey registered supplier")
  await quote.getByRole("combobox", { name: "Registered supplier", exact: true }).selectOption(supplier)
  await quote.getByRole("textbox", { name: "Currency", exact: true }).fill("JPY")
  await quote.getByRole("spinbutton", { name: "Stated total", exact: true }).fill("28000")
  await quote.getByRole("spinbutton", { name: "Quantity", exact: true }).fill("1")
  await quote.getByRole("spinbutton", { name: "Unit price", exact: true }).fill("28000")
  await fillEnabledScores(quote)
  const saveVersion = Number(await sourceVersion(page))
  const confirmSave = await openCommandReview(page, page.getByRole("button", { name: "Save sourcing", exact: true }), "Confirm once")
  const saved = await captureProcurementCommand(page, account, confirmSave, {
    page: "Requests", action: "save", id, version: saveVersion,
    values: { sourcing: { quotes: [{ supplierId: supplier, currency: "JPY", total: 28000 }] } },
  })
  expect(saved.status).toBe(200)
  expect(saved.body).toMatchObject({ ok: true })
  await expect(page.locator("[data-sf-sourcing-stage]")).toHaveText("Stage: sourcing · Source version: " + (saveVersion + 1))
  await expect(page.getByRole("textbox", { name: "Selection justification", exact: true })).toHaveValue("Selected quotation still requires a configured FX rate")
  const quoteId = ((await page.locator("fieldset.sf-u12-quote legend").first().innerText()).split(" · ")[1] ?? "").trim()
  expect(quoteId).not.toBe("")
  expect(quoteId).not.toBe("Unavailable")
  await page.getByRole("button", { name: "Compare quotations", exact: true }).click()
  const comparison = page.locator("section.sf-u12-comparison")
  const row = comparison.getByRole("row").filter({ hasText: "Journey registered supplier" })
  await expect(row).toHaveCount(1)
  const cells = row.getByRole("cell")
  await expect(cells.nth(1)).toHaveText("Unavailable: monetary data")
  await expect(cells.nth(2)).toHaveText("JPY")
  await expect(cells.nth(3)).toHaveText("28000")
  await expect(row.getByRole("cell", { name: "Unavailable (fx-missing)", exact: true })).toHaveCount(1)
  await expect(cells.nth(5)).toHaveText("Unavailable")
  await expect(cells.nth(6)).toHaveText("Unavailable")
  await expect(cells.nth(7)).toHaveText("Unavailable")
  await expect(cells.nth(8)).toHaveText("Unavailable")
  await expect(cells.nth(9)).toHaveText("")
  await expect(cells.nth(10)).toHaveText("Monetary issue: fx-missing")
  await expect(comparison.getByRole("status").filter({ hasText: /^Comparison is limited: fewer than two proposals are eligible\.$/ })).toBeVisible()
  const winning = comparison.getByRole("combobox", { name: "Selected quotation", exact: true })
  await winning.selectOption({ label: "Journey registered supplier · JPY 28000" })
  const selected = await confirmCommand(page, account, "select_quote", id, comparison.getByRole("button", { name: "Select winning quote", exact: true }), "Confirm once")
  expect(selected.command).toMatchObject({ values: { quoteId } })
  await page.getByRole("button", { name: "Sourcing", exact: true }).click()
  const version = await sourceVersion(page)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/history`)
  const history = page.locator(`article[data-sf-request-ref="${id}"] [data-stage="history"]`).getByRole("listitem")
  await expect(history.first()).toBeVisible()
  const historyText = await history.allTextContents()
  expect(historyText.length).toBeGreaterThan(0)
  const summary = await page.locator(`article[data-sf-request-ref="${id}"] p`).filter({ hasText: /^Status:/ }).innerText()
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  const confirmSubmit = await openCommandReview(page, page.getByRole("button", { name: "Submit sourcing", exact: true }), "Confirm once")
  const rejected = await captureProcurementCommand(page, account, confirmSubmit, {
    page: "Requests", action: "submit_sourcing", id, version: Number(version),
  })
  const producer = "Quote 1: no FX rate defined for JPY (Settings → Currencies)"
  const alert = "sourcing.quotes.0.currency: " + producer
  expect(rejected.status).toBe(422)
  expect(rejected.body).toMatchObject({ ok: false, errors: [producer], fieldErrors: [{ field: "sourcing.quotes.0.currency", message: producer }] })
  await expect(page.getByRole("alert").filter({ hasText: alert })).toHaveText(alert)
  await expect(page.getByRole("alert").filter({ hasText: /^The producer did not accept this operation\.$/ })).toBeVisible()
  const currency = page.locator("fieldset.sf-u12-quote").first().getByRole("textbox", { name: "Currency", exact: true })
  await expect(currency).toHaveValue("JPY")
  await expect(currency).toHaveAttribute("aria-invalid", "true")
  await expect(currency).toHaveAttribute("aria-describedby", "sf-u12-currency-0")
  await expect(page.locator("#sf-u12-currency-0")).toHaveText(producer)
  await expect(currency).toHaveAccessibleDescription(producer)
  await expect(page.locator("[data-sf-sourcing-stage]")).toHaveText("Stage: sourcing · Source version: " + version)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}`)
  await expect(page.locator(`article[data-sf-request-ref="${id}"] p`).filter({ hasText: /^Status:/ })).toHaveText(summary)
  await expect(page.locator(`article[data-sf-request-ref="${id}"] p`).filter({ hasText: /^Status:/ })).toHaveText("Status: sourcing")
  await expect(page.locator(`article[data-sf-request-ref="${id}"] p[data-request-summary="${id}"]`)).toContainText("Value unavailable")
  await expect(page.locator(`article[data-sf-request-ref="${id}"] p[data-request-summary="${id}"]`)).not.toContainText("Sourcing approval")
  await expect(page.locator(`article[data-sf-request-ref="${id}"] p[data-request-money="${id}"]`)).toHaveText("Current request value: 28000 JPY; base value: Unavailable; FX: Unavailable.")
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/history`)
  await expect(page.locator(`article[data-sf-request-ref="${id}"] [data-stage="history"]`).getByRole("listitem")).toHaveText(historyText)
  await page.goto(`/orchestra/sf-procurement/approvals/${encoded}/review`)
  await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === `/orchestra/sf-procurement/approvals/${encoded}/review`)
  await expect(page.getByText(/^(This record is not a submitted PR awaiting approval|The requested approval was not found)\.$/)).toBeVisible()
  await expect(page.getByRole("button", { name: "Approve PR", exact: true })).toHaveCount(0)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  await expect(page.locator("[data-sf-sourcing-stage]")).toHaveText("Stage: sourcing · Source version: " + version)
  await expect(page.locator("fieldset.sf-u12-quote legend").first()).toContainText(quoteId)
  await expect(page.locator("fieldset.sf-u12-quote").first().getByRole("combobox", { name: "Registered supplier", exact: true })).toHaveValue(supplier)
  await page.getByRole("button", { name: "Compare quotations", exact: true }).click()
  await expect(page.getByRole("combobox", { name: "Selected quotation", exact: true })).toHaveValue(quoteId)
  await observation(info, "operations-missing-fx-refusal", { recordId: id, quoteId, supplierId: supplier, domainVersion: version, refusal: { status: 422, field: "sourcing.quotes.0.currency", message: producer }, submitted: false })
}

async function createRequest(page: Page, account: Account, title: string) {
  const form = page.locator('form[data-command="create"][data-page="Requests"]')
  await expect(form).toHaveCount(1)
  await form.getByRole("textbox", { name: "Title", exact: true }).fill(title)
  await form.getByRole("combobox", { name: "Type", exact: true }).selectOption("service")
  await form.getByRole("textbox", { name: "Description", exact: true }).fill("Isolated Operations sourcing scope")
  await form.getByRole("spinbutton", { name: "Estimated amount", exact: true }).fill("100")
  await form.getByRole("textbox", { name: "Cost center", exact: true }).fill("Synthetic IT")
  await form.getByLabel("Needed by", { exact: true }).fill("2026-12-01")
  await form.getByRole("textbox", { name: "Justification", exact: true }).fill("Operations fixture only")
  const confirm = await openCommandReview(page, form.getByRole("button", { name: "Create request", exact: true }), "Confirm action")
  const created = await captureProcurementCommand(page, account, confirm, {
    page: "Requests", action: "create", version: 0, values: { pr: { title } },
  })
  expect(created.status).toBe(200)
  expect(created.body).toMatchObject({ ok: true })
  // The acknowledgement has no ID. Reopen the authorized list without re-submitting.
  expect((await page.goto("/orchestra/sf-procurement/requests"))?.status()).toBe(200)
  const requests = page.getByRole("table", { name: "Requests", exact: true })
  await expect(requests).toHaveCount(1)
  const row = requests.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name: title, exact: true }) })
  await expect(row).toHaveCount(1)
  const id = (await row.getAttribute("data-sf-row")) ?? ""
  expect(id).toMatch(/^PR-2026-\d+$/)
  await expect(requests.locator(`tr[data-sf-row="${id}"]`)).toHaveCount(1)
  await expect(row.getByText(id, { exact: true })).toBeVisible()
  return id
}

async function approveRequest(page: Page, account: Account, id: string) {
  const encoded = encodeSfRouteRef(id)
  await page.goto(`/orchestra/sf-procurement/approvals/${encoded}`)
  await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === `/orchestra/sf-procurement/approvals/${encoded}`)
  await page.getByRole("button", { name: "Review decision", exact: true }).click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await page.getByRole("textbox", { name: "Approval comment (optional)", exact: true }).fill("Operations missing FX approval")
  const approved = await captureProcurementCommand(page, account, review.getByRole("button", { name: "Approve PR", exact: true }), {
    page: "My approvals", action: "approve", id, values: { comment: "Operations missing FX approval" },
  })
  expect(approved.status).toBe(200)
  expect(approved.body).toMatchObject({ ok: true })
}

async function confirmCommand(page: Page, account: Account, action: string, id: string | undefined, openReview: Locator, confirmName: string) {
  const confirm = await openCommandReview(page, openReview, confirmName)
  const response = await captureProcurementCommand(page, account, confirm, { page: "Requests", action, id })
  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({ ok: true })
  return response
}

async function openCommandReview(page: Page, openReview: Locator, confirmName: string) {
  await expect(openReview).toBeEnabled()
  await openReview.click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  const confirm = review.getByRole("button", { name: confirmName, exact: true })
  await expect(confirm).toBeEnabled()
  return confirm
}

async function fillEnabledScores(quote: Locator) {
  for (const name of ["Technical scores", "Commercial scores"]) {
    const section = quote.locator("section").filter({ has: quote.page().getByRole("heading", { name, exact: true }) })
    const scores = section.getByRole("spinbutton")
    const count = await scores.count()
    for (let index = 0; index < count; index++) {
      const input = scores.nth(index)
      if (await input.isEnabled()) await input.fill("4")
    }
  }
}

async function sourceVersion(page: Page) {
  const line = page.locator("[data-sf-sourcing-stage]")
  await expect(line).toHaveText(/^Stage: \S+ · Source version: [1-9]\d*$/)
  return (await line.innerText()).replace(/^Stage: \S+ · Source version: /, "")
}
