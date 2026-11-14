import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { CostCoverageEntry } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { encodeCaseRef, parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { createDecisionPortfolioSelection } from "../../../../modules/sucafina/Sucafinav1/product/decisions/portfolio-selection.ts"
import { decisionCoverageRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-access.ts"
import { createDecisionProposalService } from "../../../../modules/sucafina/Sucafinav1/product/decisions/proposals.ts"
import { createProposalCoverageRegistry } from "../../../../modules/sucafina/Sucafinav1/product/decisions/proposal-coverage.ts"
import { createAlternativeReadOnlyReplay } from "../../../../modules/sucafina/Sucafinav1/product/decisions/alternative-replay.ts"
import { createDecisionProducerFences } from "../../../../modules/sucafina/Sucafinav1/product/decisions/producer-fences.ts"
import { supportsCoverageClassification } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-classification.ts"
import type { CoverageClassification } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-classification.ts"
import type { createDecisionEvidenceChecks } from "../../../../modules/sucafina/Sucafinav1/product/decisions/host-evidence.ts"
import { reassessScenarioCoverage } from "../../../../modules/sucafina/Sucafinav1/product/decisions/cost-coverage.ts"
import { verifyDecisionPlannerSources } from "../../../../modules/sucafina/Sucafinav1/product/decisions/baseline-fence.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/candidates.ts"
import { createSfDecisionPlannerActors } from "./decision-baseline-services.ts"
import type { createSfDecisionBaselineServices } from "./decision-baseline-services.ts"
import type { createSfBusinessServices } from "./business-services.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type SelectedScenario = { caseRef: CaseRef; scenario: ScenarioRequest; coverageRef: string }

/** The model names a draft; its scenario is selected by human authority held outside the payload. */
export function createSfDecisionAlternativeServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  baseline: ReturnType<typeof createSfDecisionBaselineServices>
  selection: Pick<ReturnType<typeof createDecisionPortfolioSelection>, "read">
  checks: Pick<ReturnType<typeof createDecisionEvidenceChecks>, "refs">
  selectedCase: (call: TrustedDomainContext) => Promise<PortResult<CaseRef>>
  verifiedInputFor?: (call: TrustedDomainContext) => Promise<PortResult<unknown>>
  hasAdmittedInputContext?: (call: TrustedDomainContext) => boolean
  proposalCoverageWrites: WeakSet<object>
}) {
  const business = input.business
  const host = input.authority.host
  const actors = createSfDecisionPlannerActors(input.authority)
  const fences = createDecisionProducerFences({ host, operationIdentity: business.operationIdentity, readSourceFences: business.readSourceFences, lockedSourceFences: business.lockedSourceFences })
  const candidate = createDecisionCandidateResolver(business.cases)
  const selectedScenario = async (call: TrustedDomainContext): Promise<PortResult<SelectedScenario>> => {
    const selected = await input.selectedCase(call)
    if (selected.status !== "ok") return selected
    const current = await business.cases.read({ caseRef: encodeCaseRef(selected.value) }, call)
    if (current.status !== "ok" || current.value.case.version !== selected.value.version) return { status: "unavailable", reason: "alternative-selected-case-unavailable" }
    if (call.kind === "native" || input.hasAdmittedInputContext?.(call)) {
      if (!input.verifiedInputFor) return { status: "unavailable", reason: "alternative-run-input-unavailable" }
      const admitted = await input.verifiedInputFor(call)
      if (admitted.status !== "ok") return admitted
      const decoded = decodeSfSkillInput("PortfolioCompositionInput", admitted.value)
      if (!decoded.ok || decoded.value.candidates.length !== 1 || decoded.value.request.candidateRefs.length !== 1 || decoded.value.costCoverageRefs.length !== 1 ||
        !same(decoded.value.candidates[0]!.case, selected.value)) return { status: "needs-input", reason: "alternative-single-bound-candidate-required" }
      const ref = decoded.value.request.candidateRefs[0]!
      const resolved = await candidate(ref, call)
      if (resolved.status !== "ok") return resolved
      const alternatives = current.value.case.alternatives.filter((value) => portfolioCandidateRef({ caseRef: encodeCaseRef(selected.value), caseVersion: selected.value.version, alternativeId: value.id, alternativeVersion: value.version }) === ref)
      if (alternatives.length !== 1 || !resolved.value.result || !same(alternatives[0]!.result, decoded.value.candidates[0]!.result) || !same(resolved.value.result, alternatives[0]!.result) ||
        !same(resolved.value.scenario, alternatives[0]!.scenario) || !same(resolved.value.operations, resolved.value.scenario.operations)) return { status: "stale", reason: "alternative-selected-candidate-changed" }
      const coverageRef = decisionCoverageRef(selected.value, alternatives[0]!.id, alternatives[0]!.version)
      const scenario = decodeSfOperationInput("sf_scenario_simulate", { ...resolved.value.scenario, operations: [...resolved.value.operations, ...decoded.value.request.operations] })
      const again = await input.verifiedInputFor(call)
      if (!scenario.ok || decoded.value.costCoverageRefs[0] !== coverageRef || again.status !== "ok" || !same(again.value, admitted.value) || !await host.revalidate(call)) return { status: "unavailable", reason: "alternative-run-selection-changed" }
      return { status: "ok", value: { caseRef: selected.value, scenario: scenario.value, coverageRef } }
    }
    const approved = await input.selection.read({ caseRef: selected.value }, call)
    if (approved.status !== "ok") return approved
    const alternatives = current.value.case.alternatives.filter((value) => value.id === approved.value.alternativeId)
    const again = await business.cases.read({ caseRef: encodeCaseRef(selected.value) }, call)
    if (alternatives.length !== 1 || again.status !== "ok" || !same(again.value.case, current.value.case) || !await host.revalidate(call)) return { status: "stale", reason: "alternative-selected-candidate-changed" }
    return { status: "ok", value: { caseRef: selected.value, scenario: alternatives[0]!.scenario,
      coverageRef: decisionCoverageRef(selected.value, alternatives[0]!.id, alternatives[0]!.version) } }
  }
  const classifications = new WeakMap<object, CoverageClassification>()
  const coverageEvidence: NonNullable<Parameters<typeof createDecisionProposalService>[0]["coverageEvidence"]> = {
    entries: async (_scenario, baseline, call) => {
      const selected = await selectedScenario(call)
      if (selected.status !== "ok") return selected
      const classification = await input.baseline.readClassification(selected.value.scenario.baseRef, call)
      if (classification.status !== "ok") return classification
      if (classification.value.basis.id !== baseline.basisId || classification.value.basis.version !== baseline.basisVersion || baseline.entries.some((entry) => entry.status === "not-applicable")) return { status: "needs-input", reason: "alternative-coverage-classification-required" }
      const entries: readonly CostCoverageEntry[] = structuredClone(baseline.entries)
      for (const entry of entries) if (entry.status !== "pending") classifications.set(entry, classification.value)
      return { status: "ok", value: entries }
    },
    resolve: (refs, call) => business.context.context({ refs }, call),
    supports: (entry, evidence) => {
      const classification = classifications.get(entry)
      return !!classification && supportsCoverageClassification(classification, entry, evidence)
    },
  }
  const resolveAlternative: Parameters<typeof createDecisionProposalService>[0]["resolveAlternative"] = async (request, call) => {
    const ref = parseCaseRef(request.caseRef)
    const selected = await selectedScenario(call)
    if (selected.status !== "ok") return selected
    if (!ref || ref.id !== selected.value.caseRef.id || ref.incarnation !== selected.value.caseRef.incarnation) return { status: "denied", reason: "alternative-outside-bound-case" }
    return { status: "ok", value: { scenario: selected.value.scenario, coverageRef: selected.value.coverageRef } }
  }
  const authorizeProposal: Parameters<typeof createDecisionProposalService>[0]["authorizeProposal"] = async (request, proposal, basis, call) => {
    const selected = await resolveAlternative(request, call)
    if (selected.status !== "ok" || !same(proposal.scenario, selected.value.scenario) || proposal.title !== request.proposal.title) return false
    const coverage = await business.plannerSources.resolveForecastCoverage(selected.value.coverageRef, call)
    const refs = [...request.sourceRefs, ...request.proposal.sourceRefs, ...basis.sourceRefs, ...proposal.result.sourceRefs,
      ...proposal.result.costCoverage.evaluatedSourceRefs, ...proposal.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
    return coverage.status === "ok" && same(coverage.value.basis, basis) && refs.length > 0 && await input.checks.refs(refs, call) && await host.revalidate(call)
  }
  const coverage = createProposalCoverageRegistry({ state: input.authority.state, host, authorizeCase: business.authorizeCase,
    operationIdentity: business.operationIdentity, proposalCoverageWrites: input.proposalCoverageWrites, now: () => new Date().toISOString(),
    verifyEvidence: async (record, call) => {
      const selected = await selectedScenario(call)
      if (selected.status !== "ok" || !same(selected.value.caseRef, record.caseRef) || !same(record.scenario, selected.value.scenario)) return false
      const original = await business.plannerSources.resolveForecastCoverage(selected.value.coverageRef, call)
      const computed = await business.planner.simulateScenario(record.scenario, call)
      if (original.status !== "ok" || computed.status !== "ok" || !same(original.value.basis, record.basis)) return false
      const entries = await coverageEvidence.entries(computed.value, original.value.assessment, call)
      if (entries.status !== "ok") return false
      const evaluated = same(computed.value.costCoverage, original.value.assessment) ? computed.value : await reassessScenarioCoverage({ scenario: computed.value,
        basis: original.value.basis, baseline: original.value.assessment, entries: entries.value, resolveEvidence: (refs) => coverageEvidence.resolve(refs, call), supports: coverageEvidence.supports })
      if (!evaluated || !same({ ...evaluated, costCoverage: { ...evaluated.costCoverage, alternativeId: record.assessment.alternativeId, alternativeVersion: record.assessment.alternativeVersion } }, record.result) ||
        !record.sourceRefs.length || !await input.checks.refs(record.sourceRefs, call) || !await actors.capture(call)) return false
      return fences.capture(call, "alternative-coverage", record.inputDigest)
    },
    verifySnapshot: (snapshot, record, call) => {
      const actor = actors.locked(snapshot, call)
      return !!actor && fences.verify(call, "alternative-coverage", record.inputDigest) && verifyDecisionPlannerSources(snapshot, record.sourceRefs, actor, call)
    } })
  const common = { cases: business.cases, planner: business.planner, sources: business.plannerSources, host, resolveAlternative, authorizeProposal, coverageEvidence }
  return { alternative: createDecisionProposalService({ ...common, registerProposalCoverage: coverage.registerProposalCoverage }),
    replayAlternative: createAlternativeReadOnlyReplay(common), proposalCoverage: { resolveForecastCoverage: coverage.resolveForecastCoverage } }
}

function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
