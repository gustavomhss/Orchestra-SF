import { expect, test } from "bun:test"
import { object, rows } from "../runtime/contract.ts"
import type { Command, NativeAction, NativeField, NativeScalar, Snapshot, View } from "../runtime/contract.ts"
import { empty } from "./fixture/persistence.ts"
import { nativeWriteFlow } from "./fixture/native-write.ts"
import type { FlowPerson } from "./fixture/native-write.ts"

type NativePage = View & { page: string; year: number; month: number; actions: readonly NativeAction[] }
const operations = "IT Operations"
const security = "IT Security KPIs"
const people: readonly FlowPerson[] = [
  { token: "admin", id: "admin-id", name: "Admin Person", roles: [{ surface: "dashboard", role: "admin" }] },
  { token: "operations", id: "operations-id", name: "Operations Person", roles: [{ surface: "dashboard", role: "contributor" }], access: { dashboard: { assigned: ["Operations"] } } },
  { token: "security", id: "security-id", name: "Security Person", roles: [{ surface: "dashboard", role: "contributor" }], access: { dashboard: { assigned: ["security"] } } },
  { token: "unassigned", id: "unassigned-id", name: "Unassigned Person", roles: [{ surface: "dashboard", role: "contributor" }] },
  { token: "readonly", id: "readonly-id", name: "Readonly Person", roles: [{ surface: "dashboard", role: "admin" }], canWrite: false },
  { token: "viewer", id: "viewer-id", name: "Viewer Person", roles: [{ surface: "dashboard", role: "viewer" }] },
  { token: "denied", id: "denied-id", name: "Denied Person", roles: [] },
]

function flow(data: Record<string, unknown>, versions: Snapshot["versions"] = {}) {
  return nativeWriteFlow({ people, at: "2026-03-15T12:00:00Z", initial: { dashboard: { ...empty(), data, versions } } })
}

async function read(app: ReturnType<typeof flow>, page: string, token = "admin"): Promise<NativePage> {
  const query: Record<string, string> = page === operations
    ? { year: "2026", opsYear: "2025", operationsMonth: "2" }
    : { year: "2026", secYear: "2025", securityMonth: "2" }
  const response = await app.read("dashboard", page, token, query)
  if (!response) throw new Error("Missing native response")
  expect(response.status).toBe(200)
  return response.json()
}

function action(page: NativePage, name: string, id?: string) {
  const found = page.actions.filter((entry) => entry.command.action === name && entry.command.id === id)
  expect(found).toHaveLength(1)
  if (!found[0]) throw new Error(`Missing ${name} action`)
  return found[0]
}

function scalars(fields: readonly NativeField[]): NativeScalar[] {
  return fields.flatMap((field) => field.kind === "group" || field.kind === "list" ? scalars(field.fields) : [field])
}

function field(descriptor: NativeAction, name: string) {
  const found = scalars(descriptor.fields).filter((entry) => entry.path.length === 1 && entry.path[0] === name)
  expect(found).toHaveLength(1)
  if (!found[0]) throw new Error(`Missing ${name} field`)
  return found[0]
}

async function post(app: ReturnType<typeof flow>, command: Command, token = "admin", status = 200) {
  const response = await app.command("dashboard", command, token)
  if (!response) throw new Error("Missing command response")
  expect(response.status).toBe(status)
  const body = object(await response.json())
  expect(body.ok).toBe(status === 200)
  return body
}

