import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { createSfBusinessServices } from "../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfDashboardHttp } from "../../../../../apps/cli/src/sucafina-product/dashboard-http.ts"
import { createSfLiveContext } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { observeSfDashboardDraftHealth } from "../../../../../apps/cli/src/sucafina-product/native-ui/dashboard-draft-health.ts"
import { createModule } from "../../index.ts"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { createSfProductAuthority } from "../../product/integration/product-authority.ts"
import { financialCompositionFixture } from "../product/wp10/integration/financial-composition-fixture.ts"

const origin = "https://example.test"
const mount = "/sucafina"
const ids = ["dashboard.dashboard-workbench", "dashboard.dashboard-hot-topic-source", "dashboard.dashboard-draft-read",
  "dashboard.dashboard-hot-topic-draft", "dashboard.dashboard-hot-topic-drafts", "dashboard.dashboard-hot-topic-draft-outcome", "dashboard.dashboard-capture"] as const
const reads = ids.filter((id) => id !== "dashboard.dashboard-hot-topic-draft" && id !== "dashboard.dashboard-hot-topic-draft-outcome" && id !== "dashboard.dashboard-capture")

async function draftFixture(policy: { dashboard?: boolean; cases?: boolean; preferences?: boolean; edit?: boolean; preserve?: boolean; write?: boolean } = {}) {
  const f = await financialCompositionFixture()
  const scheduling: { beforeCommand?: () => Promise<void> } = {}
  const authority = createSfProductAuthority({ installationId: "installation", origin, policyVersion: "dashboard-draft-health-policy",
    identity: () => f.identity, persistence: f.persistence, ...f.guards,
    authenticate: async (request, scope) => {
      const principal = await f.authority.host.authenticate(request, scope)
      return principal ? { ...principal, canWrite: policy.write !== false } : null
    },
    environment: f.authority.host.environment,
    grants: [{ principalRef: "person", namespaces: [...(policy.cases === false ? [] : ["cases" as const]),
      ...(policy.preferences === false ? [] : ["preferences" as const])],
      operations: policy.dashboard === false ? [] : ["sf_dashboard_read"],
      humanActions: [...(policy.edit === false ? [] : ["decisions.edit" as const]), ...(policy.preserve === false ? [] : ["reviews.preserve" as const])] }],
    createId: randomUUID, now: Date.now,
    commandIdentity: async () => { await scheduling.beforeCommand?.(); return randomUUID() },
    inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence: f.persistence, ...f.guards })
  business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
  const createHandler = () => createSfDashboardHttp({ origin, mount,
    runtime: () => ({ authority, dashboard: business.dashboardServices, decisions: business.dashboardDecisions }) })
  const owner = { mounted: true, handler: createHandler(), dispatches: 0 }
  const productHttp = (request: Request, surface: string) => {
    owner.dispatches++
    return owner.handler(request, surface)
  }
  const application = createModule(mount, { authenticate: authority.host.authenticate, environment: authority.host.environment,
    persistence: f.persistence, product: productHttp, maxJsonBytes: 65_536 })
  const fetch = (request: Request) => owner.mounted ? application(request) : Promise.resolve(undefined)
  const original = new Request(origin + mount + "/api/ui/context?installationId=installation&projectId=project&hostId=host")
  const initialized = await f.authority.state.transaction(original, { namespace: "preferences", expectedStorageVersion: 0,
    targetRef: f.authority.creationTarget.ref, targetIncarnation: f.authority.creationTarget.incarnation,
    idempotencyKey: "dashboard-draft-health-fixture", commandDigest: digestSfValue({ fixture: "dashboard-draft-health" }) },
  async (state) => { state.preferences["dashboard-draft-health-fixture"] = "private"; return { commit: true, value: true } })
  if (initialized.status !== "ok" || !f.store.transactionAll || !f.store.readSnapshotRoot) throw new Error("Original C08 fixture unavailable")
  const input: Parameters<typeof observeSfDashboardDraftHealth>[0] = {
    ui: authority.ui, state: authority.state, humanActions: authority.humanActions,
    binding: (id, producer) => owner.mounted && ids.some((candidate) => id === candidate) && producer === productHttp ? productHttp : undefined,
    source: (id) => {
      if (!owner.mounted) return undefined
      const dashboard = business.dashboardServices, decisions = business.dashboardDecisions
      const operation = id === "dashboard.dashboard-capture" ? dashboard.capture :
        id === "dashboard.dashboard-workbench" ? dashboard.discover :
        id === "dashboard.dashboard-hot-topic-source" ? dashboard.issue :
        id === "dashboard.dashboard-draft-read" ? decisions.revalidateDraftRead :
        id === "dashboard.dashboard-hot-topic-draft" ? decisions.drafts.register :
        id === "dashboard.dashboard-hot-topic-drafts" ? decisions.drafts.list : decisions.drafts.lookupFirstSave
      return { producer: productHttp, handler: owner.handler, operation,
        dependencies: [authority, authority.host, authority.host.authenticate, authority.host.environment,
          authority.host.revalidate, authority.host.requestFor, authority.ui.operationIdentity, authority.human,
          authority.human.admit, authority.human.authorize, authority.humanActions, authority.state.transaction,
          dashboard, dashboard.discover, dashboard.issue, dashboard.capture, dashboard.observer, dashboard.observer.preparePrivateDraftRead,
          decisions, decisions.discover, decisions.revalidateDraftRead, decisions.drafts, decisions.drafts.register,
          decisions.drafts.readCurrent, decisions.drafts.list, decisions.drafts.lookupFirstSave,
          business.cases, business.cases.read, business.dashboardSources, business.dashboardSources.resolveDashboardSource,
          business.dashboardRecords, business.dashboardRecords.issue, business.dashboardRecords.resolve, business.dashboardRecords.read,
          f.persistence, f.persistence.transaction, f.persistence.transactionAll!, f.persistence.readScopedSource, f.persistence.resolveScopedSource] }
    },
  }
  const inRoot = <T>(work: () => Promise<T>) => f.store.readSnapshotRoot!(work)
  const admission = await inRoot(() => authority.readContextAdmission(original))
  if (admission.status !== "ok") throw new Error("Original authenticated context unavailable")
  const observe = () => inRoot(() => observeSfDashboardDraftHealth(input, original, admission.stamp))
  const readState = () => f.store.transactionAll!(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
  return { f, authority, business, scheduling, owner, createHandler, fetch, original, input, inRoot, admission, observe, readState,
    dispose: async () => { business.dispose(); await f.dispose() } }
}

test("Dashboard private editor availability observes original mounted handlers and C08 without dispatch or writes", async () => {
  const f = await draftFixture()
  try {
    for (const id of ids) {
      const response = await f.fetch(new Request(origin + mount + "/dashboard?sf=" + id.slice("dashboard.".length),
        { method: id === "dashboard.dashboard-hot-topic-drafts" ? "POST" : "GET" }))
      expect(response?.status).toBe(405)
    }
    f.owner.dispatches = 0
    const before = await f.readState()
    const binding = Object.freeze({ installationId: "installation", projectId: "project", hostId: "host" })
    const live = createSfLiveContext({ origin, mount, currentBinding: () => binding,
      admit: async (request) => {
        const admitted = await f.authority.readContextAdmission(request)
        return admitted.status === "ok" ? { status: "ok", stamp: admitted.stamp, authMode: "local-operator", destinations: [] } : admitted
      }, operational: (request, stamp) => observeSfDashboardDraftHealth(f.input, request, stamp) })
    const context = await f.inRoot(() => live.readContext(f.original, binding))
    if (context.status !== "ok") throw new Error("Live Dashboard context unavailable")
    const resource = context.value.availability.find((entry) => entry.family === "domain-read" && entry.resource === "hot-topic-proposal")
    expect(resource?.operations.filter((entry) => ids.some((id) => id === entry.operationId)).toSorted((a, b) => a.operationId.localeCompare(b.operationId))).toEqual(
      ids.map((operationId) => ({ operationId, state: "ready", reason: null, operational: true })).toSorted((a, b) => a.operationId.localeCompare(b.operationId)))
    expect(resource?.state).toBe("partial")
    expect(f.owner.dispatches).toBe(0)
    expect(await f.readState()).toEqual(before)
  } finally { await f.dispose() }
})

test("private draft reads survive absent write authority while save and outcome retain their human action", async () => {
  for (const [policy, expected] of [
    [{ edit: false }, [...reads, "dashboard.dashboard-capture"]],
    [{ preserve: false }, ids.filter((id) => id !== "dashboard.dashboard-capture")],
    [{ write: false }, reads],
    [{ dashboard: false }, []],
    [{ cases: false }, ["dashboard.dashboard-capture"]],
    [{ preferences: false }, []],
  ] as const) {
    const f = await draftFixture(policy)
    try {
      const before = await f.readState()
      expect((await f.observe()).map((operation) => operation.operationId)).toEqual([...expected])
      if ("edit" in policy && policy.edit === false) {
        const response = await f.fetch(new Request(origin + mount + "/dashboard?sf=dashboard-hot-topic-draft", {
          method: "POST", headers: { origin, "content-type": "application/json" }, body: "{}",
        }))
        expect(response?.status).toBe(403)
      }
      if ("preserve" in policy && policy.preserve === false) {
        const response = await f.fetch(new Request(origin + mount + "/dashboard?sf=dashboard-capture", {
          method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ sourceRef: "not-selected" }),
        }))
        expect(response?.status).toBe(403)
      }
      expect(await f.readState()).toEqual(before)
    } finally { await f.dispose() }
  }
})

