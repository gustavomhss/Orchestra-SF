import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../src/sucafina-product/business-services.ts"
import { createSfPortfolioServices } from "../src/sucafina-product/portfolio-services.ts"
import { createSfBiServices } from "../src/sucafina-product/bi-services.ts"
import { createSfExtendedHttp } from "../src/sucafina-product/extended-http.ts"
import { createSfExtendedAssets } from "../src/sucafina-product/extended-assets.ts"
import { createSfProductAuthority } from "../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../modules/sucafina/Sucafinav1/product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationOutput } from "../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BiViewRequest } from "../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { DomainProjection } from "../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { dispatchBiPresentation } from "../../../modules/sucafina/Sucafinav1/product/analytics/consumer.ts"
import { sameBiProjection } from "../../../modules/sucafina/Sucafinav1/product/analytics/projection.ts"
import { domain } from "../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { object, rows } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor, Command, Environment } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"

const origin = "https://bi-observation.example.test"
const actorId = "bi-observation-reader"
const holderId = "bi-observation-approver"
const enteredAt = "2027-01-03T00:00:00.000Z"
const at = "2027-02-02T00:00:00.000Z"
const period = { start: "2027-01-01", end: "2027-12-31" }

function value<T>(result: PortResult<T>, step: string): T {
  if (result.status !== "ok") throw new Error(step + ": " + result.status + " (" + result.reason + ")")
  return result.value
}
function age(projection: DomainProjection) {
  const field = projection.values.find((entry) => entry.id.endsWith(":ageDays"))
  if (!field || typeof field.value !== "number") throw new Error("Original pending request omitted its proven age")
  expect(field.unit).toBe("days")
  expect(field.evidenceState).toBe("confirmed")
  return field.value
}

type Ui = <T>(operation: string, payload: unknown, work: (call: TrustedUiContext, request: Request) => Promise<T>,
  options?: { consume?: boolean; request?: Request }) => Promise<T>
type Fixture = {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  bi: ReturnType<typeof createSfBiServices>
  http: ReturnType<typeof createSfExtendedHttp>
  ui: Ui
  request: (query?: Record<string, string>, signal?: AbortSignal) => Request
  control: { authorized: boolean; role: string }
  clock: { next: number; fixedAt?: string; seen: Environment[]; hook?: (request: Request, environment: Environment) => void | Promise<void> }
  selected: BiViewRequest
  approve: () => Promise<void>
  originalDigest: () => Promise<string>
}

/** Derived from sucafina-case-read-scope's original local-store/authority fixture.
 * The bounded identity provider configures read policy; the original authority
 * issues and consumes every lease, grant check and receipt. The pending row is
 * created/submitted by original Procurement commands, never injected projections. */
