import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createPlannerMonthlyHost } from "../../../product/planner/monthly-host.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"

test("monthly annual, spread and reset previews preserve manual months and domain rounding", async () => {
  const fixture = await monthlyFixture()
  try {
    const annual = { page: "OPEX" as const, versionId: "v1", operation: { rowId: "line", revision: 0, kind: "annual" as const, annual: 1520 } }
    const context = await fixture.admit("planner.preview", annual)
    const preview = await fixture.monthly.preview(annual, context)
    expect(preview.status).toBe("ok")
    if (preview.status !== "ok") return
    expect(preview.value.operation).not.toHaveProperty("command")
    expect(preview.value.operation?.after[0]).toMatchObject({ month: 1, value: 200, manual: true })
    expect(preview.value.operation?.after.slice(1).map((month) => month.value)).toEqual(Array(11).fill(120))
    const applyContext = await fixture.admit("planner.apply", annual)
    const applied = await fixture.monthly.apply(annual, applyContext)
    expect(applied.status).toBe("ok")
    const spread = { ...annual, operation: { rowId: "line", revision: 1, kind: "spread" as const } }
    const spreadPreview = await fixture.monthly.preview(spread, await fixture.admit("planner.preview", spread))
    expect(spreadPreview.status).toBe("ok")
    const reset = { ...annual, operation: { rowId: "line", revision: 1, kind: "reset" as const } }
    const resetPreview = await fixture.monthly.preview(reset, await fixture.admit("planner.preview", reset))
    expect(resetPreview.status).toBe("ok")
    if (resetPreview.status === "ok") expect(resetPreview.value.operation?.after.every((month) => !month.manual)).toBe(true)
  } finally { await fixture.dispose() }
})

test("monthly entity operations use closed actions and per-record CAS", async () => {
  const fixture = await monthlyFixture()
  try {
    const createLine = { page: "OPEX" as const, versionId: "v1", entity: { collection: "lines" as const, kind: "create" as const, revision: 0, values: { name: "New line", el: "services", cur: "USD", annual: 120 } } }
    const created = await fixture.monthly.apply(createLine, await fixture.admit("planner.apply", createLine))
    expect(created.status).toBe("ok")
    if (created.status !== "ok") return
    expect(created.value.rows).toEqual([])
    const line = rows(object(rows(created.value.view.data.versions)[0]?.summary).lines).find((entry) => entry.name === "New line")
    expect(line).toBeDefined()
    const createProject = { page: "CAPEX" as const, versionId: "v1", entity: { collection: "projects" as const, kind: "create" as const, revision: 0, values: { name: "Project", code: "CPX-2027-9" } } }
    expect((await fixture.monthly.apply(createProject, await fixture.admit("planner.apply", createProject))).status).toBe("ok")
    const conflict = { page: "OPEX" as const, versionId: "v1", entity: { collection: "lines" as const, kind: "edit" as const, id: "line", revision: 999, values: { desc: "local draft" } } }
    const conflicted = await fixture.monthly.apply(conflict, await fixture.admit("planner.apply", conflict))
    expect(conflicted).toMatchObject({ status: "ok", value: { entityResult: { ok: false, status: 409 } } })
    const forged = { ...conflict, command: { action: "delete" } }
    expect(await fixture.monthly.apply(forged, await fixture.admit("planner.apply", forged))).toMatchObject({ status: "needs-input" })
  } finally { await fixture.dispose() }
})

