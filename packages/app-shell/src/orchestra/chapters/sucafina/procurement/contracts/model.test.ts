import { describe, expect, test } from "bun:test"
import { createRenderEffect, createRoot } from "solid-js"
import { createStore, unwrap } from "solid-js/store"
import { Option, Schema } from "effect"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import { vendorCommandInput, vendorEditFromRecord, type SfVendorEdit, type SfVendorSave } from "./model"

const ref = "design-test-contract" as SfRef
const operation = SfDomain.operations["domain.command.CAP14.save"]
const codec = SfNativeOperationBindings["domain.command.CAP14.save"]!
const complete = (): SfVendorEdit => vendorEditFromRecord({
  id: ref, vendor: "Design test supplier", num: "TEST-MSA-001", name: "Design test agreement",
  desc: "Design test source", category: "Infrastructure", owner: "Design test operator",
  start: "2026-01-01", end: "2027-12-31", renewal: "2027-10-01",
  amount: 144000, amtType: "annual", renewType: "auto", notice: "120 days", eval: "A", notes: "",
})

function admitted(input: SfVendorSave) {
  const typed = Schema.decodeUnknownOption(Schema.toType(operation.input), { onExcessProperty: "error" })(input)
  const decoded = codec.decodeInput(input)
  expect(Option.isSome(typed)).toBe(true)
  expect(decoded.status).toBe("ok")
  return decoded.status === "ok" ? decoded.value : undefined
}

describe("CAP14 values cross the unchanged native schema and JSON codec", () => {
  test("complete plain source values are admitted without adding a page or action discriminator", () => {
    const values = complete()
    const input = vendorCommandInput("save", ref, 1, values)
    expect(admitted(input)).toEqual({ id: ref, version: 1, values })
    expect(input).not.toHaveProperty("page")
    expect(input).not.toHaveProperty("action")
  })

  test("a tracked Solid review store produces an admitted command without reactive metadata", () => {
    createRoot((dispose) => {
      try {
        const [state, setState] = createStore({ review: { values: complete() } })
        createRenderEffect(() => { Object.values(state.review.values) })
        setState("review", "values", "notes", "Design test changed note")
        expect(unwrap(state.review.values)).not.toBe(state.review.values)
        const input = vendorCommandInput("save", ref, 1, state.review.values)
        const typed = Schema.decodeUnknownOption(Schema.toType(operation.input), { onExcessProperty: "error" })(input)
        const spread = { ...input, values: { ...input.values } }
        const wire = JSON.parse(JSON.stringify(input))
        console.info("SF_CAP14_CODEC_PROBE " + JSON.stringify({
          typed: Option.isSome(typed), codec: codec.decodeInput(input).status,
          shallow: codec.decodeInput(spread).status, wire: codec.decodeInput(wire).status,
          valueOwnKeyTypes: Reflect.ownKeys(input.values).map((field) => typeof field),
          fieldTypes: Object.fromEntries(Object.entries(input.values).map(([field, value]) =>
            [field, value === null ? "null" : typeof value])),
        }))
        expect(admitted(input)).toEqual({ id: ref, version: 1,
          values: { ...complete(), notes: "Design test changed note" } })
      } finally {
        dispose()
      }
    })
  })

  test("absent optional source fields remain absent at the JSON boundary and a recorded zero stays zero", () => {
    const values = vendorEditFromRecord({ id: ref, vendor: "Design test supplier", amount: 0 })
    const input = vendorCommandInput("save", ref, 1, values)
    expect(admitted(input)).toEqual({ id: ref, version: 1,
      values: { vendor: "Design test supplier", amount: 0, amtType: "total", renewType: "fixed", eval: "" } })
  })

  test("zero, numeric strings, empty strings and explicit null keep their original wire meaning", () => {
    for (const amount of [0, "0", "", null] as const) {
      const values: SfVendorEdit = { vendor: "Design test supplier", amount, num: "", notes: "", notice: "" }
      const input = vendorCommandInput("save", undefined, 0, values)
      expect(admitted(input)).toEqual({ version: 0, values })
    }
  })
})
