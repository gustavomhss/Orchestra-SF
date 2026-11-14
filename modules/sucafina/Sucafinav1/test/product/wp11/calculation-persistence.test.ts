import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { CostCoverageBasis, DecisionCase } from "../../../product/contracts/decisions.ts"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createScenarioRequestStore } from "../../../product/decisions/scenario-request-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerCalculationEvidence } from "../../../product/planner/calculation-evidence.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { domain } from "../../../runtime/planner.ts"
import { plannerAt, plannerFixture, plannerPeriod, plannerSnapshot } from "../wp03/planner-fixture.ts"
import { createWp11FixtureTrace } from "./fixture-trace.ts"

test("nested C17 calculations reopen through persisted canonical requests and replay every ancestor", async () => {
  const trace = createWp11FixtureTrace("calculation-persistence")
  await trace.checkpoint("bootstrap-start")
  const fixture = await calculationFixture(trace)
  const compose = (persistence: Awaited<ReturnType<typeof openLocalStore>>) => {
    const writes = new WeakSet<object>()
    const ports: { producer?: ReturnType<typeof createPlannerCalculationEvidence>; next: number } = { next: 0 }
    const state = trace.state(createSfProductState({ persistence, proposalCoverageWrites: writes, createId: () => "wp11-calculation-state", resolveTarget: async () => ({ incarnation: fixture.caseRef.incarnation }), authorize: async (request) => request === fixture.request && await fixture.host.revalidate(fixture.context) ? fixture.context.binding : undefined }))
    const resolve: BusinessContextService["resolve"] = async (ref, context): Promise<BusinessEvidenceResolution> => {
      if (ref.kind === "calculation") {
        const replayed = await trace.measure("evidence.calculation", async () => ports.producer?.issue(ref.target.runId, context))
        return { state: replayed?.status === "ok" && digestSfValue(replayed.value) === digestSfValue(ref) ? "fresh" : "unavailable", ref, ...(replayed?.status === "ok" ? { currentRef: replayed.value } : {}), accessRevision: context.binding.accessRevision, checkedAt: "2026-11-13T00:00:00Z" }
      }
      const resolved = await fixture.evidence.resolve(ref, context)
      if (resolved.state !== "fresh" || ref.kind !== "record" || ref.target.surface !== "planner") return resolved
      const projection = await trace.measure("evidence.recordProjection", () => fixture.planner.compareForecast({ baseRef: ref.refId, candidateRef: ref.refId, period: plannerPeriod, currency: "USD" }, context))
      return projection.status === "ok" ? { ...resolved, currentRef: ref, authorizedProjection: projection.value.baseline } : { ...resolved, state: "unavailable" }
    }
    const evidence: BusinessContextService = { ...fixture.evidence, resolve, context: async ({ refs }, context) => Promise.all(refs.map((ref) => resolve(ref, context))) }
    const planner = createPlannerPort({ host: fixture.host, sources: fixture.sources, evidence })
    const settings = { state, host: fixture.host, authorizeCase: async (value: DecisionCase) => value.id === fixture.caseRef.id && value.incarnation === fixture.caseRef.incarnation && value.participants.includes(fixture.context.binding.principalRef) && await fixture.host.revalidate(fixture.context), verifySources: async (_value: unknown, refs: readonly BusinessEvidenceRef[]) => (await Promise.all(refs.map((ref) => resolve(ref, fixture.context)))).every((value) => value.state === "fresh"), createId: () => `wp11-calculation-${++ports.next}`, now: () => "2026-11-13T00:00:00Z" }
    const results = createSfDecisionResultStore({ ...settings, verifyCalculationSources: (value, refs, context) => ports.producer ? ports.producer.verifyCalculationSources(value, refs, context) : Promise.resolve(false) })
    const requestSettings = { state, results, host: fixture.host, authorizeCase: async () => true, authorizeProducer: async () => true, verifySnapshot: () => true, operationIdentity: () => `wp11-request-${ports.next}`, writes }
    const requests = createScenarioRequestStore({ ...requestSettings, verifyRequestSources: (request, result, context) => ports.producer ? ports.producer.verifyCalculationRequestSources(request, result, context) : Promise.resolve(false) })
    const producer = createPlannerCalculationEvidence({ host: fixture.host, readForCalculation: (request, context) => trace.measure(`c17.result:${request.resultRef}`, () => results.readForCalculation(request, context)), loadRecordOnlyRequest: (runId, context) => trace.measure(`c17.request:${runId}`, () => requests.read(runId, context)), replayRecordOnly: (request, context) => trace.measure("planner.replay.record", () => fixture.planner.simulateScenario(request, context)), nested: { replayScenario: (request, context) => trace.measure("planner.replay.nested", () => planner.simulateScenario(request, context)), evidence } })
    ports.producer = producer
    return { state, results, requests, producer, planner, conservativeResults: createSfDecisionResultStore(settings), conservativeRequests: createScenarioRequestStore(requestSettings) }
  }
  try {
    const first = compose(fixture.store)
    const seed = await first.state.transaction(fixture.request, { namespace: "cases", expectedStorageVersion: 0, targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation, idempotencyKey: "calculation-case", commandDigest: digestSfValue(fixture.decision) }, async (state) => { state.cases[fixture.caseRef.id] = fixture.decision; return { commit: true, value: true } })
    expect(seed.status).toBe("ok")
    await trace.checkpoint("bootstrap-complete", first.state, fixture.request)
    const persist = async (request: ScenarioRequest, idempotencyKey: string) => {
      const simulated = await first.planner.simulateScenario(request, fixture.context)
      if (simulated.status !== "ok") throw new Error(simulated.reason)
      const refs = [...simulated.value.sourceRefs, ...simulated.value.costCoverage.evaluatedSourceRefs].filter((ref, index, all) => all.findIndex((other) => digestSfValue(other) === digestSfValue(ref)) === index)
      const stored = await first.results.write({ kind: "scenario", result: simulated.value, caseRef: fixture.caseRef, requestDigest: digestSfValue(request), sourceRefs: refs, idempotencyKey }, fixture.context)
      if (stored.status !== "ok") throw new Error(stored.reason)
      if (stored.value.kind !== "scenario") throw new Error("Unexpected result kind")
      const binding = await first.requests.register({ resultRef: stored.value.resultRef, request, engineVersion: "planner-runtime-v1" }, fixture.context)
      expect(binding.status).toBe("ok")
      if (binding.status !== "ok") throw new Error(binding.reason)
      await trace.checkpoint(`persist:${idempotencyKey}:complete`, first.state, fixture.request)
      return stored.value
    }
    const inner = await persist(fixture.scenario, "inner")
    const innerEvidence = await first.producer.issue(inner.resultRef, fixture.context)
    expect(innerEvidence.status).toBe("ok")
    if (innerEvidence.status !== "ok") throw new Error(innerEvidence.reason)
    await trace.checkpoint("inner-evidence:complete", first.state, fixture.request)
    const outerRequest: ScenarioRequest = { ...fixture.scenario, operations: fixture.scenario.operations.map((operation) => operation.targetRef === "implementation:11" ? { ...operation, amount: 46000 } : operation), assumptions: [{ id: "ancestor-analysis", value: "Use the earlier scenario only as traceable analysis, without approving or applying it.", state: "hypothetical", evidenceRefs: [innerEvidence.value] }] }
    const outer = await persist(outerRequest, "outer")
    expect(outer.result.knownSubtotal).toBe(211000)
    expect(outer.result.total).toBeNull()
    expect(outer.result.comparisonStatus).toBe("conditioned")
    expect(outer.result.currency).toBe("USD")
    expect(outer.result.horizon).toEqual(plannerPeriod)
    expect(await first.conservativeResults.readForCalculation({ resultRef: outer.resultRef }, fixture.context)).toMatchObject({ status: "unavailable", reason: "calculation-source-unsupported" })
    expect(await first.conservativeRequests.read(outer.resultRef, fixture.context)).toMatchObject({ status: "unavailable", reason: "calculation-source-unsupported" })
    const issued = await first.producer.issue(outer.resultRef, fixture.context)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") throw new Error(issued.reason)
    expect(issued.value.target.sourceRefs).toContainEqual(innerEvidence.value)
    expect(await first.producer.resolve(issued.value.refId, fixture.context)).toEqual(issued)
    await trace.checkpoint("outer-evidence:complete", first.state, fixture.request)
    const reopened = await openLocalStore(fixture.directory)
    try {
      const second = compose(reopened)
      expect((await second.requests.read(outer.resultRef, fixture.context)).status).toBe("ok")
      expect(await second.producer.issue(outer.resultRef, fixture.context)).toEqual(issued)
      await trace.checkpoint("reopened-ancestry:complete", second.state, fixture.request)
      await fixture.reviseSource(fixture.scenario.baseRef)
      expect(await fixture.host.revalidate(fixture.context)).toBe(true)
      expect((await second.results.readForCalculation({ resultRef: outer.resultRef }, fixture.context)).status).not.toBe("ok")
      expect((await second.producer.issue(outer.resultRef, fixture.context)).status).not.toBe("ok")
      await trace.checkpoint("source-revision:complete", second.state, fixture.request)
    } finally {
      await reopened.dispose()
    }
  } finally {
    await fixture.cleanup()
  }
}, 180000)

