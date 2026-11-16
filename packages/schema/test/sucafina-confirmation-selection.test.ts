import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfConfirmationPrepareValue } from "../src/sucafina/collaboration/contracts"

test("confirmation selection references omit undefined on the wire", () => {
  const value = Schema.Struct({ selectionRef: SfConfirmationPrepareValue.fields.selectionRef })
  const encode = Schema.encodeSync(value)
  const selectionRef = "confirmation-selection:" + "a".repeat(64)
  expect(encode({ selectionRef: undefined })).toEqual({})
  expect(encode({ selectionRef })).toEqual({ selectionRef })
})
