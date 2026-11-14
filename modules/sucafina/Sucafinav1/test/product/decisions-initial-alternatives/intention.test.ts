import { expect, test } from "bun:test"
import { createDecisionIntention } from "../../../product/ui/decision-alternatives.ts"

test("an uncertain promotion retains its original key, case version and nested payload bytes", () => {
  const request = {
    caseRef: { id: "case-one", incarnation: "incarnation-one", version: 7 },
    title: "Keep the reviewed scenario",
    scenario: { baseRef: "authorized-planner-version", operations: [], assumptions: [] as string[] },
    coverageRef: "authorized-cost-inventory",
  }
  const intention = createDecisionIntention("decision-promote", request, "human-intention-one")
  const originalBody = intention.body

  request.caseRef.version = 8
  request.title = "A different intention"
  request.scenario.baseRef = "replacement-planner-version"
  request.scenario.assumptions.push("a later assumption")
  request.coverageRef = "replacement-cost-inventory"

  expect(Object.isFrozen(intention)).toBe(true)
  expect(Reflect.set(intention, "key", "replacement-key")).toBe(false)
  expect(Reflect.set(intention, "body", "{}")).toBe(false)
  expect(intention.action).toBe("decision-promote")
  expect(intention.key).toBe("human-intention-one")
  expect(intention.body).toBe(originalBody)
  expect(JSON.parse(intention.body)).toEqual({
    caseRef: { id: "case-one", incarnation: "incarnation-one", version: 7 },
    title: "Keep the reviewed scenario",
    scenario: { baseRef: "authorized-planner-version", operations: [], assumptions: [] },
    coverageRef: "authorized-cost-inventory",
  })
})

test("transport serialization preserves null, confirmed zero, units and an omitted value separately", () => {
  const intention = createDecisionIntention("decision-coverage", {
    caseRef: { id: "case-one", incarnation: "incarnation-one", version: 7 },
    observations: [
      { value: null, unit: "USD", period: { start: "2027-01-01", end: "2027-12-31" } },
      { value: 0, unit: "USD", period: { start: "2027-01-01", end: "2027-12-31" } },
      { unit: "hours", period: { start: "2027-02-01", end: "2027-02-28" } },
    ],
  }, "coverage-intention")
  // This tests transport fidelity; the domain still owns admission of the payload schema.
  expect(JSON.parse(intention.body)).toEqual({
    caseRef: { id: "case-one", incarnation: "incarnation-one", version: 7 },
    observations: [
      { value: null, unit: "USD", period: { start: "2027-01-01", end: "2027-12-31" } },
      { value: 0, unit: "USD", period: { start: "2027-01-01", end: "2027-12-31" } },
      { unit: "hours", period: { start: "2027-02-01", end: "2027-02-28" } },
    ],
  })
  expect(intention.body).not.toContain("principalRef")
  expect(intention.body).not.toContain("idempotencyKey")
})

test("intention admission rejects other actions and missing or oversized keys", () => {
  expect(() => Reflect.apply(createDecisionIntention, undefined, ["decision-apply", {}, "intent"])).toThrow()
  expect(() => Reflect.apply(createDecisionIntention, undefined, ["decision-promote", {}, ""])).toThrow()
  expect(() => Reflect.apply(createDecisionIntention, undefined, ["decision-edit", {}, " \n "])).toThrow()
  expect(() => createDecisionIntention("decision-coverage", {}, "a".repeat(129))).toThrow()
})

test("unserializable and oversized intentions fail before a request can be retained", () => {
  const circular: { child?: object } = {}
  circular.child = circular
  expect(() => createDecisionIntention("decision-edit", circular, "intent")).toThrow()
  expect(() => createDecisionIntention("decision-promote", { title: "a".repeat(262144) }, "intent")).toThrow()
})

test("the request budget counts UTF-8 bytes rather than string characters", () => {
  expect(() => createDecisionIntention("decision-edit", { title: "€".repeat(90000) }, "intent")).toThrow("invalid-decision-payload")
  const ascii = createDecisionIntention("decision-edit", { title: "a".repeat(90000) }, "intent")
  expect(JSON.parse(ascii.body).title).toHaveLength(90000)
})
