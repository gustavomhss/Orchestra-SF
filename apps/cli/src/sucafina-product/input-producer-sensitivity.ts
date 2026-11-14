import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { SensitivityRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SensitivityInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { CriterionResultBinding } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts"
import type { StoredDecisionResult } from "../../../../modules/sucafina/Sucafinav1/product/decisions/result-store.ts"
import type { createPlannerSensitivityUnits } from "../../../../modules/sucafina/Sucafinav1/product/planner/sensitivity-units.ts"
import type { createPortfolioProofVerifier } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/verification.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

function humanSensitivitySelection(value: unknown): { choiceRef: string; request: SensitivityRequest; parameterRanges: SensitivityInput["parameterRanges"] } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.length !== 3 || entries.some(([key]) => key !== "choiceRef" && key !== "request" && key !== "parameterRanges")) return undefined
  const choiceRef = entries.find(([key]) => key === "choiceRef")?.[1]
  const request = decodeSfOperationInput("sf_sensitivity_evaluate", entries.find(([key]) => key === "request")?.[1])
  const ranges = entries.find(([key]) => key === "parameterRanges")?.[1]
  if (typeof choiceRef !== "string" || !choiceRef.trim() || !request.ok || !Array.isArray(ranges) || !ranges.length) return undefined
  const parameterRanges = ranges.flatMap((range) => {
    if (!range || typeof range !== "object" || Array.isArray(range)) return []
    const fields = Object.entries(range)
    if (fields.length !== 4 || fields.some(([key]) => key !== "parameterRef" && key !== "minimum" && key !== "maximum" && key !== "steps")) return []
    const parameterRef = fields.find(([key]) => key === "parameterRef")?.[1]
    const minimum = fields.find(([key]) => key === "minimum")?.[1]
    const maximum = fields.find(([key]) => key === "maximum")?.[1]
    const steps = fields.find(([key]) => key === "steps")?.[1]
    return typeof parameterRef === "string" && parameterRef.trim() && typeof minimum === "number" && typeof maximum === "number" && typeof steps === "number" && Number.isSafeInteger(steps) && steps >= 1 ? [{ parameterRef, minimum, maximum, steps }] : []
  })
  if (parameterRanges.length !== ranges.length || !parameterRanges.some((range) => same(range, request.value.parameterBounds))) return undefined
  return { choiceRef, request: request.value, parameterRanges }
}

async function compose(dependencies: SfAnalysisDependencies & {
  selectedSensitivity: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<{ binding: CriterionResultBinding; result: StoredDecisionResult }>>
  portfolioProof: Pick<ReturnType<typeof createPortfolioProofVerifier>, "verifySensitivity">
  units: Pick<ReturnType<typeof createPlannerSensitivityUnits>, "resolve">
}, human: ReturnType<typeof humanSensitivitySelection> & object, request: SfAnalysisRequest, call: TrustedDomainContext): Promise<SensitivityInput | undefined> {
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
  if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
  const choice = current.value.case.choices.find((item) => item.id === human.choiceRef)
  if (!choice) return undefined
  const criteria = choice.criteria.flatMap((id) => current.value.case.criteria.filter((criterion) => criterion.id === id))
  if (criteria.length !== choice.criteria.length || !criteria.some((criterion) => criterion.id === human.request.criterion.id)) return undefined
  const comparison = await dependencies.planner.compareScenarios({ scenarioRefs: [choice.comparison.baselineResultRef, choice.comparison.alternativeResultRef], criteria: choice.criteria }, call)
  if (comparison.status !== "ok" || !same(comparison.value, choice.comparison) || human.request.scenarioRef !== comparison.value.alternativeResultRef) return undefined
  const selected = await dependencies.selectedSensitivity(request.caseRef, call)
  if (selected.status !== "ok" || selected.value.result.kind !== "sensitivity") return undefined
  const binding = selected.value.binding
  const stored = selected.value.result
  if (!same(binding.caseRef, request.caseRef) || !same(stored.caseRef, request.caseRef) || binding.resultRef !== stored.resultRef || binding.resultDigest !== stored.resultDigest || stored.resultDigest !== digestSfValue(stored.result) || binding.requestDigest !== digestSfValue(binding.request) || binding.requestDigest !== stored.requestDigest || !same(binding.request, human.request) || !same(stored.result.costCoverageRefs, comparison.value.costCoverageRefs) || !await dependencies.portfolioProof.verifySensitivity(binding, stored, call)) return undefined
  const units = await dependencies.units.resolve(binding.request, call)
  if (units.status !== "ok" || units.value.baselineRef !== comparison.value.baselineResultRef || units.value.ruleRef !== binding.ruleRef || units.value.ruleVersion !== binding.ruleVersion || units.value.evidenceRefs.some((ref) => !stored.sourceRefs.some((item) => same(item, ref)))) return undefined
  const sources = await dependencies.context.context({ refs: stored.sourceRefs }, call)
  if (sources.length !== stored.sourceRefs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, stored.sourceRefs[index]) || !same(item.currentRef, item.ref)) || !await dependencies.host.revalidate(call)) return undefined
  return { comparison: comparison.value, criteria, parameterRanges: human.parameterRanges, costCoverageRefs: comparison.value.costCoverageRefs }
}

export function createSfSensitivityInputProducer(dependencies: SfAnalysisDependencies & {
  selectedSensitivity: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<{ binding: CriterionResultBinding; result: StoredDecisionResult }>>
  portfolioProof: Pick<ReturnType<typeof createPortfolioProofVerifier>, "verifySensitivity">
  units: Pick<ReturnType<typeof createPlannerSensitivityUnits>, "resolve">
}): SfInputProducer {
  return {
    skillIds: ["sf-avaliar-sensibilidade"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = humanSensitivitySelection(selection)
      if (!human || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version)) return { status: "needs-input", reason: "invalid-analysis-input" }
      const first = await compose(dependencies, human, request, call)
      const second = await compose(dependencies, human, request, call)
      if (!first || !second || !same(first, second)) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const decoded = decodeSfSkillInput("SensitivityInput", first)
      return decoded.ok ? { status: "ok", value: decoded.value } : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
    },
  }
}
