import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ScenarioComparison, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest, SensitivityRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore, StoredDecisionResult } from "../decisions/result-store.ts"
import { plannerPreviewDigest, plannerScenarioDigest } from "../planner/preview-comparison.ts"
import { createSensitivityEvaluator, quantifiedSensitivityScenario } from "./sensitivity.ts"
import type { SensitivitySampledResult } from "./sensitivity.ts"
import { attachSensitivityV6 } from "./sensitivity-v6.ts"
import type { createPortfolioCoveragePreview, PortfolioCoverageQualification } from "./coverage-preview.ts"
import { plannerSensitivityScenario, validatePlannerThreshold } from "./threshold-proof.ts"
import type { KnownSubtotalThreshold } from "./threshold-proof.ts"

export { plannerSensitivityScenario } from "./threshold-proof.ts"

export type PlannerSensitivityBinding = {
  caseRef: { id: string; incarnation: string; version: number }
  scenario: ScenarioRequest
  parameterOperation?: ScenarioRequest["operations"][number]
  baselineRef: string
  baselineCoverageRef: string
  scenarioCoverageRef: string
  criterionId: string
  metric: "alternative-minus-baseline-known-subtotal"
  parameterUnit: string
  resultUnit: string
  unit: string
  unitMetadataRef: string
  unitMetadataVersion: number
  engineVersion: string
  evidenceRefs: readonly BusinessEvidenceRef[]
  sensitivityRequest: SensitivityRequest
  ruleRef: string
  ruleVersion: number
  ruleDigest: string
  metadataDigest: string
}

