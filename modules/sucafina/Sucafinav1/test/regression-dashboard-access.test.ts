import { expect, test } from "bun:test"
import JSZip from "jszip"
import type { Actor, Command, Environment, Snapshot } from "../runtime/contract.ts"
import { domain, pages, render } from "../runtime/dashboard-people.ts"
import { DashboardPortfolio } from "../runtime/dashboard-portfolio.ts"
import { DashboardBudget } from "../runtime/dashboard-budget.ts"
import { DashboardOperations } from "../runtime/dashboard-operations.ts"
import { createReport } from "../runtime/reports.ts"

const at = "2026-11-12T12:00:00Z"
const environment: Environment = {
  at,
  id: () => "generated-id",
  directory: [{ id: "dir-ada", name: "Ada Leader" }],
}
const leader: Actor = { id: "dir-ada", canWrite: true, roles: ["domain leader"], domains: ["Applications"] }
const admin: Actor = { id: "dir-admin", canWrite: true, roles: ["admin"] }
const topicPage = pages[0]
const headcountPage = pages[1]
const teamPage = pages[2]
const talentPage = pages[3]
const projectPage = DashboardPortfolio.pages[1]
const riskPage = DashboardPortfolio.pages[2]
const contractPage = DashboardPortfolio.pages[3]
const stakeholderPage = DashboardPortfolio.pages[4]
const performancePage = DashboardPortfolio.pages[5]
const operationsPage = DashboardOperations.pages[0]
const securityPage = DashboardOperations.pages[1]
const opexPage = DashboardBudget.pages[2]
const capexPage = DashboardBudget.pages[3]

function snapshot(data: Record<string, unknown> = {}): Snapshot {
  return { data, versions: {}, sequences: {}, audit: [], notices: [] }
}
function command(page: string, action: string, values: Record<string, unknown> = {}, id?: string, version = 0): Command {
  return { page, action, version, values, ...(id === undefined ? {} : { id }) }
}
function screen(actor: Actor, versions: Snapshot["versions"] = {}) {
  return { actor, year: 2026, month: 11, at, versions }
}
function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row))
    : []
}
function refuses(state: Snapshot, run: () => { ok: boolean }) {
  const before = structuredClone(state)
  expect(run()).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
}
function commandForms(html: string, action: string): string[] {
  return [...html.matchAll(new RegExp(`<form data-command="${action}"[\\s\\S]*?<\\/form>`, "g"))].map((match) => match[0])
}
function expectEnabled(html: string, action: string) {
  const found = commandForms(html, action)
  expect(found.length).toBeGreaterThan(0)
  expect(found.every((form) => form.includes('type="submit" disabled'))).toBe(false)
}
function expectDisabled(html: string, action: string) {
  const found = commandForms(html, action)
  expect(found.length).toBeGreaterThan(0)
  expect(found.every((form) => form.includes('type="submit" disabled'))).toBe(true)
}
function recordForm(html: string, action: string, id: string): string {
  const found = commandForms(html, action).find((form) => form.includes(`data-record="${id}"`))
  expect(found).toBeString()
  return found ?? ""
}
function teamData(): Record<string, unknown> {
  return {
    leaders: [
      { id: "leader-record", name: "Ada Leader" },
      { id: "dir-ada", name: "Same Id Leader" },
    ],
    members: [
      {
        id: "m-private",
        name: "Private Member",
        title: "Analyst",
        type: "Employee",
        leaderId: "leader-record",
        location: "Geneva",
        start: "2020-01-15",
        end: "",
        status: "Active",
        cls: "Talent",
        outlook: "Promote",
        notes: "SENTINEL-TALENT-NOTE",
      },
      {
        id: "m-trap",
        name: "Trap Member",
        title: "Contractor",
        type: "Contractor",
        leaderId: "dir-ada",
        location: "Geneva",
        start: "2021-03-01",
        end: "",
        status: "Active",
        cls: "Lagger",
        outlook: "Replace",
        notes: "SENTINEL-TRAP-NOTE",
      },
    ],
    leaderJoin: [
      { directoryId: "dir-ada", leaderId: "leader-record" },
      { directoryId: "dir-ada", leaderId: "dir-ada" },
    ],
  }
}
function hiddenTalent(value: unknown) {
  const encoded = JSON.stringify(value)
  expect(encoded).not.toContain("SENTINEL-TALENT-NOTE")
  expect(encoded).not.toContain("SENTINEL-TRAP-NOTE")
  expect(encoded).not.toContain("SENTINEL-LEAKED")
  expect(encoded).not.toMatch(/"cls"|"outlook"|"notes"/)
}

