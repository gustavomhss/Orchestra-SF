import { expect, test } from "bun:test"
import { applyDashboardImport, previewDashboardImport } from "../../../product/dashboard/imports.ts"
import { projectDashboardSource } from "../../../product/dashboard/port.ts"
import type { DashboardImportFormat } from "../../../product/dashboard/imports.ts"
import type { Command, Snapshot } from "../../../runtime/contract.ts"

const actor = { id: "admin", roles: ["admin"], canWrite: true }
function environment() { let count = 0; return { at: "2026-11-13T00:00:00Z", id: () => `reserved-${++count}`, directory: [] } }

test("prepared Dashboard imports preview the same domain mutation and reject a changed base", () => {
  const scenarios: { format: DashboardImportFormat; command: Command }[] = [
    { format: "all-members", command: { page: "Talent Review", action: "import", version: 0, values: { rows: [{ Name: "A", Type: "Employee", Status: "Active" }] } } },
    { format: "all-projects", command: { page: "All Projects", action: "import", version: 0, values: { mode: "update", rows: [{ name: "Project" }, { name: "Ignored", _status: "error" }] } } },
    { format: "ticket-register", command: { page: "IT Operations", action: "import-month", version: 0, confirmed: true, values: { year: 2026, month: 11, tickets: {}, sla: {}, heatmap: [] } } },
  ]
  for (const scenario of scenarios) {
    const state: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
    const before = structuredClone(state)
    const preview = previewDashboardImport(scenario.format, state, actor, scenario.command, environment())
    expect(preview.status).toBe("preview")
    expect(state).toEqual(before)
    if (preview.status !== "preview") continue
    if (scenario.format === "all-projects") expect(preview.summary).toEqual({ added: 1, updated: 0, ignored: 1 })
    const applied = applyDashboardImport(scenario.format, state, actor, scenario.command, environment(), preview.baseDigest, preview.commandDigest)
    expect(applied).toMatchObject({ ok: true })
    if (scenario.format === "all-projects") expect(applied).toMatchObject({ value: preview.summary })
    expect(projectDashboardSource(state, actor, environment(), scenario.command.page)).toEqual(preview.after)
    expect(applyDashboardImport(scenario.format, state, actor, scenario.command, environment(), preview.baseDigest, preview.commandDigest)).toMatchObject({ ok: false, status: 409 })
  }
})

test("format mismatch and unauthorized actor never produce a successful import preview", () => {
  const state: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  const command: Command = { page: "Talent Review", action: "import", version: 0, values: { rows: [{ Name: "A" }] } }
  expect(previewDashboardImport("all-projects", state, actor, command, environment())).toMatchObject({ status: "invalid" })
  expect(previewDashboardImport("all-members", state, { id: "reader", roles: ["viewer"], canWrite: false }, command, environment())).toMatchObject({ status: "denied" })
})
