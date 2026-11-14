import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { CostCoverageBasis } from "../../../product/contracts/decisions.ts"
import type { PortfolioRequest, ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { comparePlannerScenarios, plannerScenarioCostPresentation } from "../../../product/planner/comparison.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { plannerScenarioDigest } from "../../../product/planner/preview-comparison.ts"
import { createPortfolioPlannerHost } from "../../../product/portfolio/planner-host.ts"
import { createPortfolioPort } from "../../../product/portfolio/port.ts"
import { plannerFixture, plannerPeriod } from "../wp03/planner-fixture.ts"

/** Real Planner/storage/source authority; selection and incomplete C10 inventory are controlled host seams.
 * A monthly defer is not a contractual cancellation rule, a persisted decision, or a human application.
 */
test("portfolio keeps a canonical monthly defer cost-neutral without inventing cancellation savings", async () => {
  const fixture = await plannerFixture()
  try {
    const context = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const issued = await fixture.issueSource("v0", context)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") throw new Error("Current Planner source unavailable")
    const source = issued.value.evidence
    const coverageRef = `source-coverage:${source.refId}`
    const basis: CostCoverageBasis = { id: "term-defer-inventory", version: 1, decisionType: "unknown", categoryIds: [], additionalCategoryIds: [], sourceRefs: [source] }
    const sourceCurrent = async (trusted: TrustedDomainContext) => {
      if (!await fixture.host.revalidate(trusted)) return false
      const current = await fixture.sources.resolveForecastSource(source.refId, trusted)
      return current.status === "ok" && digestSfValue(current.value.evidence) === digestSfValue(source)
    }
    const sources: PlannerSourceHost = {
      ...fixture.sources,
      resolveForecastCoverage: async (reference, trusted) => {
        if (reference !== source.refId && reference !== coverageRef) return { status: "unavailable", reason: "unknown-inventory" }
        if (!await sourceCurrent(trusted)) return { status: "denied", reason: "source-authority-unavailable" }
        return { status: "ok", value: { coverageRef, basis, assessment: { basisId: basis.id, basisVersion: basis.version, alternativeId: source.refId, alternativeVersion: 1, currency: "USD", horizon: plannerPeriod, coverageState: "pending", entries: [], derivedMissingCategoryIds: [], issues: ["inventory-unavailable"], evaluatedSourceRefs: [source] } } }
      },
    }
    const planner = createPlannerPort({ host: fixture.host, sources })
    const observation: ScenarioRequest = { baseRef: source.refId, operations: [], assumptions: [] }
    const deferredRequest: ScenarioRequest = { baseRef: source.refId, operations: [{ kind: "defer", targetRef: "line:11", currency: "USD", period: { start: "2027-12-01", end: "2027-12-31" } }], assumptions: [] }
    const before = await fixture.readSnapshot()
    const baseline = await planner.simulateScenario(observation, context)
    const deferred = await planner.simulateScenario(deferredRequest, context)
    expect(baseline.status).toBe("ok")
    expect(deferred.status).toBe("ok")
    if (baseline.status !== "ok" || deferred.status !== "ok") throw new Error("Canonical monthly observations unavailable")
    expect(baseline.value.components.find((component) => component.id === "line:11")).toMatchObject({ amount: 112000, currency: "USD", period: { start: "2027-11-01", end: "2027-11-30" } })
    expect(baseline.value.components.find((component) => component.id === "line:12")).toMatchObject({ amount: 40000, currency: "USD", period: { start: "2027-12-01", end: "2027-12-31" } })
    expect(deferred.value.components.find((component) => component.id === "line:11")).toMatchObject({ amount: 0, currency: "USD", period: { start: "2027-11-01", end: "2027-11-30" }, evidenceState: "hypothetical" })
    expect(deferred.value.components.find((component) => component.id === "line:12")).toMatchObject({ amount: 152000, currency: "USD", period: { start: "2027-12-01", end: "2027-12-31" }, evidenceState: "hypothetical" })
    expect(baseline.value.knownSubtotal).toBeGreaterThan(0)
    expect(deferred.value.knownSubtotal).toBe(baseline.value.knownSubtotal)
    expect(deferred.value).toMatchObject({ currency: "USD", horizon: plannerPeriod, sourceRefs: [source], total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending" } })
    expect(deferred.value.restrictions).toContain("preview-not-applied")
    expect(deferred.value.unresolvedConditions).toContain("scenario-coverage-reassessment-required")
    expect(deferred.value.components.map((component) => component.sourceRefs)).toEqual(baseline.value.components.map((component) => component.sourceRefs))

    // Compare actual observations under the same unresolved inventory; no C08 or completed C10 is claimed.
    const comparison = comparePlannerScenarios({ baselineRef: baseline.value.id, alternativeRef: deferred.value.id, baselineCoverageRef: coverageRef, alternativeCoverageRef: coverageRef, baseline: baseline.value, alternative: deferred.value })
    expect(comparison).toMatchObject({ comparisonStatus: "conditioned", knownDifference: 0, completeDifference: null })
    expect(plannerScenarioCostPresentation(comparison)).toMatchObject({ knownCostChange: 0, knownSavings: 0, completeCostChange: null, completeSavings: null })

    const candidate = { ref: "term-defer-selection", caseRef: "controlled-term-defer-case", scenario: deferredRequest, operations: deferredRequest.operations, result: deferred.value }
    const portfolio = createPortfolioPort(createPortfolioPlannerHost({
      planner,
      resolveCandidate: async (reference, trusted) => reference === candidate.ref && await sourceCurrent(trusted) ? { status: "ok", value: structuredClone(candidate) } : { status: "denied", reason: "selection-or-source-unavailable" },
      scenarioRequest: async (_request, _candidates, operations, trusted) => await sourceCurrent(trusted) ? { status: "ok", value: { ...observation, operations } } : { status: "denied", reason: "source-authority-unavailable" },
      assess: async (_request, _candidates, _result, trusted) => {
        const coverage = await sources.resolveForecastCoverage(coverageRef, trusted)
        return coverage.status === "ok" ? { status: "ok", value: { costCoverageRefs: [coverage.value.coverageRef], constraints: [] } } : coverage
      },
      revalidateEvaluation: async (scenario, refs, analysis, trusted) => {
        const replay = await planner.simulateScenario(deferredRequest, trusted)
        const coverage = await sources.resolveForecastCoverage(coverageRef, trusted)
        return replay.status === "ok" && coverage.status === "ok" && analysis === undefined && digestSfValue(refs) === digestSfValue([coverage.value.coverageRef]) && plannerScenarioDigest(replay.value) === plannerScenarioDigest(scenario) && await sourceCurrent(trusted)
      },
      revalidate: fixture.host.revalidate,
    }))
    const request: PortfolioRequest = { scope: { horizon: plannerPeriod, currency: "USD" }, candidateRefs: [candidate.ref], operations: [], constraints: [], priorities: [], explorationLimit: 1 }
    const evaluated = await portfolio.evaluate(request, context)
    expect(evaluated.status).toBe("ok")
    if (evaluated.status !== "ok") throw new Error("Current monthly defer portfolio unavailable")
    expect(evaluated.value.combinations).toHaveLength(1)
    expect(evaluated.value.combinations[0]).toMatchObject({ eligibility: "conditioned", comparisonStatus: "conditioned", components: deferred.value.components, costCoverageRefs: [coverageRef] })
    expect(evaluated.value.combinations[0]!.restrictions).toContain("coverage:pending")
    expect(evaluated.value.combinations[0]!.restrictions).toContain("preview-not-applied")
    expect(evaluated.value.combinations[0]!.restrictions).toContain("analysis-unavailable")
    expect(evaluated.value.evidenceRefs).toContainEqual(source)

    const after = await fixture.readSnapshot()
    expect(after.data.versions).toEqual(before.data.versions)
    expect(after.versions).toEqual(before.versions)
    expect(after.audit).toEqual(before.audit)
    expect(after.sequences).toEqual(before.sequences)
    const unchanged = await fixture.issueSource("v0", context)
    expect(unchanged.status).toBe("ok")
    if (unchanged.status !== "ok") throw new Error("Original Planner source was lost")
    expect(unchanged.value.evidence).toEqual(source)

    fixture.access.allowed = false
    expect(await portfolio.evaluate(request, context)).toEqual({ status: "denied", reason: "invalid-binding" })
    expect(await planner.simulateScenario(deferredRequest, context)).toEqual({ status: "denied", reason: "invalid-binding" })
  } finally { await fixture.close() }
})
