import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { currentLocalReadonlyAuthorityData, openLocalStore } from "../runtime/local-store.ts"
import type { LocalStore } from "../runtime/local-contract.ts"
import { currentSfReadonlyAuthorityData, createSfSourcePersistence } from "../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../product/integration/source-inventory.ts"

const surfaces = ["dashboard", "planner", "procurement"] as const
const methods = ["currentSnapshots", "currentSnapshot", "transaction", "transactionAll", "readSnapshotRoot"] as const

async function fixture(work: (store: LocalStore) => Promise<void>) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-authority-data-"))
  const store = await openLocalStore(join(directory, "store"))
  try { await work(store) } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
}

test("readonly authority copies match the codec, preserve absence and never expose the private root", async () => {
  await fixture(async (store) => {
    const nested = Object.assign(Object.create(null), { assigned: ["one"], domains: ["finance"], negative: -0, absent: undefined })
    Object.defineProperty(nested, "__proto__", { value: { retained: true }, enumerable: true })
    Object.defineProperty(nested, "hidden", { value: "normalized", enumerable: false })
    const sparse = Array(2); sparse[1] = undefined
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data = { roleMap: [], access: { person: nested, sparse }, marker: "full receiver", unrelated: "x".repeat(200_000) }
      return { commit: true, value: undefined }
    })
    expect(currentLocalReadonlyAuthorityData(store, surfaces)).toBeUndefined()
    await store.readSnapshotRoot!(async () => {
      const first = currentLocalReadonlyAuthorityData(store, surfaces)
      const second = currentLocalReadonlyAuthorityData(store, surfaces)
      const full = store.currentSnapshots!()
      if (!first || !second || !full) throw new Error("Real readonly observations unavailable")
      expect(first.current()).toBe(true)
      expect(first.snapshots.dashboard.data).toEqual({ roleMap: full.dashboard.data.roleMap, access: full.dashboard.data.access })
      expect(Object.keys(first.snapshots.dashboard.data)).toEqual(["roleMap", "access"])
      expect(first.snapshots.planner.data).toEqual({})
      expect(Object.hasOwn(first.snapshots.planner.data, "roleMap")).toBe(false)
      expect(Object.hasOwn(first.snapshots.planner.data, "access")).toBe(false)
      expect(first.snapshots.dashboard.data).not.toBe(second.snapshots.dashboard.data)
      expect(first.snapshots.dashboard.data.access).not.toBe(second.snapshots.dashboard.data.access)
      const access = first.snapshots.dashboard.data.access as { person: Record<string, unknown>; sparse: unknown[] }
      expect(Object.is(access.person.negative, -0)).toBe(true)
      expect(Object.hasOwn(access.person, "absent")).toBe(true)
      expect(Object.hasOwn(access.person, "__proto__")).toBe(true)
      expect(Object.getOwnPropertyDescriptor(access.person, "hidden")?.enumerable).toBe(true)
      expect(Object.keys(access.sparse)).toEqual(["0", "1"])
      access.person.assigned = ["mutated detached copy"]
      first.snapshots.dashboard.data.roleMap = ["mutated detached copy"]
      full.dashboard.data.access = {}
      expect(currentLocalReadonlyAuthorityData(store, surfaces)?.snapshots).toEqual(second.snapshots)
      expect(first.current()).toBe(true)
    })
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.access = { person: { assigned: ["staged"] } }
      expect(currentLocalReadonlyAuthorityData(store, surfaces)).toBeUndefined()
      expect(store.currentSnapshot!("dashboard")?.data.access).toEqual(snapshot.data.access)
      return { commit: false, value: undefined }
    })
  })
})

