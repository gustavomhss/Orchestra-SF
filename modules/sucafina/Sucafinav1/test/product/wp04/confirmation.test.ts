import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { projectSfProcurementScope } from "../../../product/integration/procurement-projections.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createProcurementConfirmationObserver } from "../../../product/procurement/confirmation.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("confirmation observes scoped material and fences against source changes and revoked authority", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-procurement-confirmation-"))
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, projectScope: projectSfProcurementScope, createId: randomUUID })
    await persistence.initializeSources("procurement")
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", createdBy: "a", status: "draft", pr: { title: "Need", description: "Before" } }, version: 1, by: "a" } }, suppliers: [], settings: { currency: "USD" }, issued: { pr: ["PR-1"], po: [] } }
      return { commit: true, value: undefined }
    })
    const role = { value: "buyer" }
    const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1" }), commandIdentity: async () => randomUUID(), createId: randomUUID, now: Date.now })
    const request = new Request("https://local.invalid/procurement")
    const digest = digestSfValue({ requestRef: "source" })
    const admission = await ui.admit(request, "sf_request_read", digest)
    if (admission.status !== "ok" || !await ui.validate(admission.value, "sf_request_read", digest)) throw new Error("admission failed")
    const binding = admission.value
    const host = { persistence, requestFor: (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: (context: TrustedDomainContext) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false), environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: randomUUID }), authenticate: async () => ({ id: "a", canWrite: true, roles: [{ surface: "procurement" as const, role: role.value }] }) }
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const contextFor = async (context: TrustedDomainContext) => ({ status: "ok" as const, value: { installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, surface: "procurement" as const, period, currency: "USD", sourceRefs: [], capabilities: [] } })
    const observer = createProcurementConfirmationObserver({ host, scopedSources: persistence, contextFor })
    const issued = await observer.issue("PR-1", ["subject"], period, binding)
    if (issued.status !== "ok") throw new Error("material source unavailable")
    expect(await observer.resolve(issued.value.evidence.refId, binding)).toMatchObject({ status: "ok", value: { evidence: issued.value.evidence } })
    expect((await observer.resolve("sf-procurement-c06:%FF:1", binding)).status).toBe("unavailable")
    const scope = { sourceRef: { surface: "procurement" as const, type: "procurement-request", id: "PR-1", incarnation: issued.value.evidence.target.incarnation }, fields: ["subject"], period, materialDependencies: [], scopeDefinitionVersion: "procurement-c06-v1" }
    expect((await observer.observe({ ...scope, fields: ["ageDays"] }, binding)).state).toBe("dependency-unavailable")
    const first = await observer.observe(scope, binding)
    if (first.state !== "available") throw new Error("observation unavailable")
    expect(first.projection.values).toMatchObject([{ id: "subject", value: "Need", evidenceState: "confirmed" }])
    expect(await observer.fence(scope, first, binding)).toBe(false)
    expect(await persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(scope, first, binding) }))).toBe(true)
    expect(await persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(scope, { ...first, sourceFingerprint: "forged" }, binding) }))).toBe(false)
    await persistence.transaction("procurement", async (snapshot) => {
      const requests = (snapshot.data.store as { requests: Record<string, { request: { pr: { description: string } } }> }).requests
      requests["PR-1"]!.request.pr.description = "Unrelated"
      return { commit: true, value: undefined }
    })
    const unchanged = await observer.observe(scope, binding)
    expect(unchanged).toMatchObject({ state: "available", scopeFingerprint: first.scopeFingerprint })
    await persistence.transaction("procurement", async (snapshot) => {
      const requests = (snapshot.data.store as { requests: Record<string, { request: { pr: { title: string } } }> }).requests
      requests["PR-1"]!.request.pr.title = "Changed"
      return { commit: true, value: undefined }
    })
    expect(await persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(scope, first, binding) }))).toBe(false)
    const changed = await observer.observe(scope, binding)
    expect(changed.state).toBe("available")
    if (changed.state === "available") expect(changed.scopeFingerprint).not.toBe(first.scopeFingerprint)
    role.value = "viewer-without-access"
    expect((await observer.observe(scope, binding)).state).toBe("access-unavailable")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
