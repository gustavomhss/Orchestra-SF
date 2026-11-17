import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import {
  SfMemory,
  SfIntelligenceMemoryCatalog,
  SfIntelligenceMemoryCondition,
  SfIntelligenceMemoryConditions,
  SfIntelligenceMemoryMateriality,
  SfIntelligenceMemoryOutcome,
  SfIntelligenceMemoryOutcomeSelection,
  SfIntelligenceMemorySignals,
} from "../../../../../packages/schema/src/sucafina/memory.ts"

// Effect 4 Decoder<A, RD> retains decoding-service requirements; RD=never is enforced.
const decode = <A>(schema: Schema.Decoder<A, never>, value: unknown): A =>
  Schema.decodeUnknownSync(schema)(value)

// For a schema whose public type erases its service requirements, validate the
// *decoded type* (not the encoded wire). toType removes decoder effects without
// an unsafe cast; never claim this verifies its context-dependent wire decoder.
const validateDecoded = <S extends Schema.Top>(schema: S, value: unknown): S["Type"] =>
  Schema.decodeUnknownSync(Schema.toType(schema), { onExcessProperty: "error" })(value)

const query = { caseId: "case-1", incarnation: "inc-1", version: 3 }
const period = { start: "2026-01-01", end: "2026-12-31" } as const
const digest = "a".repeat(64)
const source = {
  surface: "planner", type: "planner-version", id: "version-1",
  incarnation: "inc-1", version: 2, fields: ["amount"], period,
  observedAt: "2026-11-15T00:00:00.000Z",
} as const
const evidence = {
  schema: "sf-evidence-v1", kind: "record", refId: "evidence-1",
  installationId: "installation-1", projectId: "project-1",
  refDigest: digest, evidenceLevel: "observed",
  target: {
    surface: "planner", recordType: "planner-version", recordId: "version-1",
    incarnation: "inc-1", version: 2, fields: ["amount"], period,
    projectionDigest: digest,
  },
} as const
const condition = {
  caseRef: { id: "case-1", incarnation: "inc-1", version: 3 },
  choiceId: "choice-1", scenarioRefs: ["base-1", "alternative-1"],
  source, evidence, fields: ["amount"], period,
  criterionId: "criterion-1", recipientRef: "principal-1",
  destination: "decision-review", label: "Review cost",
} as const
const outcome = {
  caseRef: condition.caseRef, choiceId: "choice-1",
  criterionRef: "criterion-1", valueId: "cost-total", period,
  evidenceRefs: [evidence],
} as const

