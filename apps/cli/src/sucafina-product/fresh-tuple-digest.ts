import { sfTupleCost, sfTupleCount, sfTupleInitialPins, sfTupleInspect, sfTupleCrossReturn, sfTupleCrossDiscard, sfTupleCrossBypass } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/recall-observation-cost.ts"
import { types } from "node:util"
import { digestSfValue, sfCanonicalSerializerUnhooked } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"

const descriptor = Object.getOwnPropertyDescriptor
const ownKeys = Reflect.ownKeys
const prototype = Object.getPrototypeOf
const hasOwn = Object.hasOwn
const same = Object.is
const isProxy = types.isProxy
const isArray = Array.isArray
const finite = Number.isFinite
const safeInteger = Number.isSafeInteger
const clone = structuredClone
const objectPrototype = Object.prototype
const arrayPrototype = Array.prototype
const hashPrototype = Bun.CryptoHasher.prototype
const pinKeys: readonly (readonly [object, PropertyKey])[] = [
  [globalThis, "Object"], [globalThis, "Array"], [globalThis, "Number"], [globalThis, "JSON"],
  [globalThis, "Reflect"], [globalThis, "Bun"], [globalThis, "WeakSet"], [globalThis, "WeakMap"], [globalThis, "structuredClone"],
  [Object, "prototype"], [Object, "keys"], [Object, "getPrototypeOf"], [Object, "getOwnPropertyDescriptor"], [Object, "hasOwn"], [Object, "is"],
  [Array, "prototype"], [Array, "isArray"], [Array, Symbol.species], [Number, "isFinite"], [Number, "isSafeInteger"],
  [Reflect, "ownKeys"], [JSON, "stringify"], [types, "isProxy"],
  [Bun, "CryptoHasher"], [Bun.CryptoHasher, "prototype"], [hashPrototype, "update"], [hashPrototype, "digest"],
  [WeakSet, "prototype"], [WeakSet.prototype, "constructor"], [WeakSet.prototype, "has"], [WeakSet.prototype, "add"], [WeakSet.prototype, "delete"],
  [WeakMap, "prototype"], [WeakMap.prototype, "constructor"], [WeakMap.prototype, "get"], [WeakMap.prototype, "set"],
]
const pins = pinKeys.map(([owner, key]) => ({ owner, key, value: descriptor(owner, key) }))
const prototypePins = [objectPrototype, arrayPrototype].map((owner) => ({
  owner, parent: prototype(owner), keys: ownKeys(owner), values: ownKeys(owner).map((key) => descriptor(owner, key)),
}))

/** A pure digest shortcut for one observation only. Every call receives the complete fresh tuple.
 * No root, authority, reader result or external object identity admits reuse. */
export function createSfFreshTupleDigest() {
  let retained: { value: unknown; digest: string } | undefined
  let closed = false
  let busy = false
  return {
    digest(value: unknown): string {
      sfTupleCount(0)
      if (closed || busy) { sfTupleCount(1); sfTupleCrossBypass(); return sfTupleCost("digest-original", () => digestSfValue(value)) }
      busy = true
      try {
        let admitted = false
        try {
          if (sfTupleInitialPins(intrinsicsCurrent)) {
            const result = sfTupleInspect(() => inspect(value, retained?.value, retained !== undefined, new WeakMap()))
            admitted = result !== 0
            if (result === 2 && retained && sfTupleCost("pins", intrinsicsCurrent)) { sfTupleCount(5); sfTupleCrossReturn(1, retained.digest, true); return retained.digest }
          }
        } catch { sfTupleCount(8) /* Unprovable inspection keeps the original digest path. */ }
        // An opaque read or original serializer can reenter; no prior baseline is visible to it.
        retained = undefined
        let crossRetained = false
        if (!admitted) sfTupleCrossDiscard()
        // Deliberately outside the observational catch: propagate the original error without replay.
        const digest = sfTupleCost("digest-original", () => digestSfValue(value))
        if (admitted && !closed) {
          try {
            if (sfTupleCost("pins", intrinsicsCurrent)) {
              const detached = sfTupleCost("clone", () => clone(value))
              if (!closed && sfTupleCost("pins", intrinsicsCurrent)) { retained = { value: detached, digest }; sfTupleCount(7); crossRetained = true }
            }
          } catch { retained = undefined; sfTupleCount(8) }
        }
        sfTupleCrossReturn(0, digest, crossRetained)
        return digest
      } finally { busy = false }
    },
    close() { closed = true; retained = undefined },
  }
}

