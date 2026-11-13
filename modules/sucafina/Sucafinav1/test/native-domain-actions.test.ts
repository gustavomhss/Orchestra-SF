import { expect, test } from "bun:test"
import { object, rows } from "../runtime/contract.ts"
import type { Command, NativeAction, NativeScalar, Snapshot, View } from "../runtime/contract.ts"
import { empty } from "./fixture/persistence.ts"
import { nativeWriteFlow } from "./fixture/native-write.ts"

const at = "2026-03-15T12:00:00Z"
type NativePage = View & { page: string; year: number; month: number; actions?: readonly NativeAction[] }
const people = [
  { token: "admin", id: "admin-id", name: "Fixture Admin", roles: [{ surface: "dashboard", role: "admin" }] },
  { token: "leader", id: "leader-id", name: "Fixture Leader", roles: [{ surface: "dashboard", role: "domain leader" }] },
  { token: "other", id: "other-id", name: "Fixture Other", roles: [{ surface: "dashboard", role: "domain leader" }] },
  { token: "readonly", id: "readonly-id", name: "Fixture Readonly", roles: [{ surface: "dashboard", role: "domain leader" }], canWrite: false },
  { token: "denied", id: "denied-id", name: "Fixture Denied", roles: [] },
] as const

function flow(data: Record<string, unknown>, versions: Snapshot["versions"] = {}) {
  return nativeWriteFlow({ people, at, initial: { dashboard: { ...empty(), data, versions } } })
}

async function read(app: ReturnType<typeof flow>, page: string, token = "admin", query: Record<string, string> = { year: "2025", month: "2" }): Promise<NativePage> {
  const response = await app.read("dashboard", page, token, query)
  if (!response) throw new Error("Missing native response")
  expect(response.status).toBe(200)
  return response.json()
}

function action(page: NativePage, name: string, id?: string) {
  const found = page.actions?.filter((item) => item.command.action === name && item.command.id === id) ?? []
  expect(found).toHaveLength(1)
  if (!found[0]) throw new Error(`Missing ${name} descriptor`)
  return found[0]
}

function scalar(descriptor: NativeAction, name: string): NativeScalar {
  const field = descriptor.fields.find((item) => item.kind !== "group" && item.kind !== "list" && item.path.length === 1 && item.path[0] === name)
  if (!field || field.kind === "group" || field.kind === "list") throw new Error(`Missing scalar ${name}`)
  return field
}

async function post(app: ReturnType<typeof flow>, command: Command, token = "admin", status = 200) {
  const response = await app.command("dashboard", command, token)
  if (!response) throw new Error("Missing command response")
  expect(response.status).toBe(status)
  const body = object(await response.json())
  expect(body.ok).toBe(status === 200)
  return body
}

test("budget descriptors bind selected period, zero defaults, enums and stored revision", async () => {
  const app = flow({
    opexOwners: [{ id: "o1", name: "Operations", budget: 1200 }],
    opexEntries: [{ id: "e1", ownerId: "o1", year: 2025, month: 2, budget: 0, actual: 17, forecast: 29 }],
    itUsersMonthly: [{ id: "users", year: 2025, month: 2, users: 0 }, { id: "future", year: 2026, month: 2, users: 99 }],
  }, { "opexOwners:o1": { version: 3, by: "prior" }, "opexEntries:e1": { version: 4, by: "prior" }, "itUsersMonthly:users": { version: 6, by: "prior" } })
  const page = await read(app, "OPEX Detail")
  expect([page.year, page.month]).toEqual([2025, 2])
  const monthly = action(page, "save-entry", "e1")
  expect(monthly.target).toEqual({ collection: "opexEntries", id: "e1" })
  expect(monthly.command).toMatchObject({ page: "OPEX Detail", version: 4, values: { year: 2025, month: 2, ownerId: "o1", budget: 0, actual: 17, forecast: 29 } })
  expect(scalar(monthly, "year")).toMatchObject({ kind: "number", readOnly: true })
  expect(scalar(monthly, "month")).toMatchObject({ kind: "number", readOnly: true, min: 1, max: 12 })
  expect(scalar(action(page, "annual-entry", "o1"), "field").options?.map((item) => item.value)).toEqual(["budget", "actual", "forecast"])
  const deviation = page.actions?.find((item) => item.command.action === "save-deviation" && item.command.values.month === 2)
  if (!deviation) throw new Error("Missing selected deviation")
  expect(scalar(deviation, "flag").options?.map((item) => item.value)).toEqual(["", "dev-green", "dev-amber", "dev-red"])
  const executive = await read(app, "Executive Dashboard", "admin", { year: "2026", month: "2", execYear: "2025" })
  expect(action(executive, "save-users", "users").command).toMatchObject({
    page: "Executive Dashboard", version: 6, values: { year: 2025, month: 2, value: 0 },
  })
})

