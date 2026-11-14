import { expect, test } from "bun:test"
import { applyDashboardImport, previewDashboardImport } from "../../../product/dashboard/imports.ts"
import { simulateDashboardCommand } from "../../../product/dashboard/commands.ts"
import type { Command, Snapshot } from "../../../runtime/contract.ts"

test("unknown import formats are rejected while supported formats use the domain simulator", () => {
  const actor = { id: "admin", roles: ["admin"], canWrite: true }
  const environment = { at: "2026-11-13T00:00:00Z", id: () => "reserved", directory: [] }
  const snapshot = (): Snapshot => ({ data: {}, versions: {}, sequences: {}, audit: [], notices: [] })
  const command: Command = { page: "Talent Review", action: "import", version: 0, values: { rows: [{ Name: "A" }] } }
  const state = snapshot()
  expect(previewDashboardImport("json-dashboard", state, actor, command, environment)).toEqual({ status: "invalid", reason: "format-unsupported" })
  expect(applyDashboardImport("json-dashboard", state, actor, command, environment, "base", "command")).toMatchObject({ ok: false, status: 400 })
  expect(state).toEqual(snapshot())
  expect(previewDashboardImport("all-projects", state, actor, command, environment)).toEqual({ status: "invalid", reason: "format-command-mismatch" })
  const backup: Command = { page: "Budget Overview", action: "backup-import", version: 0, values: {} }
  expect(previewDashboardImport("backup", state, actor, backup, environment)).toEqual({ status: "invalid", reason: "backup-producer-unavailable" })
  expect(applyDashboardImport("backup", state, actor, backup, environment, "base", "command")).toMatchObject({ ok: false, status: 503 })
  expect(previewDashboardImport("backup", state, actor, command, environment)).toEqual({ status: "invalid", reason: "format-command-mismatch" })
  expect(previewDashboardImport("all-members", snapshot(), actor, command, environment)).toEqual(simulateDashboardCommand(snapshot(), actor, command, environment))
})
