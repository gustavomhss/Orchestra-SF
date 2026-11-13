import { digestSfValue, sfEvidenceSourceMaps } from "../contracts/canonical.ts"
import { deriveSfMemoryOwner } from "./atlas-projection.ts"
import type { AuthorizedCaseProjection, BusinessEvidenceRef, BusinessEvidenceResolution, BusinessMemoryEnvelope, SfAtlasProjection } from "../contracts/business-context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

export type RecallFeatures = { decisionType: string; horizon: string; components: readonly string[]; restrictions: readonly string[]; resultAvailable: boolean }
export type AuthorizedMemoryProjection = { envelope: BusinessMemoryEnvelope; entry: SfAtlasProjection["entry"]; case: AuthorizedCaseProjection; features: RecallFeatures; resolutions: readonly BusinessEvidenceResolution[]; atlasTrace: { module: string; operation: "createMemoryRead.recall"; recordDigest: string }; accessRevision: string }
export type RecallScope = { installationId: string; projectId: string; principalRef: string; accessRevision: string; policyVersion: string; boundaryVersion: string; schemaVersion: string; manifestVersion: string; skillVersion: string; sourceVersions: Readonly<Record<string, number>>; sourceIncarnations: Readonly<Record<string, string>> }

export function sfRecallCacheKey(scope: RecallScope) { return digestSfValue(scope) }

type RecallInput = { scope: RecallScope; features: RecallFeatures; candidates: readonly AuthorizedMemoryProjection[] }
type RecallProof = WeakMap<AuthorizedMemoryProjection, string>

export function rankSfRecalledCases(input: RecallInput) {
  return rankSfCases(input)
}

