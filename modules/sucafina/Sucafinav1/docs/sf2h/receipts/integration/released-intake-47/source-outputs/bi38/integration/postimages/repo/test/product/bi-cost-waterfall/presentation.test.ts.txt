import { expect, test } from "bun:test"
import { resolveWaterfall } from "../../../product/analytics/waterfall.ts"
import { sameBiContext } from "../../../product/analytics/projection.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { BiViewRequest } from "../../../product/contracts/operations.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import { plannerScenarioBiPresentation } from "../../../product/planner/scenario-bi.ts"
import { sfDecisionBiSelection } from "../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { compositionTestDeadline } from "../wp10/integration/composition-test-deadline.ts"
import { ok, waterfallFixture } from "./fixture.ts"

test("installed BI09 mounts the canonical waterfall for sequential human promotions and preserves pending totals", async () => {
  const deadline = compositionTestDeadline("bi09-installed-persisted-pair")
  try {
    const fixture = await waterfallFixture(deadline)
    expect(fixture.baseline.caseRef.version).toBeLessThan(fixture.candidate.caseRef.version)
    const output = ok(await deadline.phase("BI09.dispatch", () => fixture.dispatch()), "Installed BI09 presentation")
    const decision = output.projection.decision
    if (decision?.kind !== "scenario") throw new Error("Installed BI09 lost its scenario decision")
    expect(decision.scenarioResultRef).toBe(fixture.candidate.resultRef)
    expect(decision.comparisonRef).toBe(fixture.comparisonRef)
    expect(decision.comparison.baselineResultRef).toBe(fixture.baseline.resultRef)
    expect(decision.scenario).toEqual(fixture.caseValue.alternatives[1]!.result)
    expect(decision.scenario).toMatchObject({ comparisonStatus: "conditioned", total: null, costCoverage: { coverageState: "pending" } })
    expect(decision.comparison.completeDifference).toBeNull()
    expect(output.projection.components).toEqual(decision.scenario.components)
    const scenarios = fixture.business.plannerProduct.scenarios
    if (!scenarios) throw new Error("Actual Planner scenario resolver unavailable")
    const pair = ok(await deadline.phase("canonical.pair", () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, async () => {
      const baseline = await scenarios.resolve(fixture.baseline.resultRef, fixture.call)
      if (baseline.status !== "ok") return baseline
      const candidate = await scenarios.resolve(fixture.candidate.resultRef, fixture.call)
      if (candidate.status !== "ok") return candidate
      return { status: "ok", value: { baseline: baseline.value, candidate: candidate.value } }
    })), "Actual canonical pair")
    const canonical = ok(plannerScenarioBiPresentation({ ...pair.candidate.projection, decision,
      ...(output.projection.comparison ? { comparison: output.projection.comparison } : {}) }, pair, "BI09"), "Canonical cost producer")
    // Compare the actual producer output, rather than reimplementing its sums,
    // matching rules or reconciliation in either this test or the BI adapter.
    expect(output.presentation).toEqual(canonical.presentation)
    expect(output.projection.values).toEqual(canonical.projection.values)
    expect(output.projection.components).toEqual(canonical.projection.components)
    expect(output.projection.version).toBe(pair.candidate.projection.version)
    expect(output.projection.engineVersion).toBe(pair.candidate.projection.engineVersion)
    expect(output.projection.context).toMatchObject({ currency: "USD", period: fixture.period,
      installationId: "installation", projectId: "project", principalRef: "person" })
    const plan = output.presentation.waterfall
    if (!plan) throw new Error("Installed BI09 still lacks its canonical waterfall plan")
    expect(output.presentation.series.length).toBeGreaterThan(0)
    const waterfall = resolveWaterfall(output.projection, plan)
    if (waterfall.status !== "ok") throw new Error(`Supplied waterfall: ${waterfall.reason}`)
    expect(waterfall.reconciliation).toBe("reconciled")
    expect(waterfall.initial).toBe(pair.baseline.result.knownSubtotal)
    expect(waterfall.final).toBe(decision.scenario.knownSubtotal)
    expect(waterfall.segments.some((segment) => segment.amount === 0)).toBe(true)
    expect(waterfall.segments.some((segment) => typeof segment.amount === "number" && segment.amount < 0)).toBe(true)
    expect(decision.scenario.components.some((component) => typeof component.amount === "number" && component.amount < 0)).toBe(true)
    expect(plan.segments.every((segment, index) => segment.componentValueId === `difference:component:${index}`)).toBe(true)
    expect(output.projection.values.find((value) => value.id === "scenario:candidate-complete-total")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(output.projection.values.find((value) => value.id === "scenario:complete-difference")).toMatchObject({ value: null, evidenceState: "absent" })
    for (const value of output.projection.values) {
      expect(value.period).toEqual(fixture.period)
      expect(value.currency).toBe("USD")
      expect(value.sourceRefs.length).toBeGreaterThan(0)
      for (const ref of value.sourceRefs) expect([...pair.baseline.result.sourceRefs, ...pair.candidate.result.sourceRefs,
        ...pair.baseline.result.costCoverage.evaluatedSourceRefs, ...pair.candidate.result.costCoverage.evaluatedSourceRefs].some((source) =>
        digestSfValue(source) === digestSfValue(ref))).toBe(true)
    }
  } finally { await deadline.close() }
}, 120_000)

