import { expect, test } from "bun:test"
import { domain } from "../runtime/planner.ts"
import { exportMembers, parseWorkbook } from "../runtime/workbooks.ts"
import { createApplication } from "../runtime/application.ts"
import type { Actor, Environment, Snapshot } from "../runtime/contract.ts"
import { testPersistence } from "./fixture/persistence.ts"

const at = "2026-11-12T15:00:00Z"
const actor: Actor = { id: "directory-admin", canWrite: true, roles: ["admin", "hr"] }
const principal = {
  id: "directory-admin",
  canWrite: true,
  roles: [
    { surface: "dashboard" as const, role: "admin" },
    { surface: "planner" as const, role: "admin" },
  ],
}
const directory = [{ id: actor.id, name: "Directory Admin" }]
let serial = 0
const environment: Environment = { at, directory, id: () => `generated-date-row-${++serial}` }

function dashboardSnapshot(): Snapshot {
  return {
    data: {
      members: [
        {
          id: "terminated-member",
          name: "Terminated Member",
          title: "Analyst",
          type: "Employee",
          leaderId: "leader-1",
          location: "Brazil",
          start: "2022-03-15",
          end: "2026-03-15",
          status: "Terminated",
        },
      ],
      leaders: [{ id: "leader-1", name: "Marta", domain: "IT", location: "Brazil" }],
      projects: [
        {
          id: "project-1",
          name: "Existing Project",
          status: "In Progress",
          risk: "Medium",
          priority: "Normal",
          start: "2024-01-02",
          end: "2026-12-31",
          milestones: [],
        },
      ],
    },
    versions: { "members:terminated-member": { version: 0, by: actor.id } },
    sequences: {},
    audit: [],
    notices: [],
  }
}

function memberExportSnapshot(): Snapshot {
  const snapshot = dashboardSnapshot()
  snapshot.data.members = [
    {
      id: "terminated-member",
      name: "Terminated Member",
      title: "Analyst",
      type: "Employee",
      leaderId: "leader-1",
      location: "Brazil",
      start: "2020-01-01",
      end: "2020-01-02",
      status: "Terminated",
    },
    {
      id: "date-precision",
      name: "Date Precision",
      title: "Engineer",
      type: "Employee",
      leaderId: "leader-1",
      location: "Brazil",
      start: "2021-01-01",
      end: "2021-01-02",
      status: "Active",
    },
    {
      id: "exact-iso",
      name: "Exact ISO",
      title: "Engineer",
      type: "Employee",
      leaderId: "leader-1",
      location: "Brazil",
      start: "2018-04-09",
      end: "2019-04-10",
      status: "Active",
    },
    {
      id: "numeric-serial",
      name: "Numeric Serial",
      title: "Engineer",
      type: "Employee",
      leaderId: "leader-1",
      location: "Brazil",
      start: "2017-05-06",
      end: "2018-05-07",
      status: "Active",
    },
    {
      id: "blank-dates",
      name: "Blank Dates",
      title: "Engineer",
      type: "Employee",
      leaderId: "leader-1",
      location: "Brazil",
      start: "2024-01-02",
      end: "2026-12-31",
      status: "Active",
    },
  ]
  snapshot.versions = Object.fromEntries(
    (snapshot.data.members as Record<string, unknown>[]).map((member) => [
      `members:${String(member.id)}`,
      { version: 0, by: actor.id },
    ]),
  )
  return snapshot
}

function plannerSnapshot(roster = [{
  name: "Blank Dates",
  title: "Engineer",
  type: "Employee",
  leader: "Marta",
  location: "Brazil",
  start: "2024-01-02",
  end: "2026-12-31",
  status: "Active",
}]): Snapshot {
  return {
    data: {
      versions: [
        {
          id: "plan-1",
          name: "Plan",
          year: 2026,
          locked: false,
          closed: 0,
          lines: [],
          projects: [],
          hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} },
          fx: [],
          lists: {},
        },
      ],
      officials: {},
      entities: [],
      allocations: [],
      roster,
    },
    versions: {},
    sequences: {},
    audit: [],
    notices: [],
  }
}

