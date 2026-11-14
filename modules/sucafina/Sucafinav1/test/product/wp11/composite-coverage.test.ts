import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { validateScenarioCoverage } from "../../../product/decisions/cost-coverage.ts"
import { createCoverageIntervalCertificate } from "../../../product/decisions/coverage-interval.ts"
import { supportsCoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import { createPlannerIntervalProof } from "../../../product/planner/interval-proof.ts"
import type { PortfolioSelection } from "../../../product/decisions/portfolio-selection.ts"
import { createWp05SensitivityFixture } from "../wp05/engine-fixture.ts"
import { renewalCoverage } from "./renewal-coverage-fixture.ts"

test("shared categories and supported N/A consume one real Planner contribution and retain the complete composed interval", async () => {
  const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "bundled", composed: true })
  try {
    const coverage = await renewalCoverage(fixture, "bundled")
    expect(coverage.assessment.coverageState).toBe("complete")
    expect(coverage.assessment.issues).toEqual([])
    expect(coverage.assessment.derivedMissingCategoryIds).toEqual([])
    expect(fixture.selectedResult.knownSubtotal).toBe(210000)
    if (fixture.selectedResult.comparisonStatus !== "conditioned") throw new Error("The simulated operations must retain their declared conditions")
    const storedResult = { ...fixture.selectedResult, costCoverage: coverage.assessment }
    expect(validateScenarioCoverage(storedResult, fixture.basis, coverage.assessment)).toBeUndefined()
    // Classification resolves cost scope; an unapplied scenario remains a hypothetical analysis.
    expect(storedResult.comparisonStatus).toBe("conditioned")
    expect(storedResult.total).toBeNull()
    const structural = await createPlannerIntervalProof({ units: fixture.issuer, preview: fixture.preview })(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
    const rule = await fixture.rules.resolve({ caseRef: fixture.caseRef, criterionId: fixture.sensitivityRequest.criterion.id }, fixture.context)
    if (structural.status !== "ok" || rule.status !== "ok") throw new Error(`Real interval or registered rule unavailable: ${JSON.stringify({ structural, rule })}`)
    expect(structural.value.scenarioDigest).toBe(digestSfValue(fixture.scenario))
    const selectionBody = { schema: "sf-portfolio-selection-v1" as const, selectionRef: "selection", caseRef: fixture.caseRef, baselineAlternativeId: "baseline", alternativeId: "selected", baselineRef: fixture.baselineRef, alternativeRef: fixture.selectedRef, criteria: [rule.value.criterionId], comparisonDigest: digestSfValue(fixture.comparison), version: 1, principalRef: "finance", accessRevision: "access", policyVersion: "policy", createdAt: "2026-11-13T00:00:00Z" }
    const selection: PortfolioSelection = { ...selectionBody, selectionDigest: digestSfValue(selectionBody) }
    const decision = { ...fixture.decision, alternatives: fixture.decision.alternatives.map((item) => item.id === "selected" ? { ...item, result: storedResult } : item) }
    const input = { decision, selection, scenario: fixture.scenario, storedResult, rule: rule.value, structural: structural.value, assessment: coverage.assessment, basis: fixture.basis, classification: coverage.classification, evidence: coverage.evidence, context: fixture.context }
    const certificate = createCoverageIntervalCertificate(input)
    expect(certificate?.bounds).toEqual(fixture.sensitivityRequest.parameterBounds && { parameterRef: "implementation:11", minimum: 10000, maximum: 70000 })
    expect(certificate?.structuralDigest).toBe(digestSfValue(structural.value))
    expect(createCoverageIntervalCertificate({ ...input, evidence: coverage.evidence.map((item) => item.ref.refId === coverage.statement.refId ? { ...item, state: "revoked" as const } : item) })).toBeUndefined()
    expect(createCoverageIntervalCertificate({ ...input, classification: { ...coverage.classification, notApplicableEntries: [] } })).toBeUndefined()
    const duplicated = { ...structural.value, componentIds: [...structural.value.componentIds, structural.value.componentIds[0]!] }
    expect(createCoverageIntervalCertificate({ ...input, structural: duplicated })).toBeUndefined()
    if (coverage.assessment.coverageState !== "complete") throw new Error("Expected complete coverage before tampering")
    const forged = { ...storedResult, costCoverage: { ...coverage.assessment, entries: coverage.assessment.entries.filter((item) => item.categoryId !== "training") } }
    expect(validateScenarioCoverage(forged, fixture.basis, forged.costCoverage)).toBe("incomplete-cost-coverage")
    const exact = await fixture.exact(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
    expect(exact.status).toBe("ok")
    if (exact.status !== "ok") throw new Error(exact.reason)
    expect(exact.value.value).toBeCloseTo(55000, 8)
  } finally { await fixture.cleanup() }
}, 180000)

test("coverage distinguishes omitted and null training from explicit zero and a later 40000 quote", async () => {
  for (const training of ["omitted", "null", "zero", "confirmed"] as const) {
    const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training, composed: true })
    try {
      const coverage = await renewalCoverage(fixture, training)
      expect(coverage.assessment.coverageState).toBe(training === "zero" || training === "confirmed" ? "complete" : "pending")
      expect(coverage.assessment.issues).toEqual([])
      if (training === "omitted") expect(coverage.assessment.entries.find((item) => item.categoryId === "training")).toEqual({ categoryId: "training", status: "pending", reason: "missing-category" })
      if (training === "null") expect(coverage.assessment.entries.find((item) => item.categoryId === "training")).toEqual({ categoryId: "training", status: "pending", reason: "component-unresolved" })
      expect(fixture.selectedResult.knownSubtotal).toBe(training === "confirmed" ? 250000 : 210000)
      expect(fixture.comparison.knownDifference).toBe(training === "confirmed" ? 10000 : -30000)
      if (training === "confirmed" || training === "zero") {
        const exact = await fixture.exact(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
        expect(exact.status).toBe("ok")
        if (exact.status !== "ok") throw new Error(exact.reason)
        expect(exact.value.value).toBeCloseTo(training === "confirmed" ? 15000 : 55000, 8)
      }
      const notApplicable = coverage.entries.find((item) => item.status === "not-applicable")
      if (!notApplicable || notApplicable.status !== "not-applicable") throw new Error("Applicability fixture missing")
      expect(supportsCoverageClassification(coverage.classification, notApplicable, coverage.evidence)).toBe(true)
      expect(supportsCoverageClassification(coverage.classification, { ...notApplicable, justification: "The model guesses zero" }, coverage.evidence)).toBe(false)
      expect(supportsCoverageClassification(coverage.classification, { ...notApplicable, evidenceRefs: [] }, coverage.evidence)).toBe(false)
      const duplicate = coverage.entries.map((entry) => entry.status === "included" && entry.categoryId === "implementation" ? { ...entry, componentRefs: [...entry.componentRefs, entry.componentRefs[0]!] } : entry)
      expect(coverage.assess(duplicate).coverageState).toBe("pending")
      expect(coverage.assess(coverage.entries, [...coverage.actual.components, coverage.actual.components[0]!]).issues).toContain("duplicate-component")
    } finally { await fixture.cleanup() }
  }
}, 180000)
