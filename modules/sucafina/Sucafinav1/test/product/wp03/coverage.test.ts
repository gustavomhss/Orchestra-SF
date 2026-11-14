import { expect, test } from "bun:test"
import { comparePlannerScenarios } from "../../../product/planner/comparison.ts"
import { plannerCoverageComplete } from "../../../product/planner/coverage.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis } from "../../../product/contracts/decisions.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const evidence: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "source", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: "v", incarnation: "inc", version: 1, fields: ["amount"], period, projectionDigest: "digest" } }
const basis: CostCoverageBasis = { id: "basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [evidence] }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "finance", accessRevision: "1", policyVersion: "1", surface: "planner", currency: "USD", period, sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "planner-runtime-v1", components: [{ id: "line:1", amount: 0, currency: "USD", period, sourceRefs: [], evidenceState: "confirmed" }], values: [], missing: [] }
const complete: CostCoverageAssessment = { basisId: "basis", basisVersion: 1, alternativeId: "alt", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [evidence], coverageState: "complete", derivedMissingCategoryIds: [], entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ status: "included", categoryId, componentRefs: ["line:1"], evidenceRefs: [evidence], scopeNote: "included in source" })) }

test("coverage requires every category and a quantified current component", () => {
  expect(plannerCoverageComplete(basis, complete, projection, evidence)).toBe(true)
  expect(plannerCoverageComplete(basis, { ...complete, evaluatedSourceRefs: [] }, projection, evidence)).toBe(false)
  expect(plannerCoverageComplete(basis, { ...complete, entries: complete.entries.filter((entry) => entry.categoryId !== "training") }, projection, evidence)).toBe(false)
  expect(plannerCoverageComplete(basis, complete, { ...projection, components: [{ ...projection.components[0], amount: null, evidenceState: "absent" }] }, evidence)).toBe(false)
  expect(plannerCoverageComplete(basis, complete, { ...projection, missing: [{ field: "fx", reason: "missing-fx" }] }, evidence)).toBe(false)
})

test("comparison does not promote a conditioned or incompatible result", () => {
  const common = { id: "base", version: 1, components: projection.components, currency: "USD", horizon: period, sourceRefs: [evidence], costCoverage: complete, unresolvedConditions: [], restrictions: [] }
  const baseline = { ...common, comparisonStatus: "complete" as const, knownSubtotal: 0, total: 0 }
  const conditioned = { ...common, id: "candidate", comparisonStatus: "conditioned" as const, knownSubtotal: 10, total: null, unresolvedConditions: ["training-missing"] }
  const args = { baselineRef: "base", alternativeRef: "candidate", baselineCoverageRef: "coverage-base", alternativeCoverageRef: "coverage-candidate", baseline, alternative: conditioned }
  expect(comparePlannerScenarios({ ...args, alternative: { ...baseline, id: "candidate" } })).toMatchObject({ comparisonStatus: "conditioned", completeDifference: null })
  expect(comparePlannerScenarios(args)).toMatchObject({ comparisonStatus: "conditioned", knownDifference: 10, completeDifference: null })
  expect(comparePlannerScenarios({ ...args, alternative: { ...conditioned, currency: "EUR" } })).toMatchObject({ comparisonStatus: "incompatible", knownDifference: null })
})

test("unknown non-financial criteria do not erase financially complete differences", async () => {
  const { compareScenarios } = await import("../../../product/planner/scenario-comparison-port.ts")
  const source = evidence as Extract<BusinessEvidenceRef, { kind: "record" }>
  const component = { ...projection.components[0]!, sourceRefs: [{ surface: "planner" as const, type: "planner-version", id: "v", incarnation: "inc", version: 1, fields: ["amount"], period, observedAt: "2026-11-13T00:00:00Z" }] }
  const proofProjection = { ...projection, components: [component] }
  const result = { id: "result", version: 1, components: [component], currency: "USD", horizon: period, sourceRefs: [source], costCoverage: complete as Extract<CostCoverageAssessment, { coverageState: "complete" }>, unresolvedConditions: [], restrictions: [], comparisonStatus: "complete" as const, knownSubtotal: 0, total: 0 }
  const host = { revalidate: async () => true } as unknown as import("../../../product/contracts/ports.ts").DomainPortHost
  const sources: import("../../../product/contracts/ports.ts").PlannerSourceHost = { resolveForecastSource: async () => ({ status: "ok", value: { versionId: "v", evidence: source } }), resolveForecastCoverage: async (reference) => ({ status: "ok", value: { coverageRef: reference, basis, assessment: complete } }) }
  const clock = { ticks: 0 }
  const scenarios = { resolve: async (reference: string) => ({ status: "ok" as const, value: { result, coverageRef: `coverage-${reference}`, basis, projection: { ...proofProjection, components: proofProjection.components.map((item) => ({ ...item, sourceRefs: item.sourceRefs.map((ref) => ({ ...ref, observedAt: `tick-${++clock.ticks}` })) })) }, source } }) }
  const context = {} as import("../../../product/contracts/sf-execution.ts").TrustedDomainContext
  expect(await compareScenarios({ host, sources, scenarios }, { scenarioRefs: ["base", "candidate"], criteria: ["delivery"] }, context)).toMatchObject({ status: "ok", value: { comparisonStatus: "complete", completeDifference: 0, criterionResults: [{ criterionId: "delivery", state: "unknown" }] } })
  const criteria = { evaluate: async () => ({ status: "ok" as const, value: { criterionId: "delivery", state: "satisfied" as const, reason: "registered-rule-satisfied", ruleRef: "rule", evidenceRefs: [source] } }) }
  expect(await compareScenarios({ host, sources, scenarios, criteria }, { scenarioRefs: ["base", "candidate"], criteria: ["delivery"] }, context)).toMatchObject({ status: "ok", value: { comparisonStatus: "complete", completeDifference: 0, criterionResults: [{ criterionId: "delivery", state: "satisfied" }] } })
  const revision = { value: 0 }
  const changed = { evaluate: async () => ({ status: "ok" as const, value: { criterionId: "delivery", state: "satisfied" as const, reason: `rule-${++revision.value}`, ruleRef: "rule", evidenceRefs: [source] } }) }
  expect(await compareScenarios({ host, sources, scenarios, criteria: changed }, { scenarioRefs: ["base", "candidate"], criteria: ["delivery"] }, context)).toMatchObject({ status: "stale", reason: "criterion-or-authority-changed" })
})

test("scenario identity ignores observation clocks but binds financial values", async () => {
  const { plannerScenarioDigest } = await import("../../../product/planner/preview-comparison.ts")
  const component = { ...projection.components[0]!, sourceRefs: [{ surface: "planner" as const, type: "planner-version", id: "v", incarnation: "inc", version: 1, fields: ["amount"], period, observedAt: "2026-11-13T00:00:00Z" }] }
  const scenario = { id: "result", version: 1, components: [component], currency: "USD", horizon: period, sourceRefs: [evidence], costCoverage: complete, unresolvedConditions: ["hypothetical"], restrictions: [], comparisonStatus: "conditioned" as const, knownSubtotal: 0, total: null }
  const later = { ...scenario, components: [{ ...component, sourceRefs: [{ ...component.sourceRefs[0]!, observedAt: "2026-11-14T00:00:00Z" }] }] }
  expect(plannerScenarioDigest(scenario)).toBe(plannerScenarioDigest(later))
  expect(plannerScenarioDigest(scenario)).not.toBe(plannerScenarioDigest({ ...later, components: [{ ...later.components[0]!, amount: 1 }] }))
})