function importRoster(
  state: Snapshot,
  sheets: Record<string, Record<string, unknown>[]>,
  versions: Record<string, unknown> = state.versions,
) {
  return domain.execute(
    state,
    actor,
    {
      page: "Headcount",
      action: "import-workbook",
      version: 0,
      values: { versionId: "plan-1", sheets, versions: structuredClone(versions) },
    },
    environment,
  )
}

async function parsedMemberWorkbook(
  dates: Record<string, [string | number | null, string | number | null]> = {},
) {
  const exported = await exportMembers(memberExportSnapshot(), actor, environment)
  expect(exported.ok).toBe(true)
  if (!exported.ok) throw new Error("Expected the real All Members export")
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  await workbook.xlsx.load(new Uint8Array(exported.bytes).buffer)
  const allMembers = workbook.getWorksheet("All Members")
  if (!allMembers || !workbook.getWorksheet("Summary by Leader"))
    throw new Error("Expected both sheets from the real All Members export")
  allMembers.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const override = dates[String(row.getCell(1).value)]
    if (override) {
      row.getCell(6).value = override[0]
      row.getCell(7).value = override[1]
    }
  })
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

async function parsedSheets(bytes: Uint8Array) {
  const parsed = await parseWorkbook(bytes)
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) throw new Error(`Expected XLSX parse: ${parsed.errors.join("; ")}`)
  return parsed.sheets
}

