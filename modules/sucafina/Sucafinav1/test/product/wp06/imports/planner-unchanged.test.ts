import { expect, test } from "bun:test"
import { plannerUnchangedOutcomes } from "../../../../product/imports/planner-unchanged.ts"

const row = { "Line ID": "line-1", Measure: "Budget", Jan: 0 }
const origin = { sheet: "OPEX", recordIndex: 0, row: 4, column: 6, address: "F4", field: "Jan" }
const parsed = { sourceDigest: "digest", format: "xlsx", sheets: { OPEX: [row] }, origins: [origin] }
const projection = { versions: [{ id: "v1", lines: [{ id: "line-1", sec: "opex", b: [0], a: [null], f: [null] }] }] }

test("Planner unchanged outcome keeps a physically sourced zero only when both projections match", () => {
  expect(plannerUnchangedOutcomes({ parsed, before: projection, after: projection, versionId: "v1" })).toEqual([
    { kind: "unchanged", source: { sheet: "OPEX", row: 4, column: 6, address: "F4", field: "Jan" }, reason: "domain-no-change" },
  ])
})

test("changed values and missing or ambiguous line identities remain unclassified", () => {
  const changed = { versions: [{ id: "v1", lines: [{ id: "line-1", sec: "opex", b: [1], a: [null], f: [null] }] }] }
  const duplicate = { ...parsed, sheets: { OPEX: [row, row] }, origins: [origin, { ...origin, recordIndex: 1, row: 5, address: "F5" }] }
  const missingId = { ...parsed, sheets: { OPEX: [{ ...row, "Line ID": "unknown" }] } }
  const withoutOrigin = { ...parsed, origins: [] }

  expect(plannerUnchangedOutcomes({ parsed, before: projection, after: changed, versionId: "v1" })).toEqual([])
  expect(plannerUnchangedOutcomes({ parsed: duplicate, before: projection, after: projection, versionId: "v1" })).toEqual([])
  expect(plannerUnchangedOutcomes({ parsed: missingId, before: projection, after: projection, versionId: "v1" })).toEqual([])
  expect(plannerUnchangedOutcomes({ parsed: withoutOrigin, before: projection, after: projection, versionId: "v1" })).toEqual([])
})

test("Planner unchanged outcomes exclude synthetic HR lines", () => {
  const hr = { ...parsed, sheets: { OPEX: [{ ...row, "Line ID": "HR:ops", "Cost element": "HR" }] } }
  const hrProjection = { versions: [{ id: "v1", lines: [{ id: "HR:ops", sec: "opex", synthetic: true, b: [0], a: [null], f: [null] }] }] }
  expect(plannerUnchangedOutcomes({ parsed: hr, before: hrProjection, after: hrProjection, versionId: "v1" })).toEqual([])
})
