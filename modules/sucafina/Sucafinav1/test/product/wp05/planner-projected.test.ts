import { expect, test } from "bun:test"
import { bindProjectedPlannerBiPort, createProjectedPlannerBiSource } from "../../../product/analytics/planner-projected.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { FinancialAnalysis } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const context: TrustedUiContext = { kind: "ui", lease: {} as TrustedUiLease, binding: { installationId: "i", projectId: "p", principalRef: "u", requestId: "r", policyVersion: "v", accessRevision: "a", expiresAt: "2030-01-01T00:00:00Z" } }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "planner", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "planner-v1", components: [], values: [{ id: "contribution", value: -5, currency: "USD", period, granularity: "aggregate", sourceRefs: [], drilldown: null, evidenceState: "confirmed" }], missing: [] }
const analysis: FinancialAnalysis = { analysisBasis: "domain", domainApplied: true, baseline: projection, candidate: projection, sourceRefs: [], gaps: [], explanation: "", comparison: { baselineResultRef: "base", alternativeResultRef: "candidate", costCoverageRefs: [], comparisonStatus: "conditioned", knownDifference: null, completeDifference: null, criterionResults: [], unresolvedConditions: [] }, knownDifference: null, completeDifference: null }
const presentation = { viewId: "BI03" as const, series: [{ id: "contribution", label: "Contribution", unit: "USD", role: "contribution" as const, valueIds: ["contribution"] }], limitations: [] }
const request = { viewId: "BI03", selectionRef: "selection", period }

test("planner-projected adapter forwards producer projection and detects a changed revision", async () => {
  const unused = async () => ({ status: "unavailable" as const, reason: "unused" })
  const observed = { version: 1, calls: 0 }
  const host = bindProjectedPlannerBiPort({ planner: { compareForecast: async () => ({ status: "ok", value: analysis }), simulateScenario: unused, compareScenarios: unused, evaluateSensitivity: unused }, resolve: async () => ({ status: "ok", value: { comparison: { baseRef: "base", candidateRef: "candidate", period, currency: "USD" }, project: (value) => { expect(value).toBe(analysis); observed.calls++; return { status: "ok", value: { projection: { ...projection, version: observed.version }, presentation } } } } }), revalidate: async () => true })
  const source = createProjectedPlannerBiSource(host)
  const first = await source.read(request, context)
  expect(first.status).toBe("ok")
  if (first.status !== "ok") return
  expect(first.value.values[0]?.value).toBe(-5)
  expect(await source.describe(request, context, first.value)).toMatchObject({ status: "ok", value: presentation })
  observed.version = 2
  expect(await source.describe(request, context, first.value)).toEqual({ status: "stale", reason: "projection-changed" })
  expect(observed.calls).toBe(3)
})

test("planner-projected adapter refuses mixed currency or principal before presentation", async () => {
  const unused = async () => ({ status: "unavailable" as const, reason: "unused" })
  const state = { current: analysis, projected: 0 }
  const host = bindProjectedPlannerBiPort({ planner: { compareForecast: async () => ({ status: "ok", value: state.current }), simulateScenario: unused, compareScenarios: unused, evaluateSensitivity: unused }, resolve: async () => ({ status: "ok", value: { comparison: { baseRef: "base", candidateRef: "candidate", period, currency: "USD" }, project: () => { state.projected++; return { status: "ok", value: { projection, presentation } } } } }), revalidate: async () => true })
  state.current = { ...analysis, baseline: { ...projection, context: { ...projection.context, currency: "EUR" } } }
  expect(await host.readView(request, context)).toEqual({ status: "unavailable", reason: "currency-mismatch" })
  state.current = { ...analysis, candidate: { ...projection, context: { ...projection.context, principalRef: "other" } } }
  expect(await host.readView(request, context)).toEqual({ status: "denied", reason: "context-mismatch" })
  expect(state.projected).toBe(0)
})
