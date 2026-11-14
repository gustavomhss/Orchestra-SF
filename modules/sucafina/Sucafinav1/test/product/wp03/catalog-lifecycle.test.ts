import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import { domain } from "../../../runtime/planner.ts"
import { normName } from "../../../src/planner-accounts.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createPlannerCatalogHost } from "../../../product/planner/catalog-host.ts"
import type { CatalogRequest } from "../../../product/planner/catalog-host.ts"
import { createPlannerMonthlyHost } from "../../../product/planner/monthly-host.ts"
import { plannerAt, plannerFixture, plannerSnapshot } from "./planner-fixture.ts"

test("CAPEX refuses deleting a referenced project atomically and permits deletion after its last line is removed", async () => {
  const initial = plannerSnapshot()
  const version = rows(initial.data.versions)[1]!
  version.projects = [{ id: "project", name: "IT investment", code: "CPX-2027-001" }]
  version.lines = [...rows(version.lines), { id: "capital", name: "Server", sec: "capex", el: "hwo", cls: "capex", proj: "project", cur: "USD", annual: 1200, b: Array(12).fill(100), a: [], f: [] }]
  const fixture = await plannerFixture(initial)
  try {
    const monthly = createPlannerMonthlyHost({ host: fixture.host, humanAuthorize: async (context, action, payload) => context.kind === "ui" && fixture.ui.matchesIntent(context, `sf-human:${action}`, digestSfValue(payload)) && await fixture.ui.revalidate(context) })
    const removeProject = { page: "CAPEX" as const, versionId: "v1", entity: { collection: "projects" as const, kind: "delete" as const, id: "project", revision: 0 } }
    const before = await fixture.readSnapshot()
    expect(await monthly.preview(removeProject, await fixture.admit("sf-human:planner.preview", removeProject, "admin", true))).toMatchObject({ status: "ok", value: { entityResult: { ok: false, status: 422, errors: ["Project is in use"] } } })
    expect(await monthly.apply(removeProject, await fixture.admit("sf-human:planner.apply", removeProject, "admin", true))).toMatchObject({ status: "ok", value: { entityResult: { ok: false, status: 422, errors: ["Project is in use"] } } })
    expect(await fixture.readSnapshot()).toEqual(before)
    const removeLine = { ...removeProject, entity: { collection: "lines" as const, kind: "delete" as const, id: "capital", revision: 0 } }
    expect(await monthly.apply(removeLine, await fixture.admit("sf-human:planner.apply", removeLine, "admin", true))).toMatchObject({ status: "ok", value: { entityResult: { ok: true } } })
    expect(await monthly.apply(removeProject, await fixture.admit("sf-human:planner.apply", removeProject, "admin", true))).toMatchObject({ status: "ok", value: { entityResult: { ok: true } } })
    const changed = rows((await fixture.readSnapshot()).data.versions).find((item) => item.id === "v1")!
    expect(rows(changed.projects)).toEqual([])
    expect(rows(changed.lines).some((line) => line.id === "capital")).toBe(false)
    expect(rows(changed.lines).some((line) => line.id === "line")).toBe(true)
  } finally { await fixture.close() }
})

