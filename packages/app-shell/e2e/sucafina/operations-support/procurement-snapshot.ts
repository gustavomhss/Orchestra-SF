import { randomUUID } from "node:crypto"
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { login, observation, readManifest } from "./runtime"
import type { Account } from "./runtime"

export async function sourcingSnapshot(page: Page, info: TestInfo) {
  const account = await login(page, "first", "settings")
  const supplier = (await readManifest()).records.supplier
  const title = "Operations EUR snapshot " + randomUUID()
  const id = await createRequest(page, account, title)
  const encoded = encodeSfRouteRef(id)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}`)
  const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  await expect(detail).toHaveCount(1)
  await confirmCommand(page, account, "submit_pr", id, detail.getByRole("button", { name: "Submit requisition", exact: true }), "Confirm action")
  await approveRequest(page, account, id)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  await page.getByRole("textbox", { name: "Evaluator", exact: true }).fill("Synthetic Operations evaluator")
  await page.getByRole("textbox", { name: "Fewer quotations justification", exact: true }).fill("Isolated single-quote snapshot regression; comparison remains limited")
  await page.getByRole("textbox", { name: "Selection justification", exact: true }).fill("Review the EUR quotation with the current holder")
  const quote = page.locator("fieldset.sf-u12-quote").first()
  await quote.getByRole("textbox", { name: "Supplier", exact: true }).fill("Journey registered supplier")
  await quote.getByRole("combobox", { name: "Registered supplier", exact: true }).selectOption(supplier)
  await quote.getByRole("textbox", { name: "Currency", exact: true }).fill("EUR")
  await quote.getByRole("spinbutton", { name: "Stated total", exact: true }).fill("28000")
  await quote.getByRole("spinbutton", { name: "Quantity", exact: true }).fill("1")
  await quote.getByRole("spinbutton", { name: "Unit price", exact: true }).fill("28000")
  await fillEnabledScores(quote)
  await confirmCommand(page, account, "save", id, page.getByRole("button", { name: "Save sourcing", exact: true }), "Confirm once")
  await expect(page.getByRole("textbox", { name: "Selection justification", exact: true })).toHaveValue("Review the EUR quotation with the current holder")
  await page.getByRole("button", { name: "Compare quotations", exact: true }).click()
  const comparison = page.locator("section.sf-u12-comparison")
  await expect(comparison.getByRole("status", { name: "Comparison is limited: fewer than two proposals are eligible.", exact: true })).toBeVisible()
  const winning = comparison.getByRole("combobox", { name: "Selected quotation", exact: true })
  await winning.selectOption({ label: "Journey registered supplier · EUR 28000" })
  await confirmCommand(page, account, "select_quote", id, comparison.getByRole("button", { name: "Select winning quote", exact: true }), "Confirm once")
  const order = page.locator("section").filter({ has: page.getByRole("button", { name: "Submit purchase order", exact: true }) })
  await expect(order).toHaveCount(1)
  await expect(order.getByRole("textbox", { name: "Supplier", exact: true })).toHaveValue("Journey registered supplier")
  await expect(order.getByRole("textbox", { name: "Currency", exact: true })).toHaveValue("EUR")
  await expect(order.getByRole("spinbutton", { name: "Unit price", exact: true })).toHaveValue("28000")
  await expect(order.getByRole("button", { name: "Submit purchase order", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Sourcing", exact: true }).click()
  await confirmCommand(page, account, "submit_sourcing", id, page.getByRole("button", { name: "Submit sourcing", exact: true }), "Confirm once")
  await expect(page.locator(".sf-u12-heading p")).toHaveText(/^Stage: src_pending · Source version: [1-9]\d*$/)
  const pendingVersion = (await page.locator(".sf-u12-heading p").innerText()).replace("Stage: src_pending · Source version: ", "")
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}`)
  await expect(detail.locator("p").filter({ hasText: /^Status:/ })).toHaveText("Status: src_pending")
  await expect(detail.locator(`p[data-request-summary="${id}"]`)).toContainText("Sourcing approval")
  await expect(detail.locator(`p[data-request-summary="${id}"]`)).toContainText("30240 USD")
  await expect(detail.locator(`p[data-request-money="${id}"]`)).toHaveText("Current request value: 28000 EUR; base value: 30240 USD; FX: 1.08 (submitted).")
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing/compare`)
  const frozen = page.locator("section.sf-u12-comparison")
  await expect(frozen.getByRole("row").filter({ hasText: "Journey registered supplier" }).getByRole("cell", { name: "30240 USD (submitted FX: 1.08)", exact: true })).toHaveCount(1)
  await expect(frozen.getByRole("status", { name: "Comparison is limited: fewer than two proposals are eligible.", exact: true })).toBeVisible()
  const original = await setEurRate(page, account, "2")
  try {
    expect(original).toBe("1.08")
    await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
    await expect(page.locator(".sf-u12-heading p")).toHaveText("Stage: src_pending · Source version: " + pendingVersion)
    await expect(page.locator(`p[data-request-summary="${id}"]`)).toContainText("Sourcing approval")
    await expect(page.locator(`p[data-request-summary="${id}"]`)).toContainText("30240 USD")
    await expect(page.locator(`p[data-request-money="${id}"]`)).toHaveText("Current request value: 28000 EUR; base value: 30240 USD; FX: 1.08 (submitted).")
    await expect(page.getByRole("status", { name: "Estimate value: 28000 EUR; base value: 56000 USD; FX: 2 (current).", exact: true })).toBeVisible()
    await expect(page.getByRole("status", { name: "Order value 56000 USD; approved sourcing value 30240 USD. Review the difference.", exact: true })).toBeVisible()
    await expect(page.getByRole("status", { name: "Sourcing is not editable in the current request stage.", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Submit sourcing", exact: true })).toHaveCount(0)
    await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing/compare`)
    await expect(page.locator("section.sf-u12-comparison").getByRole("cell", { name: "30240 USD (submitted FX: 1.08)", exact: true })).toHaveCount(1)
    await page.reload()
    await expect(page.locator(".sf-u12-heading p")).toHaveText("Stage: src_pending · Source version: " + pendingVersion)
    await expect(page.locator(`p[data-request-money="${id}"]`)).toHaveText("Current request value: 28000 EUR; base value: 30240 USD; FX: 1.08 (submitted).")
    await expect(page.locator("section.sf-u12-comparison").getByRole("cell", { name: "30240 USD (submitted FX: 1.08)", exact: true })).toHaveCount(1)
    await observation(info, "operations-sourcing-frozen-fx", { recordId: id, domainVersion: pendingVersion, pendingSourcing: { original: 28000, currency: "EUR", rate: 1.08, baseAmount: 30240, state: "src_pending" }, futurePo: { baseAmount: 56000, rate: 2, submitted: false }, c06MaterialConfirmation: "BLOCKED_DEPENDENCY" })
  } finally {
    await setEurRate(page, account, original)
  }
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
  await page.getByRole("textbox", { name: "Approval comment (optional)", exact: true }).fill("Operations snapshot approval")
  const pending = commandResponse(page, account.origin, "approve", id)
  await review.getByRole("button", { name: "Approve PR", exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  expect(response.request().postDataJSON()).toMatchObject({ page: "My approvals", action: "approve", id, values: { comment: "Operations snapshot approval" } })
}

async function confirmCommand(page: Page, account: Account, action: string, id: string | undefined, openReview: Locator, confirmName: string) {
  await expect(openReview).toBeEnabled()
  await openReview.click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  const pending = commandResponse(page, account.origin, action, id)
  const confirm = review.getByRole("button", { name: confirmName, exact: true })
  await expect(confirm).toBeEnabled()
  await confirm.click()
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

async function setEurRate(page: Page, account: Account, value: string) {
  await page.goto("/orchestra/sf-procurement/settings")
  const settings = page.locator("form.sf-n21-settings-form")
  await expect(settings).toHaveCount(1)
  const code = settings.locator("#sf-u36-fx-code-1")
  const rate = settings.locator("#sf-u36-fx-rate-1")
  await expect(code).toHaveValue("EUR")
  const original = await rate.inputValue()
  const version = Number(await settings.getAttribute("data-version"))
  expect(Number.isSafeInteger(version)).toBe(true)
  await rate.fill(value)
  const pending = commandResponse(page, account.origin, "save")
  await settings.getByRole("button", { name: "Review changes", exact: true }).click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await review.getByRole("button", { name: "Save", exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toMatchObject({ page: "Settings", action: "save", version })
  expect(await response.json()).toMatchObject({ ok: true })
  await expect(settings).toHaveAttribute("data-version", String(version + 1))
  await page.reload()
  await expect(page.locator("#sf-u36-fx-rate-1")).toHaveValue(value)
  return original
}
