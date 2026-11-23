import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { createCurrentChoiceFence, currentChoiceReadonlyAuthorityData } from "../../../../product/decisions/current-choice-preview.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence, currentSfPlannerReadonlySnapshotScope, currentSfReadonlyAuthorityData,
  currentSfReadonlySnapshotScope, plannerScopeAuthority } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector, sfPlannerProjectionSelector } from "../../../../product/integration/source-projections.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import type { BlobTransaction } from "../../../../runtime/assets.ts"
import { object, rows } from "../../../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../../../runtime/contract.ts"
import { currentLocalReadonlyAuthorityData, openLocalStore } from "../../../../runtime/local-store.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type Hooks = {
  prepare?: (snapshot: Snapshot) => void | Promise<void>
  authorize?: (snapshot: Pick<Snapshot, "data">, invocation: number) => void | Promise<void>
}

async function fixture(deadline: ReturnType<typeof compositionTestDeadline>) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-current-choice-source-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(path.join(directory, "store"))
  deadline.own(() => store.dispose())
  if (!store.readSnapshotRoot || !store.transactionAll || !store.holdTargetPreimage)
    throw new Error("Canonical LocalStore observation capabilities unavailable")
  const readRoot = store.readSnapshotRoot
  const all = store.transactionAll
  const holdPreimage = store.holdTargetPreimage
  const at = "2027-02-02T00:00:00Z"
  const control = { active: true }
  const installed: { authority?: ReturnType<typeof createSfProductAuthority> } = {}
  const identity = {
    installationId: "current-choice-source", hostId: "host", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }),
  }
  const fenceInput = {
    persistence: store,
    host: () => {
      if (!installed.authority) throw new Error("Original product authority unavailable")
      return installed.authority.host
    },
    identity: () => identity,
    operationIdentity: (context: TrustedDomainContext) =>
      context.kind === "ui" ? installed.authority?.ui.operationIdentity(context) : undefined,
  }
  const fence = createCurrentChoiceFence(fenceInput)
  const projector = createSfSourceScopeProjector(() => at)
  const projectionHooks: { after?: (snapshot: Snapshot) => void } = {}
  const sourceInput: Parameters<typeof createSfSourcePersistence>[0] = {
    persistence: fence.persistence, enumerate: enumerateSfSources, createId: randomUUID,
    projectScope: (surface, snapshot, scope) => {
      const projected = projector(surface, snapshot, scope)
      projectionHooks.after?.(snapshot)
      return projected
    },
  }
  const sources = createSfSourcePersistence(sourceInput)
  const persistence = { ...store, ...fence.persistence, ...sources }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data = {
      roleMap: [{ surface: "planner", role: "finance", entra: "Finance", version: 1, by: "fixture" }],
      access: { person: { assigned: [], domains: [], proof: { value: "original" } } },
      privateFixtureValue: "retained",
      versions: [{ id: "v0", name: "CurrentChoice source fixture", year: 2027, closed: 1,
        lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(120), a: [100, ...Array(11).fill(null)], f: [null, ...Array(11).fill(120)] }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
      officials: { "2027": "v0" }, entities: [], allocations: [], roster: [],
    }
    return { commit: true, value: undefined }
  })
  const authority = createSfProductAuthority({
    identity: () => identity, installationId: identity.installationId, origin: "https://example.test",
    policyVersion: "current-choice-source-policy", persistence,
    grants: [{ principalRef: "person", namespaces: ["cases", "preferences"], operations: ["sf_forecast_compare"], humanActions: [] }],
    authenticate: async (_request, scope) => {
      deadline.check()
      return control.active && scope ? { id: "person", canWrite: true,
        roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null
    },
    environment: async () => { deadline.check(); return { at, id: randomUUID, directory: [] } },
    createId: randomUUID, now: Date.now, commandIdentity: async () => randomUUID(),
    inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => 1,
    authorizeDocument: async () => undefined,
  })
  installed.authority = authority
  const withCall = async <T>(work: (context: TrustedUiContext) => Promise<T>) => {
    const request = new Request("https://example.test/planner", {
      method: "POST", signal: deadline.signal, headers: { origin: "https://example.test" },
    })
    const digest = digestSfValue({})
    const admitted = await authority.ui.admit(request, "sf_forecast_compare", digest)
    if (admitted.status !== "ok" || !await authority.ui.validate(admitted.value, "sf_forecast_compare", digest))
      throw new Error("Canonical UI admission unavailable")
    try { return await work(admitted.value) } finally { authority.ui.finish(admitted.value) }
  }
  const read = async (context: TrustedUiContext, hooks: Hooks = {}, registered = true, source = sources) => {
    const request = authority.host.requestFor(context)
    if (!request || !source.readScopedSourcePrepared) throw new Error("Canonical prepared source reader unavailable")
    const actor = async (snapshot: Pick<Snapshot, "data">): Promise<Actor | undefined> => {
      const principal = await authority.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal || principal.id !== context.binding.principalRef) return undefined
      const roles = principal.roles.filter((row) => row.surface === "planner").map((row) => row.role)
      return { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") }
    }
    return source.readScopedSourcePrepared("planner", async (snapshot) => {
      const principal = await actor(snapshot)
      if (!principal) return undefined
      const selector = sfPlannerProjectionSelector(snapshot, principal)
      const scope = { principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision,
        policyVersion: context.binding.policyVersion, recordType: "planner-version", recordId: "v0", selector }
      await hooks.prepare?.(snapshot)
      let invocation = 0
      const authorize = async (observed: Pick<Snapshot, "data">) => {
        const current = await actor(observed)
        const allowed = !!current && digestSfValue(sfPlannerProjectionSelector(observed, current)) === digestSfValue(selector)
        await hooks.authorize?.(observed, ++invocation)
        return allowed
      }
      return { scope, authorize: registered ? plannerScopeAuthority(authorize) : authorize }
    }, { signal: request.signal })
  }
  const observe = (hooks: Hooks = {}, registered = true, source = sources) =>
    withCall((context) => readRoot(() => fence.run(context, () => read(context, hooks, registered, source)), { signal: deadline.signal }))
  const snapshot = () => all(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
  return { store, readRoot, holdPreimage, control, fenceInput, fence, sourceInput, sources, persistence,
    projectionHooks, withCall, read, observe, snapshot }
}

function descriptor(owner: object, name: string) {
  const value = Object.getOwnPropertyDescriptor(owner, name)
  if (!value || !Object.hasOwn(value, "value")) throw new Error("Expected original own data method: " + name)
  return value
}

// Real SQLite, the installed factory chain and the original Planner projector
// provide the positive reference. Negative callbacks never manufacture a source.
test("CurrentChoice prepared sources preserve canonical values and close owner, callback and readonly boundaries", async () => {
  const deadline = compositionTestDeadline("current-choice-source-authority")
  try {
    const f = await deadline.phase("native-source-fixture", () => fixture(deadline))
    const expected = await f.withCall((context) => f.fence.run(context, () => f.read(context)))
    expect(expected).toBeDefined()
    if (!expected) throw new Error("Original Planner projection unavailable")
    const before = await f.snapshot()

    await deadline.phase("readonly-forwarder-and-legacy-parity", async () => {
      const visible: string[][] = []
      expect(await f.observe({ authorize: (snapshot) => { visible.push(Object.keys(snapshot.data).sort()) } })).toEqual(expected)
      expect(visible).toEqual([["access", "roleMap"], ["access", "roleMap"]])
      const legacy = createSfSourcePersistence({ ...f.sourceInput, persistence: { ...f.fence.persistence } })
      const complete: boolean[] = []
      expect(await f.observe({ authorize: (snapshot) => { complete.push(Object.hasOwn(snapshot.data, "versions")) } }, true, legacy)).toEqual(expected)
      expect(complete).toEqual([true, true])
      expect(await f.observe({}, false)).toEqual(expected)
      const retained = await f.readRoot(async () => {
        const first = currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])
        const canonical = currentLocalReadonlyAuthorityData(f.store, ["planner"])
        expect(first?.snapshots).toEqual(canonical?.snapshots)
        expect(first?.current()).toBe(true)
        expect(currentLocalReadonlyAuthorityData(f.fence.persistence, ["planner"])).toBeUndefined()
        const spread = { ...f.fence.persistence }
        const traps = { count: 0 }
        const proxy = new Proxy(f.fence.persistence, { get() { traps.count++; throw new Error("Proxy must not be inspected") } })
        expect(currentChoiceReadonlyAuthorityData(spread, ["planner"])).toBeUndefined()
        expect(currentChoiceReadonlyAuthorityData(proxy, ["planner"])).toBeUndefined()
        expect(traps.count).toBe(0)
        const opaque = createCurrentChoiceFence({ ...f.fenceInput, persistence: { ...f.store } })
        expect(currentChoiceReadonlyAuthorityData(opaque.persistence, ["planner"])).toBeUndefined()
        if (!first) throw new Error("Exact factory owner was not recognized")
        object(object(first.snapshots.planner.data.access).person).proof = { value: "caller mutation" }
        expect(currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])?.snapshots).toEqual(canonical?.snapshots)
        return first
      })
      expect(() => retained.current()).toThrow("Local transaction scope has ended")
      expect(currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])).toBeUndefined()
    })

    await deadline.phase("planner-scope-uses-only-the-native-source-composition", async () => {
      const retained = await f.readRoot(async () => {
        const native = currentLocalReadonlyAuthorityData(f.store, [])?.scope
        const scope = currentSfPlannerReadonlySnapshotScope(f.persistence)
        expect(native).toBeDefined()
        expect(scope?.identity).toBe(native?.identity)
        expect(scope?.bytesIdentity).toBe(native?.bytesIdentity)
        expect(scope?.current()).toBe(true)
        expect(currentSfReadonlyAuthorityData(f.persistence, ["planner"])).toBeUndefined()
        expect(currentSfReadonlySnapshotScope(f.persistence)).toBeUndefined()
        expect(currentSfPlannerReadonlySnapshotScope(f.fence.persistence)).toBeUndefined()
        expect(currentSfPlannerReadonlySnapshotScope({ ...f.fence.persistence })).toBeUndefined()
        expect(currentSfPlannerReadonlySnapshotScope({})).toBeUndefined()
        for (const method of ["currentSnapshot", "readSnapshotRoot"] as const) {
          const original = descriptor(f.persistence, method)
          const pinned = currentSfPlannerReadonlySnapshotScope(f.persistence)
          expect(pinned?.current()).toBe(true)
          Object.defineProperty(f.persistence, method, { ...original, value: () => undefined })
          try {
            expect(pinned?.current()).toBe(false)
            if (method !== "readSnapshotRoot")
              expect(currentSfPlannerReadonlySnapshotScope(f.persistence)).toBeUndefined()
          } finally { Object.defineProperty(f.persistence, method, original) }
          expect(pinned?.current()).toBe(false)
        }
        const owner = f.sourceInput.persistence
        const pinned = currentSfPlannerReadonlySnapshotScope(f.persistence)
        f.sourceInput.persistence = { ...owner }
        try {
          expect(pinned?.current()).toBe(false)
          expect(currentSfPlannerReadonlySnapshotScope(f.persistence)).toBeUndefined()
        } finally { f.sourceInput.persistence = owner }
        expect(pinned?.current()).toBe(false)
        const fresh = currentSfPlannerReadonlySnapshotScope(f.persistence)
        if (!fresh) throw new Error("Native Planner source scope unavailable")
        expect(fresh.current()).toBe(true)
        return fresh
      })
      expect(() => retained.current()).toThrow("Local transaction scope has ended")
      expect(currentSfPlannerReadonlySnapshotScope(f.persistence)).toBeUndefined()
    })

    await deadline.phase("fresh-preparation-authorization-and-projector-copies", async () => {
      const copies: Pick<Snapshot, "data">[] = []
      f.projectionHooks.after = (snapshot) => { snapshot.data.privateFixtureValue = "projector mutation" }
      try {
        expect(await f.observe({
          prepare: (snapshot) => { snapshot.data.privateFixtureValue = "prepare mutation" },
          authorize: (snapshot) => {
            expect(Object.hasOwn(snapshot.data, "privateFixtureValue")).toBe(false)
            expect(object(object(object(snapshot.data.access).person).proof).value).toBe("original")
            copies.push(snapshot)
            object(object(object(snapshot.data.access).person).proof).value = "authorization mutation"
            rows(snapshot.data.roleMap)[0]!.entra = "Changed by callback"
          },
        })).toEqual(expected)
      } finally { f.projectionHooks.after = undefined }
      expect(copies).toHaveLength(2)
      expect(copies[0]).not.toBe(copies[1])
      expect(copies[0]!.data).not.toBe(copies[1]!.data)
      expect(await f.observe()).toEqual(expected)
      expect(await f.snapshot()).toEqual(before)
      await expect(f.observe({ authorize: (snapshot) => {
        snapshot.data.privateFixtureValue = "opaque mutation"
      } }, false)).rejects.toThrow("SF_SOURCE_SCOPE_CALLBACK_MUTATION")
      expect(await f.snapshot()).toEqual(before)
    })

    await deadline.phase("owner-and-method-pins-are-monotonic", async () => {
      const methods = ["currentSnapshots", "currentSnapshot", "hasCurrentSnapshots", "transaction",
        "transactionAll", "readSnapshotRoot", "currentSnapshotScope"] as const
      await f.readRoot(async () => {
        for (const owner of [f.store, f.fence.persistence]) {
          for (const method of methods) {
            const original = descriptor(owner, method)
            const observation = currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])
            expect(observation?.current()).toBe(true)
            Object.defineProperty(owner, method, { ...original, value: () => { throw new Error("Replaced method must not be invoked") } })
            try {
              expect(observation?.current()).toBe(false)
              expect(currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])).toBeUndefined()
            } finally { Object.defineProperty(owner, method, original) }
            expect(observation?.current()).toBe(false)
            expect(currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])?.current()).toBe(true)
          }
          const prototype = Object.getPrototypeOf(owner)
          const observation = currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])
          Object.setPrototypeOf(owner, null)
          try {
            expect(observation?.current()).toBe(false)
            expect(currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])).toBeUndefined()
          } finally { Object.setPrototypeOf(owner, prototype) }
          expect(observation?.current()).toBe(false)
        }
        for (const [owner, key] of [[f.fence.persistence, "currentSnapshot"], [f.fenceInput, "persistence"]] as const) {
          const original = descriptor(owner, key)
          const getter = { calls: 0 }
          const observation = currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])
          Object.defineProperty(owner, key, { configurable: true, enumerable: true, get() { getter.calls++; return original.value } })
          try {
            expect(observation?.current()).toBe(false)
            expect(currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])).toBeUndefined()
            expect(getter.calls).toBe(0)
          } finally { Object.defineProperty(owner, key, original) }
        }
        const original = f.fenceInput.persistence
        const observation = currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])
        f.fenceInput.persistence = { ...original }
        try {
          expect(observation?.current()).toBe(false)
          expect(currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])).toBeUndefined()
        } finally { f.fenceInput.persistence = original }
        expect(observation?.current()).toBe(false)
        const prototype = Object.getPrototypeOf(f.fenceInput)
        const changedPrototype = currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])
        Object.setPrototypeOf(f.fenceInput, null)
        try {
          expect(changedPrototype?.current()).toBe(false)
          expect(currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])).toBeUndefined()
        } finally { Object.setPrototypeOf(f.fenceInput, prototype) }
        expect(changedPrototype?.current()).toBe(false)
      })
      expect(await f.observe()).toEqual(expected)
    })

    await deadline.phase("prepared-reader-refuses-provider-substitution-and-revocation", async () => {
      const owner = f.sourceInput.persistence
      let authorizations = 0
      try {
        const refused = await f.observe({
          prepare: async () => { await Promise.resolve(); f.sourceInput.persistence = { ...owner } },
          authorize: () => { authorizations++ },
        })
        expect(refused).toBeUndefined()
        expect(authorizations).toBe(0)
      } finally { f.sourceInput.persistence = owner }
      try {
        await expect(f.observe({ authorize: (_snapshot, invocation) => {
          if (invocation === 1) f.control.active = false
        } })).rejects.toThrow("SF_CURRENT_CHOICE_FENCE_CHANGED")
      } finally { f.control.active = true }
      expect(await f.observe()).toEqual(expected)
      expect(await f.snapshot()).toEqual(before)
    })

    await deadline.phase("nested-writes-poison-the-root-despite-a-caught-error", async () => {
      for (const kind of ["record", "blob"] as const) {
        const invoked = { writes: 0, authorizations: 0 }
        await expect(f.withCall((context) => f.readRoot(() => f.read(context, {
          authorize: async (_snapshot, invocation) => {
            invoked.authorizations++
            if (invocation !== 1) return
            const ordinary = currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])
            const strict = currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])
            const planner = currentSfPlannerReadonlySnapshotScope(f.persistence)
            expect(planner?.current()).toBe(true)
            expect(ordinary?.current()).toBe(true)
            expect(strict?.current("unpoisoned")).toBe(true)
            const attack = f.fence.persistence.transaction("planner", async (snapshot, blobs) => {
              invoked.writes++
              if (kind === "blob") {
                await expect(blobs.put("forbidden", new Uint8Array([1]), "application/octet-stream"))
                  .rejects.toThrow("Nested blob writes are forbidden")
                return { commit: false, value: undefined }
              }
              snapshot.data.privateFixtureValue = "forbidden"
              return { commit: true, value: undefined }
            })
            await expect(attack).rejects.toThrow(kind === "record" ? "Nested local writes are forbidden" : "Nested local write attempted")
            expect(ordinary?.current()).toBe(true)
            expect(strict?.current("unpoisoned")).toBe(false)
            expect(planner?.current()).toBe(false)
            expect(strict?.current()).toBe(false)
            expect(currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])?.current()).toBe(true)
          },
        })))).rejects.toThrow("Nested local write attempted")
        expect(invoked).toEqual({ writes: 1, authorizations: 2 })
      }
      expect(await f.snapshot()).toEqual(before)
      await f.store.transaction("planner", async (_snapshot: Snapshot, blobs: BlobTransaction) => {
        expect(await blobs.get("forbidden")).toBeUndefined()
        return { commit: false, value: undefined }
      })
      expect(await f.observe()).toEqual(expected)
    })

    await deadline.phase("writable-preimage-and-aborted-scopes-keep-their-original-boundaries", async () => {
      await f.store.transaction("planner", async () => {
        expect(currentLocalReadonlyAuthorityData(f.store, ["planner"])).toBeUndefined()
        expect(currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])).toBeUndefined()
        return { commit: false, value: undefined }
      })
      const preimage = f.holdPreimage()
      try {
        await f.store.transaction("dashboard", async () => {
          expect(preimage.current()).toBe(true)
          expect(currentLocalReadonlyAuthorityData(f.store, ["planner"])).toBeUndefined()
          expect(currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])).toBeUndefined()
          return { commit: false, value: undefined }
        }, { targetPreimageCurrent: preimage.current })
      } finally { preimage.release() }
      const abort = new AbortController()
      await expect(f.readRoot(async () => {
        const observation = currentChoiceReadonlyAuthorityData(f.fence.persistence, ["planner"])
        expect(observation?.current()).toBe(true)
        abort.abort(new Error("Fixture observation aborted"))
        expect(() => observation?.current()).toThrow("Fixture observation aborted")
      }, { signal: abort.signal })).rejects.toThrow("Fixture observation aborted")
      expect(await f.observe()).toEqual(expected)
      expect(await f.snapshot()).toEqual(before)
    })
  } finally { await deadline.close() }
}, 120_000)

