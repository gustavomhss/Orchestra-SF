import { expect, test } from "bun:test"
import { resolveTimeline } from "../../../product/analytics/milestones.ts"
import { sameBiContext } from "../../../product/analytics/projection.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { plannerScenarioBiPresentation } from "../../../product/planner/scenario-bi.ts"
import { sfDecisionBiSelection } from "../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { ok, waterfallFixture } from "../bi-cost-waterfall/fixture.ts"
import { compositionTestDeadline } from "../wp10/integration/composition-test-deadline.ts"

test("installed BI10 uses the canonical period producer over the same persisted pair as BI09", async () => {
  const deadline = compositionTestDeadline("installed-bi10-canonical-pair", 165_000)
  try {
    const fixture = await waterfallFixture(deadline)
    const temporal = ok(await deadline.phase("BI10.dispatch", () => fixture.dispatch("BI10")), "Installed temporal presentation")
    const cost = ok(await deadline.phase("BI09.dispatch", () => fixture.dispatch("BI09")), "Installed cost presentation")
    const decision = temporal.projection.decision
    if (decision?.kind !== "scenario") throw new Error("BI10 lost its persisted scenario")
    expect(fixture.baseline.caseRef.version).toBeLessThan(fixture.candidate.caseRef.version)
    expect(decision).toEqual(cost.projection.decision)
    expect(decision.scenarioResultRef).toBe(fixture.candidate.resultRef)
    expect(decision.comparisonRef).toBe(fixture.comparisonRef)
    expect(decision.comparison.baselineResultRef).toBe(fixture.baseline.resultRef)
    expect(decision.scenario).toEqual(fixture.caseValue.alternatives[1]!.result)
    expect(decision.scenario).toMatchObject({ total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending" } })
    expect(temporal.projection.components).toEqual(cost.projection.components)
    expect(temporal.projection.version).toBe(cost.projection.version)
    expect(temporal.projection.engineVersion).toBe(cost.projection.engineVersion)
    expect(sameBiContext(temporal.projection.context, cost.projection.context)).toBe(true)

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

test("installed BI10 preserves the persisted Portfolio envelope and equivalent scenario timeline", async () => {
  const deadline = compositionTestDeadline("installed-bi10-portfolio", 165_000)
  try {
    const fixture = await waterfallFixture(deadline)
    const selected = await fixture.preparePortfolio()
    const equivalent = sfDecisionBiSelection({ scenarioResultRef: selected.analysis.scenarioResultRef, comparisonRef: selected.analysis.comparisonRef })
    const scenario = ok(await deadline.phase("BI10.scenario", () => fixture.dispatch("BI10", equivalent)), "Equivalent stored scenario")
    const portfolio = ok(await deadline.phase("BI10.portfolio", () => fixture.dispatch("BI10", selected.selectionRef)), "Stored Portfolio timeline")
    expect(portfolio.projection.decision).toEqual({ kind: "portfolio", portfolioResultRef: selected.bundle.portfolioResultRef, portfolio: selected.bundle.portfolio })
    expect(portfolio.presentation.timeline).toBeDefined()
    expect(portfolio.presentation.timeline).toEqual(scenario.presentation.timeline)
    expect(portfolio.presentation.series).toEqual(scenario.presentation.series)
    expect(portfolio.presentation.waterfall).toBeUndefined()
    expect(portfolio.projection.values).toEqual(scenario.projection.values)
    expect(portfolio.projection.components).toEqual(scenario.projection.components)
    expect(sameBiContext(portfolio.projection.context, scenario.projection.context)).toBe(true)
    expect(portfolio.projection.version).toBe(scenario.projection.version)
    expect(portfolio.projection.engineVersion).toBe(scenario.projection.engineVersion)
    const forged = sfDecisionBiSelection({ portfolioResultRef: selected.bundle.portfolioResultRef, sourceScenarioRef: fixture.baseline.resultRef })
    const refused = await deadline.phase("BI10.foreign-scenario", () => fixture.dispatch("BI10", forged))
    expect(refused.status).not.toBe("ok")
    expect(refused).not.toHaveProperty("value")
  } finally { await deadline.close() }
}, 180_000)

test("installed BI10 withholds changed scope, selection and current source without inventing BI11 sensitivity", async () => {
  const deadline = compositionTestDeadline("installed-bi10-current-read", 165_000)
  try {
    const fixture = await waterfallFixture(deadline)
    const initial = ok(await deadline.phase("BI10.current", () => fixture.dispatch("BI10")), "Current timeline")
    expect(initial.presentation.timeline?.items.length).toBeGreaterThan(0)
    for (const [label, selected, period] of [
      ["wrong-candidate", sfDecisionBiSelection({ scenarioResultRef: fixture.baseline.resultRef, comparisonRef: fixture.comparisonRef }), fixture.period],
      ["missing-comparison", sfDecisionBiSelection({ scenarioResultRef: fixture.candidate.resultRef, comparisonRef: "not-a-persisted-comparison" }), fixture.period],
      ["wrong-period", fixture.selectionRef, { start: "2026-02-01", end: "2026-02-28" }],
    ] as const) {
      const refused = await deadline.phase(`BI10.${label}`, () => fixture.dispatch("BI10", selected, period))
      expect(refused.status).not.toBe("ok")
      expect(refused).not.toHaveProperty("value")
    }
    const sensitivity = await fixture.dispatch("BI11")
    expect(sensitivity.status).not.toBe("ok")
    expect(sensitivity).not.toHaveProperty("value")
    await fixture.persistence.transaction("planner", async (snapshot) => {
      const versions = snapshot.data.versions as { id: string; lines: { id: string; f: (number | null)[] }[] }[]
      const service = versions.find((version) => version.id === "waterfall-v1")?.lines.find((line) => line.id === "service")
      if (!service) throw new Error("Current source missing")
      service.f[0] = 81
      return { commit: true, value: undefined }
    })
    const stale = await deadline.phase("BI10.source-changed", () => fixture.dispatch("BI10"))
    expect(stale.status).not.toBe("ok")
    expect(stale).not.toHaveProperty("value")
    // A previously returned value remains a historical observation; a refresh
    // must not return it as the current source after the source revision.
    expect(initial.projection.decision?.kind).toBe("scenario")
  } finally { await deadline.close() }
}, 180_000)
