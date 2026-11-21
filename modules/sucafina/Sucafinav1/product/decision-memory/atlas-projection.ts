import { memoryKindOf, validate } from "@orchestra/atlas-boundary/business-memory-ports"
import { digestSfValue, sfEvidenceSourceMaps } from "../contracts/canonical.ts"
import type { AuthorizedCaseProjection, AuthorizedPolicyProjection, BusinessEvidenceRef, SfAtlasProjection } from "../contracts/business-context.ts"

type Context = AuthorizedCaseProjection["context"]
type CaseRef = { id: string; incarnation: string }
export type SfAtlasSource =
  | { kind: "task"; projection: AuthorizedCaseProjection; eventId: string; bundleRef: BusinessEvidenceRef }
  | { kind: "project"; projection: AuthorizedPolicyProjection }

export function deriveSfMemoryOwner(context: Context, caseRef?: CaseRef) {
  if (!context || typeof context !== "object") return undefined
  if (!caseRef && context.kind !== "native") return undefined
  const parts = caseRef
    ? [context.installationId, context.projectId, caseRef.id, caseRef.incarnation]
    : [context.installationId, context.projectId, context.kind === "native" ? context.profileId : "", context.policyVersion]
  if (parts.some((part) => typeof part !== "string" || !part.trim())) return undefined
  return `${caseRef ? "sf-case-v1" : "sf-policy-v1"}:${new Bun.CryptoHasher("sha256").update(JSON.stringify(parts)).digest("hex")}`
}

