import { expect, test } from "bun:test"
import { randomBytes } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Application } from "../../runtime/application.ts"
import type { SfHostServices } from "../../product/contracts/host-context.ts"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { createSfProductAuthority } from "../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../product/integration/source-inventory.ts"
import { createOperatorIdentity } from "../../runtime/operator-identity.ts"
import { openLocalStore } from "../../runtime/local-store.ts"
import { contributions } from "../../index.ts"
import { DASHBOARD_PAGES } from "../../src/nav.ts"
import { createSfContextHandler } from "../../../../../apps/cli/src/sucafina-product/native-ui/context.ts"
import { createSfLiveContext, sfContextDestinationsFromPages } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { createSfSummarySettingsHandlers, observeSfSummarySettingsHealth } from "../../../../../apps/cli/src/sucafina-product/native-ui/summary-settings.ts"
import { mountSfNativeProjections, type SfNativeHostDependencies } from "../../../../../apps/cli/src/sucafina-product/native-ui/router.ts"

const origin = "http://127.0.0.1"
const mount = "/sucafina"
const readPath = "/api/ui/local-admin/summary-settings"
const writePath = "/api/ui/local-admin/configure-summaries"
const gate = () => ({ entered: Promise.withResolvers<void>(), release: Promise.withResolvers<void>() })
async function entered(pause: ReturnType<typeof gate>) {
  const timeout = setTimeout(() => { pause.entered.reject(new Error("Summary fixture did not reach the bounded race")); pause.release.resolve() }, 3000)
  try { await pause.entered.promise } finally { clearTimeout(timeout) }
}

// Actual SQLite, encrypted operator session, product authority, F01 mapper and
// mounted router. The fixture's policy knobs only REMOVE the source actor's access.
async function fixture() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sf-summary-settings-"))
  const driver = await openLocalStore(path.join(root, "business"))
  const store = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources,
    createId: () => crypto.randomUUID(), projectScope: createSfSourceScopeProjector(() => "2026-11-20T00:00:00Z") })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await store.initializeSources(surface)
  const operator = { installationId: "c1277f59-fd23-460c-9df6-b1939cd00804", uid: 1000, name: "Summary operator" }
  const identity = createOperatorIdentity({ origin, mount, operator, key: randomBytes(32), secrets: driver.secrets })
  const enrollment = await identity.enroll()
  const loggedIn = await identity.handle(new Request(origin + mount + "/auth/local?code=" + enrollment))
  expect(loggedIn?.status).toBe(303)
  const cookie = loggedIn!.headers.getSetCookie()[0]!.split(";")[0]!
  const principal = "macos:" + operator.installationId + ":" + operator.uid
  const binding = Object.freeze({ installationId: operator.installationId, projectId: "project", hostId: "host" })
  const state: { role: string; canWrite: boolean; directory: boolean; mode: "local-operator" | "microsoft";
    afterWrite?: ReturnType<typeof gate>; environment?: ReturnType<typeof gate>; afterRead?: ReturnType<typeof gate> } =
    { role: "admin", canWrite: true, directory: true, mode: "local-operator" }
  const requests = new Set<Request>()
  const authenticate: Application["authenticate"] = async (request, context) => {
    expect(requests.has(request)).toBe(true)
    if (state.afterWrite && store.currentSnapshots?.()?.dashboard.versions["config:summaries"]?.version === 1) {
      const pause = state.afterWrite
      delete state.afterWrite
      pause.entered.resolve()
      await pause.release.promise
    }
    const actual = await identity.authenticate(request, context)
    return actual ? { ...actual, canWrite: actual.canWrite && state.canWrite,
      roles: actual.roles.map((role) => role.surface === "dashboard" ? { ...role, role: state.role } : role) } : null
  }
  const environment: Application["environment"] = async (request) => {
    expect(requests.has(request)).toBe(true)
    if (state.environment) {
      const pause = state.environment
      delete state.environment
      pause.entered.resolve()
      await pause.release.promise
    }
    return { at: "2026-11-20T00:00:00Z", id: () => crypto.randomUUID(),
      directory: state.directory ? await identity.directory(request) : [] }
  }
  const authority = createSfProductAuthority({
    identity: () => ({ ...binding, location: { directory: root } }), installationId: operator.installationId,
    origin, policyVersion: "summary-policy", persistence: store, authenticate, environment,
    isAuthenticated: async (request) => !!await identity.person(request),
    grants: [{ principalRef: principal, namespaces: [], operations: [] }],
    createId: () => crypto.randomUUID(), now: () => Date.now(), commandIdentity: async () => undefined,
    inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
  })
  const application: Application = { persistence: store, authenticate, environment, domains: contributions, maxJsonBytes: 16384 }
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding,
    admit: async (request) => {
      const admitted = await authority.readContextAdmission(request)
      if (admitted.status !== "ok") return admitted
      return { status: "ok", stamp: admitted.stamp, authMode: state.mode,
        destinations: sfContextDestinationsFromPages(admitted.pages)! }
    },
    operational: (request, stamp) => observeSfSummarySettingsHealth(deps, handlers, request, stamp),
  })
  // Unrelated model/session ports are deliberately absent; the exercised host
  // ports here are the real authority and the real native context producer.
  const services = { ...authority, nativeUiProducts: live } as unknown as SfHostServices
  const context = createSfContextHandler({ origin, mount, application, runtime: () => services })
  const reads = new WeakMap<Request, number>()
  const deps: SfNativeHostDependencies = { origin, mount, application, runtime: () => services,
    readContext: async (request) => {
      const count = (reads.get(request) ?? 0) + 1
      reads.set(request, count)
      if (state.afterRead && request.method === "GET" && count === 2) {
        const pause = state.afterRead
        delete state.afterRead
        pause.entered.resolve()
        await pause.release.promise
      }
      return context.readContext(request)
    },
  }
  const handlers = createSfSummarySettingsHandlers(deps)
  const router = mountSfNativeProjections({ mount, context, handlers })
  const request = (pathname: string, body?: unknown, headers: Record<string, string> = {}) => {
    const original = new Request(origin + mount + pathname, { method: body === undefined ? "GET" : "POST",
      headers: { cookie, ...(body === undefined ? {} : { origin, "content-type": "application/json" }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    requests.add(original)
    return original
  }
  const call = async (pathname: string, body?: unknown, headers: Record<string, string> = {}) => {
    const result = await router(request(pathname, body, headers))
    if (!result) throw new Error("Summary route not mounted")
    return result
  }
  const read = async () => {
    const response = await call(readPath)
    expect(response.status).toBe(200)
    return await response.json() as { status: "ok"; context: SfContextStamp;
      value: { pages: string[]; availablePages: string[]; version: number; canConfigure: boolean } }
  }
  return { state, principal, call, read, request, router, application, handlers, deps,
    raw: () => store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) })),
    corrupt: (pages: unknown) => store.transaction("dashboard", async (snapshot) => {
      snapshot.data.summaries = pages
      return { commit: true, value: undefined }
    }),
    logout: () => identity.handle(new Request(origin + mount + "/auth/logout", { method: "POST", headers: { cookie, origin } })),
    close: async () => { await driver.dispose(); await rm(root, { recursive: true, force: true }) },
  }
}

