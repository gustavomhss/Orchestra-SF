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
import { compareScenarios, resolvePlannerScenarioBatch } from "../../../../modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import { createSfPortfolioComparisonScope } from "./portfolio-comparison-scope.ts"
import { createSfPortfolioComparisonObservation } from "./portfolio-comparison-observation.ts"

/** Private host callbacks supplement, never replace, the producer's C08 and C17 checks. */
export function createSfPortfolioAuthority(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  proposalCoverageWrites: WeakSet<object>
  proof: () => ReturnType<typeof createPortfolioProofVerifier> | undefined
}) {
  const { authority, business } = input
  const host = authority.host
  const plannerProduct = business.plannerProduct
  const scenarios = plannerProduct.scenarios
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
    const captured = structuredClone(request)
    const resolve = scenarios.resolve, resolveMany = scenarios.resolveMany
    const readersCurrent = () => business.plannerProduct === plannerProduct && plannerProduct.scenarios === scenarios &&
      scenarios.resolve === resolve && scenarios.resolveMany === resolveMany
    const changed = () => ({ status: "stale" as const, reason: "criterion-metric-changed" })
    if (!readersCurrent()) return changed()
    const source = host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    const stored = await business.results.readHistoricalScenario({ resultRef: captured.scenarioRef }, call)
    if (stored.status !== "ok") return stored
    if (stored.value.kind !== "scenario" || stored.value.caseRef.id !== captured.caseRef.id || stored.value.caseRef.incarnation !== captured.caseRef.incarnation || stored.value.caseRef.version > captured.caseRef.version)
      return { status: "denied", reason: "criterion-scenario-scope-mismatch" }
    // Observe only this invocation's real producer reads. The public comparator
    // reopens both scenarios and validates these final snapshots before return.
    // No observation serves a resolve call or survives this metric invocation.
    const observed = new Map<string, Awaited<ReturnType<typeof scenarios.resolve>>>()
    const pair = { scenarioRefs: [captured.baselineRef!, captured.scenarioRef], criteria: [] }
    // Reuse the original closed-pair observation for this comparison only.
    // Every canonical reader still executes; unsupported adapters retain their
    // complete reads, and changed authority or sources cannot replay the work.
    const result = await business.withPlannerObservation(pair, call, () =>
      compareScenarios({ host, sources: business.plannerSources, scenarios: {
        resolve: async (reference, context) => {
          if (context !== call || !readersCurrent()) return changed()
          const observation = structuredClone(await resolve.call(scenarios, reference, context))
          if (!readersCurrent()) return changed()
          observed.set(reference, observation)
          return observation
        },
        ...(resolveMany ? { resolveMany: async (references: readonly string[], context: TrustedDomainContext) => {
          const selected = [...references]
          if (context !== call || !readersCurrent()) return selected.map(() => changed())
          // Forward the producer's fresh sibling observation, including its
          // cardinality fence. The comparator opens a new batch for each phase.
          const values = await resolvePlannerScenarioBatch(scenarios, selected, context)
          if (!readersCurrent()) return selected.map(() => changed())
          for (const [index, value] of values.entries()) observed.set(selected[index]!, structuredClone(value))
          return values
        } } : {}),
      } }, pair, call))
    if (result.status !== "ok") return result
    const baseline = observed.get(captured.baselineRef!)
    const candidate = observed.get(captured.scenarioRef)
    if (!baseline || !candidate) return { status: "unavailable", reason: "criterion-metric-observation-unavailable" }
    if (baseline.status !== "ok") return baseline
    if (candidate.status !== "ok") return candidate
    if (digestSfValue(candidate.value.result) !== stored.value.resultDigest || result.value.baselineResultRef !== captured.baselineRef ||
      result.value.alternativeResultRef !== captured.scenarioRef || !await host.revalidate(call) || !readersCurrent() || !source || host.requestFor(call) !== source || source.signal.aborted ||
      binding !== digestSfValue([call.kind, call.binding]) || digestSfValue(request) !== digestSfValue(captured)) return { status: "stale", reason: "criterion-metric-changed" }
    const evidenceRefs = [...baseline.value.result.sourceRefs, ...candidate.value.result.sourceRefs]
      .filter((ref, index, all) => all.findIndex((entry) => entry.refDigest === ref.refDigest) === index)
    return { status: "ok", value: { ...captured, value: result.value.knownDifference, unit: candidate.value.result.currency,
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
  const observation = createSfPortfolioComparisonObservation({ authority, business, rules })
  const planner: typeof business.planner = { ...business.planner, compareScenarios: scenarios ? (request: Parameters<typeof business.planner.compareScenarios>[0], call: TrustedDomainContext) =>
    observation.scenarios(request, call, () => compareScenarios({ host, sources: business.plannerSources,
      // A selected criterion is outside the planner-only comparison cache. Its
      // scope probe always declines and performs redundant full C08 reads;
      // preserve the canonical scenario producer and all comparison checks.
      scenarios: request.criteria.length ? scenarios : (comparisons.scenarios ?? scenarios),
      criteria: { evaluate: async (criterion, binding) => {
      const selected = await business.resolveCase(binding)
      return selected.status === "ok" ? rules.evaluate({ ...criterion, caseRef: selected.value }, binding) : selected
    } } }, request, call)) : business.planner.compareScenarios }
  const originalCompare = createDecisionComparisonService({ state: authority.state, host, cases: business.cases, results: business.results, planner })
  const compareCanonical: typeof originalCompare = (request, call) => observation.alternatives(request, call, () => originalCompare(request, call))
  const comparisons = createSfPortfolioComparisonScope({ authority, business, compareCanonical, scenarios })
  const compare: typeof compareCanonical = (request, call) => comparisons.run(call, () => comparisons.compare(request, call))
  const selectionCanonical = createDecisionPortfolioSelection({ ...common, compare,
    authorizeSelection: (request, call) => intent.authorize(call, "decisions.select-portfolio", request),
    verifySnapshot: (_snapshot, request, _selection, call) => intent.verify(call, "decisions.select-portfolio", request),
  })
  const selection = { ...selectionCanonical, withComparisonScope: comparisons.run,
    read: (request: Parameters<typeof selectionCanonical.read>[0], call: TrustedDomainContext) => comparisons.run(call, () => selectionCanonical.read(request, call)),
    inspect: (request: Parameters<typeof selectionCanonical.inspect>[0], call: TrustedDomainContext) => comparisons.run(call, () => selectionCanonical.inspect(request, call)),
    register: (request: Parameters<typeof selectionCanonical.register>[0], call: TrustedDomainContext) => comparisons.run(call, () => selectionCanonical.register(request, call)),
  }
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