test("missing mount, copied producer, missing method, stale stamp, foreign origin and abort cannot claim private draft readiness", async () => {
  const f = await draftFixture()
  try {
    const before = await f.readState()
    f.owner.mounted = false
    expect(await f.fetch(new Request(origin + mount + "/dashboard?sf=dashboard-draft-read"))).toBeUndefined()
    expect(await f.observe()).toEqual([])
    f.owner.mounted = true
    expect(await f.inRoot(() => observeSfDashboardDraftHealth({ ...f.input, binding: undefined }, f.original, f.admission.stamp))).toEqual([])
    for (const replacement of ["producer", "operation", "dependencies"] as const) {
      const source: typeof f.input.source = (id) => {
        const original = f.input.source(id)
        if (!original) return undefined
        return replacement === "producer" ? { ...original, producer: {} } :
          replacement === "operation" ? { ...original, operation: {} } : { ...original, dependencies: [] }
      }
      expect(await f.inRoot(() => observeSfDashboardDraftHealth({ ...f.input, source }, f.original, f.admission.stamp))).toEqual([])
    }
    expect(await f.inRoot(() => observeSfDashboardDraftHealth(f.input, f.original, { ...f.admission.stamp, accessRevision: "changed" }))).toEqual([])
    const foreign = new Request("https://foreign.example.test" + mount + "/api/ui/context")
    expect(await f.inRoot(() => observeSfDashboardDraftHealth(f.input, foreign, f.admission.stamp))).toEqual([])
    const abort = new AbortController()
    const aborted = new Request(f.original.url, { signal: abort.signal })
    abort.abort()
    expect(await f.inRoot(() => observeSfDashboardDraftHealth(f.input, aborted, f.admission.stamp))).toEqual([])
    expect(f.owner.dispatches).toBe(0)
    expect(await f.readState()).toEqual(before)
  } finally { await f.dispose() }
})

test("revocation or replacement of the real router/private reader during admission invalidates all observations", async () => {
  for (const change of ["revoke", "replace-router", "replace-reader"] as const) {
    const f = await draftFixture()
    const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    try {
      const before = await f.readState()
      f.scheduling.beforeCommand = async () => { entered.resolve(); await release.promise }
      const pending = f.observe()
      await entered.promise
      if (change === "revoke") f.f.active.value = false
      if (change === "replace-router") f.owner.handler = f.createHandler()
      if (change === "replace-reader") {
        const original = f.business.dashboardDecisions.revalidateDraftRead
        f.business.dashboardDecisions.revalidateDraftRead = (...args) => original(...args)
      }
      release.resolve()
      expect(await pending).toEqual([])
      f.scheduling.beforeCommand = undefined
      if (change !== "revoke") expect((await f.observe()).map((operation) => operation.operationId)).toEqual([...ids])
      expect(f.owner.dispatches).toBe(0)
      expect(await f.readState()).toEqual(before)
    } finally { release.resolve(); await f.dispose() }
  }
})
