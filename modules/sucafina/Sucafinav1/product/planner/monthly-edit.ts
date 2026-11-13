import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { projectPlanner, simulatePlannerCommands } from "./adapter.ts"
import { projectMonthlyGrid } from "./monthly-grid.ts"

export type MonthlyDraft = {
  rowId: string
  revision: number
  cells: readonly { measure: "budget" | "actual" | "forecast"; month: number; text: string }[]
}

export type MonthlySpreadPreview = {
  rowId: string
  revision: number
  operation: "annual" | "spread" | "reset"
  command?: Command
  before: readonly { month: number; value: number | null; manual: boolean }[]
  after: readonly { month: number; value: number | null; manual: boolean }[]
  changedMonths: readonly number[]
  errors: readonly string[]
  annualBefore: number | null
  annualAfter: number | null
  allMonthsManual: boolean
}

/** Preview annual/spread/reset by running the real domain command against a disposable snapshot. */
export function previewMonthlyOperation(snapshot: Snapshot, actor: Actor, environment: Environment, page: "OPEX" | "CAPEX", versionId: string, rowId: string, revision: number, operation: "annual" | "spread" | "reset", annual?: number): MonthlySpreadPreview {
  const view = projectPlanner(snapshot, actor, environment)
  const version = (view.data.versions as Record<string, unknown>[]).find((entry) => entry.id === versionId)
  const lines = version && typeof version.summary === "object" && version.summary !== null ? (version.summary as Record<string, unknown>).lines : undefined
  const line = Array.isArray(lines) ? lines.find((entry) => !!entry && typeof entry === "object" && (entry as Record<string, unknown>).id === rowId) as Record<string, unknown> | undefined : undefined
  const measure = page === "OPEX" ? "opex" : "capex"
  const amounts = Array.isArray(line?.b) ? line.b as unknown[] : []
  const flags = Array.isArray(line?.bm) ? line.bm as unknown[] : []
  const before = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, value: typeof amounts[index] === "number" && Number.isFinite(amounts[index]) ? amounts[index] as number : null, manual: flags[index] === true }))
  const annualBefore = typeof line?.annual === "number" && Number.isFinite(line.annual) ? line.annual : null
  const allMonthsManual = before.every((cell) => cell.manual)
  const errors: string[] = []
  if (!line || line.sec !== measure) errors.push("row-unavailable")
  if (!Number.isSafeInteger(revision) || revision < 0) errors.push("invalid-revision")
  if (operation === "annual" && (typeof annual !== "number" || !Number.isFinite(annual))) errors.push("invalid-annual")
  const command: Command = { page, action: operation === "annual" ? "save" : operation === "reset" ? "reset" : "spread", id: rowId, version: revision, values: { versionId, ...(operation === "annual" ? { annual } : {}) } }
  if (errors.length) return { rowId, revision, operation, before, after: before, changedMonths: [], errors, annualBefore, annualAfter: annualBefore, allMonthsManual }
  const preview = simulatePlannerCommands(snapshot, actor, [command], environment)
  const result = preview.results[0]
  const afterVersion = (preview.view.data.versions as Record<string, unknown>[]).find((entry) => entry.id === versionId)
  const afterLines = afterVersion && typeof afterVersion.summary === "object" && afterVersion.summary !== null ? (afterVersion.summary as Record<string, unknown>).lines : undefined
  const updated = Array.isArray(afterLines) ? afterLines.find((entry) => !!entry && typeof entry === "object" && (entry as Record<string, unknown>).id === rowId) as Record<string, unknown> | undefined : undefined
  const updatedAmounts = Array.isArray(updated?.b) ? updated.b as unknown[] : []
  const updatedFlags = Array.isArray(updated?.bm) ? updated.bm as unknown[] : []
  const after = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, value: typeof updatedAmounts[index] === "number" && Number.isFinite(updatedAmounts[index]) ? updatedAmounts[index] as number : null, manual: updatedFlags[index] === true }))
  if (!result?.ok) errors.push(...(result && "errors" in result ? result.errors ?? ["operation-rejected"] : ["operation-unavailable"]))
  const annualAfter = typeof updated?.annual === "number" && Number.isFinite(updated.annual) ? updated.annual : null
  return { rowId, revision, operation, annualBefore, annualAfter, allMonthsManual, ...(errors.length ? {} : { command }), before, after, changedMonths: after.filter((cell, index) => cell.value !== before[index]?.value || cell.manual !== before[index]?.manual).map((cell) => cell.month), errors }
}

/** Parse a pasted or edited range without discarding invalid cells or local text. */
export function prepareMonthlyDrafts(page: "OPEX" | "CAPEX", versionId: string, drafts: readonly MonthlyDraft[]) {
  return drafts.map((draft) => {
    const errors: { cell?: MonthlyDraft["cells"][number]; reason: string }[] = draft.cells.flatMap((cell) => {
      if (!Number.isInteger(cell.month) || cell.month < 1 || cell.month > 12) return [{ cell, reason: "invalid-month" }]
      if (cell.text.trim() === "" && cell.measure === "budget") return [{ cell, reason: "budget-requires-value" }]
      if (cell.text.trim() !== "" && !Number.isFinite(Number(cell.text))) return [{ cell, reason: "invalid-number" }]
      return []
    })
    if (!versionId.trim() || !draft.rowId.trim() || !Number.isSafeInteger(draft.revision) || draft.revision < 0 || !draft.cells.length)
      errors.push({ reason: "invalid-row-context" })
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

/** Preview each valid row through the domain, retaining rejected and unparsed drafts. */
export function previewMonthlyDrafts(snapshot: Snapshot, actor: Actor, environment: Environment, page: "OPEX" | "CAPEX", versionId: string, drafts: readonly MonthlyDraft[]) {
  const prepared = prepareMonthlyDrafts(page, versionId, drafts)
  const valid = prepared.filter((item) => item.command !== undefined)
  const preview = simulatePlannerCommands(snapshot, actor, valid.flatMap((item) => item.command ? [item.command] : []), environment)
  return { view: preview.view, before: projectMonthlyGrid(projectPlanner(snapshot, actor, environment), actor, page, versionId), after: projectMonthlyGrid(preview.view, actor, page, versionId), rows: prepared.map((item) => ({ ...item, result: item.command ? preview.results[valid.indexOf(item)] : undefined })) }
}
