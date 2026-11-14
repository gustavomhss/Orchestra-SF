import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { Period } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { PlannerSensitivityRule, createPlannerSensitivityUnits } from "./sensitivity-units.ts"
import type { comparePlannerPreview } from "./preview-comparison.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type MetricRequest = { caseRef: CaseRef; criterionId: string; ruleRef: string; ruleVersion: number; scenarioRef: string; metricRef: string; baselineRef?: string }
type Metric = MetricRequest & { value: number | null; unit: string; period: Period; evidenceRefs: readonly BusinessEvidenceRef[]; state: "confirmed" | "conditioned"; engineVersion: string }

/** Resolve a registered criterion to the domain-produced, currently authorized Planner metric. */
export function createPlannerCriterionMetric(input: {
  host: Pick<DomainPortHost, "revalidate">
  rules: { resolve: (request: { caseRef: CaseRef; criterionId: string }, context: TrustedDomainContext) => Promise<PortResult<PlannerSensitivityRule>> }
  units: ReturnType<typeof createPlannerSensitivityUnits>
  preview: (request: Parameters<typeof comparePlannerPreview>[1], context: TrustedDomainContext) => ReturnType<typeof comparePlannerPreview>
}) {
  return async (incoming: MetricRequest, context: TrustedDomainContext): Promise<PortResult<Metric>> => {
    const request = structuredClone(incoming)
    if (!await input.host.revalidate(context)) return { status: "denied", reason: "criterion-authority-unavailable" }
    const rule = await input.rules.resolve({ caseRef: request.caseRef, criterionId: request.criterionId }, context)
    if (rule.status !== "ok") return rule
    if (!rule.value.sensitivity || !request.baselineRef || request.baselineRef !== rule.value.sensitivity.baselineRef || request.metricRef !== "planner:known-subtotal-difference" || request.metricRef !== rule.value.metricRef || request.ruleRef !== rule.value.ruleRef || request.ruleVersion !== rule.value.version || request.criterionId !== rule.value.criterionId || request.caseRef.id !== rule.value.caseRef.id || request.caseRef.incarnation !== rule.value.caseRef.incarnation || rule.value.caseRef.version > request.caseRef.version) return { status: "needs-input", reason: "criterion-metric-binding-mismatch" }
    const issued = await input.units.issue({ scenarioRef: request.scenarioRef, baselineRef: request.baselineRef, parameterRef: rule.value.sensitivity.parameterRef }, context)
    if (issued.status !== "ok") return issued
    if (digestSfValue(issued.value.caseRef) !== digestSfValue(request.caseRef) || digestSfValue(issued.value.units) !== digestSfValue(rule.value.sensitivity) || rule.value.unit !== issued.value.units.resultUnit) return { status: "stale", reason: "criterion-units-changed" }
    if (issued.value.sourceComparison?.comparisonStatus === "complete" && issued.value.sourceComparison.completeDifference !== null) {
      if (!issued.value.sourcePeriod || digestSfValue(issued.value.sourcePeriod) !== digestSfValue(rule.value.period)) return { status: "stale", reason: "criterion-metric-changed" }
      const again = await input.rules.resolve({ caseRef: request.caseRef, criterionId: request.criterionId }, context)
      const issuedAgain = await input.units.issue({ scenarioRef: request.scenarioRef, baselineRef: request.baselineRef, parameterRef: rule.value.sensitivity.parameterRef }, context)
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(rule.value) || issuedAgain.status !== "ok" || issuedAgain.value.metadataDigest !== issued.value.metadataDigest || digestSfValue(issuedAgain.value.sourceComparison) !== digestSfValue(issued.value.sourceComparison) || !await input.host.revalidate(context)) return { status: "stale", reason: "criterion-authority-or-source-changed" }
      const refs = [...issued.value.units.sourceRefs, ...rule.value.evidenceRefs]
      return { status: "ok", value: { ...request, value: issued.value.sourceComparison.completeDifference, unit: issued.value.units.resultUnit, period: rule.value.period, evidenceRefs: refs.filter((ref, index) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index), state: "confirmed", engineVersion: issued.value.units.engineVersion } }
    }
    const scenario = issued.value.parameterOperation ? { ...issued.value.scenario, operations: [issued.value.parameterOperation] } : issued.value.scenario
    const preview = await input.preview({ baselineRef: request.baselineRef, scenario }, context)
    if (preview.status !== "ok") return preview
    if (preview.value.metric.metricRef !== request.metricRef || preview.value.metric.unit !== rule.value.unit || digestSfValue(preview.value.metric.period) !== digestSfValue(rule.value.period) || preview.value.metric.engineVersion !== issued.value.units.engineVersion) return { status: "stale", reason: "criterion-metric-changed" }
    const again = await input.rules.resolve({ caseRef: request.caseRef, criterionId: request.criterionId }, context)
    const issuedAgain = await input.units.issue({ scenarioRef: request.scenarioRef, baselineRef: request.baselineRef, parameterRef: rule.value.sensitivity.parameterRef }, context)
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(rule.value) || issuedAgain.status !== "ok" || issuedAgain.value.metadataDigest !== issued.value.metadataDigest || digestSfValue(issuedAgain.value.parameterOperation) !== digestSfValue(issued.value.parameterOperation) || !await input.host.revalidate(context)) return { status: "stale", reason: "criterion-authority-or-source-changed" }
    const refs = [...preview.value.metric.evidenceRefs, ...rule.value.evidenceRefs]
    return { status: "ok", value: { ...request, value: preview.value.metric.value, unit: preview.value.metric.unit, period: preview.value.metric.period, evidenceRefs: refs.filter((ref, index) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index), state: "conditioned", engineVersion: preview.value.metric.engineVersion } }
  }
}
