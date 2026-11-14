import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { createPlannerScenarioBiHost } from "../../../product/planner/scenario-bi.ts"
import { createStoredScenarioBiProjection } from "../../../product/analytics/stored-scenario.ts"
import { bindStoredScenarioBiPort } from "../../../product/analytics/scenario.ts"
import { sameBiProjection } from "../../../product/analytics/projection.ts"
import { resolveWaterfall } from "../../../product/analytics/waterfall.ts"
import { createRenewalChoiceHistory } from "../wp11/renewal-choice-fixture.ts"

test("BI09 accepts the complete source-only 235000 result with real N-A/shared coverage and -5000 complete difference", async () => {
  const history = await createRenewalChoiceHistory({ training: "bundled" })
  try {
    // Reuse the existing domain CAS, applicability/classification and C08 publication.
    // This test never sets coverageState, total or a financial comparison itself.
    const phase = await history.reviseImplementation()
    const { host, context, store } = history.fixture
    expect(phase.scenario.operations).toEqual([])
    expect(phase.selectedResult).toMatchObject({ knownSubtotal: 235000, total: 235000, comparisonStatus: "complete", costCoverage: { coverageState: "complete" } })
    expect(phase.baselineResult).toMatchObject({ knownSubtotal: 240000, total: 240000, comparisonStatus: "complete" })
    expect(phase.comparison).toMatchObject({ knownDifference: -5000, completeDifference: -5000, comparisonStatus: "complete" })
    const selection = { selectionRef: "covered-scenario-bi", scenarioResultRef: phase.selectedRef, comparisonRef: phase.comparisonRef }
    const request = { viewId: "BI09", selectionRef: selection.selectionRef, period: phase.selectedResult.horizon }
    const scenarios = createStoredPlannerScenarioHost({ store: phase.results, cases: phase.cases, planner: phase.planner, coverageRefFor: (caseRef, alternative) => decisionCoverageRef(caseRef, alternative.id, alternative.version) })
    const readCurrent = () => phase.planner.compareForecast({ baseRef: phase.scenario.baseRef, candidateRef: phase.scenario.baseRef, period: request.period, currency: phase.selectedResult.currency }, context)
    const readProjection = createStoredScenarioBiProjection({ results: phase.results, readProjection: async (reference) => {
      if (reference !== selection.selectionRef) return { status: "unavailable", reason: "unknown-covered-selection" }
      const current = await readCurrent()
      return current.status === "ok" ? { status: "ok", value: current.value.candidate } : current
    }, revalidateProjection: async (selected, observed, caseRef, binding) => {
      const current = await readCurrent()
      return digestSfValue(selected) === digestSfValue(selection) && digestSfValue(caseRef) === digestSfValue(phase.caseRef) && binding === context && current.status === "ok" && sameBiProjection(current.value.candidate, observed) && await host.revalidate(binding)
    } })
    const scenario = bindStoredScenarioBiPort({ readProjection, resolve: async (selected) => selected.selectionRef === selection.selectionRef ? { status: "ok", value: { ...selection, present: () => ({ viewId: "BI09", series: [], limitations: [] }) } } : { status: "unavailable", reason: "unknown-covered-selection" }, revalidate: (_request, binding) => host.revalidate(binding) })
    const plan = createPlannerScenarioBiHost({ host, scenarios, results: phase.results, scenario })
    const snapshot = () => store.transaction("dashboard", async () => ({ commit: false, value: digestSfValue(store.currentSnapshots!()) }))
    const before = await snapshot()
    const shown = await plan.readView(request, context)
    expect(shown.status).toBe("ok")
    if (shown.status !== "ok") throw new Error(JSON.stringify(shown))
    const { projection, presentation } = shown.value
    expect(projection.decision).toEqual({ kind: "scenario", scenarioResultRef: phase.selectedRef, scenario: phase.selectedResult, comparisonRef: phase.comparisonRef, comparison: phase.comparison })
    expect(projection.values.find((value) => value.id === "scenario:baseline-complete-total")).toMatchObject({ value: 240000, evidenceState: "confirmed" })
    expect(projection.values.find((value) => value.id === "scenario:candidate-complete-total")).toMatchObject({ value: 235000, evidenceState: "confirmed" })
    expect(projection.values.find((value) => value.id === "scenario:complete-difference")).toMatchObject({ value: -5000, evidenceState: "confirmed" })
    const waterfall = resolveWaterfall(projection, presentation.waterfall!)
    expect(waterfall).toMatchObject({ status: "ok", initial: 240000, final: 235000, reconciliation: "reconciled" })
    if (waterfall.status !== "ok") throw new Error(JSON.stringify(waterfall))
    expect(waterfall.segments.filter((segment) => segment.label === "implementation:11")).toHaveLength(1)
    expect(waterfall.segments.find((segment) => segment.label === "implementation:11")?.amount).toBe(70000)
    const entries = phase.selectedResult.costCoverage.entries
    const implementation = entries.find((entry) => entry.categoryId === "implementation")
    const training = entries.find((entry) => entry.categoryId === "training")
    const migration = entries.find((entry) => entry.categoryId === "migration")
    if (implementation?.status !== "included" || training?.status !== "included" || migration?.status !== "included") throw new Error("Shared canonical classification missing")
    expect(training.componentRefs).toEqual(implementation.componentRefs)
    expect(migration.componentRefs).toEqual(implementation.componentRefs)
    expect(entries.filter((entry) => entry.status === "not-applicable").map((entry) => entry.categoryId).sort()).toEqual(["contract_exit", "internal_costs", "other_relevant_costs"])
    expect(await snapshot()).toBe(before)
    const decision = await history.readCase()
    expect(decision.choices).toEqual([])
    expect(decision.preparedChanges).toEqual([])
    expect(decision.receipts).toEqual([])
  } finally { await history.cleanup() }
}, 180000)
