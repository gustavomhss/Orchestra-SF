import { expect, test } from "bun:test"
import { domain, render } from "../runtime/planner.ts"
import type { Actor, Environment, Snapshot } from "../runtime/contract.ts"

// Acceptance for PL-OWNER-SCOPE, PL-SPREAD-FLAGS, and PL-LOCKED-CODE. Hosted RED gate pending.

const AT = "2026-11-12T12:00:00Z"
const OWNER = "owner-apps"
const OTHER = "owner-other"
const directory = [
  { id: OWNER, name: "Apps Owner" },
  { id: OTHER, name: "Other Owner" },
]
const admin: Actor = { id: "directory-admin", canWrite: true, roles: ["admin"] }
const budgetOwner: Actor = { id: OWNER, canWrite: true, roles: ["budget owner"], domains: ["Apps"] }
const emptyDomains: Actor = { id: "owner-empty", canWrite: true, roles: ["budget owner"], domains: [] }
const readOnlyOwner: Actor = { id: OWNER, canWrite: false, roles: ["budget owner"], domains: ["Apps"] }
const environment: Environment = { at: AT, id: () => "generated-id", directory }

function persistedRevision(state: Snapshot, key: string): number {
  return state.versions[key]?.version ?? 0
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row))
    : []
}

function versionOf(state: Snapshot, versionId: string): Record<string, unknown> {
  const version = asRows(state.data.versions).find((row) => row.id === versionId)
  if (!version) throw new Error(`missing version ${versionId}`)
  return version
}

function lineOf(state: Snapshot, versionId: string, lineId: string): Record<string, unknown> {
  const line = asRows(versionOf(state, versionId).lines).find((row) => row.id === lineId)
  if (!line) throw new Error(`missing line ${versionId}/${lineId}`)
  return line
}

function projectOf(state: Snapshot, versionId: string, projectId: string): Record<string, unknown> {
  const project = asRows(versionOf(state, versionId).projects).find((row) => row.id === projectId)
  if (!project) throw new Error(`missing project ${versionId}/${projectId}`)
  return project
}

function booleans(value: unknown): boolean[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "boolean")) throw new Error("expected booleans")
  return value
}

function numbers(value: unknown): number[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "number")) throw new Error("expected numbers")
  return value
}

function monthAt(value: unknown, index: number): number | null {
  if (!Array.isArray(value) || index < 0 || index >= value.length) throw new Error("expected month vector")
  const item = value[index]
  if (item === null) return null
  if (typeof item !== "number") throw new Error("expected month number")
  return item
}

function execute(
  state: Snapshot,
  who: Actor,
  page: string,
  action: string,
  id: string,
  values: Record<string, unknown>,
  key: string,
  versionId: string,
  env: Environment = environment,
) {
  return domain.execute(
    state,
    who,
    {
      page,
      action,
      id: id || undefined,
      version: persistedRevision(state, key),
      values: { versionId, ...values },
    },
    env,
  )
}

function refuse(
  state: Snapshot,
  who: Actor,
  page: string,
  action: string,
  id: string,
  values: Record<string, unknown>,
  key: string,
  versionId: string,
) {
  const before = structuredClone(state)
  expect(execute(state, who, page, action, id, values, key, versionId)).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
}

function plan(id: string, year: number, locked = false): Record<string, unknown> {
  return {
    id,
    name: `FY${year}`,
    year,
    locked,
    closed: 0,
    lines: [],
    projects: [],
    hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} },
    fx: [],
    lists: {},
  }
}

function budgetLine(
  id: string,
  el: string,
  name: string,
  ownerId: string,
  annual: number,
  lineDomain?: string,
): Record<string, unknown> {
  return {
    id,
    sec: "opex",
    el,
    name,
    ...(lineDomain === undefined ? {} : { domain: lineDomain }),
    owner: { id: ownerId, name: ownerId === OWNER ? "Apps Owner" : "Other Owner" },
    entity: "",
    alloc: "",
    annual,
    b: Array<number>(12).fill(annual / 12),
    bm: Array<boolean>(12).fill(false),
    cur: "USD",
  }
}

type PostedForm = {
  page: string
  action: string
  id: string
  version: number
  values: Record<string, string | number>
}

function attr(source: string, name: string): string {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(source)?.[1] ?? ""
}

function postedForms(html: string): PostedForm[] {
  return [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/g)].map((match) => {
    const attrs = match[1] ?? ""
    const body = match[2] ?? ""
    const values: Record<string, string | number> = {}
    for (const input of body.matchAll(/<input\b[^>]*>/g)) {
      const tag = input[0]
      const name = attr(tag, "name")
      if (!name) continue
      const raw = attr(tag, "value")
      values[name] = attr(tag, "type") === "number" ? (raw === "" ? 0 : Number(raw)) : raw
    }
    for (const select of body.matchAll(/<select\b[^>]*\bname="([^"]*)"[^>]*>([\s\S]*?)<\/select>/g)) {
      const name = select[1]
      if (!name) continue
      const selected = [...(select[2] ?? "").matchAll(/<option\b([^>]*)>/g)].find((option) =>
        /\bselected\b/.test(option[1] ?? ""),
      )
      if (selected) values[name] = attr(selected[1] ?? "", "value")
    }
    return {
      page: attr(attrs, "data-page"),
      action: attr(attrs, "data-command"),
      id: attr(attrs, "data-record"),
      version: Number(attr(attrs, "data-version")),
      values,
    }
  })
}