test("installed BI09 preserves a complete comparison supported by separate confirmed costs for every category", async () => {
  const deadline = compositionTestDeadline("bi09-complete-covered-costs")
  try {
    // These are declared synthetic source records, each with a genuine nonzero
    // quantity in the closed month. Human coverage registers every category as
    // included; only the actual producer may conclude that coverage is complete.
    const fixture = await waterfallFixture(deadline, { complete: true })
    const output = ok(await deadline.phase("BI09.dispatch", () => fixture.dispatch()), "Complete-cost presentation")
    const decision = output.projection.decision
    if (decision?.kind !== "scenario" || !output.presentation.waterfall) throw new Error("Complete-cost waterfall unavailable")
    expect(decision.scenario.comparisonStatus).toBe("complete")
    expect(decision.comparison.comparisonStatus).toBe("complete")
    expect(decision.scenario.costCoverage.coverageState).toBe("complete")
    expect(decision.scenario.costCoverage.entries.map((entry) => entry.categoryId)).toEqual([...RENEWAL_TRANSITION_CATEGORIES])
    expect(decision.scenario.costCoverage.entries.every((entry) => entry.status === "included" && entry.componentRefs.length === 1 && entry.evidenceRefs.length > 0)).toBe(true)
    expect(decision.scenario.components.every((component) => component.evidenceState === "confirmed" && component.amount !== null && component.amount !== 0)).toBe(true)
    expect(decision.scenario.components).toHaveLength(RENEWAL_TRANSITION_CATEGORIES.length)
    expect(decision.scenario.total).toBe(decision.scenario.knownSubtotal)
    expect(decision.comparison.completeDifference).toBe(decision.comparison.knownDifference)
    const waterfall = resolveWaterfall(output.projection, output.presentation.waterfall)
    if (waterfall.status !== "ok") throw new Error(`Complete-cost waterfall: ${waterfall.reason}`)
    expect(waterfall.reconciliation).toBe("reconciled")
    expect(waterfall.final).toBe(decision.scenario.total)
    expect(output.projection.values.find((value) => value.id === "scenario:candidate-complete-total")).toMatchObject({
      value: decision.scenario.total, evidenceState: "confirmed", currency: "USD", period: fixture.period,
    })
    expect(decision.scenario.sourceRefs).toEqual(fixture.caseValue.alternatives[1]!.result.sourceRefs)
    expect(output.projection.components).toEqual(decision.scenario.components)
    expect(fixture.baseline.caseRef.version).toBeLessThan(fixture.candidate.caseRef.version)
  } finally { await deadline.close() }
}, 120_000)

test("installed BI09 keeps real zero and opposing contributions when the known difference cancels", async () => {
  const deadline = compositionTestDeadline("bi09-zero-cancellation")
  try {
    const fixture = await waterfallFixture(deadline, { cancellation: true })
    const output = ok(await deadline.phase("BI09.dispatch", () => fixture.dispatch()), "Cancellation presentation")
    const plan = output.presentation.waterfall
    if (!plan) throw new Error("Cancellation lost the waterfall")
    const waterfall = resolveWaterfall(output.projection, plan)
    if (waterfall.status !== "ok") throw new Error(`Cancellation waterfall: ${waterfall.reason}`)
    expect(waterfall.reconciliation).toBe("reconciled")
    expect(waterfall.initial).toBe(waterfall.final)
    expect(waterfall.segments.some((segment) => segment.amount === 0)).toBe(true)
    expect(waterfall.segments.some((segment) => typeof segment.amount === "number" && segment.amount > 0)).toBe(true)
    expect(waterfall.segments.some((segment) => typeof segment.amount === "number" && segment.amount < 0)).toBe(true)
    expect(output.projection.values.find((value) => value.id === "scenario:known-difference")?.value).toBe(0)
    expect(output.projection.values.find((value) => value.id === "scenario:complete-difference")?.value).toBeNull()
  } finally { await deadline.close() }
}, 120_000)

