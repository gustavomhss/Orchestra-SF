import { describe, expect, test } from "bun:test"
import { domain, pages, render } from "../runtime/dashboard-portfolio.ts"
import type { Actor, Command, Snapshot } from "../runtime/contract.ts"

const admin: Actor = { id: "admin", roles: ["admin"], canWrite: true }
const environment = {
  at: "2026-11-11T12:00:00Z",
  id: () => "new-id",
  directory: [],
}
function snapshot(data: Record<string, unknown> = {}): Snapshot {
  return { data, versions: {}, sequences: {}, audit: [], notices: [] }
}
function command(page: string, values: Record<string, unknown>, extra: Partial<Command> = {}): Command {
  return { page, action: "save", values, version: 0, ...extra }
}

describe("dashboard portfolio runtime", () => {
  test("risk factors retain six, blank becomes one; derived fields are not stored", () => {
    const state = snapshot()
    expect(
      domain.execute(state, admin, command("IT Risks", { name: "Risk", impact: "6", probability: "" }), environment).ok,
    ).toBe(true)
    expect(state.data.risks).toMatchObject([{ id: "new-id", impact: 6, probability: 1, status: "open" }])
    expect(state.audit).toHaveLength(1)
    expect(state.versions["risks:new-id"]?.version).toBe(1)
    expect(JSON.stringify(state.data)).not.toContain('"score"')
  })
  test("denied actors and missing ownership predicate never mutate or audit", () => {
    for (const actor of [
      { ...admin, canWrite: false },
      { id: "c", canWrite: true, roles: ["contributor"], assigned: [] },
      { id: "l", canWrite: true, roles: ["domain leader"] },
    ]) {
      const state = snapshot({
        projects: [{ id: "p", name: "Old", leaderId: actor.id }],
      })
      const before = structuredClone(state)
      expect(
        domain.execute(state, actor, command("All Projects", { name: "Changed" }, { id: "p" }), environment),
      ).toMatchObject({ ok: false, status: 403 })
      expect(state).toEqual(before)
    }
  })
  test("assigned contributors edit only the matching module; stale CAS returns stored and author", () => {
    const actor = {
      id: "c",
      canWrite: true,
      roles: ["contributor"],
      assigned: ["risks"],
    }
    const state = snapshot({
      risks: [{ id: "r", name: "Old", impact: 2, probability: 2, custom: "keep" }],
    })
    expect(domain.execute(state, actor, command("IT Risks", { name: "New" }, { id: "r" }), environment).ok).toBe(true)
    const before = structuredClone(state)
    expect(
      domain.execute(state, actor, command("IT Risks", { name: "Stale" }, { id: "r" }), environment),
    ).toMatchObject({
      ok: false,
      status: 409,
      by: "c",
      stored: { name: "New", custom: "keep" },
    })
    expect(state).toEqual(before)
    expect(domain.execute(state, actor, command("Vendor Contracts", { vendor: "X" }), environment)).toMatchObject({
      ok: false,
      status: 403,
    })
  })
  test("project details, milestones and independent capex survive save and imports", () => {
    const state = snapshot({
      projects: [
        {
          id: "p",
          name: "ERP",
          createdAt: "old",
          milestones: [{ name: "Go", status: "upcoming" }],
          custom: 1,
        },
      ],
      capexProjects: [{ id: "p", budget: 5 }],
    })
    expect(
      domain.execute(
        state,
        admin,
        command(
          "All Projects",
          {
            rows: [{ name: " erp ", budget: 9 }],
            mode: "update",
            versions: { "projects:p": 0 },
          },
          { action: "import" },
        ),
        environment,
      ).ok,
    ).toBe(true)
    expect(state.data.projects).toMatchObject([
      {
        id: "p",
        createdAt: "old",
        custom: 1,
        milestones: [{ name: "Go" }],
        budget: 9,
      },
    ])
    expect(state.data.capexProjects).toEqual([{ id: "p", budget: 5 }])
    const before = structuredClone(state)
    expect(
      domain.execute(
        state,
        admin,
        command("All Projects", { rows: [{ name: "New" }], mode: "replace" }, { action: "import" }),
        environment,
      ).ok,
    ).toBe(false)
    expect(state).toEqual(before)
    expect(domain.execute(state, admin, command("All Projects", { name: "" }), environment).ok).toBe(false)
  })
  test("stakeholder priority keys override tier, category and missing owner warning", () => {
    const state = snapshot()
    expect(
      domain.execute(
        state,
        admin,
        command("Stakeholder Management", {
          name: "S",
          biz: 5,
          iti: 5,
          perc: 0,
          priority: "Action Plan Required",
        }),
        environment,
      ),
    ).toMatchObject({ ok: true, warnings: [expect.stringContaining("owner")] })
    const html = render("Stakeholder Management", domain.view(state, admin, environment).data, {
      actor: admin,
      year: 2026,
      month: 11,
      at: environment.at,
      versions: state.versions,
    })
    expect(html).toContain("Sceptic")
    expect(html).toContain("Action Plan Required")
  })
  test("performance overallocated owners requires confirmation; weight warning permits save", () => {
    const state = snapshot()
    const input = command("IT Performance Contract", {
      items: [
        {
          id: "i",
          name: "Delivery",
          totalWeight: 0.8,
          subs: [
            {
              label: "ERP",
              score: 4,
              totalWeight: 0.5,
              ownerWeight: 0.6,
              co1Weight: 0,
              co2Weight: 0,
              status: "on",
            },
          ],
        },
      ],
    })
    const before = structuredClone(state)
    expect(domain.execute(state, admin, input, environment)).toMatchObject({
      ok: false,
      status: 422,
    })
    expect(state).toEqual(before)
    expect(domain.execute(state, admin, { ...input, confirmed: true }, environment)).toMatchObject({
      ok: true,
      warnings: expect.any(Array),
    })
    expect(state.versions.itperf?.version).toBe(1)
    expect(domain.execute(state, admin, input, environment)).toMatchObject({
      ok: false,
      status: 409,
    })
  })
  test("contract deletion returns private deletion keys only from stored documents", () => {
    const state = snapshot({
      contracts: [
        {
          id: "c",
          vendor: "V",
          documents: [{ id: "d", key: "contracts/c/d" }],
        },
      ],
    })
    expect(
      domain.execute(
        state,
        admin,
        command("Vendor Contracts", { key: "client/path" }, { action: "delete", id: "c" }),
        environment,
      ),
    ).toMatchObject({ ok: true, value: { deleteBlobKeys: ["contracts/c/d"] } })
    expect(state.data.contracts).toEqual([])
  })
  test("views expose only authorized collections and their versions; all pages have escaped usable forms", () => {
    const state = snapshot({
      projects: [{ id: "p", name: "<script>", budget: 10, spent: 0 }],
      risks: [],
      contracts: [],
      stakeholders: [],
      itperf: {},
      members: [{ salary: 3 }],
      bank: "secret",
    })
    state.versions["members:x"] = { version: 1, by: "private" }
    expect(domain.view(state, { id: "v", roles: ["viewer"], canWrite: false }, environment)).toEqual({
      data: {},
      versions: {},
    })
    const view = domain.view(state, admin, environment)
    expect(view.data.members).toBeUndefined()
    expect(view.versions["members:x"]).toBeUndefined()
    for (const page of pages) {
      const html = render(page, view.data, {
        actor: admin,
        year: 2024,
        month: 2,
        at: environment.at,
        versions: view.versions,
      })
      expect(html).toContain("<form")
      expect(html).not.toContain("<script>")
      expect(html).not.toContain("JSON editor")
    }
    expect(
      render(
        "other",
        {},
        {
          actor: admin,
          year: 2026,
          month: 1,
          at: environment.at,
          versions: {},
        },
      ),
    ).toBeUndefined()
  })
})

