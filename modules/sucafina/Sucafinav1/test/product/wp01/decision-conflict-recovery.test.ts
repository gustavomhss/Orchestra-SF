import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser, BrowserContext, Page } from "@playwright/test"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { createDecisionCaseManagement } from "../../../product/decisions/case-management.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createDecisionEvidenceChecks } from "../../../product/decisions/host-evidence.ts"
import { createDecisionIntentFences } from "../../../product/decisions/intent-fences.ts"
import { createDecisionHttp } from "../../../product/decisions/http.ts"
import { createSfWorkbenchHttp } from "../../../product/interface/http.ts"
import { decorateSfProductHtml } from "../../../product/interface/html.ts"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"

let browser: Browser
beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

type Edit = Parameters<ReturnType<typeof createDecisionCaseManagement>["edit"]>[0]

/** Real operator cookies, C08, admission, case reads, intent fences and CAS edits.
 * Only the private edit HTTP route is exercised here. Other Decision HTTP ports
 * fail explicitly on access; they never supply a simulated domain result.
 * This is a consumer proof, not acceptance of the complete host router.
 * These source-free cases do not assert source provenance or native execution.
 */
async function fixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "wp01-decision-conflict-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(directory)
  const routing: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => await routing.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin, installationId = randomUUID()
  const now = () => "2026-11-13T08:00:00Z"
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(now), createId: randomUUID })
  const first = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1001, name: "First decision reviewer" }, secrets: driver.secrets, key: randomBytes(32) })
  const second = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1002, name: "Second decision reviewer" }, secrets: driver.secrets, key: randomBytes(32) })
  const principals = [`macos:${installationId}:1001`, `macos:${installationId}:1002`]
  const authenticate: typeof first.authenticate = async (request, context) => await first.authenticate(request, context) ?? await second.authenticate(request, context)
  const environment = async (request: Request) => ({ at: now(), id: randomUUID, directory: [...await first.directory(request), ...await second.directory(request)] })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  const proposalCoverageWrites = new WeakSet<object>(), dashboardHostWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => ({ installationId, hostId: "host", projectId: "project", location: { directory: AbsolutePath.make(directory) } }),
    installationId, origin, policyVersion: "policy", persistence, authenticate, environment, createId: randomUUID, now: Date.now,
    commandIdentity: async (request, operation) => request.method === "GET" || request.method === "HEAD" ? randomUUID() : request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
    grants: principals.map((principalRef) => ({ principalRef, namespaces: ["cases", "receipts"] as const, operations: ["sf_case_read"], humanActions: ["decisions.edit"] as const })),
    proposalCoverageWrites, dashboardHostWrites, inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites, dashboardHostWrites })
  const intent = createDecisionIntentFences({ human: authority.human, ui: authority.ui, readSourceFences: business.readSourceFences, lockedSourceFences: business.lockedSourceFences })
  const evidence = createDecisionEvidenceChecks({ host: authority.host, evidence: business.context, recomputeMetric: async () => ({ status: "unavailable", reason: "metric-not-mounted" }) })
  const management = createDecisionCaseManagement({ state: authority.state, host: authority.host, operationIdentity: business.operationIdentity,
    authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef) && await authority.host.revalidate(context),
    authorizeEdit: (request, context) => intent.authorize(context, "decisions.edit", request), verifyEvidence: evidence.refs,
    verifyEdit: (_snapshot, before, after, context) => {
      const payload = intent.payload(context, "decisions.edit")
      // The fixture admits only source-free edits. Real captured intent and all
      // source-surface fences must still match under the actual C08 write lock.
      return payload !== undefined && intent.verify(context, "decisions.edit", payload) && before.sourceRefs.length === 0 && after.sourceRefs.length === 0 &&
        [...before.assumptions, ...after.assumptions].every((item) => item.evidenceRefs.length === 0)
    } })
  const unmounted = (port: string): never => { throw new Error(`Decision conflict fixture does not mount ${port}`) }
  const editOptions = {
    origin, mount: "/sucafina/dashboard", human: authority.human, management, withCase: business.withCase,
    get admitList() { return unmounted("admitList") },
    get admitComparison() { return unmounted("admitComparison") },
    get admitSelection() { return unmounted("admitSelection") },
    get portfolio() { return unmounted("portfolio") },
    get history() { return unmounted("history") },
    get choiceCatalog() { return unmounted("choiceCatalog") },
    get coverageCatalog() { return unmounted("coverageCatalog") },
    get reviewChange() { return unmounted("reviewChange") },
    get selection() { return unmounted("selection") },
    get baseline() { return unmounted("baseline") },
    get compare() { return unmounted("compare") },
    get mutations() { return unmounted("mutations") },
    get accept() { return unmounted("accept") },
    get apply() { return unmounted("apply") },
    get criteria() { return unmounted("criteria") },
  } satisfies Parameters<typeof createDecisionHttp>[0]
  const edit = createDecisionHttp(editOptions)
  const dispatch: SfHostServices["dispatch"] = (operation, payload, context) => dispatchSfCapability({ operation, payload, context, descriptors: business.descriptors, authority: authority.authority,
    validateInput: (_descriptor, value) => operation === "sf_case_read" && decodeSfOperationInput("sf_case_read", value).ok,
    validateOutput: (_descriptor, result) => result.status !== "ok" || operation === "sf_case_read" && decodeSfOperationOutput("sf_case_read", result.result).ok })
  const services = { ...authority, dispatch } as SfHostServices
  const workbench = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => services })
  const module = createModule("/sucafina", { persistence, authenticate, environment, product: async (request, surface) => await edit(request) ?? await workbench(request, surface), productHtml: decorateSfProductHtml, maxJsonBytes: 100000 })
  const writes: { principal: string | undefined; status: number; body: Edit; key: string | null }[] = []
  routing.handle = async (request) => {
    if (new URL(request.url).pathname === "/sucafina/auth/logout") return (await first.person(request) ? first : second).handle(request)
    const isEdit = request.method === "POST" && new URL(request.url).searchParams.get("sf") === "decision-edit"
    const principal = isEdit ? await first.person(request) ?? await second.person(request) : undefined
    const body: Edit | undefined = isEdit ? await request.clone().json() : undefined
    const response = await module(request)
    if (body && response) writes.push({ principal: principal?.id, status: response.status, body, key: request.headers.get("idempotency-key") })
    return response
  }
  const contexts: BrowserContext[] = []
  const enroll = async (identity: typeof first) => {
    const login = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`))
    expect(login?.status).toBe(303)
    const cookie = login!.headers.get("set-cookie")!.split(";")[0]!
    const separator = cookie.indexOf("=")
    const context = await browser.newContext()
    contexts.push(context)
    await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), domain: new URL(origin).hostname, path: "/sucafina", httpOnly: true, sameSite: "Lax" }])
    const page = await context.newPage()
    page.setDefaultTimeout(10_000)
    page.on("dialog", (dialog) => dialog.accept())
    return { context, page, cookie }
  }
  const errors: string[] = []
  const close = async () => {
    const closed = await Promise.allSettled(contexts.map((context) => context.close()))
    business.dispose(); await server.stop(true); await driver.dispose(); await rm(directory, { recursive: true, force: true })
    const failed = closed.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failed.length) throw new AggregateError(failed.map((result) => result.reason), "Decision conflict contexts did not close")
  }
  try {
    const actors = [await enroll(first), await enroll(second)] as const
    actors.forEach((actor) => actor.page.on("pageerror", (error) => errors.push(error.message)))
    const request = () => new Request(`${origin}/sucafina/dashboard`, { headers: { cookie: actors[0].cookie } })
    const decision: DecisionCase = { id: "decision", incarnation: "decision-incarnation", version: 1, state: "draft", objective: "Original decision",
      horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", participants: principals,
      criteria: [{ id: "cost", description: "Initial cost criterion", required: true }, { id: "quality", description: "Initial quality criterion", required: false }],
      sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref,
      targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "fixture-case", commandDigest: digestSfValue(decision) }, async (state) => { state.cases[decision.id] = decision; return { commit: true, value: true } })
    expect(seeded.status).toBe("ok")
    const url = `${origin}/sucafina/dashboard?${new URLSearchParams({ sf: "workbench-case", caseRef: encodeCaseRef(decision) })}`
    for (const actor of actors) {
      expect((await actor.page.goto(url))?.status()).toBe(200)
      await actor.page.getByText("Edit decision", { exact: true }).click()
    }
    const read = async () => {
      const value = await authority.state.read(request(), "cases", (state) => ({ decision: structuredClone(state.cases[decision.id]!), transactions: Object.values(state.transactions) }))
      if (value.status !== "ok") throw new Error(`Actual case read failed: ${value.status}`)
      return { ...value.value, storageVersion: value.storageVersion }
    }
    const post = async (body: Edit) => actors[0].context.request.post(`${origin}/sucafina/dashboard?sf=decision-edit`, { headers: { origin, "content-type": "application/json", "idempotency-key": randomUUID() }, data: body })
    return { actors, principals, errors, writes, read, post, origin, close, initial: decision }
  } catch (error) { await close(); throw error }
}

const form = (page: Page) => page.locator("[data-decision-edit]")
const editBody = (decision: DecisionCase, objective: string, criteria = decision.criteria): Edit => ({ caseRef: { id: decision.id, incarnation: decision.incarnation, version: decision.version }, objective,
  horizon: decision.horizon, currency: decision.currency, criteria, sourceRefs: decision.sourceRefs })
const openedVersion = async (page: Page) => JSON.parse(await form(page).getAttribute("data-context") ?? "{}").caseRef?.version

test("real decision CAS preserves a second operator's edits by criterion ID and requires explicit review after each newer version", async () => {
  const f = await fixture()
  try {
    const page = f.actors[1].page, editor = form(page)
    await editor.getByLabel("Decision objective", { exact: true }).fill("Second operator retained objective")
    await editor.locator('[data-criterion-id="cost"]').fill("Second operator cost entry")
    await editor.locator('[data-criterion-id="quality"]').fill("Second operator quality entry")
    const first = await f.post(editBody(f.initial, "First operator committed objective", [...f.initial.criteria].reverse()))
    expect(first.status()).toBe(200)
    const firstSaved = await f.read()
    expect(firstSaved.decision.version).toBe(2)
    const rejected = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).searchParams.get("sf") === "decision-edit")
    await editor.getByRole("button", { name: "Save decision", exact: true }).click()
    expect((await rejected).status()).toBe(409)
    await editor.locator("[data-decision-conflict]").getByText("Objective: current First operator committed objective; yours Second operator retained objective", { exact: true }).waitFor()
    expect(await openedVersion(page)).toBe(1)
    expect(await editor.getByRole("button", { name: "Save decision", exact: true }).isDisabled()).toBe(true)
    expect(await editor.locator('[data-criterion-id="cost"]').inputValue()).toBe("Second operator cost entry")
    expect((await f.read()).storageVersion).toBe(firstSaved.storageVersion)
    expect(f.writes.map((entry) => ({ principal: entry.principal, status: entry.status, version: entry.body.caseRef.version }))).toEqual([
      { principal: f.principals[0], status: 200, version: 1 }, { principal: f.principals[1], status: 409, version: 1 },
    ])

    await editor.getByRole("button", { name: "Use current version and keep my edits", exact: true }).click()
    await editor.getByText("Current version adopted. Review your entries, then save explicitly.", { exact: true }).waitFor()
    expect(await openedVersion(page)).toBe(2)
    expect(await editor.locator('input[name="criterion-0"]').getAttribute("data-criterion-id")).toBe("quality")
    expect(await editor.locator('input[name="criterion-0"]').inputValue()).toBe("Second operator quality entry")
    expect(await editor.locator('input[name="criterion-1"]').getAttribute("data-criterion-id")).toBe("cost")
    expect(await editor.locator('input[name="criterion-1"]').inputValue()).toBe("Second operator cost entry")
    expect(f.writes).toHaveLength(2)

    // Another real commit after adoption invalidates the review before POST.
    expect((await f.post(editBody(firstSaved.decision, "Third committed objective"))).status()).toBe(200)
    await editor.getByRole("button", { name: "Save decision", exact: true }).click()
    await editor.getByText("The decision changed after your review. Compare the current version before saving.", { exact: true }).waitFor()
    expect(await openedVersion(page)).toBe(2)
    expect(f.writes).toHaveLength(3)
    expect(await editor.locator("[data-decision-conflict]").textContent()).toContain("Third committed objective")
    await editor.getByRole("button", { name: "Use current version and keep my edits", exact: true }).click()
    await editor.getByText("Current version adopted. Review your entries, then save explicitly.", { exact: true }).waitFor()
    expect(await openedVersion(page)).toBe(3)
    const saved = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).searchParams.get("sf") === "decision-edit")
    await editor.getByRole("button", { name: "Save decision", exact: true }).click()
    expect((await saved).status()).toBe(200)
    await page.getByRole("heading", { name: "Second operator retained objective", exact: true }).waitFor()
    const final = await f.read()
    expect(final.decision.version).toBe(4)
    expect(final.decision.objective).toBe("Second operator retained objective")
    expect(final.decision.criteria).toEqual([
      { id: "quality", description: "Second operator quality entry", required: false },
      { id: "cost", description: "Second operator cost entry", required: true },
    ])
    expect(final.transactions.filter((entry) => entry.principalRef === f.principals[1])).toHaveLength(1)
    expect(f.writes).toHaveLength(4)
    expect(f.writes[3]).toMatchObject({ principal: f.principals[1], status: 200, body: { caseRef: { version: 3 } } })
    expect(f.writes[3]!.key).not.toBe(f.writes[1]!.key)
    expect(f.errors).toEqual([])
  } finally { await f.close() }
}, 60_000)

test("real added and removed criteria require an explicit structural review and retain the removed draft for comparison", async () => {
  const f = await fixture()
  try {
    const page = f.actors[1].page, editor = form(page)
    await editor.getByLabel("Decision objective", { exact: true }).fill("Structural reconciliation")
    await editor.locator('[data-criterion-id="cost"]').fill("Retained removed criterion")
    await editor.locator('[data-criterion-id="quality"]').fill("Retained quality criterion")
    expect((await f.post(editBody(f.initial, "Changed criteria", [f.initial.criteria[1]!, { id: "capacity", description: "Current capacity criterion", required: true }]))).status()).toBe(200)
    await editor.getByRole("button", { name: "Save decision", exact: true }).click()
    await editor.getByLabel("I reviewed the added and removed criteria", { exact: true }).waitFor()
    expect(await editor.locator("[data-decision-conflict]").textContent()).toContain("current removed; yours Retained removed criterion")
    await editor.getByRole("button", { name: "Use current version and keep my edits", exact: true }).click()
    await editor.getByText("Review the added and removed criteria before adopting the current version.", { exact: true }).waitFor()
    expect(await openedVersion(page)).toBe(1)
    expect(f.writes).toHaveLength(2)
    await editor.locator('[data-criterion-id="cost"]').fill("Latest removed criterion remains readable")
    await editor.getByLabel("I reviewed the added and removed criteria", { exact: true }).check()
    await editor.getByRole("button", { name: "Use current version and keep my edits", exact: true }).click()
    await editor.getByText("Current version adopted. Review your entries, then save explicitly.", { exact: true }).waitFor()
    expect(await editor.locator('[data-decision-removed-entry="cost"]').textContent()).toContain("Latest removed criterion remains readable")
    expect(await editor.locator('[data-criterion-id="cost"]').count()).toBe(0)
    expect(await editor.locator('[data-criterion-id="quality"]').inputValue()).toBe("Retained quality criterion")
    expect(await editor.locator('[data-criterion-id="capacity"]').inputValue()).toBe("Current capacity criterion")
    expect(f.writes).toHaveLength(2)
    const saved = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).searchParams.get("sf") === "decision-edit")
    await editor.getByRole("button", { name: "Save decision", exact: true }).click()
    expect((await saved).status()).toBe(200)
    await page.getByRole("heading", { name: "Structural reconciliation", exact: true }).waitFor()
    const final = await f.read()
    expect(final.decision.version).toBe(3)
    expect(final.decision.criteria).toEqual([
      { id: "quality", description: "Retained quality criterion", required: false },
      { id: "capacity", description: "Current capacity criterion", required: true },
    ])
    expect(f.errors).toEqual([])
  } finally { await f.close() }
}, 60_000)

test("real session revocation during decision reconciliation purges the retained draft and prevents another write", async () => {
  const f = await fixture()
  try {
    const page = f.actors[1].page, editor = form(page)
    await editor.getByLabel("Decision objective", { exact: true }).fill("Private losing decision draft")
    expect((await f.post(editBody(f.initial, "First operator current objective"))).status()).toBe(200)
    await editor.getByRole("button", { name: "Save decision", exact: true }).click()
    await editor.getByRole("button", { name: "Use current version and keep my edits", exact: true }).waitFor()
    const before = await f.read()
    expect(await page.evaluate(async () => (await fetch("/sucafina/auth/logout", { method: "POST", credentials: "same-origin" })).status)).toBe(204)
    await editor.getByRole("button", { name: "Use current version and keep my edits", exact: true }).click()
    await editor.getByText("Your access changed. Reload before editing this decision.", { exact: true }).waitFor()
    expect(await editor.locator("[data-context], input, [data-decision-conflict]").count()).toBe(0)
    expect(await editor.getAttribute("data-context")).toBeNull()
    expect(await editor.innerText()).not.toContain("Private losing decision draft")
    expect(f.writes).toHaveLength(2)
    expect((await f.read()).storageVersion).toBe(before.storageVersion)
    expect(f.errors).toEqual([])
  } finally { await f.close() }
}, 60_000)
