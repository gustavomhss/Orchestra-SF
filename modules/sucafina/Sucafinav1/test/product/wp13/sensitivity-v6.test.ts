import { expect, test } from "bun:test"
import { attachSensitivityV6, createSensitivityV6Evaluator } from "../../../product/portfolio/sensitivity-v6.ts"
import type { SensitivityRequest } from "../../../product/contracts/operations.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { SensitivityLegacyResult } from "../../../product/portfolio/sensitivity-v6.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"

const result: SensitivityLegacyResult = { parameterUnit: "days", resultUnit: "USD", scenarioRef: "s", parameterRef: "price", bounds: { minimum: 0, maximum: 100000, steps: 2 }, evaluated: [{ parameterValue: 50000, resultRef: "sample-a", value: 1 }, { parameterValue: 60000, resultRef: "sample-b", value: -1 }], threshold: 55000, comparisonStatus: "complete", unresolvedConditions: [], evidenceRefs: [] }
const evidence = [{ refDigest: "synthetic" } as unknown as BusinessEvidenceRef]

test("v6 keeps exact evidence and legacy threshold consistent", () => {
  const input = { result, costCoverageRefs: ["coverage-v1"], unit: "USD", engineVersion: "planner-v1", thresholdEvidence: { state: "exact" as const, value: 55000, evidenceRefs: evidence } }
  const accepted = attachSensitivityV6(input)
  expect(accepted.status).toBe("ok")
  const conditioned = attachSensitivityV6({ ...input, result: { ...result, comparisonStatus: "conditioned", unresolvedConditions: [{ id: "training", category: "coverage", reason: "Known subtotal threshold; training remains unresolved.", evidenceRefs: evidence }] } })
  expect(conditioned.status).toBe("ok")
  if (conditioned.status === "ok") expect(conditioned.value.comparisonStatus).toBe("conditioned")
  expect(attachSensitivityV6({ ...input, result: { ...result, comparisonStatus: "incompatible" } })).toEqual({ status: "conflict", reason: "threshold-evidence-mismatch" })
  expect(attachSensitivityV6({ ...input, result: { ...result, evaluated: [{ parameterValue: 50000, resultRef: "missing", value: null }] } })).toEqual({ status: "conflict", reason: "threshold-evidence-mismatch" })
  expect(attachSensitivityV6({ ...input, thresholdEvidence: { ...input.thresholdEvidence, value: 15000 } })).toEqual({ status: "conflict", reason: "threshold-evidence-mismatch" })
})

test("sampled interval cannot masquerade as an exact threshold", () => {
  const input = { result, costCoverageRefs: ["coverage-v1"], unit: "USD", engineVersion: "planner-v1", thresholdEvidence: { state: "sampled" as const, interval: { minimum: 50000, maximum: 60000 }, evidenceRefs: evidence } }
  expect(attachSensitivityV6(input)).toEqual({ status: "conflict", reason: "sampled-interval-mismatch" })
  expect(attachSensitivityV6({ ...input, result: { ...result, threshold: null } }).status).toBe("ok")
})


test("v6 revalidates coverage before returning enriched output", async () => {
  const evaluate = createSensitivityV6Evaluator({
    evaluate: async () => ({ status: "ok", value: result }),
    describe: async () => ({ status: "ok", value: { costCoverageRefs: ["coverage-v1"], unit: "USD", engineVersion: "planner-v1", thresholdEvidence: { state: "exact", value: 55000, evidenceRefs: evidence } } }),
    revalidate: async () => false,
  })
  expect(await evaluate({} as SensitivityRequest, {} as TrustedDomainContext)).toEqual({ status: "stale", reason: "source-or-authority-changed" })
})


test("legacy sensitivity without both units is unavailable", () => {
  expect(attachSensitivityV6({ result: { ...result, resultUnit: undefined }, costCoverageRefs: ["coverage-v1"], unit: "days", engineVersion: "planner-v1", thresholdEvidence: { state: "exact", value: 55000, evidenceRefs: evidence } })).toEqual({ status: "unavailable", reason: "sensitivity-units-unavailable" })
})

test("v6 rejects callbacks that mutate the validated result during enrichment or revalidation", async () => {
  for (const phase of ["describe", "revalidate"] as const) {
    const borrowed = structuredClone(result)
    const evaluate = createSensitivityV6Evaluator({
      evaluate: async () => ({ status: "ok", value: borrowed }),
      describe: async (value) => {
        if (phase === "describe") value.threshold = 15000
        return { status: "ok", value: { costCoverageRefs: ["coverage-v1"], unit: "USD", engineVersion: "planner-v1", thresholdEvidence: { state: "exact", value: 55000, evidenceRefs: evidence } } }
      },
      revalidate: async (value) => { if (phase === "revalidate") value.threshold = 15000; return true },
    })
    expect(await evaluate({} as SensitivityRequest, {} as TrustedDomainContext)).toEqual({ status: "stale", reason: "source-or-authority-changed" })
    expect(borrowed.threshold).toBe(55000)
  }
})
