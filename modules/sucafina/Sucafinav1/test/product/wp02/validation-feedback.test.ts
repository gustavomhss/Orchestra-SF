import { expect, test } from "bun:test"
import { applyDashboardPreview, simulateDashboardCommand } from "../../../product/dashboard/commands.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { Command, Snapshot } from "../../../runtime/contract.ts"

const actor = { id: "admin", roles: ["admin"], canWrite: true }
const environment = { at: "2026-11-13T00:00:00Z", id: () => "reserved", directory: [] }
const initial = (): Snapshot => ({ data: { opexOwners: [{ id: "owner", name: "Owner", budget: 1200 }], budgetCurrentMonth: { 2026: 3 } }, versions: {}, sequences: {}, audit: [], notices: [] })

test("preview preserves field validation and the submitted draft without mutating the source", () => {
  const state = initial()
  const command: Command = { page: "OPEX Detail", action: "year-amount", id: "owner", version: 0, values: { year: 2026, amount: -10 } }
  const before = structuredClone({ state, command })
  expect(simulateDashboardCommand(state, actor, command, environment)).toEqual({ status: "invalid", reason: "command-rejected", errors: ["Enter a nonnegative year amount or clear the field."] })
  expect({ state, command }).toEqual(before)
  expect(simulateDashboardCommand(state, { id: "contributor", roles: ["contributor"], canWrite: true }, command, environment)).toEqual({ status: "denied", reason: "command-rejected" })
})

test("apply returns the domain validation and conflicts expose only the authorized stored row", () => {
  const state = initial()
  const valid: Command = { page: "OPEX Detail", action: "year-amount", id: "owner", version: 0, values: { year: 2026, amount: "" } }
  const preview = simulateDashboardCommand(state, actor, valid, environment)
  expect(preview.status).toBe("preview")
  if (preview.status !== "preview") throw new Error("Expected preview")
  const invalid = { ...valid, values: { year: 2026, amount: -10 } }
  const before = structuredClone(state)
  expect(applyDashboardPreview(state, actor, invalid, environment, preview.baseDigest, digestSfValue({ actor, command: invalid }))).toEqual({ ok: false, status: 422, errors: ["Enter a nonnegative year amount or clear the field."] })
  expect(state).toEqual(before)
  const project: Snapshot = { data: { projects: [{ id: "p", name: "Server value", status: "Planning", hiddenSecret: "restricted" }] }, versions: { "projects:p": { version: 2, by: "other" } }, sequences: {}, audit: [], notices: [] }
  const draft: Command = { page: "All Projects", action: "save", id: "p", version: 1, values: { name: "Local draft", status: "Planning" } }
  const saved = structuredClone(draft)
  const conflict = simulateDashboardCommand(project, actor, draft, environment)
  expect(conflict).toMatchObject({ status: "conflict", by: "other", stored: { id: "p", name: "Server value" } })
  expect(JSON.stringify(conflict)).not.toContain("restricted")
  expect(draft).toEqual(saved)
})
