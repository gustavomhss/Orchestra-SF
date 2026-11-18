import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfDecisions } from "../../../../../packages/schema/src/sucafina/decisions.ts"
import { SfSourceEvidenceInput } from "../../../../../packages/schema/src/sucafina/decisions/source-contracts.ts"
import type { SfEvidenceRef } from "../../../../../packages/schema/src/sucafina/decisions/source-contracts.ts"
import { createSfDecisionsClient } from "../../../../../packages/client/src/sucafina/decisions.ts"
import type { SfTransport } from "../../../../../packages/client/src/sucafina/transport.ts"

const caseRef = { id: "case-1", incarnation: "incarnation-1", version: 3 } as const
const digest = "a".repeat(64)
const selected = { caseRef, choiceId: "choice-1", changeId: "change-1" } as const
const signal = new AbortController().signal

function accepts<S extends Schema.Top>(schema: S, value: unknown) {
  // A04's source schemas are validation-only; toType retains their checks
  // without claiming services erased by recursive Schema.Schema<T> declarations.
  return Schema.decodeUnknownExit(Schema.toType(schema), { onExcessProperty: "error" })(value)._tag === "Success"
}

describe("W16/A04 — frozen decision operation manifest (schema only; CI120 qualifies)", () => {
  test("all 21 literal IDs exist without a generic endpoint", () => {
    expect(Object.keys(SfDecisions.operations).sort()).toEqual([
      "projection.cases", "projection.case",
      "decisions.choice.read", "decisions.controls.read",
      "decisions.command.sf_case_draft", "decisions.command.sf_change_prepare", "decisions.command.sf_question_prepare",
      "decisions.current-choice-prepare", "decisions.current-choice-promote",
      "decisions.decision-add-question", "decisions.decision-answer-question", "decisions.decision-apply",
      "decisions.decision-choose", "decisions.decision-condition", "decisions.decision-coverage",
      "decisions.decision-criteria", "decisions.decision-prepare-changes", "decisions.decision-promote",
      "decisions.decision-recover", "decisions.decision-review", "decisions.decision-select-portfolio",
    ].sort())
    for (const [id, operation] of Object.entries(SfDecisions.operations)) {
      expect(operation.operationId).toBe(id)
      expect(operation.pathTemplate.startsWith("{mount}")).toBe(true)
      expect(operation.responseMode).toBe("json")
      expect("automaticRetry" in operation).toBe(false)
    }
  })

  test("caseRef is a closed incarnation+positive-version CAS object", () => {
    const op = SfDecisions.operations["decisions.decision-add-question"]
    expect(accepts(op.input, { caseRef, questionRef: "question-1" })).toBe(true)
    expect(accepts(op.input, { caseRef: { ...caseRef, version: 0 }, questionRef: "question-1" })).toBe(false)
    expect(accepts(op.input, { caseRef: { id: "case-1", version: 3 }, questionRef: "question-1" })).toBe(false)
    expect(accepts(op.input, { caseRef, questionRef: "question-1", authority: "fake" })).toBe(false)
    expect(accepts(op.input, { caseRef, questionRef: "question-1", caseVersion: 4 })).toBe(false)
  })

  test("workbench command discriminators do not accept another operation", () => {
    const op = SfDecisions.operations["decisions.command.sf_case_draft"]
    const input = { objective: "Replace service", horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "BRL", criteria: [], sourceRefs: [] }
    expect(accepts(op.input, { operation: "sf_case_draft", input })).toBe(true)
    expect(accepts(op.input, { operation: "sf_change_prepare", input })).toBe(false)
    expect(accepts(op.input, { operation: "sf_case_draft", input, defaultApproved: true })).toBe(false)
    expect(op.fixedBodyDiscriminator).toEqual({ operation: "sf_case_draft" })
    expect(op.maxRequestBytes).toBe(65536)
  })

  test("document digest nesting and recursive evidence retain exact source contracts", () => {
    const document = {
      schema: "sf-evidence-v1",
      refId: "evidence:doc-1",
      installationId: "installation-1",
      projectId: "project-1",
      refDigest: digest,
      evidenceLevel: "observed",
      kind: "document",
      target: {
        documentId: "document-1",
        incarnation: "document-incarnation-1",
        revision: 0,
        blobDigest: { algorithm: "sha256", value: digest },
        segment: {
          start: 0,
          end: 12,
          unit: "utf16",
          textDigest: { algorithm: "sha256", value: digest },
        },
        confirmationVersion: 0,
      },
    } satisfies SfEvidenceRef
    const calculation = {
      schema: "sf-evidence-v1",
      refId: "evidence:calculation-1",
      installationId: "installation-1",
      projectId: "project-1",
      refDigest: digest,
      evidenceLevel: "observed",
      kind: "calculation",
      target: {
        calculationId: "calculation-1",
        runId: "run-1",
        engineVersion: "v1",
        inputDigest: digest,
        resultDigest: digest,
        sourceRefs: [document],
        period: { start: "2026-01-01", end: "2026-12-31" },
        currency: "BRL",
      },
    } satisfies SfEvidenceRef
    const draft = SfDecisions.operations["decisions.command.sf_case_draft"].input
    const input = {
      operation: "sf_case_draft",
      input: {
        objective: "Compare documented alternatives",
        horizon: { start: "2026-01-01", end: "2026-12-31" },
        currency: "BRL",
        criteria: [],
        sourceRefs: [calculation],
      },
    }

    expect(accepts(SfSourceEvidenceInput, document)).toBe(true)
    expect(accepts(SfSourceEvidenceInput, calculation)).toBe(true)
    expect(accepts(draft, input)).toBe(true)
    expect(accepts(SfSourceEvidenceInput, {
      ...document,
      target: {
        ...document.target,
        segment: { ...document.target.segment, textDigest: { algorithm: "sha256", value: "short" } },
      },
    })).toBe(false)
    expect(accepts(SfSourceEvidenceInput, {
      ...document,
      target: {
        ...document.target,
        segment: { ...document.target.segment, textDigest: { algorithm: "blake3", value: digest } },
      },
    })).toBe(false)
    expect(accepts(SfSourceEvidenceInput, {
      ...document,
      target: { ...document.target, authority: "admin" },
    })).toBe(false)
    expect(accepts(draft, {
      ...input,
      input: {
        ...input.input,
        sourceRefs: [{
          ...calculation,
          target: {
            ...calculation.target,
            sourceRefs: [{ ...document, installationId: "" }],
          },
        }],
      },
    })).toBe(false)
  })

  test("choice mutation retains reviewed source digests and does not accept fake receipts", () => {
    const op = SfDecisions.operations["decisions.current-choice-promote"]
    expect(accepts(op.input, {caseRef,choiceId:"a",choiceDigest:digest,alternativeRef:{id:"x",version:1},resultRef:"r",resultDigest:digest,coverageRef:"c"})).toBe(false)
    expect(accepts(op.input, {caseRef,choiceId:"a",choiceDigest:digest,alternativeRef:{id:"x",version:1},resultRef:"r",resultDigest:digest,coverageRef:"c",receiptId:"invented"})).toBe(false)
    expect(op.fixedQuery).toEqual({ sf: "current-choice-promote" })
  })

  test("apply requires reviewed 64-hex digest; recovery is explicit and exclusive", () => {
    const apply = SfDecisions.operations["decisions.decision-apply"]
    const recover = SfDecisions.operations["decisions.decision-recover"]
    expect(accepts(apply.input, { ...selected, reviewDigest: digest })).toBe(true)
    expect(accepts(apply.input, { ...selected, reviewDigest: "" })).toBe(false)
    expect(accepts(apply.input, { ...selected, reviewDigest: digest, purpose: "recover" })).toBe(false)
    expect(accepts(recover.input, { ...selected, purpose: "recover" })).toBe(true)
    expect(accepts(recover.input, { ...selected, reviewDigest: digest })).toBe(true)
    expect(accepts(recover.input, { ...selected, purpose: "recover", reviewDigest: digest })).toBe(false)
  })

  test("conditional choices keep explicit zero/null and never flatten stale to ok", () => {
    const criteria = SfDecisions.operations["decisions.decision-criteria"]
    const value = { caseRef, criterionId:"criterion-1", metricRef:"forecast", operator:"lte", value:0, unit:"BRL",
      period:{start:"2026-01-01",end:"2026-12-31"}, evidenceRefs:[], expectedRuleVersion:0 }
    expect(accepts(criteria.input,value)).toBe(true)
    expect(accepts(criteria.input,{...value,value:null})).toBe(false)
    const review = SfDecisions.operations["decisions.decision-review"]
    expect(accepts(review.output, { status: "stale", reason: "prepared-case-changed" })).toBe(true)
    expect(accepts(review.output, { status: "conflict", reason: "review-choice-ambiguous" })).toBe(true)
    expect(accepts(review.output, { status: "denied", reason: "human-review-required" })).toBe(true)
  })

  test("read projections refuse unknown keys and never accept user-supplied grants", () => {
    const one = SfDecisions.operations["projection.case"]
    const many = SfDecisions.operations["projection.cases"]
    expect(accepts(one.input, { caseRef:"case:1:inc" })).toBe(true)
    expect(accepts(one.input, { caseRef:"case:1:inc", returnTo:"/sf/dashboard?page=Vendor%20Contracts" })).toBe(true)
    expect(accepts(one.input, { caseRef:"case:1:inc", principalRef:"admin" })).toBe(false)
    expect(accepts(many.input, {})).toBe(true)
    expect(accepts(many.input, { includePrivate:true })).toBe(false)
    expect(accepts(many.input, { principalRef: "admin" })).toBe(false)
    expect(accepts(many.input, { grant: "cases:all" })).toBe(false)
    expect(accepts(many.input, { authority: { role: "admin" } })).toBe(false)
    expect(accepts(many.input, { unknown: null })).toBe(false)
    expect(many.method).toBe("GET")
    expect(many.pathTemplate).toBe("{mount}/api/ui/projections/cases")
  })

  test("POSTed read, prepare and mutation retain correct effect and route", () => {
    expect(SfDecisions.operations["decisions.decision-review"].method).toBe("POST")
    expect(SfDecisions.operations["decisions.decision-review"].effect).toBe("read")
    expect(SfDecisions.operations["decisions.decision-prepare-changes"].effect).toBe("prepare")
    expect(SfDecisions.operations["decisions.decision-apply"].effect).toBe("mutation")
    expect(SfDecisions.operations["decisions.choice.read"].fixedQuery).toEqual({sf:"current-choice",format:"json"})
    expect(SfDecisions.operations["decisions.controls.read"].fixedQuery).toEqual({sf:"decision-controls",format:"json"})
  })

  test("client maps each operation to exactly one transport call, never auto-retries uncertainty", async () => {
    const invocations: string[] = []
    const transport: SfTransport = {
      execute: async (operation) => {
        invocations.push(operation.operationId)
        return { kind: "transport-error" as const, reason: "outcome-unknown" as const }
      },
    }
    const client = createSfDecisionsClient(transport)
    const outcome = await client["decisions.decision-apply"]({ ...selected, reviewDigest: digest }, { signal, idempotencyKey:"human:apply-00001" })
    expect(outcome).toEqual({kind:"transport-error",reason:"outcome-unknown"})
    expect(invocations).toEqual(["decisions.decision-apply"])
    expect(Object.keys(client).sort()).toEqual(Object.keys(SfDecisions.operations).sort())
    expect("execute" in client).toBe(false)
  })

  test("unauthenticated, stale and conflict stay distinct typed outcomes", () => {
    const projection = SfDecisions.operations["projection.case"].output
    const review = SfDecisions.operations["decisions.decision-review"].output
    expect(accepts(projection, { status:"unauthenticated" })).toBe(true)
    expect(accepts(projection, { status:"denied" })).toBe(true)
    expect(accepts(review, { status:"stale", reason:"case-changed" })).toBe(true)
    expect(accepts(review, { status:"conflict", reason:"review-digest-changed" })).toBe(true)
    expect(accepts(review, { status:"ok", receiptId:"invented" })).toBe(false)
  })
})

/**
 * Host-bound authorization, identity, double-read freshness, C12 recovery
 * receipt proof, contextualReturn and native-router installation are NOT
 * qualified by these unit-contract specs. CI120 must select real producers.
 */
