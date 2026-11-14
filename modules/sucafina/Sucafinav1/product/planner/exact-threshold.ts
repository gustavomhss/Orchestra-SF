import { outlookMonth, plannerKnownSubtotal, plannerMonthlyAmount, usdAmount } from "../../src/planner-accounts.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ScenarioResult } from "../contracts/decisions.ts"
import type { SensitivityRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { plannerComponentDigest } from "./comparison.ts"
import type { comparePlannerPreview } from "./preview-comparison.ts"
import type { createPlannerSensitivityUnits } from "./sensitivity-units.ts"

/** For an open non-HR USD month, the shared save, outlook and conversion primitives preserve the input. Ordered IEEE additions of fixed finite components and subtraction of a fixed baseline are monotone, including plateaus. */
export function createPlannerExactThreshold(input: { units: ReturnType<typeof createPlannerSensitivityUnits>; preview: (request: Parameters<typeof comparePlannerPreview>[1], context: TrustedDomainContext) => ReturnType<typeof comparePlannerPreview> }) {
  return async (request: SensitivityRequest, baselineRef: string, context: TrustedDomainContext): Promise<PortResult<{ value: number; evidenceRefs: readonly BusinessEvidenceRef[] }>> => {
    const bounds = request.parameterBounds
    if (!Number.isFinite(bounds.minimum) || !Number.isFinite(bounds.maximum) || bounds.minimum >= bounds.maximum || !Number.isFinite(request.criterion.value) || !["gte", "lte"].includes(request.criterion.operator)) return { status: "unavailable", reason: "exact-threshold-domain-unproven" }
    const issued = await input.units.issue({ scenarioRef: request.scenarioRef, baselineRef, parameterRef: bounds.parameterRef }, context)
    if (issued.status !== "ok") return issued
    const scenario = issued.value.scenario
    const operation = scenario.operations[0]
    if (!issued.value.units.sourceRefs.length || issued.value.units.engineVersion !== "planner-runtime-v1" || issued.value.units.parameterUnit !== "USD" || issued.value.units.resultUnit !== "USD" || scenario.assumptions.length || scenario.operations.length !== 1 || !operation || operation.kind !== "replace" || operation.targetRef !== bounds.parameterRef || operation.targetRef.startsWith("HR:") || operation.currency !== "USD" || operation.replacementRef !== undefined) return { status: "unavailable", reason: "exact-threshold-domain-unproven" }
    const evaluate = (amount: number) => input.preview({ baselineRef, scenario: { ...scenario, operations: [{ ...operation, amount }] } }, context)
    const [lower, upper] = await Promise.all([evaluate(bounds.minimum), evaluate(bounds.maximum)])
    if (lower.status !== "ok") return lower
    if (upper.status !== "ok") return upper
    const left = lower.value
    const right = upper.value
    if (!exactComponents(left.sample, bounds.parameterRef, bounds.minimum) || !exactComponents(right.sample, bounds.parameterRef, bounds.maximum) || left.metric.engineVersion !== issued.value.units.engineVersion || right.metric.engineVersion !== issued.value.units.engineVersion || left.metric.unit !== "USD" || right.metric.unit !== "USD" || left.metric.value === null || right.metric.value === null || !Number.isFinite(left.metric.value) || !Number.isFinite(right.metric.value) || digestSfValue(left.sample.components.map((component) => component.id)) !== digestSfValue(right.sample.components.map((component) => component.id)) || plannerComponentDigest(left.sample.components.filter((component) => component.id !== bounds.parameterRef)) !== plannerComponentDigest(right.sample.components.filter((component) => component.id !== bounds.parameterRef))) return { status: "unavailable", reason: "exact-threshold-domain-unproven" }
    const satisfies = (value: number) => request.criterion.operator === "gte" ? value >= request.criterion.value : value <= request.criterion.value
    const lowerState = satisfies(left.metric.value)
    const upperState = satisfies(right.metric.value)
    if (lowerState === upperState || lowerState !== (request.criterion.operator === "lte")) return { status: "unavailable", reason: "exact-threshold-not-bracketed" }
    let low = ordered(bounds.minimum)
    let high = ordered(bounds.maximum)
    const anchor = Number.isFinite(bounds.minimum + (request.criterion.value - left.metric.value)) ? bounds.minimum + (request.criterion.value - left.metric.value) : bounds.minimum
    const candidate = Math.max(bounds.minimum, Math.min(bounds.maximum, anchor))
    const seed = ordered(candidate)
    const refs = [...issued.value.units.sourceRefs, ...left.metric.evidenceRefs, ...right.metric.evidenceRefs]
    const probe = async (key: bigint) => {
      const amount = fromOrdered(key)
      if (!Number.isFinite(amount) || plannerMonthlyAmount(amount) !== amount || usdAmount(amount, "USD", 1).usd !== amount || outlookMonth(0, 0, null, amount, 0) !== amount) return undefined
      const result = await evaluate(amount)
      if (result.status !== "ok" || result.value.metric.engineVersion !== issued.value.units.engineVersion || result.value.metric.unit !== "USD" || result.value.metric.value === null || !Number.isFinite(result.value.metric.value) || !exactComponents(result.value.sample, bounds.parameterRef, amount) || digestSfValue(result.value.sample.components.map((component) => component.id)) !== digestSfValue(left.sample.components.map((component) => component.id)) || plannerComponentDigest(result.value.sample.components.filter((component) => component.id !== bounds.parameterRef)) !== plannerComponentDigest(left.sample.components.filter((component) => component.id !== bounds.parameterRef))) return undefined
      refs.push(...result.value.metric.evidenceRefs)
      return satisfies(result.value.metric.value)
    }
    if (seed > low && seed < high) {
      const state = await probe(seed)
      if (state === undefined) return { status: "unavailable", reason: "exact-threshold-domain-unproven" }
      if (state === lowerState) low = seed
      else high = seed
    }
    while (high - low > 1n) {
      const middle = low + (high - low) / 2n
      const state = await probe(middle)
      if (state === undefined) return { status: "unavailable", reason: "exact-threshold-domain-unproven" }
      if (state === lowerState) low = middle
      else high = middle
    }
    const leftProof = await probe(low)
    const rightProof = await probe(high)
    if (leftProof !== lowerState || rightProof !== upperState) return { status: "unavailable", reason: "exact-threshold-certificate-unavailable" }
    const again = await input.units.issue({ scenarioRef: request.scenarioRef, baselineRef, parameterRef: bounds.parameterRef }, context)
    if (again.status !== "ok" || again.value.metadataDigest !== issued.value.metadataDigest) return { status: "stale", reason: "exact-threshold-source-changed" }
    return { status: "ok", value: { value: fromOrdered(request.criterion.operator === "gte" ? high : low), evidenceRefs: refs.filter((ref, index) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index) } }
  }
}

export function exactComponents(scenario: ScenarioResult, target: string, amount: number) {
  const targetComponents = scenario.components.filter((component) => component.id === target)
  if (targetComponents.length !== 1 || targetComponents[0]!.amount !== amount || scenario.knownSubtotal === null || !Number.isFinite(scenario.knownSubtotal)) return false
  if (scenario.components.some((component) => component.currency !== "USD" || component.amount === null || !Number.isFinite(component.amount) || component.evidenceState === "absent" || !component.sourceRefs.length)) return false
  return plannerKnownSubtotal(scenario.components.map((component) => component.amount)) === scenario.knownSubtotal
}

const sign = 1n << 63n
const mask = (1n << 64n) - 1n
function ordered(value: number) {
  const bytes = new DataView(new ArrayBuffer(8))
  bytes.setFloat64(0, value)
  const bits = bytes.getBigUint64(0)
  return bits & sign ? ~bits & mask : bits ^ sign
}
function fromOrdered(value: bigint) {
  const bytes = new DataView(new ArrayBuffer(8))
  bytes.setBigUint64(0, value & sign ? value ^ sign : ~value & mask)
  return bytes.getFloat64(0)
}
