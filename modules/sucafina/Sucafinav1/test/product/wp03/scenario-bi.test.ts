import { expect, test } from "bun:test"
import { createPlannerScenarioBiHost, plannerScenarioBiPresentation } from "../../../product/planner/scenario-bi.ts"
import { resolvePlannerScenarioBatch } from "../../../product/planner/scenario-comparison-port.ts"
import { resolveWaterfall } from "../../../product/analytics/waterfall.ts"
import { resolveTimeline } from "../../../product/analytics/milestones.ts"
import { resolveBiPresentation } from "../../../product/analytics/semantics.ts"
import { scenarioBiFixture } from "./scenario-bi-fixture.ts"

test("BI09 routes a real C08 pair through the Planner waterfall without promoting conditioned totals or reversing evidence", async () => {
  const f = await scenarioBiFixture({ training: 40000 })
  try {
    const before = await f.snapshot()
    const shown = await f.factory.readPresentation(f.payload, f.context)
    expect(shown.status).toBe("ok")
    if (shown.status !== "ok") throw new Error(JSON.stringify(shown))
    const { projection, presentation } = shown.value
    expect(presentation.viewId).toBe("BI09")
    expect(projection.decision).toEqual({ kind: "scenario", scenarioResultRef: f.candidateRef, scenario: f.candidate, comparisonRef: f.selection.comparisonRef, comparison: f.comparison })
    expect(projection.comparison?.comparisonRef).toBe(f.selection.advantageComparisonRef)
    expect(projection.comparison?.values.find((value) => value.id === "scenario:advantage-known-difference")?.value).toBe(-10000)
    expect(f.comparison.knownDifference).toBe(10000)
    expect(f.inverse.knownDifference).toBe(-10000)
    expect(projection.values.find((value) => value.id === "scenario:candidate-known-subtotal")).toMatchObject({ value: 250000, currency: "USD", evidenceState: "estimated" })
    expect(projection.values.find((value) => value.id === "scenario:candidate-complete-total")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(projection.values.find((value) => value.id === "scenario:complete-difference")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(projection.decision?.kind === "scenario" && projection.decision.scenario.costCoverage.coverageState).toBe("pending")
    expect(presentation.series.find((series) => series.role === "result")?.label).toBe("Subtotal conhecido do candidato")
    expect(presentation.waterfall).toBeDefined()
    const waterfall = resolveWaterfall(projection, presentation.waterfall!)
    expect(waterfall).toMatchObject({ status: "ok", initial: 240000, final: 250000, reconciliation: "reconciled" })
    if (waterfall.status !== "ok") throw new Error(JSON.stringify(waterfall))
    expect(waterfall.segments.every((segment) => segment.source.sourceRefs.length > 0)).toBe(true)
    expect(waterfall.segments.some((segment) => segment.label === "training:11" && segment.amount === 40000)).toBe(true)
    expect(resolveBiPresentation(projection, presentation).status).toBe("ok")
    expect(await f.snapshot()).toBe(before)
    const decision = await f.state.read(f.request, "cases", (state) => state.cases["scenario-bi-case"])
    expect(decision).toMatchObject({ status: "ok", value: { choices: [], preparedChanges: [], receipts: [] } })
    f.access.revision = "revoked"
    const refused = await f.plan.readView(f.payload, f.context)
    expect(refused.status).not.toBe("ok")
    expect(refused).not.toHaveProperty("value")
    expect(await f.snapshot()).toBe(before)
  } finally { await f.close() }
}, 180000)

test("BI09 preserves explicit zero, missing amount and missing FX through actual Planner scenarios", async () => {
  for (const option of [{ training: 0 }, { training: null }, { missingFx: true }]) {
    const f = await scenarioBiFixture(option)
    try {
      const before = await f.snapshot()
      const result = await f.plan.readView(f.payload, f.context)
      expect(result.status).toBe("ok")
      if (result.status !== "ok") throw new Error(JSON.stringify(result))
      const { projection, presentation } = result.value
      const waterfall = resolveWaterfall(projection, presentation.waterfall!)
      expect(waterfall.status).toBe("ok")
      if (waterfall.status !== "ok") throw new Error(JSON.stringify(waterfall))
      expect(projection.decision?.kind === "scenario" && projection.decision.scenario).toEqual(f.candidate)
      expect(projection.values.find((value) => value.id === "scenario:candidate-complete-total")).toMatchObject({ value: null, evidenceState: "absent" })
      if ("training" in option && option.training === 0) {
        expect(f.candidate.components.find((component) => component.id === "training:11")).toMatchObject({ amount: 0, evidenceState: "confirmed" })
        expect(waterfall).toMatchObject({ initial: 240000, final: 210000, reconciliation: "reconciled" })
        expect(waterfall.segments.find((segment) => segment.label === "training:11")).toMatchObject({ amount: 0 })
      } else {
        expect(waterfall).toMatchObject({ final: null, reconciliation: "unavailable" })
        expect(waterfall.segments.some((segment) => segment.amount === null)).toBe(true)
        if ("training" in option) {
          expect(f.candidate.components.find((component) => component.id === "training:11")).toMatchObject({ amount: null, evidenceState: "absent" })
          expect(projection.values.find((value) => value.id === "scenario:candidate-known-subtotal")?.value).toBe(210000)
        } else {
          expect(f.candidate.components.every((component) => component.amount === null)).toBe(true)
          expect(projection.missing.some((entry) => entry.reason === "missing-fx")).toBe(true)
          expect(projection.values.find((value) => value.id === "scenario:candidate-known-subtotal")?.value).toBeNull()
        }
      }
      expect(await f.snapshot()).toBe(before)
    } finally { await f.close() }
  }
}, 180000)

test("BI10 shows the real deferred periods and no invented annual saving or completed payment", async () => {
  const f = await scenarioBiFixture({ defer: true })
  try {
    const payload = { ...f.payload, viewId: "BI10" }
    const context = await f.admit("sf_bi_view", payload, "finance", true)
    const before = await f.snapshot()
    const shown = await f.factory.readPresentation(payload, context)
    expect(shown.status).toBe("ok")
    if (shown.status !== "ok") throw new Error(JSON.stringify(shown))
    const { projection, presentation } = shown.value
    expect(projection.decision?.kind === "scenario" && projection.decision.scenario).toEqual(f.candidate)
    expect(f.baseline.knownSubtotal).toBe(210000)
    expect(f.candidate.knownSubtotal).toBe(210000)
    expect(f.comparison.knownDifference).toBe(0)
    expect(projection.values.find((value) => value.id === "scenario:known-difference")?.value).toBe(0)
    const contributions = presentation.series.find((series) => series.role === "contribution")!.valueIds.map((id) => projection.values.find((value) => value.id === id)!)
    expect(contributions.map((value) => value.value)).toEqual([-45000, 45000])
    expect(contributions.map((value) => value.period)).toEqual([{ start: "2027-11-01", end: "2027-11-30" }, { start: "2027-12-01", end: "2027-12-31" }])
    expect(contributions.every((value) => value.evidenceState === "hypothetical" && value.currency === "USD" && value.sourceRefs.length > 0)).toBe(true)
    const timeline = resolveTimeline(projection, presentation.timeline!)
    expect(timeline.status).toBe("ok")
    if (timeline.status !== "ok") throw new Error(JSON.stringify(timeline))
    expect(timeline.items.map((item) => item.date)).toEqual(["2027-11-01", "2027-11-30", "2027-12-01", "2027-12-31"])
    expect(timeline.items.every((item) => item.state === "unknown" && item.label.includes("do período"))).toBe(true)
    expect(presentation.limitations.some((limitation) => limitation.includes("adiar um valor não elimina a obrigação"))).toBe(true)
    expect(resolveBiPresentation(projection, presentation).status).toBe("ok")
    expect(await f.snapshot()).toBe(before)
  } finally { await f.close() }
}, 180000)

test("scenario plans reject callback mutation, changed paired projection, swallowed nested writes and final lease revocation", async () => {
  const f = await scenarioBiFixture({ training: 0 })
  try {
    const before = await f.snapshot()
    const mutated = createPlannerScenarioBiHost({ host: f.host, results: f.results, scenarios: f.scenarios, scenario: { ...f.scenario, readView: async (request, context) => {
      const result = await f.scenario.readView(request, context)
      request.selectionRef = "mutated"
      return result
    } } })
    expect(await mutated.readView(f.payload, f.context)).toMatchObject({ status: "stale", reason: "scenario-plan-selection-changed" })
    const changed = { calls: 0 }
    const mismatch = createPlannerScenarioBiHost({ host: f.host, results: f.results, scenario: f.scenario, scenarios: { ...f.scenarios, resolveMany: async (refs, context) => {
      const result = await resolvePlannerScenarioBatch(f.scenarios, refs, context)
      changed.calls++
      const baseline = result[0]
      if (changed.calls === 2 && baseline?.status === "ok") baseline.value.projection.engineVersion = "changed-engine"
      return result
    } } })
    const changedResult = await mismatch.readView(f.payload, f.context)
    expect(changed.calls).toBe(2)
    expect(changedResult).toMatchObject({ status: "stale", reason: "scenario-plan-observation-changed" })
    expect(changedResult).not.toHaveProperty("value")
    const poisoned = { calls: 0, attempted: false, rejected: false }
    const nested = createPlannerScenarioBiHost({ host: f.host, results: f.results, scenarios: f.scenarios, scenario: { ...f.scenario, readView: async (request, context) => {
      const result = await f.scenario.readView(request, context)
      if (++poisoned.calls === 2) try {
        await f.persistence.transaction("planner", async (snapshot) => { poisoned.attempted = true; snapshot.data.scenarioBiWrite = true; return { commit: true, value: true } })
      } catch { poisoned.rejected = true }
      return result
    } } })
    const blocked = await nested.readView(f.payload, f.context)
    expect(poisoned).toEqual({ calls: 2, attempted: true, rejected: true })
    expect(blocked.status).not.toBe("ok")
    expect(blocked).not.toHaveProperty("value")
    expect(await f.snapshot()).toBe(before)
    const source = await f.scenario.readView(f.payload, f.context)
    const pair = await resolvePlannerScenarioBatch(f.scenarios, [f.baselineRef, f.candidateRef], f.context)
    if (source.status !== "ok" || pair[0]?.status !== "ok" || pair[1]?.status !== "ok") throw new Error("Canonical pair unavailable")
    const foreignCurrency = structuredClone(pair[0].value)
    foreignCurrency.projection.context.currency = "EUR"
    expect(plannerScenarioBiPresentation(source.value.projection, { baseline: foreignCurrency, candidate: pair[1].value }, "BI09")).toMatchObject({ status: "unavailable", reason: "scenario-projection-scope-mismatch" })
    let finalChecks = 0
    const closed = createPlannerScenarioBiHost({ host: { ...f.host, revalidate: async (context) => {
      const allowed = await f.host.revalidate(context)
      if (++finalChecks === 2) f.ui.finish(f.context)
      return allowed
    } }, results: f.results, scenarios: f.scenarios, scenario: f.scenario })
    const revoked = await closed.readView(f.payload, f.context)
    expect(finalChecks).toBe(2)
    expect(revoked.status).not.toBe("ok")
    expect(revoked).not.toHaveProperty("value")
    expect(await f.snapshot()).toBe(before)
  } finally { await f.close() }
}, 180000)
