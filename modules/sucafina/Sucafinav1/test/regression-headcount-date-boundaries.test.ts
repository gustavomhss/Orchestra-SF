import { expect, test } from "bun:test"
import { WorkbookDate } from "../src/workbook-date.ts"
import { DashboardPeople } from "../runtime/dashboard-people.ts"
import { DashboardPortfolio } from "../runtime/dashboard-portfolio.ts"
import { createApplication } from "../runtime/application.ts"
import type { Actor, Environment, Snapshot } from "../runtime/contract.ts"
import { testPersistence } from "./fixture/persistence.ts"

const admin: Actor = { id: "directory-admin", canWrite: true, roles: ["admin"] }
const leader: Actor = { id: "directory-leader", canWrite: true, roles: ["domain leader"] }
const environment: Environment = {
  at: "2026-11-12T15:00:00Z",
  directory: [{ id: admin.id, name: "Directory Admin" }],
  id: () => "new-record",
}

function snapshot(): Snapshot {
  return {
    data: {
      members: [{ id: "member-1", name: "Existing Member", type: "Employee", status: "Active", cls: "", outlook: "", start: "2024-01-02", end: "2026-12-31" }],
      projects: [{ id: "project-1", name: "Existing Project", status: "In Progress", risk: "Medium", priority: "Normal", start: "2024-01-02", end: "2026-12-31", milestones: [] }],
    },
    versions: { "members:member-1": { version: 2, by: "previous" }, "projects:project-1": { version: 2, by: "previous" } },
    sequences: {}, audit: [], notices: [],
  }
}

const memberImport = (rows: Record<string, unknown>[], version = 2) => ({
  page: "Talent Review", action: "import", version: 0,
  values: { rows, versions: { "members:member-1": version } },
})
const projectImport = (rows: Record<string, unknown>[], version = 2) => ({
  page: "All Projects", action: "import", version: 0,
  values: { mode: "update", rows, versions: { "projects:project-1": version } },
})

test("workbook dates reject calendar rollover and trailing suffixes", () => {
  for (const value of ["2026-02-29", "2024-02-30", "31/04/2026", "00.03.2026", "2026-13-01", "2026-03-15T00:00:00Z", "15/03/2026 extra", "44635"]) {
    expect(WorkbookDate.parse(value)).toBeUndefined()
  }
  expect(WorkbookDate.parse("2024-02-29")).toBe("2024-02-29")
})

test("workbook dates use UTC for Date and truncate fractional Excel serial days", () => {
  expect(WorkbookDate.parse(new Date("2026-03-15T23:30:00-03:00"))).toBe("2026-03-16")
  expect(WorkbookDate.parse(new Date("invalid"))).toBeUndefined()
  expect(WorkbookDate.parse(44635.75)).toBe("2022-03-15")
  expect(WorkbookDate.parse(46096.99)).toBe("2026-03-15")
  expect(WorkbookDate.parse(Number.POSITIVE_INFINITY)).toBeUndefined()
})

test("dashboard member mixed valid and invalid dates roll back the entire snapshot", () => {
  const state = snapshot()
  const before = structuredClone(state)
  const result = DashboardPeople.domain.execute(state, admin, memberImport([
    { Name: "Existing Member", "Start Date": "15/03/2022", "End Date": "15/03/2026" },
    { Name: "Invalid Member", "Start Date": "31/02/2026", "End Date": "" },
  ]), environment)
  expect(result).toMatchObject({ ok: false, status: 422, errors: ["Invalid member date"] })
  expect(state).toEqual(before)
})

test("project workbook preview marks an invalid calendar date as an error", async () => {
  const storage = testPersistence({ dashboard: snapshot() })
  const app = createApplication("/sucafina", {
    authenticate: async () => ({ id: admin.id, canWrite: true, roles: [{ surface: "dashboard", role: "admin" }] }),
    persistence: storage.persistence,
    environment: async () => environment,
    domains: { dashboard: [DashboardPortfolio, DashboardPeople], planner: [], procurement: [] },
    maxJsonBytes: 1_000_000,
  })
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  workbook.addWorksheet("Projects Import").addRows([
    ["Name", "Status", "Risk", "Priority", "Start Date", "End Date"],
    ["Valid Project", "Planning", "Low", "Normal", "15/03/2022", "15/03/2026"],
    ["Invalid Project", "Planning", "Low", "Normal", "31/02/2026", "15/03/2026"],
  ])
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  const before = structuredClone(storage.state)
  const response = await app(new Request("https://installation.example/sucafina/dashboard", {
    method: "POST", headers: { Origin: "https://installation.example", "Content-Type": "application/json" },
    body: JSON.stringify({ page: "All Projects", action: "preview-workbook", version: 0, values: { kind: "projects", bytes: [...bytes] } }),
  }))
  expect(response?.status).toBe(200)
  const preview = await response?.json() as { ok: boolean; sheets: Record<string, Record<string, unknown>[]> }
  expect(preview.ok).toBe(true)
  expect(preview.sheets["Projects Import"]).toEqual([
    expect.objectContaining({ name: "Valid Project", start: "2022-03-15", _status: "valid" }),
    expect.objectContaining({ name: "Invalid Project", _status: "error" }),
  ])
  expect(storage.state).toEqual(before)
})

test("direct project import rejects an invalid date and rolls back valid rows", () => {
  const state = snapshot()
  const before = structuredClone(state)
  const result = DashboardPortfolio.domain.execute(state, admin, projectImport([
    { name: "Existing Project", start: "15/03/2022", end: "15/03/2026" },
    { name: "Invalid Project", start: "2026-02-29", end: "2026-12-31" },
  ]), environment)
  expect(result).toMatchObject({ ok: false, status: 422, errors: ["Invalid project date"] })
  expect(state).toEqual(before)
})

test("non-admin member and project workbook imports are forbidden without changes", () => {
  const state = snapshot()
  const before = structuredClone(state)
  expect(DashboardPeople.domain.execute(state, leader, memberImport([{ Name: "Existing Member", "Start Date": "15/03/2022" }]), environment)).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
  expect(DashboardPortfolio.domain.execute(state, leader, projectImport([{ name: "Existing Project", start: "15/03/2022" }]), environment)).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
})

test("stale member and project imports reject without changing the snapshot", () => {
  const state = snapshot()
  const before = structuredClone(state)
  expect(DashboardPeople.domain.execute(state, admin, memberImport([{ Name: "Existing Member", "Start Date": "15/03/2022" }], 1), environment)).toMatchObject({ ok: false, status: 409, by: "previous" })
  expect(state).toEqual(before)
  expect(DashboardPortfolio.domain.execute(state, admin, projectImport([{ name: "Existing Project", start: "15/03/2022" }], 1), environment)).toMatchObject({ ok: false, status: 409, by: "previous" })
  expect(state).toEqual(before)
})
