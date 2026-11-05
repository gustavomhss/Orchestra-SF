import { expect, test } from "bun:test"
import { ReviewRouting } from "@orchestra/core/review/routing"
import { ReviewCardV2 } from "../src/v2/workflow/review-card"

const routing: ReviewRouting.Record = {
  version: "route-v1", catalog: "a".repeat(64),
  profile: { id: "pr", source: "request" }, tier: { id: "standard", source: "risk", signals: [] },
  overlays: [{ id: "docs", source: "path", signal: "docs/a.md" }], languages: [], lenses: [], packs: [],
  budget: { lensChildren: 1, samples: 1, verifiers: 1, itemsPerLens: 1, loadsPerSession: 1,
    candidatesPerChild: 1, candidatesPerVerifier: 1, toolCallsPerSession: 1, probeAttempts: 1 },
  deviations: [],
}
const scope = { base: "base", head: "head", files: 1, changedLines: 2 }
const finding = {
  id: "C1", path: "src/a.ts", line: 2, severity: "P1", confidence: "high", lens: "correctness-logic",
  class: "logic.invariant", node: "lucy-lens-correctness-logic", rule: "invariant", trigger: "bad input",
  rungs: ["quote"], evidence: { kind: "quote", path: "src/a.ts", startLine: 2, endLine: 2 }, status: "open",
} as const
const confirmed = [{ id: finding.id, path: finding.path, line: finding.line, severity: finding.severity,
  class: finding.class, node: finding.node, rungs: finding.rungs, evidence: finding.evidence }]
const card = {
  outcome: "done", verdict: "FIX_FIRST", profile: "pr", tier: "standard", overlays: ["docs"], routing, scope,
  findings: [finding], questions: [], checks: [], coverage: { examined: [], notExamined: [] },
  handoffs: [], blockers: [], risks: [], nextActions: [],
}
const reply = (value: unknown) => `\`\`\`review-result\n${JSON.stringify(value)}\n\`\`\``
const expected = { routing, scope, confirmed }
const invalid = (value: unknown, reason: string, wanted = expected) =>
  expect(() => ReviewCardV2.validate(reply(value), wanted)).toThrow(reason)

test("accepts Quick quote evidence without a host confirmed list", () => {
  const quick = { ...routing, tier: { ...routing.tier, id: "quick" } }
  const value = { ...card, routing: quick, tier: "quick" }
  expect(ReviewCardV2.validate(reply(value), { routing: quick, scope })).toEqual(value)
  invalid({ ...value, findings: [{ ...finding, severity: "P2" }] }, "unverified-finding", { routing: quick, scope, confirmed: [] })
  expect(() => ReviewCardV2.validate(reply({ ...value, findings: [{ ...finding, evidence: { ...finding.evidence, startLine: 3 } }] }), { routing: quick, scope })).toThrow("unverified-finding")
})

test("accepts a Standard finding bound to the host's confirmed record", () => {
  expect(ReviewCardV2.validate(reply(card), expected)).toEqual(card)
})

test("accepts an empty APPROVE and does not promote questions to findings", () => {
  const value = { ...card, verdict: "APPROVE", findings: [], questions: [{ question: "Unverified?", severity: "P1" }] }
  expect(ReviewCardV2.validate(reply(value), expected)).toEqual(value)
})

test("blocked requires a blocker and cannot have a verdict", () => {
  const value = { ...card, outcome: "blocked", verdict: undefined, findings: [], blockers: [{ kind: "entry", reason: "unavailable" }] }
  expect(ReviewCardV2.validate(reply(value), expected).outcome).toBe("blocked")
  invalid({ ...value, blockers: [] }, "verdict-mismatch")
  invalid({ ...value, verdict: "APPROVE" }, "malformed-card")
})

test("rejects malformed and duplicated result blocks", () => {
  expect(() => ReviewCardV2.validate("```review-result\n{\n```", expected)).toThrow("malformed-card")
  expect(() => ReviewCardV2.validate(`${reply(card)}\n${reply(card)}`, expected)).toThrow("malformed-card")
  invalid({ ...card, findings: [{ ...finding, evidence: undefined }] }, "malformed-card")
})

test("rejects routing, profile, tier, overlay, catalog and scope mismatches", () => {
  for (const value of [
    { ...card, profile: "code" }, { ...card, tier: "quick" }, { ...card, overlays: [] },
    { ...card, routing: { ...routing, catalog: "b".repeat(64) } },
    { ...card, routing: { ...routing, deviations: [{ kind: "changed", stage: "finish", detail: "x" }] } },
  ]) invalid(value, "routing-mismatch")
  invalid({ ...card, scope: { ...scope, head: "other" } }, "scope-mismatch")
})

test("rejects an invented finding and fabricated evidence even with a valid id", () => {
  for (const changed of [
    { ...finding, id: "C2" }, { ...finding, evidence: { ...finding.evidence, endLine: 3 } },
    { ...finding, path: "src/b.ts" }, { ...finding, rungs: ["quote", "probe:test"] },
  ]) invalid({ ...card, findings: [changed] }, "unverified-finding")
  invalid(card, "unverified-finding", { ...expected, confirmed: [] })
})

test("APPROVE cannot carry an open blocking finding", () => {
  invalid({ ...card, verdict: "APPROVE" }, "verdict-mismatch")
})
