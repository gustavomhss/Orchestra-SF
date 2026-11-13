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

test("monthly UI authority previews and commits only valid current domain rows", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-planner-monthly-"))
  const persistence = await openLocalStore(directory)
  try {
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }]
      snapshot.data.versions = [{ id: "v1", year: 2027, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), f: [] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: undefined }
    })
    const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "finance", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "command", createId: randomUUID, now: () => Date.parse("2026-11-13T00:00:00Z"), privateCommands: ["sf-human:planner.preview", "sf-human:planner.apply"] })
    const access = { planner: true }
    const host: DomainPortHost = { persistence, authenticate: async (request, context) => { const principal = request.headers.get("authorization"); return principal ? resolve(principal, [...context!.roleMap], (group) => access.planner && principal === "finance" && group === "finance-group") : null }, environment: async () => ({ at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }), requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context) }
    const monthly = createPlannerMonthlyHost({ host, humanAuthorize: async (context, action, payload) => context.kind === "ui" && ui.matchesIntent(context, `sf-human:${action}`, digestSfValue(payload)) && await ui.revalidate(context) })
    const request = { page: "OPEX" as const, versionId: "v1", drafts: [{ rowId: "line", revision: 0, cells: [{ measure: "forecast" as const, month: 1, text: "42" }] }, { rowId: "line", revision: 0, cells: [{ measure: "forecast" as const, month: 2, text: "99" }] }, { rowId: "line", revision: 0, cells: [{ measure: "forecast" as const, month: 3, text: "bad" }] }] }
    const admit = async (action: "planner.preview" | "planner.apply") => {
      const operation = `sf-human:${action}`
      const admitted = await ui.admit(new Request("https://example.test", { method: "POST", headers: { authorization: "finance" } }), operation, digestSfValue(request))
      if (admitted.status !== "ok" || !await ui.validate(admitted.value, operation, digestSfValue(request))) throw new Error("UI admission failed")
      return admitted.value
    }
    const before = await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const missingRow = { ...request, drafts: [{ rowId: "not-a-line", revision: 0, cells: [{ measure: "forecast" as const, month: 1, text: "50" }] }] }
    const previewContext = await admit("planner.preview")
    const forged = { ...request, actor: "forged" }
    expect(await monthly.preview(forged, previewContext)).toMatchObject({ status: "needs-input", reason: "invalid-monthly-request" })
    const preview = await monthly.preview(request, previewContext)
    expect(preview.status).toBe("ok")
    if (preview.status === "ok") {
      expect(preview.value.rows[0].result).toMatchObject({ ok: true })
      expect(preview.value.rows[1].result).toMatchObject({ ok: false, status: 409 })
      expect(preview.value.rows[2].errors[0].reason).toBe("invalid-number")
      expect(preview.value.rows[0]).not.toHaveProperty("command")
    }
    expect(await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
    expect(await monthly.apply(request, previewContext)).toMatchObject({ status: "denied" })
    access.planner = false
    expect(await monthly.preview(request, previewContext)).toMatchObject({ status: "denied" })
    access.planner = true
    const missingDigest = digestSfValue(missingRow)
    const missingContext = await ui.admit(new Request("https://example.test", { method: "POST", headers: { authorization: "finance" } }), "sf-human:planner.apply", missingDigest)
    if (missingContext.status !== "ok" || !await ui.validate(missingContext.value, "sf-human:planner.apply", missingDigest)) throw new Error("UI admission failed")
    const missing = await monthly.apply(missingRow, missingContext.value)
    expect(missing).toMatchObject({ status: "ok", value: { rows: [{ errors: [{ reason: "row-unavailable" }] }] } })
    expect(await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
    const applyContext = await admit("planner.apply")
    const applied = await monthly.apply(request, applyContext)
    expect(applied.status).toBe("ok")
    if (applied.status === "ok") {
      expect(applied.value.rows[0].result).toMatchObject({ ok: true })
      expect(applied.value.rows[1].result).toMatchObject({ ok: false, status: 409 })
      expect(applied.value.rows[2].draft.cells[0].text).toBe("bad")
    }
    const after = await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))
    expect((after.data.versions as { lines: { f: (number | null)[] }[] }[])[0]!.lines[0]!.f.slice(0, 3)).toEqual([42, null, null])
    ui.finish(applyContext)
    expect(await monthly.apply(request, applyContext)).toMatchObject({ status: "denied" })
  } finally { await persistence.dispose(); await rm(directory, { recursive: true, force: true }) }
})
