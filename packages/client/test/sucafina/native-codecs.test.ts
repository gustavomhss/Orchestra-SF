import { expect, test } from "bun:test"
import { Option, Schema } from "effect"
import { SfDomainCommandCap23Save } from "@orchestra/schema/sucafina/planner"
import { SfNativeOperationBindings } from "../../src/sucafina/bindings"

const codec = SfNativeOperationBindings["domain.command.CAP23.save"]!
const command = {
  page: "Versions", version: 0, confirmed: true, action: "save",
  values: { name: "Native codec version", year: 2026 },
}

test("CAP23 accepts the exact JSON create command and preserves its values", () => {
  expect(codec.decodeInput(command)).toEqual({ status: "ok", value: command })
  const existing = { ...command, id: "version-existing", version: 3 }
  expect(codec.decodeInput(existing)).toEqual({ status: "ok", value: existing })
})

test("CAP23 identifies undefined optional fields without relaxing the source schema", () => {
  const explicit = { ...command, id: undefined }
  const parsed = Schema.decodeUnknownOption(Schema.toType(SfDomainCommandCap23Save.input), { onExcessProperty: "error" })(explicit)
  console.info("SF_CODEC_OPTIONAL_DIAGNOSTIC", JSON.stringify({
    sourceAccepted: Option.isSome(parsed), wire: codec.decodeInput(explicit).status,
    sourceOwnUndefined: Option.isSome(parsed) && Object.hasOwn(parsed.value, "id") && parsed.value.id === undefined,
  }))
  expect(codec.decodeInput(explicit)).toEqual({ status: "invalid" })
  expect(codec.decodeInput({ ...command, authorityHint: undefined })).toEqual({ status: "invalid" })
  expect(codec.decodeInput({ ...command, values: { ...command.values, year: Infinity } })).toEqual({ status: "invalid" })
})

test("Planner arrays keep exact length and reject undefined instead of converting it to null", () => {
  const save = SfNativeOperationBindings["domain.command.CAP18.save"]!
  const months = Array.from({ length: 12 }, (_, month) => month === 0 ? 12 : 0)
  const input = { page: "OPEX", action: "save", id: "line-1", version: 1, values: { versionId: "version-1", b: months } }
  expect(save.decodeInput(input)).toEqual({ status: "ok", value: input })
  expect(save.decodeInput({ ...input, values: { ...input.values, b: [undefined, ...months.slice(1)] } })).toEqual({ status: "invalid" })
  expect(save.decodeInput({ ...input, values: { ...input.values, b: [Infinity, ...months.slice(1)] } })).toEqual({ status: "invalid" })
})
