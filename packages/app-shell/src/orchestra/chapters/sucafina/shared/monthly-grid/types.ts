/**
 * S02 frozen public carriers. Product target:
 * packages/app-shell/src/orchestra/chapters/sucafina/shared/monthly-grid/types.ts
 *
 * The opaque identities come from the F01 public Schema/context contract.
 * This module is presentation-only: no private producer, permission policy,
 * domain arithmetic, network or idempotency implementation lives here.
 */
import type { JSX } from "solid-js"
import type { SfOpaque, SfRef, SfVersion } from "@orchestra/schema/sucafina/context"

export type SfCopyKey = SfOpaque<"key-from-frozen-typed-dictionaries">
export type SfMessage = Readonly<{ key: SfCopyKey; params?: Readonly<Record<string, string | number>> }>
export type SfText = Readonly<{ kind: "message"; message: SfMessage }> | Readonly<{ kind: "data"; text: string }>
export type SfCoverage = Readonly<{
  state: "complete" | "partial" | "unavailable"
  summary: SfMessage
  reasons: readonly SfMessage[]
  knownCount: number | null
  expectedCount: number | null
}>
export type SfSource = Readonly<{
  ref: SfRef
  version: SfVersion
  label: SfText
  scope: SfText
  coverage: SfCoverage
}>
export type SfUnit =
  | Readonly<{ kind: "currency"; code: string }>
  | Readonly<{ kind: "percent" }>
  | Readonly<{ kind: "quantity"; label: SfMessage }>
  | Readonly<{ kind: "unspecified"; label: SfMessage }>
export type SfUiState =
  | "loading" | "ready" | "empty" | "filtered-empty" | "partial"
  | "invalid" | "not-found" | "stale" | "conflict" | "unavailable"
  | "denied" | "session-expired" | "outcome-unknown"

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

export type SfMonthId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
export type SfMonth = Readonly<{ id: SfMonthId; labelKey: SfCopyKey; closed: boolean }>
export type SfCellCoordinate = Readonly<{
  rowRef: SfRef
  month: SfMonthId
  measure: "budget" | "actual" | "forecast" | "fte" | "cost"
}>
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
  key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End"
    | "Control+Home" | "Control+End" | "PageUp" | "PageDown"
  visibleRowCount: number
}>
export type SfGridRange = Readonly<{ anchor: SfCellCoordinate; extent: SfCellCoordinate }>
export type SfPasteMeasure = "budget" | "actual" | "forecast"
export type SfPasteCell = Readonly<{ coordinate: SfCellCoordinate; rawText: string; issue?: SfMessage }>
export type SfPasteRow = Readonly<{
  rowRef: SfRef
  revision: number
  cells: readonly SfPasteCell[]
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
  months: readonly SfMonth[]
  columns: readonly SfColumn<Row>[]
  getRowKey: (row: Readonly<Row>) => SfRef
  cells: readonly SfGridCell[]
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