test("contract terms use original field names and blank amount becomes zero", () => {
  const state = snapshot({
    contracts: [
      {
        id: "c",
        vendor: "Vendor",
        num: "C1",
        renewal: "2027-01-01",
        docs: [{ id: "asset", name: "Terms.pdf" }],
        original: "retained",
      },
    ],
  })
  expect(
    domain.execute(
      state,
      admin,
      command("Vendor Contracts", { amount: "", amtType: "monthly", renewType: "auto", eval: "B" }, { id: "c" }),
      environment,
    ).ok,
  ).toBe(true)
  expect(state.data.contracts).toMatchObject([{ amount: 0, num: "C1", renewal: "2027-01-01", original: "retained" }])
  expect(
    domain.execute(
      state,
      admin,
      command("Vendor Contracts", { key: "elsewhere" }, { id: "c", action: "delete", version: 1 }),
      environment,
    ),
  ).toMatchObject({
    ok: true,
    value: { deleteBlobKeys: ["contracts/c/asset"] },
  })
})

test("a stale member of an import batch leaves the entire draft and audit unchanged", () => {
  const state = snapshot({
    projects: [
      { id: "p1", name: "One" },
      { id: "p2", name: "Two" },
    ],
  })
  state.versions["projects:p2"] = { version: 4, by: "other" }
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      admin,
      command(
        "All Projects",
        {
          rows: [{ name: "One" }, { name: "Two" }],
          mode: "update",
          versions: { "projects:p1": 0, "projects:p2": 3 },
        },
        { action: "import" },
      ),
      environment,
    ),
  ).toMatchObject({ ok: false, status: 409, by: "other" })
  expect(state).toEqual(before)
})

