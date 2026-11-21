import type { Schema } from "effect"
import { SfPlannerMonthlyPreview } from "@orchestra/schema/sucafina/planner"

/** This is the ONE UI edge mapping of 0-based grid indices to producer months 1..12.
 * It never parses monetary text; the original host validates/normalizes it and
 * applies one optimistic concurrency token per row in its real transaction.
 */
export type SfPlannerUiCell = Readonly<{
  measure: "budget" | "actual" | "forecast"
  monthIndex: number
  text: string
}>
export type SfPlannerUiRow = Readonly<{
  rowId: string
  revision: number
  cells: readonly SfPlannerUiCell[]
}>
export type SfPlannerMonthlyDraftInput = Schema.Schema.Type<typeof SfPlannerMonthlyPreview.input>["input"]
export type SfPlannerRangeResult =
  | Readonly<{ status: "ready"; input: SfPlannerMonthlyDraftInput }>
  | Readonly<{ status: "invalid"; reason: "selection" | "row" | "month-index" | "duplicate-cell" | "duplicate-row" | "measure" | "range-size"; rowId?: string }>

export function prepareSfPlannerMonthlyRange(
  page: "OPEX" | "CAPEX",
  versionId: string,
  rows: readonly SfPlannerUiRow[],
): SfPlannerRangeResult {
  if ((page !== "OPEX" && page !== "CAPEX") || !versionId.trim()) return { status: "invalid", reason: "selection" }
  if (!rows.length || rows.length > 500) return { status: "invalid", reason: "range-size" }
  const ids = new Set<string>()
  const drafts: Array<SfPlannerMonthlyDraftInput["drafts"][number]> = []
  for (const row of rows) {
    if (!row.rowId.trim() || !Number.isSafeInteger(row.revision) || row.revision < 0)
      return { status: "invalid", reason: "row", rowId: row.rowId }
    if (ids.has(row.rowId)) return { status: "invalid", reason: "duplicate-row", rowId: row.rowId }
    ids.add(row.rowId)
    if (!row.cells.length || row.cells.length > 36)
      return { status: "invalid", reason: "range-size", rowId: row.rowId }
    const used = new Set<string>()
    const cells: Array<SfPlannerMonthlyDraftInput["drafts"][number]["cells"][number]> = []
    for (const cell of row.cells) {
      if (cell.measure !== "budget" && cell.measure !== "actual" && cell.measure !== "forecast")
        return { status: "invalid", reason: "measure", rowId: row.rowId }
      if (!Number.isInteger(cell.monthIndex) || cell.monthIndex < 0 || cell.monthIndex > 11)
        return { status: "invalid", reason: "month-index", rowId: row.rowId }
      if (typeof cell.text !== "string") return { status: "invalid", reason: "row", rowId: row.rowId }
      const key = cell.measure + ":" + cell.monthIndex
      if (used.has(key)) return { status: "invalid", reason: "duplicate-cell", rowId: row.rowId }
      used.add(key)
      // The +1 occurs once HERE; no other helper converts months.
      cells.push({ measure: cell.measure, month: cell.monthIndex + 1, text: cell.text })
    }
    drafts.push({ rowId: row.rowId, revision: row.revision, cells })
  }
  return { status: "ready", input: { page, versionId, drafts } }
}

/** Preserve each original row and raw cell text after a partial commit.
 * Network uncertainty is deliberately NOT a failure and cannot trigger replay.
 */
export function unresolvedSfPlannerMonthlyRows(
  sent: SfPlannerMonthlyDraftInput,
  reply: Awaited<ReturnType<ReturnType<typeof import("../planner").createSfPlannerClient>["planner.monthly.apply"]>>,
): Readonly<{
  status: "known" | "outcome-unknown" | "unavailable"
  rows: SfPlannerMonthlyDraftInput["drafts"]
}> {
  if (reply.kind === "transport-error") {
    return { status: reply.reason === "contract-unavailable" ? "unavailable" : "outcome-unknown", rows: sent.drafts }
  }
  if (reply.status !== 200 || reply.body.status !== "ok") return { status: "known", rows: sent.drafts }
  const applied = new Set(
    reply.body.value.rows.filter((row) => row.result?.ok === true).map((row) => row.draft.rowId),
  )
  return { status: "known", rows: sent.drafts.filter((row) => !applied.has(row.rowId)) }
}