describe("A14: closed memory operation catalog", () => {
  test("the exact seven operation IDs and their schema exports stay stable", () => {
    expect(Object.keys(SfMemory.operations)).toEqual([
      "intelligence.memory-catalog",
      "intelligence.memory-conditions",
      "intelligence.memory-signals",
      "intelligence.memory-materiality",
      "intelligence.memory-outcome",
      "intelligence.memory-condition",
      "intelligence.memory-outcome-selection",
    ])
    expect(SfMemory.operations["intelligence.memory-catalog"]).toBe(SfIntelligenceMemoryCatalog)
    expect(SfMemory.operations["intelligence.memory-conditions"]).toBe(SfIntelligenceMemoryConditions)
    expect(SfMemory.operations["intelligence.memory-signals"]).toBe(SfIntelligenceMemorySignals)
    expect(SfMemory.operations["intelligence.memory-materiality"]).toBe(SfIntelligenceMemoryMateriality)
    expect(SfMemory.operations["intelligence.memory-outcome"]).toBe(SfIntelligenceMemoryOutcome)
    expect(SfMemory.operations["intelligence.memory-condition"]).toBe(SfIntelligenceMemoryCondition)
    expect(SfMemory.operations["intelligence.memory-outcome-selection"]).toBe(SfIntelligenceMemoryOutcomeSelection)
  })

  test("catalog has no invented memories, cases or privileged snapshots", () => {
    expect(decode(SfIntelligenceMemoryCatalog.input, undefined)).toBeUndefined()
    expect(decode(SfIntelligenceMemoryCatalog.output, {
      status: "ok", value: ["planner-closed-month-outcomes"],
    })).toEqual({ status: "ok", value: ["planner-closed-month-outcomes"] })
    expect(() => decode(SfIntelligenceMemoryCatalog.output, {
      status: "ok", value: ["unapproved-memory-engine"],
    })).toThrow()
    expect(() => decode(SfIntelligenceMemoryCatalog.output, {
      status: "ok", value: ["planner-closed-month-outcomes"], snapshots: [],
    })).toThrow()
  })

  test("case reads preserve explicit version and reject unrecognized selectors", () => {
    expect(decode(SfIntelligenceMemoryConditions.input, query)).toEqual(query)
    expect(() => decode(SfIntelligenceMemoryConditions.input, { ...query, version: 0 })).toThrow()
    expect(() => decode(SfIntelligenceMemoryConditions.input, { ...query, version: 1.5 })).toThrow()
    expect(() => decode(SfIntelligenceMemoryConditions.input, { ...query, installationId: "other" })).toThrow()
    expect(() => decode(SfIntelligenceMemoryConditions.input, { ...query, caseId: " " })).toThrow()
    expect(decode(SfIntelligenceMemoryMateriality.input, { ...query, conditionId: "condition-1" })).toEqual({
      ...query, conditionId: "condition-1",
    })
    expect(decode(SfIntelligenceMemoryOutcome.input, { ...query, choiceId: "choice-1" })).toEqual({
      ...query, choiceId: "choice-1",
    })
  })

  test("condition and outcome mutations accept only the existing human selection wire", () => {
    expect(decode(SfIntelligenceMemoryCondition.input, condition)).toEqual(condition)
    expect(decode(SfIntelligenceMemoryOutcomeSelection.input, outcome)).toEqual(outcome)
    expect(() => decode(SfIntelligenceMemoryCondition.input, { ...condition, action: "reconcile" })).toThrow()
    expect(() => decode(SfIntelligenceMemoryCondition.input, { ...condition, source: { ...source, surface: "procurement" } })).toThrow()
    expect(() => decode(SfIntelligenceMemoryCondition.input, { ...condition, evidence: { ...evidence, evidenceLevel: "claim" } })).toThrow()
    expect(() => decode(SfIntelligenceMemoryCondition.input, { ...condition, caseRef: { ...condition.caseRef, version: 0 } })).toThrow()
    expect(() => decode(SfIntelligenceMemoryOutcomeSelection.input, { ...outcome, evidenceRefs: [] })).toThrow()
    expect(() => decode(SfIntelligenceMemoryOutcomeSelection.input, { ...outcome, actor: "admin" })).toThrow()
    // A valid wire shape does not establish digest equality or live access;
    // only the original producer can accept the evidence and selection.
  })

  test("conditions and signals never substitute denial/unavailable with an empty list", () => {
    const one = { status: "ok", value: [
      { conditionId: "condition-1", revision: 2, choiceId: "choice-1",
        criterionId: "criterion-1", label: "Review", period },
    ] } as const
    expect(decode(SfIntelligenceMemoryConditions.output, one)).toEqual(one)
    expect(validateDecoded(SfIntelligenceMemorySignals.output, { status: "unavailable" })).toEqual({ status: "unavailable" })
    expect(validateDecoded(SfIntelligenceMemorySignals.output, { status: "denied", reason: "memory-authority-unavailable" })).toEqual({
      status: "denied", reason: "memory-authority-unavailable",
    })
    expect(() => validateDecoded(SfIntelligenceMemorySignals.output, {
      status: "ok", signals: [{ action: "auto-approve", label: "Review", impact: {} }],
    })).toThrow()
    expect(() => decode(SfIntelligenceMemoryConditions.output, {
      status: "ok", value: [], sourceVersions: { case: 1 },
    })).toThrow()
  })

  test("observed outcomes keep zero, versioned source refs and absence separate", () => {
    const comparison = {
      status: "comparable",
      caseRef: condition.caseRef, choiceId: "choice-1", criterionRef: "criterion-1",
      unit: "BRL", currency: "BRL", period,
      expected: 0, observed: 0, delta: 0,
      compatibility: { metric: true, unit: true, period: true, currency: true, coverage: "complete", compatible: true },
      summary: { facts: [], pending: ["No causality established"], causality: "not-attributed" },
      cutoff: "2026-11-15T00:00:00.000Z",
      sourceRefs: [evidence], baselineRefs: [evidence], limitations: [],
      observation: { caseRef: condition.caseRef, expected: 0, observed: 0, cutoff: "2026-11-15T00:00:00.000Z", currency: "BRL", sourceRefs: [evidence], limitations: [] },
    } as const
    expect(validateDecoded(SfIntelligenceMemoryOutcome.output, comparison)).toEqual(comparison)
    expect(validateDecoded(SfIntelligenceMemoryOutcome.output, { status: "unavailable" })).toEqual({ status: "unavailable" })
    expect(() => validateDecoded(SfIntelligenceMemoryOutcome.output, {
      ...comparison, summary: { ...comparison.summary, causality: "verified-by-ai" },
    })).toThrow()
    expect(() => validateDecoded(SfIntelligenceMemoryOutcome.output, { ...comparison, privateChoice: {} })).toThrow()
  })

  test("mutation acknowledgement is not a fabricated persistent receipt", () => {
    expect(decode(SfIntelligenceMemoryCondition.output, { status: "ok" })).toEqual({ status: "ok" })
    expect(decode(SfIntelligenceMemoryOutcomeSelection.output, { status: "unavailable" })).toEqual({ status: "unavailable" })
    expect(() => decode(SfIntelligenceMemoryOutcomeSelection.output, {
      status: "ok", receiptId: "synthetic",
    })).toThrow()
  })
})
