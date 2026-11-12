import { expect, test } from "bun:test"
import { domain, pages, render } from "../runtime/planner.ts"
import type { Snapshot } from "../runtime/contract.ts"
const actor = { id: "directory-admin", canWrite: true, roles: ["admin"] }
const at = "2026-11-11T12:00:00Z"
function snapshot(): Snapshot {
  return { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
}
test("planner required pages contain functional controls or nonempty read views", () => {
  for (const page of pages) {
    const html = render(page, {}, { actor, year: 2026, month: 11, at, versions: {} })
    expect(html).toBeString()
    expect(html!.length).toBeGreaterThan(80)
    expect(html).toMatch(/<table|<form|class="metric"/)
  }
})
test("planner direct write without canWrite fails atomically", () => {
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
test("planner creates first version only once and rejects stale record writes", () => {
  const state = snapshot()
  const env = { at, id: () => "v1", directory: [] }
  expect(domain.execute(state, actor, { page: "Versions", action: "save", version: 0, values: {} }, env)).toMatchObject(
    { ok: true },
  )
  expect(domain.execute(state, actor, { page: "Versions", action: "save", version: 0, values: {} }, env)).toMatchObject(
    { ok: false },
  )
  expect(
    domain.execute(state, actor, { page: "Versions", action: "lock", id: "v1", version: 0, values: {} }, env),
  ).toMatchObject({
    ok: false,
    status: 409,
  })
})
const environment = {
  at,
  id: () => "new-record",
  directory: [{ id: "owner-1", name: "Budget Owner" }],
}
function seeded(): Snapshot {
  return {
    ...snapshot(),
    data: {
      versions: [
        {
          id: "v",
          name: "Plan",
          year: 2027,
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
      roster: [],
    },
  }
}
function run(
  state: Snapshot,
  page: string,
  action: string,
  id: string,
  values: Record<string, unknown>,
  version = 0,
  who = actor,
) {
  return domain.execute(
    state,
    who,
    {
      page,
      action,
      id: id || undefined,
      version,
      values: { versionId: "v", ...values },
    },
    environment,
  )
}
test("line numerical operations preserve manual months and null versus zero", () => {
  const state = seeded()
  expect(run(state, "OPEX", "save", "l", { annual: 100000, el: "licenses" })).toMatchObject({ ok: true })
  const view = domain.view(state, actor, environment)
  const version = (view.data.versions as Record<string, unknown>[])[0]
  const line = (version.lines as Record<string, unknown>[])[0]
  expect(line.b).toEqual([...Array(11).fill(8333.33), 8333.37])
  expect(run(state, "OPEX", "save", "l", { month: 0, value: 0 }, 1)).toMatchObject({ ok: true })
  expect(run(state, "OPEX", "save", "l", { annual: 1200 }, 2)).toMatchObject({
    ok: true,
  })
  expect(run(state, "OPEX", "save", "l", { a0: 0, f0: 0 }, 3)).toMatchObject({
    ok: true,
  })
  const result = domain.view(state, actor, environment).data.versions as {
    lines: {
      b: number[]
      bm: boolean[]
      a: (number | null)[]
      f: (number | null)[]
    }[]
    summary: { fullYear: number }
  }[]
  expect(result[0].lines[0].bm[0]).toBe(true)
  expect(result[0].lines[0].b[0]).toBe(0)
  expect(result[0].lines[0].a[0]).toBe(0)
  expect(result[0].lines[0].a[1]).toBeNull()
  expect(run(state, "OPEX", "reset", "l", {}, 4)).toMatchObject({ ok: true })
  expect(run(state, "OPEX", "save", "l", { annual: 2 }, 4)).toMatchObject({
    ok: false,
    status: 409,
  })
})
test("independent line revisions allow two editors while stale same-line fails atomically", () => {
  const state = seeded()
  expect(run(state, "OPEX", "save", "a", { annual: 120 })).toMatchObject({
    ok: true,
  })
  expect(run(state, "OPEX", "save", "b", { annual: 240 })).toMatchObject({
    ok: true,
  })
  expect(run(state, "OPEX", "save", "a", { annual: 360 }, 1)).toMatchObject({
    ok: true,
  })
  expect(run(state, "OPEX", "save", "b", { annual: 480 }, 1)).toMatchObject({
    ok: true,
  })
  const before = structuredClone(state)
  expect(run(state, "OPEX", "save", "a", { annual: 999 }, 1)).toMatchObject({
    ok: false,
    status: 409,
  })
  expect(state).toEqual(before)
})
test("lock reread rejects budget and HR but permits finance actual forecast and closing", () => {
  const state = seeded()
  expect(run(state, "OPEX", "save", "l", { annual: 1200 })).toMatchObject({
    ok: true,
  })
  expect(run(state, "Versions", "lock", "v", {})).toMatchObject({ ok: true })
  const before = structuredClone(state)
  expect(run(state, "OPEX", "save", "l", { annual: 1 }, 1)).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(state).toEqual(before)
  const finance = { id: "f", roles: ["finance"], canWrite: true }
  expect(run(state, "OPEX", "save", "l", { a0: 20, f1: 0 }, 1, finance)).toMatchObject({ ok: true })
  expect(run(state, "OPEX", "save", "", { closed: 1 }, 0, finance)).toMatchObject({ ok: true })
  expect(
    run(state, "Headcount", "save", "p", { name: "Person" }, 0, {
      id: "hr",
      roles: ["hr"],
      canWrite: true,
    }),
  ).toMatchObject({
    ok: false,
    status: 403,
  })
})
test("official per year has shared CAS and official cannot unlock or delete", () => {
  const state = seeded()
  expect(run(state, "Versions", "copy", "v", { name: "Second" })).toMatchObject({ ok: true })
  expect(run(state, "Versions", "official", "v", {})).toMatchObject({
    ok: true,
  })
  const before = structuredClone(state)
  expect(run(state, "Versions", "official", "new-record", {})).toMatchObject({
    ok: false,
    status: 409,
  })
  expect(state).toEqual(before)
  expect(run(state, "Versions", "official", "new-record", {}, 1)).toMatchObject({ ok: true })
  expect(run(state, "Versions", "unlock", "new-record", {}, 2)).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(run(state, "Versions", "delete", "new-record", {}, 2)).toMatchObject({
    ok: false,
    status: 403,
  })
  expect((state.data.officials as Record<string, string>)["2027"]).toBe("new-record")
  expect((state.data.versions as { locked: boolean }[]).every((version) => version.locked)).toBe(true)
})
test("HR calculations and recursive privacy preserve domain aggregates", () => {
  const state = seeded()
  expect(
    run(state, "Headcount", "save", "rate", {
      collection: "rates",
      name: "Employee",
      locs: "Brazil",
      annual: 120000,
      cur: "USD",
    }),
  ).toMatchObject({ ok: true })
  expect(
    run(state, "Headcount", "save", "person", {
      name: "Private Person",
      location: "Brazil",
      domain: "IT",
      fte: 1,
      start: 12,
      end: 1,
      rateId: "rate",
      rateOverride: 240000,
    }),
  ).toMatchObject({ ok: true })
  expect(
    run(state, "Headcount", "save", "", {
      collection: "increase",
      inc: 10,
      incMonth: 12,
    }),
  ).toMatchObject({ ok: true })
  const full = domain.view(state, actor, environment)
  const version = (
    full.data.versions as {
      hc: { positions: { start: number; end: number; months: number[] }[] }
      summary: { hrTotal: number }
    }[]
  )[0]
  expect(version.hc.positions[0].start).toBe(1)
  expect(version.hc.positions[0].end).toBe(12)
  expect(version.summary.hrTotal).toBe(242000)
  state.data.nested = {
    salary: 123456,
    inside: { cost: 123456, rateOverride: 123456, inc: 50 },
  }
  const viewer = { id: "reader", canWrite: false, roles: ["viewer"] }
  const filtered = domain.view(state, viewer, environment)
  expect(JSON.stringify(filtered.data)).not.toMatch(/"(?:rates|rateId|rateOverride|cost|inc|salary|months)":/)
  expect(JSON.stringify(filtered.data)).toContain("242000")
  expect(
    render("Headcount", full.data, {
      actor: viewer,
      year: 2027,
      month: 11,
      at,
      versions: state.versions,
    }),
  ).not.toContain("rateOverride")
  expect(run(state, "Headcount", "delete", "rate", { collection: "rates" }, 1)).toMatchObject({
    ok: false,
    status: 422,
  })
})
test("FX preserves cur shape, parses comma and warns without rejecting missing rate totals", () => {
  const state = seeded()
  expect(run(state, "FX rates", "save", "eur", { cur: "EUR", rate: "1,1234567" })).toMatchObject({ ok: true })
  expect(run(state, "OPEX", "save", "l", { annual: 100, cur: "EUR" })).toMatchObject({ ok: true })
  expect(run(state, "FX rates", "delete", "eur", {}, 1)).toMatchObject({
    ok: false,
    status: 422,
  })
  expect(run(state, "FX rates", "save", "eur", { rate: "" }, 1)).toMatchObject({
    ok: true,
  })
  const version = (
    domain.view(state, actor, environment).data.versions as {
      fx: { cur: string; rate: number | null }[]
      summary: { warnings: string[]; total: number }
    }[]
  )[0]
  expect(version.fx[0]).toMatchObject({ cur: "EUR", rate: null })
  expect(version.summary.warnings).toEqual(["EUR"])
  expect(version.summary.total).toBe(0)
})
test("owner scope, directory identity and unknown actions fail closed", () => {
  const state = seeded()
  expect(run(state, "OPEX", "save", "l", { owner: "owner-1" })).toMatchObject({
    ok: true,
  })
  const owner = { id: "owner-1", canWrite: true, roles: ["budget owner"] }
  expect(run(state, "OPEX", "save", "l", { f0: 0 }, 1, owner)).toMatchObject({
    ok: true,
  })
  expect(run(state, "OPEX", "save", "l", { a0: 0 }, 2, owner)).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(run(state, "OPEX", "save", "l", { f0: 0 }, 2, { ...owner, id: "other" })).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(run(state, "OPEX", "save", "l", { owner: "Unknown imported name" }, 2)).toMatchObject({
    ok: true,
    warnings: ["Unknown owner: Unknown imported name"],
  })
  const version = (state.data.versions as { lines: { owner: unknown }[] }[])[0]
  expect(version.lines[0].owner).toEqual({
    id: "owner-1",
    name: "Budget Owner",
  })
  const before = structuredClone(state)
  expect(run(state, "Dashboard", "save", "x", {})).toMatchObject({
    ok: false,
    status: 400,
  })
  expect(run(state, "OPEX", "preview-workbook", "x", {})).toMatchObject({
    ok: false,
    status: 400,
  })
  expect(state).toEqual(before)
})
test("CPX sequence spans versions, survives deletion and copies preserve codes", () => {
  const state = seeded()
  expect(
    run(state, "CAPEX", "save", "project", {
      collection: "projects",
      name: "Project",
      code: "CPX-2025-080",
    }),
  ).toMatchObject({
    ok: true,
  })
  expect(run(state, "CAPEX", "delete", "project", { collection: "projects" }, 1)).toMatchObject({ ok: true })
  expect(
    run(state, "CAPEX", "save", "next", {
      collection: "projects",
      name: "Next",
    }),
  ).toMatchObject({ ok: true })
  expect((state.data.versions as { projects: { code: string }[] }[])[0].projects[0].code).toBe("CPX-2027-081")
  expect(run(state, "Versions", "copy", "v", {})).toMatchObject({ ok: true })
  expect((state.data.versions as { projects: { code: string }[] }[])[1].projects[0].code).toBe("CPX-2027-081")
})
test("shared lists reject normalized duplicates and references across versions", () => {
  const state = seeded()
  expect(
    run(state, "Entities & allocations", "save", "entity", {
      collection: "entities",
      name: "São Paulo",
      code: "SP",
    }),
  ).toMatchObject({
    ok: true,
  })
  expect(
    run(state, "Entities & allocations", "save", "duplicate", {
      collection: "entities",
      name: "sao paulo",
    }),
  ).toMatchObject({
    ok: false,
    status: 422,
  })
  expect(run(state, "OPEX", "save", "line", { entity: "entity" })).toMatchObject({ ok: true })
  expect(run(state, "Entities & allocations", "delete", "entity", { collection: "entities" }, 1)).toMatchObject({
    ok: false,
    status: 422,
  })
})
test("roster sync retains manual domain and does not ingest future or terminated people", () => {
  const state = seeded()
  state.data.roster = [
    { name: "Current", domain: "HR" },
    { name: "Future", start: "2028-01-01" },
    { name: "Gone", status: "Terminated" },
  ]
  expect(
    run(state, "Headcount", "save", "person", {
      name: "Current",
      domain: "IT",
    }),
  ).toMatchObject({ ok: true })
  expect(run(state, "Headcount", "sync", "", {}, 1)).toMatchObject({
    ok: true,
  })
  const version = (
    state.data.versions as {
      hc: { positions: { name: string; domain: string }[] }
    }[]
  )[0]
  expect(version.hc.positions).toHaveLength(1)
  expect(version.hc.positions[0].domain).toBe("IT")
})
test("viewer with write identity never writes and salary cannot leak through stale conflicts", () => {
  const state = seeded()
  expect(
    run(state, "Headcount", "save", "p", {
      name: "Person",
      rateOverride: 123456,
    }),
  ).toMatchObject({ ok: true })
  const before = structuredClone(state)
  expect(
    run(state, "Headcount", "save", "p", {}, 1, {
      id: "viewer",
      canWrite: true,
      roles: ["viewer"],
    }),
  ).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(state).toEqual(before)
  const response = run(state, "Headcount", "save", "p", {}, 0, {
    id: "owner",
    canWrite: true,
    roles: ["budget owner"],
  })
  expect(response).toMatchObject({ ok: false, status: 409 })
  expect(JSON.stringify(response)).not.toContain("rateOverride")
  expect(state).toEqual(before)
})
test("HR actuals are independent of calculated budget and reject the wrong page", () => {
  const state = seeded()
  expect(run(state, "OPEX", "save", "HR:IT", { a0: 0, f0: 0 })).toMatchObject({
    ok: true,
  })
  expect(run(state, "OPEX", "save", "HR:IT", { annual: 100 }, 1)).toMatchObject({ ok: false, status: 403 })
  expect(run(state, "OPEX", "delete", "HR:IT", {}, 1)).toMatchObject({
    ok: false,
    status: 422,
  })
  expect(run(state, "CAPEX", "save", "HR:IT", { f0: 2 }, 1)).toMatchObject({
    ok: false,
    status: 400,
  })
  const version = (
    domain.view(state, actor, environment).data.versions as {
      hr: { annual: number; a: (number | null)[]; f: (number | null)[] }[]
    }[]
  )[0]
  expect(version.hr[0].annual).toBe(0)
  expect(version.hr[0].a[0]).toBe(0)
  expect(version.hr[0].f[0]).toBe(0)
})
test("total-only mode refuses multiple rows and HR split is immutable", () => {
  const state = seeded()
  expect(run(state, "OPEX", "save", "a", { annual: 100, el: "licenses" })).toMatchObject({ ok: true })
  expect(run(state, "OPEX", "save", "b", { annual: 100, el: "licenses" })).toMatchObject({ ok: true })
  expect(run(state, "OPEX", "save", "", { el: "licenses", split: false })).toMatchObject({ ok: false, status: 422 })
  expect(run(state, "OPEX", "save", "", { el: "hr", split: false })).toMatchObject({ ok: false, status: 422 })
})
test("legacy numeric identifiers stay addressable and directory selects show names", () => {
  const state = seeded()
  const version = (state.data.versions as Record<string, unknown>[])[0]
  version.id = 7
  version.lines = [
    {
      id: 42,
      sec: "opex",
      el: "licenses",
      owner: 11,
      annual: 120,
      b: Array(12).fill(10),
      cur: "USD",
    },
  ]
  const env = {
    ...environment,
    directory: [{ id: "11", name: "Named owner" }],
  }
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "OPEX",
        action: "save",
        id: "42",
        version: 0,
        values: { versionId: "7", annual: 240 },
      },
      env,
    ),
  ).toMatchObject({ ok: true })
  const view = domain.view(state, actor, env)
  const html = render(
    "OPEX",
    { ...view.data, version: "7", mode: "actual" },
    { actor, year: 2027, month: 11, at, versions: state.versions },
  )!
  expect(html).toContain('value="11" selected>Named owner</option>')
  expect(html).toContain('name="versionId" value="7"')
  expect(html).toContain('data-workbook="planner"')
  expect(html).toContain("?download=xlsx")
  expect(html).not.toContain("<textarea")
  expect(html).toContain('method="get"')
  expect(html).not.toContain("data-grid=")
})
test("CAPEX GET owner, classification and search filters affect rendered rows", () => {
  const state = seeded()
  expect(
    run(state, "CAPEX", "save", "p", {
      collection: "projects",
      name: "Project",
    }),
  ).toMatchObject({ ok: true })
  expect(
    run(state, "CAPEX", "save", "a", {
      proj: "p",
      name: "Visible item",
      owner: "owner-1",
      cls: "opex",
    }),
  ).toMatchObject({ ok: true })
  expect(
    run(state, "CAPEX", "save", "b", {
      proj: "p",
      name: "Hidden item",
      cls: "capex",
    }),
  ).toMatchObject({ ok: true })
  const data = domain.view(state, actor, environment).data
  const html = render(
    "CAPEX",
    { ...data, owner: "owner-1", class: "opex", q: "Visible" },
    { actor, year: 2027, month: 11, at, versions: state.versions },
  )!
  expect(html).toContain("Visible item")
  expect(html).not.toContain("Hidden item")
})
function workbook(
  state: Snapshot,
  sheets: Record<string, Record<string, unknown>[]>,
  options: Record<string, unknown> = {},
  who = actor,
  env = environment,
) {
  const versionId = typeof options.versionId === "string" ? options.versionId : "v"
  return domain.execute(
    state,
    who,
    {
      page: "Overview",
      action: "import-workbook",
      version: state.versions[`versions:${versionId}`]?.version ?? 0,
      values: {
        versionId,
        sheets,
        versions: structuredClone(state.versions),
        ...options,
      },
    },
    env,
  )
}
function moneyRow(id: string | number, measure: string, extra: Record<string, unknown> = {}) {
  return {
    "Line ID": id,
    "Cost element": "Licenses",
    "Vendor / item": "Licences",
    Currency: "USD",
    Measure: measure,
    Jan: 100,
    ...extra,
  }
}
test("workbook apply matches numeric IDs and names, preserves migrated fields, null and typed zero", () => {
  const state = seeded()
  const version = (state.data.versions as Record<string, unknown>[])[0]
  version.lines = [
    {
      id: 42,
      sec: "opex",
      el: "licenses",
      name: "Licences",
      annual: 12,
      b: Array(12).fill(1),
      cur: "USD",
      original: { keep: true },
    },
  ]
  expect(
    workbook(state, {
      OPEX: [
        moneyRow(42, "Budget", { Jan: 0, Feb: 120 }),
        moneyRow("missing-id", "Actual", { Jan: 0 }),
        moneyRow(42, "Forecast", { Jan: 0 }),
      ],
    }),
  ).toMatchObject({ ok: true })
  const line = (state.data.versions as { lines: Record<string, unknown>[] }[])[0].lines[0]
  expect(line.id).toBe("42")
  expect(line.annual).toBe(120)
  expect(line.b).toEqual([0, 120, ...Array(10).fill(0)])
  expect(line.a).toEqual([0, ...Array(11).fill(null)])
  expect(line.f).toEqual([0, ...Array(11).fill(null)])
  expect(line.original).toEqual({ keep: true })
  expect(state.versions["v:lines:42"].version).toBe(1)
})
test("workbook preview command never writes and a late invalid position rolls every sheet back", () => {
  const state = seeded()
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Overview",
        action: "preview-workbook",
        version: 0,
        values: { sheets: { OPEX: [moneyRow("", "Budget")] } },
      },
      environment,
    ),
  ).toMatchObject({ ok: false, status: 400 })
  expect(state).toEqual(before)
  expect(
    workbook(state, {
      "FX rates": [{ Currency: "EUR", "USD per 1 unit": 1.2 }],
      "Rate cards": [
        {
          "Rate ID": "",
          "Rate card": "Employee",
          "Annual cost per FTE": 120000,
          Currency: "EUR",
        },
      ],
      OPEX: [moneyRow("", "Budget", { Currency: "EUR" })],
      Headcount: [{ Name: "Late invalid person", FTE: "not a number" }],
    }),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
})
test("workbook preflights each changed CAS and rolls back earlier records when a later token is stale", () => {
  const state = seeded()
  expect(run(state, "OPEX", "save", "a", { annual: 120, name: "A" })).toMatchObject({ ok: true })
  expect(run(state, "OPEX", "save", "b", { annual: 120, name: "B" })).toMatchObject({ ok: true })
  const revisions = structuredClone(state.versions)
  expect(run(state, "OPEX", "save", "b", { annual: 240 }, 1)).toMatchObject({
    ok: true,
  })
  const before = structuredClone(state)
  expect(
    workbook(
      state,
      {
        OPEX: [
          moneyRow("a", "Budget", { "Vendor / item": "A", Jan: 400 }),
          moneyRow("b", "Budget", { "Vendor / item": "B", Jan: 500 }),
        ],
      },
      { versions: revisions },
    ),
  ).toMatchObject({ ok: false, status: 409 })
  expect(state).toEqual(before)
  expect(
    workbook(state, { OPEX: [moneyRow("a", "Budget", { "Vendor / item": "A", Jan: 400 })] }, { versions: revisions }),
  ).toMatchObject({
    ok: true,
  })
})
test("locked workbook ignores budget structure FX salary and removal while finance edits actual and forecast", () => {
  const state = seeded()
  expect(run(state, "OPEX", "save", "a", { annual: 120, name: "Kept" })).toMatchObject({ ok: true })
  expect(run(state, "OPEX", "save", "b", { annual: 120, name: "Also kept" })).toMatchObject({ ok: true })
  expect(run(state, "Versions", "lock", "v", {})).toMatchObject({ ok: true })
  const finance = { id: "finance", canWrite: true, roles: ["finance"] }
  expect(
    workbook(
      state,
      {
        OPEX: [
          moneyRow("a", "Budget", {
            "Vendor / item": "Forbidden rename",
            Currency: "EUR",
            Jan: 999,
          }),
          moneyRow("a", "Actual", { Jan: 0 }),
          moneyRow("a", "Forecast", { Jan: 300 }),
        ],
        "FX rates": [{ Currency: "EUR", "USD per 1 unit": -1 }],
        "Rate cards": [{ "Rate card": "Injected", "Annual cost per FTE": 999999 }],
        Headcount: [{ Name: "Injected", FTE: 2 }],
      },
      { removeMissing: true },
      finance,
    ),
  ).toMatchObject({ ok: true })
  const version = (
    state.data.versions as {
      lines: Record<string, unknown>[]
      fx: unknown[]
      hc: { positions: unknown[]; rates: unknown[] }
    }[]
  )[0]
  expect(version.lines).toHaveLength(2)
  expect(version.lines[0]).toMatchObject({
    name: "Kept",
    annual: 120,
    cur: "USD",
  })
  expect((version.lines[0].a as number[])[0]).toBe(0)
  expect((version.lines[0].f as number[])[0]).toBe(300)
  expect(version.fx).toEqual([])
  expect(version.hc.positions).toEqual([])
  expect(version.hc.rates).toEqual([])
})
test("newVersion imports into an unlocked atomic copy without moving official or touching source", () => {
  const state = seeded()
  expect(run(state, "OPEX", "save", "line", { annual: 120, name: "Licences" })).toMatchObject({ ok: true })
  expect(run(state, "Versions", "official", "v", {})).toMatchObject({
    ok: true,
  })
  const source = structuredClone((state.data.versions as { locked: boolean; lines: { annual: number }[] }[])[0])
  let counter = 0
  const env = { ...environment, id: () => `generated-${++counter}` }
  expect(
    workbook(state, { OPEX: [moneyRow("line", "Budget", { Jan: 900 })] }, { newVersion: true }, actor, env),
  ).toMatchObject({
    ok: true,
    value: "generated-1",
  })
  const versions = state.data.versions as {
    locked: boolean
    lines: { annual: number }[]
  }[]
  expect(versions[0]).toEqual(source)
  expect(versions[1].locked).toBe(false)
  expect(versions[1].lines[0].annual).toBe(900)
  expect(state.data.officials).toEqual({ "2027": "v" })
  expect(state.versions["generated-1:lines:line"].version).toBe(1)
  expect(state.versions["versions:generated-1"].version).toBe(1)
  const before = structuredClone(state)
  expect(
    workbook(state, { Info: [] }, { newVersion: true }, { id: "finance", roles: ["finance"], canWrite: true }, env),
  ).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(state).toEqual(before)
})
test("workbook resolves directory names and list names or codes; unknown values warn without inventing records", () => {
  const state = seeded()
  state.data.entities = [{ id: 9, name: "São Paulo", code: "SP" }]
  state.data.allocations = [{ id: 10, name: "Direct", desc: "" }]
  const env = {
    ...environment,
    directory: [{ id: "owner-1", name: "André Owner" }],
  }
  expect(
    workbook(
      state,
      {
        OPEX: [
          moneyRow("", "Budget", {
            Owner: "andre owner",
            Entity: "SP",
            Allocation: "direct",
          }),
        ],
      },
      {},
      actor,
      env,
    ),
  ).toMatchObject({ ok: true })
  const version = (state.data.versions as { lines: Record<string, unknown>[] }[])[0],
    line = version.lines[0]
  expect(line.owner).toEqual({ id: "owner-1", name: "André Owner" })
  expect(line.entity).toBe("9")
  expect(line.alloc).toBe("10")
  const result = workbook(
    state,
    {
      OPEX: [
        moneyRow(String(line.id), "Budget", {
          Owner: "Unknown Person",
          Entity: "Unknown Entity",
          Allocation: "Unknown Key",
          Currency: "XYZ",
        }),
      ],
    },
    {},
    actor,
    env,
  )
  expect(result).toMatchObject({
    ok: true,
    warnings: expect.arrayContaining([
      "Unknown owner: Unknown Person",
      "Unknown entity: Unknown Entity",
      "Unknown allocation: Unknown Key",
      "Unknown currency: XYZ",
    ]),
  })
  const next = (state.data.versions as { lines: Record<string, unknown>[] }[])[0].lines[0]
  expect(next.owner).toEqual(line.owner)
  expect(next.entity).toBe("9")
  expect(next.alloc).toBe("10")
  expect(next.cur).toBe("USD")
  expect(env.directory).toHaveLength(1)
  expect(state.data.entities).toHaveLength(1)
})
test("workbook CAPEX matches normalized project code then name, class prefixes and preserves unknown classification", () => {
  const state = seeded()
  expect(
    run(state, "CAPEX", "save", "project", {
      collection: "projects",
      name: "Core",
      code: "CPX-2027-010",
    }),
  ).toMatchObject({ ok: true })
  const capex = {
    ...moneyRow("", "Budget"),
    "Project code": "cpx-2027-010",
    Project: "Ignored alternate",
    Classification: "OPEX expense",
  }
  expect(workbook(state, { CAPEX: [capex] })).toMatchObject({ ok: true })
  let version = (
    state.data.versions as {
      projects: Record<string, unknown>[]
      lines: Record<string, unknown>[]
    }[]
  )[0]
  expect(version.projects).toHaveLength(1)
  expect(version.lines[0].cls).toBe("opex")
  expect(version.lines[0].proj).toBe("project")
  expect(
    workbook(state, {
      CAPEX: [
        {
          ...capex,
          "Line ID": version.lines[0].id,
          "Project code": "not-found",
          Project: "core",
          Classification: "Unknown class",
        },
      ],
    }),
  ).toMatchObject({
    ok: true,
    warnings: ["Unknown classification: Unknown class"],
  })
  version = (state.data.versions as (typeof version)[])[0]
  expect(version.projects).toHaveLength(1)
  expect(version.lines[0].cls).toBe("opex")
})
test("workbook FX precedes costs, rounds six decimals, and invalid positive-rate validation is atomic", () => {
  const state = seeded()
  expect(
    workbook(state, {
      "FX rates": [{ Currency: "EUR", "USD per 1 unit": "1,1234567" }],
      OPEX: [moneyRow("", "Budget", { Currency: "EUR" })],
    }),
  ).toMatchObject({ ok: true })
  const version = (
    domain.view(state, actor, environment).data.versions as {
      fx: { cur: string; rate: number }[]
      summary: { total: number }
    }[]
  )[0]
  expect(version.fx[0]).toMatchObject({ cur: "EUR", rate: 1.123457 })
  expect(version.summary.total).toBeCloseTo(112.3457)
  const before = structuredClone(state)
  expect(workbook(state, { "FX rates": [{ Currency: "GBP", "USD per 1 unit": 0 }] })).toMatchObject({
    ok: false,
    status: 422,
  })
  expect(state).toEqual(before)
})
test("headcount workbook matches numeric IDs, clamps FTE and orders months while ignoring calculated and unrelated columns", () => {
  const state = seeded()
  const version = (
    state.data.versions as {
      hc: {
        positions: Record<string, unknown>[]
        rates: Record<string, unknown>[]
      }
    }[]
  )[0]
  version.hc.positions = [
    {
      id: 77,
      name: "Existing",
      include: true,
      fte: 1,
      start: 1,
      end: 12,
      domain: "IT",
      src: "roster",
    },
  ]
  version.hc.rates = [{ id: 88, name: "Employee", locs: "Brazil", annual: 120000, cur: "USD" }]
  const hr = { id: "hr", canWrite: true, roles: ["hr"] }
  expect(
    workbook(
      state,
      {
        Headcount: [
          {
            "Position ID": 77,
            Name: "Existing",
            Include: "Y",
            FTE: 5,
            "Start month": "Dec",
            "End month": "Jan",
            "Rate card": "employee",
            "Rate override": 240000,
            Domain: "Manual",
            Classification: "INJECTED",
            Outlook: "INJECTED",
            Notes: "INJECTED",
            "FY cost USD (calculated)": "not numeric",
          },
        ],
      },
      {},
      hr,
    ),
  ).toMatchObject({ ok: true })
  const position = (state.data.versions as (typeof version)[])[0].hc.positions[0]
  expect(position).toMatchObject({
    id: "77",
    fte: 2,
    start: 1,
    end: 12,
    rateId: "88",
    rateOverride: 240000,
    domainManual: true,
  })
  expect(JSON.stringify(position)).not.toContain("INJECTED")
  expect(position).not.toHaveProperty("FY cost USD (calculated)")
})
test("salary imports obey HR edit rules and synthetic HR ignores workbook budget", () => {
  const state = seeded()
  state.data.entities = [{ id: "entity", name: "Entity", code: "E" }]
  expect(
    workbook(state, {
      "Rate cards": [
        {
          "Rate ID": "",
          "Rate card": "Employee",
          Locations: "Brazil",
          Currency: "USD",
          "Annual cost per FTE": 120000,
        },
      ],
      Headcount: [
        {
          Name: "Person",
          Location: "Brazil",
          Domain: "IT",
          Include: "Y",
          FTE: 1,
        },
      ],
    }),
  ).toMatchObject({ ok: true })
  expect(
    workbook(state, {
      OPEX: [
        moneyRow("HR:IT", "Budget", {
          "Cost element": "HR Staff",
          Jan: "not a number",
          Entity: "E",
        }),
        moneyRow("HR:IT", "Actual", { "Cost element": "HR Staff", Jan: 0 }),
        moneyRow("HR:IT", "Forecast", { "Cost element": "HR Staff", Jan: 0 }),
      ],
    }),
  ).toMatchObject({ ok: true })
  const version = (
    domain.view(state, actor, environment).data.versions as {
      hr: {
        annual: number
        a: (number | null)[]
        f: (number | null)[]
        entity: string
      }[]
      lines: unknown[]
    }[]
  )[0]
  expect(version.hr[0]).toMatchObject({ annual: 120000, entity: "entity" })
  expect(version.hr[0].a[0]).toBe(0)
  expect(version.hr[0].f[0]).toBe(0)
  expect(version.lines).toHaveLength(0)
  const viewer = { id: "viewer", canWrite: false, roles: ["viewer"] }
  const before = structuredClone(state)
  expect(workbook(state, { "Rate cards": [] }, {}, viewer)).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(state).toEqual(before)
  const finance = { id: "finance", canWrite: true, roles: ["finance"] }
  expect(
    workbook(state, { "Rate cards": [{ "Rate card": "Employee", "Annual cost per FTE": 1 }] }, {}, finance),
  ).toMatchObject({
    ok: true,
  })
  expect((state.data.versions as { hc: { rates: { annual: number }[] } }[])[0].hc.rates[0].annual).toBe(120000)
})
test("removeMissing prunes only supplied sheets and never removes orphan projects", () => {
  const state = seeded()
  expect(run(state, "OPEX", "save", "a", { annual: 100, name: "A" })).toMatchObject({ ok: true })
  expect(run(state, "OPEX", "save", "b", { annual: 100, name: "B" })).toMatchObject({ ok: true })
  expect(
    run(state, "CAPEX", "save", "p", {
      collection: "projects",
      name: "Project",
    }),
  ).toMatchObject({ ok: true })
  expect(run(state, "CAPEX", "save", "c", { proj: "p", annual: 100, name: "C" })).toMatchObject({ ok: true })
  expect(
    workbook(state, { OPEX: [moneyRow("a", "Budget", { "Vendor / item": "A" })] }, { removeMissing: true }),
  ).toMatchObject({
    ok: true,
  })
  let version = (state.data.versions as { lines: { id: string }[]; projects: unknown[] }[])[0]
  expect(version.lines.map((line) => line.id).sort()).toEqual(["a", "c"])
  expect(workbook(state, { CAPEX: [] }, { removeMissing: true })).toMatchObject({ ok: true })
  version = (state.data.versions as (typeof version)[])[0]
  expect(version.lines.map((line) => line.id)).toEqual(["a"])
  expect(version.projects).toHaveLength(1)
})
test("dashboard headcount file normalizes Start Date and End Date, stores only roster columns even locked", () => {
  const state = seeded()
  expect(run(state, "Versions", "lock", "v", {})).toMatchObject({ ok: true })
  expect(
    workbook(state, {
      Headcount: [
        {
          Name: "Roster Person",
          Title: "Engineer",
          Type: "Employee",
          Leader: "Leader",
          Location: "Brazil",
          "Start Date": "2026-01-03",
          "End Date": "2027-11-01",
          Status: "Active",
          Classification: "INJECTED",
          Outlook: 123,
          Notes: "INJECTED",
          rateOverride: 999999,
        },
      ],
    }),
  ).toMatchObject({ ok: true })
  expect(state.data.roster).toEqual([
    {
      name: "Roster Person",
      title: "Engineer",
      type: "Employee",
      leader: "Leader",
      location: "Brazil",
      start: "2026-01-03",
      end: "2027-11-01",
      status: "Active",
    },
  ])
  expect((state.data.versions as { hc: { positions: unknown[] } }[])[0].hc.positions).toEqual([])
  expect(state.versions["roster:file"].version).toBe(1)
})
test("budget owner workbook applies only owned forecasts and rejects a mixed unauthorized forecast atomically", () => {
  const state = seeded()
  expect(
    run(state, "OPEX", "save", "a", {
      annual: 100,
      name: "A",
      owner: "owner-1",
    }),
  ).toMatchObject({ ok: true })
  expect(run(state, "OPEX", "save", "b", { annual: 100, name: "B" })).toMatchObject({ ok: true })
  const owner = { id: "owner-1", canWrite: true, roles: ["budget owner"] }
  const before = structuredClone(state)
  expect(
    workbook(
      state,
      {
        OPEX: [
          moneyRow("a", "Forecast", { "Vendor / item": "A", Jan: 0 }),
          moneyRow("b", "Forecast", { "Vendor / item": "B", Jan: 200 }),
        ],
      },
      {},
      owner,
    ),
  ).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
  expect(
    workbook(
      state,
      {
        OPEX: [
          moneyRow("a", "Budget", { "Vendor / item": "Rename", Jan: 900 }),
          moneyRow("a", "Actual", { Jan: 900 }),
          moneyRow("a", "Forecast", { Jan: 0 }),
        ],
      },
      {},
      owner,
    ),
  ).toMatchObject({ ok: true })
  const line = (
    state.data.versions as {
      lines: {
        name: string
        annual: number
        f: (number | null)[]
        a: (number | null)[]
      }[]
    }[]
  )[0].lines[0]
  expect(line.name).toBe("A")
  expect(line.annual).toBe(100)
  expect(line.f[0]).toBe(0)
  expect(line.a[0]).toBeNull()
})
test("workbook permits ordinary CAPEX HR cost element and locked line IDs retain original project", () => {
  const state = seeded()
  expect(
    run(state, "CAPEX", "save", "project", {
      collection: "projects",
      name: "Project",
    }),
  ).toMatchObject({ ok: true })
  expect(
    workbook(state, {
      CAPEX: [
        {
          ...moneyRow("", "Budget"),
          "Cost element": "HR Staff",
          Project: "Project",
          Classification: "CAPEX",
        },
      ],
    }),
  ).toMatchObject({ ok: true })
  const version = (
    state.data.versions as {
      lines: { id: string; el: string; proj: string }[]
    }[]
  )[0]
  expect(version.lines[0].el).toBe("hr")
  expect(
    (
      domain.view(state, actor, environment).data.versions as {
        summary: { total: number }
      }[]
    )[0].summary.total,
  ).toBe(100)
  expect(run(state, "Versions", "lock", "v", {})).toMatchObject({ ok: true })
  expect(
    workbook(
      state,
      {
        CAPEX: [
          {
            ...moneyRow(version.lines[0].id, "Actual"),
            "Cost element": "HR Staff",
            Project: "Unknown changed project",
            "Project code": "invalid",
            Jan: 250,
          },
        ],
      },
      {},
      { id: "f", canWrite: true, roles: ["finance"] },
    ),
  ).toMatchObject({ ok: true })
  const next = (
    state.data.versions as {
      projects: unknown[]
      lines: { proj: string; a: number[] }[]
    }[]
  )[0]
  expect(next.projects).toHaveLength(1)
  expect(next.lines[0].proj).toBe("project")
  expect(next.lines[0].a[0]).toBe(250)
})
test("workbook CPX sequence is global, CAS protected and rolls back on later validation failure", () => {
  const state = seeded()
  state.sequences.cpx = 80
  let counter = 0
  const env = { ...environment, id: () => `record-${++counter}` }
  const capex = {
    ...moneyRow("", "Budget"),
    Project: "New project",
    Classification: "CAPEX",
  }
  const before = structuredClone(state)
  expect(
    workbook(state, { CAPEX: [capex], Headcount: [{ Name: "Invalid", FTE: "bad" }] }, {}, actor, env),
  ).toMatchObject({
    ok: false,
    status: 422,
  })
  expect(state).toEqual(before)
  expect(workbook(state, { CAPEX: [capex] }, {}, actor, env)).toMatchObject({
    ok: true,
  })
  expect(state.sequences.cpx).toBe(81)
  expect((state.data.versions as { projects: { code: string }[] }[])[0].projects[0].code).toBe("CPX-2027-081")
  expect(state.versions["sequences:cpx"].version).toBe(1)
  const current = structuredClone(state)
  expect(
    workbook(
      state,
      {
        CAPEX: [
          {
            ...capex,
            Project: "Next project",
            "Vendor / item": "Different line",
          },
        ],
      },
      { versions: { ...state.versions, "sequences:cpx": 0 } },
      actor,
      env,
    ),
  ).toMatchObject({ ok: false, status: 409 })
  expect(state).toEqual(current)
})
test("workbook rejects malformed shapes, duplicate measures, invalid revision tokens and stale source lock", () => {
  const state = seeded()
  expect(run(state, "OPEX", "save", "line", { annual: 100, name: "Licences" })).toMatchObject({ ok: true })
  const before = structuredClone(state)
  expect(
    workbook(state, {
      OPEX: [moneyRow("line", "Budget"), moneyRow("line", "Budget")],
    }),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  expect(
    workbook(state, { OPEX: [moneyRow("line", "Budget", { Jan: 200 })] }, { versions: { "v:lines:line": "invalid" } }),
  ).toMatchObject({
    ok: false,
    status: 422,
  })
  expect(state).toEqual(before)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Overview",
        action: "import-workbook",
        version: 0,
        values: { versionId: "v", sheets: { OPEX: [null] } },
      },
      environment,
    ),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  expect(run(state, "Versions", "lock", "v", {})).toMatchObject({ ok: true })
  const locked = structuredClone(state)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: "Overview",
        action: "import-workbook",
        version: 0,
        values: {
          versionId: "v",
          sheets: { OPEX: [moneyRow("line", "Forecast")] },
          versions: state.versions,
        },
      },
      environment,
    ),
  ).toMatchObject({ ok: false, status: 409 })
  expect(state).toEqual(locked)
})
test("roster singleton has CAS and ignores all salary, classification, outlook and notes input", () => {
  const state = seeded()
  const row = {
    Name: "Person",
    Title: "Title",
    Type: "Employee",
    Leader: "Leader",
    Location: "Brazil",
    Start: "2026-01-01",
    End: "",
    Status: "Active",
    Classification: "Unknown",
    Outlook: 900,
    Notes: "private",
    rateOverride: 900,
    inc: 50,
  }
  expect(workbook(state, { Headcount: [row] })).toMatchObject({ ok: true })
  const before = structuredClone(state)
  expect(
    workbook(state, { Headcount: [{ ...row, Name: "Changed" }] }, { versions: { "roster:file": 0 } }),
  ).toMatchObject({
    ok: false,
    status: 409,
  })
  expect(state).toEqual(before)
  const roster = state.data.roster as Record<string, unknown>[]
  expect(Object.keys(roster[0]).sort()).toEqual(
    ["name", "title", "type", "leader", "location", "start", "end", "status"].sort(),
  )
})
test("known IDs allow sparse workbook updates without guessing names or elements", () => {
  const state = seeded()
  expect(
    run(state, "OPEX", "save", "line", {
      annual: 120,
      name: "Keep name",
      el: "services",
    }),
  ).toMatchObject({ ok: true })
  expect(
    workbook(state, {
      OPEX: [{ "Line ID": "line", Measure: "Actual", Jan: 0 }],
    }),
  ).toMatchObject({ ok: true })
  const line = (
    state.data.versions as {
      lines: { name: string; el: string; a: (number | null)[] }[]
    }[]
  )[0].lines[0]
  expect(line.name).toBe("Keep name")
  expect(line.el).toBe("services")
  expect(line.a[0]).toBe(0)
  expect(run(state, "Headcount", "save", "p", { name: "Keep position", fte: 2 })).toMatchObject({ ok: true })
  expect(workbook(state, { Headcount: [{ "Position ID": "p", FTE: "" }] })).toMatchObject({ ok: true })
  expect(
    (
      state.data.versions as {
        hc: { positions: { name: string; fte: number }[] }
      }[]
    )[0].hc.positions[0],
  ).toMatchObject({
    name: "Keep position",
    fte: 1,
  })
})
test("workbook leaves unrelated legacy versions and absent sequence untouched", () => {
  const state = seeded()
  const other = {
    id: 19,
    name: "Legacy",
    year: 2026,
    locked: false,
    closed: 0,
    lines: [{ id: 90, sec: "opex", el: "licenses", annual: 1, cur: "USD" }],
    projects: [],
    hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} },
    fx: [{ cur: "EUR", rate: 1.1 }],
    lists: {},
    preserved: { original: true },
  }
  ;(state.data.versions as Record<string, unknown>[]).push(other)
  const before = structuredClone(other)
  expect(workbook(state, { OPEX: [moneyRow("", "Budget")] })).toMatchObject({
    ok: true,
  })
  expect((state.data.versions as (typeof other)[])[1]).toEqual(before)
  expect(state.sequences).toEqual({})
})
test("Info Field and Value rows only warn on version mismatch and cannot change year or authority", () => {
  const state = seeded(),
    before = structuredClone(state)
  expect(
    workbook(state, {
      Info: [
        { Field: "Version ID", Value: 19 },
        { Field: "Budget year", Value: 2099 },
        { Field: "Role", Value: "admin" },
      ],
    }),
  ).toMatchObject({
    ok: true,
    warnings: ["Workbook was exported from another version; matching records are applied to the selected version"],
  })
  expect(state).toEqual(before)
  expect(workbook(state, { Info: [{ Field: "Version ID", Value: "v" }] })).toMatchObject({ ok: true, warnings: [] })
  expect(
    workbook(
      state,
      { Info: [{ Field: "Role", Value: "admin" }] },
      {},
      { id: "viewer", canWrite: true, roles: ["viewer"] },
    ),
  ).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
})
test("workbook upload belongs to an operating import form with source CAS, preview fields and explicit apply", () => {
  const state = seeded()
  state.versions["versions:v"] = { version: 7, by: "editor" }
  state.versions["v:lines:one"] = { version: 3, by: "other" }
  const before = structuredClone(state)
  const html = render("OPEX", domain.view(state, actor, environment).data, {
    actor,
    year: 2027,
    month: 11,
    at,
    versions: state.versions,
  })!
  const operatingForm = html.match(/<form\b[^>]*data-command="import-workbook"[^>]*>[\s\S]*?<\/form>/)?.[0]
  expect(operatingForm).toBeDefined()
  expect(operatingForm).toContain('data-page="OPEX"')
  expect(operatingForm).toContain('data-record="v"')
  expect(operatingForm).toContain('data-version="7"')
  expect(operatingForm).toContain('type="hidden" name="versionId" value="v"')
  expect(operatingForm).toContain('type="hidden" name="sheets" data-json="true"')
  expect(operatingForm).toContain('type="hidden" name="versions" data-json="true"')
  expect(operatingForm).toContain("&quot;v:lines:one&quot;:{&quot;version&quot;:3")
  expect(operatingForm).toContain('type="file" accept=".xlsx,.xls" data-workbook="planner"')
  expect(operatingForm).toContain("data-import-notice")
  expect(operatingForm).toContain('name="newVersion" type="checkbox"')
  expect(operatingForm).toContain('name="removeMissing" type="checkbox"')
  expect(operatingForm).toContain('<button type="submit">Apply</button>')
  expect(html.match(/data-workbook="planner"/g)).toHaveLength(1)
  expect(state).toEqual(before)
})