function requireForm(html: string, record: string, field: string): PostedForm {
  const form = postedForms(html).find((item) => item.id === record && Object.hasOwn(item.values, field))
  if (!form) throw new Error(`missing ${field} form for ${record}`)
  return form
}

function rendered(page: string, state: Snapshot, who: Actor, year: number): string {
  const html = render(page, state.data, { actor: who, year, month: 11, at: AT, versions: state.versions })
  if (typeof html !== "string") throw new Error(`${page} did not render`)
  return html
}

function submitRendered(state: Snapshot, who: Actor, form: PostedForm, key: string, env: Environment) {
  const version = persistedRevision(state, key)
  expect(form.version).toBe(version)
  return domain.execute(
    state,
    who,
    {
      page: form.page,
      action: form.action,
      id: form.id || undefined,
      version,
      values: form.values,
    },
    env,
  )
}

const bareOwner = emptyDomains
const spreadEnv: Environment = { at: AT, id: () => "generated-id", directory: [] }
const deniedLineWrites: [string, Record<string, unknown>][] = [
  ["save", { annual: 1 }],
  ["save", { name: "Hijack" }],
  ["save", { entity: "ent-ch" }],
  ["save", { alloc: "alloc-it" }],
  ["save", { f0: 1 }],
  ["delete", {}],
]

function bareScope(): Snapshot {
  const open = plan("open", 2026)
  const owned = budgetLine("bare-line", "licenses", "Bare licenses", bareOwner.id, 1200)
  owned.owner = { id: bareOwner.id, name: "Bare Owner" }
  open.lines = [
    owned,
    budgetLine("foreign-line", "hwo", "Foreign hardware", OTHER, 600),
    budgetLine("domain-line", "services", "Finance services", OTHER, 2400, "Finance"),
  ]
  return snapshot({
    versions: [open],
    officials: {},
    entities: [{ id: "ent-ch", name: "Sucafina CH", code: "CH" }],
    allocations: [{ id: "alloc-it", name: "IT", desc: "Information technology" }],
    roster: [],
  })
}

function openedSpread(lineId = "spread-line") {
  const state = snapshot({
    versions: [plan("fy2027", 2027)],
    officials: {},
    entities: [],
    allocations: [],
    roster: [],
  })
  expect(
    execute(
      state,
      admin,
      "OPEX",
      "save",
      lineId,
      { annual: 100000, el: "licenses", name: "Spread" },
      `fy2027:lines:${lineId}`,
      "fy2027",
      spreadEnv,
    ),
  ).toMatchObject({ ok: true })
  const opened = lineOf(state, "fy2027", lineId)
  expect(numbers(opened.b)).toEqual([...Array<number>(11).fill(8333.33), 8333.37])
  expect(booleans(opened.bm)).toEqual(Array<boolean>(12).fill(false))
  const budget = requireForm(rendered("OPEX", state, admin, 2027), lineId, "b0")
  const months = Array.from({ length: 12 }, (_, index) => `b${index}`)
  expect(months.filter((name) => Object.hasOwn(budget.values, name))).toEqual(months)
  expect(Object.hasOwn(budget.values, "month")).toBe(false)
  expect(Object.hasOwn(budget.values, "value")).toBe(false)
  return { state, budget, lineId }
}

function postMarked(state: Snapshot, budget: PostedForm, lineId: string, marker: string) {
  budget.values.budgetEdited = marker
  return submitRendered(state, admin, budget, `fy2027:lines:${lineId}`, spreadEnv)
}

function lockedDraft(): Snapshot {
  const version = plan("fy2026-draft", 2026, true)
  version.projects = [{ id: "proj-1", name: "Network refresh", code: "CPX-2026-004", owner: { id: OTHER, name: "Other Owner" } }]
  version.lines = [
    {
      id: "capex-line",
      sec: "capex",
      el: "licenses",
      proj: "proj-1",
      name: "Rack build",
      desc: "Original note",
      cls: "capex",
      cur: "USD",
      annual: 1200,
      b: Array<number>(12).fill(100),
      bm: Array<boolean>(12).fill(false),
      owner: { id: OWNER, name: "Apps Owner" },
    },
  ]
  version.lists = { licenses: { split: true } }
  return snapshot({
    versions: [version],
    officials: { "2026": "fy2026-official" },
    entities: [],
    allocations: [],
    roster: [],
  })
}

