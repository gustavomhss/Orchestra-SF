import { expect, test } from "bun:test"
import { createApplication } from "../../../../runtime/application.ts"
import { domain, pages, render } from "../../../../runtime/dashboard-portfolio.ts"
import { testPersistence } from "../../../fixture/persistence.ts"
import { rows } from "../../../../runtime/contract.ts"
import { nativePublicStateFixture } from "./native-public-state-fixture.ts"

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

test("native risk projection suppresses private historical audit entries without changing storage", async () => {
  const app = await nativePublicStateFixture()
  try {
    const created = await app.post({ page: "IT Risks", action: "save", version: 0,
      values: { name: "Public audit risk", impact: 4, probability: 2, status: "open" } })
    expect(created?.status).toBe(200)
    expect(await created?.json()).toMatchObject({ ok: true })
    await app.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.audit.push({ who: app.principalRef, at: app.at, record: "dataset", was: null,
        became: { __sfProductV1: { secret: "private-product-receipt" }, risks: structuredClone(snapshot.data.risks) } })
      return { commit: true, value: undefined }
    })
    const before = await app.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const historical = before.audit.at(-1)
    expect(historical?.became).toHaveProperty("__sfProductV1.secret", "private-product-receipt")
    const risk = rows(before.data.risks).find((item) => item.name === "Public audit risk")
    expect(risk).toMatchObject({ name: "Public audit risk", impact: 4, probability: 2, status: "open" })
    if (typeof risk?.id !== "string") throw new Error("The original risk command did not persist an identified record")
    const response = await app.read("/sucafina/api/ui/pages/CAP13?year=2026")
    expect(response?.status).toBe(200)
    expect(response?.headers.get("Content-Type")).toContain("application/json")
    const text = await response!.text()
    const result = JSON.parse(text)
    expect(result).toMatchObject({ status: "ok", value: { capabilityId: "CAP13", data: {
      risks: [{ id: risk.id, name: "Public audit risk", impact: 4, probability: 2, status: "open" }],
    } } })
    expect(result.value.versions["risks:" + risk.id]).toBe(before.versions["risks:" + risk.id]?.version)
    expect(result.value.data.risks).toHaveLength(1)
    // The native public projection omits audit entirely; it does not render a
    // sanitized historical entry or revive the retired HTML console.
    expect(result.value.data).not.toHaveProperty("audit")
    expect(text).not.toContain("private-product-receipt")
    expect(text).not.toContain("__sfProductV1")
    const after = await app.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect(after).toEqual(before)
    expect(after.audit.at(-1)).toEqual(historical)
  } finally { await app.close() }
}, 60_000)
