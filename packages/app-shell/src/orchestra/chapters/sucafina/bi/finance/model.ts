/**
 * U20/U21: view-only adapter of the A08 admitted BI response.
 * No data acquisition, FX, financial aggregation, aging arithmetic or auth inference.
 * A single source result feeds both the SVG marks and the equivalent table.
 */
import type { SfBiBiDataOutput } from "@orchestra/schema/sucafina/bi"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import type {
  SfChartFrameProps, SfCopyKey, SfCoverage, SfDisplayValue, SfMessage,
  SfPlotSeries, SfUiState, SfUnit,
} from "../../shared/frame"

export type SfBiSnapshot = Extract<SfBiBiDataOutput, { request: unknown }>
export type SfBiFinancialView = "BI01" | "BI02" | "BI03" | "BI04"
export type SfBiOperationalView = "BI05" | "BI06" | "BI07" | "BI08"
export type SfBiOwnedView = SfBiFinancialView | SfBiOperationalView
export type SfBiFigureProps<Id extends SfBiOwnedView> = Readonly<{
  viewId: Id
  projection: SfBiSnapshot
  selection: SfRef | null
  onSelect: (selectionRef: SfRef) => void
  onOpenSource: (sourceRef: SfRef) => void
}>

export const sfBiKey = (key: string): SfCopyKey => key as SfCopyKey
const message = (key: string): SfMessage => ({ key: sfBiKey(key) })
const raw = (text: string) => ({ kind: "data", text } as const)
const absent = (key: string): SfDisplayValue => ({ kind: "missing", reason: message(key) })
const dataCell = (text: string): SfDisplayValue => ({ kind: "text", text: raw(text) })

const ROLE_LABELS = {
  budget: "sf.u20.role.budget",
  actual: "sf.u20.role.actual",
  outlook: "sf.u20.role.outlook",
  baseline: "sf.u20.role.baseline",
  contribution: "sf.u20.role.contribution",
  result: "sf.u20.role.result",
  fte: "sf.u20.role.fte",
  cost: "sf.u20.role.cost",
  stock: "sf.u20.role.stock",
  aging: "sf.u20.role.aging",
  opened: "sf.u20.role.opened",
  closed: "sf.u20.role.closed",
  planned: "sf.u20.role.planned",
  completed: "sf.u20.role.completed",
  sensitivity: "sf.u20.role.sensitivity",
  other: "sf.u20.role.other",
} as const

type SourceValue = SfBiSnapshot["projection"]["values"][number]
export function sfBiEvidenceRef(value: SourceValue): SfRef | undefined {
  // Only opaque references actually published by the admitted C08 producer.
  // Never transform a valueId or an array index into an authority-bearing ref.
  return value.drilldown?.refId
    ? value.drilldown.refId as SfRef
    : value.sourceRefs.length === 1 && value.sourceRefs[0]?.refId
      ? value.sourceRefs[0].refId as SfRef
      : undefined
}

function numeric(value: SourceValue): number | null {
  return value.evidenceState !== "absent" && typeof value.value === "number" &&
    Number.isFinite(value.value) ? value.value : null
}

function cellValue(value: SourceValue, unit: SfUnit, prefix: string): SfDisplayValue {
  if (value.evidenceState === "absent" || value.value === null)
    return absent(prefix + ".missing")
  if (typeof value.value === "number")
    return Number.isFinite(value.value)
      ? { kind: "number", value: value.value, unit, fractionDigits: 2 }
      : absent(prefix + ".missing")
  if (typeof value.value === "boolean")
    return { kind: "boolean", value: value.value,
      trueLabel: message(prefix + ".yes"), falseLabel: message(prefix + ".no") }
  if (typeof value.value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.value))
    return { kind: "date", isoDate: value.value }
  return dataCell(value.value)
}

export type SfBiChartModel = Readonly<{
  state: SfUiState
  coverage: SfCoverage
  series: SfPlotSeries[]
  table: SfChartFrameProps["table"]
  limitations: readonly string[]
  rows: readonly Readonly<{
    id: string
    label: string
    unit: string
    period: string
    value: number | null
    evidenceRef?: SfRef
    evidence: SourceValue["evidenceState"]
  }>[]
}>

