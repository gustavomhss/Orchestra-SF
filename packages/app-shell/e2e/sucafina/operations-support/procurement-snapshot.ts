import { randomUUID } from "node:crypto"
import { expect, type Page, type TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { approveRequest, captureProcurementCommand, confirmCommand, createRequest, fillEnabledScores, openCommandReview, queueIdentity, sourcingSourceVersion, sourcingStage } from "./procurement"
import { forwardOnce, login, observation, readManifest } from "./runtime"
import type { Account } from "./runtime"

export async function sourcingSnapshot(page: Page, info: TestInfo) {
  const account = await login(page, "first", "settings")
  const supplier = (await readManifest()).records.supplier
  const title = "Operations EUR snapshot " + randomUUID()
  const submitted = "Current request value: 28000 EUR; base value: 30240 USD; FX: 1.08 (submitted)."
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
  await approveRequest(page, account, id, "Operations snapshot approval")
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  await page.getByRole("textbox", { name: "Evaluator", exact: true }).fill("Synthetic Operations evaluator")
  await page.getByRole("textbox", { name: "Fewer quotations justification", exact: true }).fill("Isolated single-quote snapshot regression; comparison remains limited")
  await page.getByRole("textbox", { name: "Selection justification", exact: true }).fill("Review the EUR quotation with the current holder")
  await page.getByRole("button", { name: "Add quotation", exact: true }).click()
  const quote = page.locator("fieldset.sf-u12-quote")
  await expect(quote).toHaveCount(1)
  await quote.getByRole("textbox", { name: "Supplier", exact: true }).fill("Journey registered supplier")
  await quote.getByRole("combobox", { name: "Registered supplier", exact: true }).selectOption(supplier)
  await quote.getByRole("textbox", { name: "Currency", exact: true }).fill("EUR")
  await quote.getByRole("spinbutton", { name: "Stated total", exact: true }).fill("28000")
  await quote.getByRole("spinbutton", { name: "Quantity", exact: true }).fill("1")
  await quote.getByRole("spinbutton", { name: "Unit price", exact: true }).fill("28000")
  await fillEnabledScores(quote)
  const save = await openCommandReview(page, page.getByRole("button", { name: "Save sourcing", exact: true }), "Confirm once")
  const saved = await captureProcurementCommand(page, account, save, {
    page: "Requests", action: "save", id, values: { sourcing: { quotes: [{ supplierId: supplier, currency: "EUR", total: 28000, qty: 1, unitPrice: 28000 }] } },
  })
  expect(saved.status).toBe(200)
  expect(saved.body).toMatchObject({ ok: true })
  await expect(page.getByRole("textbox", { name: "Selection justification", exact: true })).toHaveValue("Review the EUR quotation with the current holder")
  await page.getByRole("button", { name: "Compare quotations", exact: true }).click()
  const comparison = page.locator("section.sf-u12-comparison")
  const limited = /^Comparison is limited: fewer than two proposals are eligible\.$/
  await expect(comparison.getByRole("status").filter({ hasText: limited })).toBeVisible()
  const winning = comparison.getByRole("combobox", { name: "Selected quotation", exact: true })
  await winning.selectOption({ label: "Journey registered supplier · EUR 28000" })
  await confirmCommand(page, account, "select_quote", id, comparison.getByRole("button", { name: "Select winning quote", exact: true }), "Confirm once")
  const order = page.locator(".sf-u12-root > section").filter({ has: page.getByRole("button", { name: "Submit purchase order", exact: true }) })
  await expect(order).toHaveCount(1)
  await expect(order.getByRole("textbox", { name: "Supplier", exact: true })).toHaveValue("Journey registered supplier")
  await expect(order.getByRole("textbox", { name: "Currency", exact: true })).toHaveValue("EUR")
  await expect(order.getByRole("spinbutton", { name: "Unit price", exact: true })).toHaveValue("28000")
  await expect(order.getByRole("button", { name: "Submit purchase order", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Sourcing", exact: true }).click()
  await confirmCommand(page, account, "submit_sourcing", id, page.getByRole("button", { name: "Submit sourcing", exact: true }), "Confirm once")
  const stage = sourcingStage(page)
  await expect(stage).toHaveText("Stage: src_pending")
  const pendingVersion = await sourcingSourceVersion(page)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}`)
  await expect(detail.locator("p").filter({ hasText: /^Status:/ })).toHaveText("Status: src_pending")
  await expect(detail.locator(`p[data-request-summary="${id}"]`)).toContainText("Sourcing approval")
  await expect(detail.locator(`p[data-request-summary="${id}"]`)).toContainText("30240 USD")
  await expect(detail.locator(`p[data-request-money="${id}"]`)).toHaveText(submitted)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing/compare`)
  const frozen = page.locator("section.sf-u12-comparison")
  await expect(frozen.getByRole("row").filter({ hasText: "Journey registered supplier" }).getByRole("cell", { name: "30240 USD (submitted FX: 1.08)", exact: true })).toHaveCount(1)
  await expect(frozen.getByRole("status").filter({ hasText: limited })).toBeVisible()
  const before = await queueIdentity(page, account, id, submitted, "pending-approval")
  expect(before.domainVersion).toBe(Number(pendingVersion))
  let restore = false
  try {
    await setEurRate(page, account, "1.08", "2", () => { restore = true })
    await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
    await expect(stage).toHaveText("Stage: src_pending")
    expect(await sourcingSourceVersion(page)).toBe(pendingVersion)
    await expect(page.locator(`p[data-request-summary="${id}"]`)).toContainText("Sourcing approval")
    await expect(page.locator(`p[data-request-summary="${id}"]`)).toContainText("30240 USD")
    await expect(page.locator(`p[data-request-money="${id}"]`)).toHaveText(submitted)
    await expect(order.getByRole("status").filter({ hasText: /^Estimate value: 28000 EUR; base value: 56000 USD; FX: 2 \(current\)\.$/ })).toBeVisible()
    await expect(order.getByRole("status").filter({ hasText: /^Order value 56000 USD; approved sourcing value 30240 USD\. Review the difference\.$/ })).toBeVisible()
    await expect(order.getByRole("button", { name: "Submit purchase order", exact: true })).toBeDisabled()
    await expect(page.getByRole("status").filter({ hasText: /^Sourcing is not editable in the current request stage\.$/ })).toBeVisible()
    await expect(page.getByRole("button", { name: "Submit sourcing", exact: true })).toHaveCount(0)
    await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing/compare`)
    await expect(page.locator("section.sf-u12-comparison").getByRole("cell", { name: "30240 USD (submitted FX: 1.08)", exact: true })).toHaveCount(1)
    await expect(stage).toHaveText("Stage: src_pending")
    expect(await sourcingSourceVersion(page)).toBe(pendingVersion)
    await expect(page.locator(`p[data-request-money="${id}"]`)).toHaveText(submitted)
    await page.reload()
    await expect(stage).toHaveText("Stage: src_pending")
    expect(await sourcingSourceVersion(page)).toBe(pendingVersion)
    await expect(page.locator(`p[data-request-money="${id}"]`)).toHaveText(submitted)
    const after = await queueIdentity(page, account, id, submitted, "pending-approval")
    expect(after.domainVersion).toBe(before.domainVersion)
    const reloaded = await queueIdentity(page, account, id, submitted, "pending-approval", { reload: true })
    expect(reloaded.sourceVersion).toBe(after.sourceVersion)
    expect(reloaded.domainVersion).toBe(after.domainVersion)
    await observation(info, "operations-sourcing-frozen-fx", { recordId: id, before, after, reloaded, domainVersion: pendingVersion, pendingSourcing: { original: 28000, currency: "EUR", rate: 1.08, baseAmount: 30240, state: "src_pending" }, futurePo: { baseAmount: 56000, rate: 2, submitted: false }, c06MaterialConfirmation: "BLOCKED_DEPENDENCY" })
  } finally {
    if (restore) await setEurRate(page, account, "2", "1.08")
  }
}

async function setEurRate(page: Page, account: Account, expectedRate: string, value: string, onSaved?: () => void) {
  await page.goto("/orchestra/sf-procurement/settings")
  const settings = page.locator("form.sf-n21-settings-form")
  await expect(settings).toHaveCount(1)
  const code = settings.locator("#sf-u36-fx-code-1")
  const rate = settings.locator("#sf-u36-fx-rate-1")
  await expect(code).toHaveValue("EUR")
  await expect(rate).toHaveValue(expectedRate)
  await expect(settings).toHaveAttribute("data-version", /^[1-9]\d*$/)
  const version = Number(await settings.getAttribute("data-version"))
  expect(Number.isSafeInteger(version)).toBe(true)
  await rate.fill(value)
  await settings.getByRole("button", { name: "Review changes", exact: true }).click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  let settingsReadback: Awaited<ReturnType<typeof forwardOnce>> | undefined
  const saved = await captureProcurementCommand(page, account, review.getByRole("button", { name: "Save", exact: true }), {
    page: "Settings", action: "save", version,
    values: { settings: { fxRates: expect.arrayContaining([{ code: "EUR", rate: Number(value) }]) } },
  }, async (response) => {
    if (response.status() !== 200) return
    expect(await response.json()).toMatchObject({ ok: true })
    onSaved?.()
    settingsReadback = await forwardOnce(page, account.baseURL + "/api/ui/pages/CAP28", "GET")
  })
  expect(saved.status).toBe(200)
  expect(saved.body).toMatchObject({ ok: true })
  if (!settingsReadback) throw new Error("No committed Settings readback was installed")
  const { response: projection } = await settingsReadback.completed.finally(settingsReadback.close)
  expect(projection.status()).toBe(200)
  expect(Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP28"].output)(await projection.json())).toMatchObject({
    status: "ok",
    context: { principalRef: account.principal, installationId: account.installationId, projectId: account.projectId },
    value: {
      versions: { settings: { version: version + 1 } },
      data: { settings: { fxRates: expect.arrayContaining([{ code: "EUR", rate: Number(value) }]) } },
    },
  })
  await expect(settings).toHaveAttribute("data-version", String(version + 1))
  await expect(code).toHaveValue("EUR")
  await expect(rate).toHaveValue(value)
}
