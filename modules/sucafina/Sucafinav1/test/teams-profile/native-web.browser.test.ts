import { expect, test } from "bun:test"
import { constants } from "node:fs"
import { lstat, open, realpath } from "node:fs/promises"
import type { BrowserContext, Page } from "@playwright/test"
import { Schema } from "effect"
import { SfTeamContextResult } from "@orchestra/schema/sucafina/context"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfDomainCommandCap25Create, SfDomainPageCap25 } from "@orchestra/schema/sucafina/procurement"
import { expectSpawn } from "../../../../../packages/core/test/fixture/omni-expect.ts"
import { launchBrowserDriver } from "../product/wp02/browser-driver-fixture.ts"
import { buildNativeTeamsWeb } from "./native-web-build.ts"
import { nativeProcurementWebFixture, nativeTeamWebFixture } from "./native-web-fixture.ts"
import { serveNativeTeamsWeb } from "./native-web-network.ts"
import { profileA, profileB, teamRow } from "./installation-fixture.ts"
import { authority, group, oid } from "../microsoft-login/oidc-fixture.ts"

const principalObjectId = Schema.decodeUnknownSync(TeamProfile.PrincipalObjectId)(oid)

test("native Web composition retains the live host identity through anonymous F02 admission", async () => {
  const f = await nativeTeamWebFixture()
  try {
    const response = await f.handle(new Request(f.contextRequest().url))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ status: "unauthenticated" })
    expect(response.headers.get("cache-control")).toBe("no-store")
  } finally { await f.close() }
})

test("native Teams fixture auto-binds exactly one eligible Team to the purchase projection", async () => {
  await using f = await nativeProcurementWebFixture([profileA])
  const response = await f.handle(f.contextRequest("selection"))
  expect(response.status).toBe(200)
  const context = Schema.decodeUnknownSync(SfTeamContextResult)(await response.json())
  expect(context.status).toBe("ok")
  if (context.status !== "ok") throw new Error("Single eligible Team context was not admitted")
  expect(context.value.profile.teams.status).toBe("ready")
  if (context.value.profile.teams.status !== "ready") throw new Error("Single eligible Team was not selected")
  expect(context.value.profile.teams.choices.map((choice) => choice.profile)).toEqual([profileA])
  expect(context.value.profile.teams.selected).toEqual(profileA)
  expect(context.value.stamp).toMatchObject({ installationId: f.technical.installationId,
    projectId: f.technical.projectId, hostId: f.technical.hostId, principalRef: oid })
  expect(context.value.stamp.team).toEqual({
    owner: { profile: profileA, principal: { tenantId: profileA.tenantId, principalObjectId } },
    revisions: { configRevision: context.value.profile.teams.configRevision,
      accessRevision: context.value.profile.accessRevision },
  })
  expectProcurementAdmission(context)

  const selector = JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileA })
  const page = await f.handle(f.request("/api/ui/pages/CAP25", f.cookie, { headers: { "x-sf-team-profile": selector } }))
  expect(page.status).toBe(200)
  const projection = Schema.decodeUnknownSync(SfDomainPageCap25.output)(await page.json())
  expect(projection.status).toBe("ok")
  if (projection.status !== "ok") throw new Error("Single-Team CAP25 projection was not admitted")
  expect(projection.context.team).toEqual(context.value.stamp.team)
  expect(projection.value.capabilityId).toBe("CAP25")
  expect(projection.value.allowedActionIds).toContain("create")
  expect(projection.value.data.requests).toEqual([])
  expect(projection.value.data.procurementQueueView).toBeDefined()
})

test("native Teams fixture requires a choice between eligible Teams and withholds business projection", async () => {
  await using f = await nativeProcurementWebFixture([profileA, profileB])
  const response = await f.handle(f.contextRequest("selection"))
  expect(response.status).toBe(200)
  const context = Schema.decodeUnknownSync(SfTeamContextResult)(await response.json())
  expect(context.status).toBe("ok")
  if (context.status !== "ok") throw new Error("Team choice context was not admitted")
  expect(context.value.profile.teams.status).toBe("selection-required")
  if (context.value.profile.teams.status !== "selection-required") throw new Error("Multiple eligible Teams did not require selection")
  expect(context.value.profile.teams.choices.map((choice) => choice.profile)).toEqual([profileA, profileB])
  expect(context.value.stamp.team).toBeUndefined()
  expect(context.value.destinations.some((destination) => destination.capabilityId === "CAP25")).toBe(false)
  // Technical context availability is permitted; no business operation may appear ready.
  expect(context.value.availability.flatMap((resource) => resource.family === "ctx" ? [] : resource.operations)
    .filter((operation) => operation.state === "ready")).toEqual([])

  const denied = await f.handle(f.request("/api/ui/pages/CAP25", f.cookie))
  expect(denied.status).toBe(403)
  const deniedBody: unknown = await denied.json()
  expect(deniedBody).not.toHaveProperty("value")
  expect(deniedBody).not.toHaveProperty("data")
})

test("native Teams fixture reports no eligible Team without business access", async () => {
  await using f = await nativeProcurementWebFixture([])
  const response = await f.handle(f.contextRequest("selection"))
  expect(response.status).toBe(200)
  const context = Schema.decodeUnknownSync(SfTeamContextResult)(await response.json())
  expect(context.status).toBe("ok")
  if (context.status !== "ok") throw new Error("No-Team context was not admitted")
  expect(context.value.profile.teams).toEqual({ status: "no-teams" })
  expect(context.value.stamp.team).toBeUndefined()
  expect(context.value.destinations.some((destination) => destination.capabilityId === "CAP25")).toBe(false)
  expect(context.value.availability.flatMap((resource) => resource.family === "ctx" ? [] : resource.operations)
    .filter((operation) => operation.state === "ready")).toEqual([])

  const denied = await f.handle(f.request("/api/ui/pages/CAP25", f.cookie))
  expect(denied.status).toBe(403)
  const deniedBody: unknown = await denied.json()
  expect(deniedBody).not.toHaveProperty("value")
  expect(deniedBody).not.toHaveProperty("data")
})

const installedChrome = "/opt/google/chrome/chrome"
const purchaseBoundaryTimeoutMs = 15000

