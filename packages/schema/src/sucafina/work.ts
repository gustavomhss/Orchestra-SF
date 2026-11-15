/**
 * A12 native UI work/search/personal-views contracts.
 * Source-locked to the C58 producers. No private host type, HTML, runtime or
 * alternate preference store enters this browser-safe module.
 *
 * The four views.* operations below describe ONLY the existing v1 wire.
 * schemaVersion:2 is intentionally not an admitted codec: the real
 * personal-views.ts V2 producer has not been released.
 */
import { Schema } from "effect"
import { optional } from "../schema"

const NonEmpty = Schema.String.check(Schema.isMinLength(1))
const ShortRef = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(16_384))
const DatePart = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/))
const Period = Schema.Struct({ start: DatePart, end: DatePart })
const PositiveVersion = Schema.Int.check(Schema.isGreaterThan(0))
const NonNegativeVersion = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

const ProjectionFailure = Schema.Struct({
  status: Schema.Literals(["invalid", "denied", "unavailable", "stale", "conflict", "needs-input"]),
  reason: NonEmpty.pipe(optional),
})
const result = <V extends Schema.Top>(value: V) => Schema.Union([
  Schema.Struct({ status: Schema.Literal("ok"), value }),
  ProjectionFailure,
])

// Search's documentRef is a *typed* SF evidence reference, not opaque JSON.
// Document search presently emits document refs, but the published
// sf_knowledge_search output contract permits all six canonical evidence kinds.
export type SfWorkEvidenceRef = Readonly<{
  schema: "sf-evidence-v1"
  refId: string
  installationId: string
  projectId: string
  refDigest: string
  evidenceLevel: "observed" | "claim" | "assumption" | "proposal" | "decision"
} & (
  | { kind: "record"; target: { surface: "dashboard" | "planner" | "procurement"; recordType: string; recordId: string; incarnation: string; version: number; fields: readonly string[]; period?: { start: string; end: string }; projectionDigest: string } }
  | { kind: "document"; target: { documentId: string; incarnation: string; revision: number; blobDigest: { algorithm: "sha256"; value: string }; segment: { start: number; end: number; unit: "utf16"; textDigest: { algorithm: "sha256"; value: string } }; ragSourceId?: string; ragRevisionId?: string; ragSourceHash?: { algorithm: "blake3"; value: string }; fieldCandidateId?: string; confirmationVersion?: number } }
  | { kind: "calculation"; target: { calculationId: string; runId: string; engineVersion: string; inputDigest: string; resultDigest: string; sourceRefs: readonly SfWorkEvidenceRef[]; period: { start: string; end: string }; currency: string } }
  | { kind: "receipt"; target: { surface: "dashboard" | "planner" | "procurement"; receiptId: string; idempotencyKey: string; targetIncarnation: string; commandDigest: string; version: number } }
  | { kind: "case-event"; target: { caseId: string; caseIncarnation: string; caseVersion: number; eventId: string; outputDigest: string; evidenceRefs: readonly SfWorkEvidenceRef[] } }
  | { kind: "policy"; target: { packageId: string; version: string; sourceDigest: string; ruleId: string; reviewRef: string; scope: string } }
)>

