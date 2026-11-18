/**
 * NORMATIVE PLANNING SPECIFICATION — not product implementation or a test.
 * Revision native-ux-cold-r2. No runtime code is supplied in this file.
 *
 * F03/S01–S05 implement these signatures in their owned paths. I00 publishes
 * the public entrypoints. The declarations here close prop/callback decisions;
 * they do not create permission, transport, domain schemas or a new framework.
 *
 * F01 public route/opaque-reference aliases come from planned
 * packages/schema/src/sucafina/context.ts; APP/context/contracts.ts reexports
 * them. F02 Schema/common owns the closed SfOperationId catalog union.
 * SfResolvedRoute is public Schema/context; SfSurfaceProps is APP-only F01.
 * Actual owner authority/lifecycle stays in APP context, not the public route.
 * Leaves do not redeclare brands; NONE of the pure components takes page props.
 *
 * Surface IDs and localized key unions are generated/composed once by I00
 * from the frozen manifests and leaf dictionaries, not by component authors.
 * All label messages must resolve a frozen typed dictionary key (COPY-01).
 * Raw data text is only for already-authorized domain content, never UI copy.
 * Callbacks return void: parents own async operations, busy/error props and
 * operation correlation. No component fetches, dispatches or logs payloads.
 */
import type { Accessor, JSX } from "solid-js"

import type {
  SfOpaque, SfOwnerKey, SfRef, SfIntentRef, SfFileSelectionRef, SfEditScopeKey,
  SfOperationId, SurfaceId, SfHref, SfOperationRef, SfVersion, SfResolvedRoute,
} from "./route-signatures"
export type {
  SfOpaque, SfOwnerKey, SfRef, SfIntentRef, SfFileSelectionRef, SfEditScopeKey,
  SfOperationId, SurfaceId, SfHref, SfOperationRef, SfVersion,
} from "./route-signatures"
// Product code reuses F01 Schema/context exports; these relative imports are
// only links between normative documents, never Schema -> App dependencies.
export type SfCopyKey = SfOpaque<"key-from-frozen-typed-dictionaries">
export type SfSurfaceProps<Id extends SurfaceId = SurfaceId> = {
  [Current in Id]: Readonly<{ surfaceId: Current; route: SfResolvedRoute<Current> }>
}[Id]
// SfSurfaceProps lives only in APP/context/contracts.ts (F01); pure components
// below do not take this prop or fetch through it. U44 pages own A13 calls.
export type SfDensity = "comfortable" | "compact"
export type SfLayoutMode = "single" | "split" | "split-context"
export type SfScalar = string | number | boolean | null
export type SfMessage = Readonly<{
  key: SfCopyKey
  params?: Readonly<Record<string, string | number>>
}>
export type SfText =
  | Readonly<{ kind: "message"; message: SfMessage }>
  | Readonly<{ kind: "data"; text: string }>
export type SfUiState =
  | "loading" | "ready" | "empty" | "filtered-empty" | "partial"
  | "invalid" | "not-found" | "stale" | "conflict" | "unavailable"
  | "denied" | "session-expired" | "outcome-unknown"
export type SfCoverage = Readonly<{
  state: "complete" | "partial" | "unavailable"
  summary: SfMessage
  reasons: readonly SfMessage[]
  knownCount: number | null
  expectedCount: number | null
}>
export type SfAction = Readonly<{
  id: string
  labelKey: SfCopyKey
  labelParams?: Readonly<Record<string, string | number>>
  tone: "primary" | "secondary" | "danger"
  disabled: boolean
  reasonKey?: SfCopyKey
  busy: boolean
  onInvoke: () => void
}>
export type SfStatus = Readonly<{
  code: string
  text: SfText
  tone: "neutral" | "info" | "success" | "warning" | "danger"
}>
export type SfUnit =
  | Readonly<{ kind: "currency"; code: string }>
  | Readonly<{ kind: "percent" }>
  | Readonly<{ kind: "quantity"; label: SfMessage }>
  | Readonly<{ kind: "unspecified"; label: SfMessage }>
