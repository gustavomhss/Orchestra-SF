import { expect, test } from "bun:test"
import { domain, pages, render } from "../runtime/dashboard-budget.ts"
import { configure } from "../runtime/admin.ts"
import type { Snapshot } from "../runtime/contract.ts"
const actor = { id: "directory-admin", canWrite: true, roles: ["admin"] }
const at = "2026-11-11T12:00:00Z"
function snapshot(): Snapshot {
  return { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
}
test("dashboard-budget required pages contain functional controls or nonempty read views", () => {
  for (const page of pages) {
    const html = render(page, {}, { actor, year: 2026, month: 11, at, versions: {} })
    expect(html).toBeString()
    expect(html!.length).toBeGreaterThan(80)
    expect(html).toMatch(/<table|<form|class="metric"/)
  }
})
test("dashboard-budget direct write without canWrite fails atomically", () => {
  const state = snapshot()
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      { ...actor, canWrite: false },
      { page: pages[0], action: "save", version: 0, values: {} },
      { at, id: () => "server-id", directory: [] },
    ),
  ).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
})

test("OPEX stores monthly zero, keeps annual fallback and sums all twelve actuals", () => {
  const state = snapshot()
  state.data.opexOwners = [{ id: "o", name: "Owner", budget: 1200 }]
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "OPEX Detail",
        action: "save-entry",
        id: "",
        version: 0,
        values: {
          ownerId: "o",
          year: 2026,
          month: 12,
          budget: 0,
          actual: 70,
          forecast: 110,
        },
      },
      { at, id: () => "entry", directory: [] },
    ),
  ).toMatchObject({ ok: true })
  expect(state.data.opexEntries).toEqual([
    {
      id: "entry",
      ownerId: "o",
      year: 2026,
      month: 12,
      budget: 0,
      actual: 70,
      forecast: 110,
    },
  ])
  const html = render(
    "Executive Dashboard",
    domain.view(state, actor, { at, id: () => "unused", directory: [] }).data,
    { actor, year: 2026, month: 1, at, versions: state.versions },
  )
  expect(html).toContain("$1200")
  expect(html).toContain("$70")
})
test("year amount remainder and clear preserve stored months", () => {
  const state = snapshot()
  state.data.opexOwners = [{ id: "o", name: "Owner", budget: 1200 }]
  state.data.budgetCurrentMonth = { 2026: 3 }
  let serial = 0
  const env = { at, id: () => `id-${++serial}`, directory: [] }
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "OPEX Detail",
        action: "year-amount",
        id: "o",
        version: 0,
        values: { year: 2026, month: 3, amount: 100 },
      },
      env,
    ),
  ).toMatchObject({ ok: true })
  const entries = state.data.opexEntries as Record<string, unknown>[]
  expect(entries.slice(0, 3).map((e) => e.actual)).toEqual([33.33, 33.33, 33.34])
  expect(entries.map((e) => e.forecast)).toEqual(Array(12).fill(33.33))
  const before = structuredClone(entries)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "OPEX Detail",
        action: "year-amount",
        id: "o",
        version: 1,
        values: { year: 2026, month: 3, amount: "" },
      },
      env,
    ),
  ).toMatchObject({ ok: true })
  expect(state.data.opexEntries).toEqual(before)
})

