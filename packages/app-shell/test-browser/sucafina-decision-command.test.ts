import { describe, expect, test } from "bun:test"
import { createRenderEffect, createRoot } from "solid-js"
import { createStore, unwrap } from "solid-js/store"
import { Option, Schema } from "effect"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import type { SfOperationCodec } from "@orchestra/schema/sucafina/common"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { SfAnalyses } from "@orchestra/schema/sucafina/analyses"
import { snapshotDecisionRequest } from "../src/orchestra/chapters/sucafina/decisions/intent/request"

const edit = SfDecisions.operations["decisions.decision-edit"]
type Edit = typeof edit.input.Type
const original = (): Edit => ({
  caseRef: { id: "design-test-case", incarnation: "design-test-incarnation", version: 2 },
  objective: "Design test case with exact Planner evidence",
  horizon: { start: "2026-01-01", end: "2026-12-31" },
  currency: "USD",
  criteria: [{ id: "design-test-criterion", description: "Keep known costs visible", required: true }],
  sourceRefs: [{
    schema: "sf-evidence-v1", kind: "record", refId: "planner-version:design-test-plan:design-test-plan-incarnation:1",
    installationId: "design-test-installation", projectId: "design-test-project",
    refDigest: "a".repeat(64), evidenceLevel: "observed",
    target: { surface: "planner", recordType: "planner-version", recordId: "design-test-plan",
      incarnation: "design-test-plan-incarnation", version: 1, fields: ["lines"],
      period: { start: "2026-01-01", end: "2026-12-31" }, projectionDigest: "b".repeat(64) },
  }],
})

function admitted(schema: Schema.Top, codec: SfOperationCodec, input: unknown) {
  expect(Option.isSome(Schema.decodeUnknownOption(Schema.toType(schema), { onExcessProperty: "error" })(input))).toBe(true)
  const result = codec.decodeInput(input)
  expect(result.status).toBe("ok")
  return result.status === "ok" ? result.value : undefined
}

describe("Decision snapshots cross the unchanged native schema and JSON codec", () => {
  test("tracked source evidence retains its exact values and becomes independent of later draft edits", () => {
    createRoot((dispose) => {
      try {
        const [state, setState] = createStore({ request: original() })
        createRenderEffect(() => {
          JSON.stringify(state.request)
          Object.values(state.request.sourceRefs[0]!.target)
        })
        setState("request", "objective", "Design test reviewed objective")
        expect(unwrap(state.request)).not.toBe(state.request)
        const tracked = { ...state.request, sourceRefs: state.request.sourceRefs }
        expect(Option.isNone(Schema.decodeUnknownOption(Schema.toType(edit.input), { onExcessProperty: "error" })(tracked))).toBe(true)
        const input = snapshotDecisionRequest(tracked)
        const exact = { ...original(), objective: "Design test reviewed objective" }
        expect(admitted(edit.input, SfNativeOperationBindings["decisions.decision-edit"]!, input)).toEqual(exact)
        setState("request", "objective", "Design test later objective")
        expect(input).toEqual(exact)
        expect(input.sourceRefs).not.toBe(state.request.sourceRefs)
        expect(input.sourceRefs[0]).not.toBe(state.request.sourceRefs[0])
        expect(Reflect.ownKeys(input.sourceRefs[0]!).every((key) => typeof key === "string")).toBe(true)
        expect(Reflect.ownKeys(input.sourceRefs[0]!.target).every((key) => typeof key === "string")).toBe(true)
      } finally { dispose() }
    })
  })

  test("question preparation preserves the original evidence through its real codec", () => {
    createRoot((dispose) => {
      try {
        const [state] = createStore(original())
        createRenderEffect(() => { JSON.stringify(state.sourceRefs) })
        const input = { operation: "sf_question_prepare" as const, input: {
          caseRef: "case:design-test-case:design-test-incarnation",
          question: { text: "Design test question", criterionRef: "design-test-criterion" },
          sourceRefs: snapshotDecisionRequest(state.sourceRefs),
        } }
        expect(admitted(SfDecisions.operations["decisions.command.sf_question_prepare"].input,
          SfNativeOperationBindings["decisions.command.sf_question_prepare"]!, input)).toEqual({
            ...input, input: { ...input.input, sourceRefs: original().sourceRefs },
          })
      } finally { dispose() }
    })
  })

  test("a case selector copied from a tracked analysis catalog remains an exact source reference", () => {
    createRoot((dispose) => {
      try {
        const [state] = createStore({ caseRef: original().caseRef })
        createRenderEffect(() => { Object.values(state.caseRef) })
        const input = { caseRef: { ...state.caseRef } }
        expect(admitted(SfAnalyses.operations["intelligence.analysis.list"].input,
          SfNativeOperationBindings["intelligence.analysis.list"]!, input)).toEqual({ caseRef: original().caseRef })
      } finally { dispose() }
    })
  })

  test("snapshotting does not admit unknown command fields or explicit undefined", () => {
    for (const value of [{ ...original(), inventedApproval: true }, { ...original(), horizon: undefined }]) {
      createRoot((dispose) => {
        try {
          const [state] = createStore({ value })
          createRenderEffect(() => { Object.values(state.value) })
          const copied = snapshotDecisionRequest(state.value)
          expect(SfNativeOperationBindings["decisions.decision-edit"]!.decodeInput(copied).status).toBe("invalid")
          expect(Reflect.ownKeys(copied)).toEqual(Object.keys(value))
        } finally { dispose() }
      })
    }
  })
})