test("budget GET is pure and selected OPEX descriptors create, update and conflict without rebasing", async () => {
  const app = flow({
    opexOwners: [{ id: "o1", name: "Operations", budget: 1200 }],
    opexEntries: [{ id: "e1", ownerId: "o1", year: 2025, month: 2, budget: 0, actual: 17, forecast: 29 }],
    budgetLineIds: { "leader-id": ["opexOwners:o1"] },
  }, { "opexEntries:e1": { version: 4, by: "prior" } })
  const before = structuredClone(app.storage.state.dashboard)
  const first = await read(app, "OPEX Detail")
  const second = await read(app, "OPEX Detail")
  expect(first.actions).toEqual(second.actions)
  expect(app.storage.state.dashboard).toEqual(before)
  const create = action(first, "save")
  expect(create.command).toMatchObject({ version: 0, values: { year: 2025, name: "", budget: 0 } })
  await post(app, { ...create.command, values: { ...create.command.values, name: "New owner", budget: 2400 } })
  expect(rows(app.storage.state.dashboard.data.opexOwners)).toContainEqual({ id: "fixture-generated-1", name: "New owner", budget: 2400 })
  const selected = action(first, "save-entry", "e1")
  await post(app, { ...selected.command, values: { ...selected.command.values, actual: 25 } }, "leader")
  expect(rows(app.storage.state.dashboard.data.opexEntries)).toEqual([{ id: "e1", ownerId: "o1", year: 2025, month: 2, budget: 0, actual: 25, forecast: 29 }])
  expect(app.storage.state.dashboard.versions["opexEntries:e1"]).toEqual({ version: 5, by: "leader-id" })
  expect(app.storage.state.dashboard.audit).toMatchObject([{ record: "opexOwners:fixture-generated-1", who: "admin-id" }, { record: "opexEntries:e1", who: "leader-id", was: { actual: 17 }, became: { actual: 25 } }])
  const committed = structuredClone(app.storage.state.dashboard)
  expect(await post(app, { ...selected.command, values: { ...selected.command.values, actual: 999 } }, "admin", 409)).toMatchObject({ by: "leader-id", stored: { actual: 25 } })
  expect(app.storage.state.dashboard).toEqual(committed)
  expect(selected.command.version).toBe(4)
})

test("CAPEX descriptors carry legacy parent identity into existing and ordinary new commands", async () => {
  const app = flow({
    capexProjects: [{ id: "p1", name: "Infrastructure", budget: 3600 }],
    capexEntries: [{ id: "ce1", projectId: "p1", year: 2025, month: 2, budget: 100, actual: 7, forecast: 11 }],
  }, { "capexEntries:ce1": { version: 2, by: "prior" } })
  const page = await read(app, "CAPEX Projects")
  const selected = action(page, "save-entry", "ce1")
  expect(selected.command).toMatchObject({ version: 2, values: { year: 2025, month: 2, projId: "p1", budget: 100, actual: 7, forecast: 11 } })
  await post(app, { ...selected.command, values: { ...selected.command.values, actual: 0 } })
  expect(rows(app.storage.state.dashboard.data.capexEntries)).toEqual([{ id: "ce1", projId: "p1", year: 2025, month: 2, budget: 100, actual: 0, forecast: 11 }])
  const create = action(page, "save")
  await post(app, { ...create.command, values: { ...create.command.values, name: "New CAPEX", budget: 1200 } })
  expect(rows(app.storage.state.dashboard.data.capexProjects)).toContainEqual({ id: "fixture-generated-1", name: "New CAPEX", budget: 1200, status: "In Progress" })
  expect(app.storage.state.dashboard.audit.map((item) => item.record)).toEqual(["capexEntries:ce1", "capexProjects:fixture-generated-1"])
})

