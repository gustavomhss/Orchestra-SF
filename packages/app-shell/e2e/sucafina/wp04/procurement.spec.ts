import { readFile } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"
import type { Locator, Page, Request, TestInfo } from "@playwright/test"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { selectSfProfile } from "../native/select-profile"

type Account = { baseURL: string; principal: string; projectId: string; installationId: string; enrollments: Record<string, string> }
type Manifest = { origin: string; directory: string; accounts: { first: Account; second: Account; viewer: Account }; records: { supplier: string; comparison: string } }

test.describe.configure({ retries: 0 })

type SafeEvent = Readonly<Record<string, string | number>>
const observedPages = new Map<Page, { events: SafeEvent[]; stop: () => void }>()
const commandPages = new Set(["Requests", "My approvals", "Suppliers", "Settings"])
const commandActions = new Set(["create", "save", "submit_pr", "submit_sourcing", "select_quote", "submit_po", "approve", "reject", "issue", "cancel", "delete", "activate", "block", "inactivate", "change-bank", "reset"])

function observedOperation(request: Request): SafeEvent | undefined {
  const pathname = new URL(request.url()).pathname
  const projection = pathname.match(/\/api\/ui\/pages\/(CAP2[4-8])$/)
  if (request.method() === "GET" && projection) return { method: "GET", path: "/api/ui/pages/" + projection[1] }
  if (request.method() !== "POST" || !pathname.endsWith("/procurement")) return undefined
  try {
    const input = request.postDataJSON() as { page?: unknown; action?: unknown }
    return { method: "POST", path: "/procurement",
      page: typeof input.page === "string" && commandPages.has(input.page) ? input.page : "unrecognized",
      action: typeof input.action === "string" && commandActions.has(input.action) ? input.action : "unrecognized" }
  } catch { return { method: "POST", path: "/procurement", action: "unrecognized" } }
}

function observeProcurement(page: Page) {
  if (observedPages.has(page)) return
  const events: SafeEvent[] = []
  const startedAt = Date.now()
  const requests = new WeakMap<Request, number>()
  const sequence = { value: 0 }
  const requestId = (request: Request) => {
    const current = requests.get(request)
    if (current !== undefined) return current
    const next = ++sequence.value
    requests.set(request, next)
    return next
  }
  const record = (event: SafeEvent) => {
    events.push({ elapsedMs: Date.now() - startedAt, ...event })
    if (events.length > 24) events.shift()
  }
  const request = (value: Request) => {
    const operation = observedOperation(value)
    if (operation) record({ event: "request", requestId: requestId(value), ...operation })
  }
  const response = (value: import("@playwright/test").Response) => {
    const operation = observedOperation(value.request())
    if (operation) record({ event: "response", requestId: requestId(value.request()), ...operation, status: value.status() })
  }
  const finished = (value: Request) => {
    const operation = observedOperation(value)
    if (operation) record({ event: "requestfinished", requestId: requestId(value), ...operation })
  }
  const failed = (value: Request) => {
    const operation = observedOperation(value)
    if (!operation) return
    const failures = new Map([
      ["net::ERR_ABORTED", "aborted"],
      ["net::ERR_CONNECTION_RESET", "connection-reset"],
      ["net::ERR_CONNECTION_CLOSED", "connection-closed"],
      ["net::ERR_CONNECTION_REFUSED", "connection-refused"],
      ["net::ERR_CONTENT_LENGTH_MISMATCH", "content-length-mismatch"],
      ["net::ERR_INCOMPLETE_CHUNKED_ENCODING", "incomplete-chunked-encoding"],
      ["net::ERR_EMPTY_RESPONSE", "empty-response"],
      ["net::ERR_TIMED_OUT", "timed-out"],
      ["net::ERR_FAILED", "failed"],
    ])
    const error = value.failure()?.errorText
    record({ event: "requestfailed", requestId: requestId(value), ...operation,
      failure: error === undefined ? "unavailable" : failures.get(error) ?? "unrecognized" })
  }
  const pageError = (error: Error) => record({ event: "pageerror",
    name: ["Error", "TypeError", "RangeError", "DataCloneError", "InvalidStateError", "SecurityError"].includes(error.name) ? error.name : "unrecognized" })
  page.on("request", request)
  page.on("response", response)
  page.on("requestfinished", finished)
  page.on("requestfailed", failed)
  page.on("pageerror", pageError)
  observedPages.set(page, { events, stop: () => {
    page.off("request", request); page.off("response", response)
    page.off("requestfinished", finished); page.off("requestfailed", failed); page.off("pageerror", pageError)
  } })
}

async function procurementUiSnapshot(page: Page) {
  let deadline: ReturnType<typeof setTimeout> | undefined
  const snapshot = await Promise.race([
    page.evaluate(() => {
      const states = new Set(["ready", "loading", "partial", "empty", "filtered-empty", "not-found", "denied",
        "session-expired", "unavailable", "stale", "invalid", "conflict", "outcome-unknown", "resolving", "unmounted",
        "ambiguous", "invalid-link", "blocked"])
      const state = (value: string | null) => value && states.has(value) ? value : "unrecognized"
      const count = (selector: string) => document.querySelectorAll(selector).length
      const messages = Array.from(document.querySelectorAll(".sf-state-message, [role=alert], [role=status]"))
        .map((node) => node.textContent ?? "")
      const notices = {
        "request-unavailable": "Required producer capability is not available in this context.",
        "request-unknown": "The response may have been lost after the command.",
        "request-version-required": "A current request version is required for this action.",
        "request-invalid": "The requisition values are incomplete or invalid.",
        "supplier-conflict": "Supplier version or authority changed.",
        "supplier-unknown": "Command outcome is unknown.",
        "supplier-unavailable": "The authorized supplier source is unavailable.",
        "supplier-invalid": "The producer returned an invalid projection.",
        "supplier-refused": "The producer refused the change.",
        "supplier-confirmed": "The producer acknowledged the command;",
      }
      const owners = Array.from(document.querySelectorAll('[data-sf-host="owner-runtime231"]')).slice(0, 2)
      return {
        ownerCount: count('[data-sf-host="owner-runtime231"]'),
        owner: owners.map((node) => {
          const generation = node.getAttribute("data-sf-provider-generation")
          const parsed = generation !== null && /^(?:-1|0|[1-9]\d*)$/.test(generation) ? Number(generation) : undefined
          return {
            generation: parsed !== undefined && Number.isSafeInteger(parsed) ? parsed : "unavailable",
            discovery: state(node.getAttribute("data-sf-discovery-state")),
            view: state(node.getAttribute("data-sf-view-state")),
          }
        }),
        provider: Array.from(document.querySelectorAll("[data-sf-provider-state]")).slice(0, 2)
          .map((node) => state(node.getAttribute("data-sf-provider-state"))),
        review: Array.from(document.querySelectorAll('[data-component="sf-change-review"]')).slice(0, 2)
          .map((node) => state(node.getAttribute("data-state"))),
        panels: Array.from(document.querySelectorAll("[data-sf-state]")).slice(0, 8)
          .map((node) => state(node.getAttribute("data-sf-state"))),
        counts: { requests: count('[data-component="sf-requests-pr-po"]'), prEditors: count("[data-sf-pr-form]"),
          poEditors: count("[data-sf-po-form]"), supplierEditors: count(".sf-u14-editor"),
          draftConflicts: count("[data-draft-conflict]"),
          supplierDetails: count(".sf-u14-detail"), settings: count("form.sf-n21-settings-form"),
          alerts: count("[role=alert]"), statuses: count("[role=status]") },
        notices: Object.entries(notices).filter(([, text]) => messages.some((message) => message.includes(text))).map(([key]) => key),
      }
    }).catch(() => null),
    new Promise<null>((resolve) => { deadline = setTimeout(() => resolve(null), 1_000) }),
  ])
  if (deadline) clearTimeout(deadline)
  return snapshot
}