export type SfSource = Readonly<{
  ref: SfRef
  version: SfVersion
  label: SfText
  scope: SfText
  coverage: SfCoverage
}>
export type SfDisplayValue =
  | Readonly<{ kind: "text"; text: SfText }>
  | Readonly<{ kind: "number"; value: number; unit: SfUnit; fractionDigits: number }>
  | Readonly<{ kind: "boolean"; value: boolean; trueLabel: SfMessage; falseLabel: SfMessage }>
  | Readonly<{ kind: "date"; isoDate: string }>
  | Readonly<{ kind: "timestamp"; isoTimestamp: string; timezone: string }>
  | Readonly<{ kind: "missing"; reason: SfMessage }>
  | Readonly<{ kind: "unavailable"; reason: SfMessage }>
  | Readonly<{ kind: "list"; items: readonly SfDisplayValue[] }>

// F03 — one width observer and one state/copy system.
export type SfPageFrameProps = Readonly<{
  titleKey: SfCopyKey
  subtitleKey?: SfCopyKey
  eyebrow?: SfText
  context: readonly Readonly<{ id: string; label: SfMessage; value: SfText }>[]
  tabs: readonly Readonly<{ id: string; labelKey: SfCopyKey; href: SfHref; available: boolean }>[]
  activeTab: string | null
  primaryAction?: SfAction
  secondaryActions: readonly SfAction[]
  density: SfDensity
  layout: "reading" | "work" | "split" | "comparison"
  onLayoutMode: (mode: SfLayoutMode) => void
  children: JSX.Element
}>
export declare function SfPageFrame(props: SfPageFrameProps): JSX.Element

export type SfStatePanelProps = Readonly<{
  state: SfUiState
  messageKey: SfCopyKey
  detailsKey?: SfCopyKey
  coverage?: SfCoverage
  onRetryRead?: () => void
  onLogin?: () => void
  onBack?: () => void
  children?: JSX.Element
}>
export declare function SfStatePanel(props: SfStatePanelProps): JSX.Element

export type SfContextControl = "year" | "period" | "version" | "currency" | "view"
export type SfContextOption = Readonly<{
  id: string
  control: SfContextControl
  value: SfScalar
  label: SfText
  available: boolean
  reason?: SfMessage
}>
export type SfContextBarProps = Readonly<{
  selection: readonly Readonly<{ control: SfContextControl; optionId: string | null }>[]
  catalog: readonly SfContextOption[]
  lockedReasons: readonly Readonly<{ control: SfContextControl; reason: SfMessage }>[]
  onRequestChange: (change: Readonly<{ control: SfContextControl; optionId: string }>) => void
  state: SfUiState
}>
export declare function SfContextBar(props: SfContextBarProps): JSX.Element

// S01 — table state and callbacks never carry a private Snapshot.
export type SfSort = Readonly<{ kind: "none" }> | Readonly<{ kind: "field"; key: string; direction: "asc" | "desc" }>
export type SfPage =
  | Readonly<{ kind: "none"; total: number | null }>
  | Readonly<{ kind: "cursor"; current: SfRef | null; previous: SfRef | null; next: SfRef | null; from: number | null; to: number | null; total: number | null }>
  | Readonly<{ kind: "offset"; index: number; size: number; total: number | null }>
export type SfPageRequest =
  | Readonly<{ kind: "cursor"; direction: "previous" | "next"; cursor: SfRef }>
  | Readonly<{ kind: "offset"; index: number }>
export type SfColumnWidth =
  | Readonly<{ kind: "content"; minPx: number; maxPx: number }>
  | Readonly<{ kind: "fixed"; px: number }>
  | Readonly<{ kind: "flex"; minPx: number; weight: number }>
