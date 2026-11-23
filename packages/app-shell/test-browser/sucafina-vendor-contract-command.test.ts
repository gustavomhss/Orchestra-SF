import { describe, expect, test } from "bun:test"
import { createRenderEffect, createRoot } from "solid-js"
import { createStore, unwrap } from "solid-js/store"
import { Option, Schema } from "effect"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import { vendorAmountText, vendorCommandInput, vendorEditFromRecord, type SfVendorEdit, type SfVendorSave } from "../src/orchestra/chapters/sucafina/procurement/contracts/model"

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
  test("review groups exact numeric amounts without rounding source strings or changing the command", () => {
    expect(vendorAmountText(36000, "en")).toBe("36,000")
    expect(vendorAmountText("36000", "en")).toBe("36,000")
    expect(vendorAmountText("36000", "pt-BR")).toBe("36.000")
    for (const value of ["9007199254740993", "1.0000000000000001", "36000.000", " 36000 ", "NaN", "Infinity", "not a number"])
      expect(vendorAmountText(value, "en")).toBe(value)
    expect(vendorAmountText(Number.POSITIVE_INFINITY, "en")).toBe("Infinity")
    expect(vendorAmountText(Number.NaN, "en")).toBe("NaN")
    expect(vendorAmountText("", "en")).toBe("")
    expect(vendorAmountText(null, "en")).toBe("")
    const values = { ...complete(), amount: "36000" }
    vendorAmountText(values.amount, "en")
    const input = vendorCommandInput("save", ref, 1, values)
    expect(input.values.amount).toBe("36000")
    expect(admitted(input)).toEqual({ id: ref, version: 1, values })
  })

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
        const serialized = JSON.stringify(input)
        setState("review", "values", "notes", "Design test later edit")
        expect(input.values).not.toBe(state.review.values)
        expect(JSON.stringify(input)).toBe(serialized)
        expect(Reflect.ownKeys(input.values).every((field) => typeof field === "string")).toBe(true)
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
