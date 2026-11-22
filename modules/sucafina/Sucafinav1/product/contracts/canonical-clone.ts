import { types } from "node:util"

// Like the existing integrity proofs, these identities are trusted at module
// bootstrap. Later replacement never becomes a new baseline. No caller can mark
// an arbitrary object: ordinary identities are born only in the clone/map below.
const realm = globalThis
const native = {
  Object, Array, Number, JSON, Reflect, WeakMap, WeakSet,
  objectPrototype: Object.prototype, arrayPrototype: Array.prototype,
  property: Object.getOwnPropertyDescriptor, own: Object.hasOwn,
  prototype: Object.getPrototypeOf, keys: Object.keys, same: Object.is,
  define: Object.defineProperty, ownKeys: Reflect.ownKeys, apply: Reflect.apply,
  isArray: Array.isArray, map: Array.prototype.map, sort: Array.prototype.sort,
  includes: Array.prototype.includes, finite: Number.isFinite,
  stringify: JSON.stringify, isProxy: types.isProxy,
  isAnyArrayBuffer: types.isAnyArrayBuffer, isView: ArrayBuffer.isView,
  weakHas: WeakSet.prototype.has, weakAdd: WeakSet.prototype.add,
  weakDelete: WeakSet.prototype.delete,
  memoGet: WeakMap.prototype.get, memoSet: WeakMap.prototype.set,
}
const species = Symbol.species
const cloneDescriptor = native.property(realm, "structuredClone")
const clone = cloneDescriptor && native.own(cloneDescriptor, "value") ? cloneDescriptor.value : undefined
const arraySpecies = native.property(native.Array, species)
const bunDescriptor = native.property(realm, "Bun")
const bun = bunDescriptor && native.own(bunDescriptor, "value") && bunDescriptor.value &&
  typeof bunDescriptor.value === "object" && !native.isProxy(bunDescriptor.value) ? bunDescriptor.value as object : undefined
const ordinary = new native.WeakSet<object>()
const maximumNodes = 4096, maximumProperties = 32768, maximumDepth = 64
const maximumExpansion = 65536, maximumUnits = 4 * 1024 * 1024
const pins: readonly (readonly [object, PropertyKey, unknown])[] = [
  [realm, "Object", native.Object], [realm, "Array", native.Array],
  [realm, "Number", native.Number], [realm, "JSON", native.JSON],
  [realm, "Reflect", native.Reflect], [realm, "structuredClone", clone],
  [native.Object, "prototype", native.objectPrototype],
  [native.Object, "getOwnPropertyDescriptor", native.property],
  [native.Object, "getPrototypeOf", native.prototype], [native.Object, "keys", native.keys],
  [native.Object, "hasOwn", native.own], [native.Object, "is", native.same],
  [native.Object, "defineProperty", native.define],
  [native.Array, "prototype", native.arrayPrototype], [native.Array, "isArray", native.isArray],
  [native.arrayPrototype, "map", native.map], [native.arrayPrototype, "sort", native.sort],
  [native.arrayPrototype, "includes", native.includes], [native.arrayPrototype, "constructor", native.Array],
  [native.Number, "isFinite", native.finite], [native.JSON, "stringify", native.stringify],
  [native.Reflect, "ownKeys", native.ownKeys], [native.Reflect, "apply", native.apply],
]

function has(set: WeakSet<object>, value: object): boolean {
  return native.apply(native.weakHas, set, [value])
}
function add(set: WeakSet<object>, value: object) {
  native.apply(native.weakAdd, set, [value])
}
function ownData(owner: object, key: PropertyKey, expected: unknown) {
  const found = native.property(owner, key)
  return !!found && native.own(found, "value") && found.value === expected
}
function environmentCurrent() {
  // The ordinary-birth proof covers this native clone implementation only.
  // Descriptor reads never invoke a version/revision getter or a replacement Bun.
  if (!bun || !ownData(realm, "Bun", bun) || !ownData(bun, "version", "1.3.14") ||
    !ownData(bun, "revision", "0d9b296af33f2b851fcbf4df3e9ec89751734ba4") || typeof clone !== "function") return false
  for (let index = 0; index < pins.length; index++) {
    const pin = pins[index]!
    if (!ownData(pin[0], pin[1], pin[2])) return false
  }
  const current = native.property(native.Array, species)
  return !!arraySpecies && !!current &&
    native.own(arraySpecies, "get") && native.own(arraySpecies, "set") &&
    native.own(current, "get") && native.own(current, "set") &&
    !native.own(current, "value") && current.get === arraySpecies.get && current.set === arraySpecies.set &&
    current.enumerable === arraySpecies.enumerable && current.configurable === arraySpecies.configurable &&
    native.prototype(native.arrayPrototype) === native.objectPrototype &&
    native.prototype(native.objectPrototype) === null &&
    !native.property(native.arrayPrototype, "toJSON") && !native.property(native.objectPrototype, "toJSON")
}
function nativeMapAllocation(values: readonly unknown[]) {
  return !native.isProxy(values) && native.isArray(values) &&
    native.prototype(values) === native.arrayPrototype &&
    !native.property(values, "map") && !native.property(values, "constructor") &&
    !native.property(values, "species") && !native.property(values, species)
}

