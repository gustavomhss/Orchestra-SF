import { expect, test } from "bun:test"
import { resolveWaterfall } from "../../../product/analytics/waterfall.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BaselineCoverageRequest } from "../../../product/decisions/baseline-coverage.ts"
import { sfDecisionBiSelection } from "../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { ok } from "../bi-cost-waterfall/fixture.ts"
import { compositionTestDeadline } from "../wp10/integration/composition-test-deadline.ts"
import { trainingFixture, trainingHorizon } from "./fixture.ts"

const cases = [
  { training: "omitted", subtotal: 210000, total: null, direct: -30000, advantage: 30000, status: "conditioned", coverage: "pending" },
  { training: "confirmed", subtotal: 250000, total: 250000, direct: 10000, advantage: -10000, status: "complete", coverage: "complete" },
  { training: "zero", subtotal: 210000, total: 210000, direct: -30000, advantage: 30000, status: "complete", coverage: "complete" },
  { training: "null", subtotal: 210000, total: null, direct: -30000, advantage: 30000, status: "conditioned", coverage: "pending" },
] as const

for (const expected of cases) test(`installed BI09 preserves literal ${expected.training} training, shared coverage and its persisted inverse`, async () => {
  const deadline = compositionTestDeadline(`installed-bi-training-${expected.training}`, 165_000)
  try {
    const fixture = await trainingFixture(deadline, expected.training)
    const original = structuredClone(fixture.caseValue)
    const output = ok(await deadline.phase("BI09.training", () => fixture.dispatch()), "Training comparison presentation")
    const decision = output.projection.decision
    if (decision?.kind !== "scenario" || !output.presentation.waterfall) throw new Error("Training waterfall unavailable")
    expect(decision.scenarioResultRef).toBe(fixture.candidate.resultRef)
    expect(decision.comparisonRef).toBe(fixture.comparison.resultRef)
    expect(decision.scenario).toEqual(original.alternatives[1]!.result)
    expect(original.alternatives[0]!.result).toMatchObject({ knownSubtotal: 240000, total: 240000, comparisonStatus: "complete" })
    expect(decision.scenario).toMatchObject({ knownSubtotal: expected.subtotal, total: expected.total,
      comparisonStatus: expected.status, currency: "USD", horizon: trainingHorizon, costCoverage: { coverageState: expected.coverage } })
    expect(decision.comparison).toMatchObject({ baselineResultRef: fixture.baseline.resultRef, alternativeResultRef: fixture.candidate.resultRef,
      knownDifference: expected.direct, completeDifference: expected.status === "complete" ? expected.direct : null, comparisonStatus: expected.status })
    expect(output.projection.components).toEqual(decision.scenario.components)
    expect(output.projection.values.find((value) => value.id === "scenario:candidate-known-subtotal")?.value).toBe(expected.subtotal)
    expect(output.projection.values.find((value) => value.id === "scenario:candidate-complete-total")?.value).toBe(expected.total)
    expect(output.projection.values.find((value) => value.id === "scenario:known-difference")?.value).toBe(expected.direct)
    expect(output.projection.values.find((value) => value.id === "scenario:complete-difference")?.value).toBe(expected.status === "complete" ? expected.direct : null)

    // Advantage has its own persisted inverse observation. BI never changes the
    // sign of the canonical alternative-minus-baseline comparison.
    expect(output.projection.comparison?.comparisonRef).toBe(fixture.advantage.resultRef)
    expect(output.projection.comparison?.values.find((value) => value.id === "scenario:advantage-known-difference")?.value).toBe(expected.advantage)
    const inverse = ok(await deadline.phase("advantage.read", () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      fixture.business.results.read({ kind: "comparison", resultRef: fixture.advantage.resultRef }, fixture.call))), "Read persisted inverse")
    if (inverse.kind !== "comparison") throw new Error("Inverse reference did not address a comparison")
    expect(inverse.caseRef).toEqual(fixture.caseRef)
    expect(inverse.result).toMatchObject({ baselineResultRef: fixture.candidate.resultRef, alternativeResultRef: fixture.baseline.resultRef,
      knownDifference: expected.advantage, completeDifference: expected.status === "complete" ? expected.advantage : null })
    expect(output.projection.comparison?.values.find((value) => value.id === "scenario:advantage-known-difference")?.value).toBe(inverse.result.knownDifference)

    const coverage = decision.scenario.costCoverage
    const implementation = coverage.entries.find((entry) => entry.categoryId === "implementation")
    const migration = coverage.entries.find((entry) => entry.categoryId === "migration")
    if (implementation?.status !== "included" || migration?.status !== "included") throw new Error("Shared implementation scope unavailable")
    expect(migration.componentRefs).toEqual(implementation.componentRefs)
    expect(implementation.componentRefs).toHaveLength(12)
    expect(decision.scenario.components.filter((component) => component.id === "implementation:11")).toEqual([
      expect.objectContaining({ amount: 45000, currency: "USD", evidenceState: "confirmed" }),
    ])
    expect(new Set(decision.scenario.components.map((component) => component.id)).size).toBe(decision.scenario.components.length)
    if (expected.training !== "null") expect(coverage.issues).toEqual([])
    expect(decision.scenario.sourceRefs).toEqual(original.alternatives[1]!.result.sourceRefs)
    const training = coverage.entries.find((entry) => entry.categoryId === "training")
    const supplied = fixture.coverageRequests[1]!.entries.find((entry) => entry.categoryId === "training")
    if (expected.training === "omitted") {
      expect(supplied).toBeUndefined()
      expect(decision.scenario.components.some((component) => component.id.startsWith("training:"))).toBe(false)
      expect(coverage.derivedMissingCategoryIds).toEqual(["training"])
      expect(training).toEqual({ categoryId: "training", status: "pending", reason: "missing-category" })
    } else {
      expect(supplied?.status).toBe(expected.training === "null" ? "pending" : "included")
      expect(coverage.derivedMissingCategoryIds).toEqual([])
      expect(decision.scenario.components.find((component) => component.id === "training:11")).toMatchObject({
        amount: expected.training === "confirmed" ? 40000 : expected.training === "zero" ? 0 : null,
        currency: "USD", evidenceState: expected.training === "null" ? "absent" : "confirmed",
      })
      if (expected.training === "null") expect(training).toEqual({ categoryId: "training", status: "pending", reason: "missing-value-and-evidence" })
      else {
        if (training?.status !== "included") throw new Error("Confirmed training lost coverage")
        expect(training.componentRefs).toContain("training:11")
        expect(training.evidenceRefs).toEqual([fixture.sources[1]!])
      }
    }
    const waterfall = resolveWaterfall(output.projection, output.presentation.waterfall)
    if (waterfall.status !== "ok") throw new Error(`Training waterfall: ${waterfall.reason}`)
    expect(waterfall.reconciliation).toBe(expected.training === "null" ? "unavailable" : "reconciled")
    if (expected.training !== "null") {
      expect(waterfall.initial).toBe(240000)
      expect(waterfall.final).toBe(expected.subtotal)
    }
    expect(output.presentation.waterfall.segments.every((segment) => /^difference:component:\d+$/.test(segment.componentValueId))).toBe(true)

    if (expected.training === "omitted") {
      const forged = sfDecisionBiSelection({ scenarioResultRef: fixture.candidate.resultRef,
        comparisonRef: fixture.comparison.resultRef, advantageComparisonRef: fixture.comparison.resultRef })
      const refused = await fixture.dispatch("BI09", forged)
      expect(refused.status).not.toBe("ok")
      expect(refused).not.toHaveProperty("value")
      // An unsupported N/A statement must not close the missing category or
      // turn the already stored 210000 known subtotal into a complete total.
      const request: BaselineCoverageRequest = { ...fixture.coverageRequests[1]!, caseRef: fixture.caseRef, expectedVersion: 1,
        entries: [...fixture.coverageRequests[1]!.entries, { categoryId: "training", status: "not-applicable",
          justification: "Claim without an installed applicability producer", evidenceRefs: [fixture.sources[1]!] }] }
      const human = ok(await fixture.authority.human.admit(fixture.request("training-unproven-na"), "decisions.coverage", request), "Admit N/A counterexample")
      try {
        const result = await fixture.business.withCase(human, fixture.caseRef, {}, () => fixture.business.baselineCoverage.register(request, human))
        expect(result).toEqual({ status: "needs-input", reason: "baseline-not-applicable-proof-unavailable" })
        expect(result).not.toHaveProperty("value")
      } finally { fixture.authority.human.finish(human) }
    }
    const unchanged = await fixture.authority.state.read(fixture.request(), "cases", (state) => state.cases[fixture.caseRef.id])
    if (unchanged.status !== "ok") throw new Error("Original case unavailable after BI")
    expect(digestSfValue(unchanged.value)).toBe(digestSfValue(original))
    expect(unchanged.value?.choices).toEqual([])
    expect(unchanged.value?.preparedChanges).toEqual([])
  } finally { await deadline.close() }
}, 180_000)
