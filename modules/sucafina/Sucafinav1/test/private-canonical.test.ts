import { expect, test } from "bun:test"
import { types } from "node:util"
import { canonicalSfValue, digestSfValue } from "../product/contracts/canonical.ts"
import { canonicalSfPrivateValue, compareSfPrivateCanonical, digestSfPrivateValue } from "../product/contracts/private-canonical.ts"

test("private canonical fragments retain exact tagged bytes for detached aliases and ordinary values", () => {
  expect(typeof types.isProxy).toBe("function")
  expect(types.isProxy({})).toBe(false)
  expect(types.isProxy(new Proxy({}, {}))).toBe(true)
  const revoked = Proxy.revocable({}, {})
  revoked.revoke()
  expect(types.isProxy(revoked.proxy)).toBe(true)

  const shared = { z: null, text: "Unicode ç\\\n\u0000", absent: undefined, signed: -0, list: [false, true, 0, 1e30] }
  const source = structuredClone({ left: shared, right: shared, values: Array.from({ length: 96 }, (_, id) => ({
    id, sourceRefs: [shared], amount: id / 7,
  })) })
  const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, { b: -0, a: shared })
  const symbol = Symbol("ignored")
  const hidden = Object.defineProperty({ amount: 2 }, "hidden", { value: 3 })
  const symbolKey = { amount: 2, [symbol]: "not an own string key" }
  for (const value of [undefined, null, true, false, -0, 0, 1.234, "", "\ud800", [], {}, source, nullPrototype, hidden, symbolKey]) {
    expect(canonicalSfPrivateValue(value)).toBe(canonicalSfValue(value))
    expect(digestSfPrivateValue(value)).toBe(digestSfValue(value))
  }
  expect(digestSfPrivateValue({ z: null, b: -0, a: undefined }))
    .toBe("b4a421d81576203d897e3517a69b9c626cf7ffbc56c3356ee588f8c96d97be41")
  expect(source.left).toBe(source.right)
  const before = digestSfPrivateValue(source)
  source.right.text = "changed after the first observation"
  expect(digestSfPrivateValue(source)).toBe(digestSfValue(source))
  expect(digestSfPrivateValue(source)).not.toBe(before)
  expect(digestSfPrivateValue({ a: -0 })).not.toBe(digestSfPrivateValue({ a: 0 }))
})

test("private canonical eligibility never consumes getters or Proxy traps before the original walk", () => {
  const getter = () => {
    let calls = 0
    const shared = Object.defineProperty({}, "amount", { enumerable: true, get: () => ++calls })
    return { value: { first: shared, second: shared }, calls: () => calls }
  }
  const original = getter(), fast = getter()
  expect(canonicalSfPrivateValue(fast.value)).toBe(canonicalSfValue(original.value))
  expect(fast.calls()).toBe(original.calls())
  expect(fast.calls()).toBe(2)

  const proxy = () => {
    const calls: string[] = []
    const value = new Proxy({ amount: 4 }, {
      get(target, key, receiver) { calls.push("get:" + String(key)); return Reflect.get(target, key, receiver) },
      getPrototypeOf(target) { calls.push("prototype"); return Reflect.getPrototypeOf(target) },
      ownKeys(target) { calls.push("keys"); return Reflect.ownKeys(target) },
      getOwnPropertyDescriptor(target, key) { calls.push("descriptor:" + String(key)); return Reflect.getOwnPropertyDescriptor(target, key) },
    })
    return { value, calls }
  }
  const first = proxy(), second = proxy()
  expect(canonicalSfPrivateValue(second.value)).toBe(canonicalSfValue(first.value))
  expect(second.calls).toEqual(first.calls)

  const accessor = Object.defineProperty({ amount: 4 }, "ignored", { get: () => { throw new Error("must stay unread") } })
  expect(canonicalSfPrivateValue(accessor)).toBe(canonicalSfValue(accessor))
})

test("private canonical observations preserve holes, custom prototypes, invalid data and cycles", () => {
  const sparse = new Array(3); sparse[1] = undefined
  const ownMap = Object.assign([1, 2], { map: () => ["custom map result"] })
  const ownToJSON = Object.assign([1, 2], { toJSON: () => "must not replace tagged values" })
  for (const value of [sparse, ownMap, ownToJSON]) expect(canonicalSfPrivateValue(value)).toBe(canonicalSfValue(value))
  for (const value of [NaN, Infinity, -Infinity, 1n, Symbol("invalid"), () => 1, new Date(0), Object.create({ inherited: true })]) {
    let original: unknown, privateError: unknown
    try { canonicalSfValue(value) } catch (error) { original = error }
    try { canonicalSfPrivateValue(value) } catch (error) { privateError = error }
    expect(privateError).toBeInstanceOf(Error)
    expect((privateError as Error).name).toBe((original as Error).name)
    expect((privateError as Error).message).toBe((original as Error).message)
  }
  const cycle: { next?: object } = {}; cycle.next = cycle
  expect(() => canonicalSfValue(cycle)).toThrow(RangeError)
  expect(() => canonicalSfPrivateValue(cycle)).toThrow(RangeError)
  const revoked = Proxy.revocable({}, {}); revoked.revoke()
  expect(() => canonicalSfValue(revoked.proxy)).toThrow(TypeError)
  expect(() => canonicalSfPrivateValue(revoked.proxy)).toThrow(TypeError)
})

