import { expect, test } from "bun:test"
import { createSfFreshTupleDigest } from "../../../../../../../apps/cli/src/sucafina-product/fresh-tuple-digest.ts"
import { canonicalSfValue, digestSfValue } from "../../../../product/contracts/canonical.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

const originalDescriptor = Object.getOwnPropertyDescriptor
const originalDefine = Object.defineProperty
const originalDelete = Reflect.deleteProperty
const originalStringify = JSON.stringify
const originalMap = Array.prototype.map

type Outcome = { ok: true; value: string } | { ok: false; error: unknown }

function observe(read: () => string): Outcome {
  try { return { ok: true, value: read() } }
  catch (error) { return { ok: false, error } }
}

function comparable(outcome: Outcome) {
  return outcome.ok ? outcome : { ok: false, error: outcome.error instanceof Error
    ? { name: outcome.error.name, message: outcome.error.message } : outcome.error }
}

function withDataMethod<Value>(owner: object, key: PropertyKey, value: unknown, read: () => Value): Value {
  const previous = originalDescriptor(owner, key)
  if (previous && !("value" in previous)) throw new Error("Expected an original data method")
  originalDefine(owner, key, previous ? { ...previous, value }
    : { configurable: true, enumerable: false, writable: true, value })
  try { return read() }
  finally {
    if (previous) originalDefine(owner, key, previous)
    else originalDelete(owner, key)
  }
}

function tuple() {
  return {
    state: { cases: { selected: { id: "selected", version: 1, values: [0, -0, undefined, null] } },
      preferences: { coverage: { state: "pending", entries: ["training", "migration"] } } },
    snapshots: { dashboard: { revision: 1 }, planner: { version: 4, amount: 125.5 }, procurement: { version: 2 } },
    sources: { planner: "version-four", procurement: "version-two" },
  }
}

test("Fresh tuple digests preserve canonical bytes across complete fresh and mutated observations", async () => {
  const deadline = compositionTestDeadline("fresh-tuple-parity", 12_000)
  const owner = createSfFreshTupleDigest()
  const secondOwner = createSfFreshTupleDigest()
  try {
    const named: Record<string, unknown> = { z: "last", a: "first", toJSON: "plain data", constructor: "plain data" }
    originalDefine(named, "__proto__", { value: { ordinary: true }, enumerable: true, configurable: true, writable: true })
    const shared = { amount: 12, absent: undefined }
    const values: unknown[] = [
      undefined, null, false, true, "", "Coffee ☕", "a" + String.fromCharCode(0) + "b",
      0, -0, Number.MIN_VALUE, Number.MAX_VALUE, Number.MAX_SAFE_INTEGER, -45.5,
      [], [undefined, null, -0, true, "x"], {}, named,
      { left: shared, right: shared }, { right: { absent: undefined, amount: 12 }, left: { amount: 12, absent: undefined } },
      Object.freeze({ values: Object.freeze([1, 2, Object.freeze({ value: "frozen data" })]) }),
      { rows: Array.from({ length: 256 }, (_, index) => ({ index, parity: index % 2, value: "row-" + index })) },
      tuple(),
    ]
    for (const value of values) {
      deadline.check()
      const expected = digestSfValue(value)
      expect(owner.digest(value)).toBe(expected)
      expect(owner.digest(structuredClone(value))).toBe(expected)
      expect(secondOwner.digest(structuredClone(value))).toBe(expected)
    }

    const value = tuple()
    const initial = digestSfValue(value)
    expect(owner.digest(value)).toBe(initial)
    value.state.cases.selected.version = 2
    value.snapshots.planner.amount = 250
    value.sources.planner = "version-five"
    const changed = digestSfValue(value)
    expect(changed).not.toBe(initial)
    expect(owner.digest(value)).toBe(changed)
    expect(secondOwner.digest(tuple())).toBe(initial)
    expect(owner.digest(tuple())).toBe(initial)

    const sharedValue = { amount: 7 }
    const aliases = { a: sharedValue, b: sharedValue }
    const independent = { b: { amount: 7 }, a: { amount: 7 } }
    expect(digestSfValue(aliases)).toBe(digestSfValue(independent))
    expect(owner.digest(aliases)).toBe(digestSfValue(independent))
    expect(owner.digest(independent)).toBe(digestSfValue(aliases))
    sharedValue.amount = 8
    expect(owner.digest(aliases)).toBe(digestSfValue(aliases))
    expect(owner.digest(independent)).toBe(digestSfValue(independent))
    owner.close()
    expect(owner.digest(value)).toBe(digestSfValue(value))
    expect(secondOwner.digest(value)).toBe(digestSfValue(value))
  } finally { owner.close(); secondOwner.close(); await deadline.close() }
}, 15_000)

