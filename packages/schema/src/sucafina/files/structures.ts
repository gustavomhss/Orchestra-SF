import { Schema } from "effect"
import { NonNegativeInt, PositiveInt, optional } from "../../schema"

/**
 * A06 source-locked public file shapes. The private product remains the sole
 * authority for admission, scanner verdicts, version CAS and financial math.
 * Never import product/runtime sources into the browser contract.
 */
export const SfFileSurface = Schema.Literals(["dashboard", "planner", "procurement"])
export const SfImportSurface = Schema.Literals(["dashboard", "planner"])
export const SfAssetSurface = Schema.Literals(["dashboard", "procurement"])
export const SfFilePeriod = Schema.Struct({ start: Schema.String, end: Schema.String })
export const SfFileFields = Schema.Array(Schema.String)
export const SfFileDigest = Schema.Struct({
  algorithm: Schema.Literal("sha256"),
  value: Schema.String,
})
export const SfDocumentRef = Schema.Struct({
  schema: Schema.Literal("sf-evidence-v1"),
  kind: Schema.Literal("document"),
  refId: Schema.String,
  installationId: Schema.String,
  projectId: Schema.String,
  refDigest: Schema.String,
  evidenceLevel: Schema.Literals(["observed", "claim", "assumption", "proposal", "decision"]),
  target: Schema.Struct({
    documentId: Schema.String,
    incarnation: Schema.String,
    revision: PositiveInt,
    blobDigest: SfFileDigest,
    segment: Schema.Struct({
      start: NonNegativeInt,
      end: NonNegativeInt,
      unit: Schema.Literal("utf16"),
      textDigest: SfFileDigest,
    }),
    ragSourceId: Schema.String.pipe(optional),
    ragRevisionId: Schema.String.pipe(optional),
    ragSourceHash: Schema.Struct({ algorithm: Schema.Literal("blake3"), value: Schema.String }).pipe(optional),
    fieldCandidateId: Schema.String.pipe(optional),
    confirmationVersion: PositiveInt.pipe(optional),
  }),
}).annotate({ identifier: "SfFiles.DocumentRef" })
export interface SfDocumentRef extends Schema.Schema.Type<typeof SfDocumentRef> {}

export const SfDocumentEvidence = Schema.Struct({
  id: Schema.String,
  fileRef: Schema.String,
  version: PositiveInt,
  location: Schema.String,
  textRange: Schema.Struct({ start: NonNegativeInt, end: NonNegativeInt, unit: Schema.Literal("utf16") }),
  fieldCandidate: Schema.String,
  value: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null]),
  unit: Schema.String.pipe(optional),
  status: Schema.Literals(["extracted", "confirmed", "rejected", "stale"]),
  rejection: Schema.Struct({ reason: Schema.String, page: PositiveInt }).pipe(optional),
  ref: SfDocumentRef,
}).annotate({ identifier: "SfFiles.DocumentEvidence" })
export interface SfDocumentEvidence extends Schema.Schema.Type<typeof SfDocumentEvidence> {}

