import { expect, test } from "bun:test"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import { assessCostCoverage, reassessScenarioCoverage, validateScenarioCoverage } from "../../../product/decisions/cost-coverage.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CostCoverageAssessment, ScenarioResult } from "../../../product/contracts/decisions.ts"

test("conditioned scenarios cannot carry an incomplete coverage seal", () => {
  const source = { schema: "sf-evidence-v1", kind: "record", refId: "ref", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", target: { surface: "planner", recordType: "forecast", recordId: "forecast", incarnation: "inc", version: 1, fields: ["amount"], projectionDigest: "b".repeat(64) } } as const satisfies BusinessEvidenceRef
  const basis = { id: "basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: [source] }
  const assessment = { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: { start: "2027-01-01", end: "2027-12-31" }, issues: [], evaluatedSourceRefs: [source], entries: [], derivedMissingCategoryIds: [], coverageState: "complete" } as const satisfies CostCoverageAssessment
  const scenario = { comparisonStatus: "conditioned", id: "scenario", version: 1, components: [], currency: "USD", horizon: assessment.horizon, sourceRefs: [source], unresolvedConditions: ["hypothetical"], restrictions: [], costCoverage: assessment, knownSubtotal: 0, total: null } as const satisfies ScenarioResult
  expect(validateScenarioCoverage(scenario, basis, assessment)).toBe("incomplete-cost-coverage")
  const complete = { ...assessment, entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ categoryId, status: "not-applicable" as const, justification: "Reviewed scope", evidenceRefs: [source] })) }
  expect(validateScenarioCoverage({ ...scenario, costCoverage: complete }, basis, complete)).toBeUndefined()
})

test("an unassigned scenario component prevents complete coverage", () => {
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const source = { schema: "sf-evidence-v1", kind: "record", refId: "ref", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", target: { surface: "planner", recordType: "forecast", recordId: "forecast", incarnation: "inc", version: 1, fields: ["amount"], period: horizon, projectionDigest: "b".repeat(64) } } as const satisfies BusinessEvidenceRef
  const basis = { id: "basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: [source] }
  const entries = RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ categoryId, status: "not-applicable" as const, justification: "Reviewed scope", evidenceRefs: [source] }))
  const component = { id: "unassigned", amount: 40000, currency: "USD", period: horizon, evidenceState: "confirmed" as const, sourceRefs: [{ surface: "planner" as const, type: "forecast", id: "forecast", incarnation: "inc", version: 1, fields: ["amount"], period: horizon, observedAt: "2026-11-13T00:00:00Z" }] }
  const assessment = assessCostCoverage({ basis, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon, entries, components: [component], evidence: [{ state: "fresh", ref: source, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" }], supports: () => true })
  expect(assessment).toMatchObject({ coverageState: "pending", issues: ["uncategorized-component"] })
})

test("reassessment uses scenario entries and keeps hypothetical totals conditioned", async () => {
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const source = { schema: "sf-evidence-v1", kind: "record", refId: "ref", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", target: { surface: "planner", recordType: "forecast", recordId: "forecast", incarnation: "inc", version: 1, fields: ["amount"], period: horizon, projectionDigest: "b".repeat(64) } } as const satisfies BusinessEvidenceRef
  const sourceRef = { surface: "planner" as const, type: "forecast", id: "forecast", incarnation: "inc", version: 1, fields: ["amount"], period: horizon, observedAt: "2026-11-13T00:00:00Z" }
  const basis = { id: "basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: [source] }
  const baseline = { basisId: "basis", basisVersion: 1, alternativeId: "old", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: [source], entries: [], derivedMissingCategoryIds: [], coverageState: "pending" } as const satisfies CostCoverageAssessment
  const scenario = { id: "preview", version: 0, components: [{ id: "service", amount: 210000, currency: "USD", period: horizon, evidenceState: "hypothetical", sourceRefs: [sourceRef] }, { id: "training", amount: 40000, currency: "USD", period: horizon, evidenceState: "hypothetical", sourceRefs: [sourceRef] }], currency: "USD", horizon, sourceRefs: [source], unresolvedConditions: ["scenario-is-hypothetical", "scenario-coverage-reassessment-required"], restrictions: [], costCoverage: { ...baseline, alternativeId: "new" }, comparisonStatus: "conditioned", knownSubtotal: 250000, total: null } as const satisfies ScenarioResult
  const entries = RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service" || categoryId === "training" ? { categoryId, status: "included" as const, componentRefs: [categoryId], evidenceRefs: [source], scopeNote: "Scenario component" } : { categoryId, status: "not-applicable" as const, justification: "Reviewed scope", evidenceRefs: [source] })
  const input = { scenario, basis, baseline, entries, resolveEvidence: async () => [{ state: "fresh" as const, ref: source, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" }], supports: () => true }
  const missing = await reassessScenarioCoverage({ ...input, entries: entries.filter((entry) => entry.categoryId !== "training") })
  expect(missing).toMatchObject({ comparisonStatus: "conditioned", total: null, costCoverage: { coverageState: "pending", derivedMissingCategoryIds: ["training"] } })
  const complete = await reassessScenarioCoverage(input)
  expect(complete).toMatchObject({ comparisonStatus: "conditioned", total: null, knownSubtotal: 250000, unresolvedConditions: ["scenario-is-hypothetical"], costCoverage: { coverageState: "complete", alternativeId: "new" } })
})
