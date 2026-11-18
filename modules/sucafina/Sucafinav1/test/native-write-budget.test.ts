import { expect, test } from "bun:test"
import { object, rows } from "../runtime/contract.ts"
import { empty } from "./fixture/persistence.ts"
import { nativeWriteFlow } from "./fixture/native-write.ts"

const at = "2026-03-15T12:00:00Z"
const admin = {
  token: "budget-admin",
  id: "fixture-budget-admin",
  name: "Synthetic Budget Admin",
  roles: [{ surface: "dashboard" as const, role: "admin" }],
}
const owner = {
  token: "budget-leader",
  id: "fixture-budget-leader",
  name: "Synthetic Budget Leader",
  roles: [{ surface: "dashboard" as const, role: "domain leader" }],
}

test("native dashboard HTTP saves OPEX and CAPEX owners with version and audit", async () => {
  const initial = empty()
  initial.data.opexOwners = [{ id: "opex-1", name: "Old OPEX", budget: 1200 }]
  initial.data.capexProjects = [{ id: "capex-1", name: "Old CAPEX", budget: 2400 }]
  const app = nativeWriteFlow({ people: [admin], initial: { dashboard: initial }, at })

  const opex = await app.command("dashboard", {
    page: "OPEX Detail", action: "save", id: "opex-1", version: 0,
    values: { name: "Synthetic OPEX", budget: 1800 },
  }, admin.token)
  const capex = await app.command("dashboard", {
    page: "CAPEX Projects", action: "save", id: "capex-1", version: 0,
    values: { name: "Synthetic CAPEX", budget: 3600 },
  }, admin.token)

  expect(opex?.status).toBe(200)
  expect(await opex?.json()).toEqual({ ok: true })
  expect(capex?.status).toBe(200)
  expect(await capex?.json()).toEqual({ ok: true })
  expect(rows(app.storage.state.dashboard.data.opexOwners)).toMatchObject([{ id: "opex-1", name: "Synthetic OPEX", budget: 1800 }])
  expect(rows(app.storage.state.dashboard.data.capexProjects)).toMatchObject([{ id: "capex-1", name: "Synthetic CAPEX", budget: 3600 }])
  expect(app.storage.state.dashboard.versions).toMatchObject({
    "opexOwners:opex-1": { version: 1, by: admin.id },
    "capexProjects:capex-1": { version: 1, by: admin.id },
  })
  expect(app.storage.state.dashboard.audit.map((entry) => entry.record)).toEqual([
    "opexOwners:opex-1", "capexProjects:capex-1",
  ])

  const opexRead = await app.read("dashboard", "OPEX Detail", admin.token)
  const capexRead = await app.read("dashboard", "CAPEX Projects", admin.token)
  expect(opexRead?.status).toBe(200)
  expect(capexRead?.status).toBe(200)
  const opexView = object(await opexRead?.json())
  const capexView = object(await capexRead?.json())
  expect(rows(object(opexView.data).opexOwners)).toMatchObject([{ id: "opex-1", name: "Synthetic OPEX", budget: 1800 }])
  expect(rows(object(capexView.data).capexProjects)).toMatchObject([{ id: "capex-1", name: "Synthetic CAPEX", budget: 3600 }])
  expect(object(opexView.versions)["opexOwners:opex-1"]).toEqual({ version: 1, by: admin.id })
  expect(object(capexView.versions)["capexProjects:capex-1"]).toEqual({ version: 1, by: admin.id })
})

test("native OPEX and CAPEX monthly entry commands persist explicit zero and amounts", async () => {
  const initial = empty()
  initial.data.opexOwners = [{ id: "o", name: "OPEX", budget: 1200 }]
  initial.data.capexProjects = [{ id: "p", name: "CAPEX", budget: 2400 }]
  const app = nativeWriteFlow({ people: [admin], initial: { dashboard: initial }, at })

  const opex = await app.command("dashboard", {
    page: "OPEX Detail", action: "save-entry", version: 0,
    values: { ownerId: "o", year: 2026, month: 2, budget: 0, actual: 70, forecast: 110 },
  }, admin.token)
  const capex = await app.command("dashboard", {
    page: "CAPEX Projects", action: "save-entry", version: 0,
    values: { projId: "p", year: 2026, month: 2, budget: 200, actual: 30, forecast: 40 },
  }, admin.token)

  expect(opex?.status).toBe(200)
  expect(capex?.status).toBe(200)
  expect(await opex?.json()).toEqual({ ok: true })
  expect(await capex?.json()).toEqual({ ok: true })
  expect(rows(app.storage.state.dashboard.data.opexEntries)).toEqual([
    { id: "fixture-generated-1", ownerId: "o", year: 2026, month: 2, budget: 0, actual: 70, forecast: 110 },
  ])
  expect(rows(app.storage.state.dashboard.data.capexEntries)).toEqual([
    { id: "fixture-generated-2", projId: "p", year: 2026, month: 2, budget: 200, actual: 30, forecast: 40 },
  ])
  expect(app.storage.state.dashboard.audit.map((entry) => entry.record)).toEqual([
    "opexEntries:fixture-generated-1", "capexEntries:fixture-generated-2",
  ])
})

