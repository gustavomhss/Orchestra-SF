import { expect, type Locator, type Page } from "@playwright/test"

export const topicsPage = "Hot Topics & Actions"

export function dashboardUrl(origin: string, page: string, extra: Record<string, string> = {}) {
  return `${origin}/sucafina/dashboard?${new URLSearchParams({ page, year: "2026", ...extra })}`
}

export async function command(page: Page, button: Locator, action: string, expectedStatus = 200) {
  await expect(button).toBeEnabled()
  const pending = page.waitForResponse((response) => response.request().method() === "POST" &&
    new URL(response.url()).pathname === "/sucafina/dashboard" && !new URL(response.url()).searchParams.has("sf") &&
    response.request().postDataJSON()?.action === action)
  await button.click()
  const response = await pending
  expect(response.status()).toBe(expectedStatus)
  const result = await response.json() as { ok: boolean; value?: { applied?: boolean; previewRef?: string }; stored?: unknown }
  expect(result.ok).toBe(expectedStatus === 200)
  return result
}

export async function hostCommand(page: Page, button: Locator, mode: string) {
  await expect(button).toBeEnabled()
  const pending = page.waitForResponse((response) => new URL(response.url()).pathname === "/sucafina/dashboard" &&
    new URL(response.url()).searchParams.get("sf") === mode)
  await button.click()
  const response = await pending
  expect(response.status()).toBe(200)
  const result = await response.json() as { status: string }
  expect(result.status).toBe("ok")
}

export async function confirmDialog(page: Page, button: Locator, message: string, accept: boolean) {
  const pending = page.waitForEvent("dialog")
  const clicking = button.click()
  const dialog = await pending
  expect(dialog.type()).toBe("confirm")
  expect(dialog.message()).toBe(message)
  if (accept) await dialog.accept()
  else await dialog.dismiss()
  await clicking
}

export function topicRow(page: Page, id: string) {
  return page.getByRole("row").filter({ has: page.locator(`form[data-page="${topicsPage}"][data-command="save"][data-record="${id}"]`) })
}

export async function addTopic(page: Page, action: string, due: string) {
  await page.getByText("Add action", { exact: true }).click()
  const form = page.locator(`form[data-page="${topicsPage}"][data-command="save"][data-record=""]`)
  await form.getByLabel("Action", { exact: true }).fill(action)
  await form.getByLabel("Owner", { exact: true }).fill("Installed operator")
  await form.getByLabel("Due", { exact: true }).fill(due)
  await form.getByLabel("Status", { exact: true }).selectOption("open")
  await form.getByLabel("Priority", { exact: true }).selectOption("high")
  await command(page, form.getByRole("button", { name: "Save", exact: true }), "save")
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: action, exact: true }) })
  await expect(row).toBeVisible()
  const id = await row.locator('form[data-command="save"]').getAttribute("data-record")
  if (!id) throw new Error("Created Hot Topic has no durable record identity")
  return id
}

export async function openTopic(page: Page, id: string) {
  await topicRow(page, id).getByRole("button", { name: "Edit", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Edit record", exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

export async function openForm(form: Locator) {
  const details = form.locator("..")
  if (await details.getAttribute("open") === null) await details.locator(":scope > summary").click()
  await expect(form).toBeVisible()
}

export function monthlyForm(page: Page, owner: string, month: number) {
  return page.locator('form[data-page="OPEX Detail"][data-command="save-entry"]')
    .filter({ has: page.locator(`input[name="ownerId"][value="${owner}"]`) })
    .filter({ has: page.locator(`input[name="month"][value="${month}"]`) })
}

export async function openMonth(page: Page, owner: string, month: number) {
  const form = monthlyForm(page, owner, month)
  await page.getByRole("row").filter({ has: form }).getByRole("button", { name: "Edit", exact: true }).click()
  await openForm(form)
  return form
}

export async function addOwner(page: Page, name: string, annual: string) {
  const form = page.locator('form[data-page="OPEX Detail"][data-command="save"][data-record=""]')
  await openForm(form)
  await form.getByLabel("Owner name", { exact: true }).fill(name)
  await form.getByLabel("Annual budget", { exact: true }).fill(annual)
  await command(page, form.getByRole("button", { name: "Add", exact: true }), "save")
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) })
  await expect(section.getByRole("heading", { name, exact: true })).toBeVisible()
  const id = await section.locator('form[data-command="save"]').getAttribute("data-record")
  if (!id) throw new Error("Created OPEX line has no durable record identity")
  return id
}