test.afterEach(async ({ page }, info) => {
  const entries = [...observedPages]
  observedPages.clear()
  entries.forEach(([, observed]) => observed.stop())
  if (info.status === info.expectedStatus) return
  // Fixed route/action/state names and closed network categories only: never log bodies, bank fields, headers,
  // credentials, URL queries, arbitrary console messages or error messages.
  console.info("SF_WP04_FAILURE_NETWORK", JSON.stringify(entries.map(([observed, trace], index) =>
    ({ page: index, primary: observed === page, closed: observed.isClosed(), events: trace.events }))))
  for (const [index, [observed]] of entries.entries()) {
    if (observed.isClosed()) continue
    const snapshot = await procurementUiSnapshot(observed)
    console.info("SF_WP04_FAILURE_UI", JSON.stringify({ page: index, state: snapshot ?? "unavailable" }))
  }
})

async function readManifest() {
  return JSON.parse(await readFile(path.join(import.meta.dirname, ".host-manifest.json"), "utf8")) as Manifest
}

function chapterUrl(account: Account, pathname: string) {
  return new URL(pathname, account.baseURL)
}

const requestDetail = (page: Page, id: string) => page.locator('article[data-sf-request-ref="' + id + '"]')
const prEditor = (page: Page, id: string) => requestDetail(page, id).locator("[data-sf-pr-form]")
const poEditor = (page: Page, id: string) => requestDetail(page, id).locator("[data-sf-po-form]")
const requestSummary = (page: Page, id: string) => page.locator('[data-request-summary="' + id + '"]')

async function login(page: Page, account: "first" | "second" | "viewer", scenario: string) {
  observeProcurement(page)
  const manifest = await readManifest()
  const selected = manifest.accounts[account]
  const enrollment = selected.enrollments[scenario]
  if (!enrollment) throw new Error("The selected real-host enrollment is unavailable")
  const response = await page.request.get(enrollment, { maxRedirects: 0 })
  expect(response.status()).toBe(303)
  await selectSfProfile(page, { origin: manifest.origin, directory: manifest.directory, chapterPath: "/orchestra/sf-procurement/requests" })
  const entry = await page.goto(chapterUrl(selected, "/orchestra/sf-procurement/requests").href)
  expect(entry?.status()).toBe(200)
  await expect(page.getByRole("heading", { name: "Requests", exact: true })).toBeVisible()
  const requests = page.locator('[data-component="sf-requests-pr-po"]')
  // Assert the exact producer record in the Requests table, independently of the queue.
  const source = requests.getByRole("link", { name: manifest.records.comparison, exact: true })
  await expect(source).toBeVisible()
  await expect(source).toHaveAttribute("href", "?request=" + encodeURIComponent(manifest.records.comparison) + "#" + encodeURIComponent(manifest.records.comparison))
  await expect(source).toHaveAttribute("data-source-ref", /.+/)
  await expect(source).toHaveAttribute("data-source-digest", /^[a-f0-9]{64}$/)
  await expect(source).toHaveAttribute("data-source-version", /^\d+$/)
  if (account === "viewer") await expect(requests.getByRole("button", { name: "Create request", exact: true })).toHaveCount(0)
  if (account !== "viewer") await expect(requests.getByRole("button", { name: "Create request", exact: true })).toBeEnabled()
  return selected
}

function responseFor(page: Page, action: string, id?: string) {
  return page.waitForResponse((response) => {
    const request = response.request()
    if (request.method() !== "POST" || !new URL(request.url()).pathname.endsWith("/procurement")) return false
    const payload = request.postDataJSON() as { action?: string; id?: string }
    return payload.action === action && (id === undefined || payload.id === id)
  })
}

async function confirmReview(page: Page, label = "Confirm action", keyboard = false) {
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
  const confirm = review.getByRole("button", { name: label, exact: true })
  await expect(confirm).toBeEnabled()
  if (keyboard) { await confirm.focus(); await page.keyboard.press("Enter") }
  else await confirm.click()
}

async function createDraft(page: Page, account: Account, title: string) {
  await page.goto(chapterUrl(account, "/orchestra/sf-procurement/requests/new").href)
  const form = page.locator('article.sf-u11-detail form[data-command="create"][data-page="Requests"]')
  await expect(form).toHaveCount(1)
  await form.getByRole("textbox", { name: "Title", exact: true }).fill(title)
  await form.getByRole("combobox", { name: "Type", exact: true }).selectOption("service")
  await form.getByRole("textbox", { name: "Description", exact: true }).fill("Recorded service scope")
  await form.getByRole("spinbutton", { name: "Estimated amount", exact: true }).fill("100")
  await form.getByRole("textbox", { name: "Cost center", exact: true }).fill("Synthetic IT")
  await form.getByLabel("Needed by", { exact: true }).fill("2026-12-01")
  await form.getByRole("textbox", { name: "Justification", exact: true }).fill("Recorded business need")
  const response = responseFor(page, "create")
  await form.getByRole("button", { name: "Create request", exact: true }).click()
  await confirmReview(page)
  const created = await response
  expect(created.status()).toBe(200)
  expect(await created.json()).toMatchObject({ ok: true })
  expect(created.request().postDataJSON()).toMatchObject({ page: "Requests", action: "create", version: 0, values: { pr: { title } } })
  const row = page.locator('[data-component="sf-requests-pr-po"] tr[data-sf-row]').filter({ has: page.getByRole("cell", { name: title, exact: true }) })
  await expect(row).toHaveCount(1)
  const id = (await row.getAttribute("data-sf-row")) ?? ""
  expect(id).toMatch(/^PR-2026-\d+$/)
  await expect(row.getByRole("cell").nth(0)).toContainText(id)
  await expect(row.getByRole("link")).toHaveCount(1)
  const source = row.getByRole("link", { name: id, exact: true })
  await expect(source).toBeVisible()
  await expect(source).toHaveAttribute("href", "?request=" + encodeURIComponent(id) + "#" + encodeURIComponent(id))
  await expect(source).toHaveAttribute("data-source-ref", /.+/)
  await expect(source).toHaveAttribute("data-source-digest", /^[a-f0-9]{64}$/)
  await expect(source).toHaveAttribute("data-source-version", /^\d+$/)
  await openRecord(page, account, id)
  await expect(requestSummary(page, id)).toContainText("Requisition draft")
  return id
}

async function openRecord(page: Page, account: Account, id: string) {
  expect(id).toMatch(/^PR-2026-\d+$/)
  const encoded = encodeSfRouteRef(id)
  const nativeOrigin = new URL(account.baseURL)
  await page.goto(chapterUrl(account, "/orchestra/sf-procurement/requests/" + encoded).href)
  await expect(page).toHaveURL((url) => url.origin === nativeOrigin.origin && url.pathname === "/orchestra/sf-procurement/requests/" + encoded)
  const row = page.locator('tr[data-sf-row="' + id + '"]')
  await expect(row).toHaveCount(1)
  await expect(row).toHaveAttribute("aria-selected", "true")
  const detail = requestDetail(page, id)
  await expect(detail).toHaveCount(1)
  await expect(detail.locator("p").filter({ hasText: /^Request identity:/ })).toHaveText("Request identity: " + id)
  await expect(detail.locator("p").filter({ hasText: /^Current source version:/ })).toHaveText(/^Current source version: [1-9]\d*$/)
  await expect(requestSummary(page, id)).toContainText("Version")
  return detail
}

async function currentVersion(page: Page, id: string) {
  const summary = requestSummary(page, id)
  await expect(summary).toHaveCount(1)
  const version = (await summary.innerText()).match(/\bVersion (\d+)\b/)
  if (!version) throw new Error("The current producer version is unavailable")
  return Number(version[1])
}