export const SfDocumentField = Schema.Struct({
  id: Schema.String,
  type: Schema.Literals(["string", "number", "boolean", "date"]),
  unit: Schema.String.pipe(optional),
})
export const SfDocumentFieldDefinition = Schema.Struct({
  documentRef: Schema.String,
  fields: Schema.Array(SfDocumentField),
  id: Schema.String.pipe(optional),
  expectedVersion: PositiveInt.pipe(optional),
})
export const SfDocumentFieldRecord = Schema.Struct({
  id: Schema.String,
  version: PositiveInt,
  ref: Schema.String,
  fields: Schema.Array(SfDocumentField),
})
export const SfImportPreviewOptions = Schema.Struct({
  sheet: Schema.String.pipe(optional),
  replace: Schema.Boolean.pipe(optional),
  headerRow: PositiveInt.pipe(optional),
})
export const SfImportOptions = Schema.Struct({
  newVersion: Schema.Boolean,
  removeMissing: Schema.Boolean,
  preview: SfImportPreviewOptions,
})
export const SfImportSourceRef = Schema.Struct({
  surface: SfFileSurface,
  type: Schema.String,
  id: Schema.String,
  incarnation: Schema.String,
  version: NonNegativeInt,
  fields: SfFileFields,
  period: SfFilePeriod,
  observedAt: Schema.String,
})
export const SfImportContext = Schema.Struct({
  installationId: Schema.String,
  projectId: Schema.String,
  principalRef: Schema.String,
  accessRevision: Schema.String,
  policyVersion: Schema.String,
  surface: SfFileSurface,
  period: SfFilePeriod,
  currency: Schema.String,
  sourceRefs: Schema.Array(SfImportSourceRef),
  capabilities: Schema.Array(Schema.String),
})
export const SfImportProjectionComponent = Schema.Struct({
  id: Schema.String,
  amount: Schema.NullOr(Schema.Finite),
  currency: Schema.String,
  period: SfFilePeriod,
  sourceRefs: Schema.Array(SfImportSourceRef),
  evidenceState: Schema.Literals(["confirmed", "estimated", "hypothetical", "absent"]),
})
// Domain projections/decision analysis are maintained by other domain contracts.
// Their rich nested decisions are opaque to this file adapter: no computation or
// authorizing decisions from this field is permitted by A06.
export const SfImportDomainProjection = Schema.Struct({
  context: SfImportContext,
  version: NonNegativeInt,
  engineVersion: Schema.String,
  components: Schema.Array(SfImportProjectionComponent),
  values: Schema.Array(Schema.Struct({
    id: Schema.String,
    value: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null]),
    unit: Schema.String.pipe(optional),
    currency: Schema.String.pipe(optional),
    period: SfFilePeriod,
    granularity: Schema.Literals(["record", "month", "year", "aggregate"]),
    sourceRefs: Schema.Array(Schema.Json),
    drilldown: Schema.NullOr(Schema.Json),
    evidenceState: Schema.Literals(["confirmed", "estimated", "hypothetical", "absent"]),
  })),
  missing: Schema.Array(Schema.Struct({
    field: Schema.String,
    reason: Schema.Literals(["missing","unavailable","restricted","not-applicable","incompatible-currency","missing-fx","missing-rate","unconfirmed"]),
  })),
  comparison: Schema.Json.pipe(optional),
  decision: Schema.Json.pipe(optional),
})
export const SfImportReceipt = Schema.Struct({
  id: Schema.String,
  idempotencyKey: Schema.String,
  commandDigest: Schema.String,
  targetIncarnation: Schema.String,
  principalRef: Schema.String,
  surface: SfFileSurface,
  version: NonNegativeInt,
  at: Schema.String,
  status: Schema.Literals(["applied", "awaiting-approval", "conflict", "failed", "cancelled"]),
  resultRef: Schema.String.pipe(optional),
  errors: Schema.Array(Schema.String),
})
export const SfImportManifest = Schema.Struct({
  id: Schema.String,
  version: PositiveInt,
  sourceDigest: Schema.String,
  format: Schema.String,
  context: SfImportContext,
  baseIdentity: Schema.Array(SfImportSourceRef),
  commands: Schema.Array(Schema.Struct({
    id: Schema.String,
    target: SfImportSourceRef,
    idempotencyKey: Schema.String,
    commandDigest: Schema.String,
    expectedVersion: NonNegativeInt,
    requiredAuthority: Schema.Array(Schema.String),
    preview: SfImportDomainProjection,
    action: Schema.String,
    operationRef: Schema.String,
    receiptRef: Schema.String.pipe(optional),
  })),
  issues: Schema.Array(Schema.Struct({ row: PositiveInt, field: Schema.String, reason: Schema.String })),
  state: Schema.Literals(["preview", "stale", "blocked", "applied"]),
  domainApplied: Schema.Boolean,
  receipts: Schema.Array(SfImportReceipt),
}).annotate({ identifier: "SfFiles.ImportManifest" })

export const SfImportDetail = Schema.Struct({
  manifestId: Schema.String,
  version: PositiveInt,
  sourceDigest: Schema.String,
  changes: Schema.Array(Schema.Struct({
    path: Schema.String,
    kind: Schema.Literals(["added", "changed", "removed", "unchanged", "ignored", "rejected"]),
    before: Schema.Union([
      Schema.Struct({ state: Schema.Literals(["absent", "undefined"]) }),
      Schema.Struct({ state: Schema.Literal("present"), value: Schema.Json }),
    ]),
    after: Schema.Union([
      Schema.Struct({ state: Schema.Literals(["absent", "undefined"]) }),
      Schema.Struct({ state: Schema.Literal("present"), value: Schema.Json }),
    ]),
    source: Schema.Union([
      Schema.Struct({
        kind: Schema.Literal("file"),
        sheet: Schema.String,
        row: PositiveInt,
        column: PositiveInt,
        address: Schema.String,
        field: Schema.String,
      }),
      Schema.Struct({ kind: Schema.Literal("domain"), reference: Schema.String }),
    ]),
    reason: Schema.String.pipe(optional),
  })),
})
export const SfImportReceiptSummary = Schema.Struct({
  receiptId: Schema.String,
  manifestId: Schema.String,
  idempotencyKey: Schema.String,
  commandDigest: Schema.String,
  outcome: Schema.Literals(["applied", "unchanged", "rejected"]),
  changedFields: NonNegativeInt,
})
export const SfFilesFailure = Schema.Struct({
  status: Schema.Literals(["denied", "unavailable", "stale", "conflict", "needs-input", "invalid", "provider-conflict", "failed"]),
  reason: Schema.String.pipe(optional),
})
export const SfFilesLegacyFailure = Schema.Struct({
  ok: Schema.Literal(false),
  status: Schema.Int,
  errors: Schema.Array(Schema.String).pipe(optional),
})
export const SfFilesPortResult = <S extends Schema.Top>(value: S) => Schema.Union([
  Schema.Struct({ status: Schema.Literal("ok"), value }),
  SfFilesFailure,
])

export const SfImportReadReference = Schema.Struct({
  manifest: SfImportManifest,
  detail: SfImportDetail,
  digest: Schema.String,
  receipt: SfImportReceiptSummary.pipe(optional),
})
export const SfImportReadDetail = Schema.Struct({
  digest: Schema.String,
  detail: SfImportDetail,
  receipt: SfImportReceiptSummary.pipe(optional),
})

export const SfFilesDownloadBytes = Schema.Uint8Array.annotate({ identifier: "SfFiles.DownloadBytes" })
/** Bytes are never represented as JSON, a local pathname, a detached link or a fake clean-scan status. */
export const SfFilesUploadBytes = Schema.Uint8Array.annotate({ identifier: "SfFiles.UploadBytes" })