test("only the actual store or unchanged source-factory composition can project", async () => {
  await fixture(async (store) => {
    const input = { persistence: store, enumerate: enumerateSfSources, createId: randomUUID }
    const source = createSfSourcePersistence(input)
    const composite = { ...store, ...source }
    await store.readSnapshotRoot!(async () => {
      expect(currentLocalReadonlyAuthorityData({ ...store }, surfaces)).toBeUndefined()
      expect(currentSfReadonlyAuthorityData(store, surfaces)?.current()).toBe(true)
      expect(currentSfReadonlyAuthorityData(source, surfaces)?.current()).toBe(true)
      const read = currentSfReadonlyAuthorityData(composite, surfaces)
      expect(read?.current()).toBe(true)
      const calls = { proxy: 0, getter: 0, wrapper: 0 }
      const proxy = new Proxy(composite, { getOwnPropertyDescriptor(target, name) { calls.proxy++; return Reflect.getOwnPropertyDescriptor(target, name) },
        getPrototypeOf(target) { calls.proxy++; return Reflect.getPrototypeOf(target) } })
      expect(currentSfReadonlyAuthorityData(proxy, surfaces)).toBeUndefined()
      const accessor = { ...composite }
      Object.defineProperty(accessor, "currentSnapshot", { get() { calls.getter++; return composite.currentSnapshot } })
      expect(currentSfReadonlyAuthorityData(accessor, surfaces)).toBeUndefined()
      const wrapped = { ...composite, currentSnapshots: () => { calls.wrapper++; return composite.currentSnapshots!() } }
      expect(currentSfReadonlyAuthorityData(wrapped, surfaces)).toBeUndefined()
      expect(calls).toEqual({ proxy: 0, getter: 0, wrapper: 0 })
      expect(wrapped.currentSnapshots()).toEqual(composite.currentSnapshots!())
      expect(calls.wrapper).toBe(1)
      const rebound = currentSfReadonlyAuthorityData.bind(undefined, { ...store })
      expect(rebound(surfaces)).toBeUndefined()
      input.persistence = { ...store }
      expect(read?.current()).toBe(false)
      expect(currentSfReadonlyAuthorityData(composite, surfaces)).toBeUndefined()
    })
  })
})

for (const method of methods) test(`changing ${method} cannot retain a projected store or source observation`, async () => {
  await fixture(async (store) => {
    const source = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, createId: randomUUID })
    const composite = { ...store, ...source }
    await store.readSnapshotRoot!(async () => {
      const direct = currentLocalReadonlyAuthorityData(store, surfaces)
      const composed = currentSfReadonlyAuthorityData(composite, surfaces)
      if (!direct || !composed) throw new Error("Projection not admitted")
      const descriptor = Object.getOwnPropertyDescriptor(store, method)!
      Object.defineProperty(store, method, { ...descriptor, value: () => { throw new Error("replacement must not run") } })
      try {
        expect(direct.current()).toBe(false)
        expect(composed.current()).toBe(false)
        expect(currentLocalReadonlyAuthorityData(store, surfaces)).toBeUndefined()
      } finally { Object.defineProperty(store, method, descriptor) }
      expect(direct.current()).toBe(false)
      expect(currentLocalReadonlyAuthorityData(store, surfaces)?.current()).toBe(true)
      const fresh = currentSfReadonlyAuthorityData(composite, surfaces)
      expect(fresh?.current()).toBe(true)
      const forwarded = Object.getOwnPropertyDescriptor(composite, method)!
      Object.defineProperty(composite, method, { ...forwarded, value: () => undefined })
      try { expect(fresh?.current()).toBe(false); expect(currentSfReadonlyAuthorityData(composite, surfaces)).toBeUndefined() }
      finally { Object.defineProperty(composite, method, forwarded) }
    })
  })
})

test("an opaque source input is not registered and inspecting it adds no getter invocation", async () => {
  await fixture(async (store) => {
    const counter = { reads: 0 }
    const input = { get persistence() { counter.reads++; return store }, enumerate: enumerateSfSources, createId: randomUUID }
    const source = createSfSourcePersistence(input)
    await store.readSnapshotRoot!(async () => {
      const before = counter.reads
      expect(currentSfReadonlyAuthorityData(source, surfaces)).toBeUndefined()
      expect(counter.reads).toBe(before)
      expect(source.currentSnapshots!()).toEqual(store.currentSnapshots!())
      expect(counter.reads).toBeGreaterThan(before)
    })
  })
})

for (const field of ["roleMap", "access"] as const) test(`inherited ${field} preserves the full receiver and later inheritance invalidates a read`, async () => {
  await fixture(async (store) => {
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.marker = "full receiver"
      return { commit: true, value: undefined }
    })
    await store.readSnapshotRoot!(async () => {
      const admitted = currentLocalReadonlyAuthorityData(store, surfaces)
      if (!admitted) throw new Error("Absent metadata was not admitted")
      const receivers: unknown[] = []
      Object.defineProperty(Object.prototype, field, { configurable: true, get() {
        receivers.push(Object.getOwnPropertyDescriptor(this, "marker")?.value)
        return field === "roleMap" ? [] : {}
      } })
      try {
        expect(admitted.current()).toBe(false)
        expect(currentLocalReadonlyAuthorityData(store, surfaces)).toBeUndefined()
        expect(receivers).toEqual([])
        const full = store.currentSnapshot!("dashboard")
        if (!full) throw new Error("Full fallback unavailable")
        void full.data[field]
        expect(receivers).toEqual(["full receiver"])
      } finally { Reflect.deleteProperty(Object.prototype, field) }
      expect(admitted.current()).toBe(false)
      expect(currentLocalReadonlyAuthorityData(store, surfaces)?.current()).toBe(true)
    })
  })
})