async function requestAction(page: Page, id: string, button: Locator, action: string, confirmation = "Confirm action") {
  const version = await currentVersion(page, id)
  const pending = responseFor(page, action, id)
  await expect(button).toBeEnabled()
  await button.click()
  await confirmReview(page, confirmation)
  const response = await pending
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  expect(response.request().postDataJSON()).toMatchObject({ id, action, version })
  await expect(requestSummary(page, id)).toContainText("Version " + (version + 1))
  return response
}

async function openSourcing(page: Page, account: Account, id: string, compare = false) {
  await page.goto(chapterUrl(account, "/orchestra/sf-procurement/requests/" + encodeSfRouteRef(id) + "/sourcing" + (compare ? "/compare" : "")).href)
  await expect(page.getByRole("heading", { name: "Requests", exact: true })).toBeVisible()
  await expect(requestSummary(page, id)).toContainText("Version")
  return page.locator(".sf-u12-root")
}

async function approveRequest(page: Page, account: Account, id: string, kind: "pr" | "remaining") {
  const version = await currentVersion(page, id)
  await page.goto(chapterUrl(account, "/orchestra/sf-procurement/approvals/" + encodeSfRouteRef(id) + (kind === "pr" ? "" : "/review")).href)
  await expect(page.getByRole("heading", { name: "My approvals", exact: true })).toBeVisible()
  const pending = responseFor(page, "approve", id)
  const detail = kind === "pr" ? page.locator("[data-sf-record-detail]") : page.locator(".sf-u13-remaining-detail")
  await expect(detail).toHaveCount(1)
  await detail.getByRole("button", { name: kind === "pr" ? "Review decision" : "Approve current step", exact: true }).click()
  await confirmReview(page, kind === "pr" ? "Approve PR" : "Confirm once")
  const response = await pending
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  expect(response.request().postDataJSON()).toMatchObject({ page: "My approvals", action: "approve", id, version })
  await openRecord(page, account, id)
  await expect(requestSummary(page, id)).toContainText("Version " + (version + 1))
}

async function proof(page: Page, info: TestInfo, name: string, observation: Record<string, unknown>, mask: Locator[] = []) {
  const path = info.outputPath(name + ".png")
  await page.screenshot({ path, mask })
  await info.attach(name + ".png", { path, contentType: "image/png" })
  await info.attach(name + ".json", { body: Buffer.from(JSON.stringify({ ...observation, humanTimingMeasured: false })), contentType: "application/json" })
}

async function supplierValidation(page: Page, account: Account, number: string) {
  const response = await page.request.get(account.baseURL + "/procurement?download=suppliers")
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("text/csv")
  const parsed = (await response.text()).split("\r\n").map((line) =>
    [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((match) => match[1]!.replaceAll('""', '"')),
  )
  const columns = parsed[0] ?? []
  for (const field of ["iban", "account", "bankName", "swift", "accountHolder", "bankCountry"]) expect(columns).not.toContain(field)
  const selected = parsed.slice(1).filter((row) => row[columns.indexOf("number")] === number)
  expect(selected).toHaveLength(1)
  return Object.fromEntries(["number", "status", "validatedBy", "validatedAt"].map((field) => [field, selected[0]![columns.indexOf(field)]]))
}

async function reviewSettings(page: Page, settings: Locator) {
  await settings.getByRole("button", { name: "Review changes", exact: true }).click()
  await confirmReview(page, "Save")
}

test("keyboard submission uses current entries and focuses the real 422 field without clearing the draft", async ({ page }, info) => {
  const account = await login(page, "first", "validation")
  const id = await createDraft(page, account, "Keyboard validation request")
  const section = prEditor(page, id)
  const description = section.getByRole("textbox", { name: "Description", exact: true })
  const justification = section.getByRole("textbox", { name: "Justification", exact: true })
  // Existing title edits use a separate W19 intent. This submission owns the requisition fields.
  await description.fill("Unsent scope retained through validation")
  await justification.fill("")
  const invalid = responseFor(page, "submit_pr", id)
  await section.getByRole("button", { name: "Submit requisition", exact: true }).focus()
  await page.keyboard.press("Enter")
  await confirmReview(page, "Confirm action", true)
  const rejected = await invalid
  expect(rejected.status()).toBe(422)
  expect(rejected.request().postDataJSON().values.pr).toMatchObject({ description: "Unsent scope retained through validation", justification: "" })
  expect((await rejected.json()).fieldErrors).toContainEqual({ field: "pr.justification", message: "Business justification is required" })
  await expect(justification).toBeFocused()
  await expect(justification).toHaveAttribute("aria-invalid", "true")
  await expect(justification).toHaveAccessibleName("Justification")
  await expect(justification).toHaveAccessibleDescription("Business justification is required")
  await expect(section.locator('[data-field-error="pr.justification"]')).toHaveText("Business justification is required")
  await expect(description).toHaveValue("Unsent scope retained through validation")
  await expect(section).toHaveAttribute("data-version", "1")
  await expect(requestDetail(page, id).getByRole("heading", { name: "Keyboard validation request", exact: true })).toBeVisible()
  await proof(page, info, "keyboard-422", { id, status: 422, focusedField: "pr.justification", draftPreserved: true })

  await justification.fill("Corrected explanation remains part of this submission")
  const accepted = responseFor(page, "submit_pr", id)
  await section.getByRole("button", { name: "Submit requisition", exact: true }).focus()
  await page.keyboard.press("Enter")
  await confirmReview(page, "Confirm action", true)
  expect((await accepted).status()).toBe(200)
  await expect(requestSummary(page, id)).toContainText("Requisition approval")
  await expect(section.getByRole("button", { name: "Submit requisition", exact: true })).toBeDisabled()
  await expect(description).toHaveValue("Unsent scope retained through validation")
  await expect(justification).toHaveValue("Corrected explanation remains part of this submission")
  await expect(section.locator("[data-field-error]")).toHaveCount(0)
})

test("two authenticated actors review an actual CAS conflict and submit only after an explicit version choice", async ({ page, browser }, info) => {
  const first = await login(page, "first", "conflict")
  const id = await createDraft(page, first, "Concurrent procurement request")
  const secondContext = await browser.newContext()
  try {
    const secondPage = await secondContext.newPage()
    const second = await login(secondPage, "second", "conflict")
    await openRecord(secondPage, second, id)
    const firstSection = prEditor(page, id)
    const secondSection = prEditor(secondPage, id)
    const secondDescription = secondSection.getByRole("textbox", { name: "Description", exact: true })
    const secondCostCenter = secondSection.getByRole("textbox", { name: "Cost center", exact: true })
    const posts: string[] = []
    secondPage.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/procurement")) posts.push(request.postData() ?? "")
    })
    await secondDescription.fill("Second actor's unsent scope")
    await firstSection.getByRole("textbox", { name: "Cost center", exact: true }).fill("First actor's saved cost center")
    await requestAction(page, id, firstSection.getByRole("button", { name: "Save requisition draft", exact: true }), "save")
    await expect(requestSummary(page, id)).toContainText("Version 2")
    const conflict = responseFor(secondPage, "save", id)
    await secondSection.getByRole("button", { name: "Save requisition draft", exact: true }).focus()
    await secondPage.keyboard.press("Enter")
    await confirmReview(secondPage, "Confirm action", true)
    const stale = await conflict
    expect(stale.status()).toBe(409)
    expect(await stale.json()).toMatchObject({ ok: false, currentVersionCAS: 2, stored: { pr: { costCenter: "First actor's saved cost center" } } })
    const review = requestDetail(secondPage, id).getByRole("region", { name: "Review conflicting changes", exact: true })
    await expect(review.getByRole("heading", { name: "Review the changed record", exact: true })).toBeFocused()
    await expect(review.locator("[data-current-version-cas]")).toHaveText("Current source version: 2")
    await expect(secondDescription).toHaveValue("Second actor's unsent scope")
    await expect(secondSection).toHaveAttribute("data-version", "1")
    await expect(secondSection).toHaveCount(1)
    expect(posts).toHaveLength(1)
    await expect(secondSection.getByRole("button", { name: "Save requisition draft", exact: true })).toBeDisabled()
    expect(posts).toHaveLength(1)
    await openRecord(page, first, id)
    await expect(firstSection.getByRole("textbox", { name: "Cost center", exact: true })).toHaveValue("First actor's saved cost center")
    await expect(firstSection.getByRole("textbox", { name: "Description", exact: true })).toHaveValue("Recorded service scope")

    // Local typing cannot release a CAS rejection before the source is reviewed.
    await secondCostCenter.fill("Local cost center kept pending source review")
    await expect(review).toBeVisible()
    await expect(secondSection).toHaveAttribute("data-version", "1")
    await expect(secondSection.getByRole("button", { name: "Save requisition draft", exact: true })).toBeDisabled()
    expect(posts).toHaveLength(1)
    await review.getByRole("button", { name: "Review current record", exact: true }).click()
    const keep = review.getByRole("button", { name: "Use reviewed version and keep my entries", exact: true })
    await expect(keep).toBeFocused()
    await expect(review.getByRole("table")).toContainText("Second actor's unsent scope")
    await expect(review.getByRole("table")).toContainText("First actor's saved cost center")
    await expect(secondSection).toHaveAttribute("data-version", "1")
    expect(posts).toHaveLength(1)
    // Explicitly keep the current cost center and the second actor's separate local change.
    await secondCostCenter.fill("First actor's saved cost center")
    await proof(secondPage, info, "cas-explicit-review-step", { id, status: 409, currentVersionCAS: 2, postCountBeforeChoice: posts.length })
    await keep.press("Enter")
    await expect(secondSection).toHaveAttribute("data-version", "2")
    await expect(secondDescription).toBeFocused()
    await expect(secondDescription).toHaveValue("Second actor's unsent scope")
    expect(posts).toHaveLength(1)
    await requestAction(secondPage, id, secondSection.getByRole("button", { name: "Save requisition draft", exact: true }), "save")
    await expect(requestSummary(secondPage, id)).toContainText("Version 3")
    await expect(secondSection.getByRole("button", { name: "Save requisition draft", exact: true })).toBeFocused()
    expect(posts).toHaveLength(2)
    await openRecord(page, first, id)
    await expect(firstSection.getByRole("textbox", { name: "Cost center", exact: true })).toHaveValue("First actor's saved cost center")
    await expect(firstSection.getByRole("textbox", { name: "Description", exact: true })).toHaveValue("Second actor's unsent scope")
  } catch (error) {
    const secondary = secondContext.pages()[0]
    if (secondary && !secondary.isClosed()) {
      const snapshot = await procurementUiSnapshot(secondary).catch(() => null)
      console.info("SF_WP04_PRE_CLOSE_UI", JSON.stringify({ page: "secondary-cas", state: snapshot ?? "unavailable" }))
    }
    throw error
  } finally { await secondContext.close() }
})

