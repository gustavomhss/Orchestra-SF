import { expect, test } from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { Location } from "@orchestra/core/location"
import { DashboardPortfolio } from "../../../../runtime/dashboard-portfolio.ts"
import { domain } from "../../../../runtime/procurement.ts"
import { object } from "../../../../runtime/contract.ts"
import { initialProcurementSettings } from "../../../../src/initial-settings.ts"
import { readProcurementQueueView } from "../../../../product/procurement/queue-view.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import type { SfHumanAction } from "../../../../product/integration/human-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import type { TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { createSfWorkRefIssuer } from "../../../../product/decision-memory/signal-work.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfMemoryServices } from "../../../../../../../apps/cli/src/sucafina-product/memory-services.ts"
import { createSfWorkSignals, deriveSfWorkRefKey } from "../../../../../../../apps/cli/src/sucafina-product/work-signals.ts"
import { createSfWorkDestinations } from "../../../../../../../apps/cli/src/sucafina-product/work-destinations.ts"
import { createSfWorkHttp } from "../../../../../../../apps/cli/src/sucafina-product/work-http.ts"
import { memoryFixture, memoryCase } from "./memory-fixture.ts"

const origin = "https://example.test", mount = "/sucafina"
const period = { start: "2026-01-01", end: "2026-12-31" }

function ok<T>(value: PortResult<T>, name: string): T {
  expect(value.status).toBe("ok")
  if (value.status !== "ok") throw new Error(`${name}: ${value.reason}`)
  return value.value
}

// Full C08/SQLite authority, actual case/selection/thread writes and canonical
// memory registry reads. No condition or accepted native receipt is fabricated.
// The separate memory fixture below declares its upstream scenario/criterion
// inputs; those are not evidence of native execution or global acceptance.
async function workFixture(options: { threadRead?: boolean; key?: Uint8Array } = {}) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-work-bridge-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(join(directory, "store"))
  const active = { value: true }, signingKey = options.key ?? randomBytes(32)
  const access = { procurement: true }
  const keyPath = join(directory, "asset-signing-key")
  await writeFile(keyPath, signingKey, { mode: 0o600 })
  const at = "2026-11-14T00:00:00Z"
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, createId: randomUUID,
    projectScope: createSfSourceScopeProjector(() => at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "person" }]
    snapshot.data.access = { person: { assigned: [], domains: [] }, other: { assigned: [], domains: [] } }
    snapshot.data.summaries = ["Executive Dashboard", "All Projects", "Hot Topics & Actions"]
    const result = DashboardPortfolio.domain.execute(snapshot, { id: "person", canWrite: true, roles: ["admin"] },
      { page: "All Projects", action: "save", version: 0, values: { name: "Current delivery", status: "In Progress", risk: "Low" } },
      { at, id: () => "work-project", directory: [{ id: "person", name: "Person" }, { id: "other", name: "Other" }] })
    if (!result.ok) throw new Error("Real Dashboard project unavailable")
    return { commit: true, value: undefined }
  })
  const grants: readonly SfHumanAction[] = ["collaboration.selection.create", "collaboration.thread.create", "collaboration.work.list",
    "collaboration.work.destination", "collaboration.confirmation.project", ...(options.threadRead === false ? [] : ["collaboration.thread.read" as const])]
  const open = (assetSigningKey: Uint8Array) => {
    const guards = { proposalCoverageWrites: new WeakSet<object>(), dashboardHostWrites: new WeakSet<object>(), procurementEvidenceWrites: new WeakSet<object>(),
      caseSelectionWrites: new WeakSet<object>(), threadHistoryWrites: new WeakSet<object>(), signalRegistryWrites: new WeakSet<object>() }
    const authority = createSfProductAuthority({ installationId: "installation", origin, policyVersion: "policy", ...guards,
      identity: () => ({ installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
      persistence, grants: ["person", "other"].map((principalRef) => ({ principalRef, namespaces: ["cases", "preferences", "threads", "relations", "confirmations", "outbox"] as const,
        operations: ["sf_case_draft", "sf_case_read", "sf_work_list", "sf_dashboard_read", "sf_request_read"], humanActions: grants })),
      createId: randomUUID, now: Date.now, commandIdentity: async () => randomUUID(),
      authenticate: async (request, context) => active.value && context && ["person", "other"].includes(request.headers.get("authorization") ?? "")
        ? { id: request.headers.get("authorization")!, canWrite: true, roles: context.surface === "procurement" && !access.procurement ? [] : [{ surface: context.surface, role: "admin" }] } : null,
      environment: async () => ({ at, id: randomUUID, directory: [{ id: "person", name: "Person" }, { id: "other", name: "Other" }] }),
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
      providerGeneration: async () => 1, authorizeDocument: async () => undefined })
    const business = createSfBusinessServices({ authority, persistence, ...guards })
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
    const memory = createSfMemoryServices({ authority, business, signalRegistryWrites: guards.signalRegistryWrites })
    const signals = createSfWorkSignals({ business, memory, origin, mount, workRefKey: deriveSfWorkRefKey("installation", assetSigningKey) })
    const destinations = createSfWorkDestinations({ authority, business, origin, mount })
    business.bindWorkBridge({ signals, destination: destinations.resolve })
    const http = createSfWorkHttp({ authority, destinations, origin, mount })
    const request = (url = `${origin}${mount}/dashboard`, actor = "person", method = "POST") => new Request(url, { method, headers: { origin, authorization: actor } })
    const admit = async (operation: string, payload: unknown, source = request()) => {
      const call = ok(await authority.ui.admit(source, operation, digestSfValue(payload)), "admission")
      if (!await authority.ui.validate(call, operation, digestSfValue(payload))) throw new Error("Actual UI admission unavailable")
      return call
    }
    const human = async <T>(action: SfHumanAction, payload: unknown, work: (call: TrustedUiContext) => Promise<PortResult<T>>) => {
      const call = ok(await authority.human.admit(request(), action, payload), action)
      try { return ok(await work(call), action) } finally { authority.human.finish(call) }
    }
    return { authority, business, memory, signals, destinations, http, request, admit, human }
  }
  const runtime = open(new Uint8Array(await readFile(keyPath)))
  return { ...runtime, directory, store, persistence, active, access, signingKey,
    reopen: async () => open(new Uint8Array(await readFile(keyPath))),
    dispose: async () => { runtime.business.dispose(); await store.dispose(); await rm(directory, { recursive: true, force: true }) } }
}

async function fixture(options: { threadRead?: boolean; key?: Uint8Array } = {}) {
  const runtime = await workFixture(options)
  const call = await runtime.admit("sf_dashboard_read", { page: "All Projects", period })
  const source = ok(await runtime.business.dashboardRecords.issue({ page: "All Projects", recordType: "projects", recordId: "work-project", fields: ["status"], period }, call), "source")
  runtime.authority.ui.finish(call)
  const draft = { objective: "Read current work", horizon: period, currency: "USD", criteria: ["Delivery is resolved"], sourceRefs: [source] }
  const caseCall = await runtime.admit("sf_case_draft", draft)
  const decision = ok(await runtime.business.cases.draft(draft, caseCall), "case")
  runtime.authority.ui.finish(caseCall)
  const selected = { caseRef: encodeCaseRef(decision), period, sourceRefs: [source] }
  const mutation = { expectedStorageVersion: 0, idempotencyKey: randomUUID() }
  const selection = await runtime.human("collaboration.selection.create", { draft: selected, mutation }, (context) => runtime.business.collaboration.caseSelection!.create(selected, mutation, context))
  const query = { selectionRef: selection.selectionRef, period }
  const threadDraft = { kind: "clarification" as const, sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version,
    period, recipientRef: "person", body: "Read this actual contextual question", evidenceRefs: [source] }
  const threadMutation = { expectedStorageVersion: 0, idempotencyKey: randomUUID() }
  const thread = await runtime.human("collaboration.thread.create", { draft: threadDraft, mutation: threadMutation }, (context) => runtime.business.collaboration.threads.create(threadDraft, threadMutation, context))
  const payload = { selection: query, actionRef: thread.id }
  const route = new URL(`${mount}/dashboard`, origin)
  for (const [key, value] of Object.entries({ sf: "work-item", selectionRef: query.selectionRef, start: period.start, end: period.end, actionRef: thread.id })) route.searchParams.set(key, value)
  return { ...runtime, decision, source, selection: query, thread, payload, route }
}

async function procurementFixture() {
  // Build the real Procurement source directly. An unrelated contextual thread
  // to another recipient is not a precondition for reading this approval work.
  const f = await workFixture()
  try {
    const actor = { id: "person", canWrite: true, roles: ["admin"], assigned: [], domains: [] }
    const environment = await f.authority.host.environment(f.request())
    const created = await f.persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "procurement", role: "admin", entra: "admins", version: 1, by: "person" }]
      snapshot.data.store = { settings: { ...initialProcurementSettings(), levels: [{ id: "L1", name: "Current approver", threshold: 0, holderId: "person" }] },
        requests: {}, suppliers: [], sup: [], issued: { pr: [], po: [] } }
      const result = domain.execute(snapshot, actor, { page: "Requests", action: "create", version: 0, values: { pr: {
        title: "Canonical Procurement destination", type: "service", description: "Current support renewal", estAmount: 100,
        costCenter: "IT", needBy: "2026-12-01", justification: "Continue support", recurring: false, expenseType: "OPEX",
      } } }, environment)
      return { commit: result.ok, value: result }
    })
    if (!created.ok) throw new Error(`Actual Procurement create refused: ${created.status}`)
    const recordId = object(created.value).number
    if (typeof recordId !== "string" || !recordId) throw new Error("Actual Procurement request identity absent")
    const mutate = async (action: "submit_pr" | "cancel") => {
      const result = await f.persistence.transaction("procurement", async (snapshot) => {
        const outcome = domain.execute(snapshot, actor, { page: "Requests", action, id: recordId,
          version: snapshot.versions[`requests:${recordId}`]?.version ?? 0, values: action === "cancel" ? { reason: "Actual source counterproof" } : {} }, environment)
        return { commit: outcome.ok, value: outcome }
      })
      if (!result.ok) throw new Error(`Actual Procurement ${action} refused: ${result.status}`)
    }
    await mutate("submit_pr")
    return { ...f, recordId, cancel: () => mutate("cancel") }
  } catch (error) { await f.dispose(); throw error }
}

