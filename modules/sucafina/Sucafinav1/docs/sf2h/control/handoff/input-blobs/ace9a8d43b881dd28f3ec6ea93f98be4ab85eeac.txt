import type { WorkbookOutcome } from "./detail.ts"
import type { ParsedImport } from "./files.ts"

/** Reports only workbook cells whose original Planner line and authorized projections all agree. */
export function plannerUnchangedOutcomes(input: { parsed: ParsedImport; before: PlannerProjection; after: PlannerProjection; versionId: string }): WorkbookOutcome[] {
  if (!input.versionId.trim() || !input.parsed.sheets || !input.parsed.origins) return []
  const beforeVersions = versions(input.before)
  const afterVersions = versions(input.after)
  const before = beforeVersions.filter((version) => version.id === input.versionId)
  const after = afterVersions.filter((version) => version.id === input.versionId)
  if (before.length !== 1 || after.length !== 1) return []
  const beforeLines = records(before[0]!.lines)
  const afterLines = records(after[0]!.lines)
  return (["OPEX", "CAPEX"] as const).flatMap((sheet) => (input.parsed.sheets?.[sheet] ?? []).flatMap((row, recordIndex) => {
    const rawLineId = row["Line ID"]
    const lineId = typeof rawLineId === "string" || typeof rawLineId === "number" && Number.isFinite(rawLineId) ? String(rawLineId) : ""
    const measure = typeof row.Measure === "string" ? row.Measure.trim().toLowerCase() : ""
    const sec = sheet === "OPEX" ? "opex" : "capex"
    if (!lineId.trim() || lineId.startsWith("HR:") || measure !== "budget" && measure !== "actual" && measure !== "forecast" || String(row["Cost element"] ?? "").trim().toLowerCase() === "hr") return []
    if ((input.parsed.sheets?.[sheet] ?? []).filter((candidate) => String(candidate["Line ID"] ?? "") === lineId && typeof candidate.Measure === "string" && candidate.Measure.trim().toLowerCase() === measure).length !== 1) return []
    const left = beforeLines.filter((line) => line.id === lineId)
    const right = afterLines.filter((line) => line.id === lineId)
    if (left.length !== 1 || right.length !== 1 || left[0]!.sec !== sec || right[0]!.sec !== sec || left[0]!.synthetic === true || right[0]!.synthetic === true) return []
    const monthlyField = measure === "budget" ? "b" : measure === "actual" ? "a" : "f"
    return months.flatMap((month, index) => {
      const source = row[month]
      if (source !== null && (typeof source !== "number" || !Number.isFinite(source))) return []
      const beforeValues = left[0]![monthlyField]
      const afterValues = right[0]![monthlyField]
      if (!Array.isArray(beforeValues) || !Array.isArray(afterValues) || index >= beforeValues.length || index >= afterValues.length || !sameValue(source, beforeValues[index], afterValues[index])) return []
      const origins = input.parsed.origins!.filter((origin) => origin.sheet === sheet && origin.recordIndex === recordIndex && origin.field === month)
      if (origins.length !== 1 || !validOrigin(origins[0]!)) return []
      const origin = origins[0]!
      return [{ kind: "unchanged" as const, source: { sheet: origin.sheet, row: origin.row, column: origin.column, address: origin.address, field: origin.field }, reason: "domain-no-change" as const }]
    })
  }))
}

type PlannerProjection = { versions?: unknown; data?: { versions?: unknown } }

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function versions(projection: PlannerProjection) {
  const data = projection.data && typeof projection.data === "object" ? projection.data : projection
  return records(data.versions)
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object" && !Array.isArray(entry)) : []
}

function sameValue(source: unknown, before: unknown, after: unknown) {
  return (source === null || typeof source === "number" && Number.isFinite(source)) && source === before && before === after
}

function validOrigin(origin: NonNullable<ParsedImport["origins"]>[number]) {
  return Number.isSafeInteger(origin.row) && origin.row > 0 && Number.isSafeInteger(origin.column) && origin.column > 0 && origin.address === `${columnName(origin.column)}${origin.row}`
}

function columnName(column: number) {
  let value = column
  let name = ""
  while (value > 0) {
    value -= 1
    name = String.fromCharCode(65 + value % 26) + name
    value = Math.floor(value / 26)
  }
  return name
}
