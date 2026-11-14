import { randomUUID } from "node:crypto"
import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import { login, observation, readManifest } from "./runtime"
import { commandResponse, createDraft, openRequest, queueIdentity, requestAction } from "./procurement"

export async function missingFxRefusal(page: Page, info: TestInfo) {
  const account = await login(page, "first", "validation")
  const supplier = (await readManifest()).records.supplier
  const id = await createDraft(page, account, "Operations missing FX " + randomUUID())
  const detail = page.locator('details[id="' + id + '"]')
  await requestAction(page, id, detail.locator('section[id="' + id + '-pr"] form[data-command="submit_pr"]'), "Submit requisition")
  await requestAction(page, id, detail.locator('form[data-command="approve"]'), "Approve")
  const sourcing = detail.locator('section[id="' + id + '-sourcing"]')
  const form = sourcing.locator('form[data-command="save"]')
  await form.getByRole("textbox", { name: "Technical evaluator", exact: true }).fill("Synthetic Operations evaluator")
  await form.getByRole("textbox", { name: "Fewer quotations justification", exact: true }).fill("Isolated quotation for an unavailable FX refusal")
  await form.getByRole("textbox", { name: "Selection justification", exact: true }).fill("Selected quotation still requires a configured FX rate")
  await form.locator('[name="sourcing.quotes.0.supplier"]').fill("Journey registered supplier")
  await form.locator('[name="sourcing.quotes.0.supplierId"]').selectOption(supplier)
  // JPY is absent from the real initial settings. The test does not add a rate or compute a substitute.
  await form.locator('[name="sourcing.quotes.0.currency"]').fill("JPY")
  await form.locator('[name="sourcing.quotes.0.total"]').fill("28000")
  await form.locator('[name="sourcing.quotes.0.qty"]').fill("1")
  await form.locator('[name="sourcing.quotes.0.unitPrice"]').fill("28000")
  for (const index of [0, 1, 2, 3, 4]) await form.locator(`[name="sourcing.quotes.0.scores.${index}"]`).fill("4")
  for (const index of [1, 2]) await form.locator(`[name="sourcing.quotes.0.cscores.${index}"]`).fill("4")
  await requestAction(page, id, form, "Save sourcing")
  const quoteId = await form.locator('[name="sourcing.quotes.0.id"]').inputValue()
  expect(quoteId).not.toBe("")
  const selection = sourcing.locator('form[data-command="select_quote"]')
  await selection.getByRole("combobox", { name: "Winning quote", exact: true }).selectOption({ label: "Journey registered supplier · JPY 28000" })
  const selected = await requestAction(page, id, selection, "Select quote")
  expect(selected.request().postDataJSON()).toMatchObject({ values: { quoteId } })
  const comparison = sourcing.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Base amount / FX", exact: true }) })
  const quote = comparison.getByRole("row").filter({ has: page.getByRole("cell", { name: "Journey registered supplier", exact: true }) })
  await expect(quote).toHaveCount(1)
  await expect(quote.getByRole("cell")).toHaveText([
    "Journey registered supplier", "Unavailable: monetary data", "28000 JPY", "28000 JPY", "Unavailable (fx-missing)",
    "Unavailable", "Unavailable", "Unavailable", "Unavailable", "Unavailable",
  ])
  await expect(sourcing).toContainText("Comparison ranking unavailable: at least one proposal has missing, invalid or inconsistent monetary data.")
  const version = await form.getAttribute("data-version")
  if (!version || !/^[1-9]\d*$/.test(version)) throw new Error("The saved quotation must have a positive domain version")
  const before = await queueIdentity(page, account, id, "Unavailable")
  const summary = await detail.locator("[data-request-summary]").innerText()
  const history = detail.locator('section[id="' + id + '-history"]')
  const historyCells = await history.getByRole("cell").allTextContents()
  const pending = commandResponse(page, "submit_sourcing", id)
  await sourcing.getByRole("button", { name: "Submit sourcing", exact: true }).click()
  const rejected = await pending
  const message = "Quote 1: no FX rate defined for JPY (Settings → Currencies)"
  expect(rejected.status()).toBe(422)
  expect(rejected.request().postDataJSON()).toMatchObject({ page: "Requests", action: "submit_sourcing", id, version: Number(version) })
  expect(await rejected.json()).toMatchObject({ ok: false, errors: [message], fieldErrors: [{ field: "sourcing.quotes.0.currency", message }] })
  const currency = form.locator('[name="sourcing.quotes.0.currency"]')
  await expect(currency).toHaveValue("JPY")
  await expect(currency).toHaveAttribute("aria-invalid", "true")
  await expect(currency).toHaveAccessibleDescription(message)
  await expect(form).toHaveAttribute("data-version", version)
  await expect(detail.locator("[data-request-summary]")).toContainText("Value unavailable")
  await expect(detail.locator("[data-request-summary]")).not.toContainText("Sourcing approval")
  await openRequest(page, account, id)
  await expect(form).toHaveAttribute("data-version", version)
  await expect(currency).toHaveValue("JPY")
  await expect(detail.locator("[data-request-summary]")).toHaveText(summary)
  await expect(detail.locator("[data-request-money]")).toHaveText("Current request value: 28000 JPY; base value: Unavailable; FX: Unavailable.")
  await expect(history.getByRole("cell")).toHaveText(historyCells)
  await expect(form.locator('[name="sourcing.quotes.0.id"]')).toHaveValue(quoteId)
  await expect(form.locator('[name="sourcing.quotes.0.supplierId"]')).toHaveValue(supplier)
  await expect(selection.getByRole("combobox", { name: "Winning quote", exact: true })).toHaveValue(quoteId)
  await expect(detail.locator('form[data-command="approve"]')).toHaveCount(0)
  const after = await queueIdentity(page, account, id, "Unavailable")
  await observation(info, "operations-missing-fx-refusal", { recordId: id, quoteId, supplierId: supplier, domainVersion: version, before, after, historyCells, refusal: { status: 422, field: "sourcing.quotes.0.currency", message }, submitted: false })
}