test("a stale approval preserves the typed comment and refuses to revive an action after cancellation", async ({ page, browser }, info) => {
  const second = await login(page, "second", "comment")
  const id = await createDraft(page, second, "Approval comment conflict")
  await requestAction(page, id, prEditor(page, id).getByRole("button", { name: "Submit requisition", exact: true }), "submit_pr")
  await expect(requestSummary(page, id)).toContainText("Requisition approval")
  const holderContext = await browser.newContext()
  const dispatch: { release?: () => void; signal?: () => void } = {}
  const observed = new Promise<void>((resolve) => { dispatch.signal = resolve })
  const release = new Promise<void>((resolve) => { dispatch.release = resolve })
  try {
    const holderPage = await holderContext.newPage()
    const first = await login(holderPage, "first", "comment")
    await holderPage.goto(chapterUrl(first, "/orchestra/sf-procurement/approvals/" + encodeSfRouteRef(id)).href)
    const approval = holderPage.locator("[data-sf-record-detail]")
    await expect(approval).toHaveCount(1)
    await approval.getByRole("button", { name: "Review decision", exact: true }).click()
    const decision = holderPage.getByRole("region", { name: "Decision review", exact: true })
    await decision.getByRole("textbox", { name: "Approval comment (optional)", exact: true }).fill("My approval rationale must remain unsent")
    const writes: string[] = []
    holderPage.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/procurement")) writes.push(request.postData() ?? "")
    })
    // Hold the real POST after the native preflight, then cancel through the other actor.
    // The response remains the actual producer CAS response.
    await holderPage.route("**/procurement?*", async (route) => {
      const request = route.request()
      if (request.method() !== "POST" || request.postDataJSON().action !== "approve") { await route.continue(); return }
      dispatch.signal?.()
      await release
      await route.continue()
    })
    const conflict = responseFor(holderPage, "approve", id)
    await confirmReview(holderPage, "Approve PR", true)
    await observed
    const detail = requestDetail(page, id)
    await detail.getByRole("textbox", { name: "Cancellation reason", exact: true }).fill("Requester no longer needs this purchase")
    await requestAction(page, id, detail.getByRole("button", { name: "Cancel request", exact: true }), "cancel")
    await expect(requestSummary(page, id)).toContainText("Cancelled")
    dispatch.release?.()
    const rejected = await conflict
    expect(rejected.status()).toBe(409)
    expect(await rejected.json()).toMatchObject({ currentVersionCAS: 3, stored: { status: "cancelled" } })
    expect(rejected.request().postDataJSON()).toMatchObject({ id, version: 2, values: { comment: "My approval rationale must remain unsent" } })
    const review = holderPage.locator("[data-sf-approval-conflict]")
    await expect(review.getByRole("heading", { name: "Current persisted request", exact: true })).toBeFocused()
    const comment = review.getByRole("textbox", { name: "Approval comment (optional)", exact: true })
    await expect(comment).toHaveValue("My approval rationale must remain unsent")
    await expect(review.locator("[data-current-version-cas]")).toHaveText("Persisted version: 3")
    await review.getByRole("button", { name: "Refresh from source", exact: true }).click()
    await expect(review.locator("[data-sf-current-status]")).toHaveText("Status: cancelled")
    await expect(review.getByRole("status")).toHaveText("The current producer has not admitted this action.")
    await expect(review.getByRole("button", { name: "Approve PR", exact: true })).toBeDisabled()
    await expect(review.getByRole("button", { name: "Use reviewed version and keep my entries", exact: true })).toHaveCount(0)
    await expect(comment).toHaveValue("My approval rationale must remain unsent")
    expect(writes).toHaveLength(1)
    await proof(holderPage, info, "approval-comment-preserved", { id, status: 409, currentVersionCAS: 3, postCount: writes.length, unavailableAction: "approve" })
    await openRecord(page, second, id)
    await expect(requestSummary(page, id)).toContainText("Cancelled")
    await expect(requestDetail(page, id).getByRole("button", { name: /^Approve/ })).toHaveCount(0)
  } finally { dispatch.release?.(); await holderContext.close() }
})

