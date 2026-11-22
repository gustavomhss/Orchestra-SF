import { types } from "node:util"
import { canonicalSfValue } from "./canonical.ts"

// This opt-in route is for private structured clones owned by one observation.
// It does not retain an object, canonical fragment, digest or authority after a call.
const descriptor = Object.getOwnPropertyDescriptor
const own = Object.hasOwn
const prototype = Object.getPrototypeOf
const descriptors = Object.getOwnPropertyDescriptors
const keys = Object.keys
const ownKeys = Reflect.ownKeys
const stringify = JSON.stringify
const isProxy = types.isProxy
const objectPrototype = Object.prototype
const arrayPrototype = Array.prototype
const intrinsicKeys: readonly (readonly [object, PropertyKey])[] = [
  ...["Object", "Array", "JSON", "Number", "Reflect", "WeakMap", "WeakSet"].map((key) => [globalThis, key] as const),
  ...["getOwnPropertyDescriptor", "getOwnPropertyDescriptors", "getPrototypeOf", "hasOwn", "keys", "is"].map((key) => [Object, key] as const),
  [Array, "isArray"], [Array, Symbol.species], [Number, "isFinite"], [JSON, "stringify"], [Reflect, "ownKeys"],
  ...["map", "sort", "join", "includes", "constructor", "toJSON"].map((key) => [arrayPrototype, key] as const),
  [objectPrototype, "toJSON"], [types, "isProxy"],
  [WeakMap.prototype, "get"], [WeakMap.prototype, "set"],
  [WeakSet.prototype, "has"], [WeakSet.prototype, "add"], [WeakSet.prototype, "delete"],
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
    if (own(left, field) !== own(right, field) || own(left, field) && left[field] !== right[field]) return false
  }
  return true
}

function unhooked() {
  if (typeof isProxy !== "function" || prototype(arrayPrototype) !== objectPrototype ||
    prototype(objectPrototype) !== null) return false
  for (let index = 0; index < intrinsicPins.length; index++) {
    const pin = intrinsicPins[index]!
    if (!sameDescriptor(descriptor(pin.owner, pin.key), pin.expected)) return false
  }
  for (let index = 0; index < prototypePins.length; index++) {
    const pin = prototypePins[index]!, current = ownKeys(pin.owner)
    if (current.length !== pin.fields.length) return false
    for (let position = 0; position < current.length; position++) {
      const key = current[position]!, field = pin.fields[position]!
      if (key !== field.key || !sameDescriptor(descriptor(pin.owner, key), field.expected)) return false
    }
  }
  return true
}

/** Exact tagged bytes for a private, callback-free data graph. Any ambiguity uses
 * the original serializer. Aliases share only a completed fragment during this
 * synchronous walk; a later call observes the graph again from the beginning. */
export function canonicalSfPrivateValue(value: unknown): string {
  if (!unhooked()) return canonicalSfValue(value)
  try {
    const fragments = new WeakMap<object, string>()
    const active = new WeakSet<object>()
    const visit = (item: unknown): string | undefined => {
      if (item === undefined) return '["absent"]'
      if (item === null) return '["null"]'
      if (typeof item === "string") return '["string",' + stringify(item) + "]"
      if (typeof item === "boolean") return '["boolean",' + (item ? "true" : "false") + "]"
      if (typeof item === "number") return Number.isFinite(item)
        ? '["number",' + (Object.is(item, -0) ? '"-0"' : stringify(item)) + "]" : undefined
      if (typeof item !== "object" || isProxy(item)) return undefined
      const prior = fragments.get(item)
      if (prior !== undefined) return prior
      if (active.has(item)) return undefined
      const array = Array.isArray(item)
      const parent = prototype(item)
      if (array ? parent !== arrayPrototype : parent !== objectPrototype && parent !== null) return undefined
      const fields = descriptors(item)
      const names = ownKeys(fields)
      // Never invoke an accessor or a Proxy while discovering eligibility.
      // Symbols and nonstandard arrays retain the canonical implementation.
      for (let index = 0; index < names.length; index++) {
        const name = names[index]!
        if (typeof name !== "string" || !own(fields[name]!, "value")) return undefined
      }
      active.add(item)
      const parts: string[] = []
      if (array) {
        const length: unknown = fields.length?.value
        if (typeof length !== "number" || names.length !== length + 1) return undefined
        for (let index = 0; index < length; index++) {
          const field = fields[index]
          if (!field || !own(field, "value")) return undefined
          const encoded = visit(field.value)
          if (encoded === undefined) return undefined
          parts[index] = encoded
        }
      } else {
        const selected = keys(item).sort()
        for (let index = 0; index < selected.length; index++) {
          const key = selected[index]!
          const encoded = visit(fields[key]!.value)
          if (encoded === undefined) return undefined
          parts[index] = "[" + stringify(key) + "," + encoded + "]"
        }
      }
      active.delete(item)
      const encoded = (array ? '["array",[' : '["object",[') + parts.join(",") + "]]"
      fragments.set(item, encoded)
      return encoded
    }
    const result = visit(value)
    if (result !== undefined) return result
  } catch {
    // A fast-walk allocation/stack failure does not change canonical admission.
  }
  return canonicalSfValue(value)
}

export function digestSfPrivateValue(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(canonicalSfPrivateValue(value)).digest("hex")
}
