import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { CriterionResultBinding } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts"
import type { StoredDecisionResult } from "../../../../modules/sucafina/Sucafinav1/product/decisions/result-store.ts"
import type { createPlannerSensitivityUnits } from "../../../../modules/sucafina/Sucafinav1/product/planner/sensitivity-units.ts"
import type { createPortfolioProofVerifier } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/verification.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest, SfAnalysisVerifier } from "./analysis-verifier.ts"

export function createSfSensitivityVerifier(dependencies: SfAnalysisDependencies & {
  selectedSensitivity: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<{ binding: CriterionResultBinding; result: StoredDecisionResult }>>
  portfolioProof: Pick<ReturnType<typeof createPortfolioProofVerifier>, "verifySensitivity">
  units: Pick<ReturnType<typeof createPlannerSensitivityUnits>, "resolve">
}): SfAnalysisVerifier {
  return {
    skillIds: ["sf-avaliar-sensibilidade"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("SensitivityInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version ||
          digestSfValue(value.costCoverageRefs) !== digestSfValue(value.comparison.costCoverageRefs) ||
          value.criteria.some((criterion) => !current.value.case.criteria.some((item) => digestSfValue(item) === digestSfValue(criterion)))) return undefined
        const choice = current.value.case.choices.find((item) => digestSfValue(item.comparison) === digestSfValue(value.comparison))
        if (!choice) return undefined
        const comparison = await dependencies.planner.compareScenarios({ scenarioRefs: [value.comparison.baselineResultRef, value.comparison.alternativeResultRef], criteria: choice.criteria }, currentCall)
        if (comparison.status !== "ok" || digestSfValue(comparison.value) !== digestSfValue(value.comparison)) return undefined
        const selected = await dependencies.selectedSensitivity(request.caseRef, currentCall)
        if (selected.status !== "ok" || selected.value.result.kind !== "sensitivity") return undefined
        const binding = selected.value.binding
        const result = selected.value.result
        if (digestSfValue(binding.caseRef) !== digestSfValue(request.caseRef) || digestSfValue(result.caseRef) !== digestSfValue(request.caseRef) ||
          binding.resultRef !== result.resultRef || binding.resultDigest !== result.resultDigest || result.resultDigest !== digestSfValue(result.result) ||
          binding.requestDigest !== digestSfValue(binding.request) || binding.requestDigest !== result.requestDigest || binding.criterionId !== binding.request.criterion.id ||
          !value.criteria.some((criterion) => criterion.id === binding.criterionId) ||
          !value.parameterRanges.some((range) => digestSfValue(range) === digestSfValue(binding.request.parameterBounds)) ||
          binding.request.scenarioRef !== value.comparison.alternativeResultRef ||
          digestSfValue(result.result.costCoverageRefs) !== digestSfValue(value.costCoverageRefs) || !await dependencies.portfolioProof.verifySensitivity(binding, result, currentCall)) return undefined
        const units = await dependencies.units.resolve(binding.request, currentCall)
        if (units.status !== "ok" || units.value.baselineRef !== value.comparison.baselineResultRef || units.value.ruleRef !== binding.ruleRef || units.value.ruleVersion !== binding.ruleVersion || units.value.evidenceRefs.some((ref) => !result.sourceRefs.some((item) => digestSfValue(item) === digestSfValue(ref)))) return undefined
        const sources = await dependencies.context.context({ refs: result.sourceRefs }, currentCall)
        if (sources.length !== result.sourceRefs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(result.sourceRefs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, sources, binding, result }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        if (output.state !== "ready" || output.kind !== "SensitivityResult") return { status: "unavailable", reason: "analysis-output-unverified" }
        const current = await read(currentCall)
        if (!current || digestSfValue(current.binding) !== digestSfValue(proof.binding) || digestSfValue(current.result) !== digestSfValue(proof.result) || digestSfValue(output.payload) !== digestSfValue(current.result.result) || digestSfValue(output.evidenceRefs) !== digestSfValue(current.result.result.evidenceRefs)) return { status: "unavailable", reason: "analysis-output-unverified" }
        return { status: "ok", value: true }
      } } }
    },
  }
}
