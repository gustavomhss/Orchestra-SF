import { digestSfValue, sfEvidenceSourceMaps } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../contracts/business-context.ts"
import { planSfRecallInvalidation, sfRecallCacheKey } from "./recall.ts"
import type { RecallScope } from "./recall.ts"

export type MemoryInvalidationPlan = {
  action: "reuse" | "invalidate"
  reasons: readonly string[]
  dependencyDigests: readonly string[]
  reauthorize: true
}

/** Cache/lease/index consumers receive fingerprints, never permission to reuse without reauthorization. */
export type InvalidationEnvelope = {
  schema: "sf-memory-invalidation-v1"
  scopeDigest: string
  action: MemoryInvalidationPlan["action"]
  reasons: readonly string[]
  dependencyDigests: readonly string[]
  reauthorize: true
}

export function planSfMemoryInvalidation(previous: RecallScope, current: RecallScope, dependencies: readonly BusinessEvidenceRef[]): MemoryInvalidationPlan {
  try {
    const maps = sfEvidenceSourceMaps(dependencies)
    const expanded = dependencies.flatMap(expand)
    const dependencyDigests = [...new Set(expanded.map((ref) => ref.refDigest))].sort()
    const reasons = planSfRecallInvalidation(previous, current).reasons.filter((reason) => reason !== "source-version" && reason !== "source-incarnation")
    if (!dependencies.length) reasons.push("dependencies-unavailable")
    if (Object.entries(maps.sourceVersions).some(([key, version]) => previous.sourceVersions[key] !== version || current.sourceVersions[key] !== previous.sourceVersions[key])) reasons.push("source-version")
    if (Object.entries(maps.sourceIncarnations).some(([key, incarnation]) => previous.sourceIncarnations[key] !== incarnation || current.sourceIncarnations[key] !== previous.sourceIncarnations[key])) reasons.push("source-incarnation")
    return { action: reasons.length ? "invalidate" : "reuse", reasons: [...new Set(reasons)], dependencyDigests, reauthorize: true }
  } catch {
    return { action: "invalidate", reasons: ["dependencies-invalid"], dependencyDigests: [], reauthorize: true }
  }
}

export function createSfInvalidationEnvelope(previous: RecallScope, current: RecallScope, dependencies: readonly BusinessEvidenceRef[]): InvalidationEnvelope {
  const plan = planSfMemoryInvalidation(previous, current, dependencies)
  return { schema: "sf-memory-invalidation-v1", scopeDigest: sfRecallCacheKey(current), action: plan.action, reasons: plan.reasons, dependencyDigests: plan.dependencyDigests, reauthorize: true }
}

