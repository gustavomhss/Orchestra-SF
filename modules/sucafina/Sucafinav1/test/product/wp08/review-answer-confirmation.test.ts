import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { available } from "./relations-fixture.ts"
import { createReviewAnswersFixture } from "./review-answers-fixture.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { createCollaborationHttp } from "../../../product/collaboration/http.ts"
import { createSfHumanAuthority, sfHumanReadActions } from "../../../product/integration/human-authority.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"

test("C05 answers confirm only the preserved review, suppress one work item, and recheck edits and review ACL", async () => {
  const f = await createReviewAnswersFixture()
  try {
    let port = f.port
    if (!port.recipientActions || !port.answerReuse || !port.threadHistory) throw new Error("Review answer consumers unavailable")
    const draft = { kind: "clarification" as const, ...f.basis, recipientRef: "reader-b", body: "Why was this project In Progress in the preserved review?" }
    const mutation = { expectedStorageVersion: available(await port.storageVersion("threads", f.author)), idempotencyKey: "review-answer-question" }
    const thread = available(await port.threads.create(draft, mutation, await f.admit("person", "collaboration.thread.create", { draft, mutation })))
    const before = await f.snapshots()
    await f.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: before.dashboard.versions["projects:project"]!.version, values: { status: "On Hold" } })
    const afterDomain = await f.snapshots()
    const body = "C05-ANSWER: the old review preceded the later project pause."
    const replyMutation = { expectedStorageVersion: available(await port.storageVersion("threads", f.recipient)), idempotencyKey: "review-answer-response" }
    const replied = available(await port.recipientActions.reply(thread.id, body, replyMutation, await f.admit("reader-b", "collaboration.thread.reply", { id: thread.id, body, mutation: replyMutation })))
    expect(replied.messages[1]!.sourceContext).toEqual(f.basis)
    const answerRef = available(await port.answerEvidence.issue(thread.id, replied.messages[1]!.id, f.recipient)).refId
    const workSelection = await f.select("reader-b", f.recipient)
    const pending = available(await port.work.listPresentation(workSelection, f.recipient))
    expect(pending.items.filter((item) => item.actionRef === thread.id)).toMatchObject([{ state: "clarification-open", reviewContext: f.basis.reviewContext }])
    expect(await port.answerReuse.read(thread.id, f.recipient)).toEqual({ status: "needs-input", reason: "answer-unconfirmed" })
    const httpHuman = createSfHumanAuthority({ origin: "https://example.test", ui: f.ui })
    const http = createCollaborationHttp({ origin: "https://example.test", mount: "/product", host: port, human: httpHuman, admitRead: async (request, operation, payload) => sfHumanReadActions.some((action) => action === operation) ? httpHuman.admit(request, operation as SfHumanAction, payload) : { status: "denied", reason: "unregistered-read" }, finishRead: httpHuman.finish })
    const httpPrepared = await http(new Request("https://example.test/product?sf=collaboration-answer-prepare", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json", actor: "reader-b" }, body: JSON.stringify({ questionId: thread.id, answerRef }) }))
    if (!httpPrepared) throw new Error("Review answer HTTP unavailable")
    const displayed = await httpPrepared.text()
    expect(httpPrepared.status).toBe(200)
    expect(JSON.parse(displayed)).toMatchObject({ status: "ok", value: { reviewContext: f.basis.reviewContext, answer: body } })
    expect(displayed).not.toContain("accessLeaseRef")
    expect(displayed).not.toContain("physicalIncarnation")
    const prepared = available(await port.answerReuse.prepare(thread.id, answerRef, f.recipient))
    expect(prepared.reviewContext).toEqual(f.basis.reviewContext)
    expect(prepared.scope.scopeDefinitionVersion).toBe("review-thread-c06-v1")
    expect(prepared.observedSourceVersion).toBe(f.source.target.version)
    const confirmation = { expectedStorageVersion: available(await port.storageVersion("threads", f.recipient)), idempotencyKey: "review-answer-confirm", observationRef: prepared.observationRef, observedSourceVersion: prepared.observedSourceVersion, expectedScopeFingerprint: prepared.expectedScopeFingerprint }
    const confirm = async () => port.answerReuse!.confirm(thread.id, answerRef, confirmation, await f.admit("reader-b", "collaboration.answer.confirm", { questionId: thread.id, answerRef, mutation: confirmation }))
    expect(available(await confirm())).toEqual({ answerRef, observedVersion: f.source.target.version })
    const version = available(await port.storageVersion("threads", f.recipient))
    expect(available(await confirm())).toEqual({ answerRef, observedVersion: f.source.target.version })
    expect(available(await port.storageVersion("threads", f.recipient))).toBe(version)
    expect(available(await port.answerReuse.read(thread.id, f.recipient))).toMatchObject({ answerRef, answer: body, authorRef: "reader-b", observedVersion: f.source.target.version, reviewContext: f.basis.reviewContext })
    expect(available(await port.work.listPresentation(workSelection, f.recipient)).items.filter((item) => item.actionRef === thread.id)).toEqual([])
    expect(digestSfValue(available(await f.services.reviews.read(f.review.id, f.recipient)))).toBe(f.basis.reviewContext.reviewDigest)
    const afterConfirm = await f.snapshots()
    expect(afterConfirm.dashboard.data.projects).toEqual(afterDomain.dashboard.data.projects)
    expect(afterConfirm.dashboard.data.hotTopics).toEqual(afterDomain.dashboard.data.hotTopics)
    const dispatch = async (questionRef: string) => {
      const payload = { questionRef }
      const admitted = available(await f.ui.admit(f.request("reader-b"), "sf_answer_read", digestSfValue(payload)))
      return dispatchSfCapability({ operation: "sf_answer_read", payload, context: admitted, descriptors: port.capabilities, authority: f.domainAuthority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_answer_read", value).ok, validateOutput: (_descriptor, value) => value.status !== "ok" || decodeSfOperationOutput("sf_answer_read", value.result).ok })
    }
    const shared = await dispatch(thread.id)
    expect(shared).toMatchObject({ status: "unavailable", reason: "review-answer-output-contract-unavailable" })
    expect(JSON.stringify(shared)).not.toContain(body)
    expect(JSON.stringify(shared)).not.toContain(f.review.id)

    // Reopen the actual SQLite file and compose new answer/host consumers. The
    // baseline survives; the old in-memory human observation is not resurrected.
    const reopened = await f.reopenConsumers()
    await expect(reopened.closed.transaction("dashboard", async () => ({ commit: false, value: true }))).rejects.toThrow("disposed")
    port = reopened.port
    if (!port.recipientActions || !port.answerReuse || !port.threadHistory) throw new Error("Reopened review consumers unavailable")
    expect(available(await port.answerReuse.read(thread.id, f.recipient))).toMatchObject({ answerRef, answer: body, observedVersion: f.source.target.version, reviewContext: f.basis.reviewContext })
    expect(available(await port.work.listPresentation(workSelection, f.recipient)).items.filter((item) => item.actionRef === thread.id)).toEqual([])
    expect(await confirm()).toEqual({ status: "denied", reason: "answer-observation-unavailable" })
    expect(available(await port.storageVersion("threads", f.recipient))).toBe(version)

    // Changing the answer invalidates its confirmation, while its preserved
    // source stays exact. My Work reopens one communication item with the C05 pin.
    const message = replied.messages[1]!
    const edit = { id: thread.id, messageId: message.id, expectedVersion: message.version, body: "C05-ANSWER-EDITED: corrected explanation of that original review.", mutation: { expectedStorageVersion: version, idempotencyKey: "review-answer-edit" } }
    available(await port.threadHistory.edit(edit.id, edit.messageId, edit.expectedVersion, edit.body, edit.mutation, await f.admit("reader-b", "collaboration.thread.edit", edit)))
    const stale = available(await port.work.listPresentation(workSelection, f.recipient)).items.filter((item) => item.actionRef === thread.id)
    expect(stale).toHaveLength(1)
    expect(stale).toMatchObject([{ state: "answer-stale", reason: "answer-changed", reviewContext: f.basis.reviewContext }])
    expect(available(await port.work.listPresentation(workSelection, f.recipient)).items.filter((item) => item.actionRef === thread.id)).toEqual(stale)
    expect((await confirm()).status).not.toBe("ok")
    const currentAnswerRef = available(await port.answerEvidence.issue(thread.id, message.id, f.recipient)).refId
    expect(currentAnswerRef).not.toBe(answerRef)
    const current = available(await port.answerReuse.prepare(thread.id, currentAnswerRef, f.recipient))
    const next = { expectedStorageVersion: available(await port.storageVersion("threads", f.recipient)), idempotencyKey: "review-answer-reconfirm", observationRef: current.observationRef, observedSourceVersion: current.observedSourceVersion, expectedScopeFingerprint: current.expectedScopeFingerprint }
    available(await port.answerReuse.confirm(thread.id, currentAnswerRef, next, await f.admit("reader-b", "collaboration.answer.confirm", { questionId: thread.id, answerRef: currentAnswerRef, mutation: next })))
    expect(available(await port.work.listPresentation(workSelection, f.recipient)).items.filter((item) => item.actionRef === thread.id)).toEqual([])
    const historicalAnswer = available(await port.threadHistory.readVersion(thread.id, message.id, message.incarnation, message.version, f.recipient))
    expect(historicalAnswer.message.body).toBe(body)
    expect(historicalAnswer.reviewContext).toEqual(f.basis.reviewContext)
    const resolution = { expectedStorageVersion: available(await port.storageVersion("threads", f.recipient)), idempotencyKey: "review-answer-resolve" }
    expect(available(await port.recipientActions.resolve(thread.id, resolution, await f.admit("reader-b", "collaboration.thread.resolve", { id: thread.id, mutation: resolution }))).state).toBe("resolved")
    expect(available(await port.answerReuse.read(thread.id, f.recipient))).toMatchObject({ answer: edit.body, reviewContext: f.basis.reviewContext })

    // Current-source answers cannot inherit the C05 confirmation by text, ID
    // proximity or a still-current project selector.
    const source = await f.issueProject(f.recipient)
    const liveDraft = { kind: "clarification" as const, sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: f.period, evidenceRefs: [source], recipientRef: "reader-b", body: "Explain the current On Hold status, not the preserved review." }
    const liveMutation = { expectedStorageVersion: available(await port.storageVersion("threads", f.recipient)), idempotencyKey: "review-answer-current-question" }
    const live = available(await port.threads.create(liveDraft, liveMutation, await f.admit("reader-b", "collaboration.thread.create", { draft: liveDraft, mutation: liveMutation })))
    const liveReplyMutation = { expectedStorageVersion: available(await port.storageVersion("threads", f.recipient)), idempotencyKey: "review-answer-current-response" }
    available(await port.recipientActions.reply(live.id, edit.body, liveReplyMutation, await f.admit("reader-b", "collaboration.thread.reply", { id: live.id, body: edit.body, mutation: liveReplyMutation })))
    expect(await port.answerReuse.read(live.id, f.recipient)).toEqual({ status: "needs-input", reason: "answer-unconfirmed" })
    expect(await dispatch(live.id)).toMatchObject({ status: "ok", result: { questionRef: live.id, answer: edit.body, state: "unconfirmed" } })
    f.access["reader-b"] = false
    for (const result of [await port.answerReuse.read(thread.id, f.recipient), await port.answerReuse.prepare(thread.id, currentAnswerRef, f.recipient), await port.work.listPresentation(workSelection, f.recipient)]) {
      expect(result.status).not.toBe("ok")
      expect(JSON.stringify(result)).not.toContain("C05-ANSWER")
      expect(JSON.stringify(result)).not.toContain(f.review.id)
    }
  } finally { await f.dispose() }
}, 120000)

test("C05 confirmation refuses a lease revoked at commit and cannot revive a replaced physical source", async () => {
  const f = await createReviewAnswersFixture()
  try {
    const port = f.port
    if (!port.recipientActions || !port.answerReuse) throw new Error("Review answer consumers unavailable")
    const draft = { kind: "clarification" as const, ...f.basis, recipientRef: "reader-b", body: "Explain this preserved project before confirming." }
    const mutation = { expectedStorageVersion: available(await port.storageVersion("threads", f.author)), idempotencyKey: "review-fence-question" }
    const thread = available(await port.threads.create(draft, mutation, await f.admit("person", "collaboration.thread.create", { draft, mutation })))
    const body = "REVIEW-FENCED-ANSWER: original project only."
    const replyMutation = { expectedStorageVersion: available(await port.storageVersion("threads", f.recipient)), idempotencyKey: "review-fence-answer" }
    const authorize = f.human.authorize
    let revokedAfterHumanCheck = false
    f.human.authorize = async (context, action, payload) => {
      const admitted = await authorize(context, action, payload)
      if (admitted && action === "collaboration.thread.reply" && f.persistence.currentSnapshots?.()) { revokedAfterHumanCheck = true; f.access["reader-b"] = false }
      return admitted
    }
    try {
      const refused = await port.recipientActions.reply(thread.id, body, replyMutation, await f.admit("reader-b", "collaboration.thread.reply", { id: thread.id, body, mutation: replyMutation }))
      expect(revokedAfterHumanCheck).toBe(true)
      expect(refused.status).not.toBe("ok")
      expect(JSON.stringify(refused)).not.toContain(body)
    } finally { f.human.authorize = authorize; f.access["reader-b"] = true }
    expect(available(await port.storageVersion("threads", f.recipient))).toBe(replyMutation.expectedStorageVersion)
    const reply = available(await port.recipientActions.reply(thread.id, body, replyMutation, await f.admit("reader-b", "collaboration.thread.reply", { id: thread.id, body, mutation: replyMutation })))
    const answerRef = available(await port.answerEvidence.issue(thread.id, reply.messages[1]!.id, f.recipient)).refId
    const observed = available(await port.answerReuse.prepare(thread.id, answerRef, f.recipient))
    const version = available(await port.storageVersion("threads", f.recipient))
    const confirmation = { expectedStorageVersion: version, idempotencyKey: "review-confirm-revoked-at-commit", observationRef: observed.observationRef, observedSourceVersion: observed.observedSourceVersion, expectedScopeFingerprint: observed.expectedScopeFingerprint }
    const transaction = f.state.transaction
    let entered = false
    f.state.transaction = (request, command, work) => transaction(request, command, async (state, authority, snapshot) => {
      if (command.idempotencyKey === confirmation.idempotencyKey) { entered = true; f.access["reader-b"] = false }
      return work(state, authority, snapshot)
    })
    try {
      const raced = await port.answerReuse.confirm(thread.id, answerRef, confirmation, await f.admit("reader-b", "collaboration.answer.confirm", { questionId: thread.id, answerRef, mutation: confirmation }))
      expect(entered).toBe(true)
      expect(raced.status).not.toBe("ok")
      expect(JSON.stringify(raced)).not.toContain(body)
    } finally { f.state.transaction = transaction; f.access["reader-b"] = true }
    expect(available(await port.storageVersion("threads", f.recipient))).toBe(version)
    expect(await port.answerReuse.read(thread.id, f.recipient)).toEqual({ status: "needs-input", reason: "answer-unconfirmed" })
    const fresh = available(await port.answerReuse.prepare(thread.id, answerRef, f.recipient))
    const retried = { ...confirmation, idempotencyKey: "review-confirm-after-human-review", observationRef: fresh.observationRef, observedSourceVersion: fresh.observedSourceVersion, expectedScopeFingerprint: fresh.expectedScopeFingerprint }
    available(await port.answerReuse.confirm(thread.id, answerRef, retried, await f.admit("reader-b", "collaboration.answer.confirm", { questionId: thread.id, answerRef, mutation: retried })))
    expect(available(await port.answerReuse.read(thread.id, f.recipient)).reviewContext).toEqual(f.basis.reviewContext)
    const current = await f.snapshots()
    await f.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "delete", id: "project", version: current.dashboard.versions["projects:project"]!.version, values: {} })
    await f.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", version: 0, values: { name: "Replacement with the same text ID", status: "In Progress", risk: "Low" } }, "project")
    const replaced = await port.answerReuse.read(thread.id, f.recipient)
    expect(replaced.status).not.toBe("ok")
    expect(JSON.stringify(replaced)).not.toContain(body)
    expect(JSON.stringify(replaced)).not.toContain(f.review.id)
  } finally { await f.dispose() }
}, 120000)