test("a real committed save cannot clear edits typed before its response arrives", async ({ page, browser }, info) => {
  const first = await login(page, "first", "late-edit")
  const id = await createDraft(page, first, "Edits during save response")
  const section = prEditor(page, id)
  const description = section.getByRole("textbox", { name: "Description", exact: true })
  const committed: { release?: () => void; signal?: (status: number) => void } = {}
  const observed = new Promise<number>((resolve) => { committed.signal = resolve })
  const release = new Promise<void>((resolve) => { committed.release = resolve })
  await page.route("**/procurement?*", async (route) => {
    const request = route.request()
    if (request.method() !== "POST" || request.postDataJSON().action !== "save") { await route.continue(); return }
    const response = await route.fetch()
    committed.signal?.(response.status())
    await release
    await route.fulfill({ response })
  })
  const observerContext = await browser.newContext()
  try {
    await description.fill("The value sent to the real host")
    const saved = responseFor(page, "save", id)
    await section.getByRole("button", { name: "Save requisition draft", exact: true }).click()
    await confirmReview(page)
    expect(await observed).toBe(200)
    await description.fill("Later edits remain unsaved")
    committed.release?.()
    expect((await saved).status()).toBe(200)
    await expect(page.getByRole("status").filter({ hasText: /^The submitted changes were saved\. Later edits remain unsaved; review them before continuing\.$/ }))
      .toHaveText("The submitted changes were saved. Later edits remain unsaved; review them before continuing.")
    await expect(description).toHaveValue("Later edits remain unsaved")
    await expect(section).toHaveAttribute("data-dirty", "true")
    const observer = await observerContext.newPage()
    const second = await login(observer, "second", "late-edit")
    await openRecord(observer, second, id)
    await expect(prEditor(observer, id).getByRole("textbox", { name: "Description", exact: true })).toHaveValue("The value sent to the real host")
    await proof(page, info, "later-edits-preserved", { id, status: 200, committedValue: "The value sent to the real host", unsavedValue: "Later edits remain unsaved" })
  } finally { committed.release?.(); await observerContext.close() }
})

test("a recurring request reaches an internally issued PO with source values and negotiated entries preserved", async ({ page }, info) => {
  const account = await login(page, "first", "journey")
  const manifest = await readManifest()
  const id = await createDraft(page, account, "Recurring source-to-order browser journey")
  const detail = requestDetail(page, id)
  const pr = prEditor(page, id)
  await pr.getByRole("checkbox", { name: "Recurring", exact: true }).check()
  await pr.getByRole("textbox", { name: "Frequency", exact: true }).fill("Monthly")
  await pr.getByRole("spinbutton", { name: "Estimated annual", exact: true }).fill("1200")
  await requestAction(page, id, pr.getByRole("button", { name: "Save requisition draft", exact: true }), "save")
  await pr.getByRole("checkbox", { name: "Recurring", exact: true }).uncheck()
  await requestAction(page, id, pr.getByRole("button", { name: "Save requisition draft", exact: true }), "save")
  await expect(pr.getByRole("textbox", { name: "Frequency", exact: true })).toHaveValue("Monthly")
  await expect(pr.getByRole("spinbutton", { name: "Estimated annual", exact: true })).toHaveValue("1200")
  await pr.getByRole("checkbox", { name: "Recurring", exact: true }).check()
  await pr.getByRole("textbox", { name: "Expense type", exact: true }).fill("OPEX")
  await requestAction(page, id, pr.getByRole("button", { name: "Submit requisition", exact: true }), "submit_pr")
  await expect(requestSummary(page, id)).toContainText("Requisition approval")
  await approveRequest(page, account, id, "pr")
  await expect(requestSummary(page, id)).toContainText("Sourcing")

  const sourcing = await openSourcing(page, account, id)
  const sourceForm = sourcing.locator(".sf-u12-editor")
  await expect(sourceForm.getByRole("button", { name: "Submit sourcing", exact: true })).toBeEnabled()
  await sourceForm.getByRole("textbox", { name: "Evaluator", exact: true }).fill("Browser sourcing evaluator")
  await sourceForm.getByRole("textbox", { name: "Fewer quotations justification", exact: true }).fill("One qualified proposal is recorded; this does not establish a complete competition")
  await sourceForm.getByRole("textbox", { name: "Selection justification", exact: true }).fill("Recorded service continuity decision")
  await sourceForm.getByRole("textbox", { name: "Contract strategy", exact: true }).fill("existing")
  await expect(sourceForm.locator(".sf-u12-quote")).toHaveCount(0)
  await sourceForm.getByRole("button", { name: "Add quotation", exact: true }).click()
  const quote = sourceForm.locator(".sf-u12-quote")
  await expect(quote).toHaveCount(1)
  await quote.getByRole("textbox", { name: "Supplier", exact: true }).fill("Journey registered supplier")
  await quote.getByRole("combobox", { name: "Registered supplier", exact: true }).selectOption(manifest.records.supplier)
  await quote.getByRole("textbox", { name: "Currency", exact: true }).fill("EUR")
  await quote.getByRole("spinbutton", { name: "Stated total", exact: true }).fill("100")
  await quote.getByRole("spinbutton", { name: "Quantity", exact: true }).fill("2")
  await quote.getByRole("spinbutton", { name: "Unit price", exact: true }).fill("50")
  const technical = quote.locator(".sf-u12-scores > section").filter({ has: page.getByRole("heading", { name: "Technical scores", exact: true }) }).getByRole("spinbutton")
  const commercial = quote.locator(".sf-u12-scores > section").filter({ has: page.getByRole("heading", { name: "Commercial scores", exact: true }) }).locator('input[type="number"]:not([disabled])')
  await expect(technical).toHaveCount(5)
  await expect(commercial).toHaveCount(2)
  for (const field of await technical.all()) await field.fill("5")
  for (const field of await commercial.all()) await field.fill("4")
  await requestAction(page, id, sourceForm.getByRole("button", { name: "Save sourcing", exact: true }), "save", "Confirm once")
  await expect(quote.getByRole("spinbutton", { name: "Quantity", exact: true })).toHaveValue("2")
  await expect(quote.getByRole("spinbutton", { name: "Unit price", exact: true })).toHaveValue("50")
  await sourcing.getByRole("button", { name: "Compare quotations", exact: true }).click()
  const selection = sourcing.getByRole("combobox", { name: "Selected quotation", exact: true })
  await selection.selectOption({ label: "Journey registered supplier · EUR 100" })
  const selectedQuote = await selection.inputValue()
  expect(selectedQuote).toMatch(/\S/)
  await requestAction(page, id, sourcing.getByRole("button", { name: "Select winning quote", exact: true }), "select_quote", "Confirm once")
  const sourceOrder = sourcing.locator("fieldset[disabled]")
  await expect(sourceOrder).toHaveCount(1)
  await expect(sourceOrder.getByRole("textbox", { name: "Registered supplier", exact: true })).toHaveValue(manifest.records.supplier)
  await expect(sourceOrder.getByRole("textbox", { name: "Currency", exact: true })).toHaveValue("EUR")
  await expect(sourceOrder.getByRole("spinbutton", { name: "Quantity", exact: true })).toHaveValue("2")
  for (const strategy of ["new", "existing"]) {
    await sourcing.getByRole("button", { name: "Sourcing", exact: true }).click()
    await sourceForm.getByRole("textbox", { name: "Contract strategy", exact: true }).fill(strategy)
    await requestAction(page, id, sourceForm.getByRole("button", { name: "Save sourcing", exact: true }), "save", "Confirm once")
    await expect(sourceForm.getByRole("textbox", { name: "Selection justification", exact: true })).toHaveValue("Recorded service continuity decision")
    await expect(quote.getByRole("spinbutton", { name: "Quantity", exact: true })).toHaveValue("2")
    await sourcing.getByRole("button", { name: "Compare quotations", exact: true }).click()
    await expect(selection).toHaveValue(selectedQuote)
    await expect(sourceOrder.getByRole("textbox", { name: "Registered supplier", exact: true })).toHaveValue(manifest.records.supplier)
  }
  await sourcing.getByRole("button", { name: "Sourcing", exact: true }).click()
  await requestAction(page, id, sourceForm.getByRole("button", { name: "Submit sourcing", exact: true }), "submit_sourcing", "Confirm once")
  await expect(requestSummary(page, id)).toContainText("Sourcing approval")
  await approveRequest(page, account, id, "remaining")
  await expect(requestSummary(page, id)).toContainText("Purchase order draft")

  const po = poEditor(page, id)
  const lines = po.locator("[data-sf-po-lines]")
  await expect(po).toHaveCount(1)
  await po.getByRole("textbox", { name: "Description", exact: true }).fill("Negotiated delivery scope")
  await po.getByRole("textbox", { name: "Payment terms", exact: true }).fill("Net 60 negotiated")
  await po.getByLabel("Delivery date", { exact: true }).fill("2026-12-20")
  await po.getByRole("textbox", { name: "Delivery conditions", exact: true }).fill("Inspection and acceptance on delivery")
  await po.getByRole("textbox", { name: "Billing address", exact: true }).fill("Negotiated invoice address")
  await lines.getByRole("spinbutton", { name: "Unit price", exact: true }).fill("48")
  const missingReference = responseFor(page, "submit_po", id)
  await po.getByRole("button", { name: "Submit purchase order", exact: true }).click()
  await confirmReview(page)
  const invalid = await missingReference
  expect(invalid.status()).toBe(422)
  expect((await invalid.json()).fieldErrors).toContainEqual({ field: "po.contractRef", message: "Contract reference is required (call-off under existing contract)" })
  await expect(po.getByRole("textbox", { name: "Contract reference", exact: true })).toBeFocused()
  await expect(po.getByRole("textbox", { name: "Contract reference", exact: true })).toHaveAccessibleDescription("Contract reference is required (call-off under existing contract)")
  await expect(po.getByRole("textbox", { name: "Payment terms", exact: true })).toHaveValue("Net 60 negotiated")
  await expect(lines.getByRole("spinbutton", { name: "Unit price", exact: true })).toHaveValue("48")
  await po.getByRole("textbox", { name: "Contract reference", exact: true }).fill("FRAME-2026-01")
  await requestAction(page, id, po.getByRole("button", { name: "Save purchase order draft", exact: true }), "save")
  const savedVersion = await po.getAttribute("data-version")
  expect(savedVersion).toMatch(/^[1-9]\d*$/)
  await openRecord(page, account, id)
  await expect(po).toHaveAttribute("data-version", savedVersion!)
  await expect(po.getByRole("textbox", { name: "Supplier ID", exact: true })).toHaveValue(manifest.records.supplier)
  await expect(po.getByRole("textbox", { name: "Currency", exact: true })).toHaveValue("EUR")
  await expect(po.getByRole("textbox", { name: "Contract reference", exact: true })).toHaveValue("FRAME-2026-01")
  await expect(po.getByRole("textbox", { name: "Payment terms", exact: true })).toHaveValue("Net 60 negotiated")
  await expect(lines.getByRole("spinbutton", { name: "Quantity", exact: true })).toHaveValue("2")
  await expect(lines.getByRole("spinbutton", { name: "Unit price", exact: true })).toHaveValue("48")
  const origins = detail.getByRole("region", { name: "Purchase order field origins", exact: true })
  await expect(origins).toContainText("Net 45")
  await expect(origins).toContainText("Net 60 negotiated")
  await po.getByRole("textbox", { name: "Notes", exact: true }).fill("A later edit must not reapply master defaults")
  await requestAction(page, id, po.getByRole("button", { name: "Save purchase order draft", exact: true }), "save")
  await expect(po.getByRole("textbox", { name: "Payment terms", exact: true })).toHaveValue("Net 60 negotiated")
  await expect(po.getByRole("textbox", { name: "Billing address", exact: true })).toHaveValue("Negotiated invoice address")
  await expect(po.getByRole("textbox", { name: "Contract reference", exact: true })).toHaveValue("FRAME-2026-01")
  await expect(lines.getByRole("spinbutton", { name: "Quantity", exact: true })).toHaveValue("2")
  await requestAction(page, id, po.getByRole("button", { name: "Submit purchase order", exact: true }), "submit_po")
  await expect(requestSummary(page, id)).toContainText("Purchase order approval")
  await approveRequest(page, account, id, "remaining")
  await expect(requestSummary(page, id)).toContainText("Purchase order approved")
  await requestAction(page, id, detail.getByRole("button", { name: "Issue purchase order internally", exact: true }), "issue")
  const issuedVersion = await po.getAttribute("data-version")
  await openRecord(page, account, id)
  await expect(po).toHaveAttribute("data-version", issuedVersion!)
  await expect(po.getByRole("textbox", { name: "Supplier ID", exact: true })).toHaveValue(manifest.records.supplier)
  await expect(po.getByRole("textbox", { name: "Currency", exact: true })).toHaveValue("EUR")
  await expect(po.getByRole("textbox", { name: "Payment terms", exact: true })).toHaveValue("Net 60 negotiated")
  await expect(po.getByRole("textbox", { name: "Contract reference", exact: true })).toHaveValue("FRAME-2026-01")
  await expect(lines.getByRole("spinbutton", { name: "Quantity", exact: true })).toHaveValue("2")
  await expect(lines.getByRole("spinbutton", { name: "Unit price", exact: true })).toHaveValue("48")
  await expect(requestSummary(page, id)).toContainText("Issued internally")
  await expect(requestSummary(page, id)).toContainText("103.68 USD")
  await po.scrollIntoViewIfNeeded()
  await proof(page, info, "pr-sourcing-po-issued", { id, sourceSupplier: manifest.records.supplier, currency: "EUR", quantity: 2, negotiatedUnitPrice: 48, savedPaymentTerms: "Net 60 negotiated", issuedInternally: true })
})

