import { Schema } from "effect"
import { NonNegativeInt, PositiveInt, optional } from "../schema"
import {
  SfAssetSurface, SfDocumentEvidence, SfDocumentFieldDefinition, SfDocumentFieldRecord,
  SfDocumentRef, SfFilePeriod, SfFileSurface, SfFilesDownloadBytes, SfFilesFailure,
  SfFilesLegacyFailure, SfFilesPortResult, SfFilesUploadBytes, SfImportDetail,
  SfImportManifest, SfImportOptions, SfImportPreviewOptions, SfImportReadDetail,
  SfImportReadReference, SfImportSurface,
} from "./files/structures"

/**
 * One typed operation for each source-locked files operation.
 *
 * These are NOT endpoints or source grants. I00/F02 bind the exact method, path,
 * fixed query, content type and download/upload wire mode from contract-catalog.
 * Import/document operations use existing same-origin JSON HTTP producers only.
 */
const NonEmptyRef = Schema.String
const ImportSelection = Schema.Struct({ surface: SfImportSurface, selectionRef: NonEmptyRef })
const HostSurface = Schema.Struct({ surface: SfFileSurface })
const ImportLocation = Schema.Struct({ surface: SfImportSurface })
const ImportManifestId = Schema.Struct({ surface: SfFileSurface, manifestId: NonEmptyRef, version: PositiveInt })
const DocumentRefSelector = Schema.Struct({ surface: SfFileSurface, documentRef: NonEmptyRef })

const Receipt = Schema.Struct({
  operation: Schema.String, handlerExport: Schema.String, inputDigest: Schema.String,
  resultDigest: Schema.String.pipe(optional), principalRef: Schema.String,
  callId: Schema.String, accessRevision: Schema.String, at: Schema.String,
  kind: Schema.Literal("ui"), requestId: Schema.String,
})
const NativeReceipt = Schema.Struct({
  operation: Schema.String, handlerExport: Schema.String, inputDigest: Schema.String,
  resultDigest: Schema.String.pipe(optional), principalRef: Schema.String,
  callId: Schema.String, accessRevision: Schema.String, at: Schema.String,
  kind: Schema.Literal("native"),
  runId: Schema.String, nativeSessionId: Schema.String, providerGeneration: NonNegativeInt,
})
const ImportPreviewSuccess = Schema.Struct({
  status: Schema.Literal("ok"),
  value: SfImportManifest,
  receipt: Schema.Union([Receipt, NativeReceipt]),
})
const DocumentSearchMatch = Schema.Struct({
  documentRef: SfDocumentRef,
  text: Schema.String,
  lexicalScore: Schema.Finite,
})
const DocumentScenarioInput = Schema.Struct({
  surface: SfFileSurface,
  documentRef: SfDocumentRef,
  baseRef: Schema.String,
  targetRef: Schema.String,
  period: SfFilePeriod,
})
const ScenarioTarget = Schema.Struct({
  baseRef: Schema.String,
  targetRef: Schema.String,
  period: SfFilePeriod,
  currency: Schema.String,
  label: Schema.String,
  linkRef: Schema.String.pipe(optional),
  linkedAt: Schema.String.pipe(optional),
})
const DocumentRejection = Schema.Struct({
  surface: SfFileSurface, action: Schema.Literal("reject"),
  evidence: SfDocumentEvidence, reason: Schema.String, page: PositiveInt,
})
const DocumentLink = Schema.Struct({
  surface: SfFileSurface, action: Schema.Literal("link"),
  ...DocumentScenarioInput.fields,
})
const DocumentLinkReceipt = Schema.Struct({
  kind: Schema.Literal("scenario-link"), id: Schema.String, at: Schema.String,
  documentRef: SfDocumentRef, baseRef: Schema.String, targetRef: Schema.String,
  period: SfFilePeriod, evidenceVersion: PositiveInt,
  domainApplied: Schema.Literal(false),
})
const SourceLink = Schema.Struct({
  ok: Schema.Literal(true),
  query: Schema.String,
  expires: Schema.String,
})
const AssetUploadSuccess = Schema.Struct({ ok: Schema.Literal(true) })

/**
 * 'bytes' must travel through the isolated, typed upload payload owned by F02/D01,
 * never JSON, local filesystem paths, or a renderer-provided URL. The client does
 * not mark an upload clean or admitted; the producer's scanner is mandatory.
 */
export const SfFilesImportTargets = {
  operationId: "files.import-targets",
  input: Schema.Struct({
    surface: SfImportSurface,
    start: Schema.String.pipe(optional),
    end: Schema.String.pipe(optional),
  }),
  output: SfFilesPortResult(Schema.Array(Schema.Struct({
    label: Schema.String,
    surface: SfImportSurface,
    selectionRef: Schema.String,
    formats: Schema.Array(Schema.String),
    sheet: Schema.String.pipe(optional),
    period: SfFilePeriod.pipe(optional),
  }))),
} as const