export type SfColumn<Row> = Readonly<{
  id: string
  labelKey: SfCopyKey
  align: "start" | "center" | "end"
  widthPolicy: SfColumnWidth
  render: (row: Readonly<Row>) => JSX.Element
  sortKey?: string
}>
export type SfRowAction = Readonly<{
  id: string
  labelKey: SfCopyKey
  tone: "secondary" | "danger"
  disabled: boolean
  reason?: SfMessage
  busy: boolean
}>
export type SfDataTableProps<Row> = Readonly<{
  rows: readonly Readonly<Row>[]
  getRowKey: (row: Readonly<Row>) => SfRef
  columns: readonly SfColumn<Row>[]
  selectedKey?: SfRef
  sort: SfSort
  page: SfPage
  onSort: (sort: SfSort) => void
  onPage: (request: SfPageRequest) => void
  onSelect: (recordRef: SfRef) => void
  rowActions: (row: Readonly<Row>) => readonly SfRowAction[]
  onRowAction: (request: Readonly<{ recordRef: SfRef; actionId: string }>) => void
  captionKey: SfCopyKey
  density: SfDensity
  state: SfUiState
}>
export declare function SfDataTable<Row>(props: SfDataTableProps<Row>): JSX.Element

export type SfDetailSection = Readonly<{ id: string; titleKey: SfCopyKey; content: JSX.Element; state: SfUiState }>
export type SfRecordDetailProps = Readonly<{
  title: SfText
  secondaryId?: SfText
  status: SfStatus
  metadata: readonly Readonly<{ id: string; label: SfMessage; value: SfDisplayValue }>[]
  sections: readonly SfDetailSection[]
  primaryAction?: SfAction
  secondaryActions: readonly SfAction[]
  sourceActions: readonly SfAction[]
  onBack: () => void
  onOpenPage: () => void
}>
export declare function SfRecordDetail(props: SfRecordDetailProps): JSX.Element
export type SfListDetailProps = Readonly<{
  list: JSX.Element
  detail: JSX.Element
  selectedRef?: SfRef
  onBack: () => void
  onOpenPage: () => void
  layoutMode: SfLayoutMode
}>
export declare function SfListDetail(props: SfListDetailProps): JSX.Element

// S02 — month IDs are fixed; coordinate identity is never an array index.
export type SfMonthId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
export type SfMonth = Readonly<{ id: SfMonthId; labelKey: SfCopyKey; closed: boolean }>
export type SfCellCoordinate = Readonly<{ rowRef: SfRef; month: SfMonthId; measure: "budget" | "actual" | "forecast" | "fte" | "cost" }>
export type SfCellValue =
  | Readonly<{ kind: "known"; value: number; unit: SfUnit; origin: SfSource }>
  | Readonly<{ kind: "missing"; reason: SfMessage }>
  | Readonly<{ kind: "inherited"; value: number | null; unit: SfUnit; sourceRef: SfRef; sourceVersion: SfVersion }>
  | Readonly<{ kind: "unavailable"; reason: SfMessage }>
export type SfGridCell = Readonly<{
  coordinate: SfCellCoordinate
  value: SfCellValue
  permission: Readonly<{ editable: true }> | Readonly<{ editable: false; reason: SfMessage }>
  fractionDigits: number
}>
export type SfDraftCell = Readonly<{
  coordinate: SfCellCoordinate
  text: string
  dirty: boolean
  error?: SfMessage
}>
export type SfGridNavigation = Readonly<{
  from: SfCellCoordinate
  key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End" | "Control+Home" | "Control+End" | "PageUp" | "PageDown"
  visibleRowCount: number
}>
// S02 — producer-backed TSV range/paste; month coordinates here are zero-based
// but MonthlyDraft.cells.month in monthly-edit.ts is 1..12. A02 maps +1 once.
export type SfGridRange = Readonly<{ anchor: SfCellCoordinate; extent: SfCellCoordinate }>
export type SfPasteMeasure = "budget" | "actual" | "forecast"
export type SfPasteCell = Readonly<{ coordinate: SfCellCoordinate; rawText: string; issue?: SfMessage }>
export type SfPasteRow = Readonly<{
  rowRef: SfRef; revision: number; cells: readonly SfPasteCell[]
  result: "ready" | "invalid" | "locked" | "applied" | "conflict" | "failed"
  issues: readonly SfMessage[]
}>
export type SfPasteState =
  | Readonly<{ phase: "idle" }>
  | Readonly<{ phase: "preparing"; originalTsv: string; range: SfGridRange }>
  | Readonly<{ phase: "review" | "applying" | "partial" | "conflict" | "failed"; originalTsv: string; range: SfGridRange; rows: readonly SfPasteRow[] }>
  | Readonly<{ phase: "complete"; appliedRowRefs: readonly SfRef[] }>