test("PL-OWNER-SCOPE budget owner saves and deletes owned or in-domain lines and refuses the rest", () => {
  const open = plan("open", 2026)
  open.lines = [
    budgetLine("owned-line", "licenses", "Owned licenses", OWNER, 1200),
    budgetLine("apps-line", "services", "Apps services", OTHER, 2400, "Apps"),
    budgetLine("vendor-line", "hwo", "Vendor hardware", OTHER, 600),
    budgetLine("finance-line", "te", "Finance travel", OTHER, 360, "Finance"),
    budgetLine("owned-delete", "fac", "Owned facilities", OWNER, 120),
    budgetLine("apps-delete", "oth", "Apps other", OTHER, 240, "Apps"),
  ]
  open.hc = {
    positions: [
      {
        id: "pos-1",
        name: "Ada",
        include: true,
        fte: 1,
        start: 1,
        end: 12,
        type: "Employee",
        domain: "Apps",
        location: "Geneva",
        rateId: "card-1",
        rateOverride: 88000,
      },
    ],
    rates: [{ id: "card-1", name: "Geneva employee", locs: "Geneva", annual: 88000, cur: "USD" }],
    inc: 3,
    incMonth: 4,
    hrAF: {},
  }
  const locked = plan("locked", 2026, true)
  locked.lines = [
    budgetLine("owned-line", "licenses", "Owned licenses", OWNER, 1200),
    budgetLine("apps-line", "services", "Apps services", OTHER, 2400, "Apps"),
    budgetLine("vendor-line", "hwo", "Vendor hardware", OTHER, 600),
  ]
  const state = snapshot({
    versions: [open, locked],
    officials: {},
    entities: [{ id: "ent-ch", name: "Sucafina CH", code: "CH" }],
    allocations: [{ id: "alloc-it", name: "IT", desc: "Information technology" }],
    roster: [],
  })
  const structure = { name: "Renamed", entity: "ent-ch", alloc: "alloc-it", annual: 4800 }
  refuse(state, readOnlyOwner, "OPEX", "save", "owned-line", { annual: 1 }, "open:lines:owned-line", "open")
  refuse(state, readOnlyOwner, "OPEX", "save", "owned-line", { f0: 1 }, "open:lines:owned-line", "open")
  for (const id of ["owned-line", "apps-line", "vendor-line", "finance-line"]) {
    for (const values of [{ annual: 1 }, { name: "Hijack" }, { entity: "ent-ch" }, { alloc: "alloc-it" }, { f0: 1 }])
      refuse(state, emptyDomains, "OPEX", "save", id, values, `open:lines:${id}`, "open")
    refuse(state, emptyDomains, "OPEX", "delete", id, {}, `open:lines:${id}`, "open")
  }
  for (const id of ["vendor-line", "finance-line"]) {
    for (const values of [{ annual: 1 }, { name: "Hijack" }, { entity: "ent-ch" }, { alloc: "alloc-it" }, { f0: 1 }])
      refuse(state, budgetOwner, "OPEX", "save", id, values, `open:lines:${id}`, "open")
    refuse(state, budgetOwner, "OPEX", "delete", id, {}, `open:lines:${id}`, "open")
  }
  refuse(
    state,
    budgetOwner,
    "OPEX",
    "save",
    "not-mine",
    { name: "Not mine", owner: OTHER, annual: 100, el: "licenses" },
    "open:lines:not-mine",
    "open",
  )
  refuse(
    state,
    budgetOwner,
    "Headcount",
    "save",
    "card-1",
    { collection: "rates", annual: 1 },
    "open:rates:card-1",
    "open",
  )
  refuse(
    state,
    budgetOwner,
    "Headcount",
    "save",
    "pos-1",
    { collection: "positions", rateOverride: 1 },
    "open:positions:pos-1",
    "open",
  )
  refuse(
    state,
    budgetOwner,
    "Headcount",
    "save",
    "",
    { collection: "increase", inc: 9, incMonth: 1 },
    "open:increase",
    "open",
  )
  const viewed = domain.view(state, budgetOwner, environment)
  const viewedJson = JSON.stringify(viewed.data)
  expect(viewedJson).not.toContain("rateOverride")
  expect(viewedJson).not.toContain("Geneva employee")
  expect(viewedJson).not.toContain('"rates"')
  const headcount = rendered("Headcount", state, budgetOwner, 2026)
  expect(headcount).not.toContain("Rate cards")
  expect(headcount).not.toContain("rateOverride")
  expect(headcount).not.toContain("Geneva employee")
  refuse(
    state,
    budgetOwner,
    "OPEX",
    "save",
    "locked-new",
    { name: "Nope", owner: OWNER, annual: 100, el: "licenses" },
    "locked:lines:locked-new",
    "locked",
  )
  refuse(state, budgetOwner, "OPEX", "delete", "owned-line", {}, "locked:lines:owned-line", "locked")
  expect(execute(state, budgetOwner, "OPEX", "save", "owned-line", { f0: 25 }, "locked:lines:owned-line", "locked")).toMatchObject({
    ok: true,
  })
  expect(monthAt(lineOf(state, "locked", "owned-line").f, 0)).toBe(25)
  expect(execute(state, budgetOwner, "OPEX", "save", "apps-line", { f1: 0 }, "locked:lines:apps-line", "locked")).toMatchObject({
    ok: true,
  })
  expect(monthAt(lineOf(state, "locked", "apps-line").f, 1)).toBe(0)
  refuse(state, budgetOwner, "OPEX", "save", "vendor-line", { f0: 1 }, "locked:lines:vendor-line", "locked")
  refuse(state, budgetOwner, "OPEX", "save", "owned-line", { annual: 999 }, "locked:lines:owned-line", "locked")
  refuse(state, budgetOwner, "OPEX", "save", "apps-line", { annual: 999 }, "locked:lines:apps-line", "locked")
  refuse(state, budgetOwner, "OPEX", "save", "owned-line", { entity: "ent-ch" }, "locked:lines:owned-line", "locked")
  const beforeOwned = state.audit.length
  expect(
    execute(state, budgetOwner, "OPEX", "save", "owned-line", { ...structure, owner: OWNER }, "open:lines:owned-line", "open"),
  ).toMatchObject({ ok: true })
  expect(state.audit.length).toBe(beforeOwned + 1)
  const owned = lineOf(state, "open", "owned-line")
  expect(owned.name).toBe("Renamed")
  expect(owned.entity).toBe("ent-ch")
  expect(owned.alloc).toBe("alloc-it")
  expect(owned.annual).toBe(4800)
  expect(owned.owner).toEqual({ id: OWNER, name: "Apps Owner" })
  expect(owned.domain).toBeUndefined()
  expect(
    execute(state, budgetOwner, "OPEX", "save", "apps-line", structure, "open:lines:apps-line", "open"),
  ).toMatchObject({ ok: true })
  const apps = lineOf(state, "open", "apps-line")
  expect(apps.name).toBe("Renamed")
  expect(apps.entity).toBe("ent-ch")
  expect(apps.alloc).toBe("alloc-it")
  expect(apps.annual).toBe(4800)
  expect(apps.domain).toBe("Apps")
  expect(apps.owner).toEqual({ id: OTHER, name: "Other Owner" })
  expect(
    execute(
      state,
      budgetOwner,
      "OPEX",
      "save",
      "new-owned",
      { name: "New owned line", owner: OWNER, entity: "ent-ch", alloc: "alloc-it", el: "licenses", annual: 3600, cur: "USD" },
      "open:lines:new-owned",
      "open",
    ),
  ).toMatchObject({ ok: true })
  const created = lineOf(state, "open", "new-owned")
  expect(created.name).toBe("New owned line")
  expect(created.owner).toEqual({ id: OWNER, name: "Apps Owner" })
  expect(created.entity).toBe("ent-ch")
  expect(created.alloc).toBe("alloc-it")
  expect(created.annual).toBe(3600)
  expect(created.domain).toBeUndefined()
  expect(execute(state, budgetOwner, "OPEX", "delete", "new-owned", {}, "open:lines:new-owned", "open")).toMatchObject({
    ok: true,
  })
  expect(execute(state, budgetOwner, "OPEX", "delete", "owned-delete", {}, "open:lines:owned-delete", "open")).toMatchObject({
    ok: true,
  })
  expect(execute(state, budgetOwner, "OPEX", "delete", "apps-delete", {}, "open:lines:apps-delete", "open")).toMatchObject({
    ok: true,
  })
  const remaining = asRows(versionOf(state, "open").lines).map((row) => row.id)
  expect(remaining).not.toContain("new-owned")
  expect(remaining).not.toContain("owned-delete")
  expect(remaining).not.toContain("apps-delete")
  expect(remaining).toContain("vendor-line")
  expect(remaining).toContain("finance-line")
  expect(lineOf(state, "open", "vendor-line").domain).toBeUndefined()
})

