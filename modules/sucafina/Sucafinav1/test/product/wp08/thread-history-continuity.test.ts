import { expect, test } from "bun:test"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { isThread } from "../../../product/collaboration/threads.ts"
import { createThreadHistoryFixture } from "./thread-history-fixture.ts"
import { available } from "./relations-fixture.ts"

test("authorized historical messages keep their original basis and a new answer reuses the same stale thread", async () => {
  const fixture = await createThreadHistoryFixture()
  try {
    const source = available(await fixture.records.issue({ page: "All Projects", recordType: "projects", recordId: "project", fields: ["name", "status"], period: fixture.period }, fixture.read))
    await fixture.capture(source)
    const port = fixture.collaboration
    if (!port.answerReuse || !port.threadHistory || !port.recipientActions || !port.recipientThread) throw new Error("Collaboration consumers missing")
    const version = async () => available(await port.storageVersion("threads", fixture.read))
    const draft = { kind: "clarification" as const, sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: fixture.period, recipientRef: fixture.person.id, body: "Please explain the project status.", evidenceRefs: [source] }
    const mutation = { expectedStorageVersion: await version(), idempotencyKey: "history-question" }
    const thread = available(await port.threads.create(draft, mutation, await fixture.admit("collaboration.thread.create", { draft, mutation })))
    const body = "The project is in progress."
    const replyMutation = { expectedStorageVersion: await version(), idempotencyKey: "history-answer" }
    const replied = available(await port.threads.reply(thread.id, body, replyMutation, await fixture.admit("collaboration.thread.reply", { id: thread.id, body, mutation: replyMutation })))
    const message = replied.messages[1]!
    const answerRef = available(await port.answerEvidence.issue(thread.id, message.id, fixture.read)).refId
    const observed = available(await port.answerReuse.prepare(thread.id, answerRef, fixture.read))
    const confirmation = { expectedStorageVersion: await version(), idempotencyKey: "history-confirm", observationRef: observed.observationRef, observedSourceVersion: observed.observedSourceVersion, expectedScopeFingerprint: observed.expectedScopeFingerprint }
    available(await port.answerReuse.confirm(thread.id, answerRef, confirmation, await fixture.admit("collaboration.answer.confirm", { questionId: thread.id, answerRef, mutation: confirmation })))
    const resolution = { expectedStorageVersion: await version(), idempotencyKey: "history-resolve" }
    available(await port.threads.resolve(thread.id, resolution, await fixture.admit("collaboration.thread.resolve", { id: thread.id, mutation: resolution })))
    const oldHistory = available(await port.threadHistory.readVersion(thread.id, message.id, message.incarnation, message.version, fixture.read))
    expect(oldHistory).toMatchObject({ message, sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, evidenceRefs: [source], period: fixture.period })
    const before = await fixture.snapshots()
    await fixture.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: before.dashboard.versions["projects:project"]!.version, values: { status: "On Hold" } })
    const changed = await fixture.snapshots()
    // Current source access alone must not reveal the historical body.
    expect((await port.threadReads.readHistorical(thread.id, fixture.read)).status).not.toBe("ok")
    expect((await port.threadHistory.readVersion(thread.id, message.id, message.incarnation, 1, fixture.read)).status).not.toBe("ok")
    fixture.historical.allowed = true
    const historical = available(await port.threadHistory.readVersion(thread.id, message.id, message.incarnation, 1, fixture.read))
    expect(historical).toEqual(oldHistory)
    const current = available(await port.recipientThread(thread.id, fixture.read))
    expect(current.continuity).toBe("historical")
    expect(current.historical).toMatchObject({ sourceRef: source.refId, observedVersion: source.target.version, evidenceRefs: [source] })
    expect(current.current.sourceRef.target.version).toBeGreaterThan(source.target.version)
    expect(await port.answerReuse.read(thread.id, fixture.read)).toMatchObject({ status: "stale", reason: "answer-scope-changed" })
    const newBody = "The project is now on hold."
    const newMutation = { expectedStorageVersion: await version(), idempotencyKey: "same-thread-new-answer" }
    const admitted = await fixture.admit("collaboration.thread.reply", { id: thread.id, body: newBody, mutation: newMutation })
    const next = available(await port.recipientActions.reply(thread.id, newBody, newMutation, admitted))
    expect(next.id).toBe(thread.id)
    expect(next.state).toBe("open")
    expect(next.messages).toHaveLength(3)
    expect(next.messages[1]).toEqual(message)
    const nextMessage = next.messages[2]!
    const newHistory = available(await port.threadHistory.readVersion(thread.id, nextMessage.id, nextMessage.incarnation, 1, fixture.read))
    expect(newHistory.observedVersion).toBe(next.current.sourceRef.target.version)
    expect(newHistory.evidenceRefs).toEqual(next.current.evidenceRefs)
    expect(newHistory.evidenceRefs).not.toEqual(oldHistory.evidenceRefs)
    expect(available(await port.threadHistory.readVersion(thread.id, message.id, message.incarnation, 1, fixture.read))).toEqual(oldHistory)
    const forged = await fixture.state.transaction(fixture.request(), { namespace: "threads", expectedStorageVersion: await version(), idempotencyKey: "rewrite-message-source", commandDigest: digestSfValue({ thread: thread.id, source: source.refId }), targetRef: fixture.creationTarget.ref, targetIncarnation: fixture.creationTarget.incarnation }, async (state) => {
      const stored = state.threads[thread.id]
      if (!isThread(stored)) throw new Error("canonical thread missing")
      state.threads[thread.id] = { ...stored, messages: stored.messages.map((entry) => entry.id === nextMessage.id ? { ...entry, sourceContext: { sourceRef: oldHistory.sourceRef, sourceIncarnation: oldHistory.sourceIncarnation, observedVersion: oldHistory.observedVersion, period: oldHistory.period, evidenceRefs: oldHistory.evidenceRefs } } : entry) }
      return { commit: true, value: true }
    })
    expect(forged).toMatchObject({ status: "denied", reason: "thread-history-write-outside-authority" })
    expect(available(await port.threadHistory.readVersion(thread.id, nextMessage.id, nextMessage.incarnation, 1, fixture.read))).toEqual(newHistory)
    const retry = available(await port.recipientActions.reply(thread.id, newBody, newMutation, await fixture.admit("collaboration.thread.reply", { id: thread.id, body: newBody, mutation: newMutation })))
    expect(retry.messages).toEqual(next.messages)
    const stored = available(await fixture.state.read(fixture.request(), "threads", (state) => state.threads))
    expect(Object.entries(stored).filter(([key, value]) => isThread(value) && key === value.id)).toHaveLength(1)
    const resolutionEntry = Object.entries(stored).find(([key]) => key.startsWith("sf:thread-resolution-history:"))
    if (!resolutionEntry) throw new Error("resolution archive missing")
    expect(resolutionEntry[1]).toMatchObject({ kind: "thread-resolution-history-v1", messages: [{ resolution: { id: thread.id, state: "resolved", messages: replied.messages } }] })
    for (const operation of ["replace", "delete"] as const) {
      const attacked = await fixture.state.transaction(fixture.request(), { namespace: "threads", expectedStorageVersion: await version(), idempotencyKey: `resolution-${operation}`, commandDigest: digestSfValue({ operation, resolution: resolutionEntry[0] }), targetRef: fixture.creationTarget.ref, targetIncarnation: fixture.creationTarget.incarnation }, async (state) => {
        if (operation === "delete") delete state.threads[resolutionEntry[0]]
        else state.threads[resolutionEntry[0]] = { kind: "thread-resolution-history-v1", messages: [{ resolution: { id: thread.id, state: "open", messages: [] } }] }
        return { commit: true, value: true }
      })
      expect(attacked).toMatchObject({ status: "denied", reason: "thread-history-write-outside-authority" })
      expect(available(await fixture.state.read(fixture.request(), "threads", (state) => state.threads[resolutionEntry[0]]))).toEqual(resolutionEntry[1])
    }
    expect(await fixture.snapshots()).toEqual(changed)
    const nextAnswer = available(await port.answerEvidence.issue(thread.id, nextMessage.id, fixture.read)).refId
    const nextObserved = available(await port.answerReuse.prepare(thread.id, nextAnswer, fixture.read))
    const confirmed = { expectedStorageVersion: await version(), idempotencyKey: "confirm-new-answer", observationRef: nextObserved.observationRef, observedSourceVersion: nextObserved.observedSourceVersion, expectedScopeFingerprint: nextObserved.expectedScopeFingerprint }
    available(await port.answerReuse.confirm(thread.id, nextAnswer, confirmed, await fixture.admit("collaboration.answer.confirm", { questionId: thread.id, answerRef: nextAnswer, mutation: confirmed })))
    expect(await port.answerReuse.read(thread.id, fixture.read)).toMatchObject({ status: "ok", value: { answer: newBody, observedVersion: next.current.sourceRef.target.version } })
    fixture.historical.allowed = false
    const revokedHistory = await port.threadHistory.readVersion(thread.id, message.id, message.incarnation, 1, fixture.read)
    expect(revokedHistory.status).not.toBe("ok")
    expect(JSON.stringify(revokedHistory)).not.toContain(body)
    fixture.historical.allowed = true
    fixture.gate.dashboard = false
    expect((await port.threadReads.readHistorical(thread.id, fixture.read)).status).not.toBe("ok")
    expect((await port.threadHistory.readVersion(thread.id, nextMessage.id, nextMessage.incarnation, 1, fixture.read)).status).not.toBe("ok")
    fixture.gate.dashboard = true
    expect(available(await port.threadHistory.readVersion(thread.id, message.id, message.incarnation, 1, fixture.read))).toEqual(oldHistory)
    await fixture.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "delete", id: "project", version: changed.dashboard.versions["projects:project"]!.version, values: {} })
    await fixture.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", version: 0, values: { name: "Replacement", budget: 100, spent: 20, status: "In Progress", risk: "Low", notes: "New incarnation" } }, "project")
    expect((await port.threadReads.readHistorical(thread.id, fixture.read)).status).not.toBe("ok")
    expect((await port.threadHistory.readVersion(thread.id, message.id, message.incarnation, 1, fixture.read)).status).not.toBe("ok")
    expect(digestSfValue(historical)).toBe(digestSfValue(oldHistory))
  } finally {
    await fixture.dispose()
  }
})
