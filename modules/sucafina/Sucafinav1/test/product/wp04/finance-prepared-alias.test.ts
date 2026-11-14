import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { object } from "../../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { prepareProcurementMutation } from "../../../product/procurement/prepared.ts"
import { createProcurementPreparedReview } from "../../../product/procurement/prepared-review.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { projectProcurementScope } from "../../../product/procurement/source-projection.ts"
import { createProcurementSourceResolver } from "../../../product/procurement/sources.ts"

test("the prepared command retains its reviewed inputs when caller-owned outputs are mutated", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-prepared-alias-"))
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, projectScope: projectProcurementScope, enumerate: enumerateSfSources })
    await persistence.initializeSources("procurement")
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", createdBy: "alice", status: "draft", pr: { title: "Original", justification: "Need", estAmount: 100 }, history: [] }, version: 1, by: "alice" } }, suppliers: [], settings: { currency: "USD" }, issued: { pr: ["PR-1"], po: [] } }
      snapshot.versions["requests:PR-1"] = { version: 0, by: "alice" }
      return { commit: true, value: undefined }
    })
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const at = "2026-11-13T00:00:00Z"
    const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "alice", accessRevision: "1", policyVersion: "1" }), commandIdentity: async () => randomUUID(), createId: randomUUID, now: Date.now })
    const request = new Request("https://local.invalid/procurement")
    const digest = digestSfValue({ requestRef: "preparation" })
    const admission = await ui.admit(request, "sf_request_read", digest)
    if (admission.status !== "ok" || !await ui.validate(admission.value, "sf_request_read", digest)) throw new Error("UI authority unavailable")
    const context = admission.value
    const revalidationHooks: (() => void)[] = []
    const host = {
      persistence,
      requestFor: (binding: TrustedDomainContext) => binding.kind === "ui" ? ui.requestFor(binding) : undefined,
      revalidate: (binding: TrustedDomainContext) => { revalidationHooks.shift()?.(); return binding.kind === "ui" ? ui.revalidate(binding) : Promise.resolve(false) },
      environment: async () => ({ at, directory: [], id: randomUUID }),
      authenticate: async () => ({ id: "alice", canWrite: true, roles: [{ surface: "procurement" as const, role: "requester" }] }),
    }
    const contextFor = async (binding: TrustedDomainContext) => ({ status: "ok" as const, value: { installationId: binding.binding.installationId, projectId: binding.binding.projectId, principalRef: binding.binding.principalRef, accessRevision: binding.binding.accessRevision, policyVersion: binding.binding.policyVersion, surface: "procurement" as const, period, currency: "USD", sourceRefs: [], capabilities: [] } })
    const resolver = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor })
    const issued = await resolver.issue("procurement-request", "PR-1", context)
    if (issued.status !== "ok") throw new Error("Source unavailable")
    const source = await resolver.resolveForPreparation(issued.value, context)
    if (source.status !== "ok") throw new Error("Preparation source unavailable")
    const snapshot = await persistence.transaction("procurement", async (value) => ({ commit: false, value: structuredClone(value) }))
    const actor: Actor = { id: "alice", canWrite: true, roles: ["requester"], assigned: [], domains: [] }
    const target: SourceRef = { surface: "procurement", type: "procurement-request", id: "PR-1", incarnation: source.value.evidence.target.incarnation, version: source.value.evidence.target.version, fields: source.value.evidence.target.fields, period, observedAt: at }
    const command = { page: "Requests", action: "save", id: "PR-1", version: 0, values: { pr: { title: "Reviewed" } } }
    const prepared = prepareProcurementMutation({ snapshot, actor, target, context, scope: source.value.scope, evidence: source.value.evidence, command, operationId: "op", idempotencyKey: "key", environment: await host.environment() })
    if (!prepared) throw new Error("Mutation preparation unavailable")
    const before = structuredClone(snapshot)
    const unavailable = async () => ({ status: "unavailable" as const, reason: "unused" })
    const port = createProcurementPort({ ...host, resolveRequestSource: resolver.resolve, isCurrentRequestSource: resolver.isCurrent, resolveRequestCollection: unavailable, isCurrentRequestCollection: () => false, resolveSupplierSource: resolver.resolve, isCurrentSupplierSource: resolver.isCurrent, readContractSource: unavailable })
    const reviewInput = structuredClone(prepared.command)
    const targetDigest = digestSfValue(reviewInput.target)
    revalidationHooks.push(() => {
      reviewInput.target.id = "changed-during-await"
      const title = reviewInput.preview.values.find((value) => value.id === "subject")
      if (title) title.value = "Changed during review"
    })
    const reviewed = await createProcurementPreparedReview({ port, individual: resolver })(reviewInput, context)
    expect(reviewed).toMatchObject({ status: "ok", value: { originalTargetDigest: targetDigest, fields: [{ field: "subject", before: "Original", after: "Reviewed" }] } })
    expect(reviewInput.target.id).toBe("changed-during-await")

    command.values.pr.title = "Mutated original input"
    object(prepared.command.command.values.pr).title = "Mutated public command"
    prepared.command.target.id = "different-request"
    prepared.target.incarnation = "different-incarnation"
    prepared.targetEvidence.target.recordId = "different-record"
    prepared.preview.context.currency = "GBP"
    prepared.command.preview.context.currency = "EUR"
    const result = prepared.mutation.execute(snapshot, actor, { at, directory: [], id: randomUUID })
    expect(result).toEqual({ commit: true, value: { status: "applied" } })
    const record = object(object(object(snapshot.data.store).requests)["PR-1"]).request
    expect(object(record).pr).toMatchObject({ title: "Reviewed", justification: "Need", estAmount: 100 })
    expect(object(record).history).toEqual([expect.objectContaining({ action: "Saved", by: "alice" })])
    expect(object(object(object(before.data.store).requests)["PR-1"]).request).toMatchObject({ pr: { title: "Original" } })
    const outsider: Snapshot = structuredClone(before)
    expect(prepared.mutation.execute(outsider, { ...actor, id: "other" }, { at, directory: [], id: randomUUID })).toMatchObject({ commit: false, value: { status: "denied" } })
    expect(outsider).toEqual(before)
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