function rankSfCases(input: RecallInput, proofs?: RecallProof) {
  return input.candidates.flatMap((candidate) => {
    const proven = proofs?.get(candidate) === digestSfValue([candidate, input.scope])
    const context = candidate.case.context
    if (!candidate.envelope.caseRef || candidate.envelope.kind !== "task" || candidate.envelope.owner !== deriveSfMemoryOwner(context, candidate.case.case) || context.installationId !== input.scope.installationId || context.projectId !== input.scope.projectId || context.principalRef !== input.scope.principalRef || context.accessRevision !== input.scope.accessRevision || context.policyVersion !== input.scope.policyVersion || candidate.accessRevision !== input.scope.accessRevision || (!proven && candidate.envelope.accessRevision !== input.scope.accessRevision) || candidate.atlasTrace.operation !== "createMemoryRead.recall" || candidate.atlasTrace.module !== "@orchestra/atlas-boundary/business-memory-ports" || !/^[a-f0-9]{64}$/i.test(candidate.atlasTrace.recordDigest) || !candidate.envelope.evidenceRefs.length || !candidate.envelope.dependencies.length) return []
    const caseRef = candidate.envelope.caseRef
    const entry = candidate.entry
    if (!("taskId" in entry) || !entry.ref || !candidate.envelope.evidenceRefs.some((ref) => ref.kind === "case-event" && ref.target.eventId === candidate.envelope.sourceEventId && ref.target.caseId === caseRef.id && ref.target.caseIncarnation === caseRef.incarnation && entry.ref === `sf-evidence:v1:${ref.refId}:${ref.refDigest}`)) return []
    if (candidate.envelope.projectionDigest !== digestSfValue({ kind: "task", owner: candidate.envelope.owner, entry: candidate.entry, sourceEventId: candidate.envelope.sourceEventId, evidenceRefs: candidate.envelope.evidenceRefs })) return []
    if (candidate.case.case.id !== candidate.envelope.caseRef.id || candidate.case.case.incarnation !== candidate.envelope.caseRef.incarnation || candidate.case.case.version !== candidate.envelope.caseRef.version) return []
    const references = [...candidate.envelope.evidenceRefs, ...candidate.envelope.dependencies]
    // Canonical mapping validates original reference digests and expands nested references.
    try {
      const original = sfEvidenceSourceMaps(references)
      if (digestSfValue(original.sourceVersions) !== digestSfValue(candidate.envelope.sourceVersions) || digestSfValue(original.sourceIncarnations) !== digestSfValue(candidate.envelope.sourceIncarnations)) return []
      if (references.flatMap(expandEvidence).some((ref) => !candidate.resolutions.some((resolution) => digestSfValue(resolution.ref) === digestSfValue(ref) && resolution.accessRevision === input.scope.accessRevision && (resolution.state === "fresh" || resolution.state === "historical")))) return []
      if (Object.entries(original.sourceVersions).some(([key, version]) => {
        const resolution = candidate.resolutions.find((item) => item.ref.refDigest === key && item.accessRevision === input.scope.accessRevision)
        if (!resolution || (resolution.state !== "fresh" && resolution.state !== "historical") || (!proven && original.sourceIncarnations[key] !== input.scope.sourceIncarnations[key])) return true
        if (resolution.state === "fresh" && !proven) return version !== input.scope.sourceVersions[key]
        if (resolution.state === "fresh" && proven && !resolution.currentRef) return true
        if (!resolution.authorizedProjection || !resolution.currentRef || resolution.currentRef.kind !== resolution.ref.kind) return true
        const current = sfEvidenceSourceMaps([resolution.currentRef])
        return current.sourceVersions[resolution.currentRef.refDigest] !== input.scope.sourceVersions[key] || current.sourceIncarnations[resolution.currentRef.refDigest] !== (proven ? input.scope.sourceIncarnations[key] : original.sourceIncarnations[key])
      })) return []
      if (candidate.resolutions.some((resolution) => resolution.state === "historical" && (!resolution.authorizedProjection || !resolution.currentRef))) return []
    } catch {
      return []
    }
    const relevantResolutions = candidate.resolutions.filter((resolution) => references.flatMap(expandEvidence).some((ref) => digestSfValue(ref) === digestSfValue(resolution.ref)))
    const matched = [candidate.features.decisionType === input.features.decisionType ? "decision-type" : "", candidate.features.horizon === input.features.horizon ? "horizon" : "", candidate.features.components.some((item) => input.features.components.includes(item)) ? "component" : "", candidate.features.restrictions.some((item) => input.features.restrictions.includes(item)) ? "restriction" : "", candidate.features.resultAvailable && input.features.resultAvailable ? "result" : ""].filter(Boolean)
    if (!matched.includes("decision-type")) return []
    const differences = [candidate.features.horizon !== input.features.horizon ? "horizon" : "", digestSfValue(candidate.features.components) !== digestSfValue(input.features.components) ? "components" : "", digestSfValue(candidate.features.restrictions) !== digestSfValue(input.features.restrictions) ? "restrictions" : "", candidate.features.resultAvailable !== input.features.resultAvailable ? "result" : "", ...relevantResolutions.flatMap((resolution) => resolution.state === "historical" ? (resolution.differences ?? []).map((difference) => `${difference.field}: ${JSON.stringify(difference.before)} → ${JSON.stringify(difference.after)}`) : [])].filter(Boolean)
    return [{ candidateCaseRef: candidate.envelope.caseRef, matchedCriteria: matched, currentDifferences: differences, sourceStates: relevantResolutions.map((resolution) => resolution.state), limitations: ["Semelhança não confirma validade atual nem recomenda uma escolha."], atlasTrace: candidate.atlasTrace }]
  }).sort((a, b) => b.matchedCriteria.length - a.matchedCriteria.length || a.candidateCaseRef.id.localeCompare(b.candidateCaseRef.id) || a.candidateCaseRef.incarnation.localeCompare(b.candidateCaseRef.incarnation))
}

