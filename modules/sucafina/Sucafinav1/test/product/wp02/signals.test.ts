import { expect, test } from "bun:test"
import { dashboardSignals } from "../../../product/dashboard/signals.ts"
import type { Snapshot } from "../../../runtime/contract.ts"

const environment = { at: "2026-11-13T12:00:00Z", id: () => "unused", directory: [] }

test("signals use only authorized source pages and explicit eligibility", () => {
  const state: Snapshot = { data: { summaries: ["IT Risks"], hotTopics: [{ id: "a", action: "Late", status: "open", due: "2026-11-01" }, { id: "b", action: "Done", status: "done", due: "2026-11-01" }], risks: [{ id: "r", title: "High", status: "open", impact: 4, probability: 4 }], contracts: [{ id: "c", vendor: "No date", renewal: "" }] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const admin = dashboardSignals(state, { id: "admin", roles: ["admin"], canWrite: true }, environment)
  expect(admin.map((signal) => signal.id)).toEqual(["hotTopics:a", "risks:r"])
  expect(admin[0]).toMatchObject({ page: "Hot Topics & Actions", recordId: "a", rule: "Open action past due date" })
  const viewer = dashboardSignals(state, { id: "reader", roles: ["viewer"], canWrite: false }, environment)
  expect(viewer.map((signal) => signal.id)).toEqual(["risks:r"])
  state.data.summaries = []
  expect(dashboardSignals(state, { id: "reader", roles: ["viewer"], canWrite: false }, environment)).toEqual([])
})
