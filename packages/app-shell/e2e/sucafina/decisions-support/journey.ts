import { expect, type Locator, type Page, type Request, type Response, type TestInfo } from "@playwright/test"
import { startPlannerInstallation } from "../wp03/installation-fixture"

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
  try {
    await page.context().addCookies([installation.cookie])
    await action(installation, observations)
    body.completed = true
  } finally {
    page.off("request", listener)
    // Never retain cookies, authorization headers, enrollment URLs or arbitrary response bodies.
    try {
      await info.attach("decisions-observations.json", { contentType: "application/json", body: JSON.stringify({
        selection: "CI-UI-DECISIONS", snapshot: process.env.GITHUB_SHA ?? null, test: info.title, bodyCompleted: body.completed, observations, requests,
        verdict: "The Playwright runtime report owns the terminal test result.",
        limit: "Observed stages only; unexecuted choice, C10, C12, native critique and C17 replay are not accepted by this receipt.",
      }, null, 2) })
    } finally { await installation.stop() }
  }
}

export async function enterWorkbench(page: Page, origin: string) {
  await page.goto(`${origin}/sucafina/dashboard`)
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled()
  const link = page.getByRole("link", { name: "Workbench", exact: true })
  await expect(link).toHaveCount(1)
  await link.click()
  await expect(page).toHaveURL(`${origin}/sucafina/dashboard?sf=workbench`)
  await expect(page.getByRole("heading", { name: "Decisions", exact: true })).toBeVisible()
  await expect(page.locator("form[data-decision-create]")).toHaveAttribute("data-sf-create-ready", "true")
}

export async function fillDecision(page: Page, objective: string) {
  const form = page.locator("form[data-decision-create]")
  await page.getByText("Create a decision", { exact: true }).click()
  await expect(form).toHaveCount(1)
  await form.getByLabel("Decision objective", { exact: true }).fill(objective)
  await form.getByLabel("Start", { exact: true }).fill(draft.horizon.start)
  await form.getByLabel("End", { exact: true }).fill(draft.horizon.end)
  await form.getByLabel("Currency", { exact: true }).fill(draft.currency)
  await form.getByLabel("Criteria, one per line", { exact: true }).fill(draft.criteria.join("\n"))
  await expect(form.getByRole("button", { name: "Create decision", exact: true })).toBeEnabled()
  return form
}

export async function clickCommand(page: Page, button: Locator, mode: string, observations: Record<string, unknown>[], method = "POST") {
  await expect(button).toBeEnabled()
  const pending = page.waitForResponse((response) => isCommand(response.request(), mode, method))
  await button.click()
  const response = await pending
  return readReply(response, observations)
}

export async function readReply(response: Response, observations: Record<string, unknown>[]) {
  const contentType = response.headers()["content-type"] ?? ""
  const record = { mode: new URL(response.url()).searchParams.get("sf"), httpStatus: response.status(), contentType }
  observations.push(record)
  // A legacy HTML page returned with 200 must never satisfy a domain-command assertion.
  expect(contentType, `Expected the installed Decisions handler for ${record.mode}`).toContain("application/json")
  const result = asRecord(await response.json())
  observations.push({ mode: record.mode, status: result.status, reason: result.reason, outputRef: result.outputRef })
  expect(response.status(), `Domain response for ${record.mode}`).toBe(200)
  expect(result.status, `Domain outcome for ${record.mode}`).toBe("ok")
  return result
}

export async function assertCase(page: Page, reference: string, objective: string, version: number) {
  const identity = caseIdentity(reference)
  await expect(page).toHaveURL((url) => url.pathname === "/sucafina/dashboard" && url.searchParams.get("sf") === "workbench-case" && url.searchParams.get("caseRef") === reference)
  const decision = page.getByRole("region", { name: "Decision", exact: true })
  await expect(decision, "WP10 must provide the real case-port verifier before the saved case can be read").toBeVisible()
  await expect(decision.getByRole("heading", { name: objective, exact: true })).toBeVisible()
  await expect(decision.locator("header > p")).toHaveText(`draft · Version ${version} · ${draft.horizon.start} – ${draft.horizon.end} · ${draft.currency}`)
  for (const criterion of draft.criteria) await expect(decision.getByText(`${criterion} (required)`, { exact: true })).toBeVisible()
  const context = asRecord(JSON.parse((await page.locator("form[data-decision-edit]").getAttribute("data-context"))!))
  expect(context.caseRef).toEqual({ ...identity, version })
  await expect(decision.getByText("No alternatives recorded.", { exact: true })).toBeVisible()
  await expect(decision.getByText("No changes prepared.", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Record choice", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Apply reviewed change", exact: true })).toHaveCount(0)
  return decision
}

export async function reopenCase(page: Page, reference: string, objective: string) {
  await page.getByRole("link", { name: "Workbench", exact: true }).click()
  const link = page.getByRole("link", { name: objective, exact: true })
  await expect(link, "The persisted case must be discoverable under the current operator authority").toHaveCount(1)
  const target = new URL((await link.getAttribute("href"))!, page.url())
  expect(target.searchParams.get("caseRef")).toBe(reference)
  await link.click()
}