export const SfFilesImportReference = {
  operationId: "files.import-reference",
  input: Schema.Struct({ surface: SfFileSurface, importPreviewRef: NonEmptyRef }),
  output: SfFilesPortResult(SfImportReadReference),
} as const

export const SfFilesImportDetail = {
  operationId: "files.import-detail",
  input: ImportManifestId,
  output: SfFilesPortResult(SfImportReadDetail),
} as const

export const SfFilesImportAdmit = {
  operationId: "files.import-admit",
  input: Schema.Struct({
    ...ImportSelection.fields,
    options: SfImportOptions,
    fileName: Schema.String,
    mediaType: Schema.String,
    bytes: SfFilesUploadBytes,
  }),
  output: SfFilesPortResult(Schema.Struct({
    ref: Schema.String,
    digest: Schema.String,
    expiresAt: Schema.String,
  })),
} as const

export const SfFilesImportPreview = {
  operationId: "files.import-preview",
  input: Schema.Struct({
    ...ImportLocation.fields,
    admittedFileRef: NonEmptyRef,
    format: Schema.String,
    options: SfImportPreviewOptions,
  }),
  output: Schema.Union([ImportPreviewSuccess, SfFilesFailure]),
} as const

export const SfFilesImportApply = {
  operationId: "files.import-apply",
  input: ImportManifestId,
  output: SfFilesPortResult(SfImportManifest),
} as const

export const SfFilesDocumentRequests = {
  operationId: "files.document-requests",
  input: HostSurface,
  output: SfFilesPortResult(Schema.Array(Schema.Struct({
    selectionRef: Schema.String,
    label: Schema.String,
  }))),
} as const

export const SfFilesDocumentSearch = {
  operationId: "files.document-search",
  input: Schema.Struct({
    ...HostSurface.fields,
    query: Schema.String,
    documentRefs: Schema.Array(NonEmptyRef).pipe(optional),
    limit: PositiveInt,
  }),
  output: SfFilesPortResult(Schema.Struct({
    matches: Schema.Array(DocumentSearchMatch),
    limitations: Schema.Array(Schema.String),
  })),
} as const

export const SfFilesDocumentOpen = {
  operationId: "files.document-open",
  input: Schema.Struct({ ...HostSurface.fields, ref: SfDocumentRef }),
  output: SfFilesPortResult(Schema.Struct({
    title: Schema.String,
    href: Schema.String.pipe(optional),
    excerpt: Schema.String,
    location: Schema.String,
  })),
} as const

export const SfFilesDocumentSchemas = {
  operationId: "files.document-schemas",
  input: DocumentRefSelector,
  output: SfFilesPortResult(Schema.Array(SfDocumentFieldRecord)),
} as const

export const SfFilesDocumentSchema = {
  operationId: "files.document-schema",
  input: Schema.Struct({ ...HostSurface.fields, ...SfDocumentFieldDefinition.fields }),
  output: SfFilesPortResult(SfDocumentFieldRecord),
} as const

export const SfFilesDocumentSources = {
  operationId: "files.document-sources",
  input: Schema.Struct({
    ...HostSurface.fields,
    requestSelectionRef: Schema.String.pipe(optional),
  }),
  output: SfFilesPortResult(Schema.Array(Schema.Struct({
    selectionRef: Schema.String,
    label: Schema.String,
    surface: Schema.Literals(["dashboard", "procurement"]),
  }))),
} as const

export const SfFilesDocumentAdmit = {
  operationId: "files.document-admit",
  input: Schema.Struct({ ...HostSurface.fields, selectionRef: Schema.String }),
  output: SfFilesPortResult(Schema.Struct({ documentRef: Schema.String })),
} as const

export const SfFilesDocumentExtract = {
  operationId: "files.document-extract",
  input: Schema.Struct({
    ...HostSurface.fields,
    documentRef: Schema.String,
    fieldSchemaRef: Schema.String,
  }),
  output: SfFilesPortResult(SfDocumentEvidence),
} as const

/** Existing human-governed document mutation route; the legacy confirm body remains unchanged. */
export const SfFilesDocumentConfirm = {
  operationId: "files.document-confirm",
  input: Schema.Union([
    Schema.Struct({ ...HostSurface.fields, evidence: SfDocumentEvidence }),
    DocumentRejection,
    DocumentLink,
  ]),
  output: SfFilesPortResult(Schema.Union([SfDocumentEvidence, DocumentLinkReceipt])),
} as const

export const SfFilesDocumentCandidates = {
  operationId: "files.document-candidates",
  input: DocumentRefSelector,
  output: SfFilesPortResult(Schema.Array(SfDocumentEvidence)),
} as const

export const SfFilesDocumentScenarioTargets = {
  operationId: "files.document-scenario-targets",
  input: Schema.Struct({ ...HostSurface.fields, ref: SfDocumentRef }),
  output: SfFilesPortResult(Schema.Array(ScenarioTarget)),
} as const