async function withFixture<T>(work: (fixture: Fixture) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-bi-observation-"))
  const store = await openLocalStore(directory)
  let business: ReturnType<typeof createSfBusinessServices> | undefined
  const assets = createSfExtendedAssets()
  try {
    const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID,
      enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) }) }
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    const seedEnvironment = { at: enteredAt, id: randomUUID, directory: [] }
    const admin: Actor = { id: actorId, canWrite: true, roles: ["admin"] }
    const requester: Actor = { id: actorId, canWrite: true, roles: ["requester"] }
    const holder: Actor = { id: holderId, canWrite: true, roles: ["approver"] }
    const requestId = await persistence.transaction("procurement", async (snapshot) => {
      const execute = (actor: Actor, command: Command) => {
        const result = domain.execute(snapshot, actor, command, seedEnvironment)
        if (!result.ok) throw new Error("Original Procurement rejected fixture " + command.page + "/" + command.action)
        return result.value
      }
      execute(admin, { page: "Settings", action: "reset", version: 0, values: {} })
      execute(admin, { page: "Settings", action: "save", version: snapshot.versions.settings?.version ?? 0,
        values: { levels: [{ id: "L1", name: "Original pending fixture", threshold: 0, holderId }] } })
      const pr = { title: "BI observation original request", type: "service", description: "Producer-backed boundary fixture",
        estAmount: 500, costCenter: "IT", needBy: "2027-12-01", justification: "Observation proof", recurring: false, expenseType: "OPEX" }
      const created = object(execute(requester, { page: "Requests", action: "create", version: 0, values: { pr } }))
      if (typeof created.number !== "string") throw new Error("Original Procurement omitted request identity")
      execute(requester, { page: "Requests", action: "submit_pr", id: created.number,
        version: snapshot.versions["requests:" + created.number]?.version ?? 0, values: { pr } })
      expect(rows(domain.view(snapshot, admin, seedEnvironment).data.requests)[0]?.status).toBe("pr_pending")
      return { commit: true, value: created.number }
    })
    const requests = new WeakSet<Request>()
    const request = (query: Record<string, string> = {}, signal?: AbortSignal) => {
      const url = new URL(origin + "/sucafina/dashboard")
      for (const [key, entry] of Object.entries(query)) url.searchParams.set(key, entry)
      const incoming = new Request(url, { headers: { origin }, ...(signal ? { signal } : {}) })
      requests.add(incoming)
      return incoming
    }
    const control = { authorized: true, role: "admin" }
    const clock: Fixture["clock"] = { next: Date.parse(at), seen: [] }
    const identity = { installationId: "bi-observation-installation", hostId: "bi-observation-host",
      projectId: "bi-observation-project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const authority = createSfProductAuthority({
      identity: () => identity, installationId: identity.installationId, origin, policyVersion: "bi-observation-policy",
      persistence, proposalCoverageWrites: new WeakSet<object>(),
      grants: [{ principalRef: actorId, namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
        operations: ["sf_bi_view", "sf_dashboard_read", "sf_work_list"], humanActions: [] }],
      authenticate: async (incoming, scope) => requests.has(incoming) && control.authorized && scope
        ? { id: actorId, canWrite: true, roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : control.role }] } : null,
      environment: async (incoming) => {
        const sequence = clock.seen.length
        const observed: Environment = { at: clock.fixedAt ?? new Date(clock.next).toISOString(), id: randomUUID,
          directory: [{ id: actorId, name: "Live directory " + sequence }], bankKey: new Uint8Array([sequence % 256]) }
        clock.next += 1000
        clock.seen.push(observed)
        const hook = clock.hook
        clock.hook = undefined
        await hook?.(incoming, observed)
        return observed
      },
      createId: randomUUID, now: () => Date.now(), commandIdentity: async () => randomUUID(),
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
      providerGeneration: async () => 1, authorizeDocument: async () => undefined,
    })
    const canonical = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet<object>() })
    business = canonical
    canonical.initializeAtlas(undefined, { boundaryVersion: "bi-observation-fixture", schemaVersion: "bi-observation-fixture",
      manifestVersion: "bi-observation-fixture", skillVersion: "bi-observation-fixture" })
    const portfolio = createSfPortfolioServices({ authority, business: canonical, proposalCoverageWrites: new WeakSet<object>() })
    const bi = createSfBiServices({ authority, business: canonical, portfolio })
    const http = createSfExtendedHttp({ authority, business: canonical, bi, reviews: undefined, persistence, origin, assets })
    const ui: Ui = async (operation, payload, read, options = {}) => {
      const incoming = options.request ?? request(), digest = digestSfValue(payload)
      const call = value(await authority.ui.admit(incoming, operation, digest), "original UI admission")
      try {
        if (options.consume !== false) expect(await authority.ui.validate(call, operation, digest)).toBe(true)
        return await read(call, incoming)
      } finally { authority.ui.finish(call) }
    }
    const selection = await ui("sf_work_list", { purpose: "work-selection", period }, async (call) =>
      value(await canonical.procurementSelections.create(call, period), "original Procurement selection"))
    const selected: BiViewRequest = { viewId: "BI06", selectionRef: selection.selectionRef, period }
    const approve = async () => {
      await persistence.transaction("procurement", async (snapshot) => {
        const result = domain.execute(snapshot, holder, { page: "Requests", action: "approve", id: requestId,
          version: snapshot.versions["requests:" + requestId]?.version ?? 0, values: {} }, { ...seedEnvironment, at })
        if (!result.ok) throw new Error("Original Procurement rejected approval mutation control")
        return { commit: true, value: undefined }
      })
    }
    const originalDigest = () => persistence.transaction("procurement", async (snapshot) => ({
      commit: false, value: digestSfValue({ data: snapshot.data, versions: snapshot.versions, audit: snapshot.audit, notices: snapshot.notices }) }))
    return await work({ authority, business: canonical, bi, http, ui, request, control, clock, selected, approve, originalDigest })
  } finally {
    business?.dispose()
    assets.dispose()
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}

