import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import { createSfDashboardContinuityProof, createSfDashboardSourceAccess } from "../../../product/decision-memory/source-access.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

const binding = (id: string): TrustedDomainContext => ({ kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: id, requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as TrustedUiLease })
const selection = { page: "Budget Overview", fields: ["budgetMetrics"], period: { start: "2026-01-01", end: "2026-12-31" } }

test("current request reauthorizes another principal's source after the store is reopened without exposing private identity", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-source-access-"))
  let store = await openLocalStore(directory, { lockTimeoutMs: 500 })
  try {
    const clock = "2026-11-13T12:00:00Z"
    const wrap = () => createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => clock) })
    const persistence = wrap()
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.opexOwners = [{ id: "o", budget: 1200 }]; snapshot.data.opexEntries = []; return { commit: true, value: undefined } })
    const session = { id: "alice", active: true }
    const host: DomainPortHost = { persistence, authenticate: async (request, context) => { const id = request.headers.get("authorization"); return id ? resolve(id, [...context!.roleMap], (group) => session.active && group === "admins") : null }, environment: async () => ({ at: clock, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test", { headers: { authorization: session.id } }), revalidate: async () => session.active && await store.transaction("dashboard", async () => ({ commit: false, value: true })) }
    const first = await createDashboardSourceIssuer({ host, scopedSources: persistence })(selection, binding("alice"))
    expect(first.status).toBe("ok")
    if (first.status !== "ok") return
    session.id = "bob"
    await store.dispose()
    store = await openLocalStore(directory, { lockTimeoutMs: 500 })
    const afterRestart = wrap()
    const currentHost = { ...host, persistence: afterRestart }
    const issue = createDashboardSourceIssuer({ host: currentHost, scopedSources: afterRestart })
    const sources = createDashboardSourceHost({ host: currentHost, scopedSources: afterRestart })
    const dashboard = createDashboardPort({ host: currentHost, sources })
    const access = createSfDashboardSourceAccess({ host: currentHost, issue, dashboard })
    const result = await access(first.value.evidence, binding("bob"))
    expect(result.state).toBe("fresh")
    expect(result.currentRef?.kind).toBe("record")
    if (result.currentRef?.kind === "record") expect(result.currentRef.target.incarnation).not.toBe(first.value.evidence.target.incarnation)
    expect(JSON.stringify(result)).not.toContain("sourceIncarnation")
    if (!result.currentRef) return
    // This fixture stands in for the protected Atlas reader; AM05 must exercise the real reader.
    const proof = createSfDashboardContinuityProof({ host: currentHost, issue, dashboard: createDashboardPort({ host: currentHost, sources }), readOriginal: async (digest) => digest === first.value.evidence.refDigest ? first.value.evidence : undefined })
    expect(await proof(first.value.evidence, result.currentRef, binding("bob"))).toBe(true)
    const forged = { ...first.value.evidence, refId: "forged" }
    expect(await proof({ ...forged, refDigest: digestSfEvidenceRef(forged) }, result.currentRef, binding("bob"))).toBe(false)
    if (result.currentRef.kind === "record") {
      const wider = { ...result.currentRef, target: { ...result.currentRef.target, fields: ["budgetMetrics", "members"] } }
      expect(await proof(first.value.evidence, { ...wider, refDigest: digestSfEvidenceRef(wider) }, binding("bob"))).toBe(false)
    }
    session.active = false
    expect(await proof(first.value.evidence, result.currentRef, binding("bob"))).toBe(false)
    expect((await access(first.value.evidence, binding("bob"))).state).toBe("unavailable")
    session.active = true
    const raceAccess = createSfDashboardSourceAccess({ host: currentHost, issue, dashboard: { read: async (selection, call) => { const observed = await dashboard.read(selection, call); session.active = false; return observed } } })
    expect((await raceAccess(first.value.evidence, binding("bob"))).state).toBe("unavailable")
    session.active = true
    await afterRestart.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "o", budget: 1300 }]; return { commit: true, value: undefined } })
    expect((await access(first.value.evidence, binding("bob"))).state).toBe("unavailable")
    expect(await proof(first.value.evidence, result.currentRef, binding("bob"))).toBe(false)
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
