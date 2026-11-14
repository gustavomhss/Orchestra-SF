import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { available } from "./relations-fixture.ts"
import { createReviewAnswersFixture } from "./review-answers-fixture.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { createCollaborationHttp } from "../../../product/collaboration/http.ts"
import { createSfHumanAuthority, sfHumanReadActions } from "../../../product/integration/human-authority.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"

test("C05 answers confirm the displayed preserved review and reuse the same baseline after SQLite reopen", async () => {
  const mark = checkpoints("confirmation-reopen")
  const f = await createReviewAnswersFixture()
  mark("fixture-ready")
  try {
    let port = f.port
    if (!port.recipientActions || !port.answerReuse || !port.threadHistory) throw new Error("Review answer consumers unavailable")
    const draft = { kind: "clarification" as const, ...f.basis, recipientRef: "reader-b", body: "Why was this project In Progress in the preserved review?" }
    const mutation = { expectedStorageVersion: available(await port.storageVersion("threads", f.author)), idempotencyKey: "review-answer-question" }
    const thread = available(await port.threads.create(draft, mutation, await f.admit("person", "collaboration.thread.create", { draft, mutation })))
    const before = await f.snapshots()
    await f.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: before.dashboard.versions["projects:project"]!.version, values: { status: "On Hold" } })
    const afterDomain = await f.snapshots()
    mark("question-and-source-change")
    const body = "C05-ANSWER: the old review preceded the later project pause."
    const replyMutation = { expectedStorageVersion: available(await port.storageVersion("threads", f.recipient)), idempotencyKey: "review-answer-response" }
    const replied = available(await port.recipientActions.reply(thread.id, body, replyMutation, await f.admit("reader-b", "collaboration.thread.reply", { id: thread.id, body, mutation: replyMutation })))
    expect(replied.messages[1]!.sourceContext).toEqual(f.basis)
    mark("recipient-reply")
    const answerRef = available(await port.answerEvidence.issue(thread.id, replied.messages[1]!.id, f.recipient)).refId
    const wrongReference = await port.answerReuse.prepare(thread.id, `${answerRef}0`, f.recipient)
    expect(wrongReference).toEqual({ status: "unavailable", reason: "answer-observation-unavailable" })
    expect(JSON.stringify(wrongReference)).not.toContain(body)
    mark("exact-answer-reference-checked")
    const workSelection = await f.select("reader-b", f.recipient)
    const pending = available(await port.work.listPresentation(workSelection, f.recipient))
    expect(pending.items.filter((item) => item.actionRef === thread.id)).toMatchObject([{ state: "clarification-open", reviewContext: f.basis.reviewContext }])
    expect(await port.answerReuse.read(thread.id, f.recipient)).toEqual({ status: "needs-input", reason: "answer-unconfirmed" })
    mark("unconfirmed-read")
    const httpHuman = createSfHumanAuthority({ origin: "https://example.test", ui: f.ui })
    const http = createCollaborationHttp({ origin: "https://example.test", mount: "/product", host: port, human: httpHuman, admitRead: async (request, operation, payload) => sfHumanReadActions.some((action) => action === operation) ? httpHuman.admit(request, operation as SfHumanAction, payload) : { status: "denied", reason: "unregistered-read" }, finishRead: httpHuman.finish })
    const httpPrepared = await http(new Request("https://example.test/product?sf=collaboration-answer-prepare", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json", actor: "reader-b" }, body: JSON.stringify({ questionId: thread.id, answerRef }) }))
    if (!httpPrepared) throw new Error("Review answer HTTP unavailable")
    const displayed = await httpPrepared.text()
    expect(httpPrepared.status).toBe(200)
    expect(JSON.parse(displayed)).toMatchObject({ status: "ok", value: { reviewContext: f.basis.reviewContext, answer: body } })
    expect(displayed).not.toContain("accessLeaseRef")
    expect(displayed).not.toContain("physicalIncarnation")
    mark("http-observation")
    // Confirm the exact observation displayed by the real HTTP preparation.
    // A second prepare would replace the human observation with an unshown one.
    const prepared = JSON.parse(displayed).value
    expect(prepared.reviewContext).toEqual(f.basis.reviewContext)
    expect(prepared.scope.scopeDefinitionVersion).toBe("review-thread-c06-v1")
    expect(prepared.observedSourceVersion).toBe(f.source.target.version)
    const confirmation = { expectedStorageVersion: available(await port.storageVersion("threads", f.recipient)), idempotencyKey: "review-answer-confirm", observationRef: prepared.observationRef, observedSourceVersion: prepared.observedSourceVersion, expectedScopeFingerprint: prepared.expectedScopeFingerprint }
    const confirm = async () => port.answerReuse!.confirm(thread.id, answerRef, confirmation, await f.admit("reader-b", "collaboration.answer.confirm", { questionId: thread.id, answerRef, mutation: confirmation }))
    expect(available(await confirm())).toEqual({ answerRef, observedVersion: f.source.target.version })
    const version = available(await port.storageVersion("threads", f.recipient))
    expect(available(await confirm())).toEqual({ answerRef, observedVersion: f.source.target.version })
    expect(available(await port.storageVersion("threads", f.recipient))).toBe(version)
    mark("confirmation-retry")
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
    mark("confirmed-read-work-and-shared-denial")

    // Reopen the actual SQLite file and compose new answer/host consumers. The
    // baseline survives; the old in-memory human observation is not resurrected.
    const reopened = await f.reopenConsumers()
    await expect(reopened.closed.transaction("dashboard", async () => ({ commit: false, value: true }))).rejects.toThrow("disposed")
    port = reopened.port
    if (!port.recipientActions || !port.answerReuse || !port.threadHistory) throw new Error("Reopened review consumers unavailable")
    expect(available(await port.answerReuse.read(thread.id, f.recipient))).toMatchObject({ answerRef, answer: body, observedVersion: f.source.target.version, reviewContext: f.basis.reviewContext })
    expect(available(await port.work.listPresentation(workSelection, f.recipient)).items.filter((item) => item.actionRef === thread.id)).toEqual([])
    expect(await confirm()).toEqual({ status: "denied", reason: "answer-observation-unavailable" })
    mark("sqlite-reopen-and-reuse")
    expect(available(await port.storageVersion("threads", f.recipient))).toBe(version)
    mark("reopened-storage-unchanged")

  } finally { await f.dispose(); mark("disposed") }
}, 120000)