// The C02 collection is ephemeral. After rebuilding the host this real queue
// producer issues a NEW selection; no old collection reference is restored.
// Its retained page period belongs only to its own UI call, never periods(key).
async function procurementQueue(runtime: Pick<Awaited<ReturnType<typeof fixture>>, "business" | "request">) {
  const issued: { selectionRef?: string; call?: TrustedUiContext } = {}
  const create = runtime.business.registry.createSelection
  runtime.business.registry.createSelection = async (call) => {
    const result = await create(call)
    if (result.status === "ok") {
      if (call.kind !== "ui") throw new Error("Queue did not admit an actual UI call")
      issued.selectionRef = result.value; issued.call = call
    }
    return result
  }
  try {
    const prepared = await runtime.business.procurementQueueView(runtime.request(`${origin}${mount}/procurement?page=Requests`, "person", "GET"), "procurement", "Requests")
    if (!prepared || prepared instanceof Response) throw new Error(`Actual queue unavailable: ${prepared?.status}`)
    const view = readProcurementQueueView(prepared.data.procurementQueueView)
    const row = view?.rows.find((entry) => entry.holder === "person")
    if (!issued.selectionRef || !issued.call || !row || row.status !== "pr_pending") { prepared.finish(); throw new Error("Actual approval work absent") }
    return { selection: { selectionRef: issued.selectionRef, period: structuredClone(row.projection.context.period) },
      actionRef: row.evidence.refId, recordId: row.id, queueCall: issued.call, finish: prepared.finish }
  } finally { runtime.business.registry.createSelection = create }
}

