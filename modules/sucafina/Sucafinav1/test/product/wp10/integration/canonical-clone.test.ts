import { expect, test } from "bun:test"
import { canonicalSfValue, digestSfValue } from "../../../../product/contracts/canonical.ts"
import { cloneSfCanonicalValues, sfCanonicalCloneTree } from "../../../../product/contracts/canonical-clone.ts"

const property = Object.getOwnPropertyDescriptor, define = Object.defineProperty
const create = Object.create, assign = Object.assign, remove = Reflect.deleteProperty
const apply = Reflect.apply, nativeClone = structuredClone, nativeMap = Array.prototype.map
const species = Symbol.species

// Null-prototype descriptors keep the restoration helpers independent of the
// inherited get/set hooks exercised below.
function descriptor(value: PropertyDescriptor): PropertyDescriptor {
  return assign(create(null), value)
}
function withProperty<Value>(owner: object, key: PropertyKey, replacement: PropertyDescriptor, work: () => Value): Value {
  const saved = property(owner, key)
  const savedLength = owner === Array.prototype ? property(owner, "length") : undefined
  define(owner, key, descriptor(replacement))
  try { return work() } finally {
    if (saved) define(owner, key, descriptor(saved))
    else remove(owner, key)
    if (savedLength) define(owner, "length", descriptor(savedLength))
  }
}
function withValue<Value>(owner: object, key: PropertyKey, value: unknown, work: () => Value): Value {
  const saved = property(owner, key)
  if (!saved || !Object.hasOwn(saved, "value")) throw new Error("expected own data property")
  return withProperty(owner, key, { ...saved, value }, work)
}
function outcome<Value>(work: () => Value) {
  try { return { ok: true as const, value: work() } } catch (error) {
    return { ok: false as const, error: error instanceof Error ? { name: error.name, message: error.message } : error }
  }
}
function clone<Value>(value: Value): Value {
  const copies = cloneSfCanonicalValues([value])
  expect(copies).toHaveLength(1)
  return copies[0] as Value
}
function admittedBytes(value: unknown, oracle: unknown): string {
  // The oracle is cloned outside the registering helper. Its production
  // canonicalizer therefore exercises the original route, not this encoder.
  expect(sfCanonicalCloneTree(oracle)).toBeUndefined()
  const tree = sfCanonicalCloneTree(value)
  expect(tree).toBeDefined()
  if (!tree) throw new Error("expected a real admitted canonical tree")
  const bytes = JSON.stringify(tree)
  expect(bytes).toBe(canonicalSfValue(oracle))
  expect(canonicalSfValue(value)).toBe(bytes)
  expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(digestSfValue(oracle))
  expect(digestSfValue(value)).toBe(digestSfValue(oracle))
  return bytes
}

test("native-clone canonical trees preserve the existing SHA and canonical value distinctions", () => {
  const golden = { z: null, b: -0, a: undefined }
  const copied = clone(golden), oracle = nativeClone(golden)
  admittedBytes(copied, oracle)
  expect(digestSfValue(copied)).toBe("b4a421d81576203d897e3517a69b9c626cf7ffbc56c3356ee588f8c96d97be41")
  expect(digestSfValue(copied)).not.toBe(digestSfValue({ ...oracle, b: 0 }))
  expect(digestSfValue(copied)).not.toBe(digestSfValue({ z: null, b: -0 }))

  const input = {
    z: undefined, a: true, empty: "", nil: null,
    text: 'Café 漢字 😀 \u0000 \b \f \n \r \t " \\',
    loneHigh: "\ud800", loneLow: "\udfff",
    numbers: [-0, 0, 1.25, -2, Number.MIN_VALUE, Number.MAX_VALUE],
    dictionary: assign(create(null), { "\uffff": "last", "10": "ten", "2": "two", a: false }),
  }
  admittedBytes(clone(input), nativeClone(input))
  expect(sfCanonicalCloneTree(input)).toBeUndefined()
  expect(canonicalSfValue(clone({ second: 2, first: 1 }))).toBe(canonicalSfValue({ first: 1, second: 2 }))
})