for (const role of ["viewer", "owner"] as const) test(`monthly ${role} response retains permitted HR aggregates and excludes private rates, individual costs and migrated Talent fields`, async () => {
  const fixture = await monthlyFixture(role)
  try {
    const request = { page: "OPEX" as const, versionId: "v1", drafts: [{ rowId: "line", revision: 0, cells: [{ measure: "forecast" as const, month: 1, text: "42" }] }] }
    const preview = await fixture.monthly.preview(request, await fixture.admit("planner.preview", request))
    expect(preview.status).toBe("ok")
    if (preview.status !== "ok") return
    const version = rows(preview.value.view.data.versions)[0]
    expect(rows(object(version.summary).lines).find((line) => line.id === "HR:IT")).toMatchObject({ synthetic: true, cur: "USD" })
    expect(preview.value.before!.rows.some((line) => line.id === "HR:IT")).toBe(true)
    expect(JSON.stringify(preview.value.view)).not.toContain("salary-secret")
    expect(JSON.stringify(preview.value.view)).not.toContain('"rateId"')
    expect(JSON.stringify(preview.value.view)).not.toContain('"rateOverride"')
    for (const marker of ["private-talent-review", "private-personnel-outlook", "private-migrated-position", "private-nested-talent"]) expect(JSON.stringify(preview.value)).not.toContain(marker)
    for (const position of [...rows(object(version.hc).positions), ...rows(object(version.summary).positions)]) {
      expect(position).toMatchObject({ id: "person", name: "Person", domain: "IT", include: true, fte: 1 })
      for (const field of ["talentReview", "outlook", "privateMigration", "annual", "months", "total", "budget"]) expect(position).not.toHaveProperty(field)
    }
    expect(rows(object(version.hc).rates)).toEqual([])
    expect(preview.value.view.data.roster).toEqual([])
  } finally { await fixture.dispose() }
})

test("monthly settings preserve finance closed-through on locked plans and reject structural changes", async () => {
  const fixture = await monthlyFixture("finance")
  try {
    await fixture.persistence.transaction("planner", async (snapshot) => {
      const version = (snapshot.data.versions as { locked: boolean }[])[0]
      version.locked = true
      return { commit: true, value: undefined }
    })
    const closed = { page: "OPEX" as const, versionId: "v1", setting: { kind: "closed-through" as const, revision: 0, closed: 3 } }
    const preview = await fixture.monthly.preview(closed, await fixture.admit("planner.preview", closed))
    expect(preview).toMatchObject({ status: "ok", value: { settingResult: { ok: true } } })
    const unchanged = await fixture.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: (snapshot.data.versions as { closed: number }[])[0].closed }))
    expect(unchanged).toBe(0)
    expect(await fixture.monthly.apply(closed, await fixture.admit("planner.apply", closed))).toMatchObject({ status: "ok", value: { settingResult: { ok: true } } })
    expect(await fixture.monthly.apply(closed, await fixture.admit("planner.apply", closed))).toMatchObject({ status: "ok", value: { settingResult: { ok: false, status: 409 } } })
    const structural = { page: "OPEX" as const, versionId: "v1", setting: { kind: "breakdown" as const, revision: 0, element: "licenses", split: true } }
    expect(await fixture.monthly.apply(structural, await fixture.admit("planner.apply", structural))).toMatchObject({ status: "ok", value: { settingResult: { ok: false, status: 403 } } })
  } finally { await fixture.dispose() }
})

