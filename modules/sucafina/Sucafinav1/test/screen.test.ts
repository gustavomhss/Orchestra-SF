import { expect, test } from "bun:test"
import { dashboardMoney, executiveReportTotals } from "../src/dashboard-accounts.ts"
import { dashboardScreen } from "../src/dashboard-screen.ts"
import { plannerScreen } from "../src/planner-screen.ts"
import { procurementScreen } from "../src/procurement-screen.ts"
import { press, UNSAVED } from "../src/screen-shell.ts"
import { DASHBOARD_PAGES, FOOTER, PLANNER_TABS, PROCUREMENT_NAV, executiveScreen, showPage } from "../src/surfaces.ts"

const AT = "2026-11-11T12:00:00Z"

function actor(id: string, roles: string[], canWrite = true) {
  return { id, canWrite, roles }
}

function anchors(html: string): string[] {
  const nav = html.slice(html.search(/<nav\b[^>]*>/), html.indexOf("</nav>"))
  return [...nav.matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((match) =>
    match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"'),
  )
}

function script(html: string): string {
  return html.slice(html.indexOf("<script>"), html.indexOf("</script>"))
}

const budget = {
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
}

test("the screen draws the server list, the footer is not a page, and a refused write is not saved", () => {
  const viewer = dashboardScreen({
    actor: actor("vie", ["viewer"]),
    budget,
    year: 2026,
    members: [{ id: "m1", cls: "Talent", notes: "private-note" }],
  })
  expect(viewer.drawn.nav.map((item) => item.key)).toEqual(["Executive Dashboard"])
  expect(anchors(viewer.html)).toEqual(["Executive Dashboard"])
  expect(viewer.html).not.toContain("private-note")
  expect(viewer.html).not.toContain("Talent Review")
  expect(viewer.drawn.aside.map((item) => item.key)).toEqual([...FOOTER])
  expect(viewer.drawn.aside.every((item) => item.page === false)).toBe(true)
  for (const key of FOOTER) expect(showPage(key)).toEqual({ drawn: false })
  expect(anchors(viewer.html)).not.toContain("Generate Report")
  expect(viewer.html.indexOf('data-slot="footer"')).toBeGreaterThan(viewer.html.indexOf("</nav>"))
  expect(viewer.html).not.toContain("IT Budget Planner")
  expect(viewer.html).not.toContain("My approvals")
  expect(viewer.html).not.toContain("FX rates")
  expect(viewer.html).not.toContain("localStorage")
  expect(viewer.html).not.toContain("claude")
  expect(script(viewer.html)).not.toContain("showPage")
  expect(script(viewer.html)).not.toContain("roles")
  expect(script(viewer.html)).toContain(UNSAVED)
  expect(script(viewer.html)).not.toContain("/ 12")
  const fromSidebar = executiveScreen(budget, 2026)
  expect(viewer.html).not.toContain(dashboardMoney(fromSidebar.totals.totalBudget))

  const executive = dashboardScreen({
    actor: actor("vie", ["viewer"]),
    budget,
    year: 2025,
    ownYear: 2026,
  })
  const server = executiveScreen(budget, 2026)
  expect(executive.html).toContain(dashboardMoney(server.totals.totalBudget))
  expect(executive.html).toContain(server.label)
  expect(executive.html).toContain(String(server.chart[0]))
  expect(executive.html).toContain(dashboardMoney(executiveReportTotals(budget, 2026).totalBudget))
  expect(executive.html).not.toContain(dashboardMoney(executiveScreen(budget, 2025).totals.totalBudget))

  const overview = dashboardScreen({
    actor: actor("cio", ["admin"]),
    key: "Budget Overview",
    budget,
    year: 2025,
    ownYear: 2026,
  })
  expect(overview.drawn.active).toEqual({
    drawn: true,
    key: "Budget Overview",
    index: 2,
  })
  expect(overview.html).toContain(dashboardMoney(executiveScreen(budget, 2025).totals.totalBudget))
  expect(overview.html).not.toContain('data-year="own"')

  const closed = dashboardScreen({
    actor: actor("vie", ["viewer"]),
    key: "Talent Review",
    members: [{ id: "m1", cls: "Talent", notes: "private-note" }],
    at: AT,
    audit: [],
  })
  expect(closed.drawn.active).toEqual({ drawn: false })
  expect(closed.html).toContain('data-drawn="false"')
  expect(closed.html).not.toContain("private-note")

  const audit: { who: string; at: string; member: string }[] = []
  const lead = dashboardScreen({
    actor: actor("lead", ["domain leader"]),
    key: "Talent Review",
    members: [
      {
        id: "m1",
        name: "Ada",
        cls: "Talent",
        outlook: "Promote",
        notes: "private-note",
      },
    ],
    at: AT,
    audit,
  })
  expect(lead.drawn.active).toEqual({
    drawn: true,
    key: "Talent Review",
    index: 7,
  })
  expect(lead.html).toContain("Ada")
  expect(lead.html).not.toContain("private-note")
  expect(lead.html).not.toContain("Promote")
  expect(audit).toEqual([{ who: "lead", at: AT, member: "m1" }])

  const adminAudit: { who: string; at: string; member: string }[] = []
  const adminTalent = dashboardScreen({
    actor: actor("cio", ["admin"]),
    key: "Talent Review",
    members: [
      {
        id: "m1",
        name: "Ada",
        cls: "Solid Contributor",
        notes: "private-note",
      },
    ],
    at: AT,
    audit: adminAudit,
  })
  expect(adminTalent.html).toContain("Solid Contributor")
  expect(adminTalent.html).toContain("private-note")

  const admin = dashboardScreen({ actor: actor("cio", ["admin"]) })
  expect(anchors(admin.html)).toEqual([...DASHBOARD_PAGES])
  expect(admin.html).not.toContain(">Hardware<")
  expect(showPage("Hardware")).toEqual({ drawn: false })
  expect(showPage("Overview")).toEqual({
    drawn: true,
    surface: "planner",
    index: 0,
  })
  expect(anchors(admin.html)).not.toContain("Overview")

  const risks = dashboardScreen({
    actor: actor("cio", ["admin"]),
    key: "IT Risks",
    risks: [{ impact: 6, probability: 1 }],
  })
  expect(risks.html).toContain("6 ")
  expect(risks.html).not.toContain(">5<")

  const shown = { total: 1 }
  expect(
    press(() => {
      throw new Error("down")
    }),
  ).toEqual({ saved: false, notice: UNSAVED })
  expect(press(() => null)).toEqual({ saved: false, notice: UNSAVED })
  expect(press(() => ({ ok: false }))).toEqual({ saved: false })
  expect(press(() => ({ ok: false, status: 409, stored: 3, by: "bea" }))).toEqual({
    saved: false,
    status: 409,
    stored: 3,
    by: "bea",
  })
  expect(press(() => ({ ok: true, value: 9 }))).toEqual({
    saved: true,
    value: 9,
  })
  expect(shown).toEqual({ total: 1 })
})

test("planner and procurement screens do not add a page and do not carry another surface", () => {
  const plan = plannerScreen({ actor: actor("fin", ["finance"]) })
  expect(anchors(plan.html)).toEqual([...PLANNER_TABS])
  expect(plan.drawn.active).toEqual({ drawn: true, key: "Overview", index: 0 })
  expect(anchors(plan.html)).not.toContain("Excel")
  expect(showPage("Excel")).toEqual({ drawn: false })
  expect(plan.html).toContain('data-slot="excel" data-page="false"')
  expect(plan.html.indexOf('data-slot="excel"')).toBeGreaterThan(plan.html.indexOf("</nav>"))
  expect(plan.html).not.toContain("CIO Dashboard")
  expect(plan.html).not.toContain("Executive Dashboard")
  expect(plannerScreen({ actor: actor("bea", ["buyer"]) }).drawn.nav).toEqual([])
  expect(plannerScreen({ actor: actor("bea", ["buyer"]) }).html).not.toContain("Excel")

  const request = {
    number: "PR-2026-0007",
    status: "draft",
    createdBy: "ada",
    po: { iban: "GB00SECRET", lines: [{ qty: 1, unitPrice: 2 }] },
    sourcing: { quotes: [{ scores: [9] }] },
  }
  const proc = procurementScreen({
    actor: actor("bea", ["buyer"]),
    requests: [
      request,
      {
        number: "PR-2026-0008",
        status: "po_issued",
        createdBy: "ada",
        po: { expenseType: "OPEX", lines: [{ qty: 2, unitPrice: 15 }] },
      },
    ],
    rates: { currency: "USD", fxRates: [{ code: "EUR", rate: 1.08 }] },
    request,
    supplier: true,
  })
  expect(anchors(proc.html)).toEqual([...PROCUREMENT_NAV])
  expect(anchors(proc.html)).not.toContain("Request detail")
  expect(anchors(proc.html)).not.toContain("Supplier detail")
  expect(showPage("Request detail")).toEqual({ drawn: false })
  expect(proc.html).toContain('data-slot="request-detail" data-page="false"')
  expect(proc.html).toContain('data-slot="supplier-detail" data-page="false"')
  expect(proc.html.indexOf('data-slot="request-detail"')).toBeGreaterThan(proc.html.indexOf("</nav>"))
  expect(proc.html).not.toContain("GB00SECRET")
  expect(proc.html).not.toContain("scores")
  expect(proc.html).not.toContain("Executive Dashboard")
  expect(proc.html).not.toContain("FX rates")
  expect(proc.drawn.aside.every((item) => item.page === false)).toBe(true)
  expect(procurementScreen({ actor: actor("lead", ["domain leader"]) }).drawn.nav).toEqual([])
})
