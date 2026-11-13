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

/** Join memory source identities to the original evidence digest, including authorized historical refs. */
export function sfEvidenceSourceMaps(refs: readonly BusinessEvidenceRef[]) {
  const sourceVersions: Record<string, number> = {}
  const sourceIncarnations: Record<string, string> = {}
  const active = new WeakSet<object>()
  const visit = (ref: BusinessEvidenceRef, depth: number) => {
    if (!ref || typeof ref !== "object" || depth > 16 || active.has(ref) ||
      !["record", "document", "receipt", "case-event", "calculation", "policy"].includes(ref.kind)) throw new Error("SF_EVIDENCE_GRAPH_INVALID")
    active.add(ref)
    if (ref.kind === "calculation") ref.target.sourceRefs.forEach((child) => visit(child, depth + 1))
    if (ref.kind === "case-event") ref.target.evidenceRefs.forEach((child) => visit(child, depth + 1))
    if (ref.refDigest !== digestSfEvidenceRef(ref)) throw new Error("SF_EVIDENCE_DIGEST_INVALID")
    const identity = ref.kind === "record" ? { version: ref.target.version, incarnation: ref.target.incarnation }
      : ref.kind === "document" ? { version: ref.target.revision, incarnation: ref.target.incarnation }
      : ref.kind === "receipt" ? { version: ref.target.version, incarnation: ref.target.targetIncarnation }
      : ref.kind === "case-event" ? { version: ref.target.caseVersion, incarnation: ref.target.caseIncarnation }
      : undefined
    if (identity) {
      if (!Number.isSafeInteger(identity.version) || identity.version < 0 || !identity.incarnation.trim()) throw new Error("SF_EVIDENCE_SOURCE_IDENTITY_INVALID")
      sourceVersions[ref.refDigest] = identity.version
      sourceIncarnations[ref.refDigest] = identity.incarnation
    }
    active.delete(ref)
  }
  refs.forEach((ref) => visit(ref, 0))
  return { sourceVersions, sourceIncarnations }
}