test("BI06 holds one real original at through C16 without changing exact values, while new invocations advance", async () => {
  await withFixture(async (fixture) => {
    const selected = fixture.selected, sameRequest = fixture.request()
    const before = await fixture.originalDigest()
    const raw = await fixture.ui("sf_bi_view", selected, (call) =>
      dispatchBiPresentation(selected, call, fixture.bi.source, fixture.authority.authority), { consume: false })
    expect(raw).toMatchObject({ status: "denied", reason: "access-changed" })
    const firstObservation = fixture.clock.seen.length
    const first = value(await fixture.ui("sf_bi_view", selected, (call) => fixture.bi.dispatchPresentation(selected, call),
      { consume: false, request: sameRequest }), "composed C16 BI06")
    expect(first.receipt.operation).toBe("sf_bi_view")
    expect(first.receipt.inputDigest).toBe(digestSfValue(selected))
    expect(fixture.clock.seen.length - firstObservation).toBeGreaterThan(2)
    const exactAge = age(first.projection)
    const observed = fixture.clock.seen.slice(firstObservation).find((entry) =>
      exactAge === (Date.parse(entry.at) - Date.parse(enteredAt)) / 86_400_000)
    expect(observed).toBeDefined()
    // Ask the unchanged original producer at that real recorded instant. Its
    // complete value/reference/missing arrays must match, not just the age cell.
    fixture.clock.fixedAt = observed!.at
    const canonical = value(await fixture.ui("sf_bi_view", selected, (call) => fixture.bi.source.read(selected, call)),
      "original producer at the captured observation")
    expect(sameBiProjection(canonical, first.projection)).toBe(true)
    fixture.clock.fixedAt = undefined
    const second = value(await fixture.ui("sf_bi_view", selected, (call) => fixture.bi.dispatchPresentation(selected, call),
      { consume: false, request: sameRequest }), "new original admission on the same Request")
    expect(age(second.projection)).toBeGreaterThan(exactAge)
    expect(second.receipt.callId).not.toBe(first.receipt.callId)
    const stock = { ...selected, viewId: "BI05" }
    expect(value(await fixture.ui("sf_bi_view", stock, (call) =>
      dispatchBiPresentation(stock, call, fixture.bi.source, fixture.authority.authority), { consume: false }),
      "unscoped BI05 control").projection.values[0]?.value).toBe(1)
    expect(await fixture.originalDigest()).toBe(before)
  })
}, 45_000)

