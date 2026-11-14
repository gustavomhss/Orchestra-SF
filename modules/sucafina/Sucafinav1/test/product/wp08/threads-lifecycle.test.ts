import { expect, test } from "bun:test"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { object, rows } from "../../../runtime/contract.ts"
import type { CollaborationThread } from "../../../product/collaboration/threads.ts"
import { available, createRelationsFixture } from "./relations-fixture.ts"

test("canonical contextual conversations preserve all business snapshots and fail closed for changed, removed or restricted sources", async () => {
  const fixture = await createRelationsFixture()
  try {
    const source = available(await fixture.records.issue({ page: "All Projects", recordType: "projects", recordId: "project", fields: ["name", "status"], period: fixture.period }, fixture.read))
    const january = { start: "2026-01-01", end: "2026-01-31" }
    const february = { start: "2026-02-01", end: "2026-02-28" }
    const scenarios = [...(["comment", "clarification", "review"] as const).map((kind) => ({ kind, period: january })), { kind: "comment" as const, period: february }]
    const conversations: CollaborationThread[] = []
    for (const [index, { kind, period }] of scenarios.entries()) {
      const draft = { kind, sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period, ...(kind === "comment" ? {} : { recipientRef: fixture.person.id }), body: `${kind} context ${period.start}`, evidenceRefs: [source] }
      const mutation = { expectedStorageVersion: index, idempotencyKey: `create-${kind}-${period.start}` }
      const thread = available(await fixture.threads.create(draft, mutation, await fixture.admit("collaboration.thread.create", { draft, mutation })))
      conversations.push(thread)
      expect(await fixture.threads.read(thread.id, fixture.read)).toMatchObject({ status: "ok", value: { kind, sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period, state: "open", messages: [{ authorRef: fixture.person.id, body: `${kind} context ${period.start}` }] } })
    }
    const comments = conversations.filter((thread) => thread.kind === "comment")
    expect(comments.map((thread) => ({ sourceRef: thread.sourceRef, period: thread.period, body: thread.messages[0]!.body }))).toEqual([{ sourceRef: source.refId, period: january, body: "comment context 2026-01-01" }, { sourceRef: source.refId, period: february, body: "comment context 2026-02-01" }])
    expect(comments[0]!.id).not.toBe(comments[1]!.id)
    const before = await fixture.snapshots()
    expect(rows(before.dashboard.data.hotTopics)).toMatchObject([{ id: "topic", status: "open" }])
    expect(Object.values(object(object(before.procurement.data.store).requests)).map((entry) => object(entry).request)).toMatchObject([{ status: "draft", pr: { estAmount: 75 } }])
    expect(rows(before.planner.data.versions)).toMatchObject([{ id: "planner-version", year: 2027, locked: false }])
    for (const [index, thread] of conversations.entries()) {
      const mutation = { expectedStorageVersion: conversations.length + index, idempotencyKey: `reply-${thread.id}` }
      const body = `${thread.kind} explanation ${thread.period.start}`
      expect((await fixture.threads.reply(thread.id, body, mutation, await fixture.admit("collaboration.thread.reply", { id: thread.id, body, mutation }))).status).toBe("ok")
    }
    for (const [index, thread] of conversations.entries()) {
      const mutation = { expectedStorageVersion: conversations.length * 2 + index, idempotencyKey: `resolve-${thread.id}` }
      expect((await fixture.threads.resolve(thread.id, mutation, await fixture.admit("collaboration.thread.resolve", { id: thread.id, mutation }))).status).toBe("ok")
      expect(await fixture.threads.read(thread.id, fixture.read)).toMatchObject({ status: "ok", value: { kind: thread.kind, state: "resolved", sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: thread.period, messages: [{ authorRef: fixture.person.id, body: `${thread.kind} context ${thread.period.start}` }, { authorRef: fixture.person.id, body: `${thread.kind} explanation ${thread.period.start}` }] } })
    }
    // Full domain data, physical versions, source identities, sequences, notices and audit stay equal.
    // Only the owned __sfProductV1 namespace is excluded by the fixture.
    expect(await fixture.snapshots()).toEqual(before)
    await fixture.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: before.dashboard.versions["projects:project"]!.version, values: { notes: "Changed outside the selected source fields" } })
    const outsideScope = await fixture.snapshots()
    expect(rows(outsideScope.dashboard.data.projects)).toMatchObject([{ id: "project", notes: "Changed outside the selected source fields" }])
    expect(outsideScope.dashboard.versions["projects:project"]!.version).toBe(before.dashboard.versions["projects:project"]!.version + 1)
    for (const thread of conversations) {
      expect(await fixture.threads.read(thread.id, fixture.read)).toMatchObject({ status: "ok", value: { sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: thread.period, state: "resolved", messages: [{ body: `${thread.kind} context ${thread.period.start}` }, { body: `${thread.kind} explanation ${thread.period.start}` }] } })
    }
    expect(await fixture.snapshots()).toEqual(outsideScope)
    fixture.gate.dashboard = false
    for (const thread of conversations) expect(await fixture.threads.read(thread.id, fixture.read)).toEqual({ status: "unavailable", reason: "thread-access-unavailable" })
    fixture.gate.dashboard = true
    for (const thread of conversations) expect((await fixture.threads.read(thread.id, fixture.read)).status).toBe("ok")
    expect(await fixture.snapshots()).toEqual(outsideScope)
    await fixture.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: outsideScope.dashboard.versions["projects:project"]!.version, values: { status: "On Hold" } })
    const materiallyChanged = await fixture.snapshots()
    expect(rows(materiallyChanged.dashboard.data.projects)).toMatchObject([{ id: "project", status: "On Hold" }])
    for (const thread of conversations) {
      // Current producers reject stale material projections. This does not prove a historical C05 reader.
      expect(await fixture.threads.read(thread.id, fixture.read)).toEqual({ status: "unavailable", reason: "thread-access-unavailable" })
      expect(await fixture.state.read(fixture.request(), "threads", (state) => state.threads[thread.id])).toMatchObject({ status: "ok", storageVersion: conversations.length * 3, value: { sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: thread.period, messages: [{ body: `${thread.kind} context ${thread.period.start}` }, { body: `${thread.kind} explanation ${thread.period.start}` }] } })
    }
    expect(await fixture.snapshots()).toEqual(materiallyChanged)
    await fixture.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "delete", id: "project", version: materiallyChanged.dashboard.versions["projects:project"]!.version, values: {} })
    const deleted = await fixture.snapshots()
    expect(rows(deleted.dashboard.data.projects)).toEqual([])
    for (const thread of conversations) expect(await fixture.threads.read(thread.id, fixture.read)).toEqual({ status: "unavailable", reason: "thread-access-unavailable" })
    expect(await fixture.snapshots()).toEqual(deleted)
    expect(deleted.procurement).toEqual(before.procurement)
    expect(deleted.planner).toEqual(before.planner)
  } finally {
    await fixture.dispose()
  }
})
