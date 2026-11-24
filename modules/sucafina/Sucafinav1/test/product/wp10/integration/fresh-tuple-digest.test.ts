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

test("Tuple intrinsic drift preserves original serialization and hash calls without replay", async () => {
  const deadline = compositionTestDeadline("fresh-tuple-intrinsics", 12_000)
  const owner = createSfFreshTupleDigest()
  try {
    const value = { nested: { value: 1 }, items: [1, undefined, 3] }
    const expected = digestSfValue(value)
    expect(owner.digest(value)).toBe(expected)

    const jsonCount = { calls: 0 }
    const json = withDataMethod(JSON, "stringify", function (this: unknown, ...args: unknown[]) {
      jsonCount.calls++
      return Reflect.apply(originalStringify, this, args)
    }, () => ({ value: owner.digest(value), calls: jsonCount.calls }))
    expect(json).toEqual({ value: expected, calls: 1 })

    for (const method of ["keys", "map"] as const) {
      deadline.check()
      const calls = { value: 0 }
      const target = method === "keys" ? Object : Array.prototype
      const original = originalDescriptor(target, method)?.value
      if (typeof original !== "function") throw new Error("Original canonical method unavailable")
      const observed = withDataMethod(target, method, function (this: unknown, ...args: unknown[]) {
        calls.value++
        return Reflect.apply(original, this, args)
      }, () => {
        const canonical = digestSfValue(value), canonicalCalls = calls.value
        calls.value = 0
        const actual = owner.digest(value)
        return { canonical, actual, canonicalCalls, actualCalls: calls.value }
      })
      expect(observed.actual).toBe(observed.canonical)
      expect(observed.actualCalls).toBe(observed.canonicalCalls)
      expect(observed.canonicalCalls).toBeGreaterThan(0)
    }

    const inheritedCount = { calls: 0 }
    const inherited = withDataMethod(Object.prototype, "toJSON", function () {
      inheritedCount.calls++
      return "Original inherited serializer"
    }, () => {
      const canonical = digestSfValue(value), canonicalCalls = inheritedCount.calls
      inheritedCount.calls = 0
      const actual = owner.digest(value)
      return { canonical, actual, canonicalCalls, actualCalls: inheritedCount.calls }
    })
    expect(inherited.actual).toBe(inherited.canonical)
    expect(inherited.actual).not.toBe(expected)
    expect(inherited.canonicalCalls).toBe(1)
    expect(inherited.actualCalls).toBe(1)

    const hashPrototype = Bun.CryptoHasher.prototype
    const hashDescriptor = originalDescriptor(hashPrototype, "digest")
    if (!hashDescriptor || !("value" in hashDescriptor) || typeof hashDescriptor.value !== "function")
      throw new Error("Original hash method unavailable")
    const originalHash = hashDescriptor.value, hashCount = { calls: 0 }
    const hashed = withDataMethod(hashPrototype, "digest", function (this: unknown, ...args: unknown[]) {
      hashCount.calls++
      return Reflect.apply(originalHash, this, args)
    }, () => ({ value: owner.digest(value), calls: hashCount.calls }))
    expect(hashed).toEqual({ value: expected, calls: 1 })

    const failure = new Error("Original hash failure"), failedCount = { calls: 0 }
    const failed = withDataMethod(hashPrototype, "digest", function () {
      failedCount.calls++
      throw failure
    }, () => observe(() => owner.digest(value)))
    expect(failed.ok).toBe(false)
    if (failed.ok) throw new Error("Expected the original hash failure")
    expect(failed.error).toBe(failure)
    expect(failedCount.calls).toBe(1)
    expect(owner.digest(value)).toBe(expected)

    const serializerDescriptor = originalDescriptor(JSON, "stringify")
    if (!serializerDescriptor) throw new Error("Original serializer unavailable")
    const once = { calls: 0 }
    const changedHash = digestSfValue("The original serializer changed for one call")
    const first = withDataMethod(JSON, "stringify", function () {
      once.calls++
      originalDefine(JSON, "stringify", serializerDescriptor)
      return canonicalSfValue("The original serializer changed for one call")
    }, () => owner.digest(value))
    expect(once.calls).toBe(1)
    expect(first).toBe(changedHash)
    expect(first).not.toBe(expected)
    expect(owner.digest(value)).toBe(expected)

    const selfRemovingHash = { calls: 0 }
    const special = withDataMethod(hashPrototype, "digest", function () {
      selfRemovingHash.calls++
      originalDefine(hashPrototype, "digest", hashDescriptor)
      return "The original hash returned this once"
    }, () => owner.digest(value))
    expect(special).toBe("The original hash returned this once")
    expect(selfRemovingHash.calls).toBe(1)
    expect(owner.digest(value)).toBe(expected)

    const cloneCount = { calls: 0 }
    const fresh = { changed: "fresh input while clone is opaque" }
    const native = digestSfValue(fresh)
    const cloned = withDataMethod(globalThis, "structuredClone", function () {
      cloneCount.calls++
      throw new Error("An opaque clone cannot affect the original digest")
    }, () => owner.digest(fresh))
    expect(cloned).toBe(native)
    expect(cloneCount.calls).toBe(0)
  } finally { owner.close(); await deadline.close() }
}, 15_000)

