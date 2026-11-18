import { expect, test } from "bun:test"
import { createNativeGateway } from "../../src/native.ts"
import type { ModuleServices } from "../index.ts"
import { emptyMap, plugGroup, resolve } from "../src/identity.ts"
import type { Command } from "../runtime/contract.ts"
import { empty, testPersistence } from "./fixture/persistence.ts"

const ORIGIN = "https://conflict.example"
const MOUNT = "/api/sucafina"
const AT = "2026-11-13T12:00:00Z"
const markers = ["PRIVATE-CONTRACT-MARKER", "contracts/c1/d1", "PRIVATE-DOC-MARKER", "PRIVATE-PROJECT-MARKER", "PRIVATE-MILESTONE-MARKER", "PRIVATE-RISK-MARKER", "PRIVATE-STAKEHOLDER-MARKER"]

function fixture() {
  const snapshot = empty()
  snapshot.data.roleMap = plugGroup(
    plugGroup(emptyMap(), "dashboard", "admin", "conflict-admins"),
    "dashboard", "contributor", "conflict-contributors",
  )
  snapshot.data.access = {
    contributor: { assigned: ["contracts", "risks"] },
    unassigned: { assigned: ["projects"] },
  }
  snapshot.data.contracts = [{
    id: "c1", vendor: "Example vendor", amount: 100, custom: markers[0],
    docs: [{ id: "d1", name: "terms.txt", key: markers[1], type: "text/plain", bytes: 12, size: 12, hidden: markers[2] }],
  }]
  snapshot.data.assets = [{ id: "d1", record: "c1", kind: "contract", key: markers[1], name: "terms.txt", type: "text/plain", bytes: 12 }]
  snapshot.data.risks = [{ id: "r1", name: "Risk", status: "open", impact: 2, probability: 2, custom: markers[5] }]
  snapshot.data.stakeholders = [{ id: "s1", name: "Stakeholder", custom: markers[6] }]
  snapshot.data.projects = [
    { id: "p1", name: "First", status: "Planning", risk: "Low", milestones: [] },
    { id: "p2", name: "Second", status: "Planning", risk: "Low", custom: markers[3],
      milestones: [{ id: "m1", name: "Launch", status: "upcoming", privateField: markers[4] }] },
  ]
  snapshot.versions["contracts:c1"] = { version: 4, by: "earlier-editor" }
  snapshot.versions["risks:r1"] = { version: 4, by: "earlier-editor" }
  snapshot.versions["stakeholders:s1"] = { version: 4, by: "earlier-editor" }
  snapshot.versions["projects:p2"] = { version: 4, by: "earlier-editor" }
  const storage = testPersistence({ dashboard: snapshot })
  const services: ModuleServices = {
    authenticate: async (request, context) => {
      if (!context) return null
      const token = request.headers.get("authorization")?.replace(/^Bearer /, "")
      if (!token || !["admin", "contributor", "unassigned"].includes(token)) return null
      const group = token === "admin" ? "conflict-admins" : "conflict-contributors"
      return resolve(token, context.roleMap.map((row) => ({ ...row })), (value) => value === group)
    },
    environment: async () => ({
      at: AT, id: () => "new-record", directory: [
        { id: "admin", name: "Admin" },
        { id: "contributor", name: "Contributor" },
        { id: "unassigned", name: "Unassigned" },
      ],
    }),
    persistence: storage.persistence,
    maxJsonBytes: 100_000,
  }
  return { ...storage, handle: createNativeGateway(MOUNT, services) }
}

async function publicRow(app: ReturnType<typeof fixture>, token: string, page: string, collection: string, id: string) {
  const query = new URLSearchParams({ page, year: "2026", month: "6" })
  const response = await app.handle(new Request(`${ORIGIN}${MOUNT}/dashboard/state?${query}`, {
    headers: { authorization: `Bearer ${token}` },
  }))
  expect(response?.status).toBe(200)
  const state = await response!.json() as { data: Record<string, unknown>; versions: Record<string, { version: number; by: string }> }
  const records = state.data[collection] as { id: string }[]
  const record = records.find((row) => row.id === id)
  expect(record).toBeDefined()
  expect(state.versions[`${collection}:${id}`]).toEqual({ version: 4, by: "earlier-editor" })
  return record
}

async function command(app: ReturnType<typeof fixture>, token: string, value: Command) {
  return app.handle(new Request(`${ORIGIN}${MOUNT}/dashboard/commands`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify(value),
  }))
}