function originalPlannerSnapshot(): Snapshot {
  return {
    ...snapshot(),
    data: {
      app: {
        officialId: 7,
        currency: "USD",
        entities: [{ id: "entity", name: "Original entity", code: "OE" }],
        allocations: [{ id: "allocation", name: "Direct", desc: "Original" }],
        leaderDomains: { "Original leader": "IT" },
      },
      versions: {
        "7": {
          id: 7,
          name: "FY2026 Original",
          year: 2026,
          closed: 1,
          lockBudget: false,
          created: "2025-11-01",
          note: "Keep original metadata",
          els: { licenses: { split: false }, hr: { split: true } },
          lines: [
            {
              id: "original-opex",
              sec: "opex",
              el: "licenses",
              name: "Original vendor",
              cur: "USD",
              annual: 200.01,
              b: [100.01, 0, ...Array(10).fill(10)],
              bm: [true, true, ...Array(10).fill(false)],
              a: [5, 0, ...Array(10).fill(null)],
              f: [null, 0, ...Array(10).fill(null)],
            },
            {
              id: "original-capex",
              sec: "capex",
              el: "hwo",
              proj: 81,
              name: "Original hardware",
              cls: "capex",
              cur: "EUR",
              annual: 200.12,
              b: [200.12, ...Array(11).fill(0)],
              a: [2, ...Array(11).fill(null)],
              f: Array(12).fill(null),
            },
          ],
          projects: [{ id: 81, name: "Original project", code: "CPX-2026-081", original: true }],
          hc: {
            positions: [
              {
                id: 41,
                name: "Original person",
                include: true,
                type: "Employee",
                location: "Brazil",
                domain: "IT",
                fte: 1,
                start: 1,
                end: 12,
                rateId: 31,
                rateOverride: "",
              },
            ],
            rates: [{ id: 31, name: "Employee", locs: "Brazil", annual: 1200, cur: "USD" }],
            inc: 10,
            incMonth: 7,
            ratesAreExamples: false,
          },
          hrAF: {
            IT: { a: [10, ...Array(11).fill(null)], f: Array(12).fill(null), entity: "entity", alloc: "allocation" },
          },
          fx: [{ cur: "EUR", rate: 1.25 }],
        },
        "draft-2027": {
          name: "FY2027 Original draft",
          year: 2027,
          closed: 0,
          lockBudget: false,
          lines: [
            {
              id: "draft-line",
              sec: "opex",
              el: "licenses",
              name: "Draft vendor",
              cur: "USD",
              annual: 100000,
              b: [...Array(11).fill(8333.33), 8333.37],
              bm: Array(12).fill(false),
              a: Array(12).fill(null),
              f: Array(12).fill(null),
            },
          ],
          projects: [],
          hc: { positions: [], rates: [], inc: 0, incMonth: 1 },
          hrAF: {},
          fx: [],
          els: {},
        },
      },
    },
  }
}