test("the A B C comparison shows score components and retains submitted FX in the real detail and queue", async ({ page }, info) => {
  const account = await login(page, "first", "comparison")
  const manifest = await readManifest()
  const id = manifest.records.comparison
  const sourcing = await openSourcing(page, account, id, true)
  const comparison = sourcing.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Base amount / FX", exact: true }) })
  const row = (code: string) => comparison.locator('tr[data-sf-row="' + code + '"]')
  const cells = (code: string) => row(code).locator(":scope > td:not(:first-child):not(:last-child)")
  await expect(row("A").locator(".sf-s01-cell-value")).toHaveText("Browser quote A")
  await expect(row("B").locator(".sf-s01-cell-value")).toHaveText("Browser quote B")
  await expect(row("C").locator(".sf-s01-cell-value")).toHaveText("Browser quote C")
  await expect(cells("A")).toHaveText(["Eligible", "USD", "32400", "32400 USD (base: 1)", "87.0", "93.3", "89.3", "87.9", "1", "", "1", "32400", "5, 4, 4, 4, 4", ", 4, 4"])
  await expect(cells("B")).toHaveText(["Eligible", "EUR", "28000", "30240 USD (submitted FX: 1.08)", "77.0", "100.0", "97.0", "85.0", "2", "", "1", "28000", "4, 4, 4, 3, 4", ", 5, 4"])
  await expect(cells("C")).toHaveText(["Not compliant", "USD", "29000", "29000 USD (base: 1)", "Unavailable", "Unavailable", "Unavailable", "Unavailable", "", "Technically ineligible", "1", "29000", "5, 5, 5, 5, 5", ", 5, 5"])
  await expect(sourcing).toContainText("Rank 1: Browser quote A")
  await expect(sourcing).toContainText("2160 USD (7.14%) above the lowest eligible proposal")
  await expect(sourcing.locator("[data-sf-sourcing-selection] dd")).toHaveText(["Browser quote A", "Recorded technical preference"])
  await expect(requestSummary(page, id)).toContainText("32400 USD")
  await comparison.scrollIntoViewIfNeeded()
  await proof(page, info, "abc-submitted-comparison", { id, selectedBaseAmount: 32400, euroOriginal: 28000, submittedFx: 1.08, euroBaseAmount: 30240, rank: ["A", "B"], excluded: ["C"] })

  await page.goto(chapterUrl(account, "/orchestra/sf-procurement/requests").href)
  const queue = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Value basis", exact: true }) })
  const queueRow = queue.locator('tr[data-sf-row="' + id + '"]')
  await expect(queueRow.getByRole("cell", { name: "Frozen browser sourcing comparison", exact: true })).toHaveCount(1)
  await expect(queueRow.getByRole("cell", { name: "pending-approval", exact: true })).toHaveCount(1)
  await expect(queueRow.getByRole("cell", { name: "32400 USD", exact: true })).toHaveCount(1)
  await page.goto(chapterUrl(account, "/orchestra/sf-procurement/settings").href)
  const settings = page.locator("form.sf-n21-settings-form")
  await expect(settings).toHaveAttribute("data-version", /^[1-9]\d*$/)
  const version = Number(await settings.getAttribute("data-version"))
  await settings.locator("#sf-u36-fx-rate-1").fill("2")
  const saved = responseFor(page, "save")
  await reviewSettings(page, settings)
  expect((await saved).status()).toBe(200)
  await expect(settings).toHaveAttribute("data-version", String(version + 1))
  await openSourcing(page, account, id, true)
  await expect(row("B").locator("td").nth(4)).toHaveText("30240 USD (submitted FX: 1.08)")
  await expect(row("B").locator("td").nth(2)).toHaveText("EUR")
  await expect(row("B").locator("td").nth(3)).toHaveText("28000")
  await expect(comparison).not.toContainText("56000 USD")
  await expect(requestSummary(page, id)).toContainText("32400 USD")

  await page.goto(chapterUrl(account, "/orchestra/sf-procurement/requests").href)
  const filters = page.locator("fieldset.sf-procurement-queue-filters")
  const stageFilter = filters.getByRole("combobox", { name: "Status", exact: true })
  const decisionFilter = filters.getByRole("combobox", { name: "Decision", exact: true })
  const search = filters.getByRole("searchbox", { name: "Search", exact: true })
  await expect(queueRow.getByRole("cell", { name: "32400 USD", exact: true })).toHaveCount(1)
  await expect(stageFilter.locator('option[value="src_pending"]')).toHaveCount(1)
  const statuses = await stageFilter.locator("option").evaluateAll((options) =>
    options.map((option) => option.getAttribute("value") ?? ""),
  )
  expect(statuses[0]).toBe("")
  expect(new Set(statuses).size).toBe(statuses.length)
  const sourcingStatus = statuses.indexOf("src_pending")
  expect(sourcingStatus).toBeGreaterThan(0)
  await stageFilter.focus()
  await page.keyboard.press("End")
  await expect(stageFilter).toHaveValue(statuses[statuses.length - 1]!)
  // Statuses follow the authorized source order. Select the required status
  // with the keyboard without assuming it is the final option.
  await page.keyboard.press("Space")
  await page.keyboard.press("Home")
  for (let index = 0; index < sourcingStatus; index++) await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
  await expect(stageFilter).toHaveValue("src_pending")
  await page.keyboard.press("Tab")
  await expect(decisionFilter).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(search).toBeFocused()
  await page.keyboard.press("ControlOrMeta+A")
  await page.keyboard.type("unmatched-wp04-request")
  await expect(queueRow).toHaveCount(0)
  await stageFilter.focus()
  await page.keyboard.press("Home")
  await expect(stageFilter).toHaveValue("")
  await page.keyboard.press("Tab")
  await expect(decisionFilter).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(search).toBeFocused()
  await page.keyboard.press("ControlOrMeta+A")
  await page.keyboard.type(id)
  await expect(queueRow.getByRole("cell", { name: "Frozen browser sourcing comparison", exact: true })).toHaveCount(1)
  await expect(queueRow.getByRole("cell", { name: "32400 USD", exact: true })).toHaveCount(1)
  await proof(page, info, "queue-keyboard-filter-restored", { id, filter: "All", search: id, interaction: "End, Space, Home, ArrowDown to src_pending, Enter, Tab, Tab, text; Home, Tab, Tab, text", retainedBaseAmount: 32400 })

  // The exact C02 anchor omits owner parameters; the real selected profile survives it.
  await queueRow.getByRole("link", { name: id, exact: true }).click()
  await expect(page).toHaveURL((url) => url.searchParams.get("request") === id && !url.searchParams.has("server"))
  await expect(page.locator('[data-sf-host="owner-runtime231"]')).toHaveAttribute("data-sf-provider-state", "ready")
  await expect(queueRow).toHaveAttribute("aria-selected", "true")
  await expect(queueRow.getByRole("cell", { name: "32400 USD", exact: true })).toHaveCount(1)
})

