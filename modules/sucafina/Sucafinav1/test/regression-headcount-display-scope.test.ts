import { expect, test } from "bun:test"
import { domain } from "../runtime/planner.ts"
import type { Snapshot } from "../runtime/contract.ts"

const environment = { at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }

function snapshot(): Snapshot {
  return {
    data: {
      headcountMappingVisible: "stored value must not control visibility",
      roster: [{ name: "Roster member", leader: "Leader" }],
      versions: [{
        id: "plan",
        name: "Plan",
        year: 2026,
        locked: false,
        closed: 0,
        lines: [],
        projects: [],
        hc: {
          positions: [{ id: "position", name: "Roster member", domain: "Apps", type: "Employee", include: true, fte: 1, start: 1, end: 12, rateId: "rate", rateOverride: 2400 }],
          rates: [{ id: "rate", name: "Rate", locs: "Brazil", annual: 1200, cur: "USD" }],
          inc: 0,
          incMonth: 1,
          leaderDomains: { Leader: "Apps" },
          hrAF: {},
        },
        fx: [],
        lists: {},
      }],
      officials: {},
      entities: [],
      allocations: [],
    },
    versions: { "plan:positions:position": { version: 2, by: "writer" } },
    sequences: {},
    audit: [],
    notices: [],
  }
}

test.each([
  ["admin", true],
  ["hr", true],
  ["finance", true],
  ["budget owner", false],
  ["viewer", false],
] as const)("headcount mapping visibility for %s is %s without mutating the read", (role, visible) => {
  const state = snapshot()
  const before = structuredClone(state)
  const view = domain.view(state, { id: "reader", canWrite: false, roles: [role] }, environment)
  const version = (view.data.versions as Record<string, unknown>[])[0]
  expect(view.data.headcountMappingVisible).toBe(visible)
  expect(view.data.roster).toEqual([{ name: "Roster member", leader: "Leader" }])
  expect(version.hc).toMatchObject({ leaderDomains: { Leader: "Apps" } })
  expect(version.summary).toMatchObject({ hrTotal: 2400, fte: 1 })
  expect(version.hr).toEqual([expect.objectContaining({ id: "HR:Apps", annual: 2400 })])
  if (!visible) {
    expect(JSON.stringify(view.data)).not.toMatch(/"(?:rates|rateId|rateOverride|months)":/)
  }
  expect(state).toEqual(before)
})
