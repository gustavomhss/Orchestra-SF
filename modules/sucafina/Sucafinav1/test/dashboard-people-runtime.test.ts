import { expect, test } from "bun:test"
import { domain, pages, render } from "../runtime/dashboard-people.ts"
import type { Snapshot } from "../runtime/contract.ts"
const actor = { id: "directory-admin", canWrite: true, roles: ["admin"] }
const at = "2026-11-11T12:00:00Z"
function snapshot(): Snapshot {
  return { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
}
test("dashboard-people required pages contain functional controls or nonempty read views", () => {
  for (const page of pages) {
    const html = render(page, {}, { actor, year: 2026, month: 11, at, versions: {} })
    expect(html).toBeString()
    expect(html!.length).toBeGreaterThan(80)
    expect(html).toMatch(/<table|<form|class="metric"/)
  }
})
test("dashboard-people direct write without canWrite fails atomically", () => {
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

const environment = { at, id: () => "server-id", directory: [] }
test("hot topics persist, reject stale updates and reject unknown commands atomically", () => {
  const state = snapshot()
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[0],
        action: "save",
        version: 0,
        values: {
          action: "Resolve outage",
          status: "open",
          priority: "critical",
        },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(state.data.hotTopics).toMatchObject([{ id: "server-id", action: "Resolve outage" }])
  expect(state.versions["hotTopics:server-id"]?.version).toBe(1)
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[0],
        action: "save",
        id: "server-id",
        version: 0,
        values: { action: "stale" },
      },
      environment,
    ),
  ).toMatchObject({ ok: false, status: 409, by: actor.id })
  expect(state).toEqual(before)
  expect(
    domain.execute(state, actor, { page: pages[0], action: "surprise", version: 0, values: {} }, environment),
  ).toMatchObject({ ok: false, status: 400 })
  expect(state).toEqual(before)
})
test("talent stays admin only even with supplied identity joins; reads audit every member", () => {
  const state = snapshot()
  state.data = {
    members: [
      {
        id: "m",
        name: "A",
        leaderId: "l",
        cls: "Talent",
        outlook: "Promote",
        notes: "private",
        status: "Active",
      },
    ],
    leaders: [{ id: "l", name: "Leader" }],
    leaderJoin: [{ directoryId: "d", leaderId: "l" }],
  }
  const leader = { id: "d", canWrite: true, roles: ["domain leader"] }
  const view = domain.view(state, leader, environment)
  expect(JSON.stringify(view.data)).not.toMatch(/private|Promote|"cls"|"outlook"|"notes"/)
  expect(state.audit).toContainEqual(expect.objectContaining({ who: "d", at, record: "members:m" }))
  expect(
    render(pages[1], view.data, {
      actor: leader,
      year: 2026,
      month: 11,
      at,
      versions: {},
    }),
  ).not.toContain(">Talent<")
  const before = structuredClone(state)
  expect(
    domain.execute(state, leader, { page: pages[3], action: "exportAllMembers", version: 0, values: {} }, environment),
  ).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
  expect(
    domain.execute(
      state,
      leader,
      {
        page: pages[2],
        action: "saveMember",
        id: "m",
        version: 0,
        values: { name: "B", cls: "posted-private", outlook: "posted-private", notes: "posted-private" },
      },
      environment,
    ),
  ).toMatchObject({ ok: true })
  expect(state.data.members).toMatchObject([{ id: "m", name: "B", cls: "Talent", outlook: "Promote", notes: "private" }])
  expect(JSON.stringify(state.data)).not.toContain("posted-private")
  expect(state.versions["members:m"]?.version).toBe(1)
})
test("member import confirmation and name matching preserve nonempty fields, clear talent, audit export", () => {
  const state = snapshot()
  state.data.members = [
    {
      id: "m",
      name: " Alice ",
      title: "Engineer",
      notes: "Keep",
      cls: "Talent",
      outlook: "Promote",
    },
  ]
  const command = {
    page: pages[3],
    action: "import",
    version: 0,
    values: { replace: true, rows: [{ Name: "Alice" }] },
  }
  const before = structuredClone(state)
  expect(domain.execute(state, actor, command, environment)).toMatchObject({
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
        values: {
          rows: [
            {
              Name: "alice",
              Title: "",
              Classification: "",
              Outlook: "",
              Notes: "",
            },
          ],
          versions: { "members:m": 0 },
        },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(state.data.members).toMatchObject([{ id: "m", title: "Engineer", notes: "Keep", cls: "", outlook: "" }])
  const count = state.audit.length
  expect(
    domain.execute(state, actor, { page: pages[3], action: "exportAllMembers", version: 0, values: {} }, environment)
      .ok,
  ).toBe(true)
  expect(state.audit.length).toBe(count + 1)
})
test("leader deletion clears members with independent versions and audit", () => {
  const state = snapshot()
  state.data = {
    leaders: [{ id: "l", name: "Leader" }],
    members: [{ id: "m", name: "Member", leaderId: "l" }],
  }
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[2],
        action: "deleteLeader",
        id: "l",
        version: 0,
        values: { versions: { "members:m": 0 } },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(state.data.leaders).toEqual([])
  expect(state.data.members).toMatchObject([{ id: "m", leaderId: "" }])
  expect(state.versions["members:m"]?.version).toBe(1)
  expect(state.audit).toHaveLength(2)
})

test("contributor assignment never grants people or hot topics; unknown pages fail closed", () => {
  const state = snapshot()
  const contributor = {
    id: "c",
    canWrite: true,
    roles: ["contributor"],
    assigned: ["people", "Hot Topics & Actions"],
  }
  state.data.members = [{ id: "m", name: "Secret", cls: "Talent", notes: "Private" }]
  expect(domain.view(state, contributor, environment).data).toEqual({})
  const before = structuredClone(state)
  for (const page of pages)
    expect(domain.execute(state, contributor, { page, action: "save", version: 0, values: {} }, environment).ok).toBe(
      false,
    )
  expect(
    domain.execute(state, actor, { page: "Unregistered", action: "save", version: 0, values: {} }, environment),
  ).toMatchObject({ ok: false, status: 400 })
  expect(state).toEqual(before)
})
test("viewer summaries expose only public member fields and never salary", () => {
  const state = snapshot()
  state.data = {
    summaries: [pages[1], "Made up"],
    members: [
      {
        id: "m",
        name: "A",
        salary: 100,
        cls: "Talent",
        outlook: "Promote",
        notes: "Private",
      },
    ],
  }
  const view = domain.view(state, { id: "v", canWrite: false, roles: ["viewer"] }, environment)
  expect(view.data.members).toEqual([{ id: "m", name: "A" }])
  expect(state.audit).toHaveLength(1)
})
test("domain leaders may save hot topics and team structure without an identity join", () => {
  const state = snapshot()
  const leader = { id: "l", canWrite: true, roles: ["domain leader"] }
  expect(
    domain.execute(
      state,
      leader,
      {
        page: pages[0],
        action: "save",
        version: 0,
        values: { action: "Plan recovery" },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(
    domain.execute(
      state,
      leader,
      {
        page: pages[2],
        action: "saveLeader",
        version: 0,
        values: { name: "Leader" },
      },
      environment,
    ),
  ).toMatchObject({ ok: true })
  expect(state.data.leaders).toMatchObject([{ id: "server-id", name: "Leader" }])
  expect(state.versions["leaders:server-id"]?.version).toBe(1)
})
test("cascade delete conflict returns stored member and leaves all records unchanged", () => {
  const state = snapshot()
  state.data = {
    leaders: [{ id: "l", name: "Leader" }],
    members: [{ id: "m", name: "Member", leaderId: "l" }],
  }
  state.versions["members:m"] = { version: 2, by: "another-editor" }
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[2],
        action: "deleteLeader",
        id: "l",
        version: 0,
        values: { versions: { "members:m": 1 } },
      },
      environment,
    ),
  ).toMatchObject({
    ok: false,
    status: 409,
    by: "another-editor",
    stored: { id: "m" },
  })
  expect(state).toEqual(before)
})
test("late invalid import rolls back earlier valid rows and audit", () => {
  const state = snapshot()
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[3],
        action: "import",
        version: 0,
        values: { rows: [{ Name: "A" }, { Name: "B", Status: "invalid" }] },
      },
      {
        ...environment,
        id: (() => {
          const ids = ["a", "b"]
          return () => ids.shift()!
        })(),
      },
    ),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
})
test("confirmed replacement audits deletion and creation without touching leaders", () => {
  const state = snapshot()
  state.data = {
    members: [{ id: "old", name: "Old" }],
    leaders: [{ id: "l", name: "Leader" }],
  }
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[3],
        action: "import",
        confirmed: true,
        version: 0,
        values: {
          replace: true,
          versions: { "members:old": 0 },
          rows: [
            { Name: "New", Leader: "leader" },
            { Name: " new ", Title: "Updated" },
          ],
        },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(state.data.members).toMatchObject([{ id: "server-id", title: "Updated", leaderId: "l" }])
  expect(state.data.leaders).toMatchObject([{ id: "l" }])
  expect(state.audit).toHaveLength(3)
  expect(state.versions["members:server-id"]?.version).toBe(2)
})
test("member changes and CIO singleton persist with audited versions", () => {
  const state = snapshot()
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[2],
        action: "saveCio",
        version: 0,
        values: {
          name: "CIO",
          title: "IT",
          location: "Geneva",
          start: "2020-01-01",
        },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(state.versions.cio?.version).toBe(1)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[2],
        action: "saveMember",
        version: 0,
        values: { name: "Member", status: "Active", type: "Contractor" },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[3],
        action: "save",
        id: "server-id",
        version: 1,
        values: { cls: "Talent", outlook: "Promote", notes: "Review" },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(state.data.members).toMatchObject([{ cls: "Talent", outlook: "Promote", notes: "Review" }])
  expect(state.audit).toHaveLength(3)
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[2],
        action: "saveCio",
        version: 0,
        values: { name: "Stale" },
      },
      environment,
    ),
  ).toMatchObject({ ok: false, status: 409, stored: { name: "CIO" } })
  expect(state).toEqual(before)
})
test("headcount preserves active-only leader talent versus all-member talent and calendar ratio", () => {
  const html = render(
    pages[1],
    {
      members: [
        { id: "a", status: "Active", cls: "Talent", leaderId: "l" },
        { id: "t", status: "Terminated", cls: "Talent", end: "2026-10-01" },
        { id: "leave", status: "On Leave" },
      ],
      leaders: [{ id: "l", name: "Leader" }],
      itUsersMonthly: [{ year: 2026, month: 10, users: 42 }],
    },
    { actor, year: 2026, month: 1, at, versions: {} },
  )
  expect(html).toContain("<span>Talent</span><strong>2</strong>")
  expect(html).toContain("<td>Leader</td><td>1</td><td>1</td>")
  expect(html).toContain("<span>Staff ratio</span><strong>42</strong>")
  expect(html).toContain("<span>Attrition YTD</span><strong>66.7%</strong>")
  expect(html).not.toContain("salary")
})
test("render escapes topic and member input; talent defaults to Active", () => {
  const context = { actor, year: 2026, month: 11, at, versions: {} }
  expect(
    render(
      pages[0],
      {
        hotTopics: [{ id: "t", action: "<script>", due: "2026-11-10", status: "open" }],
      },
      context,
    ),
  ).toContain("&lt;script&gt;")
  expect(
    render(
      pages[0],
      {
        hotTopics: [{ id: "t", action: "Due", due: "2026-11-10", status: "done" }],
      },
      context,
    ),
  ).not.toContain("Overdue")
  expect(render(pages[3], { members: [{ id: "t", name: "Departed", status: "Terminated" }] }, context)).not.toContain(
    "Departed",
  )
  expect(render("Unknown page", {}, context)).toBeUndefined()
})

