import { variance } from "../../src/planner-accounts.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ScenarioComparison, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { projectionDigest } from "./scenario-comparison-port.ts"
import { plannerComponentDigest } from "./comparison.ts"
import type { PlannerScenarioHost } from "./scenario-comparison-port.ts"

/** Compare a current case alternative to a transient domain preview without inventing coverage. */
export async function comparePlannerPreview(input: { host: Pick<DomainPortHost, "revalidate">; sources: PlannerSourceHost; scenarios: PlannerScenarioHost; planner: Pick<PlannerPort, "simulateScenario"> }, incoming: { baselineRef: string; scenario: ScenarioRequest }, context: TrustedDomainContext): Promise<PortResult<{ sample: ScenarioResult; comparison: ScenarioComparison; metric: { metricRef: "planner:known-subtotal-difference"; value: number | null; unit: string; period: ScenarioResult["horizon"]; evidenceRefs: readonly BusinessEvidenceRef[]; state: "conditioned"; engineVersion: string } }>> {
  const request = structuredClone(incoming)
  if (!request.baselineRef.trim() || !await input.host.revalidate(context)) return { status: "denied", reason: "invalid-binding" }
  const baseline = structuredClone(await input.scenarios.resolve(request.baselineRef, context))
  if (baseline.status !== "ok") return baseline
  if (!baseline.value.coverageRef.trim()) return { status: "unavailable", reason: "baseline-coverage-unavailable" }
  if (baseline.value.result.comparisonStatus === "incompatible" || baseline.value.result.comparisonStatus === "unavailable") return { status: "unavailable", reason: "baseline-unavailable" }
  const sampleSource = structuredClone(await input.sources.resolveForecastSource(request.scenario.baseRef, context))
  if (sampleSource.status !== "ok") return sampleSource
  const check = async () => {
    const source = await input.sources.resolveForecastSource(baseline.value.source.refId, context)
    const coverage = await input.sources.resolveForecastCoverage(baseline.value.coverageRef, context)
    return source.status === "ok" && source.value.evidence.refDigest === baseline.value.source.refDigest && coverage.status === "ok" && coverage.value.coverageRef === baseline.value.coverageRef && digestSfValue(coverage.value.basis) === digestSfValue(baseline.value.basis) && digestSfValue(coverage.value.assessment) === digestSfValue(baseline.value.result.costCoverage)
  }
  if (!await check()) return { status: "stale", reason: "scenario-source-or-coverage-changed" }
  const sample = structuredClone(await input.planner.simulateScenario(structuredClone(request.scenario), context))
  if (sample.status !== "ok") return sample
  if (sample.value.comparisonStatus !== "conditioned" || sample.value.total !== null || sample.value.costCoverage.coverageState === "complete" || !sample.value.id.startsWith("preview:")) return { status: "unavailable", reason: "preview-unavailable" }
  if (sample.value.costCoverage.basisId !== baseline.value.basis.id || sample.value.costCoverage.basisVersion !== baseline.value.basis.version) return { status: "needs-input", reason: "preview-coverage-basis-mismatch" }
  if (sample.value.currency !== baseline.value.result.currency || sample.value.horizon.start !== baseline.value.result.horizon.start || sample.value.horizon.end !== baseline.value.result.horizon.end) return { status: "needs-input", reason: "preview-scope-mismatch" }
  if (!sample.value.sourceRefs.some((ref) => ref.refDigest === sampleSource.value.evidence.refDigest)) return { status: "stale", reason: "preview-source-changed" }
  const again = structuredClone(await input.scenarios.resolve(request.baselineRef, context))
  const sampleSourceAgain = structuredClone(await input.sources.resolveForecastSource(request.scenario.baseRef, context))
  if (sampleSourceAgain.status !== "ok" || sampleSourceAgain.value.evidence.refDigest !== sampleSource.value.evidence.refDigest || again.status !== "ok" || digestSfValue({ ...again.value, projection: undefined }) !== digestSfValue({ ...baseline.value, projection: undefined }) || projectionDigest(again.value.projection) !== projectionDigest(baseline.value.projection) || !await check() || !await input.host.revalidate(context)) return { status: "stale", reason: "scenario-or-authority-changed" }
  const before = baseline.value.result.knownSubtotal
  const after = sample.value.knownSubtotal
  const difference = before === null || after === null || !Number.isFinite(before) || !Number.isFinite(after) ? null : variance(after, before).value
  const knownDifference = difference !== null && Number.isFinite(difference) ? difference : null
  const refs = [...baseline.value.result.sourceRefs, ...baseline.value.result.costCoverage.evaluatedSourceRefs, ...baseline.value.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs), ...sample.value.sourceRefs, ...sample.value.costCoverage.evaluatedSourceRefs, ...sample.value.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
  const evidenceRefs = refs.filter((ref, index) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index)
  return { status: "ok", value: { sample: sample.value, comparison: { baselineResultRef: request.baselineRef, alternativeResultRef: sample.value.id, costCoverageRefs: [baseline.value.coverageRef], comparisonStatus: "conditioned", knownDifference, completeDifference: null, criterionResults: [], unresolvedConditions: [...new Set([...baseline.value.result.unresolvedConditions, ...sample.value.unresolvedConditions, "preview-comparison-transient", "preview-coverage-unresolved"])] }, metric: { metricRef: "planner:known-subtotal-difference", value: knownDifference, unit: sample.value.currency, period: sample.value.horizon, evidenceRefs, state: "conditioned", engineVersion: baseline.value.projection.engineVersion } } }
}

/** Observation clocks do not change a persisted scenario or transient comparison's identity. */
export function plannerScenarioDigest(scenario: ScenarioResult) {
  return digestSfValue({ ...scenario, components: plannerComponentDigest(scenario.components) })
}

export function plannerPreviewDigest(value: { sample: ScenarioResult; comparison: ScenarioComparison; metric?: unknown }) {
  return digestSfValue({ ...value, sample: plannerScenarioDigest(value.sample) })
}

