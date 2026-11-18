import { expect, test } from "bun:test"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { comparePlannerPreview } from "../../../product/planner/preview-comparison.ts"
import { compareScenarios } from "../../../product/planner/scenario-comparison-port.ts"
import type { PlannerCriteriaHost, PlannerScenarioHost } from "../../../product/planner/scenario-comparison-port.ts"
import { plannerFixture, plannerPeriod } from "./planner-fixture.ts"

type ScenarioSnapshot = Extract<Awaited<ReturnType<PlannerScenarioHost["resolve"]>>, { status: "ok" }>["value"]
type CriterionObservation = Extract<Awaited<ReturnType<PlannerCriteriaHost["evaluate"]>>, { status: "ok" }>

/** Real SQLite, authority, source lifecycle and Planner outputs; only resolver cache ownership is varied. */
async function comparisonFixture() {
  const fixture = await plannerFixture()
  try {
    const context = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const sourcesByVersion = await Promise.all(["v0", "v1"].map((id) => fixture.issueSource(id, context)))
    const refs = sourcesByVersion.flatMap((entry) => entry.status === "ok" ? [entry.value.evidence] : [])
    if (refs.length !== 2) throw new Error("Planner sources unavailable")
    const basis: CostCoverageBasis = { id: "resume-basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: refs }
    const coverage = refs.map((ref, index): CostCoverageAssessment => ({
      basisId: basis.id, basisVersion: basis.version, alternativeId: `alternative-${index}`, alternativeVersion: 1,
      currency: "USD", horizon: plannerPeriod, evaluatedSourceRefs: [ref], coverageState: "pending",
      entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ status: "pending", categoryId, reason: "Human cost classification not supplied" })),
      derivedMissingCategoryIds: [...RENEWAL_TRANSITION_CATEGORIES], issues: ["human-cost-classification-required"],
    }))
    const records = new Map<string, ScenarioSnapshot>()
    const sources: PlannerSourceHost = {
      resolveForecastSource: fixture.sources.resolveForecastSource,
      resolveForecastCoverage: async (reference, binding) => {
        if (!await fixture.host.revalidate(binding)) return { status: "denied", reason: "fixture-authority-revoked" }
        const stored = [...records.values()].find((value) => value.coverageRef === reference)
        if (stored) return { status: "ok", value: { coverageRef: reference, basis, assessment: stored.result.costCoverage } }
        const index = refs.findIndex((ref) => ref.refId === reference)
        if (index < 0) return { status: "unavailable", reason: "fixture-coverage-unavailable" }
        return { status: "ok", value: { coverageRef: `seed-coverage-${index}`, basis, assessment: coverage[index]! } }
      },
    }
    const planner = createPlannerPort({ host: fixture.host, sources })
    const requests: ScenarioRequest[] = refs.map((ref) => ({ baseRef: ref.refId, operations: [], assumptions: [] }))
    for (const [index, ref] of refs.entries()) {
      const projection = await planner.compareForecast({ baseRef: ref.refId, candidateRef: ref.refId, period: plannerPeriod, currency: "USD" }, context)
      const scenario = await planner.simulateScenario(requests[index]!, context)
      if (projection.status !== "ok" || scenario.status !== "ok") throw new Error("Planner fixture projection unavailable")
      records.set(index === 0 ? "base" : "alternative", { result: scenario.value, coverageRef: `coverage-${index}`, basis, projection: projection.value.baseline, source: ref })
    }
    const scenarios: PlannerScenarioHost = {
      resolve: async (reference, binding) => {
        if (!await fixture.host.revalidate(binding)) return { status: "denied", reason: "fixture-authority-revoked" }
        const value = records.get(reference)
        return value ? { status: "ok", value } : { status: "unavailable", reason: "fixture-scenario-unavailable" }
      },
    }
    return { ...fixture, context, refs, records, requests, sources, planner, scenarios }
  } catch (error) {
    await fixture.close()
    throw error
  }
}

function criterion(source: BusinessEvidenceRef): CriterionObservation {
  return { status: "ok", value: { criterionId: "delivery", state: "satisfied", reason: "Registered rule satisfied", ruleRef: "delivery-rule-v1", evidenceRefs: [source] } }
}

test("scenario comparison snapshots each cached resolver result before resolving the next reference", async () => {
  const fixture = await comparisonFixture()
  try {
    const before = await fixture.readSnapshot()
    const cache = structuredClone(fixture.records.get("base")!)
    const calls: string[] = []
    const scenarios: PlannerScenarioHost = { resolve: async (reference) => {
      calls.push(reference)
      const value = fixture.records.get(reference)
      if (!value) return { status: "unavailable", reason: "fixture-scenario-unavailable" }
      Object.assign(cache, value)
      return { status: "ok", value: cache }
    } }
    const result = await compareScenarios({ host: fixture.host, sources: fixture.sources, scenarios }, { scenarioRefs: ["base", "alternative"], criteria: [] }, fixture.context)
    expect(result).toMatchObject({ status: "ok", value: { knownDifference: 12000, completeDifference: null, comparisonStatus: "conditioned" } })
    expect(calls).toEqual(["base", "alternative", "base", "alternative"])
    expect(fixture.records.get("base")!.result.knownSubtotal).toBe(590000)
    expect(fixture.records.get("alternative")!.result.knownSubtotal).toBe(602000)
    expect(await fixture.readSnapshot()).toEqual(before)
  } finally { await fixture.close() }
})

