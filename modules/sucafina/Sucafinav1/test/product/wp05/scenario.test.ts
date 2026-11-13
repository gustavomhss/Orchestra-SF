import { expect, test } from "bun:test"
import { presentScenario, presentSensitivity } from "../../../product/analytics/catalog.ts"
import type { ScenarioComparison, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { SensitivityResult } from "../../../product/contracts/outputs.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"

const evidence: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "source", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "forecast", recordId: "a", incarnation: "inc", version: 1, fields: ["cost"], projectionDigest: "digest" } }
const result: ScenarioResult = {
  id: "replace", version: 1, currency: "USD", horizon: { start: "2027-01-01", end: "2027-12-31" },
  sourceRefs: [], restrictions: [], components: [], knownSubtotal: 210000, total: null,
  comparisonStatus: "conditioned", unresolvedConditions: ["training missing"],
  costCoverage: { basisId: "renewal", basisVersion: 1, alternativeId: "replace", alternativeVersion: 1, currency: "USD", horizon: { start: "2027-01-01", end: "2027-12-31" }, issues: [], evaluatedSourceRefs: [], coverageState: "pending", entries: [], derivedMissingCategoryIds: ["training"] },
}
const comparison: ScenarioComparison = { baselineResultRef: "renew", alternativeResultRef: "replace", costCoverageRefs: ["coverage"], criterionResults: [], unresolvedConditions: ["training missing"], comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null }

test("conditioned results retain missing category and never invent a total", () => {
  const view = presentScenario(result, comparison)
  expect(view.knownSubtotal).toBe(210000)
  expect(view.total).toBeNull()
  expect(view.difference).toBe(30000)
  expect(view.status).toBe("conditioned")
  expect(view.coverage.derivedMissingCategoryIds).toEqual(["training"])
})

test("sensitivity leaves missing and nonfinite results as gaps", () => {
  const sensitivity: SensitivityResult = { scenarioRef: "replace", parameterRef: "training", bounds: { minimum: 0, maximum: 40000, steps: 2 }, evaluated: [{ parameterValue: 0, resultRef: "one", value: 0 }, { parameterValue: 40000, resultRef: "two", value: null }, { parameterValue: 1, resultRef: "invalid", value: Infinity }, { parameterValue: Infinity, resultRef: "invalid-parameter", value: 2 }], threshold: null, thresholdEvidence: { state: "unavailable", reason: "not-evaluated" }, unit: "USD", engineVersion: "v1", costCoverageRefs: ["coverage"], comparisonStatus: "conditioned", unresolvedConditions: [], evidenceRefs: [] }
  expect(presentSensitivity(sensitivity).evaluated.map((point) => point.value)).toEqual([0, null, null, 2])
  expect(presentSensitivity(sensitivity).evaluated[3]?.parameterValue).toBeNull()
})

test("a later resolved revision changes displayed totals without mutating the earlier snapshot", () => {
  const resolved: ScenarioResult = { ...result, version: 2, knownSubtotal: 250000, total: 250000, comparisonStatus: "complete", unresolvedConditions: [], costCoverage: { ...result.costCoverage, alternativeVersion: 2, coverageState: "complete", entries: [{ status: "included", categoryId: "training", componentRefs: ["training"], evidenceRefs: [evidence], scopeNote: "confirmed by producer" }], derivedMissingCategoryIds: [] } }
  const updated: ScenarioComparison = { ...comparison, comparisonStatus: "complete", knownDifference: -10000, completeDifference: -10000, unresolvedConditions: [] }
  const view = presentScenario(resolved, updated)
  expect(view.total).toBe(250000)
  expect(view.difference).toBe(-10000)
  expect(presentScenario(result, comparison).total).toBeNull()
})

test("an inconsistent complete comparison cannot promote a conditioned result", () => {
  const inconsistent: ScenarioComparison = { ...comparison, comparisonStatus: "complete", knownDifference: 30000, completeDifference: 30000, unresolvedConditions: [] }
  expect(presentScenario(result, inconsistent).status).toBe("incompatible")
  expect(presentScenario(result, inconsistent).total).toBeNull()
})


