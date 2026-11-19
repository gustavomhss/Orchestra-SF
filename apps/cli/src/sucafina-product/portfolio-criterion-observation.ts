import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { CriterionMetric, CriterionRule } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts"
import { criterionRuleKey } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts"
import { decisionCoverageRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-access.ts"
import type { StoredDecisionResult } from "../../../../modules/sucafina/Sucafinav1/product/decisions/result-store.ts"
import { createPlannerCriterionObservationReader } from "../../../../modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts"
import type { PlannerCriterionObservation } from "../../../../modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"

type MetricRequest = Pick<CriterionMetric, "caseRef" | "criterionId" | "ruleRef" | "ruleVersion" | "metricRef" | "scenarioRef" | "baselineRef">
type Selection = { decision: DecisionCase | undefined; results: readonly (StoredDecisionResult | undefined)[]; rule: unknown }

// CI-only diagnostics: fixed stage labels, booleans, counts and durations; no authority or source data.
function criterionObservationProbe(phase: string, values: Record<string, unknown> = {}) {
  if (process.env.SF_REPORTS_TRACE !== "1") return
  const statuses: Record<string, number> = { ok: 1, denied: 2, stale: 3, unavailable: 4, "needs-input": 5, preview: 6 }
  const fields = Object.entries(values).map(([key, value]) => {
    const numeric = typeof value === "boolean" ? Number(value) : typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : typeof value === "string" ? statuses[value] ?? 0 : 0
    return key.toUpperCase() + "_" + numeric
  }).join("__")
  console.info("SF_REPORTS_TRACE_CRITERION_OBSERVER_" + phase.toUpperCase().replace(/[^A-Z0-9_]/g, "_") + "__" + fields)
}

/** The private comparator supplies a calculation, never C08 or source authority.
 * Both state observations and both granular source/coverage observations remain
 * real. Unsupported dependency kinds continue through the full metric producer. */
export function createSfConditionedCriterionMetric(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
}) {
  const { authority, business } = input
  const host = authority.host, state = authority.state, planner = business.planner, sources = business.plannerSources
  const product = business.plannerProduct, results = business.results, cases = business.cases, persistence = host.persistence
  const compare = planner.compareScenarios
  const methods = [
    [host, "requestFor"], [host, "revalidate"], [host, "authenticate"], [host, "environment"],
    [persistence, "transaction"], [persistence, "currentSnapshots"], [state, "read"], [business, "selectedCase"], [business, "lockedSourceFences"],
    [business, "authorizeCase"], [cases, "read"], [planner, "compareScenarios"],
    [results, "readHistoricalScenario"], [sources, "resolveForecastSource"], [sources, "resolveForecastCoverage"],
  ] as const
  const fields = [[authority, "host"], [authority, "state"], [host, "persistence"], [business, "planner"], [business, "plannerSources"],
    [business, "plannerProduct"], [product, "scenarios"], [business, "results"], [business, "cases"]] as const
  const own = (object: object, key: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(object, key)
    return descriptor && "value" in descriptor ? descriptor.value : undefined
  }
  const pinned = methods.map(([object, key]) => own(object, key))
  const containers = fields.map(([object, key]) => own(object, key))
  const supported = pinned.every((value) => typeof value === "function") && containers.every((value) => !!value && typeof value === "object")
  criterionObservationProbe("factory", { supported, methodCount: pinned.length, functionCount: pinned.filter((value) => typeof value === "function").length,
    missingMethodBits: pinned.reduce((bits, value, index) => bits | (typeof value === "function" ? 0 : 1 << index), 0),
    containerCount: containers.length, objectCount: containers.filter((value) => !!value && typeof value === "object").length,
    missingContainerBits: containers.reduce((bits, value, index) => bits | (value && typeof value === "object" ? 0 : 1 << index), 0) })
  const current = () => supported && methods.every(([object, key], index) => own(object, key) === pinned[index]) &&
    fields.every(([object, key], index) => own(object, key) === containers[index])
  const observe = createPlannerCriterionObservationReader(compare, current)
  return async (request: MetricRequest, call: TrustedDomainContext, stored: StoredDecisionResult) => {
    const started = performance.now()
    const probe = (phase: string, values: Record<string, unknown> = {}) => criterionObservationProbe(phase, { elapsedMs: performance.now() - started, ...values })
    let samplePass = 0, sourcePass = 0
    probe("begin")
    const captured = structuredClone(request), storedDigest = digestSfValue(stored)
    const result = await observe(request, call, async (observation, ownerCurrent) => {
      const transport = host.requestFor(call)
      const unchanged = () => current() && ownerCurrent() && !!transport && host.requestFor(call) === transport && !transport.signal.aborted &&
        digestSfValue(request) === digestSfValue(captured) && digestSfValue(stored) === storedDigest && current() && ownerCurrent()
      if (!transport || !unchanged()) return false
      const sample = async () => {
        const sampleStarted = performance.now(), pass = ++samplePass
        probe("sample-begin", { pass })
        if (!unchanged() || !await host.revalidate(call) || !unchanged()) return undefined
        const selected = await business.selectedCase(call)
        probe("sample-selection", { pass, durationMs: performance.now() - sampleStarted, status: selected.status })
        if (selected.status !== "ok" || !same(selected.value, captured.caseRef) || !unchanged()) return undefined
        let expected: string | undefined
        let expectedSupported: boolean | undefined
        let borrowed: unknown
        const found = await state.read(transport, "cases", async (snapshot, actor) => {
          if (!sameAuthority(actor, call) || !unchanged()) return undefined
          const ruleKey = criterionRuleKey(captured.caseRef, captured.criterionId)
          let ruleDigest: string | undefined
          const rule = await state.read(transport, "preferences", (preferences, ruleActor) => {
            if (!sameAuthority(ruleActor, call) || !unchanged()) return undefined
            const value = preferences.preferences[ruleKey]
            ruleDigest = digestSfValue(value)
            return value
          })
          if (rule.status !== "ok" || !unchanged() || ruleDigest !== digestSfValue(rule.value) ||
            !same(rule.value, snapshot.preferences[ruleKey])) return undefined
          const selection: Selection = { decision: snapshot.cases[captured.caseRef.id],
            results: observation.scenarioRefs.map((reference) => snapshot.decisionResults?.[reference]), rule: rule.value }
          const proof = inspect(selection, captured, observation, storedDigest, call)
          probe("sample-inspected", { pass, recognized: !!proof, supported: proof?.supported })
          if (!proof) return undefined
          expectedSupported = proof.supported
          const caseCopy = structuredClone(selection.decision!)
          const caseDigest = digestSfValue(caseCopy)
          if (!await business.authorizeCase(caseCopy, call) || digestSfValue(caseCopy) !== caseDigest || !unchanged()) return undefined
          const fences = business.lockedSourceFences()
          if (!fences) return undefined
          borrowed = { selection, actor, fences, revision: snapshot.revision, incarnation: snapshot.incarnation, versions: snapshot.versions }
          expected = digestSfValue(borrowed)
          const allowed = await host.revalidate(call)
          probe("sample-final-authority", { pass, allowed })
          // The final authority check runs while C08 still holds its snapshot.
          // Only synchronous identity/digest checks follow it in this callback.
          return allowed && unchanged() && expected === digestSfValue(borrowed) && same(fences, business.lockedSourceFences())
            ? { digest: expected, supported: proof.supported } : undefined
        })
        probe("sample-state-returned", { pass, durationMs: performance.now() - sampleStarted, status: found.status })
        return found.status === "ok" && found.value && expected === found.value.digest && expectedSupported === found.value.supported && expected === digestSfValue(borrowed) && unchanged()
          ? { ...found.value, unchanged: () => expected === digestSfValue(borrowed) } : undefined
      }
      const before = await sample()
      probe("first-sample", { available: !!before, supported: before?.supported })
      if (!before || !unchanged()) return false
      if (!before.supported) { probe("dependency-fallback"); return "unsupported" }
      const sourceObservation = async () => {
        const pass = ++sourcePass, sourcePassStarted = performance.now()
        probe("source-pass-begin", { pass })
        for (const [index, source] of observation.sources.entries()) {
          const sourceStarted = performance.now()
          const actual = structuredClone(await sources.resolveForecastSource(source.refId, call))
          probe("source-read", { pass, position: index + 1, durationMs: performance.now() - sourceStarted, status: actual.status })
          if (actual.status !== "ok" || !same(actual.value.evidence, source) || !unchanged() || !before.unchanged()) return false
          const coverageStarted = performance.now()
          const coverage = structuredClone(await sources.resolveForecastCoverage(observation.coverage[index]!.coverageRef, call))
          probe("coverage-read", { pass, position: index + 1, durationMs: performance.now() - coverageStarted, status: coverage.status })
          const expected = observation.coverage[index]!
          if (coverage.status !== "ok" || coverage.value.coverageRef !== expected.coverageRef ||
            digestSfValue(coverage.value.basis) !== expected.basisDigest || digestSfValue(coverage.value.assessment) !== expected.assessmentDigest ||
            !unchanged() || !before.unchanged()) return false
        }
        probe("source-pass-complete", { pass, durationMs: performance.now() - sourcePassStarted })
        return true
      }
      if (!await sourceObservation() || !await host.revalidate(call) || !unchanged() || !before.unchanged() || !await sourceObservation()) return false
      const after = await sample()
      probe("final-sample", { available: !!after, supported: after?.supported })
      return !!after && after.supported && before.digest === after.digest && before.unchanged() && after.unchanged() && unchanged()
    })
    probe("returned", { handled: !!result, consumed: result?.status === "ok", status: result?.status })
    if (!result || result.status !== "ok") return result
    return current() && digestSfValue(request) === digestSfValue(captured) && digestSfValue(stored) === storedDigest
      ? { status: "ok" as const, value: { ...captured, ...result.value } }
      : { status: "stale" as const, reason: "criterion-observation-changed" }
  }
}