test("criterion mutation in a reused response cannot erase the first freshness observation", async () => {
  const fixture = await comparisonFixture()
  try {
    const before = await fixture.readSnapshot()
    const shared = criterion(fixture.refs[0]!)
    const calls = { count: 0 }
    const criteria: PlannerCriteriaHost = { evaluate: async () => {
      calls.count++
      if (calls.count === 2) {
        shared.value.state = "failed"
        shared.value.reason = "The registered rule changed before egress"
      }
      return shared
    } }
    const result = await compareScenarios({ host: fixture.host, sources: fixture.sources, scenarios: fixture.scenarios, criteria }, { scenarioRefs: ["base", "alternative"], criteria: ["delivery"] }, fixture.context)
    expect(result).toEqual({ status: "stale", reason: "criterion-or-authority-changed" })
    expect(calls.count).toBe(2)
    expect("value" in result).toBe(false)
    expect(await fixture.readSnapshot()).toEqual(before)
  } finally { await fixture.close() }
})

test("distinct criterion observations remain associated when the evaluator reuses one cache object", async () => {
  const fixture = await comparisonFixture()
  try {
    const shared = criterion(fixture.refs[0]!)
    const calls: string[] = []
    const criteria: PlannerCriteriaHost = { evaluate: async (request) => {
      calls.push(request.criterionId)
      shared.value.criterionId = request.criterionId
      shared.value.state = request.criterionId === "delivery" ? "satisfied" : "failed"
      shared.value.reason = request.criterionId === "delivery" ? "Delivery rule satisfied" : "Capacity rule failed"
      shared.value.ruleRef = `${request.criterionId}-rule-v1`
      return shared
    } }
    const result = await compareScenarios({ host: fixture.host, sources: fixture.sources, scenarios: fixture.scenarios, criteria }, { scenarioRefs: ["base", "alternative"], criteria: ["delivery", "capacity"] }, fixture.context)
    expect(result).toMatchObject({ status: "ok", value: { knownDifference: 12000, criterionResults: [
      { criterionId: "delivery", state: "satisfied", reason: "Delivery rule satisfied" },
      { criterionId: "capacity", state: "failed", reason: "Capacity rule failed" },
    ] } })
    expect(calls).toEqual(["delivery", "capacity", "delivery", "capacity"])
  } finally { await fixture.close() }
})

test("preview comparison rejects a reused baseline cache changed after a real simulation", async () => {
  const fixture = await comparisonFixture()
  try {
    const before = await fixture.readSnapshot()
    const changed = await fixture.planner.simulateScenario({ ...fixture.requests[0]!, operations: [{ kind: "replace", targetRef: "line:11", amount: 124000, currency: "USD" }] }, fixture.context)
    if (changed.status !== "ok") throw new Error("Changed baseline simulation unavailable")
    expect(changed.value.knownSubtotal).toBe(602000)
    const baseline = fixture.records.get("base")!
    const calls = { resolved: 0, simulated: 0 }
    const scenarios: PlannerScenarioHost = { resolve: async (reference) => {
      if (reference !== "base") return { status: "unavailable", reason: "fixture-scenario-unavailable" }
      calls.resolved++
      if (calls.resolved === 2) baseline.result = changed.value
      return { status: "ok", value: baseline }
    } }
    const result = await comparePlannerPreview({ host: fixture.host, sources: fixture.sources, scenarios, planner: { simulateScenario: async (request, binding) => {
      calls.simulated++
      return fixture.planner.simulateScenario(request, binding)
    } } }, { baselineRef: "base", scenario: fixture.requests[1]! }, fixture.context)
    expect(result).toEqual({ status: "stale", reason: "scenario-or-authority-changed" })
    expect(calls).toEqual({ resolved: 2, simulated: 1 })
    expect("value" in result).toBe(false)
    expect(await fixture.readSnapshot()).toEqual(before)
  } finally { await fixture.close() }
})

test("stable preview remains conditioned with the canonical cost difference and preserved domain", async () => {
  const fixture = await comparisonFixture()
  try {
    const before = await fixture.readSnapshot()
    const request = { baselineRef: "base", scenario: fixture.requests[1]! }
    const original = structuredClone(request)
    const result = await comparePlannerPreview({ host: fixture.host, sources: fixture.sources, scenarios: fixture.scenarios, planner: fixture.planner }, request, fixture.context)
    expect(result).toMatchObject({ status: "ok", value: { sample: { knownSubtotal: 602000, total: null }, comparison: { knownDifference: 12000, completeDifference: null, comparisonStatus: "conditioned" }, metric: { value: 12000, state: "conditioned", unit: "USD" } } })
    expect(request).toEqual(original)
    expect(await fixture.readSnapshot()).toEqual(before)
  } finally { await fixture.close() }
})

