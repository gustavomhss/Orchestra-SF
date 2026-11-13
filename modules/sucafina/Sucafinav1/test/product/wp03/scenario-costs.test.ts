import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis, ScenarioResult } from "../../../product/contracts/decisions.ts"
import { comparePlannerScenarios, plannerScenarioCostPresentation } from "../../../product/planner/comparison.ts"
import { plannerFixture, plannerPeriod, plannerSnapshot } from "./planner-fixture.ts"

test("C10 keeps the 30000 apparent savings conditional until training changes 210000 to 250000", async () => {
  const snapshot = plannerSnapshot()
  const planVersions = rows(snapshot.data.versions)
  for (const [index, version] of planVersions.entries()) {
    version.closed = 0
    const service = index === 0 ? 240000 : 210000
    version.lines = [{ id: "service", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(service / 12), a: Array(12).fill(null), f: Array(12).fill(service / 12) }]
    if (index === 2) version.lines = [...rows(version.lines), { id: "training", sec: "opex", el: "other", cur: "USD", b: [...Array(11).fill(0), 40000], a: Array(12).fill(null), f: [...Array(11).fill(0), 40000] }]
  }
  const fixture = await plannerFixture(snapshot)
  try {
    const context = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const issued = await Promise.all(["v0", "v1", "v2"].map((id) => fixture.issueSource(id, context)))
    if (issued.some((item) => item.status !== "ok")) throw new Error("source unavailable")
    const refs = issued.flatMap((item) => item.status === "ok" ? [item.value.evidence] : [])
    const assessed = await Promise.all(refs.map((source) => fixture.planner.compareForecast({ baseRef: source.refId, candidateRef: source.refId, period: plannerPeriod, currency: "USD" }, context)))
    if (assessed.some((item) => item.status !== "ok")) throw new Error("projection unavailable")
    const projections = assessed.flatMap((item) => item.status === "ok" ? [item.value.baseline] : [])
    expect(projections.map((projection) => projection.components.reduce((sum, component) => sum + component.amount!, 0))).toEqual([240000, 210000, 250000])
    const basis: CostCoverageBasis = { id: "renewal-transition", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: refs }
    const coverage = (index: number, training: "pending" | "included" | "not-applicable"): CostCoverageAssessment => {
      const source = refs[index]!
      const projection = projections[index]!
      const common = { basisId: basis.id, basisVersion: basis.version, alternativeId: `alternative-${index}`, alternativeVersion: 1, currency: "USD", horizon: plannerPeriod, evaluatedSourceRefs: [source] }
      const entries = RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service" || categoryId === "training" && training === "included" ? { status: "included" as const, categoryId, componentRefs: projection.components.filter((component) => component.id.startsWith(`${categoryId}:`)).map((component) => component.id), evidenceRefs: [source], scopeNote: "Included in the current Planner component set" } : { status: "not-applicable" as const, categoryId, justification: "Explicitly outside this fixture's documented renewal scope", evidenceRefs: [source] })
      return training === "pending" ? { ...common, coverageState: "pending", entries: entries.map((entry) => entry.categoryId === "training" ? { status: "pending", categoryId: "training", reason: "Training has not been priced" } : entry), derivedMissingCategoryIds: ["training"], issues: ["training-unpriced"] } : { ...common, coverageState: "complete", entries, derivedMissingCategoryIds: [], issues: [] }
    }
    const result = (index: number, assessment: CostCoverageAssessment): ScenarioResult => {
      const projection = projections[index]!
      const subtotal = projection.components.reduce((sum, component) => sum + component.amount!, 0)
      const common = { id: `result-${index}`, version: 1, components: projection.components, currency: "USD", horizon: plannerPeriod, sourceRefs: [refs[index]!], restrictions: [] }
      return assessment.coverageState === "complete" ? { ...common, costCoverage: assessment, comparisonStatus: "complete", knownSubtotal: subtotal, total: subtotal, unresolvedConditions: [] } : { ...common, costCoverage: assessment, comparisonStatus: "conditioned", knownSubtotal: subtotal, total: null, unresolvedConditions: ["training-unpriced"] }
    }
    const baseline = result(0, coverage(0, "not-applicable"))
    const proof = (index: number): { basis: CostCoverageBasis; projection: DomainProjection; source: Extract<BusinessEvidenceRef, { kind: "record" }> } => ({ basis, projection: projections[index]!, source: refs[index]! })
    const common = { baselineRef: "renewal", alternativeRef: "transition", baselineCoverageRef: "coverage-renewal", alternativeCoverageRef: "coverage-transition", baseline, baselineProof: proof(0) }
    const pending = comparePlannerScenarios({ ...common, alternative: result(1, coverage(1, "pending")), alternativeProof: proof(1) })
    expect(pending).toMatchObject({ comparisonStatus: "conditioned", knownDifference: -30000, completeDifference: null })
    expect(plannerScenarioCostPresentation(pending)).toMatchObject({ knownCostChange: -30000, knownSavings: 30000, completeSavings: null, savingsDefinition: "baseline minus alternative" })
    const complete = comparePlannerScenarios({ ...common, alternative: result(2, coverage(2, "included")), alternativeProof: proof(2) })
    expect(complete).toMatchObject({ comparisonStatus: "complete", knownDifference: 10000, completeDifference: 10000, unresolvedConditions: [] })
    expect(plannerScenarioCostPresentation(complete)).toMatchObject({ knownCostChange: 10000, knownSavings: -10000, completeCostChange: 10000, completeSavings: -10000 })
    const unproven = result(2, coverage(2, "included"))
    const withoutEvidence = { ...unproven, costCoverage: { ...unproven.costCoverage, entries: unproven.costCoverage.entries.map((entry) => entry.status === "included" && entry.categoryId === "training" ? { ...entry, evidenceRefs: [] } : entry) } } as ScenarioResult
    expect(comparePlannerScenarios({ ...common, alternative: withoutEvidence, alternativeProof: proof(2) })).toMatchObject({ comparisonStatus: "conditioned", completeDifference: null })
    const zero = projections[2]!.components.find((component) => component.id === "training:1")!
    expect(zero).toMatchObject({ amount: 0, evidenceState: "confirmed", sourceRefs: [expect.objectContaining({ id: "v2" })] })
    const absent = { ...proof(2), projection: { ...projections[2]!, components: projections[2]!.components.map((component) => component.id === zero.id ? { ...component, amount: null, evidenceState: "absent" as const } : component) } }
    expect(comparePlannerScenarios({ ...common, alternative: unproven, alternativeProof: absent })).toMatchObject({ comparisonStatus: "conditioned", completeDifference: null })
    const fx = { ...proof(2), projection: { ...projections[2]!, missing: [{ field: "currency", reason: "missing-fx" as const }] } }
    expect(comparePlannerScenarios({ ...common, alternative: unproven, alternativeProof: fx })).toMatchObject({ comparisonStatus: "conditioned", completeDifference: null })
    expect(object((await fixture.readSnapshot()).data.officials)).toEqual({ "2027": "v0" })
  } finally { await fixture.close() }
})
