import type { ImportChange } from "./changes.ts"
import type { WorkbookOutcome } from "./detail.ts"
import type { ParsedImport } from "./files.ts"

/** Name-matched workbook cells are used only when the selected row, column and value are unambiguous. */
export function dashboardImportLocations(input: { parsed: ParsedImport; sheet?: string; after: Record<string, unknown>; changes: readonly ImportChange[] }) {
  const sheet = input.sheet
  if (!sheet || !input.parsed.sheets || !input.parsed.origins) return {}
  if (sheet === "Ticket Register") {
    const rows = input.parsed.sheets[sheet] ?? []
    return Object.fromEntries(input.changes.flatMap((change) => {
      const match = change.path.match(/^\/opsTickets\/@id=([^/]+)\/([^/]+)$/)
      if (!match || change.after.state !== "present") return []
      const id = match[1]!.replace(/~1/g, "/").replace(/~0/g, "~")
      const field = match[2]!.replace(/~1/g, "/").replace(/~0/g, "~")
      const matching = rows.flatMap((row, index) => `${row.year}-${row.month}` === id ? [index] : [])
      if (matching.length !== 1) return []
      const index = matching[0]!
      const tickets = rows[index]?.tickets
      if (!tickets || typeof tickets !== "object" || Array.isArray(tickets) || (tickets as Record<string, unknown>)[field] !== change.after.value) return []
      const origins = input.parsed.origins!.filter((origin) => origin.sheet === sheet && origin.recordIndex === index && origin.field === `tickets.${field}`)
      if (origins.length !== 1) return []
      const origin = origins[0]!
      return [[change.path, { sheet: origin.sheet, row: origin.row, column: origin.column, address: origin.address, field: origin.field }]]
    }))
  }
  const collection = sheet === "All Members" ? "members" : sheet === "Projects Import" || sheet === "All Projects" ? "projects" : undefined
  if (!collection || !Array.isArray(input.after[collection])) return {}
  const fields: Record<string, readonly string[]> = collection === "members" ? { name: ["Name"], title: ["Title"], type: ["Type"], location: ["Location"], start: ["Start Date", "Start"], end: ["End Date", "End"], status: ["Status"], cls: ["Classification"], outlook: ["Outlook"], notes: ["Notes"] } : { name: ["Name", "Project Name"], desc: ["Description"], status: ["Status"], risk: ["Risk"], priority: ["Priority"], pm: ["Project Manager"], start: ["Start Date"], end: ["End Date"], budget: ["Budget (USD)"], spent: ["Spent (USD)"], pct: ["% Complete"], notes: ["Notes"] }
  const values = input.after[collection] as unknown[]
  const rows = input.parsed.sheets[sheet] ?? []
  return Object.fromEntries(input.changes.flatMap((change) => {
    const match = change.path.match(new RegExp(`^/${collection}/@id=([^/]+)/([^/]+)$`))
    if (!match || change.after.state !== "present") return []
    const id = match[1]!.replace(/~1/g, "/").replace(/~0/g, "~")
    const field = match[2]!.replace(/~1/g, "/").replace(/~0/g, "~")
    const columns = fields[field]
    if (!columns) return []
    const record = values.find((value) => value && typeof value === "object" && !Array.isArray(value) && String((value as Record<string, unknown>).id) === id) as Record<string, unknown> | undefined
    if (!record || typeof record.name !== "string" || !record.name.trim()) return []
    const matching = rows.flatMap((row, index) => {
      const name = row.Name ?? row["Project Name"]
      return typeof name === "string" && name.trim().toLowerCase() === (record.name as string).trim().toLowerCase() ? [index] : []
    })
    if (matching.length !== 1) return []
    const index = matching[0]!
    const after = change.after.value
    const origins = input.parsed.origins!.filter((origin) => origin.sheet === sheet && origin.recordIndex === index && columns.includes(origin.field) && rows[index]?.[origin.field] === after)
    if (origins.length !== 1) return []
    const origin = origins[0]!
    return [[change.path, { sheet: origin.sheet, row: origin.row, column: origin.column, address: origin.address, field: origin.field }]]
  }))
}