test("common allocations preserve existing identities, repeat without duplicates and never redistribute financial values", async () => {
  const initial = plannerSnapshot()
  initial.data.allocations = [{ id: "headcount", name: "  BY HEADCOUNT  ", desc: "Existing classification" }]
  const fixture = await plannerFixture(initial)
  try {
    const authorized = async (context: Parameters<typeof fixture.ui.revalidate>[0], action: "planner.preview" | "planner.apply", payload: unknown) => fixture.ui.matchesIntent(context, `sf-human:${action}`, digestSfValue(payload)) && await fixture.ui.revalidate(context)
    const catalogs = createPlannerCatalogHost({ host: fixture.host, humanAuthorize: async (context, action, payload) => context.kind === "ui" && await authorized(context, action, payload) })
    const monthly = createPlannerMonthlyHost({ host: fixture.host, humanAuthorize: async (context, action, payload) => context.kind === "ui" && await authorized(context, action, payload) })
    const common = { action: "allocation-common" as const, versionId: "v1", revision: 0 }
    const before = await fixture.readSnapshot()
    const originalMoney = rows(domain.view(before, { id: "admin", roles: ["admin"], canWrite: true }, { at: plannerAt, id: () => "unused", directory: [] }).data.versions).map((version) => {
      const summary = object(version.summary)
      return { id: version.id, budget: summary.budget, actual: summary.actual, outlook: summary.outlook, total: summary.total }
    })
    const otherSurfaces = await fixture.store.transactionAll!(async (snapshots) => ({ commit: false, value: { dashboard: structuredClone(snapshots.dashboard), procurement: structuredClone(snapshots.procurement) } }))
    expect(await catalogs.preview(common, await fixture.admit("sf-human:planner.preview", common, "admin", true))).toMatchObject({ status: "ok", value: { outcome: { ok: true }, preview: { shared: { allocations: expect.arrayContaining([expect.objectContaining({ id: "headcount", classificationOnly: true })]) } } } })
    expect(await fixture.readSnapshot()).toEqual(before)
    expect(await catalogs.apply(common, await fixture.admit("sf-human:planner.apply", common, "admin", true))).toMatchObject({ status: "ok", value: { outcome: { ok: true } } })
    const first = await fixture.readSnapshot()
    expect(rows(first.data.allocations)).toHaveLength(6)
    expect(rows(first.data.allocations).find((entry) => entry.id === "headcount")).toEqual({ id: "headcount", name: "  BY HEADCOUNT  ", desc: "Existing classification" })
    const repeat = { ...common, revision: 1 }
    expect(await catalogs.apply(repeat, await fixture.admit("sf-human:planner.apply", repeat, "admin", true))).toMatchObject({ status: "ok", value: { outcome: { ok: true } } })
    const repeated = await fixture.readSnapshot()
    expect(repeated.data.allocations).toEqual(first.data.allocations)
    expect(new Set(rows(repeated.data.allocations).map((entry) => normName(String(entry.name)))).size).toBe(6)
    expect(repeated.data.versions).toEqual(before.data.versions)
    expect(await catalogs.apply(common, await fixture.admit("sf-human:planner.apply", common, "admin", true))).toMatchObject({ status: "ok", value: { outcome: { ok: false, status: 409 } } })
    expect(await fixture.readSnapshot()).toEqual(repeated)
    const classify = { page: "OPEX" as const, versionId: "v1", entity: { collection: "lines" as const, kind: "edit" as const, id: "line", revision: 0, values: { alloc: "headcount" } } }
    expect(await monthly.apply(classify, await fixture.admit("sf-human:planner.apply", classify, "admin", true))).toMatchObject({ status: "ok", value: { entityResult: { ok: true } } })
    const after = await fixture.readSnapshot()
    const money = rows(domain.view(after, { id: "admin", roles: ["admin"], canWrite: true }, { at: plannerAt, id: () => "unused", directory: [] }).data.versions).map((version) => {
      const summary = object(version.summary)
      return { id: version.id, budget: summary.budget, actual: summary.actual, outlook: summary.outlook, total: summary.total }
    })
    expect(money).toEqual(originalMoney)
    expect(rows(rows(after.data.versions).find((version) => version.id === "v1")!.lines)[0]!.alloc).toBe("headcount")
    expect(await fixture.store.transactionAll!(async (snapshots) => ({ commit: false, value: { dashboard: snapshots.dashboard, procurement: snapshots.procurement } }))).toEqual(otherSurfaces)
  } finally { await fixture.close() }
})