test("C05 edited answers after SQLite reopen create one stale item and reconfirm the same original review", async () => {
  const mark = checkpoints("edit-reconfirm")
  const f = await createReviewAnswersFixture()
  mark("fixture-ready")
  try {
    let port = f.port
    if (!port.recipientActions || !port.answerReuse || !port.threadHistory) throw new Error("Review answer consumers unavailable")
    const { thread, replied, body, answerRef } = await setupReviewAnswer(f, "review-edit", mark)
    const workSelection = await f.select("reader-b", f.recipient)
    const confirmation = await confirmReviewAnswer(f, port, thread.id, answerRef, "review-edit-initial-confirm")
    const version = available(await port.storageVersion("threads", f.recipient))
    const confirm = async () => port.answerReuse!.confirm(thread.id, answerRef, confirmation, await f.admit("reader-b", "collaboration.answer.confirm", { questionId: thread.id, answerRef, mutation: confirmation }))
    // This journey retains the original causal link: editing uses a new
    // consumer over the reopened real SQLite baseline, not a seeded record.
    port = (await f.reopenConsumers()).port
    if (!port.recipientActions || !port.answerReuse || !port.threadHistory) throw new Error("Reopened review consumers unavailable")
    mark("real-confirmation-and-sqlite-reopen")
    // Changing the answer invalidates its confirmation, while its preserved
    // source stays exact. My Work reopens one communication item with the C05 pin.
    const message = replied.messages[1]!
    const edit = { id: thread.id, messageId: message.id, expectedVersion: message.version, body: "C05-ANSWER-EDITED: corrected explanation of that original review.", mutation: { expectedStorageVersion: version, idempotencyKey: "review-answer-edit" } }
    available(await port.threadHistory.edit(edit.id, edit.messageId, edit.expectedVersion, edit.body, edit.mutation, await f.admit("reader-b", "collaboration.thread.edit", edit)))
    const stale = available(await port.work.listPresentation(workSelection, f.recipient)).items.filter((item) => item.actionRef === thread.id)
    expect(stale).toHaveLength(1)
    expect(stale).toMatchObject([{ state: "answer-stale", reason: "answer-changed", reviewContext: f.basis.reviewContext }])
    expect(available(await port.work.listPresentation(workSelection, f.recipient)).items.filter((item) => item.actionRef === thread.id)).toEqual(stale)
    mark("answer-edit-and-stale-work")
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
    mark("reconfirmation-history-and-resolution")

  } finally { await f.dispose(); mark("disposed") }
}, 120000)

