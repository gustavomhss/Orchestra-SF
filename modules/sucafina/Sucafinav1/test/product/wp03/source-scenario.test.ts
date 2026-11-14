import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { CostCoverageAssessment } from "../../../product/contracts/decisions.ts"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createPlannerCalculationEvidence } from "../../../product/planner/calculation-evidence.ts"
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { buildPlannerFinancialProjection, createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { simulateScenario } from "../../../product/planner/scenario-port.ts"
import { createWp05SensitivityFixture } from "../wp05/engine-fixture.ts"
import { renewalCoverage } from "../wp11/renewal-coverage-fixture.ts"

async function fixture(training: "confirmed" | "zero" | "null") {
  const engine = await createWp05SensitivityFixture({ mode: "renewal-usd", training, composed: true })
  try {
    const inventory = await renewalCoverage(engine, training)
    const state: { assessment: CostCoverageAssessment } = { assessment: inventory.assessment }
    const sources: PlannerSourceHost = { ...engine.sources, resolveForecastCoverage: async (reference, context) => {
      if (reference !== engine.scenario.baseRef) return engine.sources.resolveForecastCoverage(reference, context)
      const source = await engine.sources.resolveForecastSource(reference, context)
      if (source.status !== "ok") return source
      return { status: "ok", value: { coverageRef: `source-coverage:${reference}`, basis: engine.basis, assessment: state.assessment } }
    } }
    const planner = createPlannerPort({ host: engine.host, sources })
    return { ...engine, inventory, coverageState: state, sourcePlanner: planner, sourceHost: sources, observation: { baseRef: engine.scenario.baseRef, operations: [], assumptions: [] } }
  } catch (error) {
    await engine.cleanup()
    throw error
  }
}

test("source-only scenario publishes the covered confirmed total and replays through persistence and C17 without applying a choice", async () => {
  const f = await fixture("confirmed")
  try {
    const before = await f.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    const result = await f.sourcePlanner.simulateScenario(f.observation, f.context)
    expect(result).toMatchObject({ status: "ok", value: { knownSubtotal: 250000, total: 250000, comparisonStatus: "complete", costCoverage: { coverageState: "complete" }, unresolvedConditions: [], restrictions: [] } })
    if (result.status !== "ok") throw new Error(result.reason)
    expect(result.value.id.startsWith("source-scenario:")).toBe(true)
    expect(result.value.components.every((component) => component.evidenceState === "confirmed")).toBe(true)
    expect(result.value.sourceRefs).toContainEqual(f.inventory.statement)
    const hypothetical = await f.sourcePlanner.simulateScenario(f.scenario, f.context)
    expect(hypothetical).toMatchObject({ status: "ok", value: { knownSubtotal: 250000, total: null, comparisonStatus: "conditioned", restrictions: ["preview-not-applied"] } })
    const ids = { value: 0 }
    const results = createSfDecisionResultStore({ state: f.state, host: f.host, authorizeCase: async (decision) => decision.id === f.caseRef.id && decision.incarnation === f.caseRef.incarnation, verifySources: async (_value, refs, context) => await f.host.revalidate(context) && refs.every((ref) => f.inventory.evidence.some((entry) => entry.state === "fresh" && digestSfValue(entry.ref) === digestSfValue(ref))), createId: () => `wp03-source-${++ids.value}`, now: () => "2026-11-14T00:00:00Z" })
    const persist = createPlannerResultPersistence({ store: results, replay: f.sourcePlanner, resolveCase: async () => ({ status: "ok", value: f.caseRef }) })
    const saved = await persist({ kind: "scenario", request: f.observation, result: result.value }, "source-observation", f.context)
    expect(saved.status).toBe("ok")
    if (saved.status !== "ok") throw new Error(saved.reason)
    const issuer = createPlannerCalculationEvidence({ host: f.host, readForCalculation: (request, context) => results.readForCalculation(request, context), loadRecordOnlyRequest: async (runId) => runId === saved.value.resultRef ? { status: "ok", value: { resultRef: runId, request: f.observation, engineVersion: "planner-runtime-v1" } } : { status: "unavailable", reason: "unknown-result" }, replayRecordOnly: f.sourcePlanner.simulateScenario })
    const issued = await issuer.issue(saved.value.resultRef, f.context)
    expect(issued).toMatchObject({ status: "ok", value: { target: { inputDigest: digestSfValue(f.observation), resultDigest: digestSfValue(result.value), sourceRefs: result.value.sourceRefs } } })
    expect(await persist({ kind: "scenario", request: f.observation, result: result.value }, "source-observation", f.context)).toEqual(saved)
    const decision = await f.state.read(f.request, "cases", (state) => state.cases[f.caseRef.id])
    expect(decision).toMatchObject({ status: "ok", value: { choices: [], preparedChanges: [], receipts: [] } })
    expect(await f.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(before)
    f.revokeSource(f.observation.baseRef)
    expect((await issuer.issue(saved.value.resultRef, f.context)).status).not.toBe("ok")
    expect(await f.host.revalidate(f.context)).toBe(true)
  } finally { await f.cleanup() }
}, 180000)

test("source-only zero stays confirmed while omitted coverage and null never become a complete total", async () => {
  const zero = await fixture("zero")
  try {
    const confirmed = await zero.sourcePlanner.simulateScenario(zero.observation, zero.context)
    expect(confirmed).toMatchObject({ status: "ok", value: { knownSubtotal: 210000, total: 210000, comparisonStatus: "complete" } })
    if (confirmed.status !== "ok") throw new Error(confirmed.reason)
    expect(confirmed.value.components.find((component) => component.id === "training:11")).toMatchObject({ amount: 0, evidenceState: "confirmed" })
    zero.coverageState.assessment = zero.inventory.assess(zero.inventory.entries.filter((entry) => entry.categoryId !== "training"))
    const omitted = await zero.sourcePlanner.simulateScenario(zero.observation, zero.context)
    expect(omitted).toMatchObject({ status: "ok", value: { knownSubtotal: 210000, total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending", derivedMissingCategoryIds: ["training"] } } })
    if (omitted.status !== "ok") throw new Error(omitted.reason)
    expect(omitted.value.unresolvedConditions).toContain("coverage:training:missing-category")
  } finally { await zero.cleanup() }
  const absent = await fixture("null")
  try {
    const result = await absent.sourcePlanner.simulateScenario(absent.observation, absent.context)
    expect(result).toMatchObject({ status: "ok", value: { knownSubtotal: 210000, total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending" } } })
    if (result.status !== "ok") throw new Error(result.reason)
    expect(result.value.components.find((component) => component.id === "training:11")).toMatchObject({ amount: null, evidenceState: "absent" })
  } finally { await absent.cleanup() }
}, 180000)

test("a source-only observation refuses a coverage change after the real comparison recheck", async () => {
  const f = await fixture("confirmed")
  try {
    const reads = { comparisons: 0 }
    const result = await simulateScenario({ host: f.host, sources: f.sourceHost, project: projectPlannerSource, qualify: buildPlannerFinancialProjection, compare: async (request, context) => {
      const compared = await f.sourcePlanner.compareForecast(request, context)
      reads.comparisons++
      if (reads.comparisons === 2) f.coverageState.assessment = f.inventory.assess(f.inventory.entries.filter((entry) => entry.categoryId !== "training"))
      return compared
    } }, f.observation, f.context)
    expect(reads.comparisons).toBe(2)
    expect(result.status).toBe("stale")
    expect(result).not.toHaveProperty("value")
    expect(await f.host.revalidate(f.context)).toBe(true)
  } finally { await f.cleanup() }
}, 180000)