test("each native clone is independent while sourceRefs and drilldown aliases remain internal to that clone", () => {
  const ref = { kind: "record", refDigest: "reference", target: { version: 1, fields: ["amount"] } }
  const input = {
    sourceRefs: [ref, ref],
    authorizedProjection: { values: [{ amount: 10, sourceRefs: [ref] }] },
    drilldown: [{ sourceRef: ref, sourceRefs: [ref] }],
  }
  const copies = cloneSfCanonicalValues([input, input]), first = copies[0]!, second = copies[1]!
  expect(first).not.toBe(input)
  expect(second).not.toBe(first)
  expect(first.sourceRefs[0]).toBe(first.sourceRefs[1])
  expect(first.sourceRefs[0]).toBe(first.authorizedProjection.values[0]!.sourceRefs[0])
  expect(first.sourceRefs[0]).toBe(first.drilldown[0]!.sourceRef)
  expect(first.sourceRefs[0]).toBe(first.drilldown[0]!.sourceRefs[0])
  expect(first.sourceRefs[0]).not.toBe(ref)
  expect(first.sourceRefs[0]).not.toBe(second.sourceRefs[0])
  admittedBytes(first, nativeClone(input))
  first.sourceRefs[0]!.target.version = 2
  expect(ref.target.version).toBe(1)
  expect(second.sourceRefs[0]!.target.version).toBe(1)
  admittedBytes(first, nativeClone(first))
  admittedBytes(second, nativeClone(input))

  let reads = 0
  const withGetter = { get value() { reads++; return { amount: 3 } } }
  const observed = cloneSfCanonicalValues([withGetter, withGetter])
  expect(reads).toBe(2)
  expect(observed[0]!.value).not.toBe(observed[1]!.value)
  admittedBytes(observed[0], nativeClone({ value: { amount: 3 } }))
  expect(reads).toBe(2)
})

test("tagged subtrees are shared only within one walk and later primitive mutations are read again", () => {
  const shared = { amount: 1 }, copied = clone([shared, shared])
  const first = sfCanonicalCloneTree(copied), second = sfCanonicalCloneTree(copied)
  expect(first).toBeDefined()
  expect(second).toBeDefined()
  if (!first || !second || !Array.isArray(first[1]) || !Array.isArray(second[1]))
    throw new Error("expected admitted array trees")
  expect(first).not.toBe(second)
  expect(first[1][0]).toBe(first[1][1])
  expect(second[1][0]).toBe(second[1][1])
  expect(first[1][0]).not.toBe(second[1][0])
  copied[0]!.amount = 9
  admittedBytes(copied, nativeClone(copied))
  expect(JSON.stringify(first)).not.toBe(canonicalSfValue(copied))

  const input: { amount: number; removable?: boolean; added?: unknown; child: { amount: number } } =
    { amount: 1, removable: true, child: { amount: 2 } }
  const value = clone(input), before = admittedBytes(value, nativeClone(input))
  value.amount = -0
  value.child.amount = 4
  value.added = undefined
  remove(value, "removable")
  expect(admittedBytes(value, nativeClone(value))).not.toBe(before)
  value.child = { amount: 5 }
  expect(sfCanonicalCloneTree(value)).toBeUndefined()
  expect(canonicalSfValue(value)).toBe(canonicalSfValue(nativeClone(value)))
})

test("new accessors and Proxy children are refused before their effects and retain original fallback", () => {
  const copied = clone({ amount: 1 })
  let getterReads = 0
  const failure = new Error("original canonical getter failure")
  withProperty(copied, "amount", { configurable: true, enumerable: true, get: () => {
    getterReads++
    throw failure
  } }, () => {
    expect(sfCanonicalCloneTree(copied)).toBeUndefined()
    expect(getterReads).toBe(0)
    expect(() => canonicalSfValue(copied)).toThrow(failure)
    expect(getterReads).toBe(1)
  })
  admittedBytes(copied, nativeClone({ amount: 1 }))

  function proxied() {
    const trace: string[] = []
    const value = new Proxy({ amount: 2 }, {
      getPrototypeOf(target) { trace.push("prototype"); return Reflect.getPrototypeOf(target) },
      ownKeys(target) { trace.push("keys"); return Reflect.ownKeys(target) },
      getOwnPropertyDescriptor(target, key) { trace.push("descriptor:" + String(key)); return property(target, key) },
      get(target, key, receiver) { trace.push("get:" + String(key)); return Reflect.get(target, key, receiver) },
    })
    return { value, trace }
  }
  const actualProxy = proxied(), oracleProxy = proxied()
  const actual = clone({ child: { amount: 0 } }), oracle = nativeClone({ child: { amount: 0 } })
  actual.child = actualProxy.value
  oracle.child = oracleProxy.value
  expect(sfCanonicalCloneTree(actual)).toBeUndefined()
  expect(actualProxy.trace).toEqual([])
  expect(canonicalSfValue(actual)).toBe(canonicalSfValue(oracle))
  expect(actualProxy.trace).toEqual(oracleProxy.trace)
  expect(actualProxy.trace.length).toBeGreaterThan(0)
})

