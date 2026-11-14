import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { ScenarioResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createDecisionProposalService } from "../../../../modules/sucafina/Sucafinav1/product/decisions/proposals.ts"
import { createAlternativeReadOnlyReplay } from "../../../../modules/sucafina/Sucafinav1/product/decisions/alternative-replay.ts"
import { createProposalCoverageRegistry } from "../../../../modules/sucafina/Sucafinav1/product/decisions/proposal-coverage.ts"
import type { ProposalCoverage } from "../../../../modules/sucafina/Sucafinav1/product/decisions/proposal-coverage.ts"
import { createDecisionProducerFences } from "../../../../modules/sucafina/Sucafinav1/product/decisions/producer-fences.ts"
import { reassessScenarioCoverage, validateScenarioCoverage } from "../../../../modules/sucafina/Sucafinav1/product/decisions/cost-coverage.ts"
import { createSfAlternativeSelections } from "./alternative-selections.ts"
import type { SfAlternativeSelection } from "./alternative-selections.ts"
import type { createSfBusinessServices } from "./business-services.ts"

type ProposalInput = Parameters<typeof createDecisionProposalService>[0]

/** C11 proposals and replay share the same human selection, Planner engine and cost evidence. */
export function createSfAlternativeServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  proposalCoverageWrites: WeakSet<object>
}) {
  const { authority, business } = input
  const host = authority.host
  const choices = createSfAlternativeSelections(input)
  const selected = new WeakMap<TrustedDomainContext, SfAlternativeSelection>()
  const approvedEntries = new WeakMap<object, string>()
  const fences = createDecisionProducerFences({ host, operationIdentity: business.operationIdentity,
    readSourceFences: business.readSourceFences, lockedSourceFences: business.lockedSourceFences })
  const resolveAlternative: ProposalInput["resolveAlternative"] = async (request, call) => {
    const record = await choices.read(request, call)
    if (record.status !== "ok") return record
    selected.set(call, record.value)
    return { status: "ok", value: { scenario: record.value.scenario, coverageRef: record.value.coverageRef } }
  }
  const coverageEvidence: NonNullable<ProposalInput["coverageEvidence"]> = {
    entries: async (scenario, baseline, call) => {
      const chosen = selected.get(call)
      if (!chosen) return { status: "needs-input", reason: "human-alternative-selection-required" }
      const again = await choices.read(chosen.request, call)
      const coverage = await business.plannerSources.resolveForecastCoverage(chosen.coverageRef, call)
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(chosen) || coverage.status !== "ok" ||
        digestSfValue(coverage.value.assessment) !== digestSfValue(baseline) || baseline.currency !== scenario.currency ||
        digestSfValue(baseline.horizon) !== digestSfValue(scenario.horizon) || !await host.revalidate(call)) return { status: "stale", reason: "alternative-coverage-changed" }
      // These are the existing human classifications. The domain reassessment checks them against
      // the new components and current evidence; no category or non-applicability is invented here.
      const entries = structuredClone(baseline.entries)
      for (const entry of entries) if (entry.status !== "pending") approvedEntries.set(entry, digestSfValue(entry))
      return { status: "ok", value: entries }
    },
    resolve: (refs, call) => business.context.context({ refs }, call),
    supports: (entry, resolutions) => approvedEntries.get(entry) === digestSfValue(entry) && entry.evidenceRefs.length > 0 &&
      entry.evidenceRefs.every((ref) => resolutions.some((value) => value.state === "fresh" && !!value.authorizedProjection && !!value.currentRef &&
        digestSfValue(value.ref) === digestSfValue(ref) && digestSfValue(value.currentRef) === digestSfValue(ref))),
  }
  const evaluate = async (selection: SfAlternativeSelection, call: TrustedDomainContext) => {
    const active = await choices.read(selection.request, call)
    const current = await business.cases.read({ caseRef: selection.request.caseRef }, call)
    if (active.status !== "ok" || digestSfValue(active.value) !== digestSfValue(selection) || current.status !== "ok" || current.value.case.version !== selection.caseRef.version) return undefined
    selected.set(call, selection)
    const simulation = await business.planner.simulateScenario(selection.scenario, call)
    const coverage = await business.plannerSources.resolveForecastCoverage(selection.coverageRef, call)
    if (simulation.status !== "ok" || coverage.status !== "ok" || digestSfValue(coverage.value) !== selection.coverageDigest ||
      simulation.value.currency !== current.value.case.currency || digestSfValue(simulation.value.horizon) !== digestSfValue(current.value.case.horizon)) return undefined
    const changed = digestSfValue(simulation.value.costCoverage) !== digestSfValue(coverage.value.assessment)
    const entries = changed ? await coverageEvidence.entries(simulation.value, coverage.value.assessment, call) : undefined
    if (entries && entries.status !== "ok") return undefined
    const evaluated = !changed ? simulation.value : entries?.status === "ok" ? await reassessScenarioCoverage({ scenario: simulation.value, basis: coverage.value.basis,
      baseline: coverage.value.assessment, entries: entries.value, resolveEvidence: (refs) => coverageEvidence.resolve(refs, call), supports: coverageEvidence.supports }) : undefined
    if (!evaluated) return undefined
    const previous = current.value.case.alternatives.find((value) => value.id === evaluated.costCoverage.alternativeId)
    const provisional = evaluated.costCoverage.alternativeVersion !== (previous?.version ?? 0) + 1 || current.value.case.alternatives.some((value) => value.result.id === evaluated.id)
    const identity = provisional ? { alternativeId: `proposal:${digestSfValue({ caseRef: selection.request.caseRef, request: selection.request, scenario: selection.scenario })}`, alternativeVersion: 1 }
      : { alternativeId: evaluated.costCoverage.alternativeId, alternativeVersion: evaluated.costCoverage.alternativeVersion }
    const result: ScenarioResult = evaluated.comparisonStatus === "complete"
      ? { ...evaluated, costCoverage: { ...evaluated.costCoverage, ...identity } }
      : { ...evaluated, costCoverage: { ...evaluated.costCoverage, ...identity } }
    if (validateScenarioCoverage(result, coverage.value.basis, result.costCoverage)) return undefined
    const again = await business.cases.read({ caseRef: selection.request.caseRef }, call)
    if (again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(current.value.case) || !await host.revalidate(call)) return undefined
    return { coverage: coverage.value, result, proposal: { id: identity.alternativeId, version: identity.alternativeVersion,
      title: selection.request.proposal.title, scenario: selection.scenario, result } }
  }
  const authorizeProposal: ProposalInput["authorizeProposal"] = async (request, proposal, basis, call) => {
    const choice = await choices.read(request, call)
    if (choice.status !== "ok") return false
    const expected = await evaluate(choice.value, call)
    return !!expected && digestSfValue(expected.proposal) === digestSfValue(proposal) && digestSfValue(expected.coverage.basis) === digestSfValue(basis) && await host.revalidate(call)
  }
  const verified = new WeakMap<TrustedDomainContext, Map<string, { record: string; decision: string }>>()
  const verifyEvidence = async (record: ProposalCoverage, call: TrustedDomainContext) => {
    if (!await fences.capture(call, "alternative-coverage", record.inputDigest)) return false
    const candidates = await choices.candidates(record.caseRef, record.scenario, call)
    if (candidates.status !== "ok") return false
    let matches = 0
    for (const candidate of candidates.value) {
      const proof = await evaluate(candidate, call)
      if (proof && digestSfValue(proof.result) === digestSfValue(record.result) && digestSfValue(proof.result.costCoverage) === digestSfValue(record.assessment) &&
        digestSfValue(proof.coverage.basis) === digestSfValue(record.basis)) matches += 1
    }
    if (matches !== 1) return false
    const request = host.requestFor(call)
    if (!request || !await host.revalidate(call)) return false
    const current = await authority.state.read(request, "cases", (state, actor) => actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision &&
      actor.policyVersion === call.binding.policyVersion ? state.cases[record.caseRef.id] : undefined)
    if (current.status !== "ok" || !current.value || current.value.incarnation !== record.caseRef.incarnation || current.value.version !== record.caseRef.version ||
      !current.value.participants.includes(call.binding.principalRef)) return false
    const records = verified.get(call) ?? new Map<string, { record: string; decision: string }>()
    records.set(record.ref, { record: digestSfValue(record), decision: digestSfValue(current.value) })
    verified.set(call, records)
    return await host.revalidate(call)
  }
  const coverage = createProposalCoverageRegistry({ state: authority.state, host, proposalCoverageWrites: input.proposalCoverageWrites,
    operationIdentity: business.operationIdentity, now: () => new Date().toISOString(),
    authorizeCase: async (decision, call) => decision.participants.includes(call.binding.principalRef) && await host.revalidate(call), verifyEvidence,
    verifySnapshot: (_snapshot, record, call) => {
      const proof = verified.get(call)?.get(record.ref)
      const snapshots = host.persistence.currentSnapshots?.()
      return !!proof && !!snapshots && proof.record === digestSfValue(record) && proof.decision === digestSfValue(object(object(snapshots.dashboard.data.__sfProductV1).cases)[record.caseRef.id]) &&
        fences.verify(call, "alternative-coverage", record.inputDigest)
    } })
  const sources = { ...business.plannerSources, resolveForecastCoverage: (ref: string, call: TrustedDomainContext) =>
    ref.startsWith("proposal-coverage:") ? coverage.resolveForecastCoverage(ref, call) : business.plannerSources.resolveForecastCoverage(ref, call) }
  const ports = { cases: business.cases, planner: business.planner, sources, host, resolveAlternative, authorizeProposal, coverageEvidence }
  return { choices, coverage, proposal: createDecisionProposalService({ ...ports, registerProposalCoverage: coverage.registerProposalCoverage }),
    replay: createAlternativeReadOnlyReplay(ports) }
}
