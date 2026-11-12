import { expect, test } from "bun:test"
import { createModule } from "../index.ts"
import { DASHBOARD_PAGES, PLANNER_TABS, PROCUREMENT_NAV } from "../src/nav.ts"
import { empty, testPersistence } from "./fixture/persistence.ts"
import { object } from "../runtime/contract.ts"

function fixture() {
  const state = empty()
  state.data.members = [
    {
      id: "member",
      name: "Person",
      status: "Active",
      cls: "Talent",
      notes: "PRIVATE-MEMBER-NOTES",
    },
  ]
  const storage = testPersistence({ dashboard: state })
  const ids = { next: 0 }
  const handler = createModule("/sucafina", {
    authenticate: async () => ({
      id: "directory-owner",
      canWrite: true,
      roles: [
        { surface: "dashboard", role: "admin" },
        { surface: "planner", role: "admin" },
        { surface: "procurement", role: "admin" },
      ],
    }),
    environment: async () => ({
      at: "2026-11-11T12:00:00Z",
      id: () => `server-${++ids.next}`,
      directory: [{ id: "directory-owner", name: "Owner from directory" }],
    }),
    persistence: storage.persistence,
    maxJsonBytes: 5000000,
  })
  const post = (
    surface: string,
    page: string,
    action: string,
    version: number,
    values: Record<string, unknown>,
    id?: string,
  ) =>
    handler(
      new Request(`https://installation.example/sucafina/${surface}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://installation.example",
        },
        body: JSON.stringify({ page, action, id, version, values }),
      }),
    )
  return { ...storage, handler, post }
}

test("the composed module renders every required page with operating controls and no added sidebar pages", async () => {
  const app = fixture()
  for (const [surface, pages] of [
    ["dashboard", DASHBOARD_PAGES],
    ["planner", PLANNER_TABS],
    ["procurement", PROCUREMENT_NAV],
  ] as const) {
    for (const page of pages) {
      const response = await app.handler(
        new Request(`https://installation.example/sucafina/${surface}?page=${encodeURIComponent(page)}`),
      )
      expect(response?.status, `${surface}: ${page}`).toBe(200)
      const html = await response!.text()
      expect(html).toContain(`data-page="${page.replace(/&/g, "&amp;")}"`)
      const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"))
      expect(main.length).toBeGreaterThan(100)
      expect(main).toMatch(/<form|<table|class="metric"/)
      const nav = html.slice(html.indexOf("<nav aria-label="), html.indexOf("</nav>"))
      expect((nav.match(/data-index=/g) ?? []).length).toBe(pages.length)
    }
  }
})

