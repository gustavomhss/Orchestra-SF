import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { createSfBusinessServices } from "../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfDashboardHttp } from "../../../../../apps/cli/src/sucafina-product/dashboard-http.ts"
import { createSfLiveContext } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { observeSfReviewAgendaHealth } from "../../../../../apps/cli/src/sucafina-product/native-ui/review-agenda-health.ts"
import { createModule } from "../../index.ts"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { createSfProductAuthority } from "../../product/integration/product-authority.ts"
import { financialCompositionFixture } from "../product/wp10/integration/financial-composition-fixture.ts"

const origin = "https://example.test"
const mount = "/sucafina"
const agendaId = "dashboard.dashboard-agenda"
const preserveId = "dashboard.dashboard-review-preserve"

async function reviewFixture(policy: { dashboard?: boolean; reviews?: boolean; preserve?: boolean } = {}) {
  const f = await financialCompositionFixture()
  const scheduling: { beforeCommand?: () => Promise<void> } = {}
  const authority = createSfProductAuthority({ installationId: "installation", origin, policyVersion: "review-health-policy",
    identity: () => f.identity, persistence: f.persistence, ...f.guards,
    authenticate: f.authority.host.authenticate, environment: f.authority.host.environment,
    grants: [{ principalRef: "person", namespaces: ["preferences", ...(policy.reviews === false ? [] : ["reviews" as const])],
      operations: policy.dashboard === false ? [] : ["sf_dashboard_read"],
      humanActions: policy.preserve === false ? [] : ["reviews.preserve"] }],
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
  const initialized = await authority.state.transaction(original, { namespace: "preferences", expectedStorageVersion: 0,
    targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
    idempotencyKey: "review-agenda-health-fixture", commandDigest: digestSfValue({ fixture: "review-agenda-health" }) },
  async (state) => { state.preferences["review-agenda-health-fixture"] = true; return { commit: true, value: true } })
  if (initialized.status !== "ok" || !f.store.transactionAll || !f.store.readSnapshotRoot) throw new Error("Original C08 fixture unavailable")
  const input: Parameters<typeof observeSfReviewAgendaHealth>[0] = {
    ui: authority.ui, state: authority.state, humanActions: authority.humanActions,
    binding: (id, producer) => owner.mounted && id === "dashboard.dashboard-review" && producer === productHttp ? productHttp : undefined,
    source: () => owner.mounted ? { producer: productHttp, handler: owner.handler, dashboard: business.dashboardServices,
      dependencies: [authority, authority.ui, authority.state, authority.state.transaction, authority.human, authority.human.admit,
        authority.human.authorize, authority.humanActions, owner.handler, business.dashboardServices,
        business.dashboardServices.agenda, business.dashboardServices.preserveReview, business.dashboard, business.dashboard.read,
        business.dashboardSources, business.dashboardSources.resolveDashboardSource, business.dashboardRecords,
        business.dashboardRecords.issue, business.dashboardRecords.resolve, f.persistence, f.persistence.transaction, f.persistence.resolveScopedSource] } : undefined,
  }
  const inRoot = <T>(work: () => Promise<T>) => f.store.readSnapshotRoot!(work)
  const admission = await inRoot(() => authority.readContextAdmission(original))
  if (admission.status !== "ok") throw new Error("Original authenticated context unavailable")
  const observe = () => inRoot(() => observeSfReviewAgendaHealth(input, original, admission.stamp))
  const readState = () => f.store.transactionAll!(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
  return { f, authority, business, scheduling, owner, createHandler, fetch, original, input, inRoot, admission, observe, readState,
    dispose: async () => { business.dispose(); await f.dispose() } }
}

test("agenda availability observes the installed original handlers and C08 without dispatching or writing", async () => {
  const f = await reviewFixture()
  try {
    // Exercise the actual module mount without admitting or executing a review command.
    expect((await f.fetch(new Request(origin + mount + "/dashboard?sf=dashboard-agenda")))?.status).toBe(405)
    expect((await f.fetch(new Request(origin + mount + "/dashboard?sf=dashboard-review-preserve")))?.status).toBe(405)
    f.owner.dispatches = 0
    const before = await f.readState()
    const binding = Object.freeze({ installationId: "installation", projectId: "project", hostId: "host" })
    const live = createSfLiveContext({ origin, mount, currentBinding: () => binding,
      admit: async (request) => {
        const admitted = await f.authority.readContextAdmission(request)
        return admitted.status === "ok" ? { status: "ok", stamp: admitted.stamp, authMode: "local-operator", destinations: [] } : admitted
      }, operational: (request, stamp) => observeSfReviewAgendaHealth(f.input, request, stamp) })
    const context = await f.inRoot(() => live.readContext(f.original, binding))
    if (context.status !== "ok") throw new Error("Live review context unavailable")
    const agenda = context.value.availability.find((resource) => resource.family === "reviews" && resource.resource === "agenda")
    expect(agenda?.operations.filter((operation) => [agendaId, preserveId].includes(operation.operationId))).toEqual([
      { operationId: agendaId, state: "ready", reason: null, operational: true },
      { operationId: preserveId, state: "ready", reason: null, operational: true },
    ])
    expect(f.owner.dispatches).toBe(0)
    expect(await f.readState()).toEqual(before)
  } finally { await f.dispose() }
})

test("original policy retains agenda reads but requires the preservation action and reviews namespace", async () => {
  for (const [policy, expected] of [
    [{ preserve: false }, [agendaId]],
    [{ dashboard: false }, []],
    [{ reviews: false }, []],
  ] as const) {
    const f = await reviewFixture(policy)
    try {
      const before = await f.readState()
      expect((await f.observe()).map((operation) => operation.operationId)).toEqual([...expected])
      if ("preserve" in policy && policy.preserve === false) {
        const response = await f.fetch(new Request(origin + mount + "/dashboard?sf=dashboard-review-preserve", {
          method: "POST", headers: { origin, "content-type": "application/json" },
          body: JSON.stringify({ selectionRef: "not-selected", sectionRefs: ["section"] }),
        }))
        // The original human admission refuses before the producer resolves a selection.
        expect(response?.status).toBe(403)
      }
      expect(await f.readState()).toEqual(before)
    } finally { await f.dispose() }
  }
})

test("absent mount, stale stamp, foreign origin and aborted request never publish agenda readiness", async () => {
  const f = await reviewFixture()
  try {
    const before = await f.readState()
    f.owner.mounted = false
    expect(await f.fetch(new Request(origin + mount + "/dashboard?sf=dashboard-agenda"))).toBeUndefined()
    expect(await f.observe()).toEqual([])
    f.owner.mounted = true
    expect(await f.inRoot(() => observeSfReviewAgendaHealth({ ...f.input, binding: undefined }, f.original, f.admission.stamp))).toEqual([])
    expect(await f.inRoot(() => observeSfReviewAgendaHealth(f.input, f.original, { ...f.admission.stamp, accessRevision: "changed" }))).toEqual([])
    const foreign = new Request("https://foreign.example.test" + mount + "/api/ui/context")
    expect(await f.inRoot(() => observeSfReviewAgendaHealth(f.input, foreign, f.admission.stamp))).toEqual([])
    const abort = new AbortController()
    const aborted = new Request(f.original.url, { signal: abort.signal })
    abort.abort()
    expect(await f.inRoot(() => observeSfReviewAgendaHealth(f.input, aborted, f.admission.stamp))).toEqual([])
    expect(f.owner.dispatches).toBe(0)
    expect(await f.readState()).toEqual(before)
  } finally { await f.dispose() }
})

test("real revocation or router replacement during admission cannot publish a prior observation", async () => {
  for (const change of ["revoke", "replace-router"] as const) {
    const f = await reviewFixture()
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    try {
      const before = await f.readState()
      f.scheduling.beforeCommand = async () => { entered.resolve(); await release.promise }
      const pending = f.observe()
      await entered.promise
      if (change === "revoke") f.f.active.value = false
      if (change === "replace-router") f.owner.handler = f.createHandler()
      release.resolve()
      expect(await pending).toEqual([])
      f.scheduling.beforeCommand = undefined
      if (change === "replace-router") expect((await f.observe()).map((operation) => operation.operationId)).toEqual([agendaId, preserveId])
      expect(f.owner.dispatches).toBe(0)
      expect(await f.readState()).toEqual(before)
    } finally { release.resolve(); await f.dispose() }
  }
})
