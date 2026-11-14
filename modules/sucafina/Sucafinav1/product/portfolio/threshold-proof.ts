import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest, SensitivityRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { exactComponents, plannerDirectUsdParameter } from "../planner/exact-threshold.ts"
import { plannerComponentDigest } from "../planner/comparison.ts"
import type { createPlannerSensitivity, PlannerSensitivityBinding } from "./planner-sensitivity.ts"

export type KnownSubtotalThreshold = { value: number; evidenceRefs: readonly BusinessEvidenceRef[]; scope: "known-subtotal" }

/** Check the domain certificate against the exact admitted metric, source and two adjacent IEEE values.
 * The domain proves monotonicity; this consumer never infers it from sampled points.
 * A certified subtotal boundary does not resolve missing business cost categories. */
export async function validatePlannerThreshold(input: {
  request: SensitivityRequest
  binding: PlannerSensitivityBinding
  source: ScenarioResult
  baseline: ScenarioResult
  certificate: { value: number | null; evidenceRefs: readonly BusinessEvidenceRef[] }
  preview: Parameters<typeof createPlannerSensitivity>[0]["preview"]
  context: TrustedDomainContext
}): Promise<PortResult<KnownSubtotalThreshold>> {
  const { request, binding, context } = input
  const certificate = structuredClone(input.certificate)
  const value = certificate.value
  const unsupported = () => ({ status: "unavailable" as const, reason: "exact-threshold-certificate-incompatible" })
  if (value === null || !Number.isFinite(value) || value < request.parameterBounds.minimum || value > request.parameterBounds.maximum || !["lte", "gte"].includes(request.criterion.operator) || binding.metric !== "alternative-minus-baseline-known-subtotal" || binding.parameterUnit !== "USD" || binding.resultUnit !== "USD" || binding.unit !== "USD" || binding.engineVersion !== "planner-runtime-v1" || !plannerDirectUsdParameter(binding.scenario, request.parameterBounds.parameterRef, binding.parameterOperation)) return unsupported()
  if ([input.source, input.baseline].some((scenario) => scenario.currency !== binding.resultUnit || scenario.knownSubtotal === null || !Number.isFinite(scenario.knownSubtotal) || ["incompatible", "unavailable"].includes(scenario.comparisonStatus)) || digestSfValue(input.source.horizon) !== digestSfValue(input.baseline.horizon)) return unsupported()
  if (!certificate.evidenceRefs.length || new Set(certificate.evidenceRefs.map((ref) => ref.refDigest)).size !== certificate.evidenceRefs.length || certificate.evidenceRefs.some((ref) => ref.refDigest !== digestSfEvidenceRef(ref) || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId) || !binding.evidenceRefs.some((ref) => ref.refId === binding.unitMetadataRef && certificate.evidenceRefs.some((proof) => digestSfValue(proof) === digestSfValue(ref)))) return unsupported()
  const rejected = adjacent(value, request.criterion.operator === "lte" ? 1 : -1)
  if (!Number.isFinite(rejected) || rejected < request.parameterBounds.minimum || rejected > request.parameterBounds.maximum) return unsupported()
  const preview = async (parameter: number) => structuredClone(await input.preview({ baselineRef: binding.baselineRef, scenario: plannerSensitivityScenario(binding, request.parameterBounds.parameterRef, parameter) }, context))
  const included = await preview(value)
  if (included.status !== "ok") return included
  const excluded = await preview(rejected)
  if (excluded.status !== "ok") return excluded
  const valid = (observation: typeof included.value, parameter: number) => observation.comparison.baselineResultRef === binding.baselineRef && observation.comparison.alternativeResultRef === observation.sample.id && observation.comparison.comparisonStatus === "conditioned" && observation.comparison.completeDifference === null && digestSfValue(observation.comparison.costCoverageRefs) === digestSfValue([binding.baselineCoverageRef]) && observation.metric.metricRef === "planner:known-subtotal-difference" && observation.metric.state === "conditioned" && observation.metric.engineVersion === binding.engineVersion && observation.metric.unit === binding.resultUnit && observation.metric.value !== null && Number.isFinite(observation.metric.value) && observation.metric.value === observation.comparison.knownDifference && digestSfValue(observation.metric.period) === digestSfValue(input.source.horizon) && observation.metric.evidenceRefs.length > 0 && observation.metric.evidenceRefs.every((ref) => certificate.evidenceRefs.some((proof) => digestSfValue(proof) === digestSfValue(ref))) && exactComponents(observation.sample, request.parameterBounds.parameterRef, parameter)
  const fixed = (scenario: ScenarioResult) => plannerComponentDigest(scenario.components.filter((component) => component.id !== request.parameterBounds.parameterRef))
  if (!valid(included.value, value) || !valid(excluded.value, rejected) || fixed(included.value.sample) !== fixed(excluded.value.sample) || digestSfValue(included.value.sample.components.map((component) => component.id)) !== digestSfValue(excluded.value.sample.components.map((component) => component.id))) return unsupported()
  const meets = (metric: number) => request.criterion.operator === "lte" ? metric <= request.criterion.value : metric >= request.criterion.value
  if (!meets(included.value.metric.value!) || meets(excluded.value.metric.value!)) return unsupported()
  return { status: "ok", value: { value, evidenceRefs: certificate.evidenceRefs, scope: "known-subtotal" } }
}

export function plannerSensitivityScenario(binding: Pick<PlannerSensitivityBinding, "scenario" | "parameterOperation">, target: string, value: number): ScenarioRequest {
  const source = structuredClone(binding.scenario)
  const operations = source.operations.length ? source.operations : binding.parameterOperation ? [structuredClone(binding.parameterOperation)] : []
  return { ...source, operations: operations.map((operation) => operation.targetRef === target ? { ...operation, amount: value } : operation) }
}

function adjacent(value: number, direction: 1 | -1) {
  if (value === 0) return direction === 1 ? Number.MIN_VALUE : -Number.MIN_VALUE
  const bits = new DataView(new ArrayBuffer(8))
  bits.setFloat64(0, value)
  const change = (value > 0 ? direction : -direction) === 1 ? 1n : -1n
  bits.setBigUint64(0, bits.getBigUint64(0) + change)
  return bits.getFloat64(0)
}