test("sparse arrays and own map, constructor and species changes retain the original array route", () => {
  const sparse = clone([1, , 3]), oracle = nativeClone([1, , 3])
  expect(sfCanonicalCloneTree(sparse)).toBeUndefined()
  expect(canonicalSfValue(sparse)).toBe(canonicalSfValue(oracle))
  expect(canonicalSfValue(sparse)).not.toBe(canonicalSfValue([1, undefined, 3]))

  // A named key can hide a hole from a cardinality-only shape check.
  const hiddenHole = clone([1, 2])
  remove(hiddenHole, "0")
  define(hiddenHole, "extra", descriptor({ value: 3, enumerable: true, configurable: true, writable: true }))
  expect(sfCanonicalCloneTree(hiddenHole)).toBeUndefined()
  expect(canonicalSfValue(hiddenHole)).toBe(canonicalSfValue(nativeClone(hiddenHole)))

  const copied = clone([1, 2]), expected = canonicalSfValue(nativeClone([1, 2]))
  let mapCalls = 0
  const ownMap = new Proxy(nativeMap, { apply(target, receiver, args) {
    mapCalls++
    return apply(target, receiver, args)
  } })
  const mapped = withProperty(copied, "map", { configurable: true, value: ownMap }, () => {
    const tree = sfCanonicalCloneTree(copied), before = mapCalls
    const bytes = canonicalSfValue(copied)
    return { tree, before, bytes, calls: mapCalls }
  })
  expect(mapped).toEqual({ tree: undefined, before: 0, bytes: expected, calls: 1 })

  let constructorReads = 0
  const constructed = withProperty(copied, "constructor", { configurable: true, get: () => {
    constructorReads++
    return Array
  } }, () => {
    const tree = sfCanonicalCloneTree(copied), before = constructorReads
    const bytes = canonicalSfValue(copied)
    return { tree, before, bytes, calls: constructorReads }
  })
  expect(constructed).toEqual({ tree: undefined, before: 0, bytes: expected, calls: 1 })

  let speciesReads = 0
  const constructor = { get [species]() { speciesReads++; return Array } }
  const specialized = withProperty(copied, "constructor", { configurable: true, value: constructor }, () => {
    const tree = sfCanonicalCloneTree(copied), before = speciesReads
    const bytes = canonicalSfValue(copied)
    return { tree, before, bytes, calls: speciesReads }
  })
  expect(specialized).toEqual({ tree: undefined, before: 0, bytes: expected, calls: 1 })

  let globalSpeciesReads = 0
  const globalConstructor = new Proxy(Array, { get(target, key, receiver) {
    if (key === species) globalSpeciesReads++
    return Reflect.get(target, key, receiver)
  } })
  const global = withValue(Array.prototype, "constructor", globalConstructor, () => {
    const tree = sfCanonicalCloneTree(copied), before = globalSpeciesReads
    const bytes = canonicalSfValue(copied)
    return { tree, before, bytes, reads: globalSpeciesReads }
  })
  expect(global.tree).toBeUndefined()
  expect(global.before).toBe(0)
  expect(global.bytes).toBe(expected)
  expect(global.reads).toBeGreaterThan(0)
})

