import { variance } from "../../src/planner-accounts.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { ScenarioComparison, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { projectionDigest } from "./scenario-comparison-port.ts"
import type { PlannerScenarioHost } from "./scenario-comparison-port.ts"

/** Compare a current case alternative to a transient domain preview without inventing coverage. */
export async function comparePlannerPreview(input: { host: Pick<DomainPortHost, "revalidate">; sources: PlannerSourceHost; scenarios: PlannerScenarioHost; planner: Pick<PlannerPort, "simulateScenario"> }, request: { baselineRef: string; scenario: ScenarioRequest }, context: TrustedDomainContext): Promise<PortResult<{ sample: ScenarioResult; comparison: ScenarioComparison }>> {
  if (!request.baselineRef.trim() || !await input.host.revalidate(context)) return { status: "denied", reason: "invalid-binding" }
  const baseline = await input.scenarios.resolve(request.baselineRef, context)
  if (baseline.status !== "ok") return baseline
  if (!baseline.value.coverageRef.trim()) return { status: "unavailable", reason: "baseline-coverage-unavailable" }
  if (baseline.value.result.comparisonStatus === "incompatible" || baseline.value.result.comparisonStatus === "unavailable") return { status: "unavailable", reason: "baseline-unavailable" }
  if (request.scenario.baseRef !== baseline.value.source.refId) return { status: "needs-input", reason: "preview-base-mismatch" }
  const check = async () => {
    const source = await input.sources.resolveForecastSource(baseline.value.source.refId, context)
    const coverage = await input.sources.resolveForecastCoverage(baseline.value.coverageRef, context)
    return source.status === "ok" && source.value.evidence.refDigest === baseline.value.source.refDigest && coverage.status === "ok" && coverage.value.coverageRef === baseline.value.coverageRef && digestSfValue(coverage.value.basis) === digestSfValue(baseline.value.basis) && digestSfValue(coverage.value.assessment) === digestSfValue(baseline.value.result.costCoverage)
  }
  if (!await check()) return { status: "stale", reason: "scenario-source-or-coverage-changed" }
  const sample = await input.planner.simulateScenario(request.scenario, context)
  if (sample.status !== "ok") return sample
  if (sample.value.comparisonStatus !== "conditioned" || sample.value.total !== null || sample.value.costCoverage.coverageState === "complete" || !sample.value.id.startsWith("preview:")) return { status: "unavailable", reason: "preview-unavailable" }
  if (sample.value.currency !== baseline.value.result.currency || sample.value.horizon.start !== baseline.value.result.horizon.start || sample.value.horizon.end !== baseline.value.result.horizon.end) return { status: "needs-input", reason: "preview-scope-mismatch" }
  if (!sample.value.sourceRefs.some((ref) => ref.refDigest === baseline.value.source.refDigest)) return { status: "stale", reason: "preview-source-changed" }
  const again = await input.scenarios.resolve(request.baselineRef, context)
  if (again.status !== "ok" || digestSfValue({ ...again.value, projection: undefined }) !== digestSfValue({ ...baseline.value, projection: undefined }) || projectionDigest(again.value.projection) !== projectionDigest(baseline.value.projection) || !await check() || !await input.host.revalidate(context)) return { status: "stale", reason: "scenario-or-authority-changed" }
  const before = baseline.value.result.knownSubtotal
  const after = sample.value.knownSubtotal
  const difference = before === null || after === null || !Number.isFinite(before) || !Number.isFinite(after) ? null : variance(after, before).value
  const knownDifference = difference !== null && Number.isFinite(difference) ? difference : null
  return { status: "ok", value: { sample: sample.value, comparison: { baselineResultRef: request.baselineRef, alternativeResultRef: sample.value.id, costCoverageRefs: [baseline.value.coverageRef], comparisonStatus: "conditioned", knownDifference, completeDifference: null, criterionResults: [], unresolvedConditions: [...new Set([...baseline.value.result.unresolvedConditions, ...sample.value.unresolvedConditions, "preview-comparison-transient", "preview-coverage-unresolved"])] } } }
}
