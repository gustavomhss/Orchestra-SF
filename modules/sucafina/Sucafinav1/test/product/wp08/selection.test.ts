import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { projectSfProcurementScope } from "../../../product/integration/procurement-projections.ts"
import { createProcurementCollectionRegistry } from "../../../product/procurement/sources.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import { createCollaborationAuthority } from "../../../product/collaboration/authority.ts"
import { createWorkSelectionPort } from "../../../product/collaboration/selection.ts"

test("work membership uses the current authorized Procurement collection, not refId equality", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-work-selection-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: projectSfProcurementScope })
  try {
    await persistence.initializeSources("procurement")
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: { own: { request: { number: "own", createdBy: "a", status: "draft", pr: { title: "Visible", estAmount: 100 } }, version: 1, by: "a" }, hidden: { request: { number: "hidden", createdBy: "b", status: "draft" }, version: 1, by: "b" } }, suppliers: [], settings: { currency: "USD" } }
      return { commit: true, value: undefined }
    })
    const request = new Request("https://local.invalid/procurement", { headers: { authorization: "test-a" } })
    const identity = { active: true }
    const ui = createSfUiAuthority({ authorize: async (candidate) => identity.active && candidate.headers.get("authorization") === "test-a" ? { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1" } : undefined, commandIdentity: async () => "command", createId: randomUUID, now: Date.now })
    const payload = { selectionRef: "selection", period: { start: "2026-01-01", end: "2026-12-31" } }
    const admitted = await ui.admit(request, "sf_work_list", digestSfValue(payload))
    if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_work_list", digestSfValue(payload))) throw new Error("admission failed")
    const host = { persistence, requestFor: () => ui.requestFor(admitted.value), revalidate: () => ui.revalidate(admitted.value), environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: randomUUID }), authenticate: async (candidate: Request) => identity.active && candidate.headers.get("authorization") === "test-a" ? { id: "a", canWrite: true, roles: [{ surface: "procurement" as const, role: "requester" }] } : null }
    const context = { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", surface: "procurement" as const, period: payload.period, currency: "USD", sourceRefs: [], capabilities: [] }
    const registry = createProcurementCollectionRegistry({ host, scopedSources: persistence, contextFor: async () => ({ status: "ok", value: context }) })
    const issued = await registry.createSelection(admitted.value)
    if (issued.status !== "ok") throw new Error("selection failed")
    const collection = await registry.resolveRequestCollection(issued.value, admitted.value)
    if (collection.status !== "ok" || collection.value.requests.length !== 1) throw new Error("member missing")
    const evidence: BusinessContextService = { context: async ({ refs }, binding) => Promise.all(refs.map(async (ref) => {
      const result = await registry.resolveRequestSource(ref.refId, binding)
      return { state: result.status === "ok" && digestSfValue(result.value.evidence) === digestSfValue(ref) ? "fresh" as const : "unavailable" as const, ref, accessRevision: "1", checkedAt: "2026-01-01T00:00:00Z" }
    })), resolve: async () => { throw new Error("not used") }, recall: async () => [], emitFromLedger: async () => { throw new Error("not used") } }
    const port = createWorkSelectionPort({ collections: registry, authority: createCollaborationAuthority({ host, evidence }) })
    const selected = await port.resolve(issued.value, payload.period, admitted.value)
    if (selected.status !== "ok") throw new Error("scope failed")
    const member = collection.value.requests[0]!
    expect(member.refId).not.toBe(issued.value)
    expect(await port.contains(selected.value, [member], admitted.value)).toEqual({ status: "ok", value: true })
    identity.active = false
    expect((await port.contains(selected.value, [member], admitted.value)).status).not.toBe("ok")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