test("Tuple owners reject post-hash admission and remain canonical through close and reentrancy", async () => {
  const deadline = compositionTestDeadline("fresh-tuple-lifecycle", 12_000)
  const owner = createSfFreshTupleDigest()
  const closing = createSfFreshTupleDigest()
  const independent = createSfFreshTupleDigest()
  try {
    const value: Record<string, unknown> = { stable: 1 }
    const postRemoval = digestSfValue({ stable: 2 })
    const beforeRemoval = digestSfValue({ ephemeral: "observed once", stable: 2 })
    const reads = { value: 0 }
    originalDefine(value, "ephemeral", { configurable: true, enumerable: true, get: () => {
      reads.value++
      originalDelete(value, "ephemeral")
      value.stable = 2
      return "observed once"
    } })
    expect(owner.digest(value)).toBe(beforeRemoval)
    expect(reads.value).toBe(1)
    expect(value).toEqual({ stable: 2 })
    expect(owner.digest(value)).toBe(postRemoval)
    expect(postRemoval).not.toBe(beforeRemoval)

    const counts = { outer: 0, inner: 0 }
    const inner = { get value() { counts.inner++; return "Original inner value" } }
    const outer = { get nested() { counts.outer++; return owner.digest(inner) } }
    const expected = digestSfValue({ nested: digestSfValue({ value: "Original inner value" }) })
    expect(owner.digest(outer)).toBe(expected)
    expect(counts).toEqual({ outer: 1, inner: 1 })
    expect(owner.digest(outer)).toBe(expected)
    expect(counts).toEqual({ outer: 2, inner: 2 })

    const failure = new Error("Original reentrant getter failed"), errors = { reads: 0 }
    const failing = { get value() {
      errors.reads++
      owner.digest({ fresh: "inner before error" })
      throw failure
    } }
    const failed = observe(() => owner.digest(failing))
    expect(failed.ok).toBe(false)
    if (failed.ok) throw new Error("Expected original reentrant getter failure")
    expect(failed.error).toBe(failure)
    expect(errors.reads).toBe(1)
    expect(owner.digest(tuple())).toBe(digestSfValue(tuple()))

    const closeReads = { outer: 0, inner: 0 }
    const afterClose = { get value() { closeReads.inner++; return "Canonical after close" } }
    const closes = { get value() {
      closeReads.outer++
      closing.close()
      return closing.digest(afterClose)
    } }
    const closedExpected = digestSfValue({ value: digestSfValue({ value: "Canonical after close" }) })
    expect(closing.digest(closes)).toBe(closedExpected)
    expect(closeReads).toEqual({ outer: 1, inner: 1 })
    expect(closing.digest(afterClose)).toBe(digestSfValue({ value: "Canonical after close" }))
    expect(closeReads.inner).toBe(2)
    expect(independent.digest(tuple())).toBe(digestSfValue(tuple()))
    owner.close()
    owner.close()
    expect(owner.digest(inner)).toBe(digestSfValue({ value: "Original inner value" }))
    expect(counts.inner).toBe(3)
    expect(independent.digest({ changed: true })).toBe(digestSfValue({ changed: true }))
  } finally { owner.close(); closing.close(); independent.close(); await deadline.close() }
}, 15_000)

