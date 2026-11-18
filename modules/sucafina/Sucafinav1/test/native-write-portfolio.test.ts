import { expect, test } from "bun:test"
import { object, rows } from "../runtime/contract.ts"
import type { Command } from "../runtime/contract.ts"
import { empty } from "./fixture/persistence.ts"
import { nativeWriteFlow } from "./fixture/native-write.ts"

const people = [
  { token: "admin", id: "admin-id", name: "Synthetic Admin", roles: [{ surface: "dashboard", role: "admin" }] },
  { token: "leader", id: "leader-id", name: "Synthetic Leader", roles: [{ surface: "dashboard", role: "domain leader" }] },
  { token: "other", id: "other-id", name: "Synthetic Other", roles: [{ surface: "dashboard", role: "domain leader" }] },
  { token: "readonly", id: "readonly-id", name: "Synthetic Readonly", roles: [{ surface: "dashboard", role: "admin" }], canWrite: false },
] as const

function setup(data: Record<string, unknown>) {
  return nativeWriteFlow({ people, initial: { dashboard: { ...empty(), data } } })
}

async function send(app: ReturnType<typeof setup>, command: Command, token: string, status: number) {
  const response = await app.command("dashboard", command, token)
  expect(response?.status).toBe(status)
  const body = object(await response!.json())
  expect(body.ok).toBe(status === 200)
  return body
}

async function read(app: ReturnType<typeof setup>, page: string, token = "admin") {
  const response = await app.read("dashboard", page, token)
  expect(response?.status).toBe(200)
  return object(await response!.json())
}

test("project and milestone writes share CAS and preserve independent CAPEX", async () => {
  const app = setup({
    projects: [{ id: "p", name: "Project", milestones: [], custom: "retained" }],
    capexProjects: [{ id: "p", budget: 50 }],
  })
  const milestone = { page: "All Projects", action: "save-milestone", id: "p", version: 0, values: { name: "Launch", status: "upcoming", date: "2027-01-01" } }
  await send(app, milestone, "admin", 200)
  const first = await read(app, "All Projects")
  expect(rows(object(first.data).projects)).toMatchObject([{ id: "p", milestones: [{ id: "fixture-generated-1", name: "Launch", status: "upcoming" }] }])
  expect(object(first.versions)["projects:p"]).toEqual({ version: 1, by: "admin-id" })
  const before = structuredClone(app.storage.state.dashboard)
  await send(app, milestone, "admin", 409)
  expect(app.storage.state.dashboard).toEqual(before)
  await send(app, { page: "All Projects", action: "save", id: "p", version: 1, values: { name: "Renamed", budget: 12 } }, "admin", 200)
  const page = await read(app, "All Projects")
  expect(rows(object(page.data).projects)).toMatchObject([{ id: "p", name: "Renamed", budget: 12, milestones: [{ name: "Launch" }] }])
  expect(object(page.versions)["projects:p"]).toEqual({ version: 2, by: "admin-id" })
  expect(app.storage.state.dashboard.data.projects).toMatchObject([{ custom: "retained" }])
  expect(app.storage.state.dashboard.data.capexProjects).toEqual([{ id: "p", budget: 50 }])
  expect(app.storage.state.dashboard.audit.map((entry) => entry.record)).toEqual(["projects:p", "projects:p"])
})

test("domain leader edits own risk but cannot forge ownership of another", async () => {
  const app = setup({ risks: [
    { id: "own", name: "Own", responsible: "Synthetic Leader", impact: 2, probability: 2 },
    { id: "other", name: "Other", responsible: "Synthetic Other", impact: 3, probability: 3 },
  ] })
  const initial = await read(app, "IT Risks", "leader")
  expect(object(initial.data).editableRisks).toEqual(["own"])
  await send(app, { page: "IT Risks", action: "save", id: "own", version: 0, values: { name: "Changed", impact: 6 } }, "leader", 200)
  const page = await read(app, "IT Risks", "leader")
  expect(rows(object(page.data).risks)).toMatchObject([{ id: "own", name: "Changed", impact: 6 }, { id: "other", name: "Other" }])
  expect(object(page.versions)["risks:own"]).toEqual({ version: 1, by: "leader-id" })
  const before = structuredClone(app.storage.state.dashboard)
  await send(app, { page: "IT Risks", action: "save", id: "other", version: 0, values: { name: "Forged", responsible: "Synthetic Leader", ownerId: "leader-id", leaderId: "leader-id" } }, "leader", 403)
  await send(app, { page: "IT Risks", action: "save", id: "own", version: 1, values: { responsible: "Synthetic Other" } }, "leader", 403)
  expect(app.storage.state.dashboard).toEqual(before)
  expect(app.storage.state.dashboard.audit.map((entry) => entry.record)).toEqual(["risks:own"])
})

