import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { AuthorizedCaseProjection, BusinessContextService, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { ContributionEnvelope } from "../../../../modules/sucafina/Sucafinav1/product/contracts/resident-ai.ts"
import type { BusinessPorts, DecisionCasePort, DomainPortHost, PlannerPort, PortResult, ProcurementPort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"

export type SfAnalysisRequest = Omit<Parameters<BusinessPorts["analysis"]["create"]>[0], "contextFingerprint">
export type SfAnalysisProof = { current: AuthorizedCaseProjection["case"]; input: unknown; sources: readonly BusinessEvidenceResolution[];
  acceptsOutput: (output: ContributionEnvelope, call: TrustedDomainContext) => Promise<PortResult<true>> }
export type SfAnalysisVerifier = { skillIds: readonly string[]; verify: (input: unknown, request: SfAnalysisRequest, call: TrustedDomainContext) => Promise<PortResult<SfAnalysisProof>> }
export type SfAnalysisDependencies = { cases: DecisionCasePort; planner: PlannerPort; procurement: ProcurementPort; context: BusinessContextService; host: DomainPortHost }

export function createSfForecastVerifier(dependencies: SfAnalysisDependencies): SfAnalysisVerifier {
  return {
    skillIds: ["sf-explicar-forecast"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("ForecastExplainInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      if (value.importPreview || value.registeredReasons.length || value.forecastComparison.analysisBasis !== "domain")
        return { status: "unavailable", reason: "analysis-input-producer-unavailable" }
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
        const refs = value.forecastComparison.sourceRefs
        if (refs.length !== 2 || digestSfValue(value.sourceRefs) !== digestSfValue(refs) ||
          refs.some((ref) => !current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref)))) return undefined
        const replay = await dependencies.planner.compareForecast({ baseRef: refs[0]!.refId, candidateRef: refs[1]!.refId,
          period: value.selectedPeriod, currency: value.currency }, currentCall)
        if (replay.status !== "ok" || digestSfValue(withoutObservationTimes(replay.value)) !== digestSfValue(withoutObservationTimes(value.forecastComparison))) return undefined
        const sources = await dependencies.context.context({ refs }, currentCall)
        if (sources.length !== refs.length || sources.some((item) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, replay: replay.value, sources }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        const current = await read(currentCall)
        return current && output.kind === "FinancialAnalysis" && digestSfValue(output.evidenceRefs) === digestSfValue(value.sourceRefs) &&
          digestSfValue(withoutObservationTimes(output.payload)) === digestSfValue(withoutObservationTimes(current.replay))
          ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-unverified" }
      } } }
    },
  }
}

export function withoutObservationTimes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutObservationTimes)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "observedAt").map(([key, item]) => [key, withoutObservationTimes(item)]))
}
