import { expect, test } from "bun:test"
import { createHotTopicPort } from "../../../product/dashboard/hot-topics.ts"
import type { HotTopic, HotTopicHost } from "../../../product/dashboard/hot-topics.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { Snapshot } from "../../../runtime/contract.ts"

const binding = {} as TrustedDomainContext
const source = { schema: "sf-evidence-v1", refId: "source", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "project", recordId: "p", incarnation: "1", version: 1, fields: ["name"], projectionDigest: "digest" } } as BusinessEvidenceRef

test("canonical hot topic retries once, detects changed intent and follows completion", async () => {
  const state: Snapshot = { data: { members: [{ id: "person", name: "Private" }] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const correlations: Record<string, { digest: string; id: string; result?: HotTopic }> = {}
  const actor = { id: "leader", roles: ["domain leader"], canWrite: true }
  const access = { enabled: true }
  let next = 0
  const host: HotTopicHost = { transact: async (_binding, refs, work) => {
    if (!access.enabled || !refs.length) return { status: "denied", reason: "source-denied" }
    const snapshot = structuredClone(state)
    const pending = structuredClone(correlations)
    const result = work(snapshot, actor, { at: "2026-11-13T00:00:00Z", id: () => `topic-${++next}`, directory: [] }, pending)
    if (result.commit) {
      Object.assign(state, snapshot)
      Object.assign(correlations, pending)
    }
    return result.value
  } }
  const port = createHotTopicPort(host)
  const intent = { correlationKey: "handoff", sourceRefs: [source], action: "Review project", owner: "owner", due: "2026-12-01", priority: "high" as const, notes: "" }
  expect(await port.create({ ...intent, action: 7 } as unknown as typeof intent, binding)).toMatchObject({ status: "needs-input" })
  const created = await port.create(intent, binding)
  expect(created).toMatchObject({ status: "ok", value: { state: "created", topic: { id: "topic-1", version: 1 } } })
  expect(await port.create(intent, binding)).toMatchObject({ status: "ok", value: { state: "existing", topic: { id: "topic-1" } } })
  expect(await port.create({ ...intent, action: "Different intent" }, binding)).toMatchObject({ status: "conflict" })
  actor.id = "another-leader"
  expect(await port.create(intent, binding)).toMatchObject({ status: "conflict" })
  actor.id = "leader"
  expect(await port.update({ id: "topic-1", version: 0, idempotencyKey: "stale", sourceRefs: [source], values: { status: "done" } }, binding)).toMatchObject({ status: "conflict" })
  const update = { id: "topic-1", version: 1, idempotencyKey: "finish", sourceRefs: [source], values: { status: "done" } }
  expect(await port.update(update, binding)).toMatchObject({ status: "ok", value: { status: "done", version: 2 } })
  expect(await port.update(update, binding)).toMatchObject({ status: "ok", value: { status: "done", version: 2 } })
  expect(await port.read("topic-1", [source], binding)).toMatchObject({ status: "ok", value: { status: "done" } })
  expect((state.data.hotTopics as unknown[]).length).toBe(1)
  expect(state.audit.every((entry) => !entry.record.startsWith("members:"))).toBe(true)
  actor.canWrite = false
  expect(await port.create(intent, binding)).toMatchObject({ status: "denied" })
  expect(await port.update(update, binding)).toMatchObject({ status: "denied" })
  actor.canWrite = true
  access.enabled = false
  expect(await port.create(intent, binding)).toMatchObject({ status: "denied" })
})

test("action input is fixed before asynchronous host authorization", async () => {
  const state: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  const actor = { id: "leader", roles: ["domain leader"], canWrite: true }
  const host: HotTopicHost = { transact: async (_binding, _refs, work) => {
    await Promise.resolve()
    return work(state, actor, { at: "2026-11-13T00:00:00Z", id: () => "topic", directory: [] }, {}).value
  } }
  const request = { correlationKey: "key", sourceRefs: [source], action: "Original", owner: "owner", due: "2026-12-01", priority: "high" as const, notes: "" }
  const pending = createHotTopicPort(host).create(request, binding)
  request.action = "Changed after call"
  request.sourceRefs.length = 0
  expect(await pending).toMatchObject({ status: "ok", value: { topic: { action: "Original" } } })
})
