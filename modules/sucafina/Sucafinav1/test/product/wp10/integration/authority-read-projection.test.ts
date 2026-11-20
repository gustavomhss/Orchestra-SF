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
    commandIdentity: async () => "projection-command", inspectSession: async () => undefined,
    verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => 1,
    authorizeDocument: async () => undefined }
  const product = createSfProductAuthority(input)
  return { directory, store, persistence, sourceInput, input, product, calls, control, request, controller }
}

test("real authority keeps all three authentications and identical admission revisions on projected and full reads", async () => {
  await fixture(async (f) => {
    const baseline = await f.product.ui.admit(f.request, "sf_context_get", "a".repeat(64))
    expect(baseline.status).toBe("ok")
    if (baseline.status !== "ok") throw new Error("Baseline admission unavailable")
    const originalCalls = f.calls.splice(0)
    expect(originalCalls.map((call) => call.surface)).toEqual(surfaces)
    await f.store.readSnapshotRoot!(async () => {
      expect(currentSfReadonlyAuthorityData(f.persistence, surfaces)?.current()).toBe(true)
      expect(await f.product.ui.revalidate(baseline.value)).toBe(true)
      expect(f.calls).toEqual(originalCalls)
      expect(f.calls.every((call) => call.request === f.request)).toBe(true)
      f.calls.length = 0
      const result = await f.product.state.read(f.request, "cases", () => "read callback")
      expect(result.status).toBe("ok")
      if (result.status === "ok") expect(result.value).toBe("read callback")
      expect(f.calls.map((call) => call.surface)).toEqual([...surfaces, ...surfaces])
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
    expect(f.calls.map((call) => call.surface)).toEqual(surfaces)
    expect(count.fallbacks).toBe(0)
  })
})

test("opaque input getters and wrappers retain their actual full-copy path", async () => {
  await fixture(async (f) => {
    const reads = { input: 0, copies: 0 }
    const current = f.persistence.currentSnapshots!
    const wrapped = { ...f.persistence, currentSnapshots: () => { reads.copies++; return current() } }
    const opaque = { ...f.input, get persistence() { reads.input++; return wrapped } }
    const product = createSfProductAuthority(opaque)
    await f.store.readSnapshotRoot!(async () => {
      const before = reads.input
      const admitted = await product.ui.admit(f.request, "sf_context_get", "a".repeat(64))
      expect(admitted.status).toBe("ok")
      expect(reads.input - before).toBe(2)
      expect(reads.copies).toBe(1)
      expect(f.calls.map((call) => call.surface)).toEqual(surfaces)
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
    expect(f.calls.map((call) => call.surface)).toEqual(surfaces)
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
    expect(f.calls.map((call) => call.surface)).toEqual(surfaces)
  })
})

test("an already poisoned root still authenticates before its original publication fence rejects", async () => {
  await fixture(async (f) => {
    await expect(f.store.readSnapshotRoot!(async () => {
      await f.store.transaction("planner", async () => ({ commit: true, value: undefined })).catch(() => undefined)
      const admitted = await f.product.ui.admit(f.request, "sf_context_get", "a".repeat(64))
      expect(admitted.status).toBe("ok")
      expect(f.calls.map((call) => call.surface)).toEqual(surfaces)
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
      expect(f.calls.map((call) => call.surface)).toEqual(surfaces)
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
    expect(f.calls.map((call) => call.surface)).toEqual(surfaces)
  })
})

test("an inherited role map uses the real full data receiver on the original fallback", async () => {
  await fixture(async (f) => {
    for (const surface of surfaces) await f.persistence.transaction(surface, async (snapshot) => {
      snapshot.data.marker = surface
      return { commit: true, value: undefined }
    })
    const receivers: unknown[] = []
    Object.defineProperty(Object.prototype, "roleMap", { configurable: true, get() {
      receivers.push(Object.getOwnPropertyDescriptor(this, "marker")?.value)
      return []
    } })
    try {
      const result = await f.store.readSnapshotRoot!(() => f.product.ui.admit(f.request, "sf_context_get", "a".repeat(64)))
      expect(result.status).toBe("ok")
      expect(receivers).toEqual(surfaces.flatMap((surface) => [surface, surface, surface]))
      expect(f.calls.map((call) => call.surface)).toEqual(surfaces)
      if (result.status === "ok") f.product.ui.finish(result.value)
    } finally { Reflect.deleteProperty(Object.prototype, "roleMap") }
  })
})
