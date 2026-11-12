import { expect, test } from "bun:test"
import { domain, render } from "../runtime/planner.ts"
import { exportMembers, parseWorkbook } from "../runtime/workbooks.ts"
import type { Actor, Snapshot } from "../runtime/contract.ts"

const actor: Actor = { id: "admin", canWrite: true, roles: ["admin"] }
const at = "2026-11-12T12:00:00Z"
const directory: { id: string; name: string }[] = []
let generated = 0
const environment = { at, directory, id: () => `generated-${++generated}` }

function snapshot(locked = false): Snapshot {
  return {
    data: {
      versions: [
        {
          id: "plan",
          name: "Plan",
          year: 2026,
          locked,
          closed: 2,
          lines: [],
          projects: [],
          hc: {
            positions: [
              {
                id: "ana-position",
                name: "Ana Silva",
                title: "Senior analyst",
                type: "Employee",
                location: "Brazil",
                domain: "Manual domain",
                domainManual: true,
                include: true,
                fte: 0.5,
                start: 1,
                end: 12,
                rateOverride: 70000,
                role: "Preserved role",
              },
              { id: "departed-position", name: "Departed person", include: true, end: 12 },
            ],
            rates: [],
            inc: 0,
            incMonth: 1,
            hrAF: {},
            leaderDomains: {},
          },
          fx: [],
          lists: {},
        },
      ],
      officials: {},
      entities: [],
      allocations: [],
      roster: [
        {
          name: "Ana Silva",
          title: "Analyst",
          type: "Employee",
          leader: "Marta",
          location: "Brazil",
          start: "2024-02-01",
          end: "",
          status: "Active",
        },
      ],
      members: [
        {
          id: "member-ana",
          name: "Ana Silva",
          title: "Principal analyst",
          type: "Employee",
          leaderId: "leader-marta",
          location: "Brazil",
          start: "2024-02-01",
          end: "",
          status: "Active",
          cls: "Sensitive classification",
          outlook: "Sensitive outlook",
          notes: "Sensitive note",
        },
        {
          id: "member-jo",
          name: "Jo Costa",
          title: "Designer",
          type: "Contractor",
          leaderId: "leader-marta",
          location: "Brazil",
          start: "2026-04-01",
          end: "",
          status: "Active",
          cls: "Talent",
          outlook: "Stay",
          notes: "Private details",
        },
      ],
      leaders: [{ id: "leader-marta", name: "Marta", domain: "Product", location: "Brazil" }],
    },
    versions: {},
    sequences: {},
    audit: [],
    notices: [],
  }
}

function importSheets(state: Snapshot, sheets: Record<string, Record<string, unknown>[]>) {
  return domain.execute(
    state,
    actor,
    {
      page: "Headcount",
      action: "import-workbook",
      version: state.versions["versions:plan"]?.version ?? 0,
      values: {
        versionId: "plan",
        sheets,
        versions: structuredClone(state.versions),
      },
    },
    environment,
  )
}

test("planner workbook import form accepts both XLSX and legacy XLS files", () => {
  const state = snapshot()
  const html = render("OPEX", domain.view(state, actor, environment).data, {
    actor,
    year: 2026,
    month: 11,
    at,
    versions: state.versions,
  })!
  expect(html).toContain('type="file" accept=".xlsx,.xls" data-workbook="planner"')
})

test("Dashboard members export parses and imports its roster while ignoring its paired leader summary", async () => {
  generated = 0
  const dashboard = snapshot()
  const exported = await exportMembers(dashboard, actor, environment)
  expect(exported.ok).toBe(true)
  if (!exported.ok) throw new Error("Expected Dashboard members workbook")

  const parsed = await parseWorkbook(exported.bytes)
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) throw new Error("Expected parsed Dashboard members workbook")
  expect(Object.keys(parsed.sheets)).toEqual(["All Members", "Summary by Leader"])
  expect(importSheets(dashboard, parsed.sheets)).toMatchObject({ ok: true })

  expect(dashboard.data.roster).toEqual([
    {
      name: "Ana Silva",
      title: "Principal analyst",
      type: "Employee",
      leader: "Marta",
      location: "Brazil",
      start: "2024-02-01",
      end: "",
      status: "Active",
    },
    {
      name: "Jo Costa",
      title: "Designer",
      type: "Contractor",
      leader: "Marta",
      location: "Brazil",
      start: "2026-04-01",
      end: "",
      status: "Active",
    },
  ])
  const version = (dashboard.data.versions as {
    hc: { positions: Record<string, unknown>[] }
  }[])[0]
  expect(version.hc.positions).toEqual([
    expect.objectContaining({
      id: "ana-position",
      name: "Ana Silva",
      title: "Senior analyst",
      domain: "Manual domain",
      domainManual: true,
      rateOverride: 70000,
      role: "Preserved role",
    }),
    expect.objectContaining({ id: "departed-position", left: true }),
    expect.objectContaining({ name: "Jo Costa", start: 4, end: 12 }),
  ])
  expect(version.hc.positions[2].id).toBe("generated-1")
  expect(version.hc.positions[0].title).toBe("Senior analyst")
  expect(version.hc.positions[0].type).toBe("Employee")
  expect(dashboard.versions["roster:file"].version).toBe(1)
  expect(dashboard.versions["plan:positions:sync"].version).toBe(1)
  expect(dashboard.versions["plan:positions:ana-position"].version).toBe(1)
  expect(dashboard.versions["plan:positions:generated-1"].version).toBe(1)
  const roster = dashboard.data.roster as Record<string, unknown>[]
  roster.forEach((person) =>
    expect(Object.keys(person).sort()).toEqual(
      ["end", "leader", "location", "name", "start", "status", "title", "type"].sort(),
    ),
  )
})

