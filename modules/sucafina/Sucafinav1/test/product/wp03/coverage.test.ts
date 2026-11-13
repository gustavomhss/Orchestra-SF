import { expect, test } from "bun:test"
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