test("PL-OWNER-SCOPE empty-domain owner saves the annual budget of an owned no-domain line", () => {
  const state = bareScope()
  expect(execute(state, bareOwner, "OPEX", "save", "bare-line", { annual: 4800 }, "open:lines:bare-line", "open")).toMatchObject({
    ok: true,
  })
  const owned = lineOf(state, "open", "bare-line")
  expect(owned.annual).toBe(4800)
  expect(owned.domain).toBeUndefined()
  expect(owned.owner).toEqual({ id: bareOwner.id, name: "Bare Owner" })
  expect(lineOf(state, "open", "foreign-line").annual).toBe(600)
  expect(lineOf(state, "open", "domain-line").domain).toBe("Finance")
})

test("PL-OWNER-SCOPE empty-domain owner saves the name of an owned no-domain line", () => {
  const state = bareScope()
  expect(execute(state, bareOwner, "OPEX", "save", "bare-line", { name: "Renamed bare" }, "open:lines:bare-line", "open")).toMatchObject({
    ok: true,
  })
  expect(lineOf(state, "open", "bare-line").name).toBe("Renamed bare")
  expect(lineOf(state, "open", "bare-line").domain).toBeUndefined()
  expect(lineOf(state, "open", "foreign-line").name).toBe("Foreign hardware")
})

test("PL-OWNER-SCOPE empty-domain owner saves the entity of an owned no-domain line", () => {
  const state = bareScope()
  expect(execute(state, bareOwner, "OPEX", "save", "bare-line", { entity: "ent-ch" }, "open:lines:bare-line", "open")).toMatchObject({
    ok: true,
  })
  expect(lineOf(state, "open", "bare-line").entity).toBe("ent-ch")
  expect(lineOf(state, "open", "bare-line").domain).toBeUndefined()
  expect(lineOf(state, "open", "domain-line").entity).toBe("")
})

test("PL-OWNER-SCOPE empty-domain owner saves the allocation of an owned no-domain line", () => {
  const state = bareScope()
  expect(execute(state, bareOwner, "OPEX", "save", "bare-line", { alloc: "alloc-it" }, "open:lines:bare-line", "open")).toMatchObject({
    ok: true,
  })
  expect(lineOf(state, "open", "bare-line").alloc).toBe("alloc-it")
  expect(lineOf(state, "open", "bare-line").domain).toBeUndefined()
  expect(lineOf(state, "open", "foreign-line").alloc).toBe("")
})

test("PL-OWNER-SCOPE empty-domain owner saves the forecast of an owned no-domain line", () => {
  const state = bareScope()
  expect(execute(state, bareOwner, "OPEX", "save", "bare-line", { f0: 25 }, "open:lines:bare-line", "open")).toMatchObject({
    ok: true,
  })
  const owned = lineOf(state, "open", "bare-line")
  expect(monthAt(owned.f, 0)).toBe(25)
  expect(owned.annual).toBe(1200)
  expect(owned.domain).toBeUndefined()
  expect(lineOf(state, "open", "foreign-line").f).toBeUndefined()
})