/** Unchanged cells need an exact authorized value on both sides and one physical, name-matched source cell. */
export function dashboardImportUnchangedOutcomes(input: { parsed: ParsedImport; sheet?: string; before: Record<string, unknown>; after: Record<string, unknown> }): WorkbookOutcome[] {
  const sheet = input.sheet
  if (!sheet || !input.parsed.sheets || !input.parsed.origins) return []
  const rows = input.parsed.sheets[sheet] ?? []
  if (sheet === "Ticket Register") {
    const beforeRows = records(input.before.opsTickets)
    const afterRows = records(input.after.opsTickets)
    return rows.flatMap((row, recordIndex) => {
      if (typeof row.year !== "number" || !Number.isSafeInteger(row.year) || typeof row.month !== "number" || !Number.isSafeInteger(row.month) || row.month < 1 || row.month > 12 || !row.tickets || typeof row.tickets !== "object" || Array.isArray(row.tickets)) return []
      const id = `${row.year}-${row.month}`
      if (rows.filter((candidate) => candidate.year === row.year && candidate.month === row.month).length !== 1) return []
      const left = beforeRows.filter((value) => value.id === id)
      const right = afterRows.filter((value) => value.id === id)
      if (left.length !== 1 || right.length !== 1) return []
      const tickets = row.tickets as Record<string, unknown>
      return Object.keys(tickets).flatMap((field) => {
        const value = tickets[field]
        if (!samePresentValue(left[0]![field], right[0]![field], value)) return []
        const origins = input.parsed.origins!.filter((origin) => origin.sheet === sheet && origin.recordIndex === recordIndex && origin.field === `tickets.${field}`)
        if (origins.length !== 1) return []
        return [{ kind: "unchanged" as const, source: locations(origins[0]!), reason: "domain-no-change" as const }]
      })
    })
  }
  const collection = sheet === "All Members" ? "members" : sheet === "Projects Import" || sheet === "All Projects" ? "projects" : undefined
  if (!collection) return []
  const fields: readonly [string, readonly string[]][] = collection === "members"
    ? [["name", ["Name"]], ["title", ["Title"]], ["type", ["Type"]], ["location", ["Location"]], ["start", ["Start Date", "Start"]], ["end", ["End Date", "End"]], ["status", ["Status"]], ["cls", ["Classification"]], ["outlook", ["Outlook"]], ["notes", ["Notes"]]]
    : [["name", ["Name", "Project Name"]], ["desc", ["Description"]], ["status", ["Status"]], ["risk", ["Risk"]], ["priority", ["Priority"]], ["pm", ["Project Manager"]], ["start", ["Start Date"]], ["end", ["End Date"]], ["budget", ["Budget (USD)"]], ["spent", ["Spent (USD)"]], ["pct", ["% Complete"]], ["notes", ["Notes"]]]
  const beforeRows = records(input.before[collection])
  const afterRows = records(input.after[collection])
  return rows.flatMap((row, recordIndex) => {
    const name = row.Name ?? row["Project Name"]
    if (typeof name !== "string" || !name.trim()) return []
    if (rows.filter((candidate) => {
      const candidateName = candidate.Name ?? candidate["Project Name"]
      return typeof candidateName === "string" && candidateName.trim().toLowerCase() === name.trim().toLowerCase()
    }).length !== 1) return []
    const matching = (values: Record<string, unknown>[]) => values.filter((value) => typeof value.name === "string" && value.name.trim().toLowerCase() === name.trim().toLowerCase())
    const left = matching(beforeRows)
    const right = matching(afterRows)
    if (left.length !== 1 || right.length !== 1 || !stableRecordId(left[0]!.id) || !stableRecordId(right[0]!.id) || left[0]!.id !== right[0]!.id) return []
    return fields.flatMap(([field, columns]) => {
      const sourceField = columns.find((column) => Object.hasOwn(row, column))
      if (!sourceField || !samePresentValue(left[0]![field], right[0]![field], row[sourceField])) return []
      const origins = input.parsed.origins!.filter((origin) => origin.sheet === sheet && origin.recordIndex === recordIndex && origin.field === sourceField)
      if (origins.length !== 1) return []
      return [{ kind: "unchanged" as const, source: locations(origins[0]!), reason: "domain-no-change" as const }]
    })
  })
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object" && !Array.isArray(entry)) : []
}

function samePresentValue(before: unknown, after: unknown, source: unknown) {
  return before !== undefined && after !== undefined && before === after && after === source
}

function stableRecordId(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : typeof value === "number" && Number.isFinite(value)
}

function locations(origin: NonNullable<ParsedImport["origins"]>[number]) {
  return { sheet: origin.sheet, row: origin.row, column: origin.column, address: origin.address, field: origin.field }
}