async function preparePurchaseChromePages() {
  const maxBytes = 512 * 1024 * 1024, budgetMs = 20000
  const started = performance.now()
  const timedOut = new Error("Purchase warm-I/O preparation exceeded its 20s budget")
  const checkDeadline = () => { if (performance.now() - started >= budgetMs) throw timedOut }
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(timedOut), budgetMs) })
  const readExecutable = async () => {
    if (process.platform !== "linux" || await realpath(installedChrome) !== installedChrome)
      throw new Error("Purchase warm-I/O requires the exact installed Linux Chrome path")
    checkDeadline()
    const entry = await lstat(installedChrome)
    if (!entry.isFile() || !(entry.mode & 0o111) || entry.size <= 0 || entry.size > maxBytes)
      throw new Error("Purchase warm-I/O requires a regular executable within the byte budget")
    checkDeadline()
    const file = await open(installedChrome, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    try {
      checkDeadline()
      const stat = await file.stat()
      if (!stat.isFile() || !(stat.mode & 0o111) || stat.dev !== entry.dev || stat.ino !== entry.ino || stat.size !== entry.size)
        throw new Error("Installed Chrome changed before warm-I/O preparation")
      const buffer = Buffer.alloc(1024 * 1024)
      let bytes = 0
      while (bytes < stat.size) {
        checkDeadline()
        const { bytesRead } = await file.read(buffer, 0, Math.min(buffer.length, stat.size - bytes), bytes)
        if (!bytesRead) throw new Error("Installed Chrome ended before warm-I/O preparation completed")
        bytes += bytesRead
      }
      return bytes
    } finally { await file.close() }
  }
  try {
    // A timed-out kernel read may finish later; the loop issues no further reads or launch.
    const bytes = await Promise.race([deadline, readExecutable()])
    checkDeadline()
    return { bytes, maxBytes, budgetMs, elapsedMs: Math.round(performance.now() - started) }
  } finally { if (timer !== undefined) clearTimeout(timer) }
}