test("non-original map or species on the helper input never registers its returned clones", () => {
  for (const key of ["map", "constructor", "species", species] as const) {
    const input = [{ amount: 1 }]
    const value = key === "map" ? nativeMap : key === "constructor" ? Array : "opaque-species"
    const copies = withProperty(input, key, { configurable: true, value }, () => cloneSfCanonicalValues(input))
    expect(copies).toEqual(nativeClone([{ amount: 1 }]))
    expect(sfCanonicalCloneTree(copies)).toBeUndefined()
    expect(sfCanonicalCloneTree(copies[0])).toBeUndefined()
  }

  const speciesDescriptor = property(Array, species)
  if (!speciesDescriptor) throw new Error("missing Array species")
  let reads = 0
  const copies = withProperty(Array, species, { ...speciesDescriptor, get: () => { reads++; return Array } },
    () => cloneSfCanonicalValues([{ amount: 1 }]))
  expect(reads).toBeGreaterThan(0)
  expect(sfCanonicalCloneTree(copies[0])).toBeUndefined()
})

test("clone and map hooks that restore themselves cannot register their output retroactively", () => {
  const cloneDescriptor = property(globalThis, "structuredClone"), mapDescriptor = property(Array.prototype, "map")
  if (!cloneDescriptor || !mapDescriptor) throw new Error("missing clone or map descriptor")
  let cloneCalls = 0, mapCalls = 0
  const transientClone = new Proxy(nativeClone, { apply(target, receiver, args) {
    cloneCalls++
    define(globalThis, "structuredClone", descriptor(cloneDescriptor))
    return apply(target, receiver, args)
  } })
  const copied = withValue(globalThis, "structuredClone", transientClone, () => cloneSfCanonicalValues([{ amount: 1 }]))
  expect(cloneCalls).toBe(1)
  expect(sfCanonicalCloneTree(copied[0])).toBeUndefined()
  expect(canonicalSfValue(copied[0])).toBe(canonicalSfValue(nativeClone({ amount: 1 })))

  const transientMap = new Proxy(nativeMap, { apply(target, receiver, args) {
    mapCalls++
    define(Array.prototype, "map", descriptor(mapDescriptor))
    return apply(target, receiver, args)
  } })
  const mapped = withValue(Array.prototype, "map", transientMap, () => cloneSfCanonicalValues([{ amount: 1 }]))
  expect(mapCalls).toBe(1)
  expect(sfCanonicalCloneTree(mapped[0])).toBeUndefined()
  expect(canonicalSfValue(mapped[0])).toBe(canonicalSfValue(nativeClone({ amount: 1 })))
})

test("later JSON, Number, Object and Array hooks keep the original canonical effects", () => {
  const copied = clone({ amount: -0, values: [1, true, null] }), expected = canonicalSfValue(nativeClone(copied))
  const hooks = [
    { owner: JSON, key: "stringify", value: JSON.stringify },
    { owner: Number, key: "isFinite", value: Number.isFinite },
    { owner: Object, key: "is", value: Object.is },
    { owner: Object, key: "keys", value: Object.keys },
    { owner: Object, key: "getPrototypeOf", value: Object.getPrototypeOf },
    { owner: Array, key: "isArray", value: Array.isArray },
    { owner: Array.prototype, key: "map", value: Array.prototype.map },
    { owner: Array.prototype, key: "sort", value: Array.prototype.sort },
    { owner: Array.prototype, key: "includes", value: Array.prototype.includes },
  ]
  for (const hook of hooks) {
    let calls = 0
    const replacement = new Proxy(hook.value, { apply(target, receiver, args) {
      calls++
      return apply(target, receiver, args)
    } })
    const observed = withValue(hook.owner, hook.key, replacement, () => {
      const tree = sfCanonicalCloneTree(copied), before = calls
      const bytes = canonicalSfValue(copied)
      return { tree, before, bytes, calls }
    })
    expect(observed.tree).toBeUndefined()
    expect(observed.before).toBe(0)
    expect(observed.bytes).toBe(expected)
    expect(observed.calls).toBeGreaterThan(0)
  }
  admittedBytes(copied, nativeClone(copied))
})

