/** Tagged canonical bytes distinguish absent, null, zero and inherited value descriptors. */
import type { BusinessEvidenceRef } from "./business-context.ts"
import type { ContributionEnvelope } from "./resident-ai.ts"

export function canonicalSfValue(value: unknown): string {
  return JSON.stringify(canonical(value))
}

export function digestSfValue(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(canonicalSfValue(value)).digest("hex")
}

/** Integrity of the whole reference; authentication remains in the source resolver. */
export function digestSfEvidenceRef(reference: BusinessEvidenceRef): string {
  return digestSfValue(Object.fromEntries(Object.entries(reference).filter(([key]) => key !== "refDigest")))
}

/** The digest field itself is excluded; all other envelope fields are bound to this revision. */
export function digestSfContribution(envelope: ContributionEnvelope): string {
  return digestSfValue(Object.fromEntries(Object.entries(envelope).filter(([key]) => key !== "outputDigest")))
}

function canonical(value: unknown): unknown {
  if (value === undefined) return ["absent"]
  if (value === null) return ["null"]
  if (typeof value === "string" || typeof value === "boolean") return [typeof value, value]
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("SF_CANONICAL_NONFINITE")
    return ["number", Object.is(value, -0) ? "-0" : value]
  }
  if (Array.isArray(value)) return ["array", value.map(canonical)]
  if (typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw new Error("SF_CANONICAL_UNSUPPORTED")
  const record = value as Record<string, unknown>
  return ["object", Object.keys(record).sort().map((key) => [key, canonical(record[key])])]
}