test("private canonical route falls back when the serializer, prototype or Proxy inspector changes", () => {
  const stringify = Object.getOwnPropertyDescriptor(JSON, "stringify")!
  const proxy = Object.getOwnPropertyDescriptor(types, "isProxy")!
  const arrayJSON = Object.getOwnPropertyDescriptor(Array.prototype, "toJSON")
  const species = Object.getOwnPropertyDescriptor(Array, Symbol.species)!
  const indexZero = Object.getOwnPropertyDescriptor(Array.prototype, "0")
  let calls = 0
  try {
    Object.defineProperty(JSON, "stringify", { ...stringify, value: (value: unknown) => { calls++; return stringify.value(value) } })
    const expected = canonicalSfValue({ amount: 7 })
    calls = 0
    const actual = canonicalSfPrivateValue({ amount: 7 }), actualCalls = calls
    Object.defineProperty(JSON, "stringify", stringify)
    expect(actual).toBe(expected)
    expect(actualCalls).toBe(1)

    let reads = 0
    Object.defineProperty(JSON, "stringify", { configurable: true, get: () => { reads++; return stringify.value } })
    const originalBytes = canonicalSfValue({ getter: "serializer" })
    reads = 0
    const privateBytes = canonicalSfPrivateValue({ getter: "serializer" }), privateReads = reads
    Object.defineProperty(JSON, "stringify", stringify)
    expect(privateBytes).toBe(originalBytes)
    expect(privateReads).toBe(1)

    Object.defineProperty(Array, Symbol.species, { configurable: true, get: () => { calls++; return Array } })
    calls = 0
    const arrayBytes = canonicalSfValue([1, 2]), originalCalls = calls
    calls = 0
    const privateArray = canonicalSfPrivateValue([1, 2]), privateCalls = calls
    Object.defineProperty(Array, Symbol.species, species)
    expect(privateArray).toBe(arrayBytes)
    expect(privateCalls).toBe(originalCalls)
    expect(privateCalls).toBeGreaterThan(0)

    Object.defineProperty(types, "isProxy", { ...proxy, value: undefined })
    const withoutProxyInspector = canonicalSfPrivateValue({ amount: 8 })
    Object.defineProperty(types, "isProxy", proxy)
    expect(withoutProxyInspector).toBe(canonicalSfValue({ amount: 8 }))

    Object.defineProperty(Array.prototype, "toJSON", { configurable: true, value() { return "hooked canonical array" } })
    const canonicalHook = canonicalSfValue({ amount: 9 }), privateHook = canonicalSfPrivateValue({ amount: 9 })
    if (arrayJSON) Object.defineProperty(Array.prototype, "toJSON", arrayJSON)
    else Reflect.deleteProperty(Array.prototype, "toJSON")
    expect(privateHook).toBe(canonicalHook)

    Object.defineProperty(Array.prototype, "0", { configurable: true, get: () => 99, set: () => { calls++ } })
    calls = 0
    const canonicalIndex = canonicalSfValue({ values: [1, 2] }), canonicalIndexCalls = calls
    calls = 0
    const privateIndex = canonicalSfPrivateValue({ values: [1, 2] }), privateIndexCalls = calls
    if (indexZero) Object.defineProperty(Array.prototype, "0", indexZero)
    else Reflect.deleteProperty(Array.prototype, "0")
    expect(privateIndex).toBe(canonicalIndex)
    expect(privateIndexCalls).toBe(canonicalIndexCalls)
  } finally {
    Object.defineProperty(JSON, "stringify", stringify)
    Object.defineProperty(types, "isProxy", proxy)
    Object.defineProperty(Array, Symbol.species, species)
    if (arrayJSON) Object.defineProperty(Array.prototype, "toJSON", arrayJSON)
    else Reflect.deleteProperty(Array.prototype, "toJSON")
    if (indexZero) Object.defineProperty(Array.prototype, "0", indexZero)
    else Reflect.deleteProperty(Array.prototype, "0")
  }
})

