import { expect, test } from "bun:test"
import { createNativeGateway } from "../../src/native.ts"
import type { ModuleServices } from "../index.ts"
import { emptyMap, plugGroup, resolve } from "../src/identity.ts"
import type { RoleRow, Surface } from "../src/identity.ts"
import { dashboardPages } from "../src/nav.ts"
import { roleMap } from "../runtime/admin.ts"
import type { Actor, Command, Snapshot } from "../runtime/contract.ts"
import { domain as people } from "../runtime/dashboard-people.ts"
import { empty, testPersistence } from "./fixture/persistence.ts"

const ORIGIN = "https://installation.example"
const MOUNT = "/api/sucafina"
const AT = "2026-11-11T12:00:00Z"
const ADMIN_ID = "directory-admin"
const LEADER_ID = "directory-leader"
const VIEWER_ID = "directory-viewer"
const DIRECTORY = [
  { id: ADMIN_ID, name: "Ada from directory" },
  { id: LEADER_ID, name: "Lee from directory" },
  { id: VIEWER_ID, name: "Vera from directory" },
]
const TOPIC = {
  id: "topic-1",
  action: "Renew colo",
  owner: "Ada",
  due: "2026-12-01",
  status: "open",
  priority: "high",
  notes: "Bring the order",
  raw: "NOT-IN-VIEW",
}
const MEMBER = {
  id: "member-1",
  name: "Visible Person",
  title: "Engineer",
  type: "Employee",
  status: "Active",
  cls: "Talent",
  outlook: "Promote",
  notes: "PRIVATE-TALENT-NOTE",
  secret: "RAW-MEMBER-FIELD",
}

// PageState from packages/schema/src/sucafina.ts. Decoded here without a second copy of the view rules.
type NativeState = {
  surface: string
  page: string
  pages: string[]
  actor: { id: string; name: string; canWrite: boolean; roles: string[]; assigned: string[]; domains: string[] }
  year: number
  month: number
  data: Record<string, unknown>
  versions: Record<string, { version: number; by: string }>
  directory: { id: string; name: string }[]
}

/** Isolated callback drafts from the existing memory fixture. Not a durability proof. */
function installation() {
  const storage = testPersistence({ dashboard: seeded() })
  const seen: { surface: Surface; roleMap: readonly RoleRow[] }[] = []
  const sessions = new Map<string, { id: string; groups: readonly string[]; canWrite?: false }>([
    ["session-admin", { id: ADMIN_ID, groups: ["SG-Dashboard-Admins"] }],
    ["session-leader", { id: LEADER_ID, groups: ["SG-Dashboard-Leaders"] }],
    ["session-viewer", { id: VIEWER_ID, groups: ["SG-Dashboard-Viewers"] }],
    ["session-readonly", { id: ADMIN_ID, groups: ["SG-Dashboard-Admins"], canWrite: false }],
  ])
  const services = {
    authenticate: async (request: Request, context?: { surface: Surface; roleMap: readonly RoleRow[] }) => {
      if (!context) return null
      seen.push({ surface: context.surface, roleMap: context.roleMap })
      const header = request.headers.get("authorization")
      const session = header?.startsWith("Bearer ") ? sessions.get(header.slice("Bearer ".length)) : undefined
      if (!session) return null
      const resolved = resolve(
        session.id,
        context.roleMap.map((row) => ({ ...row })),
        (group) => session.groups.includes(group),
      )
      return session.canWrite === false ? { ...resolved, canWrite: false } : resolved
    },
    persistence: storage.persistence,
    environment: async () => ({
      at: AT,
      id: () => "generated-id",
      directory: DIRECTORY.map((person) => ({ ...person })),
    }),
    maxJsonBytes: 100000,
  } satisfies ModuleServices
  return { ...storage, seen, handler: createNativeGateway(MOUNT, services) }
}

