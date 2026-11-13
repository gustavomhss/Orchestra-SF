import { digestSfValue } from "../contracts/canonical.ts"
import { validateScenarioCoverage } from "./cost-coverage.ts"
import { prepareDomainChange } from "./prepared-change.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PreparedCommand } from "../contracts/context.ts"
import type { CostCoverageBasis, ScenarioResult } from "../contracts/decisions.ts"
import type { AlternativeDraftRequest, ChangePrepareRequest, ScenarioRequest } from "../contracts/operations.ts"
import type { SfOperationOutputMap, UnresolvedCondition } from "../contracts/outputs.ts"
import type { DecisionCasePort, DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

/** Builds a proposal against the bound case. Promotion and case mutation are separate human actions. */
export function createDecisionProposalService(input: {
  cases: DecisionCasePort
  planner: PlannerPort
  sources: PlannerSourceHost
  host: Pick<DomainPortHost, "revalidate">
  resolveAlternative: (request: AlternativeDraftRequest, context: TrustedDomainContext) => Promise<PortResult<{ scenario: ScenarioRequest; coverageRef: string }>>
  authorizeProposal: (request: AlternativeDraftRequest, proposal: SfOperationOutputMap["sf_alternative_draft"]["proposal"], basis: CostCoverageBasis, context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (request: AlternativeDraftRequest, context: TrustedDomainContext): Promise<PortResult<SfOperationOutputMap["sf_alternative_draft"] & { costCoverageBasis: CostCoverageBasis; coverageRef: string }>> => {
    const parsed = decodeSfOperationInput("sf_alternative_draft", request)
    if (!parsed.ok || !request.proposal.title.trim() || !request.proposal.description.trim()) return { status: "needs-input", reason: "invalid-alternative-proposal" }
    const current = await callProposalPort(() => input.cases.read({ caseRef: parsed.value.caseRef }, context))
    if (current.status !== "ok") return current
    const supplied = [...parsed.value.sourceRefs, ...parsed.value.proposal.sourceRefs]
    if (supplied.some((ref) => !current.value.evidenceRefs.some((allowed) => digestSfValue(allowed) === digestSfValue(ref)))) return { status: "denied", reason: "source-outside-case-scope" }
    const resolved = await callProposalPort(() => input.resolveAlternative(parsed.value, context))
    if (resolved.status !== "ok") return resolved
    const scenarioInput = decodeSfOperationInput("sf_scenario_simulate", resolved.value.scenario)
    if (!scenarioInput.ok || !resolved.value.coverageRef.trim()) return { status: "needs-input", reason: "invalid-scenario-proposal" }
    if (scenarioInput.value.assumptions.flatMap((item) => item.evidenceRefs).some((ref) => !current.value.evidenceRefs.some((allowed) => digestSfValue(allowed) === digestSfValue(ref)))) return { status: "denied", reason: "source-outside-case-scope" }
    const scenario = await callProposalPort(() => input.planner.simulateScenario(scenarioInput.value, context))
    if (scenario.status !== "ok") return scenario
    const coverage = await callProposalPort(() => input.sources.resolveForecastCoverage(resolved.value.coverageRef, context))
    if (coverage.status !== "ok") return coverage
    if (coverage.value.coverageRef !== resolved.value.coverageRef || scenario.value.currency !== current.value.case.currency || scenario.value.horizon.start !== current.value.case.horizon.start || scenario.value.horizon.end !== current.value.case.horizon.end) return { status: "conflict", reason: "alternative-basis-mismatch" }
    const coverageError = validateScenarioCoverage(scenario.value, coverage.value.basis, coverage.value.assessment)
    if (coverageError) return { status: "conflict", reason: coverageError }
    const alternative = { id: scenario.value.costCoverage.alternativeId, version: scenario.value.costCoverage.alternativeVersion, title: parsed.value.proposal.title, scenario: scenarioInput.value, result: scenario.value }
    if (!await input.authorizeProposal(parsed.value, alternative, coverage.value.basis, context).catch(() => false)) return { status: "denied", reason: "alternative-access-unavailable" }
    const previous = current.value.case.alternatives.find((item) => item.id === alternative.id)
    if (!alternative.id.trim() || !Number.isSafeInteger(alternative.version) || alternative.version !== (previous?.version ?? 0) + 1 || current.value.case.alternatives.some((item) => item.result.id === alternative.result.id)) return { status: "conflict", reason: "alternative-identity-conflict" }
    const again = await callProposalPort(() => input.cases.read({ caseRef: parsed.value.caseRef }, context))
    if (again.status !== "ok") return again
    if (again.value.case.version !== current.value.case.version || !await input.authorizeProposal(parsed.value, alternative, coverage.value.basis, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "stale", reason: "case-changed" }
    return { status: "ok", value: { caseRef: parsed.value.caseRef, proposal: alternative, costCoverageBasis: coverage.value.basis, coverageRef: coverage.value.coverageRef, domainApplied: false } }
  }
}

/** Prepares domain-produced changes without applying or mutating the bound case. */
export function createChangeProposalService(input: {
  cases: DecisionCasePort
  host: Pick<DomainPortHost, "revalidate">
  resolveChanges: (request: ChangePrepareRequest, context: TrustedDomainContext) => Promise<PortResult<{ changes: readonly { command: PreparedCommand; preview: ScenarioResult; targetEvidence: Extract<BusinessEvidenceRef, { kind: "record" }> }[]; conditions: readonly UnresolvedCondition[] }>>
  authorizeProposal: (request: ChangePrepareRequest, output: SfOperationOutputMap["sf_change_prepare"], context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (request: ChangePrepareRequest, context: TrustedDomainContext): Promise<PortResult<SfOperationOutputMap["sf_change_prepare"]>> => {
    const parsed = decodeSfOperationInput("sf_change_prepare", request)
    if (!parsed.ok || !parsed.value.operations.length) return { status: "needs-input", reason: "invalid-change-proposal" }
    const current = await callProposalPort(() => input.cases.read({ caseRef: parsed.value.caseRef }, context))
    if (current.status !== "ok") return current
    if (!current.value.case.choices.some((choice) => choice.id === parsed.value.choiceRef)) return { status: "unavailable", reason: "choice-unavailable" }
    const resolved = await callProposalPort(() => input.resolveChanges(parsed.value, context))
    if (resolved.status !== "ok") return resolved
    if (!resolved.value.changes.length) return { status: "unavailable", reason: "domain-commands-unavailable" }
    if (new Set(resolved.value.changes.map((item) => item.command.idempotencyKey)).size !== resolved.value.changes.length) return { status: "conflict", reason: "change-identity-conflict" }
    const changes = resolved.value.changes.map((item, index) => {
      const target = item.command.target
      const evidence = item.targetEvidence
      if (evidence.installationId !== context.binding.installationId || evidence.projectId !== context.binding.projectId || evidence.target.surface !== target.surface || evidence.target.recordType !== target.type || evidence.target.recordId !== target.id || evidence.target.incarnation !== target.incarnation || evidence.target.version !== target.version || !evidence.target.period || evidence.target.period.start > target.period.start || evidence.target.period.end < target.period.end || target.fields.some((field) => !evidence.target.fields.includes(field))) return undefined
      const prepared = prepareDomainChange({ case: current.value.case, expectedCaseVersion: current.value.case.version, choiceId: parsed.value.choiceRef, command: item.command, preview: item.preview, id: `proposal:${digestSfValue({ caseRef: parsed.value.caseRef, choiceRef: parsed.value.choiceRef, index, commandDigest: item.command.commandDigest })}` })
      if (prepared.status !== "ok") return undefined
      return { changeRef: prepared.change.id, targetRef: evidence, expectedVersion: prepared.change.expectedVersion, operationRef: item.command.id, previewRef: item.preview.id, requiredAuthority: prepared.change.requiredAuthority }
    })
    if (changes.some((change) => !change)) return { status: "conflict", reason: "invalid-domain-command" }
    const output: SfOperationOutputMap["sf_change_prepare"] = { caseRef: parsed.value.caseRef, caseVersion: current.value.case.version, changes: changes.filter((change): change is NonNullable<typeof change> => change !== undefined), conditions: resolved.value.conditions }
    if (!await input.authorizeProposal(parsed.value, output, context).catch(() => false)) return { status: "denied", reason: "change-access-unavailable" }
    const again = await callProposalPort(() => input.cases.read({ caseRef: parsed.value.caseRef }, context))
    if (again.status !== "ok") return again
    if (again.value.case.version !== current.value.case.version || !await input.authorizeProposal(parsed.value, output, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "stale", reason: "case-changed" }
    return { status: "ok", value: output }
  }
}

async function callProposalPort<T>(work: () => Promise<PortResult<T>>): Promise<PortResult<T>> {
  try {
    return await work()
  } catch {
    return { status: "unavailable", reason: "proposal-source-unavailable" }
  }
}
