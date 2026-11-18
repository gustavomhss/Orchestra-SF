import { expect, test } from "bun:test"
import { domain, pages, render } from "../runtime/dashboard-operations.ts"
import type { Snapshot } from "../runtime/contract.ts"
const actor = { id: "directory-admin", canWrite: true, roles: ["admin"] }
const at = "2026-11-11T12:00:00Z"
function snapshot(): Snapshot {
  return { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
}
test("dashboard-operations required pages contain functional controls or nonempty read views", () => {
  for (const page of pages) {
    const html = render(page, {}, { actor, year: 2026, month: 11, at, versions: {} })
    expect(html).toBeString()
    expect(html!.length).toBeGreaterThan(80)
    expect(html).toMatch(/<table|<form|class="metric"/)
  }
})
test("dashboard-operations direct write without canWrite fails atomically", () => {
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

function command(
  state: Snapshot,
  action: string,
  values: Record<string, unknown>,
  options: {
    page?: string
    id?: string
    version?: number
    confirmed?: boolean
  } = {},
) {
  return domain.execute(
    state,
    actor,
    {
      page: options.page ?? pages[0],
      action,
      values,
      version: options.version ?? 0,
      id: options.id,
      confirmed: options.confirmed,
    },
    { at, id: () => "server-id", directory: [] },
  )
}
test("monthly writes replace values, preserve other months, audit and reject stale writes atomically", () => {
  const state = snapshot()
  expect(
    command(state, "save-sla", {
      year: 2026,
      month: 11,
      incSLA: 95,
      svcSLA: 90,
      avail: "",
    }),
  ).toMatchObject({ ok: true })
  expect(state.data.opsSLA).toEqual([
    {
      year: 2026,
      month: 11,
      id: "2026-11",
      incSLA: 95,
      svcSLA: 90,
      avail: 100,
    },
  ])
  const before = structuredClone(state)
  expect(command(state, "save-sla", { year: 2026, month: 11, avail: 0 })).toMatchObject({
    ok: false,
    status: 409,
    by: actor.id,
  })
  expect(state).toEqual(before)
  expect(command(state, "save-sla", { year: 2026, month: 12, avail: 0 })).toMatchObject({ ok: true })
  expect(command(state, "save-sla", { year: 2026, month: 11, avail: 0 }, { version: 1 })).toMatchObject({ ok: true })
  expect(state.audit).toHaveLength(3)
  expect(state.versions["ops:2026-11"]?.version).toBe(2)
  expect(state.data.opsSLA).toEqual(
    expect.arrayContaining([{ year: 2026, month: 11, id: "2026-11", incSLA: 0, svcSLA: 0, avail: 0 }]),
  )
})
test("authorization precedes validation; contributor assignment and domain leader limits", () => {
  const state = snapshot()
  for (const denied of [
    { ...actor, roles: ["viewer"] },
    { ...actor, roles: ["domain leader"] },
    { ...actor, roles: ["contributor"], assigned: [] },
    { ...actor, roles: ["contributor"], assigned: ["security"] },
  ]) {
    expect(
      domain.execute(
        state,
        denied,
        { page: pages[0], action: "save-sla", version: 0, values: {} },
        { at, id: () => "id", directory: [] },
      ),
    ).toMatchObject({ ok: false, status: 403 })
  }
  expect(
    domain.execute(
      state,
      { ...actor, roles: ["contributor"], assigned: ["Operations"] },
      {
        page: pages[0],
        action: "save-sla",
        version: 0,
        values: { year: 2026, month: 11 },
      },
      { at, id: () => "id", directory: [] },
    ),
  ).toMatchObject({ ok: true })
  expect(command(state, "unknown", {})).toMatchObject({
    ok: false,
    status: 400,
  })
  expect(command(state, "save-sla", {}, { page: "elsewhere" })).toMatchObject({
    ok: false,
    status: 400,
  })
})
test("import is a confirmed atomic whole-month replacement and shares monthly CAS", () => {
  const state = snapshot()
  state.data.opsTickets = [
    { year: 2026, month: 11, obsolete: 17 },
    { year: 2026, month: 12, keep: 3 },
  ]
  state.data.opsHeatmap = [{ year: 2026, month: 11, item: "old", p1: 2 }]
  const before = structuredClone(state)
  expect(
    command(state, "import-month", {
      year: 2026,
      month: 11,
      tickets: {},
      sla: {},
      heatmap: [],
    }),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  expect(
    command(
      state,
      "import-month",
      {
        year: 2026,
        month: 11,
        tickets: {},
        sla: {},
        heatmap: [{ item: "iRely", p1: -1 }],
      },
      { confirmed: true },
    ),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  expect(
    command(state, "import-month", { year: 2026, month: 11, tickets: {}, sla: {}, heatmap: [] }, { confirmed: true }),
  ).toMatchObject({ ok: true })
  expect(state.data.opsTickets).toEqual([
    { year: 2026, month: 12, keep: 3 },
    { id: "2026-11", year: 2026, month: 11 },
  ])
  expect(state.data.opsHeatmap).toEqual([])
  expect(state.audit).toHaveLength(1)
})
test("security entries distinguish blank and zero; derived closure and strict phishing render", () => {
  const state = snapshot()
  expect(
    command(
      state,
      "save-kpi",
      {
        year: 2026,
        month: 11,
        training: "",
        patch: 0,
        socCritical: 10,
        socPending: 1,
      },
      { page: pages[1] },
    ),
  ).toMatchObject({ ok: true })
  const view = domain.view(state, actor, { at, id: () => "id", directory: [] })
  expect(view.data.secKpi).toEqual(expect.arrayContaining([expect.objectContaining({ training: "", patch: 0 })]))
  expect(
    command(
      state,
      "save-campaign",
      {
        name: "Threshold",
        targeted: 100,
        clicked: 10,
        entered: 0,
        reported: 20,
      },
      { page: pages[1] },
    ),
  ).toMatchObject({ ok: true })
  const html = render(pages[1], state.data, {
    actor,
    year: 2026,
    month: 11,
    at,
    versions: state.versions,
  })!
  expect(html).toContain("No data")
  expect(html).toContain("90")
  expect(html).toContain('data-tone="moderate"')
})
test("mandatory incident and campaign inputs, dates, finite numbers and unknown fields fail atomically", () => {
  const state = snapshot()
  for (const [action, values] of [
    ["save-incident", { title: "", date: "2026-11-11" }],
    ["save-incident", { title: "test", date: "2026-02-30" }],
    ["save-campaign", { name: "" }],
    ["save-kpi", { year: 2026, month: 11, training: Infinity }],
    ["save-action", { text: "x", owner: "invented" }],
  ] as const) {
    const before = structuredClone(state)
    expect(command(state, action, values, { page: pages[1] })).toMatchObject({
      ok: false,
      status: 422,
    })
    expect(state).toEqual(before)
  }
})
test("actions have only text/done, incident lifecycle, per-record conflicts and delete", () => {
  const state = snapshot()
  expect(command(state, "save-action", { text: "Review", done: false }, { page: pages[1] })).toMatchObject({ ok: true })
  expect(state.data.secActions).toEqual([{ id: "server-id", text: "Review", done: false }])
  expect(
    command(state, "save-action", { text: "Reviewed", done: true }, { page: pages[1], id: "server-id", version: 1 }),
  ).toMatchObject({ ok: true })
  expect(
    command(
      state,
      "save-incident",
      {
        title: "Alert",
        date: "2026-11-11",
        contained: true,
        remediated: true,
        rootCause: false,
      },
      { page: pages[1] },
    ),
  ).toMatchObject({ ok: true })
  expect(
    render(pages[1], state.data, {
      actor,
      year: 2026,
      month: 11,
      at,
      versions: state.versions,
    }),
  ).toContain("Open")
  const before = structuredClone(state)
  expect(command(state, "delete-action", {}, { page: pages[1], id: "server-id", version: 0 })).toMatchObject({
    ok: false,
    status: 409,
  })
  expect(state).toEqual(before)
  expect(command(state, "delete-action", {}, { page: pages[1], id: "server-id", version: 2 })).toMatchObject({
    ok: true,
  })
  expect(state.data.secActions).toEqual([])
})
test("view returns only authorized owned data and versions without private payload; rendering escapes and heat thresholds", () => {
  const state = snapshot()
  state.data = {
    members: [{ notes: "SECRET" }],
    opsTickets: [],
    secActions: [{ id: "x", text: '<script>"bad"</script>', done: false }],
    opsHeatmap: [{ year: 2026, month: 11, item: "iRely", p1: 2, p2: 0, tickets: 0 }],
  }
  state.versions = {
    "members:x": { version: 1, by: "secret" },
    "ops:2026-11": { version: 1, by: actor.id },
  }
  const view = domain.view(state, actor, { at, id: () => "id", directory: [] })
  expect(view.data.members).toBeUndefined()
  expect(view.versions["members:x"]).toBeUndefined()
  const denied = domain.view(state, { ...actor, roles: ["viewer"] }, { at, id: () => "id", directory: [] })
  expect(denied).toEqual({ data: {}, versions: {} })
  expect(
    render(pages[1], view.data, {
      actor,
      year: 2026,
      month: 11,
      at,
      versions: view.versions,
    }),
  ).toContain("&lt;script&gt;")
  expect(
    render(pages[1], view.data, {
      actor,
      year: 2026,
      month: 11,
      at,
      versions: view.versions,
    }),
  ).not.toContain('<script>"bad"')
  expect(
    render(pages[0], view.data, {
      actor,
      year: 2026,
      month: 11,
      at,
      versions: view.versions,
    }),
  ).toContain("rgba(239,68,68,.18)")
  expect(render("unknown", {}, { actor, year: 2026, month: 11, at, versions: {} })).toBeUndefined()
})

test("ticket category keys match source, counts default zero, heatmap upserts and monthly CAS applies across blocks", () => {
  const state = snapshot()
  const key = "Infrastructure|Incidents|Open"
  expect(command(state, "save-tickets", { year: 2026, month: 11, [key]: 3 })).toMatchObject({ ok: true })
  expect(state.data.opsTickets).toEqual([expect.objectContaining({ [key]: 3, "IT Security|Incidents|Open": 0 })])
  const before = structuredClone(state)
  expect(
    command(state, "save-heatmap", {
      year: 2026,
      month: 11,
      item: "iRely",
      p1: 1,
    }),
  ).toMatchObject({ ok: false, status: 409 })
  expect(state).toEqual(before)
  expect(command(state, "save-heatmap", { year: 2026, month: 11, item: "iRely", p1: 1 }, { version: 1 })).toMatchObject(
    { ok: true },
  )
  expect(command(state, "save-heatmap", { year: 2026, month: 11, item: "iRely", p2: 5 }, { version: 2 })).toMatchObject(
    { ok: true },
  )
  expect(state.data.opsHeatmap).toEqual([
    {
      id: "2026-11:iRely",
      year: 2026,
      month: 11,
      item: "iRely",
      p1: 0,
      p2: 5,
      tickets: 0,
      comments: "",
    },
  ])
})
test("heatmap renders each exact boundary and leaves absent cells uncolored", () => {
  const state = snapshot()
  const cases = [
    { p1: 0, p2: 0, tickets: 0, expected: "⚪" },
    { p1: 2, p2: 0, tickets: 0, expected: "🔴" },
    { p1: 1, p2: 0, tickets: 0, expected: "🟠" },
    { p1: 0, p2: 5, tickets: 0, expected: "🟠" },
    { p1: 0, p2: 1, tickets: 0, expected: "🟡" },
    { p1: 0, p2: 0, tickets: 20, expected: "🟡" },
    { p1: 0, p2: 0, tickets: 1, expected: "🟢" },
  ]
  for (const [index, cell] of cases.entries()) {
    expect(
      command(state, "save-heatmap", {
        year: 2026,
        month: index + 1,
        item: "iRely",
        p1: cell.p1,
        p2: cell.p2,
        tickets: cell.tickets,
      }),
    ).toMatchObject({ ok: true })
  }
  const html = render(pages[0], domain.view(state, actor, { at, id: () => "id", directory: [] }).data, {
    actor,
    year: 2026,
    month: 11,
    at,
    versions: state.versions,
  })!
  for (const cell of cases) expect(html).toContain(cell.expected)
  expect(html).toContain("—")
  expect(html).toContain("rgba(245,158,11,.18)")
  expect(html).toContain("rgba(234,179,8,.10)")
  expect(html).toContain("rgba(20,184,166,.08)")
})
test("form JSON fields decode at server, malformed input is atomic, categories are conflict protected", () => {
  const state = snapshot()
  expect(
    command(state, "save-categories", {
      names: "Infrastructure\nNew category",
    }),
  ).toMatchObject({ ok: true })
  const before = structuredClone(state)
  expect(command(state, "save-categories", { names: "Other" })).toMatchObject({
    ok: false,
    status: 409,
  })
  expect(state).toEqual(before)
  expect(
    command(state, "import-month", {
      year: "2026",
      month: "11",
      tickets: '{"New category|Incidents|Open":4}',
      sla: '{"avail":""}',
      heatmap: "[]",
      confirmed: "true",
    }),
  ).toMatchObject({ ok: true })
  expect(
    command(
      state,
      "save-campaign",
      {
        name: "Campaign",
        departments: '[{"name":"Finance","users":10,"failed":4}]',
      },
      { page: pages[1] },
    ),
  ).toMatchObject({ ok: true })
  const beforeBad = structuredClone(state)
  expect(command(state, "save-campaign", { name: "bad", departments: "[invalid" }, { page: pages[1] })).toMatchObject({
    ok: false,
    status: 422,
  })
  expect(state).toEqual(beforeBad)
  const html = render(pages[1], state.data, {
    actor,
    year: 2026,
    month: 11,
    at,
    versions: state.versions,
  })!
  expect(html).toContain('data-tone="red"')
  expect(html).toContain("No data")
})
test("import changing configured lists requires their versions and audits the additions", () => {
  const state = snapshot()
  expect(command(state, "save-categories", { names: "Infrastructure" })).toMatchObject({ ok: true })
  const values = {
    year: 2026,
    month: 11,
    tickets: { "New category|Incidents|Open": 1 },
    sla: {},
    heatmap: [],
  }
  const before = structuredClone(state)
  expect(command(state, "import-month", values, { confirmed: true })).toMatchObject({ ok: false, status: 409 })
  expect(state).toEqual(before)
  expect(command(state, "import-month", { ...values, categoriesVersion: 1 }, { confirmed: true })).toMatchObject({
    ok: true,
  })
  expect(state.data.opsCats).toEqual(["Infrastructure", "New category"])
  expect(state.versions["ops-list:opsCats"]?.version).toBe(2)
  expect(state.audit).toHaveLength(3)
})
test("monthly entry blank save replaces by year/month and prior year is isolated", () => {
  const state = snapshot()
  expect(command(state, "save-kpi", { year: 2026, month: 11, training: 95 }, { page: pages[1] })).toMatchObject({
    ok: true,
  })
  expect(command(state, "save-kpi", { year: 2025, month: 11, training: 50 }, { page: pages[1] })).toMatchObject({
    ok: true,
  })
  expect(
    command(state, "save-kpi", { year: 2026, month: 11, training: "", socClosure: 0 }, { page: pages[1], version: 1 }),
  ).toMatchObject({ ok: true })
  expect(state.data.secKpi).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        year: 2026,
        month: 11,
        training: "",
        socClosure: 0,
      }),
      expect.objectContaining({ year: 2025, training: 50 }),
    ]),
  )
  expect(
    command(state, "delete-kpi", { year: 2026, month: 11 }, { page: pages[1], id: "2026-11", version: 2 }),
  ).toMatchObject({ ok: true })
  expect(state.data.secKpi).toHaveLength(1)
})
test("viewer summary reads are restricted; contributor security writes never imply Operations assignment", () => {
  const state = snapshot()
  state.data = {
    summaries: [pages[1]],
    opsSLA: [{ year: 2026, month: 11 }],
    secKpi: [],
    members: [{ notes: "secret" }],
  }
  const view = domain.view(state, { ...actor, roles: ["viewer"] }, { at, id: () => "id", directory: [] })
  expect(view.data).toEqual({
    secKpi: [],
    nativeSecuritySummaryByYear: Object.fromEntries(
      ["2024", "2025", "2026", "2027"].map((year) => [
        year,
        Object.fromEntries(
          ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map((month) => [
            month,
            {
              tiles: [
                { key: "training", value: null, status: "No data" },
                { key: "patch", value: null, status: "No data" },
                { key: "patchEndpoint", value: null, status: "No data" },
                { key: "patchServer", value: null, status: "No data" },
                { key: "scan", value: null, status: "No data" },
                { key: "assessment", value: null, status: "No data" },
                { key: "socPending", value: null, status: "No data" },
                { key: "socClosure", value: null, status: "No data" },
              ],
            },
          ]),
        ),
      ]),
    ),
  })
  const assigned = { ...actor, roles: ["contributor"], assigned: ["security"] }
  expect(
    domain.execute(
      state,
      assigned,
      {
        page: pages[1],
        action: "save-action",
        version: 0,
        values: { text: "Check", done: true },
      },
      { at, id: () => "check", directory: [] },
    ),
  ).toMatchObject({ ok: true })
  expect(
    domain.execute(
      state,
      assigned,
      {
        page: pages[0],
        action: "save-sla",
        version: 0,
        values: { year: 2026, month: 11 },
      },
      { at, id: () => "id", directory: [] },
    ),
  ).toMatchObject({ ok: false, status: 403 })
  const html = render(pages[1], state.data, {
    actor: { ...actor, roles: ["viewer"] },
    year: 2026,
    month: 11,
    at,
    versions: state.versions,
  })!
  expect(html).toContain('type="submit" disabled')
})

