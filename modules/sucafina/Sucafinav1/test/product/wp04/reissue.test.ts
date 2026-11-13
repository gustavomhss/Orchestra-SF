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
import { createProcurementCollectionRegistry, createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { createProcurementCollectionMemberIssuer } from "../../../product/procurement/collection-member.ts"
import { prepareProcurementMutation } from "../../../product/procurement/prepared.ts"
import { createProcurementPreparedReview } from "../../../product/procurement/prepared-review.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("reissue requires the recipient's current scope and the same physical request", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-procurement-reissue-"))
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, projectScope: projectSfProcurementScope, createId: randomUUID })
    await persistence.initializeSources("procurement")
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", createdBy: "a", status: "draft", pr: { title: "Owned" } }, version: 1, by: "a" } }, suppliers: [], settings: { currency: "USD" }, issued: { pr: ["PR-1"], po: [] } }
      return { commit: true, value: undefined }
    })
    const roles = { b: "requester" }
    const ui = createSfUiAuthority({ authorize: async (request) => {
      const principalRef = request.headers.get("authorization")
      return principalRef ? { installationId: "i", projectId: "p", principalRef, accessRevision: "1", policyVersion: "1" } : undefined
    }, commandIdentity: async () => randomUUID(), createId: randomUUID, now: Date.now })
    const admit = async (id: string) => {
      const request = new Request("https://local.invalid/procurement", { headers: { authorization: id } })
      const digest = digestSfValue({ requestRef: "source" })
      const result = await ui.admit(request, "sf_request_read", digest)
      if (result.status !== "ok" || !await ui.validate(result.value, "sf_request_read", digest)) throw new Error("admission failed")
      return result.value
    }
    const a = await admit("a")
    const b = await admit("b")
    const host = { persistence, requestFor: (binding: TrustedDomainContext) => binding.kind === "ui" ? ui.requestFor(binding) : undefined, revalidate: (binding: TrustedDomainContext) => binding.kind === "ui" ? ui.revalidate(binding) : Promise.resolve(false), environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: randomUUID }), authenticate: async (request: Request) => { const id = request.headers.get("authorization"); return id ? { id, canWrite: true, roles: [{ surface: "procurement" as const, role: id === "a" ? "requester" : roles.b }] } : null } }
    const contextFor = async (binding: TrustedDomainContext) => ({ status: "ok" as const, value: { installationId: binding.binding.installationId, projectId: binding.binding.projectId, principalRef: binding.binding.principalRef, accessRevision: binding.binding.accessRevision, policyVersion: binding.binding.policyVersion, surface: "procurement" as const, period: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", sourceRefs: [], capabilities: [] } })
    const resolver = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor })
    const first = await resolver.issue("procurement-request", "PR-1", a)
    if (first.status !== "ok") throw new Error("source issuance failed")
    const original = await resolver.resolve(first.value, a)
    if (original.status !== "ok") throw new Error("source resolution failed")
    const privateSource = await resolver.resolveForPreparation(first.value, a)
    if (privateSource.status !== "ok") throw new Error("source scope unavailable")
    const originalTarget = original.value.evidence.target
    const target = { surface: "procurement" as const, type: originalTarget.recordType, id: originalTarget.recordId, incarnation: originalTarget.incarnation, version: originalTarget.version, fields: originalTarget.fields, period: original.value.context.period, observedAt: "2026-01-01T00:00:00Z" }
    const prepared = await persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: prepareProcurementMutation({ snapshot, actor: { id: "a", roles: ["requester"], canWrite: true, assigned: [], domains: [] }, environment: { at: target.observedAt, directory: [], id: randomUUID }, context: a, target, scope: privateSource.value.scope, evidence: original.value.evidence, command: { page: "Requests", action: "save", id: "PR-1", version: 0, values: { pr: { title: "Updated" } } }, operationId: "op", idempotencyKey: "key" }) }))
    if (!prepared) throw new Error("source preparation failed")
    const collection = createProcurementCollectionRegistry({ host, scopedSources: persistence, contextFor })
    const selected = await collection.createSelection(a)
    if (selected.status !== "ok") throw new Error("collection issuance failed")
    const list = await collection.resolveRequestCollection(selected.value, a)
    if (list.status !== "ok") throw new Error("collection unavailable")
    const member = list.value.requests[0]
    if (!member) throw new Error("collection member unavailable")
    const persistMember = createProcurementCollectionMemberIssuer({ collection, individual: resolver, revalidate: host.revalidate })
    const persisted = await persistMember(member.refId, a)
    expect(persisted).toEqual({ status: "ok", value: original.value.evidence })
    expect((await persistMember(member.refId, b)).status).toBe("denied")
    const reissue = resolver.issueForActor
    expect((await reissue(original.value.evidence.target, b)).status).toBe("unavailable")
    roles.b = "buyer"
    const admitted = await reissue(original.value.evidence.target, b)
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    expect(admitted.value.target).toMatchObject({ recordType: "procurement-request", recordId: "PR-1", fields: original.value.evidence.target.fields, period: original.value.evidence.target.period })
    expect(admitted.value.target.incarnation).not.toBe(original.value.evidence.target.incarnation)
    expect((await resolver.resolve(admitted.value.refId, b)).status).toBe("ok")
    const fence = await resolver.prepareReissueScope(original.value.evidence, admitted.value, b)
    expect(fence.status).toBe("ok")
    if (fence.status !== "ok") return
    expect(await fence.value.fence()).toBe(false)
    const fenced = await persistence.transactionAll!(async () => ({ commit: false, value: await fence.value.fence() }))
    expect(fenced).toBe(true)
    roles.b = "requester"
    const revokedFence = await persistence.transactionAll!(async () => ({ commit: false, value: await fence.value.fence() }))
    expect(revokedFence).toBe(false)
    roles.b = "buyer"

    const unavailable = async () => ({ status: "unavailable" as const, reason: "unused" })
    const port = createProcurementPort({ ...host, resolveRequestSource: resolver.resolve, resolveSupplierSource: resolver.resolve, isCurrentRequestSource: resolver.isCurrent, isCurrentSupplierSource: resolver.isCurrent, resolveRequestCollection: unavailable, isCurrentRequestCollection: () => false, readContractSource: unavailable })
    const reviewed = await createProcurementPreparedReview({ port, individual: resolver })(prepared.command, b)
    expect(reviewed).toMatchObject({ status: "ok", value: { fields: [{ field: "subject", before: "Owned", after: "Updated" }], source: { refId: admitted.value.refId }, originalTargetDigest: digestSfValue(target), targetLabel: "Owned" } })
    expect(JSON.stringify(reviewed)).not.toContain(original.value.evidence.refId)
    expect((await reissue({ ...original.value.evidence.target, fields: ["status"] }, b)).status).toBe("unavailable")
    expect((await reissue({ ...original.value.evidence.target, incarnation: "forged" }, b)).status).toBe("unavailable")
    roles.b = "requester"
    expect((await resolver.resolve(admitted.value.refId, b)).status).not.toBe("ok")
    roles.b = "buyer"
    await persistence.transaction("procurement", async (snapshot) => { delete (snapshot.data.store as { requests: Record<string, unknown> }).requests["PR-1"]; return { commit: true, value: undefined } })
    await persistence.transaction("procurement", async (snapshot) => { (snapshot.data.store as { requests: Record<string, unknown> }).requests["PR-1"] = { request: { number: "PR-1", createdBy: "a", status: "draft", pr: { title: "Replacement" } }, version: 1, by: "a" }; return { commit: true, value: undefined } })
    expect((await reissue(original.value.evidence.target, b)).status).toBe("unavailable")
    expect((await persistMember(member.refId, a)).status).toBe("stale")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