test("domain leader saves CIO, leader, and member structure and cannot write talent", () => {
  const state = snapshot(teamData())
  expect(
    domain.execute(
      state,
      leader,
      command(teamPage, "saveCio", { name: "Ada CIO", title: "CIO", location: "Geneva", start: "2020-01-01" }),
      environment,
    ),
  ).toMatchObject({ ok: true })
  expect(state.data.cio).toEqual({ name: "Ada CIO", title: "CIO", location: "Geneva", start: "2020-01-01" })
  expect(
    domain.execute(
      state,
      leader,
      command(
        teamPage,
        "saveLeader",
        { name: "Ada Leader", title: "Director", domain: "Applications", location: "Geneva", start: "2019-05-01" },
        "leader-record",
      ),
      environment,
    ),
  ).toMatchObject({ ok: true })
  expect(state.data.leaders).toEqual([
    {
      id: "leader-record",
      name: "Ada Leader",
      title: "Director",
      domain: "Applications",
      location: "Geneva",
      start: "2019-05-01",
    },
    { id: "dir-ada", name: "Same Id Leader" },
  ])
  expect(
    domain.execute(
      state,
      leader,
      command(
        teamPage,
        "saveMember",
        {
          name: "Private Member",
          title: "Engineer",
          type: "Employee",
          leaderId: "leader-record",
          location: "London",
          start: "2020-01-15",
          end: "",
          status: "Active",
          cls: "Lagger",
          outlook: "Replace",
          notes: "SENTINEL-LEAKED",
        },
        "m-private",
      ),
      environment,
    ),
  ).toMatchObject({ ok: true })
  expect(records(state.data.members).find((member) => member.id === "m-private")).toMatchObject({
    title: "Engineer",
    type: "Employee",
    leaderId: "leader-record",
    location: "London",
    start: "2020-01-15",
    end: "",
    status: "Active",
    cls: "Talent",
    outlook: "Promote",
    notes: "SENTINEL-TALENT-NOTE",
  })
  expect(JSON.stringify(state.data.members)).not.toContain("SENTINEL-LEAKED")
  expect(
    domain.execute(
      state,
      leader,
      command(teamPage, "saveMember", {
        name: "New Person",
        title: "Analyst",
        type: "Contractor",
        leaderId: "leader-record",
        location: "London",
        start: "2024-02-01",
        end: "",
        status: "On Leave",
        cls: "Talent",
        outlook: "Promote",
        notes: "SENTINEL-LEAKED",
      }),
      environment,
    ),
  ).toMatchObject({ ok: true })
  const created = records(state.data.members).find((member) => member.id === "generated-id")
  expect(created).toMatchObject({
    name: "New Person",
    title: "Analyst",
    type: "Contractor",
    leaderId: "leader-record",
    location: "London",
    start: "2024-02-01",
    end: "",
    status: "On Leave",
  })
  expect(created?.cls ?? "").toBe("")
  expect(created?.outlook ?? "").toBe("")
  expect(JSON.stringify(created)).not.toContain("SENTINEL-LEAKED")
  const viewed = domain.view(state, leader, environment)
  hiddenTalent(viewed.data)
  expect(records(viewed.data.members).find((member) => member.id === "m-private")).toMatchObject({
    title: "Engineer",
    location: "London",
  })
  expect(viewed.data.cio).toEqual({ name: "Ada CIO", title: "CIO", location: "Geneva", start: "2020-01-01" })
  const html = render(teamPage, viewed.data, screen(leader, viewed.versions))
  expect(html).toBeString()
  expectEnabled(html ?? "", "saveCio")
  expectEnabled(html ?? "", "saveLeader")
  expectEnabled(html ?? "", "saveMember")
  expect(html).not.toContain('name="cls"')
  expect(html).not.toContain('name="outlook"')
  expect(html).not.toContain('name="notes"')
  expect(html).not.toContain("SENTINEL")
  expect(render(headcountPage, viewed.data, screen(leader, viewed.versions))).not.toContain("SENTINEL")
  expect(render(talentPage, viewed.data, screen(leader, viewed.versions))).not.toContain("SENTINEL")
})

