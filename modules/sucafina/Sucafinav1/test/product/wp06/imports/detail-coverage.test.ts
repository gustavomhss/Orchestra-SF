import { expect, test } from "bun:test"
import { plannerImportDetail } from "../../../../product/imports/detail.ts"

test("preview detail reports explicitly classified unchanged and ignored cells by physical workbook address", () => {
  const detail = plannerImportDetail({
    manifestId: "preview",
    version: 1,
    sourceDigest: "a".repeat(64),
    domainReference: "planner-v1",
    changes: [],
    locations: {},
    outcomes: [
      { kind: "unchanged", source: { sheet: "OPEX", row: 4, column: 6, address: "F4", field: "Jan" }, reason: "domain-retained-value" },
      { kind: "ignored", source: { sheet: "Headcount", row: 8, column: 11, address: "K8", field: "Classification" }, reason: "not-consumed-by-import" },
      { kind: "ignored", source: { sheet: "Headcount", row: 8, column: 13, address: "M8", field: "Rate Override" }, reason: "protected-field" },
      { kind: "unchanged", source: { sheet: "OPEX", row: 4, column: 6, address: "G4", field: "Jan" }, reason: "domain-no-change" },
    ],
  })

  expect(detail.changes).toEqual([
    { path: "/workbook/OPEX/rows/4/Jan", kind: "unchanged", before: { state: "undefined" }, after: { state: "undefined" }, source: { kind: "file", sheet: "OPEX", row: 4, column: 6, address: "F4", field: "Jan" }, reason: "The domain retained the existing value; this input will not be applied." },
    { path: "/workbook/Headcount/rows/8/Classification", kind: "ignored", before: { state: "undefined" }, after: { state: "undefined" }, source: { kind: "file", sheet: "Headcount", row: 8, column: 11, address: "K8", field: "Classification" }, reason: "The original importer does not consume this field." },
  ])
  expect(JSON.stringify(detail)).not.toContain("Rate Override")
})
