import { expect, test } from "bun:test"
import { createApplication } from "../runtime/application.ts"
import type { Actor, Domain, Environment, Snapshot, View } from "../runtime/contract.ts"
import { object } from "../runtime/contract.ts"
import { emptyMap, plugGroup, resolve } from "../src/identity.ts"
import { empty, testPersistence } from "./fixture/persistence.ts"

// Literal acceptance descriptors exercise plumbing only, not any domain's write policy.
const actions = [{
  key: "fixture-edit",
  label: { en: "Edit fixture", br: "Editar exemplo" },
  group: { en: "Fixture controls", br: "Controles de exemplo" },
  target: { collection: "fixture", id: "fixture-row" },
  command: {
    page: "Executive Dashboard", action: "fixture-save", id: "fixture-row", version: 7,
    values: { name: "Visible fixture", rows: [{ enabled: false, amount: 0 }] },
  },
  fields: [{
    kind: "group",
    label: { en: "Details", br: "Detalhes" },
    fields: [
      { kind: "text", path: ["name"], label: { en: "Name", br: "Nome" }, required: true, blank: "omit" },
      {
        kind: "list", path: ["rows"], label: { en: "Rows", br: "Linhas" },
        add: { enabled: false, amount: 0 }, remove: true, minimum: 1, maximum: 3,
        fields: [
          { kind: "checkbox", path: ["enabled"], label: { en: "Enabled", br: "Ativo" } },
          { kind: "number", path: ["amount"], label: { en: "Amount", br: "Valor" }, min: 0, max: 100, step: 1 },
          {
            kind: "select", path: ["category"], label: { en: "Category", br: "Categoria" },
            options: [{ value: "sample", label: { en: "Sample", br: "Exemplo" } }],
          },
        ],
      },
    ],
  }],
  confirm: { en: "Save fixture?", br: "Salvar exemplo?" },
  danger: false,
}] as const

type FixtureContext = {
  page: string
  year: number
  month: number
  query: Readonly<Record<string, string>>
  view: View
}

function fixture(options: {
  html?: boolean
  authenticated?: boolean
  producer?: boolean
  directory?: "missing" | "blank"
  auditRead?: boolean
} = {}) {
  const initial = empty()
  initial.data = {
    privateMarker: "PRIVATE-FIXTURE-ONLY",
    roleMap: plugGroup(emptyMap(), "dashboard", "viewer", "fixture-viewers"),
  }
  initial.versions = { "fixture:fixture-row": { version: 7, by: "fixture-editor" } }
  initial.sequences = { fixture: 4 }
  initial.audit = [{ who: "fixture-editor", at: "2026-03-01T00:00:00Z", record: "fixture:fixture-row", was: null, became: { name: "Visible fixture" } }]
  initial.notices = [{ kind: "pending", to: ["fixture-person"], record: "fixture:fixture-row", at: "2026-03-01T00:00:00Z" }]
  const storage = testPersistence({ dashboard: initial })
  const calls = { execute: 0, id: 0, view: 0, render: 0 }
  const received: { snapshot: Snapshot; actor: Actor; environment: Environment; context: FixtureContext }[] = []
  const view: View = {
    data: { fixture: [{ id: "fixture-row", name: "Visible fixture" }] },
    versions: { "fixture:fixture-row": { version: 7, by: "fixture-editor" } },
  }
  const readAudit = { who: "fixture-person", at: "2026-03-15T12:00:00Z", record: "fixture-read", was: null, became: null }
  const environment: Environment = {
    at: "2026-03-15T12:00:00Z",
    id: () => { calls.id++; return "unexpected-fixture-id" },
    directory: options.directory === "missing" ? [] : [{ id: "fixture-person", name: options.directory === "blank" ? " " : "Synthetic Reader" }],
  }
  const base: Domain = {
    execute() { calls.execute++; return { ok: true } },
    view(snapshot) {
      calls.view++
      if (options.auditRead) snapshot.audit.push(structuredClone(readAudit))
      return view
    },
  }
  const domain = options.producer === false ? base : {
    ...base,
    // Structural extra property keeps this acceptance test compilable before Domain.commands exists.
    commands(snapshot: Snapshot, actor: Actor, environment: Environment, context: FixtureContext) {
      received.push({ snapshot: structuredClone(snapshot), actor, environment, context })
      return actions
    },
  }
  const handler = createApplication("/fixture", {
    ...(options.html ? {} : { presentation: "native" as const }),
    persistence: storage.persistence,
    authenticate: async (request, context) => {
      if (options.authenticated === false || !context || request.headers.get("authorization") !== "Bearer fixture-token") return null
      return resolve("fixture-person", context.roleMap.map((row) => ({ ...row })), (group) => group === "fixture-viewers")
    },
    environment: async () => environment,
    domains: {
      dashboard: [{
        pages: ["Executive Dashboard"], domain,
        render() { calls.render++; return "<p>Fixture HTML</p>" },
      }],
      planner: [], procurement: [],
    },
    maxJsonBytes: 100_000,
  })
  return {
    storage, calls, received, view, environment, readAudit,
    read(page = "Executive Dashboard") {
      const query = new URLSearchParams({ page, year: "2024", execYear: "2025", executiveMonth: "8", month: "2", filter: "fixture-filter" })
      query.append("q", "first")
      query.append("q", "last")
      return handler(new Request(`https://native-action.example/fixture/dashboard?${query}`, {
        headers: { authorization: "Bearer fixture-token" },
      }))
    },
  }
}