test("directory id and a supplied leader join do not reveal or write talent", () => {
  const state = snapshot(teamData())
  const viewed = domain.view(state, leader, environment)
  hiddenTalent(viewed.data)
  expect(records(viewed.data.members)).toEqual([
    expect.objectContaining({ id: "m-private", name: "Private Member", leaderId: "leader-record" }),
    expect.objectContaining({ id: "m-trap", name: "Trap Member", leaderId: "dir-ada" }),
  ])
  const team = render(teamPage, viewed.data, screen(leader, viewed.versions)) ?? ""
  const headcount = render(headcountPage, viewed.data, screen(leader, viewed.versions)) ?? ""
  const talent = render(talentPage, viewed.data, screen(leader, viewed.versions)) ?? ""
  expect(team).not.toContain("SENTINEL")
  expect(team).not.toContain('name="cls"')
  expect(team).not.toContain('name="outlook"')
  expect(team).not.toContain('name="notes"')
  expect(headcount).not.toContain("SENTINEL")
  expect(headcount).not.toContain("Promote")
  expect(talent).not.toContain("SENTINEL")
  expect(talent).not.toContain("Promote")
  expect(talent).not.toContain('name="cls"')
  refuses(state, () =>
    domain.execute(
      state,
      leader,
      command(talentPage, "save", { name: "Private Member", cls: "Lagger", outlook: "Replace", notes: "SENTINEL-LEAKED" }, "m-private"),
      environment,
    ),
  )
  refuses(state, () => domain.execute(state, leader, command(talentPage, "exportAllMembers"), environment))
  refuses(state, () =>
    domain.execute(state, leader, command(talentPage, "import", { rows: [{ Name: "Private Member", Classification: "Lagger" }] }), environment),
  )
})

test("canWrite false fails closed for team, hot topics, projects, and risks", () => {
  const people = snapshot(teamData())
  people.data.hotTopics = [{ id: "ht", action: "Keep", responsible: "Raph/Rodney", status: "open", priority: "normal" }]
  for (const entry of [
    command(teamPage, "saveCio", { name: "Nope" }),
    command(teamPage, "saveLeader", { name: "Nope" }),
    command(teamPage, "saveMember", { name: "Nope", type: "Employee", status: "Active" }, "m-private"),
    command(topicPage, "save", { action: "Nope" }, "ht"),
  ])
    refuses(people, () => domain.execute(people, { ...leader, canWrite: false }, entry, environment))
  const portfolio = snapshot({
    projects: [{ id: "proj-1", name: "ERP", leaderId: "dir-ada" }],
    risks: [{ id: "risk-owned", name: "Owned outage", responsible: "Ada Leader" }],
  })
  refuses(portfolio, () =>
    DashboardPortfolio.domain.execute(
      portfolio,
      { ...leader, canWrite: false },
      command(projectPage, "save", { name: "ERP next" }, "proj-1"),
      environment,
    ),
  )
  refuses(portfolio, () =>
    DashboardPortfolio.domain.execute(
      portfolio,
      { ...leader, canWrite: false },
      command(riskPage, "save", { name: "Owned outage", mitigation: "Nope" }, "risk-owned"),
      environment,
    ),
  )
})

test("domain leader saves projects while stakeholder, performance, and contract writes stay closed", () => {
  const state = snapshot({
    projects: [{ id: "proj-1", name: "ERP", status: "In Progress", leaderId: "someone-else", budget: 10, spent: 1, pct: 5 }],
    stakeholders: [{ id: "stake-1", name: "Pat" }],
    contracts: [{ id: "contract-1", vendor: "Vendor", amount: 10 }],
    itperf: { name: "FY contract" },
  })
  refuses(state, () =>
    DashboardPortfolio.domain.execute(state, leader, command(stakeholderPage, "save", { name: "Hijack" }, "stake-1"), environment),
  )
  refuses(state, () =>
    DashboardPortfolio.domain.execute(
      state,
      leader,
      command(performancePage, "save", { name: "Hijack" }),
      environment,
    ),
  )
  refuses(state, () =>
    DashboardPortfolio.domain.execute(state, leader, command(contractPage, "save", { vendor: "Hijack" }, "contract-1"), environment),
  )
  refuses(state, () =>
    DashboardPortfolio.domain.execute(
      state,
      leader,
      command(projectPage, "import", { mode: "replace", rows: [{ name: "Nope" }], confirmed: true }),
      environment,
    ),
  )
  const viewed = DashboardPortfolio.domain.view(state, leader, environment)
  expectDisabled(DashboardPortfolio.render(stakeholderPage, viewed.data, screen(leader, viewed.versions)) ?? "", "save")
  expect(
    DashboardPortfolio.domain.execute(state, leader, command(projectPage, "save", { name: "ERP next" }, "proj-1"), environment),
  ).toMatchObject({ ok: true })
  expect(records(state.data.projects).find((project) => project.id === "proj-1")).toMatchObject({
    name: "ERP next",
    leaderId: "someone-else",
    status: "In Progress",
  })
  expect(
    DashboardPortfolio.domain.execute(state, leader, command(projectPage, "save", { name: "Fresh project" }), environment),
  ).toMatchObject({ ok: true })
  expect(records(state.data.projects).find((project) => project.id === "generated-id")).toMatchObject({ name: "Fresh project" })
  const after = DashboardPortfolio.domain.view(state, leader, environment)
  expect(records(after.data.projects).map((project) => project.name)).toEqual(expect.arrayContaining(["ERP next", "Fresh project"]))
  expectEnabled(DashboardPortfolio.render(projectPage, after.data, screen(leader, after.versions)) ?? "", "save")
  expect(state.data.stakeholders).toEqual([{ id: "stake-1", name: "Pat" }])
  expect(state.data.contracts).toEqual([{ id: "contract-1", vendor: "Vendor", amount: 10 }])
  expect(state.data.itperf).toEqual({ name: "FY contract" })
})

