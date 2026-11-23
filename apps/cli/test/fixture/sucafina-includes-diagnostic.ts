import { sfCanonicalProjectionRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { sfCanonicalCloneTree } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical-clone.ts"

// Fixture-only counterfactual: the original tagged traversal is retained,
// replacing only its private two-element prototype membership check.
// Bootstrap identities have the existing proof's explicit trust limitation:
// this does not attest intrinsics modified before the module was initialized.
function captureIncludes() {
  // Verify the original canonical anchor BEFORE capturing a later helper's
  // intrinsics. A transient hook must not substitute a fake literal prototype
  // and restore itself before this proof runs.
  if (!sfCanonicalProjectionRuntime()) return undefined
  const property = Object.getOwnPropertyDescriptor, own = Object.hasOwn
  const arrayPrototype = Object.getPrototypeOf([])
  const descriptor = property(arrayPrototype, "includes")
  const originalIncludes: unknown = descriptor && own(descriptor, "value") ? descriptor.value : undefined
  if (typeof originalIncludes !== "function") return undefined
  return { property, own, arrayPrototype, originalIncludes }
}
const captured = captureIncludes()

export function sfCanonicalIncludesDiagnosticBootstrapAvailable() {
  return captureIncludes() !== undefined
}

export function sfCanonicalIncludesDiagnosticAvailable() {
  const current = captured?.property(captured.arrayPrototype, "includes")
  return !!captured && !!current && captured.own(current, "value") && current.value === captured.originalIncludes
}

function canonicalRecordPrototype(value: object): value is Record<string, unknown> {
  // Preserve the first Object/prototype Get before selecting includes, and the
  // later Object/getPrototypeOf method Get, receiver and call after selection.
  const expected: unknown = Object.prototype
  const current = captured?.property(captured.arrayPrototype, "includes")
  if (!captured || !current || !captured.own(current, "value") || current.value !== captured.originalIncludes)
    return [expected, null].includes(Object.getPrototypeOf(value))
  const actual: unknown = Object.getPrototypeOf(value)
  // Native includes uses SameValueZero. A custom Object facade can return NaN
  // for both fields, so strict equality alone would not preserve its behavior.
  return actual === expected || actual === null || (actual !== actual && expected !== expected)
}

export function canonicalSfIncludesDiagnosticValue(value: unknown): string {
  const tree = sfCanonicalCloneTree(value)
  if (tree) return JSON.stringify(tree)
  return JSON.stringify(canonical(value))
}

// Same traversal and dynamic operations as the original canonical function.
// The predicate supplies TypeScript narrowing without a new cast.
function canonical(value: unknown): unknown {
  if (value === undefined) return ["absent"]
  if (value === null) return ["null"]
  if (typeof value === "string" || typeof value === "boolean") return [typeof value, value]
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("SF_CANONICAL_NONFINITE")
    return ["number", Object.is(value, -0) ? "-0" : value]
  }
  if (Array.isArray(value)) return ["array", value.map(canonical)]
  if (typeof value !== "object" || !canonicalRecordPrototype(value))
    throw new Error("SF_CANONICAL_UNSUPPORTED")
  const record = value
  return ["object", Object.keys(record).sort().map((key) => [key, canonical(record[key])])]
}
