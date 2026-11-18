import { Option, Schema } from "effect"
import { SfFiles } from "@orchestra/schema/sucafina/files"
import type { SfOperationBindings, SfOperationCodec, SfWireDecodeResult } from "@orchestra/schema/sucafina/common"

/**
 * A06 source-locked wire catalog, including the original members download.
 * Only the two original upload
 * operations move their Uint8Array through F02's isolated byte slot. Their
 * JSON metadata is validated with the SAME original schema fields.
 *
 * No codec is an access grant. Every response remains subject to the original
 * Request, current owner/role, version and producer-side policy.
 */
const importWire = Schema.Struct({
  surface: SfFiles.operations["files.import-admit"].input.fields.surface,
  selectionRef: SfFiles.operations["files.import-admit"].input.fields.selectionRef,
  options: SfFiles.operations["files.import-admit"].input.fields.options,
  fileName: SfFiles.operations["files.import-admit"].input.fields.fileName,
  mediaType: SfFiles.operations["files.import-admit"].input.fields.mediaType,
})
const assetWire = Schema.Struct({
  surface: SfFiles.operations["files.asset.upload"].input.fields.surface,
  upload: SfFiles.operations["files.asset.upload"].input.fields.upload,
  record: SfFiles.operations["files.asset.upload"].input.fields.record,
  recordVersion: SfFiles.operations["files.asset.upload"].input.fields.recordVersion,
  name: SfFiles.operations["files.asset.upload"].input.fields.name,
  page: SfFiles.operations["files.asset.upload"].input.fields.page,
  mediaType: SfFiles.operations["files.asset.upload"].input.fields.mediaType,
})

const invalid = (): SfWireDecodeResult => ({ status: "invalid" })
function decodeJson(schema: Schema.Top, input: unknown): SfWireDecodeResult {
  const typed = Schema.decodeUnknownOption(Schema.toType(schema), { onExcessProperty: "error" })(input)
  if (Option.isNone(typed)) return invalid()
  const json = Schema.decodeUnknownOption(Schema.Json)(typed.value)
  return Option.isSome(json) ? { status: "ok", value: json.value } : invalid()
}

const entries = Object.entries(SfFiles.operations).map(([operationId, source]) => {
  const input = operationId === "files.import-admit" ? importWire :
    operationId === "files.asset.upload" ? assetWire : source.input
  const bytes = operationId === "files.asset.download" || operationId.startsWith("files.export.")
  const result: SfOperationCodec = Object.freeze({
    decodeInput: (value) => decodeJson(input, value),
    // Actual byte results are separately schema-checked after a bounded
    // authenticated streaming read. Never serialize them as JSON/base64.
    decodeOutput: (value) => bytes ? invalid() : decodeJson(source.output, value),
  })
  return [operationId, result] as const
})

if (entries.length !== 27 || new Set(entries.map(([id]) => id)).size !== 27)
  throw new Error("SF_A06_SOURCE_CATALOG_MISMATCH")
export const SfFilesOperationBindings: SfOperationBindings = Object.freeze(Object.fromEntries(entries))