test("native annual entry and year amount retain the runtime's monthly wire results", async () => {
  const initial = empty()
  initial.data.opexOwners = [{ id: "o", name: "OPEX", budget: 1200 }]
  initial.data.budgetCurrentMonth = { 2025: 4, 2026: 3 }
  initial.data.opexEntries = [{ id: "prior-year", ownerId: "o", year: 2025, month: 4, actual: 55, forecast: 66 }]
  initial.data.budgetYtd = { opex: { "2025:o": { amount: 500, months: 4, perMonth: 125, at: "2025-04-15T12:00:00Z" } } }
  const app = nativeWriteFlow({ people: [admin], initial: { dashboard: initial }, at })

  const annual = await app.command("dashboard", {
    page: "OPEX Detail", action: "annual-entry", id: "o", version: 0,
    values: { year: 2026, annual: 100000 },
  }, admin.token)
  expect(annual?.status).toBe(200)
  expect(await annual?.json()).toEqual({ ok: true })
  expect(rows(app.storage.state.dashboard.data.opexEntries)
    .filter((entry) => entry.year === 2026)
    .map((entry) => entry.budget)).toEqual(Array(12).fill(8333.33))
  expect(rows(app.storage.state.dashboard.data.opexEntries).find((entry) => entry.id === "prior-year")).toEqual({
    id: "prior-year", ownerId: "o", year: 2025, month: 4, actual: 55, forecast: 66,
  })

  const amount = await app.command("dashboard", {
    page: "OPEX Detail", action: "year-amount", id: "o", version: 0,
    values: {
      year: 2026,
      amount: 100,
      versions: Object.fromEntries(Object.entries(app.storage.state.dashboard.versions)
        .map(([key, value]) => [key, value.version])),
    },
  }, admin.token)
  expect(amount?.status).toBe(200)
  expect(await amount?.json()).toEqual({ ok: true })
  expect(rows(app.storage.state.dashboard.data.opexEntries)
    .filter((entry) => entry.year === 2026 && Number(entry.month) <= 4)
    .map((entry) => entry.actual)).toEqual([33.33, 33.33, 33.34, 0])
  expect(object(object(app.storage.state.dashboard.data.budgetYtd).opex)["2026:o"]).toMatchObject({
    amount: 100, months: 3, perMonth: 33.33, at,
  })
  expect(app.storage.state.dashboard.versions["budgetYtd"]?.version).toBe(1)
  const selectedYear = await app.read("dashboard", "OPEX Detail", admin.token, { year: "2026" })
  const selectedView = object(await selectedYear?.json())
  expect(selectedYear?.status).toBe(200)
  expect(selectedView.year).toBe(2026)
  expect(rows(object(selectedView.data).opexEntries)).toContainEqual(
    expect.objectContaining({ id: "prior-year", year: 2025, month: 4, actual: 55, forecast: 66 }),
  )
  expect(object(object(selectedView.data).budgetYtd).opex).toMatchObject({
    "2025:o": { amount: 500, months: 4, perMonth: 125 },
    "2026:o": { amount: 100, months: 3, perMonth: 33.33 },
  })
})

test("native domain leader requires a collection-qualified line grant and cannot redirect an entry", async () => {
  const initial = empty()
  initial.data.opexOwners = [{ id: "o1", name: "Granted", budget: 1200 }, { id: "o2", name: "Other", budget: 2400 }]
  initial.data.opexEntries = [{ id: "entry", ownerId: "o1", year: 2026, month: 1, budget: 100, actual: 7, forecast: 8 }]
  initial.data.budgetLineIds = { [owner.id]: ["opexOwners:o1"] }
  const app = nativeWriteFlow({
    people: [owner], initial: { dashboard: initial }, at,
  })
  const allowed = await app.command("dashboard", {
    page: "OPEX Detail", action: "save", id: "o1", version: 0,
    values: { name: "Granted updated", budget: 1300 },
  }, owner.token)
  expect(allowed?.status).toBe(200)
  expect(await allowed?.json()).toEqual({ ok: true })
  const afterAllowed = structuredClone(app.storage.state.dashboard)

  const crossParent = await app.command("dashboard", {
    page: "OPEX Detail", action: "save-entry", id: "entry", version: 0,
    values: { ownerId: "o2", year: 2026, month: 1, actual: 33 },
  }, owner.token)
  const otherOwner = await app.command("dashboard", {
    page: "OPEX Detail", action: "save", id: "o2", version: 0,
    values: { name: "forged", budget: 1 },
  }, owner.token)
  expect(crossParent?.status).toBe(422)
  expect(await crossParent?.json()).toMatchObject({ ok: false, status: 422 })
  expect(otherOwner?.status).toBe(403)
  expect(await otherOwner?.json()).toMatchObject({ ok: false, status: 403 })
  expect(app.storage.state.dashboard).toEqual(afterAllowed)
})

test("native stale month CAS rejects a year amount with full snapshot rollback", async () => {
  const initial = empty()
  initial.data.opexOwners = [{ id: "o", name: "OPEX", budget: 1200 }]
  initial.data.opexEntries = [{ id: "existing", ownerId: "o", year: 2026, month: 3, actual: 500 }]
  initial.versions["opexEntries:existing"] = { version: 9, by: "fixture-other-writer" }
  const app = nativeWriteFlow({ people: [admin], initial: { dashboard: initial }, at })
  const before = structuredClone(app.storage.state.dashboard)

  const response = await app.command("dashboard", {
    page: "OPEX Detail", action: "year-amount", id: "o", version: 0,
    values: { year: 2026, amount: 100 },
  }, admin.token)

  expect(response?.status).toBe(409)
  expect(await response?.json()).toMatchObject({ ok: false, status: 409, by: "fixture-other-writer", stored: { actual: 500 } })
  expect(app.storage.state.dashboard).toEqual(before)
})