/** Preserve the existing map and one global clone call per original callback. */
export function cloneSfCanonicalValues<Value>(values: readonly Value[]): Value[] {
  if (!environmentCurrent() || !nativeMapAllocation(values))
    return values.map((value) => structuredClone(value))
  // Native map allocates its ordinary result before any element getter/callback.
  // Later hooks cannot retroactively attest a custom map or clone invocation.
  const result = values.map((value) => {
    const trusted = ownData(realm, "structuredClone", clone)
    const copied = structuredClone(value)
    // Registration is optional metadata; a failed inspection never repeats or
    // changes the clone operation that has already completed.
    try { if (trusted && environmentCurrent()) rememberClone(copied) } catch {
      // Origin metadata is optional; preserve the native clone that already succeeded.
    }
    return copied
  })
  add(ordinary, result)
  return result
}

function rememberClone(value: unknown) {
  type Pending = { value: unknown; next: Pending | undefined }
  let pending: Pending | undefined = { value, next: undefined }
  const seen = new native.WeakSet<object>()
  let nodes = 0, properties = 0
  while (pending) {
    const current = pending.value
    pending = pending.next
    if (!current || typeof current !== "object" || has(seen, current)) continue
    add(seen, current)
    // Native clone creates ObjectTag/ArrayTag identities, not aliases of input
    // objects. Other cloned brands are never marked, even if reparented later.
    if (native.isProxy(current) || native.isAnyArrayBuffer(current) || native.isView(current)) continue
    const prototype = native.prototype(current)
    if (native.isArray(current) ? prototype !== native.arrayPrototype : prototype !== native.objectPrototype) continue
    if (++nodes > maximumNodes) return
    add(ordinary, current)
    const keys = native.ownKeys(current)
    if (properties + keys.length > maximumProperties) return
    properties += keys.length
    for (let index = 0; index < keys.length; index++) {
      const property = native.property(current, keys[index]!)
      if (property && native.own(property, "value"))
        pending = { value: property.value, next: pending }
    }
  }
}

type Encoded = { tree: unknown[]; height: number; expansion: number; units: number }

/**
 * A current, bounded read of clone-born ordinary identities. The per-call memo
 * shares only canonical tagged subtrees; JSON.stringify still produces all bytes.
 * No descriptor, grant, projection, serialized byte or digest survives this call.
 */
export function sfCanonicalCloneTree(value: unknown): unknown[] | undefined {
  // Membership precedes every inspection of an untrusted object or Proxy.
  if (!value || typeof value !== "object" || !has(ordinary, value) || !environmentCurrent()) return undefined
  const memo = new native.WeakMap<object, Encoded>()
  const visiting = new native.WeakSet<object>()
  let nodes = 0, properties = 0

  const visit = (input: unknown, depth: number): Encoded | undefined => {
    if (depth > maximumDepth) return undefined
    if (input === undefined) return { tree: ["absent"], height: 0, expansion: 1, units: 12 }
    if (input === null) return { tree: ["null"], height: 0, expansion: 1, units: 10 }
    if (typeof input === "string") {
      const units = 16 + input.length * 6
      return units > maximumUnits ? undefined : { tree: ["string", input], height: 0, expansion: 1, units }
    }
    if (typeof input === "boolean") return { tree: ["boolean", input], height: 0, expansion: 1, units: 20 }
    if (typeof input === "number")
      return native.finite(input) ? { tree: ["number", native.same(input, -0) ? "-0" : input], height: 0, expansion: 1, units: 40 } : undefined
    if (typeof input !== "object" || !has(ordinary, input)) return undefined
    const cached: Encoded | undefined = native.apply(native.memoGet, memo, [input])
    if (cached) return depth + cached.height > maximumDepth ? undefined : cached
    if (has(visiting, input) || ++nodes > maximumNodes) return undefined

    const array = native.isArray(input), prototype = native.prototype(input)
    if (array ? prototype !== native.arrayPrototype : prototype !== native.objectPrototype && prototype !== null) return undefined
    const keys = native.ownKeys(input)
    if (properties + keys.length > maximumProperties) return undefined
    properties += keys.length
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index]!
      if (typeof key !== "string" || key === "map" || key === "constructor" || key === "species") return undefined
    }
    const length = array ? native.property(input, "length") : undefined
    if (array && (!length || !native.own(length, "value") ||
      typeof length.value !== "number" || keys.length !== length.value + 1)) return undefined
    if (!array) native.apply(native.sort, keys, [])
    const count = array ? length!.value as number : keys.length
    const children: unknown[] = []
    let height = 0, expansion = 1, units = 16
    add(visiting, input)
    for (let index = 0; index < count; index++) {
      const key = array ? index : keys[index]!
      const property = native.property(input, key)
      if (!property || !native.own(property, "value") || !property.enumerable) return undefined
      const child = visit(property.value, depth + 1)
      if (!child) return undefined
      const keyUnits = array ? 1 : 8 + (key as string).length * 6
      if (expansion > maximumExpansion - child.expansion ||
        units > maximumUnits - child.units - keyUnits) return undefined
      expansion += child.expansion
      units += child.units + keyUnits
      if (child.height + 1 > height) height = child.height + 1
      // Null-prototype descriptors avoid inherited get/set, and direct definition
      // avoids inherited numeric setters on the fresh tagged arrays.
      const descriptor = { __proto__: null, value: array ? child.tree : [key, child.tree],
        enumerable: true, configurable: true, writable: true }
      native.define(children, index, descriptor)
    }
    native.apply(native.weakDelete, visiting, [input])
    const encoded: Encoded = { tree: [array ? "array" : "object", children], height, expansion, units }
    native.apply(native.memoSet, memo, [input, encoded])
    return encoded
  }

  try { return visit(value, 0)?.tree } catch { return undefined }
}