/** Sample the Planner preview and store its actual results; metadata is resolved by the authorized host. */
export function createPlannerSensitivity(input: {
  results: ReturnType<typeof createSfDecisionResultStore> & { readHistoricalScenario?: (request: { resultRef: string }, context: TrustedDomainContext) => ReturnType<ReturnType<typeof createSfDecisionResultStore>["read"]>; readByRequest?: (request: { caseRef: PlannerSensitivityBinding["caseRef"]; kind: "scenario"; idempotencyKey: string; requestDigest: string }, context: TrustedDomainContext) => Promise<PortResult<{ state: "found"; result: StoredDecisionResult } | { state: "not-found" }>> }
  resolve: (request: SensitivityRequest, context: TrustedDomainContext) => Promise<PortResult<PlannerSensitivityBinding>>
  revalidate: (binding: PlannerSensitivityBinding, context: TrustedDomainContext) => Promise<boolean>
  preview: (request: { baselineRef: string; scenario: ScenarioRequest }, context: TrustedDomainContext) => Promise<PortResult<{ sample: ScenarioResult; comparison: ScenarioComparison; metric: { metricRef: "planner:known-subtotal-difference"; value: number | null; unit: string; period: ScenarioResult["horizon"]; evidenceRefs: readonly BusinessEvidenceRef[]; state: "conditioned"; engineVersion: string } }>>
  exactThreshold?: (request: SensitivityRequest, binding: PlannerSensitivityBinding, context: TrustedDomainContext) => Promise<PortResult<{ value: number | null; evidenceRefs: readonly BusinessEvidenceRef[] }>>
  coveragePreview?: ReturnType<typeof createPortfolioCoveragePreview>
  idempotencyKey: (requestDigest: string, context: TrustedDomainContext) => Promise<string | undefined>
}) {
  return async (incoming: SensitivityRequest, context: TrustedDomainContext) => {
    const request = structuredClone(incoming)
    const resolved = await input.resolve(structuredClone(request), context)
    if (resolved.status !== "ok") return resolved
    const binding = structuredClone(resolved.value)
    if (digestSfValue(binding.sensitivityRequest) !== digestSfValue(request) || !binding.baselineCoverageRef.trim() || !binding.scenarioCoverageRef.trim() || !binding.ruleRef.trim() || !Number.isSafeInteger(binding.ruleVersion) || binding.ruleVersion < 1 || !/^[a-f0-9]{64}$/.test(binding.ruleDigest) || !/^[a-f0-9]{64}$/.test(binding.metadataDigest) || binding.metric !== "alternative-minus-baseline-known-subtotal" || binding.criterionId !== request.criterion.id || !binding.parameterUnit.trim() || !binding.resultUnit.trim() || !binding.unit.trim() || !binding.unitMetadataRef.trim() || !Number.isSafeInteger(binding.unitMetadataVersion) || binding.unitMetadataVersion < 1 || !binding.engineVersion.trim() || !binding.evidenceRefs.some((ref) => ref.refId === binding.unitMetadataRef) || !await input.revalidate(structuredClone(binding), context)) return { status: "unavailable", reason: "sensitivity-metadata-unavailable" } as const
    const readScenario = (resultRef: string, trusted: TrustedDomainContext) => input.results.readHistoricalScenario ? input.results.readHistoricalScenario({ resultRef }, trusted) : input.results.read({ kind: "scenario", resultRef }, trusted)
    const source = structuredClone(await readScenario(request.scenarioRef, context))
    if (source.status !== "ok") return source
    const baseline = structuredClone(await readScenario(binding.baselineRef, context))
    if (baseline.status !== "ok") return baseline
    if (source.value.kind !== "scenario" || baseline.value.kind !== "scenario" || source.value.resultRef !== request.scenarioRef || baseline.value.resultRef !== binding.baselineRef || source.value.resultDigest !== digestSfValue(source.value.result) || baseline.value.resultDigest !== digestSfValue(baseline.value.result) || source.value.requestDigest !== digestSfValue(binding.scenario) || [source.value.caseRef, baseline.value.caseRef].some((ref) => ref.id !== binding.caseRef.id || ref.incarnation !== binding.caseRef.incarnation || ref.version > binding.caseRef.version)) return { status: "stale", reason: "sensitivity-scenario-changed" } as const
    const sourceScenario = source.value.result
    const baselineScenario = baseline.value.result
    const operations = binding.scenario.operations.length ? binding.scenario.operations.filter((operation) => operation.targetRef === request.parameterBounds.parameterRef) : binding.parameterOperation ? [binding.parameterOperation] : []
    if (binding.parameterOperation && (binding.scenario.operations.length || binding.scenario.assumptions.length || binding.parameterOperation.targetRef !== request.parameterBounds.parameterRef || binding.parameterOperation.currency !== "USD" || !sourceScenario.id.startsWith("source-scenario:") || !sourceScenario.components.some((component) => component.id === binding.parameterOperation!.targetRef && component.evidenceState === "confirmed" && component.amount === binding.parameterOperation!.amount && component.currency === binding.parameterOperation!.currency && digestSfValue(component.period) === digestSfValue(binding.parameterOperation!.period)))) return { status: "unavailable", reason: "sensitivity-source-parameter-unproven" } as const
    if (operations.length !== 1 || operations[0].kind !== "replace" || operations[0].replacementRef !== undefined || typeof operations[0].amount !== "number" || !Number.isFinite(operations[0].amount)) return { status: "needs-input", reason: "unsupported-sensitivity-parameter" } as const
    const key = await input.idempotencyKey(digestSfValue(request), context)
    if (!key?.trim()) return { status: "denied", reason: "operation-identity-unavailable" } as const
    const interval = input.coveragePreview ? structuredClone(await input.coveragePreview.issue(structuredClone(request), binding.baselineRef, context)) : undefined
    if (interval && interval.status !== "ok" && interval.status !== "unavailable") return interval
    const samples: { request: ScenarioRequest; resultRef: string; digest: string; coverageRefs: readonly string[]; conditions: readonly string[]; complete: boolean; qualification?: PortfolioCoverageQualification }[] = []
    const exactEvidence: { value?: KnownSubtotalThreshold } = {}
    const certify = (certificate: { value: number | null; evidenceRefs: readonly BusinessEvidenceRef[] }, trusted: TrustedDomainContext) => validatePlannerThreshold({ request, binding, source: sourceScenario, baseline: baselineScenario, certificate, preview: input.preview, context: trusted })
    const evaluate = createSensitivityEvaluator({
      sample: async (_request, value, trusted) => {
        const scenario = plannerSensitivityScenario(binding, request.parameterBounds.parameterRef, value)
        const preview = structuredClone(await input.preview({ baselineRef: binding.baselineRef, scenario: structuredClone(scenario) }, trusted))
        if (preview.status !== "ok") return preview
        if (preview.value.comparison.baselineResultRef !== binding.baselineRef || preview.value.comparison.alternativeResultRef !== preview.value.sample.id || digestSfValue(preview.value.comparison.costCoverageRefs) !== digestSfValue([binding.baselineCoverageRef]) || preview.value.comparison.comparisonStatus === "incompatible" || preview.value.comparison.comparisonStatus === "unavailable") return { status: "unavailable", reason: "sensitivity-comparison-unavailable" }
        if (preview.value.metric.metricRef !== "planner:known-subtotal-difference" || preview.value.metric.state !== "conditioned" || preview.value.metric.value !== preview.value.comparison.knownDifference || preview.value.metric.unit !== binding.resultUnit || preview.value.metric.engineVersion !== binding.engineVersion || digestSfValue(preview.value.metric.period) !== digestSfValue(preview.value.sample.horizon) || !preview.value.metric.evidenceRefs.length) return { status: "unavailable", reason: "sensitivity-metric-mismatch" }
        const qualified = interval?.status === "ok" && input.coveragePreview ? structuredClone(await input.coveragePreview.qualify(interval.value.intervalRef, value, preview.value, trusted)) : undefined
        if (qualified && qualified.status !== "ok") return qualified
        const qualification = qualified?.status === "ok" ? qualified.value : undefined
        const requestDigest = digestSfValue(scenario)
        const refs = [...preview.value.sample.sourceRefs, ...baseline.value.sourceRefs, ...source.value.sourceRefs, ...preview.value.metric.evidenceRefs, ...binding.evidenceRefs].filter((ref, index, all) => all.findIndex((item) => item.refDigest === ref.refDigest) === index)
        const idempotencyKey = `sensitivity:${key}:${requestDigest}`
        const existing = input.results.readByRequest ? await input.results.readByRequest({ caseRef: binding.caseRef, kind: "scenario", idempotencyKey, requestDigest }, trusted) : undefined
        if (existing && existing.status !== "ok") return existing
        const saved = structuredClone(existing?.status === "ok" && existing.value.state === "found" ? { status: "ok" as const, value: existing.value.result } : await input.results.write({ kind: "scenario", result: structuredClone(preview.value.sample), caseRef: structuredClone(binding.caseRef), requestDigest, sourceRefs: structuredClone(refs), idempotencyKey }, trusted))
        if (saved.status !== "ok") return saved
        if (saved.value.kind !== "scenario" || saved.value.requestDigest !== requestDigest || digestSfValue(saved.value.caseRef) !== digestSfValue(binding.caseRef) || plannerScenarioDigest(saved.value.result) !== plannerScenarioDigest(preview.value.sample)) return { status: "stale", reason: "sensitivity-sample-changed" }
        samples.push({ request: scenario, resultRef: saved.value.resultRef, digest: plannerPreviewDigest(preview.value), coverageRefs: preview.value.comparison.costCoverageRefs, conditions: qualification ? preview.value.comparison.unresolvedConditions.filter((condition) => ![...qualification.resolvedCoverageConditions, ...qualification.hypotheticalConditions].includes(condition)) : preview.value.comparison.unresolvedConditions, complete: !!qualification || (preview.value.comparison.comparisonStatus === "complete" && preview.value.sample.costCoverage.coverageState === "complete"), qualification })
        return { status: "ok", value: { resultRef: saved.value.resultRef, scenario: saved.value.result, criterionValue: preview.value.comparison.knownDifference, parameterUnit: binding.parameterUnit, resultUnit: binding.resultUnit, unitMetadataRef: binding.unitMetadataRef, unitMetadataVersion: binding.unitMetadataVersion, ...(qualification ? { coverageQualification: qualification } : {}) } }
      },
      exactThreshold: async (_request, trusted) => {
        if (!input.exactThreshold || !quantifiedSensitivityScenario(sourceScenario) || !quantifiedSensitivityScenario(baselineScenario)) return { status: "unavailable", reason: "exact-threshold-not-proven" }
        const result = structuredClone(await input.exactThreshold(structuredClone(request), structuredClone(binding), trusted))
        if (result.status !== "ok") return result
        const certificate = await certify(result.value, trusted)
        if (certificate.status === "ok") exactEvidence.value = certificate.value
        return certificate
      },
      revalidate: async (_samples, _threshold, trusted) => {
        const latest = structuredClone(await input.resolve(structuredClone(request), trusted))
        if (latest.status !== "ok" || digestSfValue(latest.value) !== digestSfValue(binding) || !await input.revalidate(structuredClone(binding), trusted)) return false
        const currentSource = structuredClone(await readScenario(request.scenarioRef, trusted))
        const currentBaseline = structuredClone(await readScenario(binding.baselineRef, trusted))
        if (currentSource.status !== "ok" || currentBaseline.status !== "ok" || digestSfValue(currentSource.value) !== digestSfValue(source.value) || digestSfValue(currentBaseline.value) !== digestSfValue(baseline.value)) return false
        const checked = await Promise.all(samples.map(async (sample) => {
          const stored = structuredClone(await input.results.read({ kind: "scenario", resultRef: sample.resultRef }, trusted))
          const current = structuredClone(await input.preview({ baselineRef: binding.baselineRef, scenario: structuredClone(sample.request) }, trusted))
          return stored.status === "ok" && stored.value.kind === "scenario" && current.status === "ok" && plannerPreviewDigest(current.value) === sample.digest && plannerScenarioDigest(stored.value.result) === plannerScenarioDigest(current.value.sample)
        }))
        if (!checked.every(Boolean) || !await input.revalidate(structuredClone(binding), trusted)) return false
        if (interval?.status === "ok" && (!input.coveragePreview || !await input.coveragePreview.revalidate(interval.value.intervalRef, trusted))) return false
        if (!exactEvidence.value) return true
        // The domain search already established the admitted monotone interval.
        // Reproduce its boundary and adjacent rejected input with fresh previews;
        // searching for the same boundary again adds work, not a new observation.
        const certificate = await certify(structuredClone(exactEvidence.value), trusted)
        return certificate.status === "ok" && digestSfValue(certificate.value) === digestSfValue(exactEvidence.value) && await input.revalidate(structuredClone(binding), trusted)
      },
      verifyCoverageQualification: input.coveragePreview?.verify,
    })
    const evaluated = await evaluate(request, context)
    if (evaluated.status !== "ok") return evaluated
    return finalizePlannerSensitivity({ request, binding, result: evaluated.value, samples, baselineRefs: baseline.value.sourceRefs, exact: exactEvidence.value, originalScenarios: evaluated.value.comparisonStatus === "complete" ? [] : [{ resultRef: request.scenarioRef, scenario: sourceScenario, coverageRef: binding.scenarioCoverageRef }, { resultRef: binding.baselineRef, scenario: baselineScenario, coverageRef: binding.baselineCoverageRef }] })
  }
}