test("original HTTP BI06 data and source links share their own admitted observation; source changes remain refused", async () => {
  await withFixture(async (fixture) => {
    const query = { viewId: "BI06", start: period.start, end: period.end }
    const options = await fixture.http(fixture.request({ sf: "bi-options", ...query }), "dashboard")
    expect(options?.status).toBe(200)
    const optionsBody = object(await options!.json())
    expect(optionsBody.status).toBe("ok")
    const choices = rows(object(optionsBody.value).choices)
    expect(choices).toHaveLength(1)
    const selectionRef = choices[0]!.selectionRef
    if (typeof selectionRef !== "string") throw new Error("Original options omitted the collection selection")
    const response = await fixture.http(fixture.request({ sf: "bi-data", ...query, selectionRef }), "dashboard")
    expect(response?.status).toBe(200)
    const result = decodeSfOperationOutput("sf_bi_view", object(await response!.json()).projection)
    if (!result.ok) throw new Error("Original HTTP BI06 response failed its unchanged codec")
    const field = result.value.values.find((entry) => entry.id.endsWith(":ageDays"))
    if (!field || !field.drilldown) throw new Error("Original aging field omitted its source")
    const source = { sf: "bi-source", ...query, selectionRef, valueId: field.id, referenceDigest: field.drilldown.refDigest }
    const linked = await fixture.http(fixture.request(source), "dashboard")
    expect(linked?.status).toBe(200)
    const links = rows(object(await linked!.json()).links)
    expect(links).toHaveLength(1)
    expect(String(links[0]!.url)).toContain("/orchestra/sf-procurement/requests?")
    const outside = await fixture.http(fixture.request({ ...source, referenceDigest: "f".repeat(64) }), "dashboard")
    expect(outside?.status).toBe(403)
    expect(await outside!.json()).toMatchObject({ status: "denied", reason: "bi-source-outside-selected-value" })
    const missing = await fixture.http(fixture.request({ ...source, valueId: "unissued-value" }), "dashboard")
    expect(missing?.status).toBe(409)
    expect(await missing!.json()).toMatchObject({ status: "unavailable", reason: "bi-value-source-unavailable" })
    await fixture.approve()
    const changed = await fixture.http(fixture.request({ sf: "bi-data", ...query, selectionRef }), "dashboard")
    if (!changed) throw new Error("Original BI data handler did not return a response after source mutation")
    expect([403, 409]).toContain(changed.status)
    expect(object(await changed.json()).status).not.toBe("ok")
  })
}, 45_000)

test("one original observation never hides source mutation between complete producer reads", async () => {
  await withFixture(async (fixture) => {
    const selected = fixture.selected
    const result = await fixture.ui("sf_bi_view", selected, (call) => fixture.business.biObservation.run(selected, call,
      { operation: "sf_bi_view", input: selected }, async () => {
        value(await fixture.bi.source.read(selected, call), "original source before mutation")
        await fixture.approve()
        return fixture.bi.source.read(selected, call)
      }))
    expect(result.status).not.toBe("ok")
    expect(["stale", "unavailable", "denied"]).toContain(result.status)
  })
}, 45_000)

test("live authorization, role changes and abort still invalidate BI06 across environment awaits", async () => {
  for (const change of ["revocation", "role", "abort"] as const) await withFixture(async (fixture) => {
    const abort = new AbortController()
    fixture.clock.hook = async () => {
      await Promise.resolve()
      if (change === "revocation") fixture.control.authorized = false
      if (change === "role") fixture.control.role = "viewer"
      if (change === "abort") abort.abort()
    }
    const result = await fixture.ui("sf_bi_view", fixture.selected, (call) =>
      fixture.bi.dispatchPresentation(fixture.selected, call), { consume: false, request: fixture.request({}, abort.signal) })
    expect(result.status).not.toBe("ok")
    expect(["denied", "unavailable"]).toContain(result.status)
  })
}, 45_000)

test("observation refuses unconsumed or mismatched intent and detects input changes at egress", async () => {
  await withFixture(async (fixture) => {
    for (const mismatch of ["unconsumed", "operation", "digest", "input"] as const) {
      const selected = structuredClone(fixture.selected)
      const result = await fixture.ui("sf_bi_view", selected, (call) => fixture.business.biObservation.run(selected, call,
        { operation: mismatch === "operation" ? "sf_dashboard_read" : "sf_bi_view",
          input: mismatch === "digest" ? { ...selected, selectionRef: "not-issued" } : selected }, async () => {
          const first = await fixture.bi.source.read(selected, call)
          if (mismatch === "input" && first.status === "ok") selected.period.end = "2027-11-30"
          return first
        }), { consume: mismatch !== "unconsumed" })
      expect(result.status).toBe("denied")
    }
  })
}, 45_000)

