import type { JSX } from "solid-js"
import type { SfHref, SfRef, SfVersion } from "@orchestra/schema/sucafina/context"

// F03 public presentation contracts: COMPONENT-CONTRACTS.md and component-signatures.ts
// are frozen. The only external identities are F01 Schema's opaque route/ref types.
// I00 composes the full leaf dictionary; its keys must never be arbitrary data text.
declare const sfCopyKey: unique symbol
export type SfCopyKey = string & { readonly [sfCopyKey]: "key-from-frozen-typed-dictionaries" }
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
  | "loading"
  | "ready"
  | "empty"
  | "filtered-empty"
  | "partial"
  | "invalid"
  | "not-found"
  | "stale"
  | "conflict"
  | "unavailable"
  | "denied"
  | "session-expired"
  | "outcome-unknown"
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
export type SfPlotValue =
  | Readonly<{ kind: "known"; value: number }>
  | Readonly<{ kind: "missing" | "unavailable"; reason: SfMessage }>
export type SfPlotPoint = Readonly<{
  id: string
  x: SfScalar
  xLabel: SfText
  value: SfPlotValue
  selectionRef?: SfRef
}>
export type SfPlotSeries = Readonly<{
  id: string
  label: SfMessage
  unit: SfUnit
  semanticToken: string
  points: readonly SfPlotPoint[]
}>
export type SfChartTable = Readonly<{
  caption: SfMessage
  columns: readonly Readonly<{ id: string; label: SfMessage }>[]
  rows: readonly Readonly<{
    id: string
    selectionRef?: SfRef
    cells: Readonly<Record<string, SfDisplayValue>>
  }>[]
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
export type SfRunPhase =
  | "unavailable"
  | "ready"
  | "queued"
  | "running"
  | "needs-input"
  | "cancelling"
  | "cancelled"
  | "failed"
  | "partial"
  | "complete"
  | "stale"
export type SfRunTask =
  | Readonly<{ kind: "routine"; recipeRef: SfRef; title: SfText; recipeVersion: SfVersion }>
  | Readonly<{
      kind: "analysis"
      profileId: string
      profileVersion: string
      skillId: string
      skillVersion: string
      title: SfText
    }>
export type SfRunIdentity =
  | Readonly<{ kind: "unadmitted"; task?: SfRunTask; inputVersion?: SfVersion }>
  | Readonly<{ kind: "run"; runRef: SfRef; task: SfRunTask; inputVersion: SfVersion }>
export type SfRunCommonProps = Readonly<{
  modelSession?: Readonly<{ modelLabel: SfText; sessionRef: SfRef }>
  coverage?: SfCoverage
  actions: readonly SfAction[]
  onOpen: (resultRef: SfRef) => void
}>
export type SfRunStateProps = SfRunCommonProps &
  (
    | Readonly<{
        identity: Extract<SfRunIdentity, { kind: "unadmitted" }>
        state: "unavailable" | "ready" | "needs-input"
        progress?: never
        result?: never
      }>
    | Readonly<{
        identity: Extract<SfRunIdentity, { kind: "run" }>
        state: SfRunPhase
        progress?:
          | Readonly<{ kind: "percent"; value: number; label: SfMessage }>
          | Readonly<{ kind: "indeterminate"; label: SfMessage }>
        result?: Readonly<{ ref: SfRef; summary: SfText; source: SfSource }>
      }>
  )
