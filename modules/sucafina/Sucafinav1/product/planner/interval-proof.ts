import { digestSfValue } from "../contracts/canonical.ts"
import type { SensitivityRequest } from "../contracts/operations.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { plannerComponentDigest } from "./comparison.ts"
import { exactComponents, plannerDirectUsdParameter } from "./exact-threshold.ts"
import type { comparePlannerPreview } from "./preview-comparison.ts"
import type { createPlannerSensitivityUnits } from "./sensitivity-units.ts"

/** Private structural proof, not a C10 coverage assessment or a complete decision. */
export function createPlannerIntervalProof(input: { units: ReturnType<typeof createPlannerSensitivityUnits>; preview: (request: Parameters<typeof comparePlannerPreview>[1], context: TrustedDomainContext) => ReturnType<typeof comparePlannerPreview> }) {
  return async (incoming: SensitivityRequest, baselineRef: string, context: TrustedDomainContext) => {
    const request = structuredClone(incoming)
    const bounds = request.parameterBounds
    if (!Number.isFinite(bounds.minimum) || !Number.isFinite(bounds.maximum) || bounds.minimum >= bounds.maximum) return { status: "unavailable", reason: "interval-domain-unproven" } as const
    const issued = structuredClone(await input.units.issue({ scenarioRef: request.scenarioRef, baselineRef, parameterRef: bounds.parameterRef }, context))
    if (issued.status !== "ok") return issued
    const scenario = issued.value.scenario
    const operation = plannerDirectUsdParameter(scenario, bounds.parameterRef)
    if (!issued.value.units.sourceRefs.length || issued.value.units.engineVersion !== "planner-runtime-v1" || issued.value.units.parameterUnit !== "USD" || issued.value.units.resultUnit !== "USD" || !operation) return { status: "unavailable", reason: "interval-domain-unproven" } as const
    const evaluate = (amount: number) => input.preview(structuredClone({ baselineRef, scenario: { ...scenario, operations: scenario.operations.map((item) => item.targetRef === operation.targetRef ? { ...item, amount } : item) } }), context)
    const lower = structuredClone(await evaluate(bounds.minimum))
    const upper = structuredClone(await evaluate(bounds.maximum))
    if (lower.status !== "ok") return lower
    if (upper.status !== "ok") return upper
    const fixed = (sample: typeof lower.value.sample) => plannerComponentDigest(sample.components.filter((component) => component.id !== bounds.parameterRef))
    if (!exactComponents(lower.value.sample, bounds.parameterRef, bounds.minimum) || !exactComponents(upper.value.sample, bounds.parameterRef, bounds.maximum) || lower.value.metric.engineVersion !== issued.value.units.engineVersion || upper.value.metric.engineVersion !== issued.value.units.engineVersion || lower.value.metric.unit !== "USD" || upper.value.metric.unit !== "USD" || lower.value.metric.value === null || upper.value.metric.value === null || !Number.isFinite(lower.value.metric.value) || !Number.isFinite(upper.value.metric.value) || digestSfValue(lower.value.sample.components.map((component) => component.id)) !== digestSfValue(upper.value.sample.components.map((component) => component.id)) || fixed(lower.value.sample) !== fixed(upper.value.sample) || digestSfValue(lower.value.metric.period) !== digestSfValue(upper.value.metric.period)) return { status: "unavailable", reason: "interval-domain-unproven" } as const
    const again = await input.units.issue({ scenarioRef: request.scenarioRef, baselineRef, parameterRef: bounds.parameterRef }, context)
    if (again.status !== "ok" || again.value.metadataDigest !== issued.value.metadataDigest || digestSfValue(again.value.scenario) !== digestSfValue(scenario)) return { status: "stale", reason: "interval-source-changed" } as const
    const refs = [...issued.value.units.sourceRefs, ...lower.value.metric.evidenceRefs, ...upper.value.metric.evidenceRefs]
    return { status: "ok", value: { kind: "planner-direct-usd-v1" as const, baselineRef, scenarioRef: request.scenarioRef, scenarioDigest: digestSfValue(scenario), metadataDigest: issued.value.metadataDigest, engineVersion: issued.value.units.engineVersion, parameterRef: bounds.parameterRef, minimum: bounds.minimum, maximum: bounds.maximum, period: lower.value.metric.period, unit: "USD" as const, componentIds: lower.value.sample.components.map((component) => component.id), fixedComponentsDigest: fixed(lower.value.sample), sourceRefs: refs.filter((ref, index) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index) } } as const
  }
}
