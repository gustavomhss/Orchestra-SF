import { AsyncLocalStorage } from "node:async_hooks"
import { observeSfUiContextIntegrity } from "../../../../modules/sucafina/Sucafinav1/product/integration/ui-authority.ts"
import type { SfUiContextIntegrity } from "../../../../modules/sucafina/Sucafinav1/product/integration/ui-authority.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { SfProductState } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { closedPlannerScenarios } from "./finance-pair-observation.ts"
import { createSfFreshTupleDigest } from "./fresh-tuple-digest.ts"
import { criterionRuleKey } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts"
import type { CriterionRule, createCriterionRuleRegistry } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createDecisionComparisonService } from "../../../../modules/sucafina/Sucafinav1/product/decisions/comparison.ts"
import { decisionCoverageRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-access.ts"
import { resolvePlannerScenarioBatch } from "../../../../modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts"
import type { PlannerScenarioHost } from "../../../../modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts"
import type { createSfBusinessServices } from "./business-services.ts"

type Compare = ReturnType<typeof createDecisionComparisonService>
type Value = Extract<Awaited<ReturnType<Compare>>, { status: "ok" }>["value"]
type ScenarioValue = Extract<Awaited<ReturnType<PlannerScenarioHost["resolve"]>>, { status: "ok" }>["value"]
type Scope = { request: Request; binding: string; bindingIntegrity: SfUiContextIntegrity; criteria: boolean; readersCurrent: () => boolean; proofs: Map<string, { fence: string; value: Value }>;
  scenarios: Map<string, { fence: string; value: ScenarioValue }>; tupleDigest: ReturnType<typeof createSfFreshTupleDigest> }
export type SfComparisonInvocation = <T>(call: TrustedDomainContext, work: () => Promise<PortResult<T>>) => Promise<PortResult<T>>

/** Completed canonical comparisons may be reused only inside one lexical invocation.
 * Each fence independently reopens every supported Planner source. All other
 * dependency kinds continue through the complete canonical comparison.
 */
export function createSfPortfolioComparisonScope(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: Pick<ReturnType<typeof createSfBusinessServices>, "selectedCase" | "lockedSourceFences" | "plannerSources" | "plannerProduct" | "plannerReaderIdentities" | "host">
  compareCanonical: Compare
  scenarios?: PlannerScenarioHost
  rules?: Pick<ReturnType<typeof createCriterionRuleRegistry>, "resolve">
}) {
  const host = input.authority.host
  const active = new WeakMap<TrustedDomainContext, Scope>()
  const execution = new AsyncLocalStorage<Scope>()
  const reading = new AsyncLocalStorage<{ scope: Scope; keys: ReadonlySet<string> }>()
  const current = (call: TrustedDomainContext, scope: Scope) => active.get(call) === scope && execution.getStore() === scope &&
    scope.readersCurrent() && host.requestFor(call) === scope.request && !scope.request.signal.aborted && scope.bindingIntegrity.current()
  const environment = async (request: Request) => {
    const value = await host.environment(request), at = Date.parse(value.at)
    return Number.isFinite(at) ? digestSfValue({ day: new Date(at).toISOString().slice(0, 10),
      directory: value.directory, bankKey: value.bankKey ? Array.from(value.bankKey) : undefined }) : undefined
  }
  const sample = async (call: TrustedDomainContext, scope: Scope, caseRef: Parameters<Compare>[0]["caseRef"], references: readonly string[] = []) => {
    if (!current(call, scope) || !await host.revalidate(call) || !current(call, scope)) return undefined
    const beforeEnvironment = await environment(scope.request)
    const selected = await input.business.selectedCase(call)
    if (!beforeEnvironment || selected.status !== "ok" || digestSfValue(selected.value) !== digestSfValue(caseRef) || !current(call, scope)) return undefined
    // No financial/source producer is entered while C08 owns its read scope.
    // The final clock and authority reads remain inside it; the state provider
    // performs its own final reauthorization before releasing the snapshot.
    const found = await input.authority.state.read(scope.request, "preferences", async (state, actor) => {
      const decision = state.cases[selected.value.id]
      if (!decision || decision.id !== selected.value.id || decision.incarnation !== selected.value.incarnation || decision.version !== selected.value.version ||
        actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion ||
        !decision.participants.includes(actor.principalRef) || !current(call, scope)) return undefined
      const rules = plannerOnlyRules(decision, scope.criteria && input.rules ? state.preferences : undefined)
      if (!rules) return undefined
      const refs = scope.criteria && references.length ? closedPlannerScenarios(decision, state, references, rules) : plannerOnlyEvidence(decision)
      if (!refs) return undefined
      // This only selects the supported dependency closure. The first read is
      // still the actual stored-scenario reader, with its historical/result checks.
      const scenarios: { reference: string; source: Extract<BusinessEvidenceRef, { kind: "record" }>; coverageRef: string }[] = []
      for (const reference of references) {
        const stored = state.decisionResults?.[reference]
        const alternatives = stored?.kind === "scenario" ? decision.alternatives.filter((value) =>
          digestSfValue(value.scenario) === stored.requestDigest && digestSfValue(value.result) === stored.resultDigest) : []
        const alternative = alternatives.length === 1 ? alternatives[0] : undefined
        const source = alternative?.result.sourceRefs.filter((ref) => ref.kind === "record" && ref.refId === alternative.scenario.baseRef &&
          ref.target.surface === "planner" && ref.target.recordType === "planner-version")
        if (!alternative || source?.length !== 1 || source[0]?.kind !== "record") return undefined
        scenarios.push({ reference, source: source[0], coverageRef: decisionCoverageRef(selected.value, alternative.id, alternative.version) })
      }
      const afterEnvironment = await environment(scope.request)
      const authorized = await host.revalidate(call)
      const sources = input.business.lockedSourceFences()
      // The complete state, including preferences, audit, transactions and
      // native runs, participates. Only synchronous checks follow this await.
      return sources && afterEnvironment === beforeEnvironment && authorized && current(call, scope)
        ? { refs, scenarios, digest: scope.tupleDigest.digest({ state, sources, environment: afterEnvironment, caseRef: selected.value, binding: scope.binding, actor }) } : undefined
    })
    return found.status === "ok" && found.value && current(call, scope) ? found.value : undefined
  }
  const fence = async (call: TrustedDomainContext, scope: Scope, caseRef: Parameters<Compare>[0]["caseRef"]) => {
    const before = await sample(call, scope, caseRef)
    if (!before) return undefined
    // Hashes never stand in for the source's current granular authorization.
    // Do not memoize these reads, even when an identical proof already exists.
    for (const reference of before.refs) {
      const source = await input.business.plannerSources.resolveForecastSource(reference.refId, call)
      if (source.status !== "ok" || digestSfValue(source.value.evidence) !== digestSfValue(reference) || !current(call, scope)) return undefined
    }
    const after = await sample(call, scope, caseRef)
    return after && after.digest === before.digest && digestSfValue(after.refs) === digestSfValue(before.refs) ? after.digest : undefined
  }
  const denied = (): PortResult<never> => ({ status: "denied", reason: "portfolio-comparison-invocation-unavailable" })
  const scenarioFences = async (references: readonly string[], call: TrustedDomainContext, scope: Scope, caseRef: Parameters<Compare>[0]["caseRef"]) => {
    const before = await sample(call, scope, caseRef, references)
    if (!before || before.scenarios.length !== references.length) return undefined
    // One fresh sibling observation authorizes every granular source once.
    // Coverage callbacks remain real for each scenario. Rule evaluation is not
    // memoized: the canonical criterion producer still resolves its own rules.
    for (const ref of before.refs) {
      const source = await input.business.plannerSources.resolveForecastSource(ref.refId, call)
      if (source.status !== "ok" || digestSfValue(source.value.evidence) !== digestSfValue(ref) || !current(call, scope)) return undefined
    }
    const coverage: string[] = []
    for (const scenario of before.scenarios) {
      const forecast = await input.business.plannerSources.resolveForecastCoverage(scenario.source.refId, call)
      const actual = await input.business.plannerSources.resolveForecastCoverage(scenario.coverageRef, call)
      if (forecast.status !== "ok" || actual.status !== "ok" || !current(call, scope)) return undefined
      coverage.push(digestSfValue({ forecast: forecast.value, coverage: actual.value }))
    }
    const after = await sample(call, scope, caseRef, references)
    return after && after.digest === before.digest && digestSfValue(after.refs) === digestSfValue(before.refs) &&
      digestSfValue(after.scenarios) === digestSfValue(before.scenarios) && current(call, scope)
      ? after.scenarios.map((scenario, index) => digestSfValue({ snapshot: after.digest, scenario, coverage: coverage[index] })) : undefined
  }
  const scenarioFence = async (reference: string, call: TrustedDomainContext, scope: Scope, caseRef: Parameters<Compare>[0]["caseRef"]) =>
    (await scenarioFences([reference], call, scope, caseRef))?.[0]
  const resolveScenario: PlannerScenarioHost["resolve"] = async (reference, call) => {
    const scenarios = input.scenarios
    if (!scenarios) return { status: "unavailable", reason: "portfolio-scenario-reader-unavailable" }
    const scope = active.get(call)
    if (scope && !current(call, scope)) return denied()
    if (!scope) return scenarios.resolve(reference, call)
    const selected = await input.business.selectedCase(call)
    if (selected.status !== "ok" || !current(call, scope)) return denied()
    const key = digestSfValue({ reference, caseRef: selected.value, binding: scope.binding })
    // Each asynchronous branch owns its read ancestry. Canonical sensitivity
    // revalidates sibling samples in parallel, including the same baseline.
    // Siblings reopen independently; recursion never consumes unfinished data.
    const parent = reading.getStore(), ancestors = parent?.scope === scope ? parent.keys : undefined
    if (ancestors?.has(key)) return denied()
    return reading.run({ scope, keys: new Set([...(ancestors ?? []), key]) }, async () => {
      const before = await scenarioFence(reference, call, scope, selected.value)
      if (!current(call, scope)) return denied()
      const proof = scope.scenarios.get(key)
      if (before && proof?.fence === before) {
        const value = structuredClone(proof.value)
        const after = await scenarioFence(reference, call, scope, selected.value)
        return after === before && current(call, scope) ? { status: "ok", value } : denied()
      }
      scope.scenarios.delete(key)
      const result = await scenarios.resolve(reference, call)
      if (result.status !== "ok") return result
      if (!before) return current(call, scope) ? result : denied()
      const after = await scenarioFence(reference, call, scope, selected.value)
      if (!after || !current(call, scope)) return denied()
      if (after !== before) return { status: "stale", reason: "portfolio-scenario-proof-changed" }
      scope.scenarios.set(key, { fence: after, value: structuredClone(result.value) })
      return result
    })
  }
  const resolveMany: NonNullable<PlannerScenarioHost["resolveMany"]> = async (references, call) => {
    const captured = [...references]
    const scenarios = input.scenarios
    if (!scenarios) return captured.map(() => ({ status: "unavailable", reason: "portfolio-scenario-reader-unavailable" }))
    const scope = active.get(call)
    if (!scope) return resolvePlannerScenarioBatch(scenarios, captured, call)
    if (!current(call, scope)) return captured.map(denied)
    const selected = await input.business.selectedCase(call)
    if (selected.status !== "ok" || !current(call, scope)) return captured.map(denied)
    const keys = captured.map((reference) => digestSfValue({ reference, caseRef: selected.value, binding: scope.binding }))
    if (new Set(keys).size !== keys.length) {
      const result = await resolvePlannerScenarioBatch(scenarios, captured, call)
      return current(call, scope) && digestSfValue(references) === digestSfValue(captured) ? result : captured.map(denied)
    }
    const parent = reading.getStore(), ancestors = parent?.scope === scope ? parent.keys : undefined
    if (keys.some((key) => ancestors?.has(key))) return captured.map(denied)
    return reading.run({ scope, keys: new Set([...(ancestors ?? []), ...keys]) }, async () => {
      const before = await scenarioFences(captured, call, scope, selected.value)
      if (!current(call, scope) || digestSfValue(references) !== digestSfValue(captured)) return captured.map(denied)
      const proofs = keys.map((key) => scope.scenarios.get(key))
      const reusable = before?.length === captured.length && before.every((value, index) => proofs[index]?.fence === value)
      // A cold/mixed batch still calls the original producer once with every
      // sibling. The shared cardinality check is retained, including failures.
      const results = reusable
        ? proofs.map((proof) => ({ status: "ok" as const, value: structuredClone(proof!.value) }))
        : await resolvePlannerScenarioBatch(scenarios, captured, call)
      if (!current(call, scope) || digestSfValue(references) !== digestSfValue(captured)) return captured.map(denied)
      if (!before || results.some((result) => result.status !== "ok")) {
        for (const key of keys) scope.scenarios.delete(key)
        return results
      }
      const after = await scenarioFences(captured, call, scope, selected.value)
      if (!after || !current(call, scope)) return captured.map(denied)
      if (digestSfValue(after) !== digestSfValue(before)) return captured.map(() => ({ status: "stale", reason: "portfolio-scenario-proof-changed" }))
      for (const [index, result] of results.entries()) {
        if (result.status === "ok") scope.scenarios.set(keys[index]!, { fence: after[index]!, value: structuredClone(result.value) })
      }
      return current(call, scope) && digestSfValue(references) === digestSfValue(captured) ? results : captured.map(denied)
    })
  }
  const compare: Compare = async (request, call) => {
    const captured = structuredClone(request)
    const requestDigest = digestSfValue(captured)
    const unchanged = () => digestSfValue(request) === requestDigest
    const scope = active.get(call)
    // A separate overlapping caller cannot borrow the private lexical scope.
    if (scope && !current(call, scope)) return denied()
    if (!scope || captured.criteria.length) return input.compareCanonical(captured, call)
    const before = await fence(call, scope, captured.caseRef)
    if (!unchanged() || !current(call, scope)) return denied()
    const key = digestSfValue({ request: captured, binding: scope.binding })
    const proof = scope.proofs.get(key)
    if (before && proof?.fence === before) {
      const value = structuredClone(proof.value)
      const after = await fence(call, scope, captured.caseRef)
      if (!after || !current(call, scope)) return denied()
      return after === before && unchanged() && current(call, scope) ? { status: "ok", value }
        : { status: "stale", reason: "portfolio-comparison-proof-changed" }
    }
    scope.proofs.delete(key)
    const result = await input.compareCanonical(captured, call)
    if (result.status !== "ok") return result
    if (!before) {
      // Unsupported dependencies remain a full producer invocation. No result
      // from this path is installed in the proof map.
      return unchanged() && current(call, scope) ? result : denied()
    }
    const after = await fence(call, scope, captured.caseRef)
    if (!after || !current(call, scope)) return denied()
    if (after !== before || !unchanged()) return { status: "stale", reason: "portfolio-comparison-proof-changed" }
    scope.proofs.set(key, { fence: after, value: structuredClone(result.value) })
    return result
  }
  const invoke = async <T>(call: TrustedDomainContext, work: () => Promise<PortResult<T>>, criteria: boolean): Promise<PortResult<T>> => {
    const prior = active.get(call)
    if (prior) return current(call, prior) ? work() : denied()
    const request = host.requestFor(call)
    if (!request || request.signal.aborted || !await host.revalidate(call) || active.has(call) || host.requestFor(call) !== request || request.signal.aborted) return denied()
    const scenarios = input.scenarios, resolve = scenarios?.resolve, batch = scenarios?.resolveMany
    const plannerProduct = input.business.plannerProduct
    const rules = input.rules, resolveRule = rules?.resolve
    const collectReaders = input.business.plannerReaderIdentities, readerIdentities = [...collectReaders()]
    const state = input.authority.state, readState = state.read, owner = input.business.host, readEnvironment = host.environment
    const source = input.business.plannerSources, forecast = source.resolveForecastSource, coverage = source.resolveForecastCoverage
    const readersCurrent = () => input.authority.host === host && input.business.host === owner && owner === host && host.environment === readEnvironment &&
      input.authority.state === state && state.read === readState && input.business.plannerReaderIdentities === collectReaders &&
      sameReaders(collectReaders(), readerIdentities) && input.business.plannerProduct === plannerProduct && plannerProduct.scenarios === scenarios &&
      input.scenarios === scenarios && scenarios?.resolve === resolve && scenarios?.resolveMany === batch &&
      input.rules === rules && rules?.resolve === resolveRule && input.business.plannerSources === source &&
      source.resolveForecastSource === forecast && source.resolveForecastCoverage === coverage
    const bindingIntegrity = observeSfUiContextIntegrity(call)
    const scope: Scope = { request, binding: bindingIntegrity.digest, bindingIntegrity, criteria, readersCurrent,
      proofs: new Map(), scenarios: new Map(), tupleDigest: createSfFreshTupleDigest() }
    active.set(call, scope)
    return execution.run(scope, async () => {
      try {
        const result = await work()
        // The producer/consumer owns its final awaited authority boundary.
        // Do not add another await after that boundary releases its snapshot.
        return current(call, scope) ? result : denied()
      } finally { scope.tupleDigest.close(); if (active.get(call) === scope) active.delete(call) }
    })
  }
  const run: SfComparisonInvocation = (call, work) => invoke(call, work, false)
  const observeCriteria: SfComparisonInvocation = (call, work) => invoke(call, work, true)
  const scenarios = input.scenarios ? { resolve: resolveScenario,
    ...(input.scenarios.resolveMany ? { resolveMany } : {}) } : undefined
  return { compare, run, observeCriteria, scenarios,
    criteriaScenarios: (call: TrustedDomainContext) => {
      const scope = active.get(call)
      return scope?.criteria && current(call, scope) ? scenarios : undefined
    } }

}

