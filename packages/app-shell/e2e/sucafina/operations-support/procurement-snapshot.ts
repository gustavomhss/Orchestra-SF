import { randomUUID } from "node:crypto"
import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import { login, observation, readManifest } from "./runtime"
import type { Account } from "./runtime"
import { commandResponse, createDraft, openRequest, queueIdentity, requestAction } from "./procurement"

export async function sourcingSnapshot(page: Page, info: TestInfo) {
  const account = await login(page, "first", "settings")
  const supplier = (await readManifest()).records.supplier
  const id = await createDraft(page, account, "Operations EUR snapshot " + randomUUID())
  const detail = page.locator('details[id="' + id + '"]')
  await requestAction(page, id, detail.locator('section[id="' + id + '-pr"] form[data-command="submit_pr"]'), "Submit requisition")
  await requestAction(page, id, detail.locator('form[data-command="approve"]'), "Approve")
  const sourcing = detail.locator('section[id="' + id + '-sourcing"]')
  const form = sourcing.locator('form[data-command="save"]')
  await form.getByRole("textbox", { name: "Technical evaluator", exact: true }).fill("Synthetic Operations evaluator")
  await form.getByRole("textbox", { name: "Fewer quotations justification", exact: true }).fill("Isolated single-quote snapshot regression; comparison remains limited")
  await form.getByRole("textbox", { name: "Selection justification", exact: true }).fill("Review the EUR quotation with the current holder")
  await form.locator('[name="sourcing.quotes.0.supplier"]').fill("Journey registered supplier")
  await form.locator('[name="sourcing.quotes.0.supplierId"]').selectOption(supplier)
  await form.locator('[name="sourcing.quotes.0.currency"]').fill("EUR")
  await form.locator('[name="sourcing.quotes.0.total"]').fill("28000")
  await form.locator('[name="sourcing.quotes.0.qty"]').fill("1")
  await form.locator('[name="sourcing.quotes.0.unitPrice"]').fill("28000")
  for (const index of [0, 1, 2, 3, 4]) await form.locator(`[name="sourcing.quotes.0.scores.${index}"]`).fill("4")
  for (const index of [1, 2]) await form.locator(`[name="sourcing.quotes.0.cscores.${index}"]`).fill("4")
  await requestAction(page, id, form, "Save sourcing")
  const selection = sourcing.locator('form[data-command="select_quote"]')
  await selection.getByRole("combobox", { name: "Winning quote", exact: true }).selectOption({ label: "Journey registered supplier · EUR 28000" })
  await requestAction(page, id, selection, "Select quote")
  const po = detail.locator('section[id="' + id + '-po"]')
  await expect(po.locator('[name="po.supplierId"]')).toHaveValue(supplier)
  await expect(po.locator('[name="po.currency"]')).toHaveValue("EUR")
  await expect(po.locator('[name="po.lines.0.unitPrice"]')).toHaveValue("28000")
  await expect(po.getByRole("button", { name: "Submit purchase order", exact: true })).toBeDisabled()
  await expect(sourcing).toContainText("Comparison is limited: fewer than two proposals are eligible.")
  await requestAction(page, id, sourcing.locator('form[data-command="submit_sourcing"]'), "Submit sourcing")
  await expect(detail.locator("[data-request-summary]")).toContainText("Sourcing approval")
  await expect(detail.locator("[data-request-money]")).toHaveText("Current request value: 28000 EUR; base value: 30240 USD; FX: 1.08 (submitted).")
  const pendingVersion = await form.getAttribute("data-version")
  if (!pendingVersion || !/^[1-9]\d*$/.test(pendingVersion)) throw new Error("The submitted sourcing must have a positive domain version")
  const before = await queueIdentity(page, account, id, "30240 USD")

  const original = await setEurRate(page, account, "2")
  try {
    expect(original).toBe("1.08")
    await openRequest(page, account, id)
    await expect(form).toHaveAttribute("data-version", pendingVersion)
    await expect(detail.locator("[data-request-summary]")).toContainText("Sourcing approval")
    await expect(detail.locator("[data-request-summary]")).toContainText("30240 USD")
    await expect(detail.locator("[data-request-money]")).toHaveText("Current request value: 28000 EUR; base value: 30240 USD; FX: 1.08 (submitted).")
    const comparison = sourcing.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Base amount / FX", exact: true }) })
    const quote = comparison.getByRole("row").filter({ has: page.getByRole("cell", { name: "Journey registered supplier", exact: true }) })
    await expect(quote).toHaveCount(1)
    await expect(quote.getByRole("cell", { name: "30240 USD (submitted FX: 1.08)", exact: true })).toHaveCount(1)
    // The unsubmitted future PO deliberately has another basis; it cannot replace the pending sourcing value.
    await expect(po).toContainText("Estimate value: 28000 EUR; base value: 56000 USD; FX: 2 (current).")
    await expect(po).toContainText("Order value 56000 USD; approved sourcing value 30240 USD. Review the difference.")
    await expect(po.getByRole("button", { name: "Submit purchase order", exact: true })).toBeDisabled()
    const after = await queueIdentity(page, account, id, "30240 USD")
    await page.reload()
    await expect(detail.locator("[data-request-money]")).toHaveText("Current request value: 28000 EUR; base value: 30240 USD; FX: 1.08 (submitted).")
    await expect(form).toHaveAttribute("data-version", pendingVersion)
    const reloaded = await queueIdentity(page, account, id, "30240 USD")
    expect(reloaded.sourceVersion).toBe(after.sourceVersion)
    await observation(info, "operations-sourcing-frozen-fx", { recordId: id, before, after, reloaded, domainVersion: pendingVersion, pendingSourcing: { original: 28000, currency: "EUR", rate: 1.08, baseAmount: 30240, state: "src_pending" }, futurePo: { baseAmount: 56000, rate: 2, submitted: false }, c06MaterialConfirmation: "BLOCKED_DEPENDENCY" })
  } finally {
    // Restore only this fixture's changed FX field through the authorized domain, never reset shared settings.
    await setEurRate(page, account, original)
  }
}

async function setEurRate(page: Page, account: Account, value: string) {
  await page.goto(account.baseURL + "/procurement?page=Settings")
  const settings = page.locator('form[data-command="save"][data-page="Settings"]')
  await expect(settings).toHaveCount(1)
  await expect(settings.locator('[name="fxRates.1.code"]')).toHaveValue("EUR")
  const rate = settings.locator('[name="fxRates.1.rate"]')
  const original = await rate.inputValue()
  const version = Number(await settings.getAttribute("data-version"))
  expect(Number.isSafeInteger(version)).toBe(true)
  await rate.fill(value)
  const pending = commandResponse(page, "save")
  await settings.getByRole("button", { name: "Save settings", exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toMatchObject({ page: "Settings", action: "save", version })
  expect(await response.json()).toMatchObject({ ok: true })
  await expect(settings).toHaveAttribute("data-version", String(version + 1))
  await page.reload()
  await expect(rate).toHaveValue(value)
  return original
}