test("concurrent calls and escaped continuations cannot share a closed observation or stale environment fields", async () => {
  await withFixture(async (fixture) => {
    const selected = fixture.selected, sameRequest = fixture.request()
    const parallel = await Promise.all([0, 1].map(() => fixture.ui("sf_bi_view", selected, (call) =>
      fixture.bi.dispatchPresentation(selected, call), { consume: false, request: sameRequest })))
    const projections = parallel.map((result) => value(result, "independent original invocation").projection)
    expect(age(projections[0]!)).not.toBe(age(projections[1]!))
    await fixture.ui("sf_bi_view", selected, async (call, request) => {
      let release!: () => void
      const released = new Promise<void>((resolve) => { release = resolve })
      let escaped: Promise<PortResult<DomainProjection>> | undefined
      const completed = value(await fixture.business.biObservation.run(selected, call, { operation: "sf_bi_view", input: selected },
        async () => {
          const original = await fixture.bi.source.read(selected, call)
          escaped = released.then(() => fixture.bi.source.read(selected, call))
          const environments = await fixture.business.biObservation.read(selected.selectionRef, call, async () => ({
            status: "ok", value: [await fixture.business.biObservation.environment(request), await fixture.business.biObservation.environment(request)],
          }))
          const live = value(environments, "live original environment fields")
          expect(live[0]!.at).toBe(live[1]!.at)
          expect(live[0]!.directory).not.toEqual(live[1]!.directory)
          expect(live[0]!.bankKey).not.toEqual(live[1]!.bankKey)
          return original
        }), "completed observation")
      release()
      const after = value(await escaped!, "escaped original producer after closure")
      expect(age(after)).toBeGreaterThan(age(completed))
      const later = value(await fixture.bi.source.read(selected, call), "subsequent unscoped producer")
      expect(age(later)).toBeGreaterThan(age(after))
    }, { request: sameRequest })
  })
}, 45_000)

test("observation cannot cross replacement of its original host or provider functions", async () => {
  for (const replacement of ["host", "environment", "requestFor", "revalidate", "matchesIntent"] as const) {
    await withFixture(async (fixture) => {
      const host = fixture.authority.host, ui = fixture.authority.ui
      const original = { environment: host.environment, requestFor: host.requestFor,
        revalidate: host.revalidate, matchesIntent: ui.matchesIntent }
      // Each substitute delegates to the same original provider. A fixed fixture
      // clock isolates composition identity from the separately-proven age drift.
      const replace = async () => {
        await Promise.resolve()
        if (replacement === "host") fixture.authority.host = { ...host }
        if (replacement === "environment") host.environment = (request) => original.environment(request)
        if (replacement === "requestFor") host.requestFor = (call) => original.requestFor(call)
        if (replacement === "revalidate") host.revalidate = (call) => original.revalidate(call)
        if (replacement === "matchesIntent") ui.matchesIntent = (call, operation, digest) => original.matchesIntent(call, operation, digest)
      }
      for (const scoped of [false, true]) {
        fixture.clock.fixedAt = at
        fixture.clock.hook = replace
        try {
          const result = await fixture.ui("sf_bi_view", fixture.selected, (call) => scoped
            ? fixture.bi.dispatchPresentation(fixture.selected, call)
            : dispatchBiPresentation(fixture.selected, call, fixture.bi.source, fixture.authority.authority), { consume: false })
          // C16 maps a refused first source revalidation to its original reason.
          // The unscoped control proves that the same live provider bytes remain
          // valid; only carrying an observation across their replacement is refused.
          if (scoped) expect(result).toMatchObject({ status: "denied", reason: "binding-unavailable" })
          else expect(age(value(result, "original unscoped provider replacement control").projection)).toBeGreaterThan(0)
          expect(fixture.clock.hook).toBeUndefined()
        } finally {
          fixture.authority.host = host
          host.environment = original.environment
          host.requestFor = original.requestFor
          host.revalidate = original.revalidate
          ui.matchesIntent = original.matchesIntent
        }
      }
    })
  }
}, 45_000)
