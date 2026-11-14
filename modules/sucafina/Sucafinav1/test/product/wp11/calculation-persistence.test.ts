import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createScenarioRequestStore } from "../../../product/decisions/scenario-request-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerCalculationEvidence } from "../../../product/planner/calculation-evidence.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createWp05SensitivityFixture, wp05Horizon } from "../wp05/engine-fixture.ts"

test("nested C17 calculations reopen through persisted canonical requests and replay every ancestor", async () => {
  const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "omitted", composed: true })
  const compose = (persistence: Awaited<ReturnType<typeof openLocalStore>>) => {
    const writes = new WeakSet<object>()
    const ports: { producer?: ReturnType<typeof createPlannerCalculationEvidence>; next: number } = { next: 0 }
    const state = createSfProductState({ persistence, proposalCoverageWrites: writes, createId: () => "wp11-calculation-state", resolveTarget: async () => ({ incarnation: fixture.caseRef.incarnation }), authorize: async (request) => request === fixture.request ? fixture.context.binding : undefined })
    const resolve: BusinessContextService["resolve"] = async (ref, context): Promise<BusinessEvidenceResolution> => {
      if (ref.kind === "calculation") {
        const replayed = await ports.producer?.issue(ref.target.runId, context)
        return { state: replayed?.status === "ok" && digestSfValue(replayed.value) === digestSfValue(ref) ? "fresh" : "unavailable", ref, ...(replayed?.status === "ok" ? { currentRef: replayed.value } : {}), accessRevision: context.binding.accessRevision, checkedAt: "2026-11-13T00:00:00Z" }
      }
      const resolved = await fixture.evidence.resolve(ref, context)
      if (resolved.state !== "fresh" || ref.kind !== "record" || ref.target.surface !== "planner") return resolved
      const projection = await fixture.planner.compareForecast({ baseRef: ref.refId, candidateRef: ref.refId, period: wp05Horizon, currency: "USD" }, context)
      return projection.status === "ok" ? { ...resolved, currentRef: ref, authorizedProjection: projection.value.baseline } : { ...resolved, state: "unavailable" }
    }
    const evidence: BusinessContextService = { ...fixture.evidence, resolve, context: async ({ refs }, context) => Promise.all(refs.map((ref) => resolve(ref, context))) }
    const planner = createPlannerPort({ host: fixture.host, sources: fixture.sources, evidence })
    const settings = { state, host: fixture.host, authorizeCase: async () => true, verifySources: async (_value: unknown, refs: readonly BusinessEvidenceRef[]) => (await Promise.all(refs.map((ref) => resolve(ref, fixture.context)))).every((value) => value.state === "fresh"), createId: () => `wp11-calculation-${++ports.next}`, now: () => "2026-11-13T00:00:00Z" }
    const results = createSfDecisionResultStore({ ...settings, verifyCalculationSources: (value, refs, context) => ports.producer ? ports.producer.verifyCalculationSources(value, refs, context) : Promise.resolve(false) })
    const requestSettings = { state, results, host: fixture.host, authorizeCase: async () => true, authorizeProducer: async () => true, verifySnapshot: () => true, operationIdentity: () => `wp11-request-${ports.next}`, writes }
    const requests = createScenarioRequestStore({ ...requestSettings, verifyRequestSources: (request, result, context) => ports.producer ? ports.producer.verifyCalculationRequestSources(request, result, context) : Promise.resolve(false) })
    const producer = createPlannerCalculationEvidence({ host: fixture.host, readForCalculation: (request, context) => results.readForCalculation(request, context), loadRecordOnlyRequest: requests.read, replayRecordOnly: fixture.planner.simulateScenario, nested: { replayScenario: planner.simulateScenario, evidence } })
    ports.producer = producer
    return { state, results, requests, producer, planner, conservativeResults: createSfDecisionResultStore(settings), conservativeRequests: createScenarioRequestStore(requestSettings) }
  }
  try {
    const first = compose(fixture.store)
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
      return stored.value
    }
    const inner = await persist(fixture.scenario, "inner")
    const innerEvidence = await first.producer.issue(inner.resultRef, fixture.context)
    expect(innerEvidence.status).toBe("ok")
    if (innerEvidence.status !== "ok") throw new Error(innerEvidence.reason)
    const outerRequest: ScenarioRequest = { ...fixture.scenario, operations: fixture.scenario.operations.map((operation) => operation.targetRef === "implementation:11" ? { ...operation, amount: 46000 } : operation), assumptions: [{ id: "ancestor-analysis", value: "Use the earlier scenario only as traceable analysis, without approving or applying it.", state: "hypothetical", evidenceRefs: [innerEvidence.value] }] }
    const outer = await persist(outerRequest, "outer")
    expect(outer.result.knownSubtotal).toBe(211000)
    expect(outer.result.total).toBeNull()
    expect(outer.result.comparisonStatus).toBe("conditioned")
    expect(await first.conservativeResults.readForCalculation({ resultRef: outer.resultRef }, fixture.context)).toMatchObject({ status: "unavailable", reason: "calculation-source-unsupported" })
    expect(await first.conservativeRequests.read(outer.resultRef, fixture.context)).toMatchObject({ status: "unavailable", reason: "calculation-source-unsupported" })
    const issued = await first.producer.issue(outer.resultRef, fixture.context)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") throw new Error(issued.reason)
    expect(issued.value.target.sourceRefs).toContainEqual(innerEvidence.value)
    expect(await first.producer.resolve(issued.value.refId, fixture.context)).toEqual(issued)
    const reopened = await openLocalStore(fixture.directory)
    try {
      const second = compose(reopened)
      expect((await second.requests.read(outer.resultRef, fixture.context)).status).toBe("ok")
      expect(await second.producer.issue(outer.resultRef, fixture.context)).toEqual(issued)
      fixture.revokeSource(fixture.scenario.baseRef)
      expect((await second.results.readForCalculation({ resultRef: outer.resultRef }, fixture.context)).status).not.toBe("ok")
      expect((await second.producer.issue(outer.resultRef, fixture.context)).status).not.toBe("ok")
    } finally {
      await reopened.dispose()
    }
  } finally {
    await fixture.cleanup()
  }
}, 180000)
