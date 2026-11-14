import { expect, test } from "bun:test"
import { domain, render } from "../../../runtime/planner.ts"
import type { Actor, Snapshot } from "../../../runtime/contract.ts"
import { plannerCatalogs, plannerCurrencyComposition, previewPlannerCatalog } from "../../../product/planner/catalogs.ts"

const admin = { id: "admin", roles: ["admin"], canWrite: true }
const environment = { at: "2026-11-13T00:00:00Z", id: () => "generated", directory: [] }
function fixture(): Snapshot {
  return { data: { versions: [{ id: "v1", name: "Selected plan", year: 2027, closed: 0, locked: false, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "EUR", b: [100] }], fx: [{ id: "eur", cur: "EUR", rate: 1.2 }], hc: { positions: [], rates: [], hrAF: {} } }, { id: "v2", name: "Other plan", year: 2028, closed: 0, lines: [], fx: [], hc: { positions: [], rates: [], hrAF: { Finance: { entity: "entity", alloc: "allocation", a: [50], f: [60] } } } }], entities: [{ id: "entity", name: "Example entity", code: "EX" }], allocations: [{ id: "allocation", name: "By headcount", desc: "Classification only" }], officials: {} }, versions: {}, sequences: {}, audit: [], notices: [] }
}

test("catalog scope, original currency, missing rates and normalized identities remain explicit", () => {
  const snapshot = fixture()
  const before = structuredClone(snapshot)
  expect(plannerCurrencyComposition(snapshot, admin, environment, "v1", 100, " eur ")).toEqual({ amount: 100, currency: "EUR", rate: 1.2, usd: 120, legacyUsd: 120, missingRate: false })
  expect(plannerCurrencyComposition(snapshot, admin, environment, "v2", 100, "EUR")).toMatchObject({ usd: null, legacyUsd: 0, missingRate: true })
  expect(plannerCurrencyComposition(snapshot, admin, environment, "v1", 100, "invalid")).toBeUndefined()
  expect(plannerCatalogs(snapshot, admin, environment, "v1")).toMatchObject({ fx: { scope: "version", versionId: "v1" }, shared: { scope: "shared", allocations: [{ classificationOnly: true }] } })
  const mismatch = previewPlannerCatalog(snapshot, admin, environment, "v1", { page: "FX rates", action: "save", id: "eur", version: 0, values: { versionId: "v2", cur: "EUR", rate: 2 } })
  expect(mismatch).toBeUndefined()
  const duplicate = previewPlannerCatalog(snapshot, admin, environment, "v1", { page: "Entities & allocations", action: "save", version: 0, values: { collection: "entities", name: "  Example ENTITY  " } })
  expect(duplicate?.result).toMatchObject({ ok: false, status: 422 })
  for (const [collection, id] of [["entities", "entity"], ["allocations", "allocation"]]) expect(previewPlannerCatalog(snapshot, admin, environment, "v1", { page: "Entities & allocations", action: "delete", id, version: 0, values: { collection } })?.result).toMatchObject({ ok: false, status: 422, errors: ["Record is in use"] })
  expect(snapshot).toEqual(before)
})

test("USD and in-use FX are protected, comma rates retain six decimal places", () => {
  const snapshot = fixture()
  const run = (id: string, action: string, values: Record<string, unknown>, revision = 0) => domain.execute(snapshot, admin, { page: "FX rates", action, id, version: revision, values: { versionId: "v1", ...values } }, environment)
  expect(run("usd", "save", { cur: "USD", rate: 2 })).toMatchObject({ ok: false, status: 422 })
  expect(run("eur", "delete", {})).toMatchObject({ ok: false, status: 422 })
  expect(run("eur", "save", { cur: "EUR", rate: "1,2345678" })).toMatchObject({ ok: true })
  expect(plannerCatalogs(snapshot, admin, environment, "v1")?.fx.rates[0]?.rate).toBe(1.234568)
})

test("subquantum FX preserves the pinned manual and workbook boundaries while marking the converted amount unavailable", () => {
  const snapshot = fixture()
  const before = structuredClone(snapshot)
  const command = { page: "FX rates", action: "save", id: "eur", version: 0, values: { versionId: "v1", cur: "EUR", rate: "0,0000001" } }
  const preview = previewPlannerCatalog(snapshot, admin, environment, "v1", command)
  expect(preview?.result.ok).toBe(true)
  expect(preview?.after?.fx.rates[0]?.rate).toBe(0)
  expect(snapshot).toEqual(before)
  expect(domain.execute(snapshot, admin, command, environment).ok).toBe(true)
  expect(plannerCurrencyComposition(snapshot, admin, environment, "v1", 100, "EUR")).toEqual({ amount: 100, currency: "EUR", rate: 0, usd: null, legacyUsd: 0, missingRate: true })
  const rounded = structuredClone(snapshot)
  expect(domain.execute(snapshot, admin, { ...command, version: 1, values: { ...command.values, rate: "0" } }, environment)).toMatchObject({ ok: false, status: 422 })
  expect(snapshot).toEqual(rounded)
  expect(domain.execute(snapshot, admin, { ...command, version: 1, values: { ...command.values, rate: "0,0000005" } }, environment).ok).toBe(true)
  expect(plannerCurrencyComposition(snapshot, admin, environment, "v1", 100, "EUR")).toMatchObject({ rate: 0.000001, missingRate: false })
  const workbook = fixture()
  const workbookBefore = structuredClone(workbook)
  expect(domain.execute(workbook, admin, { page: "Overview", action: "import-workbook", version: 0, values: { versionId: "v1", sheets: { "FX rates": [{ Currency: "EUR", "USD per 1 unit": 0.0000001 }] }, versions: structuredClone(workbook.versions) } }, environment)).toMatchObject({ ok: false, status: 422, errors: ["FX rate rounds to zero"] })
  expect(workbook).toEqual(workbookBefore)
})