async function procurementSession() {
  const f = await procurementFixture()
  try {
    const reopened = await f.reopen()
    try {
      const queue = await procurementQueue(reopened)
      return { f, reopened, queue, dispose: async () => { queue.finish(); reopened.business.dispose(); await f.dispose() } }
    } catch (error) { reopened.business.dispose(); throw error }
  } catch (error) { await f.dispose(); throw error }
}

test("Procurement work reads an uninitialized C08 without writing and invalidates its witness on the first real commit", async () => {
  const { f, reopened, queue, dispose } = await procurementSession()
  try {
    const request = reopened.request(), payload = { selection: queue.selection, actionRef: queue.actionRef }
    const absent = () => reopened.authority.state.read(request, "threads", () => true)
    expect(await absent()).toMatchObject({ status: "unavailable", reason: "product-state-uninitialized" })
    const call = await reopened.admit("sf-human:collaboration.work.destination", payload, request)
    const opened = ok(await reopened.destinations.read(queue.selection, queue.actionRef, call), "Procurement before first C08 commit")
    expect(await opened.verify()).toBe(true)
    expect(await absent()).toMatchObject({ status: "unavailable", reason: "product-state-uninitialized" })
    const initialized = await reopened.authority.state.transaction(request, { namespace: "preferences", expectedStorageVersion: 0,
      targetRef: reopened.authority.creationTarget.ref, targetIncarnation: reopened.authority.creationTarget.incarnation,
      idempotencyKey: randomUUID(), commandDigest: digestSfValue({ purpose: "first-real-work-preference" }) }, async (state) => {
      state.preferences.workWitnessCounterproof = { first: true }
      return { commit: true, value: true }
    })
    expect(initialized.status).toBe("ok")
    expect(await reopened.authority.ui.revalidate(call)).toBe(true)
    expect(await opened.verify()).toBe(false)
    const fresh = ok(await reopened.destinations.read(queue.selection, queue.actionRef, call), "Procurement after first C08 commit")
    expect(await fresh.verify()).toBe(true)
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.__sfProductV1 = { schemaVersion: "corrupted-counterproof" }
      return { commit: true, value: undefined }
    })
    expect((await reopened.destinations.read(queue.selection, queue.actionRef, call)).status).not.toBe("ok")
    reopened.authority.ui.finish(call)
  } finally { await dispose() }
}, 120_000)

