import { expect, test } from "bun:test"
import type { RequestView } from "../src/procurement-screen.ts"
import {
  executiveScreen,
  dashboardPages,
  dashboardWrite,
  excelFile,
  importDataset,
  openDashboard,
  openPlanner,
  openProcurement,
  reportSlide,
  setYear,
  showPage,
  sidebarYear,
  talentScreen,
  yearFor,
  DASHBOARD_PAGES,
  DASHBOARD_START,
  FOOTER,
  PLANNER_DEFAULT,
  PLANNER_TABS,
  PROCUREMENT_NAV,
} from "../src/surfaces.ts"
import {
  editHistory,
  exportRegister,
  historyView,
  myApprovals,
  procurementDashboard,
  procurementDashboardWrite,
  requestDetail,
  requestList,
  requestValue,
  supplierDetail,
} from "../src/procurement-screen.ts"

const AT = "2026-11-10T12:00:00Z"

function actor(id: string, roles: string[], canWrite = true, assigned?: string[]) {
  return { id, canWrite, roles, assigned }
}

test("S1-dash sixteen screens stay in order, the footer is not a page, and a viewer does not see the other fifteen", () => {
  expect(DASHBOARD_PAGES).toEqual([
    "Executive Dashboard",
    "Hot Topics & Actions",
    "Budget Overview",
    "OPEX Detail",
    "CAPEX Projects",
    "Headcount Overview",
    "Team Structure",
    "Talent Review",
    "Portfolio Dashboard",
    "All Projects",
    "IT Operations",
    "IT Security KPIs",
    "IT Risks",
    "Vendor Contracts",
    "Stakeholder Management",
    "IT Performance Contract",
  ])
  expect(DASHBOARD_PAGES).toHaveLength(16)
  expect(DASHBOARD_START).toBe("Executive Dashboard")
  expect(showPage("Executive Dashboard")).toEqual({
    drawn: true,
    surface: "dashboard",
    index: 0,
  })
  expect(showPage("IT Performance Contract")).toEqual({
    drawn: true,
    surface: "dashboard",
    index: 15,
  })
  expect(FOOTER).toEqual(["Generate Report", "Export JSON", "Import JSON"])
  for (const key of FOOTER) {
    expect(showPage(key)).toEqual({ drawn: false })
    expect(DASHBOARD_PAGES).not.toContain(key)
  }
  expect(showPage("renderOverview")).toEqual({ drawn: false })
  expect(showPage("#page-overview")).toEqual({ drawn: false })
  expect(showPage("slaEntries")).toEqual({ drawn: false })
  expect(showPage("Hardware")).toEqual({ drawn: false })
  expect(dashboardPages(actor("vie", ["viewer"]))).toEqual(["Executive Dashboard"])
  expect(openDashboard("Hot Topics & Actions", actor("vie", ["viewer"]))).toEqual({ drawn: false })
  expect(openDashboard("Executive Dashboard", actor("bea", ["buyer"]))).toEqual({ drawn: false })
  expect(dashboardPages(actor("cio", ["admin"]))).toHaveLength(16)
  expect(dashboardPages(actor("lead", ["domain leader"]))).toHaveLength(16)
  const contributor = dashboardPages(actor("con", ["contributor"]))
  expect(contributor).toEqual([
    "Portfolio Dashboard",
    "All Projects",
    "IT Operations",
    "IT Security KPIs",
    "IT Risks",
    "Vendor Contracts",
  ])
  expect(contributor).not.toContain("CAPEX Projects")
  expect(contributor).not.toContain("Executive Dashboard")
  expect(dashboardWrite("IT Risks", actor("con", ["contributor"], true, []))).toBe(false)
  expect(dashboardWrite("IT Risks", actor("con", ["contributor"], true, ["IT Risks"]))).toBe(false)
  expect(dashboardWrite("IT Risks", actor("con", ["contributor"], true, ["risks"]))).toBe(true)
  expect(dashboardWrite("IT Operations", actor("con", ["contributor"], true, ["risks"]))).toBe(false)
  expect(dashboardWrite("Budget Overview", actor("lead", ["domain leader"]))).toBe(false)
  expect(dashboardWrite("OPEX Detail", actor("lead", ["domain leader"]))).toBe(false)
  expect(dashboardWrite("Hot Topics & Actions", actor("lead", ["domain leader"]))).toBe(true)
  expect(dashboardWrite("Talent Review", actor("lead", ["domain leader"]))).toBe(false)
  expect(dashboardWrite("Budget Overview", actor("vie", ["viewer"], true))).toBe(false)
  expect(sidebarYear()).toBe(2026)
  expect(sidebarYear(2025)).toBe(2025)
  expect(sidebarYear()).toBe(2026)
  expect(sidebarYear(2023)).toBe(2026)
  expect(yearFor("Executive Dashboard", 2026, undefined)).toBeUndefined()
  expect(yearFor("IT Operations", 2026, 2024)).toBe(2024)
  expect(yearFor("IT Security KPIs", 2026, 2027)).toBe(2027)
  expect(yearFor("Budget Overview", 2025, 2024)).toBe(2025)
  expect(setYear("Executive Dashboard", 2025, 2026)).toEqual({
    page: "Executive Dashboard",
    year: 2025,
    sidebar: 2026,
  })
  expect(setYear("Budget Overview", 2025, 2026)).toEqual({
    page: "Budget Overview",
    year: 2025,
    sidebar: 2025,
  })
  expect(setYear("Overview", 2025, 2026)).toEqual({ ok: false })
  expect(sidebarYear()).toBe(2026)
  const screen = executiveScreen(
    {
      opexOwners: [{ id: "a", budget: 1200 }],
      opexEntries: [
        {
          year: 2026,
          month: 1,
          ownerId: "a",
          budget: 500,
          actual: 10,
          forecast: 20,
        },
      ],
    },
    2026,
  )
  expect(screen.label).toBe("12 months")
  expect(screen.totals.opexActual).toBe(10)
  expect(screen.totals.totalBudget).toBe(1600)
  expect(screen.totals.totalBudget).not.toBe(1200)
  expect(screen.chart).toEqual(Array.from({ length: 12 }, () => 1600 / 12))
  const audit: { who: string; at: string; member: string }[] = []
  const talent = talentScreen(
    [
      {
        id: "m1",
        cls: "Talent",
        outlook: "Promote",
        notes: "private",
        name: "Ada",
      },
    ],
    actor("lead", ["domain leader"]),
    AT,
    audit,
  )
  if (!talent.drawn) throw new Error("domain leader does not open Talent Review")
  expect(talent.members[0].cls).toBeUndefined()
  expect(talent.members[0].outlook).toBeUndefined()
  expect(talent.members[0].notes).toBeUndefined()
  expect(audit[0]).toEqual({ who: "lead", at: AT, member: "m1" })
  expect(importDataset(actor("vie", ["viewer"]), { a: 9 }, true)).toEqual({
    ok: false,
  })
  expect(importDataset(actor("cio", ["admin"]), { a: 9 }, false)).toEqual({
    ok: false,
  })
  expect(importDataset(actor("cio", ["admin"]), { a: 9 }, true)).toEqual({
    ok: true,
    data: { a: 9 },
  })
  expect(showPage("Generate Report")).toEqual({ drawn: false })
  expect(reportSlide([1, 2, 3, 4, 5, 6, 7], [])).toEqual({ ok: false })
  expect(
    reportSlide(
      [1, 2, 3, 4, 5, 6],
      Array.from({ length: 13 }, () => 1),
    ),
  ).toEqual({ ok: false })
  expect(reportSlide([1], [1])).toEqual({
    ok: true,
    metrics: [1],
    rows: [1],
    word: false,
  })
})

