import { expect, test } from "bun:test"
import { createPlannerImportMutation, preparePlannerWorkbook, plannerImportEnvironment } from "../../../../product/imports/planner.ts"
import { domain } from "../../../../runtime/planner.ts"
import { projectPlannerSource } from "../../../../product/planner/port.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"

const actor = { id: "finance", roles: ["finance"], canWrite: true }
const environment = { at: "2026-11-13T00:00:00Z", id: () => "host-id", directory: [] }

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