test("HTTP completes requisition, sourcing, purchase order and issue with business fields and snapshots preserved", async () => {
  const app = fixture()
  expect((await app.post("procurement", "Settings", "reset", 0, {}))?.status).toBe(200)
  const store = object(app.state.procurement.data.store)
  store.suppliers = [
    {
      id: "supplier",
      number: "SUP-00001",
      legalName: "Vendor",
      status: "active",
    },
  ]
  const pr = {
    title: "Equipment",
    type: "product",
    description: "Office equipment",
    estAmount: 100,
    costCenter: "IT",
    needBy: "2026-12-01",
    justification: "Replacement",
    recurring: false,
    expenseType: "CAPEX",
  }
  expect((await app.post("procurement", "Requests", "create", 0, { pr }))?.status).toBe(200)
  const id = "PR-2026-0001"
  expect((await app.post("procurement", "Requests", "submit_pr", 1, {}, id))?.status).toBe(200)
  expect((await app.post("procurement", "Requests", "approve", 2, {}, id))?.status).toBe(200)
  const sourcing = {
    evaluator: "Buyer",
    selectedId: "q1",
    contractStrategy: "new",
    quotes: [10, 15, 20].map((total, index) => ({
      id: `q${index + 1}`,
      supplier: "Vendor",
      supplierId: "supplier",
      currency: "USD",
      total,
      qty: 1,
      unitPrice: total,
      techPass: true,
      scores: [5, 4, 3, 4, 5],
      cscores: [0, 4, 5],
    })),
  }
  expect((await app.post("procurement", "Requests", "save", 3, { sourcing }, id))?.status).toBe(200)
  expect((await app.post("procurement", "Requests", "select_quote", 4, { quoteId: "q1" }, id))?.status).toBe(200)
  const beforeIncompleteRatings = structuredClone(app.state.procurement)
  for (const kind of ["scores", "cscores"] as const) {
    const incomplete = await app.post("procurement", "Requests", "submit_sourcing", 5, {
      sourcing: {
        ...sourcing,
        quotes: sourcing.quotes.map((quote, index) => index === 0
          ? { ...quote, [kind]: kind === "scores" ? [5, 4, 3, 4, null] : [0, 4, null] }
          : quote),
      },
    }, id)
    expect(incomplete?.status).toBe(422)
    expect(await incomplete!.json()).toMatchObject({
      ok: false,
      errors: ["Quote 1: technical / commercial scores incomplete"],
    })
    expect(app.state.procurement).toEqual(beforeIncompleteRatings)
  }
  const submitted = await app.post("procurement", "Requests", "submit_sourcing", 5, {}, id)
  expect(submitted?.status, JSON.stringify(await submitted?.clone().json())).toBe(200)
  expect((await app.post("procurement", "Requests", "approve", 6, {}, id))?.status).toBe(200)
  const po = {
    currency: "USD",
    expenseType: "CAPEX",
    supplier: "Vendor",
    supplierId: "supplier",
    description: "Hardware description",
    paymentTerms: "NET30",
    deliveryDate: "2026-12-01",
    deliveryConditions: "Office delivery",
    billingAddress: "Invoice office",
    deliveryAddress: "Delivery office",
    acceptance: "Inspection",
    warranty: "One year",
    lines: [{ desc: "Device", qty: 1, uom: "each", unitPrice: 10 }],
  }
  expect((await app.post("procurement", "Requests", "save", 7, { po }, id))?.status).toBe(200)
  const poSubmit = await app.post("procurement", "Requests", "submit_po", 8, {}, id)
  expect(poSubmit?.status, JSON.stringify(await poSubmit?.clone().json())).toBe(200)
  expect((await app.post("procurement", "Requests", "approve", 9, {}, id))?.status).toBe(200)
  expect((await app.post("procurement", "Requests", "issue", 10, {}, id))?.status).toBe(200)
  const saved = object(object(object(app.state.procurement.data.store).requests)[id])
  expect(object(saved.request)).toMatchObject({
    status: "po_issued",
    pr,
    po: { ...po, number: "PO-2026-0001" },
  })
  expect(app.state.procurement.versions[`requests:${id}`].version).toBe(11)
  expect(app.state.procurement.audit.every((entry) => entry.name === "Owner from directory")).toBe(true)
  const document = await app.handler(
    new Request(`https://installation.example/sucafina/procurement?download=po&request=${id}`),
  )
  expect(document?.status).toBe(200)
  expect(await document!.text()).toContain("Invoice office")
})

test("parallel HTTP requisitions keep unique retained PR numbers and isolate other surfaces", async () => {
  const app = fixture()
  await app.post("procurement", "Settings", "reset", 0, {})
  const beforePlanner = structuredClone(app.state.planner)
  const beforeDashboard = structuredClone(app.state.dashboard)
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      app.post("procurement", "Requests", "create", 0, {
        pr: {
          title: `Request ${index}`,
          estAmount: 1,
          recurring: false,
          expenseType: "OPEX",
        },
      }),
    ),
  )
  expect(results.every((response) => response?.status === 200)).toBe(true)
  const requests = Object.keys(object(object(app.state.procurement.data.store).requests))
  expect(new Set(requests).size).toBe(12)
  expect(requests).toContain("PR-2026-0012")
  expect(app.state.planner).toEqual(beforePlanner)
  expect(app.state.dashboard).toEqual(beforeDashboard)
})

test("dashboard year selectors keep sidebar, executive, operations and security parameters separate", async () => {
  const app = fixture()
  const executive = await app.handler(
    new Request(
      "https://installation.example/sucafina/dashboard?page=Executive%20Dashboard&year=2024&execYear=2025&executiveMonth=7",
    ),
  )
  expect(executive?.status).toBe(200)
  const html = await executive!.text()
  expect(html).toContain('<input type="hidden" name="year" value="2024">')
  expect(html).toMatch(/name="execYear"[^>]*>[\s\S]*?<option value="2025" selected>/)
  expect(html).toMatch(/name="executiveMonth"[^>]*>[\s\S]*?<option value="7" selected>/)
  expect(html).toMatch(/data-year="sidebar" data-query="year">[\s\S]*?<option value="2024" selected>/)
  for (const [page, yearKey, monthKey] of [
    ["IT Operations", "opsYear", "operationsMonth"],
    ["IT Security KPIs", "secYear", "securityMonth"],
  ]) {
    const response = await app.handler(
      new Request(
        `https://installation.example/sucafina/dashboard?page=${encodeURIComponent(page!)}&year=2024&${yearKey}=2027&${monthKey}=3`,
      ),
    )
    expect(response?.status).toBe(200)
    const content = await response!.text()
    expect(content).toMatch(new RegExp(`data-year="own" data-query="${yearKey}">[\\s\\S]*?<option selected>2027`))
    expect(content).toContain(`data-month="own" data-query="${monthKey}"`)
    expect(content).toMatch(/data-year="sidebar" data-query="year">[\s\S]*?<option value="2024" selected>/)
  }
})
