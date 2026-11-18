import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRelationPort } from "../../../product/collaboration/relations.ts"
import { isAllowedRelationPair } from "../../../product/collaboration/relation-catalog.ts"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

test("a symmetric relation has one identity and cannot silently change evidence or domain records", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-relations-integrity-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const domain = { projects: [{ id: "project", name: "Same Name", budget: 100 }], capexProjects: [{ id: "capex", name: "Same Name", amount: 250 }] }
    await store.transaction("dashboard", async (snapshot) => { Object.assign(snapshot.data, structuredClone(domain)); return { commit: true, value: undefined } })
    const context = { kind: "ui", binding: { installationId: "installation", projectId: "project", principalRef: "person", requestId: "request", accessRevision: "access", policyVersion: "policy", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const state = createSfProductState({ persistence: store, createId: () => "state", resolveTarget: async () => ({ incarnation: "workspace-inc" }), authorize: async () => ({ principalRef: "person", accessRevision: "access", policyVersion: "policy" }) })
    const count = { value: 0, readable: true }
    const port = createRelationPort({ state, host: { requestFor: () => new Request("https://example.test/"), revalidate: async () => true }, human: { authorize: async () => true }, mutationFence: createCollaborationMutationFence({ persistence: store }), creationTarget: { ref: "workspace", incarnation: "workspace-inc" }, handoffPermit: Symbol("handoff"), createId: () => `relation-${++count.value}`, now: () => "2026-11-13T00:00:00Z", authorizePair: async (pair) => {
      const from = pair.evidenceRefs.find((ref) => ref.refId === pair.fromRef)
      const to = pair.evidenceRefs.find((ref) => ref.refId === pair.toRef)
      return count.readable && !!from && !!to && isAllowedRelationPair(pair.kind, from, to)
    } })
    const source = (recordType: string, id: string) => {
      const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", installationId: "installation", projectId: "project", refId: id, refDigest: "", evidenceLevel: "observed", target: { surface: "dashboard", recordType, recordId: id, incarnation: `inc-${id}`, version: 1, fields: ["name"], projectionDigest: "a".repeat(64) } }
      return { ...ref, refDigest: digestSfEvidenceRef(ref) }
    }
    const from = source("projects", "project")
    const to = source("capexProjects", "capex")
    const pair = { fromRef: from.refId, toRef: to.refId, kind: "pmo-capex", evidenceRefs: [from, to] }
    expect(await port.storageVersion(context)).toEqual({ status: "ok", value: 0 })
    const first = await port.create(pair, { expectedStorageVersion: 0, idempotencyKey: "create" }, context)
    if (first.status !== "ok") throw new Error(`relation creation: ${first.status}`)
    expect(await port.create({ ...pair, fromRef: to.refId, toRef: from.refId, evidenceRefs: [to, from] }, { expectedStorageVersion: 1, idempotencyKey: "reverse" }, context)).toEqual(first)
    expect(await port.storageVersion(context)).toEqual({ status: "ok", value: 1 })
    expect((await port.create({ ...pair, evidenceRefs: [...pair.evidenceRefs, source("contracts", "extra")] }, { expectedStorageVersion: 1, idempotencyKey: "different-evidence" }, context)).status).toBe("conflict")
    expect((await port.create({ ...pair, recipientRef: "other" }, { expectedStorageVersion: 1, idempotencyKey: "different-assignment" }, context)).status).toBe("conflict")
    count.readable = false
    expect(await port.read([from.refId], context)).toEqual({ status: "ok", value: { relations: [] } })
    count.readable = true
    expect((await port.remove(first.value.id, pair, { expectedStorageVersion: 1, idempotencyKey: "remove" }, context)).status).toBe("ok")
    expect(await port.read([from.refId], context)).toEqual({ status: "ok", value: { relations: [] } })
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: { projects: snapshot.data.projects, capexProjects: snapshot.data.capexProjects } }))).toEqual(domain)
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
