import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence, sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardSourceIssuer, createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { classifyDashboardConfirmationChange, createDashboardConfirmationObserver } from "../../../product/dashboard/confirmation.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const january = { start: "2026-01-01", end: "2026-01-31" }
const annual = { start: "2026-01-01", end: "2026-12-31" }
const at = "2026-11-13T00:00:00Z"
const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext

test("C06 observes exact dashboard data, distinguishes dependency changes, and fences current authority", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-dashboard-confirmation-"))
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }, { surface: "dashboard", role: "viewer", entra: "viewers", version: 1, by: "admin" }]; snapshot.data.summaries = ["Budget Overview", "OPEX Detail"]; snapshot.data.opexOwners = [{ id: "o", budget: 1200, name: "private owner name" }]; snapshot.data.opexEntries = [{ id: "jan", ownerId: "o", year: 2026, month: 1, budget: 200, actual: 0, forecast: 0 }, { id: "feb", ownerId: "o", year: 2026, month: 2, actual: 10 }]; return { commit: true, value: undefined } })
    const session = { request: new Request("https://example.test", { headers: { authorization: "admin" } }) }
    const host: DomainPortHost = { persistence, authenticate: async (request, context) => ["admin", "reviewer", "reader"].includes(request.headers.get("authorization") ?? "") ? resolve(request.headers.get("authorization")!, [...context!.roleMap], (group) => request.headers.get("authorization") === "reader" ? group === "viewers" : group === "admins") : null, environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => session.request, revalidate: async () => persistence.transaction("dashboard", async () => ({ commit: false, value: true })) }
    const issue = createDashboardSourceIssuer({ host, scopedSources: persistence })
    const page = await issue({ page: "Budget Overview", fields: ["budgetSeries"], period: january }, binding)
    const dependency = await createDashboardRecordSourceIssuer({ host, scopedSources: persistence })({ page: "OPEX Detail", recordType: "opexOwners", recordId: "o", fields: ["budget"], period: annual }, binding)
    expect(page.status).toBe("ok")
    expect(dependency).toBeDefined()
    if (page.status !== "ok" || !dependency) return
    const ref = page.value.evidence.target
    const scope = { sourceRef: { surface: "dashboard" as const, type: ref.recordType, id: ref.recordId, incarnation: ref.incarnation }, fields: ["budgetSeries"], period: january, materialDependencies: [dependency.source], scopeDefinitionVersion: "dashboard-c06-v1" }
    const dashboard = createDashboardPort({ host, sources: createDashboardSourceHost({ host, scopedSources: persistence }) })
    const observer = createDashboardConfirmationObserver({ host, scopedSources: persistence, readProjection: (selection, context) => dashboard.read({ selectionRef: selection.reference, fields: selection.fields, period: selection.period }, context) })
    expect(observer.manifestFor(scope)).toMatchObject({ version: "dashboard-c06-v1", internal: expect.arrayContaining(["authorized-budget-lines", "selected-month-entries"]) })
    expect(observer.manifestFor({ ...scope, fields: ["executive"] })).toBeUndefined()
    expect(observer.manifestFor({ ...scope, scopeDefinitionVersion: "unknown" })).toBeUndefined()
    expect(observer.manifestFor({ ...scope, materialDependencies: [{ ...dependency.source, surface: "planner" }] })).toBeUndefined()
    const initial = await observer.observe(scope, binding)
    expect(initial.state).toBe("available")
    if (initial.state !== "available") return
    const physical = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "dashboard-page", "Budget Overview") }))
    expect(initial.incarnation).not.toBe(physical?.incarnation)
    const reviewer = { ...binding, binding: { ...binding.binding, principalRef: "reviewer" } } as unknown as TrustedDomainContext
    session.request = new Request("https://example.test", { headers: { authorization: "reviewer" } })
    const independent = await observer.observe(scope, reviewer)
    expect(independent.state).toBe("available")
    if (independent.state !== "available") return
    expect(independent.scopeFingerprint).toBe(initial.scopeFingerprint)
    expect(independent.evidence.target.incarnation).not.toBe(initial.evidence.target.incarnation)
    expect(independent.incarnation).not.toBe(initial.incarnation)
    expect(independent.physicalIncarnation).toBe(initial.physicalIncarnation)
    expect(independent.physicalIncarnation).toBe(physical!.incarnation)
    expect(JSON.stringify(independent.evidence)).not.toContain(physical!.incarnation)
    expect(JSON.stringify(independent.projection)).not.toContain(physical!.incarnation)
    expect(await persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(scope, independent, reviewer) }))).toBe(true)
    const reader = { ...binding, binding: { ...binding.binding, principalRef: "reader" } } as unknown as TrustedDomainContext
    session.request = new Request("https://example.test", { headers: { authorization: "reader" } })
    const readOnly = await observer.observe(scope, reader)
    expect(readOnly.state).toBe("available")
    if (readOnly.state === "available") {
      expect(readOnly.scopeFingerprint).toBe(initial.scopeFingerprint)
      expect(readOnly.incarnation).not.toBe(initial.incarnation)
    }
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.summaries = ["Budget Overview"]; return { commit: true, value: undefined } })
    const restricted = await observer.observe(scope, reader)
    expect(restricted.state).toBe("dependency-unavailable")
    expect(JSON.stringify(restricted)).not.toContain(physical!.incarnation)
    if (readOnly.state === "available") expect(await persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(scope, readOnly, reader) }))).toBe(false)
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.summaries = ["Budget Overview", "OPEX Detail"]; return { commit: true, value: undefined } })
    session.request = new Request("https://example.test", { headers: { authorization: "admin" } })
    expect(JSON.stringify(initial.projection)).not.toContain("private owner name")
    expect(JSON.stringify(initial.projection)).not.toContain("privateDependencyDigest")
    expect(await persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(scope, initial, binding) }))).toBe(true)
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.opexEntries as { actual: number }[])[1]!.actual = 99; return { commit: true, value: undefined } })
    const february = await observer.observe(scope, binding)
    expect(february.state).toBe("available")
    if (february.state !== "available") return
    expect(february.scopeFingerprint).toBe(initial.scopeFingerprint)
    expect(classifyDashboardConfirmationChange(february, initial)).toBe("unchanged-scope")
    expect(await persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(scope, initial, binding) }))).toBe(true)
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.opexOwners as { budget: number }[])[0]!.budget = 2400; return { commit: true, value: undefined } })
    const changedDependency = await observer.observe(scope, binding)
    expect(changedDependency.state).toBe("available")
    if (changedDependency.state !== "available") return
    expect(changedDependency.sourceFingerprint).toBe(initial.sourceFingerprint)
    expect(changedDependency.dependencyFingerprint).not.toBe(initial.dependencyFingerprint)
    expect(classifyDashboardConfirmationChange(changedDependency, initial)).toBe("dependency-change")
    expect(await persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(scope, initial, binding) }))).toBe(false)
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.opexEntries as { actual: number }[])[0]!.actual = 1; return { commit: true, value: undefined } })
    const changedSource = await observer.observe(scope, binding)
    expect(changedSource.state).toBe("available")
    if (changedSource.state === "available") {
      expect(changedSource.sourceFingerprint).not.toBe(changedDependency.sourceFingerprint)
      expect(classifyDashboardConfirmationChange(changedSource, changedDependency)).toBe("material-change")
    }
    if (changedSource.state === "available") {
      session.request = new Request("https://example.test", { headers: { authorization: "reader" } })
      await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "viewer", entra: "viewers", version: 1, by: "admin" }]; return { commit: true, value: undefined } })
      const originalActorRevoked = await observer.observe(scope, reader)
      expect(originalActorRevoked.state).toBe("available")
      if (originalActorRevoked.state === "available") expect(originalActorRevoked.scopeFingerprint).toBe(changedSource.scopeFingerprint)
      await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }, { surface: "dashboard", role: "viewer", entra: "viewers", version: 1, by: "admin" }]; return { commit: true, value: undefined } })
    }
    session.request = new Request("https://example.test", { headers: { authorization: "other" } })
    expect(await observer.observe(scope, binding)).toEqual({ state: "access-unavailable", sourceVersion: 0 })
    expect(await persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(scope, initial, binding) }))).toBe(false)
    session.request = new Request("https://example.test", { headers: { authorization: "admin" } })
    await persistence.transaction("dashboard", async (snapshot) => { const previous = structuredClone(snapshot.data); snapshot.audit.push({ record: "dataset", who: "admin", at, was: previous, became: structuredClone(snapshot.data) }); return { commit: true, value: undefined } })
    const replaced = await observer.observe(scope, binding)
    expect(replaced.state).not.toBe("available")
    expect(await persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(scope, initial, binding) }))).toBe(false)
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