test("Opaque tuple values retain original getter, Proxy, sparse-array and failure behaviour", async () => {
  const deadline = compositionTestDeadline("fresh-tuple-opaque", 12_000)
  try {
    const builders: (() => { value: unknown; counts: Record<string, number> })[] = [
      () => {
        const counts = { getters: 0 }
        const shared = { get amount() { counts.getters++; return 12 } }
        return { value: { a: shared, b: shared }, counts }
      },
      () => {
        const counts = { getters: 0 }, value = { visible: 1 }
        originalDefine(value, "hidden", { get: () => { counts.getters++; return "hidden" }, enumerable: false })
        originalDefine(value, Symbol("ignored"), { get: () => { counts.getters++; return "symbol" }, enumerable: true })
        return { value, counts }
      },
      () => {
        const counts = { get: 0, descriptors: 0, keys: 0, prototype: 0 }
        const value = new Proxy({ a: 1, nested: { x: 2 } }, {
          get: (target, key, receiver) => { counts.get++; return Reflect.get(target, key, receiver) },
          getOwnPropertyDescriptor: (target, key) => { counts.descriptors++; return originalDescriptor(target, key) },
          ownKeys: (target) => { counts.keys++; return Reflect.ownKeys(target) },
          getPrototypeOf: (target) => { counts.prototype++; return Object.getPrototypeOf(target) },
        })
        return { value, counts }
      },
      () => {
        const counts = { get: 0 }
        const value = new Proxy([1, undefined, 3], {
          get: (target, key, receiver) => { counts.get++; return Reflect.get(target, key, receiver) },
        })
        return { value, counts }
      },
      () => {
        const counts = { getters: 0 }
        const value = Object.create(null) as Record<string, unknown>
        originalDefine(value, "value", { enumerable: true, get: () => { counts.getters++; return "null prototype" } })
        return { value, counts }
      },
      () => {
        const counts = { getters: 0 }, value = [1, 2]
        originalDefine(value, "map", { enumerable: true, configurable: true,
          get: () => { counts.getters++; return originalMap } })
        return { value, counts }
      },
    ]
    for (const build of builders) {
      const run = (shortcut: boolean) => {
        const fixture = build(), owner = createSfFreshTupleDigest()
        try {
          owner.digest({ warm: true })
          const result = observe(() => shortcut ? owner.digest(fixture.value) : digestSfValue(fixture.value))
          return { result: comparable(result), counts: { ...fixture.counts } }
        } finally { owner.close() }
      }
      deadline.check()
      expect(run(true)).toEqual(run(false))
    }

    const owner = createSfFreshTupleDigest()
    try {
      const sparse = new Array<unknown>(3)
      sparse[1] = undefined
      const dense = [undefined, undefined, undefined]
      const extra = [1, undefined]
      Reflect.set(extra, "ignored", { extra: true })
      const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, { z: 2, a: undefined })
      for (const value of [sparse, dense, extra, nullPrototype]) {
        expect(owner.digest(value)).toBe(digestSfValue(value))
        expect(owner.digest(value)).toBe(digestSfValue(value))
      }
      expect(digestSfValue(sparse)).not.toBe(digestSfValue(dense))
      expect(owner.digest(extra)).toBe(digestSfValue([1, undefined]))

      const cycle: Record<string, unknown> = {}
      cycle.self = cycle
      const revoked = Proxy.revocable({ value: 1 }, {})
      revoked.revoke()
      for (const value of [NaN, Infinity, -Infinity, 1n, Symbol("value"), () => undefined,
        new Date("2027-01-01T00:00:00Z"), new Map([["a", 1]]), new Set([1]), new Uint8Array([1]), cycle, revoked.proxy]) {
        deadline.check()
        expect(comparable(observe(() => owner.digest(value)))).toEqual(comparable(observe(() => digestSfValue(value))))
        expect(owner.digest({ after: "original refusal" })).toBe(digestSfValue({ after: "original refusal" }))
      }

      const failure = new Error("The original getter failed")
      const count = { reads: 0 }
      const value = { get value() { count.reads++; throw failure } }
      const result = observe(() => owner.digest(value))
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error("Expected original getter error")
      expect(result.error).toBe(failure)
      expect(count.reads).toBe(1)
    } finally { owner.close() }
  } finally { await deadline.close() }
}, 15_000)
