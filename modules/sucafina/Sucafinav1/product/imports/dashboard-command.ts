import { rows, text } from "../../runtime/contract.ts"
import type { Command, Snapshot } from "../../runtime/contract.ts"
import type { SourceRef } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { DashboardImportFormat } from "../dashboard/imports.ts"
import type { ParsedImport } from "./files.ts"
import type { ImportTarget } from "./staged-files.ts"

/** Build the original Dashboard domain commands from an already admitted, parsed workbook. */
export function buildDashboardWorkbookCommand(input: { parsed: ParsedImport; target: ImportTarget; source: SourceRef; snapshot: Snapshot }): PortResult<{ format: DashboardImportFormat; command: Command }> {
  if (input.target.surface !== "dashboard" || input.source.surface !== "dashboard" || !input.parsed.sheets) return { status: "needs-input", reason: "dashboard-workbook-required" }
  const sheet = input.target.options.preview.sheet
  const versions = Object.fromEntries(Object.entries(input.snapshot.versions).map(([key, value]) => [key, value.version]))
  if (sheet === "All Members") {
    const members = input.parsed.sheets["All Members"]
    if (!members) return { status: "needs-input", reason: "sheet-unavailable" }
    return { status: "ok", value: { format: "all-members", command: { page: "Talent Review", action: "import", version: 0, values: { rows: members, replace: input.target.options.preview.replace === true, versions } } } }
  }
  if (sheet === "Projects Import" || sheet === "All Projects") {
    const projects = input.parsed.sheets[sheet]
    if (!projects) return { status: "needs-input", reason: "sheet-unavailable" }
    const columns: Record<string, string> = { Name: "name", "Project Name": "name", Description: "desc", Status: "status", Risk: "risk", Priority: "priority", "Project Manager": "pm", "Start Date": "start", "End Date": "end", "Budget (USD)": "budget", "Spent (USD)": "spent", "% Complete": "pct", Notes: "notes" }
    const mapped = projects.map((row) => {
      const values = Object.fromEntries(Object.entries(columns).filter(([key]) => row[key] !== undefined).map(([key, field]) => [field, row[key]]))
      const leader = rows(input.snapshot.data.leaders).find((item) => text(item.name).trim().toLowerCase() === text(row["IT Leader"]).trim().toLowerCase())
      if (leader) values.leaderId = leader.id
      return { ...values, _status: text(values.name).trim() ? "valid" : "error" }
    })
    return { status: "ok", value: { format: "all-projects", command: { page: "All Projects", action: "import", version: 0, values: { rows: mapped, mode: input.target.options.preview.replace === true ? "replace" : "update", versions } } } }
  }
  if (sheet === "Ticket Register") {
    const period = /^(\d{4})-(\d{2})-01$/.exec(input.source.period.start)
    if (!period || Number(period[2]) < 1 || Number(period[2]) > 12 || input.source.period.end !== `${period[1]}-${period[2]}-${String(new Date(Date.UTC(Number(period[1]), Number(period[2]), 0)).getUTCDate()).padStart(2, "0")}`) return { status: "needs-input", reason: "single-month-required" }
    const year = Number(period[1]); const month = Number(period[2])
    const row = input.parsed.sheets[sheet]?.find((item) => item.year === year && item.month === month)
    if (!row || !row.tickets || typeof row.tickets !== "object" || Array.isArray(row.tickets)) return { status: "needs-input", reason: "month-unavailable" }
    return { status: "ok", value: { format: "ticket-register", command: { page: "IT Operations", action: "import-month", id: `${year}-${month}`, version: versions[`ops:${year}-${month}`] ?? 0, values: { year, month, tickets: row.tickets, categoriesVersion: versions["ops-list:opsCats"] ?? 0, itemsVersion: versions["ops-list:opsHmItems"] ?? 0 } } } }
  }
  return { status: "needs-input", reason: "supported-sheet-selection-required" }
}