export function sfBiPeriodLabel(start: string, end: string, locale: string) {
  const day = (value: string) => {
    const iso = value.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value
    const date = new Date(iso + "T00:00:00Z")
    if (!Number.isFinite(date.getTime())) return value
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date)
  }
  const left = day(start)
  const right = day(end)
  return start.slice(0, 10) === end.slice(0, 10) ? left : left + " – " + right
}
export function sfBiChartModel(viewId: SfBiOwnedView, result: SfBiSnapshot, prefix: "sf.u20" | "sf.u21", locale = "en"): SfBiChartModel {
  const emptyTable: SfChartFrameProps["table"] = { caption: message(prefix + ".table"),
    columns: [
      { id: "series", label: message(prefix + ".column.series") },
      { id: "value", label: message(prefix + ".column.value") },
      { id: "unit", label: message(prefix + ".column.unit") },
      { id: "period", label: message(prefix + ".column.period") },
      { id: "granularity", label: message(prefix + ".column.granularity") },
      { id: "evidence", label: message(prefix + ".column.evidence") },
      { id: "source", label: message(prefix + ".column.source") },
    ],
    rows: [],
  }
  const unavailable = (): SfBiChartModel => ({
    state: "unavailable",
    coverage: { state: "unavailable", summary: message(prefix + ".coverage.unavailable"),
      reasons: [message(prefix + ".sourceMismatch")], knownCount: null, expectedCount: null },
    series: [], table: emptyTable, limitations: [], rows: [],
  })

  const source = result.projection
  const context = source.context
  if (result.request.viewId !== viewId || result.presentation.viewId !== viewId ||
      !result.request.selectionRef ||
      result.request.period.start !== context.period.start ||
      result.request.period.end !== context.period.end ||
      result.receipt.principalRef !== context.principalRef ||
      result.receipt.accessRevision !== context.accessRevision ||
      !context.installationId || !context.projectId || !context.currency ||
      new Set(source.values.map((value) => value.id)).size !== source.values.length ||
      new Set(result.presentation.series.map((series) => series.id)).size !== result.presentation.series.length)
    return unavailable()

  const values = new Map(source.values.map((value) => [value.id, value]))
  const selectedIds = result.presentation.series.flatMap((series) => [...series.valueIds])
  if (selectedIds.length !== new Set(selectedIds).size ||
      selectedIds.some((id) => !values.has(id)) ||
      result.presentation.series.some((series) =>
        series.alignmentKeys && (series.alignmentKeys.length !== series.valueIds.length ||
        new Set(series.alignmentKeys).size !== series.alignmentKeys.length)))
    return unavailable()

  const missing = source.missing.length > 0 || source.values.some((value) => value.evidenceState === "absent" || value.value === null)
  const count = selectedIds.filter((id) => {
    const value = values.get(id)
    return value !== undefined && value.evidenceState !== "absent" && value.value !== null
  }).length
  const state: SfUiState = selectedIds.length === 0 && !source.missing.length
    ? "empty" : missing || result.presentation.limitations.length > 0 ? "partial" : "ready"
  const coverage: SfCoverage = {
    state: state === "empty" || state === "ready" ? "complete" : "partial",
    summary: message(prefix + (state === "partial" ? ".coverage.partial" : ".coverage.ready")),
    reasons: state === "partial" ? [message(prefix + ".coverage.gaps")] : [],
    knownCount: count, expectedCount: null,
  }

  const rows: SfBiChartModel["rows"][number][] = []
  const tableRows: SfBiChartFrameRow[] = []
  const plot: SfPlotSeries[] = []
  for (const series of result.presentation.series) {
    const unit: SfUnit = series.unit === context.currency
      ? { kind: "currency", code: context.currency }
      : { kind: "unspecified", label: message(prefix + ".unit.raw") }
    const plotPoints: SfPlotSeries["points"][number][] = []
    for (const id of series.valueIds) {
      const value = values.get(id)
      if (!value) return unavailable()
      // An incompatible financial series must not be silently combined on an axis.
      if (value.period.start > value.period.end ||
          (value.currency && value.currency !== context.currency) ||
          (value.unit && value.unit !== series.unit && value.currency !== series.unit))
        return unavailable()
      if ((viewId === "BI01" || viewId === "BI07") &&
          value.granularity !== "month" && value.granularity !== "year")
        return unavailable()
      const reference = sfBiEvidenceRef(value)
      const period = sfBiPeriodLabel(value.period.start, value.period.end, locale)
      const amount = numeric(value)
      rows.push({ id: value.id, label: series.label, unit: series.unit,
        period, value: amount, ...(reference ? { evidenceRef: reference } : {}),
        evidence: value.evidenceState })
      plotPoints.push({ id: value.id, x: value.period.start, xLabel: raw(period),
        value: amount === null
          ? { kind: "missing", reason: message(prefix + ".missing") }
          : { kind: "known", value: amount },
        ...(reference ? { selectionRef: reference } : {}),
      })
      tableRows.push({
        id: series.id + ":" + value.id,
        ...(reference ? { selectionRef: reference } : {}),
        cells: {
          series: dataCell(series.label + " · " + value.id),
          value: cellValue(value, unit, prefix),
          unit: dataCell(series.unit),
          period: dataCell(period),
          granularity: dataCell(value.granularity),
          evidence: { kind: "text", text: { kind: "message", message: message(prefix + ".evidence." + value.evidenceState) } },
          source: reference ? dataCell(reference) : absent(prefix + ".noSource"),
        },
      })
    }
    plot.push({ id: series.id, label: message(ROLE_LABELS[series.role]), unit,
      semanticToken: series.role, points: plotPoints })
  }

  return {
    state, coverage, series: plot,
    table: { ...emptyTable, rows: tableRows },
    limitations: result.presentation.limitations,
    rows,
  }
}
type SfBiChartFrameRow = SfChartFrameProps["table"]["rows"][number]
