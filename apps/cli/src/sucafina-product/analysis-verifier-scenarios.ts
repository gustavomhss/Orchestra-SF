import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { ScenarioComparison } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { withoutObservationTimes, type SfAnalysisDependencies, type SfAnalysisProof, type SfAnalysisRequest, type SfAnalysisVerifier } from "./analysis-verifier.ts"

type ReadFailure = { readonly failed: PortResult<never> }

export function createSfScenarioVerifier(dependencies: SfAnalysisDependencies & { scenarioRef: (caseRef: SfAnalysisRequest["caseRef"], alternative: { id: string; version: number }, call: TrustedDomainContext) => Promise<PortResult<string>> }): SfAnalysisVerifier {
  return {
    skillIds: ["sf-comparar-cenarios"],
    verify: async (input, request, call) => {
      if (request.skillId === "sf-comparar-cenarios") return verifyComparison(dependencies, input, request, call)
      return { status: "denied", reason: "skill-not-supported" }
    },
  }
}

async function verifyComparison(dependencies: Parameters<typeof createSfScenarioVerifier>[0], input: unknown, request: SfAnalysisRequest, call: TrustedDomainContext): Promise<PortResult<SfAnalysisProof>> {
  const decoded = decodeSfSkillInput("ScenarioComparisonInput", input)
  if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
  const value = decoded.value
  const read = async (currentCall: TrustedDomainContext): Promise<{ current: AuthorizedCaseProjection["case"]; replay: ScenarioComparison; sources: SfAnalysisProof["sources"] } | ReadFailure | undefined> => {
    const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
    if (current.status !== "ok" || current.value.case.id !== request.caseRef.id || current.value.case.incarnation !== request.caseRef.incarnation || current.value.case.version !== request.caseRef.version) return undefined
    const domain = current.value.case
    if (value.alternatives.length !== 2 || value.alternatives[0]!.id === value.alternatives[1]!.id || value.currency !== domain.currency || digestSfValue(value.horizon) !== digestSfValue(domain.horizon) || digestSfValue(value.costCoverageBases) !== digestSfValue(domain.costCoverageBases)) return undefined
    const matched = value.alternatives.map((alternative) => domain.alternatives.filter((item) => item.id === alternative.id && item.version === alternative.version && item.title === alternative.title && digestSfValue(item.result) === digestSfValue(alternative.result)))
    if (matched.some((items) => items.length !== 1)) return undefined
    const alternatives = matched.map((items) => items[0]!)
    if (digestSfValue(value.operations) !== digestSfValue(alternatives.flatMap((alternative) => alternative.scenario.operations))) return undefined
    const resolved = await Promise.all(alternatives.map((alternative) => dependencies.scenarioRef(request.caseRef, alternative, currentCall)))
    if (resolved.some((item) => item.status !== "ok")) return undefined
    const scenarioRefs = resolved.flatMap((item) => item.status === "ok" ? [item.value] : [])
    if (scenarioRefs.some((ref) => !ref.trim()) || new Set(scenarioRefs).size !== 2) return undefined
    const replay = await dependencies.planner.compareScenarios({ scenarioRefs, criteria: [] }, currentCall)
    if (replay.status !== "ok") return { failed: replay }
    const refs = uniqueRefs(alternatives.flatMap((alternative) => alternative.result.sourceRefs))
    if (!refs.length || refs.some((ref) => !current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref)))) return undefined
    const sources = await dependencies.context.context({ refs }, currentCall)
    if (sources.length !== refs.length || sources.some((item) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
    return { current: current.value.case, replay: replay.value, sources }
  }
  const proof = await read(call)
  if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
  if ("failed" in proof) return proof.failed
  return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, freshCall) => {
    const current = await read(freshCall)
    return current && !("failed" in current) && output.kind === "ScenarioComparison" && digestSfValue(output.evidenceRefs) === digestSfValue(uniqueRefs(value.alternatives.flatMap((alternative) => alternative.result.sourceRefs))) && digestSfValue(withoutObservationTimes(output.payload)) === digestSfValue(withoutObservationTimes(current.replay))
      ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-unverified" }
  } } }
}

function uniqueRefs(refs: readonly BusinessEvidenceRef[]) {
  return refs.filter((ref, index) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index)
}
