import type { ScenarioResult } from "../../../product/contracts/decisions.ts"
import { expect, test } from "bun:test"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { finalizePlannerSensitivity } from "../../../product/portfolio/planner-sensitivity.ts"

type FinalizerInput = Parameters<typeof finalizePlannerSensitivity>[0]
const evidence = [{ refDigest: "controlled-finalizer-unit-test" } as unknown as BusinessEvidenceRef]

// Controlled serializer input, not a domain certificate or an installed-host proof.
function input(): FinalizerInput {
  const request = { scenarioRef: "source", parameterBounds: { parameterRef: "implementation", minimum: 10000, maximum: 70000, steps: 1 }, criterion: { id: "advantage", operator: "gte" as const, value: 20000 } }
  return {
    request,
    binding: { caseRef: { id: "case", incarnation: "inc", version: 1 }, scenario: { baseRef: "base", operations: [], assumptions: [] }, baselineRef: "baseline", baselineCoverageRef: "baseline-coverage", scenarioCoverageRef: "selected-coverage", criterionId: "advantage", metric: "alternative-minus-baseline-known-subtotal", parameterUnit: "USD", resultUnit: "USD", unit: "USD", unitMetadataRef: "units", unitMetadataVersion: 1, engineVersion: "planner-runtime-v1", evidenceRefs: evidence, sensitivityRequest: request, ruleRef: "rule", ruleVersion: 1, ruleDigest: "a".repeat(64), metadataDigest: "b".repeat(64) },
    result: { scenarioRef: "source", parameterRef: "implementation", parameterUnit: "USD", resultUnit: "USD", bounds: { minimum: 10000, maximum: 70000, steps: 1 }, evaluated: [{ parameterValue: 10000, resultRef: "sample-low", value: 65000 }, { parameterValue: 70000, resultRef: "sample-high", value: 5000 }], threshold: 55000, comparisonStatus: "conditioned", unresolvedConditions: [{ id: "sample:missing-category:training", category: "coverage", reason: "missing-category:training", evidenceRefs: evidence }, { id: "sample:preview-not-applied", category: "hypothesis", reason: "preview-not-applied", evidenceRefs: evidence }], evidenceRefs: evidence },
    samples: [{ resultRef: "sample-low", coverageRefs: ["baseline-coverage"], conditions: ["baseline-pending"] }, { resultRef: "sample-high", coverageRefs: ["selected-coverage"], conditions: [] }],
    baselineRefs: evidence,
    exact: { value: 55000, evidenceRefs: evidence },
  }
}

test("conditioned exact sensitivity keeps both consumer disclosures and every original gap", () => {
  const original = input()
  const before = structuredClone(original)
  const found = finalizePlannerSensitivity(original)
  expect(found.status).toBe("ok")
  if (found.status !== "ok") throw new Error(found.reason)
  expect(found.value.comparisonStatus).toBe("conditioned")
  expect(found.value.threshold).toBe(55000)
  expect(found.value.thresholdEvidence).toEqual({ state: "exact", value: 55000, evidenceRefs: evidence })
  expect(found.value.evaluated).toEqual(before.result.evaluated)
  expect(found.value.costCoverageRefs).toEqual(["baseline-coverage", "selected-coverage"])
  expect(found.value.unresolvedConditions.slice(0, 2)).toEqual(before.result.unresolvedConditions)
  expect(found.value.unresolvedConditions.map((condition) => condition.id)).toEqual(["sample:missing-category:training", "sample:preview-not-applied", "known-components-threshold", "sample-low:baseline-pending", "known-subtotal-threshold"])
  expect(found.value.unresolvedConditions.find((condition) => condition.id === "known-components-threshold")?.reason).toContain("55000 USD applies only to the known components")
  expect(found.value.unresolvedConditions.find((condition) => condition.id === "known-subtotal-threshold")?.reason).toContain("known subtotal differences")
  expect(original).toEqual(before)
})

test("historical bundle and PR37 serializers retain exact condition order without changing monetary fields", () => {
  const bundle = finalizePlannerSensitivity({ ...input(), disclosureFormat: "bundle-v1" })
  const source = finalizePlannerSensitivity({ ...input(), disclosureFormat: "pr37-v1" })
  const current = finalizePlannerSensitivity(input())
  if (bundle.status !== "ok" || source.status !== "ok" || current.status !== "ok") throw new Error("Serializer unavailable")
  expect(bundle.value.unresolvedConditions.map((condition) => condition.id)).toEqual(["sample:missing-category:training", "sample:preview-not-applied", "sample-low:baseline-pending", "preview-coverage"])
  expect(source.value.unresolvedConditions.map((condition) => condition.id)).toEqual(["sample:missing-category:training", "sample:preview-not-applied", "known-components-threshold", "sample-low:baseline-pending"])
  for (const previous of [bundle.value, source.value]) {
    const { unresolvedConditions: _previousConditions, ...previousFields } = previous
    const { unresolvedConditions: _currentConditions, ...currentFields } = current.value
    expect(previousFields).toEqual(currentFields)
  }
})

