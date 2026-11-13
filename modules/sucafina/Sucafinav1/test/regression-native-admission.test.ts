import { expect, test } from "bun:test"
import { createNativeGateway } from "../../src/native.ts"
import { createApplication, type Contribution } from "../runtime/application.ts"
import type { Actor, Environment, Persistence, Snapshot, TransactionOptions } from "../runtime/contract.ts"
import { emptyMap, plugGroup, resolve } from "../src/identity.ts"
import type { ResolvedActor, RoleRow, Surface } from "../src/identity.ts"
import { DashboardPeople } from "../runtime/dashboard-people.ts"
import { PlannerModule } from "../runtime/planner.ts"
import { ProcurementModule } from "../runtime/procurement.ts"
import { exportPlanner } from "../runtime/workbooks.ts"
import { createModule, type ModuleServices } from "../index.ts"
import { empty, testPersistence } from "./fixture/persistence.ts"

const origin = "http://localhost:4111"
const mount = "/api/sucafina"
const at = "2026-11-13T12:00:00Z"
const bankKey = Uint8Array.from({ length: 32 }, (_, index) => index + 37)
const adminID = "fixture-native-admin"
const hrID = "fixture-native-hr"
const safeDirectory = [
  { id: adminID, name: "Synthetic Native Admin" },
  { id: hrID, name: "Synthetic Native HR" },
  { id: adminID, name: "Synthetic Native Admin Duplicate" },
]

function fixture({ omitAdmin = false, legacyValidDirectory = false } = {}) {
  const providerRows: unknown[] = [
    {
      id: adminID,
      name: "Synthetic Native Admin",
      providerExtra: "DIRECTORY-ADMIN-EXTRA-SENTINEL",
      profile: { marker: "DIRECTORY-ADMIN-NESTED-SENTINEL" },
    },
    {
      id: hrID,
      name: "Synthetic Native HR",
      providerExtra: "DIRECTORY-HR-EXTRA-SENTINEL",
      metadata: { marker: "DIRECTORY-HR-NESTED-SENTINEL" },
    },
    {
      id: adminID,
      name: "Synthetic Native Admin Duplicate",
      providerExtra: "DIRECTORY-DUPLICATE-EXTRA-SENTINEL",
      claims: [{ marker: "DIRECTORY-DUPLICATE-NESTED-SENTINEL" }],
    },
    { id: 731, name: "Synthetic Invalid ID", providerExtra: "DIRECTORY-INVALID-ID-SENTINEL" },
    { id: "fixture-invalid-name", name: 29, providerExtra: "DIRECTORY-INVALID-NAME-SENTINEL" },
  ].filter((row) => {
    const person = row as { id?: unknown; name?: unknown }
    return (
      (!legacyValidDirectory || (typeof person.id === "string" && typeof person.name === "string")) &&
      (!omitAdmin || person.id !== adminID)
    )
  })
  const providerDirectory = providerRows as unknown as Environment["directory"]
  const counters = {
    authentication: 0,
    environment: 0,
    persistence: 0,
    domainViews: 0,
    domainExecutions: 0,
    domainDirectories: [] as Environment["directory"][],
    domainEnvironments: [] as { at: string; id: string; bankKey?: Uint8Array }[],
  }
  const groups = [
    ["dashboard", "admin", "fixture-dashboard-admin"],
    ["planner", "admin", "fixture-planner-admin"],
    ["planner", "hr", "fixture-planner-hr"],
    ["procurement", "admin", "fixture-procurement-admin"],
  ] as const
  const configuredMap = groups.reduce(
    (current, [surface, role, group]) => plugGroup(current, surface, role, group),
    emptyMap(),
  )
  const initial = empty()
  initial.data.roleMap = configuredMap
  const storage = testPersistence({
    dashboard: structuredClone(initial),
    planner: structuredClone(initial),
    procurement: structuredClone(initial),
  })
  const sessions = new Map<string, { id: string; groups: string[]; canWrite?: boolean }>([
    ["session-admin", { id: adminID, groups: ["fixture-dashboard-admin", "fixture-planner-admin", "fixture-procurement-admin"] }],
    ["session-hr", { id: hrID, groups: ["fixture-planner-hr"] }],
    ["session-readonly", { id: adminID, groups: ["fixture-dashboard-admin", "fixture-planner-admin", "fixture-procurement-admin"], canWrite: false }],
  ])
  const persistence: Persistence = {
    transaction<T>(surface: Surface, work: (snapshot: Snapshot) => Promise<{ commit: boolean; value: T }>, options?: TransactionOptions) {
      counters.persistence++
      return storage.persistence.transaction(surface, work, options)
    },
  }
  const services: ModuleServices = {
    async authenticate(request: Request, context?: { surface: Surface; roleMap: readonly RoleRow[] }): Promise<ResolvedActor | null> {
      counters.authentication++
      if (!context) return null
      const token = request.headers.get("authorization")?.replace(/^Bearer /, "")
      const session = token ? sessions.get(token) : undefined
      if (!session) return null
      const actor = resolve(
        session.id,
        context.roleMap.map((row) => ({ ...row })),
        (group) => session.groups.includes(group),
      )
      return session.canWrite === false ? { ...actor, canWrite: false } : actor
    },
    persistence,
    async environment() {
      counters.environment++
      return { at, id: () => "fixture-generated-id", directory: providerDirectory, bankKey }
    },
    maxJsonBytes: 1_000_000,
  }
  const observed = (contribution: Contribution): Contribution => ({
    ...contribution,
    domain: {
      view(snapshot: Snapshot, actor: Actor, environment: Environment) {
        counters.domainViews++
        counters.domainDirectories.push(environment.directory)
        counters.domainEnvironments.push({ at: environment.at, id: environment.id(), bankKey: environment.bankKey })
        return contribution.domain.view(snapshot, actor, environment)
      },
      execute(snapshot, actor, command, environment) {
        counters.domainExecutions++
        counters.domainDirectories.push(environment.directory)
        counters.domainEnvironments.push({ at: environment.at, id: environment.id(), bankKey: environment.bankKey })
        return contribution.domain.execute(snapshot, actor, command, environment)
      },
    },
  })
  const native = createNativeGateway(mount, services)
  const directNative = createApplication(mount, {
    ...services,
    presentation: "native",
    domains: {
      dashboard: [observed(DashboardPeople)],
      planner: [observed(PlannerModule)],
      procurement: [observed(ProcurementModule)],
    },
  })
  const legacy = createModule(mount, services)
  return { counters, directNative, legacy, native, providerDirectory, providerRows, storage }
}

