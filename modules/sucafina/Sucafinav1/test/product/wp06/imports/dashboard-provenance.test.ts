import { expect, test } from "bun:test"
import { compareImportProjections } from "../../../../product/imports/changes.ts"
import { dashboardImportLocations } from "../../../../product/imports/dashboard-provenance.ts"

test("member change points to one actual workbook cell, never an ambiguous row", () => {
  const before = { members: [{ id: "m1", name: "Ana", title: "Old" }] }
  const after = { members: [{ id: "m1", name: "Ana", title: "New" }] }
  const changes = compareImportProjections(before, after)
  const parsed = { sourceDigest: "digest", format: "xlsx", sheets: { "All Members": [{ Name: "Ana", Title: "New" }] }, origins: [{ sheet: "All Members", recordIndex: 0, row: 4, column: 2, address: "B4", field: "Title" }] }
  expect(dashboardImportLocations({ parsed, sheet: "All Members", after, changes })).toEqual({ "/members/@id=m1/title": { sheet: "All Members", row: 4, column: 2, address: "B4", field: "Title" } })
  const duplicate = { ...parsed, sheets: { "All Members": [...parsed.sheets["All Members"], { Name: "Ana", Title: "New" }] } }
  expect(dashboardImportLocations({ parsed: duplicate, sheet: "All Members", after, changes })).toEqual({})
  const altered = { ...parsed, sheets: { "All Members": [{ Name: "Ana", Title: "Different" }] } }
  expect(dashboardImportLocations({ parsed: altered, sheet: "All Members", after, changes })).toEqual({})
})

test("ticket metric uses the source cell for its selected month", () => {
  const metric = "Support|Incidents|Open"
  const before = { opsTickets: [{ id: "2026-2", [metric]: 3 }] }
  const after = { opsTickets: [{ id: "2026-2", [metric]: 8 }] }
  const changes = compareImportProjections(before, after)
  const parsed = { sourceDigest: "digest", format: "xlsx", sheets: { "Ticket Register": [{ year: 2026, month: 1, tickets: { [metric]: 2 } }, { year: 2026, month: 2, tickets: { [metric]: 8 } }] }, origins: [{ sheet: "Ticket Register", recordIndex: 1, row: 5, column: 5, address: "E5", field: `tickets.${metric}` }] }
  expect(dashboardImportLocations({ parsed, sheet: "Ticket Register", after, changes })).toEqual({ [`/opsTickets/@id=2026-2/${metric}`]: { sheet: "Ticket Register", row: 5, column: 5, address: "E5", field: `tickets.${metric}` } })
})