test("original dictionary migration preserves every version ID, monthly amounts and source totals without mutating reads", () => {
  const state = originalPlannerSnapshot()
  const before = structuredClone(state)
  const view = domain.view(state, actor, environment)
  const versions = view.data.versions as {
    id: string
    locked: boolean
    lines: { b: number[] }[]
    projects: { id: string }[]
    hc: { positions: { id: string; rateId: string; months: number[] }[]; rates: { id: string }[] }
    summary: { total: number; actualYTD: number; fullYear: number; hrTotal: number; fte: number }
  }[]
  expect(versions.map((version) => version.id)).toEqual(["7", "draft-2027"])
  expect(versions[0].summary.total).toBeCloseTo(1710.16, 2)
  expect(versions[0].summary.actualYTD).toBeCloseTo(17.5, 2)
  expect(versions[0].summary.fullYear).toBeCloseTo(1277.5, 2)
  expect(versions[0].summary.hrTotal).toBe(1260)
  expect(versions[0].summary.fte).toBe(1)
  expect(versions[1].summary.total).toBeCloseTo(100000, 2)
  expect(versions[1].lines[0].b).toEqual([...Array(11).fill(8333.33), 8333.37])
  expect(versions[0].projects[0].id).toBe("81")
  expect(versions[0].hc.rates[0].id).toBe("31")
  expect(versions[0].hc.positions[0]).toMatchObject({
    id: "41",
    rateId: "31",
    months: [...Array(6).fill(100), ...Array(6).fill(110)],
  })
  expect(view.data.officials).toEqual({ "2026": "7" })
  expect(versions[0].locked).toBe(true)
  expect(view.data.entities).toEqual([{ id: "entity", name: "Original entity", code: "OE" }])
  expect(state).toEqual(before)
})