test("sampled sensitivity never claims an exact threshold", () => {
  const sensitivity: SensitivityResult = { scenarioRef: "replace", parameterRef: "training", bounds: { minimum: 0, maximum: 40000, steps: 2 }, evaluated: [{ parameterValue: 10000, value: 1, resultRef: "a" }, { parameterValue: 20000, value: -1, resultRef: "b" }], threshold: null, thresholdEvidence: { state: "sampled", interval: { minimum: 10000, maximum: 20000 }, evidenceRefs: [evidence] }, unit: "USD", engineVersion: "v1", costCoverageRefs: ["coverage"], comparisonStatus: "conditioned", unresolvedConditions: [], evidenceRefs: [] }
  expect(presentSensitivity(sensitivity).threshold).toBeNull()
  expect(presentSensitivity(sensitivity).thresholdEvidence).toEqual(sensitivity.thresholdEvidence)
})

test("an exact threshold requires matching finite engine evidence", () => {
  const sensitivity: SensitivityResult = { scenarioRef: "replace", parameterRef: "training", bounds: { minimum: 0, maximum: 40000, steps: 2 }, evaluated: [], threshold: 15000, thresholdEvidence: { state: "exact", value: 15000, evidenceRefs: [evidence] }, unit: "USD", engineVersion: "v1", costCoverageRefs: ["coverage"], comparisonStatus: "conditioned", unresolvedConditions: [], evidenceRefs: [] }
  expect(presentSensitivity(sensitivity).threshold).toBe(15000)
  expect(presentSensitivity({ ...sensitivity, threshold: 16000 }).threshold).toBeNull()
})


test("missing sensitivity provenance cannot be presented as complete", () => {
  const sensitivity: SensitivityResult = { scenarioRef: "replace", parameterRef: "training", bounds: { minimum: 0, maximum: 40000, steps: 2 }, evaluated: [], threshold: 15000, thresholdEvidence: { state: "exact", value: 15000, evidenceRefs: [] }, unit: "USD", engineVersion: "v1", costCoverageRefs: [], comparisonStatus: "complete", unresolvedConditions: [], evidenceRefs: [] }
  const view = presentSensitivity(sensitivity)
  expect(view.comparisonStatus).toBe("unavailable")
  expect(view.threshold).toBeNull()
})

test("a result claiming completeness with an absent component cannot display a full total", () => {
  const complete: ScenarioResult = { ...result, comparisonStatus: "complete", knownSubtotal: 0, total: 0, components: [{ id: "training", amount: 0, currency: "USD", period: result.horizon, sourceRefs: [], evidenceState: "absent" }], costCoverage: { ...result.costCoverage, coverageState: "complete", entries: [], derivedMissingCategoryIds: [] } }
  const completeComparison: ScenarioComparison = { ...comparison, comparisonStatus: "complete", knownDifference: 0, completeDifference: 0, unresolvedConditions: [] }
  const view = presentScenario(complete, completeComparison)
  expect(view.status).toBe("incompatible")
  expect(view.total).toBeNull()
  expect(view.rows[0]?.amount).toBeNull()
})

test("a comparison without coverage references cannot be displayed as complete", () => {
  const complete: ScenarioResult = { ...result, comparisonStatus: "complete", knownSubtotal: 0, total: 0, components: [], costCoverage: { ...result.costCoverage, coverageState: "complete", entries: [], derivedMissingCategoryIds: [] } }
  const missing: ScenarioComparison = { ...comparison, comparisonStatus: "complete", knownDifference: 0, completeDifference: 0, costCoverageRefs: [], unresolvedConditions: [] }
  expect(presentScenario(complete, missing).status).toBe("incompatible")
  expect(presentScenario(complete, missing).total).toBeNull()
})
