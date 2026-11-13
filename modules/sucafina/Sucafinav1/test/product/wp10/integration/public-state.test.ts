import { expect, test } from "bun:test"
import { createApplication } from "../../../../runtime/application.ts"
import { domain, pages, render } from "../../../../runtime/dashboard-portfolio.ts"
import { testPersistence } from "../../../fixture/persistence.ts"

function fixture() {
  const storage = testPersistence()
  storage.state.dashboard.data.__sfProductV1 = { internal: "private-product-receipt" }
  const handler = createApplication("/sucafina", {
    persistence: storage.persistence,
    authenticate: async () => ({ id: "admin", canWrite: true, roles: [{ surface: "dashboard", role: "admin" }] }),
    environment: async () => ({ at: "2026-11-13T04:01:10Z", id: () => "record-1", directory: [{ id: "admin", name: "Admin" }] }),
    domains: { dashboard: [{ domain, pages, render }], planner: [], procurement: [] },
    maxJsonBytes: 100000,
  })
  const post = (data: Record<string, unknown>, version = 0) => handler(new Request("https://example.test/sucafina/dashboard", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://example.test" },
    body: JSON.stringify({ page: "IT Risks", action: "backup-import", version, confirmed: true, values: { data } }),
  }))
  return { ...storage, handler, post }
}

test("real backup download excludes private product state without deleting storage", async () => {
  const app = fixture()
  const response = await app.handler(new Request("https://example.test/sucafina/dashboard?download=json"))
  expect(response?.status).toBe(200)
  expect(await response?.json()).not.toHaveProperty("__sfProductV1")
  expect(app.state.dashboard.data.__sfProductV1).toEqual({ internal: "private-product-receipt" })
})

test("backup import refuses private state and preserves current state on accepted replacement", async () => {
  const app = fixture()
  const before = structuredClone(app.state)
  expect((await app.post({ __sfProductV1: { forged: true } }))?.status).toBe(422)
  expect(app.state).toEqual(before)
  expect((await app.post({ risks: [{ id: "risk-1", name: "Imported" }] }))?.status).toBe(200)
  expect(app.state.dashboard.data.__sfProductV1).toEqual({ internal: "private-product-receipt" })
  expect(app.state.dashboard.audit.at(-1)?.was).not.toHaveProperty("__sfProductV1")
  expect(app.state.dashboard.audit.at(-1)?.became).not.toHaveProperty("__sfProductV1")
  const stale = await app.post({}, 0)
  expect(stale?.status).toBe(409)
  expect(JSON.stringify(await stale?.json())).not.toContain("private-product-receipt")
})

test("legacy audit rendering suppresses internal product state from historical entries", async () => {
  const app = fixture()
  app.state.dashboard.audit.push({ who: "admin", at: "2026-11-13T04:01:10Z", record: "dataset", was: null, became: { __sfProductV1: { secret: "private-product-receipt" }, risks: [] } })
  const response = await app.handler(new Request("https://example.test/sucafina/dashboard?page=IT%20Risks"))
  expect(response?.status).toBe(200)
  expect(await response?.text()).not.toContain("private-product-receipt")
})
