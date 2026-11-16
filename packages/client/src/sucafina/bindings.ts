/**
 * I00: the single client codec assembly from released, browser-safe source
 * schemas. Route metadata is ONLY in SfOperationRegistry, never inferred here.
 * A codec checks shape; it is neither an entitlement nor a producer admission.
 */
import { Option, Schema } from "effect"
import { SfOperationId, type SfOperationBindings, type SfOperationCodec, type SfWireDecodeResult } from "@orchestra/schema/sucafina/common"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { SfExpectedContextBinding, SfContextResult, SfInstallationSelector, SfInstallationList } from "@orchestra/schema/sucafina/context"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { SfPeople } from "@orchestra/schema/sucafina/people"
import { SfOperations } from "@orchestra/schema/sucafina/operations"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { SfPortfolio } from "@orchestra/schema/sucafina/portfolio"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import { SfBi } from "@orchestra/schema/sucafina/bi"
import { SfReviews } from "@orchestra/schema/sucafina/reviews"
import { SfRoutines } from "@orchestra/schema/sucafina/routines"
import { SfWork } from "@orchestra/schema/sucafina/work"
import { SfMemory } from "@orchestra/schema/sucafina/memory"
import { SfAnalyses } from "@orchestra/schema/sucafina/analyses"
import { SfFilesOperationBindings } from "./files/codecs"

type Contract = Readonly<{
  operationId: string
  input: Schema.Top
  output: Schema.Top
}>

const invalid = (): SfWireDecodeResult => ({ status: "invalid" })

function decode(schema: Schema.Top, value: unknown): SfWireDecodeResult {
  // The exact source shape must parse before its JSON wire representation
  // can be admitted. No JSON passthrough, guessed response or relaxed parsing.
  const parsed = Schema.decodeUnknownOption(Schema.toType(schema), { onExcessProperty: "error" })(value)
  if (Option.isNone(parsed)) return invalid()
  const json = Schema.decodeUnknownOption(Schema.Json)(parsed.value)
  if (Option.isNone(json)) return invalid()
  return { status: "ok", value: json.value }
}

function codec(source: Contract): SfOperationCodec {
  return Object.freeze({
    decodeInput: (value: unknown) => decode(source.input, value),
    decodeOutput: (value: unknown) => decode(source.output, value),
  })
}

/**
 * Read-only canonical binding map. The transport independently enforces
 * installation, ownership generation, method, route, origin, idempotency,
 * native-owner fence and source response admission. Absent operation => 503.
 */
export const SfNativeOperationBindings: SfOperationBindings = (() => {
  const bindings = new Map<SfOperationId, SfOperationCodec>()
  const add = (family: Readonly<Record<string, Contract>>) => {
    for (const [key, source] of Object.entries(family)) {
      if (!Schema.is(SfOperationId)(key) || source.operationId !== key) {
        throw new Error("SF_NATIVE_CODEC_CATALOG_MISMATCH")
      }
      if (bindings.has(key)) throw new Error("SF_NATIVE_DUPLICATE_CODEC")
      const metadata = SfOperationRegistry[key]
      if (!metadata) throw new Error("SF_NATIVE_MISSING_ROUTE_METADATA")
      // Download/navigation responses need their own real installed consumers.
      // They must never masquerade as JSON or receive a fabricated receipt.
      if (metadata.responseMode !== "json" && metadata.responseMode !== "empty") continue
      bindings.set(key, codec(source))
    }
  }
  add({
    "ctx.context": {
      operationId: "ctx.context",
      input: SfExpectedContextBinding,
      output: SfContextResult,
    },
    "ctx.installations": {
      operationId: "ctx.installations",
      input: SfInstallationSelector,
      output: SfInstallationList,
    },
  })
  add(SfDomain.operations)
  add(SfPeople.operations)
  add(SfOperations.operations)
  add(SfPlanner.operations)
  add(SfProcurement.operations)
  add(SfDecisions.operations)
  add(SfPortfolio)
  add(SfCollaboration.operations)
  add(SfBi.operations)
  add(SfReviews)
  add(SfRoutines.operations)
  add(SfWork.operations)
  add(SfMemory.operations)
  add(SfAnalyses.operations)
  // Source A06's 25 codecs and the original members download, not JSON-masked bytes.
  const sourceFiles = Object.entries(SfFilesOperationBindings)
  if (sourceFiles.length !== 26) throw new Error("SF_A06_26_OPERATIONS_REQUIRED")
  for (const [candidate, fileCodec] of sourceFiles) {
    if (!Schema.is(SfOperationId)(candidate)) throw new Error("SF_A06_OPERATION_UNKNOWN")
    const id = candidate as SfOperationId
    const meta = SfOperationRegistry[id]
    if (!meta || meta.responseMode === "navigation" || !fileCodec || bindings.has(id))
      throw new Error("SF_A06_BINDING_CONFLICT")
    bindings.set(id, fileCodec)
  }
  return Object.freeze(Object.fromEntries(bindings))
})()
