import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { projectSfProcurementScope } from "../../../../product/integration/procurement-projections.ts"
import { createProcurementCollectionRegistry, createProcurementSourceResolver } from "../../../../product/procurement/sources.ts"
import { createProcurementPort } from "../../../../product/procurement/port.ts"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"

test("scoped procurement collection ignores hidden rows and private fields but tracks status ABA", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-procurement-scope-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, projectScope: projectSfProcurementScope, enumerate: enumerateSfSources })
  try {
    await persistence.initializeSources("procurement")
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: { own: { request: { number: "own", createdBy: "a", status: "draft", pr: { title: "visible", estAmount: 100, internalNote: "private-a" }, po: { iban: "bank-a" } }, version: 1, by: "a" }, hidden: { request: { number: "hidden", createdBy: "b", status: "draft" }, version: 1, by: "b" } }, suppliers: [{ id: "s1", legalName: "Supplier", iban: "bank-a" }], settings: { currency: "USD" } }
      return { commit: true, value: undefined }
    })
    const map = await persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(roleMap(snapshot, "procurement")) }))
    const scope = { principalRef: "a", accessRevision: "1", policyVersion: "1", recordType: "procurement-request-selection", recordId: "all", selector: { kind: "procurement-selection-v1", roles: ["requester"], canWrite: true, roleMapDigest: map, status: "all" } }
    const read = () => persistence.readScopedSource("procurement", scope, async () => true)
    const before = await read()
    expect(before?.projection).toMatchObject({ records: [{ id: "own", status: "draft" }] })
    expect(JSON.stringify(before?.projection)).not.toContain("private-a")
    const request = new Request("https://local.invalid/procurement", { headers: { authorization: "test-a" } })
    const ui = createSfUiAuthority({ authorize: async (current) => current.headers.get("authorization") === "test-a" ? { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1" } : undefined, commandIdentity: async () => "command", createId: randomUUID, now: Date.now })
    const admission = await ui.admit(request, "sf_request_read", digestSfValue({ requestRef: "unused" }))
    if (admission.status !== "ok") throw new Error("admission failed")
    expect(await ui.validate(admission.value, "sf_request_read", digestSfValue({ requestRef: "unused" }))).toBe(true)
    const context = { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", surface: "procurement" as const, period: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", sourceRefs: [], capabilities: [] }
    const identity = { role: "requester" }
    const host = { persistence, requestFor: () => ui.requestFor(admission.value), revalidate: async () => { await persistence.transaction("procurement", async () => ({ commit: false, value: undefined })); return ui.revalidate(admission.value) }, environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: randomUUID }), authenticate: async (current: Request) => current.headers.get("authorization") === "test-a" ? { id: "a", canWrite: true, roles: [{ surface: "procurement" as const, role: identity.role }] } : null }
    const registry = createProcurementCollectionRegistry({ host, scopedSources: persistence, contextFor: async () => ({ status: "ok", value: context }) })
    const individual = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor: async () => ({ status: "ok", value: context }) })
    const supplier = await individual.issue("procurement-supplier", "s1", admission.value)
    if (supplier.status !== "ok") throw new Error(`supplier issue failed: ${supplier.reason}`)
    const visible = await individual.issue("procurement-request", "own", admission.value)
    if (visible.status !== "ok") throw new Error(`request issue failed: ${visible.reason}`)
    expect((await individual.issue("procurement-request", "hidden", admission.value)).status).toBe("unavailable")
    expect((await individual.resolve("procurement-supplier:s1:legacy:1", admission.value)).status).toBe("unavailable")
    const supplierBefore = await individual.resolve(supplier.value, admission.value)
    expect(supplierBefore.status).toBe("ok")
    const individualPort = createProcurementPort({ ...host, resolveRequestSource: individual.resolve, resolveSupplierSource: individual.resolve, isCurrentRequestSource: individual.isCurrent, isCurrentSupplierSource: individual.isCurrent, resolveRequestCollection: registry.resolveRequestCollection, isCurrentRequestCollection: registry.isCurrentRequestCollection, readContractSource: async () => ({ status: "unavailable", reason: "unused" }) })
    expect((await individualPort.readSupplier({ supplierRef: supplier.value, fields: ["legalName"] }, admission.value)).status).toBe("ok")
    expect((await individualPort.readSupplier({ supplierRef: supplier.value, fields: ["iban"] }, admission.value)).status).toBe("denied")
    const selected = await registry.createSelection(admission.value)
    if (selected.status !== "ok") throw new Error(`selection failed: ${selected.reason}`)
    const port = createProcurementPort({ ...host, ...registry, resolveSupplierSource: async () => ({ status: "unavailable", reason: "unused" }), isCurrentSupplierSource: () => false, readContractSource: async () => ({ status: "unavailable", reason: "unused" }) })
    const listing = await port.list(selected.value, admission.value)
    expect(listing.status).toBe("ok")
    if (listing.status !== "ok") throw new Error("list failed")
    expect(listing.value.stock.values).toEqual([expect.objectContaining({ id: "stock:draft", value: 1 })])
    expect(JSON.stringify(listing.value)).not.toContain("hidden")
    expect(JSON.stringify(listing.value)).not.toContain("private-a")
    const drilldown = listing.value.stock.values[0]?.drilldown
    if (!drilldown) throw new Error("missing drilldown")
    const member = listing.value.stock.values[0]?.sourceRefs[0]
    if (!member) throw new Error("missing member")
    expect((await port.list(drilldown.refId, admission.value)).status).toBe("ok")
    identity.role = "unrecognized"
    expect((await registry.resolveRequestCollection(selected.value, admission.value)).status).not.toBe("ok")
    identity.role = "requester"
    await persistence.transaction("procurement", async (snapshot) => {
      const data = snapshot.data.store as { requests: Record<string, { request: { status: string; pr?: { internalNote?: string }; po?: { iban?: string } } }> }
      data.requests.hidden!.request.status = "pr_pending"
      data.requests.own!.request.pr!.internalNote = "private-b"
      data.requests.own!.request.po!.iban = "bank-b"
      const suppliers = (snapshot.data.store as { suppliers: { iban: string }[] }).suppliers
      suppliers[0]!.iban = "bank-b"
      return { commit: true, value: undefined }
    })
    expect(await read()).toEqual(before)
    expect(await individual.resolve(supplier.value, admission.value)).toEqual(supplierBefore)
    expect((await individualPort.readSupplier({ supplierRef: supplier.value, fields: ["legalName"] }, admission.value)).status).toBe("ok")
    expect((await port.list(selected.value, admission.value)).status).toBe("ok")
    for (const amount of [200, 100]) await persistence.transaction("procurement", async (snapshot) => {
      const data = snapshot.data.store as { requests: Record<string, { request: { pr: { estAmount: number } } }> }
      data.requests.own!.request.pr.estAmount = amount
      return { commit: true, value: undefined }
    })
    const afterAmount = await read()
    expect(afterAmount?.incarnation).toBe(before?.incarnation)
    expect(afterAmount?.version).toBe((before?.version ?? 0) + 2)
    expect(afterAmount?.inputDigest).toBe(before?.inputDigest)
    expect((await port.list(selected.value, admission.value)).status).toBe("stale")
    expect((await registry.resolveRequestSource(member.refId, admission.value)).status).toBe("stale")
    expect((await individual.resolve(visible.value, admission.value)).status).toBe("stale")
    for (const legalName of ["Changed", "Supplier"]) await persistence.transaction("procurement", async (snapshot) => {
      const suppliers = (snapshot.data.store as { suppliers: { legalName: string }[] }).suppliers
      suppliers[0]!.legalName = legalName
      return { commit: true, value: undefined }
    })
    expect((await individual.resolve(supplier.value, admission.value)).status).toBe("stale")
    for (const status of ["pr_pending", "draft"]) await persistence.transaction("procurement", async (snapshot) => {
      const data = snapshot.data.store as { requests: Record<string, { request: { status: string } }> }
      data.requests.own!.request.status = status
      return { commit: true, value: undefined }
    })
    const after = await read()
    expect(after?.incarnation).toBe(before?.incarnation)
    expect(after?.version).toBe((before?.version ?? 0) + 4)
    expect(after?.inputDigest).toBe(before?.inputDigest)
    expect((await port.list(selected.value, admission.value)).status).toBe("stale")
    expect((await registry.resolveRequestCollection(selected.value, { ...admission.value, binding: { ...admission.value.binding, principalRef: "other" } })).status).toBe("denied")
    expect(projectSfProcurementScope("procurement", await persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: snapshot })), { ...scope, selector: { ...scope.selector, roleMapDigest: "forged" } })).toBeUndefined()
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