test("poison keeps snapshot observation callbacks but still rejects root publication", async () => {
  await fixture(async (store) => {
    const calls: string[] = []
    await expect(store.readSnapshotRoot!(async () => {
      await store.transaction("planner", async () => ({ commit: true, value: undefined })).catch(() => { calls.push("write refused") })
      const projected = currentLocalReadonlyAuthorityData(store, surfaces)
      expect(projected?.snapshots.dashboard.data).toEqual(store.currentSnapshot!("dashboard")?.data)
      expect(projected?.current()).toBe(true)
      calls.push("read remained observable")
      return "must not escape"
    })).rejects.toThrow("Nested local write attempted")
    expect(calls).toEqual(["write refused", "read remained observable"])
  })
})

test("abort and escaped descendants cannot become an unsupported fallback", async () => {
  await fixture(async (store) => {
    const controller = new AbortController()
    await expect(store.readSnapshotRoot!(async () => {
      const projected = currentLocalReadonlyAuthorityData(store, surfaces)
      controller.abort(new Error("projection aborted"))
      expect(() => projected?.current()).toThrow("projection aborted")
      expect(() => currentLocalReadonlyAuthorityData(store, surfaces)).toThrow("projection aborted")
    }, { signal: controller.signal })).rejects.toThrow("projection aborted")
    const release = Promise.withResolvers<void>()
    const late: { read?: Promise<unknown>; current?: () => boolean } = {}
    await store.readSnapshotRoot!(async () => {
      late.current = currentLocalReadonlyAuthorityData(store, surfaces)?.current
      late.read = release.promise.then(() => currentLocalReadonlyAuthorityData(store, surfaces))
      void late.read.catch(() => undefined)
    })
    release.resolve()
    await expect(late.read).rejects.toThrow("scope has ended")
    expect(() => late.current?.()).toThrow("scope has ended")
    expect(currentLocalReadonlyAuthorityData(store, surfaces)).toBeUndefined()
  })
})

test("dispose drains an admitted readonly root without changing its observation lifetime", async () => {
  await fixture(async (store) => {
    const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    const pending = store.readSnapshotRoot!(async () => {
      entered.resolve()
      await release.promise
      const projected = currentLocalReadonlyAuthorityData(store, surfaces)
      expect(projected?.current()).toBe(true)
      return projected?.snapshots
    })
    await entered.promise
    const disposing = store.dispose()
    release.resolve()
    expect(await pending).toEqual({ dashboard: { data: {} }, planner: { data: {} }, procurement: { data: {} } })
    await disposing
  })
})

for (const target of ["driver", "source input", "source method"] as const) test(`inherited descriptor.value cannot disguise an admitted ${target} accessor`, async () => {
  await fixture(async (store) => {
    const input = { persistence: store, enumerate: enumerateSfSources, createId: randomUUID }
    const composite = { ...store, ...createSfSourcePersistence(input) }
    await store.readSnapshotRoot!(async () => {
      const owner = target === "driver" ? store : composite
      const holder = target === "driver" ? store : target === "source input" ? input : composite
      const name = target === "source input" ? "persistence" : "currentSnapshot"
      const descriptor = Object.getOwnPropertyDescriptor(holder, name)
      if (!descriptor || !Object.hasOwn(descriptor, "value")) throw new Error("Fixture data descriptor unavailable")
      const original = descriptor.value
      const admitted = currentSfReadonlyAuthorityData(owner, surfaces)
      if (!admitted) throw new Error("Initial real projection unavailable")
      const observed = { current: true, supported: true, getters: 0 }
      // Install the accessor first. Both descriptors have null prototypes so
      // prototype.value cannot turn the fixture itself into an invalid descriptor.
      Object.defineProperty(holder, name, Object.assign(Object.create(null), {
        configurable: true, enumerable: true, get() { observed.getters++; return original },
      }))
      try {
        Object.defineProperty(Object.prototype, "value", Object.assign(Object.create(null), { configurable: true, value: original }))
        observed.current = admitted.current()
        observed.supported = currentSfReadonlyAuthorityData(owner, surfaces) !== undefined
      } finally {
        Reflect.deleteProperty(Object.prototype, "value")
        Object.defineProperty(holder, name, descriptor)
      }
      expect(observed.current).toBe(false)
      expect(observed.supported).toBe(false)
      expect(observed.getters).toBe(0)
    })
  })
})