test("PL-OWNER-SCOPE empty-domain owner deletes an owned no-domain line", () => {
  const state = bareScope()
  expect(execute(state, bareOwner, "OPEX", "delete", "bare-line", {}, "open:lines:bare-line", "open")).toMatchObject({
    ok: true,
  })
  const remaining = asRows(versionOf(state, "open").lines).map((row) => row.id)
  expect(remaining).not.toContain("bare-line")
  expect(remaining).toContain("foreign-line")
  expect(remaining).toContain("domain-line")
})

for (const [action, values] of deniedLineWrites) {
  const field = Object.keys(values)[0] ?? "record"
  test(`PL-OWNER-SCOPE empty-domain owner cannot ${action} ${field} on an unrelated no-domain line`, () => {
    const state = bareScope()
    refuse(state, bareOwner, "OPEX", action, "foreign-line", values, "open:lines:foreign-line", "open")
    expect(lineOf(state, "open", "foreign-line").domain).toBeUndefined()
    expect(lineOf(state, "open", "bare-line").name).toBe("Bare licenses")
  })
  test(`PL-OWNER-SCOPE empty-domain owner cannot ${action} ${field} on a domain that is not allowed`, () => {
    const state = bareScope()
    refuse(state, bareOwner, "OPEX", action, "domain-line", values, "open:lines:domain-line", "open")
    expect(lineOf(state, "open", "domain-line").domain).toBe("Finance")
    expect(lineOf(state, "open", "bare-line").annual).toBe(1200)
  })
}

test("PL-SPREAD-FLAGS saving the twelve month form marks only January and the next annual keeps it", () => {
  const state = snapshot({
    versions: [plan("fy2027", 2027)],
    officials: {},
    entities: [],
    allocations: [],
    roster: [],
  })
  const spreadEnv: Environment = { at: AT, id: () => "generated-id", directory: [] }
  expect(execute(state, admin, "OPEX", "save", "spread-line", { annual: 100000, el: "licenses", name: "Spread" }, "fy2027:lines:spread-line", "fy2027", spreadEnv)).toMatchObject({
    ok: true,
  })
  const opened = lineOf(state, "fy2027", "spread-line")
  expect(numbers(opened.b)).toEqual([...Array<number>(11).fill(8333.33), 8333.37])
  expect(booleans(opened.bm)).toEqual(Array<boolean>(12).fill(false))
  const html = rendered("OPEX", state, admin, 2027)
  const budget = requireForm(html, "spread-line", "b0")
  const months = Array.from({ length: 12 }, (_, index) => `b${index}`)
  expect(budget.page).toBe("OPEX")
  expect(budget.action).toBe("save")
  expect(budget.values.collection).toBe("lines")
  expect(budget.values.versionId).toBe("fy2027")
  expect(months.filter((name) => Object.hasOwn(budget.values, name))).toEqual(months)
  expect(Object.hasOwn(budget.values, "month")).toBe(false)
  expect(Object.hasOwn(budget.values, "value")).toBe(false)
  expect(budget.values.budgetEdited).toBe("[]")
  expect(budget.values.b0).toBe(8333.33)
  expect(budget.values.b11).toBe(8333.37)
  budget.values.b0 = 20000
  // The browser records explicit edits; the twelve values alone cannot express that intent.
  budget.values.budgetEdited = "[0]"
  const typed = submitRendered(state, admin, budget, "fy2027:lines:spread-line", spreadEnv)
  expect(typed).toMatchObject({ ok: true })
  const january = lineOf(state, "fy2027", "spread-line")
  expect(booleans(january.bm)).toEqual([true, false, false, false, false, false, false, false, false, false, false, false])
  expect(numbers(january.b)).toEqual([20000, ...Array<number>(10).fill(8333.33), 8333.37])
  expect(january.annual).toBe(111666.67)
  const annual = requireForm(rendered("OPEX", state, admin, 2027), "spread-line", "annual")
  expect(Object.hasOwn(annual.values, "b0")).toBe(false)
  expect(Object.hasOwn(annual.values, "month")).toBe(false)
  expect(annual.values.annual).not.toBe(120000)
  annual.values.annual = 120000
  // January stays 20000. The other 100000 is truncated to cents across eleven open months, and December takes the remainder.
  expect(submitRendered(state, admin, annual, "fy2027:lines:spread-line", spreadEnv)).toMatchObject({ ok: true })
  const kept = lineOf(state, "fy2027", "spread-line")
  expect(numbers(kept.b)).toEqual([20000, ...Array<number>(10).fill(9090.9), 9091])
  expect(booleans(kept.bm)).toEqual([true, false, false, false, false, false, false, false, false, false, false, false])
  expect(kept.annual).toBe(120000)
})

test("PL-SPREAD-FLAGS typing a displayed month value with budgetEdited marks only that month", () => {
  const { state, budget, lineId } = openedSpread("equal-line")
  expect(budget.values.b2).toBe(8333.33)
  const typed = postMarked(state, budget, lineId, "[2]")
  expect(typed).toMatchObject({ ok: true })
  const line = lineOf(state, "fy2027", lineId)
  expect(booleans(line.bm)).toEqual([false, false, true, false, false, false, false, false, false, false, false, false])
  expect(numbers(line.b)).toEqual([...Array<number>(11).fill(8333.33), 8333.37])
  expect(line.annual).toBe(100000)
})

