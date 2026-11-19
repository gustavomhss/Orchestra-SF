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
import { createSfPortfolioComparisonScope } from "./portfolio-comparison-scope.ts"
import { createSfConditionedCriterionMetric } from "./portfolio-criterion-observation.ts"

// CI-only marker encoding: status 1=ok, 2=denied, 3=stale, 4=unavailable, 5=needs-input, 6=preview.
function metricObservationProbe(phase: string, values: Record<string, unknown>) {
  if (process.env.SF_REPORTS_TRACE !== "1") return
  const statuses: Record<string, number> = { ok: 1, denied: 2, stale: 3, unavailable: 4, "needs-input": 5, preview: 6 }
  const fields = Object.entries(values).map(([key, value]) => {
    const numeric = typeof value === "boolean" ? Number(value) : typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : typeof value === "string" ? statuses[value] ?? 0 : 0
    return key.toUpperCase() + "_" + numeric
  }).join("__")
  console.info("SF_REPORTS_TRACE_CRITERION_METRIC_" + phase.toUpperCase().replace(/[^A-Z0-9_]/g, "_") + "__" + fields)
}

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
  const observedMetric = createSfConditionedCriterionMetric({ authority, business })
  const readMetric: Parameters<typeof createCriterionRuleRegistry>[0]["readMetric"] = async (request, call) => {
    const started = performance.now()
    const probe = (phase: string, values: Record<string, unknown> = {}) => metricObservationProbe(phase, { elapsedMs: performance.now() - started, ...values })
    probe("begin")
    if (!scenarios || request.metricRef !== "planner:known-subtotal-difference" || !request.baselineRef)
      return { status: "unavailable", reason: "criterion-metric-producer-unavailable" }
    const captured = structuredClone(request)
    const source = host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    const stored = await business.results.readHistoricalScenario({ resultRef: captured.scenarioRef }, call)
    probe("historical-read", { status: stored.status })
    if (stored.status !== "ok") return stored
    if (stored.value.kind !== "scenario" || stored.value.caseRef.id !== captured.caseRef.id || stored.value.caseRef.incarnation !== captured.caseRef.incarnation || stored.value.caseRef.version > captured.caseRef.version)
      return { status: "denied", reason: "criterion-scenario-scope-mismatch" }
    const fromObservation = await observedMetric(request, call, stored.value)
    probe("observation-returned", { consumed: fromObservation?.status === "ok", handled: !!fromObservation, status: fromObservation?.status, fallback: !fromObservation })
    if (fromObservation) return fromObservation
    // Observe only this invocation's real producer reads. The public comparator
    // reopens both scenarios and validates these final snapshots before return.
    // No observation serves a resolve call or survives this metric invocation.
    probe("full-comparison-begin")
    const observed = new Map<string, Awaited<ReturnType<typeof scenarios.resolve>>>()
    const result = await compareScenarios({ host, sources: business.plannerSources, scenarios: { resolve: async (reference, context) => {
      const observation = structuredClone(await scenarios.resolve(reference, context))
      observed.set(reference, observation)
      return observation
    } } }, { scenarioRefs: [captured.baselineRef!, captured.scenarioRef], criteria: [] }, call)
    probe("full-comparison-returned", { status: result.status })
    if (result.status !== "ok") return result
    const baseline = observed.get(captured.baselineRef!)
    const candidate = observed.get(captured.scenarioRef)
    if (!baseline || !candidate) return { status: "unavailable", reason: "criterion-metric-observation-unavailable" }
    if (baseline.status !== "ok") return baseline
    if (candidate.status !== "ok") return candidate
    if (digestSfValue(candidate.value.result) !== stored.value.resultDigest || result.value.baselineResultRef !== captured.baselineRef ||
      result.value.alternativeResultRef !== captured.scenarioRef || !await host.revalidate(call) || !source || host.requestFor(call) !== source || source.signal.aborted ||
      binding !== digestSfValue([call.kind, call.binding]) || digestSfValue(request) !== digestSfValue(captured)) return { status: "stale", reason: "criterion-metric-changed" }
    const evidenceRefs = [...baseline.value.result.sourceRefs, ...candidate.value.result.sourceRefs]
      .filter((ref, index, all) => all.findIndex((entry) => entry.refDigest === ref.refDigest) === index)
    probe("full-producer-complete")
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
  const planner: typeof business.planner = { ...business.planner, compareScenarios: scenarios ? (request: Parameters<typeof business.planner.compareScenarios>[0], call: TrustedDomainContext) =>
    compareScenarios({ host, sources: business.plannerSources,
      // A selected criterion is outside the planner-only comparison cache. Its
      // scope probe always declines and performs redundant full C08 reads;
      // preserve the canonical scenario producer and all comparison checks.
      scenarios: request.criteria.length ? scenarios : (comparisons.scenarios ?? scenarios),
      criteria: { evaluate: async (criterion, binding) => {
      const selected = await business.resolveCase(binding)
      return selected.status === "ok" ? rules.evaluate({ ...criterion, caseRef: selected.value }, binding) : selected
    } } }, request, call) : business.planner.compareScenarios }
  const compareCanonical = createDecisionComparisonService({ state: authority.state, host, cases: business.cases, results: business.results, planner })
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
