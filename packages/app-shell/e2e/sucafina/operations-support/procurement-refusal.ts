import { randomUUID } from "node:crypto"
import { expect, type Page, type TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { approveRequest, captureProcurementCommand, confirmCommand, createRequest, fillEnabledScores, openCommandReview, queueIdentity, sourcingSourceVersion, sourcingStage } from "./procurement"
import { forwardOnce, login, observation, readManifest } from "./runtime"

export async function missingFxRefusal(page: Page, info: TestInfo) {
  const account = await login(page, "first", "validation")
  const supplier = (await readManifest()).records.supplier
  const title = "Operations missing FX " + randomUUID()
  const moneyUnavailable = "Current request value: 28000 JPY; base value: Unavailable; FX: Unavailable."
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
  await approveRequest(page, account, id, "Operations missing FX approval")
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  await page.getByRole("textbox", { name: "Evaluator", exact: true }).fill("Synthetic Operations evaluator")
  await page.getByRole("textbox", { name: "Fewer quotations justification", exact: true }).fill("Isolated quotation for an unavailable FX refusal")
  await page.getByRole("textbox", { name: "Selection justification", exact: true }).fill("Selected quotation still requires a configured FX rate")
  await page.getByRole("button", { name: "Add quotation", exact: true }).click()
  const quote = page.locator("fieldset.sf-u12-quote")
  await expect(quote).toHaveCount(1)
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
    values: { sourcing: { quotes: [{ supplierId: supplier, currency: "JPY", total: 28000, qty: 1, unitPrice: 28000 }] } },
  })
  expect(saved.status).toBe(200)
  expect(saved.body).toMatchObject({ ok: true })
  await expect(sourcingStage(page)).toHaveText("Stage: sourcing")
  expect(await sourcingSourceVersion(page, saveVersion + 1)).toBe(String(saveVersion + 1))
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
  // The canonical producer prioritizes eligibleCount < 2 in rankingUnavailableReason.
  // The row above still proves fx-missing and every score/rank is unavailable.
  await expect(comparison.getByRole("status").filter({ hasText: /^Rank / })).toHaveCount(0)
  const winning = comparison.getByRole("combobox", { name: "Selected quotation", exact: true })
  await winning.selectOption({ label: "Journey registered supplier · JPY 28000" })
  const selectionVersion = Number(await sourceVersion(page))
  const confirmSelection = await openCommandReview(page, comparison.getByRole("button", { name: "Select winning quote", exact: true }), "Confirm once")
  let selectionReadback: Awaited<ReturnType<typeof forwardOnce>> | undefined
  const selected = await captureProcurementCommand(page, account, confirmSelection, {
    page: "Requests", action: "select_quote", id, version: selectionVersion, values: { quoteId },
  }, async (response) => {
    if (response.status() !== 200) return
    // Register after the command was sent so the mandatory pre-submit read stays independent.
    selectionReadback = await forwardOnce(page, account.baseURL + "/api/ui/pages/CAP25?" + new URLSearchParams({ request: id }), "GET")
  })
  expect(selected.status).toBe(200)
  expect(selected.body).toMatchObject({ ok: true })
  if (!selectionReadback) throw new Error("No selected-quotation readback was installed")
  const { response: selectedProjection } = await selectionReadback.completed.finally(selectionReadback.close)
  expect(selectedProjection.status()).toBe(200)
  expect(Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP25"].output)(await selectedProjection.json())).toMatchObject({
    status: "ok",
    context: { principalRef: account.principal, installationId: account.installationId, projectId: account.projectId },
    value: {
      selection: { request: id },
      versions: { ["requests:" + id]: { version: selectionVersion + 1 } },
      data: { requests: expect.arrayContaining([expect.objectContaining({
        number: id, status: "sourcing", sourcing: expect.objectContaining({ selectedId: quoteId }),
      })]) },
    },
  })
  await page.getByRole("button", { name: "Sourcing", exact: true }).click()
  const version = await sourceVersion(page)
  expect(Number(version)).toBe(selectionVersion + 1)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/history`)
  const history = page.locator(`article[data-sf-request-ref="${id}"] [data-stage="history"]`).getByRole("listitem")
  await expect(history.first()).toBeVisible()
  const historyText = await history.allTextContents()
  expect(historyText.length).toBeGreaterThan(0)
  const summary = await page.locator(`article[data-sf-request-ref="${id}"] p`).filter({ hasText: /^Status:/ }).innerText()
  const before = await queueIdentity(page, account, id, moneyUnavailable, "estimate")
  expect(before.domainVersion).toBe(Number(version))
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
  await expect(sourcingStage(page)).toHaveText("Stage: sourcing")
  expect(await sourcingSourceVersion(page)).toBe(version)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}`)
  await expect(page.locator(`article[data-sf-request-ref="${id}"] p`).filter({ hasText: /^Status:/ })).toHaveText(summary)
  await expect(page.locator(`article[data-sf-request-ref="${id}"] p`).filter({ hasText: /^Status:/ })).toHaveText("Status: sourcing")
  await expect(page.locator(`article[data-sf-request-ref="${id}"] p[data-request-summary="${id}"]`)).toContainText("Value unavailable")
  await expect(page.locator(`article[data-sf-request-ref="${id}"] p[data-request-summary="${id}"]`)).not.toContainText("Sourcing approval")
  await expect(page.locator(`article[data-sf-request-ref="${id}"] p[data-request-money="${id}"]`)).toHaveText(moneyUnavailable)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/history`)
  await expect(page.locator(`article[data-sf-request-ref="${id}"] [data-stage="history"]`).getByRole("listitem")).toHaveText(historyText)
  await page.goto(`/orchestra/sf-procurement/approvals/${encoded}/review`)
  await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === `/orchestra/sf-procurement/approvals/${encoded}/review`)
  await expect(page.getByRole("alert").getByText("The submitted stage, holder or amount is incomplete.", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Approve PR", exact: true })).toHaveCount(0)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  await expect(sourcingStage(page)).toHaveText("Stage: sourcing")
  expect(await sourcingSourceVersion(page)).toBe(version)
  await expect(page.locator("fieldset.sf-u12-quote legend").first()).toContainText(quoteId)
  await expect(page.locator("fieldset.sf-u12-quote").first().getByRole("combobox", { name: "Registered supplier", exact: true })).toHaveValue(supplier)
  await page.getByRole("button", { name: "Compare quotations", exact: true }).click()
  await expect(page.getByRole("combobox", { name: "Selected quotation", exact: true })).toHaveValue(quoteId)
  const after = await queueIdentity(page, account, id, moneyUnavailable, "estimate")
  expect(after).toEqual(before)
  await observation(info, "operations-missing-fx-refusal", { recordId: id, quoteId, supplierId: supplier, domainVersion: version, before, after, refusal: { status: 422, field: "sourcing.quotes.0.currency", message: producer }, submitted: false })
}

async function sourceVersion(page: Page) {
  await expect(sourcingStage(page)).toHaveText(/^Stage: \S+$/)
  return sourcingSourceVersion(page)
}