function inspect(selection: Selection, request: MetricRequest, observation: PlannerCriterionObservation, storedDigest: string, call: TrustedDomainContext) {
  const decision = selection.decision
  if (!decision || !same({ id: decision.id, incarnation: decision.incarnation, version: decision.version }, request.caseRef) ||
    !decision.participants.includes(call.binding.principalRef) || selection.results.length !== 2 ||
    !selection.results[1] || digestSfValue(selection.results[1]) !== storedDigest) return undefined
  const rule = selection.rule as CriterionRule | undefined
  const criteria = decision.criteria.filter((criterion) => criterion.id === request.criterionId)
  if (!rule || rule.schema !== "sf-criterion-rule-v1" || rule.ruleRef !== request.ruleRef || rule.version !== request.ruleVersion ||
    rule.criterionId !== request.criterionId || rule.metricRef !== request.metricRef || !rule.caseRef ||
    rule.caseRef.id !== decision.id || rule.caseRef.incarnation !== decision.incarnation || rule.caseRef.version > decision.version ||
    rule.installationId !== call.binding.installationId || rule.projectId !== call.binding.projectId || criteria.length !== 1 ||
    rule.criterionDigest !== digestSfValue(criteria[0]) || rule.recordDigest !== digestSfValue(Object.fromEntries(Object.entries(rule).filter(([key]) => key !== "recordDigest"))) ||
    !["lte", "gte", "eq"].includes(rule.operator) || !Number.isFinite(rule.value) || rule.unit !== observation.metric.unit ||
    !same(rule.period, observation.metric.period)) return undefined
  let supported = !rule.sensitivity && !decision.assumptions.length && !decision.choices.length && !decision.preparedChanges.length &&
    !decision.receipts.length && !decision.questions.length && !decision.ledger.length
  const references: BusinessEvidenceRef[] = [...decision.sourceRefs, ...rule.evidenceRefs]
  for (const [index, stored] of selection.results.entries()) {
    if (!stored || stored.kind !== "scenario" || stored.schema !== "sf-decision-result-v1" || stored.resultRef !== observation.scenarioRefs[index] ||
      stored.caseRef.id !== decision.id || stored.caseRef.incarnation !== decision.incarnation || stored.caseRef.version > decision.version ||
      digestSfValue(stored.result) !== stored.resultDigest || stored.resultDigest !== observation.resultDigests[index]) return undefined
    const alternatives = decision.alternatives.filter((alternative) => digestSfValue(alternative.scenario) === stored.requestDigest &&
      digestSfValue(alternative.result) === stored.resultDigest)
    if (alternatives.length !== 1) return undefined
    const alternative = alternatives[0]!, expected = observation.coverage[index]!, source = observation.sources[index]!
    const bases = decision.costCoverageBases.filter((basis) => basis.id === alternative.result.costCoverage.basisId && basis.version === alternative.result.costCoverage.basisVersion)
    if (bases.length !== 1 || digestSfValue(bases[0]) !== expected.basisDigest || digestSfValue(alternative.result.costCoverage) !== expected.assessmentDigest ||
      decisionCoverageRef(request.caseRef, alternative.id, alternative.version) !== expected.coverageRef ||
      alternative.scenario.baseRef !== source.refId || alternative.result.currency !== observation.metric.unit ||
      !same(alternative.result.horizon, observation.metric.period)) return undefined
    supported &&= alternative.scenario.operations.length === 0 && alternative.scenario.assumptions.length === 0
    references.push(...stored.sourceRefs, ...alternative.result.sourceRefs, ...bases[0]!.sourceRefs,
      ...alternative.result.costCoverage.evaluatedSourceRefs,
      ...alternative.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs))
  }
  const dependenciesSupported = supported
  supported &&= references.length > 0 && references.every((reference) => reference.kind === "record" &&
    reference.target.surface === "planner" && reference.target.recordType === "planner-version" &&
    observation.sources.some((source) => same(source, reference)))
  criterionObservationProbe("eligibility", { supported, dependenciesSupported, sensitivity: !!rule.sensitivity, assumptions: decision.assumptions.length,
    choices: decision.choices.length, preparedChanges: decision.preparedChanges.length, receipts: decision.receipts.length,
    questions: decision.questions.length, ledger: decision.ledger.length, referenceCount: references.length })
  return { supported }
}
function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
function sameAuthority(authority: SfStateAuthority, call: TrustedDomainContext) {
  return authority.principalRef === call.binding.principalRef && authority.accessRevision === call.binding.accessRevision && authority.policyVersion === call.binding.policyVersion
}
