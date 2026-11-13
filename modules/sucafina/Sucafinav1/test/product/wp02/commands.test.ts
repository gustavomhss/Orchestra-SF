import { expect, test } from "bun:test"
import { applyDashboardPreview, simulateDashboardCommand } from "../../../product/dashboard/commands.ts"
import type { Command, Snapshot } from "../../../runtime/contract.ts"

const actor = { id: "admin", roles: ["admin"], canWrite: true }
const initial = (): Snapshot => ({ data: { opexOwners: [{ id: "o", name: "Owner", budget: 1200 }], budgetCurrentMonth: { 2026: 3 } }, versions: {}, sequences: {}, audit: [], notices: [] })
function environment() { let count = 0; return { at: "2026-11-13T00:00:00Z", id: () => `reserved-${++count}`, directory: [] } }

test("preview and apply use the same commands without writing the preview base", () => {
  const commands: Command[] = [
    { page: "OPEX Detail", action: "annual-entry", id: "o", version: 0, values: { year: 2026, annual: 1200 } },
    { page: "OPEX Detail", action: "year-amount", id: "o", version: 0, values: { year: 2026, month: 3, amount: 100, versions: {} } },
  ]
  const results = commands.map((command) => {
    const state = initial()
    const original = structuredClone(state)
    const preview = simulateDashboardCommand(state, actor, command, environment())
    expect(preview.status).toBe("preview")
    expect(state).toEqual(original)
    if (preview.status !== "preview") return undefined
    expect(preview.changes.some((change) => change.path.startsWith("/opexEntries/@id=reserved-") && change.path.endsWith(scenarioField(command)))).toBe(true)
    expect(applyDashboardPreview(state, { ...actor, id: "other-admin" }, command, environment(), preview.baseDigest, preview.commandDigest)).toMatchObject({ ok: false, status: 409 })
    expect(applyDashboardPreview(state, actor, command, environment(), preview.baseDigest, preview.commandDigest)).toMatchObject({ ok: true })
    expect(state.data.opexEntries).toEqual(preview.after.opexEntries)
    expect(applyDashboardPreview(state, actor, command, environment(), preview.baseDigest, preview.commandDigest)).toMatchObject({ ok: false, status: 409 })
    return state.data.opexEntries
  })
  expect(results[0]).not.toEqual(results[1])
})

function scenarioField(command: Command) {
  return command.action === "annual-entry" ? "/budget" : "/actual"
}

test("preview does not authorize a contributor to edit a financial line", () => {
  const state = initial()
  const before = structuredClone(state)
  const command: Command = { page: "OPEX Detail", action: "annual-entry", id: "o", version: 0, values: { year: 2026, annual: 1200 } }
  expect(simulateDashboardCommand(state, { id: "contributor", roles: ["contributor"], canWrite: true }, command, environment()).status).toBe("denied")
  expect(state).toEqual(before)
})

test("conflict preview does not expose fields omitted by the domain view", () => {
  const state: Snapshot = { data: { projects: [{ id: "p", name: "Project", status: "Planning", hiddenSecret: "not-for-consumer" }] }, versions: { "projects:p": { version: 2, by: "other" } }, sequences: {}, audit: [], notices: [] }
  const command: Command = { page: "All Projects", action: "save", id: "p", version: 1, values: { name: "Project" } }
  const result = simulateDashboardCommand(state, actor, command, environment())
  expect(result).toMatchObject({ status: "conflict" })
  expect(JSON.stringify(result)).not.toContain("not-for-consumer")
})

test("preview ignores unrelated directory changes but rejects changed effective roles", () => {
  const state = initial()
  const command: Command = { page: "OPEX Detail", action: "annual-entry", id: "o", version: 0, values: { year: 2026, annual: 1200 } }
  const before = { ...environment(), directory: [{ id: "person", name: "Original" }] }
  const preview = simulateDashboardCommand(state, actor, command, before)
  expect(preview.status).toBe("preview")
  if (preview.status !== "preview") return
  expect(applyDashboardPreview(structuredClone(state), actor, command, { ...environment(), directory: [{ id: "person", name: "Changed" }] }, preview.baseDigest, preview.commandDigest)).toMatchObject({ ok: true })
  expect(applyDashboardPreview(state, { ...actor, canWrite: false }, command, before, preview.baseDigest, preview.commandDigest)).toMatchObject({ ok: false, status: 409 })
  expect(preview.warnings).toContain("System timestamps use the apply time and may differ from the preview.")
})

test("preview ignores unrelated private changes but detects replacement of a visible record", () => {
  const state = initial()
  state.data.members = [{ id: "person", notes: "private before" }]
  const ownerKey = JSON.stringify(["opexOwners", "o"])
  const memberKey = JSON.stringify(["members", "person"])
  state.sfSources = { schemaVersion: 1, records: { [ownerKey]: { incarnation: "owner-inc", version: 1, alive: true, inputDigest: "a".repeat(64) }, [memberKey]: { incarnation: "person-inc", version: 1, alive: true, inputDigest: "b".repeat(64) } } }
  const command: Command = { page: "OPEX Detail", action: "annual-entry", id: "o", version: 0, values: { year: 2026, annual: 1200 } }
  const preview = simulateDashboardCommand(state, actor, command, environment())
  expect(preview.status).toBe("preview")
  if (preview.status !== "preview") return
  const members = state.data.members as { notes: string }[]
  members[0]!.notes = "private after"
  state.sfSources.records[memberKey]!.version++
  const replaced = structuredClone(state)
  replaced.sfSources!.records[ownerKey]!.incarnation = "new-owner-inc"
  expect(applyDashboardPreview(replaced, actor, command, environment(), preview.baseDigest, preview.commandDigest)).toMatchObject({ ok: false, status: 409 })
  expect(applyDashboardPreview(state, actor, command, environment(), preview.baseDigest, preview.commandDigest)).toMatchObject({ ok: true })
})