test("Fresh tuple inspection keeps own-key cardinality and separates active cycles from completed aliases", async () => {
  const deadline = compositionTestDeadline("fresh-tuple-inspection", 12_000)
  const owner = createSfFreshTupleDigest()
  try {
    const changedKeys: readonly (readonly [unknown, unknown])[] = [
      [{ a: 1, b: 2 }, { a: 1 }],
      [{ slot: undefined }, {}],
      [{ slot: undefined }, { other: undefined }],
      [[undefined], []],
      [[undefined], [undefined, undefined]],
    ]
    for (const [before, after] of changedKeys) {
      deadline.check()
      const previous = digestSfValue(before), next = digestSfValue(after)
      expect(previous).not.toBe(next)
      expect(owner.digest(before)).toBe(previous)
      expect(owner.digest(after)).toBe(next)
      expect(owner.digest(structuredClone(before))).toBe(previous)
    }

    const namedValue = { amount: 7 }
    const named: Record<string, unknown> = { constructor: undefined, toJSON: "ordinary data" }
    originalDefine(named, "__proto__", { value: namedValue, enumerable: true, writable: true, configurable: true })
    const namedDigest = digestSfValue(named)
    expect(Object.getPrototypeOf(named)).toBe(Object.prototype)
    expect(Object.hasOwn(named, "__proto__")).toBe(true)
    expect(owner.digest(named)).toBe(namedDigest)
    expect(owner.digest(structuredClone(named))).toBe(namedDigest)
    namedValue.amount = 8
    const changedNamedDigest = digestSfValue(named)
    expect(changedNamedDigest).not.toBe(namedDigest)
    expect(owner.digest(named)).toBe(changedNamedDigest)
    expect(Object.getPrototypeOf(named)).toBe(Object.prototype)

    const leaf = { amount: 7 }, branch = { leaf }
    const diamond = { left: branch, right: branch }
    const divergent = { left: { leaf: { amount: 7 } }, right: { leaf: { amount: 9 } } }
    const independent = { left: { leaf: { amount: 7 } }, right: { leaf: { amount: 7 } } }
    const diamondDigest = digestSfValue(diamond), divergentDigest = digestSfValue(divergent)
    expect(diamondDigest).not.toBe(divergentDigest)
    expect(diamondDigest).toBe(digestSfValue(independent))
    expect(owner.digest(divergent)).toBe(divergentDigest)
    expect(owner.digest(diamond)).toBe(diamondDigest)
    expect(owner.digest(structuredClone(diamond))).toBe(diamondDigest)
    expect(owner.digest(independent)).toBe(diamondDigest)
    leaf.amount = 8
    expect(owner.digest(diamond)).toBe(digestSfValue(diamond))
    expect(owner.digest(independent)).toBe(diamondDigest)

    const shared = { amount: 4 }, bridge: unknown[] = []
    const cycle = { a: shared, b: shared, z: bridge }
    bridge.push(cycle)
    const acyclic = { a: { amount: 4 }, b: { amount: 4 },
      z: [{ a: { amount: 4 }, b: { amount: 4 }, z: [] }] }
    expect(owner.digest(acyclic)).toBe(digestSfValue(acyclic))
    const originalCycle = observe(() => digestSfValue(cycle))
    const observedCycle = observe(() => owner.digest(cycle))
    expect(originalCycle.ok).toBe(false)
    expect(comparable(observedCycle)).toEqual(comparable(originalCycle))
    expect(owner.digest(acyclic)).toBe(digestSfValue(acyclic))

    const reads = { opaque: 0, failed: 0 }
    const opaque = { a: shared, b: shared, get z() { reads.opaque++; return "original opaque value" } }
    const opaqueExpected = digestSfValue({ a: shared, b: shared, z: "original opaque value" })
    expect(owner.digest(opaque)).toBe(opaqueExpected)
    expect(reads.opaque).toBe(1)
    const recovered = { a: shared, b: shared, z: "fresh after opaque" }
    expect(owner.digest(recovered)).toBe(digestSfValue(recovered))
    expect(owner.digest(structuredClone(recovered))).toBe(digestSfValue(recovered))

    const failure = new Error("Late original tuple getter failed")
    const failing = { a: shared, b: shared, get z() { reads.failed++; throw failure } }
    const failed = observe(() => owner.digest(failing))
    expect(failed.ok).toBe(false)
    if (failed.ok) throw new Error("Expected the original late getter error")
    expect(failed.error).toBe(failure)
    expect(reads.failed).toBe(1)
    shared.amount = 5
    expect(owner.digest(recovered)).toBe(digestSfValue(recovered))
    expect(owner.digest(structuredClone(recovered))).toBe(digestSfValue(recovered))
  } finally { owner.close(); await deadline.close() }
}, 15_000)

