import { SfFiles } from "@orchestra/schema/sucafina/files"
import type { SfFilesOperationInput, SfFilesOperationOutput } from "@orchestra/schema/sucafina/files"
import type { SfTransportResult } from "@orchestra/schema/sucafina/common"
import type { SfTransport, SfCallOptions } from "./transport"

/**
 * A06 source-bound facade. One invocation per caller action, no automatic
 * retry, optimistic apply, local scanner verdict, HTML parsing or URL override.
 * The producer authorizes every read/preview/mutation and rechecks on egress.
 */
const rejectContract: SfTransportResult<never> = { kind: "transport-error", reason: "contract-mismatch" }
const uuid = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
const validIdempotency = (key: string | undefined): boolean =>
  typeof key === "string" && uuid.test(key)

const plain = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
const only = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Reflect.ownKeys(value).every((key) => typeof key === "string" && keys.includes(key))
const nonempty = (value: unknown, max = 1024): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\r\n\0]/.test(value)
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0
const calendar = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const period = (value: unknown): boolean => plain(value) && only(value, ["start", "end"]) &&
  Object.keys(value).length === 2 && calendar(value.start) && calendar(value.end) && value.start <= value.end

function validImportTargets(input: SfFilesOperationInput<"files.import-targets">): boolean {
  return only(input, ["surface", "start", "end"]) &&
    ((input.start === undefined && input.end === undefined) ||
      (calendar(input.start) && calendar(input.end) && input.start <= input.end))
}
function validImportAdmit(input: SfFilesOperationInput<"files.import-admit">): boolean {
  const { options, bytes } = input
  if (!only(input, ["surface","selectionRef","options","fileName","mediaType","bytes"]) ||
      !nonempty(input.selectionRef) || !nonempty(input.fileName, 255) ||
      !/\.xlsx?$|\.json$/i.test(input.fileName) || !nonempty(input.mediaType, 128) ||
      !(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > 16 * 1024 * 1024)
    return false
  if (!plain(options) || Object.keys(options).length !== 3 ||
      !only(options, ["newVersion","removeMissing","preview"]) ||
      typeof options.newVersion !== "boolean" || typeof options.removeMissing !== "boolean" ||
      !plain(options.preview) || !only(options.preview, ["sheet","replace","headerRow"]) ||
      (options.preview.sheet !== undefined && !nonempty(options.preview.sheet)) ||
      (options.preview.replace !== undefined && typeof options.preview.replace !== "boolean") ||
      (options.preview.headerRow !== undefined && !positive(options.preview.headerRow)))
    return false
  return JSON.stringify(options).length <= 4096
}
function validDocumentSchema(input: SfFilesOperationInput<"files.document-schema">): boolean {
  if (!only(input, ["surface","documentRef","fields","id","expectedVersion"]) ||
      !nonempty(input.documentRef) || !Array.isArray(input.fields) ||
      !input.fields.length || input.fields.length > 100) return false
  const names = new Set<string>()
  for (const field of input.fields) {
    if (!plain(field) || !only(field, ["id","type","unit"]) || !nonempty(field.id,120) ||
        names.has(field.id) || !["string","number","boolean","date"].includes(String(field.type)) ||
        (field.unit !== undefined && (typeof field.unit !== "string" || field.unit.length > 40))) return false
    names.add(field.id)
  }
  return input.id === undefined ? input.expectedVersion === undefined :
    /^schema_[a-f0-9]{40}$/.test(input.id) && positive(input.expectedVersion)
}
function validDocumentSearch(input: SfFilesOperationInput<"files.document-search">): boolean {
  return only(input, ["surface","query","documentRefs","limit"]) &&
    nonempty(input.query,256) && positive(input.limit) && input.limit <= 100 &&
    (input.documentRefs === undefined || Array.isArray(input.documentRefs) &&
      input.documentRefs.every((ref) => nonempty(ref)))
}
function validDocumentConfirm(input: SfFilesOperationInput<"files.document-confirm">): boolean {
  const value = input.evidence
  return only(input, ["surface","evidence"]) && plain(value) &&
    value.status === "extracted" && nonempty(value.id) &&
    plain(value.ref) && value.ref.kind === "document"
}
function validDocumentOpen(input: SfFilesOperationInput<"files.document-open">): boolean {
  return only(input, ["surface","ref"]) && input.ref.kind === "document" &&
    new TextEncoder().encode(JSON.stringify(input.ref)).byteLength <= 8192
}
function validDocumentScenarioTargets(input: SfFilesOperationInput<"files.document-scenario-targets">): boolean {
  return only(input, ["surface","ref"]) && input.ref.kind === "document" &&
    nonempty(input.ref.target.fieldCandidateId) &&
    JSON.stringify(input.ref).length <= 32768
}
function validDocumentScenarioPreview(input: SfFilesOperationInput<"files.document-scenario-preview">): boolean {
  return only(input, ["surface","documentRef","baseRef","targetRef","period"]) &&
    input.documentRef.kind === "document" && nonempty(input.documentRef.target.fieldCandidateId) &&
    nonempty(input.baseRef) &&
    typeof input.targetRef === "string" && /^.{1,256}:(?:[1-9]|1[0-2])$/.test(input.targetRef) &&
    period(input.period)
}
function validAssetUpload(input: SfFilesOperationInput<"files.asset.upload">): boolean {
  return only(input, ["surface","upload","record","recordVersion","name","page","mediaType","bytes"]) &&
    (input.surface === "dashboard" ? input.upload === "contract" : input.upload !== "contract") &&
    nonempty(input.record) && nonempty(input.name,255) && nonempty(input.page) &&
    nonempty(input.mediaType,128) && input.bytes instanceof Uint8Array &&
    input.bytes.byteLength > 0 &&
    // For noncontract assets the real cap is dynamic and must be read server side.
    (input.upload !== "contract" || input.bytes.byteLength <= 25 * 1024 * 1024)
}

/**
 * Link parsing consumes only the exact signed query returned by files.asset.link.
 * The URL/path is never supplied by a user; access still depends on the server
 * actor, current policy, current record and the 5-minute HMAC expiry.
 */
export function readSfFilesSignedAssetQuery(query: string):
  { assetId: string; expires: number; signature: string } | undefined {
  if (typeof query !== "string" || query.length > 4096 || query.startsWith("?") ||
      /[?#\r\n]/.test(query)) return undefined
  const params = new URLSearchParams(query)
  if ([...params.keys()].length !== 3 || [...params.keys()].some((key) =>
    !["asset","expires","signature"].includes(key) || params.getAll(key).length !== 1)) return undefined
  const assetId = params.get("asset")
  const expiry = Number(params.get("expires"))
  const signature = params.get("signature")
  if (!nonempty(assetId) || !positive(expiry) || !signature || !/^[0-9a-f]{64}$/.test(signature))
    return undefined
  return { assetId, expires: expiry, signature }
}

/** Preserve the actual producer result: a rejection never becomes a clean scan. */
export function createSfFilesClient(transport: SfTransport) {
  return Object.freeze({
  "files.import-targets": (input: SfFilesOperationInput<"files.import-targets">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.import-targets">>> => {
    if (!validImportTargets(input)) return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.import-targets"], input, options)
  },
  "files.import-reference": (input: SfFilesOperationInput<"files.import-reference">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.import-reference">>> => {
    return transport.execute(SfFiles.operations["files.import-reference"], input, options)
  },
  "files.import-detail": (input: SfFilesOperationInput<"files.import-detail">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.import-detail">>> => {
    return transport.execute(SfFiles.operations["files.import-detail"], input, options)
  },
  "files.import-admit": (input: SfFilesOperationInput<"files.import-admit">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.import-admit">>> => {
    if (!validIdempotency(options.idempotencyKey) || !validImportAdmit(input)) return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.import-admit"], input, options)
  },
  "files.import-preview": (input: SfFilesOperationInput<"files.import-preview">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.import-preview">>> => {
    if (!validIdempotency(options.idempotencyKey)) return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.import-preview"], input, options)
  },
  "files.import-apply": (input: SfFilesOperationInput<"files.import-apply">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.import-apply">>> => {
    if (!validIdempotency(options.idempotencyKey)) return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.import-apply"], input, options)
  },
  "files.document-requests": (input: SfFilesOperationInput<"files.document-requests">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.document-requests">>> => {
    return transport.execute(SfFiles.operations["files.document-requests"], input, options)
  },
  "files.document-search": (input: SfFilesOperationInput<"files.document-search">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.document-search">>> => {
    if (!validDocumentSearch(input)) return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.document-search"], input, options)
  },
  "files.document-open": (input: SfFilesOperationInput<"files.document-open">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.document-open">>> => {
    if (!validDocumentOpen(input)) return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.document-open"], input, options)
  },
  "files.document-schemas": (input: SfFilesOperationInput<"files.document-schemas">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.document-schemas">>> => {
    return transport.execute(SfFiles.operations["files.document-schemas"], input, options)
  },
  "files.document-schema": (input: SfFilesOperationInput<"files.document-schema">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.document-schema">>> => {
    if (!validIdempotency(options.idempotencyKey) || !validDocumentSchema(input)) return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.document-schema"], input, options)
  },
  "files.document-sources": (input: SfFilesOperationInput<"files.document-sources">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.document-sources">>> => {
    return transport.execute(SfFiles.operations["files.document-sources"], input, options)
  },
  "files.document-admit": (input: SfFilesOperationInput<"files.document-admit">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.document-admit">>> => {
    if (!validIdempotency(options.idempotencyKey)) return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.document-admit"], input, options)
  },
  "files.document-extract": (input: SfFilesOperationInput<"files.document-extract">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.document-extract">>> => {
    if (!validIdempotency(options.idempotencyKey)) return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.document-extract"], input, options)
  },
  "files.document-confirm": (input: SfFilesOperationInput<"files.document-confirm">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.document-confirm">>> => {
    if (!validIdempotency(options.idempotencyKey) || !validDocumentConfirm(input)) return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.document-confirm"], input, options)
  },
  "files.document-candidates": (input: SfFilesOperationInput<"files.document-candidates">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.document-candidates">>> => {
    return transport.execute(SfFiles.operations["files.document-candidates"], input, options)
  },
  "files.document-scenario-targets": (input: SfFilesOperationInput<"files.document-scenario-targets">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.document-scenario-targets">>> => {
    if (!validDocumentScenarioTargets(input)) return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.document-scenario-targets"], input, options)
  },
  "files.document-scenario-preview": (input: SfFilesOperationInput<"files.document-scenario-preview">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.document-scenario-preview">>> => {
    if (!validDocumentScenarioPreview(input)) return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.document-scenario-preview"], input, options)
  },
  "files.asset.link": (input: SfFilesOperationInput<"files.asset.link">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.asset.link">>> => {
    return transport.execute(SfFiles.operations["files.asset.link"], input, options)
  },
  "files.asset.download": (input: SfFilesOperationInput<"files.asset.download">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.asset.download">>> => {
    return transport.execute(SfFiles.operations["files.asset.download"], input, options)
  },
  "files.asset.upload": (input: SfFilesOperationInput<"files.asset.upload">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.asset.upload">>> => {
    if (!validIdempotency(options.idempotencyKey) || !validAssetUpload(input)) return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.asset.upload"], input, options)
  },
  "files.export.po": (input: SfFilesOperationInput<"files.export.po">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.export.po">>> => {
    if (!plain(input) || !only(input, ["surface", "request"]) || input.surface !== "procurement" ||
        typeof input.request !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(input.request))
      return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.export.po"], input, options)
  },
  "files.export.xlsx": (input: SfFilesOperationInput<"files.export.xlsx">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.export.xlsx">>> => {
    return transport.execute(SfFiles.operations["files.export.xlsx"], input, options)
  },
  "files.export.suppliers": (input: SfFilesOperationInput<"files.export.suppliers">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.export.suppliers">>> => {
    return transport.execute(SfFiles.operations["files.export.suppliers"], input, options)
  },
  "files.export.register": (input: SfFilesOperationInput<"files.export.register">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.export.register">>> => {
    return transport.execute(SfFiles.operations["files.export.register"], input, options)
  },
  "files.export.json": (input: SfFilesOperationInput<"files.export.json">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.export.json">>> => {
    return transport.execute(SfFiles.operations["files.export.json"], input, options)
  },
  "files.export.members": (input: SfFilesOperationInput<"files.export.members">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.export.members">>> => {
    if (!plain(input) || !only(input, ["surface"]) || input.surface !== "dashboard") return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.export.members"], input, options)
  },
  "files.export.review": (input: SfFilesOperationInput<"files.export.review">, options: SfCallOptions): Promise<SfTransportResult<SfFilesOperationOutput<"files.export.review">>> => {
    if (!plain(input) || !only(input, ["surface", "artifactRef"]) || input.surface !== "dashboard" ||
        typeof input.artifactRef !== "string" || !/^report:[a-f0-9]{64}$/.test(input.artifactRef)) return Promise.resolve(rejectContract)
    return transport.execute(SfFiles.operations["files.export.review"], input, options)
  },
  })
}