async function projectedConflict(app: ReturnType<typeof fixture>, token: string, value: Command, collection: string, id: string) {
  const record = await publicRow(app, token, value.page, collection, id)
  for (const marker of markers) expect(JSON.stringify(record)).not.toContain(marker)
  const before = structuredClone(app.state)
  const response = await command(app, token, value)
  expect(response?.status).toBe(409)
  const body = await response!.json() as { ok: boolean; status: number; by: string; stored: unknown }
  expect(body).toEqual({ ok: false, status: 409, by: "earlier-editor", stored: record })
  for (const marker of markers) expect(JSON.stringify(body)).not.toContain(marker)
  expect(app.state).toEqual(before)
}

for (const token of ["admin", "contributor"]) {
  for (const action of ["save", "delete"]) {
    test(`${token} stale contract ${action} returns the GET projection without document keys or unknown fields`, async () => {
      const app = fixture()
      await projectedConflict(app, token, {
        page: "Vendor Contracts", action, id: "c1", version: 3, values: { vendor: "Changed" },
      }, "contracts", "c1")
    })
  }
}

test("unassigned contributor cannot use a stale contract to disclose stored data", async () => {
  const app = fixture()
  const before = structuredClone(app.state)
  const response = await command(app, "unassigned", {
    page: "Vendor Contracts", action: "save", id: "c1", version: 3, values: { vendor: "Changed" },
  })
  expect(response?.status).toBe(403)
  const body = await response!.text()
  for (const marker of markers) expect(body).not.toContain(marker)
  expect(body).not.toContain("stored")
  expect(app.state).toEqual(before)
})

for (const action of ["save", "delete"]) {
  test(`assigned contributor stale risk ${action} returns the GET projection`, async () => {
    const app = fixture()
    await projectedConflict(app, "contributor", {
      page: "IT Risks", action, id: "r1", version: 3, values: { name: "Changed" },
    }, "risks", "r1")
  })
  test(`admin stale stakeholder ${action} returns the GET projection`, async () => {
    const app = fixture()
    await projectedConflict(app, "admin", {
      page: "Stakeholder Management", action, id: "s1", version: 3, values: { name: "Changed" },
    }, "stakeholders", "s1")
  })
}

for (const action of ["save", "delete", "save-milestone", "delete-milestone"]) {
  test(`stale project ${action} returns the parent GET projection without private milestone metadata`, async () => {
    const app = fixture()
    await projectedConflict(app, "admin", {
      page: "All Projects", action, id: "p2", version: 3,
      values: { name: "Changed", milestoneId: "m1", status: "upcoming" },
    }, "projects", "p2")
  })
}

test("stale project import returns the GET projection and leaves the entire batch unchanged", async () => {
  const app = fixture()
  await projectedConflict(app, "admin", {
    page: "All Projects", action: "import", version: 0,
    values: { mode: "update", rows: [{ name: "First" }, { name: "Second" }], versions: { "projects:p1": 0, "projects:p2": 3 } },
  }, "projects", "p2")
})

test("current contract version saves and a repeated stale write preserves the committed state", async () => {
  const app = fixture()
  const save = { page: "Vendor Contracts", action: "save", id: "c1", version: 4, values: { vendor: "Updated vendor" } }
  const response = await command(app, "contributor", save)
  expect(response?.status).toBe(200)
  expect(await response!.json()).toEqual({ ok: true })
  expect(app.state.dashboard.versions["contracts:c1"]).toEqual({ version: 5, by: "contributor" })
  expect(app.state.dashboard.audit).toHaveLength(1)
  expect(app.state.dashboard.audit[0]).toMatchObject({ who: "contributor", record: "contracts:c1" })
  const before = structuredClone(app.state)
  const projected = await app.handle(new Request(`${ORIGIN}${MOUNT}/dashboard/state?page=Vendor%20Contracts&year=2026&month=6`, {
    headers: { authorization: "Bearer contributor" },
  }))
  expect(projected?.status).toBe(200)
  const state = await projected!.json() as { data: { contracts: unknown[] } }
  const stale = await command(app, "contributor", save)
  expect(stale?.status).toBe(409)
  expect(await stale!.json()).toEqual({ ok: false, status: 409, by: "contributor", stored: state.data.contracts[0] })
  expect(app.state).toEqual(before)
})

test("a stale new-record request has no fabricated stored record", async () => {
  const app = fixture()
  const before = structuredClone(app.state)
  const response = await command(app, "admin", {
    page: "Vendor Contracts", action: "save", version: 1, values: { vendor: "New vendor" },
  })
  expect(response?.status).toBe(409)
  const body = await response!.json() as Record<string, unknown>
  expect(body).toEqual({ ok: false, status: 409 })
  expect(app.state).toEqual(before)
})
