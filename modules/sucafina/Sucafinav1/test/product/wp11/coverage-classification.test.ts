import { expect, test } from "bun:test"
import { classifyCoverage, supportsCoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import type { BaselineCoverageRequest } from "../../../product/decisions/baseline-coverage.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"

test("human classification is bound to real components, source identity and fresh evidence", () => {
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const source = { schema: "sf-evidence-v1", kind: "record", refId: "forecast", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", target: { surface: "planner", recordType: "forecast", recordId: "forecast", incarnation: "inc", version: 1, fields: ["amount"], period, projectionDigest: "b".repeat(64) } } as const
  const entry = { categoryId: "service", status: "included", componentRefs: ["line:2027-01"], evidenceRefs: [source], scopeNote: "Service cost" } as const
  const request = { caseRef: { id: "case", incarnation: "case-inc", version: 1 }, source, basis: { id: "basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: ["service"], additionalCategoryIds: [], sourceRefs: [source] }, entries: [entry], expectedVersion: 0 } satisfies BaselineCoverageRequest
  const component = { id: "line:2027-01", amount: 100, currency: "USD", period, evidenceState: "confirmed", sourceRefs: [{ surface: "planner", type: "forecast", id: "forecast", incarnation: "inc", version: 1, fields: ["amount"], period, observedAt: "2026-11-13T00:00:00Z" }] } as const
  const projection = { components: [component] } as unknown as DomainProjection
  const evidence: BusinessEvidenceResolution[] = [{ state: "fresh", ref: source, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" }]
  const classification = classifyCoverage(request, projection, 1)
  expect(supportsCoverageClassification(classification, entry, evidence)).toBe(true)
  expect(JSON.stringify(classification)).not.toContain('"amount":100')
  expect(supportsCoverageClassification(classification, { ...entry, categoryId: "training" }, evidence)).toBe(false)
  expect(supportsCoverageClassification(classification, entry, [{ ...evidence[0]!, state: "stale" }])).toBe(false)
  expect(supportsCoverageClassification(classifyCoverage(request, { ...projection, components: [] }, 1), entry, evidence)).toBe(false)
  expect(supportsCoverageClassification(classifyCoverage(request, { ...projection, components: [{ ...component, sourceRefs: [{ ...component.sourceRefs[0], incarnation: "recreated" }] }] }, 1), entry, evidence)).toBe(false)
  expect(supportsCoverageClassification(classification, { categoryId: "training", status: "not-applicable", justification: "No costs", evidenceRefs: [source] }, evidence)).toBe(false)
})
