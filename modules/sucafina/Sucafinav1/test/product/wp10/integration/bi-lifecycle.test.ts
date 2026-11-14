import { afterEach, expect, test } from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { Location } from "@orchestra/core/location"
import { createModule } from "../../../../index.ts"
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
import type { SfBiOptions } from "../../../../../../../apps/cli/src/sucafina-product/extended-bi-options.ts"
import type { DomainProjection } from "../../../../product/contracts/context.ts"
import { sfPlannerBiSelection } from "../../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

const liveLifecycleFixtures = new Set<() => Promise<void>>()
afterEach(async () => {
  // Bun can report an exception from a transport event before the test's
  // awaited setup settles. Own provisional fixtures before their first await.
  const outcomes = await Promise.allSettled([...liveLifecycleFixtures].map((close) => close()))
  const failures = outcomes.flatMap((outcome) => outcome.status === "rejected" ? [outcome.reason] : [])
  if (failures.length) throw new AggregateError(failures, "BI lifecycle fixture cleanup failed")
})

// Real local-operator cookie/revocation, SQLite, C08, C16, source producers,
// HTTP shell and compiled BI bundle. The operator/domain seed is a fixture;
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
    const { chromium } = await import("@playwright/test")
    const { captureChromiumCleanup } = await import("../../wp07/chromium-cleanup.ts")
    signal.throwIfAborted()
    const temporary = await realpath(tmpdir())
    signal.throwIfAborted()
    const directory = await acquire(() => mkdtemp(join(temporary, "sf-bi-lifecycle-")), (value) => rm(value, { recursive: true, force: true }))
    await chmod(directory, 0o700)
    signal.throwIfAborted()
    const driver = await acquire(() => openLocalStore(directory), (value) => value.dispose())
    const route: { handle?: (request: Request) => Promise<Response | undefined> } = {}
    const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => await route.handle?.(request) ?? new Response(null, { status: 503 }) })
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
    const authority = createSfProductAuthority({ installationId: operator.installationId, origin, policyVersion: "bi-lifecycle-fixture", persistence,
      identity: () => ({ installationId: operator.installationId, hostId: "bi-lifecycle-host", projectId: operator.installationId,
        location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }), ...guards,
      grants: [{ principalRef, namespaces: ["cases", "preferences", "bi-artifacts", "reviews", "documents", "threads", "relations", "confirmations", "receipts", "outbox"],
        operations: ["sf_dashboard_read", "sf_bi_view", "sf_work_list", "sf_case_read", "sf_forecast_compare", "sf_scenario_simulate", "sf_scenario_compare", "sf_portfolio_evaluate", "sf_sensitivity_evaluate"], humanActions: [] }],
      createId: randomUUID, now: Date.now, commandIdentity: async () => undefined, authenticate: identity.authenticate, environment,
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
    const app = createModule(mount, { persistence, authenticate: identity.authenticate, environment, product: http, maxJsonBytes: 100_000 })
    const observations: { mode: string; method: string; status: number }[] = []
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
    route.handle = async (request) => {
      const url = new URL(request.url)
      const mode = url.pathname.endsWith("/auth/logout") ? "logout" : url.searchParams.get("sf") ?? "other"
      const response = await identity.handle(request) ?? await app(request)
      if (!response) return undefined
      observations.push({ mode, method: request.method, status: response.status })
      const gate = held.get(mode)
      if (gate) {
        held.delete(mode)
        gate.reached.resolve({ status: response.status, request })
        // Delay only transport after the actual product has produced these
        // bytes. The held success is never reclassified as current authority.
        try { await gate.release.promise }
        finally { pending.delete(gate); gate.finished.resolve() }
      }
      return response
    }
    stage = "browser.asset"
    await assets.bi()
    signal.throwIfAborted()
    stage = "browser.acquire"
    const owned = await acquire(async () => {
      const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 15_000 })
      try { return { browser, close: await captureChromiumCleanup(browser) } }
      catch (error) { await browser.close(); throw error }
    }, (value) => value.close())
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
    // Chromium performs the actual redirect/cookie protocol. Avoid the
    // Playwright APIRequestContext Node HTTP adapter under Bun, whose cookie
    // parser received a relative response URL in CI despite absolute input.
    const enrollment = new URL(`${mount}/auth/local`, origin)
    enrollment.searchParams.set("code", await identity.enroll())
    signal.throwIfAborted()
    const enrolled = await page.goto(enrollment.href, { waitUntil: "domcontentloaded" })
    expect(enrolled?.status()).toBe(200)
    signal.throwIfAborted()
    const parameters = new URLSearchParams({ sf: "bi-options", viewId: "BI01", start: "2026-01-01", end: "2026-12-31" })
    const choicesUrl = new URL(`${mount}/dashboard`, origin)
    choicesUrl.search = parameters.toString()
    stage = "browser.choices"
    const choicesResponse: { status: number; body: { status: string; value?: SfBiOptions } } = await page.evaluate(async (url) => {
      const response = await fetch(url, { credentials: "same-origin", cache: "no-store" })
      return { status: response.status, body: await response.json() }
    }, choicesUrl.href)
    expect(choicesResponse.status).toBe(200)
    signal.throwIfAborted()
    const selectionRef = choicesResponse.body.value?.choices[0]?.selectionRef
    if (choicesResponse.body.status !== "ok" || !selectionRef) throw new Error("Real authorized BI selection unavailable")
    parameters.set("sf", "bi"); parameters.set("selectionRef", selectionRef)
    const destination = new URL(`${mount}/dashboard`, origin)
    destination.search = parameters.toString()
    stage = "browser.bi"
    const initial = await page.goto(destination.href)
    expect(initial?.status()).toBe(200)
    expect(initial?.headers()["x-sf-access-revision"]).toMatch(/^[a-f0-9]{64}$/)
    signal.throwIfAborted()
    await page.waitForFunction((ref) => (document.querySelector('select[aria-label="Dados para visualizar"]') as HTMLSelectElement)?.value === ref, selectionRef)
    const first = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data")
    await page.getByRole("button", { name: "Atualizar visualização", exact: true }).click()
    expect((await first).status()).toBe(200)
    await page.getByText("Dados atualizados.", { exact: true }).waitFor()
    expect(await page.locator("[data-sf-bi] table").count()).toBeGreaterThan(0)
    const workspace = await page.locator("[data-sf-bi][data-sf-retain-view]").elementHandle()
    if (!workspace) throw new Error("Real retained BI workspace unavailable")
    signal.throwIfAborted()
    const count = (mode: string) => observations.filter((entry) => entry.mode === mode).length
    return { page, context, origin, mount, workspace, observations, failures, aborted, holdNext, count, dispose }
  } catch (error) {
    console.error("SF_BI_LIFECYCLE_SETUP", JSON.stringify({ stage, cancelled: signal.aborted, error: error instanceof Error ? error.message : String(error) }))
    await dispose()
    throw error
  }
}

