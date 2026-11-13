import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { resolve } from "../../../../src/identity.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector, projectSfSourceScope } from "../../../../product/integration/source-projections.ts"
import { createDashboardSourceIssuer, createDashboardRecordSourceIssuer } from "../../../../product/integration/dashboard-sources.ts"
import { createDashboardPort } from "../../../../product/dashboard/port.ts"
import { createDashboardSourceHost } from "../../../../product/dashboard/sources.ts"
import type { DomainPortHost } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"

const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
const period = { start: "2026-01-01", end: "2026-12-31" }

test("authenticated Request issues a scoped selector without exposing private revisions", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-dashboard-issuer-"))
  const store = await openLocalStore(directory)
  try {
    const clock = { at: "2026-11-13T12:00:00Z", projector: "2026-11-13T12:00:00Z" }
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => clock.projector) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.opexOwners = [{ id: "o", budget: 1200 }]; snapshot.data.opexEntries = []; return { commit: true, value: undefined } })
    const session = { request: new Request("https://example.test", { headers: { authorization: "admin" } }), active: true }
    const host: DomainPortHost = { persistence, authenticate: async (request, context) => { const id = request.headers.get("authorization"); return id ? resolve(id, [...context!.roleMap], (group) => id === "admin" && group === "admins") : null }, environment: async () => ({ at: clock.at, id: randomUUID, directory: [] }), requestFor: () => session.request, revalidate: async () => session.active }
    const issue = createDashboardSourceIssuer({ host, scopedSources: persistence })
    const sources = createDashboardSourceHost({ host, scopedSources: persistence })
    const selection = { page: "Budget Overview", fields: ["budgetMetrics"], period }
    const first = await issue(selection, binding)
    expect(first.status).toBe("ok")
    if (first.status !== "ok") return
    expect(first.value.selectionRef).toMatch(/^sf-source:/)
    expect(first.value.evidence.target.fields).toEqual(["budgetMetrics"])
    expect(await sources.resolveDashboardSource(first.value.selectionRef, binding, { fields: ["opexEntries"], period })).toMatchObject({ status: "denied" })
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.members = [{ id: "private", notes: "secret" }]; return { commit: true, value: undefined } })
    expect(await sources.resolveDashboardSource(first.value.selectionRef, binding, selection)).toMatchObject({ status: "ok" })
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "o", budget: 1300 }]; return { commit: true, value: undefined } })
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "o", budget: 1200 }]; return { commit: true, value: undefined } })
    expect(await sources.resolveDashboardSource(first.value.selectionRef, binding, selection)).toMatchObject({ status: "stale" })
    const second = await issue(selection, binding)
    expect(second.status).toBe("ok")
    if (second.status !== "ok") return
    expect(second.value.evidence.target.version).toBe(first.value.evidence.target.version + 2)
    const record = createDashboardRecordSourceIssuer({ host, scopedSources: persistence })
    expect(await record({ page: "OPEX Detail", recordType: "opexOwners", recordId: "o", fields: ["budget"], period }, binding)).toMatchObject({ source: { type: "opexOwners", id: "o", fields: ["budget"] } })
    expect(await record({ page: "OPEX Detail", recordType: "opexOwners", recordId: "o", fields: ["secret"], period }, binding)).toBeUndefined()
    const current = { page: "Executive Dashboard", fields: ["executive"], period }
    const dayOne = await issue(current, binding)
    expect(dayOne.status).toBe("ok")
    clock.projector = "2026-11-14T00:00:00Z"
    expect(await issue(current, binding)).toMatchObject({ status: "stale" })
    clock.at = clock.projector
    const dayTwo = await issue(current, binding)
    expect(dayTwo.status).toBe("ok")
    if (dayOne.status === "ok" && dayTwo.status === "ok") expect(dayTwo.value.evidence.target.version).toBeGreaterThan(dayOne.value.evidence.target.version)
    clock.at = "2026-11-13T23:30:00-03:00"
    clock.projector = "2026-11-14T02:30:00Z"
    const offset = await issue(current, binding)
    expect(offset.status).toBe("ok")
    if (offset.status === "ok") {
      const port = createDashboardPort({ host, sources })
      expect(await port.read({ selectionRef: offset.value.selectionRef, period, fields: ["executive"] }, binding)).toMatchObject({ status: "ok" })
    }
    session.request = new Request("https://example.test", { headers: { authorization: "other" } })
    expect(await sources.resolveDashboardSource(second.value.selectionRef, binding, selection)).toMatchObject({ status: "denied" })
    expect(await issue(selection, binding)).toMatchObject({ status: "denied" })
    session.request = new Request("https://example.test", { headers: { authorization: "admin" } })
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = []; return { commit: true, value: undefined } })
    expect(await sources.resolveDashboardSource(second.value.selectionRef, binding, selection)).toMatchObject({ status: "denied" })
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

test("dashboard record scope projects only granted fields on an authorized page", () => {
  const actor = { id: "admin", roles: ["admin"], canWrite: true, assigned: [], domains: [] }
  const state = { data: { roleMap: [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }], opexOwners: [{ id: "o", name: "Owner", budget: 1200 }, { id: "other", name: "Other", budget: 5 }], opexEntries: [] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const scope = { principalRef: "admin", accessRevision: "1", policyVersion: "1", recordType: "opexOwners", recordId: "o", selector: { page: "OPEX Detail", fields: ["budget"], period, actor, roleMapDigest: digestSfValue(roleMap(state, "dashboard")) } }
  expect(projectSfSourceScope("dashboard", state, scope, "2026-11-13T00:00:00Z")).toEqual({ budget: 1200 })
  expect(projectSfSourceScope("dashboard", state, { ...scope, selector: { ...scope.selector, period: { start: "2026-01-01", end: "2026-01-31" } } }, "2026-11-13T00:00:00Z")).toBeUndefined()
  const other = structuredClone(state)
  other.data.opexOwners[1]!.budget = 9
  expect(projectSfSourceScope("dashboard", other, scope, "2026-11-13T00:00:00Z")).toEqual({ budget: 1200 })
  expect(projectSfSourceScope("dashboard", state, { ...scope, recordId: "missing" }, "2026-11-13T00:00:00Z")).toBeUndefined()
  expect(projectSfSourceScope("dashboard", state, { ...scope, recordType: "budgetYtd", recordId: "__singleton__" }, "2026-11-13T00:00:00Z")).toBeUndefined()
  other.data.roleMap = []
  expect(projectSfSourceScope("dashboard", other, scope, "2026-11-13T00:00:00Z")).toBeUndefined()
})
