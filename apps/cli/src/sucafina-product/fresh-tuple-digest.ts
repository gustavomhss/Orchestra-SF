import { digestSfValue, sfCanonicalCaptureRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { sfOriginalStructuredCloneCurrent } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical-clone.ts"

/** A pure digest shortcut for one observation only. Every call receives the complete fresh tuple.
 * No root, authority, reader result or external object identity admits reuse.
 * Runtime identities belong to the earlier canonical bootstrap, never to this module's loading. */
export function createSfFreshTupleDigest() {
  let retained: { value: unknown; digest: string } | undefined
  let closed = false
  let busy = false
  return {
    digest(value: unknown): string {
      if (closed || busy) return digestSfValue(value)
      busy = true
      try {
        let admitted = false
        const runtime = originalRuntime()
        try {
          if (runtime) {
            const result = inspect(value, retained?.value, retained !== undefined, new runtime.WeakMap<object, Seen>(), runtime)
            admitted = result !== 0
            if (result === 2 && retained && runtime.current()) return retained.digest
          }
        } catch { /* Unprovable inspection keeps the original digest path. */ }
        // An opaque read or original serializer can reenter; no prior baseline is visible to it.
        retained = undefined
        // Deliberately outside the observational catch: propagate the original error without replay.
        const digest = digestSfValue(value)
        if (admitted && !closed && runtime) {
          try {
            if (runtime.current()) {
              const detached = runtime.clone(value)
              if (!closed && runtime.current()) retained = { value: detached, digest }
            }
          } catch { retained = undefined }
        }
        return digest
      } finally { busy = false }
    },
    close() { closed = true; retained = undefined },
  }
}

/** Do not read or pin late aliases until the original bootstrap admits them.
 * The optional bundle and the original clone guard use retained reflection;
 * an unavailable or changed runtime stays on the current canonical path. */
function originalRuntime() {
  const capture = sfCanonicalCaptureRuntime()
  if (!capture || !sfOriginalStructuredCloneCurrent()) return undefined
  return {
    current: () => capture.current() && sfOriginalStructuredCloneCurrent(),
    isProxy: capture.isProxy,
    descriptor: Object.getOwnPropertyDescriptor,
    ownKeys: Reflect.ownKeys,
    prototype: Object.getPrototypeOf,
    hasOwn: Object.hasOwn,
    same: Object.is,
    isArray: Array.isArray,
    finite: Number.isFinite,
    clone: structuredClone,
    WeakMap,
    objectPrototype: Object.prototype,
    arrayPrototype: Array.prototype,
  }
}

type Seen = { expected: unknown; comparable: boolean; result: 0 | 1 | 2 }

/** 0 opaque, 1 fully admitted but unequal, 2 fully admitted and equal.
 * Objects are always inspected: reference identity alone never proves equality.
 * Repeated aliases may reuse this walk's completed descriptor proof for the SAME private counterpart. */
function inspect(value: unknown, expected: unknown, comparable: boolean,
  seen: WeakMap<object, Seen>, runtime: NonNullable<ReturnType<typeof originalRuntime>>): 0 | 1 | 2 {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "boolean")
    return comparable && runtime.same(value, expected) ? 2 : 1
  if (typeof value === "number") return !runtime.finite(value) ? 0 : comparable && runtime.same(value, expected) ? 2 : 1
  if (typeof value !== "object" || runtime.isProxy(value)) return 0
  const prior = seen.get(value)
  if (prior?.result === 0) return 0
  if (prior) return prior.comparable === comparable && prior.expected === expected ? prior.result : 1
  const array = runtime.isArray(value)
  if (runtime.prototype(value) !== (array ? runtime.arrayPrototype : runtime.objectPrototype)) return 0
  // A clone can retain an exotic brand and shared memory; require the ordinary object/array prototype.
  // Fresh values still receive every descriptor check.
  const partner = comparable && expected !== null && typeof expected === "object" &&
    runtime.isArray(expected) === array && runtime.prototype(expected) === (array ? runtime.arrayPrototype : runtime.objectPrototype)
    ? expected as Record<string, unknown> : undefined
  const keys = runtime.ownKeys(value)
  let equal = partner !== undefined && (array || runtime.ownKeys(partner).length === keys.length)
  // A visiting entry is a cycle even when this visit has a different counterpart.
  const current: Seen = { expected, comparable, result: 0 }
  seen.set(value, current)
  if (array) {
    const length = runtime.descriptor(value, "length")
    if (!length || !runtime.hasOwn(length, "value") || typeof length.value !== "number" || length.value < 0 ||
      length.value > 0xffff_ffff || length.value % 1 !== 0 ||
      keys.length !== length.value + 1) return 0
    const expectedLength = partner && runtime.hasOwn(partner, "length") ? partner.length : undefined
    if (expectedLength !== length.value) equal = false
    for (let index = 0; index < length.value; index++) {
      const entry = runtime.descriptor(value, index + "")
      if (!entry || !entry.enumerable || !runtime.hasOwn(entry, "value")) return 0
      const present = partner !== undefined && runtime.hasOwn(partner, index + "")
      const result = inspect(entry.value, present ? partner[index] : undefined, present, seen, runtime)
      if (result === 0) return 0
      if (result !== 2) equal = false
    }
  } else {
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index]!
      if (typeof key !== "string") return 0
      const entry = runtime.descriptor(value, key)
      if (!entry || !entry.enumerable || !runtime.hasOwn(entry, "value")) return 0
      const present = partner !== undefined && runtime.hasOwn(partner, key)
      const result = inspect(entry.value, present ? partner[key] : undefined, present, seen, runtime)
      if (result === 0) return 0
      if (result !== 2) equal = false
    }
  }
  current.result = equal ? 2 : 1
  return current.result
}