test("Procurement destination resolves a new canonical collection in a rebuilt host and new UI with no ambient period", async () => {
  const { f, reopened, queue, dispose } = await procurementSession()
  try {
    const payload = { selection: queue.selection, actionRef: queue.actionRef }
    const call = await reopened.admit("sf-human:collaboration.work.destination", payload)
    expect(call).not.toBe(queue.queueCall)
    // The queue's own retained context cannot supply a period to this new call.
    expect(await reopened.business.registry.resolveRequestCollection(queue.selection.selectionRef, call))
      .toMatchObject({ status: "unavailable", reason: "procurement-context-unavailable" })
    expect((await reopened.business.collaboration.work.listPresentation(queue.selection, call)).status).not.toBe("ok")
    const sourceReads: { ref: string; call: TrustedUiContext }[] = []
    const resolve = reopened.business.individual.resolve
    reopened.business.individual.resolve = async (ref, context) => {
      const result = await resolve(ref, context)
      if (context.kind === "ui" && reopened.authority.ui.matchesIntent(context, "sf_request_read", digestSfValue({ requestRef: ref }))) {
        expect(result.status).toBe("ok"); sourceReads.push({ ref, call: context })
      }
      return result
    }
    const located = ok(await reopened.business.collaboration.resolveWorkDestination(queue.selection, queue.actionRef, call), "canonical Procurement destination")
    expect(sourceReads.length).toBeGreaterThan(0)
    expect(sourceReads.every((entry) => entry.call !== call && !reopened.authority.ui.requestFor(entry.call))).toBe(true)
    expect(await reopened.authority.ui.revalidate(call)).toBe(true)
    expect(await reopened.business.registry.resolveRequestCollection(queue.selection.selectionRef, call))
      .toMatchObject({ status: "unavailable", reason: "procurement-context-unavailable" })
    reopened.authority.ui.finish(call)
    reopened.business.individual.resolve = resolve
    const direct = await reopened.admit("sf_request_read", { requestRef: sourceReads[0]!.ref })
    expect(await reopened.business.individual.resolve(sourceReads[0]!.ref, direct))
      .toMatchObject({ status: "unavailable", reason: "procurement-context-unavailable" })
    reopened.authority.ui.finish(direct)
    const response = await reopened.http(reopened.request(new URL(located.href, origin).href, "person", "GET"), "dashboard")
    expect(response?.status).toBe(200)
    const html = await response!.text()
    expect(html).toContain("Canonical Procurement destination")
    expect(html).toContain("2026-01-01")
    expect(html).toContain(`request=${encodeURIComponent(f.recordId)}`)
    expect(html).not.toContain("sf-human:")
  } finally { await dispose() }
}, 120_000)

