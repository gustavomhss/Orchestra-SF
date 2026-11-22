import { expect, type Locator, type Page, type Request, type Response, type TestInfo } from "@playwright/test"
import { decisionsInstallationOrigin, startPlannerInstallation } from "../wp03/installation-fixture"
import { Schema } from "effect"
import { SfProjectionCase } from "@orchestra/schema/sucafina/decisions"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"

export const draft = {
  objective: "CI Decisions — annual service decision",
  horizon: { start: "2027-01-01", end: "2027-12-31" },
  currency: "USD",
  criteria: ["Preserve the declared annual horizon", "Require explicit human approval before any financial change"],
  sourceRefs: [],
}

export function isCommand(request: Request, mode: string, method = "POST") {
  const url = new URL(request.url())
  return request.method() === method && url.pathname === "/sucafina/dashboard" && url.searchParams.get("sf") === mode
}

export function asRecord(value: unknown): Record<string, unknown> {
  expect(value).not.toBeNull()
  expect(typeof value).toBe("object")
  expect(Array.isArray(value)).toBe(false)
  return value as Record<string, unknown>
}

export function caseIdentity(reference: string) {
  const parts = /^case:([^:]+):([^:]+)$/.exec(reference)
  expect(parts, "The real producer must return a case identity and incarnation").not.toBeNull()
  return { id: decodeURIComponent(parts![1]!), incarnation: decodeURIComponent(parts![2]!) }
}

export async function withInstallation(page: Page, info: TestInfo,
  action: (installation: Awaited<ReturnType<typeof startPlannerInstallation>>, observations: Record<string, unknown>[]) => Promise<void>) {
  const observations: Record<string, unknown>[] = []
  const body = { completed: false }
  const installation = await startPlannerInstallation(info)
  const requests: { method: string; mode: string; operation?: string; idempotencyKey?: string }[] = []
  const listener = (request: Request) => {
    const url = new URL(request.url())
    if (url.origin !== installation.origin || !url.searchParams.has("sf")) return
    const body: unknown = request.method() === "POST" && request.headers()["content-type"]?.includes("application/json")
      ? request.postDataJSON() : undefined
    requests.push({ method: request.method(), mode: url.searchParams.get("sf")!,
      ...(body && typeof body === "object" && "operation" in body && typeof body.operation === "string" ? { operation: body.operation } : {}),
      ...(request.headers()["idempotency-key"] ? { idempotencyKey: request.headers()["idempotency-key"] } : {}) })
  }
  page.on("request", listener)
  const diagnostics: string[] = []
  const onConsole = (message: { type: () => string; text: () => string }) => { if (message.type() === "error") diagnostics.push(receiptDiagnostic(`console.error: ${message.text()}`)) }
  const onPageError = (error: Error) => diagnostics.push(receiptDiagnostic(`pageerror: ${error.message}`))
  const onNavigated = (frame: { page: () => unknown }) => { if (frame.page() === page) diagnostics.push(receiptDiagnostic(`navigated: ${page.url()}`)) }
  page.on("console", onConsole)
  page.on("pageerror", onPageError)
  page.on("framenavigated", onNavigated)
  try {
    await installation.signIn(page)
    await action(installation, observations)
    body.completed = true
  } finally {
    page.off("request", listener)
    page.off("console", onConsole)
    page.off("pageerror", onPageError)
    page.off("framenavigated", onNavigated)
    // Never retain cookies, authorization headers, enrollment URLs or arbitrary response bodies.
    try {
      await info.attach("decisions-observations.json", { contentType: "application/json", body: JSON.stringify({
        selection: "CI-UI-DECISIONS", snapshot: process.env.GITHUB_SHA ?? null, test: info.title, bodyCompleted: body.completed, observations, requests, diagnostics: diagnostics.slice(-200),
        verdict: "The Playwright runtime report owns the terminal test result.",
        limit: "Observed stages only; unexecuted choice, C10, C12, native critique and C17 replay are not accepted by this receipt.",
      }, null, 2) })
    } finally { await installation.stop() }
  }
}

function receiptDiagnostic(value: string) {
  return value
    .replace(/https?:\/\/\S*\/sucafina\/auth\/\S*/g, "[enrollment-url]")
    .replace(/([?&]code=)[^&\s]*/gi, "$1redacted")
}

