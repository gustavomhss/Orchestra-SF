import { expect, test } from "bun:test"
import type { ModuleServices } from "../../index.ts"
import { roleMap } from "../../runtime/admin.ts"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { createAuthorizedComponentRenderer } from "../product/wp01/component-renderer-fixture.ts"
import { createMicrosoftComponentFixture } from "../product/wp01/microsoft-component-fixture.ts"
import { createRecoveryFixture } from "../product/wp02/workbench-recovery-fixture.ts"

// Integration contracts for the G04 composition. These are not browser-pool
// declarations and do not count toward its fixed 40-source/206-body evidence.
test("component HTTP client verifies the actual fixture CA through the closed proxy", async () => {
  const fixture = await createMicrosoftComponentFixture()
  try {
    const response = await fixture.fetch(fixture.origin + "/sucafina/dashboard?component-session=1", {
      headers: { cookie: fixture.cookie },
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("<h1>Component session ready</h1>")
    expect(() => fixture.fetch("https://foreign.example/sucafina/dashboard")).toThrow("exact installed fixture origin")
    expect(() => fixture.fetch(fixture.origin + "/foreign/dashboard")).toThrow("exact installed fixture origin")
  } finally { await fixture.close() }
}, 15_000)

test("component projection refuses a RoleMap revision change even when roles and record versions stay equal", async () => {
  const fixture = await createMicrosoftComponentFixture()
  let change = false, transactions = 0
  try {
    const capture = () => fixture.persistence.transaction("dashboard", async (snapshot) => ({
      commit: false, value: { actorRoles: roleMap(snapshot, "dashboard").map(({ role, entra }) => ({ role, entra })),
        versions: digestSfValue(snapshot.versions), roleMap: digestSfValue(roleMap(snapshot, "dashboard")) },
    }))
    const persistence: ModuleServices["persistence"] = {
      ...fixture.persistence,
      transaction: async (surface, work, options) => {
        transactions++
        if (change && transactions === 2) {
          await fixture.store.transaction(surface, async (snapshot) => {
            snapshot.data.roleMap = roleMap(snapshot, surface).map((row) => row.role === "admin"
              ? { ...row, version: row.version + 1 } : row)
            return { commit: true, value: undefined }
          })
        }
        return fixture.persistence.transaction(surface, work, options)
      },
    }
    const renderer = createAuthorizedComponentRenderer({
      ...fixture.binding, boundary: fixture.boundary,
      services: { persistence, authenticate: fixture.boundary.identity.authenticate, environment: fixture.environment, maxJsonBytes: 100000 },
    })
    const positive = await renderer(fixture.request("/dashboard?page=Budget+Overview&year=2026"), "dashboard")
    expect(positive.status).toBe(200)
    expect(positive.headers.get("x-sf-access-revision")).toMatch(/^[a-f0-9]{64}$/)
    await positive.text()
    const before = await capture()
    transactions = 0; change = true
    const denied = await renderer(fixture.request("/dashboard?page=Budget+Overview&year=2026"), "dashboard")
    expect(denied.status).toBe(403)
    expect(await denied.text()).toBe("")
    expect(denied.headers.has("x-sf-access-revision")).toBe(false)
    expect(transactions).toBe(2)
    const after = await capture()
    expect(after.actorRoles).toEqual(before.actorRoles)
    expect(after.versions).toBe(before.versions)
    expect(after.roleMap).not.toBe(before.roleMap)
  } finally { await fixture.close() }
}, 15_000)

test("component Hot Topic discovery shares the business clock with durable scoped source projections", async () => {
  const fixture = await createRecoveryFixture()
  try {
    const result = await fixture.read((context) => fixture.dashboard.discover({ page: "Hot Topics & Actions" }, context))
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("Actual scoped discovery failed: " + result.status + " " + result.reason)
    const source = result.value.records.find((entry) => entry.label === "Original action")?.draft
    expect(source).toBeDefined()
    expect(source?.target.period).toEqual({ start: fixture.clock.at.slice(0, 10), end: fixture.clock.at.slice(0, 10) })
    expect(source?.fields.action).toBe("Original action")
    expect(source?.targetEvidence.refDigest).toMatch(/^[a-f0-9]{64}$/)
  } finally { await fixture.close() }
}, 15_000)