test("a current-domain question cannot inherit a confirmed C05 answer and review ACL revocation hides every private consumer", async () => {
  const mark = checkpoints("distinct-current-revocation")
  const f = await createReviewAnswersFixture()
  mark("fixture-ready")
  try {
    const port = f.port
    if (!port.recipientActions || !port.answerReuse) throw new Error("Review answer consumers unavailable")
    const { thread, body, answerRef } = await setupReviewAnswer(f, "review-distinct", mark)
    const workSelection = await f.select("reader-b", f.recipient)
    await confirmReviewAnswer(f, port, thread.id, answerRef, "review-distinct-confirm")
    // The current-source question deliberately repeats exactly the body of
    // this independently created and genuinely confirmed C05 response.
    const edit = { body }
    const currentAnswerRef = answerRef
    mark("real-c05-confirmation")
    const dispatch = async (questionRef: string) => {
      const payload = { questionRef }
      const admitted = available(await f.ui.admit(f.request("reader-b"), "sf_answer_read", digestSfValue(payload)))
      return dispatchSfCapability({ operation: "sf_answer_read", payload, context: admitted, descriptors: port.capabilities, authority: f.domainAuthority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_answer_read", value).ok, validateOutput: (_descriptor, value) => value.status !== "ok" || decodeSfOperationOutput("sf_answer_read", value.result).ok })
    }
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
    mark("distinct-current-source-answer")
    f.access["reader-b"] = false
    for (const result of [await port.answerReuse.read(thread.id, f.recipient), await port.answerReuse.prepare(thread.id, currentAnswerRef, f.recipient), await port.work.listPresentation(workSelection, f.recipient)]) {
      expect(result.status).not.toBe("ok")
      expect(JSON.stringify(result)).not.toContain("C05-ANSWER")
      expect(JSON.stringify(result)).not.toContain(f.review.id)
    }
  } finally { await f.dispose(); mark("disposed") }
}, 120000)

test("C05 confirmation refuses a lease revoked at commit and cannot revive a replaced physical source", async () => {
  const mark = checkpoints("current-lease")
  const f = await createReviewAnswersFixture()
  mark("fixture-ready")
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
    mark("reply-denied-at-last-human-await")
    const reply = available(await port.recipientActions.reply(thread.id, body, replyMutation, await f.admit("reader-b", "collaboration.thread.reply", { id: thread.id, body, mutation: replyMutation })))
    const answerRef = available(await port.answerEvidence.issue(thread.id, reply.messages[1]!.id, f.recipient)).refId
    const observed = available(await port.answerReuse.prepare(thread.id, answerRef, f.recipient))
    mark("reply-and-private-observation")
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
    mark("confirmation-denied-at-commit")
    expect(await port.answerReuse.read(thread.id, f.recipient)).toEqual({ status: "needs-input", reason: "answer-unconfirmed" })
    mark("unconfirmed-read")
    const fresh = available(await port.answerReuse.prepare(thread.id, answerRef, f.recipient))
    const retried = { ...confirmation, idempotencyKey: "review-confirm-after-human-review", observationRef: fresh.observationRef, observedSourceVersion: fresh.observedSourceVersion, expectedScopeFingerprint: fresh.expectedScopeFingerprint }
    available(await port.answerReuse.confirm(thread.id, answerRef, retried, await f.admit("reader-b", "collaboration.answer.confirm", { questionId: thread.id, answerRef, mutation: retried })))
    expect(available(await port.answerReuse.read(thread.id, f.recipient)).reviewContext).toEqual(f.basis.reviewContext)
    mark("restored-access-confirmation")
    const current = await f.snapshots()
    const oldPhysical = sfSourceIdentity(current.dashboard, "projects", "project")
    if (!oldPhysical) throw new Error("Original physical source unavailable")
    await f.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "delete", id: "project", version: current.dashboard.versions["projects:project"]!.version, values: {} })
    // Canonical commands refuse a tombstoned ID. This is an explicit hostile
    // storage replacement, checked by the actual physical lifecycle producer.
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.projects = [...rows(snapshot.data.projects), { ...object(rows(current.dashboard.data.projects).find((row) => row.id === "project")), id: "project", name: "Replacement with the same text ID", status: "In Progress", notes: "Hostile physical replacement" }]
      return { commit: true, value: undefined }
    })
    const replacement = await f.snapshots()
    const replacedPhysical = sfSourceIdentity(replacement.dashboard, "projects", "project")
    expect(replacedPhysical).toBeDefined()
    expect(replacedPhysical?.incarnation).not.toBe(oldPhysical.incarnation)
    const replaced = await port.answerReuse.read(thread.id, f.recipient)
    expect(replaced.status).not.toBe("ok")
    expect(JSON.stringify(replaced)).not.toContain(body)
    expect(JSON.stringify(replaced)).not.toContain(f.review.id)
    mark("physical-replacement-denied")
  } finally { await f.dispose(); mark("disposed") }
}, 120000)

