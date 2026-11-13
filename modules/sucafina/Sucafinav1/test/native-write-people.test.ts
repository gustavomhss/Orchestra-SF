import { expect, test } from "bun:test"
import { nativeWriteFlow } from "./fixture/native-write.ts"
import { empty } from "./fixture/persistence.ts"
import { object, rows } from "../runtime/contract.ts"

const people = [
  { token: "admin-token", id: "directory-admin", name: "Admin Person", roles: [{ surface: "dashboard" as const, role: "admin" }] },
  { token: "leader-token", id: "directory-leader", name: "Leader Person", roles: [{ surface: "dashboard" as const, role: "domain leader" }] },
]
const at = "2026-03-15T12:00:00Z"

async function requireNative(pending: Promise<Response | undefined>) {
  const response = await pending
  if (!response) throw new Error("Missing native route")
  return response
}

async function body(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

test("domain leader Team Structure commands persist structural fields and ignore private talent fields", async () => {
  const initial = empty()
  initial.data.cio = { name: "Old CIO", title: "Chief", location: "Geneva", start: "2020-01-01" }
  initial.data.leaders = [{ id: "lead-1", name: "Old Leader", domain: "Finance" }]
  initial.data.members = [{ id: "member-1", name: "Old Member", leaderId: "lead-1", cls: "Talent", outlook: "Promote", notes: "Keep private" }]
  initial.versions.cio = { version: 2, by: "prior" }
  initial.versions["leaders:lead-1"] = { version: 3, by: "prior" }
  initial.versions["members:member-1"] = { version: 4, by: "prior" }
  const flow = nativeWriteFlow({ people, initial: { dashboard: initial }, at })
  for (const command of [
    { page: "Team Structure", action: "saveCio", version: 2, values: { name: "New CIO", title: "CIO", location: "Basel", start: "2021-02-03" } },
    { page: "Team Structure", action: "saveLeader", id: "lead-1", version: 3, values: { name: "New Leader", title: "VP", domain: "Technology", location: "Basel", start: "2022-04-05" } },
    { page: "Team Structure", action: "saveMember", id: "member-1", version: 4, values: { name: "New Member", title: "Engineer", type: "Contractor", leaderId: "lead-1", location: "Basel", start: "2023-06-07", end: "", status: "Active", cls: "Lagger", outlook: "Replace", notes: "forged" } },
  ]) {
    const response = await requireNative(flow.command("dashboard", { ...command, values: command.values }, "leader-token"))
    expect(response.status).toBe(200)
    expect(await body(response)).toEqual({ ok: true })
  }
  expect(rows(flow.storage.state.dashboard.data.members)).toMatchObject([
    { id: "member-1", cls: "Talent", outlook: "Promote", notes: "Keep private" },
  ])
  const view = await body(await requireNative(flow.read("dashboard", "Team Structure", "leader-token")))
  expect(view.data).toMatchObject({
    cio: { name: "New CIO", title: "CIO", location: "Basel", start: "2021-02-03" },
    leaders: [{ id: "lead-1", name: "New Leader", title: "VP", domain: "Technology", location: "Basel", start: "2022-04-05" }],
    members: [{ id: "member-1", name: "New Member", title: "Engineer", type: "Contractor", leaderId: "lead-1", location: "Basel", start: "2023-06-07", status: "Active" }],
  })
  expect(JSON.stringify(view.data)).not.toMatch(/Keep private|forged|Lagger|Replace/)
  expect(flow.storage.state.dashboard.versions).toMatchObject({ cio: { version: 3, by: "directory-leader" }, "leaders:lead-1": { version: 4, by: "directory-leader" }, "members:member-1": { version: 5, by: "directory-leader" } })
  expect(flow.storage.state.dashboard.audit).toEqual([
    {
      "who": "directory-leader",
      "name": "Leader Person",
      "at": "2026-03-15T12:00:00Z",
      "record": "cio",
      "was": {
        "name": "Old CIO",
        "title": "Chief",
        "location": "Geneva",
        "start": "2020-01-01"
      },
      "became": {
        "name": "New CIO",
        "title": "CIO",
        "location": "Basel",
        "start": "2021-02-03"
      }
    },
    {
      "who": "directory-leader",
      "name": "Leader Person",
      "at": "2026-03-15T12:00:00Z",
      "record": "leaders:lead-1",
      "was": {
        "id": "lead-1",
        "name": "Old Leader",
        "domain": "Finance"
      },
      "became": {
        "id": "lead-1",
        "name": "New Leader",
        "domain": "Technology",
        "title": "VP",
        "location": "Basel",
        "start": "2022-04-05"
      }
    },
    {
      "who": "directory-leader",
      "name": "Leader Person",
      "at": "2026-03-15T12:00:00Z",
      "record": "members:member-1",
      "was": {
        "id": "member-1",
        "name": "Old Member",
        "leaderId": "lead-1",
        "cls": "Talent",
        "outlook": "Promote",
        "notes": "Keep private"
      },
      "became": {
        "id": "member-1",
        "name": "New Member",
        "title": "Engineer",
        "type": "Contractor",
        "leaderId": "lead-1",
        "location": "Basel",
        "start": "2023-06-07",
        "end": "",
        "status": "Active",
        "cls": "Talent",
        "outlook": "Promote",
        "notes": "Keep private"
      }
    },
    {
      "who": "directory-leader",
      "at": "2026-03-15T12:00:00Z",
      "record": "members:member-1",
      "was": null,
      "became": {
        "read": true,
        "member": "member-1"
      }
    }
  ])
})

test("Talent Review edits require admin and admin writes private fields", async () => {
  const initial = empty()
  initial.data.members = [{ id: "member-1", name: "Member", status: "Active", cls: "Solid Contributor", outlook: "Stay", notes: "Old" }]
  initial.versions["members:member-1"] = { version: 1, by: "prior" }
  const flow = nativeWriteFlow({ people, initial: { dashboard: initial }, at })
  const before = structuredClone(flow.storage.state.dashboard)
  const denied = await requireNative(flow.command("dashboard", { page: "Talent Review", action: "save", id: "member-1", version: 1, values: { cls: "Talent", outlook: "Promote", notes: "Private" } }, "leader-token"))
  expect(denied.status).toBe(403)
  expect(await body(denied)).toMatchObject({ ok: false, status: 403, errors: ["You do not have access to Talent Review."] })
  expect(flow.storage.state.dashboard).toEqual(before)
  const saved = await requireNative(flow.command("dashboard", { page: "Talent Review", action: "save", id: "member-1", version: 1, values: { cls: "Talent", outlook: "Promote", notes: "Private" } }, "admin-token"))
  expect(saved.status).toBe(200)
  expect(await body(saved)).toEqual({ ok: true })
  const view = await body(await requireNative(flow.read("dashboard", "Talent Review", "admin-token")))
  expect(rows(object(view.data).members)).toMatchObject([{ id: "member-1", cls: "Talent", outlook: "Promote", notes: "Private" }])
  expect(flow.storage.state.dashboard.versions["members:member-1"]).toEqual({ version: 2, by: "directory-admin" })
})

test("leader deletion requires every child CAS and atomically clears children on valid versions", async () => {
  const initial = empty()
  initial.data.leaders = [{ id: "leader-1", name: "Leader" }]
  initial.data.members = [{ id: "m-1", name: "One", leaderId: "leader-1" }, { id: "m-2", name: "Two", leaderId: "leader-1" }]
  initial.versions["leaders:leader-1"] = { version: 2, by: "prior" }
  initial.versions["members:m-1"] = { version: 3, by: "prior" }
  initial.versions["members:m-2"] = { version: 5, by: "other-editor" }
  const flow = nativeWriteFlow({ people, initial: { dashboard: initial }, at })
  const before = structuredClone(flow.storage.state.dashboard)
  const conflict = await requireNative(flow.command("dashboard", { page: "Team Structure", action: "deleteLeader", id: "leader-1", version: 2, values: { versions: { "members:m-1": 3, "members:m-2": 4 } } }, "admin-token"))
  expect(conflict.status).toBe(409)
  expect(await body(conflict)).toMatchObject({ ok: false, status: 409, by: "other-editor", stored: { id: "m-2" } })
  expect(flow.storage.state.dashboard).toEqual(before)
  const deleted = await requireNative(flow.command("dashboard", { page: "Team Structure", action: "deleteLeader", id: "leader-1", version: 2, values: { versions: { "members:m-1": 3, "members:m-2": 5 } } }, "admin-token"))
  expect(deleted.status).toBe(200)
  expect(await body(deleted)).toEqual({ ok: true })
  expect(rows(flow.storage.state.dashboard.data.leaders)).toEqual([])
  expect(rows(flow.storage.state.dashboard.data.members)).toMatchObject([{ id: "m-1", leaderId: "" }, { id: "m-2", leaderId: "" }])
  expect(flow.storage.state.dashboard.versions).toMatchObject({ "leaders:leader-1": { version: 3, by: "directory-admin" }, "members:m-1": { version: 4, by: "directory-admin" }, "members:m-2": { version: 6, by: "directory-admin" } })
  expect(flow.storage.state.dashboard.audit).toHaveLength(3)
})

test("structured row import preserves matched blank dates and records the update", async () => {
  const initial = empty()
  initial.data.members = [{ id: "member-1", name: "Alice Example", title: "Engineer", status: "Active", type: "Employee", start: "2020-01-02", end: "2024-05-06", cls: "Solid Contributor", outlook: "Stay", notes: "Retain" }]
  initial.versions["members:member-1"] = { version: 7, by: "prior" }
  const flow = nativeWriteFlow({ people, initial: { dashboard: initial }, at })
  const response = await requireNative(flow.command("dashboard", { page: "Talent Review", action: "import", version: 0, values: { rows: [{ Name: "alice example", Title: "Senior Engineer", "Start Date": "", "End Date": "", Classification: "Talent", Outlook: "Promote", Notes: "Updated" }], versions: { "members:member-1": 7 } } }, "admin-token"))
  expect(response.status).toBe(200)
  expect(await body(response)).toEqual({ ok: true })
  const view = await body(await requireNative(flow.read("dashboard", "Talent Review", "admin-token")))
  expect(rows(object(view.data).members)).toMatchObject([{ id: "member-1", name: "alice example", title: "Senior Engineer", start: "2020-01-02", end: "2024-05-06", cls: "Talent", outlook: "Promote", notes: "Updated" }])
  expect(flow.storage.state.dashboard.versions["members:member-1"]).toEqual({ version: 8, by: "directory-admin" })
  expect(flow.storage.state.dashboard.audit).toEqual([
    {
      "who": "directory-admin",
      "name": "Admin Person",
      "at": "2026-03-15T12:00:00Z",
      "record": "members:member-1",
      "was": {
        "id": "member-1",
        "name": "Alice Example",
        "title": "Engineer",
        "status": "Active",
        "type": "Employee",
        "start": "2020-01-02",
        "end": "2024-05-06",
        "cls": "Solid Contributor",
        "outlook": "Stay",
        "notes": "Retain"
      },
      "became": {
        "id": "member-1",
        "name": "alice example",
        "title": "Senior Engineer",
        "status": "Active",
        "type": "Employee",
        "start": "2020-01-02",
        "end": "2024-05-06",
        "cls": "Talent",
        "outlook": "Promote",
        "notes": "Updated"
      }
    },
    {
      "who": "directory-admin",
      "at": "2026-03-15T12:00:00Z",
      "record": "members:member-1",
      "was": null,
      "became": {
        "read": true,
        "member": "member-1"
      }
    }
  ])
})

test("invalid later structured import row rolls back prior row, versions, and audit", async () => {
  const flow = nativeWriteFlow({ people, initial: { dashboard: empty() }, at })
  const before = structuredClone(flow.storage.state.dashboard)
  const response = await requireNative(flow.command("dashboard", { page: "Talent Review", action: "import", version: 0, values: { rows: [{ Name: "First Person", Status: "Active" }, { Name: "Second Person", Status: "Not a status" }] } }, "admin-token"))
  expect(response.status).toBe(422)
  expect(await body(response)).toEqual({ ok: false, status: 422, errors: ["Name, valid status, type, classification and outlook required."] })
  expect(flow.storage.state.dashboard).toEqual(before)
})