export type SensitivityDisclosureFormat = "bundle-v1" | "pr37-v1" | "intelligence-v1" | "union-v1"

/** Attach the same threshold and disclosure semantics to calculated or read-only reproduced samples. */
export function finalizePlannerSensitivity(input: {
  request: SensitivityRequest
  binding: PlannerSensitivityBinding
  result: SensitivitySampledResult
  samples: readonly { resultRef: string; coverageRefs: readonly string[]; conditions: readonly string[] }[]
  baselineRefs: readonly BusinessEvidenceRef[]
  exact?: { value: number | null; evidenceRefs: readonly BusinessEvidenceRef[] }
  originalScenarios?: readonly { resultRef: string; scenario: ScenarioResult; coverageRef: string }[]
  /** Reconstruct an authenticated historical serialization; all proofs are still rebuilt. */
  disclosureFormat?: SensitivityDisclosureFormat
}) {
  const meets = (value: number) => input.request.criterion.operator === "lte" ? value <= input.request.criterion.value : input.request.criterion.operator === "gte" ? value >= input.request.criterion.value : value === input.request.criterion.value
  const points = input.result.evaluated
  const transitions = points.flatMap((point, index) => index > 0 && point.value !== null && points[index - 1].value !== null && meets(point.value) !== meets(points[index - 1].value!) ? [index] : [])
  const transition = transitions.length === 1 && points.every((point) => point.value !== null) ? transitions[0] : undefined
  const complete = input.result.comparisonStatus === "complete" && input.result.unresolvedConditions.every((condition) => condition.category === "hypothesis") && input.samples.every((sample) => !sample.conditions.length)
  const comparable = input.result.comparisonStatus === "complete" || input.result.comparisonStatus === "conditioned"
  const exact = comparable && input.result.threshold !== null && input.exact?.value === input.result.threshold && input.exact.evidenceRefs.length > 0
  const format = input.disclosureFormat ?? "union-v1"
  const observations = format === "intelligence-v1" || format === "union-v1"
    ? [...input.samples, ...(input.originalScenarios ?? []).map(({ resultRef, scenario, coverageRef }) => ({ resultRef, coverageRefs: [coverageRef], conditions: [...scenario.unresolvedConditions, ...scenario.costCoverage.issues, ...(scenario.costCoverage.coverageState === "complete" ? [] : [`coverage:${scenario.costCoverage.coverageState}`]), ...scenario.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [`${entry.categoryId}:${entry.reason}`] : []), ...scenario.costCoverage.derivedMissingCategoryIds.map((category) => `missing-category:${category}`)] }))]
    : input.samples
  const thresholdRefs = [...input.result.evidenceRefs, ...input.binding.evidenceRefs, ...input.baselineRefs, ...(input.exact?.evidenceRefs ?? [])].filter((ref, index, refs) => refs.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
  // Older evidence order is reproduced from fresh domain inputs, never from the
  // saved result. Numeric precision and current completeness guards stay unchanged.
  const exactRefs = format === "intelligence-v1" ? input.exact?.evidenceRefs ?? [] : thresholdRefs
  const sampledRefs = format === "intelligence-v1" ? [...input.binding.evidenceRefs, ...input.baselineRefs, ...input.result.evidenceRefs] : thresholdRefs
  const thresholdEvidence = exact && input.exact && input.result.threshold !== null ? { state: "exact" as const, value: input.result.threshold, evidenceRefs: exactRefs } : transition === undefined ? { state: "unavailable" as const, reason: transitions.length > 1 ? "multiple-sampled-transitions" : points.some((point) => point.value === null) ? "sample-value-unavailable" : "no-sampled-transition" } : { state: "sampled" as const, interval: { minimum: points[transition - 1].parameterValue, maximum: points[transition].parameterValue }, evidenceRefs: sampledRefs }
  const disclosed = [...input.result.unresolvedConditions]
  if (exact && input.result.threshold !== null && input.result.comparisonStatus === "conditioned" && (format === "pr37-v1" || format === "union-v1")) disclosed.push({
    id: "known-components-threshold", category: "coverage",
    reason: `The domain-proven threshold ${input.result.threshold} ${input.result.parameterUnit} applies only to the known components. Any missing cost categories remain unresolved and are not treated as zero; their eventual costs can change this conditioned decision.`,
    evidenceRefs: input.exact!.evidenceRefs,
  })
  const preserveSubtotalId = exact && (format === "intelligence-v1" || format === "union-v1")
  const finalDisclosure = complete || (!preserveSubtotalId && disclosed.some((condition) => condition.id === "known-components-threshold")) ? [] : [{
    id: preserveSubtotalId ? "known-subtotal-threshold" : "preview-coverage", category: "coverage",
    reason: "Threshold evidence concerns known subtotal differences only; unresolved coverage can change the decision.",
    evidenceRefs: input.baselineRefs,
  }]
  return attachSensitivityV6({
    result: {
      ...input.result,
      threshold: exact ? input.result.threshold : null,
      comparisonStatus: comparable ? complete ? "complete" : "conditioned" : input.result.comparisonStatus,
      unresolvedConditions: [...disclosed, ...observations.flatMap((sample) => sample.conditions.map((reason) => ({ id: `${sample.resultRef}:${reason}`, category: "coverage", reason, evidenceRefs: input.baselineRefs }))), ...finalDisclosure],
      evidenceRefs: [...input.result.evidenceRefs, ...input.binding.evidenceRefs, ...input.baselineRefs],
    },
    costCoverageRefs: [...new Set([input.binding.baselineCoverageRef, input.binding.scenarioCoverageRef, ...observations.flatMap((sample) => sample.coverageRefs)])],
    unit: input.binding.unit, engineVersion: input.binding.engineVersion, thresholdEvidence,
  })
}