test("form JSON rows and hidden versions use the same import boundary as direct commands", () => {
  const state = snapshot()
  state.data.members = [{ id: "m", name: "A", title: "Old" }]
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[3],
        action: "import",
        version: 0,
        values: {
          rows: JSON.stringify([{ Name: "A", Title: "Updated" }]),
          versions: JSON.stringify({ "members:m": 0 }),
        },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(state.data.members).toMatchObject([{ id: "m", title: "Updated" }])
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[3],
        action: "import",
        version: 0,
        values: { rows: "invalid JSON" },
      },
      environment,
    ),
  ).toMatchObject({ ok: false, status: 422 })
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[3],
        action: "import",
        version: 0,
        values: {
          rows: [{ Name: "A", Title: "Stale" }],
          versions: { "members:m": 0 },
        },
      },
      environment,
    ),
  ).toMatchObject({ ok: false, status: 409, by: actor.id })
  expect(state).toEqual(before)
})

test("original workbook date headers import and blank dates preserve stored values", () => {
  const state = snapshot()
  state.data.members = [{ id: "m", name: "A", start: "2020-01-01", end: "2025-12-31" }]
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[3],
        action: "import",
        version: 0,
        values: {
          versions: { "members:m": 0 },
          rows: [
            {
              Name: "A",
              "Start Date": "2021-02-03",
              "End Date": "2026-10-31",
              Tenure: "Ignored computed value",
            },
          ],
        },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(state.data.members).toMatchObject([{ start: "2021-02-03", end: "2026-10-31" }])
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[3],
        action: "import",
        version: 0,
        values: {
          versions: { "members:m": 1 },
          rows: [{ Name: "A", "Start Date": "", "End Date": "" }],
        },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(state.data.members).toMatchObject([{ start: "2021-02-03", end: "2026-10-31" }])
  expect(JSON.stringify(state.data.members)).not.toContain("Ignored computed value")
})
test("nonadmin view preserves hot-topic notes while stripping member talent notes", () => {
  const state = snapshot()
  state.data = {
    hotTopics: [{ id: "t", action: "Review", notes: "Public action context" }],
    members: [
      {
        id: "m",
        name: "A",
        notes: "Private talent context",
        cls: "Talent",
        outlook: "Promote",
      },
    ],
  }
  const view = domain.view(state, { id: "l", canWrite: true, roles: ["domain leader"] }, environment)
  expect(view.data.hotTopics).toMatchObject([{ notes: "Public action context" }])
  expect(view.data.members).toEqual([{ id: "m", name: "A" }])
  expect(JSON.stringify(view.data)).not.toContain("Private talent context")
})