// Signed OIDC is synthetic; the production Web bundle, browser HTTP, queue and producer are real.
async function runPurchaseJourney(warmIO: boolean) {
  let phase = "browser-driver"
  let firstObservableUiBoundary: string | undefined
  let driver: Awaited<ReturnType<typeof launchBrowserDriver>> | undefined
  let built: Awaited<ReturnType<typeof buildNativeTeamsWeb>> | undefined
  let fixture: Awaited<ReturnType<typeof nativeProcurementWebFixture>> | undefined
  let network: Awaited<ReturnType<typeof serveNativeTeamsWeb>> | undefined
  let browser: BrowserContext | undefined
  let primaryError: unknown
  let hasPrimaryError = false
  let diagnosticPage: Page | undefined
  let contextReadCount = 0
  const contextReadStatuses: number[] = []
  let cap25GetRequestCount = 0
  let cap25GetResponseStatus: number | undefined
  let cap25ProducerReads = 0
  let cap25ProducerStatus: number | undefined
  let cap25ProducerError = false
  let cap25BrowserReadFailed = false
  let pageErrorCount = 0
  try {
    expectSpawn(import.meta.path)
    if (warmIO) {
      phase = "warm-io-read-installed-chrome"
      const prepared = await preparePurchaseChromePages()
      console.info("SF_TEAMS_PURCHASE_WARM_IO", JSON.stringify({ phase: "executable-read-complete", executable: installedChrome, ...prepared }))
    }
    phase = warmIO ? "warm-io-browser-driver" : "browser-driver"
    driver = await launchBrowserDriver("teams-web-transport")
    if (warmIO) {
      phase = "warm-io-verify-launched-chrome"
      const launch = driver.launchObservation
      expect(launch.executable).toBe(installedChrome)
      if (typeof launch.getVersionReplyMs !== "number" || !Number.isFinite(launch.getVersionReplyMs) || launch.getVersionReplyMs < 0 ||
        typeof launch.browserProduct !== "string") throw new Error("Purchase warm-I/O launch did not observe Chrome's CDP version reply")
      console.info("SF_TEAMS_PURCHASE_WARM_IO", JSON.stringify({ phase: "same-launch-executable-and-cdp-verified", ...launch }))
    }
    phase = "production-web-build"
    const assets = built = await buildNativeTeamsWeb()
    phase = "fixture-installation"
    const f = fixture = await nativeProcurementWebFixture()
    const writes: { status: number; cookie: boolean; basic: boolean; selector: string | null }[] = []
    const target = (operation: typeof SfDomainPageCap25.operationId | typeof SfDomainCommandCap25Create.operationId) =>
      SfOperationRegistry[operation].pathTemplate.replace("{mount}", f.binding.mount)
    network = await serveNativeTeamsWeb({
      origin: fixture.binding.origin,
      authorize: async (address) => {
        const login = new URL(address)
        const callback = new URL(login.searchParams.get("redirect_uri")!)
        callback.searchParams.set("code", await f.provider.issueCode(login.href, oid))
        callback.searchParams.set("state", login.searchParams.get("state")!)
        return new Response(null, { status: 303, headers: { Location: callback.href, "Cache-Control": "no-store" } })
      },
      handle: async (request) => {
        const { pathname } = new URL(request.url)
        if (!pathname.startsWith(f.binding.mount + "/") && !pathname.startsWith("/api/"))
          return await assets.asset(request) ?? new Response(null, { status: 404 })
        const queueRead = pathname === target(SfDomainPageCap25.operationId) && request.method === "GET"
        if (queueRead) cap25ProducerReads = Math.min(cap25ProducerReads + 1, 10)
        const response = await f.handle(request).catch((error: unknown) => {
          if (queueRead) cap25ProducerError = true
          throw error
        })
        if (queueRead) cap25ProducerStatus = response.status
        if (pathname === target(SfDomainCommandCap25Create.operationId) && request.method === "POST") {
          writes.push({ status: response.status, cookie: request.headers.has("cookie"),
            basic: request.headers.has("authorization"), selector: request.headers.get("x-sf-team-profile") })
        }
        return response
      },
    })
    phase = "browser-context"
    browser = await driver.browser.newContext({ proxy: { server: network.proxy }, ignoreHTTPSErrors: true,
      serviceWorkers: "block", locale: "en-US", viewport: { width: 1360, height: 900 } })
    const page = await browser.newPage()
    diagnosticPage = page
    page.setDefaultTimeout(purchaseBoundaryTimeoutMs)
    page.on("request", (request) => {
      const url = new URL(request.url())
      if (url.pathname === `${f.binding.mount}/api/ui/context`) {
        contextReadCount = Math.min(contextReadCount + 1, 10)
        return
      }
      if (url.pathname === target(SfDomainPageCap25.operationId) && request.method() === "GET")
        cap25GetRequestCount = Math.min(cap25GetRequestCount + 1, 10)
    })
    page.on("response", (response) => {
      const url = new URL(response.url())
      if (url.pathname === `${f.binding.mount}/api/ui/context` && contextReadStatuses.length < 5)
        contextReadStatuses.push(response.status())
      if (url.pathname === target(SfDomainPageCap25.operationId) && response.request().method() === "GET" &&
          cap25GetResponseStatus === undefined) cap25GetResponseStatus = response.status()
    })
    page.on("pageerror", () => { pageErrorCount = Math.min(pageErrorCount + 1, 10) })
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).pathname === target(SfDomainPageCap25.operationId) && request.method() === "GET")
        cap25BrowserReadFailed = true
    })
    phase = "anonymous-shell"
    await page.goto(fixture.binding.origin + "/")
    await page.locator("[data-sf-teams-shell][data-sf-teams-state='unauthenticated']").waitFor({ state: "visible" })
    firstObservableUiBoundary = "unauthenticated-teams-shell"
    phase = "synthetic-login"
    await page.locator("[data-sf-microsoft-login]").click()
    await page.waitForFunction(() => document.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-teams-state") === "authenticated")
    phase = "single-team-selection"
    await page.waitForFunction((team) => document.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-team-selected") === team, profileA.teamObjectId)
    expect(await page.locator(".sf-team-picker-wide [data-sf-team-picker]").inputValue()).toBe(profileA.teamObjectId)
    const owner = new URLSearchParams({ contractRevision: "sf-team-profile/1", server: fixture.binding.origin,
      installationId: fixture.binding.installationId, tenantId: fixture.binding.tenantId, teamObjectId: profileA.teamObjectId })
    const admitted = captureResponse(page.waitForResponse((response) => {
      const url = new URL(response.url())
      return url.pathname === `${f.binding.mount}/api/ui/context` && url.searchParams.get("kind") === "team"
    }))
    const queueRead = captureResponse(page.waitForResponse((response) =>
      new URL(response.url()).pathname === target(SfDomainPageCap25.operationId) && response.request().method() === "GET",
    { timeout: purchaseBoundaryTimeoutMs }))
    phase = "team-bound-navigation"
    await page.goto(`${fixture.binding.origin}/orchestra/sf-procurement/requests/new?${owner}`)
    phase = "purchase-admission-response"
    const admissionResult = await admitted
    if ("error" in admissionResult) throw admissionResult.error
    const context = admissionResult.value
    expect(context.status()).toBe(200)
    const admission = Schema.decodeUnknownSync(SfTeamContextResult)(await context.json())
    expect(admission.status).toBe("ok")
    if (admission.status !== "ok") throw new Error("Selected Team was not admitted")
    expect(admission.value.profile.teams.status).toBe("ready")
    if (admission.value.profile.teams.status !== "ready") throw new Error("Single eligible Team was not selected")
    expect(admission.value.profile.teams.choices.map((choice) => choice.profile)).toEqual([profileA])
    expect(admission.value.profile.teams.selected).toEqual(profileA)
    expect(admission.value.stamp.team).toEqual({
      owner: { profile: profileA, principal: { tenantId: profileA.tenantId, principalObjectId } },
      revisions: { configRevision: admission.value.profile.teams.configRevision,
        accessRevision: admission.value.profile.accessRevision },
    })
    expectProcurementAdmission(admission)
    phase = "purchase-requests-page-render"
    const requestsPage = page.locator('section[data-component="sf-requests-pr-po"]')
    await requestsPage.waitFor({ state: "visible", timeout: purchaseBoundaryTimeoutMs })
    expect(await requestsPage.count()).toBe(1)
    firstObservableUiBoundary ??= "requests-pr-po-section"
    phase = "purchase-CAP25-queue-response"
    const queueResult = await queueRead
    if ("error" in queueResult) throw queueResult.error
    const queue = queueResult.value
    expect(queue.status()).toBe(200)
    const initialProjection = Schema.decodeUnknownSync(SfDomainPageCap25.output)(await queue.json())
    expect(initialProjection.status).toBe("ok")
    if (initialProjection.status !== "ok") throw new Error("Authorized purchase queue projection was not admitted")
    expect(initialProjection.context.team).toEqual(admission.value.stamp.team)
    expect(initialProjection.value.capabilityId).toBe("CAP25")
    expect(initialProjection.value.data.requests).toEqual([])
    expect(initialProjection.value.data.procurementQueueView).toBeDefined()
    phase = "purchase-queue-UI-boundary"
    const heading = page.getByRole("heading", { name: "Requests", exact: true })
    await heading.waitFor({ state: "visible" })
    firstObservableUiBoundary ??= "requests-heading"
    expect(await heading.count()).toBe(1)
    const formSelector = "article.sf-u11-detail form[data-command='create'][data-page='Requests']"
    const form = page.locator(formSelector)
    await form.waitFor({ state: "visible" })
    expect(await form.count()).toBe(1)
    const title = warmIO ? "Warm-I/O synthetic browser purchase request" : "Cold synthetic browser purchase request"
    await form.locator('[name="pr.title"]').fill(title)
    phase = "purchase-review-dialog"
    await form.getByRole("button", { name: "Create request", exact: true }).click()
    expect(writes).toHaveLength(0)
    const review = page.locator('[data-component="sf-change-review"]')
    await review.waitFor({ state: "visible" })
    expect(await review.count()).toBe(1)
    const reviewHeading = review.getByRole("heading", { name: "Review changes", exact: true })
    await reviewHeading.waitFor({ state: "visible" })
    expect(await reviewHeading.count()).toBe(1)
    phase = "purchase-review-confirmation"
    const committed = captureResponse(page.waitForResponse((response) =>
      new URL(response.url()).pathname === target(SfDomainCommandCap25Create.operationId) && response.request().method() === "POST"))
    phase = "purchase-confirm-dispatch"
    await review.getByRole("button", { name: "Confirm action", exact: true }).click()
    phase = "purchase-producer-response"
    const commandResult = await committed
    if ("error" in commandResult) throw commandResult.error
    const command = commandResult.value
    expect(command.status()).toBe(200)
    expect(Schema.decodeUnknownSync(SfDomainCommandCap25Create.output)(await command.json())).toMatchObject({ ok: true })
    expect(command.request().postDataJSON()).toMatchObject({
      action: "create", page: "Requests", version: 0, values: { pr: { title } },
    })
    expect(writes).toEqual([{ status: 200, cookie: true, basic: false,
      selector: JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileA }) }])

    phase = "purchase-projection-readback"
    const listed = captureResponse(page.waitForResponse((response) =>
      new URL(response.url()).pathname === target(SfDomainPageCap25.operationId) && response.request().method() === "GET"))
    await page.goto(`${fixture.binding.origin}/orchestra/sf-procurement/requests?${owner}`)
    const listedResult = await listed
    if ("error" in listedResult) throw listedResult.error
    const projection = listedResult.value
    expect(projection.status()).toBe(200)
    const readback = Schema.decodeUnknownSync(SfDomainPageCap25.output)(await projection.json())
    expect(readback.status).toBe("ok")
    if (readback.status !== "ok") throw new Error("Purchase queue readback was not admitted")
    expect(readback.context.team).toEqual(admission.value.stamp.team)
    expect(readback.value.data.requests).toHaveLength(1)
    expect(readback.value.data.requests[0]).toMatchObject({ createdBy: oid, pr: { title } })
    await page.getByRole("cell", { name: title, exact: true }).waitFor()
    expect(writes).toHaveLength(1)
  } catch (error) {
    hasPrimaryError = true
    primaryError = error
    const ui = await readPurchaseUiDiagnostic(diagnosticPage).catch(() => undefined)
    console.info("SF_TEAMS_NATIVE_WEB_PURCHASE_FAILURE " + JSON.stringify({
      firstFailedPhase: phase,
      firstObservableUiBoundary: firstObservableUiBoundary ?? "not-observed",
      errorName: error instanceof Error ? error.name : "unknown",
      shellAlertVisible: ui?.shellAlertVisible ?? "unavailable",
      requestsPageRendered: ui?.requestsPageRendered ?? false,
      cap25GetObserved: cap25GetRequestCount > 0,
      cap25GetRequestCount,
      cap25GetResponseStatus: cap25GetResponseStatus ?? "no-response",
      cap25ProducerReads,
      cap25ProducerStatus: cap25ProducerStatus ?? "no-response",
      cap25ProducerError,
      cap25BrowserReadFailed,
      contextReadCount,
      contextReadStatuses,
      pageErrorCount,
    }))
  }
  const cleanupErrors: unknown[] = []
  for (const close of [() => browser?.close(), () => network?.close(), () => fixture?.close(),
    () => built?.close(), () => driver?.close()]) {
    try { await close() } catch (error) { cleanupErrors.push(error) }
  }
  if (hasPrimaryError) throw primaryError
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "Purchase browser journey cleanup failed")
}