test("an authorized bank change requires supplier revalidation and a real viewer cannot read or update bank details", async ({ page, browser }, info) => {
  const first = await login(page, "first", "suppliers")
  const manifest = await readManifest()
  const id = manifest.records.supplier
  const supplierPath = "/orchestra/sf-procurement/suppliers/" + encodeSfRouteRef(id)
  await page.goto(chapterUrl(first, supplierPath).href)
  const supplier = page.locator('.sf-u14-detail[data-sf-supplier-ref="' + id + '"]')
  await expect(supplier).toHaveCount(1)
  const supplierRow = page.locator('tr[data-sf-row="' + id + '"]')
  await expect(supplierRow).toHaveCount(1)
  await expect(supplierRow.getByRole("cell", { name: "Journey registered supplier", exact: true })).toBeVisible()
  await expect(supplierRow.getByRole("cell", { name: "active", exact: true })).toBeVisible()
  const supplierNumber = (await supplierRow.locator(".sf-s01-cell-value").innerText()).trim()
  expect(supplierNumber).toMatch(/^SUP-\d+$/)
  await supplier.getByRole("button", { name: "Review bank change", exact: true }).click()
  const bank = page.locator('.sf-u14-editor[data-sf-supplier-ref="' + id + '"][aria-label="Bank"]')
  await expect(bank).toHaveAttribute("data-version", /^[1-9]\d*$/)
  const before = Number(await bank.getAttribute("data-version"))
  await expect(bank.getByRole("textbox", { name: "IBAN", exact: true })).toHaveValue("TEST-ORIGINAL-IBAN")
  await bank.getByRole("textbox", { name: "IBAN", exact: true }).fill("TEST-REVISED-IBAN")
  const changed = responseFor(page, "change-bank", id)
  await bank.getByRole("button", { name: "Review bank change", exact: true }).click()
  const bankReview = page.locator('[data-component="sf-change-review"]')
  await expect(bankReview).not.toContainText("TEST-REVISED-IBAN")
  await expect(bankReview).not.toContainText("TEST-ORIGINAL-IBAN")
  await confirmReview(page, "Confirm once")
  const response = await changed
  expect(response.status()).toBe(200)
  const result = await response.json()
  expect(result).toMatchObject({ ok: true })
  expect(response.request().postDataJSON()).toMatchObject({ id, version: before, values: { supplier: { iban: "TEST-REVISED-IBAN" } } })
  expect(Object.keys(response.request().postDataJSON().values.supplier)).toEqual(["iban"])
  expect(JSON.stringify(result)).not.toContain("TEST-REVISED-IBAN")
  expect(JSON.stringify(result)).not.toContain("TEST-ORIGINAL-IBAN")
  await expect(supplier).toHaveAttribute("data-version", String(before + 1))
  await expect(supplier).toContainText("Bank details changed after activation; validation must be repeated.")
  await expect(supplierRow.getByRole("cell", { name: "pending", exact: true })).toBeVisible()
  await supplier.getByRole("button", { name: "Review bank change", exact: true }).click()
  await expect(bank.getByRole("textbox", { name: "IBAN", exact: true })).toHaveValue("TEST-REVISED-IBAN")
  await proof(page, info, "supplier-bank-revalidation", { supplier: id, result: "pending", validationCleared: true, actorRole: "admin" }, [bank])

  const viewerContext = await browser.newContext()
  try {
    const observer = await viewerContext.newPage()
    const viewer = await login(observer, "viewer", "suppliers")
    const projection = observer.waitForResponse((response) =>
      response.request().method() === "GET" && new URL(response.url()).pathname.endsWith("/api/ui/pages/CAP27"),
    )
    const read = await observer.goto(chapterUrl(viewer, supplierPath).href)
    expect(read?.status()).toBe(200)
    const source = await projection
    expect(source.status()).toBe(200)
    const sourceText = await source.text()
    expect(sourceText).not.toContain("TEST-REVISED-IBAN")
    expect(sourceText).not.toContain("TEST-ORIGINAL-ACCOUNT")
    expect(sourceText).not.toContain("TEST-ORIGINAL-IBAN")
    const visible = observer.locator('.sf-u14-detail[data-sf-supplier-ref="' + id + '"]')
    await expect(observer.locator('tr[data-sf-row="' + id + '"] .sf-s01-cell-value')).toHaveText(supplierNumber)
    expect(await supplierValidation(observer, viewer, supplierNumber)).toEqual({ number: supplierNumber, status: "pending", validatedBy: "", validatedAt: "" })
    await expect(visible).toContainText("Bank details are masked for this role.")
    await expect(observer.locator('[name="iban"], [name="account"], [name="bankName"], [name="swift"]')).toHaveCount(0)
    await expect(visible.getByRole("button", { name: "Review bank change", exact: true })).toHaveCount(0)
    await expect(visible).not.toContainText("TEST-REVISED-IBAN")
    const denied = await observer.request.post(viewer.baseURL + "/procurement?page=Suppliers", { headers: { origin: manifest.origin, "sec-fetch-site": "same-origin" },
      data: { page: "Suppliers", action: "change-bank", id, version: before + 1, values: { iban: "FORGED-VIEWER-CHANGE" } } })
    expect(denied.status()).toBe(403)
    expect(await denied.text()).not.toContain("TEST-REVISED-IBAN")
    await proof(observer, info, "supplier-viewer-redaction", { supplier: id, bankControls: 0, unauthorizedWrite: 403, syntheticPolicy: "viewer-only" })
    await page.reload()
    await expect(supplier).toHaveAttribute("data-version", String(before + 1))
    await supplier.getByRole("button", { name: "Review bank change", exact: true }).click()
    await expect(bank.getByRole("textbox", { name: "IBAN", exact: true })).toHaveValue("TEST-REVISED-IBAN")
    await bank.getByRole("button", { name: "Cancel", exact: true }).click()
    const reactivated = responseFor(page, "activate", id)
    await supplier.getByRole("button", { name: "Activate", exact: true }).click()
    await confirmReview(page, "Confirm once")
    const confirmed = await reactivated
    expect(confirmed.status()).toBe(200)
    expect(await confirmed.json()).toMatchObject({ ok: true })
    await expect(supplier).toHaveAttribute("data-version", String(before + 2))
    await expect(supplier).not.toContainText("Bank details changed after activation; validation must be repeated.")
    await expect(supplierRow.getByRole("cell", { name: "active", exact: true })).toBeVisible()
    await observer.reload()
    expect(await supplierValidation(observer, viewer, supplierNumber)).toEqual({ number: supplierNumber, status: "active", validatedBy: first.principal, validatedAt: "2026-11-13T12:00:00Z" })
    await expect(visible).toContainText("Bank details are masked for this role.")
    await expect(observer.locator('[name="iban"], [name="account"]')).toHaveCount(0)
    await proof(observer, info, "supplier-reactivated-masked", { supplier: id, result: "active", revalidatedBy: first.principal, bankControls: 0 })
  } finally { await viewerContext.close() }
})

