import { digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCasePort, DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { ScenarioResult } from "../contracts/decisions.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createDecisionProposalService } from "./proposals.ts"
import type { AlternativeCapabilityProvenance } from "./alternative-provenance.ts"
import { reassessScenarioCoverage, validateScenarioCoverage } from "./cost-coverage.ts"

/** Replays the original capability without registering another coverage record or mutating the case. */
export function createAlternativeReadOnlyReplay(input: {
  cases: DecisionCasePort
  planner: Pick<PlannerPort, "simulateScenario">
  sources: Pick<PlannerSourceHost, "resolveForecastCoverage">
  host: Pick<DomainPortHost, "revalidate">
  resolveAlternative: Parameters<typeof createDecisionProposalService>[0]["resolveAlternative"]
  authorizeProposal: Parameters<typeof createDecisionProposalService>[0]["authorizeProposal"]
  coverageEvidence: NonNullable<Parameters<typeof createDecisionProposalService>[0]["coverageEvidence"]>
}) {
  return async (record: AlternativeCapabilityProvenance, context: TrustedDomainContext): Promise<PortResult<{ output: AlternativeCapabilityProvenance["output"] }>> => {
    try {
      const current = await input.cases.read({ caseRef: record.request.caseRef }, context)
      if (current.status !== "ok") return current
      if (current.value.case.id !== record.caseRef.id || current.value.case.incarnation !== record.caseRef.incarnation || current.value.case.version !== record.caseRef.version || record.installationId !== context.binding.installationId || record.projectId !== context.binding.projectId) return { status: "stale", reason: "alternative-case-changed" }
      const supplied = [...record.request.sourceRefs, ...record.request.proposal.sourceRefs]
      if (supplied.some((ref) => !current.value.evidenceRefs.some((allowed) => digestSfValue(allowed) === digestSfValue(ref)))) return { status: "denied", reason: "source-outside-case-scope" }
      const resolved = await input.resolveAlternative(record.request, context)
      if (resolved.status !== "ok") return resolved
      if (resolved.value.scenario.assumptions.flatMap((item) => item.evidenceRefs).some((ref) => !current.value.evidenceRefs.some((allowed) => digestSfValue(allowed) === digestSfValue(ref)))) return { status: "denied", reason: "source-outside-case-scope" }
      const simulation = await input.planner.simulateScenario(resolved.value.scenario, context)
      if (simulation.status !== "ok") return simulation
      const coverage = await input.sources.resolveForecastCoverage(resolved.value.coverageRef, context)
      if (coverage.status !== "ok") return coverage
      if (coverage.value.coverageRef !== resolved.value.coverageRef || simulation.value.currency !== current.value.case.currency || digestSfValue(simulation.value.horizon) !== digestSfValue(current.value.case.horizon)) return { status: "stale", reason: "alternative-basis-changed" }
      const reassessed = digestSfValue(simulation.value.costCoverage) !== digestSfValue(coverage.value.assessment)
      const entries = reassessed ? await input.coverageEvidence.entries(simulation.value, coverage.value.assessment, context) : undefined
      if (entries && entries.status !== "ok") return entries
      const evaluated = !reassessed ? simulation.value : entries?.status === "ok" ? await reassessScenarioCoverage({ scenario: simulation.value, basis: coverage.value.basis, baseline: coverage.value.assessment, entries: entries.value, resolveEvidence: (refs) => input.coverageEvidence.resolve(refs, context), supports: input.coverageEvidence.supports }) : undefined
      if (!evaluated) return { status: "unavailable", reason: "scenario-coverage-reassessment-unavailable" }
      const previous = current.value.case.alternatives.find((item) => item.id === evaluated.costCoverage.alternativeId)
      const provisional = evaluated.costCoverage.alternativeVersion !== (previous?.version ?? 0) + 1 || current.value.case.alternatives.some((item) => item.result.id === evaluated.id)
      const identity = provisional ? { alternativeId: `proposal:${digestSfValue({ caseRef: record.request.caseRef, request: record.request, scenario: resolved.value.scenario })}`, alternativeVersion: 1 } : { alternativeId: evaluated.costCoverage.alternativeId, alternativeVersion: evaluated.costCoverage.alternativeVersion }
      const result: ScenarioResult = evaluated.comparisonStatus === "complete"
        ? { ...evaluated, costCoverage: { ...evaluated.costCoverage, ...identity } }
        : { ...evaluated, costCoverage: { ...evaluated.costCoverage, ...identity } }
      if (validateScenarioCoverage(result, coverage.value.basis, result.costCoverage)) return { status: "stale", reason: "alternative-coverage-changed" }
      const proposal = { id: identity.alternativeId, version: identity.alternativeVersion, title: record.request.proposal.title, scenario: resolved.value.scenario, result }
      if (!await input.authorizeProposal(record.request, proposal, coverage.value.basis, context)) return { status: "denied", reason: "alternative-access-unavailable" }
      const proof = await input.sources.resolveForecastCoverage(record.output.coverageRef, context)
      if (proof.status !== "ok") return proof
      if (digestSfValue(proof.value.basis) !== digestSfValue(coverage.value.basis) || digestSfValue(proof.value.assessment) !== digestSfValue(result.costCoverage) || proof.value.coverageRef !== record.output.coverageRef) return { status: "stale", reason: "alternative-coverage-changed" }
      const output = { caseRef: record.request.caseRef, proposal, costCoverageBasis: coverage.value.basis, coverageRef: proof.value.coverageRef, domainApplied: false as const }
      const again = await input.cases.read({ caseRef: record.request.caseRef }, context)
      if (again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(current.value.case) || digestSfValue(output) !== record.receipt.resultDigest || !await input.authorizeProposal(record.request, proposal, coverage.value.basis, context) || !await input.host.revalidate(context)) return { status: "stale", reason: "alternative-proposal-changed" }
      return { status: "ok", value: { output } }
    } catch { return { status: "unavailable", reason: "alternative-replay-unavailable" } }
  }
}
