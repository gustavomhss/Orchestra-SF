import { afterEach, expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { launchBrowserDriver } from "../../wp02/browser-driver-fixture.ts"
import { randomBytes, randomUUID } from "node:crypto"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { Location } from "@orchestra/core/location"
import { createModule, contributions } from "../../../../index.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../../runtime/operator-identity.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfPortfolioServices } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-services.ts"
import { createSfBiServices } from "../../../../../../../apps/cli/src/sucafina-product/bi-services.ts"
import { createSfExtendedAssets } from "../../../../../../../apps/cli/src/sucafina-product/extended-assets.ts"
import { createSfExtendedHttp } from "../../../../../../../apps/cli/src/sucafina-product/extended-http.ts"
import type { SfHostServices } from "../../../../product/contracts/host-context.ts"
import { observeSfDecisionIntentHealth } from "../../../../../../../apps/cli/src/sucafina-product/native-ui/decision-intent-health.ts"
import { createNativeBrowserHost } from "../../native-ui-browser/host.ts"
import { createNativeBrowserAssets } from "../../native-ui-browser/browser-assets.ts"
import { enrollNativeBrowser } from "../../native-ui-browser/session.ts"
import type { DomainProjection } from "../../../../product/contracts/context.ts"
import { sfPlannerBiSelection } from "../../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

const liveLifecycleFixtures = new Set<() => Promise<void>>()
let nativeAssetBuild: ReturnType<typeof createNativeBrowserAssets> | undefined
afterEach(async () => {
  // Bun can report an exception from a transport event before the test's
  // awaited setup settles. Own provisional fixtures before their first await.
  const outcomes = await Promise.allSettled([...liveLifecycleFixtures].map((close) => close()))
  const failures = outcomes.flatMap((outcome) => outcome.status === "rejected" ? [outcome.reason] : [])
  if (failures.length) throw new AggregateError(failures, "BI lifecycle fixture cleanup failed")
})

// Real local-operator cookie/revocation, SQLite, C08, C16, source producers,
// native F01 owner and compiled product views. The operator/domain seed is a fixture;
// this does not claim installed OS identity, native inference or global proof.
async function prepareBiLifecycle(deadline: ReturnType<typeof compositionTestDeadline>) {
  const cancellation = new AbortController(), signal = cancellation.signal
  const releases: (() => void | Promise<void>)[] = []
  const transports: (() => void | Promise<void>)[] = []
  const acquiring = new Set<Promise<unknown>>()
  type Hold = { reached: ReturnType<typeof Promise.withResolvers<{ status: number; request: Request }>>;
    release: ReturnType<typeof Promise.withResolvers<void>>; finished: ReturnType<typeof Promise.withResolvers<void>> }
  const held = new Map<string, Hold>(), pending = new Set<Hold>()
  const stop = () => {
    for (const gate of pending) { gate.reached.reject(signal.reason); gate.release.resolve() }
  }
  signal.addEventListener("abort", stop, { once: true })
  let closing: Promise<void> | undefined
  const dispose = () => closing ??= (async () => {
    cancellation.abort(new Error("BI lifecycle fixture closed"))
    deadline.signal.removeEventListener("abort", relay)
    // Acquisition owns its value before it can observe cancellation. Wait for
    // every pending acquisition before taking the final cleanup stack.
    await Promise.allSettled([...acquiring])
    const failures: unknown[] = []
    for (const close of [...transports, ...releases.toReversed()]) {
      try { await close() } catch (error) { failures.push(error) }
    }
    liveLifecycleFixtures.delete(dispose)
    signal.removeEventListener("abort", stop)
    if (failures.length) throw new AggregateError(failures, "BI lifecycle resources did not close")
  })()
  const relay = () => {
    cancellation.abort(deadline.signal.reason)
    // Start cancellation even while an awaited browser transport is pending;
    // the deadline owner and afterEach both await the same closing promise.
    void dispose().catch(() => undefined)
  }
  deadline.own(dispose)
  liveLifecycleFixtures.add(dispose)
  deadline.signal.addEventListener("abort", relay, { once: true })
  if (deadline.signal.aborted) relay()
  const acquire = async <Value>(open: () => Promise<Value>, close: (value: Value) => void | Promise<void>): Promise<Value> => {
    signal.throwIfAborted()
    const task = Promise.resolve().then(open).then((value) => {
      releases.push(() => close(value))
      return value
    })
    acquiring.add(task)
    try { const value = await task; signal.throwIfAborted(); return value }
    finally { acquiring.delete(task) }
  }
  let stage = "imports"
  try {
    signal.throwIfAborted()
    signal.throwIfAborted()
    const temporary = await realpath(tmpdir())
    signal.throwIfAborted()
    const directory = await acquire(() => mkdtemp(join(temporary, "sf-bi-lifecycle-")), (value) => rm(value, { recursive: true, force: true }))
    await chmod(directory, 0o700)
    signal.throwIfAborted()
    const driver = await acquire(() => openLocalStore(directory), (value) => value.dispose())
    const route: { handle?: (request: Request) => Promise<Response | undefined> } = {}
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => await route.handle?.(request) ?? new Response(null, { status: 404 }) })
    transports.push(async () => { route.handle = undefined; await server.stop(true) })
    const origin = server.url.origin, mount = "/sucafina"
    const operator = { installationId: randomUUID(), uid: 1000, name: "BI lifecycle fixture operator" }
    const identity = createOperatorIdentity({ origin, mount, operator, secrets: driver.secrets, key: randomBytes(32) })
    const now = () => "2026-11-14T12:00:00Z"
    const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources,
      projectScope: createSfSourceScopeProjector(now), createId: randomUUID })
    const environment = async (request: Request) => {
      signal.throwIfAborted()
      const directory = await identity.directory(request)
      signal.throwIfAborted()
      return { at: now(), id: randomUUID, directory }
    }
    const principalRef = `macos:${operator.installationId}:${operator.uid}`
    const guards = { proposalCoverageWrites: new WeakSet<object>(), dashboardHostWrites: new WeakSet<object>(), procurementEvidenceWrites: new WeakSet<object>(),
      caseSelectionWrites: new WeakSet<object>(), threadHistoryWrites: new WeakSet<object>(), analysisSelectionWrites: new WeakSet<object>() }
    const binding = Object.freeze({ installationId: operator.installationId, hostId: "bi-lifecycle-host",
      projectId: operator.installationId, location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) })
    const authority = createSfProductAuthority({ installationId: operator.installationId, origin, policyVersion: "bi-lifecycle-fixture", persistence,
      identity: () => binding, isAuthenticated: async (request) => Boolean(await identity.person(request)), ...guards,
      grants: [{ principalRef, namespaces: ["cases", "preferences", "bi-artifacts", "reviews", "documents", "threads", "relations", "confirmations", "receipts", "outbox"],
        operations: ["sf_dashboard_read", "sf_bi_view", "sf_work_list", "sf_case_read", "sf_forecast_compare", "sf_scenario_simulate", "sf_scenario_compare", "sf_portfolio_evaluate", "sf_sensitivity_evaluate"], humanActions: [] }],
      createId: randomUUID, now: Date.now,
      // The installed host creates a fresh read identity, and derives command
      // identity only from an explicit, valid caller idempotency key.
      commandIdentity: async (request, operation) => {
        if (request.method === "GET" || request.method === "HEAD") return randomUUID()
        const key = request.headers.get("Idempotency-Key")
        return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined
      },
      authenticate: identity.authenticate, environment,
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
      providerGeneration: async () => 1, authorizeDocument: async () => undefined })
    const business = createSfBusinessServices({ authority, persistence, ...guards })
    releases.push(() => business.dispose())
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
    const portfolio = createSfPortfolioServices({ authority, business, ...guards })
    releases.push(() => portfolio.dispose())
    const bi = createSfBiServices({ authority, business, portfolio }), assets = createSfExtendedAssets()
    releases.push(() => assets.dispose())
    const http = createSfExtendedHttp({ authority, business, bi, reviews: undefined, persistence, origin, assets })
    const application = { persistence, authenticate: identity.authenticate, environment, product: http, maxJsonBytes: 100_000 }
    const app = createModule(mount, application)
    const services = { ...authority, productHttp: http } as SfHostServices
    // Bind readiness only to the real product handler mounted immediately
    // above, with its actual BI/Planner dependencies. The production observer
    // still consumes admission and checks two canonical namespace snapshots.
    const native = createNativeBrowserHost({
      origin, mount, directory, identity: () => binding, application: { ...application, domains: contributions },
      authority, services: () => services,
      observe: (request, stamp) => observeSfDecisionIntentHealth({
        ui: authority.ui, state: authority.state, humanActions: authority.humanActions,
        binding: (operation, producer) => operation.startsWith("bi.") && producer === application.product &&
          services.productHttp === http ? application : undefined,
        source: (operation) => operation.startsWith("bi.") && services.productHttp === http ? {
          producer: http, dependencies: [http, bi, bi.descriptor, bi.source, bi.source.read,
            bi.source.revalidate, business.plannerProduct, business.plannerProduct.versions,
            business.plannerProduct.issueSource, persistence],
        } : undefined,
      }, request, stamp),
    })
    const observations: { mode: string; method: string; status: number; url: string }[] = []
    const failures: string[] = [], aborted: string[] = []
    const holdNext = (mode: string) => {
      signal.throwIfAborted()
      if (held.has(mode)) throw new Error(`A ${mode} response is already held`)
      const gate: Hold = { reached: Promise.withResolvers(), release: Promise.withResolvers(), finished: Promise.withResolvers() }
      void gate.reached.promise.catch(() => undefined)
      held.set(mode, gate); pending.add(gate)
      return gate
    }
    stage = "source.initialize"
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexOwners = [{ id: "owner", name: "Lifecycle private owner", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "jan", ownerId: "owner", year: 2026, month: 1, budget: 100, actual: 50, forecast: 0 }]
      snapshot.data.capexProjects = []; snapshot.data.capexEntries = []
      return { commit: true, value: undefined }
    })
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [100, 80].map((amount, index) => ({ id: `navigation-${index}`, name: `Navigation version ${index}`, year: 2026, closed: 0,
        lines: [{ id: "navigation-line", name: "Navigation license", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
      return { commit: true, value: undefined }
    })
    await persistence.initializeSources("planner")
    signal.throwIfAborted()
    stage = "browser.asset"
    const nativeAssets = await (nativeAssetBuild ??= createNativeBrowserAssets())
    signal.throwIfAborted()
    route.handle = async (request) => {
      const url = new URL(request.url)
      const mode = url.pathname.endsWith("/auth/logout") ? "logout" :
        url.pathname.endsWith("/api/ui/context") ? "native-context" :
        url.pathname.endsWith("/api/ui/pages/CAP17") ? "planner-page" :
        url.searchParams.get("sf") ?? "other"
      const response = await identity.handle(request) ?? nativeAssets.handle(request, { directory }) ??
        await native.handle(request) ?? await app(request)
      if (!response) return undefined
      observations.push({ mode, method: request.method, status: response.status, url: request.url })
      const gate = held.get(mode)
      if (gate) {
        held.delete(mode)
        gate.reached.resolve({ status: response.status, request })
        // Hold transport only after the actual producer has completed.
        try { await gate.release.promise }
        finally { pending.delete(gate); gate.finished.resolve() }
      }
      return response
    }
    stage = "browser.acquire"
    const owned = await acquire(
      () => launchBrowserDriver("bi-lifecycle", { signal, timeoutMs: 15_000 }),
      (value) => value.close(),
    )
    const context = await owned.browser.newContext({ serviceWorkers: "block" })
    signal.throwIfAborted()
    const page = await context.newPage()
    signal.throwIfAborted()
    page.setDefaultTimeout(10_000); page.setDefaultNavigationTimeout(15_000)
    page.on("pageerror", (error) => failures.push(error.message))
    page.on("requestfailed", (request) => { aborted.push(new URL(request.url()).searchParams.get("sf") ?? "other") })
    await page.clock.install({ time: new Date("2026-11-14T12:00:00Z") })
    await page.clock.pauseAt(new Date("2026-11-14T12:00:01Z"))
    signal.throwIfAborted()
    stage = "browser.enrollment"
    await enrollNativeBrowser(context, origin, () => identity.enroll())
    signal.throwIfAborted()
    // The exact owner triplet is the native route selector, never a grant.
    const destination = new URL("/orchestra/sf-bi", origin)
    destination.search = new URLSearchParams({ server: origin, project: binding.projectId,
      installation: binding.installationId }).toString()
    stage = "browser.bi"
    expect((await page.goto(destination.href))?.status()).toBe(200)
    await page.locator('[data-sf-host="owner-runtime231"][data-sf-provider-state="ready"]').waitFor()
    const catalog = page.locator('[data-sf-catalog="UI45"]')
    await catalog.waitFor()
    await page.locator('[data-sf-field="view"]').selectOption("BI01")
    await page.locator('[data-sf-field="start"]').fill("2026-01-01")
    await page.locator('[data-sf-field="end"]').fill("2026-12-31")
    const options = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-options")
    await page.getByRole("button", { name: "Choose context", exact: true }).click()
    expect((await options).status()).toBe(200)
    const choices = await page.locator('[data-sf-field="selection"] option').evaluateAll((items) =>
      items.map((item) => (item as HTMLOptionElement).value).filter((value) => value && value !== "planner"))
    expect(choices).toHaveLength(1)
    const selectionRef = choices[0]!
    await page.locator('[data-sf-field="selection"]').selectOption(selectionRef)
    const first = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data")
    await page.getByRole("button", { name: "View data", exact: true }).click()
    expect((await first).status()).toBe(200)
    await page.getByText("Data updated.", { exact: true }).waitFor()
    expect(await catalog.locator("table").count()).toBeGreaterThan(0)
    const owner = await page.locator('[data-sf-host="owner-runtime231"]').elementHandle()
    if (!owner) throw new Error("Real native F01 owner unavailable")
    signal.throwIfAborted()
    const count = (mode: string) => observations.filter((entry) => entry.mode === mode).length
    return { page, context, origin, mount, owner, selectionRef, observations, failures, aborted, holdNext, count, dispose, report: owned.report }

  } catch (error) {
    console.error("SF_BI_LIFECYCLE_SETUP", JSON.stringify({ stage, cancelled: signal.aborted, error: error instanceof Error ? error.message : String(error) }))
    await dispose()
    throw error
  }
}

test("native BI keeps its owner, refreshes on manual focus and timer, and signs out once while discarding a held genuine success", async () => {
  expectSpawn(import.meta.path)
  const deadline = compositionTestDeadline("bi-lifecycle-controls")
  try {
    const world = await deadline.phase("browser.setup", () => prepareBiLifecycle(deadline))
    const { page } = world
    const refresh = async (action: () => Promise<unknown>) => {
      const before = world.count("bi-data"), beforeAuthority = world.count("native-context")
      const data = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data")
      const authority = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/api/ui/context"))
      await action()
      expect((await authority).status()).toBe(200)
      const response = await data
      expect(response.status()).toBe(200)
      expect((await response.json()).request).toEqual({ viewId: "BI01", selectionRef: world.selectionRef,
        period: { start: "2026-01-01", end: "2026-12-31" } })
      await page.getByText("Data updated.", { exact: true }).waitFor()
      expect(world.count("bi-data")).toBeGreaterThan(before)
      expect(world.count("native-context")).toBeGreaterThan(beforeAuthority)
      expect(await world.owner.evaluate((node) => node.isConnected && node.getAttribute("data-sf-provider-state") === "ready")).toBe(true)
      expect(await page.locator("[data-sf-catalog] table").count()).toBeGreaterThan(0)
      expect(await page.locator('[data-sf-field="selection"]').inputValue()).toBe(world.selectionRef)
    }
    await deadline.phase("manual-refresh", () => refresh(() => page.getByRole("button", { name: "Refresh data", exact: true }).click()))
    await deadline.phase("focus-refresh", () => refresh(() => page.evaluate(() => dispatchEvent(new Event("focus")))))
    await deadline.phase("periodic-refresh", () => refresh(() => page.clock.runFor(30_000)))
    const success = world.holdNext("bi-data"), logout = world.holdNext("logout")
    await page.getByRole("button", { name: "View data", exact: true }).click()
    expect((await deadline.phase("hold-real-data", () => success.reached.promise)).status).toBe(200)
    const beforeLogout = world.count("logout")
    const aborted = page.waitForEvent("requestfailed", (request) => new URL(request.url()).searchParams.get("sf") === "bi-data")
    // Two user activations still start exactly one genuine identity POST.
    await page.getByRole("button", { name: "Sign out", exact: true }).evaluate((button) => {
      (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click()
    })
    expect((await deadline.phase("hold-real-logout", () => logout.reached.promise)).status).toBe(204)
    await aborted
    // Logout is still held, but the native owner has already fenced its
    // generation, removed private BI UI and aborted the old successful read.
    await page.waitForFunction(() => document.querySelector('[data-sf-host="owner-runtime231"]')?.getAttribute("data-sf-provider-state") === "resolving")
    expect(await page.locator("[data-sf-catalog], .sf-bi-figure, [data-sf-bi-focus]").count()).toBe(0)
    expect(world.count("logout") - beforeLogout).toBe(1)
    success.release.resolve(); await success.finished.promise
    expect(await page.locator("[data-sf-catalog], .sf-bi-figure").count()).toBe(0)
    logout.release.resolve(); await logout.finished.promise
    await page.waitForFunction(() => document.querySelector('[data-sf-host="owner-runtime231"]')?.getAttribute("data-sf-provider-state") === "unavailable")
    expect(world.aborted).toContain("bi-data")
    expect(await page.locator("[data-sf-catalog]").count()).toBe(0)
    expect(world.count("logout") - beforeLogout).toBe(1)
    expect(world.observations.filter((entry) => entry.mode === "logout").map((entry) => entry.method)).toEqual(["POST"])
    expect(world.failures).toEqual([])
    await world.dispose()
    world.report()
  } finally { await deadline.close() }
}, 120_000)

test("native BI independently polls authority while awaiting a held result and real session revocation prevents every late render", async () => {
  expectSpawn(import.meta.path)
  const deadline = compositionTestDeadline("bi-lifecycle-authority")
  try {
    const world = await deadline.phase("browser.setup", () => prepareBiLifecycle(deadline))
    const { page } = world
    // Keep the data read's own deadline after the independent authority tick.
    await page.clock.runFor(1000)
    const success = world.holdNext("bi-data")
    await page.getByRole("button", { name: "View data", exact: true }).click()
    expect((await deadline.phase("hold-real-data", () => success.reached.promise)).status).toBe(200)
    const beforeAuthority = world.count("native-context")
    const cookies = await world.context.cookies(new URL(`${world.mount}/auth/logout`, world.origin).href)
    const revoked = await fetch(new URL(`${world.mount}/auth/logout`, world.origin).href, { method: "POST", signal: deadline.signal,
      headers: { origin: world.origin, cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ") }, redirect: "manual" })
    expect(revoked.status).toBe(204)
    expect(world.aborted).not.toContain("bi-data")
    const authority = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/api/ui/context"))
    await page.clock.runFor(29_000)
    const denied = await authority
    // F01 distinguishes a durably revoked operator session from a current
    // authenticated principal denied by policy. This is its real 401 envelope.
    expect(denied.status()).toBe(401)
    expect(await denied.json()).toEqual({ status: "unauthenticated" })
    await page.waitForFunction(() => document.querySelector('[data-sf-host="owner-runtime231"]')?.getAttribute("data-sf-provider-state") === "unavailable")
    expect(world.count("native-context")).toBeGreaterThan(beforeAuthority)
    expect(await page.locator("[data-sf-catalog], .sf-bi-figure, [data-sf-bi-focus]").count()).toBe(0)
    success.release.resolve(); await success.finished.promise
    await page.clock.runFor(1)
    expect(await page.locator("[data-sf-catalog], .sf-bi-figure").count()).toBe(0)
    expect(world.aborted).toContain("bi-data")
    const after = world.observations.length
    await page.clock.runFor(60_000)
    expect(world.observations.length).toBe(after)
    expect(world.failures).toEqual([])
    await world.dispose()
    world.report()
  } finally { await deadline.close() }
}, 120_000)

test("clearing native BI selection while genuine authorized options are delayed prevents restoration of the previous selection", async () => {
  expectSpawn(import.meta.path)
  const deadline = compositionTestDeadline("bi-lifecycle-selection")
  try {
    const world = await deadline.phase("browser.setup", () => prepareBiLifecycle(deadline))
    const { page } = world
    const options = world.holdNext("bi-options"), beforeData = world.count("bi-data")
    await page.getByRole("button", { name: "Refresh data", exact: true }).click()
    expect((await deadline.phase("hold-real-options", () => options.reached.promise)).status).toBe(200)
    const aborted = page.waitForEvent("requestfailed", (request) => new URL(request.url()).searchParams.get("sf") === "bi-options")
    await page.getByLabel("Selection", { exact: true }).selectOption("")
    await aborted
    options.release.resolve(); await options.finished.promise
    await page.clock.runFor(1)
    expect(await page.getByLabel("Selection", { exact: true }).inputValue()).toBe("")
    expect(await page.getByRole("button", { name: "View data", exact: true }).isDisabled()).toBe(true)
    expect(await page.locator("[data-sf-catalog] table, [data-sf-catalog] nav a").count()).toBe(0)
    expect(await page.getByText("Read data for the current selection.", { exact: true }).isVisible()).toBe(true)
    expect(world.count("bi-data")).toBe(beforeData)
    expect(await world.owner.evaluate((node) => node.isConnected)).toBe(true)
    // A later authority tick cannot turn the cleared human selection back
    // into a request or replay the held options response.
    const authority = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/api/ui/context"))
    await page.clock.runFor(30_000)
    expect((await authority).status()).toBe(200)
    expect(world.count("bi-data")).toBe(beforeData)
    expect(await page.getByLabel("Selection", { exact: true }).inputValue()).toBe("")
    expect(world.failures).toEqual([])
    await world.dispose()
    world.report()
  } finally { await deadline.close() }
}, 120_000)

test("native BI returns from its real Planner source with the same human filters, version pair, currency and mark focus after current reauthorization", async () => {
  expectSpawn(import.meta.path)
  const deadline = compositionTestDeadline("bi-return-context")
  try {
    const world = await deadline.phase("browser.setup", () => prepareBiLifecycle(deadline))
    const { page } = world
    await page.getByLabel("Analysis view", { exact: true }).selectOption("BI02")
    await page.getByLabel("End date", { exact: true }).fill("2026-03-31")
    const options = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-options")
    await page.getByRole("button", { name: "Choose context", exact: true }).click()
    expect((await options).status()).toBe(200)
    await page.getByLabel("Selection", { exact: true }).selectOption("planner")
    const versions = await page.getByLabel("Base version", { exact: true }).locator("option").evaluateAll((items) =>
      items.map((item) => (item as HTMLOptionElement).value).filter(Boolean))
    expect(versions).toHaveLength(2)
    await page.getByLabel("Base version", { exact: true }).selectOption(versions[0]!)
    await page.getByLabel("Candidate version", { exact: true }).selectOption(versions[1]!)
    await page.getByLabel("Comparison currency", { exact: true }).fill("USD")
    const data = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data")
    await page.getByRole("button", { name: "View data", exact: true }).click()
    const dataResponse = await data
    expect(dataResponse.status()).toBe(200)
    const query = new URL(dataResponse.url()).searchParams
    expect(query.get("baseRef")).toBe(versions[0])
    expect(query.get("candidateRef")).toBe(versions[1])
    expect(query.get("currency")).toBe("USD")
    expect(query.has("selectionRef")).toBe(false)
    await page.getByText("Data updated.", { exact: true }).waitFor()
    const marker = page.locator("[data-sf-catalog] .sf-bi-source-actions button[data-sf-bi-focus]").first()
    const valueId = await marker.getAttribute("data-sf-bi-focus")
    expect(valueId).toBeTruthy()
    const source = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-source")
    await marker.click()
    const sourceResponse = await source
    expect(sourceResponse.status()).toBe(200)
    expect(new URL(sourceResponse.url()).searchParams.get("valueId")).toBe(valueId)
    const original: { links: { label: string; url: string }[] } = await sourceResponse.json()
    expect(original.links.length).toBeGreaterThan(0)
    const originalUrl = new URL(original.links[0]!.url, world.origin)
    const link = page.getByRole("navigation", { name: "Authorized source links", exact: true }).locator("a").first()
    const nativeUrl = new URL((await link.getAttribute("href"))!, world.origin)
    expect(nativeUrl.pathname).toBe("/orchestra/sf-planner/overview")
    expect(nativeUrl.searchParams.get("version")).toBe(originalUrl.searchParams.get("version"))
    expect(nativeUrl.searchParams.get("server")).toBe(world.origin)
    expect(nativeUrl.searchParams.get("project")).toBe(new URL(page.url()).searchParams.get("project"))
    expect(nativeUrl.searchParams.get("installation")).toBe(new URL(page.url()).searchParams.get("installation"))
    const planner = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/api/ui/pages/CAP17"))
    await link.click()
    await page.waitForURL((url) => url.pathname === "/orchestra/sf-planner/overview")
    const plannerResponse = await planner
    expect(plannerResponse.status()).toBe(200)
    const plannerBody = await plannerResponse.json()
    expect(plannerBody.status).toBe("ok")
    expect(plannerBody.value.data.selectedVersion.id).toBe(originalUrl.searchParams.get("version"))
    expect(await page.locator("[data-sf-catalog]").count()).toBe(0)
    expect(await world.owner.evaluate((node) => node.isConnected)).toBe(true)
    const beforeReturn = world.count("bi-data"), beforeAuthority = world.count("native-context")
    const returning = world.holdNext("bi-options")
    const fresh = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data")
    await page.goBack({ waitUntil: "domcontentloaded" })
    expect((await deadline.phase("hold-return-options", () => returning.reached.promise)).status).toBe(200)
    expect(world.count("native-context")).toBeGreaterThan(beforeAuthority)
    expect(await page.locator("[data-sf-catalog] table, [data-sf-catalog] .sf-bi-figure").count()).toBe(0)
    expect(world.count("bi-data")).toBe(beforeReturn)
    returning.release.resolve(); await returning.finished.promise
    expect((await fresh).status()).toBe(200)
    await page.getByText("Data updated.", { exact: true }).waitFor()
    expect(world.count("bi-data")).toBeGreaterThan(beforeReturn)
    expect(await page.getByLabel("Analysis view", { exact: true }).inputValue()).toBe("BI02")
    expect(await page.getByLabel("Start date", { exact: true }).inputValue()).toBe("2026-01-01")
    expect(await page.getByLabel("End date", { exact: true }).inputValue()).toBe("2026-03-31")
    expect(await page.getByLabel("Selection", { exact: true }).inputValue()).toBe("planner")
    expect(await page.getByLabel("Base version", { exact: true }).inputValue()).toBe(versions[0]!)
    expect(await page.getByLabel("Candidate version", { exact: true }).inputValue()).toBe(versions[1]!)
    expect(await page.getByLabel("Comparison currency", { exact: true }).inputValue()).toBe("USD")
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-sf-bi-focus"))).toBe(valueId)
    expect(await world.owner.evaluate((node) => node.isConnected && node.getAttribute("data-sf-provider-state") === "ready")).toBe(true)
    expect(world.failures).toEqual([])
    await world.dispose()
    world.report()
  } finally { await deadline.close() }
}, 120_000)

test("BI origin digests select only an explicit source of the real current Planner difference and never choose A or B implicitly", async () => {
  const deadline = compositionTestDeadline("bi-explicit-origins")
  try {
    const fixture = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() })
    deadline.own(() => fixture.dispose())
    const { authority, business, portfolio, persistence } = fixture
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [100, 80].map((amount, index) => ({ id: `origin-${index}`, name: `Explicit origin ${index}`, year: 2026, closed: 0,
        lines: [{ id: "line", name: "License service", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
      return { commit: true, value: undefined }
    })
    await persistence.initializeSources("planner")
    const call = await fixture.read()
    deadline.own(() => authority.ui.finish(call))
    const a = await business.plannerProduct.issueSource("origin-0", call)
    const b = await business.plannerProduct.issueSource("origin-1", call)
    if (a.status !== "ok" || b.status !== "ok") throw new Error("Real authorized Planner origins unavailable")
    const period = { start: "2026-01-01", end: "2026-01-31" }
    const selectionRef = sfPlannerBiSelection({ baseRef: a.value.evidence.refId, candidateRef: b.value.evidence.refId, period, currency: "USD" })
    const bi = createSfBiServices({ authority, business, portfolio }), assets = createSfExtendedAssets()
    deadline.own(() => assets.dispose())
    const http = createSfExtendedHttp({ authority, business, bi, reviews: undefined, persistence, origin: "https://example.test", assets })
    const query = new URLSearchParams({ sf: "bi-data", viewId: "BI02", selectionRef, start: period.start, end: period.end })
    const invoke = (query: URLSearchParams) => deadline.phase("http.bi-origin", () => http(new Request(`https://example.test/dashboard?${query}`, { signal: deadline.signal }), "dashboard"))
    const data = await invoke(query)
    expect(data?.status).toBe(200)
    const body: { projection: DomainProjection } = await data!.json()
    const row = body.projection.values.find((value) => value.drilldown === null && new Set(value.sourceRefs.map((ref) => ref.refDigest)).size === 2)
    if (!row) throw new Error("Real Planner difference did not preserve both explicit origins")
    const origins = [...new Map(row.sourceRefs.map((reference) => [reference.refDigest, reference])).values()]
    expect(origins.map((ref) => ref.refDigest).sort()).toEqual([a.value.evidence.refDigest, b.value.evidence.refDigest].sort())
    query.set("sf", "bi-source"); query.set("valueId", row.id)
    const missing = await invoke(query)
    expect(missing?.status).toBe(409)
    expect(await missing!.json()).toMatchObject({ status: "needs-input", reason: "bi-source-choice-required" })
    for (const reference of origins) {
      if (reference.kind !== "record" || reference.target.surface !== "planner") throw new Error("Unexpected real Planner origin")
      query.set("referenceDigest", reference.refDigest)
      const opened = await invoke(query)
      expect(opened?.status).toBe(200)
      const result: { links: { label: string; url: string }[] } = await opened!.json()
      expect(result.links.length).toBeGreaterThan(0)
      expect(result.links.every((link) => new URL(link.url, "https://example.test").searchParams.get("version") === reference.target.recordId)).toBe(true)
    }
    query.set("referenceDigest", "0".repeat(64))
    const outside = await invoke(query)
    expect(outside?.status).toBe(403)
    const denied = await outside!.json()
    expect(denied).toMatchObject({ status: "denied", reason: "bi-source-outside-selected-value" })
    expect(denied).not.toHaveProperty("links")
    query.set("referenceDigest", "not-a-digest")
    expect((await invoke(query))?.status).toBe(400)
    query.set("referenceDigest", origins[0]!.refDigest); query.append("referenceDigest", origins[1]!.refDigest)
    expect((await invoke(query))?.status).toBe(400)
    query.delete("referenceDigest"); query.set("referenceDigest", origins[0]!.refDigest)
    fixture.active.value = false
    const revoked = await invoke(query)
    expect(revoked?.status).toBe(403)
    expect(await revoked!.json()).not.toHaveProperty("links")
  } finally { await deadline.close() }
}, 120_000)
