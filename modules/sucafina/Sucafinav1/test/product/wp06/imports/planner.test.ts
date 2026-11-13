import { expect, test } from "bun:test"
import { createPlannerImportMutation, preparePlannerWorkbook, plannerImportEnvironment, plannerWorkbookHasRoster } from "../../../../product/imports/planner.ts"
import { domain } from "../../../../runtime/planner.ts"
import { projectPlannerSource } from "../../../../product/planner/port.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { exportPlanner, parseWorkbook } from "../../../../runtime/workbooks.ts"
import { emptyFlags } from "../../../../src/planner-accounts.ts"

const actor = { id: "finance", roles: ["finance"], canWrite: true }
const environment = { at: "2026-11-13T00:00:00Z", id: () => "host-id", directory: [] }

test("roster scope is required for both All Members and roster-shaped Headcount", () => {
  expect(plannerWorkbookHasRoster({ "All Members": [] })).toBe(true)
  expect(plannerWorkbookHasRoster({ Headcount: [{ Name: "Person", Leader: "Lead" }] })).toBe(true)
  expect(plannerWorkbookHasRoster({ Headcount: [{ Name: "Person", Leader: "Lead", "Position ID": "p1" }] })).toBe(false)
})

test("workbook preview and real Planner command agree without mutating the source", () => {
  const snapshot: Snapshot = { data: { versions: [{ id: "v1", year: 2027, closed: 0, locked: false, lines: [{ id: "42", sec: "opex", el: "licenses", name: "Licences", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(null) }], projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }], officials: {}, entities: [], allocations: [] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const original = structuredClone(snapshot)
  const input = { snapshot, actor, environment, versionId: "v1", sheets: { OPEX: [{ "Line ID": "42", "Cost element": "Licenses", "Vendor / item": "Licences", Currency: "USD", Measure: "Forecast", Jan: 0 }] }, newVersion: false, removeMissing: false, operationId: "operation-1", idempotencyKey: "key-1", targetIncarnation: "inc-1" }
  const preview = preparePlannerWorkbook(input)
  expect(preview.result.ok).toBe(true)
  expect(snapshot).toEqual(original)
  const applied = structuredClone(snapshot)
  const result = domain.execute(applied, actor, preview.command, plannerImportEnvironment(environment, input.operationId))
  expect(result).toEqual(preview.result)
  expect(domain.view(applied, actor, plannerImportEnvironment(environment, input.operationId))).toEqual(preview.after)
  const lines = ((applied.data.versions as { lines: { f: (number | null)[] }[] }[])[0]).lines
  expect(lines[0].f[0]).toBe(0)
  const mutation = createPlannerImportMutation({ command: preview.command, commandDigest: preview.commandDigest, previewDigest: preview.previewDigest, actorId: actor.id, operationId: input.operationId, idempotencyKey: "key-1", targetIncarnation: "inc-1", previewAt: environment.at, verifyTarget: (_, id, incarnation) => id === "v1" && incarnation === "inc-1" })
  if (!mutation) throw new Error("Planner import was not prepared")
  const commit = structuredClone(snapshot)
  expect(mutation.execute(commit, actor, environment).commit).toBe(true)
  expect(commit).toEqual(applied)
  const repeated = preparePlannerWorkbook({ ...input, snapshot: applied, operationId: "operation-2", idempotencyKey: "key-2" })
  const noChange = createPlannerImportMutation({ command: repeated.command, commandDigest: repeated.commandDigest, previewDigest: repeated.previewDigest, actorId: actor.id, operationId: "operation-2", idempotencyKey: "key-2", targetIncarnation: "inc-1", previewAt: environment.at, verifyTarget: () => true })!
  const unchanged = structuredClone(applied)
  expect(noChange.execute(unchanged, actor, environment)).toMatchObject({ commit: true, value: { status: "unchanged", changedFields: 0 } })
  expect(unchanged).toEqual(applied)
  const stale = structuredClone(snapshot)
  stale.versions["versions:v1"] = { version: 1, by: "another" }
  const staleBefore = structuredClone(stale)
  expect(mutation.execute(stale, actor, environment).commit).toBe(false)
  expect(stale).toEqual(staleBefore)
  expect(createPlannerImportMutation({ command: preview.command, commandDigest: preview.commandDigest, previewDigest: "0".repeat(64), actorId: actor.id, operationId: input.operationId, idempotencyKey: "key-1", targetIncarnation: "inc-1", previewAt: environment.at, verifyTarget: () => true })).toBeUndefined()
  expect(createPlannerImportMutation({ command: { ...preview.command, confirmed: true }, commandDigest: preview.commandDigest, previewDigest: preview.previewDigest, actorId: actor.id, operationId: input.operationId, idempotencyKey: "key-1", targetIncarnation: "inc-1", previewAt: environment.at, verifyTarget: () => true })).toBeUndefined()
})

test("replayed operation identities are deterministic and distinct per operation", () => {
  const first = plannerImportEnvironment(environment, "one")
  const retry = plannerImportEnvironment(environment, "one")
  const other = plannerImportEnvironment(environment, "two")
  expect([first.id(), first.id()]).toEqual([retry.id(), retry.id()])
  expect(other.id()).not.toBe(plannerImportEnvironment(environment, "one").id())
})

test("forecast workbook replaces the included amount without changing budget or actual", () => {
  const snapshot: Snapshot = { data: { versions: [{ id: "v1", year: 2027, closed: 9, lines: [{ id: "line", sec: "opex", el: "licenses", name: "Licences", cur: "USD", b: [40000, 45000, 45000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 60000, 60000], a: [40000, 40000, 45000, 45000, 45000, 45000, 45000, 45000, 50000, null, null, null], f: [null, null, null, null, null, null, null, null, null, 38000, 112000, 40000] }], projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }], officials: {}, entities: [], allocations: [] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const before = projectPlannerSource(snapshot, actor, "v1")!
  const preview = preparePlannerWorkbook({ snapshot, actor, environment, versionId: "v1", sheets: { OPEX: [{ "Line ID": "line", "Cost element": "Licenses", "Vendor / item": "Licences", Currency: "USD", Measure: "Forecast", Oct: 38000, Nov: 124000, Dec: 40000 }] }, newVersion: false, removeMissing: false, operationId: "forecast", idempotencyKey: "forecast-key", targetIncarnation: "inc-1" })
  expect(preview.result.ok).toBe(true)
  expect((preview.before.data.versions as { summary: { fullYear: number } }[])[0].summary.fullYear).toBe(590000)
  expect((preview.after.data.versions as { summary: { fullYear: number } }[])[0].summary.fullYear).toBe(602000)
  const applied = structuredClone(snapshot)
  const mutation = createPlannerImportMutation({ command: preview.command, commandDigest: preview.commandDigest, previewDigest: preview.previewDigest, actorId: actor.id, operationId: "forecast", idempotencyKey: "forecast-key", targetIncarnation: "inc-1", previewAt: environment.at, verifyTarget: () => true })!
  expect(mutation.execute(applied, actor, environment).commit).toBe(true)
  const after = projectPlannerSource(applied, actor, "v1")!
  expect((before.summary as { fullYear: number }).fullYear).toBe(590000)
  expect((after.summary as { fullYear: number }).fullYear).toBe(602000)
  const originalLine = (snapshot.data.versions as { lines: { b: unknown; a: unknown }[] }[])[0].lines[0]
  const appliedLine = (applied.data.versions as { lines: { b: unknown; a: unknown }[] }[])[0].lines[0]
  expect(appliedLine.b).toEqual(originalLine.b)
  expect(appliedLine.a).toEqual(originalLine.a)
})

test("exported workbook reimports through the Planner engine without new lines and normalizes absent bm", async () => {
  const flat = Array(12).fill(10)
  const varied = [10, 20, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]
  const actual = [0, null, null, null, null, null, null, null, null, null, null, null]
  const snapshot: Snapshot = { data: { app: { entities: [], allocations: [] }, versions: [{ id: "v1", name: "Plan", year: 2027, closed: 0, locked: false, lines: [
    { id: "flat", sec: "opex", el: "licenses", name: "Flat", cur: "USD", b: flat, bm: Array(12).fill(true), a: actual, f: Array(12).fill(null) },
    { id: "varied", sec: "opex", el: "licenses", name: "Varied", cur: "USD", b: varied, bm: emptyFlags(), a: actual, f: Array(12).fill(null) },
  ], projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }], officials: {}, entities: [], allocations: [] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const before = structuredClone(snapshot)
  const file = await exportPlanner(snapshot, actor, environment, "v1")
  expect(file.ok).toBe(true)
  if (!file.ok) return
  const parsed = await parseWorkbook(file.bytes)
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) return
  expect(parsed.sheets.OPEX.every((row) => !("bm" in row))).toBe(true)
  const preview = preparePlannerWorkbook({ snapshot, actor, environment, versionId: "v1", sheets: parsed.sheets, newVersion: false, removeMissing: false, operationId: "roundtrip", idempotencyKey: "roundtrip-key", targetIncarnation: "inc-1" })
  expect(preview.result.ok).toBe(true)
  const applied = structuredClone(snapshot)
  const mutation = createPlannerImportMutation({ command: preview.command, commandDigest: preview.commandDigest, previewDigest: preview.previewDigest, actorId: actor.id, operationId: "roundtrip", idempotencyKey: "roundtrip-key", targetIncarnation: "inc-1", previewAt: environment.at, verifyTarget: () => true })
  expect(mutation?.execute(applied, actor, environment).commit).toBe(true)
  const lines = (applied.data.versions as { lines: { id: string; b: number[]; bm: boolean[]; a: (number | null)[] }[] }[])[0].lines
  expect(lines.map((line) => line.id)).toEqual(["flat", "varied"])
  expect(lines[0].b).toEqual(flat)
  expect(lines[0].a[0]).toBe(0)
  expect(lines[0].bm).toEqual(emptyFlags())
  expect(lines[1].b).toEqual(varied)
  expect(lines[1].bm).toEqual(Array(12).fill(true))
  expect(snapshot).toEqual(before)
})

test("budget owner workbook with one foreign forecast is refused without a commit", () => {
  const snapshot: Snapshot = { data: { versions: [{ id: "v1", year: 2027, closed: 0, locked: false, lines: [
    { id: "a", sec: "opex", el: "licenses", name: "A", cur: "USD", owner: "owner-1", b: Array(12).fill(0), a: Array(12).fill(null), f: Array(12).fill(null) },
    { id: "b", sec: "opex", el: "licenses", name: "B", cur: "USD", b: Array(12).fill(0), a: Array(12).fill(null), f: Array(12).fill(null) },
  ], projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }], officials: {}, entities: [], allocations: [] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const owner = { id: "owner-1", roles: ["budget owner"], canWrite: true }
  const before = structuredClone(snapshot)
  const preview = preparePlannerWorkbook({ snapshot, actor: owner, environment, versionId: "v1", sheets: { OPEX: [
    { "Line ID": "a", "Cost element": "Licenses", "Vendor / item": "A", Currency: "USD", Measure: "Forecast", Jan: 0 },
    { "Line ID": "b", "Cost element": "Licenses", "Vendor / item": "B", Currency: "USD", Measure: "Forecast", Jan: 200 },
  ] }, newVersion: false, removeMissing: false, operationId: "foreign", idempotencyKey: "foreign-key", targetIncarnation: "inc-1" })
  expect(preview.result).toMatchObject({ ok: false, status: 403 })
  const mutation = createPlannerImportMutation({ command: preview.command, commandDigest: preview.commandDigest, previewDigest: preview.previewDigest, actorId: owner.id, operationId: "foreign", idempotencyKey: "foreign-key", targetIncarnation: "inc-1", previewAt: environment.at, verifyTarget: () => true })
  const applied = structuredClone(snapshot)
  expect(mutation?.execute(applied, owner, environment)).toMatchObject({ commit: false, value: { status: "denied" } })
  expect(applied).toEqual(before)
  expect(snapshot).toEqual(before)
})
