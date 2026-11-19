import { expect, test } from "bun:test"
import { SfNativeOperationBindings } from "../../src/sucafina/bindings"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"

// Codec/route proof only. The installed producer owns C08 and comparison arithmetic.
const codec = SfNativeOperationBindings["decisions.decision-compare"]!
const input = {
  caseRef: { id: "case-one", incarnation: "case-incarnation", version: 4 },
  baselineAlternativeId: "baseline", alternativeId: "candidate", criteria: ["criterion-one"],
}
const comparison = {
  baselineResultRef: "result-baseline", alternativeResultRef: "result-candidate",
  costCoverageRefs: ["coverage-baseline", "coverage-candidate"], criterionResults: [],
  unresolvedConditions: ["cost-coverage-pending"], comparisonStatus: "conditioned",
  knownDifference: 1200, completeDifference: null,
}
const output = { status: "ok", value: {
  request: { scenarioRefs: ["result-baseline", "result-candidate"], criteria: input.criteria },
  comparison,
} }

test("selected case comparison uses the original read-only POST and preserves conditioned values", () => {
  expect(SfOperationRegistry["decisions.decision-compare"]).toEqual({
    method: "POST", pathTemplate: "{mount}/dashboard", effect: "read", responseMode: "json",
    fixedQuery: { sf: "decision-compare" }, maxRequestBytes: 262144,
  })
  expect(codec.decodeInput(input)).toEqual({ status: "ok", value: input })
  expect(codec.decodeOutput(output)).toEqual({ status: "ok", value: output })
  expect(codec.decodeOutput({ ...output, value: { ...output.value, comparison: { ...comparison, completeDifference: 1200 } } }))
    .toEqual({ status: "invalid" })
})

test("comparison rejects injected authority, alternate routing and absent CAS", () => {
  for (const extra of [{ principalRef: "claimed-owner" }, { surface: "procurement" }, { purpose: "compare" }])
    expect(codec.decodeInput({ ...input, ...extra })).toEqual({ status: "invalid" })
  expect(codec.decodeInput({ ...input, caseRef: { id: "case-one", incarnation: "case-incarnation" } })).toEqual({ status: "invalid" })
  expect(codec.decodeInput({ ...input, criteria: [] })).toEqual({ status: "invalid" })
  expect(codec.decodeInput({ ...input, criteria: [""] })).toEqual({ status: "invalid" })
  expect(codec.decodeOutput({ ...output, value: { ...output.value, approved: true } })).toEqual({ status: "invalid" })
})

test("comparison preserves original refusal and source-change results", () => {
  for (const result of [
    { status: "denied", reason: "comparison-access-unavailable" },
    { status: "stale", reason: "comparison-source-changed" },
    { status: "conflict", reason: "comparison-reference-mismatch" },
  ]) expect(codec.decodeOutput(result)).toEqual({ status: "ok", value: result })
})