test("settings reject invalid currencies with visible feedback and reset restores defaults without changing a submitted request", async ({ page }, info) => {
  const account = await login(page, "first", "settings")
  const manifest = await readManifest()
  const comparison = await openRecord(page, account, manifest.records.comparison)
  const unchanged = await comparison.locator("[data-request-summary]").textContent()
  await page.goto(chapterUrl(account, "/orchestra/sf-procurement/settings").href)
  const settings = page.locator("form.sf-n21-settings-form")
  await expect(settings).toHaveAttribute("data-version", /^[1-9]\d*$/)
  const version = Number(await settings.getAttribute("data-version"))
  await settings.locator("#sf-u36-fx-rate-1").fill("0")
  await settings.locator("#sf-u36-field-billingAddress").fill("Preserved unsent settings address")
  const rejected = responseFor(page, "save")
  await reviewSettings(page, settings)
  expect((await rejected).status()).toBe(422)
  await expect(page.locator(".sf-n21-settings-error[role=alert]")).toHaveText("Invalid matrix or currencies")
  await expect(settings).toHaveAttribute("data-version", String(version))
  await expect(settings.locator("#sf-u36-fx-rate-1")).toHaveValue("0")
  await expect(settings.locator("#sf-u36-field-billingAddress")).toHaveValue("Preserved unsent settings address")
  await settings.locator("#sf-u36-fx-rate-1").fill("1.2")
  const accepted = responseFor(page, "save")
  await reviewSettings(page, settings)
  expect((await accepted).status()).toBe(200)
  await expect(settings).toHaveAttribute("data-version", String(version + 1))
  await expect(page.locator(".sf-n21-settings-notice[role=status]")).toHaveText("Changes saved.")
  await expect(settings.locator("#sf-u36-field-billingAddress")).toHaveValue("Preserved unsent settings address")
  await expect(settings.getByRole("button", { name: "Review changes", exact: true })).toBeFocused()
  await page.keyboard.press("Tab")
  const reset = settings.getByRole("button", { name: "Reset settings", exact: true })
  await expect(reset).toBeFocused()
  await expect(settings).toContainText("Requests, suppliers, issued identifiers and submitted approval/FX snapshots remain preserved")
  await page.keyboard.press("Enter")
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await expect(review).toContainText("Requests, suppliers, issued identifiers and submitted approval/FX snapshots remain preserved")
  const confirm = review.getByRole("button", { name: "Reset settings", exact: true })
  await expect(confirm).toBeEnabled()
  await confirm.focus()
  await expect(confirm).toBeFocused()
  const restored = responseFor(page, "reset")
  await page.keyboard.press("Space")
  const response = await restored
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toMatchObject({ page: "Settings", action: "reset", version: version + 1, values: {} })
  await expect(settings).toHaveAttribute("data-version", String(version + 2))
  await expect(settings.locator("#sf-u36-fx-rate-1")).toHaveValue("1.08")
  await expect(settings.locator("#sf-u36-field-minQuotes")).toHaveValue("3")
  await expect(settings.locator("#sf-u36-field-billingAddress")).toHaveValue("")
  await expect(page.locator(".sf-n21-settings-notice[role=status]")).toHaveText("Changes saved.")
  await openRecord(page, account, manifest.records.comparison)
  await expect(comparison.locator("[data-request-summary]")).toHaveText(unchanged!)
  const sourcing = await openSourcing(page, account, manifest.records.comparison, true)
  await expect(sourcing).toContainText("30240 USD (submitted FX: 1.08)")
  await expect(requestSummary(page, manifest.records.comparison)).toHaveText(unchanged!)
  await proof(page, info, "settings-reset-preserves-submitted-source", { invalidSave: 422, validSave: 200, reset: 200, resetInteraction: "Tab, Enter, focus confirmation, Space", retainedRequest: manifest.records.comparison, submittedEuroFx: 1.08 })
})
