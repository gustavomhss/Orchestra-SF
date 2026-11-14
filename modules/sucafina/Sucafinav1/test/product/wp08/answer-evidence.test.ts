import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createThreadPort } from "../../../product/collaboration/threads.ts"
import { createThreadAnswerEvidence } from "../../../product/collaboration/evidence.ts"
import { createThreadHistory } from "../../../product/collaboration/thread-history.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("human answer evidence is a stable claim and disappears when access is revoked", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-answer-evidence-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const binding = (principalRef: string) => ({ kind: "ui", binding: { installationId: "install", projectId: "project", principalRef, requestId: principalRef, policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} }) as unknown as TrustedUiContext
  const access = { allowed: true }
  const ids = { n: 0 }
  const threadHistoryWrites = new WeakSet<object>()
  const source = { schema: "sf-evidence-v1", refId: "source", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "line", recordId: "line-A", incarnation: "inc-A", version: 1, fields: ["amount"], period: { start: "2027-01-01", end: "2027-01-31" }, projectionDigest: "b".repeat(64) } } as const
  try {
    // The canonical provider does not expose the history guard; this fixture proves history/evidence behavior only.
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "workspace-inc" }), authorize: async (request) => {
      const principalRef = request.headers.get("x-test-principal")
      return access.allowed && (principalRef === "A" || principalRef === "B") ? { principalRef, policyVersion: "policy", accessRevision: "access" } : undefined
    } })
    const threads = createThreadPort({ mutationFence: createCollaborationMutationFence({ persistence: store }), human: { authorize: async () => true }, checkRecipientAtCommit: (id) => access.allowed && id === "B", state, creationTarget: { ref: "workspace", incarnation: "workspace-inc" }, host: { requestFor: (context) => new Request("https://example.test/", { headers: { "x-test-principal": context.binding.principalRef } }), revalidate: async () => access.allowed }, authorize: async (thread, context) => access.allowed && (thread.recipientRef === context.binding.principalRef || !("messages" in thread) || thread.messages.some((message) => message.authorRef === context.binding.principalRef)), createId: () => `id-${++ids.n}`, now: () => "2026-11-13T00:00:00Z" })
    const opened = await threads.create({ kind: "clarification", sourceRef: "source", sourceIncarnation: "inc-A", observedVersion: 1, period: { start: "2027-01-01", end: "2027-01-31" }, recipientRef: "B", body: "Why?", evidenceRefs: [source] }, { expectedStorageVersion: 0, idempotencyKey: "open" }, binding("A"))
    if (opened.status !== "ok") throw new Error("thread creation failed")
    const replied = await threads.reply(opened.value.id, "Because", { expectedStorageVersion: 1, idempotencyKey: "answer" }, binding("B"))
    if (replied.status !== "ok") throw new Error("answer failed")
    const message = replied.value.messages.at(-1)!
    const evidence = createThreadAnswerEvidence(threads)
    const issued = await evidence.issue(opened.value.id, message.id, binding("A"))
    expect(issued).toMatchObject({ status: "ok", value: { evidenceLevel: "claim", target: { recordType: "sf-thread-answer", recordId: message.id, incarnation: message.incarnation, version: 1 } } })
    if (issued.status !== "ok") return
    const productContext = { installationId: "install", projectId: "project", principalRef: "A", accessRevision: "access", policyVersion: "policy", surface: "planner", period: { start: "2027-01-01", end: "2027-01-31" }, currency: "USD", sourceRefs: [], capabilities: [] } as const
    const projection = await evidence.project(issued.value, productContext, binding("A"))
    expect(projection).toMatchObject({ status: "ok", value: { context: productContext, values: [
      { id: "body", value: "Because", sourceRefs: [{ evidenceLevel: "claim", refId: issued.value.refId }] },
      { id: "authorRef", value: "B" }, { id: "createdAt", value: "2026-11-13T00:00:00Z" },
    ] } })
    expect((await evidence.project(issued.value, { ...productContext, period: { start: "2027-01-01", end: "2027-12-31" } }, binding("A"))).status).toBe("ok")
    expect((await evidence.project(issued.value, { ...productContext, principalRef: "B" }, binding("A"))).status).toBe("denied")
    expect((await evidence.project(issued.value, { ...productContext, period: { start: "2027-02-01", end: "2027-02-28" } }, binding("A"))).status).toBe("stale")
    expect((await threads.reply(opened.value.id, "Follow-up", { expectedStorageVersion: 2, idempotencyKey: "follow-up" }, binding("A"))).status).toBe("ok")
    expect(await evidence.resolve(issued.value.refId, binding("A"))).toEqual(issued)
    expect(await evidence.belongsToQuestion(opened.value.id, issued.value.refId, binding("A"))).toBe(true)
    expect(await evidence.belongsToQuestion("another-question", issued.value.refId, binding("A"))).toBe(false)
    expect((await evidence.issue(opened.value.id, opened.value.messages[0]!.id, binding("A"))).status).toBe("unavailable")
    const history = createThreadHistory({ state, host: { requestFor: (context) => new Request("https://example.test/", { headers: { "x-test-principal": context.binding.principalRef } }), revalidate: async () => access.allowed }, read: threads.read, human: { authorize: async () => true }, fence: createCollaborationMutationFence({ persistence: store }), target: { ref: "workspace", incarnation: "workspace-inc" }, threadHistoryWrites })
    expect(await history.edit(opened.value.id, message.id, 1, "Second", { expectedStorageVersion: 3, idempotencyKey: "edit-1" }, binding("B"))).toMatchObject({ status: "ok", value: { version: 2 } })
    expect(await history.edit(opened.value.id, message.id, 2, "Third", { expectedStorageVersion: 4, idempotencyKey: "edit-2" }, binding("B"))).toMatchObject({ status: "ok", value: { version: 3 } })
    expect(await history.edit(opened.value.id, message.id, 3, "Fourth", { expectedStorageVersion: 5, idempotencyKey: "edit-3" }, binding("B"))).toMatchObject({ status: "ok", value: { version: 4 } })
    expect(await history.readVersion(opened.value.id, message.id, message.incarnation, 3, binding("A"))).toMatchObject({ status: "ok", value: { message: { body: "Third", version: 3, authorRef: "B" } } })
    access.allowed = false
    expect((await history.readVersion(opened.value.id, message.id, message.incarnation, 3, binding("A"))).status).not.toBe("ok")
    expect(await evidence.belongsToQuestion(opened.value.id, issued.value.refId, binding("A"))).toBe(false)
    expect((await evidence.resolve(issued.value.refId, binding("A"))).status).not.toBe("ok")
    expect((await evidence.project(issued.value, productContext, binding("A"))).status).not.toBe("ok")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

