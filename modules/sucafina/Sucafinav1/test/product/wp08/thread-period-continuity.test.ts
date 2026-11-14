import { expect, test } from "bun:test"
import { DashboardPeople } from "../../../runtime/dashboard-people.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { DashboardBudget } from "../../../runtime/dashboard-budget.ts"
import { rows } from "../../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import { answerReuseBaselineKey } from "../../../product/collaboration/answer-reuse.ts"
import { createHistoricalThreadSourceRefresh } from "../../../product/collaboration/thread-source-refresh.ts"
import { isThread } from "../../../product/collaboration/threads.ts"
import { createExactReviewThreadSourceMapping, createReviewThreadComments } from "../../../product/reviews/thread-access.ts"
import { available } from "./relations-fixture.ts"
import { createThreadHistoryFixture } from "./thread-history-fixture.ts"

for (const selected of [
  { name: "Hot Topic day", at: "2026-11-13T00:00:00Z", next: "2026-11-14T00:00:00Z", page: "Hot Topics & Actions", type: "hotTopics", id: "topic", fields: ["status"], period: { start: "2026-11-13", end: "2026-11-13" }, currentPeriod: { start: "2026-11-14", end: "2026-11-14" }, domain: DashboardPeople.domain },
  { name: "project year", at: "2026-12-31T00:00:00Z", next: "2027-01-01T00:00:00Z", page: "Portfolio Dashboard", type: "projects", id: "project", fields: ["name", "status"], period: { start: "2026-01-01", end: "2026-12-31" }, currentPeriod: { start: "2027-01-01", end: "2027-12-31" }, domain: DashboardPortfolio.domain },
]) test(`real ${selected.name} rollover keeps old messages and confirms only the new reply's own period`, async () => {
  const clock = { at: selected.at }
  // The capture archive and currentRef publication are explicit test boundaries. The record issuer,
  // Dashboard historical verifier, physical registry, BCS and consumer are the real implementations.
  const fixture = await createThreadHistoryFixture({ clock, currentTarget: (original, at) => ({ ...original.target, period: at === selected.at ? selected.period : selected.currentPeriod }) })
  try {
    const port = fixture.collaboration
    if (!port.recipientThread || !port.recipientActions || !port.threadHistory || !port.answerReuse || !port.authorizeThreadSourceContinuity) throw new Error("thread consumers unavailable")
    const source = available(await fixture.records.issue({ page: selected.page, recordType: selected.type, recordId: selected.id, fields: selected.fields, period: selected.period }, fixture.read))
    await fixture.capture(source)
    const forged = structuredClone(source)
    forged.target.period = selected.currentPeriod
    forged.refDigest = digestSfEvidenceRef(forged)
    await fixture.capture(forged)
    const version = async (context = fixture.read) => available(await port.storageVersion("threads", context))
    const draft = { kind: "clarification" as const, sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: selected.period, recipientRef: fixture.person.id, body: `Question observed in ${selected.period.start}`, evidenceRefs: [source] }
    const mutation = { expectedStorageVersion: await version(), idempotencyKey: "open-before-rollover" }
    const thread = available(await port.threads.create(draft, mutation, await fixture.admit("collaboration.thread.create", { draft, mutation })))
    const body = "Answer for the original observed period."
    const replyMutation = { expectedStorageVersion: await version(), idempotencyKey: "original-period-answer" }
    const originalReply = available(await port.threads.reply(thread.id, body, replyMutation, await fixture.admit("collaboration.thread.reply", { id: thread.id, body, mutation: replyMutation })))
    const message = originalReply.messages[1]!
    const answer = available(await port.answerEvidence.issue(thread.id, message.id, fixture.read))
    const display = available(await port.answerReuse.prepare(thread.id, answer.refId, fixture.read))
    const confirm = { expectedStorageVersion: await version(), idempotencyKey: "confirm-original-period", observationRef: display.observationRef, observedSourceVersion: display.observedSourceVersion, expectedScopeFingerprint: display.expectedScopeFingerprint }
    available(await port.answerReuse.confirm(thread.id, answer.refId, confirm, await fixture.admit("collaboration.answer.confirm", { questionId: thread.id, answerRef: answer.refId, mutation: confirm })))
    const key = answerReuseBaselineKey(thread.id, message.id, fixture.read)
    const audit = await fixture.state.read(fixture.request(), "threads", (state) => state.threads[key])
    if (audit.status !== "ok") throw new Error("original answer baseline unavailable")
    const resolution = { expectedStorageVersion: await version(), idempotencyKey: "resolve-original-period" }
    available(await port.threads.resolve(thread.id, resolution, await fixture.admit("collaboration.thread.resolve", { id: thread.id, mutation: resolution })))
    clock.at = selected.next
    const read = available(await fixture.ui.admit(fixture.request(), "sf_relation_read", digestSfValue({ recordRefs: [] })))
    if (!await fixture.ui.validate(read, "sf_relation_read", digestSfValue({ recordRefs: [] }))) throw new Error("renewed read unavailable")
    expect((await port.threadReads.readHistorical(thread.id, read)).status).not.toBe("ok")
    fixture.historical.allowed = true
    const projected = available(await port.recipientThread(thread.id, read))
    expect(projected.observed.period).toEqual(selected.period)
    expect(projected.current.sourceRef.target.period).toEqual(selected.currentPeriod)
    expect(projected.historical?.evidenceRefs).toEqual([source])
    expect(available(await port.threadReads.read(thread.id, read)).period).toEqual(selected.period)
    expect(available(await port.threadHistory.readVersion(thread.id, message.id, message.incarnation, 1, read))).toMatchObject({ message, period: selected.period, evidenceRefs: [source] })
    expect((await port.answerReuse.read(thread.id, read)).status).not.toBe("ok")
    const historicalRefresh = createHistoricalThreadSourceRefresh({ host: fixture.host, evidence: fixture.historyEvidence })
    expect((await historicalRefresh(forged, read)).status).not.toBe("ok")
    const nextBody = "New answer for the newly observed period."
    const nextMutation = { expectedStorageVersion: await version(read), idempotencyKey: "new-period-answer" }
    const next = available(await port.recipientActions.reply(thread.id, nextBody, nextMutation, await fixture.admit("collaboration.thread.reply", { id: thread.id, body: nextBody, mutation: nextMutation })))
    expect(next.id).toBe(thread.id)
    expect(next.state).toBe("open")
    expect(next.messages.slice(0, 2)).toEqual(originalReply.messages)
    const currentMessage = next.messages[2]!
    expect(currentMessage.sourceContext?.period).toEqual(selected.currentPeriod)
    expect(available(await port.threadHistory.readVersion(thread.id, currentMessage.id, currentMessage.incarnation, 1, read)).period).toEqual(selected.currentPeriod)
    const stored = await fixture.state.read(fixture.request(), "threads", (state) => state.threads[thread.id])
    expect(stored.status === "ok" && isThread(stored.value)).toBe(true)
    const nextEvidence = available(await port.answerEvidence.issue(thread.id, currentMessage.id, read))
    expect(nextEvidence.target.period).toEqual(selected.currentPeriod)
    const nextDisplay = available(await port.answerReuse.prepare(thread.id, nextEvidence.refId, read))
    expect(nextDisplay.scope.period).toEqual(selected.currentPeriod)
    const nextConfirm = { expectedStorageVersion: await version(read), idempotencyKey: "confirm-current-period", observationRef: nextDisplay.observationRef, observedSourceVersion: nextDisplay.observedSourceVersion, expectedScopeFingerprint: nextDisplay.expectedScopeFingerprint }
    available(await port.answerReuse.confirm(thread.id, nextEvidence.refId, nextConfirm, await fixture.admit("collaboration.answer.confirm", { questionId: thread.id, answerRef: nextEvidence.refId, mutation: nextConfirm })))
    expect(await port.answerReuse.read(thread.id, read)).toMatchObject({ status: "ok", value: { answer: nextBody } })
    const retained = await fixture.state.read(fixture.request(), "threads", (state) => state.threads[key])
    expect(retained.status === "ok" && retained.value).toEqual(audit.value)
    const comments = createReviewThreadComments({ host: fixture.host, threads: port.threadReads, history: port.threadHistory, authorizeSourceMapping: createExactReviewThreadSourceMapping({ host: fixture.host, evidence: fixture.historyEvidence }), authorizeSourceContinuity: port.authorizeThreadSourceContinuity, maxMessages: 20 })
    const selectedSources = available(await fixture.records.read(next.current.sourceRef.refId, read)).context.sourceRefs
    const captured = available(await comments.capture(thread.id, selectedSources, read))
    expect(captured.map((entry) => entry.sourceRefs[0]!.period)).toEqual([selected.period, selected.period, selected.currentPeriod])
    expect(await comments.authorizeComments(read, captured)).toBe(true)
    fixture.historical.allowed = false
    expect((await port.threadReads.readHistorical(thread.id, read)).status).not.toBe("ok")
    fixture.historical.allowed = true
    fixture.gate.dashboard = false
    expect((await port.threadReads.read(thread.id, read)).status).not.toBe("ok")
    expect(await comments.authorizeComments(read, captured)).toBe(false)
    fixture.gate.dashboard = true
    const before = await fixture.snapshots()
    await fixture.mutate("dashboard", selected.domain, { page: selected.page, action: "delete", id: selected.id, version: before.dashboard.versions[`${selected.type}:${selected.id}`]!.version, values: {} })
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data[selected.type] = [...rows(snapshot.data[selected.type]), structuredClone(rows(before.dashboard.data[selected.type]).find((entry) => entry.id === selected.id)!)]
      return { commit: true, value: undefined }
    })
    expect((await port.threadReads.readHistorical(thread.id, read)).status).not.toBe("ok")
    expect(await comments.authorizeComments(read, captured)).toBe(false)
  } finally {
    await fixture.dispose()
  }
})