export type SfPasteRequest = Readonly<{ range: SfGridRange; originalTsv: string }>
export type SfMonthlyGridProps<Row> = Readonly<{
  rows: readonly Readonly<Row>[]
  months: readonly SfMonth[] // exactly 0..11, once each; January label is index 0
  columns: readonly SfColumn<Row>[] // non-month metadata only
  getRowKey: (row: Readonly<Row>) => SfRef
  cells: readonly SfGridCell[] // at most one per coordinate
  draftCells: readonly SfDraftCell[]
  activeCell: SfCellCoordinate | null
  selectedRange: SfGridRange | null
  paste: SfPasteState
  onSelectRange: (range: SfGridRange | null) => void
  onPasteTsv: (request: SfPasteRequest) => void
  onApplyPastedRows: (rows: readonly SfPasteRow[]) => void
  onRetryFailedPasteRows: (rows: readonly SfPasteRow[]) => void
  onCancelPaste: () => void
  onNavigate: (event: SfGridNavigation) => void
  onEdit: (event: Readonly<{ coordinate: SfCellCoordinate; text: string }>) => void
  onCommitCell: (event: Readonly<{ coordinate: SfCellCoordinate; text: string; exit: "Enter" | "Tab" | "Shift+Tab" }>) => void
  onCancelCell: (coordinate: SfCellCoordinate) => void
  onOpenRow: (recordRef: SfRef) => void
  readOnlyReason?: SfMessage
  state: SfUiState
}>
export declare function SfMonthlyGrid<Row>(props: SfMonthlyGridProps<Row>): JSX.Element

// S03 — versions/fences come from producer. These are display carriers, not a calculator.
export type SfReviewField = Readonly<{ path: string; label: SfMessage; value: SfDisplayValue; source?: SfSource }>
export type SfReviewSnapshot =
  | Readonly<{ kind: "persisted"; ref: SfRef; version: SfVersion; fields: readonly SfReviewField[] }>
  | Readonly<{ kind: "draft"; intentRef: SfIntentRef; sourceRef: SfRef | null; sourceVersion: SfVersion | null; fields: readonly SfReviewField[] }>
  | Readonly<{ kind: "not-provided"; reason: SfMessage }>
export type SfEffect = Readonly<{
  id: string
  domain: "dashboard" | "planner" | "procurement" | "decisions" | "portfolio" | "files" | "reviews" | "collaboration" | "intelligence"
  title: SfText
  state: "proposed" | "blocked" | "applied" | "not-applied" | "unknown"
  details: readonly SfReviewField[]
  reason?: SfMessage
  receiptRef?: SfRef
}>
export type SfReviewPurpose = "create" | "save" | "update" | "submit" | "approve" | "reject" | "select" | "apply" | "delete" | "cancel" | "issue" | "reset" | "spread" | "sync" | "copy" | "official" | "lock" | "unlock" | "activate" | "block" | "inactivate" | "change-bank" | "common" | "import" | "export" | "confirm" | "pause" | "prepare" | "run"
export type SfCommandVersion =
  | Readonly<{ kind: "record"; expectedVersion: SfVersion }>
  | Readonly<{ kind: "admission"; admissionRef: SfRef; expectedAdmissionVersion: number }>
  | Readonly<{ kind: "none" }>
