import { expect, test } from "bun:test"
import type { Actor, Snapshot } from "../runtime/contract.ts"
import { domain, pages, render } from "../runtime/dashboard-people.ts"

const at = "2026-01-15T12:00:00Z"
const environment = { at, id: () => "unused", directory: [] }
const admin: Actor = { id: "fixture-admin", canWrite: false, roles: ["admin"] }
const leader: Actor = { id: "fixture-leader", canWrite: false, roles: ["domain leader"] }
const headcountPage = pages[1]

function snapshot(members: Record<string, unknown>[], users = 18): Snapshot {
  return {
    data: {
      members,
      leaders: [{ id: "leader-fixture", name: "Synthetic Lead" }],
      itUsersMonthly: [{ year: 2026, month: 1, users }],
    },
    versions: {},
    sequences: {},
    audit: [],
    notices: [],
  }
}

function overview(state: Snapshot, actor: Actor = admin) {
  const view = domain.view(state, actor, environment)
  const html = render(headcountPage, view.data, {
    actor,
    year: 2026,
    month: 1,
    at,
    versions: view.versions,
  })
  if (html === undefined) throw new Error("Headcount Overview renderer returned no markup")
  return { view, html }
}

function metricValue(html: string, label: string) {
  return [...html.matchAll(/<article class="metric"><span>([^<]*)<\/span><strong>([^<]*)<\/strong><\/article>/g)]
    .find((match) => match[1] === label)?.[2]
}

const mixedMembers = [
  {
    id: "active-employee",
    name: "Synthetic Active Employee",
    title: "Analyst",
    type: "Employee",
    leaderId: "leader-fixture",
    start: "2025-01-15",
    end: "",
    status: "Active",
    cls: "Talent",
    outlook: "Stay",
    notes: "FIXTURE-PRIVATE-ACTIVE",
  },
  {
    id: "active-contractor",
    name: "Synthetic Active Contractor",
    title: "Designer",
    type: "Contractor",
    leaderId: "leader-fixture",
    start: "2025-07-15",
    end: "",
    status: "Active",
    cls: "Solid Contributor",
    outlook: "Stay",
    notes: "FIXTURE-PRIVATE-CONTRACTOR",
  },
  {
    id: "terminated-employee",
    name: "Synthetic Terminated Employee",
    title: "Former Analyst",
    type: "Employee",
    leaderId: "leader-fixture",
    start: "2010-01-15",
    end: "2026-01-08",
    status: "Terminated",
    cls: "Talent",
    outlook: "Promote",
    notes: "FIXTURE-PRIVATE-TERMINATED",
  },
  {
    id: "leave-contractor",
    name: "Synthetic Leave Contractor",
    title: "Former Designer",
    type: "Contractor",
    leaderId: "leader-fixture",
    start: "2012-01-15",
    end: "",
    status: "On Leave",
    cls: "Talent",
    outlook: "Replace",
    notes: "FIXTURE-PRIVATE-LEAVE",
  },
  {
    id: "earlier-terminated-employee",
    name: "Synthetic Earlier-Terminated Employee",
    title: "Former Planner",
    type: "Employee",
    leaderId: "leader-fixture",
    start: "2011-01-15",
    end: "2024-02-15",
    status: "Terminated",
    cls: "Solid Contributor",
    outlook: "Stay",
    notes: "FIXTURE-PRIVATE-EARLIER-TERMINATED",
  },
]

test("DASH-HC-ACTIVE filters only Employees, Contractors and average tenure to Active members", () => {
  const { html } = overview(snapshot(structuredClone(mixedMembers)))

  expect(metricValue(html, "Employees")).toBe("1")
  expect(metricValue(html, "Contractors")).toBe("1")
  expect(metricValue(html, "Average tenure (months)")).toBe("9.0")
  expect(metricValue(html, "Active")).toBe("2")
  expect(metricValue(html, "Terminated")).toBe("2")
  // Only the 2026 departure affects YTD attrition; the earlier termination raises the all-time card only.
  expect(metricValue(html, "Attrition YTD")).toBe("40.0%")
  expect(metricValue(html, "Staff ratio")).toBe("9")
  // Global Talent remains admin-only and intentionally includes Active, Terminated, and On Leave members.
  expect(metricValue(html, "Talent")).toBe("3")
  expect(html).toContain("<td>Synthetic Lead</td><td>2</td><td>1</td>")
})

