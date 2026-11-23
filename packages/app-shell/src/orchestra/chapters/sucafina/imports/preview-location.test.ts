import { expect, test } from "bun:test"
import { importGapLocation, type ImportPreviewChange } from "./preview-location"

const change: ImportPreviewChange = {
  path: "/versions/@id=source-version/lines/@id=source-line/desc",
  kind: "changed",
  before: { state: "absent" },
  after: { state: "present", value: "Recorded description" },
  source: { kind: "file", sheet: "OPEX", row: 2, column: 4, address: "D2", field: "Description" },
}

test("gap context uses the unique admitted change and its exact source metadata", () => {
  const before = importGapLocation(change.path + ":before", [change])
  expect(before).toEqual({ change, side: "before" })
  expect(before?.change.source).toBe(change.source)
  expect(importGapLocation(change.path + ":after", [change])).toEqual({ change, side: "after" })
  expect(change.before).toEqual({ state: "absent" })
})

test("similar, ambiguous and financial-only references never acquire invented file identity", () => {
  expect(importGapLocation(change.path + "-other:before", [change])).toBeUndefined()
  expect(importGapLocation(change.path + ":unknown", [change])).toBeUndefined()
  expect(importGapLocation("before:source-line:1:forecast", [change])).toBeUndefined()
  expect(importGapLocation(change.path + ":before", [change, { ...change }])).toBeUndefined()
  expect(importGapLocation(change.path + ":before", [])).toBeUndefined()
})
