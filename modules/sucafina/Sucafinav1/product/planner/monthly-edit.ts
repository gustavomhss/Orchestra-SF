import type { Command } from "../../runtime/contract.ts"

export type MonthlyDraft = {
  rowId: string
  revision: number
  cells: readonly { measure: "budget" | "actual" | "forecast"; month: number; text: string }[]
}

/** Parse a pasted or edited range without discarding invalid cells or local text. */
export function prepareMonthlyDrafts(page: "OPEX" | "CAPEX", versionId: string, drafts: readonly MonthlyDraft[]) {
  return drafts.map((draft) => {
    const errors = draft.cells.flatMap((cell) => {
      if (!Number.isInteger(cell.month) || cell.month < 1 || cell.month > 12) return [{ cell, reason: "invalid-month" }]
      if (cell.text.trim() === "" && cell.measure === "budget") return [{ cell, reason: "budget-requires-value" }]
      if (cell.text.trim() !== "" && !Number.isFinite(Number(cell.text))) return [{ cell, reason: "invalid-number" }]
      return []
    })
    if (new Set(draft.cells.map((cell) => `${cell.measure}:${cell.month}`)).size !== draft.cells.length)
      errors.push({ cell: draft.cells[0], reason: "duplicate-cell" })
    const values: Record<string, unknown> = { versionId }
    draft.cells.forEach((cell) => {
      const prefix = cell.measure === "budget" ? "b" : cell.measure === "actual" ? "a" : "f"
      values[`${prefix}${cell.month - 1}`] = cell.text.trim() === "" ? null : Number(cell.text)
    })
    const command: Command = { page, action: "save", id: draft.rowId, version: draft.revision, values }
    return { draft, errors, command: errors.length ? undefined : command }
  })
}