test("domain leader saves a risk whose responsible person is themselves and is refused otherwise", () => {
  const state = snapshot({
    risks: [
      {
        id: "risk-owned",
        name: "Owned outage",
        responsible: "Ada Leader",
        leaderId: "leader-record",
        impact: 3,
        probability: 2,
        status: "open",
        mitigation: "Old plan",
      },
      {
        id: "risk-other",
        name: "Foreign outage",
        responsible: "Someone Else",
        owner: "dir-other",
        ownerId: "dir-other",
        leaderId: "dir-ada",
        impact: 3,
        probability: 2,
        status: "open",
        mitigation: "Keep",
      },
    ],
  })
  refuses(state, () =>
    DashboardPortfolio.domain.execute(
      state,
      leader,
      command(
        riskPage,
        "save",
        { name: "Foreign outage", responsible: "Ada Leader", ownerId: "dir-ada", leaderId: "dir-ada", mitigation: "Hijack" },
        "risk-other",
      ),
      environment,
    ),
  )
  refuses(state, () =>
    DashboardPortfolio.domain.execute(
      state,
      leader,
      command(riskPage, "save", {
        name: "Seized",
        responsible: "Someone Else",
        ownerId: "dir-ada",
        leaderId: "dir-ada",
      }),
      environment,
    ),
  )
  expect(records(state.data.risks).find((risk) => risk.id === "risk-other")).toMatchObject({
    responsible: "Someone Else",
    ownerId: "dir-other",
    leaderId: "dir-ada",
    mitigation: "Keep",
  })
  expect(
    DashboardPortfolio.domain.execute(
      state,
      leader,
      command(riskPage, "save", { name: "Owned outage", responsible: "Ada Leader", mitigation: "Call the owner" }, "risk-owned"),
      environment,
    ),
  ).toMatchObject({ ok: true })
  expect(records(state.data.risks).find((risk) => risk.id === "risk-owned")).toMatchObject({
    responsible: "Ada Leader",
    leaderId: "leader-record",
    mitigation: "Call the owner",
  })
  expect(
    DashboardPortfolio.domain.execute(
      state,
      leader,
      command(riskPage, "save", { name: "Fresh outage", responsible: "Ada Leader", leaderId: "leader-record" }),
      environment,
    ),
  ).toMatchObject({ ok: true })
  expect(records(state.data.risks).find((risk) => risk.id === "generated-id")).toMatchObject({
    name: "Fresh outage",
    responsible: "Ada Leader",
  })
  const viewed = DashboardPortfolio.domain.view(state, leader, environment)
  expect(records(viewed.data.risks)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "risk-owned", responsible: "Ada Leader", mitigation: "Call the owner" }),
      expect.objectContaining({ id: "risk-other", responsible: "Someone Else", mitigation: "Keep" }),
      expect.objectContaining({ name: "Fresh outage", responsible: "Ada Leader" }),
    ]),
  )
})