test("native read passes exact admitted page context and authorized view to structural descriptor producer", async () => {
  const app = fixture()
  const before = structuredClone(app.storage.state)
  const response = await app.read()
  expect(response?.status).toBe(200)
  const body: unknown = await response!.json()
  expect(body).toEqual({
    surface: "dashboard", page: "Executive Dashboard", pages: ["Executive Dashboard"],
    actor: { id: "fixture-person", name: "Synthetic Reader", canWrite: false, roles: ["viewer"], assigned: [], domains: [] },
    year: 2025, month: 8, data: app.view.data, versions: app.view.versions,
    directory: app.environment.directory, actions,
  })
  expect(app.received).toHaveLength(1)
  expect(app.received[0]!.context).toEqual({
    page: "Executive Dashboard", year: 2025, month: 8,
    query: { page: "Executive Dashboard", year: "2024", execYear: "2025", executiveMonth: "8", month: "2", filter: "fixture-filter", q: "last" },
    view: app.view,
  })
  expect(app.received[0]!.context.view).toBe(app.view)
  expect(app.received[0]!.snapshot).toEqual(before.dashboard)
  expect(app.received[0]!.actor).toEqual({ id: "fixture-person", canWrite: false, roles: ["viewer"], assigned: [], domains: [] })
  expect(app.received[0]!.environment).toEqual(app.environment)
  expect(JSON.stringify(body)).not.toContain("PRIVATE-FIXTURE-ONLY")
  expect(app.calls).toEqual({ execute: 0, id: 0, view: 1, render: 0 })
  expect(app.storage.state).toEqual(before)
})

for (const denied of [
  { name: "authentication", options: { authenticated: false }, page: "Executive Dashboard", status: 401, views: 0 },
  { name: "navigation", options: {}, page: "Talent Review", status: 403, views: 0 },
  { name: "missing directory", options: { directory: "missing" }, page: "Executive Dashboard", status: 503, views: 1 },
  { name: "blank directory name", options: { directory: "blank" }, page: "Executive Dashboard", status: 503, views: 1 },
] as const) {
  test(`native ${denied.name} denial never calls descriptor producer`, async () => {
    const app = fixture(denied.options)
    const before = structuredClone(app.storage.state)
    expect((await app.read(denied.page))?.status).toBe(denied.status)
    expect(app.received).toEqual([])
    expect(app.calls).toEqual({ execute: 0, id: 0, view: denied.views, render: 0 })
    expect(app.storage.state).toEqual(before)
  })
}

test("ordinary HTML read renders without calling the descriptor producer", async () => {
  const app = fixture({ html: true })
  const before = structuredClone(app.storage.state)
  const response = await app.read()
  expect(response?.status).toBe(200)
  expect(response!.headers.get("content-type")).toContain("text/html")
  expect(await response!.text()).toContain("<p>Fixture HTML</p>")
  expect(app.received).toEqual([])
  expect(app.calls).toEqual({ execute: 0, id: 0, view: 1, render: 1 })
  expect(app.storage.state).toEqual(before)
})

test("native read without a descriptor producer returns an explicit empty actions array", async () => {
  const app = fixture({ producer: false })
  const before = structuredClone(app.storage.state)
  const response = await app.read()
  expect(response?.status).toBe(200)
  const body: unknown = await response!.json()
  expect(object(body).actions).toEqual([])
  expect(object(body).data).toEqual(app.view.data)
  expect(object(body).versions).toEqual(app.view.versions)
  expect(app.received).toEqual([])
  expect(app.calls).toEqual({ execute: 0, id: 0, view: 1, render: 0 })
  expect(app.storage.state).toEqual(before)
})

test("native descriptors preserve existing audit rows and the domain view read-audit commit", async () => {
  const app = fixture({ auditRead: true })
  const before = structuredClone(app.storage.state)
  const response = await app.read()
  expect(response?.status).toBe(200)
  const body: unknown = await response!.json()
  expect(object(body).actions).toEqual(actions)
  expect(app.received).toHaveLength(1)
  expect(app.received[0]!.snapshot.audit).toEqual([...before.dashboard.audit, app.readAudit])
  expect(app.storage.state).toEqual({
    ...before,
    dashboard: { ...before.dashboard, audit: [...before.dashboard.audit, app.readAudit] },
  })
  expect(app.calls).toEqual({ execute: 0, id: 0, view: 1, render: 0 })
})