test("S1-plan seven tabs stay in order, Overview is the default, and Excel is not a tab", () => {
  expect(PLANNER_TABS).toEqual([
    "Overview",
    "OPEX",
    "CAPEX",
    "Headcount",
    "Entities & allocations",
    "FX rates",
    "Versions",
  ])
  expect(PLANNER_TABS).toHaveLength(7)
  expect(PLANNER_DEFAULT).toBe("Overview")
  expect(showPage("Overview")).toEqual({
    drawn: true,
    surface: "planner",
    index: 0,
  })
  expect(showPage("Versions")).toEqual({
    drawn: true,
    surface: "planner",
    index: 6,
  })
  expect(PLANNER_TABS).not.toContain("Excel")
  expect(showPage("Excel")).toEqual({ drawn: false })
  expect(excelFile()).toEqual({ file: true, tab: false })
  expect(openPlanner("Overview", actor("fin", ["finance"]))).toEqual({
    drawn: true,
    key: "Overview",
    index: 0,
  })
  expect(openPlanner("Overview", actor("bea", ["buyer"]))).toEqual({
    drawn: false,
  })
  expect(openPlanner("Excel", actor("cio", ["admin"]))).toEqual({
    drawn: false,
  })
})

test("S1-proc five entries stay in order, detail is not a sixth page, and the screens do not decide", () => {
  expect(PROCUREMENT_NAV).toEqual(["Dashboard", "Requests", "My approvals", "Suppliers", "Settings"])
  expect(PROCUREMENT_NAV).toHaveLength(5)
  expect(showPage("Dashboard")).toEqual({
    drawn: true,
    surface: "procurement",
    index: 0,
  })
  expect(showPage("Settings")).toEqual({
    drawn: true,
    surface: "procurement",
    index: 4,
  })
  expect(showPage("Requisition")).toEqual({ drawn: false })
  expect(showPage("Request detail")).toEqual({ drawn: false })
  expect(showPage("Supplier detail")).toEqual({ drawn: false })
  expect(openProcurement("Dashboard", actor("bea", ["buyer"]))).toEqual({
    drawn: true,
    key: "Dashboard",
    index: 0,
  })
  expect(openProcurement("Dashboard", actor("lead", ["domain leader"]))).toEqual({ drawn: false })
  expect(openProcurement("Dashboard", actor("fin", ["finance"]))).toEqual({
    drawn: false,
  })

  const rates = { currency: "USD", fxRates: [{ code: "EUR", rate: 1.08 }] }
  const requests = [
    draft("a", "draft", undefined, undefined, { estAmount: 7 }),
    draft("b", "po_issued", {
      expenseType: "OPEX",
      lines: [{ qty: 2, unitPrice: 15 }],
    }),
    draft("c", "po_approved", {
      expenseType: "opex",
      lines: [{ qty: 1, unitPrice: 99 }],
    }),
    draft("d", "cancelled"),
    draft(
      "e",
      "po_issued",
      { expenseType: "CAPEX" },
      { quotes: [{ id: "q1", total: 10, currency: "EUR" }], selectedId: "q1" },
    ),
  ]
  const board = procurementDashboard(requests, rates)
  expect(board.edits).toBe(false)
  expect(board.open).toBe(2)
  expect(board.issued.OPEX).toBe(30)
  expect(board.issued.CAPEX).toBe(10.8)
  expect(board.issued.OPEX).not.toBe(129)
  expect(procurementDashboardWrite()).toEqual({ ok: false })
  expect(requests[0].status).toBe("draft")

  const listed = [
    {
      ...draft("mine", "draft"),
      pr: { title: "EDR", description: "kit", costCenter: "IT" },
      requesterName: "Ada",
    },
    {
      ...draft("theirs", "pr_pending"),
      createdBy: "bea",
      pr: { title: "Other" },
    },
    draft("closed", "po_issued"),
  ]
  expect(requestList(listed, actor("ada", ["requester"])).map((item) => item.number)).toEqual(["mine"])
  expect(requestList(listed, actor("bea", ["buyer"]), "Awaiting approval").map((item) => item.number)).toEqual([
    "theirs",
  ])
  expect(requestList(listed, actor("bea", ["buyer"]), "Closed").map((item) => item.number)).toEqual(["closed"])
  expect(requestList(listed, actor("bea", ["buyer"]), "Open", "edr")).toEqual([])
  expect(requestList(listed, actor("bea", ["buyer"]), "Open", "EDR").map((item) => item.number)).toEqual(["mine"])
  expect(requestList(listed, actor("ada", ["requester"]), "Open", "ada")).toEqual([])

  const exported = exportRegister([
    {
      ...draft("a", "draft"),
      sourcing: { quotes: [{ id: "q", scores: [5], cscores: [1] }] },
      po: { iban: "GB00", supplier: "Acme" },
    },
  ])
  expect(JSON.stringify(exported)).not.toContain("scores")
  expect(JSON.stringify(exported)).not.toContain("GB00")
  expect(JSON.stringify(exported)).toContain("Acme")

  const pending = draft("p", "pr_pending")
  pending.prApproval = {
    amount: 10,
    steps: [{ holderId: "zoe", status: "pending" }],
  }
  pending.po = { lines: [{ qty: 9, unitPrice: 11 }] }
  const mine = myApprovals([pending], "zoe")
  expect(mine.waitingForYou).toEqual([{ number: "p", amount: 10 }])
  expect(mine.waitingForYou[0].amount).not.toBe(99)
  expect(myApprovals([pending], "ada").waitingForYou).toEqual([])
  expect(myApprovals([pending], "ada").waitingForOthers).toEqual([{ number: "p", amount: 10 }])

  const history = [
    { at: "1", by: "ada", action: "created", note: "" },
    { at: "2", by: "bea", action: "submitted", note: "" },
  ]
  expect(historyView(history).map((line) => line.at)).toEqual(["2", "1"])
  expect(editHistory()).toEqual({ ok: false })
  expect(history.map((line) => line.at)).toEqual(["1", "2"])

  expect(requestDetail(draft("a", "draft")).sourcingEnabled).toBe(false)
  expect(requestDetail(draft("a", "pr_pending")).sourcingEnabled).toBe(false)
  expect(requestDetail({ ...draft("a", "draft"), sourcing: { quotes: [] } }).sourcingEnabled).toBe(true)
  expect(requestDetail(draft("a", "sourcing")).sourcingEnabled).toBe(true)
  expect(requestDetail(draft("a", "po_draft")).poEnabled).toBe(false)
  expect(requestDetail({ ...draft("a", "po_draft"), po: { number: "PO-2026-0001" } }).poEnabled).toBe(true)
  expect(requestDetail(draft("a", "draft")).page).toBe(false)
  expect(requestDetail(draft("a", "draft")).tabs).toEqual(["Requisition", "Sourcing", "Purchase order", "History"])
  expect(requestDetail(draft("a", "draft")).stepper).toEqual([
    "Requisition",
    "PR approval",
    "Sourcing",
    "Sourcing approval",
    "Purchase order",
    "PO approval",
    "Approved",
    "Issued",
  ])
  expect(supplierDetail()).toEqual({
    page: false,
    sections: ["General", "categories", "contacts", "commercial", "bank", "compliance", "linked requests", "audit"],
  })
  expect(
    requestValue(
      {
        ...draft("x", "draft"),
        po: { lines: [{ qty: 0, unitPrice: 5 }] },
        pr: { estAmount: 9 },
      },
      rates,
    ),
  ).toBe(0)
})

function draft(
  number: string,
  status: string,
  po?: {
    expenseType?: string
    lines?: { qty: number; unitPrice: number }[]
    number?: string
    supplier?: string
    iban?: string
  },
  sourcing?: {
    quotes: { id: string; total: number; currency: string }[]
    selectedId: string
  },
  pr?: { estAmount?: number },
): RequestView {
  return {
    number,
    status,
    createdBy: "ada",
    po: po ?? null,
    sourcing: sourcing ?? null,
    pr: pr ?? null,
    history: [],
  }
}
