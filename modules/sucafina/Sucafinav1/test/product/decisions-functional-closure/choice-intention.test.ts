import { expect, test } from "bun:test"
import { createDecisionChoiceIntention, isDecisionChoiceReceipt, isDecisionCriterionReceipt, readDecisionChoiceIntention } from "../../../product/ui/decision-choice.ts"

const context = { scope: '["installation","project","person","case","incarnation"]', caseRef: { id: "case", incarnation: "incarnation", version: 4 } }

function choice() {
  return { caseRef: { ...context.caseRef }, alternativeId: "alternative", alternativeVersion: 2, comparison: { scenarioRefs: ["baseline-result", "alternative-result"], criteria: ["cost"] }, criteria: ["cost"], reason: "Accept the stated missing-cost condition; this is not financial approval." }
}

test("choice replay after reload retains the exact original command bytes and key at a newer case version", () => {
  const payload = choice()
  const intention = createDecisionChoiceIntention("decision-choose", payload, "one-choice-key", context)
  const original = intention.body
  payload.caseRef.version = 8
  payload.criteria.push("new-criterion")
  payload.reason = "Different intention"
  const reopened = readDecisionChoiceIntention(JSON.stringify(intention), { ...context, caseRef: { ...context.caseRef, version: 9 } })
  expect(Object.isFrozen(intention)).toBe(true)
  expect(Object.isFrozen(reopened)).toBe(true)
  expect(reopened.key).toBe("one-choice-key")
  expect(reopened.body).toBe(original)
  expect(JSON.parse(reopened.body)).toEqual(choice())
})

test("retained choice refuses another principal, installation, project, case, incarnation or a future CAS", () => {
  const intention = createDecisionChoiceIntention("decision-choose", choice(), "choice-key", context)
  const raw = JSON.stringify(intention)
  for (const scope of [
    '["installation","project","another-person","case","incarnation"]',
    '["another-installation","project","person","case","incarnation"]',
    '["installation","another-project","person","case","incarnation"]',
  ]) expect(() => readDecisionChoiceIntention(raw, { ...context, scope })).toThrow("invalid-choice-intention")
  expect(() => readDecisionChoiceIntention(raw, { ...context, caseRef: { ...context.caseRef, id: "other-case" } })).toThrow("invalid-choice-case")
  expect(() => readDecisionChoiceIntention(raw, { ...context, caseRef: { ...context.caseRef, incarnation: "replacement" } })).toThrow("invalid-choice-case")
  expect(() => readDecisionChoiceIntention(raw, { ...context, caseRef: { ...context.caseRef, version: 3 } })).toThrow("invalid-choice-case")
})

test("preparation freezes the already chosen operations including explicit zero without fabricating an operation", () => {
  const payload = { caseRef: { ...context.caseRef }, choiceId: "recorded-choice", operations: [{ kind: "replace", targetRef: "real-target", amount: 0, currency: "USD", period: { start: "2027-01-01", end: "2027-12-31" } }] }
  const intention = createDecisionChoiceIntention("decision-prepare-changes", payload, "preparation-key", context)
  payload.operations[0]!.amount = 750
  const reopened = readDecisionChoiceIntention(JSON.stringify(intention), { ...context, caseRef: { ...context.caseRef, version: 7 } })
  expect(JSON.parse(reopened.body).operations).toEqual([{ kind: "replace", targetRef: "real-target", amount: 0, currency: "USD", period: { start: "2027-01-01", end: "2027-12-31" } }])
  expect(reopened.action).toBe("decision-prepare-changes")
  expect(reopened.key).toBe("preparation-key")
  expect(() => createDecisionChoiceIntention("decision-prepare-changes", { ...payload, operations: [] }, "empty", context)).toThrow("invalid-choice-payload")
})