test("native summaries use the original configure command, audit name, dataset version and actual refetch", async () => {
  const f = await fixture()
  try {
    const initial = await f.read()
    expect(initial.value).toEqual({ pages: [], availablePages: [...DASHBOARD_PAGES], version: 0, canConfigure: true })
    const saved = await f.call(writePath, { context: initial.context, version: 0, pages: ["IT Risks"] })
    expect(saved.status).toBe(200)
    expect(await saved.json()).toEqual({ ok: true })
    const refreshed = await f.read()
    expect(refreshed.context).toEqual(initial.context)
    expect(refreshed.value).toMatchObject({ pages: ["IT Risks"], version: 1, canConfigure: true })
    const actual = await f.raw()
    expect(actual.data.summaries).toEqual(["IT Risks"])
    expect(actual.versions["config:summaries"]).toEqual({ version: 1, by: f.principal })
    expect(actual.versions.dataset).toEqual({ version: 1, by: f.principal })
    expect(actual.audit).toEqual([{ who: f.principal, name: "Summary operator", at: "2026-11-20T00:00:00Z",
      record: "config:summaries", was: [], became: ["IT Risks"] }])
    const stale = await f.call(writePath, { context: initial.context, version: 0, pages: ["All Projects"] })
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({ ok: false, status: 409, stored: ["IT Risks"], currentVersionCAS: 1 })
    expect(await f.raw()).toEqual(actual)
  } finally { await f.close() }
})

test("native summaries reject foreign owners, malformed or partial settings, outsiders and CSRF without mutation", async () => {
  const f = await fixture()
  try {
    const initial = await f.read()
    const before = await f.raw()
    const valid = { context: initial.context, version: 0, pages: ["IT Risks"] }
    for (const key of ["installationId", "projectId", "hostId", "principalRef"] as const) {
      const response = await f.call(writePath, { ...valid, context: { ...initial.context, [key]: "foreign" } })
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ status: "denied" })
    }
    for (const body of [
      { context: initial.context, version: 0 }, { ...valid, pages: undefined }, { ...valid, pages: "IT Risks" },
      { ...valid, context: {} }, { ...valid, context: { ...initial.context, principalRef: "" } },
      { ...valid, actor: f.principal }, { ...valid, context: { ...initial.context, role: "admin" } },
      { ...valid, version: -1 }, { ...valid, version: 0.5 },
    ]) expect((await f.call(writePath, body)).status).toBe(400)
    expect((await f.call(writePath, { ...valid, pages: ["IT Risks", "Not a dashboard page"] })).status).toBe(422)
    expect((await f.call(writePath, { ...valid, pages: ["IT Risks", 1] })).status).toBe(422)
    expect((await f.call(writePath, { ...valid, context: { ...initial.context, accessRevision: "old" } })).status).toBe(409)
    expect((await f.call(writePath, valid, { origin: "https://foreign.example" })).status).toBe(403)
    expect((await f.call(writePath, valid, { "sec-fetch-site": "cross-site" })).status).toBe(403)
    expect((await f.call(writePath + "?page=IT%20Risks", valid)).status).toBe(400)
    expect((await f.call(writePath, { ...valid, pages: ["x".repeat(17000)] })).status).toBe(413)
    expect(await f.raw()).toEqual(before)
  } finally { await f.close() }
})