function seeded(): Snapshot {
  const snapshot = empty()
  snapshot.data.roleMap = plugGroup(
    plugGroup(
      plugGroup(emptyMap(), "dashboard", "admin", "SG-Dashboard-Admins"),
      "dashboard",
      "domain leader",
      "SG-Dashboard-Leaders",
    ),
    "dashboard",
    "viewer",
    "SG-Dashboard-Viewers",
  )
  snapshot.data.access = { [ADMIN_ID]: { assigned: ["people"], domains: ["Infrastructure"] } }
  snapshot.data.hotTopics = [{ ...TOPIC }]
  snapshot.data.members = [{ ...MEMBER }]
  snapshot.data.rawSnapshot = { marker: "RAW-SNAPSHOT" }
  snapshot.versions["hotTopics:topic-1"] = { version: 4, by: "earlier-editor" }
  snapshot.versions["members:member-1"] = { version: 2, by: "earlier-editor" }
  snapshot.versions["raw:secret"] = { version: 9, by: "earlier-editor" }
  return snapshot
}

function actor(id: string, roles: string[], canWrite: boolean, assigned: string[] = [], domains: string[] = []): Actor {
  return { id, canWrite, roles, assigned, domains }
}

function masked(snapshot: Snapshot, person: Actor) {
  return people.view(structuredClone(snapshot), person, {
    at: AT,
    id: () => "view-oracle",
    directory: DIRECTORY.map((entry) => ({ ...entry })),
  })
}

function stateRequest(surface: Surface, page: string, token?: string, year = "2025", month = "3") {
  const headers = new Headers()
  if (token) headers.set("authorization", `Bearer ${token}`)
  return new Request(`${ORIGIN}${MOUNT}/${surface}/state?${new URLSearchParams({ page, year, month })}`, { headers })
}

function commandRequest(body: Command, token?: string, origin = ORIGIN) {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (origin) headers.set("origin", origin)
  if (token) headers.set("authorization", `Bearer ${token}`)
  return new Request(`${ORIGIN}${MOUNT}/dashboard/commands`, { method: "POST", headers, body: JSON.stringify(body) })
}

const save: Command = {
  page: "Hot Topics & Actions",
  action: "save",
  id: "topic-1",
  version: 4,
  values: { action: "Renew colo now", status: "progress", priority: "critical" },
}
const stale: Command = {
  page: "Hot Topics & Actions",
  action: "save",
  id: "topic-1",
  version: 4,
  values: { action: "Stale overwrite", status: "done", priority: "normal" },
}

async function expectDenied(app: ReturnType<typeof installation>, request: Request, status: number, body: string | Record<string, unknown>) {
  const before = structuredClone(app.state)
  const response = await app.handler(request)
  expect(response).toBeInstanceOf(Response)
  expect(response?.status).toBe(status)
  if (typeof body === "string") expect(await response?.text()).toBe(body)
  else expect(await response?.json()).toEqual(body)
  expect(app.state).toEqual(before)
}

function expectNativeShape(body: NativeState) {
  expect(Object.keys(body).sort()).toEqual(["actor", "data", "directory", "month", "page", "pages", "surface", "versions", "year"])
  expect(Object.keys(body.actor).sort()).toEqual(["assigned", "canWrite", "domains", "id", "name", "roles"])
}

async function readState(response: Response | undefined): Promise<NativeState> {
  expect(response).toBeInstanceOf(Response)
  expect(response?.status).toBe(200)
  expect(response?.headers.get("content-type")).toContain("application/json")
  const raw = await response!.text()
  expect(raw).not.toContain("<html")
  expect(raw).not.toContain("<iframe")
  expect(raw).not.toContain("<form")
  expect(raw).not.toContain("data-command")
  const body = JSON.parse(raw) as NativeState
  expectNativeShape(body)
  expect(body.directory).toEqual(DIRECTORY)
  expect(body.year).toBe(2025)
  expect(body.month).toBe(3)
  return body
}

