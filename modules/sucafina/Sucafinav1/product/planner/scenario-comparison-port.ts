import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { CostCoverageBasis, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioCompareRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { comparePlannerScenarios, plannerComponentDigest } from "./comparison.ts"

type ResolvedScenario = { result: ScenarioResult; coverageRef: string; basis: CostCoverageBasis; projection: DomainProjection; source: Extract<BusinessEvidenceRef, { kind: "record" }> }
export type PlannerScenarioHost = { resolve: (reference: string, context: TrustedDomainContext) => Promise<PortResult<ResolvedScenario>> }
export type PlannerCriteriaHost = { evaluate: (request: { scenarioRef: string; baselineRef: string; criterionId: string }, context: TrustedDomainContext) => Promise<PortResult<{ criterionId: string; state: "satisfied" | "failed" | "unknown"; reason: string; ruleRef?: string; evidenceRefs: readonly BusinessEvidenceRef[] }>> }

/** Resolve current, authorized case results and recheck their sources before returning. */
export async function compareScenarios(input: { host: DomainPortHost; sources: PlannerSourceHost; scenarios: PlannerScenarioHost; criteria?: PlannerCriteriaHost }, request: ScenarioCompareRequest, binding: TrustedDomainContext): ReturnType<PlannerPort["compareScenarios"]> {
  if (new Set(request.criteria).size !== request.criteria.length) return { status: "needs-input", reason: "duplicate-criteria" }
  if (request.scenarioRefs.length !== 2 || request.scenarioRefs[0] === request.scenarioRefs[1]) return { status: "needs-input", reason: "two-distinct-scenarios-required" }
  if (!(await input.host.revalidate(binding))) return { status: "denied", reason: "invalid-binding" }
  const resolved = structuredClone(await Promise.all(request.scenarioRefs.map((reference) => input.scenarios.resolve(reference, binding))))
  const failed = resolved.find((result) => result.status !== "ok")
  if (failed) return failed
  if (resolved[0].status !== "ok" || resolved[1].status !== "ok") return { status: "unavailable", reason: "scenario-unavailable" }
  const values = [resolved[0].value, resolved[1].value]
  const validateSources = () => Promise.all(values.map(async (value) => {
    if (!value.result.sourceRefs.some((ref) => ref.refDigest === value.source.refDigest) || !value.result.costCoverage.evaluatedSourceRefs.some((ref) => ref.kind === "record" && ref.refDigest === value.source.refDigest)) return false
    const source = await input.sources.resolveForecastSource(value.source.refId, binding)
    const coverage = await input.sources.resolveForecastCoverage(value.coverageRef, binding)
    return source.status === "ok" && source.value.evidence.refDigest === value.source.refDigest && coverage.status === "ok" && coverage.value.coverageRef === value.coverageRef && digestSfValue(coverage.value.basis) === digestSfValue(value.basis) && digestSfValue(coverage.value.assessment) === digestSfValue(value.result.costCoverage)
  }))
  if ((await validateSources()).some((item) => !item)) return { status: "stale", reason: "scenario-source-or-coverage-changed" }
  const comparison = comparePlannerScenarios({ baselineRef: request.scenarioRefs[0], alternativeRef: request.scenarioRefs[1], baselineCoverageRef: values[0].coverageRef, alternativeCoverageRef: values[1].coverageRef, baseline: values[0].result, alternative: values[1].result, baselineProof: values[0], alternativeProof: values[1] })
  const again = await Promise.all(request.scenarioRefs.map((reference) => input.scenarios.resolve(reference, binding)))
  if (!(await input.host.revalidate(binding)) || again.some((entry, index) => entry.status !== "ok" || !values[index] || digestSfValue({ ...entry.value, projection: undefined }) !== digestSfValue({ ...values[index], projection: undefined }) || projectionDigest(entry.value.projection) !== projectionDigest(values[index].projection)) || (await validateSources()).some((item) => !item) || !(await input.host.revalidate(binding))) return { status: "stale", reason: "scenario-or-authority-changed" }
  if (!request.criteria.length || comparison.comparisonStatus === "incompatible" || comparison.comparisonStatus === "unavailable") return { status: "ok", value: comparison }
  if (!input.criteria) return { status: "ok", value: { ...comparison, criterionResults: request.criteria.map((criterionId) => ({ criterionId, state: "unknown", reason: "criterion-rule-unavailable" })), unresolvedConditions: [...comparison.unresolvedConditions, "criterion-rules-unavailable"] } }
  const criteria = input.criteria
  const evaluate = () => Promise.all(request.criteria.map((criterionId) => criteria.evaluate({ scenarioRef: request.scenarioRefs[1], baselineRef: request.scenarioRefs[0], criterionId }, binding)))
  const evaluated = await evaluate()
  const failure = evaluated.find((item) => item.status !== "ok")
  if (failure) return failure
  if (evaluated.some((item, index) => item.status !== "ok" || item.value.criterionId !== request.criteria[index] || !["satisfied", "failed", "unknown"].includes(item.value.state) || typeof item.value.reason !== "string" || !item.value.reason.trim())) return { status: "unavailable", reason: "criterion-result-invalid" }
  const checked = await evaluate()
  const finalScenarios = await Promise.all(request.scenarioRefs.map((reference) => input.scenarios.resolve(reference, binding)))
  if (checked.some((item, index) => digestSfValue(item) !== digestSfValue(evaluated[index])) || finalScenarios.some((entry, index) => entry.status !== "ok" || !values[index] || digestSfValue({ ...entry.value, projection: undefined }) !== digestSfValue({ ...values[index], projection: undefined }) || projectionDigest(entry.value.projection) !== projectionDigest(values[index].projection)) || !(await input.host.revalidate(binding)) || (await validateSources()).some((item) => !item) || !(await input.host.revalidate(binding))) return { status: "stale", reason: "criterion-or-authority-changed" }
  const criterionResults = evaluated.flatMap((item) => item.status === "ok" ? [{ criterionId: item.value.criterionId, state: item.value.state, reason: item.value.reason }] : [])
  return { status: "ok", value: { ...comparison, criterionResults, unresolvedConditions: criterionResults.some((item) => item.state === "unknown") ? [...comparison.unresolvedConditions, "criterion-rules-unavailable"] : comparison.unresolvedConditions } }
}

export function projectionDigest(projection: DomainProjection) {
  return digestSfValue({ ...projection, context: { ...projection.context, sourceRefs: projection.context.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) }, components: plannerComponentDigest(projection.components) })
}