test("Procurement destination refuses a different period, actor and actually changed source after its canonical positive", async () => {
  const { f, reopened, queue, dispose } = await procurementSession()
  try {
    const payload = { selection: queue.selection, actionRef: queue.actionRef }
    const call = await reopened.admit("sf-human:collaboration.work.destination", payload)
    const opened = ok(await reopened.destinations.read(queue.selection, queue.actionRef, call), "current Procurement item")
    expect(opened.view.item).toMatchObject({ kind: "procurement", actionRef: queue.actionRef, period,
      destination: { kind: "procurement-request", recordId: f.recordId } })
    expect(await opened.verify()).toBe(true)
    const different = { ...queue.selection, period: { ...period, start: "2026-02-01" } }
    const otherPeriod = await reopened.admit("sf-human:collaboration.work.destination", { selection: different, actionRef: queue.actionRef })
    expect((await reopened.destinations.read(different, queue.actionRef, otherPeriod)).status).not.toBe("ok")
    expect(await reopened.authority.ui.revalidate(otherPeriod)).toBe(true)
    reopened.authority.ui.finish(otherPeriod)
    const other = await reopened.admit("sf-human:collaboration.work.destination", payload, reopened.request(undefined, "other"))
    expect((await reopened.destinations.read(queue.selection, queue.actionRef, other)).status).not.toBe("ok")
    reopened.authority.ui.finish(other)
    await f.cancel()
    expect(f.active.value).toBe(true)
    expect(await reopened.authority.ui.revalidate(call)).toBe(true)
    expect(await opened.verify()).toBe(false)
    expect((await reopened.destinations.read(queue.selection, queue.actionRef, call)).status).not.toBe("ok")
    reopened.authority.ui.finish(call)
  } finally { await dispose() }
}, 120_000)

test("Procurement period scope rejects overlap and header replacement and cleans up after throw or lease finish", async () => {
  const { reopened, queue, dispose } = await procurementSession()
  try {
    const payload = { selection: queue.selection, actionRef: queue.actionRef }, request = reopened.request()
    const call = await reopened.admit("sf-human:collaboration.work.destination", payload, request)
    const read = () => reopened.business.registry.resolveRequestCollection(queue.selection.selectionRef, call)
    const scope = () => reopened.business.withProcurementWorkPeriod(call, payload, read)
    expect((await scope()).status).toBe("ok")
    expect((await read()).status).not.toBe("ok")
    let enter: () => void = () => {}, release: () => void = () => {}
    const entered = new Promise<void>((resolve) => { enter = resolve }), retained = new Promise<void>((resolve) => { release = resolve })
    const first = reopened.business.withProcurementWorkPeriod(call, payload, async () => {
      const result = await read(); enter(); await retained; return result
    })
    void first.then(enter, enter)
    await entered
    try {
      expect((await scope()).status).toBe("denied")
      const sibling = await reopened.admit("sf-human:collaboration.work.destination", payload, request)
      expect((await reopened.business.registry.resolveRequestCollection(queue.selection.selectionRef, sibling)).status).not.toBe("ok")
      reopened.authority.ui.finish(sibling)
    } finally { release() }
    expect((await first).status).toBe("ok")
    await expect(reopened.business.withProcurementWorkPeriod(call, payload, async () => {
      expect((await read()).status).toBe("ok"); throw new Error("after-real-collection-read")
    })).rejects.toThrow("after-real-collection-read")
    expect((await read()).status).not.toBe("ok")
    expect((await reopened.business.withProcurementWorkPeriod(call, payload, async () => {
      const result = await read(); expect(result.status).toBe("ok"); request.headers.set("x-work-counterproof", "changed"); return result
    })).status).toBe("denied")
    expect(await reopened.authority.ui.revalidate(call)).toBe(true) // unrelated header; the scope pin caused the refusal
    expect((await read()).status).not.toBe("ok")
    expect((await reopened.business.withProcurementWorkPeriod(call, payload, async () => {
      const result = await read(); expect(result.status).toBe("ok"); reopened.authority.ui.finish(call); return result
    })).status).toBe("denied")
    expect(reopened.authority.ui.requestFor(call)).toBeUndefined()
  } finally { await dispose() }
}, 120_000)

