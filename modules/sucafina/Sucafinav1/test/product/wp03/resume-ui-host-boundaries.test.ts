import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createPlannerCatalogHost } from "../../../product/planner/catalog-host.ts"
import type { CatalogRequest } from "../../../product/planner/catalog-host.ts"
import { createPlannerHeadcountHost } from "../../../product/planner/headcount-host.ts"
import type { HeadcountRequest } from "../../../product/planner/headcount-host.ts"
import { createPlannerMonthlyHost } from "../../../product/planner/monthly-host.ts"

for (const collection of ["lines", "projects"] as const) test(`monthly ${collection} previews reserve no live IDs and cannot replace a live or deleted identity`, async () => {
  const fixture = await hostFixture()
  try {
    const request = { page: collection === "projects" ? "CAPEX" as const : "OPEX" as const, versionId: "v1", entity: { collection, kind: "create" as const, revision: 0, values: collection === "projects" ? { name: "New project" } : { name: "New line", el: "services", cur: "USD", annual: 120 } } }
    const before = await fixture.snapshot()
    const first = await fixture.monthly.preview(request, await fixture.admit("planner.preview", request))
    const repeated = await fixture.monthly.preview(request, await fixture.admit("planner.preview", request))
    expect(first).toMatchObject({ status: "ok", value: { entityResult: { ok: true } } })
    expect(repeated).toEqual(first)
    expect(fixture.generated).toEqual([])
    expect(await fixture.snapshot()).toEqual(before)
    if (first.status !== "ok") throw new Error("Expected a successful domain preview")
    const version = rows(first.value.view.data.versions)[0]!
    const created = (collection === "projects" ? rows(version.projects) : rows(object(version.summary).lines)).find((entry) => entry.name === (collection === "projects" ? "New project" : "New line"))
    expect(created?.id).toBe("planner-preview-2")
    const applied = await fixture.monthly.apply(request, await fixture.admit("planner.apply", request))
    expect(applied).toMatchObject({ status: "ok", value: { entityResult: { ok: true } } })
    expect(fixture.generated).toEqual(["committed-0"])
    const saved = rows((await fixture.snapshot()).data.versions)[0]!
    expect(rows(saved[collection]).find((entry) => entry.id === "committed-0")?.name).toBe(collection === "projects" ? "New project" : "New line")
  } finally { await fixture.dispose() }
})

const headcountCreates: readonly HeadcountRequest[] = [
  { action: "position-save", versionId: "v1", id: "", revision: 0, values: { name: "New hire", domain: "IT", type: "Employee", location: "Brazil", fte: 1, start: 1, end: 12 } },
  { action: "rate-save", versionId: "v1", id: "", revision: 0, values: { name: "Rate card", locs: "Brazil", annual: 120000, cur: "USD" } },
  { action: "sync", versionId: "v1", revision: 0 },
]

for (const revision of [0, 999]) test(`monthly egress revocation distinguishes a ${revision === 0 ? "committed" : "rejected"} write`, async () => {
  const fixture = await hostFixture()
  try {
    const request = { page: "OPEX" as const, versionId: "v1", drafts: [{ rowId: "planner-preview-0", revision, cells: [{ measure: "forecast" as const, month: 1, text: "42" }] }] }
    const context = await fixture.admit("planner.apply", request)
    const before = await fixture.snapshot()
    const revoked = { value: false }
    const revalidate = fixture.host.revalidate
    fixture.host.revalidate = async (authority) => !revoked.value && await revalidate(authority)
    fixture.host.persistence = {
      async transaction(surface, work, options) {
        const result = await fixture.persistence.transaction(surface, work, options)
        revoked.value = true
        return result
      },
    }
    expect(await fixture.monthly.apply(request, context)).toEqual(revision === 0
      ? { status: "unavailable", reason: "monthly-apply-outcome-requires-reconciliation" }
      : { status: "denied", reason: "monthly-authority-changed" })
    const after = await fixture.snapshot()
    if (revision !== 0) expect(after).toEqual(before)
    if (revision === 0) {
      const line = rows(rows(after.data.versions)[0]!.lines).find((entry) => entry.id === "planner-preview-0")!
      expect(line.f).toEqual([42, ...Array(11).fill(null)])
      expect(after.versions["v1:lines:planner-preview-0"]?.version).toBe(1)
    }
  } finally { await fixture.dispose() }
})

for (const request of headcountCreates) test(`headcount ${request.action} preview is repeatable without consuming the host ID allocator`, async () => {
  const fixture = await hostFixture()
  try {
    const before = await fixture.snapshot()
    const first = await fixture.headcount.preview(request, await fixture.admit("planner.preview", request))
    const repeated = await fixture.headcount.preview(request, await fixture.admit("planner.preview", request))
    expect(first).toMatchObject({ status: "ok", value: { result: { ok: true } } })
    expect(repeated).toEqual(first)
    expect(fixture.generated).toEqual([])
    expect(await fixture.snapshot()).toEqual(before)
    if (first.status !== "ok") throw new Error("Expected a successful domain preview")
    const created = request.action === "rate-save" ? first.value.headcount.rates : first.value.headcount.groups.flatMap((group) => group.positions)
    expect(created.map((entry) => object(entry).id)).toEqual(["planner-preview-2"])
    expect(await fixture.headcount.apply(request, await fixture.admit("planner.apply", request))).toMatchObject({ status: "ok", value: { result: { ok: true } } })
    expect(fixture.generated).toEqual(["committed-0"])
    const saved = object(rows((await fixture.snapshot()).data.versions)[0]!.hc)
    expect(rows(saved[request.action === "rate-save" ? "rates" : "positions"]).map((entry) => entry.id)).toEqual(["committed-0"])
  } finally { await fixture.dispose() }
})

