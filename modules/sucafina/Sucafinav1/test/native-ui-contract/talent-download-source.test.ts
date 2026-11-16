import { expect, test } from "bun:test"
import { createApplication } from "../../runtime/application"
import { parseWorkbook } from "../../runtime/workbooks"
import { testPersistence } from "../fixture/persistence"

test("original members download emits its workbook only to a still-authorized admin", async () => {
  const storage = testPersistence()
  storage.state.dashboard.data.members = [{ id: "m1", name: "Alice", status: "Active" }]
  let role: "admin" | "viewer" = "admin"
  let revoke = false
  let calls = 0
  const handler = createApplication("/sucafina", {
    authenticate: async () => {
      calls++
      if (revoke && calls > 1) return null
      return { id: "person", canWrite: role === "admin", roles: [{ surface: "dashboard", role }] }
    },
    persistence: storage.persistence,
    environment: async () => ({ at: "2026-11-11T12:00:00Z", id: () => "id", directory: [] }),
    domains: { dashboard: [], planner: [], procurement: [] },
    maxJsonBytes: 100000,
  })
  const get = () => handler(new Request("https://installation.example/sucafina/dashboard?download=members"))
  const success = await get()
  expect(success?.status).toBe(200)
  expect(success?.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  const parsed = await parseWorkbook(new Uint8Array(await success!.arrayBuffer()))
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) throw new Error("Expected original workbook")
  expect(Object.keys(parsed.sheets)).toEqual(["All Members", "Summary by Leader"])
  expect(JSON.stringify(parsed.sheets["All Members"])).toContain("Alice")
  role = "viewer"
  calls = 0
  expect((await get())?.status).toBe(403)
  role = "admin"
  calls = 0
  revoke = true
  const revoked = await get()
  expect(calls).toBeGreaterThan(1)
  expect(revoked?.status).toBe(403)
  expect(revoked?.headers.get("content-type") ?? "").not.toContain("spreadsheet")
})