test("workbook rows import using per-project versions without touching unrelated rows", () => {
  const state = snapshot({
    projects: [
      {
        id: "p",
        name: "ERP",
        status: "Planning",
        risk: "Low",
        milestones: [],
        preserved: true,
      },
      { id: "u", name: "Untouched", custom: 2 },
    ],
  })
  const untouched = structuredClone((state.data.projects as Record<string, unknown>[])[1])
  expect(
    domain.execute(
      state,
      admin,
      command(
        "All Projects",
        {
          rows: [{ name: "ERP", budget: 15 }],
          mode: "update",
          "version:projects:p": "0",
        },
        { action: "import" },
      ),
      environment,
    ).ok,
  ).toBe(true)
  expect((state.data.projects as Record<string, unknown>[])[1]).toEqual(untouched)
  expect(state.audit.map((entry) => entry.record)).toEqual(["projects:p"])
  expect(state.data.projects).toMatchObject([{ id: "p", preserved: true, budget: 15 }, untouched])
})

test("milestone actions audit and conflict at the parent project version", () => {
  const state = snapshot({
    projects: [{ id: "p", name: "ERP", milestones: [] }],
  })
  const input = command(
    "All Projects",
    { name: "Launch", status: "upcoming", date: "2027-01-01" },
    { id: "p", action: "save-milestone" },
  )
  expect(domain.execute(state, admin, input, environment).ok).toBe(true)
  expect(state.data.projects).toMatchObject([{ milestones: [{ id: "new-id", name: "Launch" }] }])
  const before = structuredClone(state)
  expect(domain.execute(state, admin, input, environment)).toMatchObject({
    ok: false,
    status: 409,
  })
  expect(state).toEqual(before)
})

test("performance keeps unknown original fields and excludes absent scores from weighting", () => {
  const state = snapshot({
    itperf: {
      original: "keep",
      items: [
        {
          id: "i",
          name: "Delivery",
          totalWeight: 1,
          subs: [
            {
              id: "s",
              label: "ERP",
              totalWeight: 1,
              score: "",
              notes: "old",
              custom: 3,
            },
          ],
        },
      ],
    },
  })
  expect(
    domain.execute(
      state,
      admin,
      command("IT Performance Contract", { itemId: "i", subId: "s", score: 0 }, { action: "save-sub" }),
      environment,
    ),
  ).toMatchObject({ ok: true })
  expect(state.data.itperf).toMatchObject({
    original: "keep",
    items: [{ subs: [{ score: 0, custom: 3, notes: "old" }] }],
  })
  const html = render("IT Performance Contract", domain.view(state, admin, environment).data, {
    actor: admin,
    year: 2024,
    month: 1,
    at: environment.at,
    versions: state.versions,
  })
  expect(html).toContain("0.00")
  expect(html).toContain("Q4")
  expect(html).toContain("Owner Dashboard")
})

