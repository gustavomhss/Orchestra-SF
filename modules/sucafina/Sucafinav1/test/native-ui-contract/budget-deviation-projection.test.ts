import { expect, test } from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import type { SfHostServices } from "../../product/contracts/host-context.ts"
import { createSfProductAuthority } from "../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../product/integration/source-inventory.ts"
import { createApplication, type Application } from "../../runtime/application.ts"
import type { Command } from "../../runtime/contract.ts"
import { object, rows } from "../../runtime/contract.ts"
import { createOperatorIdentity } from "../../runtime/operator-identity.ts"
import { openLocalStore } from "../../runtime/local-store.ts"
import { contributions } from "../../index.ts"
import { createSfActionSource } from "../../../../../apps/cli/src/sucafina-product/native-ui/action-source.ts"
import { createSfContextHandler } from "../../../../../apps/cli/src/sucafina-product/native-ui/context.ts"
import { createSfDomainProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/domain.ts"
import { projectSfDomainData } from "../../../../../apps/cli/src/sucafina-product/native-ui/domain/projection.ts"
import { createSfLiveContext, sfContextDestinationsFromPages } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { mountSfNativeProjections, type SfNativeHostDependencies } from "../../../../../apps/cli/src/sucafina-product/native-ui/router.ts"

const origin = "http://127.0.0.1"
const mount = "/sucafina"
const at = "2026-11-20T00:00:00Z"
const budgets = [
  { cap: "CAP04", page: "OPEX Detail", owners: "opexOwners", ref: "ownerId", own: "opex" },
  { cap: "CAP05", page: "CAPEX Projects", owners: "capexProjects", ref: "projId", own: "capex" },
] as const
type Budget = typeof budgets[number]
type Projection = { status: "ok"; context: SfContextStamp; value: {
  capabilityId: string; data: Record<string, unknown>; versions: Record<string, number>; allowedActionIds: string[]
} }

// Real SQLite, encrypted operator identity, F01 admission, original Budget view
// and original command HTTP dispatch. Policy knobs only remove existing access.
// Positive setup creates owners/entries by command and never seeds deviations.
async function fixture() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sf-budget-deviation-"))
  const driver = await openLocalStore(path.join(root, "business"))
  const store = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources,
    createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await store.initializeSources(surface)
  const operator = { installationId: randomUUID(), uid: 1000, name: "Budget operator" }
  const identity = createOperatorIdentity({ origin, mount, operator, key: randomBytes(32), secrets: driver.secrets })
  const loggedIn = await identity.handle(new Request(origin + mount + "/auth/local?code=" + await identity.enroll()))
  expect(loggedIn?.status).toBe(303)
  const cookie = loggedIn!.headers.getSetCookie()[0]!.split(";")[0]!
  const principal = "macos:" + operator.installationId + ":" + operator.uid
  const binding = Object.freeze({ installationId: operator.installationId, projectId: "project", hostId: "host" })
  const state: { readable: boolean; writable: boolean; beforeRefetch?: () => Promise<void> } =
    { readable: true, writable: true }
  const requests = new WeakSet<Request>()
  const authenticate: Application["authenticate"] = async (request, context) => {
    expect(requests.has(request)).toBe(true)
    const actual = await identity.authenticate(request, context)
    return actual ? { ...actual, canWrite: actual.canWrite && state.writable,
      roles: actual.roles.filter((role) => state.readable || role.surface !== "dashboard") } : null
  }
  const environment: Application["environment"] = async (request) => {
    expect(requests.has(request)).toBe(true)
    return { at, id: randomUUID, directory: await identity.directory(request) }
  }
  const authority = createSfProductAuthority({
    identity: () => ({ ...binding, location: { directory: root } }), installationId: operator.installationId,
    origin, policyVersion: "budget-policy", persistence: store, authenticate, environment,
    isAuthenticated: async (request) => !!await identity.person(request),
    grants: [{ principalRef: principal, namespaces: [], operations: [] }],
    createId: randomUUID, now: () => Date.now(), commandIdentity: async () => undefined,
    inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
  })
  const application: Application = { persistence: store, authenticate, environment, domains: contributions, maxJsonBytes: 16384 }
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding,
    admit: async (request) => {
      const admitted = await authority.readContextAdmission(request)
      if (admitted.status !== "ok") return admitted
      const observed = await actions.actions(request, admitted.stamp, admitted.pages)
      const destinations = sfContextDestinationsFromPages(admitted.pages, observed)
      if (!destinations) return { status: "unavailable", reason: "contract-mismatch" }
      return { status: "ok", stamp: admitted.stamp, authMode: "local-operator", destinations }
    },
  })
  // No model/session operations are claimed. These exercised ports are the
  // original authority, native context mapper, domain projection and commands.
  const services = { ...authority, nativeUiProducts: live } as unknown as SfHostServices
  const context = createSfContextHandler({ origin, mount, application, runtime: () => services })
  const reads = new WeakMap<Request, number>()
  const deps: SfNativeHostDependencies = { origin, mount, application, runtime: () => services,
    readContext: async (request) => {
      const count = (reads.get(request) ?? 0) + 1
      reads.set(request, count)
      if (count === 2 && state.beforeRefetch) {
        const change = state.beforeRefetch
        delete state.beforeRefetch
        await change()
      }
      return context.readContext(request)
    },
  }
  const handlers = createSfDomainProjectionHandlers(deps)
  const actions = createSfActionSource(deps, handlers)
  const router = mountSfNativeProjections({ mount, context, handlers })
  const business = createApplication(mount, application)
  const call = async (pathname: string, body?: unknown, headers: Record<string, string> = {}) => {
    const request = new Request(origin + mount + pathname, { method: body === undefined ? "GET" : "POST",
      headers: { cookie, ...(body === undefined ? {} : { origin, "content-type": "application/json" }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    requests.add(request)
    const response = await router(request) ?? await business(request)
    if (!response) throw new Error("Budget route not mounted")
    return response
  }
  const raw = () => store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
  const command = (input: Command, headers?: Record<string, string>) => call("/dashboard", input, headers)
  const get = (budget: Budget, headers?: Record<string, string>) => call("/api/ui/pages/" + budget.cap + "?year=2026&month=1", undefined, headers)
  const read = async (budget: Budget) => {
    const response = await get(budget)
    expect(response.status).toBe(200)
    return await response.json() as Projection
  }
  const seed = async (budget: Budget) => {
    const created = await command({ page: budget.page, action: "save", version: 0, values: { name: budget.own, budget: 1200 } })
    expect(created.status).toBe(200)
    const owners = rows((await raw()).data[budget.owners])
    expect(owners).toHaveLength(1)
    const id = owners[0]!.id
    if (typeof id !== "string") throw new Error("Original Budget owner was not created")
    const entry = await command({ page: budget.page, action: "save-entry", version: 0,
      values: { [budget.ref]: id, year: 2026, month: 1, budget: 100, actual: 25, forecast: 90 } })
    expect(entry.status).toBe(200)
    return id
  }
  return { state, principal, command, get, read, raw, seed,
    corrupt: (deviations: unknown) => store.transaction("dashboard", async (snapshot) => {
      snapshot.data.deviations = deviations
      return { commit: true, value: undefined }
    }),
    logout: () => identity.handle(new Request(origin + mount + "/auth/logout", { method: "POST", headers: { cookie, origin } })),
    close: async () => { await driver.dispose(); await rm(root, { recursive: true, force: true }) },
  }
}

for (const budget of budgets) test(budget.cap + " publishes canonical absence and preserves first-write and stale CAS through original HTTP", async () => {
  const f = await fixture()
  try {
    const id = await f.seed(budget)
    const key = budget.own + "-" + id + "-2026-1"
    const versionKey = "deviations:" + key
    const before = await f.raw()
    expect(Object.hasOwn(before.data, "deviations")).toBe(false)
    const initial = await f.read(budget)
    expect(initial.value.capabilityId).toBe(budget.cap)
    expect(initial.value.allowedActionIds).toContain("save-deviation")
    expect(Object.hasOwn(initial.value.data, "deviations")).toBe(true)
    expect(initial.value.data.deviations).toEqual({})
    expect(Object.hasOwn(initial.value.versions, versionKey)).toBe(false)
    expect(await f.raw()).toEqual(before)

    const input: Command = { page: budget.page, action: "save-deviation", id, version: 0,
      values: { year: 2026, month: 1, flag: "dev-amber", text: "First admitted deviation" } }
    const saved = await f.command(input)
    expect(saved.status).toBe(200)
    expect(await saved.json()).toEqual({ ok: true })
    const actual = await f.raw()
    expect(object(actual.data.deviations)[key]).toEqual({ flag: "dev-amber", text: "First admitted deviation" })
    expect(actual.versions[versionKey]).toEqual({ version: 1, by: f.principal })
    expect(actual.versions.dataset!.version).toBe(before.versions.dataset!.version + 1)
    expect(actual.audit.at(-1)).toMatchObject({ record: versionKey, who: f.principal, name: "Budget operator",
      became: { flag: "dev-amber", text: "First admitted deviation" } })
    const current = await f.read(budget)
    expect(current.value.data.deviations).toEqual({ [key]: { flag: "dev-amber", text: "First admitted deviation" } })
    expect(current.value.versions[versionKey]).toBe(1)

    const stale = await f.command({ ...input, values: { ...input.values, text: "Stale replacement" } })
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({ ok: false, status: 409, currentVersionCAS: 1,
      stored: { flag: "dev-amber", text: "First admitted deviation" } })
    expect(await f.raw()).toEqual(actual)
    const updated = await f.command({ ...input, version: current.value.versions[versionKey]!,
      values: { ...input.values, text: "Reviewed current deviation" } })
    expect(updated.status).toBe(200)
    const refreshed = await f.read(budget)
    expect(refreshed.value.versions[versionKey]).toBe(2)
    expect(object(refreshed.value.data.deviations)[key]).toEqual({ flag: "dev-amber", text: "Reviewed current deviation" })
  } finally { await f.close() }
})

test("Budget deviation projection keeps CAP04 and CAP05 records, versions and command targets separate", async () => {
  const f = await fixture()
  try {
    const ids = [await f.seed(budgets[0]), await f.seed(budgets[1])]
    for (const [index, budget] of budgets.entries()) {
      const result = await f.command({ page: budget.page, action: "save-deviation", id: ids[index], version: 0,
        values: { year: 2026, month: 1, flag: "dev-red", text: budget.own + " private note" } })
      expect(result.status).toBe(200)
    }
    for (const [index, budget] of budgets.entries()) {
      const key = budget.own + "-" + ids[index] + "-2026-1"
      const result = await f.read(budget)
      expect(result.value.data.deviations).toEqual({ [key]: { flag: "dev-red", text: budget.own + " private note" } })
      expect(Object.keys(result.value.versions).filter((key) => key.startsWith("deviations:"))).toEqual(["deviations:" + key])
      expect(JSON.stringify(result)).not.toContain(budgets[1 - index]!.own + " private note")
    }
    const before = await f.raw()
    const wrong = await f.command({ page: budgets[1].page, action: "save-deviation", id: ids[0], version: 0,
      values: { year: 2026, month: 1, flag: "dev-red", text: "Wrong scope" } })
    expect(wrong.status).toBe(404)
    expect(await f.raw()).toEqual(before)
    const crossSite = await f.get(budgets[0], { origin: "https://foreign.invalid" })
    expect(crossSite.status).toBe(403)
    expect(await crossSite.json()).toEqual({ status: "denied" })
  } finally { await f.close() }
})

test("Budget HTTP does not normalize a present malformed deviation map or row", async () => {
  const f = await fixture()
  try {
    const id = await f.seed(budgets[0])
    for (const malformed of [null, [], "invalid", { ["opex-" + id + "-2026-1"]: null }]) {
      await f.corrupt(malformed)
      const before = await f.raw()
      const response = await f.get(budgets[0])
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ status: "unavailable", reason: "domain-projection-unavailable" })
      expect(await f.raw()).toEqual(before)
    }
    // Even present undefined is malformed at the authorized projection seam.
    // No client deserializer fallback is introduced by this server correction.
    for (const budget of budgets) {
      for (const malformed of [undefined, null, [], "invalid"])
        expect(() => projectSfDomainData(budget.cap, { deviations: malformed }, 2026)).toThrow("Malformed authorized source object")
    }
  } finally { await f.close() }
})

test("Budget absence is withheld after access revocation and after operator logout", async () => {
  const f = await fixture()
  try {
    const id = await f.seed(budgets[0])
    const before = await f.raw()
    f.state.beforeRefetch = async () => { f.state.readable = false }
    const revoked = await f.get(budgets[0])
    expect(revoked.status).toBe(403)
    expect(await revoked.json()).toEqual({ status: "denied" })
    const deniedWrite = await f.command({ page: budgets[0].page, action: "save-deviation", id, version: 0,
      values: { year: 2026, month: 1, flag: "dev-red", text: "Revoked" } })
    expect(deniedWrite.status).toBe(403)
    expect(await f.raw()).toEqual(before)
    f.state.readable = true
    f.state.writable = false
    const readOnly = await f.read(budgets[0])
    expect(readOnly.value.data.deviations).toEqual({})
    expect(readOnly.value.allowedActionIds).not.toContain("save-deviation")
    expect((await f.command({ page: budgets[0].page, action: "save-deviation", id, version: 0,
      values: { year: 2026, month: 1, flag: "dev-red", text: "Read only" } })).status).toBe(403)
    expect(await f.raw()).toEqual(before)
    await f.logout()
    const loggedOut = await f.get(budgets[0])
    expect(loggedOut.status).toBe(401)
    expect(await loggedOut.json()).toEqual({ status: "unauthenticated" })
    expect(await f.raw()).toEqual(before)
  } finally { await f.close() }
})

test("Budget empty-map response is rejected when an original first write races its source fence", async () => {
  const f = await fixture()
  try {
    const id = await f.seed(budgets[0])
    f.state.beforeRefetch = async () => {
      const concurrent = await f.command({ page: budgets[0].page, action: "save-deviation", id, version: 0,
        values: { year: 2026, month: 1, flag: "dev-green", text: "Concurrent current value" } })
      expect(concurrent.status).toBe(200)
    }
    const raced = await f.get(budgets[0])
    expect(raced.status).toBe(409)
    expect(await raced.json()).toEqual({ status: "stale", reason: "domain-source-changed" })
    const current = await f.read(budgets[0])
    const key = "opex-" + id + "-2026-1"
    expect(object(current.value.data.deviations)[key]).toEqual({ flag: "dev-green", text: "Concurrent current value" })
    expect(current.value.versions["deviations:" + key]).toBe(1)
  } finally { await f.close() }
})
