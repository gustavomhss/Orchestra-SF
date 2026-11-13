import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import { createRelationPort } from "../../../product/collaboration/relations.ts"
import { createThreadPort } from "../../../product/collaboration/threads.ts"
import { createConfirmationPort } from "../../../product/collaboration/confirmation.ts"
import { createQuestionSource } from "../../../product/collaboration/question-source.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("relations and contextual threads persist, retry and hide after access revocation", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-collaboration-"))
  await chmod(directory, 0o700)
  const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "person-A", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const access = { allowed: true }
  const ids = { n: 0 }
  const evidence = { schema: "sf-evidence-v1", refId: "source", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "line", recordId: "line-A", incarnation: "inc-A", version: 1, fields: ["amount"], period: { start: "2027-01-01", end: "2027-01-31" }, projectionDigest: "b".repeat(64) } } as const
  const open = async () => {
    const store = await openLocalStore(directory)
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "inc-A" }), authorize: async () => ({ principalRef: "person-A", policyVersion: "policy", accessRevision: "access" }) })
    const host = { requestFor: () => new Request("https://example.test/"), revalidate: async () => true }
    const common = { state, host, mutationFence: createCollaborationMutationFence({ persistence: store }), human: { authorize: async () => access.allowed }, createId: () => `id-${++ids.n}`, now: () => "2026-11-13T00:00:00Z" }
    return { store, relations: createRelationPort({ ...common, handoffPermit: Symbol("test"), authorizePair: async () => access.allowed, creationTarget: { ref: "line-A", incarnation: "inc-A" } }), threads: createThreadPort({ ...common, creationTarget: { ref: "line-A", incarnation: "inc-A" }, authorize: async () => access.allowed }) }
  }
  try {
    const first = await open()
    const pair = { fromRef: "line-A", toRef: "request-B", kind: "line-request", evidenceRefs: [evidence] }
    const pending = first.relations.create(pair, { expectedStorageVersion: 0, idempotencyKey: "relation-1" }, context)
    pair.toRef = "request-C"
    const relation = await pending
    expect(relation.status).toBe("ok")
    if (relation.status === "ok") expect(relation.value.toRef).toBe("request-B")
    pair.toRef = "request-B"
    expect(await first.relations.create(pair, { expectedStorageVersion: 0, idempotencyKey: "relation-1" }, context)).toEqual(relation)
    const thread = await first.threads.create({ kind: "clarification", sourceRef: "source", sourceIncarnation: "inc-A", observedVersion: 1, period: { start: "2027-01-01", end: "2027-01-31" }, recipientRef: "person-B", body: "Why?", evidenceRefs: [evidence] }, { expectedStorageVersion: 0, idempotencyKey: "thread-1" }, context)
    expect(thread.status).toBe("ok")
    if (thread.status !== "ok") return
    expect(await createQuestionSource(first.threads)(thread.value.id, context)).toMatchObject({ status: "ok", value: { id: thread.value.id, text: "Why?", evidenceRefs: [evidence] } })
    const reply = await first.threads.reply(thread.value.id, "Because", { expectedStorageVersion: 1, idempotencyKey: "reply-1" }, context)
    expect(reply.status).toBe("ok")
    expect(await first.threads.reply(thread.value.id, "Because", { expectedStorageVersion: 1, idempotencyKey: "reply-1" }, context)).toEqual(reply)
    await first.store.dispose()
    const reopened = await open()
    expect((await reopened.threads.read(thread.value.id, context)).status).toBe("ok")
    access.allowed = false
    expect((await reopened.threads.read(thread.value.id, context)).status).toBe("unavailable")
    expect((await createQuestionSource(reopened.threads)(thread.value.id, context)).status).toBe("unavailable")
    expect(await reopened.relations.read(["line-A"], context)).toEqual({ status: "ok", value: { relations: [] } })
    await reopened.store.dispose()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("confirmation keeps the observed version while current scope and access are rechecked", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-confirmation-"))
  await chmod(directory, 0o700)
  const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "person-A", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const current = { accessible: true, version: 8, fingerprint: "january-v1", race: false, reads: 0 }
  const store = await openLocalStore(directory)
  try {
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "inc-A" }), authorize: async () => ({ principalRef: "person-A", policyVersion: "policy", accessRevision: "access" }) })
    const ids = { n: 0 }
    const port = createConfirmationPort({ human: { authorize: async () => true }, state, host: { requestFor: () => new Request("https://example.test/"), revalidate: async () => true }, observe: async () => { if (current.race && ++current.reads === 2) current.fingerprint = "january-v2"; return current.accessible ? { state: "available", sourceVersion: current.version, incarnation: "inc-A", physicalIncarnation: "physical-A", scopeFingerprint: current.fingerprint, sourceFingerprint: current.fingerprint, dependencyFingerprint: "dependencies-v1" } : { state: "access-unavailable", sourceVersion: current.version } }, fence: async (_scope, observed) => current.accessible && current.fingerprint === observed.scopeFingerprint, verifyObserved: async () => ({ physicalIncarnation: "physical-A", sourceFingerprint: current.fingerprint, dependencyFingerprint: "dependencies-v1" }), creationTarget: { ref: "line-A", incarnation: "inc-A" }, createId: () => `id-${++ids.n}`, now: () => "2026-11-13T00:00:00Z" })
    const command = { scope: { sourceRef: { surface: "planner", type: "line", id: "line-A", incarnation: "inc-A" }, fields: ["amount"], period: { start: "2027-01-01", end: "2027-01-31" }, materialDependencies: [], scopeDefinitionVersion: "1" }, observedSourceVersion: 7, expectedScopeFingerprint: "january-v1", expectedStorageVersion: 0, idempotencyKey: "confirm-1" } as const
    const confirmed = await port.confirm(command, context)
    expect(confirmed.status).toBe("ok")
    if (confirmed.status !== "ok") return
    expect(confirmed.value.observedSourceVersion).toBe(7)
    expect(confirmed.value).not.toHaveProperty("physicalIncarnation")
    expect(confirmed.value).not.toHaveProperty("sourceFingerprint")
    expect(await port.confirm(command, context)).toEqual(confirmed)
    expect(await port.project(confirmed.value.id, context)).toMatchObject({ status: "ok", value: { state: "valid", evaluatedSourceVersion: 8 } })
    const inspected = await port.inspect(confirmed.value.id, context)
    expect(inspected).toMatchObject({ status: "ok", value: { authorId: "person-A", observedSourceVersion: 7, period: command.scope.period, validity: { state: "valid" } } })
    if (inspected.status === "ok") expect(inspected.value).not.toHaveProperty("sourceRef")
    current.race = true
    expect((await port.project(confirmed.value.id, context)).status).toBe("stale")
    current.race = false
    current.fingerprint = "january-v2"
    expect(await port.project(confirmed.value.id, context)).toMatchObject({ status: "ok", value: { state: "stale", reason: "material-change" } })
    expect((await port.confirm({ ...command, idempotencyKey: "confirm-2", expectedStorageVersion: 1 }, context)).status).toBe("conflict")
    current.accessible = false
    const revoked = await port.project(confirmed.value.id, context)
    expect(revoked).toMatchObject({ status: "ok", value: { state: "unavailable" } })
    if (revoked.status === "ok") expect("scopeFingerprint" in revoked.value).toBe(false)
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

