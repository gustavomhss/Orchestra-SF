import { expect, test } from "bun:test"
import type { LocalStore } from "../../../runtime/local-contract.ts"
import { read, record, seed, warm, withStores } from "./fixture.ts"

const prototypes: readonly { name: string; value: object | null; reads: number }[] = [
  { name: "ordinary", value: Object.prototype, reads: 1 },
  { name: "null", value: null, reads: 2 },
]

for (const prototype of prototypes) {
  test(`mutable ${prototype.name}-prototype copies preserve Proxy observation order and ignore late symbols`, async () => {
    await withStores(async (_directory, open) => {
      const store = await open()
      await seed(store)
      await warm(store)
      await store.transaction("dashboard", async (snapshot) => {
        const trace: string[] = []
        const calls = { keys: 0, nested: 0 }
        const alpha = { count: 1 }
        const own = { marker: "own data" }
        const live = { mustNotEscape: true }
        const late = Symbol("late-symbol")
        const target: Record<PropertyKey, unknown> = Object.create(prototype.value)
        Object.defineProperty(target, "alpha", { value: alpha, enumerable: false, writable: false, configurable: true })
        Object.defineProperty(target, "__proto__", { value: own, enumerable: false, configurable: true })
        Object.defineProperty(target, late, { value: live, enumerable: true, configurable: true })
        snapshot.data.boundary = new Proxy(target, {
          getPrototypeOf(subject) {
            trace.push("prototype")
            return Reflect.getPrototypeOf(subject)
          },
          ownKeys() {
            trace.push(`keys:${++calls.keys}`)
            return calls.keys === 1 ? ["alpha", "__proto__"] : ["alpha", "__proto__", late]
          },
          getOwnPropertyDescriptor(subject, key) {
            trace.push(key === late ? "descriptor:symbol" : `descriptor:${String(key)}`)
            return Reflect.getOwnPropertyDescriptor(subject, key)
          },
        })
        for (const nested of [false, true]) {
          trace.length = 0
          calls.keys = 0
          const observed = nested ? await store.transaction("dashboard", async (child) => {
            calls.nested++
            return { commit: false, value: child }
          }) : currentTarget(store)
          const copied = record(observed.data.boundary)
          expect(trace).toEqual([
            ...Array.from({ length: prototype.reads }, () => "prototype"),
            "keys:1", "keys:2", "descriptor:alpha", "descriptor:__proto__", "descriptor:symbol",
          ])
          expect(Object.keys(copied)).toEqual(["alpha", "__proto__"])
          expect(Object.getOwnPropertySymbols(copied)).toEqual([])
          expect(Object.getPrototypeOf(copied)).toBe(Object.prototype)
          expect(Object.hasOwn(copied, "__proto__")).toBe(true)
          expect(copied.alpha).toEqual({ count: 1 })
          expect(copied.alpha).not.toBe(alpha)
          expect(copied.__proto__).toEqual({ marker: "own data" })
          expect(copied.__proto__).not.toBe(own)
          expect(Object.getOwnPropertyDescriptor(copied, "alpha")).toMatchObject({ enumerable: true, writable: true, configurable: true })
          record(copied.alpha).count = 8
          expect(alpha.count).toBe(1)
          expect(live).toEqual({ mustNotEscape: true })
        }
        expect(calls.nested).toBe(1)
        return { commit: false, value: undefined }
      })
      expect((await read(store)).snapshot.data).not.toHaveProperty("boundary")
    })
  })
}

test("descriptor capture keeps sibling references while later child visits observe nested mutations", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await warm(store)
    await store.transaction("dashboard", async (snapshot) => {
      const calls = { index: 0 }
      const oldLater = { nested: { count: 0 } }
      const replacement = { nested: { count: 99 } }
      const first: unknown[] = [undefined]
      const parent = { first, later: oldLater }
      Object.defineProperty(first, "0", { enumerable: true, configurable: true, get: () => {
        calls.index++
        parent.later = replacement
        oldLater.nested.count = calls.index
        return "first child"
      } })
      snapshot.data.boundary = parent
      const firstCopy = record(currentTarget(store).data.boundary)
      expect(calls.index).toBe(1)
      expect(firstCopy.first).toEqual(["first child"])
      expect(firstCopy.later).toEqual({ nested: { count: 1 } })
      expect(firstCopy.later).not.toBe(oldLater)
      expect(parent.later).toBe(replacement)
      expect(oldLater.nested.count).toBe(1)
      const secondCopy = record(currentTarget(store).data.boundary)
      expect(calls.index).toBe(2)
      expect(secondCopy.later).toEqual({ nested: { count: 99 } })
      expect(secondCopy.later).not.toBe(replacement)
      expect(firstCopy.later).toEqual({ nested: { count: 1 } })
      expect(oldLater.nested.count).toBe(2)
      return { commit: false, value: undefined }
    })
    expect((await read(store)).snapshot.data).not.toHaveProperty("boundary")
  })
})

