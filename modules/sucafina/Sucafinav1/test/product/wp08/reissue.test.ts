import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createRecipientAwareThreadReads } from "../../../product/collaboration/thread-reads.ts"
import { createThreadAnswerEvidence } from "../../../product/collaboration/evidence.ts"
import { createRecipientThreadActions } from "../../../product/collaboration/recipient-actions.ts"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import { createRecipientThreadReader } from "../../../product/collaboration/recipient-thread.ts"
import { createCollaborationReissuer } from "../../../product/collaboration/reissue.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("reissue checks actor access and the live physical incarnation", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-reissue-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: (_surface, snapshot) => snapshot.data.exists ? [{ recordType: "line", recordId: "A", inputDigest: digestSfValue(snapshot.data.value) }] : [], projectScope: (_surface, snapshot, scope) => snapshot.data.exists && !(scope.principalRef === "A" && snapshot.data.revokeA) ? { amount: snapshot.data.value } : undefined })
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("planner", async (snapshot) => { snapshot.data.exists = true; snapshot.data.value = 10; return { commit: true, value: undefined } })
    const period = { start: "2027-01-01", end: "2027-01-31" }
    const current = { allowed: true }
    const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "B", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const issue = async (principalRef: string): Promise<Extract<BusinessEvidenceRef, { kind: "record" }>> => {
      const scope = { principalRef, accessRevision: "access", policyVersion: "policy", recordType: "line", recordId: "A", selector: { fields: ["amount"], period } }
      const result = await persistence.readScopedSource("planner", scope, async () => current.allowed)
      if (!result) throw new Error("source unavailable")
      const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: randomUUID(), installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "line", recordId: "A", incarnation: result.incarnation, version: result.version, fields: ["amount"], period, projectionDigest: result.inputDigest } }
      return { ...ref, refDigest: digestSfEvidenceRef(ref) }
    }
    const original = await issue("A")
    const host = { persistence, requestFor: () => new Request("https://example.test/"), revalidate: async () => current.allowed } as unknown as DomainPortHost
    const evidence = createSfBusinessContext({ revalidate: async () => current.allowed, resolveSource: async (ref, binding) => {
      const source = ref.kind === "record" ? await persistence.resolveScopedSource(ref.target.surface, ref.target.incarnation, async (_snapshot, scope) => current.allowed && scope.principalRef === binding.binding.principalRef) : undefined
      return { state: source && ref.kind === "record" && source.version === ref.target.version && source.inputDigest === ref.target.projectionDigest ? "fresh" : "unavailable", ref, accessRevision: binding.binding.accessRevision, checkedAt: "2026-11-13T00:00:00Z" }
    }, proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "not used" }) })
    const reissue = createCollaborationReissuer({ host, issueForActor: async () => ({ status: "ok", value: await issue("B") }), authorize: async (ref, binding) => (await evidence.resolve(ref, binding)).state === "fresh" })
    const result = await reissue(original, context)
    expect(result).toMatchObject({ status: "ok", value: { target: { recordId: "A", fields: ["amount"], period } } })
    if (result.status === "ok") expect(result.value.target.incarnation).not.toBe(original.target.incarnation)
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "workspace-inc" }), authorize: async () => ({ principalRef: "B", accessRevision: "access", policyVersion: "policy" }) })
    const saved = await state.transaction(new Request("https://example.test/"), { namespace: "threads", expectedStorageVersion: 0, targetRef: "workspace", targetIncarnation: "workspace-inc", idempotencyKey: "seed", commandDigest: "a".repeat(64) }, async (snapshot) => {
      snapshot.threads.thread = { id: "thread", kind: "clarification", sourceRef: original.refId, sourceIncarnation: original.target.incarnation, observedVersion: original.target.version, period, recipientRef: "B", state: "open", messages: [{ id: "message", incarnation: "message-inc", version: 1, authorRef: "A", body: "Why?", createdAt: "2026-11-13T00:00:00Z" }], evidenceRefs: [original] }
      return { commit: true, value: true }
    })
    if (saved.status !== "ok") throw new Error("thread fixture failed")
    const reader = createRecipientThreadReader({ state, host, reissue, authorize: async (refs, binding) => (await evidence.context({ refs }, binding)).every((entry) => entry.state === "fresh") })
    const projected = await reader("thread", context)
    expect(projected).toMatchObject({ status: "ok", value: { observed: { version: 1, period }, current: { sourceRef: { target: { recordId: "A" } } }, messages: [{ body: "Why?" }] } })
    if (projected.status === "ok") {
      expect(projected.value.current.sourceRef.refId).not.toBe(original.refId)
      expect(JSON.stringify(projected.value)).not.toContain(original.target.incarnation)
      expect(JSON.stringify(projected.value)).not.toContain(original.refId)
      const repeated = await reader("thread", context)
      if (repeated.status !== "ok") throw new Error("repeat projection failed")
      expect(repeated.value.current.sourceRef).toEqual(projected.value.current.sourceRef)
    }
    const ui = createSfUiAuthority({ authorize: async () => current.allowed ? { installationId: "install", projectId: "project", principalRef: "B", policyVersion: "policy", accessRevision: "access" } : undefined, commandIdentity: async () => "command", createId: randomUUID, now: () => Date.parse("2026-11-13T00:00:00Z"), privateCommands: ["sf-human:collaboration.thread.reply"] })
    const human = createSfHumanAuthority({ origin: "https://example.test", ui })
    const mutation = { expectedStorageVersion: 1, idempotencyKey: "reply" }
    const admitted = await human.admit(new Request("https://example.test/action", { method: "POST", headers: { origin: "https://example.test" } }), "collaboration.thread.reply", { id: "thread", body: "Because", mutation })
    if (admitted.status !== "ok") throw new Error("recipient admission failed")
    const actions = createRecipientThreadActions({ state, host: { requestFor: (binding) => binding.kind === "ui" ? ui.requestFor(binding) : undefined, revalidate: async (binding) => binding.kind === "ui" && await ui.revalidate(binding) }, human, mutationFence: createCollaborationMutationFence({ persistence: store }), read: reader, creationTarget: { ref: "workspace", incarnation: "workspace-inc" }, createId: randomUUID, now: () => "2026-11-13T00:00:00Z" })
    const replied = await actions.reply("thread", "Because", mutation, admitted.value)
    expect(replied).toMatchObject({ status: "ok", value: { messages: [{ body: "Why?" }, { body: "Because", authorRef: "B" }] } })
    if (replied.status === "ok") {
      expect(JSON.stringify(replied.value)).not.toContain(original.target.incarnation)
      const reads = createRecipientAwareThreadReads({ read: async () => ({ status: "unavailable", reason: "foreign-scope" }) }, reader)
      const answer = createThreadAnswerEvidence(reads)
      const issued = await answer.issue("thread", replied.value.messages.at(-1)!.id, context)
      expect(issued).toMatchObject({ status: "ok", value: { evidenceLevel: "claim", target: { recordType: "sf-thread-answer" } } })
      if (issued.status === "ok") expect(await answer.resolve(issued.value.refId, context)).toEqual(issued)
    }
    current.allowed = false
    expect((await reissue(original, context)).status).not.toBe("ok")
    expect((await reader("thread", context)).status).not.toBe("ok")
    current.allowed = true
    await persistence.transaction("planner", async (snapshot) => { snapshot.data.revokeA = true; return { commit: true, value: undefined } })
    expect((await reissue(original, context)).status).toBe("ok")
    await persistence.transaction("planner", async (snapshot) => { snapshot.data.value = 11; return { commit: true, value: undefined } })
    const updated = await reissue(original, context)
    expect(updated).toMatchObject({ status: "ok", value: { target: { recordId: "A", version: 2 } } })
    await persistence.transaction("planner", async (snapshot) => { snapshot.data.exists = false; return { commit: true, value: undefined } })
    await persistence.transaction("planner", async (snapshot) => { snapshot.data.exists = true; return { commit: true, value: undefined } })
    expect((await reissue(original, context)).status).not.toBe("ok")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
