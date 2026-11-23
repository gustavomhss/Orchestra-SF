import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence, plannerScopeAuthority, plannerScopePreparation } from "../../../../product/integration/source-lifecycle.ts"
import type { SfScopedSourcePort } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector, sfPlannerProjectionSelector } from "../../../../product/integration/source-projections.ts"
import { createPlannerProduct } from "../../../../product/planner/product.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { Actor, Snapshot } from "../../../../runtime/contract.ts"

const at = "2027-02-02T00:00:00Z"
const origin = "https://planner-preparation.example.test"
const unrelated = "Planner source preparation must leave domain bytes private. ".repeat(2048)

async function withFixture(work: (fixture: Awaited<ReturnType<typeof createFixture>>) => Promise<void>) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-planner-preparation-"))
  const store = await openLocalStore(path.join(directory, "store"))
  try {
    const fixture = await createFixture(store, directory)
    try { await work(fixture) }
    finally { fixture.authority.ui.finish(fixture.call) }
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}

async function createFixture(store: Awaited<ReturnType<typeof openLocalStore>>, directory: string) {
  const root = store.readSnapshotRoot
  if (!root) throw new Error("The original SQLite readonly root is required")
  const calls = { prepare: 0, authorize: 0, project: 0, authenticate: 0 }
  const project = createSfSourceScopeProjector(() => at)
  const sources = createSfSourcePersistence({
    persistence: store, createId: randomUUID, enumerate: enumerateSfSources,
    projectScope: (...args: Parameters<typeof project>) => { calls.project++; return project(...args) },
  })
  const persistence = { ...store, ...sources }
  await sources.initializeSources("dashboard")
  await sources.initializeSources("planner")
  await sources.initializeSources("procurement")
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data = {
      versions: [{ id: "v0", name: "Original preparation source", year: 2027, closed: 1,
        lines: [{ id: "line", name: "Service", ownerId: "person", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(120), a: [100, ...Array(11).fill(null)], f: [null, ...Array(11).fill(120)] }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
      officials: { "2027": "v0" }, entities: [], allocations: [], roster: [], unrelated,
      roleMap: [{ surface: "planner", role: "finance", version: 1, by: "fixture", entra: null }],
      access: { person: { assigned: ["line"], domains: ["opex"] } },
    }
    return { commit: true, value: undefined }
  })
  const request = new Request(origin + "/planner", { method: "POST", headers: { origin } })
  const identity = { installationId: "preparation-installation", hostId: "preparation-host", projectId: "preparation-project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const authority = createSfProductAuthority({
    identity: () => identity, installationId: identity.installationId, origin, policyVersion: "preparation-policy",
    persistence, grants: [{ principalRef: "person", namespaces: ["cases", "preferences"],
      operations: ["sf_case_read", "sf_evidence_get"], humanActions: [] }],
    authenticate: async (incoming, scope) => {
      calls.authenticate++
      return incoming === request && scope ? { id: "person", canWrite: true,
        roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null
    },
    environment: async () => ({ at, id: randomUUID, directory: [] }), createId: randomUUID, now: Date.now,
    commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined,
  })
  const caseRef = { id: "preparation-case", incarnation: "preparation-incarnation", version: 1 }
  const created = await authority.state.transaction(request, {
    namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref,
    targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "preparation-case",
    commandDigest: digestSfValue(caseRef),
  }, async (state) => {
    state.cases[caseRef.id] = { ...caseRef, state: "investigating", objective: "Observe original Planner preparation",
      horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: [], participants: ["person"],
      sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [],
      preparedChanges: [], receipts: [], ledger: [] }
    return { commit: true, value: true }
  })
  if (created.status !== "ok") throw new Error("The original C08 fixture did not initialize")
  const digest = digestSfValue({})
  const admitted = await authority.ui.admit(request, "sf_case_read", digest)
  if (admitted.status !== "ok" || !await authority.ui.validate(admitted.value, "sf_case_read", digest))
    throw new Error("The original UI authority did not admit the fixture")
  const call = admitted.value
  const planner = createPlannerProduct({ host: authority.host, scopedSources: persistence,
    coverageFor: async () => ({ status: "unavailable", reason: "fixture-does-not-produce-coverage" }) })
  const issued = await planner.issueSource("v0", call)
  if (issued.status !== "ok") throw new Error("The original Planner source was not issued")
  const reader = sources.readScopedSourcePrepared
  if (!reader) throw new Error("The original prepared source reader is required")
  const read = (prepare: Parameters<NonNullable<SfScopedSourcePort["readScopedSourcePrepared"]>>[1]) =>
    reader("planner", prepare, { signal: request.signal })
  const prepare = (hooks: {
    prepared?: (snapshot: Pick<Snapshot, "data">) => void | Promise<void>
    authorized?: (snapshot: Pick<Snapshot, "data">) => void | Promise<void>
  } = {}) => plannerScopePreparation(async (snapshot) => {
    calls.prepare++
    const principal = await authority.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
    if (!principal || principal.id !== call.binding.principalRef) return undefined
    const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
    const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") }
    const selector = sfPlannerProjectionSelector(snapshot, actor)
    await hooks.prepared?.(snapshot)
    return {
      scope: { principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision,
        policyVersion: call.binding.policyVersion, recordType: "planner-version", recordId: "v0", selector },
      authorize: plannerScopeAuthority(async (snapshot) => {
        calls.authorize++
        const principal = await authority.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
        if (!principal || principal.id !== call.binding.principalRef) return false
        const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
        const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") }
        const matches = digestSfValue(sfPlannerProjectionSelector(snapshot, actor)) === digestSfValue(selector)
        await hooks.authorized?.(snapshot)
        return matches
      }),
    }
  })
  return { store, sources, persistence, root, calls, authority, call, planner, source: issued.value.evidence, prepare, read }
}

test("Planner preparation copies only admitted ACL data while original sources, callbacks and copies remain fresh", async () => {
  await withFixture(async (fixture) => {
    const original = await fixture.read(fixture.prepare())
    if (!original) throw new Error("The original complete preparation did not resolve")
    const originalDigest = digestSfValue(original)
    await fixture.root(async () => {
      const before = { ...fixture.calls }
      const copies: Record<string, unknown>[] = []
      const observed = await fixture.read(fixture.prepare({
        prepared: (snapshot) => {
          expect(Object.keys(snapshot.data).sort()).toEqual(["access", "roleMap"])
          snapshot.data.roleMap = []
          snapshot.data.access = {}
          snapshot.data.preparationMutation = true
        },
        authorized: (snapshot) => {
          copies.push(structuredClone(snapshot.data))
          snapshot.data.roleMap = []
          snapshot.data.authorizationMutation = true
        },
      }))
      expect(observed).toEqual(original)
      expect(digestSfValue(observed)).toBe(originalDigest)
      expect(fixture.calls.prepare - before.prepare).toBe(1)
      expect(fixture.calls.authorize - before.authorize).toBe(2)
      expect(fixture.calls.project - before.project).toBe(1)
      expect(copies).toHaveLength(2)
      expect(copies[0]).toEqual(copies[1])
      expect(copies[0]).toHaveProperty("roleMap.0.role", "finance")
      expect(copies[0]).not.toHaveProperty("preparationMutation")
      expect(copies[1]).not.toHaveProperty("authorizationMutation")
      const live = fixture.store.currentSnapshot?.("planner")
      expect(live?.data.unrelated).toBe(unrelated)
      expect(live?.data.versions).toHaveLength(1)
      expect(live?.data).not.toHaveProperty("preparationMutation")
      expect(live?.data).not.toHaveProperty("authorizationMutation")
      // Exercise the installed factory too; both original source observations
      // still project and authenticate instead of returning this completed read.
      const producerBefore = { ...fixture.calls }
      const resolved = await fixture.planner.sources.resolveForecastSource(fixture.source.refId, fixture.call)
      expect(resolved).toEqual({ status: "ok", value: { versionId: "v0", evidence: fixture.source } })
      expect(fixture.calls.project - producerBefore.project).toBe(2)
      expect(fixture.calls.authenticate - producerBefore.authenticate).toBeGreaterThanOrEqual(6)
      if (observed?.projection && typeof observed.projection === "object")
        Object.assign(observed.projection, { name: "Mutated returned copy" })
      expect(await fixture.read(fixture.prepare())).toEqual(original)
    })
  })
}, 45_000)

test("unknown Planner preparation wrappers and non-readonly roots retain the complete Snapshot", async () => {
  await withFixture(async (fixture) => {
    let complete = 0
    const registered = fixture.prepare({ prepared: (snapshot) => {
      expect(snapshot.data.unrelated).toBe(unrelated)
      expect(snapshot.data.versions).toHaveLength(1)
      expect(Object.hasOwn(snapshot, "sfSources")).toBe(true)
      complete++
    } })
    // Even an explicitly registered preparer has no readonly capability here.
    const original = await fixture.read(registered)
    if (!original) throw new Error("The original complete preparation did not resolve")
    const wrapped: Parameters<typeof fixture.read>[0] = (snapshot) => registered(snapshot)
    await fixture.root(async () => {
      const before = { ...fixture.calls }
      expect(await fixture.read(wrapped)).toEqual(original)
      expect(fixture.calls.prepare - before.prepare).toBe(1)
      expect(fixture.calls.authorize - before.authorize).toBe(2)
      expect(fixture.calls.project - before.project).toBe(1)
    })
    expect(complete).toBe(2)
  })
}, 45_000)

test("Planner preparation preserves the full-copy error and observes a clone installed during its await", async () => {
  await withFixture(async (fixture) => {
    const original = await fixture.read(fixture.prepare())
    if (!original) throw new Error("The original complete preparation did not resolve")
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "structuredClone")
    if (!descriptor || !Object.hasOwn(descriptor, "value")) throw new Error("The original clone descriptor is required")
    const clone = structuredClone
    const sentinel = new Error("Original complete snapshot copy failed")
    let getterCalls = 0, cloneCalls = 0
    let argument: unknown
    await fixture.root(async () => {
      const before = { ...fixture.calls }
      let caught: unknown
      // A global accessor is necessary to exercise the actual copy boundary.
      Object.defineProperty(globalThis, "structuredClone", { configurable: true, get() {
        getterCalls++
        return (value: unknown) => { cloneCalls++; argument = value; throw sentinel }
      } })
      try { await fixture.read(fixture.prepare()) }
      catch (error) { caught = error }
      finally { Object.defineProperty(globalThis, "structuredClone", descriptor) }
      expect(caught).toBe(sentinel)
      expect(getterCalls).toBe(1)
      expect(cloneCalls).toBe(1)
      expect(argument).toHaveProperty("data.unrelated", unrelated)
      expect(argument).toHaveProperty("sfSources")
      expect(fixture.calls.prepare).toBe(before.prepare)
      expect(fixture.calls.authorize).toBe(before.authorize)
      expect(fixture.calls.project).toBe(before.project)
    })
    await fixture.root(async () => {
      const before = { ...fixture.calls }
      const argumentsSeen: unknown[] = []
      try {
        const observed = await fixture.read(fixture.prepare({ prepared: async (snapshot) => {
          expect(Object.keys(snapshot.data).sort()).toEqual(["access", "roleMap"])
          Object.defineProperty(globalThis, "structuredClone", { ...descriptor, value(value: unknown) {
            argumentsSeen.push(value)
            return clone(value)
          } })
          await Promise.resolve()
        } }))
        expect(observed).toEqual(original)
        expect(fixture.calls.prepare - before.prepare).toBe(1)
        expect(fixture.calls.authorize - before.authorize).toBe(2)
        expect(fixture.calls.project - before.project).toBe(1)
        expect(argumentsSeen[0]).toHaveProperty("recordType", "planner-version")
        expect(argumentsSeen.some((value) => !!value && typeof value === "object" && Object.hasOwn(value, "sfSources"))).toBe(true)
      } finally { Object.defineProperty(globalThis, "structuredClone", descriptor) }
    })
  })
}, 45_000)