test("inherited toJSON and a self-restoring serializer getter are preserved by fallback", () => {
  const copied = clone({ amount: 1 })
  for (const prototype of [Array.prototype, Object.prototype]) {
    let calls = 0
    const observed = withProperty(prototype, "toJSON", { configurable: true, value: () => { calls++; return "hooked" } }, () => {
      const tree = sfCanonicalCloneTree(copied), before = calls
      const bytes = canonicalSfValue(copied)
      return { tree, before, bytes, calls }
    })
    expect(observed).toEqual({ tree: undefined, before: 0, bytes: '"hooked"', calls: 1 })
  }

  const saved = property(JSON, "stringify")
  if (!saved) throw new Error("missing serializer descriptor")
  let getterReads = 0, serializerCalls = 0
  const observed = withProperty(JSON, "stringify", { configurable: true, get: () => {
    getterReads++
    define(JSON, "stringify", descriptor(saved))
    return () => { serializerCalls++; return '"self-restoring-serializer"' }
  } }, () => {
    const tree = sfCanonicalCloneTree(copied), before = getterReads
    const bytes = canonicalSfValue(copied)
    return { tree, before, bytes }
  })
  expect(observed).toEqual({ tree: undefined, before: 0, bytes: '"self-restoring-serializer"' })
  expect(getterReads).toBe(1)
  expect(serializerCalls).toBe(1)
  admittedBytes(copied, nativeClone(copied))
})

test("numeric prototype setters and inherited descriptor get/set hooks gain no new calls", () => {
  const copied = clone({ values: [{ amount: 1 }, { amount: 2 }] }), expected = canonicalSfValue(nativeClone(copied))
  for (const prototype of [Array.prototype, Object.prototype]) {
    let writes = 0
    const observed = withProperty(prototype, "0", { configurable: true, set: () => { writes++ } }, () => {
      const tree = sfCanonicalCloneTree(copied)
      return { tree, bytes: canonicalSfValue(copied), writes }
    })
    expect(observed.writes).toBe(0)
    expect(observed.bytes).toBe(expected)
    if (observed.tree) expect(JSON.stringify(observed.tree)).toBe(expected)
  }

  let descriptorReads = 0
  const inherited = () => { descriptorReads++; throw new Error("unexpected inherited descriptor access") }
  const observed = withProperty(Object.prototype, "get", { configurable: true, get: inherited }, () =>
    withProperty(Object.prototype, "set", { configurable: true, get: inherited }, () => {
      const tree = sfCanonicalCloneTree(copied)
      return { tree, bytes: canonicalSfValue(copied), reads: descriptorReads }
    }))
  expect(observed.reads).toBe(0)
  expect(descriptorReads).toBe(0)
  expect(observed.bytes).toBe(expected)
  if (observed.tree) expect(JSON.stringify(observed.tree)).toBe(expected)
})

test("a transient hasher update getter keeps serializer effects and cannot poison a later walk", () => {
  const copied = clone({ amount: 1 }), expected = digestSfValue(nativeClone(copied))
  const constructorDescriptor = property(Bun, "CryptoHasher"), stringifyDescriptor = property(JSON, "stringify")
  if (!constructorDescriptor || !stringifyDescriptor) throw new Error("missing native hash descriptors")
  const update = Bun.CryptoHasher.prototype.update
  const changedBytes = '"canonical-clone-under-update-getter"'
  const changedDigest = new Bun.CryptoHasher("sha256").update(changedBytes).digest("hex")
  let constructions = 0, updateReads = 0, serializerCalls = 0
  // Bun's prototype update is not configurable. Shadow it on a real instance.
  const constructor = new Proxy(Bun.CryptoHasher, { construct(target, args) {
    constructions++
    define(Bun, "CryptoHasher", descriptor(constructorDescriptor))
    const hasher = Reflect.construct(target, args)
    define(hasher, "update", descriptor({ configurable: true, get: () => {
      updateReads++
      remove(hasher, "update")
      define(JSON, "stringify", descriptor({ ...stringifyDescriptor, value: () => {
        serializerCalls++
        define(JSON, "stringify", descriptor(stringifyDescriptor))
        return changedBytes
      } }))
      return update
    } }))
    return hasher
  } })
  const actual = withValue(Bun, "CryptoHasher", constructor, () => {
    try { return digestSfValue(copied) } finally { define(JSON, "stringify", descriptor(stringifyDescriptor)) }
  })
  expect(constructions).toBe(1)
  expect(updateReads).toBe(1)
  expect(serializerCalls).toBe(1)
  expect(actual).toBe(changedDigest)
  expect(actual).not.toBe(expected)
  expect(digestSfValue(copied)).toBe(expected)
  admittedBytes(copied, nativeClone(copied))
})