test("unused FX, entities and allocations complete create, edit and delete with record revisions and their original scopes", async () => {
  const fixture = await plannerFixture()
  try {
    const catalogs = createPlannerCatalogHost({ host: fixture.host, humanAuthorize: async (context, action, payload) => context.kind === "ui" && fixture.ui.matchesIntent(context, `sf-human:${action}`, digestSfValue(payload)) && await fixture.ui.revalidate(context) })
    const apply = async (request: CatalogRequest) => {
      const result = await catalogs.apply(request, await fixture.admit("sf-human:planner.apply", request, "admin", true))
      expect(result).toMatchObject({ status: "ok", value: { outcome: { ok: true } } })
      if (result.status !== "ok" || !result.value.outcome.ok) throw new Error("Catalog operation failed")
      return result.value.catalogs
    }
    const createFx: CatalogRequest = { action: "fx-save", versionId: "v1", id: "", revision: 0, currency: "EUR", rate: "1,2" }
    const before = await fixture.readSnapshot()
    expect(await catalogs.preview(createFx, await fixture.admit("sf-human:planner.preview", createFx, "admin", true))).toMatchObject({ status: "ok", value: { outcome: { ok: true }, preview: { fx: { rates: [expect.objectContaining({ currency: "EUR", rate: 1.2, revision: 1 })] } } } })
    expect(await fixture.readSnapshot()).toEqual(before)
    const createdFx = (await apply(createFx)).fx.rates.find((rate) => rate.currency === "EUR")!
    expect(createdFx).toMatchObject({ rate: 1.2, revision: 1 })
    expect(createdFx.id).not.toBe("")
    expect((await apply({ ...createFx, id: createdFx.id, revision: 1, rate: "1,5" })).fx.rates).toEqual([{ ...createdFx, rate: 1.5, revision: 2 }])
    const otherVersion = await catalogs.read("v2", await fixture.admit("sf-human:planner.read", {}, "admin", true))
    expect(otherVersion).toMatchObject({ status: "ok", value: { fx: { scope: "version", versionId: "v2", rates: [] } } })
    expect((await apply({ action: "fx-delete", versionId: "v1", id: createdFx.id, revision: 2 })).fx.rates).toEqual([])

    const createEntity: CatalogRequest = { action: "entity-save", versionId: "v1", id: "", revision: 0, name: "Brazil Entity", code: "BR" }
    const createdEntity = (await apply(createEntity)).shared.entities.find((entry) => entry.code === "BR")!
    expect(createdEntity).toMatchObject({ name: "Brazil Entity", revision: 1 })
    const changedEntity = await apply({ ...createEntity, id: createdEntity.id, revision: 1, name: "LATAM Entity", code: "LAT" })
    expect(changedEntity.shared.entities).toEqual([{ ...createdEntity, name: "LATAM Entity", code: "LAT", revision: 2 }])

    const createAllocation: CatalogRequest = { action: "allocation-save", versionId: "v1", id: "", revision: 0, name: "Equal shares", description: "A label only" }
    const createdAllocation = (await apply(createAllocation)).shared.allocations.find((entry) => entry.name === "Equal shares")!
    expect(createdAllocation).toMatchObject({ description: "A label only", classificationOnly: true, revision: 1 })
    const changedAllocation = await apply({ ...createAllocation, id: createdAllocation.id, revision: 1, name: "Named shares", description: "No distribution is calculated" })
    expect(changedAllocation.shared.allocations).toEqual([{ ...createdAllocation, name: "Named shares", description: "No distribution is calculated", revision: 2 }])
    const sharedFromOfficial = await catalogs.read("v0", await fixture.admit("sf-human:planner.read", {}, "admin", true))
    expect(sharedFromOfficial).toMatchObject({ status: "ok", value: { shared: { scope: "shared", entities: changedEntity.shared.entities, allocations: changedAllocation.shared.allocations } } })

    expect((await apply({ action: "entity-delete", versionId: "v2", id: createdEntity.id, revision: 2 })).shared.entities).toEqual([])
    expect((await apply({ action: "allocation-delete", versionId: "v2", id: createdAllocation.id, revision: 2 })).shared.allocations).toEqual([])
    const after = await fixture.readSnapshot()
    expect(after.data.officials).toEqual(before.data.officials)
    for (const version of rows(after.data.versions)) {
      const original = rows(before.data.versions).find((entry) => entry.id === version.id)!
      expect(version.fx).toEqual(original.fx)
      expect(rows(version.lines).map((line) => ({ id: line.id, b: line.b, a: line.a, f: line.f }))).toEqual(rows(original.lines).map((line) => ({ id: line.id, b: line.b, a: line.a, f: line.f })))
    }
  } finally { await fixture.close() }
})