test("render accepts the original dictionary directly and never offers an empty-store first version", () => {
  const state = originalPlannerSnapshot()
  const before = structuredClone(state)
  const html = render("Versions", state.data, { actor, year: 2026, month: 11, at, versions: {} })!
  expect(html).toContain("FY2026 Original")
  expect(html).toContain("FY2027 Original draft")
  expect(html).toContain("Official")
  expect(html).not.toContain("Create first version")
  const unlock = html.match(/<form[^>]*data-command="unlock"[^>]*data-record="7"[^>]*>[\s\S]*?<\/form>/)?.[0]
  expect(unlock).toContain("disabled")
  expect(state).toEqual(before)
})

test("legacy dictionary cannot be overwritten by first-version creation or an official unlock/delete/budget write", () => {
  const state = originalPlannerSnapshot()
  const before = structuredClone(state)
  expect(run(state, "Versions", "save", "", {})).toMatchObject({ ok: false, status: 400 })
  expect(run(state, "Versions", "unlock", "7", {})).toMatchObject({ ok: false, status: 403 })
  expect(run(state, "Versions", "delete", "7", {})).toMatchObject({ ok: false, status: 403 })
  expect(run(state, "OPEX", "save", "original-opex", { versionId: "7", annual: 1 })).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(state).toEqual(before)
})

