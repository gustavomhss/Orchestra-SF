import { expectUnchangedDomainState } from "./domain-state.ts"
import { expect, test } from "bun:test"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { createThreadHistoryFixture } from "./thread-history-fixture.ts"
import { available } from "./relations-fixture.ts"

test("a March answer remains a scoped claim beside the official May project until a separate domain command changes the schedule", async () => {
  const fixture = await createThreadHistoryFixture()
  try {
    const initial = await fixture.snapshots()
    await fixture.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: initial.dashboard.versions["projects:project"]!.version, values: { end: "2026-05-31" } })
    const source = available(await fixture.records.issue({ page: "All Projects", recordType: "projects", recordId: "project", fields: ["name", "end"], period: fixture.period }, fixture.read))
    await fixture.capture(source)
    const official = available(await fixture.records.read(source.refId, fixture.read))
    expect(official.values.find((value) => value.id === "projects:project:end")?.value).toBe("2026-05-31")
    const before = await fixture.snapshots()
    const port = fixture.collaboration
    if (!port.answerReuse) throw new Error("answer consumer unavailable")
    const version = async () => available(await port.storageVersion("threads", fixture.read))
    const draft = { kind: "clarification" as const, sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: fixture.period, recipientRef: fixture.person.id, body: "What completion date should the case consider?", evidenceRefs: [source] }
    const mutation = { expectedStorageVersion: await version(), idempotencyKey: "schedule-question" }
    const thread = available(await port.threads.create(draft, mutation, await fixture.admit("collaboration.thread.create", { draft, mutation })))
    const body = "For the case, I expect completion in March 2026; the official project still ends in May."
    const replyMutation = { expectedStorageVersion: await version(), idempotencyKey: "march-answer" }
    const replied = available(await port.threads.reply(thread.id, body, replyMutation, await fixture.admit("collaboration.thread.reply", { id: thread.id, body, mutation: replyMutation })))
    const message = replied.messages[1]!
    const answer = available(await port.answerEvidence.issue(thread.id, message.id, fixture.read))
    expect(answer.evidenceLevel).toBe("claim")
    const observed = available(await port.answerReuse.prepare(thread.id, answer.refId, fixture.read))
    const confirmation = { expectedStorageVersion: await version(), idempotencyKey: "confirm-march-claim", observationRef: observed.observationRef, observedSourceVersion: observed.observedSourceVersion, expectedScopeFingerprint: observed.expectedScopeFingerprint }
    available(await port.answerReuse.confirm(thread.id, answer.refId, confirmation, await fixture.admit("collaboration.answer.confirm", { questionId: thread.id, answerRef: answer.refId, mutation: confirmation })))
    expect(await port.answerReuse.read(thread.id, fixture.read)).toMatchObject({ status: "ok", value: { answer: body, authorRef: fixture.person.id, observedVersion: source.target.version } })
    expect(available(await fixture.records.read(source.refId, fixture.read))).toEqual(official)
    expectUnchangedDomainState(before, await fixture.snapshots())
    // This explicit official edit is a separate authorized domain command, never a side effect of the answer.
    await fixture.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: before.dashboard.versions["projects:project"]!.version, values: { end: "2026-03-31" } })
    const changedSource = available(await fixture.records.issue({ page: "All Projects", recordType: "projects", recordId: "project", fields: ["name", "end"], period: fixture.period }, fixture.read))
    expect(available(await fixture.records.read(changedSource.refId, fixture.read)).values.find((value) => value.id === "projects:project:end")?.value).toBe("2026-03-31")
    fixture.historical.allowed = true
    expect(await port.answerReuse.read(thread.id, fixture.read)).toMatchObject({ status: "stale", reason: "answer-scope-changed" })
    expect(available(await port.threadHistory!.readVersion(thread.id, message.id, message.incarnation, 1, fixture.read)).message.body).toBe(body)
  } finally {
    await fixture.dispose()
  }
})