test("all rendered command actions exist, deletions act on real records, malformed import objects fail", () => {
  const state = snapshot()
  expect(command(state, "save-items", { names: ["iRely", "<custom>"] })).toMatchObject({ ok: true })
  expect(command(state, "save-campaign", { name: "Delete campaign", targeted: 0 }, { page: pages[1] })).toMatchObject({
    ok: true,
  })
  expect(command(state, "delete-campaign", {}, { page: pages[1], id: "server-id", version: 1 })).toMatchObject({
    ok: true,
  })
  expect(state.data.secPhishing).toEqual([])
  expect(
    command(
      state,
      "save-incident",
      {
        title: "Contained",
        date: "2026-11-11",
        contained: true,
        remediated: true,
        rootCause: true,
        consequences: '["Data loss"]',
      },
      { page: pages[1] },
    ),
  ).toMatchObject({ ok: true })
  expect(command(state, "delete-incident", {}, { page: pages[1], id: "server-id", version: 1 })).toMatchObject({
    ok: true,
  })
  expect(state.data.secIncidents).toEqual([])
  for (const action of ["__proto__", "constructor", "toString"]) {
    const before = structuredClone(state)
    expect(command(state, action, {}, { page: pages[1] })).toMatchObject({
      ok: false,
      status: 400,
    })
    expect(state).toEqual(before)
  }
  const before = structuredClone(state)
  expect(
    command(state, "import-month", { year: 2026, month: 11, tickets: [], sla: {}, heatmap: [] }, { confirmed: true }),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  const html = render(pages[0], state.data, {
    actor,
    year: 2026,
    month: 11,
    at,
    versions: state.versions,
  })!
  expect(html).toContain("&lt;custom&gt;")
  expect(html).not.toContain("<custom>")
  for (const action of ["save-tickets", "save-sla", "save-heatmap", "save-categories", "save-items", "import-month"])
    expect(html).toContain(`data-command="${action}"`)
})
