import { expect, test } from "bun:test"
import { compareImportProjections } from "../../../../product/imports/changes.ts"

test("changes distinguish missing, null and zero without treating reordered IDs as new records", () => {
  const before = { rows: [{ id: "a", amount: null }, { id: "b", amount: 2 }] }
  const after = { rows: [{ id: "b", amount: 2 }, { id: "a", amount: 0, note: null }] }
  expect(compareImportProjections(before, after)).toEqual([
    { path: "/rows/@id=a/amount", kind: "changed", before: { state: "present", value: null }, after: { state: "present", value: 0 } },
    { path: "/rows/@id=a/note", kind: "added", before: { state: "absent" }, after: { state: "present", value: null } },
  ])
})