function plannerOnlyEvidence(decision: DecisionCase): readonly Extract<BusinessEvidenceRef, { kind: "record" }>[] | undefined {
  // This narrow path has no criterion, receipt, calculation, document, HR,
  // Procurement or command authority. The canonical producer handles all such
  // cases normally; a broad state digest cannot authorize those dependencies.
  if (decision.criteria.length || decision.choices.length || decision.preparedChanges.length || decision.receipts.length || decision.ledger.length ||
    decision.questions.length || decision.alternatives.some((alternative) => alternative.scenario.operations.length ||
      alternative.result.components.some((component) => component.sourceRefs.some((source) => source.surface !== "planner")))) return undefined
  const refs = [...decision.sourceRefs, ...decision.costCoverageBases.flatMap((basis) => basis.sourceRefs), ...decision.assumptions.flatMap((value) => value.evidenceRefs),
    ...decision.alternatives.flatMap((alternative) => [...alternative.scenario.assumptions.flatMap((value) => value.evidenceRefs), ...alternative.result.sourceRefs,
      ...alternative.result.costCoverage.evaluatedSourceRefs, ...alternative.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)])]
  if (!refs.length || refs.some((reference) => reference.kind !== "record" || reference.target.surface !== "planner" || reference.target.recordType !== "planner-version")) return undefined
  return refs.filter((reference, index) => refs.findIndex((other) => digestSfValue(other) === digestSfValue(reference)) === index) as readonly Extract<BusinessEvidenceRef, { kind: "record" }>[]
}

