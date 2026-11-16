import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfPeople } from "../../../../../packages/schema/src/sucafina/people.ts"
import { createSfPeopleClient } from "../../../../../packages/client/src/sucafina/people.ts"
import type { SfTransport } from "../../../../../packages/client/src/sucafina/transport.ts"
import {
  SF_PEOPLE_PAGES, projectSfPeopleData, projectSfPeopleVersions,
} from "../../../../../apps/cli/src/sucafina-product/native-ui/people.ts"
import { domain } from "../../runtime/dashboard-people.ts"
import type { Snapshot } from "../../runtime/contract.ts"

const at = "2026-11-15T12:00:00Z"
const environment = {
  at,
  id: () => "new-person",
  directory: [{ id: "admin", name: "Admin" }, { id: "viewer", name: "Viewer" }],
}
const admin = { id: "admin", roles: ["admin"], canWrite: true }
const viewer = { id: "viewer", roles: ["viewer"], canWrite: false }
const selection = { year: 2026, month: 11 } as const
const sources = {
  cio: { name: "Director", title: "CIO", private: "never-copy" },
  leaders: [
    { id: "l1", name: "Leader", domain: "Operations", private: "confidential" },
  ],
  members: [
    {
      id: "m1", name: "Alice", title: "Engineer", type: "Employee", status: "Active",
      leaderId: "l1", cls: "Talent", outlook: "Promote", notes: "Sensitive",
      privateSalary: 100_000,
    },
    {
      id: "m2", name: "Bob", title: "Contractor", type: "Contractor", status: "Terminated",
      leaderId: 0, end: "2026-03-15", cls: "Solid Contributor", notes: "",
    },
  ],
  hotTopics: [{ id: "t1", action: "Migrate", owner: "Alice", status: "blocked", priority: "high", secret: "no" }],
  itUsersMonthly: [{ year: 2026, month: 11, users: 0 }],
}
function snapshot(): Snapshot {
  return {
    data: structuredClone({ ...sources, summaries: ["Headcount Overview", "Team Structure", "Talent Review"] }),
    versions: {
      "cio": { version: 0, by: "admin" },
      "leaders:l1": { version: 7, by: "admin" },
      "members:m1": { version: 1, by: "admin" },
      "members:m2": { version: 0, by: "admin" },
      "hotTopics:t1": { version: 3, by: "admin" },
      "dataset": { version: 55, by: "system" },
      "secret:payroll": { version: 90, by: "system" },
    },
    sequences: {}, audit: [], notices: [],
  }
}