test("successful legacy write persists canonical versions and official-by-year without respreading another version", () => {
  const state = originalPlannerSnapshot()
  const app = structuredClone(state.data.app)
  expect(run(state, "OPEX", "save", "draft-line", { versionId: "draft-2027", annual: 1200 })).toMatchObject({
    ok: true,
  })
  expect(Array.isArray(state.data.versions)).toBe(true)
  const versions = state.data.versions as {
    id: string
    note?: string
    lines: { b: number[]; annual: number }[]
    els: unknown
    hrAF: unknown
  }[]
  expect(versions.map((version) => version.id)).toEqual(["7", "draft-2027"])
  expect(versions[0].lines[0].b).toEqual([100.01, 0, ...Array(10).fill(10)])
  expect(versions[0].lines[1].b).toEqual([200.12, ...Array(11).fill(0)])
  expect(versions[0].note).toBe("Keep original metadata")
  expect(versions[0].els).toEqual({ licenses: { split: false }, hr: { split: true } })
  expect(versions[0].hrAF).toBeDefined()
  expect(versions[1].lines[0].annual).toBe(1200)
  expect(state.data.officials).toEqual({ "2026": "7" })
  expect(state.data.app).toEqual(app)
  expect(
    (domain.view(state, actor, environment).data.versions as { summary: { total: number } }[])[0].summary.total,
  ).toBeCloseTo(1710.16, 2)
})

