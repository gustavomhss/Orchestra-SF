import { types } from "node:util"
import type { Snapshot } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"

/**
 * A private mutation comparison, never a durable identity or authorization proof.
 * Ordinary stored data can be compared without materializing tagged hash bytes.
 * Exotic graphs retain the canonical reader, including its rejection semantics.
 */
export function createSfSnapshotMutationGuard(snapshot: Snapshot): () => boolean {
  if (!plainCanonicalData(snapshot)) {
    const before = digestSfValue(snapshot)
    return () => digestSfValue(snapshot) === before
  }
  // structuredClone preserves primitive values, own enumerable keys and dense
  // arrays. Its null-prototype normalization is also canonical-equivalent.
  const before = structuredClone(snapshot)
  return () => plainCanonicalData(snapshot)
    ? equalCanonicalData(before, snapshot)
    : digestSfValue(before) === digestSfValue(snapshot)
}

function plainCanonicalData(value: unknown, active = new WeakSet<object>()): boolean {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value !== "object" || types.isProxy(value) || active.has(value)) return false
  const array = Array.isArray(value)
  const prototype = Object.getPrototypeOf(value)
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false
  const keys = Object.keys(value)
  const names = Object.getOwnPropertyNames(value)
  if (Object.getOwnPropertySymbols(value).length || names.length !== keys.length + Number(array) ||
    array && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) return false
  active.add(value)
  try {
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      // Inspect accessors without invoking them; only the canonical fallback
      // may perform their reads. Proxy detection precedes all introspection.
      if (!descriptor || !("value" in descriptor) || !plainCanonicalData(descriptor.value, active)) return false
    }
    return true
  } finally { active.delete(value) }
}

/** Both graphs have already passed the plain-data admission above. */
function equalCanonicalData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length) return false
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(right, key) ||
      !equalCanonicalData((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key])) return false
  }
  return true
}
