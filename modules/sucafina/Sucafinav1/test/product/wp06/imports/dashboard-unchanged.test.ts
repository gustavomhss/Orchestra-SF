import { expect, test } from "bun:test"
import { dashboardImportUnchangedOutcomes } from "../../../../product/imports/dashboard-provenance.ts"

const origin = { sheet: "All Members", recordIndex: 0, row: 4, column: 2, address: "B4", field: "Title" }
const parsed = { sourceDigest: "digest", format: "xlsx", sheets: { "All Members": [{ Name: "Ana", Title: "Finance" }] }, origins: [origin] }

test("unchanged Dashboard cell requires one source mapping and exact before, after and source equality", () => {
  expect(dashboardImportUnchangedOutcomes({
    parsed,
    sheet: "All Members",
    before: { members: [{ id: "m1", name: "Ana", title: "Finance" }] },
    after: { members: [{ id: "m1", name: "Ana", title: "Finance" }] },
  })).toEqual([{ kind: "unchanged", source: { sheet: "All Members", row: 4, column: 2, address: "B4", field: "Title" }, reason: "domain-no-change" }])
})

test("renamed, duplicate, missing-identity and unlocated workbook records stay unclassified", () => {
  const before = { members: [{ id: "m1", name: "Ana", title: "Finance" }] }
  const after = { members: [{ id: "m1", name: "Ana", title: "Finance" }] }
  const renamed = { ...parsed, sheets: { "All Members": [{ Name: "Ana New", Title: "Finance" }] } }
  const duplicate = { ...parsed, sheets: { "All Members": [...parsed.sheets["All Members"], { Name: "Ana", Title: "Finance" }] }, origins: [...parsed.origins, { ...origin, recordIndex: 1, row: 5, address: "B5" }] }
  const withoutOrigin = { ...parsed, origins: [] }
  const withoutId = { ...parsed, sheets: { "All Members": [{ Name: "Ana", Title: "Finance" }] } }
  const missingIdentity = { members: [{ name: "Ana", title: "Finance" }] }

  expect(dashboardImportUnchangedOutcomes({ parsed: renamed, sheet: "All Members", before, after })).toEqual([])
  expect(dashboardImportUnchangedOutcomes({ parsed: duplicate, sheet: "All Members", before, after })).toEqual([])
  expect(dashboardImportUnchangedOutcomes({ parsed: withoutOrigin, sheet: "All Members", before, after })).toEqual([])
  expect(dashboardImportUnchangedOutcomes({ parsed: withoutId, sheet: "All Members", before: missingIdentity, after: missingIdentity })).toEqual([])
})

test("unchanged outcomes do not expose fields absent from the authorized workbook map", () => {
  const restricted = { ...parsed, sheets: { "All Members": [{ Name: "Ana", Title: "Finance", Salary: 250000 }] }, origins: [{ ...origin, column: 3, address: "C4", field: "Salary" }] }
  expect(dashboardImportUnchangedOutcomes({
    parsed: restricted,
    sheet: "All Members",
    before: { members: [{ id: "m1", name: "Ana", title: "Finance", salary: 250000 }] },
    after: { members: [{ id: "m1", name: "Ana", title: "Finance", salary: 250000 }] },
  })).toEqual([])
})
