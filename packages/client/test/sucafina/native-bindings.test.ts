import { describe, expect, test } from "bun:test"
import { Option, Schema } from "effect"
import { SfMemory } from "@orchestra/schema/sucafina/memory"
import { SfNativeOperationBindings } from "../../src/sucafina/bindings"

// Exercise the installed source codecs directly. These shape checks do not
// manufacture authority, producer readiness, transport responses or receipts.
describe("native source bindings preserve an admitted absent wire value", () => {
  test("the original memory catalog accepts its undefined input", () => {
    const source = SfMemory.operations["intelligence.memory-catalog"]
    expect(Schema.is(source.input)(undefined)).toBe(true)
    expect(SfNativeOperationBindings[source.operationId]!.decodeInput(undefined))
      .toEqual({ status: "ok", value: undefined })
  })

  test("a no-input source rejects every supplied JSON shape and non-JSON value", () => {
    const binding = SfNativeOperationBindings["intelligence.memory-catalog"]!
    for (const value of [
      null, {}, [], "", "undefined", false, 0, { value: undefined },
      { context: {} }, [undefined], Number.NaN, Number.POSITIVE_INFINITY, 1n,
    ]) expect(binding.decodeInput(value)).toEqual({ status: "invalid" })
  })

  test("required case inputs retain exact values and reject absent, empty or extra data", () => {
    const input = { caseId: "case-1", incarnation: "incarnation-1", version: 1 }
    for (const operationId of ["intelligence.memory-conditions", "intelligence.memory-signals"] as const) {
      const binding = SfNativeOperationBindings[operationId]!
      expect(binding.decodeInput(input)).toEqual({ status: "ok", value: input })
      for (const value of [
        undefined, null, {}, [], { ...input, version: 0 },
        { ...input, version: undefined }, { ...input, owner: "foreign-owner" },
        { ...input, extra: undefined },
      ]) expect(binding.decodeInput(value)).toEqual({ status: "invalid" })
    }
  })

  test("JSON catalog outputs still require the original closed response shape", () => {
    const binding = SfNativeOperationBindings["intelligence.memory-catalog"]!
    const result = { status: "ok", value: ["planner-conditions", "planner-materiality"] }
    expect(binding.decodeOutput(result)).toEqual({ status: "ok", value: result })
    const unavailable = { status: "unavailable", reason: "source-unavailable" }
    expect(binding.decodeOutput(unavailable)).toEqual({ status: "ok", value: unavailable })
    for (const value of [
      undefined, null, {}, { status: "ok" }, { status: "ok", value: undefined },
      { status: "ok", value: ["invented-producer"] }, { ...result, ready: true },
    ]) expect(binding.decodeOutput(value)).toEqual({ status: "invalid" })
  })

  test("an optional nested undefined never bypasses the JSON wire check", () => {
    const source = SfMemory.operations["intelligence.memory-outcome-selection"]
    const binding = SfNativeOperationBindings[source.operationId]!
    const nested = { status: "ok", selectionRef: undefined }
    // The source's decoded optional property accepts this value; the wire does not.
    expect(Option.isSome(Schema.decodeUnknownOption(Schema.toType(source.output), {
      onExcessProperty: "error",
    })(nested))).toBe(true)
    expect(binding.decodeOutput(nested)).toEqual({ status: "invalid" })
    expect(binding.decodeOutput({ status: "ok" })).toEqual({ status: "ok", value: { status: "ok" } })
    const present = { status: "ok", selectionRef: "a".repeat(64) }
    expect(binding.decodeOutput(present)).toEqual({ status: "ok", value: present })
  })

  test("absent input support does not authorize absent mutation receipts", () => {
    const binding = SfNativeOperationBindings["intelligence.memory-outcome-selection"]!
    for (const value of [undefined, null, {}, [], { status: "ok", selectionRef: "not-a-digest" }])
      expect(binding.decodeOutput(value)).toEqual({ status: "invalid" })
    for (const value of [undefined, null, {}])
      expect(binding.decodeInput(value)).toEqual({ status: "invalid" })
  })
})