test("admin and assigned contributors keep their writes and other modules stay unchanged", () => {
  const people = snapshot({
    members: [{ id: "m", name: "A", type: "Employee", status: "Active", cls: "", outlook: "" }],
  })
  expect(
    domain.execute(
      people,
      admin,
      command(
        talentPage,
        "save",
        { name: "A", type: "Employee", status: "Active", cls: "Talent", outlook: "Promote", notes: "admin note" },
        "m",
      ),
      environment,
    ),
  ).toMatchObject({ ok: true })
  expect(records(people.data.members)[0]).toMatchObject({ cls: "Talent", outlook: "Promote", notes: "admin note" })
  expect(JSON.stringify(domain.view(people, admin, environment).data)).toContain("admin note")
  const contributor = { id: "dir-contributor", canWrite: true, roles: ["contributor"], assigned: ["people", topicPage] }
  refuses(people, () => domain.execute(people, contributor, command(teamPage, "saveMember", { name: "B" }, "m"), environment))
  refuses(people, () => domain.execute(people, contributor, command(topicPage, "save", { action: "Nope" }), environment))

  const projects = snapshot({
    projects: [{ id: "proj-1", name: "ERP" }],
    risks: [{ id: "risk-other", name: "Foreign outage", responsible: "Someone Else", leaderId: "dir-ada", impact: 2, probability: 2 }],
    contracts: [{ id: "contract-1", vendor: "Vendor" }],
  })
  const projectContributor: Actor = { id: "dir-projects", canWrite: true, roles: ["contributor"], assigned: ["projects"] }
  expect(
    DashboardPortfolio.domain.execute(projects, projectContributor, command(projectPage, "save", { name: "ERP next" }, "proj-1"), environment),
  ).toMatchObject({ ok: true })
  refuses(projects, () =>
    DashboardPortfolio.domain.execute(projects, projectContributor, command(riskPage, "save", { name: "Foreign outage" }, "risk-other"), environment),
  )
  const riskContributor: Actor = { id: "dir-risks", canWrite: true, roles: ["contributor"], assigned: ["risks"] }
  expect(
    DashboardPortfolio.domain.execute(
      projects,
      riskContributor,
      command(riskPage, "save", { name: "Foreign outage", mitigation: "Contributor plan" }, "risk-other"),
      environment,
    ),
  ).toMatchObject({ ok: true })
  expect(records(projects.data.risks)[0]).toMatchObject({ mitigation: "Contributor plan", responsible: "Someone Else" })
  refuses(projects, () =>
    DashboardPortfolio.domain.execute(projects, riskContributor, command(contractPage, "save", { vendor: "Nope" }, "contract-1"), environment),
  )
  refuses(projects, () =>
    DashboardPortfolio.domain.execute(
      projects,
      { id: "dir-empty", canWrite: true, roles: ["contributor"], assigned: [] },
      command(projectPage, "save", { name: "Nope" }, "proj-1"),
      environment,
    ),
  )
  expect(
    DashboardPortfolio.domain.execute(projects, admin, command(stakeholderPage, "save", { name: "Pat" }), environment),
  ).toMatchObject({ ok: true })
  expect(
    DashboardPortfolio.domain.execute(projects, admin, command(contractPage, "save", { vendor: "Vendor", notes: "renewed" }, "contract-1"), environment),
  ).toMatchObject({ ok: true })
  expect(DashboardPortfolio.domain.execute(projects, admin, command(performancePage, "save", { name: "FY contract" }), environment)).toMatchObject({
    ok: true,
  })

  const ops = snapshot()
  refuses(ops, () => DashboardOperations.domain.execute(ops, leader, command(operationsPage, "save-sla", { year: 2026, month: 11 }), environment))
  refuses(ops, () => DashboardOperations.domain.execute(ops, leader, command(securityPage, "save-action", { text: "Review", done: false }), environment))
  expect(
    DashboardOperations.domain.execute(
      ops,
      { id: "dir-ops", canWrite: true, roles: ["contributor"], assigned: ["Operations"] },
      command(operationsPage, "save-sla", { year: 2026, month: 11 }),
      environment,
    ),
  ).toMatchObject({ ok: true })
  refuses(ops, () =>
    DashboardOperations.domain.execute(
      ops,
      { id: "dir-ops", canWrite: true, roles: ["contributor"], assigned: ["Operations"] },
      command(securityPage, "save-action", { text: "Review", done: false }),
      environment,
    ),
  )
  const security = snapshot()
  expect(
    DashboardOperations.domain.execute(
      security,
      { id: "dir-security", canWrite: true, roles: ["contributor"], assigned: ["security"] },
      command(securityPage, "save-action", { text: "Review", done: false }),
      environment,
    ),
  ).toMatchObject({ ok: true })
  refuses(security, () =>
    DashboardOperations.domain.execute(
      security,
      { id: "dir-security", canWrite: true, roles: ["contributor"], assigned: ["security"] },
      command(operationsPage, "save-sla", { year: 2026, month: 11 }),
      environment,
    ),
  )
})