test("canonical official takes precedence over the retained global pointer, including after deleting the previous official", () => {
  const state = originalPlannerSnapshot()
  const original = state.data.versions as Record<string, Record<string, unknown>>
  original["draft-2027"].year = 2026
  expect(run(state, "Versions", "official", "draft-2027", {})).toMatchObject({ ok: true })
  expect(state.data.officials).toEqual({ "2026": "draft-2027" })
  expect(run(state, "Versions", "delete", "7", {})).toMatchObject({ ok: true })
  expect(run(state, "Versions", "copy", "draft-2027", {}, 1)).toMatchObject({ ok: true })
  expect(state.data.officials).toEqual({ "2026": "draft-2027" })
  expect(
    (domain.view(state, actor, environment).data.versions as { id: string }[]).map((version) => version.id),
  ).toEqual(["draft-2027", "new-record"])
})

test("legacy lockBudget survives normalization and a canonical unlock remains unlocked on later reads", () => {
  const state = originalPlannerSnapshot()
  const original = state.data.versions as Record<string, Record<string, unknown>>
  original["draft-2027"].lockBudget = true
  const before = structuredClone(state)
  expect(run(state, "OPEX", "save", "draft-line", { versionId: "draft-2027", annual: 1200 })).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(state).toEqual(before)
  expect(run(state, "Versions", "unlock", "draft-2027", {})).toMatchObject({ ok: true })
  expect(run(state, "OPEX", "save", "draft-line", { versionId: "draft-2027", annual: 1200 })).toMatchObject({
    ok: true,
  })
  expect((domain.view(state, actor, environment).data.versions as { locked: boolean }[])[1].locked).toBe(false)
})