test("contract original fields survive an update and stale CAS rolls back", async () => {
  const app = setup({ contracts: [{ id: "c", vendor: "Vendor", num: "C1", renewal: "2027-01-01", docs: [{ id: "asset", name: "Terms.pdf" }], original: "retained" }] })
  const command = { page: "Vendor Contracts", action: "save", id: "c", version: 0, values: { amount: "", amtType: "monthly", renewType: "auto", eval: "B" } }
  await send(app, command, "admin", 200)
  const page = await read(app, "Vendor Contracts")
  expect(rows(object(page.data).contracts)).toMatchObject([{ id: "c", num: "C1", renewal: "2027-01-01", amount: 0, amtType: "monthly", renewType: "auto", eval: "B", docs: [{ id: "asset", name: "Terms.pdf" }] }])
  expect(object(page.versions)["contracts:c"]).toEqual({ version: 1, by: "admin-id" })
  expect(app.storage.state.dashboard.data.contracts).toMatchObject([{ original: "retained" }])
  const before = structuredClone(app.storage.state.dashboard)
  await send(app, { ...command, values: { amount: 99 } }, "admin", 409)
  expect(app.storage.state.dashboard).toEqual(before)
  expect(app.storage.state.dashboard.audit.map((entry) => entry.record)).toEqual(["contracts:c"])
})

test("stakeholder explicit action priority survives write and warns without owner", async () => {
  const app = setup({ stakeholders: [] })
  const command = { page: "Stakeholder Management", action: "save", version: 0, values: { name: "Stakeholder", biz: 5, iti: 5, perc: 0, priority: "action" } }
  const denied = structuredClone(app.storage.state.dashboard)
  await send(app, command, "leader", 403)
  expect(app.storage.state.dashboard).toEqual(denied)
  const result = await send(app, command, "admin", 200)
  expect(result.warnings).toEqual(["Action plan requires an owner."])
  const page = await read(app, "Stakeholder Management")
  expect(rows(object(page.data).stakeholders)).toMatchObject([{ id: "fixture-generated-1", name: "Stakeholder", biz: 5, iti: 5, perc: 0, priority: "action" }])
  expect(object(page.versions)["stakeholders:fixture-generated-1"]).toEqual({ version: 1, by: "admin-id" })
  expect(app.storage.state.dashboard.audit.map((entry) => entry.record)).toEqual(["stakeholders:fixture-generated-1"])
})

test("performance over-allocation requires confirmation and stale writes are atomic", async () => {
  const app = setup({ itperf: { original: "retained" } })
  const command = { page: "IT Performance Contract", action: "save", version: 0, values: { items: [{ id: "i", name: "Delivery", totalWeight: 0.8, subs: [{ label: "Project", score: 4, totalWeight: 0.5, ownerWeight: 0.6, co1Weight: 0, co2Weight: 0, status: "on" }] }] } }
  const before = structuredClone(app.storage.state.dashboard)
  await send(app, command, "leader", 403)
  await send(app, command, "readonly", 403)
  const rejected = await send(app, command, "admin", 422)
  expect(rejected.errors).toEqual(["Confirm owner and co-owner weights exceeding the total before saving."])
  expect(app.storage.state.dashboard).toEqual(before)
  const accepted = await send(app, { ...command, confirmed: true }, "admin", 200)
  expect(accepted.warnings).toEqual(["Item weights do not total 100%.", "Sub-item weights differ from the weight of Delivery."])
  const page = await read(app, "IT Performance Contract")
  expect(object(object(page.data).itperf)).toMatchObject({ items: [{ name: "Delivery", totalWeight: 0.8, subs: [{ label: "Project", score: 4, totalWeight: 0.5, ownerWeight: 0.6 }] }] })
  expect(object(page.versions).itperf).toEqual({ version: 1, by: "admin-id" })
  expect(object(app.storage.state.dashboard.data.itperf).original).toBe("retained")
  const after = structuredClone(app.storage.state.dashboard)
  await send(app, { ...command, confirmed: true }, "admin", 409)
  expect(app.storage.state.dashboard).toEqual(after)
  expect(app.storage.state.dashboard.audit.map((entry) => entry.record)).toEqual(["itperf"])
})