/** Host-only: callbacks must authenticate the current call and retrieve originals from protected Atlas. */
export async function rankSfRecalledCasesAuthorized(input: RecallInput & {
  call: TrustedDomainContext
  authorizeAtlas: (candidate: AuthorizedMemoryProjection, call: TrustedDomainContext) => Promise<boolean>
  proveContinuity: (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<boolean>
  revalidate: (call: TrustedDomainContext) => Promise<boolean>
}): Promise<{ status: "ok"; cases: ReturnType<typeof rankSfRecalledCases> } | { status: "unavailable" }> {
  try {
    const binding = input.call.binding
    if (binding.installationId !== input.scope.installationId || binding.projectId !== input.scope.projectId || binding.principalRef !== input.scope.principalRef || binding.accessRevision !== input.scope.accessRevision || binding.policyVersion !== input.scope.policyVersion) return { status: "unavailable" }
    const scopeDigest = digestSfValue(input.scope)
    const bindingDigest = digestSfValue([input.call.kind, input.call.binding])
    const proofs: RecallProof = new WeakMap()
    const check = async (candidate: AuthorizedMemoryProjection) => {
      const context = candidate.case.context
      if (context.kind !== input.call.kind || (context.kind === "native" && (input.call.kind !== "native" || context.profileId !== input.call.binding.profileId))) return false
      if (!await input.revalidate(input.call) || !await input.authorizeAtlas(candidate, input.call)) return false
      const refs = [...candidate.envelope.evidenceRefs, ...candidate.envelope.dependencies].flatMap(expandEvidence)
      if (!refs.length) return false
      for (const ref of refs) {
        const resolutions = candidate.resolutions.filter((item) => digestSfValue(item.ref) === digestSfValue(ref) && item.accessRevision === binding.accessRevision)
        if (resolutions.length !== 1) return false
        const resolution = resolutions[0]!
        if ((resolution.state !== "fresh" && resolution.state !== "historical") || !resolution.currentRef || (resolution.state === "historical" && !resolution.authorizedProjection) || !await input.proveContinuity(ref, resolution.currentRef, input.call)) return false
      }
      return bindingDigest === digestSfValue([input.call.kind, input.call.binding]) && await input.revalidate(input.call)
    }
    for (const candidate of input.candidates) {
      const fingerprint = digestSfValue([candidate, input.scope])
      if (!await check(candidate) || fingerprint !== digestSfValue([candidate, input.scope]) || scopeDigest !== digestSfValue(input.scope)) return { status: "unavailable" }
      proofs.set(candidate, fingerprint)
      if (!rankSfCases({ scope: input.scope, features: candidate.features, candidates: [candidate] }, proofs).length) return { status: "unavailable" }
    }
    const cases = rankSfCases(input, proofs)
    for (const candidate of input.candidates) {
      if (!await check(candidate) || proofs.get(candidate) !== digestSfValue([candidate, input.scope]) || scopeDigest !== digestSfValue(input.scope)) return { status: "unavailable" }
    }
    if (bindingDigest !== digestSfValue([input.call.kind, input.call.binding]) || !await input.revalidate(input.call)) return { status: "unavailable" }
    return { status: "ok", cases }
  } catch {
    return { status: "unavailable" }
  }
}

// The host owns eviction and must reauthorize at every use, even if no revision changed.
export function planSfRecallInvalidation(previous: RecallScope, current: RecallScope) {
  const reasons = [
    previous.installationId !== current.installationId || previous.projectId !== current.projectId || previous.principalRef !== current.principalRef ? "authority-scope" : "",
    previous.accessRevision !== current.accessRevision ? "access-revision" : "",
    previous.policyVersion !== current.policyVersion ? "policy-version" : "",
    digestSfValue(previous.sourceVersions) !== digestSfValue(current.sourceVersions) ? "source-version" : "",
    digestSfValue(previous.sourceIncarnations) !== digestSfValue(current.sourceIncarnations) ? "source-incarnation" : "",
    previous.boundaryVersion !== current.boundaryVersion || previous.schemaVersion !== current.schemaVersion || previous.manifestVersion !== current.manifestVersion || previous.skillVersion !== current.skillVersion ? "runtime-version" : "",
  ].filter(Boolean)
  return { invalidate: reasons.length > 0, reasons, reauthorize: true as const }
}

function expandEvidence(ref: BusinessEvidenceRef): BusinessEvidenceRef[] {
  if (ref.kind === "calculation") return [ref, ...ref.target.sourceRefs.flatMap(expandEvidence)]
  if (ref.kind === "case-event") return [ref, ...ref.target.evidenceRefs.flatMap(expandEvidence)]
  return [ref]
}