test("PL-SPREAD-FLAGS an empty budgetEdited marker does not change manual flags", () => {
  const { state, budget, lineId } = openedSpread("empty-marker-line")
  budget.values.b0 = 20000
  const posted = postMarked(state, budget, lineId, "[]")
  expect(posted).toMatchObject({ ok: true })
  const line = lineOf(state, "fy2027", lineId)
  expect(booleans(line.bm)).toEqual(Array<boolean>(12).fill(false))
  expect(numbers(line.b)).toEqual([...Array<number>(11).fill(8333.33), 8333.37])
  expect(line.annual).toBe(100000)
})

test("PL-SPREAD-FLAGS a legacy caller omitting budgetEdited marks its one equal posted month", () => {
  const { state, budget, lineId } = openedSpread("legacy-marker-line")
  Array.from({ length: 12 }, (_, index) => index).filter((index) => index !== 2).forEach((index) => {
    delete budget.values[`b${index}`]
  })
  delete budget.values.budgetEdited
  const before = structuredClone(state)
  const key = `fy2027:lines:${lineId}`
  expect(submitRendered(state, admin, budget, key, spreadEnv)).toMatchObject({ ok: true })
  const line = lineOf(state, "fy2027", lineId)
  expect(booleans(line.bm)).toEqual([false, false, true, false, false, false, false, false, false, false, false, false])
  expect(numbers(line.b)).toEqual([...Array<number>(11).fill(8333.33), 8333.37])
  expect(line.annual).toBe(100000)
  expect(state.versions).toEqual({ ...before.versions, [key]: { version: persistedRevision(before, key) + 1, by: admin.id } })
  expect(state.audit).toHaveLength(before.audit.length + 1)
  expect(state.audit.slice(0, -1)).toEqual(before.audit)
  expect(state.audit.at(-1)).toMatchObject({ who: admin.id, at: AT, record: key })
  expect(state.notices).toEqual(before.notices)
  expect(state.sequences).toEqual(before.sequences)
})

test("PL-SPREAD-FLAGS multiple explicit edits include an equal-valued month and leave others unmanual", () => {
  const { state, budget, lineId } = openedSpread("multiple-marker-line")
  budget.values.b0 = 20000
  expect(budget.values.b2).toBe(8333.33)
  expect(postMarked(state, budget, lineId, "[0,2]")).toMatchObject({ ok: true })
  const line = lineOf(state, "fy2027", lineId)
  expect(booleans(line.bm)).toEqual([true, false, true, false, false, false, false, false, false, false, false, false])
  expect(numbers(line.b)).toEqual([20000, ...Array<number>(10).fill(8333.33), 8333.37])
  expect(line.annual).toBe(111666.67)
})

test("PL-SPREAD-FLAGS December and January edits work in reverse index order", () => {
  const { state, budget, lineId } = openedSpread("end-marker-line")
  budget.values.b11 = 20000
  expect(budget.values.b0).toBe(8333.33)
  expect(postMarked(state, budget, lineId, "[11,0]")).toMatchObject({ ok: true })
  const line = lineOf(state, "fy2027", lineId)
  expect(booleans(line.bm)).toEqual([true, false, false, false, false, false, false, false, false, false, false, true])
  expect(numbers(line.b)).toEqual([...Array<number>(11).fill(8333.33), 20000])
  expect(line.annual).toBe(111666.63)
})

for (const marker of [
  ["not json", "nope"],
  ["a fractional index", "[1.5]"],
  ["a string index", '["0"]'],
  ["an empty string", ""],
]) {
  test(`PL-SPREAD-FLAGS malformed budgetEdited (${marker[0]}) is 422 and writes nothing`, () => {
    const { state, budget, lineId } = openedSpread("malformed-line")
    const before = structuredClone(state)
    expect(postMarked(state, budget, lineId, marker[1])).toMatchObject({ ok: false, status: 422 })
    expect(state).toEqual(before)
  })
}

test("PL-SPREAD-FLAGS duplicate budgetEdited is 422 and writes nothing", () => {
  const { state, budget, lineId } = openedSpread("duplicate-line")
  const before = structuredClone(state)
  expect(postMarked(state, budget, lineId, "[0,0]")).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
})

for (const marker of [
  ["above November", "[12]"],
  ["negative", "[-1]"],
  ["mixed with a valid index", "[0,12]"],
]) {
  test(`PL-SPREAD-FLAGS out-of-range budgetEdited (${marker[0]}) is 422 and writes nothing`, () => {
    const { state, budget, lineId } = openedSpread("range-line")
    const before = structuredClone(state)
    expect(postMarked(state, budget, lineId, marker[1])).toMatchObject({ ok: false, status: 422 })
    expect(state).toEqual(before)
  })
}

test("PL-SPREAD-FLAGS a marked month with a missing value is 422 and writes nothing", () => {
  const { state, budget, lineId } = openedSpread("missing-line")
  const before = structuredClone(state)
  delete budget.values.b4
  expect(postMarked(state, budget, lineId, "[4]")).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
})

for (const [label, value] of [
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
] as const) {
  test(`PL-SPREAD-FLAGS a marked month with ${label} is 422 and writes nothing`, () => {
    const { state, budget, lineId } = openedSpread("nonfinite-line")
    const before = structuredClone(state)
    budget.values.b4 = value
    expect(postMarked(state, budget, lineId, "[4]")).toMatchObject({ ok: false, status: 422 })
    expect(state).toEqual(before)
  })
}