test("catalog preview allocates unused identities without replacing a saved catalog row", () => {
  const snapshot = fixture()
  const version = (snapshot.data.versions as Record<string, unknown>[])[0]!
  version.fx = [{ id: "catalog-preview-0", cur: "EUR", rate: 1.2 }]
  snapshot.data.entities = [{ id: "catalog-preview-1", name: "Existing entity", code: "EX" }]
  const before = structuredClone(snapshot)
  const fx = previewPlannerCatalog(snapshot, admin, environment, "v1", { page: "FX rates", action: "save", version: 0, values: { versionId: "v1", cur: "GBP", rate: 1.3 } })
  expect(fx?.result.ok).toBe(true)
  expect(fx?.after?.fx.rates).toEqual([{ id: "catalog-preview-0", currency: "EUR", rate: 1.2, revision: 0 }, { id: "catalog-preview-2", currency: "GBP", rate: 1.3, revision: 1 }])
  const entity = previewPlannerCatalog(snapshot, admin, environment, "v1", { page: "Entities & allocations", action: "save", version: 0, values: { collection: "entities", name: "New entity", code: "NEW" } })
  expect(entity?.result.ok).toBe(true)
  expect(entity?.after?.shared.entities.map((row) => row.name)).toEqual(["Existing entity", "New entity"])
  expect(snapshot).toEqual(before)
})

test("runtime controls mirror admin catalogs and version authority, and explain FX scope and FTE denominator", () => {
  const snapshot = fixture()
  const html = (page: string, actor: Actor) => render(page, { ...domain.view(snapshot, actor, environment).data, version: "v1" }, { actor, year: 2027, month: 1, at: environment.at, versions: snapshot.versions })!
  for (const role of ["finance", "hr", "budget owner", "viewer"]) {
    const actor = { id: role, roles: [role], canWrite: role !== "viewer" }
    for (const page of ["Versions", "Entities & allocations"]) expect(html(page, actor)).not.toMatch(/<button type="submit">/)
  }
  expect(html("Versions", admin)).toMatch(/<button type="submit">/)
  const fxWrites = [...html("FX rates", { id: "hr", roles: ["hr"], canWrite: true }).matchAll(/<form data-command="(?:save|delete)"[\s\S]*?<\/form>/g)].map(([form]) => form)
  expect(fxWrites.length).toBeGreaterThan(0)
  for (const form of fxWrites) expect(form).not.toContain('<button type="submit">')
  expect(html("FX rates", { id: "finance", roles: ["finance"], canWrite: true })).toContain("These rates belong to this version")
  expect(html("Entities & allocations", admin)).toContain("Shared catalogs")
  expect(html("Entities & allocations", admin)).toContain("does not distribute costs")
  expect(html("Headcount", admin)).toContain("Annual HR budget per planned December FTE")
  expect(html("Headcount", admin)).not.toContain("Average cost per FTE")
})

test("monthly and headcount controls use the same field authority as saved commands", () => {
  const snapshot = fixture()
  const version = (snapshot.data.versions as Record<string, unknown>[])[0]!
  version.locked = true
  const line = (version.lines as Record<string, unknown>[])[0]!
  line.owner = { id: "owner", name: "Owner" }
  const html = (page: string, role: string, id = role) => render(page, { ...domain.view(snapshot, { id, roles: [role], canWrite: true }, environment).data, version: "v1" }, { actor: { id, roles: [role], canWrite: true }, year: 2027, month: 1, at: environment.at, versions: snapshot.versions })!
  const editable = (output: string, field: string) => [...output.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].some(([form]) => form.includes(`name="${field}"`) && form.includes('<button type="submit">'))
  expect(editable(html("OPEX", "finance"), "a0")).toBe(true)
  expect(editable(html("OPEX", "finance"), "f0")).toBe(true)
  expect(editable(html("OPEX", "finance"), "b0")).toBe(false)
  expect(editable(html("OPEX", "finance"), "closed")).toBe(true)
  expect(editable(html("OPEX", "finance"), "split")).toBe(false)
  expect(editable(html("OPEX", "budget owner", "owner"), "f0")).toBe(true)
  expect(editable(html("OPEX", "budget owner", "stranger"), "f0")).toBe(false)
  expect(editable(html("OPEX", "budget owner", "owner"), "a0")).toBe(false)
  expect(editable(html("Headcount", "hr"), "inc")).toBe(false)
  version.locked = false
  expect(editable(html("Headcount", "hr"), "inc")).toBe(true)
  expect(editable(html("Headcount", "finance"), "inc")).toBe(false)
})

test("the mounted budget comparison states its measure and rejects a different fiscal year", () => {
  const snapshot = fixture()
  const html = render("Overview", { ...domain.view(snapshot, admin, environment).data, version: "v1", filter: "v2" }, { actor: admin, year: 2027, month: 1, at: environment.at, versions: snapshot.versions })!
  expect(html).toContain("Budget comparison uses FY 2027 in USD")
  expect(html).toContain("outlook changes and variance to the official budget are separate measures")
  expect(html).toContain("The comparison plan is unavailable or uses a different fiscal year")
  const compare = [...html.matchAll(/<form method="get"[\s\S]*?<\/form>/g)].map(([form]) => form).find((form) => form.includes('name="filter"'))!
  expect(compare).not.toContain('value="v2"')
})