test("catalog read reports unavailable when the host environment cannot be loaded", async () => {
  const fixture = await hostFixture()
  try {
    const context = await fixture.admit("planner.preview", { versionId: "v1" })
    fixture.host.environment = async () => { throw new Error("Environment offline") }
    expect(await fixture.catalog.read("v1", context)).toEqual({ status: "unavailable", reason: "catalog-environment-unavailable" })
  } finally { await fixture.dispose() }
})

for (const phase of ["admission", "egress"] as const) test(`catalog read fails closed when ${phase} revalidation rejects`, async () => {
  const fixture = await hostFixture()
  try {
    const context = await fixture.admit("planner.preview", { versionId: "v1" })
    const attempts = { count: 0 }
    fixture.host.revalidate = async () => {
      attempts.count++
      if (phase === "admission" || attempts.count > 1) throw new Error("Authority unavailable")
      return true
    }
    expect(await fixture.catalog.read("v1", context)).toEqual({ status: "denied", reason: "catalog-authority-unavailable" })
    expect(attempts.count).toBe(phase === "admission" ? 1 : 2)
  } finally { await fixture.dispose() }
})

const ambiguousCatalogRequests: readonly CatalogRequest[] = [
  { action: "fx-save", versionId: "v1", id: "duplicate-fx", revision: 0, currency: "EUR", rate: "1.5" },
  { action: "fx-delete", versionId: "v1", id: "duplicate-fx", revision: 0 },
  { action: "entity-save", versionId: "v1", id: "duplicate-entity", revision: 0, name: "Renamed", code: "REN" },
  { action: "entity-delete", versionId: "v1", id: "duplicate-entity", revision: 0 },
  { action: "allocation-save", versionId: "v1", id: "duplicate-allocation", revision: 0, name: "Renamed", description: "Retained classification" },
  { action: "allocation-delete", versionId: "v1", id: "duplicate-allocation", revision: 0 },
]

for (const request of ambiguousCatalogRequests) test(`catalog ${request.action} rejects an ambiguous identity without changing either record`, async () => {
  const fixture = await hostFixture()
  try {
    await fixture.persistence.transaction("planner", async (snapshot) => {
      rows(snapshot.data.versions)[0]!.fx = [{ id: "duplicate-fx", cur: "EUR", rate: 1.1 }, { id: "duplicate-fx", cur: "GBP", rate: 1.2 }]
      snapshot.data.entities = [{ id: "duplicate-entity", name: "First entity", code: "ONE" }, { id: "duplicate-entity", name: "Second entity", code: "TWO" }]
      snapshot.data.allocations = [{ id: "duplicate-allocation", name: "First allocation", desc: "One" }, { id: "duplicate-allocation", name: "Second allocation", desc: "Two" }]
      return { commit: true, value: undefined }
    })
    const before = await fixture.snapshot()
    expect(await fixture.catalog.preview(request, await fixture.admit("planner.preview", request))).toEqual({ status: "needs-input", reason: "catalog-target-unavailable" })
    expect(await fixture.catalog.apply(request, await fixture.admit("planner.apply", request))).toEqual({ status: "needs-input", reason: "catalog-target-unavailable" })
    expect(await fixture.snapshot()).toEqual(before)
  } finally { await fixture.dispose() }
})

async function hostFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-wp03-host-boundaries-"))
  const persistence = await openLocalStore(directory)
  const generated: string[] = []
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "planner", role: "admin", entra: "planner-group", version: 1, by: "admin" }]
    snapshot.data.roster = [{ name: "Roster hire", start: "2027-07-01", leader: "Lead", domain: "IT" }]
    snapshot.data.versions = [{ id: "v1", name: "Budget", year: 2027, closed: 0, lines: [{ id: "planner-preview-0", name: "Existing line", sec: "opex", el: "licenses", cur: "USD", annual: 1200, b: Array(12).fill(100) }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
    snapshot.versions["v1:positions:planner-preview-1"] = { version: 2, by: "prior-editor" }
    return { commit: true, value: undefined }
  })
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "planner-user", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "host-boundary-command", createId: randomUUID, now: () => Date.parse("2026-11-13T00:00:00Z"), privateCommands: ["sf-human:planner.preview", "sf-human:planner.apply"] })
  const host: DomainPortHost = {
    persistence,
    authenticate: async (request, context) => request.headers.get("authorization") === "planner-user" ? resolve("planner-user", [...context!.roleMap], (group) => group === "planner-group") : null,
    environment: async () => ({ at: "2026-11-13T00:00:00Z", directory: [], id: () => { const id = `committed-${generated.length}`; generated.push(id); return id } }),
    requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context),
  }
  const authorize = async (context: Parameters<typeof host.revalidate>[0], action: "planner.preview" | "planner.apply", payload: unknown) => context.kind === "ui" && ui.matchesIntent(context, `sf-human:${action}`, digestSfValue(payload)) && await ui.revalidate(context)
  return {
    host,
    persistence,
    generated,
    monthly: createPlannerMonthlyHost({ host, humanAuthorize: authorize }),
    headcount: createPlannerHeadcountHost({ host, humanAuthorize: authorize }),
    catalog: createPlannerCatalogHost({ host, humanAuthorize: authorize }),
    snapshot: () => persistence.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) })),
    admit: async (action: "planner.preview" | "planner.apply", payload: unknown) => {
      const operation = `sf-human:${action}`
      const digest = digestSfValue(payload)
      const admitted = await ui.admit(new Request("https://example.test", { method: "POST", headers: { authorization: "planner-user" } }), operation, digest)
      if (admitted.status !== "ok" || !await ui.validate(admitted.value, operation, digest)) throw new Error("UI admission failed")
      return admitted.value
    },
    dispose: async () => { await persistence.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}