const Digest = Schema.Struct({ algorithm: Schema.Literal("sha256"), value: NonEmpty })
const EvidenceIdentity = {
  schema: Schema.Literal("sf-evidence-v1"),
  refId: NonEmpty,
  installationId: NonEmpty,
  projectId: NonEmpty,
  refDigest: NonEmpty,
  evidenceLevel: Schema.Literals(["observed", "claim", "assumption", "proposal", "decision"]),
}
export const SfWorkEvidence = Schema.suspend((): Schema.Schema<SfWorkEvidenceRef> => Schema.Union([
  Schema.Struct({ ...EvidenceIdentity, kind: Schema.Literal("record"), target: Schema.Struct({
    surface: Schema.Literals(["dashboard", "planner", "procurement"]),
    recordType: NonEmpty, recordId: NonEmpty, incarnation: NonEmpty,
    version: NonNegativeVersion, fields: Schema.Array(NonEmpty),
    period: Period.pipe(optional), projectionDigest: NonEmpty,
  }) }),
  Schema.Struct({ ...EvidenceIdentity, kind: Schema.Literal("document"), target: Schema.Struct({
    documentId: NonEmpty, incarnation: NonEmpty, revision: NonNegativeVersion,
    blobDigest: Digest,
    segment: Schema.Struct({ start: NonNegativeVersion, end: NonNegativeVersion, unit: Schema.Literal("utf16"), textDigest: Digest }),
    ragSourceId: NonEmpty.pipe(optional), ragRevisionId: NonEmpty.pipe(optional),
    ragSourceHash: Schema.Struct({ algorithm: Schema.Literal("blake3"), value: NonEmpty }).pipe(optional),
    fieldCandidateId: NonEmpty.pipe(optional), confirmationVersion: NonNegativeVersion.pipe(optional),
  }) }),
  Schema.Struct({ ...EvidenceIdentity, kind: Schema.Literal("calculation"), target: Schema.Struct({
    calculationId: NonEmpty, runId: NonEmpty, engineVersion: NonEmpty,
    inputDigest: NonEmpty, resultDigest: NonEmpty,
    sourceRefs: Schema.Array(SfWorkEvidence), period: Period, currency: NonEmpty,
  }) }),
  Schema.Struct({ ...EvidenceIdentity, kind: Schema.Literal("receipt"), target: Schema.Struct({
    surface: Schema.Literals(["dashboard", "planner", "procurement"]),
    receiptId: NonEmpty, idempotencyKey: NonEmpty, targetIncarnation: NonEmpty,
    commandDigest: NonEmpty, version: NonNegativeVersion,
  }) }),
  Schema.Struct({ ...EvidenceIdentity, kind: Schema.Literal("case-event"), target: Schema.Struct({
    caseId: NonEmpty, caseIncarnation: NonEmpty, caseVersion: NonNegativeVersion,
    eventId: NonEmpty, outputDigest: NonEmpty, evidenceRefs: Schema.Array(SfWorkEvidence),
  }) }),
  Schema.Struct({ ...EvidenceIdentity, kind: Schema.Literal("policy"), target: Schema.Struct({
    packageId: NonEmpty, version: NonEmpty, sourceDigest: NonEmpty, ruleId: NonEmpty,
    reviewRef: NonEmpty, scope: NonEmpty,
  }) }),
]))

const WorkItem = Schema.Struct({
  kind: Schema.Literals(["clarification", "handoff", "procurement", "confirmation", "signal"]),
  actionRef: NonEmpty,
  title: Schema.Union([Schema.String, Schema.Null]),
  ownerRef: NonEmpty,
  ownerLabel: Schema.String.pipe(optional),
  approvalStage: Schema.String.pipe(optional),
  reason: Schema.String.pipe(optional),
  due: Schema.String.pipe(optional),
  period: Period.pipe(optional),
  sourceVersion: NonNegativeVersion.pipe(optional),
  observedVersion: NonNegativeVersion.pipe(optional),
  state: Schema.String,
  destination: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("thread"), threadId: NonEmpty }),
    Schema.Struct({ kind: Schema.Literal("hot-topic"), topicId: NonEmpty }),
    Schema.Struct({ kind: Schema.Literal("procurement-request"), recordId: NonEmpty, incarnation: NonEmpty }),
    Schema.Struct({ kind: Schema.Literal("confirmation"), confirmationId: NonEmpty }),
    Schema.Struct({ kind: Schema.Literal("signal"), ref: NonEmpty }),
  ]).pipe(optional),
})
const HomeCases = Schema.Union([
  Schema.Struct({ status: Schema.Literal("ok"), items: Schema.Array(Schema.Struct({
    caseRef: NonEmpty, title: Schema.String, version: NonNegativeVersion,
  })) }),
  Schema.Struct({ status: Schema.Literal("unavailable") }),
])
const HomeRuns = Schema.Union([
  Schema.Struct({ status: Schema.Literal("ok"), items: Schema.Array(Schema.Struct({
    admission: Schema.String, runRef: NonEmpty.pipe(optional),
  })) }),
  Schema.Struct({ status: Schema.Literal("unavailable") }),
])