test("cycles, nonfinite values and native exotics retain original fallback behavior", () => {
  const cycle: { self?: unknown } = {}
  cycle.self = cycle
  const cyclic = clone(cycle)
  expect(cyclic.self).toBe(cyclic)
  expect(sfCanonicalCloneTree(cyclic)).toBeUndefined()
  expect(() => canonicalSfValue(cyclic)).toThrow()
  expect(() => canonicalSfValue(nativeClone(cycle))).toThrow()

  for (const amount of [NaN, Infinity, -Infinity]) {
    const value = clone({ amount })
    expect(sfCanonicalCloneTree(value)).toBeUndefined()
    expect(() => canonicalSfValue(value)).toThrow("SF_CANONICAL_NONFINITE")
    expect(() => canonicalSfValue(nativeClone({ amount }))).toThrow("SF_CANONICAL_NONFINITE")
  }

  const bigint = clone({ amount: 1n })
  expect(sfCanonicalCloneTree(bigint)).toBeUndefined()
  expect(() => canonicalSfValue(bigint)).toThrow("SF_CANONICAL_UNSUPPORTED")
  expect(() => canonicalSfValue(nativeClone({ amount: 1n }))).toThrow("SF_CANONICAL_UNSUPPORTED")

  for (const input of [new Date("2026-11-21"), new Map([["amount", 1]]), new Set([1]), new ArrayBuffer(8)]) {
    const value = clone(input), oracle = nativeClone(input)
    expect(sfCanonicalCloneTree(value)).toBeUndefined()
    expect(() => canonicalSfValue(value)).toThrow("SF_CANONICAL_UNSUPPORTED")
    expect(() => canonicalSfValue(oracle)).toThrow("SF_CANONICAL_UNSUPPORTED")
    Object.setPrototypeOf(value, Object.prototype)
    Object.setPrototypeOf(oracle, Object.prototype)
    expect(sfCanonicalCloneTree(value)).toBeUndefined()
    expect(canonicalSfValue(value)).toBe(canonicalSfValue(oracle))
  }

  const shared = new SharedArrayBuffer(8)
  const inputs: unknown[] = [shared, new Uint8Array(8), new Uint8Array(shared), new DataView(shared)]
  for (const input of inputs) {
    // Preserve the host's own clone outcome if a supported runtime declines a
    // shared-memory brand. This is an asserted error comparison, not a skipped test.
    const original = outcome(() => nativeClone(input)), copied = outcome(() => clone(input))
    if (!original.ok) { expect(copied).toEqual(original); continue }
    expect(copied.ok).toBe(true)
    if (!copied.ok) throw new Error("native clone succeeded but the helper failed")
    const value = copied.value, oracle = original.value
    expect(sfCanonicalCloneTree(value)).toBeUndefined()
    Object.setPrototypeOf(value as object, Object.prototype)
    Object.setPrototypeOf(oracle as object, Object.prototype)
    expect(sfCanonicalCloneTree(value)).toBeUndefined()
    expect(canonicalSfValue(value)).toBe(canonicalSfValue(oracle))
  }
})

test("node, property, depth and expanded-alias budgets decline the tree without changing the fallback", () => {
  let deep: unknown = { amount: 1 }
  for (let i = 0; i < 70; i++) deep = { child: deep }
  const identities = Array.from({ length: 5000 }, (_, amount) => ({ amount }))
  const properties = Object.fromEntries(Array.from({ length: 33000 }, (_, i) => ["key-" + i, i]))
  // The conservative estimate accounts for up to six UTF-16 units per
  // string character; this one-MiB ASCII field exceeds the four-MiB estimate.
  const units = { text: "x".repeat(1024 * 1024) }
  for (const input of [deep, identities, properties, units]) {
    const value = clone(input)
    expect(sfCanonicalCloneTree(value)).toBeUndefined()
    expect(canonicalSfValue(value)).toBe(canonicalSfValue(nativeClone(input)))
  }

  // Seventeen unique arrays still expand to 131071 array occurrences, while
  // their tagged output estimate remains below four MiB. A unique-node count
  // alone must not admit this exponentially repeated DAG.
  let aliases: unknown = []
  for (let i = 0; i < 16; i++) aliases = [aliases, aliases]
  const copied = clone(aliases)
  expect(sfCanonicalCloneTree(copied)).toBeUndefined()
})
