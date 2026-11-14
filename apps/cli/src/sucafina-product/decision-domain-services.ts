import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { AuthorizedCaseProjection } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { encodeCaseRef, parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { createCriterionRuleRegistry, createCriterionResultBindings } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts"
import type { CriterionMetric } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts"
import { createCriterionComparisonBindings } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-comparison.ts"
import { createDecisionComparisonService } from "../../../../modules/sucafina/Sucafinav1/product/decisions/comparison.ts"
import { createDecisionPortfolioSelection } from "../../../../modules/sucafina/Sucafinav1/product/decisions/portfolio-selection.ts"
import { createPortfolioResultBindings } from "../../../../modules/sucafina/Sucafinav1/product/decisions/portfolio-bindings.ts"
import { createDecisionIntentFences } from "../../../../modules/sucafina/Sucafinav1/product/decisions/intent-fences.ts"
import { createDecisionEvidenceChecks } from "../../../../modules/sucafina/Sucafinav1/product/decisions/host-evidence.ts"
import { verifyDecisionPlannerSources } from "../../../../modules/sucafina/Sucafinav1/product/decisions/baseline-fence.ts"
import { decisionCoverageRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-access.ts"
import { createPlannerSensitivityUnits } from "../../../../modules/sucafina/Sucafinav1/product/planner/sensitivity-units.ts"
import { createPlannerCriterionMetric } from "../../../../modules/sucafina/Sucafinav1/product/planner/criterion-metric.ts"
import { comparePlannerPreview } from "../../../../modules/sucafina/Sucafinav1/product/planner/preview-comparison.ts"
import { createPlannerResultPersistence } from "../../../../modules/sucafina/Sucafinav1/product/planner/persistence.ts"
import type { PlannerCriteriaHost } from "../../../../modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts"
import { createPortfolioProduct } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/product.ts"
import { createPortfolioProofVerifier } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/verification.ts"
import { createPortfolioAnalysis } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/analysis.ts"
import { createPortfolioSelectionResolver } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/selection.ts"
import { createDecisionCandidateResolver } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/candidates.ts"
import { createSfDecisionPlannerActors } from "./decision-baseline-services.ts"
import type { createSfDecisionBaselineServices } from "./decision-baseline-services.ts"
import { createSfDecisionMaterialityServices } from "./decision-materiality-services.ts"
import { createSfDecisionProposalServices } from "./decision-proposal-services.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfPortfolioServices } from "./portfolio-services.ts"
import type { SfAnalysisServiceBindings } from "./analysis-services.ts"
import type { SfAdmittedAlternativeSelection } from "./decision-alternative-services.ts"

type CaseRef = { id: string; incarnation: string; version: number }

/** Domain producers and durable proof registries share the installation's existing C08 store. */
export function createSfDecisionDomainServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  baseline: ReturnType<typeof createSfDecisionBaselineServices>
  proposalCoverageWrites: WeakSet<object>
  signalRegistryWrites: WeakSet<object>
  selectedCase: (call: TrustedDomainContext) => Promise<PortResult<CaseRef>>
  verifiedInputFor?: (call: TrustedDomainContext) => Promise<PortResult<unknown>>
  verifiedAlternativeSelectionFor?: (call: TrustedDomainContext) => Promise<PortResult<SfAdmittedAlternativeSelection>>
  hasAdmittedInputContext?: (call: TrustedDomainContext) => boolean
  readAlternativeCapture?: NonNullable<SfAnalysisServiceBindings["portfolio"]>["readAlternativeCapture"]
  sharedPortfolio?: ReturnType<typeof createSfPortfolioServices>
}) {
  const business = input.business
  const host = input.authority.host
  const scenarios = business.plannerProduct.scenarios
  if (!scenarios) throw new Error("SF_DECISION_STORED_SCENARIOS_REQUIRED")
  const planner = { planner: business.planner, sources: business.plannerSources, scenarios }
  const common = { state: input.authority.state, host, authorizeCase: business.authorizeCase, operationIdentity: business.operationIdentity,
    proposalCoverageWrites: input.proposalCoverageWrites, now: () => new Date().toISOString() }
  const actors = createSfDecisionPlannerActors(input.authority)
  const intent = createDecisionIntentFences({ human: input.authority.human, ui: input.authority.ui, readSourceFences: business.readSourceFences, lockedSourceFences: business.lockedSourceFences })
  const selectionCases = new WeakMap<TrustedDomainContext, AuthorizedCaseProjection["case"]>()
  const preview: Parameters<typeof createPlannerCriterionMetric>[0]["preview"] = (request, call) => comparePlannerPreview({ host, ...planner }, request, call)
  const checks = createDecisionEvidenceChecks({ host, evidence: business.context,
    recomputeMetric: (value, call) => metric(metricRequest(value), call) })
  const rawCase = async (ref: CaseRef, call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    const selected = await input.selectedCase(call)
    if (!request || selected.status !== "ok" || !same(selected.value, ref) || !await host.revalidate(call)) return undefined
    const found = await input.authority.state.read(request, "cases", (state, actor) => actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion ? state.cases[ref.id] : undefined)
    return found.status === "ok" && found.value && found.value.incarnation === ref.incarnation && found.value.version === ref.version && await business.authorizeCase(found.value, call) ? found.value : undefined
  }
  const rules: ReturnType<typeof createCriterionRuleRegistry> = createCriterionRuleRegistry({ ...common,
    authorizeRule: (request, call) => intent.authorize(call, "decisions.criteria", request),
    verifyEvidence: async (rule, call) => {
      const selected = await input.selectedCase(call)
      if (selected.status !== "ok" || selected.value.id !== rule.caseRef.id || selected.value.incarnation !== rule.caseRef.incarnation || selected.value.version < rule.caseRef.version ||
        rule.metricRef !== "planner:known-subtotal-difference" || !rule.sensitivity || rule.unit !== rule.sensitivity.resultUnit || !await checks.rule(rule, call)) return false
      const current = await rawCase(selected.value, call)
      const baseline = await business.results.readHistoricalScenario({ resultRef: rule.sensitivity.baselineRef }, call)
      return !!current && same(current.horizon, rule.period) && current.currency === rule.unit && baseline.status === "ok" && baseline.value.kind === "scenario" &&
        baseline.value.caseRef.id === current.id && baseline.value.caseRef.incarnation === current.incarnation && baseline.value.caseRef.version <= current.version &&
        baseline.value.result.currency === rule.unit && same(baseline.value.result.horizon, rule.period) && await host.revalidate(call)
    },
    verifySnapshot: (snapshot, request, rule, call) => {
      const actor = actors.locked(snapshot, call)
      return !!actor && intent.verify(call, "decisions.criteria", request) && verifyDecisionPlannerSources(snapshot, [...rule.evidenceRefs, ...(rule.sensitivity?.sourceRefs ?? [])], actor, call)
    },
    readMetric: (request, call) => metric(request, call), verifyMetric: checks.metric })
  const units = input.sharedPortfolio?.units ?? createPlannerSensitivityUnits({ host, cases: business.cases, scenarios, store: business.results, evidence: business.context, rules })
  const metric = createPlannerCriterionMetric({ host, rules, units, preview })
  const plannerCriteria: PlannerCriteriaHost = { evaluate: async (request, call) => {
    const selected = await input.selectedCase(call)
    if (selected.status !== "ok") return selected
    return rules.evaluate({ ...request, caseRef: selected.value }, call)
  } }
  const compare = createDecisionComparisonService({ state: input.authority.state, cases: business.cases, results: business.results, planner: business.planner, host })
  const selectedPortfolio = input.sharedPortfolio?.selection ?? createDecisionPortfolioSelection({ ...common, compare,
    authorizeSelection: (request, call) => intent.authorize(call, "decisions.select-portfolio", request),
    verifySnapshot: (snapshot, request, selected, call) => {
      const current = selectionCases.get(call)
      const actor = actors.locked(snapshot, call)
      if (!current || !actor || !same({ id: current.id, incarnation: current.incarnation, version: current.version }, request.caseRef) || !same(selected.caseRef, request.caseRef) ||
        !intent.verify(call, "decisions.select-portfolio", request)) return false
      const alternatives = [request.baselineAlternativeId, request.alternativeId].map((id) => current.alternatives.find((alternative) => alternative.id === id))
      if (alternatives.some((alternative) => !alternative)) return false
      const refs = alternatives.flatMap((alternative) => alternative ? [...alternative.result.sourceRefs, ...alternative.result.costCoverage.evaluatedSourceRefs,
        ...alternative.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)] : [])
      return verifyDecisionPlannerSources(snapshot, refs, actor, call)
    } })
  const comparisonBindings = input.sharedPortfolio?.comparisonBindings ?? createCriterionComparisonBindings({ ...common, rules, results: business.results,
    verifyBinding: (binding, result, call) => proof.verifyComparison(binding, result, call), verifySnapshot: (snapshot, binding, call) => proof.verifySnapshot(snapshot, binding, call) })
  const sensitivityBindings = input.sharedPortfolio?.sensitivityBindings ?? createCriterionResultBindings({ ...common, rules, results: business.results,
    verifyBinding: (binding, _rule, result, call) => proof.verifySensitivity(binding, result, call), verifySnapshot: (snapshot, binding, _rule, call) => proof.verifySnapshot(snapshot, binding, call) })
  const portfolioBindings = input.sharedPortfolio?.portfolioBindings ?? createPortfolioResultBindings({ ...common, results: business.results, selection: selectedPortfolio, resolveCandidate: createDecisionCandidateResolver(business.cases),
    verifyBinding: (binding, result, call) => proof.verifyPortfolio(binding, result, call), verifySnapshot: (snapshot, binding, call) => proof.verifySnapshot(snapshot, binding, call) })
  const idempotencyKey = async (requestDigest: string, call: TrustedDomainContext) => {
    const operation = business.operationIdentity(call)
    const selected = await input.selectedCase(call)
    return operation && /^[a-f0-9]{64}$/.test(requestDigest) && selected.status === "ok" && await host.revalidate(call)
      ? digestSfValue({ operation, requestDigest, caseRef: selected.value, principal: call.binding.principalRef, project: call.binding.projectId }) : undefined
  }
  const analysis: ReturnType<typeof createPortfolioAnalysis> = createPortfolioAnalysis({ planner: business.planner, results: business.results, bindings: comparisonBindings,
    persist: createPlannerResultPersistence({ store: business.results, scenarios, resolveCase: input.selectedCase }),
    select: createPortfolioSelectionResolver({ selection: selectedPortfolio, results: business.results, caseFor: input.selectedCase }), idempotencyKey })
  const decisions = { prepareChanges: business.procurementDecisions.prepareChanges }
  const createReceipt: Parameters<typeof createPortfolioProduct>[0]["createReceipt"] = async (call, operation, digest, result) => business.receipt(call, operation, digest, result)
  const proof: ReturnType<typeof createPortfolioProofVerifier> = input.sharedPortfolio?.proof ?? createPortfolioProofVerifier({ cases: business.cases, planner: business.planner, sources: business.plannerSources,
    evidence: business.context, results: business.results, revalidate: host.revalidate, readSourceFences: business.readSourceFences, lockedSourceFences: business.lockedSourceFences,
    caseFor: input.selectedCase, idempotencyKey, decisions, createReceipt, units, sensitivityPreview: preview, revalidateAnalysis: analysis.revalidate,
    candidateCoverageRefFor: async (candidate, call) => {
      const ref = parseCaseRef(candidate.caseRef)
      if (!ref || !candidate.result || !await host.revalidate(call)) return { status: "unavailable", reason: "candidate-coverage-unavailable" }
      return { status: "ok", value: decisionCoverageRef(ref, candidate.result.costCoverage.alternativeId, candidate.result.costCoverage.alternativeVersion) }
    } })
  const portfolio = input.sharedPortfolio?.product ?? createPortfolioProduct({ host, cases: business.cases, evidence: business.context, planner, results: business.results,
    rules, selection: selectedPortfolio, portfolioBindings, comparisonBindings, sensitivityBindings, decisions, createReceipt, caseFor: input.selectedCase, idempotencyKey })
  const proposals = createSfDecisionProposalServices({ ...input, selection: selectedPortfolio, checks })
  const materiality = createSfDecisionMaterialityServices({ authority: input.authority, business, selectedCase: input.selectedCase, signalRegistryWrites: input.signalRegistryWrites })
  return { ...proposals, descriptors: [...(input.sharedPortfolio?.product ? [] : portfolio.contribution.capabilities), ...proposals.descriptors], portfolio, portfolioProof: proof, units, sensitivityBindings, comparisonBindings, portfolioBindings,
    analysisBindings: { changeProposals: proposals.changeProposals,
      portfolio: { portfolioProof: proof, replayAlternative: proposals.replayAlternative, ...(input.readAlternativeCapture ? { readAlternativeCapture: input.readAlternativeCapture } : {}) },
      sensitivity: { portfolioProof: proof, units, bindings: sensitivityBindings }, materiality: { registry: materiality.registry, produce: materiality.produce } },
    plannerCriteria, baselineCoverage: input.baseline, materiality: { registry: materiality.registry, produce: materiality.produce }, conditions: materiality.conditions,
    dispose: materiality.dispose,
    criteria: { ...rules, register: async (request: Parameters<typeof rules.register>[0], call: TrustedDomainContext) => {
      if (call.kind !== "ui" || !await input.authority.human.authorize(call, "decisions.criteria", request) || !await rawCase(request.caseRef, call) || !await actors.capture(call)) return { status: "denied" as const, reason: "criterion-human-authority-unavailable" }
      try { return await rules.register(request, call) } finally { actors.release(call) }
    } },
    selection: { ...selectedPortfolio, register: async (request: Parameters<typeof selectedPortfolio.register>[0], call: TrustedDomainContext) => {
      if (call.kind !== "ui" || !await input.authority.human.authorize(call, "decisions.select-portfolio", request)) return { status: "denied" as const, reason: "portfolio-human-selection-required" }
      const current = await business.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
      if (current.status !== "ok" || !same({ id: current.value.case.id, incarnation: current.value.case.incarnation, version: current.value.case.version }, request.caseRef) || !await rawCase(request.caseRef, call) || !await actors.capture(call)) return { status: "denied" as const, reason: "portfolio-human-selection-unavailable" }
      selectionCases.set(call, current.value.case)
      try { return await selectedPortfolio.register(request, call) } finally { selectionCases.delete(call); actors.release(call) }
    } },
  }
}

function metricRequest(value: CriterionMetric) {
  return { caseRef: value.caseRef, criterionId: value.criterionId, ruleRef: value.ruleRef, ruleVersion: value.ruleVersion, scenarioRef: value.scenarioRef,
    metricRef: value.metricRef, ...(value.baselineRef === undefined ? {} : { baselineRef: value.baselineRef }) }
}
function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
