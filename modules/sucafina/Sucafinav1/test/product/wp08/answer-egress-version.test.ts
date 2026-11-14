import { expect, test } from "bun:test"
import { object } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { createAnswerWorkPort } from "../../../product/collaboration/answer-work.ts"
import { answerReuseBaselineKey } from "../../../product/collaboration/answer-reuse.ts"
import { isThread } from "../../../product/collaboration/threads.ts"
import { createReviewAnswersFixture } from "./review-answers-fixture.ts"
import { available } from "./relations-fixture.ts"

for (const consumer of ["read", "work"] as const) {
  test(`C05 answer ${consumer} refuses a real human edit after its final external version read`, async () => {
    const started = performance.now()
    const mark = (phase: string) => console.info(`[wp08-answer-egress:${consumer}] ${phase} ${Math.round(performance.now() - started)}ms`)
    const f = await createReviewAnswersFixture()
    mark("fixture-ready")
    try {
      const port = f.port
      if (!port.answerReuse || !port.recipientActions || !port.threadHistory) throw new Error("Answer consumers unavailable")
      const draft = { kind: "clarification" as const, ...f.basis, recipientRef: "reader-b", body: "Confirm the answer to this original review." }
      const mutation = { expectedStorageVersion: available(await port.storageVersion("threads", f.author)), idempotencyKey: `egress-${consumer}-question` }
      const thread = available(await port.threads.create(draft, mutation, await f.admit("person", "collaboration.thread.create", { draft, mutation })))
      const body = `C05-EGRESS-${consumer}: original confirmed answer.`
      const replyMutation = { expectedStorageVersion: available(await port.storageVersion("threads", f.recipient)), idempotencyKey: `egress-${consumer}-reply` }
      const replied = available(await port.recipientActions.reply(thread.id, body, replyMutation, await f.admit("reader-b", "collaboration.thread.reply", { id: thread.id, body, mutation: replyMutation })))
      const message = replied.messages[1]!
      const answerRef = available(await port.answerEvidence.issue(thread.id, message.id, f.recipient)).refId
      const prepared = available(await port.answerReuse.prepare(thread.id, answerRef, f.recipient))
      const confirmation = { expectedStorageVersion: available(await port.storageVersion("threads", f.recipient)), idempotencyKey: `egress-${consumer}-confirm`, observationRef: prepared.observationRef, observedSourceVersion: prepared.observedSourceVersion, expectedScopeFingerprint: prepared.expectedScopeFingerprint }
      expect(available(await port.answerReuse.confirm(thread.id, answerRef, confirmation, await f.admit("reader-b", "collaboration.answer.confirm", { questionId: thread.id, answerRef, mutation: confirmation })))).toEqual({ answerRef, observedVersion: f.source.target.version })
      mark("real-confirmation")
      const baselineKey = answerReuseBaselineKey(thread.id, message.id, f.recipient)
      const canonical = () => f.state.read(f.request("reader-b"), "threads", (state) => ({ thread: state.threads[thread.id], baseline: state.threads[baselineKey] }))
      const before = await canonical()
      if (before.status !== "ok" || !isThread(before.value.thread) || !before.value.baseline) throw new Error("Confirmed canonical thread unavailable")
      const domainBefore = await f.snapshots()
      // snapshots() deliberately projects business data without __sfProductV1.
      // Inspect C05 through the real C08 namespace, separately from the domain
      // snapshot and before installing the final-thread-read race hook.
      const readReview = () => f.state.read(f.request("reader-b"), "reviews", (state) => state.reviews[f.basis.reviewContext.reviewRef])
      const reviewBefore = await readReview()
      expect(reviewBefore.status).toBe("ok")
      if (reviewBefore.status !== "ok") throw new Error("Canonical review unavailable before race")
      expect(reviewBefore.value).toBeDefined()
      expect(reviewBefore.value).toMatchObject({ id: f.basis.reviewContext.reviewRef, version: f.basis.reviewContext.reviewVersion })
      expect(digestSfValue(reviewBefore.value)).toBe(f.basis.reviewContext.reviewDigest)
      const accessDigest = digestSfValue({ actors: f.actors, access: f.access })
      const sourceIdentity = sfSourceIdentity(domainBefore.dashboard, "projects", "project")
      expect(sourceIdentity).toBeDefined()
      const work = createAnswerWorkPort({ host: f.host, state: f.state, source: f.observer, reviewSource: f.answerSource, authorizeSources: port.authority.sources, authorizeHistoricalSources: port.authority.historicalSources })
      const edit = { id: thread.id, messageId: message.id, expectedVersion: message.version, body: `C05-EGRESS-${consumer}: edited while the old result was leaving.`, mutation: { expectedStorageVersion: before.storageVersion, idempotencyKey: `egress-${consumer}-edit` } }
      const read = f.state.read
      let externalReads = 0
      let edited = false
      // The real read has released C08 before a separately admitted human edit.
      // Return its captured result to expose the exact final-egress race. No
      // authority, source observation, baseline or thread is fabricated here.
      f.state.read = async (request, namespace, project) => {
        const result = await read(request, namespace, project)
        if (!edited && namespace === "threads" && result.status === "ok") {
          const value = object(result.value)
          const selected = consumer === "read"
            ? Object.keys(value).length === 1 && Object.hasOwn(value, "baseline")
            : Object.keys(value).length === 3 && Object.hasOwn(value, "thread") && Object.hasOwn(value, "answer") && Object.hasOwn(value, "baseline")
          if (selected && ++externalReads === 2) {
            edited = true
            expect(f.persistence.currentSnapshots?.()).toBeUndefined()
            expect(available(await port.threadHistory!.edit(edit.id, edit.messageId, edit.expectedVersion, edit.body, edit.mutation, await f.admit("reader-b", "collaboration.thread.edit", edit)))).toEqual({ id: thread.id, messageId: message.id, version: message.version + 1 })
          }
        }
        return result
      }
      try {
        // Use the actual Work component directly. A later outer work collector
        // must not hide a stale `valid` result from this component's own fence.
        const result = consumer === "read" ? await port.answerReuse.read(thread.id, f.recipient) : await work.project(thread.id, f.recipient)
        expect(edited).toBe(true)
        expect(externalReads).toBe(2)
        expect(result).toEqual(consumer === "read" ? { status: "stale", reason: "answer-scope-changed" } : { status: "unavailable", reason: "answer-work-unavailable" })
        expect(JSON.stringify(result)).not.toContain(body)
        expect(JSON.stringify(result)).not.toContain(edit.body)
        expect(JSON.stringify(result)).not.toContain(f.review.id)
      } finally { f.state.read = read }
      mark("edit-refused-at-final-egress")
      const after = await canonical()
      if (after.status !== "ok" || !isThread(after.value.thread)) throw new Error("Edited canonical thread unavailable")
      expect(after.storageVersion).toBe(before.storageVersion + 1)
      expect(after.value.thread.messages.find((entry) => entry.id === message.id)).toMatchObject({ id: message.id, incarnation: message.incarnation, version: message.version + 1, body: edit.body, sourceContext: f.basis })
      expect(after.value.baseline).toEqual(before.value.baseline)
      const domainAfter = await f.snapshots()
      expect(domainAfter.dashboard.data.projects).toEqual(domainBefore.dashboard.data.projects)
      expect(sfSourceIdentity(domainAfter.dashboard, "projects", "project")).toEqual(sourceIdentity)
      const reviewAfter = await readReview()
      expect(reviewAfter.status).toBe("ok")
      if (reviewAfter.status !== "ok") throw new Error("Canonical review unavailable after race")
      expect(reviewAfter.value).toBeDefined()
      expect(reviewAfter.value).toMatchObject({ id: f.basis.reviewContext.reviewRef, version: f.basis.reviewContext.reviewVersion })
      expect(digestSfValue(reviewAfter.value)).toBe(f.basis.reviewContext.reviewDigest)
      expect(reviewAfter.value).toEqual(reviewBefore.value)
      expect(digestSfValue({ actors: f.actors, access: f.access })).toBe(accessDigest)
      expect(available(await work.project(thread.id, f.recipient))).toMatchObject({ state: "stale", reason: "answer-changed", reviewContext: f.basis.reviewContext })
      mark("same-source-baseline-and-current-stale-work")
    } finally { await f.dispose(); mark("disposed") }
  }, 120000)
}
