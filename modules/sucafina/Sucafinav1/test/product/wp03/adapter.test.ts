import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { projectPlanner, simulatePlannerCommand, simulatePlannerCommands } from "../../../product/planner/adapter.ts"
import { simulatePlannerOperations } from "../../../product/planner/scenario.ts"
import { prepareMonthlyDrafts } from "../../../product/planner/monthly-edit.ts"
import { createPlannerCapabilities } from "../../../product/planner/capabilities.ts"
import { projectPlannerSource } from "../../../product/planner/port.ts"
import type { Snapshot } from "../../../runtime/contract.ts"

const actor = { id: "finance", canWrite: true, roles: ["finance"] }
const environment = { at: "2026-11-13T00:00:00Z", id: () => "new-id", directory: [] }
function fixture(): Snapshot {
  return {
    data: { versions: [{ id: "v1", year: 2027, closed: 1, locked: false, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", annual: 1200, b: Array(12).fill(100), bm: Array(12).fill(false), a: [null], f: [null, 0] }], projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }] },
    versions: {}, sequences: {}, audit: [], notices: [],
  }
}

test("preview reuses Planner rules without mutating the source", () => {
  const snapshot = fixture()
  const before = structuredClone(snapshot)
  const result = simulatePlannerCommand(snapshot, actor, { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v1", f1: 42 } }, environment)
  expect(result.result.ok).toBe(true)
  expect(snapshot).toEqual(before)
  const version = (result.view.data.versions as { summary: { outlook: number[] } }[])[0]
  expect(version.summary.outlook.slice(0, 3)).toEqual([0, 42, 100])
})

test("projection preserves missing FX warnings and redacts individual salary", () => {
  const snapshot = fixture()
  const version = (snapshot.data.versions as Record<string, unknown>[])[0]
  version.lines = [{ id: "line", sec: "opex", el: "licenses", cur: "EUR", b: Array(12).fill(100) }]
  version.fx = [{ id: "EUR", cur: "EUR", rate: null }]
  version.hc = { positions: [{ id: "p", name: "Person", rateOverride: 123456 }], rates: [], hrAF: {} }
  const view = projectPlanner(snapshot, { id: "viewer", canWrite: false, roles: ["viewer"] }, environment)
  expect(JSON.stringify(view)).not.toContain("123456")
  expect((view.data.versions as { summary: { warnings: string[] } }[])[0].summary.warnings).toContain("EUR")
})


test("source projection uses the same redaction as the Planner view", () => {
  const snapshot = fixture()
  const view = projectPlannerSource(snapshot, { id: "viewer", canWrite: false, roles: ["viewer"] }, "v1")
  expect(view?.id).toBe("v1")
  expect(projectPlannerSource(snapshot, { id: "outsider", canWrite: false, roles: [] }, "v1")).toBeUndefined()
})

test("preview rejects a forbidden write without changing the original or projected value", () => {
  const snapshot = fixture()
  const before = structuredClone(snapshot)
  const result = simulatePlannerCommand(snapshot, { id: "viewer", canWrite: false, roles: ["viewer"] }, { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v1", f1: 99 } }, environment)
  expect(result.result).toMatchObject({ ok: false, status: 403 })
  expect(snapshot).toEqual(before)
  expect((result.view.data.versions as { summary: { outlook: number[] } }[])[0].summary.outlook[1]).toBe(0)
})

test("batch preview retains successful records when another revision conflicts", () => {
  const snapshot = fixture()
  const original = structuredClone(snapshot)
  const commands = [
    { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v1", f1: 42 } },
    { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v1", f1: 99 } },
  ]
  const result = simulatePlannerCommands(snapshot, actor, commands, environment)
  expect(result.results[0].ok).toBe(true)
  expect(result.results[1]).toMatchObject({ ok: false, status: 409 })
  expect((result.view.data.versions as { summary: { outlook: number[] } }[])[0].summary.outlook[1]).toBe(42)
  expect(snapshot).toEqual(original)
})

test("planner capability publishes the canonical forecast schema and profile", () => {
  const descriptors = createPlannerCapabilities({ compareForecast: async () => ({ status: "unavailable", reason: "not-configured" }), simulateScenario: async () => ({ status: "unavailable", reason: "not-configured" }), compareScenarios: async () => ({ status: "unavailable", reason: "not-configured" }), evaluateSensitivity: async () => ({ status: "unavailable", reason: "not-configured" }) }, async () => undefined)
  expect(descriptors.map((descriptor) => descriptor.id)).toEqual(["sf_forecast_compare"])
  expect(descriptors[0].grantProfiles).toEqual(["sf_finance"])
})

test("monthly range keeps invalid text and preserves explicit zero and blank forecast", () => {
  const drafts = prepareMonthlyDrafts("OPEX", "v1", [
    { rowId: "line", revision: 2, cells: [{ measure: "forecast", month: 1, text: "0" }, { measure: "forecast", month: 2, text: "" }] },
    { rowId: "other", revision: 4, cells: [{ measure: "actual", month: 3, text: "bad" }] },
  ])
  expect(drafts[0].command?.values).toMatchObject({ f0: 0, f1: null })
  expect(drafts[1].command).toBeUndefined()
  expect(drafts[1].draft.cells[0].text).toBe("bad")
  expect(drafts[1].errors[0].reason).toBe("invalid-number")
})

test("scenario replacement uses domain command on a copy and rejects duplicate targets", () => {
  const snapshot = fixture()
  const before = structuredClone(snapshot)
  const result = simulatePlannerOperations(snapshot, actor, environment, "v1", [{ kind: "replace", targetRef: "line:2", amount: 42, currency: "USD", period: { start: "2027-02-01", end: "2027-02-28" } }])
  expect(result.status).toBe("ok")
  if (result.status === "ok") expect((result.view.data.versions as { summary: { outlook: number[] } }[])[0].summary.outlook[1]).toBe(42)
  expect(snapshot).toEqual(before)
  expect(simulatePlannerOperations(snapshot, actor, environment, "v1", [{ kind: "replace", targetRef: "line:2", amount: 42 }, { kind: "replace", targetRef: "line:2", amount: 50 }])).toMatchObject({ status: "needs-input" })
})

test("source projection changes when relevant Planner inputs change", () => {
  const snapshot = fixture()
  const before = projectPlannerSource(snapshot, actor, "v1")!
  const version = (snapshot.data.versions as Record<string, unknown>[])[0]
  version.closed = 2
  const after = projectPlannerSource(snapshot, actor, "v1")!
  expect(digestSfValue({ versionId: "v1", projection: after })).not.toBe(digestSfValue({ versionId: "v1", projection: before }))
  snapshot.data.allocations = [{ id: "alloc", name: "Shared" }]
  expect(digestSfValue({ versionId: "v1", projection: projectPlannerSource(snapshot, actor, "v1") })).not.toBe(digestSfValue({ versionId: "v1", projection: after }))
})