test("risk tier edges, stakeholder priority override and empty input defaults", () => {
  for (const [impact, probability, tier] of [
    [5, 5, "Critical"],
    [4, 4, "Very High"],
    [3, 3, "High"],
    [1, 3, "Medium"],
    [1, 2, "Low"],
  ] as const) {
    const html = render(
      "IT Risks",
      { risks: [{ id: "r", name: "Risk", impact, probability }] },
      { actor: admin, year: 2026, month: 11, at: environment.at, versions: {} },
    )
    expect(html).toContain(`<td>${tier}</td>`)
  }
  const state = snapshot()
  expect(
    domain.execute(
      state,
      admin,
      command("Stakeholder Management", {
        name: "S",
        biz: "",
        iti: "",
        perc: "",
        priority: "action",
      }),
      environment,
    ),
  ).toMatchObject({ ok: true, warnings: [expect.stringContaining("owner")] })
  expect(state.data.stakeholders).toMatchObject([{ biz: 1, iti: 1, perc: 1 }])
})

test("legacy numeric IDs match commands and version references without losing fields", () => {
  const state = snapshot({
    projects: [
      {
        id: 7,
        name: "Old",
        milestones: [{ id: 3, name: "Launch", status: "upcoming" }],
      },
    ],
    contracts: [{ id: 8, vendor: "Vendor", docs: [{ id: 9, name: "Terms" }] }],
  })
  expect(domain.execute(state, admin, command("All Projects", { name: "Changed" }, { id: "7" }), environment).ok).toBe(
    true,
  )
  expect(state.data.projects).toMatchObject([{ id: 7, name: "Changed" }])
  expect(state.versions["projects:7"]?.version).toBe(1)
  expect(
    domain.execute(state, admin, command("Vendor Contracts", {}, { id: "8", action: "delete" }), environment),
  ).toMatchObject({ ok: true, value: { deleteBlobKeys: ["contracts/8/9"] } })
})

test("imports use workbook boundary, filters are GET forms and legacy ids are hidden", () => {
  const context = {
    actor: admin,
    year: 2026,
    month: 11,
    at: environment.at,
    versions: { "projects:7": { version: 2, by: "a" } },
  }
  const html = render(
    "All Projects",
    {
      projects: [
        { id: 7, name: "Shown", status: "Planning" },
        { id: 8, name: "Hidden", status: "Completed" },
      ],
      status: "Planning",
    },
    context,
  )
  expect(html).toContain('method="get"')
  expect(html).toContain('data-workbook="projects"')
  expect(html).toContain('accept=".xlsx"')
  expect(html).toContain('data-record="7" data-version="2"')
  expect(html).not.toContain("Hidden")
  expect(html).not.toContain('name="projectData"')
  expect(html).not.toContain('name="leaderId"')
})

test("weight tolerance permits small differences; owner overage above tolerance needs confirmation", () => {
  const state = snapshot()
  const input = command("IT Performance Contract", {
    items: [
      {
        name: "Delivery",
        totalWeight: 0.996,
        subs: [
          {
            label: "ERP",
            totalWeight: 0.996,
            ownerWeight: 0.9964,
            score: null,
          },
        ],
      },
    ],
  })
  expect(domain.execute(state, admin, input, environment)).toMatchObject({
    ok: true,
    warnings: [],
  })
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      admin,
      command(
        "IT Performance Contract",
        { itemId: "new-id", subId: "new-id", ownerWeight: 0.997 },
        { action: "save-sub", version: 1 },
      ),
      environment,
    ),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
})

test("invalid import batch writes no audit and only first homonym requires a version", () => {
  const state = snapshot({
    projects: [
      { id: 1, name: "ERP", custom: 1 },
      { id: 2, name: "erp", custom: 2 },
    ],
  })
  const second = structuredClone((state.data.projects as Record<string, unknown>[])[1])
  expect(
    domain.execute(
      state,
      admin,
      command(
        "All Projects",
        {
          rows: [{ name: "ERP", status: "Invalid" }],
          mode: "update",
          versions: { "projects:1": 0 },
        },
        { action: "import" },
      ),
      environment,
    ),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state.audit).toEqual([])
  expect(
    domain.execute(
      state,
      admin,
      command(
        "All Projects",
        {
          rows: [{ name: "ERP", status: "Completed" }],
          mode: "update",
          versions: { "projects:1": 0 },
        },
        { action: "import" },
      ),
      environment,
    ).ok,
  ).toBe(true)
  expect((state.data.projects as Record<string, unknown>[])[1]).toEqual(second)
  expect(state.audit.map((entry) => entry.record)).toEqual(["projects:1"])
  expect((state.data.projects as Record<string, unknown>[])[0]?.id).toBe(1)
})