/** A per-envelope decision; the host still reauthorizes before every cache use. */
export function decideSfRecallInvalidation(input: { previous: RecallScope; current: RecallScope; dependencies: readonly BusinessEvidenceRef[]; resolutions: readonly BusinessEvidenceResolution[] }) {
  try {
    const maps = sfEvidenceSourceMaps(input.dependencies)
    if (!input.dependencies.length) return { status: "unavailable" as const, reauthorize: true as const }
    const refs = input.dependencies.flatMap(expand)
    const changedImmutable: string[] = []
    for (const ref of refs) {
      if (ref.installationId !== input.current.installationId || ref.projectId !== input.current.projectId) return { status: "unavailable" as const, reauthorize: true as const }
      const resolutions = input.resolutions.filter((resolution) => digestSfValue(resolution.ref) === digestSfValue(ref) && resolution.accessRevision === input.current.accessRevision)
      if (resolutions.length !== 1 || (resolutions[0]!.state !== "fresh" && resolutions[0]!.state !== "historical") || !resolutions[0]!.authorizedProjection || !resolutions[0]!.currentRef || (resolutions[0]!.state === "historical" && !resolutions[0]!.differences)) return { status: "unavailable" as const, reauthorize: true as const }
      const current = resolutions[0]!.currentRef!
      if (current.installationId !== input.current.installationId || current.projectId !== input.current.projectId || !sameReferenceSubject(ref, current)) return { status: "unavailable" as const, reauthorize: true as const }
      // A currently authorized reader may receive a new scoped record ref for the
      // same material projection; scope maps below still invalidate the old cache.
      if (resolutions[0]!.state === "fresh" && current.refDigest !== ref.refDigest && !(ref.kind === "record" && current.kind === "record" && ref.schema === current.schema && ref.evidenceLevel === current.evidenceLevel && ref.target.projectionDigest === current.target.projectionDigest)) return { status: "unavailable" as const, reauthorize: true as const }
      const mapped = sfEvidenceSourceMaps([current])
      if (maps.sourceVersions[ref.refDigest] !== undefined && (mapped.sourceVersions[current.refDigest] !== input.current.sourceVersions[ref.refDigest] || mapped.sourceIncarnations[current.refDigest] !== input.current.sourceIncarnations[ref.refDigest])) return { status: "unavailable" as const, reauthorize: true as const }
      if (maps.sourceVersions[ref.refDigest] === undefined && current.refDigest !== ref.refDigest) changedImmutable.push("immutable-source")
    }
    const plan = planSfMemoryInvalidation(input.previous, input.current, input.dependencies)
    const reasons = [...plan.reasons, ...changedImmutable]
    if (Object.keys(maps.sourceVersions).some((key) => input.previous.sourceVersions[key] !== maps.sourceVersions[key] || input.current.sourceVersions[key] !== input.previous.sourceVersions[key])) reasons.push("source-version")
    if (Object.keys(maps.sourceIncarnations).some((key) => input.previous.sourceIncarnations[key] !== maps.sourceIncarnations[key] || input.current.sourceIncarnations[key] !== input.previous.sourceIncarnations[key])) reasons.push("source-incarnation")
    const uniqueReasons = [...new Set(reasons)]
    return { status: uniqueReasons.length ? "invalidate" as const : "reuse" as const, reasons: uniqueReasons, reauthorize: true as const }
  } catch {
    return { status: "unavailable" as const, reauthorize: true as const }
  }
}

function sameReferenceSubject(original: BusinessEvidenceRef, current: BusinessEvidenceRef): boolean {
  if (original.kind === "record" && current.kind === "record") return original.target.surface === current.target.surface && original.target.recordType === current.target.recordType && original.target.recordId === current.target.recordId && digestSfValue([...original.target.fields].sort()) === digestSfValue([...current.target.fields].sort()) && digestSfValue(original.target.period) === digestSfValue(current.target.period)
  if (original.kind === "document" && current.kind === "document") return original.target.documentId === current.target.documentId && original.target.fieldCandidateId === current.target.fieldCandidateId
  if (original.kind === "receipt" && current.kind === "receipt") return original.target.surface === current.target.surface && original.target.receiptId === current.target.receiptId && original.target.idempotencyKey === current.target.idempotencyKey && original.target.commandDigest === current.target.commandDigest
  if (original.kind === "case-event" && current.kind === "case-event") return original.target.caseId === current.target.caseId && original.target.eventId === current.target.eventId
  if (original.kind === "calculation" && current.kind === "calculation") return original.target.calculationId === current.target.calculationId && digestSfValue(original.target.period) === digestSfValue(current.target.period) && original.target.currency === current.target.currency
  if (original.kind === "policy" && current.kind === "policy") return original.target.packageId === current.target.packageId && original.target.ruleId === current.target.ruleId && original.target.scope === current.target.scope
  return false
}

function expand(ref: BusinessEvidenceRef): BusinessEvidenceRef[] {
  if (ref.kind === "case-event") return [ref, ...ref.target.evidenceRefs.flatMap(expand)]
  if (ref.kind === "calculation") return [ref, ...ref.target.sourceRefs.flatMap(expand)]
  return [ref]
}