test("parallel independent rows survive and one stale row does not discard valid or invalid local drafts", async () => {
  const fixture = await monthlyFixture()
  try {
    await fixture.persistence.transaction("planner", async (snapshot) => {
      const version = (snapshot.data.versions as { lines: unknown[] }[])[0]
      version.lines.push({ id: "other", sec: "opex", el: "licenses", cur: "USD", annual: 1200, b: Array(12).fill(100), f: [] })
      return { commit: true, value: undefined }
    })
    const input = (rowId: string, text: string) => ({ page: "OPEX" as const, versionId: "v1", drafts: [{ rowId, revision: 0, cells: [{ measure: "forecast" as const, month: 1, text }] }] })
    const first = input("line", "42")
    const second = input("other", "70")
    const contexts = await Promise.all([fixture.admit("planner.apply", first), fixture.admit("planner.apply", second)])
    const applied = await Promise.all([fixture.monthly.apply(first, contexts[0]), fixture.monthly.apply(second, contexts[1])])
    expect(applied.every((result) => result.status === "ok" && result.value.rows[0].result?.ok)).toBe(true)
    const batch = { page: "OPEX" as const, versionId: "v1", drafts: [
      { rowId: "line", revision: 0, cells: [{ measure: "forecast" as const, month: 2, text: "99" }] },
      { rowId: "other", revision: 1, cells: [{ measure: "forecast" as const, month: 2, text: "0" }] },
      { rowId: "other", revision: 2, cells: [{ measure: "forecast" as const, month: 13, text: "bad" }] },
    ] }
    const result = await fixture.monthly.apply(batch, await fixture.admit("planner.apply", batch))
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.value.rows[0]).toMatchObject({ draft: { cells: [{ text: "99" }] }, result: { ok: false, status: 409, stored: { f: [42, null, null, null, null, null, null, null, null, null, null, null] } } })
    expect(result.value.rows[1].result).toMatchObject({ ok: true })
    expect(result.value.rows[2]).toMatchObject({ draft: { cells: [{ text: "bad" }] }, errors: [{ reason: "invalid-month" }] })
    const after = await fixture.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: (snapshot.data.versions as { lines: { id: string; f: (number | null)[] }[] }[])[0].lines }))
    expect(after.find((line) => line.id === "line")!.f.slice(0, 2)).toEqual([42, null])
    expect(after.find((line) => line.id === "other")!.f.slice(0, 2)).toEqual([70, 0])
  } finally { await fixture.dispose() }
})

async function monthlyFixture(role: "admin" | "viewer" | "owner" | "finance" = "admin") {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-planner-operations-"))
  const persistence = await openLocalStore(directory)
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "planner", role, entra: "planner-group", version: 1, by: "admin" }]
    snapshot.data.versions = [{ id: "v1", year: 2027, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", annual: 1300, b: [200, ...Array(11).fill(100)], bm: [true, ...Array(11).fill(false)], f: [] }], fx: [], hc: { positions: [{ id: "person", name: "Person", type: "Employee", location: "Brazil", domain: "IT", include: true, fte: 1, start: 1, end: 12, rateId: "private-rate", rateOverride: 987654, talentReview: "private-talent-review", outlook: "private-personnel-outlook", privateMigration: "private-migrated-position" }], rates: [{ id: "private-rate", name: "salary-secret", locs: "Brazil", annual: 120000, cur: "USD" }], hrAF: {}, migrated: { talentReview: "private-nested-talent" } }, projects: [], lists: {} }]
    return { commit: true, value: undefined }
  })
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "planner-user", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "monthly-op", createId: randomUUID, now: () => Date.parse("2026-11-13T00:00:00Z"), privateCommands: ["sf-human:planner.preview", "sf-human:planner.apply"] })
  const host: DomainPortHost = { persistence, authenticate: async (request, context) => { const principal = request.headers.get("authorization"); return principal ? resolve(principal, [...context!.roleMap], (group) => principal === "planner-user" && group === "planner-group") : null }, environment: async () => ({ at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }), requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context) }
  const monthly = createPlannerMonthlyHost({ host, humanAuthorize: async (context, action, payload) => context.kind === "ui" && ui.matchesIntent(context, `sf-human:${action}`, digestSfValue(payload)) && await ui.revalidate(context) })
  return {
    monthly,
    persistence,
    admit: async (action: "planner.preview" | "planner.apply", payload: unknown) => {
      const digest = digestSfValue(payload)
      const admitted = await ui.admit(new Request("https://example.test", { method: "POST", headers: { authorization: "planner-user" } }), `sf-human:${action}`, digest)
      if (admitted.status !== "ok" || !await ui.validate(admitted.value, `sf-human:${action}`, digest)) throw new Error("UI admission failed")
      return admitted.value
    },
    dispose: async () => { await persistence.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}