test("Procurement secondary read cleans both scopes on exception and refuses real access revocation before display", async () => {
  const { f, reopened, queue, dispose } = await procurementSession()
  try {
    const payload = { selection: queue.selection, actionRef: queue.actionRef }, request = reopened.request()
    const call = await reopened.admit("sf-human:collaboration.work.destination", payload, request)
    expect((await reopened.destinations.read(queue.selection, queue.actionRef, call)).status).toBe("ok")
    const resolve = reopened.business.individual.resolve
    const observed: { mode: "throw" | "revoke"; calls: TrustedUiContext[] } = { mode: "throw", calls: [] }
    reopened.business.individual.resolve = async (ref, context) => {
      const result = await resolve(ref, context)
      if (result.status === "ok" && context.kind === "ui" && reopened.authority.ui.matchesIntent(context, "sf_request_read", digestSfValue({ requestRef: ref }))) {
        observed.calls.push(context)
        if (observed.mode === "throw") throw new Error("after-actual-individual-read")
        f.access.procurement = false
      }
      return result
    }
    expect((await reopened.destinations.read(queue.selection, queue.actionRef, call)).status).toBe("unavailable")
    expect(observed.calls).toHaveLength(1)
    expect(reopened.authority.ui.requestFor(observed.calls[0]!)).toBeUndefined()
    expect(await reopened.authority.ui.revalidate(call)).toBe(true)
    expect(await reopened.business.registry.resolveRequestCollection(queue.selection.selectionRef, call))
      .toMatchObject({ status: "unavailable", reason: "procurement-context-unavailable" })
    observed.mode = "revoke"
    expect((await reopened.destinations.read(queue.selection, queue.actionRef, call)).status).toBe("denied")
    expect(observed.calls).toHaveLength(2)
    expect(observed.calls.every((context) => !reopened.authority.ui.requestFor(context))).toBe(true)
    expect(reopened.authority.ui.requestFor(call)).toBeUndefined()
    expect(request.headers.get("authorization")).toBe("person")
    expect(f.active.value).toBe(true)
  } finally { await dispose() }
}, 120_000)

