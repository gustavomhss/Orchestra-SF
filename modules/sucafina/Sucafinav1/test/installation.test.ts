import { expect, test } from "bun:test"
import { createInstallationHandler } from "../installation.ts"
import type { Installation } from "../installation.ts"
import type { ResolvedActor } from "../src/identity.ts"
import { procurementScreen } from "../src/procurement-screen.ts"

const own = {
  number: "PR-2026-0001",
  status: "draft",
  createdBy: "directory-1",
  pr: { title: "Own request" },
}
const other = {
  number: "PR-2026-0002",
  status: "po_issued",
  createdBy: "directory-2",
  pr: { title: "Private request" },
  po: { expenseType: "CAPEX", lines: [{ qty: 1, unitPrice: 91827 }] },
}

function installation(actor: ResolvedActor | null) {
  const loads: string[] = []
  const host: Installation = {
    authenticate: async () => actor,
    dashboard: async () => {
      loads.push("dashboard")
      return {}
    },
    planner: async () => {
      loads.push("planner")
      return {}
    },
    procurement: async () => {
      loads.push("procurement")
      return {
        requests: [own, other],
        request: other,
        rates: { currency: "USD" },
      }
    },
  }
  return {
    handle: createInstallationHandler("/modules/Sucafinav1", host),
    loads,
  }
}

function request(path: string, init?: RequestInit) {
  return new Request(`https://installation.example${path}`, init)
}

test("installation authenticates and keeps each surface role separate before loading data", async () => {
  const missing = installation(null)
  expect((await missing.handle(request("/modules/Sucafinav1/dashboard")))?.status).toBe(401)
  expect(missing.loads).toEqual([])
  const empty = installation({ id: "directory-1", canWrite: false, roles: [] })
  expect((await empty.handle(request("/modules/Sucafinav1/dashboard?roles=admin&actor=admin")))?.status).toBe(403)
  expect(empty.loads).toEqual([])
  const dash = installation({
    id: "directory-1",
    canWrite: true,
    roles: [{ surface: "dashboard", role: "admin" }],
  })
  expect((await dash.handle(request("/modules/Sucafinav1/procurement")))?.status).toBe(403)
  expect(dash.loads).toEqual([])
  const unknown = installation({
    id: "directory-1",
    canWrite: true,
    roles: [{ surface: "procurement", role: "domain leader" }],
  })
  expect((await unknown.handle(request("/modules/Sucafinav1/procurement")))?.status).toBe(403)
  expect(unknown.loads).toEqual([])
  const response = await dash.handle(request("/modules/Sucafinav1/dashboard"))
  expect(response?.status).toBe(200)
  expect(response?.headers.get("cache-control")).toBe("no-store")
  expect(await response?.text()).toContain("CIO Dashboard")
  expect(dash.loads).toEqual(["dashboard"])
})

test("installation composes without claiming other routes, writing or starting a server", async () => {
  const module = installation({
    id: "directory-1",
    canWrite: false,
    roles: [{ surface: "planner", role: "viewer" }],
  })
  expect(await module.handle(request("/api/session"))).toBeUndefined()
  expect(await module.handle(request("/modules/Sucafinav10/planner"))).toBeUndefined()
  expect((await module.handle(request("/modules/Sucafinav1/planner/extra")))?.status).toBe(404)
  const post = await module.handle(
    request("/modules/Sucafinav1/planner", {
      method: "POST",
      body: '{"roles":["admin"]}',
    }),
  )
  expect(post?.status).toBe(405)
  expect(post?.headers.get("allow")).toBe("GET, HEAD")
  expect(module.loads).toEqual([])
  expect((await module.handle(request("/modules/Sucafinav1/planner?year=2026.5")))?.status).toBe(400)
  expect(module.loads).toEqual([])
  const head = await module.handle(request("/modules/Sucafinav1/planner", { method: "HEAD" }))
  expect(head?.status).toBe(200)
  expect(await head?.text()).toBe("")
  const get = await module.handle(request("/modules/Sucafinav1/planner"))
  expect(await get?.text()).toContain("IT Budget Planner")
  expect(module.loads).toEqual(["planner", "planner"])
})

test("requester cannot read another request through aggregates, detail or an unrecognized page", async () => {
  const module = installation({
    id: "directory-1",
    canWrite: true,
    roles: [{ surface: "procurement", role: "requester" }],
  })
  const dashboard = await module.handle(request("/modules/Sucafinav1/procurement"))
  const html = await dashboard!.text()
  expect(html).toContain('data-edits="false">1</p>')
  expect(html).toContain('data-capex="0"')
  expect(html).not.toContain("91827")
  expect(html).not.toContain(other.number)
  expect(html).not.toContain("Private request")
  expect(html).not.toContain('data-slot="request-detail"')
  const list = await module.handle(request("/modules/Sucafinav1/procurement?page=Requests&filter=All"))
  const listed = await list!.text()
  expect(listed).toContain(own.number)
  expect(listed).not.toContain(other.number)
  expect((await module.handle(request("/modules/Sucafinav1/procurement?page=Talent%20Review")))?.status).toBe(403)
  const denied = procurementScreen({
    actor: { id: "directory-1", canWrite: false, roles: [] },
    requests: [own, other],
    request: other,
    supplier: true,
  })
  expect(denied.drawn.aside).toEqual([])
  expect(denied.html).not.toContain(other.number)
  const buyer = procurementScreen({
    actor: { id: "directory-1", canWrite: true, roles: ["buyer"] },
    request: other,
    requests: [own, other],
    rates: { currency: "USD" },
  })
  expect(buyer.html).toContain(other.number)
  expect(buyer.html).toContain('data-capex="91827"')
})