test("an empty budgetLineIds list changes no budget line and a listed line still saves", () => {
  const lines = () =>
    snapshot({
      opexOwners: [{ id: "line-1", name: "Licenses", budget: 1200 }],
      capexProjects: [{ id: "cap-1", name: "Plant", budget: 2400 }],
    })
  for (const grants of [undefined, [], ["line-1"]]) {
    const state = lines()
    if (grants !== undefined) state.data.budgetLineIds = { "dir-ada": grants }
    refuses(state, () =>
      DashboardBudget.domain.execute(state, leader, command(opexPage, "save", { name: "Licenses", budget: 1 }, "line-1"), environment),
    )
    refuses(state, () =>
      DashboardBudget.domain.execute(state, leader, command(capexPage, "save", { name: "Plant", budget: 1 }, "cap-1"), environment),
    )
    const viewed = DashboardBudget.domain.view(state, leader, environment)
    const html = DashboardBudget.render(opexPage, viewed.data, screen(leader, viewed.versions)) ?? ""
    expect(recordForm(html, "save", "line-1")).toContain('type="submit" disabled')
    expect(recordForm(html, "save", "")).toContain('type="submit" disabled')
    expect(state.data.opexOwners).toEqual([{ id: "line-1", name: "Licenses", budget: 1200 }])
    expect(records(state.data.opexOwners)[0]).not.toHaveProperty("domain")
  }
  const granted = lines()
  granted.data.budgetLineIds = { "dir-ada": ["opexOwners:line-1"] }
  const open = DashboardBudget.domain.view(granted, leader, environment)
  const grantedHtml = DashboardBudget.render(opexPage, open.data, screen(leader, open.versions)) ?? ""
  expect(recordForm(grantedHtml, "save", "line-1")).not.toContain('type="submit" disabled')
  expect(recordForm(grantedHtml, "save", "")).toContain('type="submit" disabled')
  expect(
    DashboardBudget.domain.execute(granted, leader, command(opexPage, "save", { name: "Licenses renewed", budget: 2400, domain: "Applications" }, "line-1"), environment),
  ).toMatchObject({ ok: true })
  expect(granted.data.opexOwners).toEqual([{ id: "line-1", name: "Licenses renewed", budget: 2400 }])
  refuses(granted, () =>
    DashboardBudget.domain.execute(granted, leader, command(capexPage, "save", { name: "Plant", budget: 1 }, "cap-1"), environment),
  )
  refuses(granted, () =>
    DashboardBudget.domain.execute(
      granted,
      { id: "dir-contributor", canWrite: true, roles: ["contributor"], assigned: ["projects"] },
      command(opexPage, "save", { name: "Nope", budget: 1 }, "line-1"),
      environment,
    ),
  )
  const adminState = lines()
  expect(
    DashboardBudget.domain.execute(adminState, admin, command(opexPage, "save", { name: "Admin line", budget: 3000 }, "line-1"), environment),
  ).toMatchObject({ ok: true })
  expect(records(adminState.data.opexOwners)[0]).toMatchObject({ name: "Admin line", budget: 3000 })
})

test("imported hot topic responsible stays visible on the screen", () => {
  const state = snapshot({
    hotTopics: [
      {
        id: "ht-seed",
        action: "Develop a plan B, descoping iRely developments",
        responsible: "Raph/Rodney",
        due: "2026-09-10",
        priority: "critical",
        owner: "Stale Owner",
      },
    ],
  })
  const viewed = domain.view(state, leader, environment)
  expect(records(viewed.data.hotTopics)[0]).toMatchObject({
    id: "ht-seed",
    action: "Develop a plan B, descoping iRely developments",
    responsible: "Raph/Rodney",
  })
  const html = render(topicPage, viewed.data, screen(leader, viewed.versions)) ?? ""
  expect(html).toContain("Raph/Rodney")
  const editor = commandForms(html, "save").find((form) => form.includes('data-record="ht-seed"')) ?? ""
  expect(editor).toMatch(/name="responsible"[^>]*value="Raph\/Rodney"|<textarea name="responsible"[^>]*>Raph\/Rodney<\/textarea>/)
  expect(editor).not.toMatch(/name="responsible"[^>]*value="Stale Owner"/)
  expect(domain.view(state, admin, environment).data.hotTopics).toEqual([
    expect.objectContaining({ responsible: "Raph/Rodney" }),
  ])
})