test("PL-LOCKED-CODE official locked project code, element, and breakdown stay unchanged", () => {
  const version = plan("fy2026", 2026, true)
  version.projects = [{ id: "proj-1", name: "Network refresh", code: "CPX-2026-004", owner: { id: OTHER, name: "Other Owner" } }]
  version.lines = [
    {
      id: "capex-line",
      sec: "capex",
      el: "licenses",
      proj: "proj-1",
      name: "Rack build",
      desc: "Original note",
      cls: "capex",
      cur: "USD",
      annual: 1200,
      b: Array<number>(12).fill(100),
      bm: Array<boolean>(12).fill(false),
      owner: { id: OWNER, name: "Apps Owner" },
    },
  ]
  version.lists = { licenses: { split: true } }
  const state = snapshot({
    versions: [version],
    officials: { "2026": "fy2026" },
    entities: [],
    allocations: [],
    roster: [],
  })
  expect(execute(state, admin, "CAPEX", "save", "proj-1", { collection: "projects", owner: OWNER }, "fy2026:projects:proj-1", "fy2026")).toMatchObject({
    ok: true,
  })
  expect(projectOf(state, "fy2026", "proj-1").owner).toEqual({ id: OWNER, name: "Apps Owner" })
  expect(projectOf(state, "fy2026", "proj-1").code).toBe("CPX-2026-004")
  expect(
    execute(
      state,
      admin,
      "CAPEX",
      "save",
      "capex-line",
      { name: "Rack build renamed", desc: "Locked note", a0: 12, f0: 7 },
      "fy2026:lines:capex-line",
      "fy2026",
    ),
  ).toMatchObject({ ok: true })
  const line = lineOf(state, "fy2026", "capex-line")
  expect(line.name).toBe("Rack build renamed")
  expect(line.desc).toBe("Locked note")
  expect(monthAt(line.a, 0)).toBe(12)
  expect(monthAt(line.a, 1)).toBeNull()
  expect(monthAt(line.f, 0)).toBe(7)
  expect(monthAt(line.f, 1)).toBeNull()
  expect(projectOf(state, "fy2026", "proj-1").code).toBe("CPX-2026-004")
  const beforeUnlock = structuredClone(state)
  expect(execute(state, admin, "Versions", "unlock", "fy2026", {}, "versions:fy2026", "fy2026")).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(state).toEqual(beforeUnlock)
  const beforeDelete = structuredClone(state)
  expect(execute(state, admin, "Versions", "delete", "fy2026", {}, "versions:fy2026", "fy2026")).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(state).toEqual(beforeDelete)
  const beforeElement = structuredClone(state)
  expect(execute(state, admin, "CAPEX", "save", "capex-line", { el: "services" }, "fy2026:lines:capex-line", "fy2026")).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(state).toEqual(beforeElement)
  expect(lineOf(state, "fy2026", "capex-line").el).toBe("licenses")
  const beforeBreakdown = structuredClone(state)
  expect(execute(state, admin, "OPEX", "save", "", { el: "licenses", split: false }, "fy2026:lists:licenses", "fy2026")).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(state).toEqual(beforeBreakdown)
  expect(versionOf(state, "fy2026").lists).toEqual({ licenses: { split: true } })
  const beforeCode = structuredClone(state)
  const code = execute(
    state,
    admin,
    "CAPEX",
    "save",
    "proj-1",
    { collection: "projects", code: "CPX-2026-099" },
    "fy2026:projects:proj-1",
    "fy2026",
  )
  expect(code).toMatchObject({ ok: false, status: 403 })
  expect(projectOf(state, "fy2026", "proj-1").code).toBe("CPX-2026-004")
  expect(state.data).toEqual(beforeCode.data)
  expect(state.audit).toEqual(beforeCode.audit)
  expect(state.versions).toEqual(beforeCode.versions)
  expect(state.sequences).toEqual(beforeCode.sequences)
})

test("PL-LOCKED-CODE a locked non-official version rejects a project code change", () => {
  const state = lockedDraft()
  const before = structuredClone(state)
  expect(
    execute(
      state,
      admin,
      "CAPEX",
      "save",
      "proj-1",
      { collection: "projects", code: "CPX-2026-099" },
      "fy2026-draft:projects:proj-1",
      "fy2026-draft",
    ),
  ).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
  expect(projectOf(state, "fy2026-draft", "proj-1").code).toBe("CPX-2026-004")
})

test("PL-LOCKED-CODE a locked non-official version rejects an element change", () => {
  const state = lockedDraft()
  const before = structuredClone(state)
  expect(execute(state, admin, "CAPEX", "save", "capex-line", { el: "services" }, "fy2026-draft:lines:capex-line", "fy2026-draft")).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(state).toEqual(before)
  expect(lineOf(state, "fy2026-draft", "capex-line").el).toBe("licenses")
})

test("PL-LOCKED-CODE a locked non-official version rejects a breakdown change", () => {
  const state = lockedDraft()
  const before = structuredClone(state)
  expect(
    execute(state, admin, "OPEX", "save", "", { el: "licenses", split: false }, "fy2026-draft:lists:licenses", "fy2026-draft"),
  ).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
  expect(versionOf(state, "fy2026-draft").lists).toEqual({ licenses: { split: true } })
})

