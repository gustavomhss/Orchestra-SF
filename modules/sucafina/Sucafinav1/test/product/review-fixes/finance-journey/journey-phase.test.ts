import { expect, test } from "bun:test"
import type { SensitivityRequest } from "../../../../product/contracts/operations.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createPlannerSensitivity, plannerSensitivityScenario } from "../../../../product/portfolio/planner-sensitivity.ts"
import { createRenewalChoiceHistory } from "../../wp11/renewal-choice-fixture.ts"
import { observeRenewalCoverage } from "./observed-coverage.ts"
import { observeRenewalPhase } from "./observed-ports.ts"
import { createFinanceJourneyTrace } from "./phase-trace.ts"

// S11's original assertions remain. The unchanged fixture owns the 180000ms guard.
// Timing decorates real ports; synthetic source grants/selection are not native AI evidence.
test("FIN-IND-005 locates confirmed sensitivity cost and preserves the 15000/15001 journey through replay and real restart", async () => {
  const trace = createFinanceJourneyTrace()
  try {
    const history = await trace.measure("fixture.create", () => createRenewalChoiceHistory())
    try {
      const before = observeRenewalPhase(history.before, trace, "omitted")
      expect(before.baselineResult.knownSubtotal).toBe(240000)
      expect(before.selectedResult).toMatchObject({ knownSubtotal: 210000, total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending", derivedMissingCategoryIds: ["training"] } })
      expect(before.selectedResult.components.some((component) => component.id.startsWith("training:"))).toBe(false)
      const priorEvaluate = createPlannerSensitivity({ results: before.results, resolve: before.issuer.resolve, revalidate: before.issuer.revalidate, preview: before.preview, exactThreshold: (request, binding, context) => before.exact(request, binding.baselineRef, context), idempotencyKey: async () => "wp13-before-training" })
      const prior = await trace.measure("omitted.evaluate", () => priorEvaluate(endpointRequest(before.sensitivityRequest), history.fixture.context))
      if (prior.status !== "ok") throw new Error(`Omitted training analysis unavailable: ${JSON.stringify(prior)}`)
      expect(prior.value.threshold).toBeCloseTo(55000, 8)
      expect(prior.value.thresholdEvidence.state).toBe("exact")
      expect(prior.value.comparisonStatus).toBe("conditioned")
      expect(prior.value.unresolvedConditions.some((condition) => condition.id === "known-components-threshold" && condition.reason.includes("known components"))).toBe(true)
      expect(prior.value.unresolvedConditions.some((condition) => condition.reason === "missing-category:training")).toBe(true)
      expect(before.selectedResult.costCoverage.derivedMissingCategoryIds).toContain("training")
      trace.mark("omitted.assertions-complete", { caseRef: before.caseRef, knownSubtotal: 210000, threshold: prior.value.threshold, comparisonStatus: prior.value.comparisonStatus })
      const chosen = await trace.measure("choice.record", history.choose)
      const originalChoice = digestSfValue(chosen.choice)
      expect(chosen.choice).toMatchObject({ alternativeId: "selected", alternativeVersion: before.selectedResult.costCoverage.alternativeVersion, basisVersion: before.basis.version, comparisonStatus: "conditioned", result: { knownSubtotal: 210000, total: null }, costCoverage: { coverageState: "pending", derivedMissingCategoryIds: ["training"] } })
      trace.mark("choice.persisted", { caseRef: chosen.caseRef, choiceDigest: originalChoice })
      const after = observeRenewalPhase(await trace.measure("training.confirm", history.resolveTraining), trace, "confirmed")
      expect(after.caseRef.id).toBe(before.caseRef.id)
      expect(after.caseRef.incarnation).toBe(before.caseRef.incarnation)
      expect(after.caseRef.version).toBeGreaterThan(chosen.caseRef.version)
      expect(after.scenario.operations).toEqual([])
      expect(after.selectedResult).toMatchObject({ knownSubtotal: 250000, total: 250000, comparisonStatus: "complete", costCoverage: { coverageState: "complete", derivedMissingCategoryIds: [] } })
      expect(after.selectedResult.components.find((component) => component.id === "training:11")).toMatchObject({ amount: 40000, currency: "USD", evidenceState: "confirmed" })
      expect(after.advantageComparison.completeDifference).toBe(-10000)
      expect(after.comparison.criterionResults).toMatchObject([{ criterionId: "renewal-difference", state: "failed" }])
      trace.mark("confirmed.assertions-complete", { caseRef: after.caseRef, total: after.selectedResult.total, advantage: after.advantageComparison.completeDifference, choiceDigest: originalChoice })
      const coveragePreview = observeRenewalCoverage(history, after, trace)
      const evaluate = createPlannerSensitivity({ results: after.results, resolve: after.issuer.resolve, revalidate: after.issuer.revalidate, preview: after.preview, coveragePreview, exactThreshold: (request, binding, context) => after.exact(request, binding.baselineRef, context), idempotencyKey: async () => "wp13-after-training" })
      const request = endpointRequest(after.sensitivityRequest)
      const result = await trace.measure("confirmed.evaluate", () => evaluate(request, history.fixture.context))
      if (result.status !== "ok") throw new Error(`Source-only certified analysis unavailable: ${JSON.stringify(result)}`)
      expect(result.value.comparisonStatus).toBe("complete")
      expect(result.value.threshold).toBeCloseTo(15000, 8)
      expect(result.value.thresholdEvidence.state).toBe("exact")
      trace.mark("confirmed.threshold-assertions-complete", { threshold: result.value.threshold, comparisonStatus: result.value.comparisonStatus })
      const binding = await after.issuer.resolve(request, history.fixture.context)
      if (binding.status !== "ok") throw new Error("Current source parameter unavailable")
      expect(binding.value.parameterOperation).toMatchObject({ targetRef: "implementation:11", amount: 45000, currency: "USD" })
      for (const amount of [15000, 15001]) {
        const preview = await trace.measure(`witness.${amount}`, () => after.preview({ baselineRef: after.baselineRef, scenario: plannerSensitivityScenario(binding.value, "implementation:11", amount) }, history.fixture.context))
        if (preview.status !== "ok") throw new Error(`Source-only threshold witness unavailable: ${JSON.stringify(preview)}`)
        expect(preview.value.metric.value).toBe(amount === 15000 ? -20000 : -19999)
        expect(preview.value.sample.total).toBeNull()
        if (preview.value.metric.value === null) throw new Error("Threshold witness has no metric")
        expect(preview.value.metric.value <= request.criterion.value).toBe(amount === 15000)
        trace.mark(`witness.${amount}.assertions-complete`, { caseRef: binding.value.caseRef, baselineRef: binding.value.baselineRef, metric: preview.value.metric.value, meetsMinimum: preview.value.metric.value <= request.criterion.value })
      }
      const decision = await trace.measure("history.read", history.readCase)
      expect(decision.choices).toHaveLength(1)
      expect(digestSfValue(decision.choices[0])).toBe(originalChoice)
      expect(decision.state).toBe("reconsidering")
      expect(decision.preparedChanges).toEqual([])
      expect(decision.receipts).toEqual([])
      trace.mark("history.assertions-complete", { choiceDigest: originalChoice })
      expect(await trace.measure("choice.authorized-replay", chosen.retry)).toEqual({ status: "ok", value: { caseRef: chosen.caseRef } })
      const replayed = await history.readCase()
      expect(replayed.ledger.filter((event) => event.kind === "choice-recorded")).toHaveLength(1)
      expect(digestSfValue(replayed.choices[0])).toBe(originalChoice)
      trace.mark("choice.replay-assertions-complete")
      // This closes the original SQLite store and UI before admitting a new reader.
      const restarted = await trace.measure("persistence.real-restart", history.restart)
      try {
        expect(await history.fixture.host.revalidate(history.fixture.context)).toBe(false)
        const collaborator = await trace.measure("persistence.collaborator-read", () => restarted.read())
        expect(collaborator.status).toBe("ok")
        if (collaborator.status !== "ok") throw new Error(`Collaborator read failed: ${collaborator.reason}`)
        expect(collaborator.value.context.principalRef).toBe("collaborator")
        expect(collaborator.value.case).toMatchObject({ id: decision.id, incarnation: decision.incarnation, version: decision.version, state: "reconsidering", preparedChanges: [], receipts: [] })
        expect(digestSfValue(collaborator.value.case.choices[0])).toBe(originalChoice)
        expect(collaborator.value.case.choices).toHaveLength(1)
        expect(collaborator.value.case.alternatives.find((alternative) => alternative.id === "selected")?.result).toMatchObject({ knownSubtotal: 250000, total: 250000, comparisonStatus: "complete" })
        expect(collaborator.value.events.filter((event) => event.kind === "choice-recorded")).toHaveLength(1)
        expect(await trace.measure("persistence.outsider-read", () => restarted.read("outsider"))).toMatchObject({ status: "denied", reason: "case-access-unavailable" })
        restarted.revoke()
        expect((await trace.measure("persistence.revoked-read", () => restarted.read())).status).toBe("denied")
        trace.mark("persistence.restart-and-revocation-assertions-complete", { choiceDigest: originalChoice, caseRef: after.caseRef })
      } finally { await restarted.close() }
    } finally { await history.cleanup() }
  } finally { trace.summary() }
}, 300000)

function endpointRequest(request: SensitivityRequest): SensitivityRequest {
  return { ...request, parameterBounds: { ...request.parameterBounds, steps: 1 } }
}
