import { digestSfValue } from "../contracts/canonical.ts"
import { reassessScenarioCoverage, validateScenarioCoverage } from "./cost-coverage.ts"
import type { createChangeProposalStore } from "./change-proposal-store.ts"
import { parseCaseRef } from "./case-port.ts"
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
  coverageEvidence?: { entries: (scenario: ScenarioResult, baseline: import("../contracts/decisions.ts").CostCoverageAssessment, context: TrustedDomainContext) => Promise<PortResult<readonly import("../contracts/decisions.ts").CostCoverageEntry[]>>; resolve: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<readonly import("../contracts/business-context.ts").BusinessEvidenceResolution[]>; supports: Parameters<typeof reassessScenarioCoverage>[0]["supports"] }
  host: Pick<DomainPortHost, "revalidate">
  resolveAlternative: (request: AlternativeDraftRequest, context: TrustedDomainContext) => Promise<PortResult<{ scenario: ScenarioRequest; coverageRef: string }>>
  registerProposalCoverage?: (request: { caseRef: string; expectedCaseVersion: number; basis: CostCoverageBasis; assessment: import("../contracts/decisions.ts").CostCoverageAssessment; result: ScenarioResult; scenario: ScenarioRequest }, context: TrustedDomainContext) => Promise<PortResult<{ coverageRef: string }>>
  authorizeProposal: (request: AlternativeDraftRequest, proposal: SfOperationOutputMap["sf_alternative_draft"]["proposal"], basis: CostCoverageBasis, context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (request: AlternativeDraftRequest, context: TrustedDomainContext): Promise<PortResult<SfOperationOutputMap["sf_alternative_draft"]>> => {
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
    const reassessed = digestSfValue(scenario.value.costCoverage) !== digestSfValue(coverage.value.assessment)
    const entries = reassessed && input.coverageEvidence ? await callProposalPort(() => input.coverageEvidence!.entries(scenario.value, coverage.value.assessment, context)) : undefined
    if (entries && entries.status !== "ok") return entries
    const evaluated = !reassessed ? scenario.value : input.coverageEvidence && entries?.status === "ok" ? await reassessScenarioCoverage({ scenario: scenario.value, basis: coverage.value.basis, baseline: coverage.value.assessment, entries: entries.value, resolveEvidence: (refs) => input.coverageEvidence!.resolve(refs, context), supports: input.coverageEvidence.supports }) : undefined
    if (!evaluated) return { status: "unavailable", reason: "scenario-coverage-reassessment-unavailable" }
    const previous = current.value.case.alternatives.find((item) => item.id === evaluated.costCoverage.alternativeId)
    const provisional = evaluated.costCoverage.alternativeVersion !== (previous?.version ?? 0) + 1 || current.value.case.alternatives.some((item) => item.result.id === evaluated.id)
    const identity = provisional ? { alternativeId: `proposal:${digestSfValue({ caseRef: parsed.value.caseRef, request: parsed.value, scenario: scenarioInput.value })}`, alternativeVersion: 1 } : { alternativeId: evaluated.costCoverage.alternativeId, alternativeVersion: evaluated.costCoverage.alternativeVersion }
    const result: ScenarioResult = evaluated.comparisonStatus === "complete" ? { ...evaluated, costCoverage: { ...evaluated.costCoverage, ...identity } } : { ...evaluated, costCoverage: { ...evaluated.costCoverage, ...identity } }
    const coverageError = validateScenarioCoverage(result, coverage.value.basis, result.costCoverage)
    if (coverageError) return { status: "conflict", reason: coverageError }
    const alternative = { id: result.costCoverage.alternativeId, version: result.costCoverage.alternativeVersion, title: parsed.value.proposal.title, scenario: scenarioInput.value, result }
    if (!alternative.id.trim() || !Number.isSafeInteger(alternative.version) || !await input.authorizeProposal(parsed.value, alternative, coverage.value.basis, context).catch(() => false)) return { status: "denied", reason: "alternative-access-unavailable" }
    const again = await callProposalPort(() => input.cases.read({ caseRef: parsed.value.caseRef }, context))
    if (again.status !== "ok") return again
    if (again.value.case.version !== current.value.case.version || !await input.authorizeProposal(parsed.value, alternative, coverage.value.basis, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "stale", reason: "case-changed" }
    const changed = digestSfValue(result.costCoverage) !== digestSfValue(coverage.value.assessment)
    if (changed && !input.registerProposalCoverage) return { status: "unavailable", reason: "proposal-coverage-registration-unavailable" }
    const registered = changed ? await callProposalPort(() => input.registerProposalCoverage!({ caseRef: parsed.value.caseRef, expectedCaseVersion: current.value.case.version, basis: coverage.value.basis, assessment: result.costCoverage, result, scenario: scenarioInput.value }, context)) : { status: "ok" as const, value: { coverageRef: coverage.value.coverageRef } }
    if (registered.status !== "ok" || !registered.value.coverageRef.trim()) return { status: "unavailable", reason: "proposal-coverage-registration-unavailable" }
    const coverageRef = registered.value.coverageRef
    const proof = await callProposalPort(() => input.sources.resolveForecastCoverage(coverageRef, context))
    const finalCase = await callProposalPort(() => input.cases.read({ caseRef: parsed.value.caseRef }, context))
    if (finalCase.status !== "ok" || finalCase.value.case.version !== current.value.case.version || proof.status !== "ok" || proof.value.coverageRef !== coverageRef || digestSfValue(proof.value.basis) !== digestSfValue(coverage.value.basis) || digestSfValue(proof.value.assessment) !== digestSfValue(result.costCoverage) || !await input.authorizeProposal(parsed.value, alternative, coverage.value.basis, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "unavailable", reason: "proposal-coverage-proof-unavailable" }
    return { status: "ok", value: { caseRef: parsed.value.caseRef, proposal: alternative, costCoverageBasis: coverage.value.basis, coverageRef, domainApplied: false } }
  }
}

/** Prepares domain-produced changes without applying or mutating the bound case. */
export function createChangeProposalService(input: {
  cases: DecisionCasePort
  host: Pick<DomainPortHost, "revalidate">
  resolveChanges: (request: ChangePrepareRequest, context: TrustedDomainContext) => Promise<PortResult<{ changes: readonly { command: PreparedCommand; preview: ScenarioResult; targetEvidence: Extract<BusinessEvidenceRef, { kind: "record" }> }[]; conditions: readonly UnresolvedCondition[] }>>
  store: ReturnType<typeof createChangeProposalStore>
  resolvePreview: (request: { caseRef: { id: string; incarnation: string; version: number }; choiceId: string; preview: ScenarioResult }, context: TrustedDomainContext) => Promise<PortResult<{ previewRef: string }>>
  authorizeProposal: (request: ChangePrepareRequest, output: SfOperationOutputMap["sf_change_prepare"], context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (request: ChangePrepareRequest, context: TrustedDomainContext): Promise<PortResult<SfOperationOutputMap["sf_change_prepare"]>> => {
    const parsed = decodeSfOperationInput("sf_change_prepare", request)
    if (!parsed.ok || !parsed.value.operations.length) return { status: "needs-input", reason: "invalid-change-proposal" }
    const current = await callProposalPort(() => input.cases.read({ caseRef: parsed.value.caseRef }, context))
    if (current.status !== "ok") return current
    if (!current.value.case.choices.some((choice) => choice.id === parsed.value.choiceRef)) return { status: "unavailable", reason: "choice-unavailable" }
    const caseRef = parseCaseRef(parsed.value.caseRef)
    if (!caseRef) return { status: "needs-input", reason: "invalid-case-reference" }
    const scopedCase = { ...caseRef, version: current.value.case.version }
    const prior = await input.store.readByRequest({ caseRef: scopedCase, request: parsed.value }, context)
    if (prior.status !== "ok") return prior
    if (prior.value.state === "found") return await input.authorizeProposal(parsed.value, prior.value.output, context).catch(() => false) && await input.host.revalidate(context).catch(() => false) ? { status: "ok", value: prior.value.output } : { status: "denied", reason: "change-access-unavailable" }
    const resolved = await callProposalPort(() => input.resolveChanges(parsed.value, context))
    if (resolved.status !== "ok") return resolved
    if (!resolved.value.changes.length) return { status: "unavailable", reason: "domain-commands-unavailable" }
    if (new Set(resolved.value.changes.map((item) => item.command.idempotencyKey)).size !== resolved.value.changes.length) return { status: "conflict", reason: "change-identity-conflict" }
    const previews = await Promise.all(resolved.value.changes.map((item) => input.resolvePreview({ caseRef: scopedCase, choiceId: parsed.value.choiceRef, preview: item.preview }, context)))
    const failedPreview = previews.find((item) => item.status !== "ok")
    if (failedPreview && failedPreview.status !== "ok") return failedPreview
    const changes = resolved.value.changes.map((item, index) => {
      const target = item.command.target
      const evidence = item.targetEvidence
      if (evidence.installationId !== context.binding.installationId || evidence.projectId !== context.binding.projectId || evidence.target.surface !== target.surface || evidence.target.recordType !== target.type || evidence.target.recordId !== target.id || evidence.target.incarnation !== target.incarnation || evidence.target.version !== target.version || !evidence.target.period || evidence.target.period.start > target.period.start || evidence.target.period.end < target.period.end || target.fields.some((field) => !evidence.target.fields.includes(field))) return undefined
      const prepared = prepareDomainChange({ case: current.value.case, expectedCaseVersion: current.value.case.version, choiceId: parsed.value.choiceRef, command: item.command, preview: item.preview, id: `proposal:${digestSfValue({ caseRef: parsed.value.caseRef, choiceRef: parsed.value.choiceRef, index, commandDigest: item.command.commandDigest })}` })
      if (prepared.status !== "ok") return undefined
      const preview = previews[index]
      if (!preview || preview.status !== "ok" || !preview.value.previewRef.trim()) return undefined
      return { command: item.command, preview: item.preview, previewRef: preview.value.previewRef, targetEvidence: evidence }
    })
    if (changes.some((change) => !change)) return { status: "conflict", reason: "invalid-domain-command" }
    const saved = await input.store.register({ caseRef: scopedCase, request: parsed.value, changes: changes.filter((change): change is NonNullable<typeof change> => change !== undefined), conditions: resolved.value.conditions }, context)
    if (saved.status !== "ok") return saved
    const output = saved.value
    if (!await input.authorizeProposal(parsed.value, output, context).catch(() => false)) return { status: "denied", reason: "change-access-unavailable" }
    const again = await callProposalPort(() => input.cases.read({ caseRef: parsed.value.caseRef }, context))
    if (again.status !== "ok") return again
    const previewsAgain = await Promise.all(resolved.value.changes.map((item) => input.resolvePreview({ caseRef: scopedCase, choiceId: parsed.value.choiceRef, preview: item.preview }, context)))
    if (again.value.case.version !== current.value.case.version || digestSfValue(previewsAgain) !== digestSfValue(previews) || !await input.authorizeProposal(parsed.value, output, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "stale", reason: "case-or-preview-changed" }
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
