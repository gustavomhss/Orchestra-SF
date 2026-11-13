import { digestSfValue } from "../contracts/canonical.ts"
import { validateScenarioCoverage } from "./cost-coverage.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { AlternativeDraftRequest, ScenarioRequest } from "../contracts/operations.ts"
import type { SfOperationOutputMap } from "../contracts/outputs.ts"
import type { DecisionCasePort, DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

/** Builds a proposal against the bound case. Promotion and case mutation are separate human actions. */
export function createDecisionProposalService(input: {
  cases: DecisionCasePort
  planner: PlannerPort
  sources: PlannerSourceHost
  host: Pick<DomainPortHost, "revalidate">
  resolveAlternative: (request: AlternativeDraftRequest, context: TrustedDomainContext) => Promise<PortResult<{ scenario: ScenarioRequest; coverageRef: string }>>
  authorizeProposal: (request: AlternativeDraftRequest, proposal: SfOperationOutputMap["sf_alternative_draft"]["proposal"], context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (request: AlternativeDraftRequest, context: TrustedDomainContext): Promise<PortResult<SfOperationOutputMap["sf_alternative_draft"]>> => {
    const parsed = decodeSfOperationInput("sf_alternative_draft", request)
    if (!parsed.ok || !request.proposal.title.trim() || !request.proposal.description.trim()) return { status: "needs-input", reason: "invalid-alternative-proposal" }
    const current = await input.cases.read({ caseRef: parsed.value.caseRef }, context)
    if (current.status !== "ok") return current
    const supplied = [...parsed.value.sourceRefs, ...parsed.value.proposal.sourceRefs]
    if (supplied.some((ref) => !current.value.evidenceRefs.some((allowed) => digestSfValue(allowed) === digestSfValue(ref)))) return { status: "denied", reason: "source-outside-case-scope" }
    const resolved = await input.resolveAlternative(parsed.value, context)
    if (resolved.status !== "ok") return resolved
    const scenarioInput = decodeSfOperationInput("sf_scenario_simulate", resolved.value.scenario)
    if (!scenarioInput.ok || !resolved.value.coverageRef.trim()) return { status: "needs-input", reason: "invalid-scenario-proposal" }
    if (scenarioInput.value.assumptions.flatMap((item) => item.evidenceRefs).some((ref) => !current.value.evidenceRefs.some((allowed) => digestSfValue(allowed) === digestSfValue(ref)))) return { status: "denied", reason: "source-outside-case-scope" }
    const scenario = await input.planner.simulateScenario(scenarioInput.value, context)
    if (scenario.status !== "ok") return scenario
    const coverage = await input.sources.resolveForecastCoverage(resolved.value.coverageRef, context)
    if (coverage.status !== "ok") return coverage
    if (coverage.value.coverageRef !== resolved.value.coverageRef || scenario.value.currency !== current.value.case.currency || scenario.value.horizon.start !== current.value.case.horizon.start || scenario.value.horizon.end !== current.value.case.horizon.end) return { status: "conflict", reason: "alternative-basis-mismatch" }
    const coverageError = validateScenarioCoverage(scenario.value, coverage.value.basis, coverage.value.assessment)
    if (coverageError) return { status: "conflict", reason: coverageError }
    const alternative = { id: scenario.value.costCoverage.alternativeId, version: scenario.value.costCoverage.alternativeVersion, title: parsed.value.proposal.title, scenario: scenarioInput.value, result: scenario.value }
    if (!await input.authorizeProposal(parsed.value, alternative, context)) return { status: "denied", reason: "alternative-access-unavailable" }
    const previous = current.value.case.alternatives.find((item) => item.id === alternative.id)
    if (!alternative.id.trim() || !Number.isSafeInteger(alternative.version) || alternative.version !== (previous?.version ?? 0) + 1 || current.value.case.alternatives.some((item) => item.result.id === alternative.result.id)) return { status: "conflict", reason: "alternative-identity-conflict" }
    const again = await input.cases.read({ caseRef: parsed.value.caseRef }, context)
    if (again.status !== "ok") return again
    if (again.value.case.version !== current.value.case.version || !await input.authorizeProposal(parsed.value, alternative, context) || !await input.host.revalidate(context)) return { status: "stale", reason: "case-changed" }
    return { status: "ok", value: { caseRef: parsed.value.caseRef, proposal: alternative, domainApplied: false } }
  }
}
