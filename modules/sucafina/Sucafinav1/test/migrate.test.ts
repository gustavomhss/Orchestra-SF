import { expect, test } from "bun:test"
import { computeBudgetTotals } from "../src/dashboard-accounts.ts"
import { migrateDashboard, readMember } from "../src/dashboard-role.ts"
import { migratePlanner } from "../src/planner-role.ts"
import { createRequest, migrateProcurement, nextSup } from "../src/procurement.ts"
import type { Store } from "../src/procurement.ts"
import { legalInitialSettings } from "../src/initial-settings.ts"
import { open, seal } from "../src/supplier.ts"

const KEY = new Uint8Array(32).fill(7)

function admin(canWrite = true) {
  return { id: "ada", canWrite, roles: ["admin"] }
}

test("migration keeps the numbers, seals IBAN on load, and does not strip talent from the backup", () => {
  const exported = {
    opexOwners: [{ id: "a", budget: 1200 }],
    opexEntries: [
      {
        year: 2026,
        month: 1,
        ownerId: "a",
        budget: 500,
        actual: 10.01,
        forecast: 20,
      },
    ],
    members: [{ id: "m1", cls: "Talent", outlook: "Promote", notes: "private" }],
    slaEntries: [{ id: "dead" }],
    hwEntries: [{ id: "dead" }],
    watchList: ["not-live"],
    _budget2026Loaded: true,
    _hotTopicsSeeded: true,
    _fifth: true,
    projects: [{ id: "p", watchList: true, name: "ERP" }],
  }
  expect(migrateDashboard(exported, admin(false), true, 2026)).toEqual({
    ok: false,
  })
  expect(migrateDashboard(exported, { canWrite: true, roles: ["viewer"] }, true, 2026)).toEqual({ ok: false })
  const loaded = migrateDashboard(exported, admin(), true, 2026)
  if (!loaded.ok) throw new Error("dashboard migration refused")
  expect(loaded.totals).toEqual(computeBudgetTotals(exported, 2026))
  expect(Math.round(loaded.totals.opexActual * 100)).toBe(1001)
  expect(loaded.data.members?.[0].cls).toBe("Talent")
  expect(loaded.data.slaEntries).toBeUndefined()
  expect(loaded.data.hwEntries).toBeUndefined()
  expect(loaded.data.watchList).toBeUndefined()
  expect(loaded.data._budget2026Loaded).toBeUndefined()
  expect(loaded.data._fifth).toBe(true)
  expect(loaded.flags).toEqual(["_budget2026Loaded", "_hotTopicsSeeded"])
  expect((loaded.data.projects as { watchList: boolean }[])[0].watchList).toBe(true)
  expect(
    readMember(loaded.data.members![0], { id: "vie", roles: ["viewer"] }, "2026-11-11T00:00:00Z", []).cls,
  ).toBeUndefined()

  const versions = [{ id: "v1", year: 2027, lines: [{ b: [8333.33, 8333.37] }] }]
  expect(migratePlanner(versions, admin(false), true)).toEqual({ ok: false })
  const planner = migratePlanner(versions, admin(), true)
  if (!planner.ok) throw new Error("planner migration refused")
  versions[0].lines[0].b[0] = 0
  expect(planner.versions[0].lines[0].b).toEqual([8333.33, 8333.37])

  const already = seal("GB00", KEY)
  const procured = migrateProcurement(
    {
      requests: [
        {
          number: "PR-2026-0007",
          history: [{ at: "1", action: "created" }],
          po: { number: "PO-2026-0003" },
        },
        { number: "not-a-number" },
      ],
      suppliers: [
        { number: "SUP-00012", iban: "GB00CLEAR", account: "999" },
        { number: "SUP-00004", iban: already },
      ],
    },
    admin(),
    true,
    KEY,
  )
  if (!procured.ok) throw new Error("procurement migration refused")
  expect(procured.issued).toEqual({
    pr: ["PR-2026-0007"],
    po: ["PO-2026-0003"],
    sup: ["SUP-00012", "SUP-00004"],
  })
  expect(procured.requests[0].history).toEqual([{ at: "1", action: "created" }])
  expect(open(procured.suppliers[0].iban!, KEY)).toBe("GB00CLEAR")
  expect(procured.suppliers[0].iban).not.toBe("GB00CLEAR")
  expect(procured.suppliers[1].iban).toBe(already)
  expect(nextSup(procured.issued.sup)).toBe("SUP-00013")
  expect(nextSup(procured.issued.sup)).not.toBe("SUP-00001")
  const settings = legalInitialSettings()
  const store: Store = {
    settings,
    form: { currency: "USD", fxRates: settings.fxRates },
    issued: { pr: procured.issued.pr, po: procured.issued.po },
    sup: procured.issued.sup,
    suppliers: [],
    requests: {},
    actCalls: 0,
    lastIssued: null,
  }
  const created = createRequest(
    store,
    { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } },
    { id: "ada", canWrite: true, roles: ["requester"] },
    "2026-11-11T00:00:00Z",
  )
  if (!created.ok) throw new Error(created.code)
  expect(created.request.number).toBe("PR-2026-0008")
  expect(migrateProcurement({ requests: [], suppliers: [] }, { canWrite: true, roles: ["buyer"] }, true, KEY)).toEqual({
    ok: false,
  })
})
