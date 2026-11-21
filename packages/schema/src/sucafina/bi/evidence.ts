import { Schema } from "effect"
import { optional } from "../../schema"

export const Period = Schema.Struct({
  start: Schema.String,
  end: Schema.String,
})

export type EvidenceRefType = Readonly<{
  schema: "sf-evidence-v1"
  refId: string
  installationId: string
  projectId: string
  refDigest: string
  evidenceLevel: "observed" | "claim" | "assumption" | "proposal" | "decision"
}> & (
  | Readonly<{ kind: "record"; target: Readonly<{
      surface: "dashboard" | "planner" | "procurement"
      recordType: string; recordId: string; incarnation: string; version: number
      fields: readonly string[]; period?: typeof Period.Type; projectionDigest: string
    }> }>
  | Readonly<{ kind: "document"; target: Readonly<{
      documentId: string; incarnation: string; revision: number
      blobDigest: Readonly<{ algorithm: "sha256"; value: string }>
      segment: Readonly<{ start: number; end: number; unit: "utf16"; textDigest: Readonly<{ algorithm: "sha256"; value: string }> }>
      ragSourceId?: string; ragRevisionId?: string
      ragSourceHash?: Readonly<{ algorithm: "blake3"; value: string }>
      fieldCandidateId?: string; confirmationVersion?: number
    }> }>
  | Readonly<{ kind: "calculation"; target: Readonly<{
      calculationId: string; runId: string; engineVersion: string; inputDigest: string
      resultDigest: string; sourceRefs: readonly EvidenceRefType[]; period: typeof Period.Type; currency: string
    }> }>
  | Readonly<{ kind: "receipt"; target: Readonly<{
      surface: "dashboard" | "planner" | "procurement"; receiptId: string
      idempotencyKey: string; targetIncarnation: string; commandDigest: string; version: number
    }> }>
  | Readonly<{ kind: "case-event"; target: Readonly<{
      caseId: string; caseIncarnation: string; caseVersion: number
      eventId: string; outputDigest: string; evidenceRefs: readonly EvidenceRefType[]
    }> }>
  | Readonly<{ kind: "policy"; target: Readonly<{
      packageId: string; version: string; sourceDigest: string; ruleId: string
      reviewRef: string; scope: string
    }> }>
)

const EvidenceBase = Schema.Struct({
  schema: Schema.Literal("sf-evidence-v1"),
  refId: Schema.String,
  installationId: Schema.String,
  projectId: Schema.String,
  refDigest: Schema.String,
  evidenceLevel: Schema.Literals(["observed", "claim", "assumption", "proposal", "decision"]),
})
const Sha256 = Schema.Struct({ algorithm: Schema.Literal("sha256"), value: Schema.String })

// Suspended to preserve exact recursive evidence ancestry without a JSON/Unknown escape hatch.
export const EvidenceRef: Schema.Schema<EvidenceRefType> = Schema.suspend(() => Schema.Union([
  Schema.Struct({
    ...EvidenceBase.fields,
    kind: Schema.Literal("record"),
    target: Schema.Struct({
      surface: Schema.Literals(["dashboard", "planner", "procurement"]),
      recordType: Schema.String,
      recordId: Schema.String,
      incarnation: Schema.String,
      version: Schema.Int,
      fields: Schema.Array(Schema.String),
      period: optional(Period),
      projectionDigest: Schema.String,
    }),
  }),
  Schema.Struct({
    ...EvidenceBase.fields,
    kind: Schema.Literal("document"),
    target: Schema.Struct({
      documentId: Schema.String,
      incarnation: Schema.String,
      revision: Schema.Int,
      blobDigest: Sha256,
      segment: Schema.Struct({ start: Schema.Int, end: Schema.Int, unit: Schema.Literal("utf16"), textDigest: Sha256 }),
      ragSourceId: optional(Schema.String),
      ragRevisionId: optional(Schema.String),
      ragSourceHash: optional(Schema.Struct({ algorithm: Schema.Literal("blake3"), value: Schema.String })),
      fieldCandidateId: optional(Schema.String),
      confirmationVersion: optional(Schema.Int),
    }),
  }),
  Schema.Struct({
    ...EvidenceBase.fields,
    kind: Schema.Literal("calculation"),
    target: Schema.Struct({
      calculationId: Schema.String,
      runId: Schema.String,
      engineVersion: Schema.String,
      inputDigest: Schema.String,
      resultDigest: Schema.String,
      sourceRefs: Schema.Array(EvidenceRef),
      period: Period,
      currency: Schema.String,
    }),
  }),
  Schema.Struct({
    ...EvidenceBase.fields,
    kind: Schema.Literal("receipt"),
    target: Schema.Struct({
      surface: Schema.Literals(["dashboard", "planner", "procurement"]),
      receiptId: Schema.String,
      idempotencyKey: Schema.String,
      targetIncarnation: Schema.String,
      commandDigest: Schema.String,
      version: Schema.Int,
    }),
  }),
  Schema.Struct({
    ...EvidenceBase.fields,
    kind: Schema.Literal("case-event"),
    target: Schema.Struct({
      caseId: Schema.String,
      caseIncarnation: Schema.String,
      caseVersion: Schema.Int,
      eventId: Schema.String,
      outputDigest: Schema.String,
      evidenceRefs: Schema.Array(EvidenceRef),
    }),
  }),
  Schema.Struct({
    ...EvidenceBase.fields,
    kind: Schema.Literal("policy"),
    target: Schema.Struct({
      packageId: Schema.String,
      version: Schema.String,
      sourceDigest: Schema.String,
      ruleId: Schema.String,
      reviewRef: Schema.String,
      scope: Schema.String,
    }),
  }),
]))

export const Receipt = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("ui"),
    operation: Schema.String,
    handlerExport: Schema.String,
    inputDigest: Schema.String,
    resultDigest: optional(Schema.String),
    principalRef: Schema.String,
    callId: Schema.String,
    accessRevision: Schema.String,
    at: Schema.String,
    requestId: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("native"),
    operation: Schema.String,
    handlerExport: Schema.String,
    inputDigest: Schema.String,
    resultDigest: optional(Schema.String),
    principalRef: Schema.String,
    callId: Schema.String,
    accessRevision: Schema.String,
    at: Schema.String,
    runId: Schema.String,
    nativeSessionId: Schema.String,
    providerGeneration: Schema.Int,
  }),
])
