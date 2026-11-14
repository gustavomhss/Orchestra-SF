import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CostCoverageBasis, DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { DecisionCasePort, PlannerPort, PlannerSourceHost, PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerOperationVerifier } from "../../../product/planner/operation-verifier.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { createPlannerScenarioInputs } from "../../../product/planner/scenario-inputs.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { plannerAt, plannerFixture, plannerPeriod } from "../wp03/planner-fixture.ts"

function ok<T>(result: PortResult<T>): T {
  if (result.status !== "ok") throw new Error(`${result.status}: ${result.reason}`)
  return result.value
}

/** Actual UI admission, source issuer, Planner, case access and C08; hooks only observe boundary timing. */
export async function scenarioBatchFixture() {
  const fixture = await plannerFixture()
  try {
    for (const surface of ["dashboard", "procurement"] as const) await fixture.persistence.initializeSources(surface)
    const context = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const request = fixture.host.requestFor(context)
    if (!request) throw new Error("UI source request unavailable")
    const admissions = new Map<Request, TrustedDomainContext>([[request, context]])
    const admit = async (principal = "finance") => {
      const admitted = await fixture.admit("sf-human:planner.read", {}, principal, true)
      const request = fixture.host.requestFor(admitted)
      if (!request) throw new Error("Independent UI request unavailable")
      admissions.set(request, admitted)
      return admitted
    }
    const sourceRefs = [ok(await fixture.issueSource("v0", context)).evidence, ok(await fixture.issueSource("v1", context)).evidence]
    const basis: CostCoverageBasis = { id: "batch-coverage", version: 1, decisionType: "unknown", categoryIds: [], additionalCategoryIds: [], sourceRefs }
    const entries: { id: string; scenario: ScenarioRequest; result: ScenarioResult }[] = []
    const sources: PlannerSourceHost = { ...fixture.sources, resolveForecastCoverage: async (reference) => {
      const selected = entries.find((entry) => `coverage:${entry.id}` === reference)
      return { status: "ok", value: { coverageRef: selected ? reference : `source-coverage:${reference}`, basis, assessment: selected?.result.costCoverage ?? { basisId: basis.id, basisVersion: basis.version, alternativeId: reference, alternativeVersion: 1, currency: "USD", horizon: plannerPeriod, coverageState: "pending", entries: [], derivedMissingCategoryIds: [], issues: ["inventory-unavailable"], evaluatedSourceRefs: sourceRefs } } }
    } }
    const planner = createPlannerPort({ host: fixture.host, sources })
    for (const [index, source] of sourceRefs.entries()) {
      const id = index === 0 ? "baseline" : "selected"
      const scenario: ScenarioRequest = { baseRef: source.refId, operations: [], assumptions: [] }
      const result = ok(await planner.simulateScenario(scenario, context))
      if (result.comparisonStatus !== "conditioned") throw new Error("Incomplete inventory must remain conditioned")
      entries.push({ id, scenario, result: { ...result, costCoverage: { ...result.costCoverage, alternativeId: id, alternativeVersion: 1 } } })
    }
    const caseRef = { id: "batch-case", incarnation: "batch-incarnation", version: 1 }
    const otherCaseRef = { id: "other-batch-case", incarnation: "other-batch-incarnation", version: 1 }
    const decision: DecisionCase = { ...caseRef, state: "comparing", objective: "Observe two authorized siblings", currency: "USD", horizon: plannerPeriod, criteria: [], participants: [context.binding.principalRef], sourceRefs, alternatives: entries.map((entry) => ({ id: entry.id, version: 1, title: entry.id, scenario: entry.scenario, result: entry.result })), costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const counters = { next: 0 }
    const state = createSfProductState({ persistence: fixture.persistence, createId: () => "batch-state", resolveTarget: async (_request, _snapshot, _namespace, targetRef) => ({ incarnation: targetRef === otherCaseRef.id ? otherCaseRef.incarnation : caseRef.incarnation }), authorize: async (incoming) => {
      const admitted = admissions.get(incoming)
      return admitted && await fixture.host.revalidate(admitted) ? admitted.binding : undefined
    } })
    const seeded = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "batch-seed", commandDigest: digestSfValue({ decision, otherCaseRef }), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (value) => { value.cases[caseRef.id] = decision; value.cases[otherCaseRef.id] = { ...structuredClone(decision), ...otherCaseRef }; return { commit: true, value: true } })
    if (seeded.status !== "ok" || !seeded.value) throw new Error("Batch case persistence unavailable")
    const authorizeCase = async (value: DecisionCase, trusted: TrustedDomainContext) => value.participants.includes(trusted.binding.principalRef) && await fixture.host.revalidate(trusted)
    const verifySource = async (ref: BusinessEvidenceRef, trusted: TrustedDomainContext) => {
      const current = await fixture.sources.resolveForecastSource(ref.refId, trusted)
      return ref.kind === "record" && current.status === "ok" && digestSfValue(current.value.evidence) === digestSfValue(ref)
    }
    const evidence: BusinessContextService = {
      resolve: async (ref, trusted) => ({ ref, state: await verifySource(ref, trusted) ? "fresh" : "unavailable", accessRevision: trusted.binding.accessRevision, checkedAt: plannerAt }),
      context: async ({ refs }, trusted) => Promise.all(refs.map((ref) => evidence.resolve(ref, trusted))), recall: async () => [], emitFromLedger: async () => { throw new Error("No Atlas publication in this fixture") },
    }
    const results = createSfDecisionResultStore({ state, host: fixture.host, authorizeCase, verifySources: async (_result, refs, trusted) => (await Promise.all(refs.map((ref) => verifySource(ref, trusted)))).every(Boolean), createId: () => `batch-result-${++counters.next}`, now: () => plannerAt })
    const saved = [] as string[]
    for (const entry of entries) saved.push(ok(await results.write({ kind: "scenario", result: entry.result, caseRef, requestDigest: digestSfValue(entry.scenario), sourceRefs: entry.result.sourceRefs, idempotencyKey: `batch-${entry.id}` }, context)).resultRef)
    const scenarioInputs = createPlannerScenarioInputs({ planner, sources, verifyAssumption: async () => ({ status: "unavailable", reason: "no-assumptions-in-this-fixture" }) })
    const verifyOperations = createPlannerOperationVerifier({ host: fixture.host, sources, planner, scenarioInputs })
    const cases = createDecisionCasePort({ state, host: fixture.host, creationTarget: { ref: caseRef.id, incarnation: caseRef.incarnation }, operationIdentity: () => "batch-case", authorizeCase, verifyScenarioOperations: async (value, trusted) => (await Promise.all(value.alternatives.map((alternative) => verifyOperations(alternative.scenario, trusted)))).every(Boolean), evidence, createId: () => "unused", now: () => plannerAt })
    const changeCase = async (update: (value: DecisionCase) => DecisionCase) => {
      const current = await state.read(request, "cases", (value) => value.cases[caseRef.id])
      if (current.status !== "ok" || !current.value) throw new Error("Batch case unavailable")
      const next = update(structuredClone(current.value))
      const saved = await state.transaction(request, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: `batch-change-${++counters.next}`, commandDigest: digestSfValue(next) }, async (value) => { value.cases[caseRef.id] = next; return { commit: true, value: true } })
      if (saved.status !== "ok" || !saved.value) throw new Error("Batch case mutation unavailable")
      return next
    }
    const observe = () => {
      const counts = { cases: 0, stores: 0, forecasts: 0, events: [] as string[] }
      const hooks: {
        afterCase?: (count: number, value: Awaited<ReturnType<DecisionCasePort["read"]>>) => void | Promise<void>
        afterStore?: (count: number, value: Awaited<ReturnType<typeof results.readHistoricalScenario>>) => void | Promise<void>
        afterForecast?: (count: number, value: Awaited<ReturnType<PlannerPort["compareForecast"]>>) => void | Promise<void>
      } = {}
      const observedCases: DecisionCasePort = { ...cases, read: async (input, trusted) => {
        counts.events.push("case")
        const result = await cases.read(input, trusted)
        counts.cases++
        await hooks.afterCase?.(counts.cases, result)
        return result
      } }
      const observedStore = { ...results, readHistoricalScenario: async (input: Parameters<typeof results.readHistoricalScenario>[0], trusted: TrustedDomainContext) => {
        counts.events.push(`store:${input.resultRef}`)
        const result = await results.readHistoricalScenario(input, trusted)
        counts.stores++
        await hooks.afterStore?.(counts.stores, result)
        return result
      } }
      const scenarios = createStoredPlannerScenarioHost({ store: observedStore, cases: observedCases, coverageRefFor: (_case, alternative) => `coverage:${alternative.id}`, planner: { compareForecast: async (input, trusted) => {
        counts.events.push(`forecast:${input.baseRef}`)
        const result = await planner.compareForecast(input, trusted)
        counts.forecasts++
        await hooks.afterForecast?.(counts.forecasts, result)
        return result
      } } })
      return { scenarios, counts, hooks, cases: observedCases, store: observedStore }
    }
    return { fixture, context, request, state, results, cases, sources, planner, entries, saved, evidence, decision, caseRef, otherCaseRef, changeCase, observe, admit, close: fixture.close }
  } catch (error) {
    await fixture.close()
    throw error
  }
}
