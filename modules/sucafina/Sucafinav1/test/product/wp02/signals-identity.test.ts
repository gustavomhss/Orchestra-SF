import { expect, test } from "bun:test"
import { dashboardSignals } from "../../../product/dashboard/signals.ts"
import type { Snapshot } from "../../../runtime/contract.ts"

const environment = { at: "2026-11-13T12:00:00Z", id: () => "unused", directory: [] }
const admin = { id: "admin", roles: ["admin"], canWrite: true }

test("signals omit ambiguous IDs within each authorized collection only", () => {
  const snapshot: Snapshot = {
    data: {
      summaries: ["Hot Topics & Actions", "IT Risks", "Vendor Contracts"],
      hotTopics: [
        { id: "dup", action: "First", status: "open", due: "2026-11-01" },
        { id: "dup", action: "Second", status: "open", due: "2026-11-02" },
        { id: "shared", action: "Unique topic", status: "open", due: "2026-11-01" },
        { id: 7, action: "Numeric identity", status: "open", due: "2026-11-03" },
        { id: 8, action: "First normalized duplicate", status: "open", due: "2026-11-03" },
        { id: "8", action: "Second normalized duplicate", status: "open", due: "2026-11-03" },
      ],
      risks: [
        { id: "risk-dup", title: "First", status: "open", impact: 4, probability: 4 },
        { id: "risk-dup", title: "Second", status: "open", impact: 4, probability: 4 },
        { id: "shared", title: "Unique risk", status: "open", impact: 4, probability: 4 },
      ],
      contracts: [
        { id: "contract-dup", vendor: "First", renewal: "2026-12-01" },
        { id: "contract-dup", vendor: "Second", renewal: "2026-12-02" },
        { id: "shared", vendor: "Unique contract", renewal: "2026-12-03" },
      ],
    },
    versions: {}, sequences: {}, audit: [], notices: [],
  }
  expect(dashboardSignals(snapshot, admin, environment).map((signal) => signal.id)).toEqual([
    "hotTopics:shared", "hotTopics:7", "contracts:shared", "risks:shared",
  ])
  snapshot.data.summaries = ["IT Risks"]
  expect(dashboardSignals(snapshot, { id: "reader", roles: ["viewer"], canWrite: false }, environment).map((signal) => signal.id)).toEqual(["risks:shared"])
})

test("unavailable pages emit no signals", () => {
  const snapshot: Snapshot = {
    data: {
      summaries: [],
      hotTopics: [{ id: "dup", action: "First", status: "open", due: "2026-11-01" }, { id: "dup", action: "Second", status: "open", due: "2026-11-02" }],
      risks: [{ id: "r", title: "High", status: "open", impact: 4, probability: 4 }],
      contracts: [{ id: "c", vendor: "Vendor", renewal: "2026-12-01" }],
    },
    versions: {}, sequences: {}, audit: [], notices: [],
  }
  expect(dashboardSignals(snapshot, { id: "reader", roles: ["viewer"], canWrite: false }, environment)).toEqual([])
})
