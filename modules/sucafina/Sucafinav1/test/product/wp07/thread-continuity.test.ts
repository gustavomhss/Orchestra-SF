import { expect, test } from "bun:test"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { createReviewThreadComments, createExactReviewThreadSourceMapping } from "../../../product/reviews/thread-access.ts"
import { createThreadHistoryFixture } from "../wp08/thread-history-fixture.ts"
import { available } from "../wp08/relations-fixture.ts"

const sourceOf = (ref: Extract<BusinessEvidenceRef, { kind: "record" }>): SourceRef => ({
  surface: ref.target.surface, type: ref.target.recordType, id: ref.target.recordId, incarnation: ref.target.incarnation,
  version: ref.target.version, fields: ref.target.fields, period: ref.target.period!, observedAt: "2026-11-14T00:00:00Z",
})

// Real C06 threads, per-message history, C08 guard, domain mutation and C17 resolver.
// The fixture's explicit historical grant/archive remains a boundary fixture; this
// test does not claim that the production host already publishes historical C17.
test("review reuse retains each message source version after material change and edit, under current ACL", async () => {
  const f = await createThreadHistoryFixture()
  try {
    const original = available(await f.records.issue({ page: "All Projects", recordType: "projects", recordId: "project", fields: ["name", "status"], period: f.period }, f.read))
    await f.capture(original)
    const port = f.collaboration
    if (!port.threadHistory || !port.recipientActions || !port.recipientThread) throw new Error("Historical producer unavailable")
    const version = async () => available(await port.storageVersion("threads", f.read))
    const draft = { kind: "comment" as const, sourceRef: original.refId, sourceIncarnation: original.target.incarnation, observedVersion: original.target.version, period: f.period, body: "Original project discussion.", evidenceRefs: [original] }
    const mutation = { expectedStorageVersion: await version(), idempotencyKey: "review-history-create" }
    const thread = available(await port.threads.create(draft, mutation, await f.admit("collaboration.thread.create", { draft, mutation })))
    const comments = createReviewThreadComments({
      host: f.host, threads: port.threadReads, history: port.threadHistory, maxMessages: 100,
      authorizeSourceContinuity: port.authorizeThreadSourceContinuity,
      authorizeSourceMapping: createExactReviewThreadSourceMapping({ host: f.host, evidence: f.historyEvidence }),
    })
    const captured = available(await comments.capture(thread.id, [sourceOf(original)], f.read))
    expect(captured[0]?.content).toBe("Original project discussion.")
    const before = await f.snapshots()
    await f.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: before.dashboard.versions["projects:project"]!.version, values: { status: "On Hold" } })
    expect(await comments.authorizeComments(f.read, captured)).toBe(false)
    expect((await comments.capture(thread.id, [sourceOf(original)], f.read)).status).not.toBe("ok")
    f.historical.allowed = true
    expect(await comments.authorizeComments(f.read, captured)).toBe(true)
    const current = available(await port.recipientThread(thread.id, f.read))
    const currentSource = current.current.sourceRef
    const replyBody = "Discussion after the project moved on hold."
    const replyMutation = { expectedStorageVersion: await version(), idempotencyKey: "review-history-reply" }
    const replied = available(await port.recipientActions.reply(thread.id, replyBody, replyMutation, await f.admit("collaboration.thread.reply", { id: thread.id, body: replyBody, mutation: replyMutation })))
    expect(replied.id).toBe(thread.id)
    expect(replied.messages).toHaveLength(2)
    const selected = available(await comments.capture(thread.id, [sourceOf(currentSource)], f.read))
    expect(selected.map((comment) => comment.content)).toEqual(["Original project discussion.", replyBody])
    expect(selected.map((comment) => comment.sourceRefs[0]?.version)).toEqual([original.target.version, currentSource.target.version])
    expect(await comments.authorizeComments(f.read, selected)).toBe(true)
    expect(selected[0]?.sourceRefs[0]?.version).not.toBe(selected[1]?.sourceRefs[0]?.version)
    const forgedBasis = selected.map((comment, index) => index === 0 ? { ...comment, sourceRefs: [sourceOf(currentSource)] } : comment)
    expect(await comments.authorizeComments(f.read, forgedBasis)).toBe(false)
    const message = thread.messages[0]!
    const editedBody = "Edited original project discussion."
    const editMutation = { expectedStorageVersion: await version(), idempotencyKey: "review-history-edit" }
    available(await port.threadHistory.edit(thread.id, message.id, 1, editedBody, editMutation, await f.admit("collaboration.thread.edit", { id: thread.id, messageId: message.id, expectedVersion: 1, body: editedBody, mutation: editMutation })))
    expect(await comments.authorizeComments(f.read, captured)).toBe(true)
    expect(captured[0]?.content).toBe("Original project discussion.")
    expect(available(await comments.capture(thread.id, [sourceOf(currentSource)], f.read))[0]).toMatchObject({ content: editedBody, version: 2, sourceRefs: [{ version: original.target.version }] })
    expect((await comments.capture(thread.id, [{ ...sourceOf(currentSource), incarnation: "replaced-source" }], f.read)).status).not.toBe("ok")
    f.historical.allowed = false
    expect(await comments.authorizeComments(f.read, selected)).toBe(false)
    f.historical.allowed = true
    f.gate.dashboard = false
    const revoked = await comments.capture(thread.id, [sourceOf(currentSource)], f.read)
    expect(revoked.status).not.toBe("ok")
    expect(JSON.stringify(revoked)).not.toContain(replyBody)
    expect(await comments.authorizeComments(f.read, selected)).toBe(false)
  } finally { await f.dispose() }
})
