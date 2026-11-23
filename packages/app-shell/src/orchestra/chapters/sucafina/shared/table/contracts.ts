import type { JSX } from "solid-js"
import type { SfOpaque, SfRef, SfVersion } from "@orchestra/schema/sucafina/context"

// Exact S01 public carriers from the frozen component-signatures contract.
// F01 owns the opaque reference brands; these views only present authorized data.
export type SfCopyKey = SfOpaque<"key-from-frozen-typed-dictionaries">
export type SfDensity = "comfortable" | "compact"
export type SfLayoutMode = "single" | "split" | "split-context"
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

export type SfSort =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "field"; key: string; direction: "asc" | "desc" }>
export type SfPage =
  | Readonly<{ kind: "none"; total: number | null }>
  | Readonly<{
      kind: "cursor"
      current: SfRef | null
      previous: SfRef | null
      next: SfRef | null
      from: number | null
      to: number | null
      total: number | null
    }>
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
  rowActionContext?: (row: Readonly<Row>) => JSX.Element
  onRowAction: (request: Readonly<{ recordRef: SfRef; actionId: string }>) => void
  captionKey: SfCopyKey
  density: SfDensity
  state: SfUiState
}>
export type SfDetailSection = Readonly<{
  id: string
  titleKey: SfCopyKey
  content: JSX.Element
  state: SfUiState
}>
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
export type SfListDetailProps = Readonly<{
  list: JSX.Element
  detail: JSX.Element
  selectedRef?: SfRef
  onBack: () => void
  onOpenPage: () => void
  layoutMode: SfLayoutMode
}>
