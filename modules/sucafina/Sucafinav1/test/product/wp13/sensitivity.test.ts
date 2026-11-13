import { expect, test } from "bun:test"
import { createSensitivityEvaluator } from "../../../product/portfolio/sensitivity.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { SensitivityRequest } from "../../../product/contracts/operations.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const request: SensitivityRequest = { scenarioRef: "scenario", parameterBounds: { parameterRef: "implementation", minimum: 0, maximum: 100000, steps: 2 }, criterion: { id: "advantage", operator: "gte", value: 20000 } }
const scenario: ScenarioResult = { id: "scenario", version: 1, components: [], currency: "USD", horizon: period, sourceRefs: [], unresolvedConditions: ["training missing"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 210000, total: null, costCoverage: { basisId: "b", basisVersion: 1, alternativeId: "a", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [], coverageState: "pending", entries: [], derivedMissingCategoryIds: ["training"] } }
const context = {} as TrustedDomainContext

test("keeps a domain threshold conditioned on omitted coverage", async () => {
  const evaluate = createSensitivityEvaluator({
    sample: async (_request, value) => ({ status: "ok", value: { resultRef: `result-${value}`, scenario, parameterUnit: "USD", resultUnit: "USD", unitMetadataRef: "units-v1", unitMetadataVersion: 1, criterionValue: 75000 - value } }),
    exactThreshold: async () => ({ status: "ok", value: { value: 55000, evidenceRefs: [{ refDigest: "synthetic" } as unknown as BusinessEvidenceRef] } }),
    revalidate: async () => true,
  })
  const result = await evaluate(request, context)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.threshold).toBe(55000)
  expect(result.value.comparisonStatus).toBe("conditioned")
  expect(result.value.evaluated.map((item) => item.parameterValue)).toEqual([0, 50000, 100000])
  expect(result.value.unresolvedConditions.some((item) => item.reason === "missing-category:training")).toBe(true)
})

test("does not infer an exact threshold from sampled points", async () => {
  const evaluate = createSensitivityEvaluator({
    sample: async (_request, value) => ({ status: "ok", value: { resultRef: `result-${value}`, scenario, parameterUnit: "USD", resultUnit: "USD", unitMetadataRef: "units-v1", unitMetadataVersion: 1, criterionValue: value * value } }),
    exactThreshold: async () => ({ status: "unavailable", reason: "nonlinear" }),
    revalidate: async () => true,
  })
  const result = await evaluate(request, context)
  expect(result.status === "ok" && result.value.threshold).toBeNull()
  expect(result.status === "ok" && result.value.unresolvedConditions.some((item) => item.category === "precision")).toBe(true)
})

test("retains the domain values on either side of the exact boundary", async () => {
  const evaluate = createSensitivityEvaluator({
    sample: async (_request, value) => ({ status: "ok", value: { resultRef: `result-${value}`, scenario, parameterUnit: "USD", resultUnit: "USD", unitMetadataRef: "units-v1", unitMetadataVersion: 1, criterionValue: 75000 - value } }),
    exactThreshold: async () => ({ status: "ok", value: { value: 55000, evidenceRefs: [{ refDigest: "synthetic" } as unknown as BusinessEvidenceRef] } }),
    revalidate: async () => true,
  })
  const result = await evaluate({ ...request, parameterBounds: { ...request.parameterBounds, minimum: 55000, maximum: 55001, steps: 1 } }, context)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.evaluated.map((point) => point.value)).toEqual([20000, 19999])
  expect(result.value.comparisonStatus).toBe("conditioned")
})

test("does not disclose sampled values after source revocation", async () => {
  const evaluate = createSensitivityEvaluator({
    sample: async (_request, value) => ({ status: "ok", value: { resultRef: `result-${value}`, scenario, parameterUnit: "USD", resultUnit: "USD", unitMetadataRef: "units-v1", unitMetadataVersion: 1, criterionValue: value } }),
    exactThreshold: async () => ({ status: "unavailable", reason: "no-exact-rule" }),
    revalidate: async () => false,
  })
  expect(await evaluate(request, context)).toEqual({ status: "stale", reason: "source-or-authority-changed" })
})


test("rejects conflicting versioned units across samples", async () => {
  const evaluate = createSensitivityEvaluator({
    sample: async (_request, value) => ({ status: "ok", value: { resultRef: `result-${value}`, scenario, parameterUnit: "days", resultUnit: value === 0 ? "USD" : "EUR", unitMetadataRef: "units", unitMetadataVersion: 1, criterionValue: value } }),
    exactThreshold: async () => ({ status: "unavailable", reason: "no-exact-rule" }),
    revalidate: async () => true,
  })
  expect(await evaluate(request, context)).toEqual({ status: "unavailable", reason: "unit-metadata-mismatch" })
})

test("rejects missing unit metadata instead of inferring currency", async () => {
  const evaluate = createSensitivityEvaluator({
    sample: async (_request, value) => ({ status: "ok", value: { resultRef: `result-${value}`, scenario, parameterUnit: "", resultUnit: "USD", unitMetadataRef: "units", unitMetadataVersion: 1, criterionValue: value } }),
    exactThreshold: async () => ({ status: "unavailable", reason: "no-exact-rule" }),
    revalidate: async () => true,
  })
  expect(await evaluate(request, context)).toEqual({ status: "unavailable", reason: "invalid-domain-sample" })
})