test("budget grants scope descriptors while readonly and denied requests expose no actions or hidden people", async () => {
  const app = flow({
    opexOwners: [{ id: "o1", name: "Granted", budget: 100 }, { id: "o2", name: "Other", budget: 200 }],
    budgetLineIds: { "leader-id": ["opexOwners:o1"] },
    members: [{ id: "secret", notes: "PRIVATE-BUDGET-PEOPLE" }],
  })
  const allowed = await read(app, "OPEX Detail", "leader")
  expect(action(allowed, "save", "o1").target).toEqual({ collection: "opexOwners", id: "o1" })
  expect(allowed.actions?.some((item) => item.command.id === "o2" || (item.command.action === "save" && item.command.id === undefined))).toBe(false)
  const readonly = await read(app, "OPEX Detail", "readonly")
  expect(readonly.actions).toEqual([])
  expect(JSON.stringify(readonly)).not.toContain("PRIVATE-BUDGET-PEOPLE")
  for (const [token, status] of [["denied", 403], ["unknown", 401]] as const) {
    const response = await app.read("dashboard", "OPEX Detail", token)
    expect(response?.status).toBe(status)
    expect(await response?.text()).not.toContain("PRIVATE-BUDGET-PEOPLE")
  }
})

test("team member descriptors use authorized defaults, revisions and literal employment enums", async () => {
  const app = flow({
    leaders: [{ id: "l1", name: "Team Lead" }],
    members: [{ id: "m1", name: "Engineer", title: "Developer", type: "Employee", status: "Active", leaderId: "l1", cls: "Talent", outlook: "Promote", notes: "PRIVATE-TALENT" }],
  }, { "members:m1": { version: 4, by: "prior" } })
  const page = await read(app, "Team Structure", "leader")
  const selected = action(page, "saveMember", "m1")
  expect([page.year, page.month]).toEqual([2025, 2])
  expect(selected.target).toEqual({ collection: "members", id: "m1" })
  expect(selected.command).toMatchObject({ version: 4, values: { name: "Engineer", title: "Developer", type: "Employee", status: "Active", leaderId: "l1" } })
  expect(scalar(selected, "status").options?.map((item) => item.value)).toEqual(["Active", "On Leave", "Terminated"])
  expect(scalar(selected, "type").options?.map((item) => item.value)).toEqual(["Employee", "Contractor"])
  expect(scalar(selected, "leaderId").options?.map((item) => item.value)).toEqual(["", "l1"])
  expect(selected.fields.some((item) => item.kind !== "group" && ["cls", "outlook", "notes"].includes(String(item.path[0])))).toBe(false)
  expect(JSON.stringify(page)).not.toContain("PRIVATE-TALENT")
  expect(Object.keys(selected.command.values)).not.toContain("cls")
})

test("team GET only appends documented read audit and descriptors execute create, update and stale CAS", async () => {
  const app = flow({ members: [{ id: "m1", name: "Engineer", type: "Employee", status: "Active", cls: "Talent", outlook: "Promote", notes: "Retain private" }] }, { "members:m1": { version: 4, by: "prior" } })
  const before = structuredClone(app.storage.state.dashboard)
  const first = await read(app, "Team Structure", "leader")
  const second = await read(app, "Team Structure", "leader")
  expect(first.actions).toEqual(second.actions)
  const readAudit = { who: "leader-id", at, record: "members:m1", was: null, became: { read: true, member: "m1" } }
  expect(app.storage.state.dashboard).toEqual({ ...before, audit: [readAudit, readAudit] })
  const create = action(first, "saveMember")
  expect(create.command.values).toEqual({ type: "Employee", status: "Active", leaderId: "" })
  await post(app, { ...create.command, values: { ...create.command.values, name: "New member" } }, "leader")
  expect(rows(app.storage.state.dashboard.data.members)).toContainEqual({ id: "fixture-generated-1", name: "New member", type: "Employee", status: "Active", leaderId: "", cls: "", outlook: "" })
  const selected = action(first, "saveMember", "m1")
  await post(app, { ...selected.command, values: { ...selected.command.values, title: "Senior engineer" } })
  expect(rows(app.storage.state.dashboard.data.members)).toContainEqual({ id: "m1", name: "Engineer", title: "Senior engineer", type: "Employee", status: "Active", leaderId: "", cls: "Talent", outlook: "Promote", notes: "Retain private" })
  expect(app.storage.state.dashboard.versions["members:m1"]).toEqual({ version: 5, by: "admin-id" })
  expect(app.storage.state.dashboard.audit.slice(2)).toMatchObject([{ record: "members:fixture-generated-1", who: "leader-id" }, { record: "members:m1", who: "admin-id", became: { title: "Senior engineer" } }])
  const committed = structuredClone(app.storage.state.dashboard)
  expect(await post(app, { ...selected.command, values: { ...selected.command.values, title: "Stale" } }, "leader", 409)).toMatchObject({ by: "admin-id", stored: { title: "Senior engineer" } })
  expect(app.storage.state.dashboard).toEqual(committed)
})

