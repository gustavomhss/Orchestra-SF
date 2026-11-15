import { expect, test } from "bun:test"
import type { Snapshot } from "../../../runtime/contract.ts"
import { decodeSnapshot, encodeSnapshot } from "../../../runtime/local-store.ts"
import { current, read, record, seed, surfaces, warm, withStores } from "./fixture.ts"

for (const target of surfaces) {
  test(`fresh ${target} root keeps mutable target observations and every non-target graph independent`, async () => {
    await withStores(async (_directory, open) => {
      const store = await open()
      await seed(store)
      await warm(store)
      const calls = { root: 0, nested: 0, current: 0 }
      const observe = () => { calls.current++; return current(store) }
      const retained = await store.transaction(target, async (snapshot) => {
        calls.root++
        const first = observe()
        expect(first[target]).toEqual(decodeSnapshot(encodeSnapshot(snapshot)))
        for (const surface of surfaces) {
          expect(first[surface].data.surface).toBe(surface)
          expect(first[surface].data.left).not.toBe(first[surface].data.right)
          expect(Object.is(first[surface].data.minusZero, -0)).toBe(true)
          expect(Object.hasOwn(first[surface].data, "optional")).toBe(true)
          expect(first[surface].data.optional).toBeUndefined()
          expect(first[surface].data.text).toBe("\ud800")
          expect(first[surface].data.toJSON).toBe("ordinary data")
          const own = record(first[surface].data.own)
          expect(Object.getPrototypeOf(own)).toBe(Object.prototype)
          expect(Object.hasOwn(own, "__proto__")).toBe(true)
          expect(Object.getOwnPropertyDescriptor(own, "hidden")).toMatchObject({ value: undefined, enumerable: true, writable: true, configurable: true })
          const sparse = first[surface].data.sparse
          if (!Array.isArray(sparse)) throw new Error("Sparse fixture unavailable")
          expect(sparse).toHaveLength(3)
          expect(Object.hasOwn(sparse, 0)).toBe(true)
          expect(Object.hasOwn(sparse, 1)).toBe(true)
          expect(sparse[0]).toBeUndefined()
          expect(sparse[2]).not.toBe(first[surface].data.left)
          expect(Object.hasOwn(sparse, "extra")).toBe(false)
        }
        const second = observe()
        for (const surface of surfaces) {
          expect(second[surface]).not.toBe(first[surface])
          expect(second[surface].data.left).not.toBe(first[surface].data.left)
          record(first[surface].data.left).count = 901
          record(record(first[surface].data.own).__proto__).count = 902
          first[surface].audit[0]!.who = "copy-only"
          first[surface].notices[0]!.to.push("copy-only")
          first[surface].versions.seed!.version = 999
          first[surface].sequences.seed = 999
          expect(record(second[surface].data.left).count).toBe(1)
        }
        record(snapshot.data.left).count = 3
        snapshot.data.latest = { observed: true }
        const third = observe()
        expect(record(third[target].data.left).count).toBe(3)
        expect(third[target].data.latest).toEqual({ observed: true })
        expect(record(second[target].data.left).count).toBe(1)
        expect(second[target].data).not.toHaveProperty("latest")
        for (const surface of surfaces) {
          expect(third[surface].audit[0]!.who).toBe("fixture")
          expect(third[surface].notices[0]!.to).toEqual(["fixture"])
          expect(third[surface].versions.seed!.version).toBe(1)
          expect(third[surface].sequences.seed).toBe(1)
          await store.transaction(surface, async (nested) => {
            calls.nested++
            expect(nested).toEqual(third[surface])
            expect(nested.data.left).not.toBe(third[surface].data.left)
            record(nested.data.left).count = 707
            nested.data.private = "nested-only"
            const nestedCurrent = observe()
            expect(nestedCurrent[surface]).toEqual(third[surface])
            expect(nestedCurrent[surface].data.left).not.toBe(third[surface].data.left)
            return { commit: false, value: undefined }
          })
        }
        expect(observe()).toEqual(third)
        return { commit: true, value: second }
      })
      expect(calls).toEqual({ root: 1, nested: 3, current: 7 })
      for (const surface of surfaces) record(retained[surface].data.left).count = 444
      await store.transaction(target, async () => {
        const fresh = current(store)
        for (const surface of surfaces) {
          expect(record(fresh[surface].data.left).count).toBe(surface === target ? 3 : 1)
          expect(fresh[surface].data).not.toHaveProperty("private")
          expect(fresh[surface].data.left).not.toBe(retained[surface].data.left)
        }
        return { commit: false, value: undefined }
      })
      await store.dispose()
      const reopened = await open()
      expect(record((await read(reopened, target)).snapshot.data.left).count).toBe(3)
    })
  })
}

