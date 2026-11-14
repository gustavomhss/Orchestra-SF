import { expect } from "@playwright/test"
import type { Locator, Page } from "@playwright/test"
import type { Account } from "./runtime"

export function commandResponse(page: Page, action: string, id?: string) {
  const current = new URL(page.url())
  return page.waitForResponse((response) => {
    const request = response.request()
    const url = new URL(request.url())
    if (request.method() !== "POST" || url.origin !== current.origin || url.pathname !== current.pathname) return false
    const body = request.postDataJSON() as { page?: string; action?: string; id?: string }
    return body.action === action && (id === undefined || body.id === id)
  })
}

export async function openRequest(page: Page, account: Account, id: string) {
  expect(id).toMatch(/^PR-2026-\d+$/)
  await page.goto(account.baseURL + "/procurement?" + new URLSearchParams({ page: "Requests", request: id, q: id }))
  const detail = page.locator('details[id="' + id + '"]')
  await expect(detail).toHaveCount(1)
  await expect(detail).toHaveAttribute("open", "")
  await expect(detail.locator("[data-request-summary]")).toContainText("Version ")
  return detail
}

export async function createDraft(page: Page, account: Account, title: string) {
  await page.goto(account.baseURL + "/procurement?page=Requests")
  const form = page.locator('form[data-command="create"][data-page="Requests"]')
  await expect(form).toHaveCount(1)
  await form.getByRole("textbox", { name: "Title", exact: true }).fill(title)
  await form.getByRole("combobox", { name: "Type", exact: true }).selectOption("service")
  await form.getByRole("textbox", { name: "Description", exact: true }).fill("Isolated Operations sourcing scope")
  await form.getByRole("spinbutton", { name: "Estimated amount", exact: true }).fill("100")
  await form.getByRole("textbox", { name: "Cost centre", exact: true }).fill("Synthetic IT")
  await form.getByLabel("Needed by", { exact: true }).fill("2026-12-01")
  await form.getByRole("textbox", { name: "Justification", exact: true }).fill("Operations fixture only")
  const pending = commandResponse(page, "create")
  await form.getByRole("button", { name: "Create request", exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  expect(response.request().postDataJSON()).toMatchObject({ page: "Requests", action: "create", values: { pr: { title, estAmount: 100 } } })
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: title, exact: true }) })
  await expect(row).toHaveCount(1)
  const link = row.getByRole("link", { name: /^PR-2026-\d+$/ })
  await expect(link).toHaveCount(1)
  const id = (await link.innerText()).trim()
  const detail = await openRequest(page, account, id)
  await expect(detail.locator("[data-request-summary]")).toContainText("Requisition draft")
  await expect(detail.locator('section[id="' + id + '-pr"] form[data-command="save"]')).toHaveAttribute("data-version", "1")
  return id
}

export async function requestAction(page: Page, id: string, form: Locator, label: string) {
  await expect(form).toHaveCount(1)
  const action = await form.getAttribute("data-command")
  const version = Number(await form.getAttribute("data-version"))
  if (!action || !Number.isSafeInteger(version) || version < 1) throw new Error("Current Procurement command identity is unavailable")
  const button = form.getByRole("button", { name: label, exact: true })
  await expect(button).toBeEnabled()
  const pending = commandResponse(page, action, id)
  await button.click()
  const response = await pending
  expect(response.request().postDataJSON()).toMatchObject({ page: "Requests", action, id, version })
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  await expect(page.locator('section[id="' + id + '-pr"] form[data-command="save"]')).toHaveAttribute("data-version", String(version + 1))
  return response
}

/** Verify the unique C02 row for this record; scoped C02 version is not the domain CAS counter. */
export async function queueIdentity(page: Page, account: Account, id: string, amount: string) {
  const table = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Value basis", exact: true }) })
  await expect(table).toHaveCount(1)
  const row = table.getByRole("row").filter({ has: page.getByRole("link", { name: id, exact: true }) })
  await expect(row).toHaveCount(1)
  await expect(row.getByRole("cell", { name: amount, exact: true })).toHaveCount(1)
  const link = row.getByRole("link", { name: id, exact: true })
  await expect(link).toHaveAttribute("data-source-ref", /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
  await expect(link).toHaveAttribute("data-source-digest", /^[a-f0-9]{64}$/)
  await expect(link).toHaveAttribute("data-source-version", /^[1-9]\d*$/)
  const href = await link.getAttribute("href")
  if (!href) throw new Error("C02 drilldown is missing")
  const url = new URL(href, page.url())
  expect(url.origin + url.pathname).toBe(account.baseURL + "/procurement")
  expect(url.searchParams.get("request")).toBe(id)
  expect(url.searchParams.get("q")).toBe(id)
  expect(decodeURIComponent(url.hash.slice(1))).toBe(id)
  return { id, amount, sourceRef: await link.getAttribute("data-source-ref"), refDigest: await link.getAttribute("data-source-digest"), sourceVersion: Number(await link.getAttribute("data-source-version")) }
}