test("authenticated admin reads the Hot Topics record, versions, allowed pages and directory display name as JSON", async () => {
  const app = installation()
  const person = actor(ADMIN_ID, ["admin"], true, ["people"], ["Infrastructure"])
  const view = masked(app.state.dashboard, person)
  const body = await readState(await app.handler(stateRequest("dashboard", "Hot Topics & Actions", "session-admin")))
  expect(app.seen).toEqual([{ surface: "dashboard", roleMap: roleMap(app.state.dashboard, "dashboard") }])
  expect(body.surface).toBe("dashboard")
  expect(body.page).toBe("Hot Topics & Actions")
  expect(body.pages).toEqual(dashboardPages({ roles: ["admin"] }))
  expect(body.actor).toEqual({ ...person, assigned: person.assigned ?? [], domains: person.domains ?? [], name: "Ada from directory" })
  expect(app.state.dashboard.audit).toContainEqual(expect.objectContaining({
    who: person.id, at: AT, record: "members:member-1", was: null,
    became: { read: true, member: "member-1" },
  }))
  expect(body.data).toEqual(view.data)
  expect(body.versions).toEqual(view.versions)
  expect(body.versions["hotTopics:topic-1"]).toEqual({ version: 4, by: "earlier-editor" })
  expect(body.versions["raw:secret"]).toBeUndefined()
  expect(JSON.stringify(body.data)).toContain("Renew colo")
  expect(JSON.stringify(body.data)).toContain("PRIVATE-TALENT-NOTE")
  expect(JSON.stringify(body)).not.toContain("NOT-IN-VIEW")
  expect(JSON.stringify(body)).not.toContain("RAW-SNAPSHOT")
  expect(JSON.stringify(body)).not.toContain("RAW-MEMBER-FIELD")
  expect(app.state.dashboard.data.rawSnapshot).toEqual({ marker: "RAW-SNAPSHOT" })
})

test("unauthenticated state and command requests stay unauthorized and persist nothing", async () => {
  const app = installation()
  await expectDenied(app, stateRequest("dashboard", "Hot Topics & Actions"), 401, "Authentication required")
  await expectDenied(app, stateRequest("planner", "Overview"), 401, "Authentication required")
  await expectDenied(app, stateRequest("procurement", "Dashboard"), 401, "Authentication required")
  await expectDenied(app, commandRequest(save), 401, "Authentication required")
})

test("a viewer cannot open Talent Review or save Hot Topics", async () => {
  const app = installation()
  await expectDenied(
    app,
    stateRequest("dashboard", "Talent Review", "session-viewer"),
    403,
    "Access denied",
  )
  await expectDenied(app, commandRequest(save, "session-viewer"), 403, "Access denied")
  await expectDenied(
    app,
    commandRequest({ ...save, page: "Talent Review", values: { name: "Changed" } }, "session-viewer"),
    403,
    "Access denied",
  )
})

test("a domain leader's permitted Headcount page keeps the talent mask and leaves the raw record stored", async () => {
  const app = installation()
  const person = actor(LEADER_ID, ["domain leader"], true)
  const view = masked(app.state.dashboard, person)
  const stored = structuredClone(app.state.dashboard.data.members)
  const body = await readState(await app.handler(stateRequest("dashboard", "Headcount Overview", "session-leader")))
  expect(body.surface).toBe("dashboard")
  expect(body.page).toBe("Headcount Overview")
  expect(body.pages).toEqual(dashboardPages({ roles: ["domain leader"] }))
  expect(body.actor).toEqual({ ...person, assigned: person.assigned ?? [], domains: person.domains ?? [], name: "Lee from directory" })
  expect(app.state.dashboard.audit).toContainEqual(expect.objectContaining({
    who: person.id, at: AT, record: "members:member-1", was: null,
    became: { read: true, member: "member-1" },
  }))
  expect(body.data).toEqual(view.data)
  expect(body.versions).toEqual(view.versions)
  expect(JSON.stringify(body.data)).not.toContain("PRIVATE-TALENT-NOTE")
  expect(JSON.stringify(body.data)).not.toContain("Promote")
  expect(JSON.stringify(body.data)).not.toContain("RAW-MEMBER-FIELD")
  expect(JSON.stringify(body)).not.toContain("RAW-SNAPSHOT")
  expect(app.state.dashboard.data.members).toEqual(stored)
  expect(app.seen[0]?.roleMap).toContainEqual(
    expect.objectContaining({ surface: "dashboard", role: "domain leader", entra: "SG-Dashboard-Leaders", version: 0, by: "" }),
  )
})