export function mapSfAtlasEntry(source: SfAtlasSource): { status: "mapped"; projection: SfAtlasProjection } | { status: "refused"; reason: string } {
  if (source.kind !== "task" && source.kind !== "project") return { status: "refused", reason: "unsupported-memory-kind" }
  const context = source.projection.context
  if (!context || typeof context !== "object") return { status: "refused", reason: "invalid-scope-or-reference" }
  const owner = deriveSfMemoryOwner(context, source.kind === "task" ? source.projection.case : undefined)
  const ref = source.kind === "task" ? source.bundleRef : source.projection.policyRef
  if (!owner || typeof context.principalRef !== "string" || !context.principalRef.trim() || typeof context.accessRevision !== "string" || !context.accessRevision.trim() || typeof context.policyVersion !== "string" || !context.policyVersion.trim() || ref.schema !== "sf-evidence-v1" || ref.installationId !== context.installationId || ref.projectId !== context.projectId || typeof ref.refId !== "string" || !ref.refId.trim() || !/^[a-f0-9]{64}$/i.test(ref.refDigest)) return { status: "refused", reason: "invalid-scope-or-reference" }
  if (source.kind === "task") {
    const projection = source.projection
    try { sfEvidenceSourceMaps([ref, ...projection.evidenceRefs]) } catch { return { status: "refused", reason: "invalid-evidence-digest" } }
    if (![ref, ...projection.evidenceRefs].every((evidence) => evidenceScopeMatches(evidence, context))) return { status: "refused", reason: "invalid-evidence-scope" }
    if (!projection.case.participants.includes(context.principalRef) || !Number.isSafeInteger(projection.case.version) || projection.case.version < 1) return { status: "refused", reason: "unauthorized-case" }
    const events = projection.events.filter((event) => event.id === source.eventId)
    if (events.length !== 1 || ref.kind !== "case-event") return { status: "refused", reason: "event-or-bundle-missing" }
    const event = events[0]
    const ledger = projection.case.ledger.filter((item) => item.id === event.id)
    if (ledger.length !== 1 || digestSfValue(ledger[0]) !== digestSfValue(event)) return { status: "refused", reason: "ledger-event-mismatch" }
    const target = ref.target
    if (event.caseRef.id !== projection.case.id || event.caseRef.incarnation !== projection.case.incarnation || event.caseRef.version > projection.case.version || target.caseId !== event.caseRef.id || target.caseIncarnation !== event.caseRef.incarnation || target.caseVersion !== event.caseRef.version || target.eventId !== event.id || target.outputDigest !== event.outputDigest || digestSfValue(target.evidenceRefs) !== digestSfValue(event.evidenceRefs)) return { status: "refused", reason: "event-bundle-mismatch" }
    if (!event.id.trim() || !event.rationale.trim() || !event.principalRef.trim() || !Number.isFinite(Date.parse(event.at)) || !Number.isSafeInteger(event.caseRef.version) || event.caseRef.version < 1 || !/^[a-f0-9]{64}$/i.test(event.outputDigest) || !event.evidenceRefs.length || event.evidenceRefs.some((evidence) => evidence.installationId !== context.installationId || evidence.projectId !== context.projectId || !evidence.refId.trim() || !/^[a-f0-9]{64}$/i.test(evidence.refDigest))) return { status: "refused", reason: "incomplete-event-dependencies" }
    if (event.evidenceRefs.some((evidence) => !projection.evidenceRefs.some((authorized) => digestSfValue(authorized) === digestSfValue(evidence)))) return { status: "refused", reason: "unauthorized-event-dependency" }
    const entry = { taskId: `sf-work:${event.caseRef.id}:${event.analysisRunId || event.id}`, attempted: [...event.consideredActions], failedWith: [...event.factualGaps], stoppedAt: event.lifecycleState, lesson: event.rationale, ref: `sf-evidence:v1:${ref.refId}:${ref.refDigest}` }
    if (!validate("task", entry).valid || memoryKindOf(entry) !== "task") return { status: "refused", reason: "invalid-template" }
    const value = { kind: "task" as const, owner, entry, sourceEventId: event.id, evidenceRefs: [ref, ...event.evidenceRefs] }
    return { status: "mapped", projection: { ...value, projectionDigest: digestSfValue(value) } }
  }
  const policy = source.projection
  try { sfEvidenceSourceMaps([ref, ...policy.dependencies]) } catch { return { status: "refused", reason: "invalid-evidence-digest" } }
  if (![ref, ...policy.dependencies].every((evidence) => evidenceScopeMatches(evidence, context))) return { status: "refused", reason: "invalid-evidence-scope" }
  if (ref.kind !== "policy" || typeof ref.target.reviewRef !== "string" || !ref.target.reviewRef.trim() || ref.target.version !== context.policyVersion || ref.target.scope !== policy.scope || ref.target.sourceDigest !== policy.sourceDigest || !/^[a-f0-9]{64}$/i.test(policy.sourceDigest) || typeof policy.rule !== "string" || !policy.rule.trim() || policy.ruleDigest !== digestSfValue(policy.rule) || typeof policy.reviewedBy !== "string" || !policy.reviewedBy.trim() || typeof policy.reviewedAt !== "string" || !policy.reviewedAt.trim() || !Number.isFinite(Date.parse(policy.reviewedAt)) || typeof policy.scope !== "string" || !policy.scope.trim() || typeof policy.sourceEventId !== "string" || !policy.sourceEventId.trim() || !Number.isSafeInteger(policy.validCitationCount) || policy.validCitationCount < 0) return { status: "refused", reason: "policy-not-reviewed" }
  if (policy.dependencies.some((dependency) => dependency.schema !== "sf-evidence-v1" || dependency.installationId !== context.installationId || dependency.projectId !== context.projectId || !dependency.refId.trim() || !/^[a-f0-9]{64}$/i.test(dependency.refDigest))) return { status: "refused", reason: "invalid-policy-dependency" }
  const entry = { rule: policy.rule, scope: policy.scope, frecency: policy.validCitationCount, grounding: `sf-evidence:v1:${ref.refId}:${ref.refDigest}` }
  if (!validate("project", entry).valid || memoryKindOf(entry) !== "project") return { status: "refused", reason: "invalid-template" }
  const value = { kind: "project" as const, owner, entry, sourceEventId: policy.sourceEventId, evidenceRefs: [ref, ...policy.dependencies] }
  return { status: "mapped", projection: { ...value, projectionDigest: digestSfValue(value) } }
}

// The canonical graph validator above bounds depth and rejects cycles before this walk.
function evidenceScopeMatches(ref: BusinessEvidenceRef, context: Context): boolean {
  if (ref.schema !== "sf-evidence-v1" || ref.installationId !== context.installationId || ref.projectId !== context.projectId || !ref.refId.trim()) return false
  if (ref.kind === "case-event") return ref.target.evidenceRefs.every((child) => evidenceScopeMatches(child, context))
  if (ref.kind === "calculation") return ref.target.sourceRefs.every((child) => evidenceScopeMatches(child, context))
  return true
}

export function explainSfMemoryMatch(input: { candidateCaseRef: { id: string; incarnation: string; version: number }; matchedCriteria: readonly string[]; currentDifferences: readonly string[]; sourceStates: readonly string[]; limitations: readonly string[] }) {
  return { candidateCaseRef: input.candidateCaseRef, matchedCriteria: input.matchedCriteria, currentDifferences: input.currentDifferences, sourceStates: input.sourceStates, limitations: input.limitations }
}
