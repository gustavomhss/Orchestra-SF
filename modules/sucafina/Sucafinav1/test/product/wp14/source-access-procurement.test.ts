import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { projectSfProcurementScope } from "../../../product/integration/procurement-projections.ts"
import { createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { createSfProcurementSourceAccess } from "../../../product/decision-memory/source-access.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

const call: TrustedDomainContext = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "alice", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as TrustedUiLease }
const period = { start: "2026-01-01", end: "2026-12-31" }

test("Procurement evidence is read through current source and domain ports", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-procurement-evidence-"))
  const store = await openLocalStore(directory, { lockTimeoutMs: 500 })
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: projectSfProcurementScope })
    await persistence.initializeSources("procurement")
    await persistence.transaction("procurement", async (snapshot) => { snapshot.data.roleMap = [{ surface: "procurement", role: "requester", entra: "requesters", version: 1, by: "admin" }]; snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", status: "draft", createdBy: "alice", pr: { title: "Owned", estAmount: 100 } }, version: 1, by: "alice" } }, settings: { currency: "USD" }, suppliers: [] }; return { commit: true, value: undefined } })
    const session = { active: true }
    const host: DomainPortHost = { persistence, requestFor: () => new Request("https://example.test", { headers: { authorization: "alice" } }), revalidate: async () => session.active && await store.transaction("procurement", async () => ({ commit: false, value: true })), environment: async () => ({ at: "2026-11-13T12:00:00Z", id: randomUUID, directory: [] }), authenticate: async (request, context) => { const id = request.headers.get("authorization"); return id ? resolve(id, [...context!.roleMap], (group) => session.active && group === "requesters") : null } }
    const resolver = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor: async () => ({ status: "ok", value: { installationId: "i", projectId: "p", principalRef: "alice", accessRevision: "1", policyVersion: "1", surface: "procurement", period, currency: "USD", sourceRefs: [], capabilities: [] } }) })
    const port = createProcurementPort({ ...host, resolveRequestSource: resolver.resolve, resolveSupplierSource: resolver.resolve, isCurrentRequestSource: resolver.isCurrent, isCurrentSupplierSource: resolver.isCurrent, resolveRequestCollection: async () => ({ status: "unavailable", reason: "not in this test" }), isCurrentRequestCollection: () => false, readContractSource: async () => ({ status: "unavailable", reason: "not in this test" }) })
    const issued = await resolver.issue("procurement-request", "PR-1", call)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") throw new Error("Procurement source issuance failed")
    const first = await resolver.resolve(issued.value, call)
    expect(first.status).toBe("ok")
    if (first.status !== "ok") return
    const access = createSfProcurementSourceAccess({ host, resolve: resolver, procurement: port })
    expect((await access(first.value.evidence, call)).state).toBe("fresh")
    let resolutions = 0
    const racing = createSfProcurementSourceAccess({ host, resolve: { resolve: async (ref, context) => { const result = await resolver.resolve(ref, context); resolutions += 1; if (resolutions === 2) session.active = false; return result } }, procurement: port })
    expect((await racing(first.value.evidence, call)).state).toBe("unavailable")
    expect(resolutions).toBe(2)
    session.active = false
    expect((await access(first.value.evidence, call)).state).toBe("unavailable")
    session.active = true
    await persistence.transaction("procurement", async (snapshot) => { snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", status: "draft", createdBy: "alice", pr: { title: "Changed", estAmount: 100 } }, version: 2, by: "alice" } }, settings: { currency: "USD" }, suppliers: [] }; return { commit: true, value: undefined } })
    expect((await access(first.value.evidence, call)).state).toBe("unavailable")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