/** Minimal real Planner/SQLite/source-authority fixture; no unrelated sensitivity construction. */
async function calculationFixture(trace: ReturnType<typeof createWp11FixtureTrace>) {
  const snapshot = plannerSnapshot()
  const months = (amount: number) => Array.from({ length: 12 }, (_, month) => month === 10 ? amount : 0)
  snapshot.data.versions = [{ id: "v0", name: "Persisted C17 source", year: 2027, closed: 0, lines: [
    { id: "bridge", sec: "opex", el: "licenses", cur: "USD", b: months(60000), a: Array(12).fill(null), f: months(60000) },
    { id: "implementation", sec: "opex", el: "licenses", cur: "USD", b: months(45000), a: Array(12).fill(null), f: months(45000) },
    { id: "new-service", sec: "opex", el: "licenses", cur: "USD", b: months(105000), a: Array(12).fill(null), f: months(105000) },
  ], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
  const fixture = await plannerFixture(snapshot)
  try {
    const context = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const request = fixture.host.requestFor(context)
    if (!request) throw new Error("Real Planner UI authority unavailable")
    const host = { ...fixture.host, revalidate: (trusted: Parameters<typeof fixture.host.revalidate>[0]) => trace.measure("host.revalidate", () => fixture.host.revalidate(trusted)) }
    const issued = await fixture.issueSource("v0", context)
    if (issued.status !== "ok") throw new Error(issued.reason)
    const source = issued.value.evidence
    const basis: CostCoverageBasis = { id: "calculation-source-coverage", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [source] }
    const sources: PlannerSourceHost = {
      resolveForecastSource: (reference, trusted) => trace.measure("source.resolve", () => fixture.sources.resolveForecastSource(reference, trusted)),
      resolveForecastCoverage: (reference, trusted) => trace.measure("source.coverage", async () => {
        if (reference !== source.refId || !await host.revalidate(trusted)) return { status: "unavailable" as const, reason: "calculation-coverage-unavailable" }
        // No applicability claim is supplied by this persistence fixture.
        return { status: "ok" as const, value: { coverageRef: "calculation-source-coverage", basis, assessment: { basisId: basis.id, basisVersion: basis.version, alternativeId: "scenario", alternativeVersion: 1, currency: "USD", horizon: plannerPeriod, coverageState: "pending" as const, entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ categoryId, status: "pending" as const, reason: "human-cost-classification-required" })), derivedMissingCategoryIds: [...RENEWAL_TRANSITION_CATEGORIES], issues: ["human-cost-classification-required"], evaluatedSourceRefs: [source] } } }
      }),
    }
    const evidence: BusinessContextService = {
      resolve: async (ref, trusted) => {
        const current = ref.kind === "record" ? await sources.resolveForecastSource(ref.refId, trusted) : undefined
        return { state: current?.status === "ok" && digestSfValue(current.value.evidence) === digestSfValue(ref) ? "fresh" : "revoked", ref, accessRevision: trusted.binding.accessRevision, checkedAt: plannerAt }
      },
      context: async ({ refs }, trusted) => Promise.all(refs.map((ref) => evidence.resolve(ref, trusted))),
      recall: async () => [], emitFromLedger: async () => { throw new Error("No memory publication in the persistence fixture") },
    }
    const caseRef = { id: "calculation-case", incarnation: "calculation-incarnation", version: 1 }
    const scenario: ScenarioRequest = { baseRef: source.refId, operations: [
      { kind: "replace", targetRef: "implementation:11", amount: 45000, currency: "USD", period: { start: "2027-11-01", end: "2027-11-30" } },
      { kind: "replace", targetRef: "bridge:11", amount: 60000, currency: "USD", period: { start: "2027-11-01", end: "2027-11-30" } },
      { kind: "replace", targetRef: "new-service:11", amount: 105000, currency: "USD", period: { start: "2027-11-01", end: "2027-11-30" } },
    ], assumptions: [] }
    const decision: DecisionCase = { ...caseRef, state: "investigating", objective: "Persist and reopen the canonical calculation ancestry", horizon: plannerPeriod, currency: "USD", criteria: [], participants: [context.binding.principalRef], sourceRefs: [source], alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const reviseSource = async (reference: string) => {
      if (reference !== source.refId) throw new Error("Unknown calculation source")
      const changed = await fixture.persistence.transaction("planner", async (value) => {
        const result = domain.execute(value, { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }, { page: "OPEX", action: "save", id: "implementation", version: value.versions["v0:lines:implementation"]?.version ?? 0, values: { versionId: "v0", f10: 47000 } }, { at: plannerAt, id: () => "revoked-calculation-source", directory: [] })
        return { commit: result.ok, value: result }
      })
      if (!changed.ok) throw new Error("Canonical source revision was refused")
      expect((await sources.resolveForecastSource(source.refId, context)).status).not.toBe("ok")
    }
    return { ...fixture, host, context, request, caseRef, decision, scenario, sources, evidence, planner: createPlannerPort({ host, sources }), reviseSource, cleanup: fixture.close }
  } catch (error) { await fixture.close(); throw error }
}
