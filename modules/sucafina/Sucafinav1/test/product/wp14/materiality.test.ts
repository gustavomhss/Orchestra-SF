import { describe, expect, test } from "bun:test"
import { classifySfMaterialChange, sfReconsiderationFingerprint } from "../../../product/decision-memory/materiality.ts"
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
  test("re-reading the same material event does not reopen a signal", () => {
    const withComponent = { ...change, comparison: { ...change.comparison, resultAfter: { ...resultAfter, components: [{ id: "cost", amount: 250000, currency: "USD", period: source.period, evidenceState: "confirmed" as const, sourceRefs: [change.source] }] } } }
    const first = classifySfMaterialChange(condition, withComponent)
    const refreshed = classifySfMaterialChange(condition, { ...withComponent, source: { ...change.source, observedAt: "2026-11-14T12:00:00Z" }, comparison: { ...withComponent.comparison, resultAfter: { ...withComponent.comparison.resultAfter, components: withComponent.comparison.resultAfter.components.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map((ref) => ({ ...ref, observedAt: "2026-11-14T12:00:00Z" })) })) } } })
    expect(first.impact.state).toBe("material")
    expect(refreshed.signal?.correlationKey).toBe(first.signal?.correlationKey)
    expect(refreshed.impact.changeDigest).toBe(first.impact.changeDigest)
    if (!first.signal || !refreshed.signal) throw new Error("material change must produce a signal")
    expect(sfReconsiderationFingerprint(refreshed.signal, refreshed.impact)).toBe(sfReconsiderationFingerprint(first.signal, first.impact))
    const changed = classifySfMaterialChange(condition, { ...withComponent, source: { ...change.source, version: 3, observedAt: "2026-11-14T12:00:00Z" } })
    expect(changed.signal?.correlationKey).not.toBe(first.signal?.correlationKey)
    if (!changed.signal) throw new Error("new source version must remain material")
    expect(sfReconsiderationFingerprint(changed.signal, changed.impact)).not.toBe(sfReconsiderationFingerprint(first.signal, first.impact))
  })
  test("a conditioned choice becomes material when a missing cost resolves and breaks the criterion", () => {
    const before = { ...comparison("satisfied", 30000), comparisonStatus: "conditioned" as const, completeDifference: null, criterionResults: [{ criterionId: "advantage", state: "unknown" as const, reason: "training missing" }], unresolvedConditions: ["training"] }
    const result = classifySfMaterialChange({ ...condition, choice: { ...condition.choice, comparison: before } }, { ...change, comparison: { ...change.comparison!, before } })
    expect(result.impact.state).toBe("material")
    expect(result.signal?.before?.comparison.comparisonStatus).toBe("conditioned")
    expect(result.signal?.after?.comparison.completeDifference).toBe(-10000)
  })
  test("coverage resolution names its supported category and component", () => {
    const pending = { ...coverage, coverageState: "pending" as const, entries: [{ status: "pending" as const, categoryId: "training", reason: "unknown" }], derivedMissingCategoryIds: ["training"] }
    const complete = { ...coverage, entries: [{ status: "included" as const, categoryId: "training", componentRefs: ["training-cost"], evidenceRefs: [evidence], scopeNote: "training" }] }
    const prior = { ...resultBefore, comparisonStatus: "conditioned" as const, total: null, costCoverage: pending }
    const before = { ...comparison("satisfied", 30000), comparisonStatus: "conditioned" as const, completeDifference: null, criterionResults: [{ criterionId: "advantage", state: "unknown" as const, reason: "training pending" }] }
    const input = { ...condition, choice: { ...condition.choice, comparisonStatus: "conditioned" as const, costCoverage: pending, result: prior, comparison: before } }
    const next = { ...change, comparison: { ...change.comparison, before, resultBefore: prior, resultAfter: { ...resultAfter, costCoverage: complete } } }
    const result = classifySfMaterialChange(input, next)
    expect(result.impact.state).toBe("material")
    expect(result.signal?.reason).toContain("training:pending->included")
    expect(result.signal?.reason).toContain("training-cost")
    const notApplicable = { ...complete, entries: [{ status: "not-applicable" as const, categoryId: "training", justification: "not required", evidenceRefs: [evidence] }] }
    const resolved = classifySfMaterialChange(input, { ...next, comparison: { ...next.comparison, resultAfter: { ...next.comparison.resultAfter, costCoverage: notApplicable } } })
    expect(resolved.impact.state).toBe("material")
    expect(resolved.signal?.reason).toContain("training:pending->not-applicable")
    expect(input.choice.reason).toBe("Original decision")
    const unsupported = { ...complete, entries: [{ ...complete.entries[0]!, evidenceRefs: [] }] }
    expect(classifySfMaterialChange(input, { ...next, comparison: { ...next.comparison, resultAfter: { ...next.comparison.resultAfter, costCoverage: unsupported } } }).impact.state).toBe("unknown")
  })
  test("coverage order is not material and duplicate categories are unavailable", () => {
    const entries = [{ status: "included" as const, categoryId: "a", componentRefs: ["a"], evidenceRefs: [evidence], scopeNote: "included" }, { status: "included" as const, categoryId: "b", componentRefs: ["b"], evidenceRefs: [evidence], scopeNote: "included" }]
    const before = { ...resultBefore, costCoverage: { ...coverage, entries } }
    const scope = { ...condition, choice: { ...condition.choice, result: before } }
    const event = { ...change, comparison: { ...change.comparison, after: condition.choice.comparison, resultBefore: before, resultAfter: { ...before, version: 2, costCoverage: { ...coverage, entries: [...entries].reverse() } } } }
    expect(classifySfMaterialChange(scope, event).impact.state).toBe("irrelevant")
    expect(classifySfMaterialChange(scope, { ...event, comparison: { ...event.comparison, resultAfter: { ...before, costCoverage: { ...coverage, entries: [entries[0]!, entries[0]!] } } } }).impact.state).toBe("unknown")
  })
  test("refuses a mismatched saved baseline and ignores result metadata alone", () => {
    expect(classifySfMaterialChange(condition, { ...change, comparison: { ...change.comparison!, resultBefore: { ...resultBefore, knownSubtotal: 1, total: 1 } } }).impact.state).toBe("unknown")
    expect(classifySfMaterialChange(condition, { ...change, comparison: { ...change.comparison!, after: { ...condition.choice.comparison, baselineResultRef: "new-metadata", criterionResults: [{ ...condition.choice.comparison.criterionResults[0], reason: "unchanged criterion" }] }, resultAfter: { ...resultBefore, version: 2 } } }).impact.state).toBe("irrelevant")
    expect(classifySfMaterialChange(condition, { ...change, comparison: { ...change.comparison!, after: condition.choice.comparison } }).impact.state).toBe("material")
  })
  test("a relevant deadline change has its own reason", () => {
    const unchanged = { ...change, fields: ["deadline"], comparison: { ...change.comparison, after: condition.choice.comparison, resultAfter: { ...resultBefore, version: 2 } } }
    const result = classifySfMaterialChange({ ...condition, fields: ["deadline"] }, unchanged)
    expect(result.impact.state).toBe("material")
    expect(result.signal?.reason).toBe("deadline-changed")
    expect(classifySfMaterialChange({ ...condition, fields: ["deadline"] }, { ...unchanged, source }).impact.state).toBe("irrelevant")
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

test("materiality access rechecks evidence and refuses a revoked result", async () => {
  const { createSfMaterialityAccess } = await import("../../../product/decision-memory/materiality.ts")
  const call: import("../../../product/contracts/sf-execution.ts").TrustedDomainContext = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "1", policyVersion: "1", requestId: "r", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as import("../../../product/contracts/sf-execution.ts").TrustedUiLease }
  const access = { allowed: true, checks: 0 }
  const read = createSfMaterialityAccess({ load: async () => ({ condition, change }), authorizeEvidence: async () => { access.checks += 1; return access.allowed && access.checks < 4 }, revalidate: async () => access.allowed })
  const first = await read(condition.id, call)
  expect(first.status).toBe("ok")
  if (first.status === "ok") expect(first.signal?.reason).toContain("advantage")
  expect(await read(condition.id, call)).toEqual({ status: "unavailable" })
  access.allowed = false
  expect(await read(condition.id, call)).toEqual({ status: "unavailable" })
})

test("materiality access distinguishes an advancing observation clock from a mutable financial result", async () => {
  const { createSfMaterialityAccess } = await import("../../../product/decision-memory/materiality.ts")
  const call: import("../../../product/contracts/sf-execution.ts").TrustedDomainContext = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "1", policyVersion: "1", requestId: "r", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as import("../../../product/contracts/sf-execution.ts").TrustedUiLease }
  const shared: { condition: MaterialCondition; change: MaterialChangeEvent } = structuredClone({ condition, change })
  let reads = 0
  const read = createSfMaterialityAccess({ load: async () => { reads += 1; shared.change.source.observedAt = new Date(Date.UTC(2026, 10, 14, 12, 0, reads)).toISOString(); return shared }, authorizeEvidence: async () => true, revalidate: async () => true })
  expect((await read(condition.id, call)).status).toBe("ok")
  reads = 0
  const mutating = createSfMaterialityAccess({ load: async () => { reads += 1; if (reads > 1) shared.change.comparison!.resultAfter.knownSubtotal = 999999; return shared }, authorizeEvidence: async () => true, revalidate: async () => true })
  expect(await mutating(condition.id, call)).toEqual({ status: "unavailable" })
  const rewind = { reads: 0 }
  const stale = createSfMaterialityAccess({ load: async () => {
    rewind.reads += 1
    return { condition, change: { ...change, source: { ...change.source, observedAt: rewind.reads === 1 ? "2026-11-14T12:00:01Z" : "2026-11-14T12:00:00Z" } } }
  }, authorizeEvidence: async () => true, revalidate: async () => true })
  expect(await stale(condition.id, call)).toEqual({ status: "unavailable" })
  const malformed = createSfMaterialityAccess({ load: async () => ({ condition, change: { ...change, source: { ...change.source, observedAt: "2026-02-30T12:00:00Z" } } }), authorizeEvidence: async () => true, revalidate: async () => true })
  expect(await malformed(condition.id, call)).toEqual({ status: "unavailable" })
})