test("installed BI09 preserves missing costs as null without manufacturing a closing residual", async () => {
  const deadline = compositionTestDeadline("bi09-missing-cost")
  try {
    const fixture = await waterfallFixture(deadline, { missing: true })
    const output = ok(await deadline.phase("BI09.dispatch", () => fixture.dispatch()), "Missing-cost presentation")
    const decision = output.projection.decision
    if (decision?.kind !== "scenario" || !output.presentation.waterfall) throw new Error("Missing-cost presentation unavailable")
    expect(decision.scenario.components.some((component) => component.amount === null && component.evidenceState === "absent")).toBe(true)
    expect(output.projection.components).toEqual(decision.scenario.components)
    const waterfall = resolveWaterfall(output.projection, output.presentation.waterfall)
    if (waterfall.status !== "ok") throw new Error(`Missing-cost waterfall: ${waterfall.reason}`)
    expect(waterfall.reconciliation).toBe("unavailable")
    expect(waterfall.segments.some((segment) => segment.amount === null)).toBe(true)
    expect(waterfall.initial).toBeNull()
    expect(waterfall.final).toBeNull()
    expect(output.projection.values.find((value) => value.id === "scenario:candidate-known-subtotal")?.value).toBe(decision.scenario.knownSubtotal)
    expect(output.projection.values.find((value) => value.id === "scenario:candidate-complete-total")?.value).toBeNull()
    expect(output.presentation.waterfall.segments.every((segment) => /^difference:component:\d+$/.test(segment.componentValueId))).toBe(true)
  } finally { await deadline.close() }
}, 120_000)

test("installed BI09 consumes the equivalent persisted Portfolio analysis without replacing its decision", async () => {
  const deadline = compositionTestDeadline("bi09-portfolio-equivalence")
  try {
    const fixture = await waterfallFixture(deadline)
    const selected = await fixture.preparePortfolio()
    const scenarioSelection = sfDecisionBiSelection({ scenarioResultRef: selected.analysis.scenarioResultRef, comparisonRef: selected.analysis.comparisonRef })
    const scenario = ok(await deadline.phase("BI09.scenario", () => fixture.dispatch("BI09", scenarioSelection)), "Equivalent scenario presentation")
    const portfolio = ok(await deadline.phase("BI09.portfolio", () => fixture.dispatch("BI09", selected.selectionRef)), "Installed Portfolio presentation")
    expect(portfolio.projection.decision).toEqual({ kind: "portfolio", portfolioResultRef: selected.bundle.portfolioResultRef, portfolio: selected.bundle.portfolio })
    expect(portfolio.presentation.waterfall).toBeDefined()
    expect(portfolio.presentation.waterfall).toEqual(scenario.presentation.waterfall)
    expect(portfolio.presentation.series).toEqual(scenario.presentation.series)
    expect(portfolio.projection.values).toEqual(scenario.projection.values)
    expect(portfolio.projection.components).toEqual(scenario.projection.components)
    expect(sameBiContext(portfolio.projection.context, scenario.projection.context)).toBe(true)
    expect(portfolio.projection.version).toBe(scenario.projection.version)
    expect(portfolio.projection.engineVersion).toBe(scenario.projection.engineVersion)
    const forged = sfDecisionBiSelection({ portfolioResultRef: selected.bundle.portfolioResultRef, sourceScenarioRef: fixture.baseline.resultRef })
    const rejected = await fixture.dispatch("BI09", forged)
    expect(rejected.status).not.toBe("ok")
    expect(rejected).not.toHaveProperty("value")
  } finally { await deadline.close() }
}, 120_000)

