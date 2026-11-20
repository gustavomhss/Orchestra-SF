import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import type { Surface } from "../../../../src/identity.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence, currentSfReadonlyAuthorityData } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { initializeAbsentSfProductState } from "../../../../product/host-binding/state-provider.ts"

const surfaces = ["dashboard", "planner", "procurement"] as const
type AuthorityInput = Parameters<typeof createSfProductAuthority>[0]
type AdmissionMark = { auth: number; getters: number; copies: number; receivers: number }

async function fixture(work: (value: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
  const value = await setup()
  try { await work(value) } finally { await value.store.dispose(); await rm(value.directory, { recursive: true, force: true }) }
}

async function setup() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-authority-projection-"))
  const store = await openLocalStore(join(directory, "store"))
  const sourceInput: Parameters<typeof createSfSourcePersistence>[0] = { persistence: store, enumerate: enumerateSfSources, createId: randomUUID }
  const persistence = { ...store, ...createSfSourcePersistence(sourceInput) }
  for (const surface of surfaces) await persistence.initializeSources(surface)
  await initializeAbsentSfProductState(persistence, randomUUID)
  const calls: Array<{ surface: Surface; roleMap: unknown; request: Request }> = []
  const getters: number[] = [], copies: number[] = [], receivers: unknown[] = []
  const boundaries: Array<AdmissionMark & { request: Request; operation: string; inputDigest: string }> = []
  const mark = (): AdmissionMark => ({ auth: calls.length, getters: getters.length, copies: copies.length, receivers: receivers.length })
  const control: { active: boolean; role: string; hook?: (surface: Surface) => Promise<void> | void } = { active: true, role: "viewer" }
  const controller = new AbortController()
  const request = new Request("https://example.test/product", { signal: controller.signal })
  const identity = { installationId: "authority-projection", hostId: "host", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const input: AuthorityInput = { identity: () => identity, installationId: identity.installationId, origin: "https://example.test",
    policyVersion: "projection-policy", persistence, grants: [{ principalRef: "person", namespaces: ["cases"], operations: ["sf_context_get"] }],
    now: Date.now, createId: randomUUID, authenticate: async (original, scope) => {
      if (!scope) return null
      calls.push({ surface: scope.surface, roleMap: structuredClone(scope.roleMap), request: original })
      await control.hook?.(scope.surface)
      return control.active ? { id: "person", canWrite: true, roles: [{ surface: scope.surface, role: control.role }] } : null
    },
    environment: async () => ({ at: "2027-02-02T00:00:00Z", id: randomUUID, directory: [] }),
    commandIdentity: async (original, operation, inputDigest) => {
      // The existing callback separates both complete authorization rounds.
      boundaries.push({ ...mark(), request: original, operation, inputDigest })
      return "projection-command"
    },
    inspectSession: async () => undefined,
    verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => 1,
    authorizeDocument: async () => undefined }
  const product = createSfProductAuthority(input)
  return { directory, store, persistence, sourceInput, input, product, calls, control, request, controller,
    getters, copies, receivers, boundaries, mark }
}

function admissionRounds(f: Awaited<ReturnType<typeof setup>>, before: AdmissionMark, after: AdmissionMark) {
  expect(before.auth).toBe(0)
  expect(f.boundaries).toHaveLength(1)
  const boundary = f.boundaries[0]
  if (!boundary) throw new Error("Real commandIdentity boundary unavailable")
  expect(boundary.request).toBe(f.request)
  expect(boundary.operation).toBe("sf_context_get")
  expect(boundary.inputDigest).toBe("a".repeat(64))
  const first = f.calls.slice(before.auth, boundary.auth), second = f.calls.slice(boundary.auth, after.auth)
  expect([...first, ...second]).toEqual(f.calls.slice(before.auth, after.auth))
  expect(first.every((call) => call.request === f.request)).toBe(true)
  expect(second.every((call) => call.request === f.request)).toBe(true)
  return { first, second, boundary }
}

test("real authority keeps all three authentications and identical admission revisions on projected and full reads", async () => {
  await fixture(async (f) => {
    const before = f.mark()
    const baseline = await f.product.ui.admit(f.request, "sf_context_get", "a".repeat(64))
    expect(baseline.status).toBe("ok")
    if (baseline.status !== "ok") throw new Error("Baseline admission unavailable")
    const observed = admissionRounds(f, before, f.mark())
    const originalCalls = observed.first
    expect(originalCalls.map((call) => call.surface)).toEqual([...surfaces])
    expect(observed.second.map((call) => call.surface)).toEqual([...surfaces])
    expect(observed.second).toEqual(originalCalls)
    await f.store.readSnapshotRoot!(async () => {
      const revalidateStart = f.mark()
      expect(currentSfReadonlyAuthorityData(f.persistence, surfaces)?.current()).toBe(true)
      expect(await f.product.ui.revalidate(baseline.value)).toBe(true)
      const revalidated = f.calls.slice(revalidateStart.auth)
      expect(revalidated).toEqual(originalCalls)
      expect(f.calls.every((call) => call.request === f.request)).toBe(true)
      expect(f.boundaries).toHaveLength(1)
      expect([...originalCalls, ...observed.second, ...revalidated]).toEqual(f.calls.slice(before.auth))
      const stateStart = f.mark()
      const result = await f.product.state.read(f.request, "cases", () => "read callback")
      expect(result.status).toBe("ok")
      if (result.status === "ok") expect(result.value).toBe("read callback")
      const stateCalls = f.calls.slice(stateStart.auth)
      expect(stateCalls.map((call) => call.surface)).toEqual([...surfaces, ...surfaces])
      expect([...originalCalls, ...observed.second, ...revalidated, ...stateCalls]).toEqual(f.calls.slice(before.auth))
    })
    f.product.ui.finish(baseline.value)
  })
})

test("ACL changes between fresh roots revoke existing authority without changing other-principal semantics", async () => {
  await fixture(async (f) => {
    await f.persistence.transaction("planner", async (snapshot) => {
      snapshot.data.access = { person: { assigned: ["one"], domains: ["finance"] }, other: { assigned: ["irrelevant"] } }
      return { commit: true, value: undefined }
    })
    const admitted = await f.product.ui.admit(f.request, "sf_context_get", "a".repeat(64))
    if (admitted.status !== "ok") throw new Error("Admission unavailable")
    try {
      await f.persistence.transaction("planner", async (snapshot) => {
        snapshot.data.access = { person: { assigned: ["one"], domains: ["finance"] }, other: { assigned: ["changed"] } }
        return { commit: true, value: undefined }
      })
      expect(await f.store.readSnapshotRoot!(() => f.product.ui.revalidate(admitted.value))).toBe(true)
      await f.persistence.transaction("planner", async (snapshot) => {
        snapshot.data.access = { person: { assigned: [], domains: [] } }
        return { commit: true, value: undefined }
      })
      expect(await f.store.readSnapshotRoot!(() => f.product.ui.revalidate(admitted.value))).toBe(false)
      const fresh = await f.store.readSnapshotRoot!(() => f.product.ui.admit(f.request, "sf_context_get", "b".repeat(64)))
      expect(fresh.status).toBe("ok")
      if (fresh.status === "ok") f.product.ui.finish(fresh.value)
    } finally { f.product.ui.finish(admitted.value) }
  })
})

for (const change of ["consumer", "source", "driver", "composite"] as const) test(`an awaited ${change} owner change denies admission without a legacy retry`, async () => {
  await fixture(async (f) => {
    const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    const count = { fallbacks: 0 }
    f.control.hook = async (surface) => { if (surface === "dashboard") entered.resolve(); await release.promise }
    const all = f.persistence.currentSnapshots!
    const one = f.store.currentSnapshot!
    const pending = f.store.readSnapshotRoot!(() => f.product.ui.admit(f.request, "sf_context_get", "a".repeat(64)))
    await entered.promise
    if (change === "consumer") f.input.persistence = { ...f.persistence, currentSnapshots: () => { count.fallbacks++; return all() } }
    if (change === "source") f.sourceInput.persistence = { ...f.store, currentSnapshots: () => { count.fallbacks++; return f.store.currentSnapshots!() } }
    if (change === "driver") f.store.currentSnapshot = (surface) => { count.fallbacks++; return one(surface) }
    if (change === "composite") f.persistence.currentSnapshots = () => { count.fallbacks++; return all() }
    release.resolve()
    const result = await pending
    expect(result.status).toBe("denied")
    expect(f.calls.map((call) => call.surface)).toEqual([...surfaces])
    expect(count.fallbacks).toBe(0)
  })
})

test("opaque input getters and wrappers retain their actual full-copy path", async () => {
  await fixture(async (f) => {
    const current = f.persistence.currentSnapshots!
    const wrapped = { ...f.persistence, currentSnapshots: () => { f.copies.push(f.copies.length + 1); return current() } }
    const opaque = { ...f.input, get persistence() { f.getters.push(f.getters.length + 1); return wrapped } }
    const product = createSfProductAuthority(opaque)
    await f.store.readSnapshotRoot!(async () => {
      // Construction accesses stay before this original measurement boundary.
      const before = f.mark()
      expect(before.copies).toBe(0)
      const admitted = await product.ui.admit(f.request, "sf_context_get", "a".repeat(64))
      expect(admitted.status).toBe("ok")
      const after = f.mark(), observed = admissionRounds(f, before, after)
      const firstGetters = f.getters.slice(before.getters, observed.boundary.getters)
      const secondGetters = f.getters.slice(observed.boundary.getters, after.getters)
      const firstCopies = f.copies.slice(before.copies, observed.boundary.copies)
      const secondCopies = f.copies.slice(observed.boundary.copies, after.copies)
      expect(firstGetters.length).toBe(2)
      expect(firstCopies.length).toBe(1)
      expect(observed.first.map((call) => call.surface)).toEqual([...surfaces])
      expect(secondGetters.length).toBe(2)
      expect(secondCopies.length).toBe(1)
      expect(observed.second.map((call) => call.surface)).toEqual([...surfaces])
      expect([...firstGetters, ...secondGetters]).toEqual(f.getters.slice(before.getters, after.getters))
      expect([...firstCopies, ...secondCopies]).toEqual(f.copies.slice(before.copies, after.copies))
      if (admitted.status === "ok") product.ui.finish(admitted.value)
    })
  })
})

test("revocation and abort during real authentication remain refusals after all three callbacks start", async () => {
  await fixture(async (f) => {
    const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    f.control.hook = async (surface) => { if (surface === "dashboard") entered.resolve(); await release.promise }
    const pending = f.store.readSnapshotRoot!(() => f.product.ui.admit(f.request, "sf_context_get", "a".repeat(64)))
    await entered.promise
    f.control.active = false
    release.resolve()
    expect((await pending).status).toBe("denied")
    expect(f.calls.map((call) => call.surface)).toEqual([...surfaces])
    f.control.active = true
    delete f.control.hook
    f.calls.length = 0
    const abortEntered = Promise.withResolvers<void>(), abortRelease = Promise.withResolvers<void>()
    f.control.hook = async (surface) => { if (surface === "dashboard") abortEntered.resolve(); await abortRelease.promise }
    const aborted = f.store.readSnapshotRoot!(async () => {
      const result = await f.product.ui.admit(f.request, "sf_context_get", "b".repeat(64))
      expect(result.status).toBe("denied")
    }, { signal: f.controller.signal })
    await abortEntered.promise
    f.controller.abort(new Error("authority projection aborted"))
    abortRelease.resolve()
    await expect(aborted).rejects.toThrow("authority projection aborted")
    expect(f.calls.map((call) => call.surface)).toEqual([...surfaces])
  })
})

test("an already poisoned root still authenticates before its original publication fence rejects", async () => {
  await fixture(async (f) => {
    await expect(f.store.readSnapshotRoot!(async () => {
      await f.store.transaction("planner", async () => ({ commit: true, value: undefined })).catch(() => undefined)
      const before = f.mark()
      const admitted = await f.product.ui.admit(f.request, "sf_context_get", "a".repeat(64))
      expect(admitted.status).toBe("ok")
      const observed = admissionRounds(f, before, f.mark())
      expect(observed.first.map((call) => call.surface)).toEqual([...surfaces])
      expect(observed.second.map((call) => call.surface)).toEqual([...surfaces])
      expect(observed.second).toEqual(observed.first)
      if (admitted.status === "ok") f.product.ui.finish(admitted.value)
      return "cannot escape poisoned root"
    })).rejects.toThrow("Nested local write attempted")
  })
})

test("prototype drift during authentication is refused without executing a getter on a reduced receiver", async () => {
  await fixture(async (f) => {
    const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    const receivers: unknown[] = []
    f.control.hook = async (surface) => { if (surface === "dashboard") entered.resolve(); await release.promise }
    const pending = f.store.readSnapshotRoot!(() => f.product.ui.admit(f.request, "sf_context_get", "a".repeat(64)))
    await entered.promise
    Object.defineProperty(Object.prototype, "access", { configurable: true, get() {
      receivers.push(this)
      return {}
    } })
    try {
      release.resolve()
      expect((await pending).status).toBe("denied")
      expect(f.calls.map((call) => call.surface)).toEqual([...surfaces])
      expect(receivers).toEqual([])
    } finally { Reflect.deleteProperty(Object.prototype, "access") }
  })
})

test("a changed provider cannot recover the same in-flight observation by restoring its method", async () => {
  await fixture(async (f) => {
    const original = f.persistence.currentSnapshots!
    const entered = Promise.withResolvers<void>(), restore = Promise.withResolvers<void>()
    f.control.hook = async (surface) => {
      if (surface === "dashboard") { f.persistence.currentSnapshots = () => undefined; entered.resolve(); return }
      await restore.promise
    }
    const pending = f.store.readSnapshotRoot!(() => f.product.ui.admit(f.request, "sf_context_get", "a".repeat(64)))
    await entered.promise
    f.persistence.currentSnapshots = original
    restore.resolve()
    expect((await pending).status).toBe("denied")
  })
})

test("the final identity callback cannot replace the authority input owner before egress", async () => {
  await fixture(async (f) => {
    const original = f.input.identity
    const calls = { identity: 0 }
    f.input.identity = () => {
      calls.identity++
      if (calls.identity === 2) f.input.persistence = { ...f.persistence }
      return original()
    }
    const result = await f.store.readSnapshotRoot!(() => f.product.ui.admit(f.request, "sf_context_get", "a".repeat(64)))
    expect(result.status).toBe("denied")
    expect(calls.identity).toBe(2)
    expect(f.calls.map((call) => call.surface)).toEqual([...surfaces])
  })
})

test("an inherited role map uses the real full data receiver on the original fallback", async () => {
  await fixture(async (f) => {
    for (const surface of surfaces) await f.persistence.transaction(surface, async (snapshot) => {
      snapshot.data.marker = surface
      return { commit: true, value: undefined }
    })
    const receivers = f.receivers
    Object.defineProperty(Object.prototype, "roleMap", { configurable: true, get() {
      receivers.push(Object.getOwnPropertyDescriptor(this, "marker")?.value)
      return []
    } })
    try {
      const before = f.mark()
      expect(before.receivers).toBe(0)
      const result = await f.store.readSnapshotRoot!(() => f.product.ui.admit(f.request, "sf_context_get", "a".repeat(64)))
      expect(result.status).toBe("ok")
      const after = f.mark(), observed = admissionRounds(f, before, after)
      const first = receivers.slice(before.receivers, observed.boundary.receivers)
      const second = receivers.slice(observed.boundary.receivers, after.receivers)
      expect(first).toEqual(surfaces.flatMap((surface) => [surface, surface, surface]))
      expect(observed.first.map((call) => call.surface)).toEqual([...surfaces])
      expect(second).toEqual(surfaces.flatMap((surface) => [surface, surface, surface]))
      expect(observed.second.map((call) => call.surface)).toEqual([...surfaces])
      expect([...first, ...second]).toEqual(receivers.slice(before.receivers, after.receivers))
      if (result.status === "ok") f.product.ui.finish(result.value)
    } finally { Reflect.deleteProperty(Object.prototype, "roleMap") }
  })
})

test("inherited descriptor.value cannot disguise the consumer input accessor during authentication", async () => {
  await fixture(async (f) => {
    const descriptor = Object.getOwnPropertyDescriptor(f.input, "persistence")
    if (!descriptor || !Object.hasOwn(descriptor, "value")) throw new Error("Fixture input descriptor unavailable")
    const owner = descriptor.value
    const observed = { getters: 0 }
    f.control.hook = (surface) => {
      if (surface !== "dashboard") return
      Object.defineProperty(f.input, "persistence", Object.assign(Object.create(null), {
        configurable: true, enumerable: true, get() { observed.getters++; return owner },
      }))
      Object.defineProperty(Object.prototype, "value", Object.assign(Object.create(null), { configurable: true, value: owner }))
    }
    const result = await f.store.readSnapshotRoot!(() => f.product.ui.admit(f.request, "sf_context_get", "a".repeat(64))).finally(() => {
      Reflect.deleteProperty(Object.prototype, "value")
      Object.defineProperty(f.input, "persistence", descriptor)
    })
    if (result.status === "ok") f.product.ui.finish(result.value)
    expect(result.status).toBe("denied")
    expect(observed.getters).toBe(0)
    expect(f.calls.map((call) => call.surface)).toEqual(["dashboard"])
  })
})
