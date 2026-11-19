import { expect, type Locator, type Page, type Request, type TestInfo } from "@playwright/test"

export const topicsPage = "Hot Topics & Actions"

export function dashboardUrl(origin: string, page: string, extra: Record<string, string> = {}) {
  return `${origin}/sucafina/dashboard?${new URLSearchParams({ page, year: "2026", ...extra })}`
}

/** Only fixed protocol labels leave this observer; no URL query, headers or body. */
export function observeDashboardRequests(info: TestInfo, pages: readonly { page: Page; label: string }[]) {
  const events: Record<string, unknown>[] = [], detach: (() => void)[] = []
  let omitted = 0
  const record = (value: Record<string, unknown>) => {
    if (events.length < 160) events.push(value)
    else omitted++
    if (value.event === "failed" || value.event === "console-error" || value.event === "page-error")
      console.info("SF_DASHBOARD_INSTALLED_TRANSPORT", JSON.stringify(value))
  }
  for (const { page, label } of pages) {
    const known = new WeakMap<Request, number>()
    let next = 0
    const describe = (request: Request) => {
      const url = new URL(request.url())
      if (!url.pathname.startsWith("/sucafina/")) return undefined
      let id = known.get(request)
      if (id === undefined) { id = ++next; known.set(request, id) }
      const selector = url.searchParams.get("sf")
      const mode = selector === null ? "domain" : ["dashboard-workbench", "dashboard-draft-read", "dashboard-agenda", "dashboard-capture", "dashboard-history", "dashboard-hot-topic-draft", "views", "saved-views", "preferences"].includes(selector) ? selector : "other-product"
      let action: string | undefined
      if (request.method() === "POST" && mode === "domain") {
        try {
          const selected: unknown = request.postDataJSON()?.action
          if (typeof selected === "string" && ["save", "delete", "preview-change", "apply-preview", "read-preview", "year-amount", "annual-entry", "save-entry"].includes(selected)) action = selected
        } catch { /* Non-JSON requests have no domain-command label. */ }
      }
      return { tab: label, id, method: request.method(), path: url.pathname, mode, ...(action ? { action } : {}) }
    }
    const sent = (request: Request) => { const value = describe(request); if (value) record({ ...value, event: "sent" }) }
    const responded = (response: import("@playwright/test").Response) => {
      const value = describe(response.request())
      if (!value) return
      const type = response.headers()["content-type"] ?? ""
      const contentType = type.includes("application/json") ? "json" : type.includes("text/html") ? "html" : type ? "other" : "absent"
      record({ ...value, event: "response", status: response.status(), contentType })
    }
    const failed = (request: Request) => {
      const value = describe(request)
      if (value) record({ ...value, event: "failed", code: request.failure()?.errorText.match(/(?:net::)?ERR_[A-Z_]+/)?.[0] ?? "transport-failed" })
    }
    const consoleError = (message: import("@playwright/test").ConsoleMessage) => {
      if (message.type() !== "error") return
      const text = message.text()
      // CSP diagnostics can contain authentication URLs. Preserve the failure
      // category and directive only, never the browser's original message.
      const kind = /Content Security Policy|content-security-policy/i.test(text) ? "csp" : /CORS|cross-origin/i.test(text) ? "cors" : /fetch|network|net::ERR_/i.test(text) ? "network" : "other"
      const directive = kind === "csp" ? text.match(/\b(?:connect|default|script|style|img|font|frame)-src\b/)?.[0] : undefined
      record({ tab: label, event: "console-error", kind, ...(directive ? { directive } : {}) })
    }
    const pageError = () => record({ tab: label, event: "page-error" })
    page.on("request", sent); page.on("response", responded); page.on("requestfailed", failed)
    page.on("console", consoleError); page.on("pageerror", pageError)
    detach.push(() => { page.off("request", sent); page.off("response", responded); page.off("requestfailed", failed); page.off("console", consoleError); page.off("pageerror", pageError) })
  }
  return async () => {
    detach.forEach((remove) => remove())
    await info.attach("dashboard-installed-transport.json", { body: JSON.stringify({ events, omitted }, null, 2), contentType: "application/json" })
  }
}

async function clickedResponse(page: Page, button: Locator, matches: (request: Request) => boolean) {
  const failed = Promise.withResolvers<never>()
  const rejectFailed = (request: Request) => {
    if (matches(request)) failed.reject(new Error(`Dashboard request failed: ${request.failure()?.errorText.match(/(?:net::)?ERR_[A-Z_]+/)?.[0] ?? "transport-failed"}`))
  }
  page.on("requestfailed", rejectFailed)
  try {
    const [response] = await Promise.all([
      Promise.race([page.waitForResponse((value) => matches(value.request()), { timeout: 15_000 }), failed.promise]),
      button.click(),
    ])
    return response
  } finally { page.off("requestfailed", rejectFailed) }
}

export async function command(page: Page, button: Locator, action: string, expectedStatus = 200) {
  await expect(button).toBeEnabled()
  const response = await clickedResponse(page, button, (request) => request.method() === "POST" &&
    new URL(request.url()).pathname === "/sucafina/dashboard" && !new URL(request.url()).searchParams.has("sf") &&
    request.postDataJSON()?.action === action)
  expect(response.status()).toBe(expectedStatus)
  const result = await response.json() as { ok: boolean; value?: { applied?: boolean; previewRef?: string }; stored?: unknown }
  expect(result.ok).toBe(expectedStatus === 200)
  return result
}

export async function hostCommand(page: Page, button: Locator, mode: string) {
  await expect(button).toBeEnabled()
  const response = await clickedResponse(page, button, (request) => new URL(request.url()).pathname === "/sucafina/dashboard" &&
    new URL(request.url()).searchParams.get("sf") === mode)
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
  await form.getByRole("combobox", { name: "Status", exact: true }).selectOption("open")
  await form.getByRole("combobox", { name: "Priority", exact: true }).selectOption("high")
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
