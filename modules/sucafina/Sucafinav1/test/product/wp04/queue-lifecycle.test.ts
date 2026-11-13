import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { object } from "../../../runtime/contract.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { projectProcurementScope } from "../../../product/procurement/source-projection.ts"
import { createProcurementCollectionRegistry, createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("durable queue selection, counts and drilldowns keep requester scope across unrelated changes", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-wp04-queue-"))
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, projectScope: projectProcurementScope, createId: randomUUID })
    await persistence.initializeSources("procurement")
    const make = (number: string, createdBy: string) => ({ request: { number, createdBy, status: "pr_pending", pr: { title: number, estAmount: 100 }, prApprovalBaseCurrency: "USD", prApproval: { amount: 100, steps: [{ status: "pending", holderId: "holder", levelName: "Review" }] }, history: [{ at: "2026-01-01T00:00:00Z", action: "Requisition submitted for approval" }, { at: "2026-01-02T00:00:00Z", action: "Requisition rejected" }, { at: "2026-01-03T00:00:00Z", action: "Requisition submitted for approval" }, { at: "2026-01-04T00:00:00Z", action: "Saved" }] }, version: 1, by: createdBy })
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "procurement", role: "requester", entra: "requester", version: 1, by: "admin" }, { surface: "procurement", role: "buyer", entra: "buyer", version: 1, by: "admin" }]
      snapshot.data.store = { requests: { "PR-1": make("PR-1", "requester"), "PR-2": make("PR-2", "other") }, suppliers: [], settings: { currency: "USD" }, issued: { pr: ["PR-1", "PR-2"], po: [] } }
      return { commit: true, value: undefined }
    })
    const access = { active: true }
    const ui = createSfUiAuthority({ authorize: async (request) => access.active ? { installationId: "i", projectId: "p", principalRef: request.headers.get("x-synthetic-principal")!, accessRevision: "1", policyVersion: "1" } : undefined, commandIdentity: async () => "queue", createId: randomUUID, now: Date.now })
    const host: DomainPortHost = { persistence, requestFor: (binding) => binding.kind === "ui" ? ui.requestFor(binding) : undefined, revalidate: (binding) => binding.kind === "ui" ? ui.revalidate(binding) : Promise.resolve(false), environment: async () => ({ at: "2026-01-05T00:00:00Z", id: randomUUID, directory: [] }), authenticate: async (request, context) => { const id = request.headers.get("x-synthetic-principal"); return id ? resolve(id, [...context!.roleMap], (group) => group === id) : null } }
    const contextFor = async (binding: TrustedDomainContext) => ({ status: "ok" as const, value: { installationId: "i", projectId: "p", principalRef: binding.binding.principalRef, accessRevision: "1", policyVersion: "1", surface: "procurement" as const, period: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", sourceRefs: [], capabilities: [] } })
    const individual = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor })
    const collection = createProcurementCollectionRegistry({ host, scopedSources: persistence, contextFor })
    const unavailable = async () => ({ status: "unavailable" as const, reason: "not selected" })
    const port = createProcurementPort({ ...host, ...collection, resolveSupplierSource: individual.resolve, isCurrentSupplierSource: individual.isCurrent, readContractSource: unavailable })
    const admit = async (principal: string) => {
      const payload = { requestRef: "queue" }
      const result = await ui.admit(new Request("https://example.test/procurement", { headers: { "x-synthetic-principal": principal } }), "sf_request_read", digestSfValue(payload))
      if (result.status !== "ok" || !await ui.validate(result.value, "sf_request_read", digestSfValue(payload))) throw new Error("Synthetic UI admission failed")
      return result.value
    }
    const requester = await admit("requester")
    const buyer = await admit("buyer")
    const requesterRef = await collection.createSelection(requester)
    const buyerRef = await collection.createSelection(buyer)
    if (requesterRef.status !== "ok" || buyerRef.status !== "ok") throw new Error("Queue selection unavailable")
    const requesterBefore = await port.list(requesterRef.value, requester)
    const buyerBefore = await port.list(buyerRef.value, buyer)
    expect(requesterBefore.status).toBe("ok")
    expect(buyerBefore.status).toBe("ok")
    if (requesterBefore.status !== "ok" || buyerBefore.status !== "ok") throw new Error("Queue read unavailable")
    expect(requesterBefore.value.queue).toHaveLength(1)
    expect(buyerBefore.value.queue).toHaveLength(2)
    expect(requesterBefore.value.stock.values[0]?.value).toBe(1)
    expect(buyerBefore.value.stock.values[0]?.value).toBe(2)
    expect(JSON.stringify(requesterBefore)).not.toContain("PR-2")
    const age = requesterBefore.value.queue[0]!.values.find((value) => value.id === "ageDays")
    expect(age).toMatchObject({ value: 2, evidenceState: "confirmed" })
    const ref = age!.drilldown
    if (!ref || ref.kind !== "record") throw new Error("Queue drilldown missing")
    expect(await port.read({ requestRef: ref.refId }, requester)).toEqual({ status: "ok", value: requesterBefore.value.queue[0] })
    expect((await port.read({ requestRef: ref.refId }, buyer)).status).toBe("denied")
    await persistence.transaction("procurement", async (snapshot) => { object(object(snapshot.data.store).requests)["PR-3"] = make("PR-3", "other"); return { commit: true, value: undefined } })
    expect(await port.list(requesterRef.value, requester)).toEqual(requesterBefore)
    expect((await port.list(buyerRef.value, buyer)).status).toBe("stale")
    const refreshed = await collection.createSelection(buyer)
    if (refreshed.status !== "ok") throw new Error("Refreshed buyer selection missing")
    const latest = await port.list(refreshed.value, buyer)
    expect(latest.status === "ok" && latest.value.queue.length).toBe(3)
    await persistence.transaction("procurement", async (snapshot) => {
      object(object(object(snapshot.data.store).requests)["PR-1"]).request = { number: "PR-1", createdBy: "requester", status: "pr_pending", prApproval: { steps: [{ status: "pending", holderId: null }] }, createdAt: "2026-01-01T00:00:00Z", history: [{ at: "2026-01-04T00:00:00Z", action: "Saved" }] }
      return { commit: true, value: undefined }
    })
    const incomplete = await collection.createSelection(requester)
    if (incomplete.status !== "ok") throw new Error("Incomplete queue source missing")
    const result = await port.list(incomplete.value, requester)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("Incomplete queue missing")
    expect(result.value.aging).toHaveLength(1)
    expect(result.value.aging[0]!.values.find((value) => value.id === "ageDays")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(result.value.aging[0]!.missing).toEqual(expect.arrayContaining([{ field: "ageDays", reason: "unavailable" }, { field: "holder", reason: "missing" }]))
    access.active = false
    expect((await port.list(incomplete.value, requester)).status).toBe("denied")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
