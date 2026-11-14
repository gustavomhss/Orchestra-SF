import { expect, test } from "bun:test"
import { compareImportProjections } from "../../../../product/imports/changes.ts"
import { plannerImportDetail } from "../../../../product/imports/detail.ts"

test("detail retains the authorized change and only uses explicit workbook locations", () => {
  const changes = compareImportProjections({ rows: [{ id: "line", forecast: null }] }, { rows: [{ id: "line", forecast: 0, note: "x" }] })
  const detail = plannerImportDetail({ manifestId: "preview", version: 1, sourceDigest: "a".repeat(64), domainReference: "planner-v1", changes, locations: { "/rows/@id=line/forecast": { sheet: "OPEX", row: 4, column: 6, address: "F4", field: "Jan" } } })
  expect(detail.changes).toEqual([
    { path: "/rows/@id=line/forecast", kind: "changed", before: { state: "present", value: null }, after: { state: "present", value: 0 }, source: { kind: "file", sheet: "OPEX", row: 4, column: 6, address: "F4", field: "Jan" } },
    { path: "/rows/@id=line/note", kind: "added", before: { state: "absent" }, after: { state: "present", value: "x" }, source: { kind: "domain", reference: "planner-v1" } },
  ])
})
