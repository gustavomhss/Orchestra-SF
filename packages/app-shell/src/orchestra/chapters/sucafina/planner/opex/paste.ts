/**
 * U07 producer-backed range orchestration. This is NOT a parser for financial
 * values: original TSV bytes are kept and A02 alone converts 0..11 to 1..12.
 * Nothing here performs budget, FX, salary, split or period arithmetic.
 */
import { prepareSfPlannerMonthlyRange, type SfPlannerUiRow } from "@orchestra/client/sucafina/planner/monthly"
import type {
  SfGridCell, SfGridRange, SfPasteRequest, SfPasteRow, SfPasteState, SfPasteCell,
  SfCellCoordinate, SfMessage,
} from "../../shared/monthly-grid"
import type { SfRef } from "@orchestra/schema/sucafina/context"

type GridRow = Readonly<{ id: string; revision: number }>
export type BudgetPastePlan = Readonly<{
  state: SfPasteState
  prepared: ReturnType<typeof prepareSfPlannerMonthlyRange> | null
}>

const message = (key: string, params?: Readonly<Record<string, string | number>>): SfMessage =>
  ({ key: key as SfMessage["key"], ...(params ? { params } : {}) })
const keyFor = (coordinate: SfCellCoordinate) =>
  JSON.stringify([coordinate.rowRef, coordinate.month, coordinate.measure])

/** Do not trim, coerce, normalize decimals or elide terminal empty fields. */
export function prepareBudgetPaste(
  page: "OPEX" | "CAPEX",
  versionId: string,
  rows: readonly GridRow[],
  cells: readonly SfGridCell[],
  request: SfPasteRequest,
): BudgetPastePlan {
  const originalTsv = request.originalTsv
  const range: SfGridRange = request.range
  const baseIndex = rows.findIndex((row) => row.id === range.anchor.rowRef)
  const colIndex = range.anchor.month
  const measure = range.anchor.measure
  const raw = originalTsv.split(/\r\n|\n|\r/).map((line) => line.split("\t"))
  const width = raw[0]?.length ?? 0
  const invalidShape = width === 0 || raw.some((line) => line.length !== width)
  const outOfBounds = baseIndex < 0 || colIndex + width > 12 || baseIndex + raw.length > rows.length
  const unsupported = measure !== "budget" && measure !== "actual" && measure !== "forecast"
  const lookup = new Map(cells.map((cell) => [keyFor(cell.coordinate), cell]))
  const result: SfPasteRow[] = []
  const admissible: SfPlannerUiRow[] = []

  for (let r = 0; r < raw.length; r++) {
    const row = rows[baseIndex + r]
    const rowRef = (row?.id ?? ("unresolved-" + r)) as SfRef
    const revision = row?.revision ?? 0
    const pasteCells: SfPasteCell[] = (raw[r] ?? []).map((text, c) => ({
      coordinate: { rowRef, month: Math.min(11, colIndex + c) as SfCellCoordinate["month"], measure },
      rawText: text,
    }))
    const issue = invalidShape ? "sf.s02.paste.irregular" :
      outOfBounds ? "sf.s02.paste.overflow" :
      unsupported ? "sf.s02.paste.unsupported" :
      !row ? "sf.s02.paste.overflow" : undefined
    const locked = !issue && pasteCells.some((cell) =>
      lookup.get(keyFor(cell.coordinate))?.permission.editable !== true)
    const reason = issue ? message(issue) : locked ? message("sf.s02.closedMonth") : undefined
    result.push({
      rowRef, revision, cells: pasteCells,
      result: reason ? locked ? "locked" : "invalid" : "ready",
      issues: reason ? [reason] : [],
    })
    if (!reason && row && (measure === "budget" || measure === "actual" || measure === "forecast")) {
      admissible.push({
        rowId: row.id,
        revision: row.revision,
        cells: pasteCells.map((cell) => ({
          measure, monthIndex: cell.coordinate.month, text: cell.rawText,
        })),
      })
    }
  }
  const prepared = admissible.length
    ? prepareSfPlannerMonthlyRange(page, versionId, admissible)
    : null
  if (prepared && prepared.status === "invalid") {
    return {
      prepared,
      state: {
        phase: "review", originalTsv, range,
        rows: result.map((row) => row.result === "ready"
          ? { ...row, result: "invalid", issues: [message("sf.u07.previewError")] }
          : row),
      },
    }
  }
  return { prepared, state: { phase: "review", originalTsv, range, rows: result } }
}

export type ProducerPasteRow = Readonly<{
  draft: Readonly<{ rowId: string; revision: number }>
  errors: readonly Readonly<{ reason: string }>[]
  result?: Readonly<{ ok: boolean; status?: number }>
}>

/** No success is inferred from the absence of an error or from an HTTP 200. */
export function reconcileBudgetPaste(
  state: Extract<SfPasteState, { phase: "review" | "applying" | "partial" | "conflict" | "failed" }>,
  producerRows: readonly ProducerPasteRow[],
  applied: boolean,
): SfPasteState {
  const authoritative = new Map(producerRows.map((row) => [row.draft.rowId, row]))
  const rows: SfPasteRow[] = state.rows.map((row) => {
    if (row.result === "locked" || row.result === "invalid" || row.result === "applied") return row
    const from = authoritative.get(row.rowRef)
    if (!from) return { ...row, result: "failed", issues: [message("sf.u07.previewError")] }
    const conflict = from.result?.ok === false && from.result.status === 409
    const accepted = from.errors.length === 0 && from.result?.ok === true
    return {
      ...row,
      result: accepted ? applied ? "applied" : "ready" : conflict ? "conflict" : "invalid",
      issues: from.errors.map((issue) => message("sf.u07.producerIssue", { reason: issue.reason })),
    }
  })
  const appliedRowRefs = rows.filter((row) => row.result === "applied").map((row) => row.rowRef)
  return rows.every((row) => row.result === "applied")
    ? { phase: "complete", appliedRowRefs }
    : {
      phase: rows.some((row) => row.result === "conflict") ? "conflict" : applied ? "partial" : "review",
      originalTsv: state.originalTsv, range: state.range, rows,
    }
}
