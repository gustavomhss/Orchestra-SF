import { canonicalSfValue } from "../../../product/contracts/canonical.ts"

type Tagged = readonly [string, ...unknown[]]
type Entry = readonly [string, Tagged]
const primitiveTags = new Set(["absent", "null", "string", "boolean", "number"])

/** A local equality pin, never a persisted domain digest or authorization.
 * Flat case/selector records dominate nested fixture reads. Compare their exact
 * tagged canonical values without rebuilding a tagged tree, JSON and SHA256 on
 * every owner check. Complex inputs retain the original canonical serializer.
 */
export function captureFixtureInput(value: unknown): () => boolean {
  const bytes = canonicalSfValue(value)
  const shape = JSON.parse(bytes) as Tagged
  const entries = shape[0] === "object" ? shape[1] as readonly Entry[] : undefined
  if (!entries || entries.some((entry) => !primitiveTags.has(entry[1][0])))
    return () => canonicalSfValue(value) === bytes

  return () => {
    // Keep the canonical serializer's prototype refusal and sorted own keys.
    // Do not enumerate descriptors, cache getters, or rely on object identity.
    if (value === null || typeof value !== "object" || Array.isArray(value))
      return canonicalSfValue(value) === bytes
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value)))
      throw new Error("SF_CANONICAL_UNSUPPORTED")
    const keys = Object.keys(value).sort()
    let equal = keys.length === entries.length
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index]!, expected = entries[index]
      // Read every property in the same order, even after a mismatch. A getter
      // or invalid nested value must not disappear behind an early false.
      const matches = samePrimitive((value as Record<string, unknown>)[key], expected?.[1])
      equal = matches && key === expected?.[0] && equal
    }
    return equal
  }
}

function samePrimitive(value: unknown, expected: Tagged | undefined): boolean {
  if (value === undefined) return expected?.[0] === "absent"
  if (value === null) return expected?.[0] === "null"
  if (typeof value === "string" || typeof value === "boolean")
    return expected?.[0] === typeof value && expected?.[1] === value
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("SF_CANONICAL_NONFINITE")
    return expected?.[0] === "number" && expected?.[1] === (Object.is(value, -0) ? "-0" : value)
  }
  // A newly nested value cannot equal an original primitive, but still visit
  // it through the real serializer to preserve getter and invalid-value effects.
  canonicalSfValue(value)
  return false
}