test("per-record CAS allows independent owners and rejects stale update without audit", () => {
  const state = snapshot()
  state.data.opexOwners = [
    { id: "a", name: "A", budget: 12 },
    { id: "b", name: "B", budget: 24 },
  ]
  const env = { at, id: () => "unused", directory: [] }
  for (const id of ["a", "b"])
    expect(
      domain.execute(
        state,
        actor,
        {
          page: "OPEX Detail",
          action: "save",
          id,
          version: 0,
          values: { name: id, budget: 120 },
        },
        env,
      ),
    ).toMatchObject({ ok: true })
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "OPEX Detail",
        action: "save",
        id: "a",
        version: 0,
        values: { name: "stale", budget: 7 },
      },
      env,
    ),
  ).toMatchObject({
    ok: false,
    status: 409,
    by: actor.id,
    stored: { name: "a", budget: 120 },
  })
  expect(state).toEqual(before)
  expect(state.versions["opexOwners:b"]?.version).toBe(1)
})
test("domain leader uses stored allowlist, never domain or contributor assignment", () => {
  const state = snapshot()
  state.data.opexOwners = [
    { id: "a", name: "A", budget: 12 },
    { id: "b", name: "B", budget: 24 },
  ]
  state.data.budgetLineIds = { leader: ["opexOwners:a"] }
  const env = { at, id: () => "unused", directory: [] }
  const command = {
    page: "OPEX Detail",
    action: "save",
    id: "a",
    version: 0,
    values: { name: "A", budget: 120 },
  }
  expect(domain.execute(state, { id: "leader", roles: ["domain leader"], canWrite: true }, command, env)).toMatchObject(
    { ok: true },
  )
  const before = structuredClone(state)
  expect(
    domain.execute(state, { id: "leader", roles: ["domain leader"], canWrite: true }, { ...command, id: "b" }, env),
  ).toMatchObject({ ok: false, status: 403 })
  expect(
    domain.execute(
      state,
      {
        id: "leader",
        roles: ["contributor"],
        canWrite: true,
        assigned: ["OPEX Detail"],
      },
      { ...command, version: 1 },
      env,
    ),
  ).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
})
test("annual entry has no final remainder; year amount current month is server stored", () => {
  const state = snapshot()
  state.data.opexOwners = [{ id: "o", name: "O", budget: 100000 }]
  state.data.budgetCurrentMonth = { 2026: 3 }
  let serial = 0
  const env = { at, id: () => `e-${++serial}`, directory: [] }
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "OPEX Detail",
        action: "annual-entry",
        id: "o",
        version: 0,
        values: { year: 2026, annual: 100000 },
      },
      env,
    ),
  ).toMatchObject({ ok: true })
  const entries = state.data.opexEntries as Record<string, unknown>[]
  expect(entries.map((row) => row.budget)).toEqual(Array(12).fill(8333.33))
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "OPEX Detail",
        action: "year-amount",
        id: "o",
        version: 0,
        values: {
          year: 2026,
          month: 9,
          amount: 100,
          versions: Object.fromEntries(Object.entries(state.versions).map(([key, value]) => [key, value.version])),
        },
      },
      env,
    ),
  ).toMatchObject({ ok: true })
  expect((state.data.opexEntries as Record<string, unknown>[]).slice(0, 4).map((row) => row.actual)).toEqual([
    33.33, 33.33, 33.34, 0,
  ])
})
test("import matches first case-insensitive owner, rounds whole monthly fallback and preserves actuals", () => {
  const state = snapshot()
  state.data.opexOwners = [
    { id: "a", name: "Alpha", budget: 0 },
    { id: "b", name: "ALPHA", budget: 0 },
  ]
  state.data.opexEntries = [{ id: "e", ownerId: "a", year: 2026, month: 1, actual: 90, forecast: 80 }]
  let serial = 0
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "OPEX Detail",
        action: "import",
        version: 0,
        values: {
          year: 2026,
          rows: [{ name: "alpha", Annual: 100000, months: {} }],
        },
      },
      { at, id: () => `new-${++serial}`, directory: [] },
    ),
  ).toMatchObject({ ok: true })
  expect((state.data.opexOwners as unknown[]).length).toBe(2)
  const entries = state.data.opexEntries as Record<string, unknown>[]
  expect(entries.length).toBe(12)
  expect(entries.every((row) => row.ownerId === "a" && row.budget === 8333)).toBe(true)
  expect(entries[0]).toMatchObject({ actual: 90, forecast: 80 })
})
test("owner deletion spans years while leaving YTD/deviations; CAPEX deletion leaves PMO", () => {
  const state = snapshot()
  state.data.opexOwners = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ]
  state.data.opexEntries = [
    { id: "x", ownerId: "a", year: 2025 },
    { id: "y", ownerId: "a", year: 2026 },
    { id: "z", ownerId: "b", year: 2026 },
  ]
  state.data.budgetYtd = { opex: { "2026:a": { amount: 3 } } }
  state.data.deviations = [{ ownerId: "a" }]
  state.data.capexProjects = [{ id: "p", name: "Budget" }]
  state.data.capexEntries = [{ id: "c", projectId: "p", year: 2026 }]
  state.data.projects = [{ id: "p", name: "PMO" }]
  const env = { at, id: () => "unused", directory: [] }
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "OPEX Detail",
        action: "delete",
        id: "a",
        version: 0,
        values: {},
      },
      env,
    ),
  ).toMatchObject({ ok: true })
  expect(state.data.opexEntries).toEqual([{ id: "z", ownerId: "b", year: 2026 }])
  expect(state.data.budgetYtd).toEqual({ opex: { "2026:a": { amount: 3 } } })
  expect(state.data.deviations).toEqual([{ ownerId: "a" }])
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "CAPEX Projects",
        action: "delete",
        id: "p",
        version: 0,
        values: {},
      },
      env,
    ),
  ).toMatchObject({ ok: true })
  expect(state.data.capexEntries).toEqual([])
  expect(state.data.projects).toEqual([{ id: "p", name: "PMO" }])
})
test("budget overview uses singleton CAS, deletes zero revenue and retains flat chart", () => {
  const state = snapshot()
  state.data.opexOwners = [{ id: "o", budget: 1200 }]
  state.data.opexEntries = [
    {
      id: "e",
      ownerId: "o",
      year: 2026,
      month: 1,
      budget: 200,
      actual: 100,
      forecast: 90,
    },
  ]
  const env = { at, id: () => "unused", directory: [] }
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Budget Overview",
        action: "save-revenue",
        version: 0,
        values: { year: 2026, revenue: 10000 },
      },
      env,
    ),
  ).toMatchObject({ ok: true })
  const html = render("Budget Overview", domain.view(state, actor, env).data, {
    actor,
    year: 2026,
    month: 11,
    at,
    versions: state.versions,
  })
  expect(html).toContain("$1300")
  expect(html).toContain("13.00%")
  expect(html).toContain("$108.33333333333333")
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Budget Overview",
        action: "save-revenue",
        version: 1,
        values: { year: 2026, revenue: "" },
      },
      env,
    ),
  ).toMatchObject({ ok: true })
  expect(state.data.revenueByYear).toEqual({})
})
test("view never exposes talent or unrelated private data; invalid actions do not mutate", () => {
  const state = snapshot()
  state.data.members = [
    {
      id: "m",
      name: "Private",
      cls: "secret",
      notes: "hidden",
      status: "Active",
    },
  ]
  state.data.bank = { iban: "secret" }
  const env = { at, id: () => "unused", directory: [] }
  const view = domain.view(state, { id: "v", roles: ["viewer"], canWrite: false }, env)
  expect(JSON.stringify(view)).not.toContain("secret")
  expect(view.data.members).toBeUndefined()
  const before = structuredClone(state)
  expect(
    domain.execute(state, actor, { page: "CAPEX Projects", action: "import", version: 0, values: {} }, env),
  ).toMatchObject({ ok: false, status: 400 })
  expect(domain.execute(state, actor, { page: "unknown", action: "save", version: 0, values: {} }, env)).toMatchObject({
    ok: false,
    status: 400,
  })
  expect(state).toEqual(before)
})
test("bulk entry conflict rolls back earlier prepared writes and YTD hint", () => {
  const state = snapshot()
  state.data.opexOwners = [{ id: "o", name: "O", budget: 1200 }]
  state.data.opexEntries = [{ id: "old", ownerId: "o", year: 2026, month: 8, actual: 500 }]
  state.versions["opexEntries:old"] = { version: 9, by: "other" }
  const before = structuredClone(state)
  let serial = 0
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "OPEX Detail",
        action: "year-amount",
        id: "o",
        version: 0,
        values: { year: 2026, amount: 100 },
      },
      { at, id: () => `new-${++serial}`, directory: [] },
    ),
  ).toMatchObject({
    ok: false,
    status: 409,
    by: "other",
    stored: { actual: 500 },
  })
  expect(state).toEqual(before)
})
test("executive users zero, fallback month, yearly benchmark and selected-year attrition", () => {
  const state = snapshot()
  state.data.opexOwners = [{ id: "o", name: "O", budget: 1200 }]
  state.data.members = [
    { id: "a", status: "Active" },
    { id: "b", status: "On Leave" },
    { id: "c", status: "Terminated", end: "2025-02-01" },
  ]
  state.data.itUsersMonthly = [{ id: "u", year: 2025, month: 1, users: 10 }]
  state.data.costPerUserBenchmarks = [{ id: "b", year: 2025, value: 120 }]
  const env = { at, id: () => "unused", directory: [] }
  const html = render("Executive Dashboard", domain.view(state, actor, env).data, {
    actor,
    year: 2025,
    month: 2,
    at,
    versions: {},
  })
  expect(html).toContain("$120")
  expect(html).toContain("66.66666666666666%")
  expect(html).toContain('data-tone="green"')
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Executive Dashboard",
        action: "save-users",
        version: 0,
        values: { year: 2025, month: 2, value: "" },
      },
      env,
    ),
  ).toMatchObject({ ok: true })
  expect((state.data.itUsersMonthly as Record<string, unknown>[]).at(-1)).toMatchObject({ users: 0 })
  const zero = render("Executive Dashboard", domain.view(state, actor, env).data, {
    actor,
    year: 2025,
    month: 2,
    at,
    versions: state.versions,
  })
  expect(zero).toContain("$0")
})
test("CAPEX create/edit status and annual field are independent from PMO", () => {
  const state = snapshot()
  let serial = 0
  const env = { at, id: () => `id-${++serial}`, directory: [] }
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "CAPEX Projects",
        action: "save",
        version: 0,
        values: { name: "Budget project", budget: 1200 },
      },
      env,
    ),
  ).toMatchObject({ ok: true, value: { status: "In Progress" } })
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "CAPEX Projects",
        action: "save",
        id: "id-1",
        version: 1,
        values: { name: "Renamed", budget: 1200 },
      },
      env,
    ),
  ).toMatchObject({ ok: true, value: { status: "In Progress" } })
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "CAPEX Projects",
        action: "annual-entry",
        id: "id-1",
        version: 2,
        values: { year: 2026, annual: 100000, field: "forecast" },
      },
      env,
    ),
  ).toMatchObject({ ok: true })
  expect((state.data.capexEntries as Record<string, unknown>[]).map((row) => row.forecast)).toEqual(
    Array(12).fill(8333.33),
  )
  expect((state.data.capexProjects as Record<string, unknown>[])[0]?.budget).toBe(1200)
})
test("executive derived ops, SLA, security and performance expose no raw records", () => {
  const state = snapshot()
  state.data.opsTickets = [
    {
      id: "j",
      year: 2026,
      month: 1,
      "Infrastructure|Incidents|Open": 50,
      "Infrastructure|Incidents|Closed": 10,
    },
    {
      id: "f",
      year: 2026,
      month: 2,
      "Infrastructure|Incidents|Open": 10,
      "Infrastructure|Incidents|Closed": 15,
    },
  ]
  state.data.opsSLA = [
    { year: 2026, month: 1, incSLA: 90, svcSLA: 80 },
    { year: 2026, month: 2, incSLA: 100, svcSLA: 90 },
  ]
  state.data.opsHeatmap = [{ year: 2026, month: 2, p1: 1 }]
  state.data.secKpi = [
    { year: 2026, month: 1, training: 96, socCritical: 2, socPending: 1 },
    { year: 2026, month: 2, training: "" },
  ]
  state.data.secIncidents = [
    {
      id: "i",
      title: "Private",
      contained: true,
      remediated: true,
      rootCause: false,
      notes: "secret",
    },
  ]
  state.data.itperf = {
    items: [
      {
        subs: [{ status: "ahead" }, { status: "complete" }, { status: "behind" }],
      },
    ],
  }
  const env = { at, id: () => "unused", directory: [] }
  const view = domain.view(state, actor, env)
  const monthly = (view.data.executiveMonths as Record<string, Record<string, unknown>>)["2026:2"]!
  expect(monthly).toMatchObject({
    opened: 10,
    closed: 15,
    backlog: 0,
    backlogYtd: 0,
    incYtd: 95,
    svcYtd: 85,
    p1: 1,
    openIncidents: 1,
  })
  expect(monthly.kpis).toContainEqual({
    key: "training",
    value: 96,
    status: "Good",
  })
  expect(monthly.kpis).toContainEqual({
    key: "socClosure",
    value: 50,
    status: "High risk",
  })
  expect(view.data.executive).toMatchObject({ onTarget: 2 })
  expect(JSON.stringify(view)).not.toContain("secret")
})
test("deviation writes original collection with record CAS and escaped display", () => {
  const state = snapshot()
  state.data.opexOwners = [{ id: "o", name: "<Owner>", budget: 1200 }]
  const env = { at, id: () => "unused", directory: [] }
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "OPEX Detail",
        action: "save-deviation",
        id: "o",
        version: 0,
        values: { year: 2026, month: 1, flag: "dev-red", text: "Investigate" },
      },
      env,
    ),
  ).toMatchObject({ ok: true })
  expect(state.data.deviations).toEqual({
    "opex-o-2026-1": { flag: "dev-red", text: "Investigate" },
  })
  expect(state.versions["deviations:opex-o-2026-1"]?.version).toBe(1)
  const html = render("OPEX Detail", domain.view(state, actor, env).data, {
    actor,
    year: 2026,
    month: 1,
    at,
    versions: state.versions,
  })
  expect(html).toContain("&lt;Owner&gt;")
  expect(html).toContain("Investigate")
  expect(html).toContain("opex-template.xlsx")
})
test("OPEX import uses file boundary and hidden versions, without a JSON editor", () => {
  const html = render("OPEX Detail", {}, { actor, year: 2026, month: 11, at, versions: {} })!
  expect(html).toContain('data-workbook="opex"')
  expect(html).toContain('accept=".xlsx"')
  expect(html).toContain('href="?download=opex-template"')
  expect(html).not.toContain("<textarea")
  expect(html).toContain('type="hidden" name="versions"')
})
test("changing current month only marks YTD stale and singleton versions span years", () => {
  const state = snapshot()
  state.data.opexOwners = [{ id: "o", name: "O", budget: 1200 }]
  state.data.budgetCurrentMonth = { 2026: 3 }
  let serial = 0
  const env = { at, id: () => `e-${++serial}`, directory: [] }
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "OPEX Detail",
        action: "year-amount",
        id: "o",
        version: 0,
        values: { year: 2026, amount: 100 },
      },
      env,
    ),
  ).toMatchObject({ ok: true })
  const entries = structuredClone(state.data.opexEntries)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Budget Overview",
        action: "save-month",
        version: 0,
        values: { year: 2026, month: 4 },
      },
      env,
    ),
  ).toMatchObject({ ok: true })
  expect(state.data.opexEntries).toEqual(entries)
  expect(
    render("OPEX Detail", domain.view(state, actor, env).data, {
      actor,
      year: 2026,
      month: 4,
      at,
      versions: state.versions,
    }),
  ).toContain("hint is stale")
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Budget Overview",
        action: "save-month",
        version: 0,
        values: { year: 2025, month: 1 },
      },
      env,
    ),
  ).toMatchObject({ ok: false, status: 409 })
  expect(state).toEqual(before)
})
test("monthly departures require Terminated for current and selected years", () => {
  const state = snapshot()
  state.data.members = [
    { id: 0, status: "Terminated", end: "2026-11-02" },
    { id: 1, status: "On Leave", end: "2026-11-03" },
    { id: 2, status: "Active", end: "2026-11-04" },
    { id: 3, status: "Terminated", end: "2025-02-05" },
    { id: 4, status: "On Leave", end: "2025-02-06" },
  ]
  const env = { at, id: () => "unused", directory: [] }
  const view = domain.view(state, actor, env)
  expect(view.data.executive).toMatchObject({
    monthlyDepartures: 1,
    departures: 1,
  })
  const years = view.data.executiveByYear as Record<string, { monthlyDepartures: number[]; departures: number }>
  expect(years["2026"]?.monthlyDepartures[10]).toBe(1)
  expect(years["2025"]?.monthlyDepartures[1]).toBe(1)
  expect(years["2025"]?.departures).toBe(1)
})
test("Executive backlog ignores Initial Balance and clamps negative opened minus closed", () => {
  const state = snapshot()
  state.data.opsCats = ["Infrastructure"]
  state.data.opsTickets = [
    {
      id: "jan",
      year: 2026,
      month: 1,
      "Infrastructure|Incidents|Initial Balance": 100,
      "Infrastructure|Incidents|Open": 10,
      "Infrastructure|Incidents|Closed": 15,
    },
    {
      id: "feb",
      year: 2026,
      month: 2,
      "Infrastructure|Incidents|Initial Balance": 200,
      "Infrastructure|Incidents|Open": 20,
      "Infrastructure|Incidents|Closed": 8,
      "Infrastructure|Service Requests|Initial Balance": 300,
      "Infrastructure|Service Requests|Open": 3,
      "Infrastructure|Service Requests|Closed": 2,
    },
  ]
  const env = { at, id: () => "unused", directory: [] }
  const months = domain.view(state, actor, env).data.executiveMonths as Record<string, Record<string, unknown>>
  expect(months["2026:1"]).toMatchObject({
    opened: 10,
    closed: 15,
    backlog: 0,
    backlogYtd: 0,
  })
  expect(months["2026:2"]).toMatchObject({
    opened: 23,
    closed: 10,
    backlog: 13,
    backlogYtd: 13,
  })
  expect(months["2026:3"]).toMatchObject({
    opened: 0,
    closed: 0,
    backlog: 0,
    backlogYtd: 13,
  })
})
test("aggregate member reads audit every member and reveal no talent or change versions", () => {
  const env = { at, id: () => "unused", directory: [] }
  for (const roles of [["admin"], ["domain leader"], ["viewer"]]) {
    const state = snapshot()
    state.data.members = [
      {
        id: 0,
        status: "Active",
        cls: "private classification",
        outlook: "private outlook",
        notes: "private notes",
      },
      { id: "other", status: "On Leave", notes: "other private notes" },
    ]
    state.versions["members:0"] = { version: 5, by: "writer" }
    const before = structuredClone(state.data)
    const versions = structuredClone(state.versions)
    const reader = { id: "directory-reader", roles, canWrite: false }
    const view = domain.view(state, reader, env)
    expect(state.audit).toEqual([
      { who: reader.id, at, record: "members:0", was: null, became: null },
      { who: reader.id, at, record: "members:other", was: null, became: null },
    ])
    expect(state.data).toEqual(before)
    expect(state.versions).toEqual(versions)
    expect(JSON.stringify(view)).not.toContain("private")
    expect(view.data.members).toBeUndefined()
    domain.view(state, reader, env)
    expect(state.audit.length).toBe(4)
  }
  const denied = snapshot()
  denied.data.members = [{ id: "hidden", status: "Active" }]
  expect(domain.view(denied, { id: "none", roles: [], canWrite: false }, env)).toEqual({ data: {}, versions: {} })
  expect(denied.audit).toEqual([])
})
test("CAPEX legacy parent cannot be overridden to bypass stored allowlist", () => {
  const state = snapshot()
  state.data.capexProjects = [
    { id: 1, name: "A", budget: 1200 },
    { id: 2, name: "B", budget: 2400 },
  ]
  state.data.capexEntries = [
    {
      id: "entry",
      projectId: 1,
      year: 2026,
      month: 1,
      budget: 100,
      actual: 7,
      forecast: 8,
    },
  ]
  state.data.budgetLineIds = { leaderB: ["capexProjects:2"], leaderA: ["capexProjects:1"] }
  const env = { at, id: () => "unused", directory: [] }
  const command = {
    page: "CAPEX Projects",
    action: "save-entry",
    id: "entry",
    version: 0,
    values: { projId: 2, year: 2026, month: 1, actual: 33 },
  }
  const before = structuredClone(state)
  expect(
    domain.execute(state, { id: "leaderB", roles: ["domain leader"], canWrite: true }, command, env),
  ).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
  expect(domain.execute(state, actor, command, env)).toMatchObject({
    ok: false,
    status: 422,
  })
  expect(state).toEqual(before)
  expect(
    domain.execute(
      state,
      actor,
      {
        ...command,
        values: { projectId: 2, year: 2026, month: 1, actual: 33 },
      },
      env,
    ),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  expect(
    domain.execute(
      state,
      { id: "leaderA", roles: ["domain leader"], canWrite: true },
      { ...command, values: { projId: 1, year: 2026, month: 1, actual: 33 } },
      env,
    ),
  ).toMatchObject({ ok: true })
  expect(state.data.capexEntries).toEqual([
    {
      id: "entry",
      projId: 1,
      year: 2026,
      month: 1,
      budget: 100,
      actual: 33,
      forecast: 8,
    },
  ])
  expect(state.audit[0]?.was).toMatchObject({ projectId: 1 })
  expect(state.audit[0]?.became).toMatchObject({ projId: 1 })
  expect(state.audit[0]?.became).not.toHaveProperty("projectId")
  const html = render("Executive Dashboard", domain.view(state, actor, env).data, {
    actor,
    year: 2026,
    month: 1,
    at,
    versions: state.versions,
  })
  expect(html).toContain("$33")
  expect(html).not.toContain("$66")
})
test("monthly upsert without id retains existing actual and forecast before applying defaults", () => {
  const env = { at, id: () => "must-not-create", directory: [] }
  for (const page of ["OPEX Detail", "CAPEX Projects"]) {
    const state = snapshot()
    const capex = page === "CAPEX Projects"
    state.data[capex ? "capexProjects" : "opexOwners"] = [{ id: 10, name: "Line", budget: 1200 }]
    state.data[capex ? "capexEntries" : "opexEntries"] = [
      {
        id: 20,
        ...(capex ? { projectId: 10 } : { ownerId: 10 }),
        year: 2026,
        month: 1,
        budget: 100,
        actual: 75,
        forecast: 95,
      },
    ]
    state.versions[`${capex ? "capexEntries" : "opexEntries"}:20`] = {
      version: 4,
      by: "previous",
    }
    expect(
      domain.execute(
        state,
        actor,
        {
          page,
          action: "save-entry",
          version: 4,
          values: {
            [capex ? "projId" : "ownerId"]: 10,
            year: 2026,
            month: 1,
            budget: 200,
          },
        },
        env,
      ),
    ).toMatchObject({ ok: true })
    expect(state.data[capex ? "capexEntries" : "opexEntries"]).toEqual([
      {
        id: 20,
        ...(capex ? { projId: 10 } : { ownerId: 10 }),
        year: 2026,
        month: 1,
        budget: 200,
        actual: 75,
        forecast: 95,
      },
    ])
    expect(state.audit[0]?.record).toBe(`${capex ? "capexEntries" : "opexEntries"}:20`)
    const before = structuredClone(state)
    expect(
      domain.execute(
        state,
        actor,
        {
          page,
          action: "save-entry",
          version: 4,
          values: {
            [capex ? "projId" : "ownerId"]: 10,
            year: 2026,
            month: 1,
            budget: 300,
          },
        },
        env,
      ),
    ).toMatchObject({ ok: false, status: 409 })
    expect(state).toEqual(before)
  }
})
test("render month fallback matches execution December past and January future", () => {
  const env = { at, id: () => "unused", directory: [] }
  for (const [year, month] of [
    [2025, 12],
    [2027, 1],
  ]) {
    const state = snapshot()
    state.data.opexOwners = [{ id: "o", name: "O", budget: 1200 }]
    state.data.budgetYtd = {
      opex: { [`${year}:o`]: { amount: 100, months: month } },
    }
    const data = domain.view(state, actor, env).data
    const context = { actor, year: year!, month: 6, at, versions: {} }
    expect(render("Budget Overview", data, context)).toContain(`name="month" type="number" value="${month}"`)
    expect(render("OPEX Detail", data, context)).not.toContain("hint is stale")
    state.data.budgetYtd = {
      opex: { [`${year}:o`]: { amount: 100, months: 6 } },
    }
    expect(render("OPEX Detail", domain.view(state, actor, env).data, context)).toContain("hint is stale")
  }
  const data = { budgetCurrentMonth: { 2025: 4 } }
  expect(
    render("Budget Overview", data, {
      actor,
      year: 2025,
      month: 6,
      at,
      versions: {},
    }),
  ).toContain('name="month" type="number" value="4"')
})
test("capped utilization drives visible color; overview renders progress and flat graph", () => {
  const data = {
    opexOwners: [{ id: "o", name: "O", budget: 1200 }],
    opexEntries: [
      {
        id: "e1",
        ownerId: "o",
        year: 2026,
        month: 1,
        budget: 200,
        actual: 250,
      },
      { id: "e2", ownerId: "o", year: 2026, month: 2, actual: 90 },
    ],
  }
  const context = { actor, year: 2026, month: 1, at, versions: {} }
  const detail = render("OPEX Detail", data, context)!
  expect(detail).toContain('data-utilization="100" data-tone="amber" style="color:#b45309"')
  expect(detail).toContain('data-utilization="90" data-tone="teal" style="color:#0f766e"')
  expect(detail).not.toContain('data-utilization="125"')
  const overview = render("Budget Overview", data, context)!
  expect(overview).toContain('<progress aria-label="Actuals / budget"')
  expect(overview).toContain('value="26.153846153846157"')
  expect(overview).toContain('<svg role="img"')
  expect(overview).toContain('data-budget-series="flat"')
  const points = overview.match(/data-budget-series="flat" points="([^"]+)"/)![1]!.split(" ")
  expect(points.length).toBe(12)
  expect(new Set(points.map((point) => point.split(",")[1])).size).toBe(1)
  expect(overview.match(/Month \d+: \$108\.33333333333333/g)?.length).toBe(12)
})

