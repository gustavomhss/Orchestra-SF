import { digestSfValue } from "../contracts/canonical.ts"
import { attachSensitivityV6 } from "./sensitivity-v6.ts"
import type { PortfolioRequest, ScenarioOperation, ScenarioRequest, SensitivityRequest } from "../contracts/operations.ts"
import type { PortfolioResult, PortfolioCombination, ScenarioResult } from "../contracts/decisions.ts"
import type { SensitivityResult } from "../contracts/outputs.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

// All reads, simulations and constraint checks are performed by the authenticated host.
export type PortfolioCandidate = {
  ref: string
  caseRef: string
  operations: readonly ScenarioOperation[]
  scenario: ScenarioRequest
  result?: ScenarioResult
}
export type PortfolioHost = {
  resolveCandidate: (ref: string, context: TrustedDomainContext) => Promise<PortResult<PortfolioCandidate>>
  evaluate: (input: { request: PortfolioRequest; candidates: readonly PortfolioCandidate[]; operations: readonly ScenarioOperation[] }, context: TrustedDomainContext) => Promise<PortResult<{ scenario: ScenarioResult; costCoverageRefs: readonly string[]; analysis?: PortfolioCombination["analysis"]; constraints: readonly { ref: string; state: "satisfied" | "failed" | "unknown"; reason: string }[] }>>
  sensitivity: (request: SensitivityRequest, context: TrustedDomainContext) => Promise<PortResult<SensitivityResult>>
  revalidateEvaluation: (scenario: ScenarioResult, costCoverageRefs: readonly string[], analysis: PortfolioCombination["analysis"], context: TrustedDomainContext, candidates: readonly PortfolioCandidate[]) => Promise<boolean>
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
}
export type PortfolioPort = {
  evaluate: (request: PortfolioRequest, context: TrustedDomainContext) => Promise<PortResult<PortfolioResult>>
  sensitivity: (request: SensitivityRequest, context: TrustedDomainContext) => Promise<PortResult<SensitivityResult>>
}