export type SfReviewBinding =
  | Readonly<{ kind: "producer-review"; operationId: SfOperationId; reviewRef: SfRef; reviewDigest: string; baseVersion: SfVersion }>
  | Readonly<{ kind: "catalog-command"; operationId: SfOperationId; version: SfCommandVersion; confirmation: "presentation-only" | "producer-confirmed-field" }>
// operationId fixes the source API and input shape. Domain page/action literals
// live in the catalog, never fabricated for routines/schedules/analysis.
// Version kind none is legal only when that exact producer operation needs none.
// Admission version remains admission version; it is never renamed to record
// expectedVersion in the request. Presentation confirmation adds no body field.
export type SfReviewConfirmation =
  | Readonly<{ kind: "blocked"; labelKey: SfCopyKey; reasons: readonly SfMessage[] }>
  | Readonly<{ kind: "admitted"; labelKey: SfCopyKey; purpose: SfReviewPurpose; binding: SfReviewBinding }>
export type SfChangeReviewProps = Readonly<{
  operation: Readonly<{ ref: SfOperationRef; label: SfMessage; scope: SfText }>
  base: SfReviewSnapshot | null // null only before an entity exists; missing projection uses not-provided
  current: SfReviewSnapshot | null
  proposed: SfReviewSnapshot
  effects: readonly SfEffect[]
  coverage: SfCoverage
  blockingReasons: readonly SfMessage[]
  confirmation: SfReviewConfirmation
  state: SfUiState
  onConfirm: (review: Extract<SfReviewConfirmation, { kind: "admitted" }>) => void
  onRevise: () => void
  onCancel: () => void
  onReconcile?: (operationRef: SfOperationRef) => void
}>
export declare function SfChangeReview(props: SfChangeReviewProps): JSX.Element

export type SfDraftPhase = "clean" | "dirty" | "validating" | "validation-error" | "reviewing" | "submitting" | "outcome-unknown" | "conflict" | "failed"
export type SfDraftIdentity =
  | Readonly<{ kind: "record"; recordRef: SfRef }>
  | Readonly<{ kind: "new"; newIntentRef: SfIntentRef }>
export type SfDraftConflict<Value> = Readonly<{ currentVersion: SfVersion; current: Readonly<Value> }>
export type SfPendingOperation = Readonly<{ operationRef: SfOperationRef; idempotencyKey: string; payloadDigest: string; expectedVersion: SfVersion | null }>
export type SfDraftState<Value> =
  | Readonly<{ availability: "active"; phase: SfDraftPhase; value: Readonly<Value>; base: Readonly<Value> | null; baseVersion: SfVersion | null; dirty: boolean; conflict: SfDraftConflict<Value> | null; pendingOperation: SfPendingOperation | null }>
  | Readonly<{ availability: "confirmed-without-projection"; operationRef: SfOperationRef; resultVersion: SfVersion | null }>
  | Readonly<{ availability: "quarantined"; reason: "session-expired"; dirty: boolean }>
  | Readonly<{ availability: "revoked"; reason: "logout" | "owner-changed" | "access-revoked" | "authority-changed" }>