test("thread mutation requires the admitted payload again at commit", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-human-fence-"))
  await chmod(directory, 0o700)
  const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "person-A", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const store = await openLocalStore(directory)
  try {
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "inc-A" }), authorize: async () => ({ principalRef: "person-A", policyVersion: "policy", accessRevision: "access" }) })
    const calls: unknown[] = []
    const port = createThreadPort({ mutationFence: createCollaborationMutationFence({ persistence: store }), state, creationTarget: { ref: "line-A", incarnation: "inc-A" }, host: { requestFor: () => new Request("https://example.test/"), revalidate: async () => true }, human: { authorize: async (_context, action, payload) => { calls.push({ action, payload }); return calls.length === 1 } }, authorize: async () => true, createId: () => `id-${calls.length}`, now: () => "2026-11-13T00:00:00Z" })
    const evidence = { schema: "sf-evidence-v1", refId: "source", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "line", recordId: "line-A", incarnation: "inc-A", version: 1, fields: ["amount"], period: { start: "2027-01-01", end: "2027-01-31" }, projectionDigest: "b".repeat(64) } } as const
    const draft = { kind: "comment", sourceRef: "source", sourceIncarnation: "inc-A", observedVersion: 1, period: { start: "2027-01-01", end: "2027-01-31" }, body: "Check", evidenceRefs: [evidence] } as const
    const mutation = { expectedStorageVersion: 0, idempotencyKey: "human-fence" }
    expect((await port.create(draft, mutation, context)).status).not.toBe("ok")
    expect(calls).toEqual([{ action: "collaboration.thread.create", payload: { draft, mutation } }, { action: "collaboration.thread.create", payload: { draft, mutation } }])
    const saved = await state.read(new Request("https://example.test/"), "threads", (snapshot) => Object.keys(snapshot.threads))
    if (saved.status === "ok") expect(saved.value).toEqual([])
    else expect(saved).toMatchObject({ status: "unavailable", reason: "product-state-uninitialized" })
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

test("versioned relations keep immutable identity and cannot reuse a retired id", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-relation-version-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "person-A", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "inc-A" }), authorize: async () => ({ principalRef: "person-A", policyVersion: "policy", accessRevision: "access" }) })
    const relations = createRelationPort({ state, host: { requestFor: () => new Request("https://example.test/"), revalidate: async () => true }, human: { authorize: async () => true }, mutationFence: createCollaborationMutationFence({ persistence: store }), handoffPermit: Symbol("test"), authorizePair: async () => true, creationTarget: { ref: "workspace", incarnation: "inc-A" }, createId: () => "relation-1", now: () => "2026-11-13T00:00:00Z" })
    const source = (refId: string) => ({ schema: "sf-evidence-v1", refId, installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "line", recordId: refId, incarnation: `inc-${refId}`, version: 1, fields: ["amount"], projectionDigest: "b".repeat(64) } }) as const
    const from = source("from")
    const to = source("to")
    const pair = { fromRef: from.refId, toRef: to.refId, kind: "line-request", evidenceRefs: [from, to] }
    expect((await relations.create(pair, { expectedStorageVersion: 0, idempotencyKey: "create" }, context)).status).toBe("ok")
    expect(await relations.readVersioned(["from"], context)).toMatchObject({ status: "ok", value: [{ id: "relation-1", version: 1, from, to, state: "confirmed" }] })
    const removed = await relations.remove("relation-1", pair, { expectedStorageVersion: 1, idempotencyKey: "remove" }, context)
    expect(removed.status).toBe("ok")
    expect(await relations.remove("relation-1", pair, { expectedStorageVersion: 1, idempotencyKey: "remove" }, context)).toEqual(removed)
    expect((await relations.create(pair, { expectedStorageVersion: 2, idempotencyKey: "reuse" }, context)).status).toBe("conflict")
    expect(await relations.readVersioned(["from"], context)).toEqual({ status: "ok", value: [] })
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
