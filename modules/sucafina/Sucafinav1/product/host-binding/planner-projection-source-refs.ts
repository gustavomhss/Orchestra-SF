import { canonicalSfValue, digestSfValue, sfCanonicalProjectionRuntime } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection } from "../contracts/context.ts"

type Runtime = NonNullable<ReturnType<typeof sfCanonicalProjectionRuntime>>
type Extent = { height: number; expansion: number; units: number }

const maximumRows = 4096
const maximumNodes = 4096, maximumProperties = 32768, maximumDepth = 64
const maximumExpansion = 65536, maximumUnits = 4 * 1024 * 1024
const maximumRetainedBytes = 4 * 1024 * 1024

/**
 * Prove the inputs used by this synchronous loop. Other fields of each projected
 * value are not read. Distinct source-reference identities retain the original path.
 */
function admit(values: DomainProjection["values"], ref: BusinessEvidenceRef, runtime: Runtime) {
  const property = Object.getOwnPropertyDescriptor, own = Object.hasOwn
  const prototype = Object.getPrototypeOf, keys = Reflect.ownKeys
  const isArray = Array.isArray, finite = Number.isFinite
  const objectPrototype = Object.prototype, arrayPrototype = Array.prototype
  const data = (value: object, key: PropertyKey) => {
    const found = property(value, key)
    return found && own(found, "value") ? found : undefined
  }
  const record = (value: unknown): value is object => {
    if (!value || typeof value !== "object" || runtime.reject(value) || isArray(value)) return false
    const parent = prototype(value)
    return parent === objectPrototype || parent === null
  }
  const array = (value: unknown): value is unknown[] =>
    !!value && typeof value === "object" && !runtime.reject(value) &&
      isArray(value) && prototype(value) === arrayPrototype

  if (!array(values) || property(values, "every") || !record(ref)) return false
  const length = data(values, "length")
  if (!length || typeof length.value !== "number" || length.value < 1) return false
  // Scan only the accessed links; do not retain or inspect the other value fields.
  if (length.value > maximumRows) return false
  let left: object | undefined
  for (let index = 0; index < length.value; index++) {
    const element = data(values, index)
    if (!element || !element.enumerable || !record(element.value)) return false
    const sources = data(element.value, "sourceRefs")
    if (!sources || !sources.enumerable || !array(sources.value)) return false
    const size = data(sources.value, "length"), selected = data(sources.value, "0")
    if (!size || size.value !== 1 || !selected || !selected.enumerable) return false
    if (left === undefined) {
      if (!record(selected.value)) return false
      left = selected.value
    } else if (selected.value !== left) return false
  }
  if (!left) return false

  let nodes = 0, properties = 0
  const memo = new WeakMap<object, Extent>()
  const active = new WeakSet<object>()
  const visit = (value: unknown, depth: number): Extent | undefined => {
    if (depth > maximumDepth) return undefined
    if (value === undefined) return { height: 0, expansion: 1, units: 12 }
    if (value === null) return { height: 0, expansion: 1, units: 10 }
    if (typeof value === "string") {
      const units = 16 + value.length * 6
      return units <= maximumUnits ? { height: 0, expansion: 1, units } : undefined
    }
    if (typeof value === "boolean") return { height: 0, expansion: 1, units: 20 }
    if (typeof value === "number")
      return finite(value) ? { height: 0, expansion: 1, units: 40 } : undefined
    if (typeof value !== "object" || runtime.reject(value)) return undefined
    const saved = memo.get(value)
    if (saved) return depth + saved.height <= maximumDepth ? saved : undefined
    if (active.has(value) || ++nodes > maximumNodes) return undefined
    const isList = isArray(value), parent = prototype(value)
    if (isList ? parent !== arrayPrototype : parent !== objectPrototype && parent !== null) return undefined
    const names = keys(value)
    if (properties + names.length > maximumProperties) return undefined
    properties += names.length
    for (let index = 0; index < names.length; index++) if (typeof names[index] !== "string") return undefined
    let count = names.length
    if (isList) {
      const size = data(value, "length")
      if (!size || typeof size.value !== "number" || names.length !== size.value + 1) return undefined
      count = size.value
    }
    let height = 0, expansion = 1, units = 16
    active.add(value)
    for (let index = 0; index < count; index++) {
      const key = isList ? index : names[index]
      if (typeof key !== "number" && typeof key !== "string") return undefined
      const field = data(value, key)
      if (!field || !field.enumerable) return undefined
      const child = visit(field.value, depth + 1)
      if (!child) return undefined
      const keyUnits = typeof key === "number" ? 1 : 8 + key.length * 6
      if (expansion > maximumExpansion - child.expansion ||
        units > maximumUnits - child.units - keyUnits) return undefined
      expansion += child.expansion
      units += child.units + keyUnits
      if (child.height + 1 > height) height = child.height + 1
    }
    active.delete(value)
    const extent = { height, expansion, units }
    memo.set(value, extent)
    return extent
  }
  const first = visit(left, 0)
  if (!first) return false
  const second = visit(ref, 0)
  return !!second && first.expansion <= maximumExpansion - second.expansion &&
    first.units <= maximumUnits - second.units
}

/**
 * Only canonical bytes are shared, for this one synchronous comparison.
 * The original global hasher still runs twice for every visited valid row.
 */
export function matchesSfPlannerProjectionSourceRefs(values: DomainProjection["values"], ref: BusinessEvidenceRef) {
  let digest = digestSfValue
  try {
    const runtime = sfCanonicalProjectionRuntime()
    if (runtime && admit(values, ref, runtime)) {
      const bytes = new WeakMap<object, string>()
      let retainedBytes = 0
      const canonicalBytes = (value: unknown): string => {
        if (!value || typeof value !== "object") return canonicalSfValue(value)
        let prior: string | undefined
        try { prior = bytes.get(value) } catch { /* The optional memo cannot replace canonical behavior. */ }
        if (prior !== undefined) return prior
        const encoded = canonicalSfValue(value)
        const size = typeof encoded === "string" ? encoded.length * 2 : maximumRetainedBytes + 1
        if (retainedBytes <= maximumRetainedBytes - size) {
          try {
            bytes.set(value, encoded)
            retainedBytes += size
          } catch { /* Return the original bytes even if retaining them is unavailable. */ }
        }
        return encoded
      }
      digest = (value: unknown) =>
        new Bun.CryptoHasher("sha256").update(canonicalBytes(value)).digest("hex")
    }
  } catch { /* Refused/failed admission retains the entire original loop. */ }
  return values.every((value) =>
    value.sourceRefs.length === 1 && digest(value.sourceRefs[0]) === digest(ref))
}
