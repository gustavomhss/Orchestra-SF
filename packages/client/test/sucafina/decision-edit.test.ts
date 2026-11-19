import { expect, test } from "bun:test"
import { SfNativeOperationBindings } from "../../src/sucafina/bindings"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"

const codec = SfNativeOperationBindings["decisions.decision-edit"]!
const input = {
  caseRef: { id: "case-one", incarnation: "case-incarnation", version: 3 },
  objective: "Inspect the existing Planner source before attaching it",
  criteria: [{ id: "criterion-one", description: "Explicit human criterion", required: true }],
  sourceRefs: [],
}

test("case edit uses the original human route and returns the exact committed CAS", () => {
  expect(SfOperationRegistry["decisions.decision-edit"]).toEqual({
    method: "POST", pathTemplate: "{mount}/dashboard", effect: "mutation", responseMode: "json",
    fixedQuery: { sf: "decision-edit" }, maxRequestBytes: 262144,
  })
  expect(codec.decodeInput(input)).toEqual({ status: "ok", value: input })
  const result = { status: "ok", value: { caseRef: { ...input.caseRef, version: 4 } } }
  expect(codec.decodeOutput(result)).toEqual({ status: "ok", value: result })
  expect(codec.decodeOutput({ status: "ok", value: { ...result.value, approved: true } })).toEqual({ status: "invalid" })
})

test("case edit rejects extra authority, missing CAS and incomplete criteria", () => {
  expect(codec.decodeInput({ ...input, principalRef: "claimed-owner" })).toEqual({ status: "invalid" })
  expect(codec.decodeInput({ ...input, caseRef: { id: "case-one", version: 3 } })).toEqual({ status: "invalid" })
  expect(codec.decodeInput({ ...input, criteria: [] })).toEqual({ status: "invalid" })
  expect(codec.decodeInput({ ...input, criteria: [{ id: "criterion-one", description: "Missing required flag" }] })).toEqual({ status: "invalid" })
  expect(codec.decodeInput({ ...input, currency: "usd" })).toEqual({ status: "invalid" })
  expect(codec.decodeInput({ ...input, assumptions: [{ id: "a", text: "A claim", state: "approved", evidenceRefs: [] }] })).toEqual({ status: "invalid" })
})

test("case edit preserves denial and stale outcomes instead of inventing a receipt", () => {
  for (const result of [
    { status: "denied", reason: "human-edit-required" },
    { status: "stale", reason: "case-changed" },
    { status: "conflict", reason: "idempotency-content-changed" },
  ]) expect(codec.decodeOutput(result)).toEqual({ status: "ok", value: result })
})