test("DASH-HC-ACTIVE counts an Active member with an invalid start but omits only that date from tenure", () => {
  const { html } = overview(snapshot([
    { id: "invalid-date-active-employee", name: "Synthetic Invalid-Date Employee", type: "Employee", status: "Active", start: "not-a-date" },
    { id: "valid-date-active-contractor", name: "Synthetic Valid-Date Contractor", type: "Contractor", status: "Active", start: "2025-07-15" },
  ]))

  expect(metricValue(html, "Employees")).toBe("1")
  expect(metricValue(html, "Contractors")).toBe("1")
  expect(metricValue(html, "Average tenure (months)")).toBe("6.0")
})

test("DASH-HC-ACTIVE has meaningful empty Active population values while preserving legacy ratio and departure behavior", () => {
  const { html } = overview(snapshot([
    { id: "terminated-empty-active", name: "Synthetic Terminated Member", type: "Employee", status: "Terminated", start: "2000-01-15", end: "2026-01-10", cls: "Talent" },
    { id: "leave-empty-active", name: "Synthetic Leave Member", type: "Contractor", status: "On Leave", start: "2000-01-15", cls: "Talent" },
  ]))

  expect(metricValue(html, "Employees")).toBe("0")
  expect(metricValue(html, "Contractors")).toBe("0")
  expect(metricValue(html, "Average tenure (months)")).toBe("—")
  expect(metricValue(html, "Active")).toBe("0")
  expect(metricValue(html, "Terminated")).toBe("1")
  expect(metricValue(html, "Attrition YTD")).toBe("200.0%")
  expect(metricValue(html, "Staff ratio")).toBe("—")
  expect(metricValue(html, "Talent")).toBe("2")
})

test("DASH-HC-ACTIVE preserves the legacy no-user Staff ratio placeholder", () => {
  const { html } = overview(snapshot([
    { id: "one-active-employee", name: "Synthetic Employee", type: "Employee", status: "Active", start: "2025-01-15" },
  ], 0))

  expect(metricValue(html, "Employees")).toBe("1")
  expect(metricValue(html, "Contractors")).toBe("0")
  expect(metricValue(html, "Average tenure (months)")).toBe("12.0")
  expect(metricValue(html, "Staff ratio")).toBe("—")
})

test("DASH-HC-ACTIVE domain.view keeps private Talent fields out of a non-admin projection and rendered overview", () => {
  const state = snapshot(structuredClone(mixedMembers))
  const { view, html } = overview(state, leader)
  const projectedMembers = view.data.members as Record<string, unknown>[]

  expect(projectedMembers).toHaveLength(5)
  expect(projectedMembers[0]).toMatchObject({ id: "active-employee", name: "Synthetic Active Employee", status: "Active" })
  for (const member of projectedMembers) {
    expect(member).not.toHaveProperty("cls")
    expect(member).not.toHaveProperty("outlook")
    expect(member).not.toHaveProperty("notes")
  }
  expect(JSON.stringify(view.data)).not.toContain("FIXTURE-PRIVATE")
  expect(html).not.toContain("FIXTURE-PRIVATE")
  expect(metricValue(html, "Talent")).toBeUndefined()
  expect(html).not.toContain("Talent (active)")
  expect(metricValue(html, "Employees")).toBe("1")
  expect(metricValue(html, "Contractors")).toBe("1")
  expect(metricValue(html, "Average tenure (months)")).toBe("9.0")
})