export async function enterWorkbench(page: Page, origin: string) {
  expect(origin, "Native Decisions must use the shell served by its installation CLI").toBe(decisionsInstallationOrigin)
  const response = await page.goto(new URL("/orchestra/sf-decisions", origin).href)
  expect(response?.status()).toBe(200)
  await expect(page).toHaveURL((url) => url.origin === origin && url.pathname === "/orchestra/sf-decisions")
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled()
  await expect(page.getByRole("heading", { name: "Decisions", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled()
}

export async function fillDecision(page: Page, objective: string, criteria = draft.criteria) {
  await page.getByRole("button", { name: "New case", exact: true }).click()
  const form = page.locator("section.sf-n24-create form")
  await expect(form).toHaveCount(1)
  await expect(form.getByLabel("Decision objective", { exact: true })).toBeEnabled()
  await form.getByLabel("Decision objective", { exact: true }).fill(objective)
  await form.getByLabel("Start", { exact: true }).fill(draft.horizon.start)
  await form.getByLabel("End", { exact: true }).fill(draft.horizon.end)
  await form.getByLabel("Currency", { exact: true }).fill(draft.currency)
  await form.getByLabel("Criteria, one per line", { exact: true }).fill(criteria.join("\n"))
  const review = form.getByRole("button", { name: "Review creation", exact: true })
  await expect(review).toBeEnabled()
  await review.click()
  const proposed = form.getByRole("group", { name: "Review creation", exact: true })
  await expect(proposed).toContainText(objective)
  for (const criterion of criteria) await expect(proposed.getByRole("listitem").filter({ hasText: criterion })).toHaveText(criterion)
  await expect(form.getByRole("button", { name: "Confirm this decision creation", exact: true })).toBeEnabled()
  return form
}

export async function openCreatedDecision(page: Page, form: Locator, reference: string) {
  const link = form.getByRole("link", { name: "Open decision", exact: true })
  const href = await link.getAttribute("href")
  expect(href).toBeTruthy()
  const url = new URL(href!, page.url())
  expect(url.origin).toBe(new URL(page.url()).origin)
  expect(url.pathname).toBe("/orchestra/sf-decisions/" + encodeSfRouteRef(reference))
  await link.click()
  await expect(page).toHaveURL(url.href)
}

export async function enterInstalledWorkbench(page: Page, origin: string) {
  expect(origin).toBe(decisionsInstallationOrigin)
  const url = new URL("/sucafina/dashboard?sf=workbench", origin)
  const response = await page.goto(url.href)
  expect(response?.status()).toBe(200)
  await expect(page).toHaveURL(url.href)
  await expect(page.getByRole("heading", { name: "Decisions", exact: true })).toBeVisible()
}

/** These preserved controls consume the same case through the installed Workbench. */
export async function openInstalledWorkbenchCase(page: Page, origin: string, reference: string, objective: string) {
  await enterInstalledWorkbench(page, origin)
  const link = page.getByRole("link", { name: objective, exact: true })
  await expect(link).toHaveCount(1)
  const url = new URL("/sucafina/dashboard", origin)
  url.searchParams.set("sf", "workbench-case")
  url.searchParams.set("caseRef", reference)
  expect(new URL((await link.getAttribute("href"))!, page.url()).href).toBe(url.href)
  await link.click()
  await expect(page).toHaveURL(url.href)
  await expect(page.getByRole("heading", { name: objective, exact: true })).toBeVisible()
}

type PausedCommand = {
  requestId: string
  request: { url: string; method: string }
  responseStatusCode?: number
  responseHeaders?: { name: string; value: string }[]
}

/** Capture the actual server reply at the response stage, before a document
 * navigation evicts its body from Chromium. Exactly one original command is
 * sent; these bytes/status/headers are fulfilled back to the same browser.
 */
export async function clickCommand(page: Page, button: Locator, mode: string, observations: Record<string, unknown>[], method = "POST") {
  await expect(button).toBeEnabled()
  const origin = new URL(page.url()).origin
  const session = await page.context().newCDPSession(page)
  const captured = Promise.withResolvers<{ url: string; status: number; contentType: string; json: string }>()
  session.once("Fetch.requestPaused", async (event: PausedCommand) => {
    try {
      const url = new URL(event.request.url)
      expect(url.origin).toBe(origin)
      expect(url.pathname).toBe("/sucafina/dashboard")
      expect(url.searchParams.get("sf")).toBe(mode)
      expect(event.request.method).toBe(method)
      const status = event.responseStatusCode
      if (typeof status !== "number") throw new Error("Missing original command HTTP status")
      const headers = event.responseHeaders ?? []
      const contentType = headers.find((header) => header.name.toLowerCase() === "content-type")?.value ?? ""
      const raw = await session.send("Fetch.getResponseBody", { requestId: event.requestId })
      const bytes = raw.base64Encoded ? Buffer.from(raw.body, "base64") : Buffer.from(raw.body, "utf8")
      await session.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: status,
        responseHeaders: headers, body: bytes.toString("base64") })
      captured.resolve({ url: event.request.url, status, contentType, json: bytes.toString("utf8") })
    } catch (error) {
      try { await session.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "Failed" }) }
      catch { /* Already released by the browser; surface original error below. */ }
      captured.reject(error)
    }
  })
  await session.send("Fetch.enable", { patterns: [{ urlPattern: `${origin}/sucafina/dashboard\\?sf=${mode}*`, requestStage: "Response" }] })
  try {
    await button.click()
    const reply = await captured.promise
    return checkedReply({ mode: new URL(reply.url).searchParams.get("sf"), httpStatus: reply.status, contentType: reply.contentType },
      () => JSON.parse(reply.json), observations)
  } finally {
    await session.send("Fetch.disable")
    await session.detach()
  }
}

