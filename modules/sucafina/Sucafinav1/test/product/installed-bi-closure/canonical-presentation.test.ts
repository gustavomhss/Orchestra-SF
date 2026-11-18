import { expect, test } from "bun:test"
import { resolveTimeline } from "../../../product/analytics/milestones.ts"
import { sameBiContext } from "../../../product/analytics/projection.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { plannerScenarioBiPresentation } from "../../../product/planner/scenario-bi.ts"
import { ok, waterfallFixture } from "../bi-cost-waterfall/fixture.ts"
import { compositionTestDeadline } from "../wp10/integration/composition-test-deadline.ts"

// This focused proof isolates the new BI10 wiring against both canonical plans.
// temporal-contract.test.ts remains unchanged and still owns the two-dispatch
// cross-view assertion; its observed R1 failure is not replaced by this test.
// No timeout is raised and no actual BI09 dispatch result is claimed here.
test("focused BI10 dispatch reconciles canonical period and cost plans on its persisted pair", async () => {
  const deadline = compositionTestDeadline("bi62-focused-canonical-bi10", 165_000)
  try {
    const fixture = await waterfallFixture(deadline)
    const temporal = ok(await deadline.phase("BI10.dispatch", () => fixture.dispatch("BI10")), "Installed temporal presentation")
    const decision = temporal.projection.decision
    if (decision?.kind !== "scenario") throw new Error("BI10 lost its persisted scenario")
    expect(fixture.baseline.caseRef.version).toBeLessThan(fixture.candidate.caseRef.version)
    expect(decision.scenarioResultRef).toBe(fixture.candidate.resultRef)
    expect(decision.comparisonRef).toBe(fixture.comparisonRef)
    expect(decision.comparison.baselineResultRef).toBe(fixture.baseline.resultRef)
    expect(decision.scenario).toEqual(fixture.caseValue.alternatives[1]!.result)
    expect(decision.scenario).toMatchObject({ total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending" } })

    const scenarios = fixture.business.plannerProduct.scenarios
    if (!scenarios) throw new Error("Canonical scenario resolver unavailable")
    const pair = ok(await deadline.phase("canonical.pair", () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, async () => {
      const baseline = await scenarios.resolve(fixture.baseline.resultRef, fixture.call)
      if (baseline.status !== "ok") return baseline
      const candidate = await scenarios.resolve(fixture.candidate.resultRef, fixture.call)
      if (candidate.status !== "ok") return candidate
      return { status: "ok", value: { baseline: baseline.value, candidate: candidate.value } }
    })), "Actual canonical pair")
    const canonical = ok(plannerScenarioBiPresentation({ ...pair.candidate.projection, decision,
      ...(temporal.projection.comparison ? { comparison: temporal.projection.comparison } : {}) }, pair, "BI10"), "Canonical period presentation")
    const cost = ok(plannerScenarioBiPresentation({ ...pair.candidate.projection, decision,
      ...(temporal.projection.comparison ? { comparison: temporal.projection.comparison } : {}) }, pair, "BI09"), "Canonical cost presentation for the same pair")
    expect(decision).toEqual(cost.projection.decision)
    expect(temporal.projection.components).toEqual(cost.projection.components)
    expect(temporal.projection.version).toBe(cost.projection.version)
    expect(temporal.projection.engineVersion).toBe(cost.projection.engineVersion)
    expect(sameBiContext(temporal.projection.context, cost.projection.context)).toBe(true)
    expect(temporal.presentation).toEqual(canonical.presentation)
    expect(temporal.projection.values).toEqual(canonical.projection.values)
    expect(temporal.projection.components).toEqual(canonical.projection.components)
    expect(temporal.presentation.waterfall).toBeUndefined()
    expect(cost.presentation.waterfall).toBeDefined()
    expect(cost.presentation.timeline).toBeUndefined()
    expect(temporal.presentation.series.map((series) => series.id)).toEqual(["period-before", "period-after", "period-difference"])
    const plan = temporal.presentation.timeline
    if (!plan?.items.length) throw new Error("Installed BI10 still has no period timeline")
    const resolved = resolveTimeline(temporal.projection, plan)
    if (resolved.status !== "ok") throw new Error(`Canonical timeline rejected: ${resolved.reason}`)
    expect(new Set(resolved.items.map((item) => item.date))).toEqual(new Set([fixture.period.start, fixture.period.end]))
    expect(resolved.items.every((item) => item.state === "unknown")).toBe(true)
    const references = [...pair.baseline.result.sourceRefs, ...pair.candidate.result.sourceRefs,
      ...pair.baseline.result.costCoverage.evaluatedSourceRefs, ...pair.candidate.result.costCoverage.evaluatedSourceRefs]
    for (const item of resolved.items) {
      expect(item.source.unit).toBe("date")
      expect(item.source.period).toEqual(fixture.period)
      expect(item.source.sourceRefs.length).toBeGreaterThan(0)
      expect(item.source.sourceRefs.every((reference) => references.some((current) => digestSfValue(current) === digestSfValue(reference)))).toBe(true)
    }
    expect(temporal.presentation.limitations.some((text) => text.includes("adiar um valor não elimina a obrigação"))).toBe(true)
    expect(temporal.projection.values.find((value) => value.id === "scenario:candidate-complete-total")?.value).toBeNull()
    expect(temporal.projection.values.find((value) => value.id === "scenario:complete-difference")?.value).toBeNull()
  } finally { await deadline.close() }
}, 180_000)