test("installed BI09 rejects changed selections, scope, result identity, authority and cancellation", async () => {
  const deadline = compositionTestDeadline("bi09-selection-authority")
  try {
    const fixture = await waterfallFixture(deadline)
    const refuses = async (read: ReturnType<typeof fixture.dispatch>) => {
      const result = await read
      expect(result.status).not.toBe("ok")
      expect(result).not.toHaveProperty("value")
    }
    await refuses(fixture.dispatch("BI09", sfDecisionBiSelection({ scenarioResultRef: fixture.baseline.resultRef, comparisonRef: fixture.comparisonRef })))
    await refuses(fixture.dispatch("BI09", sfDecisionBiSelection({ scenarioResultRef: fixture.candidate.resultRef, comparisonRef: "not-a-persisted-comparison" })))
    await refuses(fixture.dispatch("BI09", fixture.selectionRef, { start: "2026-02-01", end: "2026-02-28" }))
    const request: BiViewRequest = { viewId: "BI09", selectionRef: fixture.selectionRef, period: fixture.period }
    const controller = new AbortController()
    const cancelled = await fixture.admit(request, controller.signal)
    controller.abort(new Error("Caller cancelled BI09"))
    await refuses(fixture.bi.dispatchPresentation(request, cancelled))
    const preserved = await fixture.authority.state.read(fixture.request(), "cases", (state) => structuredClone(state.decisionResults?.[fixture.candidate.resultRef]))
    if (preserved.status !== "ok" || preserved.value?.kind !== "scenario") throw new Error("Actual candidate unavailable for scope counterproof")
    const candidateRecord = preserved.value
    for (const scope of ["currency", "horizon"] as const) {
      await fixture.store.transaction("dashboard", async (snapshot) => {
        const state = snapshot.data.__sfProductV1 as SfProductState
        const candidate = state.decisionResults?.[fixture.candidate.resultRef]
        if (candidate?.kind !== "scenario") throw new Error("Stored candidate unavailable for counterproof")
        if (scope === "currency") candidate.result.currency = "EUR"
        else candidate.result.horizon = { start: "2026-02-01", end: "2026-02-28" }
        candidate.resultDigest = digestSfValue(candidate.result)
        return { commit: true, value: undefined }
      })
      await refuses(fixture.dispatch())
      await fixture.store.transaction("dashboard", async (snapshot) => {
        const state = snapshot.data.__sfProductV1 as SfProductState
        if (!state.decisionResults) throw new Error("Actual result store unavailable")
        state.decisionResults[fixture.candidate.resultRef] = structuredClone(candidateRecord)
        return { commit: true, value: undefined }
      })
    }
    const storedComparison = await fixture.authority.state.read(fixture.request(), "cases", (state) => structuredClone(state.decisionResults?.[fixture.comparisonRef]))
    if (storedComparison.status !== "ok" || storedComparison.value?.kind !== "comparison") throw new Error("Actual comparison unavailable for counterproof")
    const comparisonRecord = storedComparison.value
    await fixture.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      const comparison = state.decisionResults?.[fixture.comparisonRef]
      if (comparison?.kind !== "comparison") throw new Error("Stored comparison unavailable")
      comparison.result.baselineResultRef = fixture.candidate.resultRef
      comparison.resultDigest = digestSfValue(comparison.result)
      return { commit: true, value: undefined }
    })
    await refuses(fixture.dispatch())
    await fixture.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      if (!state.decisionResults) throw new Error("Actual comparison store unavailable")
      state.decisionResults[fixture.comparisonRef] = structuredClone(comparisonRecord)
      return { commit: true, value: undefined }
    })
    await fixture.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.cases[fixture.caseRef.id]!.participants = []
      return { commit: true, value: undefined }
    })
    await refuses(fixture.dispatch())
    await fixture.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.cases[fixture.caseRef.id]!.participants = ["person"]
      return { commit: true, value: undefined }
    })
    const admitted = await fixture.admit(request)
    fixture.active.value = false
    await refuses(fixture.bi.dispatchPresentation(request, admitted))
    fixture.active.value = true
    // An older version is legitimate; another incarnation of that baseline is
    // not. Mutating persisted fixture data is an adversarial counterproof only.
    await fixture.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      const baseline = state.decisionResults?.[fixture.baseline.resultRef]
      if (!baseline) throw new Error("Stored baseline unavailable for counterproof")
      baseline.caseRef.incarnation = "forged-baseline-incarnation"
      return { commit: true, value: undefined }
    })
    await refuses(fixture.dispatch())
  } finally { await deadline.close() }
}, 120_000)

test("installed BI09 rejects current source mutation and leaves BI10 and BI11 contracts intact", async () => {
  const deadline = compositionTestDeadline("bi09-source-and-other-views")
  try {
    const fixture = await waterfallFixture(deadline)
    const timeline = ok(await deadline.phase("BI10.dispatch", () => fixture.dispatch("BI10")), "Existing BI10 table presentation")
    expect(timeline.presentation).toMatchObject({ viewId: "BI10", series: [] })
    expect(timeline.presentation.waterfall).toBeUndefined()
    expect(timeline.presentation.timeline).toBeUndefined()
    expect(timeline.projection.decision?.kind).toBe("scenario")
    const sensitivity = await fixture.dispatch("BI11")
    expect(sensitivity.status).not.toBe("ok")
    expect(sensitivity).not.toHaveProperty("value")
    // A BI11 sensitivity result is still required. This mission must not turn a
    // plain comparison into sensitivity or claim the BI10 timeline completed.
    await fixture.persistence.transaction("planner", async (snapshot) => {
      const versions = snapshot.data.versions as { id: string; lines: { id: string; f: (number | null)[] }[] }[]
      const service = versions.find((version) => version.id === "waterfall-v1")?.lines.find((line) => line.id === "service")
      if (!service) throw new Error("Actual source unavailable for mutation")
      service.f[0] = 81
      return { commit: true, value: undefined }
    })
    const stale = await fixture.dispatch()
    expect(stale.status).not.toBe("ok")
    expect(stale).not.toHaveProperty("value")
  } finally { await deadline.close() }
}, 120_000)
