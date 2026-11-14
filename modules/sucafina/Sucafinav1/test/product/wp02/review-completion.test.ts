import { expect, test } from "bun:test"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { DashboardOperations } from "../../../runtime/dashboard-operations.ts"

const context = { actor: { id: "admin", roles: ["admin"], canWrite: true }, year: 2026, month: 11, at: "2026-11-13T00:00:00Z", versions: {} }

function exposedCommands(html: string) {
  const stack: boolean[] = []
  const exposed: string[] = []
  for (const token of html.matchAll(/<\/?(?:details|dialog)\b[^>]*>|<form\b[^>]*>/g)) {
    if (/^<\//.test(token[0])) { stack.pop(); continue }
    if (/^<(?:details|dialog)\b/.test(token[0])) { stack.push(!/\sopen(?:\s|=|>)/.test(token[0])); continue }
    if (token[0].includes("data-command=") && !stack.includes(true)) exposed.push(token[0])
  }
  return exposed
}

test("Portfolio reviews the canonical selection and drills into All Projects without exposing the register", () => {
  const data = { q: "migration", filter: "watch", owner: "owner-1", status: "In Progress", projects: [
    { id: "p1", name: "Migration Alpha", pm: "owner-1", status: "In Progress", risk: "High", watchList: true, end: "2026-12-31", milestones: [{ id: "m1", name: "Readiness check", date: "2026-11-30", status: "upcoming" }, { id: "m2", name: "Undated follow-up", date: "", status: "in-progress" }] },
    { id: "p2", name: "Migration Beta", pm: "owner-1", status: "In Progress", risk: "Low", watchList: false },
  ] }
  const before = structuredClone(data)
  const review = DashboardPortfolio.render("Portfolio Dashboard", data, context)!
  const register = DashboardPortfolio.render("All Projects", data, context)!
  expect(review).toContain('data-view="portfolio-review"')
  expect(review).toContain("1 of 2 accessible projects selected")
  expect(review).toContain("page=All+Projects&amp;year=2026&amp;q=migration&amp;status=In+Progress&amp;filter=watch&amp;owner=owner-1#record-p1")
  expect(review).toContain("Readiness check")
  expect(review).toContain("Undated follow-up")
  expect(review).toContain("not a preserved historical review")
  expect(review).not.toContain("data-command=")
  expect(register).toContain('data-command="save"')
  expect(register).toContain('data-command="import"')
  expect(register.match(/id="record-p1"/g)).toHaveLength(1)
  expect(review).not.toContain('id="record-p2"')
  expect(register).not.toContain('id="record-p2"')
  expect(register).toContain('name="owner" value="owner-1"')
  expect(data).toEqual(before)
})

test("Portfolio order exposes watch preference and recorded dates, retaining undated records", () => {
  const html = DashboardPortfolio.render("Portfolio Dashboard", { projects: [
    { id: "early", name: "Early", end: "2026-01-01" },
    { id: "watch", name: "Watch", watchList: true, end: "2026-12-01" },
    { id: "undated", name: "No date", end: "2026-02-30" },
  ] }, context)!
  expect(html.indexOf('id="record-watch"')).toBeLessThan(html.indexOf('id="record-early"'))
  expect(html.indexOf('id="record-early"')).toBeLessThan(html.indexOf('id="record-undated"'))
  expect(html).toContain("Not specified")
  expect(html).not.toContain("2026-02-30")
  expect(DashboardPortfolio.render("Portfolio Dashboard", { projects: [] }, context)).toContain("0 of 0 accessible projects selected")
})

test("Portfolio cannot publish a record destination for missing or ambiguous physical IDs", () => {
  const html = DashboardPortfolio.render("Portfolio Dashboard", { projects: [{ id: "duplicate", name: "One" }, { id: "duplicate", name: "Two" }, { name: "Missing" }] }, context)!
  expect(html).not.toContain('id="record-')
  expect(html).not.toContain("#record-")
  expect(html.match(/record identity unavailable/g)).toHaveLength(3)
  for (const [page, collection] of [["All Projects", "projects"], ["IT Risks", "risks"], ["Vendor Contracts", "contracts"], ["Stakeholder Management", "stakeholders"]]) {
    const register = DashboardPortfolio.render(page!, { [collection!]: [{ id: "duplicate", name: "One" }, { id: "duplicate", name: "Two" }, { name: "Missing" }, { id: "unique", name: "Unique" }] }, context)!
    expect(register).not.toContain('id="record-duplicate"')
    expect(register).not.toContain('id="record-"')
    expect(register.match(/id="record-unique"/g)).toHaveLength(1)
  }
})

test("Security presents facts while all mutation controls remain in closed contextual editors", () => {
  const data = { secKpi: [{ id: "k", year: 2026, month: 11, patch: 90 }], secActions: [{ id: "a", text: "Complete review", done: false }], secIncidents: [{ id: "i", title: "Service incident", date: "2026-11-01", contained: true, remediated: false }], secPhishing: [{ id: "c", name: "Awareness", targeted: 100, clicked: 5, entered: 0, reported: 30 }] }
  const html = DashboardOperations.render("IT Security KPIs", data, context)!
  expect(exposedCommands(html)).toEqual([])
  expect(html).toContain("Edit monthly security KPIs")
  expect(html).toContain("Complete review")
  expect(html).toContain("Service incident")
  for (const action of ["save-kpi", "delete-kpi", "save-action", "delete-action", "save-incident", "delete-incident", "save-campaign", "delete-campaign"]) expect(html).toContain(`data-command="${action}"`)
  const readonly = DashboardOperations.render("IT Security KPIs", data, { ...context, actor: { id: "viewer", roles: ["viewer"], canWrite: false } })!
  for (const form of readonly.matchAll(/<form\b[^>]*data-command=[\s\S]*?<\/form>/g)) expect(form[0]).toContain('type="submit" disabled')
})

test("Performance retains its read views and command scope with collapsed item and sub-item editing", () => {
  const html = DashboardPortfolio.render("IT Performance Contract", { itperf: { items: [{ id: "it1", name: "Delivery", totalWeight: 1, subs: [{ id: "sub1", label: "Availability", score: 4, totalWeight: 1, owner: "owner-1", ownerWeight: 1, status: "on" }] }] } }, context)!
  expect(exposedCommands(html)).toEqual([])
  expect(html).toContain('id="performance-item-it1"')
  expect(html).toContain('id="owner-dashboard"')
  expect(html).toContain("Availability")
  expect(html).toContain('name="itemId" value="it1"')
  expect(html).toContain('name="subId" value="sub1"')
  for (const action of ["save-item", "delete-item", "save-sub", "delete-sub"]) expect(html).toContain(`data-command="${action}"`)
  const ambiguous = DashboardPortfolio.render("IT Performance Contract", { itperf: { items: [{ id: "duplicate", name: "One" }, { id: "duplicate", name: "Two" }, { name: "Missing" }, { id: "unique", name: "Unique" }] } }, context)!
  expect(ambiguous).not.toContain('id="performance-item-duplicate"')
  expect(ambiguous).not.toContain('id="performance-item-"')
  expect(ambiguous.match(/id="performance-item-unique"/g)).toHaveLength(1)
  for (const name of ["One", "Two", "Missing", "Unique"]) expect(ambiguous).toContain(`<h3>${name}</h3>`)
})

test("historical KPI year does not relabel current security actions, campaigns or incident status", () => {
  const html = DashboardOperations.render("IT Security KPIs", { secKpi: [], secActions: [{ id: "a", text: "Current action", done: false }], secPhishing: [{ id: "c", name: "Current campaign", targeted: 10 }], secIncidents: [{ id: "i", title: "Older incident", date: "2024-02-01", contained: true }] }, { ...context, year: 2024 })!
  expect(html).toContain("Current action records as of 2026-11-13")
  expect(html).toContain("Current campaign records as of 2026-11-13")
  expect(html).toContain("Incidents dated in 2024; containment, remediation and root-cause status are current as of 2026-11-13")
  expect(html).toContain("Current action")
  expect(html).toContain("Current campaign")
  expect(html).toContain("Older incident")
})
