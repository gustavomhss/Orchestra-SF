import { expect, test } from "bun:test"
import { buildDashboardWorkbookCommand } from "../../../../product/imports/dashboard-command.ts"

const period = { start: "2026-01-01", end: "2026-01-31" }
const source = { surface: "dashboard" as const, type: "dashboard-page", id: "IT Operations", incarnation: "inc", version: 1, fields: ["tickets"], period, observedAt: "2026-11-13T00:00:00Z" }
const target = { surface: "dashboard" as const, selectionRef: "selection", incarnation: "inc", version: 1, options: { newVersion: false, removeMissing: false, preview: { sheet: "Ticket Register" } } }
const snapshot = { data: {}, versions: { "ops:2026-1": { version: 4, by: "user" }, "ops-list:opsCats": { version: 2, by: "user" } }, sequences: {}, audit: [], notices: [] }

test("ticket command uses the authorized selected month and current revision, preserving zero", () => {
  const parsed = { format: "xlsx", sourceDigest: "a".repeat(64), sheets: { "Ticket Register": [{ year: 2026, month: 1, tickets: { "Support|Incidents|Open": 0 } }, { year: 2026, month: 2, tickets: { "Support|Incidents|Open": 9 } }] } }
  const result = buildDashboardWorkbookCommand({ parsed, target, source, snapshot })
  expect(result).toMatchObject({ status: "ok", value: { format: "ticket-register", command: { action: "import-month", version: 4, values: { year: 2026, month: 1, tickets: { "Support|Incidents|Open": 0 }, categoriesVersion: 2 } } } })
  if (result.status === "ok") expect(result.value.command.confirmed).toBeUndefined()
  expect(buildDashboardWorkbookCommand({ parsed, target, source: { ...source, period: { start: "2026-03-01", end: "2026-03-31" } }, snapshot }).status).toBe("needs-input")
})
