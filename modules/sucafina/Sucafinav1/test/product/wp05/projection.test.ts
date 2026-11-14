import { expect, test } from "bun:test"
import { hasBiDecision, sameBiProjection } from "../../../product/analytics/projection.ts"
import type { DomainProjection, SourceRef } from "../../../product/contracts/context.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const ref: SourceRef = { surface: "planner", type: "planner-version", id: "v1", incarnation: "inc1", version: 1, fields: ["lines"], period, observedAt: "2027-01-01T00:00:00Z" }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "planner", period, currency: "USD", sourceRefs: [ref], capabilities: [] }, version: 1, engineVersion: "engine", values: [], missing: [], components: [{ id: "line", amount: 1, currency: "USD", period, sourceRefs: [ref], evidenceState: "confirmed" }] }

test("observation timestamps do not create stale data, while source and value changes do", () => {
  const later = { ...ref, observedAt: "2027-01-01T00:00:01Z" }
  expect(sameBiProjection(projection, { ...projection, context: { ...projection.context, sourceRefs: [later] }, components: [{ ...projection.components[0]!, sourceRefs: [later] }] })).toBe(true)
  expect(sameBiProjection(projection, { ...projection, context: { ...projection.context, sourceRefs: [{ ...later, version: 2 }] } })).toBe(false)
  expect(sameBiProjection(projection, { ...projection, components: [{ ...projection.components[0]!, amount: 2 }] })).toBe(false)
})

test("persisted comparison keeps its complete scope identity while allowing a later observation time", () => {
  const comparison = { metricRef: "planner:known-subtotal-difference", comparisonRef: "inverse", context: projection.context, version: projection.version, engineVersion: projection.engineVersion, values: [] }
  const observed = { ...projection, comparison }
  const later = { ...comparison, context: { ...comparison.context, sourceRefs: [{ ...ref, observedAt: "2027-01-01T00:00:01Z" }] } }
  expect(sameBiProjection(observed, { ...projection, comparison: later })).toBe(true)
  for (const changed of [
    { ...later, comparisonRef: "other" },
    { ...later, version: 2 },
    { ...later, engineVersion: "different" },
    { ...later, context: { ...later.context, currency: "EUR" } },
    { ...later, context: { ...later.context, period: { ...period, end: "2027-11-30" } } },
    { ...later, context: { ...later.context, accessRevision: "revoked" } },
    { ...later, context: { ...later.context, sourceRefs: [{ ...ref, version: 2 }] } },
  ]) expect(sameBiProjection(observed, { ...projection, comparison: changed })).toBe(false)
})

test("nested decision source observation times are ignored without ignoring material changes", () => {
  const scenario = { id: "scenario", version: 1, components: projection.components, currency: "USD", horizon: period, sourceRefs: [], unresolvedConditions: [], restrictions: [], comparisonStatus: "conditioned" as const, knownSubtotal: 1, total: null, costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "scenario", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [], coverageState: "pending" as const, entries: [], derivedMissingCategoryIds: [] } }
  const comparison = { baselineResultRef: "baseline", alternativeResultRef: "scenario-ref", costCoverageRefs: ["coverage"], criterionResults: [], unresolvedConditions: [], comparisonStatus: "conditioned" as const, knownDifference: 1, completeDifference: null }
  const analysis = { scenarioResultRef: "scenario-ref", scenario, comparisonRef: "comparison-ref", comparison }
  const combination = { id: "combination", caseRefs: [], components: projection.components, costCoverageRefs: ["coverage"], conflicts: [], restrictions: [], eligibility: "conditioned" as const, comparisonStatus: "conditioned" as const, analysis }
  const scenarioProjection: DomainProjection = { ...projection, decision: { kind: "scenario", ...analysis } }
  const portfolioProjection: DomainProjection = { ...projection, decision: { kind: "portfolio", portfolioResultRef: "portfolio-ref", portfolio: { combinations: [combination], limitations: [], evidenceRefs: [] } } }
  const later = { ...ref, observedAt: "2027-01-01T00:00:01Z" }
  const laterComponents = [{ ...projection.components[0]!, sourceRefs: [later] }]
  expect(sameBiProjection(scenarioProjection, { ...scenarioProjection, decision: { kind: "scenario", ...analysis, scenario: { ...scenario, components: laterComponents } } })).toBe(true)
  expect(sameBiProjection(portfolioProjection, { ...portfolioProjection, decision: { kind: "portfolio", portfolioResultRef: "portfolio-ref", portfolio: { combinations: [{ ...combination, components: laterComponents, analysis: { ...analysis, scenario: { ...scenario, components: laterComponents } } }], limitations: [], evidenceRefs: [] } } })).toBe(true)
  expect(sameBiProjection(scenarioProjection, { ...scenarioProjection, decision: { kind: "scenario", ...analysis, scenario: { ...scenario, components: [{ ...laterComponents[0]!, amount: 2 }] } } })).toBe(false)
  expect(sameBiProjection(portfolioProjection, { ...portfolioProjection, decision: { kind: "portfolio", portfolioResultRef: "different", portfolio: { combinations: [combination], limitations: [], evidenceRefs: [] } } })).toBe(false)
})


test("sensitivity requires its paired persisted reference", () => {
  const scenario = { id: "scenario", version: 1, components: [], currency: "USD", horizon: period, sourceRefs: [], unresolvedConditions: [], restrictions: [], comparisonStatus: "conditioned" as const, knownSubtotal: 1, total: null, costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "scenario", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [], coverageState: "pending" as const, entries: [], derivedMissingCategoryIds: [] } }
  const comparison = { baselineResultRef: "baseline", alternativeResultRef: "scenario-ref", costCoverageRefs: ["coverage"], criterionResults: [], unresolvedConditions: [], comparisonStatus: "conditioned" as const, knownDifference: 1, completeDifference: null }
  const sensitivity = { scenarioRef: "scenario-ref", parameterRef: "parameter", bounds: { minimum: 0, maximum: 1, steps: 1 }, evaluated: [], threshold: null, thresholdEvidence: { state: "unavailable" as const, reason: "not-evaluated" }, unit: "USD", engineVersion: "engine", costCoverageRefs: ["coverage"], comparisonStatus: "conditioned" as const, unresolvedConditions: [], evidenceRefs: [] }
  const decision = { kind: "scenario" as const, scenarioResultRef: "scenario-ref", scenario, comparisonRef: "comparison-ref", comparison }
  expect(hasBiDecision({ ...projection, decision }, "BI09")).toBe(true)
  expect(hasBiDecision({ ...projection, decision }, "BI11")).toBe(false)
  expect(hasBiDecision({ ...projection, decision: { ...decision, sensitivity } }, "BI09")).toBe(false)
  const paired = { ...decision, sensitivity, sensitivityResultRef: "sensitivity-ref" }
  expect(hasBiDecision({ ...projection, decision: paired }, "BI11")).toBe(true)
  const blank = { ...paired, sensitivityResultRef: "" }
  expect(hasBiDecision({ ...projection, decision: blank }, "BI11")).toBe(false)
})
