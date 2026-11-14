import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { projectPlanner, simulatePlannerCommand, simulatePlannerCommands } from "../../../product/planner/adapter.ts"
import { simulatePlannerOperations } from "../../../product/planner/scenario.ts"
import { prepareMonthlyDrafts, previewMonthlyDrafts } from "../../../product/planner/monthly-edit.ts"
import { createPlannerCapabilities } from "../../../product/planner/capabilities.ts"
import { projectPlannerSource } from "../../../product/planner/port.ts"
import { domain } from "../../../runtime/planner.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

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

test("projection and simulation accept a deeply frozen snapshot and preserve audit, sequences and every source version", () => {
  const snapshot = fixture()
  const originalVersion = (snapshot.data.versions as Record<string, unknown>[])[0]!
  snapshot.data.versions = [originalVersion, { ...structuredClone(originalVersion), id: "untouched", year: 2028 }]
  snapshot.data.officials = { "2028": "untouched" }
  snapshot.versions.retained = { version: 7, by: "prior-editor" }
  snapshot.sequences.CPX = 42
  snapshot.audit = [{ who: "prior-editor", at: environment.at, record: "retained", was: { name: "Before" }, became: { name: "After" } }]
  const before = structuredClone(snapshot)
  const freeze = (value: unknown): void => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  freeze(snapshot)
  expect(Object.isFrozen(snapshot)).toBe(true)
  expect(Object.isFrozen(originalVersion.lines)).toBe(true)
  expect(Object.isFrozen((originalVersion.lines as Record<string, unknown>[])[0]!.f)).toBe(true)
  expect(Object.isFrozen(snapshot.audit[0]!.became)).toBe(true)
  const command = { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v1", f1: 42 } }
  const projected = projectPlanner(snapshot, actor, environment)
  const simulated = simulatePlannerCommand(snapshot, actor, command, environment)
  const isolated = structuredClone(before)
  const executed = domain.execute(isolated, actor, command, environment)
  expect(simulated.result).toEqual(executed)
  expect(simulated.result).toMatchObject({ ok: true })
  expect(simulated.view).toEqual(projectPlanner(isolated, actor, environment))
  expect((simulated.view.data.versions as { id: string; summary: { outlook: number[] } }[]).find((version) => version.id === "v1")!.summary.outlook[1]).toBe(42)
  expect(projectPlanner(snapshot, actor, environment)).toEqual(projected)
  expect(simulatePlannerCommand(snapshot, { id: "viewer", roles: ["viewer"], canWrite: false }, command, environment).result).toMatchObject({ ok: false, status: 403 })
  expect(snapshot).toEqual(before)
  expect(snapshot.audit).toEqual(before.audit)
  expect(snapshot.sequences).toEqual(before.sequences)
  expect(snapshot.versions).toEqual(before.versions)
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

test("legacy dictionary source preserves identity and capacity input presence", () => {
  const snapshot = fixture()
  const version = (snapshot.data.versions as Record<string, unknown>[])[0]
  snapshot.data.versions = { v1: version }
  const before = structuredClone(snapshot)
  const projected = projectPlannerSource(snapshot, actor, "v1")
  expect(projected).toMatchObject({ id: "v1", fteInputsKnown: true })
  expect(snapshot).toEqual(before)
  const hc = version.hc as { positions?: unknown[] }
  delete hc.positions
  expect(projectPlannerSource(snapshot, actor, "v1")).toMatchObject({ id: "v1", fteInputsKnown: false })
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
  expect(descriptors.map((descriptor) => descriptor.id)).toEqual(["sf_forecast_compare", "sf_scenario_simulate", "sf_scenario_compare"])
  expect(descriptors[0].grantProfiles).toEqual(["sf_finance"])
})

test("scenario capabilities reject invalid payloads and require bound receipts before domain work", async () => {
  const unavailable = async () => ({ status: "unavailable" as const, reason: "not-configured" })
  const descriptors = createPlannerCapabilities({ compareForecast: unavailable, simulateScenario: unavailable, compareScenarios: unavailable, evaluateSensitivity: unavailable }, async () => undefined)
  const context = {} as TrustedDomainContext
  expect(await descriptors[1].handler({}, context)).toMatchObject({ status: "denied", reason: "invalid-input" })
  expect(await descriptors[1].handler({ baseRef: "source", operations: [], assumptions: [] }, context)).toMatchObject({ status: "unavailable", reason: "receipt-unavailable" })
  expect(await descriptors[2].handler({ scenarioRefs: ["one", "two"], criteria: [] }, context)).toMatchObject({ status: "unavailable", reason: "receipt-unavailable" })
  const authorized = createPlannerCapabilities({ compareForecast: unavailable, simulateScenario: unavailable, compareScenarios: unavailable, evaluateSensitivity: unavailable }, async (_context, operation, inputDigest, resultDigest) => ({ kind: "ui", operation, handlerExport: "simulateScenario", inputDigest, resultDigest, principalRef: "finance", callId: "call", requestId: "request", accessRevision: "1", at: "2026-11-13T00:00:00Z" }))
  expect(await authorized[1].handler({ baseRef: "source", operations: [], assumptions: [] }, context)).toMatchObject({ status: "unavailable", reason: "result-persistence-unavailable" })
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
  expect(prepareMonthlyDrafts("OPEX", "v1", [{ rowId: "", revision: 0, cells: [{ measure: "forecast", month: 1, text: "10" }] }])[0]).toMatchObject({ command: undefined, errors: [{ reason: "invalid-row-context" }] })
})

test("monthly preview preserves invalid and conflicting drafts while applying valid rows only to a copy", () => {
  const snapshot = fixture()
  const before = structuredClone(snapshot)
  const result = previewMonthlyDrafts(snapshot, actor, environment, "OPEX", "v1", [
    { rowId: "line", revision: 0, cells: [{ measure: "forecast", month: 2, text: "42" }] },
    { rowId: "line", revision: 0, cells: [{ measure: "forecast", month: 2, text: "99" }] },
    { rowId: "line", revision: 0, cells: [{ measure: "forecast", month: 3, text: "bad" }] },
  ])
  expect(result.rows[0].result).toMatchObject({ ok: true })
  expect(result.rows[1].result).toMatchObject({ ok: false, status: 409 })
  expect(result.rows[1].draft.cells[0].text).toBe("99")
  expect(result.rows[2].errors[0].reason).toBe("invalid-number")
  expect(result.rows[2].draft.cells[0].text).toBe("bad")
  expect((result.view.data.versions as { summary: { outlook: number[] } }[])[0].summary.outlook[1]).toBe(42)
  expect(snapshot).toEqual(before)
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


test("scenario exclusion and deferral preserve the source and move only the selected contribution", () => {
  const snapshot = fixture()
  const before = structuredClone(snapshot)
  const deferred = simulatePlannerOperations(snapshot, actor, environment, "v1", [{ kind: "defer", targetRef: "line:3", period: { start: "2027-04-01", end: "2027-04-30" } }])
  expect(deferred.status).toBe("ok")
  if (deferred.status === "ok") expect((deferred.view.data.versions as { summary: { outlook: number[] } }[])[0].summary.outlook.slice(2, 4)).toEqual([0, 200])
  const excluded = simulatePlannerOperations(snapshot, actor, environment, "v1", [{ kind: "exclude", targetRef: "line:3" }])
  expect(excluded.status).toBe("ok")
  if (excluded.status === "ok") expect((excluded.view.data.versions as { summary: { outlook: number[] } }[])[0].summary.outlook[2]).toBe(0)
  expect(snapshot).toEqual(before)
})


test("scenario inclusion cannot silently replace an existing contribution", () => {
  const snapshot = fixture()
  expect(simulatePlannerOperations(snapshot, actor, environment, "v1", [{ kind: "include", targetRef: "line:3", amount: 50 }])).toMatchObject({ status: "needs-input", reason: "contribution-already-present" })
  const version = (snapshot.data.versions as { lines: { b: number[] }[] }[])[0]
  version.lines[0].b[2] = 0
  const included = simulatePlannerOperations(snapshot, actor, environment, "v1", [{ kind: "include", targetRef: "line:3", amount: 50 }])
  expect(included.status).toBe("ok")
  if (included.status === "ok") expect((included.view.data.versions as { summary: { outlook: number[] } }[])[0].summary.outlook[2]).toBe(50)
})
