import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createCollaborationAuthority } from "../../../product/collaboration/authority.ts"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import { createThreadPort } from "../../../product/collaboration/threads.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

test("contextual questions retain separate periods, exact recipients, and communication after resolution", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-thread-context-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const currentSnapshots = store.currentSnapshots
    if (!currentSnapshots) throw new Error("Fixture requires currentSnapshots to detect nested source reads")
    const access = new Set(["author", "recipient-B"])
    await store.transaction("dashboard", async (snapshot) => { snapshot.data.access = { author: {}, "recipient-B": {}, "recipient-C": {} }; return { commit: true, value: undefined } })
    const context = { kind: "ui", binding: { installationId: "installation", projectId: "project", principalRef: "author", requestId: "request", accessRevision: "access", policyVersion: "policy", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const request = new Request("https://example.test/")
    const host: DomainPortHost = { persistence: store, requestFor: () => request, revalidate: async () => access.has("author"), authenticate: async () => access.has("author") ? { id: "author", canWrite: true, roles: [{ surface: "dashboard", role: "admin" }] } : null, environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [{ id: "author", name: "Author" }, { id: "recipient-B", name: "Same Name" }, { id: "recipient-C", name: "Same Name" }] }) }
    const resolve: BusinessContextService["resolve"] = async (ref, call) => {
      if (currentSnapshots()) throw new Error("Cross-surface source reads cannot run inside the mutation transaction")
      return { state: access.has(call.binding.principalRef) ? "fresh" : "revoked", ref, accessRevision: call.binding.accessRevision, checkedAt: "2026-11-13T00:00:00Z" }
    }
    const evidence: BusinessContextService = { resolve, context: async ({ refs }, call) => Promise.all(refs.map((ref) => resolve(ref, call))), recall: async () => [], emitFromLedger: async () => { throw new Error("Memory is outside this fixture") } }
    const authority = createCollaborationAuthority({ host, evidence, recipientAuthority: { authorize: async (id) => access.has(id), checkAtCommit: (id) => access.has(id) } })
    const ids = { value: 0, revokeRecipient: false }
    const state = createSfProductState({ persistence: store, createId: () => "state", resolveTarget: async () => ({ incarnation: "workspace-inc" }), authorize: async () => access.has("author") ? { principalRef: "author", accessRevision: "access", policyVersion: "policy" } : undefined })
    const threads = createThreadPort({ state, host, human: { authorize: async () => true }, mutationFence: createCollaborationMutationFence(host), authorize: authority.authorizeThread, checkRecipientAtCommit: authority.checkRecipientAtCommit, creationTarget: { ref: "workspace", incarnation: "workspace-inc" }, createId: () => { if (ids.revokeRecipient) { access.delete("recipient-B"); ids.revokeRecipient = false }; return `id-${++ids.value}` }, now: () => "2026-11-13T00:00:00Z" })
    const raw: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", installationId: "installation", projectId: "project", refId: "annual-source", refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: "version", incarnation: "source-inc", version: 7, fields: ["amount"], period: { start: "2027-01-01", end: "2027-12-31" }, projectionDigest: "a".repeat(64) } }
    const ref = { ...raw, refDigest: digestSfEvidenceRef(raw) }
    const draft = { kind: "clarification" as const, sourceRef: ref.refId, sourceIncarnation: ref.target.incarnation, observedVersion: 7, period: { start: "2027-01-01", end: "2027-01-31" }, recipientRef: "recipient-B", body: "January question", evidenceRefs: [ref] }
    expect((await threads.create({ ...draft, recipientRef: "recipient-C" }, { expectedStorageVersion: 0, idempotencyKey: "wrong-recipient" }, context)).status).toBe("unavailable")
    ids.revokeRecipient = true
    expect(await threads.create(draft, { expectedStorageVersion: 0, idempotencyKey: "january" }, context)).toMatchObject({ status: "conflict", reason: "thread-not-committed" })
    access.add("recipient-B")
    const january = await threads.create(draft, { expectedStorageVersion: 0, idempotencyKey: "january" }, context)
    const february = await threads.create({ ...draft, body: "February question", period: { start: "2027-02-01", end: "2027-02-28" } }, { expectedStorageVersion: 1, idempotencyKey: "february" }, context)
    if (january.status !== "ok" || february.status !== "ok") throw new Error("Questions were not persisted")
    expect(january.value.id).not.toBe(february.value.id)
    expect(await threads.read(january.value.id, context)).toMatchObject({ status: "ok", value: { recipientRef: "recipient-B", observedVersion: 7, period: draft.period, messages: [{ body: "January question" }] } })
    expect(await threads.read(february.value.id, context)).toMatchObject({ status: "ok", value: { recipientRef: "recipient-B", period: { start: "2027-02-01", end: "2027-02-28" }, messages: [{ body: "February question" }] } })
    access.delete("recipient-B")
    expect(await threads.reply(january.value.id, "January explanation", { expectedStorageVersion: 2, idempotencyKey: "reply" }, context)).toMatchObject({ status: "unavailable", reason: "thread-source-fence-unavailable" })
    expect(await threads.read(january.value.id, context)).toMatchObject({ status: "ok", value: { messages: [{ body: "January question" }] } })
    const refused = await state.read(request, "threads", (stored) => stored.threads[january.value.id])
    expect(refused).toMatchObject({ status: "ok", storageVersion: 2, value: { messages: [{ body: "January question" }] } })
    access.add("recipient-B")
    expect((await threads.reply(january.value.id, "January explanation", { expectedStorageVersion: 2, idempotencyKey: "reply" }, context)).status).toBe("ok")
    expect(await threads.resolve(january.value.id, { expectedStorageVersion: 3, idempotencyKey: "resolve" }, context)).toMatchObject({ status: "ok", value: { state: "resolved", observedVersion: 7, period: draft.period, messages: [{ body: "January question" }, { body: "January explanation" }] } })
    expect(await threads.read(february.value.id, context)).toMatchObject({ status: "ok", value: { state: "open" } })
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: { hotTopics: snapshot.data.hotTopics, procurement: snapshot.data.store } }))).toEqual({ hotTopics: undefined, procurement: undefined })
    access.delete("author")
    expect(await threads.read(january.value.id, context)).toEqual({ status: "denied", reason: "thread-access-unavailable" })
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