test("private source comparisons share complete bytes only within a verified synchronous graph", () => {
  const reference = { kind: "record", target: { id: "source", revision: 1 }, amount: -0 }
  const projection = { values: Array.from({ length: 128 }, () => ({ sourceRefs: [reference] })) }
  let retained: ((value: unknown) => string) | undefined
  expect(compareSfPrivateCanonical({ projection, reference }, (canonical) => {
    retained = canonical
    const expected = canonical(reference)
    return projection.values.every((value) => value.sourceRefs.length === 1 && canonical(value.sourceRefs[0]) === expected)
  })).toBe(true)
  expect(() => retained!(reference)).toThrow("SF_PRIVATE_CANONICAL_CLOSED")
  const different = structuredClone(reference); different.target.revision++
  projection.values[70]!.sourceRefs = [different]
  expect(compareSfPrivateCanonical({ projection, reference }, (canonical) => {
    const expected = canonical(reference)
    return projection.values.every((value) => canonical(value.sourceRefs[0]) === expected)
  })).toBe(false)
  projection.values[70]!.sourceRefs = [reference]
  expect(compareSfPrivateCanonical({ projection, reference }, (canonical) => {
    const first = canonical(reference)
    reference.target.revision++
    return first === canonical(reference)
  })).toBe(false)
  expect(canonicalSfPrivateValue(reference)).toBe(canonicalSfValue(reference))
  const hidden = Object.defineProperty({}, "source", { value: reference })
  expect(compareSfPrivateCanonical({ hidden, reference }, (canonical) =>
    canonical(Object.getOwnPropertyDescriptor(hidden, "source")!.value) === canonical(reference))).toBe(true)
})

test("a late source getter cannot repair an earlier mismatching alias before original short-circuit", () => {
  const fixture = (initialMatch: boolean) => {
    const expected = { id: "source", revision: 1 }, earlier = { id: "source", revision: initialMatch ? 1 : 2 }
    let reads = 0
    const later = Object.defineProperty({} as { sourceRefs: readonly object[] }, "sourceRefs", {
      enumerable: true, get: () => { reads++; earlier.revision = initialMatch ? 2 : 1; return [expected] },
    })
    return { expected, values: [{ sourceRefs: [earlier] }, later], reads: () => reads, earlier }
  }
  const original = (value: ReturnType<typeof fixture>) => {
    const expected = digestSfValue(value.expected)
    const matches = value.values.every((entry) =>
      entry.sourceRefs.length === 1 && digestSfValue(entry.sourceRefs[0]) === expected)
    return matches && digestSfValue(value.expected) === expected
  }
  for (const initialMatch of [false, true]) {
    const direct = fixture(initialMatch), guarded = fixture(initialMatch)
    let entered = false
    expect(compareSfPrivateCanonical({ expected: guarded.expected, values: guarded.values }, () => { entered = true; return true })).toBeUndefined()
    expect(entered).toBe(false)
    expect(guarded.reads()).toBe(0)
    expect(original(guarded)).toBe(original(direct))
    expect(guarded.reads()).toBe(direct.reads())
    expect(guarded.earlier).toEqual(direct.earlier)
    expect(guarded.reads()).toBe(initialMatch ? 2 : 0)
  }
})

test("private source comparison preserves observable CryptoHasher constructor, update and digest hooks", () => {
  const constructor = Object.getOwnPropertyDescriptor(Bun, "CryptoHasher")!
  const update = Object.getOwnPropertyDescriptor(Bun.CryptoHasher.prototype, "update")!
  const digest = Object.getOwnPropertyDescriptor(Bun.CryptoHasher.prototype, "digest")!
  expect(typeof update.value).toBe("function")
  expect(typeof digest.value).toBe("function")
  const reference = { revision: 1 }, source = structuredClone(reference)
  let calls = 0
  const check = () => {
    let entered = false
    const result = compareSfPrivateCanonical({ reference, source }, () => { entered = true; return true })
    expect(result).toBeUndefined()
    expect(entered).toBe(false)
    expect(calls).toBe(0)
    expect(digestSfValue(reference)).toBe(digestSfValue(source))
    expect(calls).toBeGreaterThan(0)
  }
  try {
    Object.defineProperty(Bun, "CryptoHasher", { ...constructor, value: new Proxy(constructor.value, {
      construct(target, args) { calls++; return Reflect.construct(target, args, target) },
    }) })
    check()
    Object.defineProperty(Bun, "CryptoHasher", constructor)
    calls = 0
    Object.defineProperty(Bun.CryptoHasher.prototype, "update", { ...update, value: function(this: unknown, ...args: unknown[]) {
      calls++; return Reflect.apply(update.value, this, args)
    } })
    check()
    Object.defineProperty(Bun.CryptoHasher.prototype, "update", update)
    calls = 0
    Object.defineProperty(Bun.CryptoHasher.prototype, "digest", { ...digest, value: function(this: unknown, ...args: unknown[]) {
      calls++; return Reflect.apply(digest.value, this, args)
    } })
    check()
  } finally {
    Object.defineProperty(Bun, "CryptoHasher", constructor)
    Object.defineProperty(Bun.CryptoHasher.prototype, "update", update)
    Object.defineProperty(Bun.CryptoHasher.prototype, "digest", digest)
  }
})
