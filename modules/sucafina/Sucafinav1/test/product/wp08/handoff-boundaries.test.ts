import { expect, test } from "bun:test"
import { createHandoffPort } from "../../../product/collaboration/handoff.ts"
import { createHotTopicPort } from "../../../product/dashboard/hot-topics.ts"
import type { HotTopic } from "../../../product/dashboard/hot-topics.ts"
import { hotTopicHostFixture } from "../wp02/hot-topic-host-fixture.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

async function fixture() {
  const context = { kind: "ui", binding: { principalRef: "person" } } as unknown as TrustedUiContext
  const source = { schema: "sf-evidence-v1", kind: "record", refId: "source", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", target: { surface: "dashboard", recordType: "projects", recordId: "p", incarnation: "inc", version: 1, fields: ["name"], projectionDigest: "digest" } } as const
  const snapshot: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  const correlations: Record<string, { digest: string; id: string; result?: HotTopic }> = {}
  const control = { allowed: true, revokeInRun: false, loseResponse: false, wrongReadback: false, links: 0 }
  const persisted = await hotTopicHostFixture({
    state: snapshot, correlations,
    actor: { id: "person", roles: ["domain leader"], canWrite: true },
    environment: { at: "2026-11-13T00:00:00Z", id: () => "topic-1", directory: [] },
  })
  const producer = createHotTopicPort(persisted.host)
  const port = createHandoffPort({
    hotTopics: {
      create: async (request, current) => {
        const result = await producer.create(request, current)
        if (control.loseResponse && result.status === "ok") { control.loseResponse = false; throw new Error("synthetic response loss after commit") }
        return result
      },
      read: async (id, refs, current) => {
        const result = await producer.read(id, refs, current)
        return control.wrongReadback && result.status === "ok" ? { status: "ok", value: { ...result.value, id: "unrelated-topic" } } : result
      },
    },
    relations: { storageVersion: async () => ({ status: "ok", value: 0 }), createHandoff: async () => { control.links++; return { status: "ok", value: { id: "relation" } as never } } },
    human: { authorize: async () => true }, permit: Symbol("test"),
    run: async (_context, _request, work) => { if (control.revokeInRun) control.allowed = false; return work() },
    authorizeIntent: async () => control.allowed,
    resolveTopic: async (topic) => ({ status: "ok", value: { ref: "topic-ref", evidence: { ...source, refId: "topic-ref", target: { ...source.target, recordType: "hotTopics", recordId: topic.id, fields: ["status"] } } } }),
  })
  const request = { intent: { correlationKey: "handoff", sourceRefs: [source], action: "Review source", owner: "", due: "2026-12-01", priority: "normal" as const, notes: "" }, sourceRef: "source", relationKey: "link" }
  return { port, producer, source, context, control, snapshot, request, close: persisted.close }
}

test("response loss after canonical commit recovers the same topic and no substitute action", async () => {
  const run = await fixture()
  try {
    run.control.loseResponse = true
    expect(await run.port.create(run.request, run.context)).toEqual({ status: "unavailable", reason: "action-outcome-unknown-retry-same-correlation" })
    expect(run.control.links).toBe(0)
    expect(run.snapshot.data.hotTopics).toHaveLength(1)
    expect(await run.port.create(run.request, run.context)).toMatchObject({ status: "ok", value: { state: "existing", topic: { id: "topic-1" }, relationId: "relation" } })
    expect(run.snapshot.data.hotTopics).toHaveLength(1)
    expect(run.control.links).toBe(1)
    expect(await run.port.create({ ...run.request, intent: { ...run.request.intent, action: "Different intent" } }, run.context)).toMatchObject({ status: "conflict", reason: "correlation-reused" })
    expect(run.snapshot.data.hotTopics).toHaveLength(1)
    expect(run.control.links).toBe(1)
  } finally {
    await run.close()
  }
})

test("revocation at entry to the handoff mutation scope denies before the action", async () => {
  const run = await fixture()
  try {
    run.control.revokeInRun = true
    expect(await run.port.create(run.request, run.context)).toEqual({ status: "denied", reason: "handoff-access-unavailable" })
    expect(run.snapshot.data.hotTopics).toBeUndefined()
    expect(run.control.links).toBe(0)
  } finally {
    await run.close()
  }
})

test("a readback of another action never reports a confirmed handoff", async () => {
  const run = await fixture()
  try {
    run.control.wrongReadback = true
    expect(await run.port.create(run.request, run.context)).toEqual({ status: "unavailable", reason: "action-readback-unconfirmed" })
    expect(run.snapshot.data.hotTopics).toHaveLength(1)
  } finally {
    await run.close()
  }
})

test("explicit linking uses an existing canonical action without updating its domain record", async () => {
  const run = await fixture()
  try {
    const created = await run.producer.create(run.request.intent, run.context)
    if (created.status !== "ok") throw new Error("canonical action unavailable")
    const before = structuredClone(run.snapshot)
    const topic = { ...run.source, refId: "selected-topic", target: { ...run.source.target, recordType: "hotTopics", recordId: created.value.topic.id, version: 9, fields: ["status"] } }
    const selected = { topicRef: topic.refId, sourceRef: run.source.refId, sourceRefs: [run.source, topic], relationKey: "existing-action-link" }
    expect(await run.port.link(selected, run.context)).toMatchObject({ status: "ok", value: { state: "linked", topic: { id: "topic-1" }, relationId: "relation" } })
    expect(run.snapshot).toEqual(before)
    expect(run.control.links).toBe(1)
    run.control.allowed = false
    expect(await run.port.link(selected, run.context)).toMatchObject({ status: "denied" })
    expect(run.snapshot).toEqual(before)
    expect(run.control.links).toBe(1)
  } finally {
    await run.close()
  }
})