function captureResponse<T>(promise: Promise<T>) {
  return promise.then((value) => ({ value }), (error: unknown) => ({ error }))
}

async function readPurchaseUiDiagnostic(page: Page | undefined) {
  if (!page || page.isClosed()) return undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      page.evaluate(() => ({
        shellAlertVisible: !!document.querySelector(".sf-team-main > [role='alert']"),
        requestsPageRendered: !!document.querySelector('section[data-component="sf-requests-pr-po"]'),
      })).catch(() => undefined),
      new Promise<undefined>((resolve) => { timer = setTimeout(() => resolve(undefined), 250) }),
    ])
  } finally { if (timer !== undefined) clearTimeout(timer) }
}

function expectProcurementAdmission(context: unknown) {
  expect(context).toMatchObject({ status: "ok", value: {
    destinations: expect.arrayContaining([expect.objectContaining({ capabilityId: "CAP25", canRead: true,
      allowedActionIds: expect.arrayContaining(["create"]) })]),
    availability: expect.arrayContaining([expect.objectContaining({ family: "procurement", resource: "CAP25", operations: expect.arrayContaining([
      expect.objectContaining({ operationId: SfDomainPageCap25.operationId, state: "ready", operational: true }),
      expect.objectContaining({ operationId: SfDomainCommandCap25Create.operationId, state: "ready", operational: true }),
    ]) })]),
  } })
}