test("hot topic edits keep the stored responsible person and the control can replace it", () => {
  const state = snapshot({
    hotTopics: [
      {
        id: "ht-seed",
        action: "Develop a plan B, descoping iRely developments",
        responsible: "Raph/Rodney",
        due: "2026-09-10",
        priority: "critical",
        owner: "Stale Owner",
      },
    ],
  })
  expect(
    domain.execute(state, leader, command(topicPage, "save", { action: "Replanned option" }, "ht-seed"), environment),
  ).toMatchObject({ ok: true })
  expect(records(state.data.hotTopics).find((topic) => topic.id === "ht-seed")).toMatchObject({
    action: "Replanned option",
    responsible: "Raph/Rodney",
  })
  const afterEdit = domain.view(state, leader, environment)
  expect(records(afterEdit.data.hotTopics).find((topic) => topic.id === "ht-seed")).toMatchObject({
    responsible: "Raph/Rodney",
    action: "Replanned option",
  })
  expect(render(topicPage, afterEdit.data, screen(leader, afterEdit.versions))).toContain("Raph/Rodney")
  expect(
    domain.execute(
      state,
      leader,
      command(topicPage, "save", { action: "Finish recruitment", responsible: "Lucas", status: "open", priority: "normal" }),
      environment,
    ),
  ).toMatchObject({ ok: true })
  expect(records(state.data.hotTopics).find((topic) => topic.id === "generated-id")).toMatchObject({
    action: "Finish recruitment",
    responsible: "Lucas",
  })
  expect(
    domain.execute(
      state,
      leader,
      command(
        topicPage,
        "save",
        {
          action: "Replanned option",
          responsible: "EC",
          owner: "Not EC",
          due: "2026-10-01",
          status: "progress",
          priority: "high",
        },
        "ht-seed",
        1,
      ),
      environment,
    ),
  ).toMatchObject({ ok: true })
  expect(records(state.data.hotTopics).find((topic) => topic.id === "ht-seed")?.responsible).toBe("EC")
  const replaced = domain.view(state, leader, environment)
  expect(records(replaced.data.hotTopics).find((topic) => topic.id === "ht-seed")).toMatchObject({ responsible: "EC" })
  const editor = commandForms(render(topicPage, replaced.data, screen(leader, replaced.versions)) ?? "", "save").find((form) =>
    form.includes('data-record="ht-seed"'),
  )
  expect(editor).toMatch(/name="responsible"[^>]*value="EC"|<textarea name="responsible"[^>]*>EC<\/textarea>/)
})

test("hot topics report exports the stored responsible person", async () => {
  const state = snapshot({
    hotTopics: [
      {
        id: "ht-seed",
        action: "Develop a plan B, descoping iRely developments",
        responsible: "Raph/Rodney",
        due: "2026-09-10",
        priority: "critical",
      },
    ],
  })
  const report = await createReport(state, leader, environment, { format: "docx", year: 2026, topics: [topicPage] })
  if (!report.ok) throw new Error("Hot topics report refused")
  const xml = await (await JSZip.loadAsync(report.bytes)).file("word/document.xml")?.async("string")
  expect(xml).toContain("Raph/Rodney")
  expect(xml).toContain("Develop a plan B, descoping iRely developments")
})

test("status and priority filters render and combine while overdue and empty action stay", () => {
  const rejected = snapshot({
    hotTopics: [{ id: "ht", action: "Keep", responsible: "Raph/Rodney", status: "open", priority: "normal" }],
  })
  const before = structuredClone(rejected)
  expect(
    domain.execute(
      rejected,
      leader,
      command(topicPage, "save", { action: "   ", responsible: "Raph/Rodney", status: "open", priority: "high" }, "ht"),
      environment,
    ),
  ).toMatchObject({ ok: false, status: 422 })
  expect(
    domain.execute(rejected, leader, command(topicPage, "save", { responsible: "Raph/Rodney", status: "open", priority: "normal" }), environment),
  ).toMatchObject({ ok: false, status: 422 })
  expect(rejected).toEqual(before)

  const topics = [
    { id: "open-critical", action: "Plan B critical open", status: "open", priority: "critical", due: "2020-01-01" },
    { id: "open-high", action: "Capacity high open", status: "open", priority: "high", due: "2030-06-01" },
    { id: "done-critical", action: "Announce critical done", status: "done", priority: "critical", due: "2019-05-01" },
    { id: "blocked-normal", action: "Review normal blocked", status: "blocked", priority: "normal", due: "" },
    { id: "open-none", action: "Notes no due", status: "open", priority: "normal", due: "" },
  ]
  const state = snapshot({ hotTopics: topics })
  const viewed = domain.view(state, leader, environment)
  const draw = (filters: Record<string, unknown>) => render(topicPage, { ...viewed.data, ...filters }, screen(leader, viewed.versions)) ?? ""
  const all = draw({})
  for (const action of ["Plan B critical open", "Capacity high open", "Announce critical done", "Review normal blocked", "Notes no due"])
    expect(all).toContain(action)
  expect(all).toContain("2020-01-01 Overdue")
  expect(all).not.toContain("2030-06-01 Overdue")
  expect(all).not.toContain("2019-05-01 Overdue")
  expect(all).toContain("2019-05-01")
  const blank = draw({ topicStatus: "", priority: "" })
  for (const action of ["Plan B critical open", "Capacity high open", "Announce critical done", "Review normal blocked", "Notes no due"])
    expect(blank).toContain(action)
  const openOnly = draw({ topicStatus: "open" })
  expect(openOnly).toContain("Plan B critical open")
  expect(openOnly).toContain("Capacity high open")
  expect(openOnly).toContain("Notes no due")
  expect(openOnly).not.toContain("Announce critical done")
  expect(openOnly).not.toContain("Review normal blocked")
  const critical = draw({ priority: "critical" })
  expect(critical).toContain("Plan B critical open")
  expect(critical).toContain("Announce critical done")
  expect(critical).not.toContain("Capacity high open")
  expect(critical).not.toContain("Review normal blocked")
  const combined = draw({ topicStatus: "open", priority: "critical" })
  expect(combined).toContain("Plan B critical open")
  expect(combined).toContain("2020-01-01 Overdue")
  expect(combined).not.toContain("Capacity high open")
  expect(combined).not.toContain("Announce critical done")
  expect(combined).not.toContain("Review normal blocked")
  expect(combined).not.toContain("Notes no due")
  const filters = [...all.matchAll(/<form method="get">[\s\S]*?<\/form>/g)].map((match) => match[0]).join("")
  expect(filters).toContain('name="topicStatus"')
  const priority = filters.match(/<select name="priority"[^>]*>[\s\S]*?<\/select>/)?.[0]
  expect(priority).toContain('value=""')
  expect(priority).toContain('value="critical"')
  expect(priority).toContain('value="high"')
  expect(priority).toContain('value="normal"')
  const selected = draw({ topicStatus: "blocked", priority: "normal" })
  expect(selected).toContain("Review normal blocked")
  expect(selected).not.toContain("Plan B critical open")
  expect([...selected.matchAll(/<form method="get">[\s\S]*?<\/form>/g)].join("")).toContain('<option value="normal" selected>')
  expect([...selected.matchAll(/<form method="get">[\s\S]*?<\/form>/g)].join("")).toContain('<option value="blocked" selected>')
})

