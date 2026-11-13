import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createProcurementCollectionRegistry, createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { createProcurementCollectionMemberIssuer } from "../../../product/procurement/collection-member.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { createCollaborationHost } from "../../../product/collaboration/host.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"

test("canonical My Work presentation resolves current Procurement title and destination through SQLite, then revocation removes it", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-work-host-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const at = "2026-11-13T00:00:00Z"
  const actor = { active: true }
  const directoryPeople = [{ id: "person", name: "Person" }]
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", createdBy: "person", status: "pr_pending", pr: { title: "Approval", estAmount: 100 }, prApproval: { steps: [{ status: "pending", holderId: "person" }] }, history: [{ action: "Requisition submitted for approval", at: "2026-01-01T00:00:00Z" }] }, version: 1, by: "person" } }, suppliers: [], settings: { currency: "USD" } }
      return { commit: true, value: undefined }
    })
    const identity = { installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const request = new Request("https://example.test/product", { headers: { authorization: "person" } })
    const product = createSfProductAuthority({ identity: () => identity, installationId: "installation", origin: "https://example.test", policyVersion: "policy", persistence,
      grants: [{ principalRef: "person", namespaces: ["threads", "relations", "confirmations"], operations: ["sf_work_list"] }], createId: randomUUID, now: Date.now,
      authenticate: async (candidate, options) => actor.active && candidate.headers.get("authorization") === "person" && options ? { id: "person", canWrite: true, roles: [{ surface: options.surface, role: options.surface === "procurement" ? "requester" : "viewer" }] } : null,
      environment: async () => ({ at, id: randomUUID, directory: directoryPeople }), commandIdentity: async () => "work-test",
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const contextFor = async (binding: Parameters<typeof product.host.revalidate>[0]) => ({ status: "ok" as const, value: { installationId: binding.binding.installationId, projectId: binding.binding.projectId, principalRef: binding.binding.principalRef, accessRevision: binding.binding.accessRevision, policyVersion: binding.binding.policyVersion, surface: "procurement" as const, period, currency: "USD", sourceRefs: [], capabilities: [] } })
    const collections = createProcurementCollectionRegistry({ host: product.host, scopedSources: persistence, contextFor })
    const individual = createProcurementSourceResolver({ host: product.host, scopedSources: persistence, contextFor })
    const captureWorkSource = createProcurementCollectionMemberIssuer({ collection: collections, individual, revalidate: product.host.revalidate })
    const procurement = createProcurementPort({ ...product.host, ...collections, resolveSupplierSource: individual.resolve, isCurrentSupplierSource: individual.isCurrent, readContractSource: async () => ({ status: "unavailable", reason: "not used" }) })
    const evidence = createSfBusinessContext({ revalidate: product.host.revalidate, resolveSource: async (ref, binding) => {
      const member = await collections.resolveRequestSource(ref.refId, binding)
      const source = member.status === "ok" ? member : await individual.resolve(ref.refId, binding)
      return { state: source.status === "ok" && digestSfValue(source.value.evidence) === digestSfValue(ref) ? "fresh" : "unavailable", ref, accessRevision: binding.binding.accessRevision, checkedAt: at }
    }, proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "not used" }) })
    const factory = createCollaborationHost({ captureWorkSource, human: { authorize: async () => false }, host: product.host, state: product.state, creationTarget: product.creationTarget, scopedSources: persistence, evidence, procurement, collections, cases: { read: async () => ({ status: "unavailable", reason: "not used" }) }, authority: product.authority, createId: randomUUID, now: () => at, requiredAuthority: { sf_work_list: [], sf_question_prepare: [], sf_answer_read: [], sf_relation_read: [], sf_handoff_prepare: [] } })
    const initial = { selectionRef: "pending", period }
    const discovery = await product.ui.admit(request, "sf_work_list", digestSfValue(initial))
    if (discovery.status !== "ok" || !await product.ui.validate(discovery.value, "sf_work_list", digestSfValue(initial))) throw new Error("discovery admission failed")
    const selection = await collections.createSelection(discovery.value)
    if (selection.status !== "ok") throw new Error("selection failed")
    const payload = { selectionRef: selection.value, period }
    const admitted = await product.ui.admit(request, "sf_work_list", digestSfValue(payload))
    if (admitted.status !== "ok") throw new Error("work admission failed")
    const result = await dispatchSfCapability({ operation: "sf_work_list", payload, context: admitted.value, descriptors: factory.capabilities, authority: product.authority,
      validateInput: (_descriptor, value) => decodeSfOperationInput("sf_work_list", value).ok,
      validateOutput: (_descriptor, value) => value.status !== "ok" || decodeSfOperationOutput("sf_work_list", value.result).ok })
    expect(result).toMatchObject({ status: "ok", result: { items: [{ ownerRef: "person", state: "pr_pending" }] } })
    if (result.status !== "ok") throw new Error("work list unavailable")
    const decoded = decodeSfOperationOutput("sf_work_list", result.result)
    if (!decoded.ok) throw new Error("work list invalid")
    const presented = await factory.work.listPresentation(payload, admitted.value)
    expect(presented).toMatchObject({ status: "ok", value: { list: { items: [{ actionRef: decoded.value.items[0]?.actionRef, ownerRef: "person", state: "pr_pending" }] }, items: [{ kind: "procurement", actionRef: decoded.value.items[0]?.actionRef, title: "Approval", ownerRef: "person", ownerLabel: "Person", state: "pr_pending", destination: { kind: "procurement-request", recordId: "PR-1" } }] } })
    if (presented.status !== "ok") throw new Error("presentation unavailable")
    expect(presented.value.items[0]?.actionRef).toBe(decoded.value.items[0]?.actionRef)
    expect(presented.value.items[0]?.sourceVersion).toBe(1)
    expect(presented.value.items[0]?.sourceRefs[0]).toMatchObject({ kind: "record", target: { surface: "procurement", recordType: "procurement-request", recordId: "PR-1" } })
    directoryPeople.push({ id: "person", name: "Duplicate directory identity" })
    const ambiguousLabel = await factory.work.listPresentation(payload, admitted.value)
    expect(ambiguousLabel).toMatchObject({ status: "ok", value: { items: [{ title: "Approval", destination: { kind: "procurement-request", recordId: "PR-1" } }] } })
    if (ambiguousLabel.status === "ok") expect(ambiguousLabel.value.items[0]).not.toHaveProperty("ownerLabel")
    actor.active = false
    expect((await product.ui.admit(request, "sf_work_list", digestSfValue(payload))).status).toBe("denied")
    expect((await factory.work.listPresentation(payload, admitted.value)).status).not.toBe("ok")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