test("transactionAll copies all live mutable graphs and separates aliases across surfaces", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await warm(store)
    if (!store.transactionAll) throw new Error("All-surface transaction unavailable")
    await store.transactionAll(async (snapshots) => {
      const shared = { value: 1 }
      for (const surface of surfaces) snapshots[surface].data.shared = shared
      const first = current(store)
      shared.value = 2
      const second = current(store)
      expect(first.dashboard.data.shared).not.toBe(first.planner.data.shared)
      expect(first.planner.data.shared).not.toBe(first.procurement.data.shared)
      for (const surface of surfaces) {
        expect(first[surface].data.shared).toEqual({ value: 1 })
        expect(second[surface].data.shared).toEqual({ value: 2 })
        record(first[surface].data.shared).value = 99
        await store.transaction(surface, async (nested) => {
          expect(nested.data.shared).toEqual({ value: 2 })
          record(nested.data.shared).value = 77
          expect(current(store)[surface].data.shared).toEqual({ value: 2 })
          return { commit: false, value: undefined }
        })
      }
      expect(shared.value).toBe(2)
      return { commit: true, value: undefined }
    })
    for (const surface of surfaces) expect((await read(store, surface)).snapshot.data.shared).toEqual({ value: 2 })
  })
})

test("a warm root still rejects invalid target values without evaluating accessors or invoking nested work", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await warm(store)
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    const calls = { getters: 0, nested: 0 }
    const cases: { value: unknown; reason: string }[] = [
      ...[NaN, Infinity, -Infinity, 1n, Symbol("value"), () => true].map((value) => ({ value, reason: "Unsupported local snapshot value" })),
      { value: cycle, reason: "Cyclic local snapshot" },
      { value: new Date(0), reason: "Local snapshots require plain objects" },
      { value: { [Symbol("key")]: true }, reason: "Unsupported symbol properties" },
      { value: Object.defineProperty({}, "accessor", { get: () => { calls.getters++; return "not read" } }), reason: "Unsupported snapshot accessor" },
    ]
    for (const invalid of cases) {
      await store.transaction("planner", async (snapshot: Snapshot) => {
        const before = current(store)
        snapshot.data.invalid = invalid.value
        expect(() => current(store)).toThrow(invalid.reason)
        await expect(store.transaction("planner", async () => {
          calls.nested++
          return { commit: false, value: undefined }
        })).rejects.toThrow(invalid.reason)
        expect(before.planner.data).not.toHaveProperty("invalid")
        return { commit: false, value: undefined }
      })
    }
    expect(calls).toEqual({ getters: 0, nested: 0 })
    expect((await read(store, "planner")).snapshot.data).not.toHaveProperty("invalid")
  })
})

test("non-target copies remain fresh when valid snapshots exceed the plan depth or missing-value limits", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await warm(store)
    const deep: Record<string, unknown> = {}
    const cursor = { value: deep }
    for (let index = 0; index < 140; index++) {
      const child = { value: index }
      cursor.value.child = child
      cursor.value = child
    }
    for (const value of [Array.from({ length: 4097 }, () => undefined), deep]) {
      await store.transaction("procurement", async (snapshot) => { snapshot.data.fallback = value; return { commit: true, value: undefined } })
      await warm(store)
      await store.transaction("dashboard", async () => {
        const first = current(store)
        const second = current(store)
        expect(first.procurement).toEqual(second.procurement)
        expect(first.procurement.data.fallback).not.toBe(second.procurement.data.fallback)
        first.procurement.data.fallback = "copy-only"
        expect(current(store).procurement).toEqual(second.procurement)
        return { commit: false, value: undefined }
      })
    }
  })
})

test("warm copies retain metadata validation for versions, audit and private blob generations", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await warm(store)
    const calls = { nested: 0 }
    const cases: { install: (snapshot: Snapshot) => void; reason: string }[] = [
      { install: (snapshot) => { snapshot.versions.seed = { version: -1, by: "invalid" } }, reason: "Corrupt local snapshot contents" },
      { install: (snapshot) => { Object.assign(snapshot, { audit: [{ who: "invalid", at: "2026-11-14", record: "seed", became: true }] }) }, reason: "Corrupt local snapshot contents" },
      { install: (snapshot) => { snapshot.sfBlobGenerations = { document: -1 } }, reason: "Corrupt local blob generations" },
    ]
    for (const invalid of cases) {
      await store.transaction("planner", async (snapshot) => {
        const before = current(store)
        const generations = snapshot.sfBlobGenerations
        try {
          invalid.install(snapshot)
          expect(() => current(store)).toThrow(invalid.reason)
          await expect(store.transaction("planner", async () => {
            calls.nested++
            return { commit: false, value: undefined }
          })).rejects.toThrow(invalid.reason)
          expect(before.planner.versions.seed).toEqual({ version: 1, by: "fixture" })
          expect(Object.hasOwn(before.planner.audit[0]!, "was")).toBe(true)
          expect(before.planner.sfBlobGenerations).toBeUndefined()
        } finally {
          // Keep the separate private-generation write guard intact on exit.
          if (generations === undefined) Reflect.deleteProperty(snapshot, "sfBlobGenerations")
          else snapshot.sfBlobGenerations = generations
        }
        return { commit: false, value: undefined }
      })
    }
    expect(calls.nested).toBe(0)
    const durable = (await read(store, "planner")).snapshot
    expect(durable.versions.seed).toEqual({ version: 1, by: "fixture" })
    expect(Object.hasOwn(durable.audit[0]!, "was")).toBe(true)
    expect(durable.sfBlobGenerations).toBeUndefined()
  })
})
