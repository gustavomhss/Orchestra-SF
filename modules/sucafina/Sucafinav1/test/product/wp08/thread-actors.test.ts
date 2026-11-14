import { expect, test } from "bun:test"
import { DashboardPeople } from "../../../runtime/dashboard-people.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { roleMap } from "../../../runtime/admin.ts"
import { isThread } from "../../../product/collaboration/threads.ts"
import { createExactReviewThreadSourceMapping, createReviewThreadComments } from "../../../product/reviews/thread-access.ts"
import { available } from "./relations-fixture.ts"
import { createThreadActorsFixture } from "./thread-actors-fixture.ts"

test("a selected viewer with a homonym replies across scoped incarnations and current access revisions without gaining domain authority", async () => {
  const fixture = await createThreadActorsFixture()
  try {
    const port = fixture.port
    if (!port.recipientThread || !port.recipientActions || !port.threadHistory || !port.authorizeThreadSourceContinuity) throw new Error("thread consumers missing")
    const source = await fixture.issueProject(fixture.author)
    const recipientSource = await fixture.issueProject(fixture.recipient)
    expect(source.target.incarnation).not.toBe(recipientSource.target.incarnation)
    expect(source.target.projectionDigest).toBe(recipientSource.target.projectionDigest)
    await fixture.capture(source, fixture.author)
    const selectedB = await fixture.select("reader-b", fixture.recipient)
    const selectedC = await fixture.select("reader-c", fixture.homonym)
    const beforeOwner = await fixture.snapshots()
    await fixture.mutate("dashboard", DashboardPeople.domain, { page: "Hot Topics & Actions", action: "save", id: "topic", version: beforeOwner.dashboard.versions["hotTopics:topic"]!.version, values: { owner: "Alex" } })
    // A canonical Hot Topic with a homonymous textual owner is not a personal assignment to either identity.
    expect(available(await port.work.listPresentation(selectedB, fixture.recipient)).items).toEqual([])
    expect(available(await port.work.listPresentation(selectedC, fixture.homonym)).items).toEqual([])
    const version = async () => available(await port.storageVersion("threads", fixture.author))
    const draft = { kind: "review" as const, sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: fixture.period, recipientRef: "reader-b", body: "Review this specific project.", evidenceRefs: [source] }
    const mutation = { expectedStorageVersion: await version(), idempotencyKey: "cross-actor-thread" }
    const created = available(await port.threads.create(draft, mutation, await fixture.admit("person", "collaboration.thread.create", { draft, mutation })))
    const storedThread = async () => {
      const result = await fixture.state.read(fixture.request("person"), "threads", (state) => state.threads[created.id])
      if (result.status !== "ok") throw new Error("canonical thread unavailable")
      return result.value
    }
    expect(available(await port.work.listPresentation(selectedB, fixture.recipient)).items).toMatchObject([{ actionRef: created.id, ownerRef: "reader-b", state: "clarification-open" }])
    expect(available(await port.work.listPresentation(selectedC, fixture.homonym)).items).toEqual([])
    expect((await port.threadReads.read(created.id, fixture.homonym)).status).not.toBe("ok")
    const body = "The project remains in progress."
    const replyMutation = { expectedStorageVersion: await version(), idempotencyKey: "cross-actor-reply" }
    const reply = available(await port.recipientActions.reply(created.id, body, replyMutation, await fixture.admit("reader-b", "collaboration.thread.reply", { id: created.id, body, mutation: replyMutation })))
    expect(reply.messages).toHaveLength(2)
    expect(reply.messages[1]!.sourceContext?.sourceIncarnation).toBe(recipientSource.target.incarnation)
    expect(reply.messages[1]!.sourceContext?.sourceIncarnation).not.toBe(source.target.incarnation)
    expect(isThread(await storedThread())).toBe(true)
    expect(available(await port.threadReads.read(created.id, fixture.author)).messages).toHaveLength(2)
    const topic = available(await fixture.records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic", fields: ["status"], period: { start: "2026-11-13", end: "2026-11-13" } }, fixture.author))
    const handoff = { topicRef: topic.refId, sourceRefs: [source, topic], sourceRef: source.refId, recipientRef: "reader-b", relationKey: "explicit-Alex-B-assignment" }
    const linked = available(await port.handoff.link(handoff, await fixture.admit("person", "collaboration.handoff.confirm", handoff)))
    expect(linked.topic.id).toBe("topic")
    const assigned = available(await port.work.listPresentation(selectedB, fixture.recipient)).items
    expect(assigned).toHaveLength(2)
    expect(assigned.filter((item) => item.kind === "handoff")).toMatchObject([{ ownerRef: "reader-b", destination: { kind: "hot-topic", topicId: "topic" } }])
    expect(available(await port.work.listPresentation(selectedC, fixture.homonym)).items).toEqual([])
    expect(available(await port.handoff.link(handoff, await fixture.admit("person", "collaboration.handoff.confirm", handoff))).topic.id).toBe("topic")
    expect(available(await port.work.listPresentation(selectedB, fixture.recipient)).items).toHaveLength(2)
    const beforeDeniedWrite = await fixture.snapshots()
    const write = await fixture.persistence.transaction("dashboard", async (snapshot) => {
      const principal = await fixture.host.authenticate(fixture.request("reader-b"), { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      if (!principal) throw new Error("viewer authentication missing")
      const actor = { id: principal.id, roles: principal.roles.filter((entry) => entry.surface === "dashboard").map((entry) => entry.role), canWrite: principal.canWrite }
      expect(actor).toEqual({ id: "reader-b", roles: ["viewer"], canWrite: false })
      const result = DashboardPortfolio.domain.execute(snapshot, actor, { page: "All Projects", action: "save", id: "project", version: snapshot.versions["projects:project"]!.version, values: { status: "Completed", budget: 99999 } }, { at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] })
      return { commit: result.ok, value: result }
    })
    expect(write).toMatchObject({ ok: false, status: 403 })
    expect(await fixture.snapshots()).toEqual(beforeDeniedWrite)
    const restricted = await fixture.records.issue({ page: "Vendor Contracts", recordType: "contracts", recordId: "contract", fields: ["amount"], period: fixture.period }, fixture.recipient)
    expect(restricted.status).not.toBe("ok")
    expect(JSON.stringify(restricted)).not.toContain("Selected contract")
    await fixture.capture(reply.current.sourceRef, fixture.recipient)
    fixture.actors["reader-b"]!.access = "b2"
    expect((await port.threadReads.read(created.id, fixture.recipient)).status).not.toBe("ok")
    const renewed = await fixture.admitRead("reader-b")
    const renewedSource = await fixture.issueProject(renewed)
    expect(renewedSource.target.incarnation).not.toBe(recipientSource.target.incarnation)
    const nextBody = "I have reviewed the same source under my renewed access."
    const nextMutation = { expectedStorageVersion: await version(), idempotencyKey: "cross-actor-renewed-reply" }
    const next = available(await port.recipientActions.reply(created.id, nextBody, nextMutation, await fixture.admit("reader-b", "collaboration.thread.reply", { id: created.id, body: nextBody, mutation: nextMutation })))
    expect(next.messages).toHaveLength(3)
    expect(next.messages[2]!.sourceContext?.sourceIncarnation).toBe(renewedSource.target.incarnation)
    expect(isThread(await storedThread())).toBe(true)
    fixture.historical.allowed = true
    const comments = createReviewThreadComments({ host: fixture.host, threads: port.threadReads, history: port.threadHistory, authorizeSourceMapping: createExactReviewThreadSourceMapping({ host: fixture.host, evidence: fixture.evidence }), authorizeSourceContinuity: port.authorizeThreadSourceContinuity, maxMessages: 20 })
    const selectedSources = available(await fixture.records.read(renewedSource.refId, renewed)).context.sourceRefs
    const captured = available(await comments.capture(created.id, selectedSources, renewed))
    expect(captured.map((comment) => comment.content)).toEqual([draft.body, body, nextBody])
    expect(captured.map((comment) => comment.sourceRefs[0]!.incarnation)).toEqual([source.target.incarnation, recipientSource.target.incarnation, renewedSource.target.incarnation])
    expect(await comments.authorizeComments(renewed, captured)).toBe(true)
    fixture.historical.allowed = false
    expect((await comments.capture(created.id, selectedSources, renewed)).status).not.toBe("ok")
    expect(await comments.authorizeComments(renewed, captured)).toBe(false)
    fixture.historical.allowed = true
    fixture.actors["reader-b"]!.enabled = false
    const revoked = await port.threadReads.read(created.id, renewed)
    expect(revoked.status).not.toBe("ok")
    expect(JSON.stringify(revoked)).not.toContain(body)
    expect(await comments.authorizeComments(renewed, captured)).toBe(false)
    expect(available(await port.work.listPresentation(selectedC, fixture.homonym)).items).toEqual([])
  } finally {
    await fixture.dispose()
  }
})