export const SfProjectionHome = {
  Input: Schema.Struct({}),
  Output: result(Schema.Struct({
    cases: HomeCases,
    routines: HomeRuns,
    workProducer: Schema.Literals(["available", "unavailable"]),
    personalViewsProducer: Schema.Literals(["available", "unavailable"]),
  })),
} as const
export const SfProjectionSearch = {
  Input: Schema.Struct({ q: NonEmpty }),
  Output: result(Schema.Struct({
    matches: Schema.Array(Schema.Struct({ documentRef: SfWorkEvidence, text: Schema.String, lexicalScore: Schema.Finite })),
    limitations: Schema.Array(Schema.String),
  })),
} as const
export const SfProjectionWork = {
  Input: Schema.Struct({ selectionRef: ShortRef, start: DatePart, end: DatePart }),
  Output: result(Schema.Struct({ items: Schema.Array(WorkItem) })),
} as const
export const SfProjectionWorkItem = {
  Input: Schema.Struct({ selectionRef: ShortRef, actionRef: ShortRef, start: DatePart, end: DatePart }),
  Output: result(Schema.Struct({
    item: WorkItem,
    details: Schema.Array(Schema.Struct({ label: Schema.String, value: Schema.String })),
    links: Schema.Array(Schema.Struct({ label: Schema.String, url: Schema.String })),
  })),
} as const
export const SfProjectionWorkSelection = {
  Input: Schema.Struct({ start: DatePart, end: DatePart }),
  Output: result(Schema.Struct({ selectionRef: NonEmpty, label: Schema.String, period: Period })),
} as const

