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

type Fixture = {
  page: Page
  context: BrowserContext
  store: Awaited<ReturnType<typeof openLocalStore>>
  origin: string
  post: (action: string, input: unknown) => ReturnType<BrowserContext["request"]["post"]>
  otherList: () => Promise<Response | undefined>
  hold: { nextList: boolean; entered?: () => void; release?: () => void }
}

// The destination predicate is the exact published integration implementation,
// over real encrypted sessions, SQLite, current domain views and source records.
async function withViews(check: (fixture: Fixture) => Promise<void>) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "wp01-unavailable-views-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const routing: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const hold: Fixture["hold"] = { nextList: false }
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
    const delayed = hold.nextList && request.method === "POST" && new URL(request.url).searchParams.get("sf") === "workbench-views" && (await request.clone().json()).action === "list"
    if (delayed) hold.nextList = false
    const response = await first.handle(request) ?? await app(request)
    if (!delayed || !response) return response
    await new Promise<void>((resolve) => { hold.release = resolve; hold.entered?.() })
    const headers = new Headers(response.headers)
    headers.set("X-SF-Views-Late", "yes")
    return new Response(response.body, { status: response.status, headers })
  }
  let context: BrowserContext | undefined
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
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("dialog", (dialog) => dialog.accept())
    expect((await page.goto(`${origin}/sucafina/auth/local?code=${await first.enroll()}`))?.status()).toBe(200)
    const active = context
    const post: Fixture["post"] = (action, input) => active.request.post(`${origin}/sucafina/planner?sf=workbench-views`, { headers: { origin, "idempotency-key": randomUUID() }, data: { action, input } })
    await check({ page, context, store, origin, post, hold, otherList: () => product(new Request(`${origin}/sucafina/planner?sf=workbench-views`, { method: "POST", headers: { cookie: otherCookie, origin, "content-type": "application/json", "idempotency-key": randomUUID() }, body: JSON.stringify({ action: "list", input: {} }) }), "planner") })
    expect(errors).toEqual([])
  } finally {
    hold.release?.()
    await context?.close()
    await server.stop(true)
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
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
    await savePrevious(fixture)
    await fixture.page.goto(`${fixture.origin}/sucafina/planner?page=OPEX&year=2026&version=current-plan`)
    await fixture.page.getByRole("button", { name: "PRIVATE-PREVIOUS-TITLE", exact: true }).waitFor()
    fixture.hold.nextList = true
    const entered = new Promise<void>((resolve) => { fixture.hold.entered = resolve })
    await fixture.page.getByRole("button", { name: "Refresh saved views" }).click()
    await entered
    expect((await fixture.context.request.post(`${fixture.origin}/sucafina/auth/logout`, { headers: { origin: fixture.origin } })).status()).toBe(204)
    await fixture.page.getByRole("button", { name: "Refresh saved views" }).click()
    await fixture.page.getByText("Your access changed. Reload before opening or changing saved views.", { exact: true }).waitFor()
    const delivered = fixture.page.waitForResponse((response) => response.headers()["x-sf-views-late"] === "yes")
    fixture.hold.release?.()
    await (await delivered).finished()
    await fixture.page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    expect(await fixture.page.locator("[data-personal-views]").textContent()).not.toContain("PRIVATE-")
    expect(await fixture.page.locator("[data-personal-views] button, [data-personal-views] input").count()).toBe(0)
  })
}, 45_000)