test("operations descriptors freeze period and cell identity and use shared month CAS for zero writes", async () => {
  const app = flow({
    opsCats: ["IT Operations"], opsHmItems: ["Ledger"],
    opsTickets: [{ id: "2025-2", year: 2025, month: 2, "IT Operations|Incidents|Open": 7 }, { id: "other", year: 2026, month: 2, "IT Operations|Incidents|Open": 99 }],
    opsSLA: [{ id: "2025-2", year: 2025, month: 2, incSLA: 91, svcSLA: 92, avail: 99 }],
    opsHeatmap: [{ id: "2025-2:Ledger", year: 2025, month: 2, item: "Ledger", p1: 2, p2: 3, tickets: 4, comments: "Old" }],
  }, { "ops:2025-2": { version: 4, by: "prior" } })
  const page = await read(app, operations, "operations")
  expect([page.year, page.month]).toEqual([2025, 2])
  const tickets = action(page, "save-tickets")
  const staleSla = action(page, "save-sla")
  const heat = action(page, "save-heatmap")
  expect(tickets.command).toMatchObject({ page: operations, version: 4, values: { year: 2025, month: 2, "IT Operations|Incidents|Open": 7 } })
  expect(tickets.target).toEqual({ collection: "opsTickets", id: "2025-2" })
  expect(field(tickets, "IT Operations|Incidents|Open").path).toEqual(["IT Operations|Incidents|Open"])
  for (const descriptor of [tickets, staleSla, heat]) {
    expect(field(descriptor, "year").readOnly).toBe(true)
    expect(field(descriptor, "month").readOnly).toBe(true)
    expect(descriptor.command.version).toBe(4)
  }
  expect(heat.target).toEqual({ collection: "opsHeatmap", id: "2025-2:Ledger" })
  expect(field(heat, "item")).toMatchObject({ readOnly: true, path: ["item"] })
  expect(heat.command.values.item).toBe("Ledger")
  await post(app, { ...tickets.command, values: { ...tickets.command.values, "IT Operations|Incidents|Open": 0 } }, "operations")
  expect(rows(app.storage.state.dashboard.data.opsTickets)).toContainEqual({ id: "2025-2", year: 2025, month: 2, "IT Operations|Incidents|Initial Balance": 0, "IT Operations|Incidents|Open": 0, "IT Operations|Incidents|Closed": 0, "IT Operations|Service Requests|Initial Balance": 0, "IT Operations|Service Requests|Open": 0, "IT Operations|Service Requests|Closed": 0 })
  const committed = structuredClone(app.storage.state.dashboard)
  expect(await post(app, staleSla.command, "operations", 409)).toMatchObject({ by: "operations-id" })
  expect(app.storage.state.dashboard).toEqual(committed)
  const sla = action(await read(app, operations), "save-sla")
  expect(sla.command.version).toBe(5)
  await post(app, { ...sla.command, values: { ...sla.command.values, incSLA: 0, svcSLA: 0, avail: 0 } })
  expect(app.storage.state.dashboard.data.opsSLA).toEqual([{ id: "2025-2", year: 2025, month: 2, incSLA: 0, svcSLA: 0, avail: 0 }])
  const cell = action(await read(app, operations), "save-heatmap")
  expect(cell.command.version).toBe(6)
  await post(app, { ...cell.command, values: { ...cell.command.values, p1: 0, p2: 0, tickets: 0, comments: "Zero cell" } })
  expect(app.storage.state.dashboard.data.opsHeatmap).toEqual([{ id: "2025-2:Ledger", year: 2025, month: 2, item: "Ledger", p1: 0, p2: 0, tickets: 0, comments: "Zero cell" }])
  expect(rows(app.storage.state.dashboard.data.opsTickets)).toContainEqual({ id: "other", year: 2026, month: 2, "IT Operations|Incidents|Open": 99 })
  expect(app.storage.state.dashboard.versions["ops:2025-2"]).toEqual({ version: 7, by: "admin-id" })
  expect(app.storage.state.dashboard.audit.map((entry) => entry.record)).toEqual(["ops:2025-2", "ops:2025-2", "ops:2025-2"])
})

test("all thirteen ordinary commands are projected only for writable assigned scopes", async () => {
  const app = flow({
    opsCats: ["IT Operations"], opsHmItems: ["Ledger"], summaries: [operations, security],
    secKpi: [{ id: "k1", year: 2025, month: 2, training: 0 }],
    secActions: [{ id: "a1", text: "Action", done: false }],
    secIncidents: [{ id: "i1", title: "Incident", date: "2025-02-01", consequences: [] }],
    secPhishing: [{ id: "c1", name: "Campaign", departments: [] }],
    members: [{ id: "private", notes: "PRIVATE-OPS-PEOPLE" }], privateFixture: "PRIVATE-OPS-ROOT",
  })
  const ops = await read(app, operations)
  const sec = await read(app, security)
  expect([...new Set([...ops.actions, ...sec.actions].map((entry) => entry.command.action))].sort()).toEqual([
    "delete-action", "delete-campaign", "delete-incident", "delete-kpi", "save-action", "save-campaign", "save-categories", "save-heatmap", "save-incident", "save-items", "save-kpi", "save-sla", "save-tickets",
  ])
  expect(action(ops, "save-categories").command.values).toEqual({ names: "IT Operations" })
  expect(action(ops, "save-items").command.values).toEqual({ names: "Ledger" })
  expect((await read(app, operations, "operations")).actions.length).toBeGreaterThan(0)
  expect((await read(app, security, "security")).actions.length).toBeGreaterThan(0)
  expect((await read(app, security, "operations")).actions).toEqual([])
  expect((await read(app, operations, "security")).actions).toEqual([])
  for (const token of ["readonly", "viewer", "unassigned"]) {
    for (const name of [operations, security]) {
      const page = await read(app, name, token)
      expect(page.actions).toEqual([])
      expect(JSON.stringify(page)).not.toMatch(/PRIVATE-OPS-PEOPLE|PRIVATE-OPS-ROOT/)
    }
  }
  for (const [token, status] of [["denied", 403], ["unknown", 401]] as const) {
    const response = await app.read("dashboard", security, token)
    expect(response?.status).toBe(status)
    expect(await response?.text()).not.toContain("PRIVATE-OPS")
  }
})