function intrinsicsCurrent() {
  for (let index = 0; index < pins.length; index++) {
    const pin = pins[index]!
    if (!sameDescriptor(pin.value, descriptor(pin.owner, pin.key))) return false
  }
  for (let index = 0; index < prototypePins.length; index++) {
    const pin = prototypePins[index]!, keys = ownKeys(pin.owner)
    if (prototype(pin.owner) !== pin.parent || keys.length !== pin.keys.length) return false
    for (let entry = 0; entry < keys.length; entry++)
      if (keys[entry] !== pin.keys[entry] || !sameDescriptor(pin.values[entry], descriptor(pin.owner, keys[entry]!))) return false
  }
  return sfCanonicalSerializerUnhooked()
}

function sameDescriptor(left: PropertyDescriptor | undefined, right: PropertyDescriptor | undefined) {
  if (!left || !right) return left === right
  if (left.enumerable !== right.enumerable || left.configurable !== right.configurable ||
    hasOwn(left, "value") !== hasOwn(right, "value")) return false
  return hasOwn(left, "value") ? same(left.value, right.value) && left.writable === right.writable
    : left.get === right.get && left.set === right.set
}

type Seen = { expected: unknown; comparable: boolean; result: 0 | 1 | 2 }

/** 0 opaque, 1 fully admitted but unequal, 2 fully admitted and equal.
 * Objects are always inspected: reference identity alone never proves equality.
 * Repeated aliases may reuse this walk's completed descriptor proof for the SAME private counterpart. */
function inspect(value: unknown, expected: unknown, comparable: boolean,
  seen: WeakMap<object, Seen>): 0 | 1 | 2 {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "boolean")
    return comparable && same(value, expected) ? 2 : 1
  if (typeof value === "number") return !finite(value) ? 0 : comparable && same(value, expected) ? 2 : 1
  if (typeof value !== "object" || isProxy(value)) return 0
  const prior = seen.get(value)
  if (prior?.result === 0) return 0
  if (prior) return prior.comparable === comparable && prior.expected === expected ? prior.result : 1
  const array = isArray(value)
  if (prototype(value) !== (array ? arrayPrototype : objectPrototype)) return 0
  // A clone can retain an exotic brand and shared memory; require the ordinary object/array prototype.
  // Fresh values still receive every descriptor check.
  const partner = comparable && expected !== null && typeof expected === "object" &&
    isArray(expected) === array && prototype(expected) === (array ? arrayPrototype : objectPrototype)
    ? expected as Record<string, unknown> : undefined
  const keys = ownKeys(value)
  let equal = partner !== undefined && (array || ownKeys(partner).length === keys.length)
  // A visiting entry is a cycle even when this visit has a different counterpart.
  const current: Seen = { expected, comparable, result: 0 }
  seen.set(value, current)
  if (array) {
    const length = descriptor(value, "length")
    if (!length || !hasOwn(length, "value") || !safeInteger(length.value) || length.value < 0 ||
      keys.length !== length.value + 1) return 0
    const expectedLength = partner && hasOwn(partner, "length") ? partner.length : undefined
    if (expectedLength !== length.value) equal = false
    for (let index = 0; index < length.value; index++) {
      const entry = descriptor(value, index + "")
      if (!entry || !entry.enumerable || !hasOwn(entry, "value")) return 0
      const present = partner !== undefined && hasOwn(partner, index + "")
      const result = inspect(entry.value, present ? partner[index] : undefined, present, seen)
      if (result === 0) return 0
      if (result !== 2) equal = false
    }
  } else {
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index]!
      if (typeof key !== "string") return 0
      const entry = descriptor(value, key)
      if (!entry || !entry.enumerable || !hasOwn(entry, "value")) return 0
      const present = partner !== undefined && hasOwn(partner, key)
      const result = inspect(entry.value, present ? partner[key] : undefined, present, seen)
      if (result === 0) return 0
      if (result !== 2) equal = false
    }
  }
  current.result = equal ? 2 : 1
  return current.result
}