test("Talent Review descriptors carry private admin defaults and submit existing member review", async () => {
  const app = flow({ members: [{ id: "m1", name: "Engineer", type: "Employee", status: "Active", cls: "Solid Contributor", outlook: "Stay", notes: "Old review" }] }, { "members:m1": { version: 2, by: "prior" } })
  const selected = action(await read(app, "Talent Review"), "save", "m1")
  expect(selected.command).toMatchObject({ version: 2, values: { cls: "Solid Contributor", outlook: "Stay", notes: "Old review" } })
  expect(scalar(selected, "cls").options?.map((item) => item.value)).toEqual(["", "Talent", "Solid Contributor", "Lagger"])
  expect(scalar(selected, "outlook").options?.map((item) => item.value)).toEqual(["", "Promote", "Stay", "Replace", "Termination"])
  await post(app, { ...selected.command, values: { ...selected.command.values, cls: "Talent", outlook: "Promote", notes: "Updated review" } })
  expect(rows(app.storage.state.dashboard.data.members)).toMatchObject([{ id: "m1", cls: "Talent", outlook: "Promote", notes: "Updated review" }])
  expect(app.storage.state.dashboard.versions["members:m1"]).toEqual({ version: 3, by: "admin-id" })
  expect(app.storage.state.dashboard.audit.at(-1)).toMatchObject({ record: "members:m1", who: "admin-id", was: { notes: "Old review" }, became: { notes: "Updated review" } })
})

test("people readonly and nonadmin talent pages do not offer private editors or leak private defaults", async () => {
  const app = flow({ members: [{ id: "m1", name: "Engineer", type: "Employee", status: "Active", notes: "PRIVATE-PEOPLE", cls: "Talent", outlook: "Promote" }] })
  for (const [page, token] of [["Team Structure", "readonly"], ["Talent Review", "leader"], ["Headcount Overview", "leader"]]) {
    const body = await read(app, page, token)
    expect(body.actions).toEqual([])
    expect(JSON.stringify(body)).not.toContain("PRIVATE-PEOPLE")
  }
  for (const [token, status] of [["denied", 403], ["unknown", 401]] as const) {
    const response = await app.read("dashboard", "Team Structure", token)
    expect(response?.status).toBe(status)
    expect(await response?.text()).not.toContain("PRIVATE-PEOPLE")
  }
})

test("project descriptors distinguish literal new IDs and leave ID-less milestones only in parent form", async () => {
  const app = flow({ projects: [{ id: "new", name: "Existing New", status: "In Progress", risk: "Medium", budget: 40, milestones: [{ name: "Legacy unnamed ID", status: "upcoming" }, { id: "new", name: "Identified milestone", status: "done" }], internalMarker: "PRIVATE-PROJECT" }] }, { "projects:new": { version: 6, by: "prior" } })
  const page = await read(app, "All Projects")
  expect([page.year, page.month]).toEqual([2025, 2])
  const create = action(page, "save")
  const selected = action(page, "save", "new")
  expect(create.key).not.toBe(selected.key)
  expect<number | undefined>(new Set(page.actions?.map((item) => item.key)).size).toBe(page.actions?.length)
  expect(create.command.values).toEqual({ status: "Planning", risk: "Low", milestones: [] })
  expect(selected.target).toEqual({ collection: "projects", id: "new" })
  expect(selected.command).toMatchObject({ version: 6, values: { name: "Existing New", status: "In Progress", risk: "Medium", budget: 40, milestones: [{ name: "Legacy unnamed ID", status: "upcoming" }, { id: "new", name: "Identified milestone", status: "done" }] } })
  expect(scalar(selected, "status").options?.map((item) => item.value)).toEqual(["Planning", "In Progress", "On Hold", "Completed"])
  expect(scalar(selected, "risk").options?.map((item) => item.value)).toEqual(["Low", "Medium", "High"])
  const children = page.actions?.filter((item) => item.command.action === "save-milestone" && item.command.id === "new") ?? []
  expect(children).toHaveLength(2)
  expect(children.map((item) => item.command.values)).toEqual([{ status: "upcoming" }, { status: "done", name: "Identified milestone", milestoneId: "new" }])
  expect(children[0]?.key).not.toBe(children[1]?.key)
  expect(children.some((item) => item.command.values.name === "Legacy unnamed ID")).toBe(false)
  expect(JSON.stringify(page)).not.toContain("PRIVATE-PROJECT")
})

