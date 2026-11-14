import { expect, test } from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { Location } from "@orchestra/core/location"
import { DashboardPortfolio } from "../../../../runtime/dashboard-portfolio.ts"
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
async function fixture(options: { threadRead?: boolean; key?: Uint8Array } = {}) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-work-bridge-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(join(directory, "store"))
  const active = { value: true }, signingKey = options.key ?? randomBytes(32)
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
        ? { id: request.headers.get("authorization")!, canWrite: true, roles: [{ surface: context.surface, role: "admin" }] } : null,
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
  return { ...runtime, directory, store, persistence, active, signingKey, decision, source, selection: query, thread, payload, route,
    reopen: async () => open(new Uint8Array(await readFile(keyPath))),
    dispose: async () => { runtime.business.dispose(); await store.dispose(); await rm(directory, { recursive: true, force: true }) } }
}

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