export type SfDraftInput<Value> = Readonly<{
  ownerKey: SfOwnerKey
  editScopeKey: SfEditScopeKey // stable year/business-version selection, never mutable record revision
  surfaceId: SurfaceId
  identity: SfDraftIdentity
  baseVersion: SfVersion | null
  base: Readonly<Value> | null
  value: Readonly<Value>
}>
export type SfDraftController<Value> = Readonly<{
  snapshot: Accessor<SfDraftState<Value>>
  edit: (value: Readonly<Value>) => void
  discard: () => void
  receiveRemote: (remote: Readonly<{ baseVersion: SfVersion; value: Readonly<Value> }>) => void
  setPhase: (phase: SfDraftPhase) => void
  setPending: (operation: SfPendingOperation) => void
  confirmSave: (result:
    | Readonly<{ kind: "projected"; operationRef: SfOperationRef; baseVersion: SfVersion; value: Readonly<Value> }>
    | Readonly<{ kind: "confirmed-without-projection"; operationRef: SfOperationRef; resultVersion: SfVersion | null }>
  ) => void
  quarantine: () => void
  restoreSameAuthority: (newOwnerKey: SfOwnerKey) => void // F01-private: same server/transport/origin/principal/installation/project + current entity/field revalidation; new authEpoch is permitted only by this transfer
  revoke: (reason: "logout" | "owner-changed" | "access-revoked" | "authority-changed") => void
}>
export declare function createSfDraft<Value>(input: SfDraftInput<Value>): SfDraftController<Value>

export type SfReceipt = Readonly<{
  ref: SfRef
  producer: string
  recordedAt: string
  sourceVersion: SfVersion | null
  effects: readonly SfEffect[]
}>
export type SfProducerOutcome =
  | Readonly<{ kind: "receipt-found" }>
  | Readonly<{ kind: "confirmed-by-authorized-refetch"; source: SfSource }>
  | Readonly<{ kind: "pending" }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "unavailable"; reason: SfMessage }>
export type SfReceiptViewProps = Readonly<{
  operationRef: SfOperationRef
  producerStatus: SfProducerOutcome
  effects: readonly SfEffect[]
  receipts: readonly SfReceipt[]
  state: SfUiState
  onReconcileRead?: (operationRef: SfOperationRef) => void
  onOpenSource?: (sourceRef: SfRef) => void
}>
export declare function SfReceiptView(props: SfReceiptViewProps): JSX.Element

// S04 — references and plain excerpts only, never executable URL/HTML or bytes in a public prop.
export type SfEvidence = Readonly<{
  ref: SfRef
  source: SfSource
  state: "candidate" | "confirmed" | "stale" | "unavailable" | "revoked"
  title: SfText
  excerpt: string | null
  fields: readonly SfReviewField[]
  reason?: SfMessage
}>
export type SfEvidencePanelProps = Readonly<{
  items: readonly SfEvidence[]
  selectedRef?: SfRef
  state: SfUiState
  onSelect: (evidenceRef: SfRef) => void
  onOpenAuthorizedSource: (sourceRef: SfRef) => void
  onClose: () => void
}>
export declare function SfEvidencePanel(props: SfEvidencePanelProps): JSX.Element

export type SfAttachment = Readonly<{
  ref: SfRef
  version: SfVersion
  fileName: string
  mediaType: string
  bytes: number
  status: "admitted" | "blocked" | "scanner-unavailable" | "replaced" | "revoked"
  reason?: SfMessage
  canDownload: boolean
  canRemoveReference: boolean
}>
export type SfFileAdmission =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "selected"; selectionRef: SfFileSelectionRef; fileName: string; bytes: number; mediaType: string }>
  | Readonly<{ kind: "admitting"; selectionRef: SfFileSelectionRef }>
  | Readonly<{ kind: "admitted"; attachmentRef: SfRef }>
  | Readonly<{ kind: "blocked" | "scanner-unavailable" | "failed"; reason: SfMessage }>