test("selected security KPI descriptors create zero without carry and update using period CAS", async () => {
  const earlier = { id: "earlier", year: 2025, month: 1, training: 99, patch: 88 }
  const app = flow({ secKpi: [earlier] })
  const create = action(await read(app, security, "security"), "save-kpi")
  expect(create.command).toMatchObject({ page: security, version: 0, values: { year: 2025, month: 2, training: "", patch: "", socClosure: "" } })
  expect(create.command.id).toBeUndefined()
  expect(create.target).toEqual({ collection: "secKpi", id: "2025-2" })
  expect(field(create, "year").readOnly).toBe(true)
  expect(field(create, "month").readOnly).toBe(true)
  await post(app, { ...create.command, values: { ...create.command.values, training: 0, socClosure: 0 } }, "security")
  expect(rows(app.storage.state.dashboard.data.secKpi)).toContainEqual(earlier)
  expect(rows(app.storage.state.dashboard.data.secKpi).find((row) => row.id === "2025-2")).toMatchObject({ year: 2025, month: 2, training: 0, patch: "", socClosure: 0 })
  const page = await read(app, security)
  const update = action(page, "save-kpi", "2025-2")
  expect(update.command).toMatchObject({ version: 1, values: { training: 0, patch: "", socClosure: 0 } })
  for (const descriptor of [update, action(page, "delete-kpi", "2025-2")]) {
    expect(field(descriptor, "year").readOnly).toBe(true)
    expect(field(descriptor, "month").readOnly).toBe(true)
  }
  await post(app, { ...update.command, values: { ...update.command.values, scan: 0 } })
  expect(rows(app.storage.state.dashboard.data.secKpi).find((row) => row.id === "2025-2")).toMatchObject({ training: 0, patch: "", scan: 0, socClosure: 0 })
  const committed = structuredClone(app.storage.state.dashboard)
  expect(await post(app, { ...create.command, values: { ...create.command.values, training: 90 } }, "security", 409)).toMatchObject({ by: "admin-id" })
  expect(app.storage.state.dashboard).toEqual(committed)
  expect(app.storage.state.dashboard.versions["security:2025-2"]).toEqual({ version: 2, by: "admin-id" })
  expect(app.storage.state.dashboard.audit.map((entry) => entry.record)).toEqual(["security:2025-2", "security:2025-2"])
})

test("incident consequences are one multiselect and round-trip strict empty and enum arrays", async () => {
  const app = flow({})
  const create = action(await read(app, security), "save-incident")
  const consequences = field(create, "consequences")
  expect(String(consequences.kind)).toBe("multiselect")
  expect(consequences.path).toEqual(["consequences"])
  expect(consequences.options?.map((option) => option.value)).toEqual(["Data exfiltration", "Data loss", "Service unavailability"])
  expect(scalars(create.fields).filter((entry) => entry.path[0] === "consequences").map((entry) => entry.path)).toEqual([["consequences"]])
  expect(create.command.values.consequences).toEqual([])
  await post(app, { ...create.command, values: { ...create.command.values, title: "Incident", date: "2025-02-03" } })
  const page = await read(app, security)
  const update = action(page, "save-incident", "fixture-generated-1")
  expect(update.command.version).toBe(1)
  expect(update.command.values.consequences).toEqual([])
  await post(app, { ...update.command, values: { ...update.command.values, consequences: ["Data loss", "Service unavailability"], contained: true } })
  expect(rows(app.storage.state.dashboard.data.secIncidents)).toMatchObject([{ id: "fixture-generated-1", consequences: ["Data loss", "Service unavailability"], contained: true }])
  const saved = action(await read(app, security), "save-incident", "fixture-generated-1")
  expect(saved.command.values.consequences).toEqual(["Data loss", "Service unavailability"])
  expect(app.storage.state.dashboard.audit).toMatchObject([{ record: "secIncidents:fixture-generated-1", became: { consequences: [] } }, { record: "secIncidents:fixture-generated-1", was: { consequences: [] }, became: { consequences: ["Data loss", "Service unavailability"] } }])
  const committed = structuredClone(app.storage.state.dashboard)
  await post(app, { ...saved.command, values: { ...saved.command.values, consequences: ["not an enum"] } }, "admin", 422)
  expect(app.storage.state.dashboard).toEqual(committed)
})

