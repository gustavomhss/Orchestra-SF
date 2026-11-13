import { expect, test } from "bun:test"
import { createDashboardPreparedMutation } from "../../../product/dashboard/prepared.ts"
import { simulateDashboardCommand } from "../../../product/dashboard/commands.ts"
import type { Snapshot } from "../../../runtime/contract.ts"

const actor = { id: "admin", roles: ["admin"], canWrite: true }
function environment() { let serial = 0; return { at: "2026-11-13T00:00:00Z", id: () => `reserved-${++serial}`, directory: [] } }

test("prepared write binds principal, source incarnation and domain version separately", () => {
  const key = JSON.stringify(["opexOwners", "o"])
  const state: Snapshot = { data: { opexOwners: [{ id: "o", name: "Owner", budget: 1200 }] }, versions: {}, sequences: {}, audit: [], notices: [], sfSources: { schemaVersion: 1, records: { [key]: { incarnation: "inc", version: 1, alive: true, inputDigest: "a".repeat(64) } } } }
  const command = { page: "OPEX Detail", action: "annual-entry", id: "o", version: 0, values: { year: 2026, annual: 2400 } }
  const preview = simulateDashboardCommand(state, actor, command, environment())
  expect(preview.status).toBe("preview")
  if (preview.status !== "preview") return
  const target = { surface: "dashboard" as const, type: "opexOwners", id: "o", incarnation: "inc", version: 1, fields: ["budget"], period: { start: "2026-01-01", end: "2026-12-31" }, observedAt: "2026-11-13T00:00:00Z" }
  const input = { actorId: actor.id, target, command, baseDigest: preview.baseDigest, previewDigest: preview.commandDigest, idempotencyKey: "change-1" }
  const mutation = createDashboardPreparedMutation(input)!
  expect(mutation.expectedVersion).toBe(0)
  expect(createDashboardPreparedMutation({ ...input, baseDigest: "b".repeat(64) })!.commandDigest).not.toBe(mutation.commandDigest)
  expect(mutation.execute(structuredClone(state), { ...actor, id: "other" }, environment())).toMatchObject({ commit: false, value: { status: "denied" } })
  const replaced = structuredClone(state)
  replaced.sfSources!.records[key]!.incarnation = "new-inc"
  expect(mutation.execute(replaced, actor, environment())).toMatchObject({ commit: false, value: { status: "conflict" } })
  expect(createDashboardPreparedMutation({ ...input, target: { ...target, type: "hotTopics" } })).toBeUndefined()
  expect(createDashboardPreparedMutation({ ...input, command: { ...command, confirmed: true } })).toBeUndefined()
  expect(createDashboardPreparedMutation({ ...input, command: { ...command, action: "import" } })).toBeUndefined()
  expect(createDashboardPreparedMutation({ ...input, command: { ...command, values: { ...command.values, annual: Number.NaN } } })).toBeUndefined()
  command.values.annual = 1
  expect(mutation.execute(state, actor, environment())).toMatchObject({ commit: true, value: { status: "applied" } })
  expect((state.data.opexOwners as { budget: number }[])[0]!.budget).toBe(2400)
})