test("a first-child cycle retains precedence over a later accessor and prevents nested work", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await warm(store)
    await store.transaction("dashboard", async (snapshot) => {
      const calls = { getter: 0, nested: 0 }
      const cycle: Record<string, unknown> = {}
      cycle.self = cycle
      const boundary = { first: cycle }
      Object.defineProperty(boundary, "later", { enumerable: true, get: () => {
        calls.getter++
        throw new Error("later accessor must not execute")
      } })
      snapshot.data.boundary = boundary
      expect(() => currentTarget(store)).toThrow("Cyclic local snapshot")
      await expect(store.transaction("dashboard", async () => {
        calls.nested++
        return { commit: false, value: undefined }
      })).rejects.toThrow("Cyclic local snapshot")
      expect(calls).toEqual({ getter: 0, nested: 0 })
      return { commit: false, value: undefined }
    })
    expect((await read(store)).snapshot.data).not.toHaveProperty("boundary")
  })
})

test("copied own data does not invoke inherited descriptor attributes or inherited setters", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await warm(store)
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.boundary = { get: "own get data", set: "own set data", __sfCopyBuilderSetter: "own value", first: { count: 1 }, second: { count: 2 } }
      const calls = { get: 0, set: 0, setter: 0 }
      const names = ["get", "set", "__sfCopyBuilderSetter"]
      const previous = names.map((name) => {
        const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, name)
        if (descriptor?.configurable === false) throw new Error("Prototype fixture is not configurable")
        const restoration: PropertyDescriptor | undefined = descriptor ? Object.assign(Object.create(null), descriptor) : undefined
        return { name, descriptor, restoration }
      })
      const defineProperty = Object.defineProperty
      const inheritedGet: PropertyDescriptor = Object.create(null)
      inheritedGet.configurable = true
      inheritedGet.get = () => { calls.get++; throw new Error("inherited get attribute invoked") }
      const inheritedSet: PropertyDescriptor = Object.create(null)
      inheritedSet.configurable = true
      inheritedSet.get = () => { calls.set++; throw new Error("inherited set attribute invoked") }
      const inheritedSetter: PropertyDescriptor = Object.create(null)
      inheritedSetter.configurable = true
      inheritedSetter.set = () => { calls.setter++ }
      // No await or assertion occurs while the prototype is temporarily changed.
      // Use the real mutable target copy, without unrelated non-target plan repair.
      const observed = (() => {
        try {
          defineProperty(Object.prototype, "get", inheritedGet)
          defineProperty(Object.prototype, "set", inheritedSet)
          defineProperty(Object.prototype, "__sfCopyBuilderSetter", inheritedSetter)
          return currentTarget(store)
        } finally {
          for (const name of names) Reflect.deleteProperty(Object.prototype, name)
          for (const item of previous) if (item.restoration) defineProperty(Object.prototype, item.name, item.restoration)
        }
      })()
      const copied = record(observed.data.boundary)
      expect(calls).toEqual({ get: 0, set: 0, setter: 0 })
      expect(copied).toEqual({ get: "own get data", set: "own set data", __sfCopyBuilderSetter: "own value", first: { count: 1 }, second: { count: 2 } })
      expect(Object.hasOwn(copied, "__sfCopyBuilderSetter")).toBe(true)
      expect(Object.getOwnPropertyDescriptor(copied, "__sfCopyBuilderSetter")).toMatchObject({ value: "own value", enumerable: true, writable: true, configurable: true })
      expect(copied.first).not.toBe(copied.second)
      for (const item of previous) expect(Object.getOwnPropertyDescriptor(Object.prototype, item.name)).toEqual(item.descriptor)
      return { commit: false, value: undefined }
    })
    expect((await read(store)).snapshot.data).not.toHaveProperty("boundary")
  })
})

function currentTarget(store: LocalStore) {
  const snapshot = store.currentSnapshot?.("dashboard")
  if (!snapshot) throw new Error("Mutable target snapshot unavailable")
  return snapshot
}