// Focused G02 production Web composition, outside the fixed 40-source G04 pool.
// The OAuth provider is synthetic; challenge/PKCE/JWKS/session/SQLite/HTTP/UI are real.
test("native SF Web admits Microsoft Teams, isolates windows, fences drafts and administers without a Team", async () => {
  expectSpawn(import.meta.path)
  let built: Awaited<ReturnType<typeof buildNativeTeamsWeb>> | undefined
  let f: Awaited<ReturnType<typeof nativeTeamWebFixture>> | undefined
  let admin: Awaited<ReturnType<typeof nativeTeamWebFixture>> | undefined
  let driver: Awaited<ReturnType<typeof launchBrowserDriver>> | undefined
  const networks: Awaited<ReturnType<typeof serveNativeTeamsWeb>>[] = []
  const contexts: BrowserContext[] = [], errors: string[] = [], runtimeErrors: string[] = []
  const contextReplies: { status: string; teams?: string; bound: boolean }[] = []
  const observed: { fixture: "business" | "admin"; path: string; method: string; cookie: boolean; basic: boolean; selector: string | null; status: number }[] = []
  const startedAt = performance.now()
  const httpPhases: { fixture: "business" | "admin"; route: string; method: string; startedMs: number; elapsedMs?: number; status?: number }[] = []
  let passed = false, phase = "build", holdLogout = false, loseConfigurationResponse = false
  let firstObservableUiBoundary: string | undefined
  const logoutEntered = Promise.withResolvers<void>(), logoutRelease = Promise.withResolvers<void>(), logoutHandled = Promise.withResolvers<void>()
  try {
    phase = "browser-start"
    driver = await launchBrowserDriver("teams-web-transport")
    phase = "build"
    built = await buildNativeTeamsWeb()
    f = await nativeTeamWebFixture({ enabled: [profileA, profileB], direct: [profileA, profileB],
      sessionActions: ["read", "create", "prompt", "run", "control"] })
    await f.seedPlannerVersion()
    admin = await nativeTeamWebFixture({ roles: false, grants: [], enabled: [], direct: [] })
    admin.provider.teamResources.set(profileA.teamObjectId, teamRow())
    admin.provider.hooks.before = (request) => new URL(request.url).pathname === "/v1.0/me/joinedTeams"
      ? Response.json({ error: { code: "ServiceUnavailable" } }, { status: 503 }) : undefined
    const open = async (fixture: NonNullable<typeof f>, name: "business" | "admin") => {
      const network = await serveNativeTeamsWeb({
        origin: fixture.binding.origin,
        authorize: async (address) => {
          const url = new URL(address), code = await fixture.provider.issueCode(url.href, oid)
          const callback = new URL(url.searchParams.get("redirect_uri")!)
          callback.searchParams.set("code", code)
          callback.searchParams.set("state", url.searchParams.get("state")!)
          return new Response(null, { status: 303, headers: { Location: callback.href, "Cache-Control": "no-store" } })
        },
        handle: async (request) => {
          const url = new URL(request.url)
          if (name === "business" && holdLogout && url.pathname === fixture.binding.mount + "/auth/logout") {
            logoutEntered.resolve(); await logoutRelease.promise
          }
          const start = performance.now()
          const relativePath = url.pathname.slice(fixture.binding.mount.length)
          const measured = /^\/api\/(?:session(?:\/|$)|event$)/.test(relativePath)
            ? { fixture: name, route: relativePath === "/api/session" ? "session-collection" :
              relativePath === "/api/event" ? "event-stream" : "session-resource",
              method: request.method, startedMs: Math.round(start - startedAt) } : undefined
          if (measured) httpPhases.push(measured)
          // The actual TLS Request is passed unchanged to the installed handlers.
          const response = url.pathname.startsWith(fixture.binding.mount + "/") || url.pathname.startsWith("/api/")
            ? await fixture.handle(request) : await built!.asset(request) ?? new Response(null, { status: 404 })
          if (measured) {
            Object.assign(measured, { elapsedMs: Math.round(performance.now() - start), status: response.status })
            console.info("SF_TEAMS_NATIVE_HTTP_PHASE " + JSON.stringify(measured))
          }
          if (url.pathname.endsWith("/api/ui/context")) {
            const decoded: unknown = await response.clone().json()
            if (decoded && typeof decoded === "object" && "status" in decoded && typeof decoded.status === "string") {
              const value = "value" in decoded && decoded.value && typeof decoded.value === "object" ? decoded.value : undefined
              const profile = value && "profile" in value && value.profile && typeof value.profile === "object" ? value.profile : undefined
              const teams = profile && "teams" in profile && profile.teams && typeof profile.teams === "object" ? profile.teams : undefined
              const stamp = value && "stamp" in value && value.stamp && typeof value.stamp === "object" ? value.stamp : undefined
              contextReplies.push({ status: decoded.status,
                teams: teams && "status" in teams && typeof teams.status === "string" ? teams.status : undefined,
                bound: !!stamp && "team" in stamp })
            }
          }
          let delivered = response
          if (name === "admin" && loseConfigurationResponse && request.method === "POST" &&
              url.pathname === fixture.binding.mount + "/api/ui/team-profiles/configuration" && response.status === 200) {
            // The real command already committed. Lose only its HTTP reply so
            // the native UI must reconcile a retained reference without retry.
            loseConfigurationResponse = false
            void response.body?.cancel().catch(() => {})
            delivered = new Response("Synthetic lost response after commit", { status: 502, headers: { "Cache-Control": "no-store" } })
          }
          observed.push({ fixture: name, path: url.pathname, method: request.method,
            cookie: request.headers.has("cookie"), basic: request.headers.has("authorization"),
            selector: request.headers.get("x-sf-team-profile"), status: delivered.status })
          if (name === "business" && url.pathname === fixture.binding.mount + "/auth/logout") logoutHandled.resolve()
          return delivered
        },
      })
      networks.push(network)
      // The only trusted TLS exception is this known synthetic certificate.
      // The proxy itself rejects every host except the two exact fixture hosts.
      const browser = await driver!.browser.newContext({ proxy: { server: network.proxy },
        ignoreHTTPSErrors: true, serviceWorkers: "block", locale: "en-US", viewport: { width: 1360, height: 900 } })
      browser.setDefaultTimeout(7000)
      contexts.push(browser)
      browser.on("page", (page) => {
        page.on("pageerror", (error) => errors.push(error.message))
        page.on("console", (message) => {
          if (message.type() === "error" && /^(Teams |Microsoft sign-out)/.test(message.text()))
            runtimeErrors.push(message.text())
        })
      })
      const page = await browser.newPage()
      await page.goto(fixture.binding.origin + "/", { waitUntil: "domcontentloaded" })
      return { browser, page }
    }
    const waitState = async (page: Page, state: string) => {
      await page.waitForFunction((expected) =>
        document.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-teams-state") === expected, state)
      firstObservableUiBoundary ??= "teams-shell-" + state
    }
    const waitTeam = (page: Page, id: string) => page.waitForFunction((expected) => {
      const picker = document.querySelector<HTMLSelectElement>(".sf-team-picker-wide [data-sf-team-picker]")
      // The admitted context publishes before the guarded history commit. Wait
      // for the whole user action to settle, then assert the URL separately.
      return document.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-team-selected") === expected &&
        !!picker && !picker.disabled
    }, id)
    const picker = (page: Page) => page.locator(".sf-team-picker-wide [data-sf-team-picker]")
    const signIn = async (page: Page, fixture: NonNullable<typeof f>) => {
      await waitState(page, "unauthenticated")
      const link = page.locator("[data-sf-microsoft-login]")
      const login = fixture.binding.origin + fixture.binding.mount + "/auth/login?returnTo=%2F"
      expect(await link.getAttribute("href")).toBe(login)
      expect(await link.getAttribute("target")).toBe("_self")
      const start = page.waitForResponse((response) => response.url() === login && response.request().isNavigationRequest())
      const issued = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.origin + url.pathname === authority + "/oauth2/v2.0/authorize" && response.request().isNavigationRequest()
      })
      const completed = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.origin + url.pathname === fixture.binding.origin + fixture.binding.mount + "/auth/callback" &&
          response.request().isNavigationRequest()
      })
      // Chromium follows the unchanged signed redirect chain and stores the
      // Secure HttpOnly mount cookie itself. No route, cookie or token injection.
      const [begin, authorization, callback] = await Promise.all([start, issued, completed, link.click()])
      expect(begin.status()).toBe(303)
      expect(authorization.status()).toBe(303)
      expect(callback.status()).toBe(303)
      const authorize = new URL(begin.headers()["location"]!)
      expect(authorize.origin + authorize.pathname).toBe(authority + "/oauth2/v2.0/authorize")
      const returned = new URL(authorization.headers()["location"]!)
      expect(returned.origin + returned.pathname).toBe(fixture.binding.origin + fixture.binding.mount + "/auth/callback")
      expect(new URL(callback.headers()["location"]!, callback.url()).href).toBe(fixture.binding.origin + "/")
      await waitState(page, "authenticated")
      expect(new URL(page.url()).pathname).toBe("/")
    }

    phase = "business-bootstrap"
    const human = await open(f, "business")
    await waitState(human.page, "unauthenticated")
    expect(observed.some((call) => call.path === "/api/sucafina/installations" && call.status === 200 && !call.basic)).toBe(true)
    expect(f.metadataCalls.locations).toBe(0)
    phase = "microsoft-login"
    await signIn(human.page, f)
    const session = (await human.browser.cookies()).find((cookie) => cookie.name.includes("_session"))
    expect(session).toMatchObject({ httpOnly: true, secure: true, path: f.binding.mount, sameSite: "Lax" })
    expect(await human.page.evaluate(() => document.cookie)).not.toContain("_session")
    expect(await picker(human.page).inputValue()).toBe("")
    expect(await picker(human.page).locator("option").allTextContents()).toEqual([
      "Select a Team",
      "Synthetic shared Team · " + profileA.teamObjectId,
      "Synthetic shared Team · " + profileB.teamObjectId,
    ])
    phase = "selection-and-history"
    await picker(human.page).selectOption(profileA.teamObjectId)
    await waitTeam(human.page, profileA.teamObjectId)
    await picker(human.page).selectOption(profileB.teamObjectId)
    await waitTeam(human.page, profileB.teamObjectId)
    await human.page.goBack()
    await waitTeam(human.page, profileA.teamObjectId)
    await human.page.waitForURL((url) => url.searchParams.get("teamObjectId") === profileA.teamObjectId)
    expect(new URL(human.page.url()).searchParams.get("teamObjectId")).toBe(profileA.teamObjectId)

    phase = "narrow-and-keyboard"
    await human.page.setViewportSize({ width: 390, height: 844 })
    await human.page.keyboard.press("Control+Shift+P")
    const narrowPicker = human.page.locator(".sf-team-mobile [data-sf-team-picker]")
    await narrowPicker.waitFor({ state: "visible" })
    expect(await narrowPicker.inputValue()).toBe(profileA.teamObjectId)
    expect(await narrowPicker.evaluate((element) => document.activeElement === element)).toBe(true)
    await narrowPicker.selectOption(profileB.teamObjectId)
    await waitTeam(human.page, profileB.teamObjectId)
    await narrowPicker.selectOption(profileA.teamObjectId)
    await waitTeam(human.page, profileA.teamObjectId)
    expect(await human.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await human.page.locator(".sf-team-menu-toggle").click()
    await human.page.setViewportSize({ width: 1360, height: 900 })
    await human.page.keyboard.press("Control+Shift+P")
    expect(await picker(human.page).evaluate((element) => document.activeElement === element)).toBe(true)

    phase = "two-independent-windows"
    // A duplicated document initially copies sessionStorage. Web Locks force a
    // distinct actual window identity; the copied Team hint does not select it.
    const popupPromise = human.browser.waitForEvent("page")
    await human.page.evaluate(() => { window.open("/", "_blank") })
    const second = await popupPromise
    await waitState(second, "authenticated")
    expect(await picker(second).inputValue()).toBe("")
    const firstWindow = await human.page.evaluate(() => sessionStorage.getItem("orchestra.team.window.v1"))
    const secondWindow = await second.evaluate(() => sessionStorage.getItem("orchestra.team.window.v1"))
    expect(firstWindow).toMatch(/^[0-9a-f-]{36}$/)
    expect(secondWindow).toMatch(/^[0-9a-f-]{36}$/)
    expect(secondWindow).not.toBe(firstWindow)
    await picker(second).selectOption(profileB.teamObjectId)
    await waitTeam(second, profileB.teamObjectId)
    expect(await picker(human.page).inputValue()).toBe(profileA.teamObjectId)

    phase = "native-session-creation"
    const chat = (page: Page) => page.locator('[data-sf-session-workspace][data-sf-session-state="ready"]')
    const editor = (page: Page) => chat(page).locator('[data-slot="prompt-input-v2-editor"] [contenteditable="true"]')
    const send = (page: Page) => chat(page).locator('[data-action="prompt-submit"]')
    const openChat = async (page: Page) => {
      await page.locator(".sf-team-sidebar [data-sf-open-chat]").click()
      await chat(page).waitFor({ state: "visible" })
      await page.waitForFunction(() => document.querySelector("[data-sf-session-workspace]")?.getAttribute("data-sf-session-stream") === "open")
    }
    const submit = async (page: Page, text: string) => {
      await editor(page).fill(text)
      await send(page).click()
      await chat(page).locator("[data-sf-prompt-admitted]").filter({ hasText: text }).waitFor({ state: "visible" })
      const id = new URL(page.url()).pathname.split("/").at(-1)!
      expect(id).toMatch(/^ses_[A-Za-z0-9_-]+$/)
      return id
    }
    await openChat(human.page)
    expect(await chat(human.page).locator("[data-sf-session-id]").count()).toBe(0)
    const createdA = await submit(human.page, "Recorded prompt for Team A")
    expect(observed.some((call) => call.path === f!.binding.mount + "/api/session" && call.method === "POST" &&
      call.cookie && !call.basic && call.selector === JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileA }))).toBe(true)
    expect(observed.some((call) => call.path === f!.binding.mount + "/api/event" && call.status === 200 && call.cookie && !call.basic)).toBe(true)
    expect(await chat(human.page).locator("[data-sf-session-id]").getAttribute("data-sf-session-id")).toBe(createdA)

    phase = "native-session-owner-isolation"
    await openChat(second)
    expect(await chat(second).locator("[data-sf-session-id]").count()).toBe(0)
    const createdB = await submit(second, "Recorded prompt for Team B")
    expect(createdB).not.toBe(createdA)
    expect(await chat(second).locator('[data-sf-session-id="' + createdA + '"]').count()).toBe(0)
    expect(await chat(human.page).locator('[data-sf-session-id="' + createdB + '"]').count()).toBe(0)

    phase = "native-session-incremental-stream"
    await editor(human.page).fill("Private chat draft in A")
    await picker(second).selectOption(profileA.teamObjectId)
    await waitTeam(second, profileA.teamObjectId)
    await openChat(second)
    await chat(second).locator('[data-sf-session-id="' + createdA + '"]').waitFor({ state: "visible" })
    const streamReads = observed.filter((call) => call.path === f!.binding.mount + "/api/event").length
    const peerA = await submit(second, "A new session from the other window")
    // The first document stays in the background. This title appears through
    // its already-open, namespace-checked SSE; no focus or refresh is requested.
    await chat(human.page).locator('[data-sf-session-id="' + peerA + '"]').waitFor({ state: "visible" })
    expect(observed.filter((call) => call.path === f!.binding.mount + "/api/event")).toHaveLength(streamReads)
    expect(await editor(human.page).textContent()).toBe("Private chat draft in A")
    expect(await chat(human.page).locator('[data-sf-session-id="' + createdB + '"]').count()).toBe(0)

    phase = "native-session-close-and-restore"
    await human.page.bringToFront()
    await waitTeam(human.page, profileA.teamObjectId)
    await chat(human.page).waitFor({ state: "visible" })
    expect(await editor(human.page).textContent()).toBe("Private chat draft in A")
    await chat(human.page).locator(".sf-team-session-tab[data-active]").getByRole("button", { name: "Close tab", exact: true }).click()
    await human.page.getByRole("button", { name: "Cancel", exact: true }).click()
    expect(await editor(human.page).textContent()).toBe("Private chat draft in A")
    await chat(human.page).locator(".sf-team-session-tab[data-active]").getByRole("button", { name: "Close tab", exact: true }).click()
    await human.page.locator("[data-sf-confirm-discard]").click()
    await chat(human.page).locator('[data-sf-session-reopen="' + createdA + '"]').waitFor({ state: "visible" })
    expect(await editor(human.page).textContent()).toBe("")
    await chat(human.page).locator('[data-sf-session-reopen="' + createdA + '"]').click()
    await chat(human.page).locator("[data-sf-prompt-admitted]").filter({ hasText: "Recorded prompt for Team A" }).waitFor({ state: "visible" })
    const storedChat = await human.page.evaluate(() => Object.values(sessionStorage).join("\n"))
    expect(storedChat).not.toMatch(/Private chat draft in A|Recorded prompt for Team A|Recorded prompt for Team B/)
    await human.page.reload({ waitUntil: "domcontentloaded" })
    await chat(human.page).waitFor({ state: "visible" })
    await chat(human.page).locator("[data-sf-prompt-admitted]").filter({ hasText: "Recorded prompt for Team A" }).waitFor({ state: "visible" })
    expect(new URL(human.page.url()).pathname.split("/").at(-1)).toBe(createdA)
    expect(await editor(human.page).textContent()).toBe("")
    expect(f.sessionCalls.wakes).toBe(3)
    expect(f.sessionCalls.resumes).toBe(0)
    expect(f.business.all("SELECT session_id FROM session_input")).toHaveLength(3)

    phase = "native-planner-draft"
    const owner = new URLSearchParams({ contractRevision: "sf-team-profile/1", server: f.binding.origin,
      installationId: f.binding.installationId, tenantId: f.binding.tenantId, teamObjectId: profileA.teamObjectId })
    const versionPath = "/orchestra/sf-planner/versions/r_" + Buffer.from("version-native").toString("base64url") + "?" + owner + "&year=2026"
    await human.page.goto(f.binding.origin + versionPath, { waitUntil: "domcontentloaded" })
    const name = human.page.locator("#sf-u46-name")
    await name.waitFor({ state: "visible" })
    expect(await name.inputValue()).toBe("Original version")
    expect(observed.some((call) => call.path.endsWith("/api/ui/pages/CAP23") && call.status === 200 &&
      call.cookie && call.selector === JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileA }))).toBe(true)
    await name.fill("Private unsaved Team A")
    await picker(human.page).selectOption(profileB.teamObjectId)
    await human.page.locator("dialog.sf-team-dialog[open]").waitFor({ state: "visible" })
    await human.page.getByRole("button", { name: "Cancel", exact: true }).click()
    expect(await name.inputValue()).toBe("Private unsaved Team A")
    expect(await picker(human.page).inputValue()).toBe(profileA.teamObjectId)

    await picker(human.page).selectOption(profileB.teamObjectId)
    await human.page.locator("[data-sf-confirm-discard]").click()
    await waitTeam(human.page, profileB.teamObjectId)
    expect(await human.page.locator("#sf-u46-name").count()).toBe(0)
    expect(await human.page.locator("body").textContent()).not.toContain("Private unsaved Team A")

    await human.page.goto(f.binding.origin + versionPath, { waitUntil: "domcontentloaded" })
    await human.page.locator("#sf-u46-name").fill("Revoked unsaved Team A")
    await picker(human.page).selectOption(profileB.teamObjectId)
    await human.page.locator("dialog.sf-team-dialog[open]").waitFor({ state: "visible" })
    phase = "logout-before-server-confirmation"
    holdLogout = true
    const contextReads = observed.filter((call) => call.fixture === "business" && call.path.endsWith("/api/ui/context")).length
    await second.locator("[data-sf-sign-out]").click()
    await logoutEntered.promise
    await waitState(human.page, "unauthenticated")
    await waitState(second, "unauthenticated")
    await human.page.bringToFront()
    await waitState(human.page, "unauthenticated")
    expect(observed.filter((call) => call.fixture === "business" && call.path.endsWith("/api/ui/context"))).toHaveLength(contextReads)
    logoutRelease.resolve()
    await logoutHandled.promise
    expect(await human.page.locator("dialog[open]").count()).toBe(0)
    expect(await human.page.locator("#sf-u46-name").count()).toBe(0)
    expect(await human.page.locator("body").textContent()).not.toContain("Revoked unsaved Team A")
    const logout = observed.filter((call) => call.fixture === "business" && call.path.endsWith("/auth/logout"))
    expect(logout).toHaveLength(1)
    expect(logout[0]).toMatchObject({ method: "POST", cookie: true, basic: false, selector: null, status: 204 })
    const persisted = await f.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.versions }))
    expect(persisted).toMatchObject([{ id: "version-native", name: "Original version" }])

    phase = "independent-administration"
    const administrator = await open(admin, "admin")
    await signIn(administrator.page, admin)
    expect(await administrator.page.locator("[data-sf-team-status]").textContent()).toContain("currently unavailable")
    await administrator.page.locator(".sf-team-sidebar").getByRole("button", { name: "Team administration", exact: true }).click()
    await administrator.page.locator('[data-sf-team-administration="ready"]').waitFor({ state: "visible" })
    expect(await admin.profiles.read()).toEqual({ configRevision: 0, profiles: [] })
    await administrator.page.locator("[data-sf-team-id-input]").fill(profileA.teamObjectId)
    await administrator.page.getByRole("button", { name: "Enable Team", exact: true }).click()
    await administrator.page.locator('[data-sf-admin-team="' + profileA.teamObjectId + '"]').waitFor({ state: "visible" })
    expect(await admin.profiles.read()).toEqual({ configRevision: 1, profiles: [{ profile: profileA, enabled: true }] })
    expect(await picker(administrator.page).isDisabled()).toBe(true)
    expect(observed.some((call) => call.fixture === "admin" && call.path.endsWith("/api/ui/team-profiles") &&
      call.method === "POST" && call.cookie && !call.basic && call.selector === null && call.status === 200)).toBe(true)
    phase = "shared-team-configuration"
    await administrator.page.locator('[data-sf-config-open="' + profileA.teamObjectId + '"]').click()
    const configuration = administrator.page.locator('[data-sf-team-configuration="ready"]')
    await configuration.waitFor({ state: "visible" })
    await configuration.locator("[data-sf-config-model]").fill("fixture/shared-model")
    await configuration.locator("[data-sf-config-default-agent]").fill("analyst")
    await configuration.locator("[data-sf-config-agent-id]").fill("analyst")
    await configuration.locator("[data-sf-config-add-agent]").click()
    await configuration.locator("[data-sf-config-instructions]").fill("Shared instructions configured by the independent administrator.")
    const configured = captureResponse(administrator.page.waitForResponse((response) =>
      new URL(response.url()).pathname === admin!.binding.mount + "/api/ui/team-profiles/configuration" &&
      response.request().method() === "POST"))
    await configuration.locator("[data-sf-config-save]").click()
    const configuredResult = await configured
    if ("error" in configuredResult) throw configuredResult.error
    expect(configuredResult.value.status()).toBe(200)
    await administrator.page.locator('[data-sf-team-administration="ready"]').waitFor({ state: "visible" })
    expect(await admin.profiles.readConfiguration(profileA)).toEqual({
      origin: "installation-team-store", profile: profileA, configRevision: 2,
      document: { version: 1, settings: { model: "fixture/shared-model", default_agent: "analyst",
        agents: { analyst: { system: "Shared instructions configured by the independent administrator." } } } },
    })
    expect(await admin.profiles.read()).toEqual({ configRevision: 2, profiles: [{ profile: profileA, enabled: true }] })
    expect(await picker(administrator.page).isDisabled()).toBe(true)
    expect(observed.some((call) => call.fixture === "admin" && call.path.endsWith("/api/ui/team-profiles/configuration") &&
      call.method === "POST" && call.cookie && !call.basic && call.selector === null && call.status === 200)).toBe(true)
    phase = "shared-configuration-unknown-reload"
    await administrator.page.locator('[data-sf-config-open="' + profileA.teamObjectId + '"]').click()
    await configuration.waitFor({ state: "visible" })
    await configuration.locator("[data-sf-config-agent]").selectOption("analyst")
    await configuration.locator("[data-sf-config-instructions]").fill("Observed only after the original administrator is admitted again.")
    loseConfigurationResponse = true
    await configuration.locator("[data-sf-config-save]").click()
    await configuration.locator("[data-sf-config-check]").waitFor({ state: "visible" })
    expect((await admin.profiles.read()).configRevision).toBe(3)
    const retainedConfiguration = await administrator.page.evaluate(() =>
      Object.values(sessionStorage).filter((value) => value.includes('"documentHash"')))
    expect(retainedConfiguration).toHaveLength(1)
    expect(retainedConfiguration.join("")).not.toMatch(/Observed only|fixture\/shared-model|"settings"|"system"/)
    administrator.page.once("dialog", (dialog) => { void dialog.accept() })
    await administrator.page.reload({ waitUntil: "domcontentloaded" })
    await administrator.page.locator('[data-sf-team-administration="ready"]').waitFor({ state: "visible" })
    expect(await administrator.page.locator("body").textContent()).not.toContain("Observed only after")
    await administrator.page.locator('[data-sf-config-open="' + profileA.teamObjectId + '"]').click()
    await administrator.page.locator(".sf-team-notice").filter({ hasText: "matches the settings you submitted" }).waitFor({ state: "visible" })
    expect(await administrator.page.evaluate(() =>
      Object.values(sessionStorage).filter((value) => value.includes('"documentHash"')))).toEqual([])
    expect(observed.filter((call) => call.fixture === "admin" &&
      call.path.endsWith("/api/ui/team-profiles/configuration") && call.method === "POST").map((call) => call.status)).toEqual([200, 502])
    admin.provider.account.groups = admin.provider.account.groups.filter((value) => value !== group)
    await administrator.page.getByRole("button", { name: "Read current configuration", exact: true }).click()
    await administrator.page.locator('[data-sf-team-administration="denied"]').waitFor({ state: "visible" })
    expect(await admin.profiles.read()).toEqual({ configRevision: 3, profiles: [{ profile: profileA, enabled: true }] })
    expect(admin.metadataCalls.locations).toBe(0)

    expect(observed.some((call) => call.basic)).toBe(false)
    expect(observed.some((call) => call.path === "/api/session" || call.path === "/api/reference" || call.path === "/api/global/health")).toBe(false)
    expect(errors).toEqual([])
    passed = true
  } catch (error) {
    console.info("SF_TEAMS_NATIVE_WEB_PRIMARY_FAILURE " + JSON.stringify({
      firstFailedPhase: phase,
      firstObservableUiBoundary: firstObservableUiBoundary ?? "not-observed",
      errorName: error instanceof Error ? error.name : "unknown",
    }))
    throw error
  } finally {
    logoutRelease.resolve()
    if (!passed) {
      const pages = await Promise.allSettled(contexts.flatMap((context) => context.pages().map((page) => page.evaluate(() => ({
        state: document.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-teams-state"),
        hasTeamStatus: !!document.querySelector("[data-sf-team-status]"),
        hasProcurement: !!document.querySelector('[data-component="sf-requests-pr-po"]'),
        hasPurchaseForm: !!document.querySelector('form[data-command="create"][data-page="Requests"]'),
      })))))
      console.info("SF_TEAMS_NATIVE_WEB_FAILURE " + JSON.stringify({ firstFailedPhase: phase,
        firstObservableUiBoundary: firstObservableUiBoundary ?? "not-observed",
        pageErrorCount: errors.length, runtimeErrorCount: runtimeErrors.length, contextReplies,
        httpPhases: httpPhases.map((item) => ({ fixture: item.fixture, route: item.route, method: item.method,
          pendingMs: item.elapsedMs === undefined ? Math.round(performance.now() - startedAt - item.startedMs) : undefined,
          elapsedMs: item.elapsedMs, status: item.status })),
        pages: pages.map((page) => page.status === "fulfilled" ? page.value : { inaccessible: true }),
        calls: observed.map(({ fixture, path, method, status }) => ({ fixture,
          route: path.endsWith("/api/ui/context") ? "team-context" :
            path.endsWith("/api/session") ? "session-collection" :
            path.includes("/api/session/") ? "session-resource" :
            path.endsWith("/api/event") ? "event-stream" :
            path.endsWith("/api/ui/team-profiles/configuration") ? "team-configuration" :
            path.endsWith("/api/ui/team-profiles") ? "team-profile-administration" :
            path.endsWith("/auth/logout") ? "logout" : "other",
          method, status })) }))
    }
    const browserClosed = await Promise.allSettled(contexts.map((context) => context.close()))
    const networkClosed = await Promise.allSettled(networks.map((network) => network.close()))
    const driverClosed = await Promise.allSettled([driver?.close()])
    const fixturesClosed = await Promise.allSettled([f?.close(), admin?.close()])
    const buildClosed = await Promise.allSettled([built?.close()])
    const failures = [...browserClosed, ...networkClosed, ...driverClosed, ...fixturesClosed, ...buildClosed]
      .flatMap((entry) => entry.status === "rejected" ? [entry.reason] : [])
    if (failures.length) throw new AggregateError(failures, "Native Teams Web qualification cleanup failed")
  }
  if (passed) driver?.report()
}, 180000)

test("native Teams Web with synthetic OIDC creates and rereads a purchase request after review", () => runPurchaseJourney(false), 120000)
// Register after the unprepared browser cases so this read cannot affect them in a serial run.
test("native Teams Web with synthetic OIDC creates and rereads a purchase request after review (warm-I/O diagnostic)", () => runPurchaseJourney(true), 120000)