test("the Dashboard auxiliary tab is accepted only with All Members and unknown sheets still fail atomically", () => {
  const state = snapshot()
  const before = structuredClone(state)
  expect(
    importSheets(state, {
      "Summary by Leader": [{ Leader: "Marta", "Total HC": 2 }],
    }),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  expect(
    importSheets(state, {
      "All Members": [{ Name: "Jo Costa", "Start Date": "2026-04-01", Status: "Active" }],
      "Summary by Leader": [{ Leader: "Marta", "Total HC": 999 }],
      "Unknown source": [{ Name: "Injected" }],
    }),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
})

test("a stale position revision rejects the workbook import without applying roster or position changes", () => {
  generated = 0
  const state = snapshot()
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Headcount",
        action: "import-workbook",
        version: 0,
        values: {
          versionId: "plan",
          sheets: {
            "All Members": [
              {
                Name: "Ana Silva",
                Title: "Changed title",
                Type: "Employee",
                Leader: "Marta",
                Location: "Brazil",
                "Start Date": "2024-02-01",
                "End Date": "",
                Status: "Active",
              },
              {
                Name: "Jo Costa",
                Title: "Designer",
                Type: "Contractor",
                Leader: "Marta",
                Location: "Brazil",
                "Start Date": "2026-04-01",
                "End Date": "",
                Status: "Active",
              },
            ],
            "Summary by Leader": [{ Leader: "Marta", "Total HC": 2 }],
          },
          versions: {
            "roster:file": 0,
            "plan:positions:sync": 0,
            "plan:positions:departed-position": 1,
          },
        },
      },
      environment,
    ),
  ).toMatchObject({ ok: false, status: 409 })
  expect(state).toEqual(before)
})

test("members roster imports persist while a locked plan keeps all positions unchanged", () => {
  const state = snapshot(true)
  const beforePositions = structuredClone(
    (state.data.versions as { hc: { positions: unknown[] } }[])[0].hc.positions,
  )
  expect(
    importSheets(state, {
      "All Members": [{
        Name: "Jo Costa",
        Title: "Designer",
        Type: "Contractor",
        Leader: "Marta",
        Location: "Brazil",
        "Start Date": "2026-04-01",
        "End Date": "",
        Status: "Active",
        Classification: "Not a roster field",
        Outlook: "Not a roster field",
        Notes: "Not a roster field",
      }],
      "Summary by Leader": [{ Leader: "Marta", "Total HC": 1000 }],
    }),
  ).toMatchObject({ ok: true })
  expect((state.data.roster as Record<string, unknown>[]).map((person) => person.name)).toEqual(["Jo Costa"])
  expect((state.data.versions as { hc: { positions: unknown[] } }[])[0].hc.positions).toEqual(beforePositions)
  expect(state.versions["roster:file"].version).toBe(1)
  expect(state.versions["plan:positions:sync"]).toBeUndefined()
})

test("OPEX and CAPEX compare grids show all seven original fiscal measures with closed actuals and forecast overrides", () => {
  const state = snapshot()
  const version = (state.data.versions as Record<string, unknown>[])[0]
  version.lines = [
    {
      id: "opex-line",
      sec: "opex",
      el: "licenses",
      name: "OPEX compare row",
      cur: "USD",
      b: [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210],
      a: [80, 90, null, null, null, null, null, null, null, null, null, null],
      f: [null, null, 200, 210, null, null, null, null, null, null, null, null],
      bm: Array.from({ length: 12 }, () => true),
    },
    {
      id: "capex-line",
      sec: "capex",
      proj: "project",
      el: "services",
      cls: "capex",
      name: "CAPEX compare row",
      cur: "USD",
      b: [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160],
      a: [40, 50, null, null, null, null, null, null, null, null, null, null],
      f: [null, null, 100, 110, null, null, null, null, null, null, null, null],
      bm: Array.from({ length: 12 }, () => true),
    },
  ]
  version.projects = [{ id: "project", name: "Compare project", code: "C-1", owner: "" }]
  const data = domain.view(state, actor, environment).data
  const context = { actor, year: 2026, month: 11, at, versions: state.versions }
  const measures = ["Budget FY", "Budget YTD", "Actual YTD", "YTD var", "Outlook FY", "FY var", "Var%"]
  const expected = {
    OPEX: ["$1,860.00", "$210.00", "$170.00", "-$40.00", "$1,980.00", "$120.00", "6.45%"],
    CAPEX: ["$1,260.00", "$110.00", "$90.00", "-$20.00", "$1,300.00", "$40.00", "3.17%"],
  }
  for (const page of ["OPEX", "CAPEX"] as const) {
    const html = render(page, { ...data, mode: "compare" }, context)!
    for (const measure of measures) expect(html).toMatch(new RegExp(`<th[^>]*>${measure}</th>`))
    expect(html).toContain(page === "OPEX" ? "OPEX compare row" : "CAPEX compare row")
    const compareRow = html.match(/<tr>[\s\S]*?<\/tr>/g)?.find((row) => row.includes(`${page} compare row`))
    expect(compareRow).toBeDefined()
    for (const value of expected[page]) expect(compareRow).toContain(value)
  }
})
