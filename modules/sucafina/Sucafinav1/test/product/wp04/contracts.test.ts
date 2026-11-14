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
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createProcurementCapabilities, readContract } from "../../../product/procurement/capabilities.ts"
import { createProcurementUiBindings } from "../../../product/procurement/ui-bindings.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
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
    const session = { request: new Request("https://example.test", { headers: { authorization: "admin" } }), active: true, at: "2026-11-13T12:00:00Z" }
    const ui = createSfUiAuthority({ authorize: async (request) => session.active && request.headers.get("authorization") === "admin" ? { installationId: "i", projectId: "p", principalRef: "admin", policyVersion: "1", accessRevision: "1" } : undefined, commandIdentity: async () => randomUUID(), createId: randomUUID, now: Date.now })
    const host: DomainPortHost = { persistence, authenticate: async (request, context) => { const id = request.headers.get("authorization"); return id ? resolve(id, [...context!.roleMap], (group) => id === "admin" && group === "admins") : null }, environment: async () => ({ at: session.at, id: randomUUID, directory: [] }), requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false) }
    const issuerInput = { contractRef: "issuer", fields: ["vendor", "amount", "currency"] }
    const admitted = await ui.admit(session.request, "sf_contract_read", digestSfValue(issuerInput))
    if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_contract_read", digestSfValue(issuerInput))) throw new Error("contract UI authority unavailable")
    const binding = admitted.value
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
    const authority: SfDomainValidation = { validateDomainContext: (context, operation, digest) => context.kind === "ui" ? ui.validate(context, operation, digest) : Promise.resolve(false), revalidateDomainContext: host.revalidate, receiptFor: (context, operation, digest, output) => context.kind === "ui" ? ui.receiptFor(context, operation, digest, output) : undefined }
    const descriptors = createProcurementCapabilities({ port, authority })
    const dispatch = (payload: unknown, context: TrustedDomainContext) => dispatchSfCapability({ operation: "sf_contract_read", payload, context, descriptors, authority, validateInput: (descriptor, value) => descriptor.id === "sf_contract_read" && decodeSfOperationInput("sf_contract_read", value).ok, validateOutput: (descriptor, value) => descriptor.id === "sf_contract_read" && (value.status !== "ok" || decodeSfOperationOutput("sf_contract_read", value.result).ok) })
    const bindings = createProcurementUiBindings({ authority: ui, dispatch: (_operation, payload, context) => dispatch(payload, context) })
    const input = { contractRef: issued.value, fields: ["vendor", "amount", "currency"] }
    const call = await ui.admit(session.request, "sf_contract_read", digestSfValue(input))
    if (call.status !== "ok") throw new Error("contract call admission unavailable")
    expect(await readContract(input, call.value, { port, authority })).toMatchObject({ status: "denied", receipt: { kind: "unbound", code: "invalid-binding" } })
    const exported = await dispatch(input, call.value)
    expect(exported).toMatchObject({ status: "ok", receipt: { kind: "ui", operation: "sf_contract_read", handlerExport: "readContract", principalRef: "admin" } })
    expect(exported.status === "ok" && exported.result).toEqual(result.value)
    expect((await dispatch(input, call.value)).status).toBe("denied")
    expect((await bindings.readContract(session.request, { contractRef: "not-issued", fields: ["vendor"] })).status).toBe("needs-input")
    session.at = "invalid-observation-time"
    expect(await bindings.readContract(session.request, input)).toMatchObject({ status: "unavailable", reason: "observation-time-unavailable" })
    session.at = "2026-11-13T12:00:00Z"
    expect((await port.readContract({ contractRef: issued.value, fields: ["notes"] }, binding)).status).toBe("denied")
    expect((await source.issueContract({ id: "c1", fields: ["docs"], period: { start: "2026-01-01", end: "2026-12-31" } }, binding)).status).toBe("needs-input")
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.contracts as { notes: string }[])[0]!.notes = "changed private note"; return { commit: true, value: undefined } })
    expect((await port.readContract({ contractRef: issued.value, fields: ["amount"] }, binding)).status).toBe("ok")
    for (const amount of [200, 100]) await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.contracts as { amount: number }[])[0]!.amount = amount; return { commit: true, value: undefined } })
    expect((await port.readContract({ contractRef: issued.value, fields: ["amount"] }, binding)).status).toBe("stale")
    expect((await bindings.readContract(session.request, input)).status).toBe("stale")
    session.active = false
    expect((await port.readContract({ contractRef: issued.value, fields: ["amount"] }, binding)).status).toBe("denied")
    expect((await readContract(input, call.value, { port, authority })).status).toBe("denied")
    expect((await bindings.readContract(session.request, input)).status).toBe("denied")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