test("actual C08 work composition opens a current thread and survives rebuilding the host with the same durable key", async () => {
  const f = await fixture()
  try {
    const read = await f.admit("sf-human:collaboration.work.list", { selection: f.selection })
    expect(await f.signals(f.selection.selectionRef, period, read)).toEqual({ status: "ok", signals: [] })
    expect(ok(await f.business.collaboration.work.listPresentation(f.selection, read), "work").items.some((item) => item.actionRef === f.thread.id)).toBe(true)
    expect((await f.business.selectedCase(read)).status).toBe("unavailable") // the private scope has been released
    const noKey = createSfWorkSignals({ business: f.business, memory: f.memory, origin, mount, workRefKey: undefined })
    expect(await noKey(f.selection.selectionRef, period, read)).toEqual({ status: "unavailable" })
    f.authority.ui.finish(read)
    const call = await f.admit("sf-human:collaboration.work.destination", f.payload)
    const located = ok(await f.business.collaboration.resolveWorkDestination(f.selection, f.thread.id, call), "destination")
    f.authority.ui.finish(call)
    expect(new URL(located.href, origin).pathname).toBe(`${mount}/dashboard`)
    const response = await f.http(f.request(new URL(located.href, origin).href, "person", "GET"), "dashboard")
    expect(response?.status).toBe(200)
    const html = await response!.text()
    expect(html).toContain("Read this actual contextual question")
    expect(html).toContain("page=All+Projects")
    expect(html).not.toContain("sf-human:")
    const reopened = await f.reopen()
    try {
      const call = await reopened.admit("sf-human:collaboration.work.destination", f.payload)
      expect(ok(await reopened.business.collaboration.resolveWorkDestination(f.selection, f.thread.id, call), "reopened destination")).toEqual(located)
      reopened.authority.ui.finish(call)
      expect((await reopened.http(reopened.request(new URL(located.href, origin).href, "person", "GET"), "dashboard"))?.status).toBe(200)
    } finally { reopened.business.dispose() }
  } finally { await f.dispose() }
}, 120_000)

test("an action ID, a different period or actor and missing exact content grant cannot bypass current work membership", async () => {
  const f = await fixture({ threadRead: false })
  try {
    const forbidden = await f.http(f.request(f.route.href, "person", "GET"), "dashboard")
    expect(forbidden?.status).toBe(403) // work.destination exists; thread.read does not
    const guessed = new URL(f.route); guessed.searchParams.set("actionRef", "another-real-looking-thread")
    expect((await f.http(f.request(guessed.href, "person", "GET"), "dashboard"))?.status).toBe(409)
    const periodChanged = new URL(f.route); periodChanged.searchParams.set("start", "2026-02-01")
    expect((await f.http(f.request(periodChanged.href, "person", "GET"), "dashboard"))?.status).toBe(409)
    expect((await f.http(f.request(f.route.href, "other", "GET"), "dashboard"))?.status).toBe(409)
    expect((await f.http(f.request(f.route.href, "person", "POST"), "dashboard"))?.status).toBe(405)
    const wrongMount = new URL(f.route); wrongMount.pathname = "/other/dashboard"
    expect((await f.http(f.request(wrongMount.href, "person", "GET"), "dashboard"))?.status).toBe(403)
  } finally { await f.dispose() }
}, 120_000)

test("the current work reader refuses a real session revocation after the canonical thread read", async () => {
  const f = await fixture()
  try {
    expect((await f.http(f.request(f.route.href, "person", "GET"), "dashboard"))?.status).toBe(200)
    const original = f.business.collaboration.threadReads.read
    let entered = 0
    f.business.collaboration.threadReads.read = async (...args) => {
      const found = await original(...args)
      if (found.status === "ok") { entered++; f.active.value = false }
      return found
    }
    const response = await f.http(f.request(f.route.href, "person", "GET"), "dashboard")
    expect(entered).toBeGreaterThan(0)
    expect(response?.status).toBe(403)
    expect(await response!.text()).not.toContain(f.thread.messages[0]!.body)
  } finally { await f.dispose() }
}, 120_000)

test("render egress rejects header replacement after the last real C08 work witness", async () => {
  const f = await fixture()
  try {
    const original = f.authority.state.read
    const observed: { count: number; target?: number } = { count: 0 }
    f.authority.state.read = async (request, namespace, read) => {
      const result = await original(request, namespace, read)
      if (namespace === "threads" && result.status === "ok" && typeof result.value === "string" && /^[a-f0-9]{64}$/.test(result.value)) {
        observed.count++
        if (observed.target === observed.count) request.headers.set("authorization", "other")
      }
      return result
    }
    expect((await f.http(f.request(f.route.href, "person", "GET"), "dashboard"))?.status).toBe(200)
    expect(observed.count).toBeGreaterThan(0)
    observed.target = observed.count; observed.count = 0
    const response = await f.http(f.request(f.route.href, "person", "GET"), "dashboard")
    expect(observed.count).toBe(observed.target)
    expect(response?.status).toBe(403)
    expect(await response!.text()).not.toContain(f.thread.messages[0]!.body)
    expect(f.active.value).toBe(true)
  } finally { await f.dispose() }
}, 120_000)

