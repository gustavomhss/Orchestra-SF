import { expect, test } from "bun:test"
import { domain } from "../../../runtime/procurement.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { press } from "../../../src/screen-shell.ts"

test("the actual stale Procurement save returns its current CAS version and preserves the first actor's record", () => {
  const state: Snapshot = { data: { store: { settings: initialProcurementSettings() } }, versions: {}, sequences: {}, audit: [], notices: [] }
  const first = { id: "requester", roles: ["requester"], canWrite: true }
  const second = { id: "administrator", roles: ["admin"], canWrite: true }
  const environment = { at: "2026-11-13T12:00:00Z", directory: [], id: () => "unused" }
  const created = domain.execute(state, first, { page: "Requests", action: "create", version: 0, values: { pr: { title: "Original title" } } }, environment)
  expect(created.ok).toBe(true)
  if (!created.ok) throw new Error("Draft creation failed")
  const id = String((created.value as Record<string, unknown>).number)
  expect(domain.execute(state, first, { page: "Requests", action: "save", id, version: 1, values: { pr: { title: "First actor saved" } } }, environment).ok).toBe(true)
  const before = structuredClone(state)
  const stale = domain.execute(state, second, { page: "Requests", action: "save", id, version: 1, values: { pr: { title: "Second actor attempted" } } }, environment)
  expect(stale).toMatchObject({ ok: false, status: 409, currentVersionCAS: 2, by: first.id, stored: { pr: { title: "First actor saved" } } })
  expect(state).toEqual(before)
  if (stale.ok || stale.status !== 409) throw new Error("Stale save did not return a conflict")
  expect(press(() => ({ ok: false, status: 409, stored: stale.stored, by: stale.by, currentVersionCAS: stale.currentVersionCAS }))).toMatchObject({ saved: false, status: 409, currentVersionCAS: 2 })
})
