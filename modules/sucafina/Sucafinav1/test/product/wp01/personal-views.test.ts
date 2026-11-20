import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { launchBrowserDriver } from "../wp02/browser-driver-fixture.ts"
import { createNativeBrowserAssets } from "../native-ui-browser/browser-assets.ts"
import { createNativeBrowserHost } from "../native-ui-browser/host.ts"
import { enrollNativeBrowser } from "../native-ui-browser/session.ts"
import { observeSfPersonalViewsHealth } from "../../../../../../apps/cli/src/sucafina-product/native-ui/personal-views-health.ts"
import { object } from "../../../runtime/contract.ts"
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
import { contributions, createModule } from "../../../index.ts"

test("personal views isolate authenticated principals and reconcile exact retries", async () => {
  expectSpawn(import.meta.path)
  const assets = await createNativeBrowserAssets()
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-personal-views-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const serverState: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => await serverState.handle?.(request) ?? new Response(null, { status: 404 }) })
  const origin = server.url.origin
  const installationId = randomUUID()
  const first = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1, name: "First" }, secrets: store.secrets, key: randomBytes(32) })
  const second = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 2, name: "Second" }, secrets: store.secrets, key: randomBytes(32) })
  const authenticate: typeof first.authenticate = async (request, context) => await first.authenticate(request, context) ?? await second.authenticate(request, context)
  const environment = async (request: Request) => ({ at: "2026-11-13T08:00:00Z", id: randomUUID, directory: [...await first.directory(request), ...await second.directory(request)] })
  const binding = { installationId, projectId: "project", hostId: "host", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const authority = createSfProductAuthority({ identity: () => binding, installationId, origin, policyVersion: "policy", persistence: store, authenticate,
    isAuthenticated: async (request) => Boolean(await first.person(request) ?? await second.person(request)), environment,
    grants: [1, 2].map((uid) => ({ principalRef: `macos:${installationId}:${uid}`, namespaces: ["preferences" as const], operations: [], humanActions: ["views.read" as const, "views.save" as const, "views.remove" as const] })), createId: randomUUID, now: Date.now,
    commandIdentity: async (request, operation) => request.method === "GET" ? randomUUID() : request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const personalViews = createSfPersonalViews({ host: authority.host, state: authority.state, creationTarget: authority.creationTarget, operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined, humanAuthorize: authority.human.authorize,
    authorizeView: async (view, context) => view.surface === "planner" && PLANNER_TABS.some((page) => page === view.page) && await authority.host.revalidate(context) })
  const services = { ...authority, personalViews } as SfHostServices
  const app = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => services })
  const application = { persistence: store, authenticate, environment, product: app, maxJsonBytes: 100000 }
  const module = createModule("/sucafina", application)
  const native = createNativeBrowserHost({ origin, mount: "/sucafina", directory, identity: () => binding,
    application: { ...application, domains: contributions }, authority, services: () => services,
    observe: (request, stamp) => observeSfPersonalViewsHealth({ ui: authority.ui, state: authority.state,
      source: () => services.personalViews === personalViews ? personalViews : undefined,
      binding: (operationId, producer) => (operationId === "views.list" || operationId === "views.open" ||
        operationId === "views.save" || operationId === "views.remove") && producer === personalViews &&
        services.personalViews === producer && application.product === app ? app : undefined,
    }, request, stamp),
  })
  serverState.handle = async (request) => await first.handle(request) ?? assets.handle(request, { directory }) ??
    await native.handle(request) ?? await module(request)
  let browserDriver: Awaited<ReturnType<typeof launchBrowserDriver>> | undefined
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
    await store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "v1", name: "FY27", year: 2027, locked: false, closed: 0, lines: [
        { id: "renewal-line", name: "License renewal", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), f: [] },
        { id: "other-line", name: "Unrelated hosting", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(200), f: [] },
      ], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: undefined }
    })
    browserDriver = await launchBrowserDriver("personal-views")
    const { expect: browserExpect } = await import("@playwright/test")
    try {
      const context = await browserDriver.browser.newContext({ viewport: { width: 1440, height: 1000 } })
      context.setDefaultTimeout(5000)
      context.setDefaultNavigationTimeout(5000)
      await enrollNativeBrowser(context, origin, () => first.enroll())
      const tab = await context.newPage(), errors: string[] = []
      tab.on("pageerror", (error) => errors.push(error.message))
      type CapturedResponse = { method: string; url: string; status: number; requestBody: unknown; body: unknown; error?: string }
      const pending = new Set<{ matches: (response: CapturedResponse) => boolean; complete: (response: CapturedResponse) => void }>()
      const captureResponse = (matches: (response: CapturedResponse) => boolean) => new Promise<CapturedResponse>((resolve, reject) => {
        const waiter = { matches, complete: (response: CapturedResponse) => {
          clearTimeout(timeout)
          pending.delete(waiter)
          if (response.error) reject(new Error(response.error))
          else resolve(response)
        } }
        const timeout = setTimeout(() => {
          pending.delete(waiter)
          reject(new Error("Timed out after 5000 ms waiting for the real personal-view response"))
        }, 5000)
        pending.add(waiter)
      })
      await context.exposeBinding("__sfPersonalViewResponse", (source, response: CapturedResponse) => {
        if (source.page !== tab) return
        for (const waiter of [...pending]) if (waiter.matches(response)) waiter.complete(response)
      })
      await context.addInitScript(({ origin }) => {
        const originalFetch = globalThis.fetch
        const bridge = (globalThis as unknown as {
          __sfPersonalViewResponse: (response: CapturedResponse) => Promise<void>
        }).__sfPersonalViewResponse
        globalThis.fetch = async function (this: unknown, ...args: Parameters<typeof fetch>) {
          const [input, init] = args
          const url = new URL(input instanceof Request ? input.url : String(input), location.href)
          const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
          const observed = url.origin === origin && (
            method === "GET" && url.pathname === "/sucafina/api/ui/pages/CAP18" ||
            method === "POST" && url.searchParams.get("sf") === "workbench-views")
          if (!observed) return Reflect.apply(originalFetch, this, args)
          // Clone a Request before fetch can consume its body. The installed client
          // normally supplies its JSON string in init; neither original body is read.
          const requestText = method === "POST"
            ? typeof init?.body === "string" ? Promise.resolve(init.body)
              : input instanceof Request && init?.body === undefined ? input.clone().text() : Promise.resolve("")
            : Promise.resolve("")
          const response = await Reflect.apply(originalFetch, this, args)
          let requestBody: unknown
          try {
            const text = await requestText
            requestBody = text ? JSON.parse(text) : undefined
            const body: unknown = await response.clone().json()
            // Deliver the copy before returning the original response: consumers
            // may navigate immediately, invalidating CDP's response-body identifier.
            await bridge({ method, url: response.url, status: response.status, requestBody, body })
          } catch (error) {
            await bridge({ method, url: response.url, status: response.status, requestBody, body: undefined,
              error: error instanceof Error ? error.message : String(error) }).catch(() => {})
          }
          return response
        }
      }, { origin })
      await tab.goto(origin + "/orchestra/sf-work/views")
      await tab.getByRole("button", { name: "Filtered plan", exact: true }).click()
      const openSavedPage = tab.getByRole("link", { name: "Open saved page", exact: true })
      const candidate = new URL(await openSavedPage.getAttribute("href") ?? "", origin)
      expect(candidate.pathname).toBe("/orchestra/sf-planner/opex")
      expect(Object.fromEntries(candidate.searchParams)).toEqual({
        server: origin, project: binding.projectId, installation: installationId, view: filtered.view.id,
      })
      const pageResponse = (response: CapturedResponse) =>
        response.method === "GET" && new URL(response.url).pathname === "/sucafina/api/ui/pages/CAP18"
      const openedView = (response: CapturedResponse) =>
        response.method === "POST" && new URL(response.url).searchParams.get("sf") === "workbench-views" &&
        object(response.requestBody).action === "open" &&
        object(object(response.requestBody).input).id === filtered.view.id
      const assertRestored = async (response: Awaited<ReturnType<typeof captureResponse>>, opened: Awaited<ReturnType<typeof captureResponse>>) => {
        expect(opened.status).toBe(200)
        expect(opened.body).toMatchObject({ status: "ok", value: { view: filtered.view } })
        expect(response.status).toBe(200)
        const query = new URL(response.url).searchParams
        expect(query.get("year")).toBe("2027")
        expect(query.get("mode")).toBe("forecast")
        expect(query.get("q")).toBe("renewal")
        expect(response.body).toMatchObject({ status: "ok", value: {
          selection: { year: 2027, mode: "forecast", q: "renewal" },
          data: { lines: [{ id: "renewal-line", name: "License renewal" }] },
        } })
        expect(new URL(tab.url()).searchParams.get("view")).toBe(filtered.view.id)
        expect(new URL(tab.url()).searchParams.has("q")).toBe(false)
        await browserExpect(tab.locator('[data-sf-density="compact"]')).toHaveCount(1)
        await browserExpect(tab.getByText("Saved view restored: Filtered plan", { exact: true })).toBeVisible()
        const grid = tab.getByRole("grid")
        await browserExpect(grid.locator(".sf-s02-row")).toHaveCount(1)
        await browserExpect(grid.locator(".sf-s02-measure-name")).toHaveText(Array(12).fill("Forecast"))
        await browserExpect(tab.getByText("Unrelated hosting", { exact: true })).toHaveCount(0)
      }
      const [opened, response] = await Promise.all([
        captureResponse(openedView), captureResponse(pageResponse), openSavedPage.click(),
      ])
      await assertRestored(response, opened)
      const [reopened, refreshed] = await Promise.all([
        captureResponse(openedView), captureResponse(pageResponse), tab.reload(),
      ])
      await assertRestored(refreshed, reopened)
      expect(errors).toEqual([])
    } finally { await browserDriver.close() }
  } finally { await server.stop(true); await store.dispose(); await rm(directory, { recursive: true, force: true }) }
  if (!browserDriver) throw new Error("Personal views browser driver was not created")
  browserDriver.report()
})