async function mixedPlannerWorkbook() {
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  const exported = await exportMembers(memberExportSnapshot(), actor, environment)
  expect(exported.ok).toBe(true)
  if (!exported.ok) throw new Error("Expected the real All Members export")
  await workbook.xlsx.load(new Uint8Array(exported.bytes).buffer)
  const allMembers = workbook.getWorksheet("All Members")
  if (!allMembers) throw new Error("Expected All Members sheet")
  allMembers.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || row.getCell(1).value !== "Terminated Member") return
    row.getCell(6).value = "15/03/2022"
    row.getCell(7).value = "15/03/2026"
  })
  workbook.addWorksheet("OPEX").addRows([
    ["Line ID", "Cost element", "Vendor / item", "Description", "Owner", "Entity", "Allocation", "Currency", "Measure", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Total"],
    ["", "Licenses", "Atomicity control", "", "", "", "", "USD", "Budget", 500, null, null, null, null, null, null, null, null, null, null, null, null],
  ])
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

async function invalidMemberEndDate(bytes: Uint8Array) {
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  await workbook.xlsx.load(new Uint8Array(bytes).buffer)
  const allMembers = workbook.getWorksheet("All Members")
  if (!allMembers) throw new Error("Expected All Members sheet")
  allMembers.eachRow((row) => {
    if (row.getCell(1).value === "Terminated Member") row.getCell(7).value = "not-a-date"
  })
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

test("dashboard member import canonicalizes accepted date forms and preserves calendar-day precision", async () => {
  const { domain } = await import("../runtime/dashboard-people.ts")
  const dashboardBudget = await import("../runtime/dashboard-budget.ts")
  const { isYearDeparture } = await import("../src/dashboard-accounts.ts")
  const { render } = await import("../runtime/dashboard-people.ts")
  const state = memberExportSnapshot()
  const sheets = await parsedSheets(
    await parsedMemberWorkbook({
      "Terminated Member": ["15/03/2022", "15/03/2026"],
      "Date Precision": ["2022-3-5", "5.3.2026"],
      "Exact ISO": ["2022-03-15", "2026-03-15"],
      "Numeric Serial": [44635, 46096],
    }),
  )
  expect(Object.keys(sheets)).toEqual(["All Members", "Summary by Leader"])
  const result = domain.execute(
    state,
    actor,
    {
      page: "Talent Review",
      action: "import",
      version: 0,
      values: {
        versions: Object.fromEntries(Object.entries(state.versions).map(([key, value]) => [key, value.version])),
        rows: sheets["All Members"],
      },
    },
    environment,
  )
  expect(result).toMatchObject({ ok: true })
  expect(state.data.members).toMatchObject([
    { start: "2022-03-15", end: "2026-03-15" },
    { name: "Date Precision", start: "2022-03-05", end: "2026-03-05" },
    { name: "Exact ISO", start: "2022-03-15", end: "2026-03-15" },
    { name: "Numeric Serial", start: "2022-03-15", end: "2026-03-15" },
    { name: "Blank Dates", start: "2024-01-02", end: "2026-12-31" },
  ])
  expect(isYearDeparture("Terminated", "2026-03-15", "2026")).toBe(true)
  expect(isYearDeparture("Terminated", "2026-03-15", "2025")).toBe(false)
  const executiveByYear = dashboardBudget.domain.view(state, actor, environment).data.executiveByYear
  expect(executiveByYear).toHaveProperty("2026.departures", 1)
  expect(executiveByYear).toHaveProperty("2026.monthlyDepartures.2", 1)
  expect(executiveByYear).toHaveProperty("2025.monthlyDepartures.2", 0)
  expect(
    render("Headcount Overview", state.data, {
      actor,
      year: 2026,
      month: 11,
      at,
      versions: state.versions,
    }),
  ).toContain("22.2%")
})

test("blank dashboard member dates leave stored dates unchanged", async () => {
  const { domain } = await import("../runtime/dashboard-people.ts")
  const state = memberExportSnapshot()
  const sheets = await parsedSheets(await parsedMemberWorkbook({ "Blank Dates": [null, null] }))
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Talent Review",
        action: "import",
        version: 0,
        values: {
          versions: Object.fromEntries(Object.entries(state.versions).map(([key, value]) => [key, value.version])),
          rows: sheets["All Members"],
        },
      },
      environment,
    ),
  ).toMatchObject({ ok: true })
  expect((state.data.members as Record<string, unknown>[]).find((member) => member.name === "Blank Dates")).toMatchObject({
    start: "2024-01-02",
    end: "2026-12-31",
  })
})

test("real exportMembers All Members XLSX normalizes dates, ignores its paired summary and applies to planner", async () => {
  const state = plannerSnapshot()
  const sheets = await parsedSheets(
    await parsedMemberWorkbook({
      "Terminated Member": ["15/03/2022", "15/03/2026"],
      "Date Precision": ["2022-3-5", "5.3.2026"],
      "Exact ISO": ["2022-03-15", "2026-03-15"],
      "Numeric Serial": [44635, 46096],
      "Blank Dates": [null, null],
    }),
  )
  expect(Object.keys(sheets)).toEqual(["All Members", "Summary by Leader"])
  expect(importRoster(state, sheets)).toMatchObject({ ok: true })
  expect(state.data.roster).toEqual([
    expect.objectContaining({ name: "Terminated Member", start: "2022-03-15", end: "2026-03-15" }),
    expect.objectContaining({ name: "Date Precision", start: "2022-03-05", end: "2026-03-05" }),
    expect.objectContaining({ name: "Exact ISO", start: "2022-03-15", end: "2026-03-15" }),
    expect.objectContaining({ name: "Numeric Serial", start: "2022-03-15", end: "2026-03-15" }),
    expect.objectContaining({ name: "Blank Dates", start: "2024-01-02", end: "2026-12-31" }),
  ])
})