test("campaign department list and management-action checkbox submit their ordinary structured wire", async () => {
  const app = flow({ secPhishing: [{ id: "c1", name: "Campaign", targeted: 20, departments: [{ name: "Finance", users: 10, failed: 0, entered: "", reported: 2 }] }] }, { "secPhishing:c1": { version: 3, by: "prior" } })
  const page = await read(app, security)
  const campaign = action(page, "save-campaign", "c1")
  expect(campaign.command).toMatchObject({ version: 3, values: { name: "Campaign", targeted: 20, departments: [{ name: "Finance", users: 10, failed: 0, entered: "", reported: 2 }] } })
  const departments = campaign.fields.find((entry) => entry.kind === "list" && entry.path[0] === "departments")
  if (!departments || departments.kind !== "list") throw new Error("Missing department list")
  expect(departments).toMatchObject({ path: ["departments"], add: { name: "", users: "", failed: "", entered: "", reported: "" }, remove: true, minimum: 0 })
  expect(scalars(departments.fields).map((entry) => [entry.path[0], entry.kind])).toEqual([["name", "text"], ["users", "number"], ["failed", "number"], ["entered", "number"], ["reported", "number"]])
  const changed = [{ name: "Finance", users: 10, failed: 0, entered: 1, reported: 2 }, { name: "Operations", users: 0, failed: 0, entered: 0, reported: 0 }]
  await post(app, { ...campaign.command, values: { ...campaign.command.values, departments: changed } })
  expect(rows(app.storage.state.dashboard.data.secPhishing)[0]?.departments).toEqual(changed)
  expect(action(await read(app, security), "save-campaign", "c1").command.values.departments).toEqual(changed)
  expect(app.storage.state.dashboard.versions["secPhishing:c1"]).toEqual({ version: 4, by: "admin-id" })
  expect(app.storage.state.dashboard.audit[0]).toMatchObject({ record: "secPhishing:c1", became: { departments: changed } })
  const create = action(page, "save-action")
  expect(field(create, "done").kind).toBe("checkbox")
  expect(create.command.values).toEqual({ text: "", done: false })
  await post(app, { ...create.command, values: { ...create.command.values, text: "Train staff", done: true } })
  const update = action(await read(app, security), "save-action", "fixture-generated-1")
  expect(update.command.values).toEqual({ text: "Train staff", done: true })
  await post(app, { ...update.command, values: { ...update.command.values, done: false } })
  expect(app.storage.state.dashboard.data.secActions).toEqual([{ id: "fixture-generated-1", text: "Train staff", done: false }])
  expect(app.storage.state.dashboard.audit.slice(1)).toMatchObject([{ record: "secActions:fixture-generated-1", became: { done: true } }, { record: "secActions:fixture-generated-1", was: { done: true }, became: { done: false } }])
})

test("security reads are pure and sibling saves preserve keys and distinct long-name labels", async () => {
  const name = "x".repeat(100)
  const app = flow({ secActions: [{ id: "first-id", text: name, done: false }, { id: "second-id", text: name, done: false }], members: [{ notes: "PRIVATE-READ-MARKER" }] }, { "secActions:first-id": { version: 2, by: "prior" } })
  const before = structuredClone(app.storage.state.dashboard)
  const first = await read(app, security)
  const repeat = await read(app, security)
  expect(first.actions).toEqual(repeat.actions)
  expect(app.storage.state.dashboard).toEqual(before)
  expect(JSON.stringify(first)).not.toContain("PRIVATE-READ-MARKER")
  for (const kind of ["save-action", "delete-action"]) {
    const left = action(first, kind, "first-id")
    const right = action(first, kind, "second-id")
    expect(left.key).not.toBe(right.key)
    expect(left.label.en).not.toBe(right.label.en)
    expect(left.label.br).not.toBe(right.label.br)
    expect(left.label.en).toContain("first-id")
    expect(left.label.br).toContain("first-id")
    expect(right.label.en).toContain("second-id")
    expect(right.label.br).toContain("second-id")
  }
  const selected = action(first, "save-action", "first-id")
  await post(app, { ...selected.command, values: { ...selected.command.values, done: true } })
  expect(rows(app.storage.state.dashboard.data.secActions).map((row) => row.id)).toEqual(["second-id", "first-id"])
  const committed = structuredClone(app.storage.state.dashboard)
  const reordered = await read(app, security)
  expect(app.storage.state.dashboard).toEqual(committed)
  for (const id of ["first-id", "second-id"]) {
    for (const kind of ["save-action", "delete-action"]) expect(action(reordered, kind, id).key).toBe(action(first, kind, id).key)
  }
  const create = action(reordered, "save-action")
  await post(app, { ...create.command, values: { ...create.command.values, text: "First generated row" } })
  expect(rows(app.storage.state.dashboard.data.secActions)).toContainEqual({ id: "fixture-generated-1", text: "First generated row", done: false })
})
