import { types } from "node:util"
import { digestSfValue } from "../contracts/canonical.ts"

// This preparation only removes unused serialization of one context result.
// It retains no authorization and never replaces the live comparison's digest.
const descriptor = Object.getOwnPropertyDescriptor
const descriptors = Object.getOwnPropertyDescriptors
const ownKeys = Reflect.ownKeys
const prototype = Object.getPrototypeOf
const own = Object.hasOwn
const define = Object.defineProperty
const create = Object.create
const sameValue = Object.is
const isArray = Array.isArray
const finite = Number.isFinite
const isProxy = types.isProxy
const objectPrototype = Object.prototype
const arrayPrototype = Array.prototype
const hashRuntime = typeof Bun === "undefined" ? undefined : Bun
const hashConstructor = hashRuntime?.CryptoHasher
const hashPrototype = hashConstructor?.prototype
const hashParent = hashPrototype && prototype(hashPrototype)
const hashUpdate = hashPrototype && descriptor(hashPrototype, "update")
const hashDigest = hashPrototype && descriptor(hashPrototype, "digest")
const intrinsicKeys: readonly (readonly [object, PropertyKey])[] = [
  ...["Object", "Array", "JSON", "Number", "Reflect", "WeakMap", "WeakSet", "Bun"].map((key) => [globalThis, key] as const),
  ...["getOwnPropertyDescriptor", "getOwnPropertyDescriptors", "getPrototypeOf", "hasOwn", "keys", "is", "defineProperty", "create"].map((key) => [Object, key] as const),
  [Array, "isArray"], [Array, Symbol.species], [Number, "isFinite"], [JSON, "stringify"], [Reflect, "ownKeys"], [types, "isProxy"],
  [WeakMap.prototype, "get"], [WeakMap.prototype, "set"],
  [WeakSet.prototype, "has"], [WeakSet.prototype, "add"], [WeakSet.prototype, "delete"],
  ...(hashRuntime && hashConstructor && hashPrototype ? [
    [hashRuntime, "CryptoHasher"], [hashConstructor, "prototype"], [hashPrototype, "update"], [hashPrototype, "digest"],
  ] as const : []),
]
const intrinsicPins = intrinsicKeys.map(([owner, key]) => ({ owner, key, expected: descriptor(owner, key) }))
const prototypePins = [objectPrototype, arrayPrototype].map((owner) => ({
  owner, fields: ownKeys(owner).map((key) => ({ key, expected: descriptor(owner, key) })),
}))
const descriptorFields = ["configurable", "enumerable", "value", "writable", "get", "set"] as const

function sameDescriptor(left: PropertyDescriptor | undefined, right: PropertyDescriptor | undefined) {
  if (!left || !right) return left === right
  for (let index = 0; index < descriptorFields.length; index++) {
    const field = descriptorFields[index]!
    if (own(left, field) !== own(right, field) || own(left, field) && !sameValue(left[field], right[field])) return false
  }
  return true
}

function unchangedRuntime() {
  if (typeof isProxy !== "function" || !hashPrototype || typeof hashUpdate?.value !== "function" ||
    typeof hashDigest?.value !== "function" || prototype(hashPrototype) !== hashParent ||
    prototype(arrayPrototype) !== objectPrototype || prototype(objectPrototype) !== null) return false
  for (let index = 0; index < intrinsicPins.length; index++) {
    const pin = intrinsicPins[index]!
    if (!sameDescriptor(descriptor(pin.owner, pin.key), pin.expected)) return false
  }
  for (let index = 0; index < prototypePins.length; index++) {
    const pin = prototypePins[index]!, current = ownKeys(pin.owner)
    if (current.length !== pin.fields.length) return false
    for (let position = 0; position < current.length; position++) {
      const field = pin.fields[position]!
      if (current[position] !== field.key || !sameDescriptor(descriptor(pin.owner, field.key), field.expected)) return false
    }
  }
  return true
}

const opaque = Symbol("opaque-context-identity")

/** No getters, Proxy traps, custom iterators or serializer hooks run in this walk.
 * Aliases are copied once; an active ancestor is not mistaken for an alias. */
function capture(value: unknown): { value: unknown } | undefined {
  if (!unchangedRuntime()) return undefined
  const copies = new WeakMap<object, object>()
  const active = new WeakSet<object>()
  const visit = (item: unknown): unknown => {
    if (item === undefined || item === null || typeof item === "string" || typeof item === "boolean") return item
    if (typeof item === "number") return finite(item) ? item : opaque
    if (typeof item !== "object" || isProxy(item) || active.has(item)) return opaque
    const prior = copies.get(item)
    if (prior) return prior
    const array = isArray(item), parent = prototype(item)
    if (array ? parent !== arrayPrototype : parent !== objectPrototype && parent !== null) return opaque
    const fields = descriptors(item), incoming = ownKeys(fields), names: string[] = []
    for (let index = 0; index < incoming.length; index++) {
      const name = incoming[index]!
      if (typeof name !== "string" || !own(fields[name]!, "value")) return opaque
      names[index] = name
    }
    if (array) {
      const length: unknown = fields.length?.value
      if (typeof length !== "number" || names.length !== length + 1) return opaque
      // Sparse or inherited slots retain the original Array.map behavior.
      for (let index = 0; index < length; index++)
        if (!fields[index] || !own(fields[index]!, "value")) return opaque
    }
    const copied: object = array ? [] : create(parent)
    active.add(item)
    for (let index = 0; index < names.length; index++) {
      const name = names[index]!
      if (array && name === "length") continue
      const field = fields[name]!, value = visit(field.value)
      if (value === opaque) return opaque
      define(copied, name, { value, enumerable: field.enumerable, writable: true, configurable: true })
    }
    active.delete(item)
    copies.set(item, copied)
    return copied
  }
  try {
    const copied = visit(value)
    return copied !== opaque && unchangedRuntime() ? { value: copied } : undefined
  } catch {
    // Native allocation/depth failures do not replace canonical admission.
    return undefined
  }
}

/** The private copy binds the original observation before the caller receives it.
 * Ambiguity performs canonical admission immediately. The admitted path defers
 * only its baseline digest; every comparison still digests the live value. */
export function prepareSfCapturedContextIdentity(value: unknown): (current: unknown) => boolean {
  const captured = capture(value)
  if (!captured) {
    const expected = digestSfValue(value)
    return (current) => expected === digestSfValue(current)
  }
  let expected: string | undefined
  return (current) => {
    if (!unchangedRuntime()) return false
    expected ??= digestSfValue(captured.value)
    const actual = digestSfValue(current)
    return unchangedRuntime() && expected === actual
  }
}