test("BI keeps the canonical shell, refreshes on manual focus and timer, and signs out once while discarding a held genuine success", async () => {
  const deadline = compositionTestDeadline("bi-lifecycle-controls")
  try {
    const world = await deadline.phase("browser.setup", () => prepareBiLifecycle(deadline))
    const { page } = world
    const refresh = async (action: () => Promise<unknown>, shell: boolean) => {
      const before = world.count("bi-data"), beforeShell = world.count("bi")
      const data = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data")
      const authority = shell ? page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi") : undefined
      await action()
      expect((await data).status()).toBe(200)
      if (authority) expect((await authority).status()).toBe(200)
      await page.getByText("Dados atualizados.", { exact: true }).waitFor()
      expect(world.count("bi-data")).toBeGreaterThan(before)
      if (shell) expect(world.count("bi")).toBeGreaterThan(beforeShell)
      expect(await world.workspace.evaluate((node) => node.isConnected)).toBe(true)
      expect(await page.locator("[data-sf-bi] table").count()).toBeGreaterThan(0)
    }
    await deadline.phase("manual-refresh", () => refresh(() => page.getByRole("button", { name: "Refresh data", exact: true }).click(), true))
    await deadline.phase("focus-refresh", () => refresh(() => page.evaluate(() => dispatchEvent(new Event("focus"))), false))
    await deadline.phase("periodic-refresh", () => refresh(() => page.clock.runFor(30_000), true))
    const success = world.holdNext("bi-data"), logout = world.holdNext("logout")
    await page.getByRole("button", { name: "Atualizar visualização", exact: true }).click()
    expect((await deadline.phase("hold-real-data", () => success.reached.promise)).status).toBe(200)
    const beforeLogout = world.count("logout")
    const navigation = page.waitForURL(`${world.origin}${world.mount}/auth/login`)
    await page.getByRole("button", { name: "Sign out", exact: true }).evaluate((button) => (button as HTMLButtonElement).click())
    expect((await deadline.phase("hold-real-logout", () => logout.reached.promise)).status).toBe(204)
    // The canonical POST is still waiting for its response. BI already
    // discarded private selections and aborted its previous data request.
    await page.waitForFunction(() => document.querySelector("[data-sf-bi] > [role=status]")?.textContent === "O acesso mudou. Abra novamente os dados autorizados.")
    expect(await page.locator("[data-sf-bi] table, [data-sf-bi] nav a").count()).toBe(0)
    expect(await page.getByLabel("Dados para visualizar", { exact: true }).inputValue()).toBe("")
    expect(await page.evaluate(() => history.state?.sfExtendedBi)).toBeUndefined()
    expect(world.count("logout") - beforeLogout).toBe(1)
    success.release.resolve(); await success.finished.promise
    expect(await page.locator("[data-sf-bi] table").count()).toBe(0)
    logout.release.resolve(); await navigation
    expect(world.aborted).toContain("bi-data")
    expect(await page.locator("[data-sf-bi]").count()).toBe(0)
    expect(world.count("logout") - beforeLogout).toBe(1)
    expect(world.failures).toEqual([])
  } finally { await deadline.close() }
}, 120_000)

