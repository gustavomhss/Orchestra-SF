import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { createCriterionRuleRegistry, createCriterionResultBindings } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts"
import { createCriterionComparisonBindings } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-comparison.ts"
import { createDecisionPortfolioSelection } from "../../../../modules/sucafina/Sucafinav1/product/decisions/portfolio-selection.ts"
import { createPortfolioResultBindings } from "../../../../modules/sucafina/Sucafinav1/product/decisions/portfolio-bindings.ts"
import { createDecisionComparisonService } from "../../../../modules/sucafina/Sucafinav1/product/decisions/comparison.ts"
import { createDecisionIntentFences } from "../../../../modules/sucafina/Sucafinav1/product/decisions/intent-fences.ts"
import { createDecisionCandidateResolver } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/candidates.ts"
import type { createPortfolioProofVerifier } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/verification.ts"
import { compareScenarios } from "../../../../modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"

/** Private host callbacks supplement, never replace, the producer's C08 and C17 checks. */
export function createSfPortfolioAuthority(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  proposalCoverageWrites: WeakSet<object>
  proof: () => ReturnType<typeof createPortfolioProofVerifier> | undefined
}) {
  const { authority, business } = input
  const host = authority.host
  const scenarios = business.plannerProduct.scenarios
  const authorizeCase = async (value: DecisionCase, call: TrustedDomainContext) => value.participants.includes(call.binding.principalRef) && await host.revalidate(call)
  const common = { state: authority.state, host, authorizeCase, operationIdentity: business.operationIdentity,
    proposalCoverageWrites: input.proposalCoverageWrites, now: () => new Date().toISOString() }
  const intent = createDecisionIntentFences({ human: authority.human, ui: authority.ui,
    readSourceFences: business.readSourceFences, lockedSourceFences: business.lockedSourceFences })
  const fresh = async (refs: readonly BusinessEvidenceRef[], call: TrustedDomainContext) => {
    if (!refs.length || !await host.revalidate(call)) return false
    const results = await business.context.context({ refs }, call)
    return results.length === refs.length && results.every((result, index) => result.state === "fresh" && !!result.authorizedProjection &&
      !!result.currentRef && digestSfValue(result.ref) === digestSfValue(refs[index]) && digestSfValue(result.currentRef) === digestSfValue(result.ref)) && await host.revalidate(call)
  }
  const readMetric: Parameters<typeof createCriterionRuleRegistry>[0]["readMetric"] = async (request, call) => {
    if (!scenarios || request.metricRef !== "planner:known-subtotal-difference" || !request.baselineRef)
      return { status: "unavailable", reason: "criterion-metric-producer-unavailable" }
    const stored = await business.results.readHistoricalScenario({ resultRef: request.scenarioRef }, call)
    if (stored.status !== "ok") return stored
    if (stored.value.kind !== "scenario" || stored.value.caseRef.id !== request.caseRef.id || stored.value.caseRef.incarnation !== request.caseRef.incarnation || stored.value.caseRef.version > request.caseRef.version)
      return { status: "denied", reason: "criterion-scenario-scope-mismatch" }
    const result = await business.planner.compareScenarios({ scenarioRefs: [request.baselineRef, request.scenarioRef], criteria: [] }, call)
    if (result.status !== "ok") return result
    const baseline = await scenarios.resolve(request.baselineRef, call)
    const candidate = await scenarios.resolve(request.scenarioRef, call)
    if (baseline.status !== "ok") return baseline
    if (candidate.status !== "ok") return candidate
    if (digestSfValue(candidate.value.result) !== stored.value.resultDigest || result.value.baselineResultRef !== request.baselineRef ||
      result.value.alternativeResultRef !== request.scenarioRef || !await host.revalidate(call)) return { status: "stale", reason: "criterion-metric-changed" }
    const evidenceRefs = [...baseline.value.result.sourceRefs, ...candidate.value.result.sourceRefs]
      .filter((ref, index, all) => all.findIndex((entry) => entry.refDigest === ref.refDigest) === index)
    return { status: "ok", value: { ...request, value: result.value.knownDifference, unit: candidate.value.result.currency,
      period: candidate.value.result.horizon, evidenceRefs, state: result.value.comparisonStatus === "complete" ? "confirmed" : "conditioned",
      engineVersion: candidate.value.projection.engineVersion } }
  }
  const rules = createCriterionRuleRegistry({ ...common,
    authorizeRule: (request, call) => intent.authorize(call, "decisions.criteria", request),
    verifyEvidence: (rule, call) => fresh([...rule.evidenceRefs, ...(rule.sensitivity?.sourceRefs ?? [])], call),
    verifySnapshot: (_snapshot, request, _rule, call) => intent.verify(call, "decisions.criteria", request),
    readMetric,
    verifyMetric: async (metric, call) => {
      const current = await readMetric(metric, call)
      return current.status === "ok" && digestSfValue(current.value) === digestSfValue(metric) && await fresh(metric.evidenceRefs, call)
    },
  })
  const planner = { ...business.planner, compareScenarios: scenarios ? (request: Parameters<typeof business.planner.compareScenarios>[0], call: TrustedDomainContext) =>
    compareScenarios({ host, sources: business.plannerSources, scenarios, criteria: { evaluate: async (criterion, binding) => {
      const selected = await business.resolveCase(binding)
      return selected.status === "ok" ? rules.evaluate({ ...criterion, caseRef: selected.value }, binding) : selected
    } } }, request, call) : business.planner.compareScenarios }
  const compare = createDecisionComparisonService({ state: authority.state, host, cases: business.cases, results: business.results, planner })
  const selection = createDecisionPortfolioSelection({ ...common, compare,
    authorizeSelection: (request, call) => intent.authorize(call, "decisions.select-portfolio", request),
    verifySnapshot: (_snapshot, request, _selection, call) => intent.verify(call, "decisions.select-portfolio", request),
  })
  const sensitivityBindings = createCriterionResultBindings({ ...common, rules, results: business.results,
    verifyBinding: async (binding, rule, result, call) => await fresh([...result.sourceRefs, ...rule.evidenceRefs, ...(rule.sensitivity?.sourceRefs ?? [])], call) &&
      await (input.proof()?.verifySensitivity(binding, result, call) ?? Promise.resolve(false)),
    verifySnapshot: (snapshot, binding, _rule, call) => input.proof()?.verifySnapshot(snapshot, binding, call) ?? false,
  })
  const comparisonBindings = createCriterionComparisonBindings({ ...common, rules, results: business.results,
    verifyBinding: async (binding, result, call) => await fresh(result.sourceRefs, call) && await (input.proof()?.verifyComparison(binding, result, call) ?? Promise.resolve(false)),
    verifySnapshot: (snapshot, binding, call) => input.proof()?.verifySnapshot(snapshot, binding, call) ?? false,
  })
  const portfolioBindings = createPortfolioResultBindings({ ...common, results: business.results, selection,
    resolveCandidate: createDecisionCandidateResolver(business.cases),
    verifyBinding: async (binding, result, call) => await fresh(result.sourceRefs, call) && await (input.proof()?.verifyPortfolio(binding, result, call) ?? Promise.resolve(false)),
    verifySnapshot: (snapshot, binding, call) => input.proof()?.verifySnapshot(snapshot, binding, call) ?? false,
  })
  return { rules, planner, compare, selection, sensitivityBindings, comparisonBindings, portfolioBindings, intent, authorizeCase, readMetric }
}
