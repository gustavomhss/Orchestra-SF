/**
 * A07 — closed, browser-safe contracts for the installed review producers.
 * Source pins: dashboard-http.ts@72dc59d7 and extended-http.ts@5e14d72b;
 * catalog 31dbec1726fd8147156b01dc545726650ffd49e1.
 *
 * These codecs do NOT authorize a principal or replay producer projections.
 * The host performs current admission, redaction and source revalidation.
 */
import { Schema } from "effect"

const Text = Schema.NonEmptyString
const Integer = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const Positive = Schema.Int.check(Schema.isGreaterThan(0))
const Period = Schema.Struct({ start: Text, end: Text }).annotate({ parseOptions: { onExcessProperty: "error" } })
const RefList = Schema.Array(Text)
const QueryId = Schema.Struct({ id: Text }).annotate({ parseOptions: { onExcessProperty: "error" } })
const Error = Schema.Struct({
  status: Schema.Literals(["needs-input", "stale", "denied", "unavailable", "conflict", "provider-conflict", "failed", "invalid"]),
  // Current C58 dashboard reads sometimes give status alone. Do not recast 503 into revocation.
  reason: Schema.optional(Schema.String),
})
const Result = <S extends Schema.Top>(value: S) =>
  Schema.Union([Schema.Struct({ status: Schema.Literal("ok"), value }), Error])

