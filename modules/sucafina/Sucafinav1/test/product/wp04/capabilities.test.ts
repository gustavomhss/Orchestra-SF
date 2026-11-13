import { expect, test } from "bun:test"
import { readRequest } from "../../../product/procurement/capabilities.ts"
import type { ProcurementPort } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "a", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext

test("capability refuses forged arguments and refuses an ungranted direct call", async () => {
  const unavailable = async () => ({ status: "unavailable" as const, reason: "not reached" })
  const port: ProcurementPort = { read: unavailable, readSupplier: unavailable, readContract: unavailable, compareSourcing: unavailable }
  const authority = { validateDomainContext: async () => false, revalidateDomainContext: async () => false, receiptFor: () => undefined }
  expect(await readRequest({ requestRef: "r", actor: "forged" }, binding, { port, authority })).toMatchObject({ status: "denied", receipt: { code: "invalid-input" } })
  expect(await readRequest({ requestRef: "r" }, binding, { port, authority })).toMatchObject({ status: "denied", receipt: { code: "invalid-binding" } })
})

test("authorized capability reads through an issued scoped source and consumes once", async () => {
  const { mkdtemp, realpath, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { default: path } = await import("node:path")
  const { randomUUID } = await import("node:crypto")
  const { openLocalStore } = await import("../../../runtime/local-store.ts")
  const { createSfSourcePersistence } = await import("../../../product/integration/source-lifecycle.ts")
  const { enumerateSfSources } = await import("../../../product/integration/source-inventory.ts")
  const { projectSfProcurementScope } = await import("../../../product/integration/procurement-projections.ts")
  const { createProcurementPort } = await import("../../../product/procurement/port.ts")
  const { createProcurementSourceResolver } = await import("../../../product/procurement/sources.ts")
  const { createSfUiAuthority } = await import("../../../product/integration/ui-authority.ts")
  const { digestSfValue } = await import("../../../product/contracts/canonical.ts")
  const { createProcurementUiBindings } = await import("../../../product/procurement/ui-bindings.ts")
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-capability-scope-"))
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, projectScope: projectSfProcurementScope, createId: randomUUID })
  try {
    await persistence.initializeSources("procurement")
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", status: "draft", createdBy: "a", pr: { title: "Owned", estAmount: 100 } }, version: 4, by: "a" } }, settings: { currency: "USD" }, suppliers: [] }
      return { commit: true, value: undefined }
    })
    const request = new Request("https://local.invalid/procurement")
    const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "a", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "command", createId: randomUUID, now: Date.now })
    const issuePayload = { requestRef: "issuer" }
    const admission = await ui.admit(request, "sf_request_read", digestSfValue(issuePayload))
    if (admission.status !== "ok") throw new Error("UI admission failed")
    expect(await ui.validate(admission.value, "sf_request_read", digestSfValue(issuePayload))).toBe(true)
    const host = {
      requestFor: (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined,
      revalidate: (context: TrustedDomainContext) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
      environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: randomUUID }),
      authenticate: async () => ({ id: "a", canWrite: true, roles: [{ surface: "procurement" as const, role: "requester" }] }), persistence,
    }
    const resolver = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor: async () => ({ status: "ok", value: { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", surface: "procurement", period: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", sourceRefs: [], capabilities: [] } }) })
    const issued = await resolver.issue("procurement-request", "PR-1", admission.value)
    if (issued.status !== "ok") throw new Error(`source issue failed: ${issued.reason}`)
    const input = { requestRef: issued.value }
    const port = createProcurementPort({ ...host, resolveRequestSource: resolver.resolve, resolveSupplierSource: resolver.resolve, isCurrentRequestSource: resolver.isCurrent, isCurrentSupplierSource: resolver.isCurrent, resolveRequestCollection: async () => ({ status: "unavailable", reason: "not used" }), isCurrentRequestCollection: () => false, readContractSource: async () => ({ status: "unavailable", reason: "not used" }) })
    const authority = { validateDomainContext: (context: TrustedDomainContext, operation: string, digest: string) => context.kind === "ui" ? ui.validate(context, operation, digest) : Promise.resolve(false), revalidateDomainContext: (context: TrustedDomainContext) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false), receiptFor: (context: TrustedDomainContext, operation: string, digest: string, output?: string) => context.kind === "ui" ? ui.receiptFor(context, operation, digest, output) : undefined }
    const call = await ui.admit(request, "sf_request_read", digestSfValue(input))
    if (call.status !== "ok") throw new Error("UI admission failed")
    expect((await readRequest(input, call.value, { port, authority })).status).toBe("denied")
    expect(await ui.validate(call.value, "sf_request_read", digestSfValue(input))).toBe(true)
    const result = await readRequest(input, call.value, { port, authority })
    expect(result.status === "ok" && result.result).toMatchObject({ values: expect.arrayContaining([expect.objectContaining({ id: "subject", value: "Owned" })]) })
    const bindings = createProcurementUiBindings({ authority: ui, dispatch: async (operation, payload, context) => {
      if (operation !== "sf_request_read" || context.kind !== "ui" || !await ui.validate(context, operation, digestSfValue(payload))) throw new Error("invalid dispatch")
      expect(ui.requestFor(context)).toBe(request)
      return readRequest(payload, context, { port, authority })
    } })
    const fromUi = await bindings.readRequest(request, input)
    expect(fromUi.status === "ok" && fromUi.result).toMatchObject({ values: expect.arrayContaining([expect.objectContaining({ id: "subject", value: "Owned" })]) })
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