test("workbook apply accepts a dictionary source with an ID recovered from its dictionary key", () => {
  const state = originalPlannerSnapshot()
  expect(
    workbook(
      state,
      { OPEX: [moneyRow("draft-line", "Budget", { "Vendor / item": "Draft vendor", Jan: 321 })] },
      { versionId: "draft-2027" },
    ),
  ).toMatchObject({ ok: true, value: "draft-2027" })
  expect(state.data.officials).toEqual({ "2026": "7" })
  const versions = state.data.versions as { id: string; lines: { annual: number }[] }[]
  expect(versions[1].id).toBe("draft-2027")
  expect(versions[1].lines[0].annual).toBe(321)
})

test("invalid dictionary records cannot authorize creating a replacement first version", () => {
  const state = originalPlannerSnapshot()
  state.data.versions = { broken: null }
  const before = structuredClone(state)
  expect(run(state, "Versions", "save", "", {})).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
})

test("global official numeric ID is never interpreted as an array offset during migration", () => {
  const state = snapshot()
  state.data = {
    app: { officialId: 1 },
    versions: [
      { id: 1, name: "Actual official", year: 2026, lockBudget: false },
      { id: 19, name: "Array offset is unrelated", year: 2027, lockBudget: false },
    ],
  }
  const view = domain.view(state, actor, environment)
  expect(view.data.officials).toEqual({ "2026": "1" })
  expect((view.data.versions as { locked: boolean }[]).map((version) => version.locked)).toEqual([true, false])
})