test("portfolio GET is pure and actual project descriptors create, update and reject a competing stale edit", async () => {
  const app = flow({ projects: [{ id: "p1", name: "Original", status: "Planning", risk: "Low", milestones: [] }] }, { "projects:p1": { version: 3, by: "prior" } })
  const before = structuredClone(app.storage.state.dashboard)
  const first = await read(app, "All Projects", "leader")
  const second = await read(app, "All Projects", "leader")
  expect(first.actions).toEqual(second.actions)
  expect(app.storage.state.dashboard).toEqual(before)
  const create = action(first, "save")
  await post(app, { ...create.command, values: { ...create.command.values, name: "Created project", budget: 50 } }, "leader")
  expect(rows(app.storage.state.dashboard.data.projects)).toContainEqual(expect.objectContaining({ id: "fixture-generated-1", name: "Created project", status: "Planning", risk: "Low", budget: 50 }))
  const selected = action(first, "save", "p1")
  await post(app, { ...selected.command, values: { ...selected.command.values, name: "Competing project" } })
  expect(app.storage.state.dashboard.versions["projects:p1"]).toEqual({ version: 4, by: "admin-id" })
  expect(app.storage.state.dashboard.audit).toMatchObject([{ record: "projects:fixture-generated-1", who: "leader-id" }, { record: "projects:p1", who: "admin-id", was: { name: "Original" }, became: { name: "Competing project" } }])
  const committed = structuredClone(app.storage.state.dashboard)
  expect(await post(app, { ...selected.command, values: { ...selected.command.values, name: "Stale project" } }, "leader", 409)).toMatchObject({ by: "admin-id", stored: { name: "Competing project" } })
  expect(app.storage.state.dashboard).toEqual(committed)
  expect(selected.command.version).toBe(3)
})

test("scoped risk descriptors bind directory responsible and exclude other owners' edit commands", async () => {
  const app = flow({ risks: [{ id: "own", name: "Own risk", responsible: "Fixture Leader", status: "open", impact: 2, probability: 3 }, { id: "other", name: "Other risk", responsible: "Fixture Other", impact: 4, probability: 4 }] }, { "risks:own": { version: 2, by: "prior" } })
  const page = await read(app, "IT Risks", "leader")
  const create = action(page, "save")
  expect(create.command.values).toEqual({ status: "open", impact: 1, probability: 1, responsible: "Fixture Leader" })
  const selected = action(page, "save", "own")
  expect(selected.command).toMatchObject({ version: 2, values: { responsible: "Fixture Leader", impact: 2, probability: 3 } })
  expect(scalar(selected, "responsible").options?.map((item) => item.value)).toEqual(["Fixture Leader"])
  expect(page.actions?.some((item) => item.target?.id === "other")).toBe(false)
  await post(app, { ...selected.command, values: { ...selected.command.values, name: "Mitigated risk", status: "mitigating" } }, "leader")
  expect(rows(app.storage.state.dashboard.data.risks)).toMatchObject([{ id: "own", name: "Mitigated risk", responsible: "Fixture Leader", status: "mitigating" }, { id: "other", name: "Other risk" }])
  expect(app.storage.state.dashboard.audit).toMatchObject([{ record: "risks:own", who: "leader-id" }])
})

test("portfolio readonly and denied HTTP requests expose no commands or private storage fields", async () => {
  const app = flow({ projects: [{ id: "p1", name: "Visible", status: "Planning", risk: "Low", milestones: [], internalMarker: "PRIVATE-PORTFOLIO" }], contracts: [{ id: "c1", vendor: "Vendor", docs: [{ id: "d1", name: "Terms", blobKey: "PRIVATE-BLOB-KEY" }] }] })
  for (const name of ["All Projects", "Vendor Contracts"]) {
    const page = await read(app, name, "readonly")
    expect(page.actions).toEqual([])
    expect(JSON.stringify(page)).not.toMatch(/PRIVATE-PORTFOLIO|PRIVATE-BLOB-KEY/)
  }
  for (const [token, status] of [["denied", 403], ["unknown", 401]] as const) {
    const response = await app.read("dashboard", "All Projects", token)
    expect(response?.status).toBe(status)
    expect(await response?.text()).not.toContain("PRIVATE-PORTFOLIO")
  }
})