export type SfAttachmentFieldProps = Readonly<{
  attachments: readonly SfAttachment[]
  acceptedFormats: readonly Readonly<{ mediaType: string; extensions: readonly string[]; label: SfMessage }>[]
  limit: Readonly<{ maxBytes: number; maxFiles: number }>
  admissionState: SfFileAdmission
  recordRef: SfRef
  recordVersion: SfVersion
  onSelectFile: () => void // parent chooses browser/native file dialog and owns opaque selection
  onAdmit: (request: Readonly<{ selectionRef: SfFileSelectionRef; recordRef: SfRef; recordVersion: SfVersion }>) => void
  onRemoveReference: (request: Readonly<{ attachmentRef: SfRef; recordRef: SfRef; recordVersion: SfVersion }>) => void
  onDownload: (request: Readonly<{ attachmentRef: SfRef; recordRef: SfRef; recordVersion: SfVersion }>) => void
}>
export declare function SfAttachmentField(props: SfAttachmentFieldProps): JSX.Element

// F03 frames — concrete BI producers keep their own discriminated DTOs.
export type SfPlotValue = Readonly<{ kind: "known"; value: number }> | Readonly<{ kind: "missing" | "unavailable"; reason: SfMessage }>
export type SfPlotPoint = Readonly<{ id: string; x: SfScalar; xLabel: SfText; value: SfPlotValue; selectionRef?: SfRef }>
export type SfPlotSeries = Readonly<{ id: string; label: SfMessage; unit: SfUnit; semanticToken: string; points: readonly SfPlotPoint[] }>
export type SfChartTable = Readonly<{
  caption: SfMessage
  columns: readonly Readonly<{ id: string; label: SfMessage }>[]
  rows: readonly Readonly<{ id: string; selectionRef?: SfRef; cells: Readonly<Record<string, SfDisplayValue>> }>[]
}>
export type SfChartFrameProps = Readonly<{
  titleKey: SfCopyKey
  questionKey: SfCopyKey
  context: readonly Readonly<{ label: SfMessage; value: SfText }>[]
  coverage: SfCoverage
  series: readonly SfPlotSeries[]
  table: SfChartTable
  selection: SfRef | null
  state: SfUiState
  onSelect: (selectionRef: SfRef) => void
  onOpenSource: (sourceRef: SfRef) => void
  children: JSX.Element
}>
export declare function SfChartFrame(props: SfChartFrameProps): JSX.Element
export type SfRunPhase = "unavailable" | "ready" | "queued" | "running" | "needs-input" | "cancelling" | "cancelled" | "failed" | "partial" | "complete" | "stale"
export type SfRunTask =
  | Readonly<{ kind: "routine"; recipeRef: SfRef; title: SfText; recipeVersion: SfVersion }>
  | Readonly<{ kind: "analysis"; profileId: string; profileVersion: string; skillId: string; skillVersion: string; title: SfText }>
export type SfRunIdentity =
  | Readonly<{ kind: "unadmitted"; task?: SfRunTask; inputVersion?: SfVersion }>
  | Readonly<{ kind: "run"; runRef: SfRef; task: SfRunTask; inputVersion: SfVersion }>
export type SfRunCommonProps = Readonly<{
  modelSession?: Readonly<{ modelLabel: SfText; sessionRef: SfRef }>
  coverage?: SfCoverage
  actions: readonly SfAction[]
  onOpen: (resultRef: SfRef) => void
}>
export type SfRunStateProps = SfRunCommonProps & (
  | Readonly<{
      identity: Extract<SfRunIdentity, { kind: "unadmitted" }>
      state: "unavailable" | "ready" | "needs-input"
      progress?: never
      result?: never
    }>
  | Readonly<{
      identity: Extract<SfRunIdentity, { kind: "run" }>
      state: SfRunPhase
      progress?: Readonly<{ kind: "percent"; value: number; label: SfMessage }> | Readonly<{ kind: "indeterminate"; label: SfMessage }>
      result?: Readonly<{ ref: SfRef; summary: SfText; source: SfSource }>
    }>
)
export declare function SfRunState(props: SfRunStateProps): JSX.Element