test("a Hot Topics save commits and the same version then conflicts without changing data, versions or audit", async () => {
  const app = installation()
  const other = structuredClone({ planner: app.state.planner, procurement: app.state.procurement })
  const created = await app.handler(commandRequest(save, "session-admin"))
  expect(created?.status).toBe(200)
  expect(created?.headers.get("content-type")).toContain("application/json")
  expect(await created?.json()).toEqual({ ok: true })
  expect(app.seen[0]).toEqual({ surface: "dashboard", roleMap: roleMap(app.state.dashboard, "dashboard") })
  expect(app.state.dashboard.data.hotTopics).toContainEqual(
    expect.objectContaining({ id: "topic-1", action: "Renew colo now", status: "progress", priority: "critical", owner: "Ada" }),
  )
  expect(app.state.dashboard.versions["hotTopics:topic-1"]).toEqual({ version: 5, by: ADMIN_ID })
  expect(app.state.dashboard.audit).toContainEqual(
    expect.objectContaining({
      who: ADMIN_ID,
      name: "Ada from directory",
      at: AT,
      record: "hotTopics:topic-1",
      became: expect.objectContaining({ action: "Renew colo now" }),
    }),
  )
  expect({ planner: app.state.planner, procurement: app.state.procurement }).toEqual(other)
  const person = actor(ADMIN_ID, ["admin"], true, ["people"], ["Infrastructure"])
  const view = masked(app.state.dashboard, person)
  const body = await readState(await app.handler(stateRequest("dashboard", "Hot Topics & Actions", "session-admin")))
  expect(body.data).toEqual(view.data)
  expect(body.versions["hotTopics:topic-1"]).toEqual({ version: 5, by: ADMIN_ID })
  expect(JSON.stringify(body)).not.toContain("NOT-IN-VIEW")
  const topics = app.state.dashboard.data.hotTopics
  expect(Array.isArray(topics)).toBe(true)
  await expectDenied(app, commandRequest(stale, "session-admin"), 409, {
    ok: false,
    status: 409,
    stored: (topics as Record<string, unknown>[])[0],
    by: ADMIN_ID,
  })
})

test("a supplied canWrite false and a cross-site origin refuse the write and persist nothing", async () => {
  const app = installation()
  await expectDenied(app, commandRequest(save, "session-readonly"), 403, { ok: false, status: 403 })
  await expectDenied(app, commandRequest(save, "session-admin", "https://attacker.example"), 403, "Access denied")
})

test("routes outside the mount are ignored and unknown surfaces, routes and verbs are rejected", async () => {
  const app = installation()
  const before = structuredClone(app.state)
  expect(await app.handler(new Request(`${ORIGIN}/api/session`))).toBeUndefined()
  expect(await app.handler(new Request(`${ORIGIN}/api/sucafina-extra`, { method: "POST", body: "{}" }))).toBeUndefined()
  const notFound = [
    new Request(`${ORIGIN}${MOUNT}`),
    new Request(`${ORIGIN}${MOUNT}/billing/state`),
    new Request(`${ORIGIN}${MOUNT}/billing/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: "{}",
    }),
    new Request(`${ORIGIN}${MOUNT}/dashboard/preview`),
  ]
  for (const request of notFound) {
    const response = await app.handler(request)
    expect(response?.status).toBe(404)
    expect(await response?.text()).toBe("Not found")
  }
  const rejected = [
    new Request(stateRequest("dashboard", "Hot Topics & Actions").url, { method: "PUT" }),
    new Request(stateRequest("dashboard", "Hot Topics & Actions").url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: "{}",
    }),
    new Request(`${ORIGIN}${MOUNT}/dashboard/commands`),
    new Request(`${ORIGIN}${MOUNT}/dashboard/commands`, { method: "DELETE" }),
  ]
  for (const request of rejected) {
    const response = await app.handler(request)
    expect(response?.status).toBe(405)
    expect(await response?.text()).toBe("Method not allowed")
  }
  expect(app.state).toEqual(before)
  expect(app.seen).toEqual([])
})