// The original producer's pages, ranges and optional keys (never a native
// route, no future V2 fields, no role information). Final page-specific
// selection authorization remains with personal-views.ts on the host.
const ViewId = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{8,128}$/))
const Title = Schema.String.check(Schema.isMaxLength(120), Schema.isPattern(/\S/))
const Year = Schema.String.check(Schema.isPattern(/^(|202[4-7])$/))
const Month = Schema.String.check(Schema.isPattern(/^(|[1-9]|1[0-2])$/))
const FilterValue = Schema.String.check(Schema.isMaxLength(500))
const Selections = Schema.Struct({
  year: Year.pipe(optional), own: Year.pipe(optional),
  execYear: Year.pipe(optional), opsYear: Year.pipe(optional), secYear: Year.pipe(optional),
  month: Month.pipe(optional), executiveMonth: Month.pipe(optional),
  operationsMonth: Month.pipe(optional), securityMonth: Month.pipe(optional),
  opsMonth: Month.pipe(optional),
  version: FilterValue.pipe(optional), owner: FilterValue.pipe(optional),
  class: FilterValue.pipe(optional), mode: FilterValue.pipe(optional),
  filter: FilterValue.pipe(optional), status: FilterValue.pipe(optional),
  topicStatus: FilterValue.pipe(optional), memberStatus: FilterValue.pipe(optional),
  request: FilterValue.pipe(optional), supplier: FilterValue.pipe(optional),
})
const Filters = Schema.Struct({
  query: FilterValue.pipe(optional), selections: Selections.pipe(optional),
})
const ViewFields = {
  id: ViewId, title: Title,
  period: Period.pipe(optional),
  currency: Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/)).pipe(optional),
  density: Schema.Literals(["comfortable", "compact"]).pipe(optional),
  filters: Filters.pipe(optional),
}
export const SfPersonalViewLegacy = Schema.Union([
  Schema.Struct({ ...ViewFields, surface: Schema.Literal("dashboard"), page: Schema.Literals([
    "Executive Dashboard", "Hot Topics & Actions", "Budget Overview", "OPEX Detail",
    "CAPEX Projects", "Headcount Overview", "Team Structure", "Talent Review",
    "Portfolio Dashboard", "All Projects", "IT Operations", "IT Security KPIs",
    "IT Risks", "Vendor Contracts", "Stakeholder Management", "IT Performance Contract",
  ]) }),
  Schema.Struct({ ...ViewFields, surface: Schema.Literal("planner"), page: Schema.Literals([
    "Overview", "OPEX", "CAPEX", "Headcount", "Entities & allocations", "FX rates", "Versions",
  ]) }),
  Schema.Struct({ ...ViewFields, surface: Schema.Literal("procurement"), page: Schema.Literals([
    "Dashboard", "Requests", "My approvals", "Suppliers", "Settings",
  ]) }),
])
export const SfPersonalViewRecord = Schema.Struct({ view: SfPersonalViewLegacy, version: PositiveVersion })
export const SfUnavailablePersonalView = Schema.Struct({
  id: ViewId, version: PositiveVersion, availability: Schema.Literal("unavailable"),
})
const ViewError = Schema.Struct({
  status: Schema.Literals(["denied", "unavailable", "invalid", "stale", "conflict", "needs-input"]),
})
export const SfViewsList = {
  Input: Schema.Struct({ action: Schema.Literal("list"), input: Schema.Struct({}) }),
  Output: Schema.Union([
    Schema.Struct({ status: Schema.Literal("ok"), value: Schema.Array(Schema.Union([SfPersonalViewRecord, SfUnavailablePersonalView])) }),
    ViewError,
  ]),
} as const
export const SfViewsOpen = {
  Input: Schema.Struct({ action: Schema.Literal("open"), input: Schema.Struct({ id: ViewId }) }),
  Output: Schema.Union([Schema.Struct({ status: Schema.Literal("ok"), value: SfPersonalViewRecord }), ViewError]),
} as const
export const SfViewsSave = {
  Input: Schema.Struct({ action: Schema.Literal("save"), input: Schema.Struct({
    view: SfPersonalViewLegacy,
    expectedVersion: Schema.Union([PositiveVersion, Schema.Null]),
  }) }),
  Output: Schema.Union([Schema.Struct({ status: Schema.Literal("ok"), value: SfPersonalViewRecord }), ViewError]),
} as const
export const SfViewsRemove = {
  Input: Schema.Struct({ action: Schema.Literal("remove"), input: Schema.Struct({
    id: ViewId, expectedVersion: PositiveVersion,
  }) }),
  Output: Schema.Union([Schema.Struct({ status: Schema.Literal("ok"), value: Schema.Struct({ removed: Schema.Literal(true) }) }), ViewError]),
} as const

/** All 9 IDs are the exact frozen catalog keys. I00 admits only installed codecs. */
export const SfWork = {
  operations: {
    "projection.home": { operationId: "projection.home", input: SfProjectionHome.Input, output: SfProjectionHome.Output },
    "projection.search": { operationId: "projection.search", input: SfProjectionSearch.Input, output: SfProjectionSearch.Output },
    "projection.work": { operationId: "projection.work", input: SfProjectionWork.Input, output: SfProjectionWork.Output },
    "projection.work-item": { operationId: "projection.work-item", input: SfProjectionWorkItem.Input, output: SfProjectionWorkItem.Output },
    "projection.work-selection": { operationId: "projection.work-selection", input: SfProjectionWorkSelection.Input, output: SfProjectionWorkSelection.Output },
    "views.list": { operationId: "views.list", input: SfViewsList.Input, output: SfViewsList.Output },
    "views.open": { operationId: "views.open", input: SfViewsOpen.Input, output: SfViewsOpen.Output },
    "views.remove": { operationId: "views.remove", input: SfViewsRemove.Input, output: SfViewsRemove.Output },
    "views.save": { operationId: "views.save", input: SfViewsSave.Input, output: SfViewsSave.Output },
  },
} as const