test("same-id budget grants isolate both collections in server mutations and rendered controls", () => {
  for (const granted of ["opexOwners:7", "capexProjects:7"]) {
    const state = snapshot()
    state.data.opexOwners = [{ id: 7, name: "Licenses", budget: 1200 }]
    state.data.capexProjects = [{ id: "7", name: "Infrastructure", budget: 2400 }]
    state.data.opexEntries = [{ id: "opex-entry", ownerId: 7, year: 2026, month: 1, actual: 10 }]
    state.data.capexEntries = [{ id: "capex-entry", projectId: "7", year: 2026, month: 1, actual: 20 }]
    const leader = { id: "directory-leader", roles: ["domain leader"], canWrite: true }
    const environment = { at, id: () => "unused", directory: [{ id: leader.id, name: "Directory Leader" }] }
    expect(
      configure(
        state,
        "dashboard",
        actor,
        {
          page: "Executive Dashboard",
          action: "configure-budget-lines",
          version: 0,
          values: { person: leader.id, lines: [granted] },
        },
        environment,
      ),
    ).toEqual({ ok: true })
    for (const page of ["OPEX Detail", "CAPEX Projects"]) {
      const capex = page === "CAPEX Projects"
      const entryId = capex ? "capex-entry" : "opex-entry"
      const permitted = granted === (capex ? "capexProjects:7" : "opexOwners:7")
      const context = { actor: leader, year: 2026, month: 1, at, versions: state.versions }
      const html = render(page, domain.view(state, leader, environment).data, context)!
      const rowForm = html.match(/<form\b[^>]*data-command="save"[^>]*data-record="7"[^>]*>[\s\S]*?<\/form>/)?.[0]
      const entryForm = html.match(
        new RegExp(`<form\\b[^>]*data-command="save-entry"[^>]*data-record="${entryId}"[^>]*>[\\s\\S]*?<\\/form>`),
      )?.[0]
      expect(rowForm).toBeDefined()
      expect(entryForm).toBeDefined()
      expect(rowForm!.includes('type="submit" disabled')).toBe(!permitted)
      expect(entryForm!.includes('type="submit" disabled')).toBe(!permitted)
      const before = structuredClone(state)
      const save = domain.execute(
        state,
        leader,
        { page, action: "save", id: "7", version: 0, values: { name: "Updated", budget: 3600 } },
        environment,
      )
      const entry = domain.execute(
        state,
        leader,
        {
          page,
          action: "save-entry",
          id: entryId,
          version: 0,
          values: { [capex ? "projId" : "ownerId"]: 7, year: 2026, month: 1, actual: 99 },
        },
        environment,
      )
      if (permitted) {
        expect(save).toMatchObject({ ok: true })
        expect(entry).toMatchObject({ ok: true })
        expect(state.data[capex ? "capexEntries" : "opexEntries"]).toEqual([
          expect.objectContaining({ id: entryId, actual: 99 }),
        ])
        continue
      }
      expect(save).toMatchObject({ ok: false, status: 403 })
      expect(entry).toMatchObject({ ok: false, status: 403 })
      expect(state).toEqual(before)
    }
  }
})