test("Fresh tuple digests keep retargeted shared-buffer views on the original digest path", async () => {
  const deadline = compositionTestDeadline("fresh-tuple-clone-brand", 12_000)
  const owner = createSfFreshTupleDigest()
  try {
    const buffer = new SharedArrayBuffer(3)
    const writer = new Uint8Array(buffer)
    writer.set([3, 5, 8])
    const value = new Uint8Array(buffer)
    Object.setPrototypeOf(value, Object.prototype)
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype)
    expect(ArrayBuffer.isView(value)).toBe(true)
    const detached = structuredClone(value)
    expect(Object.getPrototypeOf(detached)).toBe(Uint8Array.prototype)
    expect(ArrayBuffer.isView(detached)).toBe(true)

    const initial = digestSfValue(value)
    expect(owner.digest(value)).toBe(initial)
    expect(owner.digest(value)).toBe(initial)
    writer[0] = 13
    expect(detached[0]).toBe(13)
    const changed = digestSfValue(value)
    expect(changed).not.toBe(initial)
    expect(owner.digest(value)).toBe(changed)
    expect(owner.digest(value)).toBe(changed)

    deadline.check()
    const nestedBuffer = new SharedArrayBuffer(2)
    const nestedWriter = new Uint8Array(nestedBuffer)
    nestedWriter.set([21, 34])
    const nestedView = new Uint8Array(nestedBuffer)
    Object.setPrototypeOf(nestedView, Object.prototype)
    const nested = { state: { view: nestedView }, snapshots: [{ alias: nestedView }], sources: { revision: 1 } }
    const nestedDetached = structuredClone(nested)
    expect(nestedDetached.state.view).toBe(nestedDetached.snapshots[0]!.alias)
    expect(Object.getPrototypeOf(nestedDetached.state.view)).toBe(Uint8Array.prototype)
    const nestedInitial = digestSfValue(nested)
    expect(owner.digest(nested)).toBe(nestedInitial)
    expect(owner.digest(nested)).toBe(nestedInitial)
    nestedWriter[1] = 55
    expect(nestedDetached.state.view[1]).toBe(55)
    const nestedChanged = digestSfValue(nested)
    expect(nestedChanged).not.toBe(nestedInitial)
    expect(owner.digest(nested)).toBe(nestedChanged)
    expect(owner.digest(nested)).toBe(nestedChanged)

    const recovered = tuple()
    const recoveredDigest = digestSfValue(recovered)
    expect(owner.digest(recovered)).toBe(recoveredDigest)
    expect(owner.digest(structuredClone(recovered))).toBe(recoveredDigest)
    owner.close()
    writer[2] = 89
    expect(owner.digest(value)).toBe(digestSfValue(value))
    nestedWriter[0] = 144
    expect(owner.digest(nested)).toBe(digestSfValue(nested))
    expect(owner.digest(recovered)).toBe(recoveredDigest)
  } finally { owner.close(); await deadline.close() }
}, 15_000)
