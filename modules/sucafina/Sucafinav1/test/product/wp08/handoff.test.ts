import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import { createCollaborationHumanAuthority } from "../../../product/collaboration/human.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createHandoffPort } from "../../../product/collaboration/handoff.ts"
import { createRelationPort } from "../../../product/collaboration/relations.ts"
import { createHotTopicPort } from "../../../product/dashboard/hot-topics.ts"
import type { HotTopic, HotTopicHost } from "../../../product/dashboard/hot-topics.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { Snapshot } from "../../../runtime/contract.ts"

test("handoff retries the canonical action and keeps the same contextual link", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-handoff-"))
  await chmod(directory, 0o700)
  const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "person-A", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const source = { schema: "sf-evidence-v1", refId: "source", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "projects", recordId: "project-A", incarnation: "inc-A", version: 1, fields: ["name"], projectionDigest: "b".repeat(64) } } as const
  const state: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  const correlations: Record<string, { digest: string; id: string; result?: HotTopic }> = {}
  const host: HotTopicHost = { transact: async (_binding, _refs, work) => {
    const snapshot = structuredClone(state)
    const pending = structuredClone(correlations)
    const result = work(snapshot, { id: "person-A", roles: ["domain leader"], canWrite: true }, { at: "2026-11-13T00:00:00Z", id: () => "topic-1", directory: [] }, pending)
    if (result.commit) { Object.assign(state, snapshot); Object.assign(correlations, pending) }
    return result.value
  } }
  const store = await openLocalStore(directory)
  try {
    const product = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "inc-A" }), authorize: async () => ({ principalRef: "person-A", policyVersion: "policy", accessRevision: "access" }) })
    const permit = Symbol("test")
    const human = { authorize: async () => true }
    const relations = createRelationPort({ mutationFence: createCollaborationMutationFence({ persistence: store }), human, handoffPermit: permit, state: product, host: { requestFor: () => new Request("https://example.test/"), revalidate: async () => true }, authorizePair: async () => true, creationTarget: { ref: "project-A", incarnation: "inc-A" }, createId: () => "relation-1", now: () => "2026-11-13T00:00:00Z" })
    const handoff = createHandoffPort({ human, permit, run: async (_context, _request, work) => work(), hotTopics: createHotTopicPort(host), relations, authorizeIntent: async () => true, resolveTopic: async (topic) => ({ status: "ok", value: { ref: `hotTopics:${topic.id}`, evidence: source } }) })
    const request = { intent: { correlationKey: "handoff-1", sourceRefs: [source], action: "Review project", owner: "selected owner", due: "2026-12-01", priority: "high" as const, notes: "" }, sourceRef: "source", relationStorageVersion: 0, relationKey: "link-1" }
    expect((await handoff.create({ ...request, sourceRef: "unselected" }, context)).status).toBe("denied")
    expect(state.data.hotTopics).toBeUndefined()
    const pending = handoff.create(request, context)
    request.intent.action = "Changed after authorization started"
    const first = await pending
    expect(first).toMatchObject({ status: "ok", value: { state: "created", topic: { id: "topic-1" }, relationId: "relation-1" } })
    if (first.status === "ok") expect(first.value.topic.action).toBe("Review project")
    request.intent.action = "Review project"
    expect(await handoff.create(request, context)).toMatchObject({ status: "ok", value: { state: "existing", topic: { id: "topic-1" }, relationId: "relation-1" } })
    expect((state.data.hotTopics as unknown[]).length).toBe(1)
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})