const SourceRef = Schema.Struct({
  surface: Schema.Literals(["dashboard", "planner", "procurement"]),
  type: Text, id: Text, incarnation: Text, version: Integer,
  fields: RefList, period: Period, observedAt: Text,
})
const EvidenceIdentity = {
  schema: Schema.Literal("sf-evidence-v1"), refId: Text, installationId: Text,
  projectId: Text, refDigest: Text,
  evidenceLevel: Schema.Literals(["observed", "claim", "assumption", "proposal", "decision"]),
}
const EvidenceRecord = Schema.Struct({
  ...EvidenceIdentity, kind: Schema.Literal("record"),
  target: Schema.Struct({
    surface: Schema.Literals(["dashboard", "planner", "procurement"]),
    recordType: Text, recordId: Text, incarnation: Text, version: Integer, fields: RefList,
    period: Schema.optional(Period), projectionDigest: Text,
  }),
})
const EvidenceOther = Schema.Struct({
  ...EvidenceIdentity, kind: Schema.Literals(["calculation", "document", "receipt", "case-event", "policy"]),
  // These target types are produced by existing C01, never accepted as a command input.
  target: Schema.Record(Schema.String, Schema.Json),
})
const Evidence = Schema.Union([EvidenceRecord, EvidenceOther])
const ProjectionContext = Schema.Struct({
  installationId: Text, projectId: Text, principalRef: Text, accessRevision: Text,
  policyVersion: Text, surface: Schema.Literals(["dashboard", "planner", "procurement"]),
  period: Period, currency: Schema.String, sourceRefs: Schema.Array(SourceRef),
  capabilities: Schema.Array(Schema.String),
})
const ProjectionValue = Schema.Struct({
  id: Text, value: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null]),
  unit: Schema.optional(Schema.String), currency: Schema.optional(Schema.String),
  period: Period, granularity: Schema.Literals(["record", "month", "year", "aggregate"]),
  sourceRefs: Schema.Array(Evidence), drilldown: Schema.NullOr(Evidence),
  evidenceState: Schema.Literals(["confirmed", "estimated", "hypothetical", "absent"]),
})
const ProjectionComponent = Schema.Struct({
  id: Text, amount: Schema.NullOr(Schema.Finite), currency: Schema.String,
  period: Period, sourceRefs: Schema.Array(SourceRef),
  evidenceState: Schema.Literals(["confirmed", "estimated", "hypothetical", "absent"]),
})
export const SfReviewDomainProjection = Schema.Struct({
  context: ProjectionContext, version: Integer, engineVersion: Text,
  // Producers own scenario/portfolio math and decisions. The nested payload is
  // read-only source material, not an input or a client-calculated financial DTO.
  decision: Schema.optional(Schema.Json), comparison: Schema.optional(Schema.Json),
  components: Schema.Array(ProjectionComponent), values: Schema.Array(ProjectionValue),
  missing: Schema.Array(Schema.Struct({
    field: Text,
    reason: Schema.Literals(["missing", "unavailable", "restricted", "not-applicable",
      "incompatible-currency", "missing-fx", "missing-rate", "unconfirmed"]),
  })),
})
const Comment = Schema.Struct({
  id: Text, version: Integer, content: Schema.String, authorRef: Text, createdAt: Text,
  sourceRefs: Schema.Array(SourceRef),
})
const PreservedSection = Schema.Struct({
  id: Text, title: Text, period: Period,
  // Original PreservedReview.content is 'unknown' and is read only after
  // reviews.read performs the complete producer's ACL / continuity checks.
  content: Schema.Json, count: Integer, sourceRefs: Schema.Array(SourceRef),
})
export const SfReviewPreserved = Schema.Struct({
  id: Text, version: Integer, createdAt: Text, sourceRefs: Schema.Array(SourceRef),
  sections: Schema.Array(PreservedSection), comments: Schema.Array(Comment),
  previousReviewRef: Schema.optional(Text),
})
const ReviewSection = Schema.Struct({
  id: Text, title: Text, period: Period, recordCount: Integer,
  projection: SfReviewDomainProjection,
  agendaNote: Schema.optional(Schema.String),
  outcome: Schema.optional(Schema.Json), outcomeComparison: Schema.optional(Schema.Json),
  chart: Schema.optional(Schema.Json), comments: Schema.optional(Schema.Array(Comment)),
})
const AgendaSection = Schema.Struct({
  id: Text, title: Text, selectionRef: Text, topic: Text, period: Period,
  recordRefs: Schema.optional(RefList),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
export const SfDashboardDashboardAgenda = {
  operationId: "dashboard.dashboard-agenda" as const,
  input: Schema.Struct({ sections: Schema.Array(AgendaSection) }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: Result(Schema.Struct({ selectionRef: Text, sections: Schema.Array(ReviewSection) })),
}
export const SfDashboardDashboardCapture = {
  operationId: "dashboard.dashboard-capture" as const,
  input: Schema.Struct({ sourceRef: Text }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: Result(Schema.Struct({ captureId: Text })),
}
export const SfDashboardDashboardHistory = {
  operationId: "dashboard.dashboard-history" as const,
  input: QueryId,
  output: Result(Schema.Struct({
    state: Schema.Literal("historical"), captureId: Text, capturedAt: Text,
    capturedBy: Text, projection: SfReviewDomainProjection,
  })),
}
export const SfDashboardDashboardReview = {
  operationId: "dashboard.dashboard-review" as const,
  input: QueryId, output: Result(SfReviewPreserved),
}
export const SfDashboardDashboardReviewPreserve = {
  operationId: "dashboard.dashboard-review-preserve" as const,
  input: Schema.Struct({
    selectionRef: Text, sectionRefs: RefList, previousReviewRef: Schema.optional(Text),
  }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: Result(SfReviewPreserved),
}
const ReviewAgendaItem = Schema.Struct({
  kind: Schema.Literal("dashboard"), id: Text, topic: Text, selectionRef: Text,
  period: Period, recordRefs: Schema.optional(RefList), agendaNote: Schema.optional(Schema.String),
})
export const SfReviewUpdate = Schema.Struct({
  available: Schema.Boolean, previousReviewRef: Text,
  items: Schema.Array(ReviewAgendaItem),
  confirmations: Schema.Array(Schema.Struct({ sectionId: Text, label: Text })),
  unavailableSections: Schema.Array(Schema.Struct({ sectionId: Text, title: Text, reason: Text })),
})
export const SfProjectionReview = {
  operationId: "projection.review" as const,
  input: Schema.Struct({
    page: Schema.optional(Text), reviewRef: Schema.optional(Text),
    previousReviewRef: Schema.optional(Text), sectionId: Schema.optional(Text),
    reviewThread: Schema.optional(Text), reviewMessage: Schema.optional(Text),
    reviewIncarnation: Schema.optional(Text), reviewVersion: Schema.optional(Text),
    start: Schema.optional(Text), end: Schema.optional(Text),
  }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  // Original HTML bootstrap has three mutually exclusive branches. The new
  // projection exposes only those revalidated producer data, never principalRef.
  output: Result(Schema.Union([
    Schema.Struct({ reviewRef: Text, selectedSection: Schema.optional(Schema.Struct({
      id: Text, title: Text, period: Period, count: Integer, sourceRefs: Schema.Array(SourceRef),
      content: Schema.Json,
    })) }),
    SfReviewUpdate,
    Schema.Struct({ items: Schema.Array(ReviewAgendaItem), period: Period }),
  ])),
}
const ReportRequest = Schema.Struct({
  year: Schema.Literals(["2024", "2025", "2026", "2027"]),
  topic: Schema.Array(Text), title: Schema.optional(Schema.String),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
// Existing download=docx|pptx returns the HTML report-selection workspace.
// There is no JSON success or real Office file at this route. The codec rejects
// fabricated navigation receipts or bytes; F01 navigation is an integration seam.
export const SfReviewsExportDocx = {
  operationId: "reviews.export.docx" as const, input: ReportRequest, output: Schema.Never,
}
export const SfReviewsExportPptx = {
  operationId: "reviews.export.pptx" as const, input: ReportRequest, output: Schema.Never,
}
export const SfReviewsReviewSource = {
  operationId: "reviews.review-source" as const,
  input: Schema.Struct({ reviewRef: Text, referenceId: Text }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  // The producer returns {links} or a real status envelope, never a
  // synthetic PortResult.ok. Close each link before decoding can strip an
  // unexpected authority field; also close the outer/status envelopes.
  output: Schema.Union([
    Schema.Struct({
      links: Schema.Array(Schema.Struct({ label: Text, url: Text })
        .annotate({ parseOptions: { onExcessProperty: "error" } })),
    }).annotate({ parseOptions: { onExcessProperty: "error" } }),
    Error.annotate({ parseOptions: { onExcessProperty: "error" } }),
  ]),
}
export const SfReviewsReviewUpdate = {
  operationId: "reviews.review-update" as const,
  input: Schema.Struct({ reviewRef: Text }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  output: Result(SfReviewUpdate),
}
export const SfReviews = {
  "dashboard.dashboard-agenda": SfDashboardDashboardAgenda,
  "dashboard.dashboard-capture": SfDashboardDashboardCapture,
  "dashboard.dashboard-history": SfDashboardDashboardHistory,
  "dashboard.dashboard-review": SfDashboardDashboardReview,
  "dashboard.dashboard-review-preserve": SfDashboardDashboardReviewPreserve,
  "projection.review": SfProjectionReview,
  "reviews.export.docx": SfReviewsExportDocx,
  "reviews.export.pptx": SfReviewsExportPptx,
  "reviews.review-source": SfReviewsReviewSource,
  "reviews.review-update": SfReviewsReviewUpdate,
} as const

export type SfReviewOperationId = keyof typeof SfReviews
