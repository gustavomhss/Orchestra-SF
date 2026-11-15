import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { createCriterionComparisonBindings } from "../../../product/decisions/criterion-comparison.ts"
import { createCriterionRuleRegistry } from "../../../product/decisions/criterion-rules.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerCriterionMetric } from "../../../product/planner/criterion-metric.ts"
import type { createRenewalChoiceHistory } from "../wp11/renewal-choice-fixture.ts"
import type { installCanonicalReadDiagnostic } from "./diagnostic-probe.ts"

/** Existing fixture grants are synthetic. Sources, stored results, rules and replay remain real. */
export async function composeCanonicalReadDiagnostic(
  history: Awaited<ReturnType<typeof createRenewalChoiceHistory>>,
  probe: Awaited<ReturnType<typeof installCanonicalReadDiagnostic>>,
) {
  const phase = history.before
  const host = history.fixture.host
  const revalidate = host.revalidate
  const requestFor = host.requestFor
  host.revalidate = (context) => probe.call("host.revalidate", () => revalidate.call(host, context))
  host.requestFor = (context) => probe.call("host.requestFor", () => requestFor.call(host, context))
  probe.onRestore(() => { host.revalidate = revalidate; host.requestFor = requestFor })
  probe.persistence(history.fixture.store)
  probe.state(history.state, "fixture.c08")
  const writes = new WeakSet<object>()
  const state = createSfProductState({
    persistence: history.fixture.store, proposalCoverageWrites: writes, createId: () => "diagnostic-read-cost",
    resolveTarget: async (_request, _snapshot, _namespace, ref) => ref === phase.caseRef.id ? { incarnation: phase.caseRef.incarnation } : undefined,
    authorize: (request, _snapshot, namespace, mode) => probe.call(`c08.authorize.${mode}.${namespace}`, async () =>
      request === history.fixture.request && await host.revalidate(history.fixture.context) ? history.fixture.context.binding : undefined),
  })
  probe.state(state, "diagnostic.c08")
  const authorizeCase = (decision: DecisionCase, context: TrustedDomainContext) => probe.call("callback.authorizeCase", async () =>
    decision.id === phase.caseRef.id && decision.incarnation === phase.caseRef.incarnation && decision.version === phase.caseRef.version &&
    decision.participants.includes(context.binding.principalRef) && await host.revalidate(context))
  const evidence = (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => probe.call("callback.evidence", async () => {
    const observed = await phase.evidence.context({ refs }, context)
    return observed.length === refs.length && observed.every((value, index) =>
      value.state === "fresh" && value.accessRevision === context.binding.accessRevision && digestSfValue(value.ref) === digestSfValue(refs[index]))
  })
  const metrics: { read?: ReturnType<typeof createPlannerCriterionMetric> } = {}
  const rules = createCriterionRuleRegistry({
    state, host, authorizeCase, authorizeRule: async () => false, verifySnapshot: () => false,
    verifyEvidence: (rule, context) => evidence(rule.evidenceRefs, context),
    readMetric: (request, context) => probe.call("callback.criterionMetric", () => {
      if (!metrics.read) throw new Error("Canonical metric not composed")
      return metrics.read(request, context)
    }),
    verifyMetric: (metric, context) => evidence(metric.evidenceRefs, context),
    operationIdentity: () => undefined, proposalCoverageWrites: writes, now: () => "2026-11-15T00:00:00Z",
  })
  // No registry success is manufactured: this resolves the fixture's persisted rule,
  // and evaluates through the same real units + Planner preview as the original fixture.
  metrics.read = createPlannerCriterionMetric({ host, rules, units: phase.issuer, preview: phase.preview })
  const resolveRule = rules.resolve
  const evaluateRule = rules.evaluate
  rules.resolve = (request, context) => probe.call("rules.resolve", () => resolveRule.call(rules, request, context))
  rules.evaluate = (request, context) => probe.call("rules.evaluate", () => evaluateRule.call(rules, request, context))
  const readResult = phase.results.read
  const readCalculation = phase.results.readForCalculation
  phase.results.read = (request, context) => probe.call("results.read", () => readResult.call(phase.results, request, context))
  phase.results.readForCalculation = (request, context) => probe.call("results.readForCalculation", () => readCalculation.call(phase.results, request, context))
  // readHistoricalScenario retains its exact WeakMap identity and batching behavior.
  probe.onRestore(() => { phase.results.read = readResult; phase.results.readForCalculation = readCalculation })
  const compare = phase.planner.compareScenarios
  phase.planner.compareScenarios = (request, context) => probe.call("planner.compareScenarios", () => compare.call(phase.planner, request, context))
  probe.onRestore(() => { phase.planner.compareScenarios = compare })
  const sourceFence = await history.fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: sfRunSourceFence(snapshot) }))
  const bindings = createCriterionComparisonBindings({
    state, host, rules, results: phase.results, authorizeCase,
    verifyBinding: (binding, result, context) => probe.call("callback.verifyBinding.replay", async () => {
      const replay = await phase.planner.compareScenarios(binding.request, context)
      return result.kind === "comparison" && replay.status === "ok" && digestSfValue(replay.value) === result.resultDigest
    }),
    verifySnapshot: (snapshot) => sfRunSourceFence(snapshot) === sourceFence,
    operationIdentity: () => "canonical-read-cost-binding", proposalCoverageWrites: writes, now: () => "2026-11-15T00:00:00Z",
  })
  const bind = bindings.bind
  const readBinding = bindings.read
  const proofs = bindings.proofs
  bindings.bind = (request, context) => probe.call("bindings.bind", () => bind.call(bindings, request, context))
  bindings.read = (request, context) => probe.call("bindings.read", () => readBinding.call(bindings, request, context))
  bindings.proofs = (ref, criteria, context) => probe.call("bindings.proofs", () => proofs.call(bindings, ref, criteria, context))
  return { state, rules, bindings }
}
