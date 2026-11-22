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
  [WeakMap.prototype, "get"], [WeakMap.prototype, "set"], [WeakMap.prototype, "has"],
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

type PrivateNode = { value: object; parent: object | null; array: boolean; fields: PropertyDescriptorMap; names: readonly string[]; selected: readonly (string | number)[] }

function privateGraph(root: unknown) {
  if (!unhooked()) return undefined
  const nodes = new WeakMap<object, PrivateNode>()
  const order: PrivateNode[] = []
  const active = new WeakSet<object>()
  const visit = (value: unknown): boolean => {
    if (value === undefined || value === null || typeof value === "string" || typeof value === "boolean") return true
    if (typeof value === "number") return Number.isFinite(value)
    if (typeof value !== "object" || isProxy(value)) return false
    if (nodes.has(value)) return true
    if (active.has(value)) return false
    const array = Array.isArray(value), parent = prototype(value)
    if (array ? parent !== arrayPrototype : parent !== objectPrototype && parent !== null) return false
    const fields = descriptors(value), incoming = ownKeys(fields), names: string[] = []
    for (let index = 0; index < incoming.length; index++) {
      const name = incoming[index]!
      if (typeof name !== "string" || !own(fields[name]!, "value")) return false
      names[index] = name
    }
    const selected: (string | number)[] = []
    if (array) {
      const length: unknown = fields.length?.value
      if (typeof length !== "number" || names.length !== length + 1) return false
      for (let index = 0; index < length; index++) {
        if (!fields[index] || !own(fields[index]!, "value")) return false
        selected[index] = index
      }
    } else {
      const enumerable = keys(value).sort()
      for (let index = 0; index < enumerable.length; index++) selected[index] = enumerable[index]!
    }
    active.add(value)
    // Selection may read non-enumerable own fields; prove them too without serializing them.
    for (let index = 0; index < names.length; index++) if (!visit(fields[names[index]!]!.value)) return false
    active.delete(value)
    const node = { value, parent, array, fields, names, selected }
    nodes.set(value, node)
    order[order.length] = node
    return true
  }
  if (!visit(root)) return undefined
  const fragments = new WeakMap<object, string>()
  const encode = (value: unknown): string => {
    if (value === undefined) return '["absent"]'
    if (value === null) return '["null"]'
    if (typeof value === "string") return '["string",' + stringify(value) + "]"
    if (typeof value === "boolean") return '["boolean",' + (value ? "true" : "false") + "]"
    if (typeof value === "number" && Number.isFinite(value))
      return '["number",' + (Object.is(value, -0) ? '"-0"' : stringify(value)) + "]"
    const node = typeof value === "object" && nodes.get(value)
    if (!node) throw new Error("SF_PRIVATE_CANONICAL_FOREIGN_VALUE")
    const prior = fragments.get(node.value)
    if (prior !== undefined) return prior
    const parts: string[] = []
    for (let index = 0; index < node.selected.length; index++) {
      const key = node.selected[index]!, child = encode(node.fields[key]!.value)
      parts[index] = node.array ? child : "[" + stringify(key) + "," + child + "]"
    }
    const encoded = (node.array ? '["array",[' : '["object",[') + parts.join(",") + "]]"
    fragments.set(node.value, encoded)
    return encoded
  }
  return {
    encode,
    current() {
      if (!unhooked()) return false
      for (let index = 0; index < order.length; index++) {
        const node = order[index]!
        if (prototype(node.value) !== node.parent) return false
        const fields = descriptors(node.value), names = ownKeys(fields)
        if (names.length !== node.names.length) return false
        for (let position = 0; position < names.length; position++) {
          const key = names[position]!
          if (key !== node.names[position] || typeof key !== "string" || !sameDescriptor(fields[key], node.fields[key])) return false
        }
      }
      return true
    },
  }
}

/** Exact tagged bytes for a private structured clone. A later call proves the
 * graph again; opaque inputs use the original serializer without an extra read. */
export function canonicalSfPrivateValue(value: unknown): string {
  try {
    const graph = privateGraph(value)
    if (graph) return graph.encode(value)
  } catch {
    // A fast-walk allocation/stack failure does not change canonical admission.
  }
  return canonicalSfValue(value)
}

export function digestSfPrivateValue(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(canonicalSfPrivateValue(value)).digest("hex")
}

// Comparing bytes may remove otherwise observable hasher invocations. Only the
// captured native constructor and update/digest methods permit that comparison.
const hashRuntime = typeof Bun === "undefined" ? undefined : Bun
const hashConstructor = hashRuntime?.CryptoHasher
const hashPrototype = hashConstructor?.prototype
const hashParent = hashPrototype && prototype(hashPrototype)
const hashKeys: readonly (readonly [object, PropertyKey])[] = hashRuntime && hashConstructor && hashPrototype ? [
  [globalThis, "Bun"], [hashRuntime, "CryptoHasher"], [hashConstructor, "prototype"],
  [hashPrototype, "update"], [hashPrototype, "digest"],
] : []
const hashPins = hashKeys.map(([owner, key]) => ({ owner, key, expected: descriptor(owner, key) }))
function unhookedHasher() {
  if (!hashPrototype || hashPins.length !== 5 || prototype(hashPrototype) !== hashParent ||
    typeof hashPins[3]?.expected?.value !== "function" || typeof hashPins[4]?.expected?.value !== "function") return false
  for (let index = 0; index < hashPins.length; index++) {
    const pin = hashPins[index]!
    if (!sameDescriptor(descriptor(pin.owner, pin.key), pin.expected)) return false
  }
  return true
}

/** Prove the whole graph before selecting references. The only callback is a
 * synchronous host-owned comparison. Opacity returns undefined for the original
 * short-circuit path; mutation during an admitted comparison refuses the value. */
export function compareSfPrivateCanonical(root: unknown, compare: (encode: (value: unknown) => string) => boolean): boolean | undefined {
  if (!unhookedHasher()) return undefined
  let graph: ReturnType<typeof privateGraph>
  try { graph = privateGraph(root) } catch { return undefined }
  if (!graph) return undefined
  const encode = (value: unknown) => {
    if (!graph) throw new Error("SF_PRIVATE_CANONICAL_CLOSED")
    return graph.encode(value)
  }
  try {
    const matches = compare(encode)
    return typeof matches === "boolean" && graph.current() && unhookedHasher() ? matches : false
  } catch {
    return false
  } finally {
    // A callback retaining encode cannot use or retain an observation afterwards.
    graph = undefined
  }
}