test("hot topic status control offers open, progress, blocked, and done", () => {
  const state = snapshot({
    hotTopics: [{ id: "progress-row", action: "Recruit in progress", status: "progress", priority: "high", responsible: "Raph/Rodney" }],
  })
  const viewed = domain.view(state, leader, environment)
  const html = render(topicPage, viewed.data, screen(leader, viewed.versions)) ?? ""
  const filter = html.match(/<select name="topicStatus"[^>]*>[\s\S]*?<\/select>/)?.[0] ?? ""
  expect([...filter.matchAll(/<option value="([^"]*)"/g)].map((match) => match[1])).toEqual(["", "open", "progress", "blocked", "done"])
  const editors = [...html.matchAll(/<select name="status"[^>]*>[\s\S]*?<\/select>/g)].map((match) => match[0])
  expect(editors.length).toBeGreaterThan(0)
  for (const editor of editors)
    expect([...editor.matchAll(/<option value="([^"]*)"/g)].map((match) => match[1])).toEqual(["open", "progress", "blocked", "done"])
  expect(html).toContain('<option value="progress" selected>')
})

test("hot topic progress filter shows only progress rows", () => {
  const state = snapshot({
    hotTopics: [
      { id: "progress-high", action: "Recruit progress high", status: "progress", priority: "high" },
      { id: "progress-normal", action: "Notes progress normal", status: "progress", priority: "normal" },
      { id: "open-high", action: "Plan open high", status: "open", priority: "high" },
      { id: "blocked-high", action: "Review blocked high", status: "blocked", priority: "high" },
      { id: "done-high", action: "Announce done high", status: "done", priority: "high" },
    ],
  })
  const viewed = domain.view(state, leader, environment)
  const html = render(topicPage, { ...viewed.data, topicStatus: "progress" }, screen(leader, viewed.versions)) ?? ""
  expect(html).toContain("Recruit progress high")
  expect(html).toContain("Notes progress normal")
  expect(html).not.toContain("Plan open high")
  expect(html).not.toContain("Review blocked high")
  expect(html).not.toContain("Announce done high")
  expect([...html.matchAll(/<form method="get">[\s\S]*?<\/form>/g)].join("")).toContain('<option value="progress" selected>')
})

test("hot topic progress filter combines with priority", () => {
  const state = snapshot({
    hotTopics: [
      { id: "progress-high", action: "Recruit progress high", status: "progress", priority: "high" },
      { id: "progress-normal", action: "Notes progress normal", status: "progress", priority: "normal" },
      { id: "open-high", action: "Plan open high", status: "open", priority: "high" },
      { id: "blocked-high", action: "Review blocked high", status: "blocked", priority: "high" },
      { id: "done-critical", action: "Announce done critical", status: "done", priority: "critical" },
    ],
  })
  const viewed = domain.view(state, leader, environment)
  const html = render(topicPage, { ...viewed.data, topicStatus: "progress", priority: "high" }, screen(leader, viewed.versions)) ?? ""
  expect(html).toContain("Recruit progress high")
  expect(html).not.toContain("Notes progress normal")
  expect(html).not.toContain("Plan open high")
  expect(html).not.toContain("Review blocked high")
  expect(html).not.toContain("Announce done critical")
})
