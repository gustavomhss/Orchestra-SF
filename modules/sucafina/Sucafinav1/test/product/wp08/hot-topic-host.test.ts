import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import { createCollaborationHotTopicHost } from "../../../product/collaboration/hot-topic-host.ts"
import { createHotTopicPort } from "../../../product/dashboard/hot-topics.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("SQLite commits the Hot Topic and its correlation together and revalidates source access", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-hot-topic-host-"))
  await chmod(directory, 0o700)
  const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "person-A", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const source = { schema: "sf-evidence-v1", refId: "project-A", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "projects", recordId: "project-A", incarnation: "inc-A", version: 1, fields: ["name"], projectionDigest: "b".repeat(64) } } as const
  const gate = { allowed: true, revokeAfter: 0 }
  const ids = { n: 0 }
  const open = async () => {
    const store = await openLocalStore(directory)
    const request = new Request("https://example.test/", { headers: { "x-test-principal": "person-A" } })
    const authenticate = async (candidate: Request) => candidate.headers.get("x-test-principal") === "person-A" && gate.allowed ? { id: "person-A", canWrite: true, roles: [{ surface: "dashboard" as const, role: "domain leader" }] } : null
    const host = { persistence: store, authenticate, environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => { ids.n++; if (gate.revokeAfter > 0 && --gate.revokeAfter === 0) gate.allowed = false; return `id-${ids.n}` }, directory: [{ id: "person-A", name: "Owner" }] }), requestFor: () => request, revalidate: async () => gate.allowed }
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", authorize: async (candidate) => await authenticate(candidate) ? { principalRef: "person-A", policyVersion: "policy", accessRevision: "access" } : undefined, resolveTarget: async (_request, _snapshot, _namespace, ref) => ref === "project-A" && gate.allowed ? { incarnation: "inc-A" } : undefined })
    const evidence: BusinessContextService = { context: async ({ refs }) => store.transaction("dashboard", async () => ({ commit: false, value: gate.allowed && refs.every((ref) => ref.refId === "project-A") ? refs.map((ref) => ({ state: "fresh" as const, ref, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" })) : [] })), resolve: async () => { throw new Error("not used") }, recall: async () => [], emitFromLedger: async () => { throw new Error("not used") } }
    return { store, port: createHotTopicPort(createCollaborationHotTopicHost({ mutationFence: createCollaborationMutationFence({ persistence: store }), authorizeMutation: async () => true, host, state, evidence, creationTarget: { ref: "project-A", incarnation: "inc-A" } })) }
  }
  try {
    const first = await open()
    const intent = { correlationKey: "handoff-1", sourceRefs: [source], action: "Review project", owner: "Owner", due: "2026-12-01", priority: "high" as const, notes: "" }
    const created = await first.port.create(intent, context)
    expect(created).toMatchObject({ status: "ok", value: { state: "created" } })
    if (created.status !== "ok") return
    const id = created.value.topic.id
    await first.store.dispose()
    const reopened = await open()
    expect(await reopened.port.create(intent, context)).toMatchObject({ status: "ok", value: { state: "existing", topic: { id } } })
    const count = await reopened.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: Array.isArray(snapshot.data.hotTopics) ? snapshot.data.hotTopics.length : 0 }))
    expect(count).toBe(1)
    gate.revokeAfter = 2
    expect((await reopened.port.create({ ...intent, correlationKey: "handoff-2", action: "Another action" }, context)).status).toBe("denied")
    const afterFence = await reopened.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: Array.isArray(snapshot.data.hotTopics) ? snapshot.data.hotTopics.length : 0 }))
    expect(afterFence).toBe(1)
    gate.allowed = true
    expect((await reopened.port.create({ ...intent, correlationKey: "handoff-2", action: "Another action" }, context)).status).toBe("ok")
    gate.allowed = false
    expect((await reopened.port.read(id, [source], context)).status).toBe("denied")
    await reopened.store.dispose()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
