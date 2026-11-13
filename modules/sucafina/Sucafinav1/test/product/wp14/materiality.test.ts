import { describe, expect, test } from "bun:test"
import { classifySfMaterialChange } from "../../../product/decision-memory/materiality.ts"
import type { MaterialChangeEvent, MaterialCondition } from "../../../product/decision-memory/materiality.ts"

const source = { surface: "planner" as const, type: "quote", id: "quote-1", incarnation: "one", version: 1, fields: ["price"], period: { start: "2027-01-01", end: "2027-12-31" }, observedAt: "2026-01-01" }
const comparison = (state: "satisfied" | "failed", difference: number) => ({ comparisonStatus: "complete" as const, knownDifference: difference, completeDifference: difference, baselineResultRef: "renewal", alternativeResultRef: "transition", costCoverageRefs: [], criterionResults: [{ criterionId: "advantage", state, reason: "minimum 20000" }], unresolvedConditions: [] })
const evidence = { schema: "sf-evidence-v1", refId: "quote-ref", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "quote", recordId: "quote-1", incarnation: "one", version: 1, fields: ["price"], projectionDigest: "b".repeat(64) } } as const
const coverage = { basisId: "renewal", basisVersion: 1, alternativeId: "replace", alternativeVersion: 1, currency: "USD", horizon: source.period, issues: [], evaluatedSourceRefs: [evidence], coverageState: "complete", entries: [], derivedMissingCategoryIds: [] } as const
const resultBefore = { id: "transition", version: 1, components: [], currency: "USD", horizon: source.period, sourceRefs: [evidence], unresolvedConditions: [], restrictions: [], comparisonStatus: "complete", costCoverage: coverage, knownSubtotal: 210000, total: 210000 } as const
const resultAfter = { ...resultBefore, version: 2, knownSubtotal: 250000, total: 250000 } as const
const condition = { id: "minimum", source, fields: ["price"], period: source.period, criterionId: "advantage", choice: { id: "choice-1", alternativeId: "replace", alternativeVersion: 1, basisVersion: 1, criteria: ["advantage"], values: [], evidenceRefs: [evidence], principalRef: "principal", reason: "Original decision", at: "2026-01-01T00:00:00Z", scenario: { baseRef: "renewal", operations: [], assumptions: [] }, result: resultBefore, comparison: comparison("satisfied", 30000), comparisonStatus: "complete", costCoverage: coverage } } as const satisfies MaterialCondition
const change = { source: { ...source, version: 2 }, fields: ["price"], period: source.period, before: [evidence], after: [{ ...evidence, refId: "quote-ref-v2", refDigest: "c".repeat(64), target: { ...evidence.target, version: 2 } }], availability: "available", comparison: { before: comparison("satisfied", 30000), after: comparison("failed", -10000), resultBefore, resultAfter } } as const satisfies MaterialChangeEvent

describe("decision reconsideration", () => {
  test("preserves the original choice and reports the producer's changed comparison", () => {
    const result = classifySfMaterialChange(condition, change)
    expect(result.impact.state).toBe("material")
    expect(result.signal?.before?.comparison.knownDifference).toBe(30000)
    expect(result.signal?.after?.comparison.knownDifference).toBe(-10000)
    expect(result.signal?.originalReason).toBe("Original decision")
    expect(classifySfMaterialChange(condition, change).signal?.correlationKey).toBe(result.signal?.correlationKey)
  })
  test("a conditioned choice becomes material when a missing cost resolves and breaks the criterion", () => {
    const before = { ...comparison("satisfied", 30000), comparisonStatus: "conditioned" as const, completeDifference: null, criterionResults: [{ criterionId: "advantage", state: "unknown" as const, reason: "training missing" }], unresolvedConditions: ["training"] }
    const result = classifySfMaterialChange({ ...condition, choice: { ...condition.choice, comparison: before } }, { ...change, comparison: { ...change.comparison!, before } })
    expect(result.impact.state).toBe("material")
    expect(result.signal?.before?.comparison.comparisonStatus).toBe("conditioned")
    expect(result.signal?.after?.comparison.completeDifference).toBe(-10000)
  })
  test("does not reconsider for an unrelated field or period, and never treats unavailable data as valid", () => {
    expect(classifySfMaterialChange(condition, { ...change, fields: ["description"] }).impact.state).toBe("irrelevant")
    expect(classifySfMaterialChange(condition, { ...change, period: { start: "2028-01-01", end: "2028-12-31" } }).impact.state).toBe("irrelevant")
    const unavailable = classifySfMaterialChange(condition, { ...change, availability: "unavailable" })
    expect(unavailable.impact.state).toBe("unknown")
    expect(unavailable.signal?.after).toBeUndefined()
    expect(unavailable.impact.current).toEqual([])
    expect(classifySfMaterialChange(condition, { ...change, source: { ...change.source, incarnation: "two" }, fields: ["description"] }).impact.reason).toBe("source-replaced")
    expect(classifySfMaterialChange(condition, { ...change, comparison: { ...change.comparison!, before: comparison("satisfied", 31000) } }).impact.state).toBe("unknown")
  })
})