describe("A10 Pessoas and Talent — source-boundary contract", () => {
  test("exactly fifteen original catalog IDs and their distinct source operations", () => {
    const expected = [
      "domain.command.CAP02.delete", "domain.command.CAP02.save",
      "domain.command.CAP07.deleteLeader", "domain.command.CAP07.deleteMember",
      "domain.command.CAP07.saveCio", "domain.command.CAP07.saveLeader",
      "domain.command.CAP07.saveMember", "domain.command.CAP08.delete",
      "domain.command.CAP08.exportAllMembers", "domain.command.CAP08.import",
      "domain.command.CAP08.save", "domain.page.CAP02", "domain.page.CAP06",
      "domain.page.CAP07", "domain.page.CAP08",
    ]
    expect(Object.keys(SfPeople.operations).sort()).toEqual(expected.sort())
    Object.entries(SfPeople.operations).forEach(([id, operation]) => {
      expect(id).toBe(operation.operationId)
    })
    expect(SF_PEOPLE_PAGES).toEqual({
      CAP02: "Hot Topics & Actions", CAP06: "Headcount Overview",
      CAP07: "Team Structure", CAP08: "Talent Review",
    })
  })

  test("closed command shape rejects extra payload/action and invalid member enums or CAS", () => {
    const input = {
      id: "m1", version: 0,
      values: { name: "Alice", type: "Employee", status: "Active", cls: "", outlook: "" },
    } as const
    const op = SfPeople.operations["domain.command.CAP08.save"]
    expect(Schema.decodeUnknownSync(op.input, { onExcessProperty: "error" })(input)).toEqual(input)
    expect(() => Schema.decodeUnknownSync(op.input, { onExcessProperty: "error" })({
      ...input, action: "approve",
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(op.input, { onExcessProperty: "error" })({
      ...input, values: { ...input.values, secretSalary: 65000 },
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(op.input)({
      ...input, values: { ...input.values, status: "Promoted" },
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(op.input)({ ...input, version: -1 })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfPeople.operations["domain.command.CAP07.deleteLeader"].input)({
      id: "l1", version: 1, values: { versions: { "members:m1": -1 } },
    })).toThrow()
  })

  test("CAP02 preserves source topic field names and rejects any privileged metadata", () => {
    expect(projectSfPeopleData("CAP02", sources, { ...selection, topicStatus: "blocked" }, at, false)).toEqual({
      hotTopics: [{ id: "t1", action: "Migrate", owner: "Alice", status: "blocked", priority: "high" }],
    })
    expect(projectSfPeopleData("CAP02", sources, { ...selection, topicStatus: "done" }, at, false))
      .toEqual({ hotTopics: [] })
  })

  test("CAP07 source fields are exact, and nonadmin redaction omits restricted fields", () => {
    const projected = projectSfPeopleData("CAP07", sources, selection, at, false)
    expect(projected).toEqual({
      cio: { name: "Director", title: "CIO" },
      leaders: [{ id: "l1", name: "Leader", domain: "Operations" }],
      members: [
        { id: "m1", name: "Alice", title: "Engineer", type: "Employee", status: "Active", leaderId: "l1" },
        { id: "m2", name: "Bob", title: "Contractor", type: "Contractor", status: "Terminated", leaderId: 0, end: "2026-03-15" },
      ],
    })
    const json = JSON.stringify(projected)
    for (const secret of ["cls", "outlook", "notes", "privateSalary", "private", "100000"])
      expect(json).not.toContain(secret)
    const privileged = projectSfPeopleData("CAP07", sources, selection, at, true)
    expect(JSON.stringify(privileged)).toContain('"cls":"Talent"')
    expect(JSON.stringify(privileged)).not.toContain("privateSalary")
  })

  test("CAP08 retains all admitted rows for atomic import version map, despite status filter", () => {
    const data = projectSfPeopleData("CAP08", sources, { ...selection, memberStatus: "Active" }, at, true)
    expect("members" in data && data.members.map((row) => row.id)).toEqual(["m1", "m2"])
    expect(projectSfPeopleVersions("CAP08", snapshot().versions, data)).toEqual({
      "members:m1": 1, "members:m2": 0,
    })
    const publicData = projectSfPeopleData("CAP08", sources, selection, at, false)
    expect(JSON.stringify(publicData)).not.toContain('"cls"')
    expect(JSON.stringify(publicData)).not.toContain('"notes"')
    expect(JSON.stringify(publicData)).not.toContain('"outlook"')
  })

  test("CAP06 uses source-compatible headcount formulas and protects talent counts", () => {
    const normal = projectSfPeopleData("CAP06", sources, selection, at, false)
    expect("metrics" in normal && normal.metrics).toEqual({
      active: 1, terminated: 1, departuresYtd: 1,
      attritionYtd: "66.7%", averageTenureMonths: "—", staffRatio: "—",
      contractors: 1, employees: 1,
    })
    const withTalent = projectSfPeopleData("CAP06", sources, selection, at, true)
    expect("metrics" in withTalent && withTalent.metrics).toMatchObject({
      talent: 1, attritionYtd: "66.7%", staffRatio: "—",
    })
    expect(JSON.stringify(normal)).not.toContain('"talent"')
    expect("byLeader" in normal && normal.byLeader[0]).toEqual({
      id: "l1", name: "Leader", active: 1,
    })
    expect("byLeader" in withTalent && withTalent.byLeader[0]).toEqual({
      id: "l1", name: "Leader", active: 1, talentActive: 1,
    })
  })

  test("CAS exposes only currently displayed/authorized record keys, not by/dataset/audit", () => {
    const state = snapshot()
    const topics = projectSfPeopleData("CAP02", sources, selection, at, true)
    const structure = projectSfPeopleData("CAP07", sources, selection, at, true)
    expect(projectSfPeopleVersions("CAP02", state.versions, topics)).toEqual({ "hotTopics:t1": 3 })
    expect(projectSfPeopleVersions("CAP07", state.versions, structure)).toEqual({
      cio: 0, "leaders:l1": 7, "members:m1": 1, "members:m2": 0,
    })
    expect(projectSfPeopleVersions("CAP06", state.versions,
      projectSfPeopleData("CAP06", sources, selection, at, false))).toEqual({})
    expect(JSON.stringify(projectSfPeopleVersions("CAP07", state.versions, structure))).not.toContain("admin")
    expect(JSON.stringify(projectSfPeopleVersions("CAP07", state.versions, structure))).not.toContain("payroll")
  })

  test("real People domain keeps role-based Talent edit admission and version conflicts", () => {
    const state = snapshot()
    expect(domain.execute(state, viewer, {
      page: "Talent Review", action: "save", id: "m1", version: 1,
      values: { cls: "Lagger" },
    }, environment)).toMatchObject({ ok: false, status: 403 })
    const before = structuredClone(state.data.members)
    expect(domain.execute(state, admin, {
      page: "Team Structure", action: "saveMember", id: "m1", version: 0,
      values: { status: "On Leave" },
    }, environment)).toMatchObject({ ok: false, status: 409 })
    expect(state.data.members).toEqual(before)
    const saved = domain.execute(state, admin, {
      page: "Team Structure", action: "saveMember", id: "m1", version: 1,
      values: { status: "On Leave" },
    }, environment)
    expect(saved.ok).toBe(true)
    expect(state.versions["members:m1"].version).toBe(2)
  })

  test("source Domain.view redacts talent fields before the adapter, including on viewer role", () => {
    const state = snapshot()
    const view = domain.view(state, viewer, environment)
    const members = view.data.members as Record<string, unknown>[]
    expect(members?.[0]).toMatchObject({ id: "m1", name: "Alice" })
    expect(members?.[0]).not.toHaveProperty("cls")
    expect(members?.[0]).not.toHaveProperty("outlook")
    expect(members?.[0]).not.toHaveProperty("notes")
    expect(state.audit.length).toBeGreaterThan(0)
    expect(view.versions["members:m1"]?.version).toBe(1)
  })

  test("malformed sources fail closed rather than synthesizing empty authorized results", () => {
    expect(() => projectSfPeopleData("CAP08",
      { ...sources, members: [null] }, selection, at, false)).toThrow("SF_PEOPLE_SOURCE_INVALID")
    expect(() => projectSfPeopleData("CAP07",
      { ...sources, cio: "not-a-record" }, selection, at, false)).toThrow("SF_PEOPLE_SOURCE_INVALID")
    expect(() => projectSfPeopleData("CAP08",
      { ...sources, members: [{ id: "m1", status: "Promoted" }] }, selection, at, true)).toThrow()
    expect(() => projectSfPeopleData("CAP02",
      { ...sources, hotTopics: [{ id: "t1", status: 0 }] }, selection, at, false)).toThrow()
  })

  test("client dispatches once and rejects unknown fields before any network", async () => {
    const calls: { operationId: string; input: unknown; key?: string }[] = []
    const transport: SfTransport = {
      async execute(operation, input, options) {
        calls.push({ operationId: operation.operationId, input, key: options.idempotencyKey })
        return { kind: "transport-error", reason: "outcome-unknown" }
      },
    }
    const client = createSfPeopleClient(transport)
    const controller = new AbortController()
    const base = { id: "m1", version: 0, values: { name: "Alice", cls: "Talent" } } as const
    const result = await client["domain.command.CAP08.save"](base, {
      signal: controller.signal, idempotencyKey: "stable-people-intent",
    })
    expect(result).toEqual({ kind: "transport-error", reason: "outcome-unknown" })
    expect(calls).toEqual([{
      operationId: "domain.command.CAP08.save",
      input: base,
      key: "stable-people-intent",
    }])
    const rejected = await client["domain.command.CAP08.save"]({
      ...base, values: { ...base.values, privatePayload: "blocked" },
    } as typeof base, { signal: controller.signal, idempotencyKey: "different-intent" })
    expect(rejected).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(calls).toHaveLength(1)
  })
})
