import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser, BrowserContext } from "@playwright/test"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { sfHumanReadActions } from "../../../product/integration/human-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { createCollaborationHost } from "../../../product/collaboration/host.ts"
import { createCollaborationHttp } from "../../../product/collaboration/http.ts"
import { createCollaborationHumanAuthority } from "../../../product/collaboration/human.ts"
import { createProcurementCollectionMemberIssuer } from "../../../product/procurement/collection-member.ts"
import { createSfWorkbenchHttp } from "../../../product/interface/http.ts"
import { createFixtureBusiness } from "../wp02/business-services-fixture.ts"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"

let browser: Browser
beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

/** The My work HTML and list come from actual Workbench, Procurement/BCS and
 * collaboration services. No destination resolver is mounted: its real 503 is
 * distinct from the real authentication denial after logout. These are consumer
 * recovery proofs, not positive acceptance of the shared navigation producer. */
async function fixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-work-destination-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(directory)
  const routing: { handle?: (request: Request) => Promise<Response> } = {}
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 30, fetch: (request) => routing.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin, installationId = randomUUID(), principalRef = `macos:${installationId}:1000`, at = "2026-11-14T08:00:00Z"
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) })
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1000, name: "Authorized approval reviewer" }, secrets: driver.secrets, key: randomBytes(32) })
  const proposalCoverageWrites = new WeakSet<object>(), dashboardHostWrites = new WeakSet<object>()
  let business: Awaited<ReturnType<typeof createFixtureBusiness>> | undefined, context: BrowserContext | undefined
  const close = async () => {
    const errors: unknown[] = []
    try { await server.stop(true) } catch (error) { errors.push(error) }
    try { business?.dispose() } catch (error) { errors.push(error) }
    try { await context?.close() } catch (error) { errors.push(error) }
    try { await driver.dispose() } catch (error) { errors.push(error) }
    try { await rm(directory, { recursive: true, force: true }) } catch (error) { errors.push(error) }
    if (errors.length) throw new AggregateError(errors, "Work destination fixture did not close")
  }
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { settings: { currency: "USD", fxRates: [] }, suppliers: [], requests: Object.fromEntries(["A", "B"].map((suffix) => [`PR-${suffix}`, {
        version: 1, request: { number: `PR-${suffix}`, createdBy: principalRef, status: "pr_pending", pr: { title: `Private approval ${suffix}`, currency: "USD", total: 100 },
          prApprovalBaseCurrency: "USD", prApproval: { amount: 100, steps: [{ status: "pending", holderId: principalRef, levelName: "Review" }] }, history: [{ action: "Requisition submitted for approval", at: "2026-11-01T08:00:00Z" }] },
      }])) }
      return { commit: true, value: undefined }
    })
    const authority = createSfProductAuthority({ identity: () => ({ installationId, hostId: "host", projectId: "project", location: { directory: AbsolutePath.make(directory) } }),
      installationId, origin, policyVersion: "policy", persistence, authenticate: identity.authenticate,
      environment: async (request) => ({ at, id: randomUUID, directory: await identity.directory(request) }), now: Date.now, createId: randomUUID,
      commandIdentity: async (request, operation) => request.method === "GET" ? randomUUID() : request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
      proposalCoverageWrites, dashboardHostWrites, inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
      grants: [{ principalRef, namespaces: ["cases", "threads", "relations", "confirmations", "preferences"], operations: ["sf_case_read", "sf_work_list"], humanActions: ["collaboration.work.destination"] }] })
    const services = business = await createFixtureBusiness({ authority, persistence, proposalCoverageWrites, dashboardHostWrites })
    const collaboration = createCollaborationHost({ host: authority.host, state: authority.state, creationTarget: authority.creationTarget, scopedSources: persistence,
      evidence: services.context, procurement: services.procurement, collections: services.registry, cases: services.cases, authority: authority.authority, human: authority.human,
      captureWorkSource: createProcurementCollectionMemberIssuer({ collection: services.registry, individual: services.individual, revalidate: authority.host.revalidate }),
      requiredAuthority: { sf_work_list: ["threads:read", "relations:read", "confirmations:read"], sf_question_prepare: ["threads:read", "cases:read"],
        sf_answer_read: ["threads:read"], sf_relation_read: ["relations:read"], sf_handoff_prepare: ["threads:read", "relations:read"] }, createId: randomUUID, now: () => at })
    const http = createCollaborationHttp({ origin, mount: "/sucafina/dashboard", host: collaboration, human: createCollaborationHumanAuthority({ origin, ui: authority.ui }),
      admitRead: async (request, action, payload) => {
        if (!sfHumanReadActions.some((allowed) => allowed === action)) return { status: "denied", reason: "read-action-unavailable" }
        const operation = `sf-human:${action}`, digest = digestSfValue(payload), admitted = await authority.ui.admit(request, operation, digest)
        if (admitted.status !== "ok") return admitted
        if (!await authority.ui.validate(admitted.value, operation, digest)) { authority.ui.finish(admitted.value); return { status: "denied", reason: "read-admission-unavailable" } }
        return admitted
      }, finishRead: authority.ui.finish })
    const dispatch: SfHostServices["dispatch"] = (operation, payload, call) => dispatchSfCapability({ operation, payload, context: call, descriptors: [...services.descriptors, ...collaboration.capabilities], authority: authority.authority,
      validateInput: (_descriptor, value) => operation === "sf_work_list" ? decodeSfOperationInput("sf_work_list", value).ok : operation === "sf_case_read" && decodeSfOperationInput("sf_case_read", value).ok,
      validateOutput: (_descriptor, result) => result.status !== "ok" || (operation === "sf_work_list" ? decodeSfOperationOutput("sf_work_list", result.result).ok : operation === "sf_case_read" && decodeSfOperationOutput("sf_case_read", result.result).ok) })
    const unmounted = (port: string): never => { throw new Error(`Work destination fixture does not mount ${port}`) }
    const runtime = { ...authority, dispatch, work: collaboration.work, procurementSelections: services.procurementSelections,
      get sessions() { return unmounted("sessions") }, get selected() { return unmounted("selected") }, models: () => unmounted("models") } satisfies SfHostServices
    const workbench = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => runtime })
    const responses: { mode: string | null; status: number }[] = []
    routing.handle = async (request) => {
      const auth = await identity.handle(request)
      if (auth) return auth
      const response = await http(request) ?? await workbench(request, "dashboard") ?? new Response(null, { status: 404 })
      responses.push({ mode: new URL(request.url).searchParams.get("sf"), status: response.status })
      return response
    }
    const login = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`))
    const cookie = login?.headers.get("set-cookie")?.split(";")[0]
    if (!cookie) throw new Error("Real approval reviewer enrollment failed")
    context = await browser.newContext()
    const separator = cookie.indexOf("=")
    await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), domain: new URL(origin).hostname, path: "/sucafina", httpOnly: true, sameSite: "Lax" }])
    const page = await context.newPage(), errors: string[] = []
    page.setDefaultTimeout(10_000); page.on("pageerror", (error) => errors.push(error.message))
    const selected = await page.goto(`${origin}/sucafina/dashboard?${new URLSearchParams({ sf: "workbench-work-select", start: "2026-01-01", end: "2026-12-31" })}`)
    expect(selected?.status()).toBe(200)
    const href = await page.getByRole("link", { name: "Procurement requests", exact: true }).getAttribute("href")
    if (!href) throw new Error("Real work selection did not provide its destination")
    expect((await page.goto(new URL(href, page.url()).href))?.status()).toBe(200)
    await page.locator("[data-work-list] [data-work-destination]").nth(1).waitFor()
    expect(await page.locator("[data-work-list]").textContent()).toContain("Private approval A")
    expect(await page.locator("[data-work-list]").textContent()).toContain("Private approval B")
    return { origin, page, responses, errors, close }
  } catch (error) {
    try { await close() } catch (cleanup) { throw new AggregateError([error, cleanup], "Work destination setup and cleanup failed") }
    throw error
  }
}

test("real destination unavailability preserves My work, while real logout denial purges every protected work item", async () => {
  const app = await fixture()
  try {
    const list = app.page.locator("[data-work-list]"), button = list.getByRole("button", { name: "Open work", exact: true }).first()
    const response = app.page.waitForResponse((value) => new URL(value.url()).searchParams.get("sf") === "collaboration-work-destination")
    await button.click()
    expect((await response).status()).toBe(503)
    await app.page.waitForFunction(() => document.querySelector('[data-work-list] [role="status"]')?.textContent?.includes("temporarily unavailable"))
    expect(await button.isDisabled()).toBe(false)
    expect(await list.textContent()).toContain("Private approval A")
    expect(await list.textContent()).toContain("Private approval B")
    expect(await app.page.evaluate(async () => (await fetch("/sucafina/auth/logout", { method: "POST" })).status)).toBe(204)
    const denied = app.page.waitForResponse((value) => new URL(value.url()).searchParams.get("sf") === "collaboration-work-destination")
    await button.click()
    expect((await denied).status()).toBe(403)
    await app.page.waitForFunction(() => document.querySelector('[data-work-list] [role="status"]')?.textContent?.startsWith("Work access changed."))
    expect(await list.locator("[data-work-destination], [data-selection], button").count()).toBe(0)
    expect(await app.page.content()).not.toContain("Private approval A")
    expect(await app.page.content()).not.toContain("Private approval B")
    expect(app.responses.filter((value) => value.mode === "collaboration-work-destination").map((value) => value.status)).toEqual([503, 403])
    expect(app.errors).toEqual([])
  } finally { await app.close() }
}, 45_000)

test("an earlier real destination response cannot reactivate My work after a later authenticated denial", async () => {
  const app = await fixture()
  let release: (() => void) | undefined
  try {
    const waiting = new Promise<void>((resolve) => { release = resolve })
    let entered: (() => void) | undefined
    const ready = new Promise<void>((resolve) => { entered = resolve })
    let first = true, observedStatus: number | undefined
    await app.page.route("**/*?sf=collaboration-work-destination", async (route) => {
      if (!first) { await route.continue(); return }
      first = false
      const response = await route.fetch(); observedStatus = response.status(); entered?.()
      await waiting
      await route.fulfill({ response }).catch(() => { /* The real denial aborts this obsolete read. */ })
    })
    const list = app.page.locator("[data-work-list]"), buttons = list.getByRole("button", { name: "Open work", exact: true })
    const firstHandle = await buttons.nth(0).elementHandle()
    await buttons.nth(0).click()
    let timer: ReturnType<typeof setTimeout> | undefined
    try { await Promise.race([ready, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Real destination producer did not reach the response gate")), 5000) })]) }
    finally { if (timer) clearTimeout(timer) }
    expect(observedStatus).toBe(503)
    expect(await app.page.evaluate(async () => (await fetch("/sucafina/auth/logout", { method: "POST" })).status)).toBe(204)
    const denied = app.page.waitForResponse((value) => new URL(value.url()).searchParams.get("sf") === "collaboration-work-destination" && value.status() === 403)
    await buttons.nth(1).click()
    expect((await denied).status()).toBe(403)
    await app.page.waitForFunction(() => document.querySelector('[data-work-list] [role="status"]')?.textContent?.startsWith("Work access changed."))
    release?.()
    await app.page.unrouteAll({ behavior: "wait" })
    expect(await firstHandle?.evaluate((button) => button instanceof HTMLButtonElement ? { connected: button.isConnected, disabled: button.disabled, selection: button.dataset.selection } : { tag: button.tagName })).toEqual({ connected: false, disabled: true, selection: undefined })
    expect(await list.locator("button,[data-selection]").count()).toBe(0)
    expect(await app.page.content()).not.toContain("Private approval A")
    expect(await app.page.content()).not.toContain("Private approval B")
    expect(await list.textContent()).toBe("Work access changed. Reopen the application with your current access.")
    expect(new URL(app.page.url()).searchParams.get("sf")).toBe("workbench-work")
    await firstHandle?.dispose()
    expect(app.errors).toEqual([])
  } finally { release?.(); await app.close() }
}, 45_000)