test("raw legacy budget grants fail closed while admin needs no grants", () => {
  for (const grants of [undefined, [], ["7"]]) {
    const state = snapshot()
    state.data.opexOwners = [{ id: 7, name: "Licenses", budget: 1200 }]
    state.data.capexProjects = [{ id: 7, name: "Infrastructure", budget: 2400 }]
    state.data.opexEntries = [{ id: "opex-entry", ownerId: 7, year: 2026, month: 1, actual: 10 }]
    state.data.capexEntries = [{ id: "capex-entry", projectId: 7, year: 2026, month: 1, actual: 20 }]
    if (grants !== undefined) state.data.budgetLineIds = { leader: grants }
    const environment = { at, id: () => "unused", directory: [] }
    const leader = { id: "leader", roles: ["domain leader"], canWrite: true }
    for (const page of ["OPEX Detail", "CAPEX Projects"]) {
      const capex = page === "CAPEX Projects"
      const entryId = capex ? "capex-entry" : "opex-entry"
      const html = render(page, domain.view(state, leader, environment).data, {
        actor: leader,
        year: 2026,
        month: 1,
        at,
        versions: state.versions,
      })!
      const commands = [...html.matchAll(/<form\b[^>]*data-command="(?:save|save-entry)"[^>]*>[\s\S]*?<\/form>/g)]
      expect(commands.length).toBeGreaterThan(1)
      expect(commands.every((match) => match[0].includes('type="submit" disabled'))).toBe(true)
      const before = structuredClone(state)
      expect(
        domain.execute(
          state,
          leader,
          { page, action: "save", id: "7", version: 0, values: { name: "Denied", budget: 1 } },
          environment,
        ),
      ).toMatchObject({ ok: false, status: 403 })
      expect(
        domain.execute(
          state,
          leader,
          { page, action: "save-entry", id: entryId, version: 0, values: { year: 2026, month: 1, actual: 1 } },
          environment,
        ),
      ).toMatchObject({ ok: false, status: 403 })
      expect(state).toEqual(before)
      const adminHtml = render(page, domain.view(state, actor, environment).data, {
        actor,
        year: 2026,
        month: 1,
        at,
        versions: state.versions,
      })!
      expect(
        adminHtml.match(/<form\b[^>]*data-command="save"[^>]*data-record="7"[^>]*>[\s\S]*?<\/form>/)?.[0],
      ).toContain('<button type="submit">')
      expect(
        domain.execute(
          state,
          actor,
          { page, action: "save", id: "7", version: 0, values: { name: "Admin", budget: 100 } },
          environment,
        ),
      ).toMatchObject({ ok: true })
      expect(
        domain.execute(
          state,
          actor,
          { page, action: "save-entry", id: entryId, version: 0, values: { year: 2026, month: 1, actual: 100 } },
          environment,
        ),
      ).toMatchObject({ ok: true })
    }
  }
})