test("a fresh dated January source cannot grant February continuity", async () => {
  const fixture = await createThreadHistoryFixture()
  try {
    for (const month of [1, 2]) await fixture.mutate("dashboard", DashboardBudget.domain, { page: "CAPEX Projects", action: "save-entry", version: 0, values: { projId: "capex", year: 2026, month, actual: 10 } }, `dated-${month}`)
    const january = { start: "2026-01-01", end: "2026-01-31" }
    const february = { start: "2026-02-01", end: "2026-02-28" }
    const original = available(await fixture.records.issue({ page: "CAPEX Projects", recordType: "capexEntries", recordId: "dated-1", fields: ["actual"], period: january }, fixture.read))
    const other = available(await fixture.records.issue({ page: "CAPEX Projects", recordType: "capexEntries", recordId: "dated-2", fields: ["actual"], period: february }, fixture.read))
    const selected = available(await fixture.records.read(other.refId, fixture.read)).context.sourceRefs
    const basis = { sourceRef: original.refId, sourceIncarnation: original.target.incarnation, observedVersion: original.target.version, period: january, evidenceRefs: [original] }
    expect(await fixture.collaboration.authorizeThreadSourceContinuity!(basis, selected, fixture.read)).toBe(false)
    const originalSource = available(await fixture.records.read(original.refId, fixture.read)).context.sourceRefs[0]!
    expect(await fixture.collaboration.authorizeThreadSourceContinuity!(basis, [{ ...originalSource, period: february }], fixture.read)).toBe(false)
    const current = createHistoricalThreadSourceRefresh({ host: fixture.host, evidence: fixture.historyEvidence })
    expect((await current(original, fixture.read)).status).not.toBe("ok")
  } finally {
    await fixture.dispose()
  }
})