export const SfFilesDocumentScenarioPreview = {
  operationId: "files.document-scenario-preview",
  input: DocumentScenarioInput,
  output: SfFilesPortResult(Schema.Struct({
    // Scenario/engine math is consumed ONLY through the Planner contract. These
    // two values are opaque producer results, not a second financial schema.
    request: Schema.Json,
    scenario: Schema.Json,
    evidence: SfDocumentEvidence,
    domainApplied: Schema.Literal(false),
  })),
} as const

export const SfFilesAssetLink = {
  operationId: "files.asset.link",
  input: Schema.Struct({ surface: SfAssetSurface, assetId: Schema.String }),
  output: Schema.Union([SourceLink, SfFilesLegacyFailure]),
} as const

export const SfFilesAssetDownload = {
  operationId: "files.asset.download",
  input: Schema.Struct({
    surface: SfAssetSurface,
    assetId: Schema.String,
    expires: PositiveInt,
    signature: Schema.String,
  }),
  output: SfFilesDownloadBytes,
} as const

export const SfFilesAssetUpload = {
  operationId: "files.asset.upload",
  input: Schema.Struct({
    surface: SfAssetSurface,
    upload: Schema.Literals(["contract", "quote", "signed-po", "supplier"]),
    record: Schema.String,
    recordVersion: NonNegativeInt,
    name: Schema.String,
    page: Schema.String,
    mediaType: Schema.String,
    bytes: SfFilesUploadBytes,
  }),
  output: Schema.Union([AssetUploadSuccess, SfFilesLegacyFailure]),
} as const

export const SfFilesExportXlsx = {
  operationId: "files.export.xlsx",
  input: Schema.Struct({ surface: Schema.Literal("planner") }),
  output: SfFilesDownloadBytes,
} as const
export const SfFilesExportSuppliers = {
  operationId: "files.export.suppliers",
  input: Schema.Struct({ surface: Schema.Literal("procurement") }),
  output: SfFilesDownloadBytes,
} as const
export const SfFilesExportRegister = {
  operationId: "files.export.register",
  input: Schema.Struct({ surface: Schema.Literal("procurement") }),
  output: SfFilesDownloadBytes,
} as const
export const SfFilesExportJson = {
  operationId: "files.export.json",
  input: Schema.Struct({ surface: Schema.Literal("dashboard") }),
  output: SfFilesDownloadBytes,
} as const
export const SfFilesExportMembers = {
  operationId: "files.export.members",
  input: Schema.Struct({ surface: Schema.Literal("dashboard") }),
  output: SfFilesDownloadBytes,
} as const
export const SfFilesExportReview = {
  operationId: "files.export.review",
  input: Schema.Struct({ surface: Schema.Literal("dashboard"),
    artifactRef: Schema.String.check(Schema.isPattern(/^report:[a-f0-9]{64}$/)) })
    .annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: SfFilesDownloadBytes,
} as const

export const SfFiles = {
  operations: {
    "files.import-targets": SfFilesImportTargets,
    "files.import-reference": SfFilesImportReference,
    "files.import-detail": SfFilesImportDetail,
    "files.import-admit": SfFilesImportAdmit,
    "files.import-preview": SfFilesImportPreview,
    "files.import-apply": SfFilesImportApply,
    "files.document-requests": SfFilesDocumentRequests,
    "files.document-search": SfFilesDocumentSearch,
    "files.document-open": SfFilesDocumentOpen,
    "files.document-schemas": SfFilesDocumentSchemas,
    "files.document-schema": SfFilesDocumentSchema,
    "files.document-sources": SfFilesDocumentSources,
    "files.document-admit": SfFilesDocumentAdmit,
    "files.document-extract": SfFilesDocumentExtract,
    "files.document-confirm": SfFilesDocumentConfirm,
    "files.document-candidates": SfFilesDocumentCandidates,
    "files.document-scenario-targets": SfFilesDocumentScenarioTargets,
    "files.document-scenario-preview": SfFilesDocumentScenarioPreview,
    "files.asset.link": SfFilesAssetLink,
    "files.asset.download": SfFilesAssetDownload,
    "files.asset.upload": SfFilesAssetUpload,
    "files.export.xlsx": SfFilesExportXlsx,
    "files.export.suppliers": SfFilesExportSuppliers,
    "files.export.register": SfFilesExportRegister,
    "files.export.json": SfFilesExportJson,
    "files.export.members": SfFilesExportMembers,
    "files.export.review": SfFilesExportReview,
  },
} as const

export type SfFilesOperationId = keyof typeof SfFiles.operations
export type SfFilesOperationInput<K extends SfFilesOperationId> =
  Schema.Schema.Type<(typeof SfFiles.operations)[K]["input"]>
export type SfFilesOperationOutput<K extends SfFilesOperationId> =
  Schema.Schema.Type<(typeof SfFiles.operations)[K]["output"]>