test("PL-LOCKED-CODE a locked non-official version still saves project owner", () => {
  const state = lockedDraft()
  expect(
    execute(
      state,
      admin,
      "CAPEX",
      "save",
      "proj-1",
      { collection: "projects", owner: OWNER },
      "fy2026-draft:projects:proj-1",
      "fy2026-draft",
    ),
  ).toMatchObject({ ok: true })
  expect(projectOf(state, "fy2026-draft", "proj-1").owner).toEqual({ id: OWNER, name: "Apps Owner" })
  expect(projectOf(state, "fy2026-draft", "proj-1").code).toBe("CPX-2026-004")
})

test("PL-LOCKED-CODE a locked non-official version still saves the line name", () => {
  const state = lockedDraft()
  expect(
    execute(state, admin, "CAPEX", "save", "capex-line", { name: "Rack build renamed" }, "fy2026-draft:lines:capex-line", "fy2026-draft"),
  ).toMatchObject({ ok: true })
  const line = lineOf(state, "fy2026-draft", "capex-line")
  expect(line.name).toBe("Rack build renamed")
  expect(line.el).toBe("licenses")
  expect(line.desc).toBe("Original note")
  expect(projectOf(state, "fy2026-draft", "proj-1").code).toBe("CPX-2026-004")
})

test("PL-LOCKED-CODE a locked non-official version still saves the note", () => {
  const state = lockedDraft()
  expect(
    execute(state, admin, "CAPEX", "save", "capex-line", { desc: "Locked note" }, "fy2026-draft:lines:capex-line", "fy2026-draft"),
  ).toMatchObject({ ok: true })
  const line = lineOf(state, "fy2026-draft", "capex-line")
  expect(line.desc).toBe("Locked note")
  expect(line.name).toBe("Rack build")
  expect(line.el).toBe("licenses")
})

test("PL-LOCKED-CODE a locked non-official version still saves actuals", () => {
  const state = lockedDraft()
  expect(execute(state, admin, "CAPEX", "save", "capex-line", { a0: 12 }, "fy2026-draft:lines:capex-line", "fy2026-draft")).toMatchObject({
    ok: true,
  })
  const line = lineOf(state, "fy2026-draft", "capex-line")
  expect(monthAt(line.a, 0)).toBe(12)
  expect(monthAt(line.a, 1)).toBeNull()
  expect(line.el).toBe("licenses")
  expect(projectOf(state, "fy2026-draft", "proj-1").code).toBe("CPX-2026-004")
})

test("PL-LOCKED-CODE a locked non-official version still saves forecast", () => {
  const state = lockedDraft()
  expect(execute(state, admin, "CAPEX", "save", "capex-line", { f0: 7 }, "fy2026-draft:lines:capex-line", "fy2026-draft")).toMatchObject({
    ok: true,
  })
  const line = lineOf(state, "fy2026-draft", "capex-line")
  expect(monthAt(line.f, 0)).toBe(7)
  expect(monthAt(line.f, 1)).toBeNull()
  expect(line.name).toBe("Rack build")
  expect(versionOf(state, "fy2026-draft").lists).toEqual({ licenses: { split: true } })
})

function snapshot(data: Record<string, unknown>): Snapshot {
  return { data, versions: {}, sequences: {}, audit: [], notices: [] }
}


test("PL-OWNER-SCOPE budget owner submits the rendered CAPEX line editor with its classification", () => {
  const version = plan("owner-capex", 2026)
  version.projects = [{ id: "project", name: "Infrastructure", code: "CPX-2026-001", owner: { id: OWNER, name: "Apps Owner" } }]
  version.lines = [{ ...budgetLine("capex-line", "hwo", "Infrastructure hardware", OWNER, 1200), sec: "capex", proj: "project", cls: "capex" }]
  const state = snapshot({ versions: [version], officials: {}, directory, entities: [], allocations: [], roster: [] })
  const editor = requireForm(rendered("CAPEX", state, budgetOwner, 2026), "capex-line", "name")
  expect(editor.values.cls).toBe("capex")
  editor.values.name = "Updated infrastructure hardware"
  expect(submitRendered(state, budgetOwner, editor, "owner-capex:lines:capex-line", environment).ok).toBe(true)
  expect(lineOf(state, "owner-capex", "capex-line")).toMatchObject({ name: "Updated infrastructure hardware", cls: "capex", proj: "project" })
  expect(state.versions["owner-capex:lines:capex-line"]?.version).toBe(1)
})


for (const cleared of [null, ""] as const) {
  test("PL-SPREAD-FLAGS clearing one marked budget month keeps legacy zero semantics", () => {
    const { state, budget, lineId } = openedSpread("clear-month")
    const untouched = numbers(lineOf(state, "fy2027", lineId).b)
    expect(domain.execute(state, admin, {
      page: budget.page,
      action: budget.action,
      id: lineId,
      version: persistedRevision(state, `fy2027:lines:${lineId}`),
      values: { ...budget.values, b4: cleared, budgetEdited: "[4]" },
    }, spreadEnv).ok).toBe(true)
    const saved = lineOf(state, "fy2027", lineId)
    expect(numbers(saved.b)).toEqual(untouched.map((amount, index) => index === 4 ? 0 : amount))
    expect(booleans(saved.bm)).toEqual(Array.from({ length: 12 }, (_, index) => index === 4))
  })
}