test("Planner readonly proofs pin source factory inputs without changing canonical source reads", async () => {
  const deadline = compositionTestDeadline("planner-source-factory-pins")
  try {
    const f = await deadline.phase("native-source-fixture", () => fixture(deadline))
    const expected = await f.withCall((context) => f.fence.run(context, () => f.read(context)))
    if (!expected) throw new Error("The original Planner projection is required")
    const before = await f.snapshot(), originalProjector = f.sourceInput.projectScope
    if (!originalProjector) throw new Error("The original source projector is required")
    const directInput = { ...f.sourceInput, persistence: f.store }
    const directSources = createSfSourcePersistence(directInput)
    const direct = { ...f.store, ...directSources }
    const compositions = [
      { input: f.sourceInput, owner: f.persistence, sources: f.sources, generic: false },
      { input: directInput, owner: direct, sources: directSources, generic: true },
    ]
    const genericCurrent = (entry: (typeof compositions)[number]) => {
      const acl = currentSfReadonlyAuthorityData(entry.owner, ["planner"])
      const scope = currentSfReadonlySnapshotScope(entry.owner)
      if (entry.generic) {
        expect(acl?.current()).toBe(true)
        expect(scope?.current()).toBe(true)
      } else {
        expect(acl).toBeUndefined()
        expect(scope).toBeUndefined()
      }
      return { acl, scope }
    }
    const fields = ["projectScope", "enumerate", "createId", "purpose", "bootstrapOnWrite", "observeAuthority",
      "hasSnapshotRoot", "holdTargetPreimage", "installedDashboardProjector"] as const
    await deadline.phase("declared-input-drift-is-planner-only-and-monotonic", async () => {
      for (const entry of compositions) for (const field of fields) {
        const retained = await f.withCall((context) => f.readRoot(async () => {
          const admitted = currentSfPlannerReadonlySnapshotScope(entry.owner)
          if (!admitted) throw new Error("The original Planner factory was not admitted")
          expect(admitted.current()).toBe(true)
          const generic = genericCurrent(entry)
          const original = Object.getOwnPropertyDescriptor(entry.input, field)
          let invoked = 0
          const replacement = field === "purpose" ? "business-restore" : field === "bootstrapOnWrite" ? true :
            (...args: unknown[]) => {
              invoked++
              return typeof original?.value === "function" ? Reflect.apply(original.value, undefined, args) : undefined
            }
          Object.defineProperty(entry.input, field, { configurable: true, enumerable: true, writable: true, value: replacement })
          try {
            expect(currentSfPlannerReadonlySnapshotScope(entry.owner)).toBeUndefined()
            expect(admitted.current()).toBe(false)
            genericCurrent(entry)
            if (entry.generic) {
              expect(generic.acl?.current()).toBe(true)
              expect(generic.scope?.current()).toBe(true)
            }
            expect(invoked).toBe(0)
            if (field === "projectScope") {
              // No proof is admitted. The actual original source route still
              // invokes the substituted callback and returns the complete value.
              expect(await f.fence.run(context, () => f.read(context, {}, true, entry.sources))).toEqual(expected)
              expect(invoked).toBeGreaterThan(0)
            }
          } finally {
            if (original) Object.defineProperty(entry.input, field, original)
            else expect(Reflect.deleteProperty(entry.input, field)).toBe(true)
          }
          expect(admitted.current()).toBe(false)
          expect(currentSfPlannerReadonlySnapshotScope(entry.owner)?.current()).toBe(true)
          return admitted
        }, { signal: deadline.signal }))
        // Native closure checks still precede even a previously failed pin.
        expect(() => retained.current()).toThrow("Local transaction scope has ended")
      }
    })
    await deadline.phase("projector-accessor-drift-does-not-run-the-getter", async () => {
      for (const entry of compositions) await f.withCall((context) => f.readRoot(async () => {
        const original = descriptor(entry.input, "projectScope")
        const admitted = currentSfPlannerReadonlySnapshotScope(entry.owner)
        if (!admitted) throw new Error("The original Planner factory was not admitted")
        let gets = 0
        Object.defineProperty(entry.input, "projectScope", { configurable: true, enumerable: true,
          get: () => { gets++; return original.value } })
        try {
          expect(currentSfPlannerReadonlySnapshotScope(entry.owner)).toBeUndefined()
          expect(admitted.current()).toBe(false)
          genericCurrent(entry)
          expect(gets).toBe(0)
          expect(await f.fence.run(context, () => f.read(context, {}, true, entry.sources))).toEqual(expected)
          expect(gets).toBeGreaterThan(0)
        } finally { Object.defineProperty(entry.input, "projectScope", original) }
        expect(admitted.current()).toBe(false)
        expect(currentSfPlannerReadonlySnapshotScope(entry.owner)?.current()).toBe(true)
      }, { signal: deadline.signal }))
    })
    await deadline.phase("opaque-birth-keeps-only-the-original-producer", async () => {
      for (const kind of ["accessor", "projector-proxy", "input-proxy"] as const) {
        let calls = 0
        const original: Parameters<typeof createSfSourcePersistence>[0] = { ...f.sourceInput, persistence: f.store }
        if (kind === "accessor") Object.defineProperty(original, "projectScope", { configurable: true, enumerable: true,
          get: () => { calls++; return originalProjector } })
        if (kind === "projector-proxy") original.projectScope = new Proxy(originalProjector, {
          apply: (target, receiver, args) => { calls++; return Reflect.apply(target, receiver, args) },
        })
        const opaque = kind === "input-proxy" ? new Proxy(original, {
          get: (target, key, receiver) => { calls++; return Reflect.get(target, key, receiver) },
          getPrototypeOf: (target) => { calls++; return Reflect.getPrototypeOf(target) },
          getOwnPropertyDescriptor: (target, key) => { calls++; return Reflect.getOwnPropertyDescriptor(target, key) },
        }) : original
        const source = createSfSourcePersistence(opaque), owner = { ...f.store, ...source }
        const beforeProbe = calls
        await f.withCall((context) => f.readRoot(async () => {
          expect(currentSfPlannerReadonlySnapshotScope(owner)).toBeUndefined()
          if (kind === "input-proxy") {
            expect(currentSfReadonlyAuthorityData(owner, ["planner"])).toBeUndefined()
            expect(currentSfReadonlySnapshotScope(owner)).toBeUndefined()
          } else {
            expect(currentSfReadonlyAuthorityData(owner, ["planner"])?.current()).toBe(true)
            expect(currentSfReadonlySnapshotScope(owner)?.current()).toBe(true)
          }
          expect(calls).toBe(beforeProbe)
          expect(await f.fence.run(context, () => f.read(context, {}, true, source))).toEqual(expected)
          expect(calls).toBeGreaterThan(beforeProbe)
        }, { signal: deadline.signal }))
      }
    })
    expect(f.sourceInput.projectScope).toBe(originalProjector)
    expect(await f.observe()).toEqual(expected)
    expect(await f.snapshot()).toEqual(before)
  } finally { await deadline.close() }
}, 120_000)
