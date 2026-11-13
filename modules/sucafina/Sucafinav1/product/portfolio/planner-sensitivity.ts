import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ScenarioComparison, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest, SensitivityRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import { plannerPreviewDigest, plannerScenarioDigest } from "../planner/preview-comparison.ts"
import { createSensitivityEvaluator } from "./sensitivity.ts"
import { attachSensitivityV6 } from "./sensitivity-v6.ts"

export type PlannerSensitivityBinding = {
  caseRef: { id: string; incarnation: string; version: number }
  scenario: ScenarioRequest
  baselineRef: string
  criterionId: string
  metric: "alternative-minus-baseline-known-subtotal"
  parameterUnit: string
  resultUnit: string
  unit: string
  unitMetadataRef: string
  unitMetadataVersion: number
  engineVersion: string
  evidenceRefs: readonly BusinessEvidenceRef[]
}

/** Sample the Planner preview and store its actual results; metadata is resolved by the authorized host. */
export function createPlannerSensitivity(input: {
  results: ReturnType<typeof createSfDecisionResultStore> & { readHistoricalScenario?: (request: { resultRef: string }, context: TrustedDomainContext) => ReturnType<ReturnType<typeof createSfDecisionResultStore>["read"]> }
  resolve: (request: SensitivityRequest, context: TrustedDomainContext) => Promise<PortResult<PlannerSensitivityBinding>>
  revalidate: (binding: PlannerSensitivityBinding, context: TrustedDomainContext) => Promise<boolean>
  preview: (request: { baselineRef: string; scenario: ScenarioRequest }, context: TrustedDomainContext) => Promise<PortResult<{ sample: ScenarioResult; comparison: ScenarioComparison; metric: { metricRef: "planner:known-subtotal-difference"; value: number | null; unit: string; period: ScenarioResult["horizon"]; evidenceRefs: readonly BusinessEvidenceRef[]; state: "conditioned"; engineVersion: string } }>>
  idempotencyKey: (requestDigest: string, context: TrustedDomainContext) => Promise<string | undefined>
}) {
  return async (request: SensitivityRequest, context: TrustedDomainContext) => {
    const resolved = await input.resolve(request, context)
    if (resolved.status !== "ok") return resolved
    const binding = structuredClone(resolved.value)
    if (binding.metric !== "alternative-minus-baseline-known-subtotal" || binding.criterionId !== request.criterion.id || !binding.parameterUnit.trim() || !binding.resultUnit.trim() || !binding.unit.trim() || !binding.unitMetadataRef.trim() || !Number.isSafeInteger(binding.unitMetadataVersion) || binding.unitMetadataVersion < 1 || !binding.engineVersion.trim() || !binding.evidenceRefs.some((ref) => ref.refId === binding.unitMetadataRef) || !await input.revalidate(binding, context)) return { status: "unavailable", reason: "sensitivity-metadata-unavailable" } as const
    const readScenario = (resultRef: string, trusted: TrustedDomainContext) => input.results.readHistoricalScenario ? input.results.readHistoricalScenario({ resultRef }, trusted) : input.results.read({ kind: "scenario", resultRef }, trusted)
    const source = await readScenario(request.scenarioRef, context)
    if (source.status !== "ok") return source
    const baseline = await readScenario(binding.baselineRef, context)
    if (baseline.status !== "ok") return baseline
    if (source.value.kind !== "scenario" || baseline.value.kind !== "scenario" || source.value.requestDigest !== digestSfValue(binding.scenario) || [source.value.caseRef, baseline.value.caseRef].some((ref) => ref.id !== binding.caseRef.id || ref.incarnation !== binding.caseRef.incarnation || ref.version > binding.caseRef.version)) return { status: "stale", reason: "sensitivity-scenario-changed" } as const
    const operations = binding.scenario.operations.filter((operation) => operation.targetRef === request.parameterBounds.parameterRef)
    if (operations.length !== 1 || operations[0].kind !== "replace" || operations[0].replacementRef !== undefined || typeof operations[0].amount !== "number" || !Number.isFinite(operations[0].amount)) return { status: "needs-input", reason: "unsupported-sensitivity-parameter" } as const
    const key = await input.idempotencyKey(digestSfValue(request), context)
    if (!key?.trim()) return { status: "denied", reason: "operation-identity-unavailable" } as const
    const samples: { request: ScenarioRequest; resultRef: string; digest: string; coverageRefs: readonly string[]; conditions: readonly string[] }[] = []
    const evaluate = createSensitivityEvaluator({
      sample: async (_request, value, trusted) => {
        const scenario = { ...binding.scenario, operations: binding.scenario.operations.map((operation) => operation.targetRef === request.parameterBounds.parameterRef ? { ...operation, amount: value } : operation) }
        const preview = await input.preview({ baselineRef: binding.baselineRef, scenario }, trusted)
        if (preview.status !== "ok") return preview
        if (preview.value.comparison.baselineResultRef !== binding.baselineRef || preview.value.comparison.alternativeResultRef !== preview.value.sample.id || !preview.value.comparison.costCoverageRefs.length || preview.value.comparison.comparisonStatus === "incompatible" || preview.value.comparison.comparisonStatus === "unavailable") return { status: "unavailable", reason: "sensitivity-comparison-unavailable" }
        if (preview.value.metric.metricRef !== "planner:known-subtotal-difference" || preview.value.metric.state !== "conditioned" || preview.value.metric.value !== preview.value.comparison.knownDifference || preview.value.metric.unit !== binding.resultUnit || preview.value.metric.engineVersion !== binding.engineVersion || digestSfValue(preview.value.metric.period) !== digestSfValue(preview.value.sample.horizon) || !preview.value.metric.evidenceRefs.length) return { status: "unavailable", reason: "sensitivity-metric-mismatch" }
        const requestDigest = digestSfValue(scenario)
        const refs = [...preview.value.sample.sourceRefs, ...baseline.value.sourceRefs, ...source.value.sourceRefs, ...preview.value.metric.evidenceRefs, ...binding.evidenceRefs].filter((ref, index, all) => all.findIndex((item) => item.refDigest === ref.refDigest) === index)
        const saved = await input.results.write({ kind: "scenario", result: preview.value.sample, caseRef: binding.caseRef, requestDigest, sourceRefs: refs, idempotencyKey: `sensitivity:${key}:${requestDigest}` }, trusted)
        if (saved.status !== "ok") return saved
        if (saved.value.kind !== "scenario" || plannerScenarioDigest(saved.value.result) !== plannerScenarioDigest(preview.value.sample)) return { status: "stale", reason: "sensitivity-sample-changed" }
        samples.push({ request: scenario, resultRef: saved.value.resultRef, digest: plannerPreviewDigest(preview.value), coverageRefs: preview.value.comparison.costCoverageRefs, conditions: preview.value.comparison.unresolvedConditions })
        return { status: "ok", value: { resultRef: saved.value.resultRef, scenario: saved.value.result, criterionValue: preview.value.comparison.knownDifference, parameterUnit: binding.parameterUnit, resultUnit: binding.resultUnit, unitMetadataRef: binding.unitMetadataRef, unitMetadataVersion: binding.unitMetadataVersion } }
      },
      exactThreshold: async () => ({ status: "unavailable", reason: "exact-threshold-not-proven" }),
      revalidate: async (_samples, _threshold, trusted) => {
        const latest = await input.resolve(request, trusted)
        if (latest.status !== "ok" || digestSfValue(latest.value) !== digestSfValue(binding) || !await input.revalidate(binding, trusted)) return false
        const currentSource = await readScenario(request.scenarioRef, trusted)
        const currentBaseline = await readScenario(binding.baselineRef, trusted)
        if (currentSource.status !== "ok" || currentBaseline.status !== "ok" || digestSfValue(currentSource.value) !== digestSfValue(source.value) || digestSfValue(currentBaseline.value) !== digestSfValue(baseline.value)) return false
        const checked = await Promise.all(samples.map(async (sample) => {
          const stored = await input.results.read({ kind: "scenario", resultRef: sample.resultRef }, trusted)
          const current = await input.preview({ baselineRef: binding.baselineRef, scenario: sample.request }, trusted)
          return stored.status === "ok" && stored.value.kind === "scenario" && current.status === "ok" && plannerPreviewDigest(current.value) === sample.digest && plannerScenarioDigest(stored.value.result) === plannerScenarioDigest(current.value.sample)
        }))
        return checked.every(Boolean) && await input.revalidate(binding, trusted)
      },
    })
    const evaluated = await evaluate(request, context)
    if (evaluated.status !== "ok") return evaluated
    const meets = (value: number) => request.criterion.operator === "lte" ? value <= request.criterion.value : request.criterion.operator === "gte" ? value >= request.criterion.value : value === request.criterion.value
    const points = evaluated.value.evaluated
    const transitions = points.flatMap((point, index) => index > 0 && point.value !== null && points[index - 1].value !== null && meets(point.value) !== meets(points[index - 1].value!) ? [index] : [])
    const transition = transitions.length === 1 && points.every((point) => point.value !== null) ? transitions[0] : undefined
    const thresholdEvidence = transition === undefined ? { state: "unavailable" as const, reason: transitions.length > 1 ? "multiple-sampled-transitions" : points.some((point) => point.value === null) ? "sample-value-unavailable" : "no-sampled-transition" } : { state: "sampled" as const, interval: { minimum: points[transition - 1].parameterValue, maximum: points[transition].parameterValue }, evidenceRefs: [...binding.evidenceRefs, ...baseline.value.sourceRefs, ...evaluated.value.evidenceRefs] }
    return attachSensitivityV6({ result: { ...evaluated.value, comparisonStatus: "conditioned", unresolvedConditions: [...evaluated.value.unresolvedConditions, ...samples.flatMap((sample) => sample.conditions.map((reason) => ({ id: `${sample.resultRef}:${reason}`, category: "coverage", reason, evidenceRefs: baseline.value.sourceRefs }))), { id: "preview-coverage", category: "coverage", reason: "The sampled transition concerns known subtotal differences only; unresolved coverage can change the decision.", evidenceRefs: baseline.value.sourceRefs }], evidenceRefs: [...evaluated.value.evidenceRefs, ...binding.evidenceRefs, ...baseline.value.sourceRefs] }, costCoverageRefs: [...new Set(samples.flatMap((sample) => sample.coverageRefs))], unit: binding.unit, engineVersion: binding.engineVersion, thresholdEvidence })
  }
}