test("a valid mixed All Members and OPEX XLSX applies; changing only one date fails atomically", async () => {
  const validBytes = await mixedPlannerWorkbook()
  const validSheets = await parsedSheets(validBytes)
  expect(Object.keys(validSheets)).toEqual(["All Members", "Summary by Leader", "OPEX"])
  const validState = plannerSnapshot()
  expect(importRoster(validState, validSheets)).toMatchObject({ ok: true })
  expect(validState.data.roster).toHaveLength(5)
  expect(validState.data.roster).toContainEqual(
    expect.objectContaining({ name: "Terminated Member", start: "2022-03-15", end: "2026-03-15" }),
  )
  const importedPlan = (validState.data.versions as Record<string, unknown>[])[0]
  expect((importedPlan.lines as Record<string, unknown>[]).some((line) => line.name === "Atomicity control" && line.annual === 500)).toBe(true)

  const invalidSheets = await parsedSheets(await invalidMemberEndDate(validBytes))
  const invalidState = plannerSnapshot()
  const before = structuredClone(invalidState)
  expect(importRoster(invalidState, invalidSheets)).toEqual({
    ok: false,
    status: 422,
    errors: ["Invalid roster date"],
  })
  expect(invalidState).toEqual(before)
})

test("stale planner roster revision rejects a valid XLSX import without partial changes", async () => {
  const state = plannerSnapshot()
  state.versions["roster:file"] = { version: 2, by: "earlier-writer" }
  const before = structuredClone(state)
  const sheets = await parsedSheets(await parsedMemberWorkbook())
  expect(importRoster(state, sheets, { "roster:file": 1 })).toMatchObject({ ok: false, status: 409 })
  expect(state).toEqual(before)
})

test("project XLSX preview and import canonicalize accepted date forms", async () => {
  const { domain, pages, render } = await import("../runtime/dashboard-portfolio.ts")
  const dashboard = dashboardSnapshot()
  const storage = testPersistence({ dashboard })
  const app = createApplication("/sucafina", {
    authenticate: async () => principal,
    persistence: storage.persistence,
    environment: async () => environment,
    domains: {
      dashboard: [
        { pages, domain, render },
        await import("../runtime/dashboard-people.ts").then((module) => ({
          pages: module.pages,
          domain: module.domain,
          render: module.render,
        })),
      ],
      planner: [],
      procurement: [],
    },
    maxJsonBytes: 1_000_000,
  })
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  workbook.addWorksheet("Projects Import").addRows([
    ["Name", "Status", "Risk", "Priority", "Start Date", "End Date"],
    ["New Project", "Planning", "Low", "Normal", "5.3.2022", "15/03/2026"],
  ])
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  const response = await app(
    new Request("https://installation.example/sucafina/dashboard", {
      method: "POST",
      headers: { Origin: "https://installation.example", "Content-Type": "application/json" },
      body: JSON.stringify({ page: "All Projects", action: "preview-workbook", version: 0, values: { kind: "projects", bytes: [...bytes] } }),
    }),
  )
  expect(response?.status).toBe(200)
  const preview = await response?.json() as { ok: boolean; sheets: Record<string, Record<string, unknown>[]> }
  expect(preview.ok).toBe(true)
  expect(preview.sheets["Projects Import"]).toContainEqual(expect.objectContaining({
    start: "2022-03-05",
    end: "2026-03-15",
  }))
  expect(
    domain.execute(
      dashboard,
      actor,
      {
        page: "All Projects",
        action: "import",
        version: 0,
        values: {
          mode: "update",
          rows: preview.sheets["Projects Import"],
          versions: { "projects:project-1": 0 },
        },
      },
      environment,
    ),
  ).toMatchObject({ ok: true })
  expect(dashboard.data.projects).toHaveLength(2)
  expect(dashboard.data.projects).toContainEqual(expect.objectContaining({
    name: "Existing Project",
    start: "2024-01-02",
    end: "2026-12-31",
  }))
  expect(dashboard.data.projects).toContainEqual(expect.objectContaining({
    name: "New Project",
    start: "2022-03-05",
    end: "2026-03-15",
  }))
})
