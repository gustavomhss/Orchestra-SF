import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createSfPersonalViews } from "../../../product/interface/personal-views.ts"
import { createSfWorkbenchHttp } from "../../../product/interface/http.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { PLANNER_TABS } from "../../../src/nav.ts"
import { createModule } from "../../../index.ts"
import { decorateSfProductHtml } from "../../../product/interface/html.ts"

test("personal views isolate authenticated principals and reconcile exact retries", async () => {
  const started = Date.now()
  const checkpoint = (phase: string) => console.info(`WP01 personal views: ${phase} (${Date.now() - started}ms)`)
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-personal-views-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const serverState: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => await serverState.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin
  const installationId = randomUUID()
  const first = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1, name: "First" }, secrets: store.secrets, key: randomBytes(32) })
  const second = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 2, name: "Second" }, secrets: store.secrets, key: randomBytes(32) })
  const authenticate: typeof first.authenticate = async (request, context) => await first.authenticate(request, context) ?? await second.authenticate(request, context)
  const environment = async (request: Request) => ({ at: "2026-11-13T08:00:00Z", id: randomUUID, directory: [...await first.directory(request), ...await second.directory(request)] })
  const authority = createSfProductAuthority({ identity: () => ({ installationId, projectId: "project", hostId: "host", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }), installationId, origin, policyVersion: "policy", persistence: store, authenticate, environment,
    grants: [1, 2].map((uid) => ({ principalRef: `macos:${installationId}:${uid}`, namespaces: ["preferences" as const], operations: [], humanActions: ["views.read" as const, "views.save" as const, "views.remove" as const] })), createId: randomUUID, now: Date.now,
    commandIdentity: async (request, operation) => request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const personalViews = createSfPersonalViews({ host: authority.host, state: authority.state, creationTarget: authority.creationTarget, operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined, humanAuthorize: authority.human.authorize,
    authorizeView: async (view, context) => view.surface === "planner" && PLANNER_TABS.some((page) => page === view.page) && await authority.host.revalidate(context) })
  const services = { ...authority, personalViews } as SfHostServices
  const app = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => services })
  const module = createModule("/sucafina", { persistence: store, authenticate, environment, product: app, productHtml: decorateSfProductHtml, maxJsonBytes: 100000 })
  serverState.handle = async (request) => await first.handle(request) ?? await module(request)
  try {
    const cookie = async (identity: typeof first) => (await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`)))!.headers.get("set-cookie")!.split(";")[0]!
    const firstCookie = await cookie(first)
    const secondCookie = await cookie(second)
    const post = (credential: string, action: string, input: unknown, key: string) => app(new Request(`${origin}/sucafina/planner?sf=workbench-views`, { method: "POST", headers: { cookie: credential, origin, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify({ action, input }) }), "planner")
    const saved = { view: { id: "personal-view-1", title: "My forecast", surface: "planner", page: "OPEX" }, expectedVersion: null }
    const created = await post(firstCookie, "save", saved, "first-intention")
    expect(created?.status).toBe(200)
    expect(await created!.json()).toMatchObject({ status: "ok", value: { version: 1, view: { title: "My forecast" } } })
    const retry = await post(firstCookie, "save", saved, "first-intention")
    expect(await retry!.json()).toMatchObject({ status: "ok", value: { version: 1 } })
    const other = await post(secondCookie, "list", {}, "second-list-key")
    expect(await other!.json()).toEqual({ status: "ok", value: [] })
    const forbidden = await post(secondCookie, "open", { id: saved.view.id }, "second-open-key")
    expect(forbidden?.status).toBe(503)
    const stale = await post(firstCookie, "save", saved, "different-intention")
    expect(stale?.status).toBe(409)
    const removed = await post(firstCookie, "remove", { id: saved.view.id, expectedVersion: 1 }, "remove-intention")
    expect(removed?.status).toBe(200)
    const retryRemove = await post(firstCookie, "remove", { id: saved.view.id, expectedVersion: 1 }, "remove-intention")
    expect(retryRemove?.status).toBe(200)
    const replacement = { ...saved, view: { ...saved.view, title: "New view" } }
    expect((await post(firstCookie, "save", replacement, "replacement-intent"))?.status).toBe(200)
    expect((await post(firstCookie, "save", saved, "first-intention"))?.status).toBe(409)
    expect((await post(firstCookie, "remove", { id: saved.view.id, expectedVersion: 1 }, "remove-intention"))?.status).toBe(409)
    const filtered = { view: { id: "filtered-view-1", title: "Filtered plan", surface: "planner", page: "OPEX", density: "compact", filters: { query: "renewal", selections: { year: "2027", mode: "forecast" } } }, expectedVersion: null }
    expect((await post(firstCookie, "save", filtered, "filtered-intention"))?.status).toBe(200)
    expect(await (await post(firstCookie, "open", { id: filtered.view.id }, "filtered-open-key"))!.json()).toMatchObject({ status: "ok", value: { view: { density: "compact", filters: filtered.view.filters } } })
    const invalid = { view: { ...filtered.view, id: "invalid-view-1", filters: { selections: { supplier: "not-allowed-on-opex" } } }, expectedVersion: null }
    expect((await post(firstCookie, "save", invalid, "invalid-intention"))?.status).toBe(400)
    checkpoint("principal isolation and exact retries verified")
    await store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "v1", year: 2027, closed: 0, lines: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: undefined }
    })
    const { chromium } = await import("@playwright/test")
    const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 10_000 })
    try {
      const tab = await browser.newPage()
      tab.setDefaultTimeout(10_000)
      tab.setDefaultNavigationTimeout(10_000)
      await tab.goto(`${origin}/sucafina/auth/local?code=${await first.enroll()}`)
      await tab.goto(`${origin}/sucafina/planner?page=OPEX`)
      checkpoint("browser authenticated and Planner rendered")
      await tab.getByRole("button", { name: "Filtered plan", exact: true }).click()
      await tab.waitForURL((url) => url.searchParams.get("view") === filtered.view.id)
      expect(new URL(tab.url()).searchParams.get("year")).toBe("2027")
      expect(new URL(tab.url()).searchParams.get("mode")).toBe("forecast")
      expect(new URL(tab.url()).searchParams.get("q")).toBe("renewal")
      await tab.locator('html[data-sf-density="compact"]').waitFor()
      checkpoint("saved filters and density restored")
      await tab.evaluate(async () => { await (window as unknown as { sucafinaRefresh: () => Promise<void> }).sucafinaRefresh() })
      await tab.getByRole("button", { name: "Filtered plan", exact: true }).waitFor()
      await tab.evaluate(() => { const url = new URL(location.href); url.searchParams.set("q", "changed-after-refresh"); history.replaceState(null, "", url) })
      expect(new URL(tab.url()).searchParams.get("q")).toBe("changed-after-refresh")
      await tab.getByRole("button", { name: "Filtered plan", exact: true }).click()
      await tab.waitForURL((url) => url.searchParams.get("view") === filtered.view.id && url.searchParams.get("q") === "renewal")
      checkpoint("refreshed view restored the changed query")
    } finally { await browser.close() }
  } finally { await server.stop(true); await store.dispose(); await rm(directory, { recursive: true, force: true }) }
  // This journey includes durable authority, Chrome startup and real page refreshes.
}, 60_000)