test("malformed or oversized retained commands cannot introduce authority or be silently rewritten", () => {
  expect(() => createDecisionChoiceIntention("decision-choose", { ...choice(), principalRef: "admin" }, "key", context)).toThrow("invalid-choice-payload")
  expect(() => createDecisionChoiceIntention("decision-choose", { ...choice(), reason: "" }, "key", context)).toThrow("invalid-choice-payload")
  expect(() => createDecisionChoiceIntention("decision-choose", choice(), " ", context)).toThrow("invalid-choice-intention")
  expect(() => createDecisionChoiceIntention("decision-choose", { ...choice(), reason: "é".repeat(132000) }, "key", context)).toThrow("invalid-choice-intention")
  expect(() => readDecisionChoiceIntention(JSON.stringify({ scope: context.scope, action: "decision-apply", key: "key", body: JSON.stringify(choice()) }), context)).toThrow("invalid-choice-intention")
})

test("explicit comparison rule keeps its own CAS and zero limit while rejecting absent values or invented sensitivity", () => {
  const payload = { caseRef: { ...context.caseRef }, criterionId: "cost", metricRef: "planner:known-subtotal-difference", operator: "lte", value: 0, unit: "USD", period: { start: "2027-01-01", end: "2027-12-31" }, evidenceRefs: [{ refId: "authorized-current-comparison-source", refDigest: "a".repeat(64) }], expectedRuleVersion: 3 }
  const intention = createDecisionChoiceIntention("decision-criteria", payload, "human-rule-key", context)
  payload.value = 2000
  payload.expectedRuleVersion = 4
  const reopened = readDecisionChoiceIntention(JSON.stringify(intention), { ...context, caseRef: { ...context.caseRef, version: 8 } })
  expect(reopened.body).toBe(intention.body)
  expect(reopened.key).toBe("human-rule-key")
  expect(JSON.parse(reopened.body)).toMatchObject({ value: 0, expectedRuleVersion: 3, caseRef: context.caseRef })
  expect(() => createDecisionChoiceIntention("decision-criteria", { ...payload, value: undefined }, "absent", context)).toThrow("invalid-choice-payload")
  expect(() => createDecisionChoiceIntention("decision-criteria", { ...payload, value: null }, "null", context)).toThrow("invalid-choice-payload")
  expect(() => createDecisionChoiceIntention("decision-criteria", { ...payload, sensitivity: { parameterRef: "invented" } }, "parameter", context)).toThrow("invalid-choice-payload")
  expect(() => createDecisionChoiceIntention("decision-criteria", { ...payload, evidenceRefs: [] }, "empty-evidence", context)).toThrow("invalid-choice-payload")
})

test("numeric rule receipt confirms the next rule revision without assuming the case advanced", () => {
  expect(isDecisionCriterionReceipt({ ruleRef: "canonical-rule", version: 4 }, 3)).toBe(true)
  expect(isDecisionCriterionReceipt({ ruleRef: "canonical-rule", version: 3 }, 3)).toBe(false)
  expect(isDecisionCriterionReceipt({ ruleRef: "canonical-rule", version: 5 }, 3)).toBe(false)
  expect(isDecisionCriterionReceipt({ ruleRef: "", version: 4 }, 3)).toBe(false)
  expect(isDecisionCriterionReceipt({ caseRef: { ...context.caseRef, version: 5 } }, 3)).toBe(false)
})

test("canonical replay receipt confirms only the original identity and a committed revision after the frozen CAS", () => {
  const expected = context.caseRef
  // The page may now be v9; a real replay still returns the original committed v5.
  expect(isDecisionChoiceReceipt({ caseRef: { ...expected, version: 5 } }, expected)).toBe(true)
  expect(isDecisionChoiceReceipt({ caseRef: { ...expected, version: 4 } }, expected)).toBe(false)
  expect(isDecisionChoiceReceipt({ caseRef: { ...expected, version: 6 } }, expected)).toBe(false)
  expect(isDecisionChoiceReceipt({ caseRef: { ...expected, version: 5, id: "other" } }, expected)).toBe(false)
  expect(isDecisionChoiceReceipt({ caseRef: { ...expected, version: 5, incarnation: "replacement" } }, expected)).toBe(false)
  expect(isDecisionChoiceReceipt({ caseRef: { ...expected, version: 5.5 } }, expected)).toBe(false)
  expect(isDecisionChoiceReceipt({ caseRef: { ...expected, version: Number.MAX_SAFE_INTEGER + 1 } }, expected)).toBe(false)
  expect(isDecisionChoiceReceipt(undefined, expected)).toBe(false)
})