test("complete qualified coverage has no incomplete-coverage disclaimer", () => {
  const original = input()
  original.result.comparisonStatus = "complete"
  original.result.unresolvedConditions = original.result.unresolvedConditions.filter((condition) => condition.category === "hypothesis")
  original.samples = original.samples.map((sample) => ({ ...sample, conditions: [] }))
  const found = finalizePlannerSensitivity(original)
  expect(found.status).toBe("ok")
  if (found.status !== "ok") throw new Error(found.reason)
  expect(found.value.comparisonStatus).toBe("complete")
  expect(found.value.thresholdEvidence.state).toBe("exact")
  expect(found.value.unresolvedConditions).toEqual(original.result.unresolvedConditions)
})

test("missing or mismatched exact evidence keeps sampled precision and unresolved coverage", () => {
  for (const exact of [undefined, { value: 15000, evidenceRefs: evidence }, { value: 55000, evidenceRefs: [] }]) {
    const found = finalizePlannerSensitivity({ ...input(), exact })
    expect(found.status).toBe("ok")
    if (found.status !== "ok") throw new Error(found.reason)
    expect(found.value.threshold).toBeNull()
    expect(found.value.thresholdEvidence).toEqual({ state: "sampled", interval: { minimum: 10000, maximum: 70000 }, evidenceRefs: evidence })
    expect(found.value.comparisonStatus).toBe("conditioned")
    expect(found.value.unresolvedConditions.some((condition) => condition.id === "preview-coverage")).toBe(true)
    expect(found.value.unresolvedConditions.some((condition) => condition.id === "known-components-threshold" || condition.id === "known-subtotal-threshold")).toBe(false)
  }
})

test("union retains original source and baseline gaps while rebuilding Intelligence evidence order", () => {
  const original = input()
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const scenario: ScenarioResult = { id: "original", version: 1, components: [], currency: "USD", horizon, sourceRefs: evidence, unresolvedConditions: ["unconfirmed-source"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 210000, total: null, costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "selected", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: evidence, coverageState: "pending", entries: [], derivedMissingCategoryIds: ["training"] } }
  original.originalScenarios = [{ resultRef: "original-source", scenario, coverageRef: "selected-coverage" }, { resultRef: "original-baseline", scenario: { ...scenario, costCoverage: { ...scenario.costCoverage, derivedMissingCategoryIds: ["support"] } }, coverageRef: "baseline-coverage" }]
  const certificateOnly = { refDigest: "certificate-only-unit-test" } as unknown as BusinessEvidenceRef
  original.exact = { value: 55000, evidenceRefs: [certificateOnly, ...evidence] }
  const before = structuredClone(original)
  const current = finalizePlannerSensitivity(original)
  const intelligence = finalizePlannerSensitivity({ ...original, disclosureFormat: "intelligence-v1" })
  const bundle = finalizePlannerSensitivity({ ...original, disclosureFormat: "bundle-v1" })
  if (current.status !== "ok" || intelligence.status !== "ok" || bundle.status !== "ok") throw new Error("Historical finalization unavailable")
  for (const result of [current.value, intelligence.value]) {
    expect(result.unresolvedConditions.some((condition) => condition.id === "original-source:missing-category:training")).toBe(true)
    expect(result.unresolvedConditions.some((condition) => condition.id === "original-baseline:missing-category:support")).toBe(true)
    expect(result.comparisonStatus).toBe("conditioned")
    expect(result.threshold).toBe(55000)
    expect(result.unresolvedConditions.at(-1)?.id).toBe("known-subtotal-threshold")
  }
  expect(current.value.thresholdEvidence).toEqual({ state: "exact", value: 55000, evidenceRefs: [...evidence, certificateOnly] })
  expect(intelligence.value.thresholdEvidence).toEqual({ state: "exact", value: 55000, evidenceRefs: [certificateOnly, ...evidence] })
  expect(intelligence.value.unresolvedConditions.some((condition) => condition.id === "known-components-threshold")).toBe(false)
  expect(bundle.value.unresolvedConditions.some((condition) => condition.id.startsWith("original-"))).toBe(false)
  expect(original).toEqual(before)
})

test("Intelligence sampled history retains its original ordered evidence without claiming exactness", () => {
  const original = input()
  original.result.threshold = null
  delete original.exact
  const found = finalizePlannerSensitivity({ ...original, disclosureFormat: "intelligence-v1" })
  expect(found.status).toBe("ok")
  if (found.status !== "ok") throw new Error(found.reason)
  expect(found.value.threshold).toBeNull()
  expect(found.value.thresholdEvidence).toEqual({ state: "sampled", interval: { minimum: 10000, maximum: 70000 }, evidenceRefs: [...evidence, ...evidence, ...evidence] })
  expect(found.value.unresolvedConditions.at(-1)?.id).toBe("preview-coverage")
})
