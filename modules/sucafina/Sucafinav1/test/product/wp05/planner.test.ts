import { expect, test } from "bun:test"
import { createPlannerBiSource } from "../../../product/analytics/planner.ts"
import type { FinancialAnalysis } from "../../../product/contracts/ports.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { TrustedUiContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"
import type { BiPresentation } from "../../../product/analytics/semantics.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const context: TrustedUiContext = { kind: "ui", lease: {} as TrustedUiLease, binding: { installationId: "i", projectId: "p", principalRef: "u", requestId: "r", policyVersion: "v", accessRevision: "a", expiresAt: "2030-01-01T00:00:00Z" } }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "planner", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "planner-v1", components: [], values: [], missing: [] }
const analysis: FinancialAnalysis = { analysisBasis: "domain", domainApplied: true, baseline: projection, candidate: projection, sourceRefs: [], gaps: [], explanation: "", comparison: { baselineResultRef: "base", alternativeResultRef: "candidate", costCoverageRefs: [], comparisonStatus: "conditioned", knownDifference: null, completeDifference: null, criterionResults: [], unresolvedConditions: [] }, knownDifference: null, completeDifference: null }
const presentation: BiPresentation = { viewId: "BI01", series: [], limitations: ["No series"] }
const request = { viewId: "BI01", selectionRef: "selection", period }

test("planner adapter returns the selected canonical projection and rejects a changed base", async () => {
  let current = analysis
  const source = createPlannerBiSource({ readView: async () => ({ status: "ok", value: { analysis: current, side: "candidate", presentation } }), revalidate: async () => true })
  const first = await source.read(request, context)
  expect(first.status).toBe("ok")
  if (first.status !== "ok") return
  current = { ...analysis, candidate: { ...projection, version: 2 } }
  expect(await source.describe(request, context, first.value)).toEqual({ status: "stale", reason: "projection-changed" })
})

test("planner binding refuses a resolved comparison outside the selected period", async () => {
  const { bindPlannerBiPort } = await import("../../../product/analytics/planner.ts")
  let calls = 0
  const unavailable = async () => ({ status: "unavailable" as const, reason: "not-used" })
  const host = bindPlannerBiPort({
    planner: { compareForecast: async () => { calls++; return { status: "ok", value: analysis } }, simulateScenario: unavailable, compareScenarios: unavailable, evaluateSensitivity: unavailable },
    resolve: async () => ({ status: "ok", value: { comparison: { baseRef: "base", candidateRef: "candidate", period: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD" }, side: "candidate", present: () => presentation } }),
    revalidate: async () => true,
  })
  expect(await host.readView(request, context)).toEqual({ status: "stale", reason: "period-mismatch" })
  expect(calls).toBe(0)
})