export function createPortfolioPort(host: PortfolioHost): PortfolioPort & { evaluateWithSelections: (request: PortfolioRequest, context: TrustedDomainContext) => Promise<PortResult<{ portfolio: PortfolioResult; selections: readonly { combinationId: string; selectedCandidateRefs: readonly string[] }[] }>> } {
  const evaluate = async (incoming: PortfolioRequest, context: TrustedDomainContext, selections: { combinationId: string; selectedCandidateRefs: readonly string[] }[] = []): Promise<PortResult<PortfolioResult>> => {
    const request = structuredClone(incoming)
    if (!(await host.revalidate(context))) return { status: "denied", reason: "invalid-binding" }
    if (!request.candidateRefs.length || request.candidateRefs.length > 64 || new Set(request.candidateRefs).size !== request.candidateRefs.length || !Number.isSafeInteger(request.explorationLimit) || request.explorationLimit < 1 || request.explorationLimit > 1024 || !request.scope.currency || request.scope.horizon.start > request.scope.horizon.end)
      return { status: "needs-input", reason: "invalid-portfolio-scope-or-limit" }
    const resolved = await Promise.all(request.candidateRefs.map((ref) => host.resolveCandidate(ref, context)))
    const failure = resolved.find((item) => item.status !== "ok")
    if (failure) return failure
    const candidates = resolved.flatMap((item) => item.status === "ok" ? [structuredClone(item.value)] : [])
    if (candidates.some((item) => !item.operations.length || item.operations.some((operation) => !operation.targetRef.trim()))) return { status: "needs-input", reason: "candidate-operation-required" }
    if (candidates.some((item, index) => item.ref !== request.candidateRefs[index] || digestSfValue(item.operations) !== digestSfValue(item.scenario.operations))) return { status: "stale", reason: "candidate-reference-changed" }
    // Enumerate a bounded prefix without computing 2 ** n or materializing the power set.
    const combinations: PortfolioResult["combinations"][number][] = []
    const evidenceRefs: PortfolioResult["evidenceRefs"][number][] = []
    const evaluatedSources: { scenario: ScenarioResult; costCoverageRefs: readonly string[]; analysis?: PortfolioCombination["analysis"]; candidates: readonly PortfolioCandidate[] }[] = []
    const queue: number[][] = candidates.map((_, index) => [index])
    while (queue.length && combinations.length < request.explorationLimit) {
      const indexes = queue.shift()!
      const selected = indexes.map((index) => candidates[index])
      const operations = [...request.operations, ...selected.flatMap((candidate) => candidate.operations)]
      const duplicateTargets = operations.map((operation) => operation.targetRef).filter((target, index, all) => all.indexOf(target) !== index)
      const id = digestSfValue({ candidates: selected.map((candidate) => candidate.ref), operations })
      selections.push({ combinationId: id, selectedCandidateRefs: selected.map((candidate) => candidate.ref) })
      const last = indexes[indexes.length - 1]
      for (let index = last + 1; index < candidates.length; index++) queue.push([...indexes, index])
      if (duplicateTargets.length) {
        combinations.push({ id, caseRefs: selected.map((candidate) => candidate.caseRef), components: [], costCoverageRefs: [], conflicts: [...new Set(duplicateTargets)].map((target) => `duplicate-target:${target}`), restrictions: [], eligibility: "ineligible", comparisonStatus: "incompatible" })
        continue
      }
      const evaluated = structuredClone(await host.evaluate(structuredClone({ request, candidates: selected, operations }), context))
      if (evaluated.status !== "ok") return evaluated
      const scenario = evaluated.value.scenario
      evaluatedSources.push({ scenario, costCoverageRefs: evaluated.value.costCoverageRefs, analysis: evaluated.value.analysis, candidates: selected })
      const analysis = evaluated.value.analysis
      if (analysis && (!analysis.scenarioResultRef.trim() || !analysis.comparisonRef.trim() || digestSfValue(analysis.scenario) !== digestSfValue(scenario) || analysis.comparison.alternativeResultRef !== analysis.scenarioResultRef || !analysis.comparison.costCoverageRefs.length || new Set(analysis.comparison.costCoverageRefs).size !== analysis.comparison.costCoverageRefs.length || new Set(evaluated.value.costCoverageRefs).size !== evaluated.value.costCoverageRefs.length || analysis.comparison.costCoverageRefs.some((ref) => !evaluated.value.costCoverageRefs.includes(ref)))) return { status: "unavailable", reason: "analysis-reference-mismatch" }
      if (analysis && (new Set(analysis.comparison.criterionResults.map((item) => item.criterionId)).size !== analysis.comparison.criterionResults.length || request.constraints.some((ref) => !analysis.comparison.criterionResults.some((item) => item.criterionId === ref)) || analysis.comparison.criterionResults.some((item) => !request.constraints.includes(item.criterionId)))) return { status: "unavailable", reason: "comparison-criteria-incomplete" }
      if (new Set(scenario.components.map((component) => component.id)).size !== scenario.components.length) return { status: "unavailable", reason: "duplicate-scenario-component" }
      if (scenario.currency !== request.scope.currency || scenario.horizon.start !== request.scope.horizon.start || scenario.horizon.end !== request.scope.horizon.end) return { status: "stale", reason: "scenario-scope-mismatch" }
      const checks = evaluated.value.constraints
      if (new Set(checks.map((check) => check.ref)).size !== checks.length || request.constraints.some((ref) => !checks.some((check) => check.ref === ref)) || checks.some((check) => !request.constraints.includes(check.ref)) || (analysis && checks.some((check) => analysis.comparison.criterionResults.some((item) => item.criterionId === check.ref && item.state !== check.state)))) return { status: "unavailable", reason: "constraint-assessment-incomplete" }
      const restrictions = [...scenario.restrictions, ...scenario.unresolvedConditions, ...(scenario.costCoverage.coverageState === "complete" ? [] : [`coverage:${scenario.costCoverage.coverageState}`]), ...scenario.costCoverage.issues, ...scenario.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [`${entry.categoryId}:${entry.reason}`] : []), ...scenario.costCoverage.derivedMissingCategoryIds.map((category) => `missing-category:${category}`), ...checks.filter((check) => check.state !== "satisfied").map((check) => `${check.ref}:${check.reason}`), ...(analysis?.comparison.unresolvedConditions ?? []), ...(analysis?.comparison.criterionResults.filter((item) => item.state !== "satisfied").map((item) => `${item.criterionId}:${item.reason}`) ?? [])]
      restrictions.push(...selected.flatMap((candidate) => candidate.result ? [...(candidate.result.costCoverage.coverageState === "complete" ? [] : [`candidate:${candidate.ref}:coverage:${candidate.result.costCoverage.coverageState}`]), ...candidate.result.unresolvedConditions.map((reason) => `candidate:${candidate.ref}:${reason}`), ...candidate.result.restrictions.map((reason) => `candidate:${candidate.ref}:${reason}`), ...candidate.result.costCoverage.issues.map((issue) => `candidate:${candidate.ref}:${issue}`), ...candidate.result.costCoverage.derivedMissingCategoryIds.map((category) => `candidate:${candidate.ref}:missing-category:${category}`), ...candidate.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [`candidate:${candidate.ref}:${entry.categoryId}:${entry.reason}`] : [])] : []))
      restrictions.push(...scenario.components.filter((component) => component.amount === null || component.evidenceState !== "confirmed" || !component.sourceRefs.length).map((component) => `component-unconfirmed:${component.id}`))
      if (scenario.comparisonStatus === "complete" && (!scenario.costCoverage.entries.length || !scenario.costCoverage.evaluatedSourceRefs.length || scenario.costCoverage.entries.some((entry) => !entry.evidenceRefs.length) || scenario.components.some((component) => !component.sourceRefs.length))) restrictions.push("coverage-evidence-unavailable")
      if (!analysis) restrictions.push("analysis-unavailable")
      restrictions.push(...selected.filter((candidate) => !candidate.result).map((candidate) => `candidate:${candidate.ref}:coverage-unavailable`))
      const common = { ...(analysis ? { analysis } : {}), id, caseRefs: selected.map((candidate) => candidate.caseRef), components: scenario.components, costCoverageRefs: evaluated.value.costCoverageRefs, conflicts: [], restrictions }
      evidenceRefs.push(...selected.flatMap((candidate) => candidate.result ? [...candidate.result.sourceRefs, ...candidate.result.costCoverage.evaluatedSourceRefs, ...candidate.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)] : []), ...scenario.sourceRefs, ...scenario.costCoverage.evaluatedSourceRefs, ...scenario.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs))
      const candidateComplete = selected.every((candidate) => !!candidate.result && candidate.result.comparisonStatus === "complete" && candidate.result.costCoverage.coverageState === "complete" && !candidate.result.unresolvedConditions.length && !candidate.result.restrictions.length && !candidate.result.costCoverage.issues.length && candidate.result.components.every((component) => component.amount !== null && Number.isFinite(component.amount) && component.evidenceState === "confirmed" && component.sourceRefs.length > 0) && candidate.result.costCoverage.entries.length > 0 && candidate.result.costCoverage.evaluatedSourceRefs.length > 0 && candidate.result.costCoverage.entries.every((entry) => entry.evidenceRefs.length > 0))
      if (scenario.comparisonStatus === "incompatible" || selected.some((candidate) => candidate.result?.comparisonStatus === "incompatible") || analysis?.comparison.comparisonStatus === "incompatible" || (candidateComplete && scenario.comparisonStatus === "complete" && analysis?.comparison.comparisonStatus === "complete" && (analysis.comparison.criterionResults.some((item) => item.state === "failed") || checks.some((check) => check.state === "failed")))) {
        combinations.push({ ...common, eligibility: "ineligible", comparisonStatus: analysis?.comparison.comparisonStatus === "incompatible" || selected.some((candidate) => candidate.result?.comparisonStatus === "incompatible") ? "incompatible" : scenario.comparisonStatus })
        continue
      }
      if (scenario.comparisonStatus === "complete" && analysis && analysis.comparison.comparisonStatus === "complete" && !analysis.comparison.unresolvedConditions.length && analysis.comparison.criterionResults.every((item) => item.state === "satisfied") && scenario.costCoverage.coverageState === "complete" && !scenario.unresolvedConditions.length && !scenario.restrictions.length && !scenario.costCoverage.issues.length && scenario.costCoverage.entries.length > 0 && scenario.costCoverage.evaluatedSourceRefs.length > 0 && scenario.costCoverage.entries.every((entry) => entry.evidenceRefs.length > 0) && scenario.components.every((component) => component.amount !== null && Number.isFinite(component.amount) && component.evidenceState === "confirmed" && component.sourceRefs.length > 0) && candidateComplete && checks.every((check) => check.state === "satisfied") && evaluated.value.costCoverageRefs.length) {
        combinations.push({ ...common, eligibility: "eligible-complete", comparisonStatus: "complete" })
        continue
      }
      if (scenario.comparisonStatus === "unavailable" || selected.some((candidate) => candidate.result?.comparisonStatus === "unavailable") || analysis?.comparison.comparisonStatus === "unavailable") {
        combinations.push({ ...common, eligibility: "unavailable", comparisonStatus: "unavailable" })
        continue
      }
      const financialStatus = scenario.comparisonStatus === "complete" && candidateComplete && analysis?.comparison.comparisonStatus === "complete" ? "complete" : scenario.comparisonStatus === "complete" ? "conditioned" : scenario.comparisonStatus
      combinations.push({ ...common, eligibility: "conditioned", comparisonStatus: financialStatus })
    }
    if (!(await host.revalidate(context)) || !(await Promise.all(evaluatedSources.map((item) => host.revalidateEvaluation(item.scenario, item.costCoverageRefs, item.analysis, context, item.candidates)))).every(Boolean)) return { status: "stale", reason: "source-or-authority-changed" }
    const latest = await Promise.all(request.candidateRefs.map((ref) => host.resolveCandidate(ref, context)))
    if (latest.some((item, index) => item.status !== "ok" || digestSfValue(item.value) !== digestSfValue(candidates[index]))) return { status: "stale", reason: "candidate-changed-or-revoked" }
    return { status: "ok", value: { combinations, evidenceRefs: evidenceRefs.filter((ref, index) => evidenceRefs.findIndex((item) => item.refDigest === ref.refDigest) === index), limitations: ["Finite exploration; no global optimum is asserted.", ...(queue.length ? [`Exploration limit ${request.explorationLimit} reached.`] : [])] } }
  }
  const sensitivity: PortfolioPort["sensitivity"] = async (request, context) => {
    if (!(await host.revalidate(context))) return { status: "denied", reason: "invalid-binding" }
    const bounds = request.parameterBounds
    if (!Number.isFinite(bounds.minimum) || !Number.isFinite(bounds.maximum) || bounds.minimum > bounds.maximum || !Number.isSafeInteger(bounds.steps) || bounds.steps < 1 || bounds.steps > 1024 || !Number.isFinite(request.criterion.value)) return { status: "needs-input", reason: "invalid-parameter-bounds" }
    const result = await host.sensitivity(request, context)
    if (result.status !== "ok") return result
    const validated = attachSensitivityV6({ result: result.value, costCoverageRefs: result.value.costCoverageRefs, unit: result.value.unit, engineVersion: result.value.engineVersion, thresholdEvidence: result.value.thresholdEvidence })
    if (validated.status !== "ok") return validated
    if (!(await host.revalidate(context))) return { status: "stale", reason: "authority-changed" }
    return validated
  }
  return {
    evaluate: (request, context) => evaluate(request, context),
    sensitivity,
    evaluateWithSelections: async (request, context) => {
      const selections: { combinationId: string; selectedCandidateRefs: readonly string[] }[] = []
      const result = await evaluate(request, context, selections)
      if (result.status !== "ok") return result
      return { status: "ok", value: { portfolio: result.value, selections } }
    },
  }
}
