import { expect, test } from "bun:test"
import { readMember } from "../src/dashboard-role.ts"
import { actActor, emptyMap, plugGroup, resolve } from "../src/identity.ts"
import { quoteFile } from "../src/procurement-screen.ts"
import { budgetLineWrite, dashboardPages, openDashboard } from "../src/surfaces.ts"

test("the group map is empty until a name is plugged, and a dashboard role does not enter act", () => {
  const asked: string[] = []
  const member = (group: string) => {
    asked.push(group)
    return true
  }
  const empty = resolve("dir-1", emptyMap(), member)
  expect(empty).toEqual({ id: "dir-1", canWrite: false, roles: [] })
  expect(asked).toEqual([])
  expect(JSON.stringify(empty)).not.toContain("unresolved")
  expect(empty.id).not.toContain("local:")
  expect(actActor(empty)).toEqual({ id: "dir-1", canWrite: false, roles: [] })

  const plugged = plugGroup(emptyMap(), "dashboard", "admin", "SG-CIO")
  expect(emptyMap().every((row) => row.entra == null)).toBe(true)
  expect(plugged.find((row) => row.role === "cio")).toBeUndefined()
  const dash = resolve("dir-1", plugged, member)
  expect(dash.roles).toEqual([{ surface: "dashboard", role: "admin" }])
  expect(dash.canWrite).toBe(true)
  expect(asked).toEqual(["SG-CIO"])
  expect(actActor(dash)).toEqual({ id: "dir-1", canWrite: false, roles: [] })

  const buyer = resolve(
    "dir-1",
    plugGroup(emptyMap(), "procurement", "buyer", "SG-Buyers"),
    (group) => group === "SG-Buyers",
  )
  expect(actActor(buyer)).toEqual({
    id: "dir-1",
    canWrite: true,
    roles: ["buyer"],
  })
  expect(actActor({ id: buyer.id, roles: buyer.roles, domains: ["IT"] } as never)).toEqual({
    id: "dir-1",
    canWrite: true,
    roles: ["buyer"],
  })
})

test("the leader join is a table, empty means admin only, and equal ids do not authorize", () => {
  const member = {
    id: "m1",
    leaderId: "lead-1",
    cls: "Talent",
    outlook: "Promote",
    notes: "private",
  }
  const leader = { id: "lead-1", roles: ["domain leader"] }
  const directory = { id: "dir-1", roles: ["domain leader"] }
  expect(readMember(member, leader, "2026-11-10T12:00:00Z", []).cls).toBeUndefined()
  expect(
    readMember(member, directory, "2026-11-10T12:00:00Z", [], [{ directoryId: "lead-1", leaderId: "lead-1" }]).cls,
  ).toBeUndefined()
  const seen = readMember(member, directory, "2026-11-10T12:00:00Z", [], [{ directoryId: "dir-1", leaderId: "lead-1" }])
  expect(seen.cls).toBe("Talent")
  expect(seen.notes).toBe("private")
  expect(
    readMember(
      member,
      { id: "dir-1", roles: ["viewer"] },
      "2026-11-10T12:00:00Z",
      [],
      [{ directoryId: "dir-1", leaderId: "lead-1" }],
    ).cls,
  ).toBeUndefined()
})

test("summaries, budget lines and the quote cap are plugs, empty until he writes them", () => {
  const viewer = { roles: ["viewer"] }
  expect(dashboardPages(viewer)).toEqual(["Executive Dashboard"])
  expect(openDashboard("IT Risks", viewer)).toEqual({ drawn: false })
  expect(dashboardPages(viewer, ["IT Risks", "Hardware", "slaEntries"])).toEqual(["Executive Dashboard", "IT Risks"])
  expect(openDashboard("IT Risks", viewer, ["IT Risks"]).drawn).toBe(true)
  const lead = { canWrite: true, roles: ["domain leader"] }
  expect(budgetLineWrite(lead, "opex-1")).toBe(false)
  expect(budgetLineWrite(lead, "opex-1", ["line-9"])).toBe(false)
  expect(budgetLineWrite(lead, "line-9", ["line-9"])).toBe(true)
  expect(quoteFile(1, null)).toEqual({ ok: false })
  expect(quoteFile(25 * 1024 * 1024, null)).toEqual({ ok: false })
  expect(quoteFile(10, 10)).toEqual({ ok: true })
  expect(quoteFile(11, 10)).toEqual({ ok: false })
})
