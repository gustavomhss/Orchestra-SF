import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createPlannerCatalogHost } from "../../../product/planner/catalog-host.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"

test("catalog UI preview and apply use exact human intent and the real currency rules", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-catalog-host-"))
  const persistence = await openLocalStore(directory)
  try {
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }]
      snapshot.data.versions = [{ id: "v1", year: 2027, closed: 0, lines: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: undefined }
    })
    const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "finance", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "command", createId: randomUUID, now: () => Date.parse("2026-11-13T00:00:00Z"), privateCommands: ["sf-human:planner.preview", "sf-human:planner.apply"] })
    const host: DomainPortHost = { persistence, authenticate: async (request, context) => request.headers.get("authorization") === "finance" ? resolve("finance", [...context!.roleMap], (group) => group === "finance-group") : null, environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "eur", directory: [] }), requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context) }
    const service = createPlannerCatalogHost({ host, humanAuthorize: async (context, action, payload) => context.kind === "ui" && ui.matchesIntent(context, `sf-human:${action}`, digestSfValue(payload)) && await ui.revalidate(context) })
    const request = { action: "fx-save" as const, versionId: "v1", id: "", revision: 0, currency: "EUR", rate: "1,25" }
    const admit = async (action: "planner.preview" | "planner.apply") => {
      const operation = `sf-human:${action}`
      const granted = await ui.admit(new Request("https://example.test", { method: "POST", headers: { authorization: "finance" } }), operation, digestSfValue(request))
      if (granted.status !== "ok" || !await ui.validate(granted.value, operation, digestSfValue(request))) throw new Error("UI admission failed")
      return granted.value
    }
    const before = await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const preview = await admit("planner.preview")
    expect(await service.preview(request, preview)).toMatchObject({ status: "ok", value: { outcome: { ok: true }, preview: { fx: { rates: [{ currency: "EUR", rate: 1.25 }] } } } })
    expect(await service.apply(request, preview)).toMatchObject({ status: "denied" })
    expect(await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
    const apply = await admit("planner.apply")
    expect(await service.apply(request, apply)).toMatchObject({ status: "ok", value: { outcome: { ok: true }, catalogs: { fx: { rates: [{ currency: "EUR", rate: 1.25 }] } } } })
  } finally { await persistence.dispose(); await rm(directory, { recursive: true, force: true }) }
})
