import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser, BrowserContext, Page } from "@playwright/test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfPersonalViewAuthority } from "../../../../../../apps/cli/src/sucafina-product/personal-view-authority.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createSfPersonalViews } from "../../../product/interface/personal-views.ts"
import { createSfWorkbenchHttp } from "../../../product/interface/http.ts"
import { decorateSfProductHtml } from "../../../product/interface/html.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { createModule } from "../../../index.ts"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"

let browser: Browser
beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

async function within<T>(operation: Promise<T>, phase: string): Promise<T> {
  const started = performance.now()
  console.info("WP01 saved views phase", { phase, state: "started" })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const value = await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Saved views timed out: ${phase}`)), 5_000)
    })])
    console.info("WP01 saved views phase", { phase, state: "completed", elapsedMs: Math.round(performance.now() - started) })
    return value
  } catch (error) {
    console.error("WP01 saved views phase", { phase, state: "failed", elapsedMs: Math.round(performance.now() - started) })
    throw error
  } finally { clearTimeout(timer) }
}

type Fixture = {
  page: Page
  context: BrowserContext
  store: Awaited<ReturnType<typeof openLocalStore>>
  origin: string
  post: (action: string, input: unknown) => ReturnType<BrowserContext["request"]["post"]>
  otherList: () => Promise<Response | undefined>
  hold: { nextList: boolean; entered?: () => void; release?: () => void; status?: number; body?: string }
}

// The destination predicate is the exact published integration implementation,
// over real encrypted sessions, SQLite, current domain views and source records.
async function withViews(check: (fixture: Fixture) => Promise<void>) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "wp01-unavailable-views-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const routing: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const hold: Fixture["hold"] = { nextList: false }
  const releases = new Set<() => void>()
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => await routing.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin
  const installationId = randomUUID()
  const first = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1, name: "View owner" }, secrets: store.secrets, key: randomBytes(32) })
  const second = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 2, name: "Other owner" }, secrets: store.secrets, key: randomBytes(32) })
  const authenticate: typeof first.authenticate = async (request, context) => await first.authenticate(request, context) ?? await second.authenticate(request, context)
  const environment = async (request: Request) => ({ at: "2026-11-13T08:00:00Z", id: randomUUID, directory: [...await first.directory(request), ...await second.directory(request)] })
  const authority = createSfProductAuthority({ identity: () => ({ installationId, projectId: "project", hostId: "host", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }), installationId, origin, policyVersion: "policy", persistence: store, authenticate, environment,
    grants: [1, 2].map((uid) => ({ principalRef: `macos:${installationId}:${uid}`, namespaces: ["preferences" as const], operations: [], humanActions: ["views.read" as const, "views.save" as const, "views.remove" as const] })), createId: randomUUID, now: Date.now,
    commandIdentity: async (request, operation) => request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const personalViews = createSfPersonalViews({ host: authority.host, state: authority.state, creationTarget: authority.creationTarget, operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined, humanAuthorize: authority.human.authorize,
    authorizeView: createSfPersonalViewAuthority({ authority }) })
  const services = { ...authority, personalViews } as SfHostServices
  const product = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => services })
  const app = createModule("/sucafina", { persistence: store, authenticate, environment, product, productHtml: decorateSfProductHtml, maxJsonBytes: 100000 })
  routing.handle = async (request) => {
    // Reserve before an await: two concurrent reads must not both claim the gate.
    const candidate = hold.nextList && request.method === "POST" && new URL(request.url).searchParams.get("sf") === "workbench-views"
    if (candidate) hold.nextList = false
    const delayed = candidate && (await within(request.clone().json(), "read the delivery-gated list request")).action === "list"
    if (candidate && !delayed) hold.nextList = true
    const response = candidate
      ? await within((async () => await first.handle(request) ?? await app(request))(), "produce the real delivery-gated list response")
      : await first.handle(request) ?? await app(request)
    if (!delayed || !response) return response
    // Delay exact bytes already produced by the real authorized application.
    // A live response stream must not keep the domain request or a store scope open.
    const body = await within(response.text(), "materialize the authorized list response")
    hold.status = response.status; hold.body = body
    await new Promise<void>((resolve) => {
      const release = () => { releases.delete(release); resolve() }
      releases.add(release); hold.release = release; hold.entered?.()
    })
    const headers = new Headers(response.headers)
    headers.set("X-SF-Views-Late", "yes")
    return new Response(body, { status: response.status, headers })
  }
  let context: BrowserContext | undefined
  let failure: unknown
  try {
    await store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = ["previous-plan", "current-plan"].map((id) => ({ id, name: id, year: 2026, locked: false, closed: 0, lines: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
      return { commit: true, value: undefined }
    })
    const otherLogin = await second.handle(new Request(`${origin}/sucafina/auth/local?code=${await second.enroll()}`))
    const otherCookie = otherLogin!.headers.get("set-cookie")!.split(";")[0]!
    context = await browser.newContext()
    const page = await context.newPage()
    page.setDefaultTimeout(10_000)
    page.setDefaultNavigationTimeout(10_000)
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("dialog", (dialog) => dialog.accept())
    expect((await page.goto(`${origin}/sucafina/auth/local?code=${await first.enroll()}`))?.status()).toBe(200)
    const active = context
    const post: Fixture["post"] = (action, input) => active.request.post(`${origin}/sucafina/planner?sf=workbench-views`, { headers: { origin, "idempotency-key": randomUUID() }, data: { action, input }, timeout: 5_000 })
    await check({ page, context, store, origin, post, hold, otherList: () => product(new Request(`${origin}/sucafina/planner?sf=workbench-views`, { method: "POST", headers: { cookie: otherCookie, origin, "content-type": "application/json", "idempotency-key": randomUUID() }, body: JSON.stringify({ action: "list", input: {} }) }), "planner") })
    expect(errors).toEqual([])
  } catch (error) { failure = error; throw error }
  finally {
    hold.nextList = false; hold.entered = undefined; releases.forEach((release) => release())
    const cleanup: unknown[] = []
    // Abort remaining HTTP delivery before closing the browser context. All
    // failures are retained; lease/finalizer still require zero open contexts.
    try { await within(Promise.resolve(server.stop(true)), "stop saved views HTTP") } catch (error) { cleanup.push(error) }
    try { if (context) await within(context.close(), "close saved views browser context") } catch (error) { cleanup.push(error) }
    try { await within(store.dispose(), "dispose saved views store") } catch (error) { cleanup.push(error) }
    try { await within(rm(directory, { recursive: true, force: true }), "remove saved views directory") } catch (error) { cleanup.push(error) }
    if (cleanup.length) throw new AggregateError(failure ? [failure, ...cleanup] : cleanup, "Saved views cleanup failed")
  }
}

async function savePrevious(fixture: Fixture, id = "private-view-01") {
  const saved = await fixture.post("save", { view: { id, title: "PRIVATE-PREVIOUS-TITLE", surface: "planner", page: "OPEX", density: "compact", filters: { query: "PRIVATE-PREVIOUS-QUERY", selections: { year: "2026", version: "previous-plan", mode: "forecast" } } }, expectedVersion: null })
  expect(saved.status()).toBe(200)
  expect(await saved.json()).toMatchObject({ status: "ok", value: { version: 1 } })
}

async function removePreviousPlan(fixture: Fixture) {
  const removed = await fixture.context.request.post(`${fixture.origin}/sucafina/planner?page=Versions`, { headers: { origin: fixture.origin }, data: { page: "Versions", action: "delete", id: "previous-plan", version: 0, values: {}, confirmed: true } })
  expect(removed.status()).toBe(200)
  expect(await removed.json()).toMatchObject({ ok: true })
}

test("a removed plan produces a sanitized personal placeholder and can be explicitly replaced with the authorized current page", async () => {
  await withViews(async (fixture) => {
    await savePrevious(fixture)
    await fixture.page.goto(`${fixture.origin}/sucafina/planner?page=OPEX&year=2026&version=current-plan&mode=budget`)
    await fixture.page.getByRole("button", { name: "PRIVATE-PREVIOUS-TITLE", exact: true }).waitFor()
    await removePreviousPlan(fixture)
    const listed = await fixture.post("list", {})
    expect(await listed.json()).toEqual({ status: "ok", value: [{ id: "private-view-01", version: 1, availability: "unavailable" }] })
    expect(await (await fixture.otherList())!.json()).toEqual({ status: "ok", value: [] })
    const before = await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    await fixture.page.getByRole("button", { name: "Refresh saved views" }).click()
    await fixture.page.getByText("A saved reference is no longer available.", { exact: false }).waitFor()
    expect(await fixture.page.locator("[data-personal-views]").textContent()).not.toContain("PRIVATE-")
    expect(await fixture.page.getByRole("button", { name: "PRIVATE-PREVIOUS-TITLE", exact: true }).count()).toBe(0)
    expect(await fixture.page.locator("[data-view-unavailable] a").count()).toBe(0)
    expect(new URL(fixture.page.url()).searchParams.get("version")).toBe("current-plan")
    await fixture.page.getByLabel("View name", { exact: true }).fill("Current budget")
    await fixture.page.getByRole("button", { name: "Replace with this page", exact: true }).click()
    await fixture.page.getByText("Saved view replaced with the current page and filters.", { exact: true }).waitFor()
    expect(await fixture.page.locator("[data-view-unavailable]").count()).toBe(0)
    const opened = await fixture.post("open", { id: "private-view-01" })
    expect(await opened.json()).toMatchObject({ status: "ok", value: { version: 2, view: { title: "Current budget", filters: { selections: { year: "2026", version: "current-plan", mode: "budget" } } } } })
    expect(await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(before)
  })
}, 45_000)

test("an unavailable preferred destination is never opened automatically and its private preference can be removed", async () => {
  await withViews(async (fixture) => {
    await savePrevious(fixture, "preferred-planner")
    await removePreviousPlan(fixture)
    await fixture.page.goto(`${fixture.origin}/sucafina/planner`)
    await fixture.page.getByText("Unavailable starting page", { exact: true }).waitFor()
    expect(new URL(fixture.page.url()).searchParams.has("view")).toBe(false)
    expect(await fixture.page.locator("[data-personal-views]").textContent()).not.toContain("PRIVATE-")
    await fixture.page.getByRole("button", { name: "Remove unavailable view", exact: true }).click()
    await fixture.page.getByText("Saved view removed.", { exact: true }).waitFor()
    expect(await fixture.page.locator("[data-view-unavailable]").count()).toBe(0)
    expect(await (await fixture.post("list", {})).json()).toEqual({ status: "ok", value: [] })
  })
}, 45_000)

test("an earlier real saved-view response cannot restore private labels after the session is revoked", async () => {
  await withViews(async (fixture) => {
    await within(savePrevious(fixture), "save private view before revocation")
    await within(fixture.page.goto(`${fixture.origin}/sucafina/planner?page=OPEX&year=2026&version=current-plan`), "open current plan before revocation")
    await within(fixture.page.getByRole("button", { name: "PRIVATE-PREVIOUS-TITLE", exact: true }).waitFor(), "observe the authorized private title")
    fixture.hold.nextList = true
    const entered = new Promise<void>((resolve) => { fixture.hold.entered = resolve })
    await within(fixture.page.getByRole("button", { name: "Refresh saved views" }).click(), "request the delayed authorized list")
    await within(entered, "hold the complete authorized list before delivery")
    expect(fixture.hold.status).toBe(200)
    const authorizedBody = fixture.hold.body
    if (typeof authorizedBody !== "string") throw new Error("The authorized list body was not captured before delivery")
    expect(authorizedBody).toContain("PRIVATE-PREVIOUS-TITLE")
    expect((await within(fixture.context.request.post(`${fixture.origin}/sucafina/auth/logout`, { headers: { origin: fixture.origin }, timeout: 5_000 }), "revoke the actual operator session")).status()).toBe(204)
    const [refused] = await Promise.all([
      within(fixture.page.waitForResponse((response) => response.status() === 403 && new URL(response.url()).searchParams.get("sf") === "workbench-views", { timeout: 5_000 }), "observe the real revoked list response"),
      within(fixture.page.getByRole("button", { name: "Refresh saved views" }).click(), "request views with the revoked session"),
    ])
    expect(refused.status()).toBe(403)
    await within(fixture.page.getByText("Your access changed. Reload before opening or changing saved views.", { exact: true }).waitFor(), "observe access revocation before late delivery")
    const delivered = fixture.page.waitForResponse((response) => response.headers()["x-sf-views-late"] === "yes", { timeout: 5_000 })
    fixture.hold.release?.()
    const late = await within(delivered, "observe the delayed authorized response headers")
    expect(late.status()).toBe(200)
    // Reading exact delivered bytes proves completion and the private content
    // available to the old request without an unbounded response.finished wait.
    expect(await within(late.text(), "read the delayed authorized response body")).toBe(authorizedBody)
    await within(fixture.page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))), "settle late-response browser rendering")
    expect(await fixture.page.locator("[data-personal-views]").textContent()).not.toContain("PRIVATE-")
    expect(await fixture.page.locator("[data-personal-views] button, [data-personal-views] input").count()).toBe(0)
  })
}, 45_000)
