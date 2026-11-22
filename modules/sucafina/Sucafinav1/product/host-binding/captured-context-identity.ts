import { digestSfValue, sfCanonicalCaptureRuntime } from "../contracts/canonical.ts"

// The helper performs no reflective work while loading. Its earlier canonical
// anchor decides whether any private-copy operation can run.
const opaque = {}

/** No getters, Proxy traps, custom iterators or serializer hooks run in this walk.
 * Aliases are copied once; an active ancestor is not mistaken for an alias. */
function capture(value: unknown) {
  const runtime = sfCanonicalCaptureRuntime()
  if (!runtime) return undefined
  // No callback or await separates the earlier admission from these native aliases.
  const descriptors = Object.getOwnPropertyDescriptors, ownKeys = Reflect.ownKeys
  const prototype = Object.getPrototypeOf, own = Object.hasOwn
  const define = Object.defineProperty, create = Object.create
  const isArray = Array.isArray, finite = Number.isFinite, isProxy = runtime.isProxy
  const objectPrototype = Object.prototype, arrayPrototype = Array.prototype
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
        if (!own(fields, index) || !own(fields[index]!, "value")) return opaque
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
    return copied !== opaque && runtime.current() ? { value: copied, runtime } : undefined
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
    if (!captured.runtime.current()) return false
    expected ??= digestSfValue(captured.value)
    const actual = digestSfValue(current)
    return captured.runtime.current() && expected === actual
  }
}