function stateRequest(surface: Surface, page: string, token = "session-admin") {
  return new Request(`${origin}${mount}/${surface}/state?${new URLSearchParams({ page })}`, {
    headers: { authorization: `Bearer ${token}` },
  })
}

function applicationStateRequest(surface: Surface, page: string, token = "session-admin") {
  return new Request(`${origin}${mount}/${surface}?${new URLSearchParams({ page })}`, {
    headers: { authorization: `Bearer ${token}` },
  })
}

function previewRequest(bytes: readonly number[], token: string, path = "/planner/commands") {
  return new Request(`${origin}${mount}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      page: "Overview",
      action: "preview-workbook",
      version: 0,
      values: { kind: "planner", bytes },
    }),
  })
}

async function writerWorkbook() {
  const snapshot = empty()
  snapshot.data.curId = "fixture-writer-version"
  snapshot.data.versions = {
    "fixture-writer-version": {
      id: "fixture-writer-version",
      name: "Synthetic writer version",
      year: 2026,
      locked: false,
      closed: 0,
      lines: [],
      projects: [],
      hc: { inc: 0, incMonth: 1, positions: [], rates: [], hrAF: {} },
      fx: [],
      lists: {},
    },
  }
  const result = await exportPlanner(snapshot, { id: adminID, canWrite: true, roles: ["admin"] }, {
    at,
    id: () => "unused",
    directory: [],
  })
  if (!result.ok) throw new Error("Expected the real planner workbook writer to produce a fixture workbook")
  return Array.from(result.bytes)
}

test("native gateway refuses valid and malformed preview-workbook commands before environment, auth, or persistence", async () => {
  const app = fixture()
  const bytes = await writerWorkbook()
  const before = structuredClone(app.storage.state)

  for (const token of ["session-admin", "session-hr", "session-readonly"]) {
    for (const payload of [bytes, [0, 1, 2]]) {
      const response = await app.native(previewRequest(payload, token))
      expect(response?.status).toBe(404)
      expect(await response?.text()).toBe("Not found")
    }
  }

  expect(app.counters).toMatchObject({ authentication: 0, environment: 0, persistence: 0, domainViews: 0, domainExecutions: 0 })
  expect(app.storage.state).toEqual(before)
})

test("direct native application applies the same preview admission guard without entering a domain", async () => {
  const control = fixture()
  const page = await control.directNative(applicationStateRequest("planner", "Overview"))
  expect(page?.status).toBe(200)
  expect(control.counters.domainViews).toBe(1)

  const app = fixture()
  const bytes = await writerWorkbook()
  const before = structuredClone(app.storage.state)

  for (const [token, payload] of [["session-admin", bytes], ["session-hr", [0, 1, 2]]] as const) {
    const response = await app.directNative(previewRequest(payload, token, "/planner"))
    expect(response?.status).toBe(404)
    expect(await response?.text()).toBe("Not found")
  }

  expect(app.counters).toMatchObject({ authentication: 0, environment: 0, persistence: 0, domainViews: 0, domainExecutions: 0 })
  expect(app.storage.state).toEqual(before)
})

test("legacy presentation keeps real workbook preview for admin and writable HR while read-only remains denied", async () => {
  const app = fixture({ legacyValidDirectory: true })
  expect(app.providerDirectory.every((person) => typeof person.id === "string" && typeof person.name === "string")).toBe(true)
  const bytes = await writerWorkbook()
  const before = structuredClone(app.storage.state)

  const page = await app.legacy(applicationStateRequest("planner", "Overview"))
  expect(page?.status).toBe(200)

  for (const token of ["session-admin", "session-hr"]) {
    const response = await app.legacy(previewRequest(bytes, token, "/planner"))
    expect(response?.status).toBe(200)
    const body = await response?.json() as { ok: boolean; sheets?: Record<string, unknown> }
    expect(body.ok).toBe(true)
    expect(body.sheets).toHaveProperty("OPEX")
    expect(body.sheets).toHaveProperty("Headcount")
  }
  const readonly = await app.legacy(previewRequest(bytes, "session-readonly", "/planner"))
  expect(readonly?.status).toBe(403)
  expect(app.storage.state).toEqual(before)
})

test("native gateway emits only id/name directory rows at every surface PageState occurrence", async () => {
  const app = fixture()
  const before = structuredClone(app.providerRows)
  const expected = safeDirectory

  for (const [surface, page] of [
    ["dashboard", "Headcount Overview"],
    ["planner", "Overview"],
    ["procurement", "Dashboard"],
  ] as const) {
    const response = await app.native(stateRequest(surface, page))
    expect(response?.status).toBe(200)
    const raw = await response?.text() ?? ""
    const body = JSON.parse(raw) as { data: Record<string, unknown>; directory: { id: string; name: string }[] }
    expect(body.directory).toEqual(expected)
    if (surface === "planner" || surface === "procurement") expect(body.data.directory).toEqual(expected)
    expect(raw).not.toContain("DIRECTORY-")
    expect(raw).not.toContain("INVALID ID")
    expect(raw).not.toContain("INVALID-NAME")
    expect(raw).not.toContain(JSON.stringify(bankKey))
    expect(raw).not.toContain(JSON.stringify(Array.from(bankKey)))
  }

  expect(app.providerRows).toEqual(before)
})

test("native directory projection keeps the existing missing-current-operator 503 policy", async () => {
  const app = fixture({ omitAdmin: true })
  const before = structuredClone(app.storage.state)
  const response = await app.native(stateRequest("dashboard", "Headcount Overview"))
  expect(response?.status).toBe(503)
  expect(app.storage.state).toEqual(before)
})

test("direct native domains receive fresh id/name-only directories for all three views and command execution", async () => {
  const app = fixture()
  const before = structuredClone(app.providerRows)

  for (const [surface, page] of [
    ["dashboard", "Headcount Overview"],
    ["planner", "Overview"],
    ["procurement", "Dashboard"],
  ] as const) {
    const response = await app.directNative(applicationStateRequest(surface, page))
    expect(response?.status).toBe(200)
    const raw = await response?.text() ?? ""
    expect(raw).not.toContain(JSON.stringify(bankKey))
    expect(raw).not.toContain(JSON.stringify(Array.from(bankKey)))
  }
  expect(app.counters.domainViews).toBe(3)
  expect(app.counters.domainEnvironments.slice(0, 3)).toEqual(
    Array.from({ length: 3 }, () => ({ at, id: "fixture-generated-id", bankKey })),
  )
  expect(app.counters.domainDirectories).toHaveLength(3)
  for (const [index, directory] of app.counters.domainDirectories.entries()) {
    expect(directory).toEqual(safeDirectory)
    expect(directory).not.toBe(app.providerDirectory)
    expect(directory[0]).not.toBe(app.providerDirectory[0])
    for (const previous of app.counters.domainDirectories.slice(0, index)) expect(directory).not.toBe(previous)
  }

  const command = new Request(`${origin}${mount}/dashboard`, {
    method: "POST",
    headers: {
      authorization: "Bearer session-admin",
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify({ page: "Hot Topics & Actions", action: "invalid-fixture-action", version: 0, values: {} }),
  })
  expect((await app.directNative(command))?.status).toBe(400)
  expect(app.counters.domainExecutions).toBe(1)
  expect(app.counters.domainDirectories).toHaveLength(4)
  expect(app.counters.domainDirectories[3]).toEqual(safeDirectory)
  expect(app.counters.domainDirectories[3]).not.toBe(app.counters.domainDirectories[0])
  expect(app.counters.domainEnvironments[3]).toEqual({ at, id: "fixture-generated-id", bankKey })
  expect(app.providerRows).toEqual(before)
})
