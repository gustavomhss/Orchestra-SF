import type { ImportChange } from "./changes.ts"
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
