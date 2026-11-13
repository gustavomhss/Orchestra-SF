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
import { createProcurementContractSource } from "../../../product/procurement/contracts.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("contract capability reads only the issued Dashboard scope and rejects revocation and ABA", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-contract-source-"))
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => "2026-11-13T12:00:00Z") })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]
      snapshot.data.contracts = [{ id: "c1", vendor: "Supplier", amount: 100, currency: "USD", notes: "private note", docs: [{ id: "d1", key: "private/path" }] }]
      return { commit: true, value: undefined }
    })
    const session = { request: new Request("https://example.test", { headers: { authorization: "admin" } }), active: true }
    const host: DomainPortHost = { persistence, authenticate: async (request, context) => { const id = request.headers.get("authorization"); return id ? resolve(id, [...context!.roleMap], (group) => id === "admin" && group === "admins") : null }, environment: async () => ({ at: "2026-11-13T12:00:00Z", id: randomUUID, directory: [] }), requestFor: () => session.request, revalidate: async () => session.active }
    const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
    const source = createProcurementContractSource({ host, scopedSources: persistence })
    const issued = await source.issueContract({ id: "c1", fields: ["vendor", "amount", "currency"], period: { start: "2026-01-01", end: "2026-12-31" } }, binding)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") return
    const unavailable = async () => ({ status: "unavailable" as const, reason: "unused" })
    const port = createProcurementPort({ ...host, resolveRequestSource: unavailable, resolveRequestCollection: unavailable, resolveSupplierSource: unavailable, isCurrentRequestSource: () => false, isCurrentRequestCollection: () => false, isCurrentSupplierSource: () => false, readContractSource: source.readContractSource })
    const result = await port.readContract({ contractRef: issued.value, fields: ["vendor", "amount", "currency"] }, binding)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.value.values).toEqual(expect.arrayContaining([expect.objectContaining({ id: "vendor", value: "Supplier" }), expect.objectContaining({ id: "amount", value: 100, currency: "USD" })]))
    expect(JSON.stringify(result.value)).not.toContain("private note")
    expect(JSON.stringify(result.value)).not.toContain("private/path")
    expect((await port.readContract({ contractRef: issued.value, fields: ["notes"] }, binding)).status).toBe("denied")
    expect((await source.issueContract({ id: "c1", fields: ["docs"], period: { start: "2026-01-01", end: "2026-12-31" } }, binding)).status).toBe("needs-input")
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.contracts as { notes: string }[])[0]!.notes = "changed private note"; return { commit: true, value: undefined } })
    expect((await port.readContract({ contractRef: issued.value, fields: ["amount"] }, binding)).status).toBe("ok")
    for (const amount of [200, 100]) await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.contracts as { amount: number }[])[0]!.amount = amount; return { commit: true, value: undefined } })
    expect((await port.readContract({ contractRef: issued.value, fields: ["amount"] }, binding)).status).toBe("stale")
    session.active = false
    expect((await port.readContract({ contractRef: issued.value, fields: ["amount"] }, binding)).status).toBe("denied")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