export async function readReply(response: Response, observations: Record<string, unknown>[]) {
  return checkedReply({ mode: new URL(response.url()).searchParams.get("sf"), httpStatus: response.status(),
    contentType: response.headers()["content-type"] ?? "" }, () => response.json(), observations)
}

async function checkedReply(record: { mode: string | null; httpStatus: number; contentType: string },
  read: () => unknown | Promise<unknown>, observations: Record<string, unknown>[]) {
  observations.push(record)
  // A legacy HTML page returned with 200 cannot satisfy a domain command.
  expect(record.contentType, `Expected the installed Decisions handler for ${record.mode}`).toContain("application/json")
  const result = asRecord(await read())
  observations.push({ mode: record.mode, status: result.status, reason: result.reason, outputRef: result.outputRef })
  expect(record.httpStatus, `Domain response for ${record.mode}`).toBe(200)
  expect(result.status, `Domain outcome for ${record.mode}`).toBe("ok")
  return result
}

export async function readCase(page: Page, reference: string) {
  const url = new URL("/sucafina/api/ui/projections/case", page.url())
  url.searchParams.set("caseRef", reference)
  const response = await page.request.get(url.href)
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("application/json")
  const result = Schema.decodeUnknownSync(Schema.toType(SfProjectionCase.output), { onExcessProperty: "error" })(await response.json())
  if (result.status !== "ok") throw new Error("The original case projection was not admitted")
  expect(result.value.projection.case).toMatchObject(caseIdentity(reference))
  return result.value.projection.case
}

export async function assertCase(page: Page, reference: string, objective: string, version: number) {
  const identity = caseIdentity(reference)
  await expect(page).toHaveURL((url) => url.pathname === "/orchestra/sf-decisions/" + encodeSfRouteRef(reference))
  const decision = page.locator('[data-sf-surface="UI34"]')
  await expect(decision, "The real native case projection must be available under the current owner").toBeVisible()
  await expect(decision).toHaveAttribute("data-sf-case-ref", reference)
  await expect(decision).toHaveAttribute("data-sf-case-version", String(version))
  const original = await readCase(page, reference)
  expect(original).toMatchObject({ ...identity, version, objective, state: "draft",
    horizon: draft.horizon, currency: draft.currency })
  expect(original.criteria.map((criterion) => ({ description: criterion.description, required: criterion.required })))
    .toEqual(draft.criteria.map((description) => ({ description, required: true })))
  await expect(decision.getByRole("region", { name: "Question", exact: true }).getByText(objective, { exact: true })).toBeVisible()
  await expect(decision.locator(".sf-n24-metadata > span")).toHaveText([
    `Current version: ${version}`, "State: draft",
    `Period: ${draft.horizon.start} – ${draft.horizon.end}`, draft.currency,
  ])
  const criteria = decision.getByRole("region", { name: "Criteria", exact: true })
  for (const criterion of draft.criteria)
    await expect(criteria.getByRole("listitem").filter({ hasText: criterion })).toHaveText(criterion + " · Required")
  await expect(decision.getByText("No alternatives recorded.", { exact: true })).toBeVisible()
  await expect(decision.getByText("No changes prepared.", { exact: true })).toBeVisible()
  expect(original.alternatives).toEqual([])
  expect(original.preparedChanges).toEqual([])
  await expect(page.getByRole("button", { name: "Record choice", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Apply reviewed change", exact: true })).toHaveCount(0)
  return decision
}

export async function reopenCase(page: Page, reference: string, objective: string) {
  if (new URL(page.url()).pathname === "/orchestra/sf-decisions")
    await page.getByRole("button", { name: "Refresh case list", exact: true }).click()
  else await page.getByRole("link", { name: "Back to decisions", exact: true }).click()
  const list = page.getByRole("region", { name: "Authorized decision cases", exact: true })
  const row = list.getByRole("listitem").filter({ has: page.getByText(reference, { exact: true }) })
  await expect(row, "The persisted case must be discoverable under the current operator authority").toHaveCount(1)
  await expect(row.getByText(objective, { exact: true })).toBeVisible()
  const link = row.getByRole("link", { name: "Open decision", exact: true })
  await expect(link).toHaveCount(1)
  const target = new URL((await link.getAttribute("href"))!, page.url())
  expect(target.pathname).toBe("/orchestra/sf-decisions/" + encodeSfRouteRef(reference))
  await link.click()
}