test("people controls use workbook upload, real download and submitted GET filters", () => {
  const context = { actor, year: 2026, month: 11, at, versions: {} }
  const talent = render(
    pages[3],
    {
      memberStatus: "Terminated",
      members: [
        { id: 12, name: "Departed", status: "Terminated" },
        { id: 13, name: "Current", status: "Active" },
      ],
    },
    context,
  )!
  expect(talent).toContain('<input type="file" name="workbook" accept=".xlsx" data-workbook="members" required>')
  expect(talent).toContain('<a href="?download=members">Export All Members</a>')
  expect(talent).toContain('<form method="get"><input type="hidden" name="page" value="Talent Review">')
  expect(talent).toContain('<button type="submit">Apply filter</button>')
  expect(talent).toContain('<option value="Terminated" selected>')
  expect(talent).toContain("Departed")
  expect(talent).not.toContain("Current")
  expect(talent).toContain('<input type="hidden" name="rows" data-workbook-rows data-json="true">')
  expect(talent).not.toMatch(/Excel rows|<textarea[^>]*name="rows"|<input(?![^>]*type="hidden")[^>]*name="rows"|data-command="exportAllMembers"|Desenho|§11|predicate/)
  const topics = render(
    pages[0],
    {
      topicStatus: "blocked",
      hotTopics: [
        { id: 1, action: "Blocked action", status: "blocked" },
        { id: 2, action: "Finished action", status: "done" },
      ],
    },
    context,
  )!
  expect(topics).toContain('<form method="get"><input type="hidden" name="page" value="Hot Topics &amp; Actions">')
  expect(topics).toContain('name="topicStatus"')
  expect(topics).toContain("Blocked action")
  expect(topics).not.toContain("Finished action")
  const denied = render(pages[3], {}, { ...context, actor: { id: "v", roles: ["viewer"], canWrite: false } })!
  expect(denied).toContain("Status filter (blank = Active)")
  expect(denied).not.toContain("Classification")
  expect(denied).not.toContain("Outlook")
  expect(denied).not.toContain("data-command=")
  expect(denied).not.toMatch(/Desenho|§|directory|predicate|leader link/)
})
test("numeric artifact IDs survive edits, views, audits and leader deletion", () => {
  const state = snapshot()
  state.data = {
    hotTopics: [{ id: 10, action: "Original" }],
    leaders: [{ id: 0, name: "Leader" }],
    members: [{ id: 20, name: "Member", leaderId: 0, status: "Active" }],
  }
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[0],
        action: "save",
        id: "10",
        version: 0,
        values: { action: "Updated" },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(state.data.hotTopics).toMatchObject([{ id: 10, action: "Updated" }])
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[2],
        action: "saveMember",
        id: "20",
        version: 0,
        values: { title: "Engineer" },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(state.data.members).toMatchObject([{ id: 20, leaderId: 0, title: "Engineer" }])
  const view = domain.view(state, actor, environment)
  expect(view.data.members).toMatchObject([{ id: "20", leaderId: 0 }])
  expect(state.audit).toContainEqual(
    expect.objectContaining({
      record: "members:20",
      became: { read: true, member: "20" },
    }),
  )
  const html = render(pages[2], view.data, {
    actor,
    year: 2026,
    month: 11,
    at,
    versions: view.versions,
  })!
  expect(html).toContain('data-command="saveMember" data-page="Team Structure" data-record="20" data-version="1"')
  expect(html).toContain('<option value="0" selected>')
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[2],
        action: "deleteLeader",
        id: "0",
        version: 0,
        values: { versions: { "members:20": 1 } },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(state.data.leaders).toEqual([])
  expect(state.data.members).toMatchObject([{ id: 20, leaderId: "" }])
  expect(state.versions["members:20"]?.version).toBe(2)
})
test("numeric member IDs match workbook imports without coercing numeric names", () => {
  const state = snapshot()
  state.data = {
    members: [{ id: 42, name: "Alice" }],
    leaders: [{ id: 7, name: "Leader" }],
  }
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[3],
        action: "import",
        version: 0,
        values: {
          versions: { "members:42": 0 },
          rows: [
            {
              Name: " alice ",
              Leader: "Leader",
              "Start Date": "2024-01-01",
              "End Date": "2026-10-31",
            },
          ],
        },
      },
      environment,
    ).ok,
  ).toBe(true)
  expect(state.data.members).toMatchObject([{ id: 42, leaderId: "7", start: "2024-01-01", end: "2026-10-31" }])
  const before = structuredClone(state)
  expect(
    domain.execute(
      state,
      actor,
      {
        page: pages[3],
        action: "import",
        version: 0,
        values: { rows: [{ Name: 123 }] },
      },
      environment,
    ),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
})

test("readonly Talent Review defaults to active members and applies explicit status filters", () => {
  const context = {
    actor: { id: "viewer", canWrite: false, roles: ["domain leader"] },
    year: 2026,
    month: 11,
    at,
    versions: {},
  }
  const data = {
    members: [
      { id: "a", name: "Active person", status: "Active" },
      { id: "t", name: "Departed person", status: "Terminated" },
    ],
  }
  const current = render("Talent Review", data, context)!
  expect(current).toContain("Active person")
  expect(current).not.toContain("Departed person")
  const departed = render("Talent Review", { ...data, memberStatus: "Terminated" }, context)!
  expect(departed).toContain("Departed person")
  expect(departed).not.toContain("Active person")
  expect(departed).not.toContain("data-command=")
})
