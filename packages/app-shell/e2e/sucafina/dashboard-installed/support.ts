import { expect, type Locator, type Page, type Request, type TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfDomainPageCap04 } from "@orchestra/schema/sucafina/domain"

export const topicsPage = "Hot Topics & Actions"

export function dashboardUrl(origin: string, page: string, extra: Record<string, string> = {}) {
  const routes: Record<string, string> = {
    "Hot Topics & Actions": "/orchestra/sf-dashboard/hot-topics",
    "OPEX Detail": "/orchestra/sf-dashboard/opex",
    "IT Risks": "/orchestra/sf-operations/risks",
    "Executive Dashboard": "/orchestra/sf-dashboard/executive",
  }
  const route = routes[page]
  if (!route) throw new Error("No native Dashboard route for " + page)
  const query = new URLSearchParams(page === "IT Risks" ? extra : { year: "2026", ...extra })
  if (extra.execYear !== undefined) { query.set("year", extra.execYear); query.delete("execYear") }
  if (extra.executiveMonth !== undefined) { query.set("month", extra.executiveMonth); query.delete("executiveMonth") }
  // The installed descriptor supplies the shell origin; no browser visits the listener.
  const url = new URL(route, origin)
  url.search = query.toString()
  return url.toString()
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
  const result = await response.json() as { ok: boolean }
  expect(result.ok).toBe(expectedStatus === 200)
  return result
}

export function topicRow(page: Page, id: string) {
  return page.locator(`tr[data-sf-topic="${id}"]`)
}

export async function addTopic(page: Page, action: string, due: string) {
  await page.getByRole("button", { name: "New topic", exact: true }).click()
  const editor = page.locator("[data-sf-topic-editor]")
  const form = editor.locator("form")
  await expect(form).toBeVisible()
  await form.getByLabel("Action", { exact: true }).fill(action)
  await form.getByLabel("Owner", { exact: true }).fill("Installed operator")
  await form.getByLabel("Due date", { exact: true }).fill(due)
  await form.getByRole("combobox", { name: "Status", exact: true }).selectOption("open")
  await form.getByRole("combobox", { name: "Priority", exact: true }).selectOption("high")
  await form.getByRole("button", { name: "Review save", exact: true }).click()
  const review = editor.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  await expect(review).toContainText(action)
  await command(page, review.getByRole("button", { name: "Confirm save", exact: true }), "save")
  await expect(editor).toBeHidden()
  const row = page.locator("tr[data-sf-topic]").filter({ has: page.getByRole("rowheader", { name: action, exact: true }) })
  await expect(row).toHaveCount(1)
  await expect(row).toBeVisible()
  const id = await row.getAttribute("data-sf-topic")
  if (!id) throw new Error("Created Hot Topic has no durable record identity")
  return id
}

export async function openTopic(page: Page, id: string) {
  await topicRow(page, id).getByRole("button", { name: "View details", exact: true }).click()
  await page.locator("[data-sf-topic-detail]").getByRole("button", { name: "Edit topic", exact: true }).click()
  const editor = page.locator("[data-sf-topic-editor]")
  await expect(editor).toBeVisible()
  await expect(editor.getByLabel("Action", { exact: true })).toBeEnabled()
  return editor
}

export async function openMonth(page: Page, owner: string, month: number) {
  const row = page.locator(`tr[data-sf-row="${owner}"]`)
  await row.locator('button[data-sf-action="select"]').click()
  await expect(row).toHaveAttribute("aria-selected", "true")
  const monthly = page.locator(`.sf-budget-detail tr[data-sf-month="${month}"]`)
  await monthly.getByRole("button", { name: "Save month", exact: true }).click()
  const editor = page.locator('.sf-budget-editor[data-sf-action="save-entry"]')
  await expect(editor).toBeVisible()
  await expect(editor.getByLabel("Month", { exact: true })).toHaveValue(String(month))
  await expect(editor.getByLabel("forecast", { exact: true })).toBeEnabled()
  return editor
}

export async function addOwner(page: Page, name: string, annual: string) {
  await page.getByRole("button", { name: "New line", exact: true }).click()
  const editor = page.locator('.sf-budget-editor[data-sf-action="save"]')
  const form = editor.locator("form")
  await expect(form).toBeVisible()
  await form.getByLabel("Owner name", { exact: true }).fill(name)
  await form.getByLabel("Annual budget", { exact: true }).fill(annual)
  await form.getByRole("button", { name: "Review changes", exact: true }).click()
  const review = editor.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  await expect(review).toContainText(name)
  await expect(review).toContainText(annual)
  await command(page, review.getByRole("button", { name: "Save", exact: true }), "save")
  await expect(editor).toBeHidden()
  const row = page.locator("tr[data-sf-row]").filter({ has: page.getByText(name, { exact: true }) })
  await expect(row).toHaveCount(1)
  await expect(row).toBeVisible()
  const id = await row.getAttribute("data-sf-row")
  if (!id) throw new Error("Created OPEX line has no durable record identity")
  return id
}

/** Reread the original authorized monthly source; absence is never coerced to an empty collection. */
export async function readOpex(page: Page, year: number) {
  const url = new URL("/sucafina/api/ui/pages/CAP04", page.url())
  url.searchParams.set("year", String(year))
  const response = await page.request.get(url.toString())
  expect(response.status()).toBe(200)
  const body = Schema.decodeUnknownSync(SfDomainPageCap04.output)(await response.json())
  if (body.status !== "ok" || body.value.data.opexEntries === undefined)
    throw new Error("The authorized OPEX entries were not provided")
  expect(body.value.capabilityId).toBe("CAP04")
  return { ...body.value, entries: body.value.data.opexEntries }
}
