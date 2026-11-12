import { expect, test } from "bun:test"
import { configure, controls, roleMap } from "../runtime/admin.ts"
import { empty } from "./fixture/persistence.ts"

const at = "2026-11-11T12:00:00Z"
const actor = { id: "directory-admin", roles: ["admin"], canWrite: true }
const environment = { at, id: () => "unused", directory: [{ id: "person", name: "Person from directory" }] }

test("unconfigured role maps stay empty, group clearing is versioned and another surface row is preserved", () => {
  const state = empty()
  expect(roleMap(state, "dashboard").every((row) => row.entra === null)).toBe(true)
  expect(state.data.roleMap).toBeUndefined()
  state.data.roleMap = [{ surface: "planner", role: "viewer", entra: null, version: 0, by: "" }]
  expect(
    configure(
      state,
      "dashboard",
      actor,
      { page: "Executive Dashboard", action: "configure-group", version: 0, values: { role: "viewer", entra: "" } },
      environment,
    ),
  ).toEqual({ ok: true })
  expect(roleMap(state, "dashboard").find((row) => row.role === "viewer")).toMatchObject({
    entra: null,
    version: 1,
    by: actor.id,
  })
  expect(roleMap(state, "planner")).toContainEqual({
    surface: "planner",
    role: "viewer",
    entra: null,
    version: 0,
    by: "",
  })
  const before = structuredClone(state)
  expect(
    configure(
      state,
      "dashboard",
      actor,
      { page: "Executive Dashboard", action: "configure-group", version: 0, values: { role: "viewer", entra: "" } },
      environment,
    ),
  ).toMatchObject({ ok: false, status: 409 })
  expect(state).toEqual(before)
})

test("admin-only configuration is atomic, surface-scoped and accepts only real page and record keys", () => {
  const state = empty()
  state.data.opexOwners = [{ id: 7, name: "Licenses" }]
  const command = {
    page: "Executive Dashboard",
    action: "configure-summaries",
    version: 0,
    values: { pages: ["IT Risks"] },
  }
  const before = structuredClone(state)
  expect(configure(state, "dashboard", { ...actor, roles: ["viewer"] }, command, environment)).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(configure(state, "procurement", actor, command, environment)).toMatchObject({ ok: false, status: 403 })
  expect(
    configure(state, "dashboard", actor, { ...command, values: { pages: ["Hardware"] } }, environment),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  expect(configure(state, "dashboard", actor, command, environment)).toEqual({ ok: true })
  expect(
    configure(
      state,
      "dashboard",
      actor,
      {
        page: "OPEX Detail",
        action: "configure-budget-lines",
        version: 0,
        values: { person: "person", lines: ["opexOwners:7"] },
      },
      environment,
    ),
  ).toEqual({ ok: true })
  expect(state.data.budgetLineIds).toEqual({ person: ["opexOwners:7"] })
  expect(controls(state, "dashboard", "OPEX Detail", actor, environment)).toContain("Person from directory")
  expect(controls(state, "dashboard", "OPEX Detail", { ...actor, roles: ["viewer"] }, environment)).toBe("")
})

test("contributor assignments and planner domains never create local people or infer empty as everyone", () => {
  const state = empty()
  expect(
    configure(
      state,
      "dashboard",
      actor,
      {
        page: "IT Operations",
        action: "configure-assignment",
        version: 0,
        values: { person: "unknown", assigned: ["Operations"] },
      },
      environment,
    ),
  ).toMatchObject({ ok: false, status: 422 })
  expect(state.data.access).toBeUndefined()
  expect(
    configure(
      state,
      "dashboard",
      actor,
      {
        page: "IT Operations",
        action: "configure-assignment",
        version: 0,
        values: { person: "person", assigned: ["Operations"] },
      },
      environment,
    ),
  ).toEqual({ ok: true })
  expect(
    configure(
      state,
      "planner",
      actor,
      { page: "OPEX", action: "configure-assignment", version: 1, values: { person: "person", domains: "" } },
      environment,
    ),
  ).toEqual({ ok: true })
  expect(state.data.access).toEqual({ person: { assigned: ["Operations"], domains: [] } })
})

test("budget access uses collection-qualified choices and requires explicit legacy reselection", () => {
  const state = empty()
  state.data.opexOwners = [{ id: 7, name: "Licenses" }]
  state.data.capexProjects = [{ id: "7", name: "Infrastructure" }]
  state.data.budgetLineIds = { person: ["7"] }
  const legacy = controls(state, "dashboard", "OPEX Detail", actor, environment)
  expect(legacy).toContain('name="lines.0" data-choice="true" value="opexOwners:7">OPEX — Licenses')
  expect(legacy).toContain('name="lines.1" data-choice="true" value="capexProjects:7">CAPEX — Infrastructure')
  expect(legacy).not.toContain('value="opexOwners:7" checked')
  expect(legacy).not.toContain('value="capexProjects:7" checked')
  const before = structuredClone(state)
  for (const lines of [["7"], ["capexProjects:missing"], ["opexEntries:7"]]) {
    expect(
      configure(
        state,
        "dashboard",
        actor,
        { page: "OPEX Detail", action: "configure-budget-lines", version: 0, values: { person: "person", lines } },
        environment,
      ),
    ).toMatchObject({ ok: false, status: 422 })
    expect(state).toEqual(before)
  }
  expect(
    configure(
      state,
      "dashboard",
      actor,
      {
        page: "OPEX Detail",
        action: "configure-budget-lines",
        version: 0,
        values: { person: "person", lines: ["opexOwners:7"] },
      },
      environment,
    ),
  ).toEqual({ ok: true })
  expect(state.data.budgetLineIds).toEqual({ person: ["opexOwners:7"] })
  expect(state.audit.at(-1)).toMatchObject({
    record: "config:budgetLineIds:person",
    was: ["7"],
    became: ["opexOwners:7"],
  })
  const opex = controls(state, "dashboard", "OPEX Detail", actor, environment)
  expect(opex).toContain('value="opexOwners:7" checked')
  expect(opex).not.toContain('value="capexProjects:7" checked')
  expect(
    configure(
      state,
      "dashboard",
      actor,
      {
        page: "CAPEX Projects",
        action: "configure-budget-lines",
        version: 1,
        values: { person: "person", lines: ["capexProjects:7"] },
      },
      environment,
    ),
  ).toEqual({ ok: true })
  const capex = controls(state, "dashboard", "CAPEX Projects", actor, environment)
  expect(capex).toContain('value="capexProjects:7" checked')
  expect(capex).not.toContain('value="opexOwners:7" checked')
})
