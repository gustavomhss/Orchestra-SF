import { expect, test } from "bun:test"
import { readRequest } from "../../../product/procurement/capabilities.ts"
import type { ProcurementPort } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { Snapshot } from "../../../runtime/contract.ts"

const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "a", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext

test("capability refuses forged arguments and refuses an ungranted direct call", async () => {
  const unavailable = async () => ({ status: "unavailable" as const, reason: "not reached" })
  const port: ProcurementPort = { read: unavailable, readSupplier: unavailable, readContract: unavailable, compareSourcing: unavailable }
  const authority = { validateDomainContext: async () => false, revalidateDomainContext: async () => false, receiptFor: () => undefined }
  expect(await readRequest({ requestRef: "r", actor: "forged" }, binding, { port, authority })).toMatchObject({ status: "denied", receipt: { code: "invalid-input" } })
  expect(await readRequest({ requestRef: "r" }, binding, { port, authority })).toMatchObject({ status: "denied", receipt: { code: "invalid-binding" } })
})

test("authorized capability reads the real domain projection through the source resolver", async () => {
  const { createProcurementPort, isCurrentProcurementSource } = await import("../../../product/procurement/port.ts")
  const { createProcurementSourceResolver, procurementSourceSelector } = await import("../../../product/procurement/sources.ts")
  const { createSfUiAuthority } = await import("../../../product/integration/ui-authority.ts")
  const { digestSfValue } = await import("../../../product/contracts/canonical.ts")
  const request = new Request("https://local.invalid/procurement")
  const input = { requestRef: procurementSourceSelector("procurement-request", "PR-1", "one", 1) }
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "a", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "command", createId: () => "request", now: () => Date.parse("2026-01-01T00:00:00Z") })
  const admission = await ui.admit(request, "sf_request_read", digestSfValue(input))
  if (admission.status !== "ok") throw new Error("UI admission failed")
  const snapshot = { data: { store: { requests: { "PR-1": { request: { number: "PR-1", status: "draft", createdBy: "a", pr: { title: "Owned", estAmount: 100 } }, version: 4, by: "a" } }, settings: { currency: "USD" }, suppliers: [] } }, versions: {}, sequences: {}, audit: [], notices: [], sfSources: { schemaVersion: 1 as const, records: { [JSON.stringify(["procurement-request", "PR-1"])]: { incarnation: "one", version: 1, alive: true, inputDigest: "a".repeat(64) } } } }
  const host = {
    requestFor: (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: (context: TrustedDomainContext) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
    environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: () => "unused" }),
    authenticate: async () => ({ id: "a", canWrite: true, roles: [{ surface: "procurement" as const, role: "requester" }] }),
    persistence: { transaction: async <T>(_surface: "dashboard" | "planner" | "procurement", work: (state: Snapshot) => Promise<{ commit: boolean; value: T }>) => (await work(structuredClone(snapshot))).value },
  }
  const resolver = createProcurementSourceResolver({ host, contextFor: async () => ({ status: "ok", value: { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", surface: "procurement", period: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", sourceRefs: [], capabilities: [] } }) })
  const port = createProcurementPort({ ...host, resolveRequestSource: resolver, resolveSupplierSource: resolver, isCurrentRequestSource: isCurrentProcurementSource, isCurrentSupplierSource: isCurrentProcurementSource, resolveRequestCollection: async () => ({ status: "unavailable", reason: "not used" }), isCurrentRequestCollection: () => false, readContractSource: async () => ({ status: "unavailable", reason: "not used" }) })
  const authority = { validateDomainContext: (context: TrustedDomainContext, operation: string, digest: string) => context.kind === "ui" ? ui.validate(context, operation, digest) : Promise.resolve(false), revalidateDomainContext: (context: TrustedDomainContext) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false), receiptFor: (context: TrustedDomainContext, operation: string, digest: string, output?: string) => context.kind === "ui" ? ui.receiptFor(context, operation, digest, output) : undefined }
  expect((await readRequest(input, admission.value, { port, authority })).status).toBe("denied")
  expect(await ui.validate(admission.value, "sf_request_read", digestSfValue(input))).toBe(true)
  const result = await readRequest(input, admission.value, { port, authority })
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.result).toMatchObject({ version: 1, values: expect.arrayContaining([expect.objectContaining({ id: "subject", value: "Owned" })]) })

  const { createProcurementUiBindings } = await import("../../../product/procurement/ui-bindings.ts")
  const bindings = createProcurementUiBindings({ authority: ui, dispatch: async (operation, payload, context) => {
    if (operation !== "sf_request_read" || context.kind !== "ui" || !await ui.validate(context, operation, digestSfValue(payload))) throw new Error("invalid dispatch")
    expect(ui.requestFor(context)).toBe(request)
    return readRequest(payload, context, { port, authority })
  } })
  const fromUi = await bindings.readRequest(request, input)
  expect(fromUi.status).toBe("ok")
  expect(fromUi.status === "ok" && fromUi.result).toMatchObject({ version: 1, values: expect.arrayContaining([expect.objectContaining({ id: "subject", value: "Owned" })]) })
})
