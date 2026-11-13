import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createPlannerHeadcountHost } from "../../../product/planner/headcount-host.ts"
import type { HeadcountRequest } from "../../../product/planner/headcount-host.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import { projectHeadcount, prepareHrDomainActualForecast } from "../../../product/planner/headcount.ts"
import { domain } from "../../../runtime/planner.ts"

test("headcount preview and apply require exact human intent and preserve row revisions", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-headcount-host-"))
  const persistence = await openLocalStore(directory)
  try {
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "planner", role: "hr", entra: "hr-group", version: 1, by: "admin" }]
      snapshot.data.versions = [{ id: "v1", year: 2027, closed: 0, lines: [], fx: [], hc: { positions: [{ id: "p1", name: "Person", include: true, fte: 1, start: 1, end: 12, type: "Employee", location: "Brazil", domain: "IT" }], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: undefined }
    })
    const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "person", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "command", createId: randomUUID, now: () => Date.parse("2026-11-13T00:00:00Z"), privateCommands: ["sf-human:planner.preview", "sf-human:planner.apply"] })
    const host: DomainPortHost = { persistence, authenticate: async (request, context) => request.headers.get("authorization") === "person" ? resolve("person", [...context!.roleMap], (group) => group === "hr-group") : null, environment: async () => ({ at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }), requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context) }
    const service = createPlannerHeadcountHost({ host, humanAuthorize: async (context, action, payload) => context.kind === "ui" && ui.matchesIntent(context, `sf-human:${action}`, digestSfValue(payload)) && await ui.revalidate(context) })
    const request = { action: "position-save" as const, versionId: "v1", id: "p1", revision: 0, values: { fte: 0.5 } }
    const admit = async (action: "planner.preview" | "planner.apply") => {
      const operation = `sf-human:${action}`
      const granted = await ui.admit(new Request("https://example.test", { method: "POST", headers: { authorization: "person" } }), operation, digestSfValue(request))
      if (granted.status !== "ok" || !await ui.validate(granted.value, operation, digestSfValue(request))) throw new Error("UI admission failed")
      return granted.value
    }
    const before = await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const preview = await admit("planner.preview")
    const forged = { ...request, actor: "forged" }
    expect(await service.preview(forged, preview)).toMatchObject({ status: "needs-input" })
    expect(await service.preview({ action: "leader-domain", versionId: "v1", revision: 0, leader: null, domain: "IT" } as unknown as HeadcountRequest, preview)).toMatchObject({ status: "needs-input" })
    expect(await service.preview(request, preview)).toMatchObject({ status: "ok", value: { result: { ok: true }, headcount: { plannedDecemberFte: 0.5 } } })
    expect(await service.apply(request, preview)).toMatchObject({ status: "denied" })
    expect(await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
    const apply = await admit("planner.apply")
    expect(await service.apply(request, apply)).toMatchObject({ status: "ok", value: { result: { ok: true } } })
    expect(await service.apply(request, apply)).toMatchObject({ status: "ok", value: { result: { ok: false, status: 409 } } })
  } finally { await persistence.dispose(); await rm(directory, { recursive: true, force: true }) }
})

test("headcount domain cost follows rate, months and uplift while AF stays independent", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-headcount-cost-"))
  const persistence = await openLocalStore(directory)
  try {
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "planner", role: "hr", entra: "hr-group", version: 1, by: "admin" }]
      snapshot.data.versions = [{ id: "v1", year: 2027, closed: 0, lines: [], fx: [], projects: [], lists: {}, hc: { positions: [{ id: "p1", name: "Person", include: true, fte: 1, start: 7, end: 12, type: "Employee", location: "Brazil", domain: "IT", rateId: "r1" }], rates: [{ id: "r1", name: "Rate", locs: "Brazil", annual: 120000, cur: "USD" }], hrAF: {} } }]
      return { commit: true, value: undefined }
    })
    const environment = { at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }
    const hr = { id: "hr", roles: ["hr"], canWrite: true, assigned: [], domains: [] }
    const before = await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const snapshot = await persistence.transaction("planner", async (value) => ({ commit: false, value }))
    const base = projectHeadcount(snapshot, hr, environment, "v1")
    expect(base?.groups.find((group) => group.domain === "IT")?.monthlyOutlookUsd).toEqual([0, 0, 0, 0, 0, 0, 10000, 10000, 10000, 10000, 10000, 10000])
    expect(base?.plannedDecemberFte).toBe(1)
    const version = (snapshot.data.versions as { hc: { inc: number; incMonth: number } }[])[0]!
    version.hc.inc = 10
    version.hc.incMonth = 10
    const uplifted = projectHeadcount(snapshot, hr, environment, "v1")
    expect(uplifted?.groups.find((group) => group.domain === "IT")?.monthlyOutlookUsd?.slice(9)).toEqual([11000, 11000, 11000])
    const command = prepareHrDomainActualForecast("v1", "Finance", 0, { a0: 500, f1: 600 })!
    expect(domain.execute(snapshot, hr, command, environment).ok).toBe(true)
    const withHrAf = projectHeadcount(snapshot, hr, environment, "v1")
    expect(withHrAf?.groups.find((group) => group.domain === "Finance")?.monthlyOutlookUsd?.slice(0, 2)).toEqual([500, 600])
    expect(withHrAf?.groups.find((group) => group.domain === "IT")?.monthlyOutlookUsd?.slice(0, 2)).toEqual([0, 0])
    expect(await persistence.transaction("planner", async (value) => ({ commit: false, value }))).toEqual(before)
  } finally { await persistence.dispose(); await rm(directory, { recursive: true, force: true }) }
})