function plannerOnlyRules(decision: DecisionCase, preferences?: SfProductState["preferences"]): readonly CriterionRule[] | undefined {
  if (!preferences && decision.criteria.length) return undefined
  const rules: CriterionRule[] = []
  for (const criterion of decision.criteria) {
    const raw = preferences?.[criterionRuleKey(decision, criterion.id)]
    if (!raw || typeof raw !== "object" || !("schema" in raw) || raw.schema !== "sf-criterion-rule-v1" ||
      !("metricRef" in raw) || raw.metricRef !== "planner:known-subtotal-difference" ||
      !("evidenceRefs" in raw) || !Array.isArray(raw.evidenceRefs) || !raw.evidenceRefs.length ||
      ("sensitivity" in raw && raw.sensitivity !== undefined && (!raw.sensitivity || typeof raw.sensitivity !== "object" ||
        !("sourceRefs" in raw.sensitivity) || !Array.isArray(raw.sensitivity.sourceRefs) || !raw.sensitivity.sourceRefs.length))) return undefined
    const rule = structuredClone(raw) as CriterionRule
    // Refuse every unsupported dependency before the real rule resolver can
    // enter it. No rule result or authorization is memoized.
    const refs = [...rule.evidenceRefs, ...(rule.sensitivity?.sourceRefs ?? [])]
    if (refs.some((ref) => !ref || ref.kind !== "record" || !ref.target ||
      ref.target.surface !== "planner" || ref.target.recordType !== "planner-version")) return undefined
    rules.push(rule)
  }
  return rules
}

function sameReaders(current: readonly unknown[], expected: readonly unknown[]) {
  return current.length === expected.length && current.every((value, index) => Object.is(value, expected[index]))
}