test("handoff and its relation require the exact real human admission", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-handoff-human-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "install", projectId: "project", principalRef: "person-A", policyVersion: "policy", accessRevision: "access" }), commandIdentity: async () => "command", createId: () => "request", now: () => Date.parse("2026-11-13T00:00:00Z"), privateCommands: ["sf-human:collaboration.handoff.confirm"] })
    const human = createCollaborationHumanAuthority({ origin: "https://example.test", ui })
    const source = { schema: "sf-evidence-v1", refId: "source", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "projects", recordId: "project-A", incarnation: "inc-A", version: 1, fields: ["name"], projectionDigest: "b".repeat(64) } } as const
    const snapshot: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
    const correlations: Record<string, { digest: string; id: string; result?: HotTopic }> = {}
    const hotTopicHost: HotTopicHost = { transact: async (_context, _refs, work) => {
      const staged = structuredClone(snapshot)
      const pending = structuredClone(correlations)
      const result = work(staged, { id: "person-A", roles: ["domain leader"], canWrite: true }, { at: "2026-11-13T00:00:00Z", id: () => "topic-1", directory: [] }, pending)
      if (result.commit) { Object.assign(snapshot, staged); Object.assign(correlations, pending) }
      return result.value
    } }
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "inc-A" }), authorize: async () => ({ principalRef: "person-A", policyVersion: "policy", accessRevision: "access" }) })
    const permit = Symbol("test")
    const relations = createRelationPort({ mutationFence: createCollaborationMutationFence({ persistence: store }), state, human, handoffPermit: permit, host: { requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context) }, authorizePair: async () => true, creationTarget: { ref: "project-A", incarnation: "inc-A" }, createId: () => "relation-1", now: () => "2026-11-13T00:00:00Z" })
    const handoff = createHandoffPort({ human, permit, run: async (_context, _request, work) => work(), hotTopics: createHotTopicPort(hotTopicHost), relations, authorizeIntent: async () => true, resolveTopic: async (topic) => ({ status: "ok", value: { ref: `hotTopics:${topic.id}`, evidence: source } }) })
    const payload = { intent: { correlationKey: "handoff", sourceRefs: [source], action: "Review", owner: "owner", due: "2026-12-01", priority: "high" as const, notes: "" }, sourceRef: "source", relationKey: "link" }
    const request = new Request("https://example.test/action", { method: "POST", headers: { origin: "https://example.test" } })
    const admitted = await human.admit(request, "collaboration.handoff.confirm", payload)
    if (admitted.status !== "ok") throw new Error("human admission failed")
    expect((await handoff.create({ ...payload, relationKey: "altered" }, admitted.value)).status).toBe("denied")
    expect(await handoff.create(payload, admitted.value)).toMatchObject({ status: "ok", value: { topic: { id: "topic-1" }, relationId: "relation-1" } })
    expect((snapshot.data.hotTopics as unknown[]).length).toBe(1)
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

test("handoff update authorizes and reads while the human action lease is active", async () => {
  const context = { kind: "ui", binding: { principalRef: "person" } } as unknown as TrustedUiContext
  const source = { schema: "sf-evidence-v1", kind: "record", refId: "source", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", target: { surface: "dashboard", recordType: "projects", recordId: "p", incarnation: "inc", version: 1, fields: ["name"], projectionDigest: "digest" } } as const
  const topic = { id: "topic", version: 2, action: "Review", owner: "", due: "2026-12-15", status: "open", priority: "normal", notes: "" }
  const lease = { active: false }
  const port = createHandoffPort({
    hotTopics: { create: async () => ({ status: "unavailable", reason: "unused" }), read: async () => ({ status: "ok", value: topic }), update: async () => ({ status: "ok", value: topic }) },
    relations: { storageVersion: async () => ({ status: "ok", value: 0 }), createHandoff: async () => ({ status: "ok", value: { id: "relation" } as never }) },
    human: { authorize: async () => true }, permit: Symbol("test"),
    run: async (_context, _request, work) => { lease.active = true; try { return await work() } finally { lease.active = false } },
    authorizeIntent: async () => false, authorizeUpdate: async () => lease.active,
    resolveTopic: async () => ({ status: "ok", value: { ref: "topic-ref", evidence: source } }),
  })
  expect(await port.update({ topicId: "topic", expectedVersion: 1, idempotencyKey: "update", values: { due: "2026-12-15" }, sourceRefs: [source], sourceRef: "source", relationKey: "link" }, context)).toMatchObject({ status: "ok", value: { state: "updated", relationId: "relation" } })
  expect(lease.active).toBe(false)
})

