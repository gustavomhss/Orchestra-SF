import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { CaseRecall } from "../../../../modules/sucafina/Sucafinav1/product/contracts/outputs.ts"
import type { DecisionRecallInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfCaseRecall } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/case-recall.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { withoutObservationTimes } from "./analysis-verifier.ts"
import type { SfAnalysisDependencies, SfAnalysisProof, SfAnalysisRequest } from "./analysis-verifier.ts"

type MemoryDependencies = Pick<SfAnalysisDependencies, "cases" | "context" | "host"> & { caseRecall: ReturnType<typeof createSfCaseRecall> }
export type SfMemoryEvidence = Pick<BusinessEvidenceResolution, "state" | "ref" | "currentRef" | "authorizedProjection" | "differences" | "accessRevision">
export type SfMemoryPrompt = { result: CaseRecall; sources: readonly SfMemoryEvidence[] }

function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }

/** Preserve original evidence and the current comparison together; checkedAt is an observation, not proof identity. */
export function sfMemoryEvidence(source: BusinessEvidenceResolution): SfMemoryEvidence {
  return { state: source.state, ref: source.ref, currentRef: source.currentRef, authorizedProjection: source.authorizedProjection,
    differences: source.differences, accessRevision: source.accessRevision }
}

function evidenceAllowed(source: BusinessEvidenceResolution, expected: BusinessEvidenceRef, call: TrustedDomainContext, historical: boolean) {
  if (!same(source.ref, expected) || source.accessRevision !== call.binding.accessRevision || !source.currentRef || !source.authorizedProjection) return false
  for (const ref of [source.ref, source.currentRef]) {
    if (ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref)) return false
  }
  return source.state === "fresh" ? same(source.currentRef, source.ref)
    : historical && source.state === "historical" && Array.isArray(source.differences)
}

export function sfHistoricalMemoryRequested(request: SfAnalysisRequest, input: unknown) {
  if (request.skillId !== "sf-consultar-memoria-decisoria") return false
  const decoded = decodeSfSkillInput("DecisionRecallInput", input)
  return decoded.ok && decoded.value.recallScope.includeHistorical === true && same(decoded.value.currentCase, request.caseRef) &&
    decoded.value.query.trim().length > 0 && decoded.value.query === request.objective
}

/** Host exception is limited to the one memory skill and its verifier's complete recall proof. */
export function sfAnalysisSourcesAuthorized(proof: Pick<SfAnalysisProof, "input" | "sources" | "promptContext">, request: SfAnalysisRequest, call: TrustedDomainContext) {
  const historical = sfHistoricalMemoryRequested(request, proof.input)
  if (historical) {
    const prompt = proof.promptContext && "decisionRecall" in proof.promptContext ? proof.promptContext.decisionRecall : undefined
    if (!prompt || prompt.result.accessRevision !== call.binding.accessRevision ||
      !same(withoutObservationTimes(prompt.sources), withoutObservationTimes(proof.sources.map(sfMemoryEvidence)))) return false
    const refs = prompt.result.matches.flatMap((match) => match.evidenceRefs).filter((ref, index, all) => all.findIndex((item) => same(item, ref)) === index)
    if (!same(refs, proof.sources.map((source) => source.ref))) return false
  }
  return proof.sources.every((source) => evidenceAllowed(source, source.ref, call, historical))
}

/** C17/CaseRecall perform original-capture, source-continuity and ACL proofs; adapters never synthesize those facts. */
export async function readSfMemorySelection(dependencies: MemoryDependencies, value: DecisionRecallInput, call: TrustedDomainContext) {
  const binding = digestSfValue([call.kind, call.binding])
  const selectionDigest = digestSfValue(value)
  const request = dependencies.host.requestFor(call)
  if (!request || request.signal.aborted || !await dependencies.host.revalidate(call)) return undefined
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(value.currentCase) }, call)
  if (current.status !== "ok" || !same({ id: current.value.case.id, incarnation: current.value.case.incarnation, version: current.value.case.version }, value.currentCase) ||
    !same(current.value.case.horizon, value.recallScope.period)) return undefined
  const recalled = await dependencies.caseRecall({ caseRef: value.currentCase, limit: 50, scope: { query: value.query, recallScope: value.recallScope } }, call)
  if (recalled.status !== "ok" || recalled.accessRevision !== call.binding.accessRevision || recalled.matches.some((match) =>
    !value.recallScope.cases.some((ref) => same(ref, match.caseRef)) || !same(match.caseRef, match.explanation.candidateCaseRef) ||
    !value.recallScope.includeHistorical && match.explanation.sourceStates.includes("historical"))) return undefined
  const refs = recalled.matches.flatMap((match) => match.evidenceRefs).filter((ref, index, all) => all.findIndex((item) => same(item, ref)) === index)
  const sources = await dependencies.context.context({ refs }, call)
  if (sources.length !== refs.length || sources.some((source, index) => !evidenceAllowed(source, refs[index]!, call, value.recallScope.includeHistorical))) return undefined
  const again = await dependencies.cases.read({ caseRef: encodeCaseRef(value.currentCase) }, call)
  if (again.status !== "ok" || !same(again.value.case, current.value.case) || request.signal.aborted || selectionDigest !== digestSfValue(value) ||
    binding !== digestSfValue([call.kind, call.binding]) || !await dependencies.host.revalidate(call)) return undefined
  return { current: current.value.case, recalled, refs, sources }
}

export function sfMemoryReadIdentity(proof: NonNullable<Awaited<ReturnType<typeof readSfMemorySelection>>>) {
  return withoutObservationTimes({ current: proof.current, recalled: proof.recalled, refs: proof.refs, sources: proof.sources.map(sfMemoryEvidence) })
}
