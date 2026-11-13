import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
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

test("monthly entity operations use closed actions, CAS and never expose HR data", async () => {
  const fixture = await monthlyFixture()
  try {
    const createLine = { page: "OPEX" as const, versionId: "v1", entity: { collection: "lines" as const, kind: "create" as const, revision: 0, values: { name: "New line", el: "services", cur: "USD", annual: 120 } } }
    const created = await fixture.monthly.apply(createLine, await fixture.admit("planner.apply", createLine))
    expect(created.status).toBe("ok")
    if (created.status !== "ok") return
    expect(created.value.rows).toEqual([])
    const line = created.value.view.data.versions && (created.value.view.data.versions as { summary: { lines: { id: string; name: string }[] }[] })[0]?.summary.lines.find((entry) => entry.name === "New line")
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

test("monthly viewer response excludes HR values", async () => {
  const fixture = await monthlyFixture("viewer")
  try {
    const request = { page: "OPEX" as const, versionId: "v1", drafts: [{ rowId: "line", revision: 0, cells: [{ measure: "forecast" as const, month: 1, text: "42" }] }] }
    const preview = await fixture.monthly.preview(request, await fixture.admit("planner.preview", request))
    expect(preview.status).toBe("ok")
    if (preview.status !== "ok") return
    expect(JSON.stringify(preview.value.view)).not.toContain("HR:")
    expect(JSON.stringify(preview.value.view)).not.toContain("salary-secret")
    expect(preview.value.view.data.roster).toEqual([])
  } finally { await fixture.dispose() }
})

async function monthlyFixture(role: "admin" | "viewer" = "admin") {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-planner-operations-"))
  const persistence = await openLocalStore(directory)
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "planner", role, entra: "planner-group", version: 1, by: "admin" }]
    snapshot.data.versions = [{ id: "v1", year: 2027, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", annual: 1300, b: [200, ...Array(11).fill(100)], bm: [true, ...Array(11).fill(false)], f: [] }, { id: "HR:secret", sec: "opex", synthetic: true, name: "salary-secret", annual: 999999 }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
    return { commit: true, value: undefined }
  })
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "planner-user", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "monthly-op", createId: randomUUID, now: () => Date.parse("2026-11-13T00:00:00Z"), privateCommands: ["sf-human:planner.preview", "sf-human:planner.apply"] })
  const host: DomainPortHost = { persistence, authenticate: async (request, context) => { const principal = request.headers.get("authorization"); return principal ? resolve(principal, [...context!.roleMap], (group) => principal === "planner-user" && group === "planner-group") : null }, environment: async () => ({ at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }), requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context) }
  const monthly = createPlannerMonthlyHost({ host, humanAuthorize: async (context, action, payload) => context.kind === "ui" && ui.matchesIntent(context, `sf-human:${action}`, digestSfValue(payload)) && await ui.revalidate(context) })
  return {
    monthly,
    admit: async (action: "planner.preview" | "planner.apply", payload: unknown) => {
      const digest = digestSfValue(payload)
      const admitted = await ui.admit(new Request("https://example.test", { method: "POST", headers: { authorization: "planner-user" } }), `sf-human:${action}`, digest)
      if (admitted.status !== "ok" || !await ui.validate(admitted.value, `sf-human:${action}`, digest)) throw new Error("UI admission failed")
      return admitted.value
    },
    dispose: async () => { await persistence.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}