type ReviewAnswerFixture = Awaited<ReturnType<typeof createReviewAnswersFixture>>

/** Each caller owns a fresh real fixture and starts its120s budget before setup. */
async function setupReviewAnswer(f: ReviewAnswerFixture, correlation: string, mark: (stage: string) => void) {
  const port = f.port
  if (!port.recipientActions || !port.answerReuse) throw new Error("Review answer consumers unavailable")
  const draft = { kind: "clarification" as const, ...f.basis, recipientRef: "reader-b", body: "Why was this project In Progress in the preserved review?" }
  const mutation = { expectedStorageVersion: available(await port.storageVersion("threads", f.author)), idempotencyKey: `${correlation}-question` }
  const thread = available(await port.threads.create(draft, mutation, await f.admit("person", "collaboration.thread.create", { draft, mutation })))
  const before = await f.snapshots()
  await f.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: before.dashboard.versions["projects:project"]!.version, values: { status: "On Hold" } })
  const body = "C05-ANSWER: the old review preceded the later project pause."
  const replyMutation = { expectedStorageVersion: available(await port.storageVersion("threads", f.recipient)), idempotencyKey: `${correlation}-answer` }
  const replied = available(await port.recipientActions.reply(thread.id, body, replyMutation, await f.admit("reader-b", "collaboration.thread.reply", { id: thread.id, body, mutation: replyMutation })))
  const answerRef = available(await port.answerEvidence.issue(thread.id, replied.messages[1]!.id, f.recipient)).refId
  mark("real-question-source-change-and-answer")
  return { thread, replied, body, answerRef }
}

async function confirmReviewAnswer(f: ReviewAnswerFixture, port: ReviewAnswerFixture["port"], questionId: string, answerRef: string, idempotencyKey: string) {
  if (!port.answerReuse) throw new Error("Review answer consumer unavailable")
  const observed = available(await port.answerReuse.prepare(questionId, answerRef, f.recipient))
  const mutation = { expectedStorageVersion: available(await port.storageVersion("threads", f.recipient)), idempotencyKey, observationRef: observed.observationRef, observedSourceVersion: observed.observedSourceVersion, expectedScopeFingerprint: observed.expectedScopeFingerprint }
  available(await port.answerReuse.confirm(questionId, answerRef, mutation, await f.admit("reader-b", "collaboration.answer.confirm", { questionId, answerRef, mutation })))
  return mutation
}

function checkpoints(scenario: string) {
  const started = performance.now()
  return (stage: string) => console.info(`WP08_C05_STAGE ${scenario} ${stage} ${Math.round(performance.now() - started)}ms`)
}
