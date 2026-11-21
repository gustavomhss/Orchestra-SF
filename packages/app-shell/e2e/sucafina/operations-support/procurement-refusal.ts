import { randomUUID } from "node:crypto"
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { login, observation, readManifest } from "./runtime"
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
  await confirmCommand(page, account, "submit_pr", id, detail.getByRole("button", { name: "Submit requisition", exact: true }), "Confirm action")
  await approveRequest(page, account, id)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  await page.getByRole("textbox", { name: "Evaluator", exact: true }).fill("Synthetic Operations evaluator")
  await page.getByRole("textbox", { name: "Fewer quotations justification", exact: true }).fill("Isolated quotation for an unavailable FX refusal")
  await page.getByRole("textbox", { name: "Selection justification", exact: true }).fill("Selected quotation still requires a configured FX rate")
  const quote = page.locator("fieldset.sf-u12-quote").first()
  await quote.getByRole("textbox", { name: "Supplier", exact: true }).fill("Journey registered supplier")
  await quote.getByRole("combobox", { name: "Registered supplier", exact: true }).selectOption(supplier)
  await quote.getByRole("textbox", { name: "Currency", exact: true }).fill("JPY")
  await quote.getByRole("spinbutton", { name: "Stated total", exact: true }).fill("28000")
  await quote.getByRole("spinbutton", { name: "Quantity", exact: true }).fill("1")
  await quote.getByRole("spinbutton", { name: "Unit price", exact: true }).fill("28000")
  await fillEnabledScores(quote)
  await confirmCommand(page, account, "save", id, page.getByRole("button", { name: "Save sourcing", exact: true }), "Confirm once")
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
  await expect(comparison.getByRole("status", { name: "Comparison is limited: fewer than two proposals are eligible.", exact: true })).toBeVisible()
  const winning = comparison.getByRole("combobox", { name: "Selected quotation", exact: true })
  await winning.selectOption({ label: "Journey registered supplier · JPY 28000" })
  const selected = await confirmCommand(page, account, "select_quote", id, comparison.getByRole("button", { name: "Select winning quote", exact: true }), "Confirm once")
  expect(selected.request().postDataJSON()).toMatchObject({ values: { quoteId } })
  await page.getByRole("button", { name: "Sourcing", exact: true }).click()
  const version = await sourceVersion(page)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/history`)
  const history = page.locator(`article[data-sf-request-ref="${id}"] [data-stage="history"]`).getByRole("listitem")
  const historyText = await history.allTextContents()
  expect(historyText.length).toBeGreaterThan(0)
  const summary = await page.locator(`article[data-sf-request-ref="${id}"] p`).filter({ hasText: /^Status:/ }).innerText()
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  const pending = commandResponse(page, account.origin, "submit_sourcing", id)
  await page.getByRole("button", { name: "Submit sourcing", exact: true }).click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await review.getByRole("button", { name: "Confirm once", exact: true }).click()
  const rejected = await pending
  const producer = "Quote 1: no FX rate defined for JPY (Settings → Currencies)"
  const alert = "sourcing.quotes.0.currency: " + producer
  expect(rejected.status()).toBe(422)
  expect(rejected.request().postDataJSON()).toMatchObject({ page: "Requests", action: "submit_sourcing", id, version: Number(version) })
  expect(await rejected.json()).toMatchObject({ ok: false, errors: [producer], fieldErrors: [{ field: "sourcing.quotes.0.currency", message: producer }] })
  await expect(page.getByRole("alert").filter({ hasText: alert })).toHaveText(alert)
  await expect(page.getByRole("alert", { name: "The producer did not accept this operation.", exact: true })).toBeVisible()
  const currency = page.locator("fieldset.sf-u12-quote").first().getByRole("textbox", { name: "Currency", exact: true })
  await expect(currency).toHaveValue("JPY")
  await expect(currency).toHaveAttribute("aria-invalid", "true")
  await expect(currency).toHaveAttribute("aria-describedby", "sf-u12-currency-0")
  await expect(page.locator("#sf-u12-currency-0")).toHaveText(producer)
  await expect(currency).toHaveAccessibleDescription(producer)
  await expect(page.locator(".sf-u12-heading p")).toHaveText("Stage: sourcing · Source version: " + version)
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
  await expect(page.getByRole("button", { name: "Approve current step", exact: true })).toHaveCount(0)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  await expect(page.locator(".sf-u12-heading p")).toHaveText("Stage: sourcing · Source version: " + version)
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
  await confirmCommand(page, account, "create", undefined, form.getByRole("button", { name: "Create request", exact: true }), "Confirm action")
  const row = page.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name: title, exact: true }) })
  await expect(row).toHaveCount(1)
  const id = (await row.getAttribute("data-sf-row")) ?? ""
  expect(id).toMatch(/^PR-2026-\d+$/)
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
  const pending = commandResponse(page, account.origin, "approve", id)
  await review.getByRole("button", { name: "Approve PR", exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  expect(response.request().postDataJSON()).toMatchObject({ page: "My approvals", action: "approve", id, values: { comment: "Operations missing FX approval" } })
}

async function confirmCommand(page: Page, account: Account, action: string, id: string | undefined, openReview: Locator, confirmName: string) {
  await expect(openReview).toBeEnabled()
  await openReview.click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  const pending = commandResponse(page, account.origin, action, id)
  await expect(review.getByRole("button", { name: confirmName, exact: true })).toBeEnabled()
  await review.getByRole("button", { name: confirmName, exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  expect(response.request().postDataJSON()).toMatchObject({ page: "Requests", action, ...(id ? { id } : {}) })
  return response
}

function commandResponse(page: Page, origin: string, action: string, id?: string) {
  return page.waitForResponse((response) => {
    const request = response.request()
    const url = new URL(request.url())
    if (request.method() !== "POST" || url.origin !== origin || url.pathname !== "/sucafina/procurement") return false
    const body = request.postDataJSON() as { action?: string; id?: string }
    return body.action === action && (id === undefined || body.id === id)
  })
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
  const line = page.locator(".sf-u12-heading p")
  await expect(line).toHaveText(/^Stage: \S+ · Source version: [1-9]\d*$/)
  return (await line.innerText()).replace(/^Stage: \S+ · Source version: /, "")
}