// S05 — pure collaboration components. U44 owns pages and the A13 client calls.
export type SfRelation = Readonly<{ ref: SfRef; sourceRef: SfRef; targetRef: SfRef; kind: string; sourceLabel: SfText; targetLabel: SfText; caseRef?: SfRef; version: SfVersion; canRemove: boolean }>
export type SfRelationTarget = Readonly<{ ref: SfRef; kind: string; label: SfText; allowedRelationKinds: readonly Readonly<{ id: string; label: SfMessage }>[] }>
export type SfRelationsProps = Readonly<{
  sourceRef: SfRef
  relations: readonly SfRelation[]
  candidates: readonly SfRelationTarget[]
  state: SfUiState
  onSearchTargets: (query: string) => void
  onCreate: (request: Readonly<{ sourceRef: SfRef; targetRef: SfRef; kind: string; caseRef?: SfRef }>) => void
  onRemove: (request: Readonly<{ relationRef: SfRef; expectedVersion: SfVersion }>) => void
  onOpen: (recordRef: SfRef) => void
}>
export declare function SfRelations(props: SfRelationsProps): JSX.Element

export type SfThreadMessage = Readonly<{ ref: SfRef; incarnation: string; version: number; author: SfText; createdAt: string; text: string; sourceRefs: readonly SfRef[] }>
export type SfThreadProps = Readonly<{
  threadRef: SfRef
  incarnation: string
  version: number
  messages: readonly SfThreadMessage[]
  draft: string
  state: SfUiState
  onEditDraft: (text: string) => void
  onPost: (request: Readonly<{ threadRef: SfRef; incarnation: string; expectedVersion: number; text: string }>) => void
  onReconcileRead: (threadRef: SfRef) => void
  onOpenOrigin: () => void
}>
export declare function SfThread(props: SfThreadProps): JSX.Element

export type SfQuestionDraft = Readonly<{ text: string; recipientRef: SfRef | null; sourceRefs: readonly SfRef[] }>
export type SfQuestionProps = Readonly<{
  questionRef?: SfRef
  sourceRef: SfRef
  recipientOptions: readonly Readonly<{ ref: SfRef; label: SfText; available: boolean }>[]
  question: SfQuestionDraft
  answer?: Readonly<{ ref: SfRef; version: SfVersion; text: string; author: SfText }>
  state: SfUiState
  onEditQuestion: (draft: SfQuestionDraft) => void
  onPrepare: (draft: SfQuestionDraft) => void
  onSubmit: () => void // container submits its frozen prepared draft; no invented producer ref
  onAnswer: (request: Readonly<{ questionRef: SfRef; text: string }>) => void
  onOpen: (questionRef: SfRef) => void
}>
export declare function SfQuestion(props: SfQuestionProps): JSX.Element

export type SfConfirmationProps = Readonly<{
  selectionRef: SfRef
  materialVersion: SfVersion
  status: "current" | "stale" | "revoked" | "not-found" | "unavailable"
  coverage: SfCoverage
  state: SfUiState
  onConfirm: (request: Readonly<{ selectionRef: SfRef; materialVersion: SfVersion }>) => void
  onRevalidate: (selectionRef: SfRef) => void
}>
export declare function SfConfirmation(props: SfConfirmationProps): JSX.Element

/**
 * Semantic constraints shared by every declaration:
 * - readonly means callers never mutate props; createStore state stays with owner.
 * - component state values are presentation, never a replacement for server ACL.
 * - dynamic records in display tables contain only named public fields projected
 *   by their adapter; no raw JSON editor, private Snapshot or Schema.Any.
 * - domain-specific schemas remain authoritative. A carrier field absent from a
 *   producer is unavailable/null where the union permits it, never fabricated.
 * - callbacks for domain effects are emitted exactly once per explicit user
 *   gesture. Pure onLayoutMode may report observed width on mount/resize; it
 *   never dispatches. Focus/layout announcements are not domain effects.
 * - render/mount, refetch, restored draft and route load never emit an effect.
 * - unknown enum, missing required public binding or mismatched versions blocks
 *   that composition; consumers do not broaden these signatures independently.
 */