test("the canonical shell still polls authority while BI awaits a held result and revocation prevents every late render", async () => {
  const deadline = compositionTestDeadline("bi-lifecycle-authority")
  try {
    const world = await deadline.phase("browser.setup", () => prepareBiLifecycle(deadline))
    const { page } = world
    // Keep the BI read's own 30s deadline after the shell's first interval.
    // The clock stays paused while real HTTP work completes.
    await page.clock.runFor(1000)
    const success = world.holdNext("bi-data")
    await page.getByRole("button", { name: "Atualizar visualização", exact: true }).click()
    expect((await deadline.phase("hold-real-data", () => success.reached.promise)).status).toBe(200)
    const beforeShell = world.count("bi")
    // Revoke the real encrypted operator session from a separate HTTP caller
    // with the observed cookie. The browser keeps its old cookie, so the
    // server's durable revocation, not a fabricated client event, denies it.
    const cookies = await world.context.cookies(world.origin)
    const revoked = await fetch(new URL(`${world.mount}/auth/logout`, world.origin).href, { method: "POST", signal: deadline.signal,
      headers: { origin: world.origin, cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ") }, redirect: "manual" })
    expect(revoked.status).toBe(204)
    expect(world.aborted).not.toContain("bi-data")
    await page.clock.runFor(29_000)
    await page.locator("[data-access-unavailable]").waitFor()
    expect(world.count("bi")).toBeGreaterThan(beforeShell)
    expect(world.observations.some((entry) => entry.mode === "bi" && entry.status === 403)).toBe(true)
    expect(await page.locator("[data-sf-bi]").count()).toBe(0)
    expect(await world.workspace.evaluate((node) => node.querySelectorAll("table, nav a, svg, canvas").length)).toBe(0)
    expect(await world.workspace.evaluate((node) => (node.querySelector('select[aria-label="Dados para visualizar"]') as HTMLSelectElement).value)).toBe("")
    success.release.resolve(); await success.finished.promise
    await page.clock.runFor(1)
    expect(await page.locator("[data-sf-bi], table, svg, canvas").count()).toBe(0)
    expect(world.aborted).toContain("bi-data")
    const after = world.observations.length
    await page.clock.runFor(60_000)
    expect(world.observations.length).toBe(after)
    expect(world.failures).toEqual([])
  } finally { await deadline.close() }
}, 120_000)

test("clearing the BI selection while genuine authorized options are delayed prevents restoration of the previous selection", async () => {
  const deadline = compositionTestDeadline("bi-lifecycle-selection")
  try {
    const world = await deadline.phase("browser.setup", () => prepareBiLifecycle(deadline))
    const { page } = world
    const options = world.holdNext("bi-options"), beforeData = world.count("bi-data")
    await page.getByRole("button", { name: "Refresh data", exact: true }).click()
    expect((await deadline.phase("hold-real-options", () => options.reached.promise)).status).toBe(200)
    const aborted = page.waitForEvent("requestfailed", (request) => new URL(request.url()).searchParams.get("sf") === "bi-options")
    await page.getByLabel("Dados para visualizar", { exact: true }).selectOption("")
    await aborted
    options.release.resolve(); await options.finished.promise
    await page.clock.runFor(1)
    expect(await page.getByLabel("Dados para visualizar", { exact: true }).inputValue()).toBe("")
    expect(await page.getByRole("button", { name: "Atualizar visualização", exact: true }).isDisabled()).toBe(true)
    expect(await page.locator("[data-sf-bi] table, [data-sf-bi] nav a").count()).toBe(0)
    expect(await page.locator("[data-sf-bi] > [role=status]").textContent()).toBe("Atualize a visualização para a seleção atual.")
    expect(world.count("bi-data")).toBe(beforeData)
    expect(await page.evaluate(() => history.state?.sfExtendedBi)).toMatchObject({ selection: "", ready: false })
    expect(await world.workspace.evaluate((node) => node.isConnected)).toBe(true)
    expect(world.failures).toEqual([])
  } finally { await deadline.close() }
}, 120_000)

test("BI returns from a real source with the same human filters, version pair, currency and mark focus after current reauthorization", async () => {
  const deadline = compositionTestDeadline("bi-return-context")
  try {
    const world = await deadline.phase("browser.setup", () => prepareBiLifecycle(deadline))
    const { page } = world
    await page.getByLabel("Visualização", { exact: true }).selectOption("BI02")
    await page.waitForFunction(() => [...(document.querySelector('select[aria-label="Versão base"]') as HTMLSelectElement).options].filter((item) => item.value).length === 2)
    await page.getByLabel("Fim", { exact: true }).fill("2026-03-31")
    await page.getByLabel("Fim", { exact: true }).dispatchEvent("change")
    await page.waitForFunction(() => [...(document.querySelector('select[aria-label="Versão base"]') as HTMLSelectElement).options].filter((item) => item.value).length === 2)
    await page.getByLabel("Dados para visualizar", { exact: true }).selectOption("planner")
    const versions = await page.getByLabel("Versão base", { exact: true }).locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean))
    await page.getByLabel("Versão base", { exact: true }).selectOption(versions[0]!)
    await page.getByLabel("Versão candidata", { exact: true }).selectOption(versions[1]!)
    await page.getByLabel("Moeda da comparação", { exact: true }).fill("USD")
    const data = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data")
    await page.getByRole("button", { name: "Atualizar visualização", exact: true }).click()
    expect((await data).status()).toBe(200)
    await page.getByText("Dados atualizados.", { exact: true }).waitFor()
    const marker = page.locator("[data-sf-bi] table button[data-bi-origin]").first()
    const valueId = await marker.getAttribute("data-bi-focus")
    expect(valueId).toBeTruthy()
    const source = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-source")
    await marker.click()
    expect((await source).status()).toBe(200)
    const saved = await page.evaluate(() => history.state.sfExtendedBi)
    expect(saved).toMatchObject({ viewId: "BI02", start: "2026-01-01", end: "2026-03-31", selection: "planner", baseline: versions[0], candidate: versions[1], currency: "USD", focus: valueId, ready: true })
    await page.getByRole("navigation", { name: "Origens autorizadas do valor", exact: true }).locator("a").first().click()
    await page.waitForURL((url) => url.pathname === `${world.mount}/planner`)
    expect(await page.locator("[data-sf-bi]").count()).toBe(0)
    const beforeReturn = world.count("bi-data")
    await page.goBack({ waitUntil: "domcontentloaded" })
    await page.getByText("Dados atualizados.", { exact: true }).waitFor()
    expect(world.count("bi-data")).toBeGreaterThan(beforeReturn)
    expect(await page.getByLabel("Visualização", { exact: true }).inputValue()).toBe("BI02")
    expect(await page.getByLabel("Fim", { exact: true }).inputValue()).toBe("2026-03-31")
    expect(await page.getByLabel("Dados para visualizar", { exact: true }).inputValue()).toBe("planner")
    expect(await page.getByLabel("Versão base", { exact: true }).inputValue()).toBe(versions[0]!)
    expect(await page.getByLabel("Versão candidata", { exact: true }).inputValue()).toBe(versions[1]!)
    expect(await page.getByLabel("Moeda da comparação", { exact: true }).inputValue()).toBe("USD")
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-bi-focus"))).toBe(valueId)
    expect(world.failures).toEqual([])
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
    expect(await missing!.json()).toMatchObject({ status: "needs-input", reason: "choose-explicit-bi-origin" })
    for (const reference of origins) {
      if (reference.kind !== "record" || reference.target.surface !== "planner") throw new Error("Unexpected real Planner origin")
      query.set("refDigest", reference.refDigest)
      const opened = await invoke(query)
      expect(opened?.status).toBe(200)
      const result: { links: { label: string; url: string }[] } = await opened!.json()
      expect(result.links.length).toBeGreaterThan(0)
      expect(result.links.every((link) => new URL(link.url, "https://example.test").searchParams.get("version") === reference.target.recordId)).toBe(true)
    }
    query.set("refDigest", "0".repeat(64))
    const outside = await invoke(query)
    expect(outside?.status).toBe(403)
    const denied = await outside!.json()
    expect(denied).toMatchObject({ status: "denied", reason: "bi-origin-outside-selected-value" })
    expect(denied).not.toHaveProperty("links")
    query.set("refDigest", "not-a-digest")
    expect((await invoke(query))?.status).toBe(400)
    query.set("refDigest", origins[0]!.refDigest); query.append("refDigest", origins[1]!.refDigest)
    expect((await invoke(query))?.status).toBe(400)
    query.delete("refDigest"); query.set("refDigest", origins[0]!.refDigest)
    fixture.active.value = false
    const revoked = await invoke(query)
    expect(revoked?.status).toBe(403)
    expect(await revoked!.json()).not.toHaveProperty("links")
  } finally { await deadline.close() }
}, 120_000)
