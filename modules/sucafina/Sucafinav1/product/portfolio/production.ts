import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DecisionCasePort, PlannerPort, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { createPortfolioContribution } from "./contribution.ts"
import type { PortfolioCombination, ScenarioResult } from "../contracts/decisions.ts"
import type { PortfolioRequest, ScenarioRequest } from "../contracts/operations.ts"
import type { PortfolioCandidate, PortfolioHost } from "./port.ts"

/** Compose actual Planner, case and C08 ports without inventing a coverage assessment or comparison. */
export function createProductionPortfolio(input: {
  cases: DecisionCasePort
  planner: PlannerPort
  sources: PlannerSourceHost
  evidence: BusinessContextService
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
  createReceipt: Parameters<typeof createPortfolioContribution>[0]["createReceipt"]
  decisions: Parameters<typeof createPortfolioContribution>[0]["decisions"]
  persistence: NonNullable<Parameters<typeof createPortfolioContribution>[0]["persistence"]>
  enabledOperations: Parameters<typeof createPortfolioContribution>[0]["enabledOperations"]
  sensitivity?: PortfolioHost["sensitivity"]
  coverageRefFor?: (source: BusinessEvidenceRef, context: TrustedDomainContext) => Promise<PortResult<string>>
  candidateCoverageRefFor?: (candidate: PortfolioCandidate, context: TrustedDomainContext) => Promise<PortResult<string>>
  analysis?: {
    evaluate: (request: { portfolio: PortfolioRequest; candidates: readonly PortfolioCandidate[]; scenario: ScenarioRequest; result: ScenarioResult; costCoverageRefs: readonly string[] }, context: TrustedDomainContext) => Promise<PortResult<{ analysis: NonNullable<PortfolioCombination["analysis"]>; constraints: readonly { ref: string; state: "satisfied" | "failed" | "unknown"; reason: string }[] }>>
    revalidate: (analysis: NonNullable<PortfolioCombination["analysis"]>, context: TrustedDomainContext) => Promise<boolean>
  }
}) {
  const fresh = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
    if (!refs.length || refs.some((ref) => ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref)) || !await input.revalidate(context)) return false
    const resolved = await Promise.all(refs.map((ref) => input.evidence.resolve(ref, context).catch(() => undefined)))
    return resolved.length === refs.length && resolved.every((value, index) => !!value && value.state === "fresh" && value.accessRevision === context.binding.accessRevision && value.ref.refDigest === refs[index].refDigest && value.ref.refDigest === digestSfEvidenceRef(value.ref)) && await input.revalidate(context)
  }
  const evidenceRefs = (scenario: ScenarioResult) => [...scenario.sourceRefs, ...scenario.costCoverage.evaluatedSourceRefs, ...scenario.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)].filter((ref, index, refs) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index)
  const coverage = async (sourceRefs: readonly BusinessEvidenceRef[], expected: unknown, context: TrustedDomainContext): Promise<PortResult<readonly string[]>> => {
    const source = sourceRefs.find((ref) => ref.kind === "record" && ref.target.surface === "planner" && ref.target.recordType === "planner-version")
    if (!source) return { status: "unavailable", reason: "planner-source-unavailable" }
    if (!input.coverageRefFor) return { status: "ok", value: [] }
    const reference = await input.coverageRefFor(source, context)
    if (reference.status !== "ok") return reference
    if (!reference.value.trim()) return { status: "unavailable", reason: "coverage-reference-unavailable" }
    const current = await input.sources.resolveForecastCoverage(reference.value, context)
    if (current.status === "ok" && current.value.coverageRef !== reference.value) return { status: "stale", reason: "coverage-reference-changed" }
    if (current.status !== "ok") return current
    if (digestSfValue(current.value.assessment) !== digestSfValue(expected)) return { status: "ok", value: [] }
    return { status: "ok", value: [current.value.coverageRef] }
  }
  const candidateCoverage = async (candidates: readonly PortfolioCandidate[], context: TrustedDomainContext): Promise<PortResult<readonly string[]>> => {
    if (!input.candidateCoverageRefFor) return { status: "ok", value: [] }
    const refs: string[] = []
    for (const candidate of candidates) {
      if (!candidate.result || !await fresh(evidenceRefs(candidate.result), context)) return { status: "stale", reason: "candidate-sources-unavailable" }
      const ref = await input.candidateCoverageRefFor(candidate, context)
      if (ref.status !== "ok") return ref
      const current = await input.sources.resolveForecastCoverage(ref.value, context)
      if (current.status !== "ok") return current
      if (current.value.coverageRef !== ref.value || digestSfValue(current.value.assessment) !== digestSfValue(candidate.result.costCoverage)) return { status: "stale", reason: "candidate-coverage-changed" }
      refs.push(ref.value)
    }
    return { status: "ok", value: [...new Set(refs)] }
  }
  return createPortfolioContribution({
    cases: input.cases,
    enabledOperations: input.enabledOperations.filter((operation) => operation !== "sf_sensitivity_evaluate" || !!input.sensitivity),
    createReceipt: input.createReceipt,
    decisions: input.decisions,
    persistence: input.persistence,
    plannerHost: {
      planner: input.planner,
      sensitivity: input.sensitivity,
      revalidate: input.revalidate,
      scenarioRequest: async (_request, candidates: readonly PortfolioCandidate[], operations) => {
        const first = candidates[0]
        if (!first || candidates.some((candidate) => candidate.scenario.baseRef !== first.scenario.baseRef)) return { status: "needs-input", reason: "portfolio-base-mismatch" }
        const assumptions = candidates.flatMap((candidate) => candidate.scenario.assumptions)
        if (assumptions.some((item, index) => assumptions.findIndex((other) => other.id === item.id && digestSfValue(other) !== digestSfValue(item)) !== -1)) return { status: "conflict", reason: "portfolio-assumption-conflict" }
        return { status: "ok", value: { baseRef: first.scenario.baseRef, operations, assumptions: assumptions.filter((item, index) => assumptions.findIndex((other) => digestSfValue(other) === digestSfValue(item)) === index) } }
      },
      assess: async (request, candidates, scenario, context, scenarioRequest) => {
        if (!await fresh(evidenceRefs(scenario), context)) return { status: "stale", reason: "portfolio-sources-unavailable" }
        const result = await coverage(scenario.sourceRefs, scenario.costCoverage, context)
        if (result.status !== "ok") return result
        const candidatesResult = await candidateCoverage(candidates, context)
        if (candidatesResult.status !== "ok") return candidatesResult
        const costCoverageRefs = [...new Set([...result.value, ...candidatesResult.value])]
        if (!input.analysis) return { status: "ok", value: { costCoverageRefs, constraints: request.constraints.map((ref) => ({ ref, state: "unknown" as const, reason: "criterion-rule-unavailable" })) } }
        const analysis = await input.analysis.evaluate({ portfolio: request, candidates, scenario: scenarioRequest, result: scenario, costCoverageRefs }, context)
        if (analysis.status !== "ok") return analysis
        if (costCoverageRefs.some((ref) => !analysis.value.analysis.comparison.costCoverageRefs.includes(ref))) return { status: "stale", reason: "candidate-coverage-not-in-analysis" }
        return { status: "ok", value: { costCoverageRefs: analysis.value.analysis.comparison.costCoverageRefs, ...analysis.value } }
      },
      revalidateEvaluation: async (scenario, refs, analysis, context, candidates) => {
        if (!await fresh(evidenceRefs(scenario), context)) return false
        const current = await coverage(scenario.sourceRefs, scenario.costCoverage, context)
        const candidatesResult = await candidateCoverage(candidates, context)
        if (current.status !== "ok" || candidatesResult.status !== "ok") return false
        const known = [...new Set([...current.value, ...candidatesResult.value])]
        if (analysis) return !!input.analysis && known.every((ref) => refs.includes(ref)) && await input.analysis.revalidate(analysis, context)
        return digestSfValue(known) === digestSfValue(refs)
      },
    },
  })
}