test("native summaries require current admin, writable actor, directory and the original source binding", async () => {
  const f = await fixture()
  try {
    const initial = await f.read()
    const before = await f.raw()
    f.state.canWrite = false
    expect((await f.read()).value.canConfigure).toBe(false)
    const readonly = await f.read()
    expect((await f.call(writePath, { context: readonly.context, version: 0, pages: ["IT Risks"] })).status).toBe(403)
    f.state.canWrite = true
    f.state.directory = false
    expect((await f.read()).value.canConfigure).toBe(false)
    expect((await f.call(writePath, { context: initial.context, version: 0, pages: ["IT Risks"] })).status).toBe(503)
    f.state.directory = true
    f.state.role = "viewer"
    expect((await f.call(readPath)).status).toBe(403)
    const denied = await f.call(writePath, { context: initial.context, version: 0, pages: ["IT Risks"] })
    expect(denied.status).toBe(409)
    f.state.role = "admin"
    f.application.domains = { ...f.application.domains, dashboard: [] }
    expect((await f.call(readPath)).status).toBe(503)
    expect(await f.raw()).toEqual(before)
  } finally { await f.close() }
})

test("native summary save rolls back when admin is revoked during its terminal authority read", async () => {
  const f = await fixture()
  try {
    const initial = await f.read()
    const before = await f.raw()
    const pause = gate()
    f.state.afterWrite = pause
    const pending = f.call(writePath, { context: initial.context, version: 0, pages: ["IT Risks"] })
    await entered(pause)
    f.state.role = "viewer"
    pause.release.resolve()
    const result = await pending
    expect(result.status).toBe(409)
    const response = await result.json()
    expect(response.status).not.toBe("ok")
    expect(response).not.toHaveProperty("stored")
    expect(response).not.toHaveProperty("value")
    expect(await f.raw()).toEqual(before)
  } finally { await f.close() }
})

test("native summaries recheck an actually revoked operator session and a config revision changed during read", async () => {
  const f = await fixture()
  try {
    const initial = await f.read()
    const pause = gate()
    f.state.afterRead = pause
    const pendingRead = f.call(readPath)
    await entered(pause)
    expect((await f.call(writePath, { context: initial.context, version: 0, pages: ["IT Risks"] })).status).toBe(200)
    pause.release.resolve()
    const stale = await pendingRead
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ status: "stale", reason: "summary-settings-changed" })
    const before = await f.raw()
    const current = await f.read()
    const revoke = gate()
    f.state.environment = revoke
    const pendingWrite = f.call(writePath, { context: current.context, version: 1, pages: ["All Projects"] })
    await entered(revoke)
    expect((await f.logout())?.status).toBe(204)
    revoke.release.resolve()
    const denied = await pendingWrite
    expect(denied.status).toBe(503)
    const response = await denied.json()
    expect(response).not.toHaveProperty("stored")
    expect(response).not.toHaveProperty("value")
    expect(await f.raw()).toEqual(before)
  } finally { await f.close() }
})

test("native summaries fail closed on a mixed or partial persisted configuration", async () => {
  const f = await fixture()
  try {
    const initial = await f.read()
    for (const pages of [["IT Risks", "outside"], ["IT Risks", 3], null, "IT Risks"]) {
      await f.corrupt(pages)
      const before = await f.raw()
      const result = await f.call(readPath)
      expect(result.status).toBe(503)
      expect(await result.json()).toEqual({ status: "unavailable", reason: "summary-source-invalid" })
      expect((await f.call(writePath, { context: initial.context, version: 0, pages: ["IT Risks"] })).status).toBe(503)
      expect(await f.raw()).toEqual(before)
    }
  } finally { await f.close() }
})

test("summary operation availability uses observed source/actor state and current local authentication mode", async () => {
  const f = await fixture()
  try {
    const initial = await f.read()
    const original = f.request(readPath)
    const before = await f.raw()
    const observed = await observeSfSummarySettingsHealth(f.deps, f.handlers, original, initial.context)
    expect(observed.map((operation) => operation.operationId)).toEqual(["local-admin.summary-read", "local-admin.summary-configure"])
    expect(await observeSfSummarySettingsHealth(f.deps, [], original, initial.context)).toEqual([])
    f.state.mode = "microsoft"
    const context = await f.deps.readContext(original)
    expect(context.status).toBe("ok")
    if (context.status !== "ok") throw new Error("Context unavailable")
    expect(context.value.availability.flatMap((resource) => resource.operations)
      .filter((operation) => operation.operationId === "local-admin.summary-read" || operation.operationId === "local-admin.summary-configure")
      .every((operation) => operation.state !== "ready" && !operation.operational)).toBe(true)
    expect((await f.call(readPath)).status).toBe(403)
    expect(await f.raw()).toEqual(before)
  } finally { await f.close() }
})