test("a complete C08 witness detects preference or case mutation with the same live Request", async () => {
  const f = await fixture()
  try {
    const call = await f.admit("sf-human:collaboration.work.destination", f.payload)
    const opened = ok(await f.destinations.read(f.selection, f.thread.id, call), "current item")
    expect(await opened.verify()).toBe(true)
    await f.persistence.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.preferences.workWitnessCounterproof = { changed: true }
      return { commit: true, value: undefined }
    })
    expect(await f.authority.host.revalidate(call)).toBe(true)
    expect(await opened.verify()).toBe(false)
    const again = ok(await f.destinations.read(f.selection, f.thread.id, call), "fresh invocation")
    expect(await again.verify()).toBe(true)
    await f.persistence.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.cases[f.decision.id]!.version++
      state.versions.cases++
      return { commit: true, value: undefined }
    })
    expect(await again.verify()).toBe(false)
    expect((await f.destinations.read(f.selection, f.thread.id, call)).status).not.toBe("ok")
    f.authority.ui.finish(call)
  } finally { await f.dispose() }
}, 120_000)

test("real registered C17 bindings have stable private work refs across key reload and isolated actor, case and key rotation", async () => {
  const first = await memoryFixture()
  const secondCase = { id: "another-case", incarnation: "another-incarnation", version: 1 }
  const second = await memoryFixture({ caseRef: secondCase, principalRef: "other" })
  try {
    expect(await first.register()).toEqual({ status: "ok" })
    expect(await second.register()).toEqual({ status: "ok" })
    const actual = await first.memory.registry.list(memoryCase, first.context)
    const other = await second.memory.registry.list(secondCase, second.context)
    if (actual.status !== "ok" || other.status !== "ok" || actual.records.length !== 1 || other.records.length !== 1) throw new Error("Actual condition records unavailable")
    const key = randomBytes(32)
    const derived = deriveSfWorkRefKey("installation", key)
    if (!derived) throw new Error("Durable private key unavailable")
    const issuer = createSfWorkRefIssuer({ key: derived, revalidate: (call) => call.kind === "ui" ? first.ui.revalidate(call) : Promise.resolve(false) })
    const firstRef = await issuer(actual.records[0]!, first.context)
    expect(firstRef).toMatch(/^work-v1-[a-f0-9]{64}$/)
    expect(firstRef).not.toContain(actual.records[0]!.id)
    const reloaded = createSfWorkRefIssuer({ key: deriveSfWorkRefKey("installation", new Uint8Array(key))!, revalidate: (call) => call.kind === "ui" ? first.ui.revalidate(call) : Promise.resolve(false) })
    expect(await reloaded(actual.records[0]!, first.context)).toBe(firstRef)
    const rotated = createSfWorkRefIssuer({ key: deriveSfWorkRefKey("installation", randomBytes(32))!, revalidate: (call) => call.kind === "ui" ? first.ui.revalidate(call) : Promise.resolve(false) })
    expect(await rotated(actual.records[0]!, first.context)).not.toBe(firstRef)
    const recipient = createSfWorkRefIssuer({ key: derived, revalidate: (call) => call.kind === "ui" ? second.ui.revalidate(call) : Promise.resolve(false) })
    expect(await recipient(actual.records[0]!, second.context)).toBeUndefined()
    expect(await recipient(other.records[0]!, second.context)).not.toBe(firstRef)
    expect(await first.memory.registry.list(secondCase, first.context)).toEqual({ status: "unavailable" })
    expect(deriveSfWorkRefKey("installation", undefined)).toBeUndefined()
    expect(deriveSfWorkRefKey("installation", new Uint8Array(16))).toBeUndefined()
    first.access.allowed = false
    expect(await issuer(actual.records[0]!, first.context)).toBeUndefined()
  } finally { await first.dispose(); await second.dispose() }
}, 120_000)
