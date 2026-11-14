import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { isConsumedQuestion } from "../../../product/collaboration/question-consumer.ts"
import type { ConsumedQuestion, QuestionConsumption } from "../../../product/collaboration/question-consumer.ts"
import { isThread } from "../../../product/collaboration/threads.ts"
import type { CollaborationThread } from "../../../product/collaboration/threads.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { object } from "../../../runtime/contract.ts"
import { withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12NativeMissionContext } from "./native-mission-harness.ts"
import { initializeWp12QuestionSource, prepareWp12QuestionCase, wp12QuestionSourceDigest, WP12_QUESTION_HUMAN_ACTIONS, WP12_QUESTION_OPERATIONS, WP12_QUESTION_PERIOD, WP12_QUESTION_PENDING_REASON } from "./native-question-preparation.ts"

const label = "question-human-consumer"
const principalRef = `wp12-synthetic-${label}-principal`

test("a focused human pending question is consumed once and its unconfirmed answer reopens through the canonical thread", async () => {
  await withWp12NativeMissionHost({ label,
    operations: [...WP12_QUESTION_OPERATIONS, "sf_question_prepare", "sf_work_list"],
    humanActions: [...WP12_QUESTION_HUMAN_ACTIONS, "collaboration.question.confirm", "collaboration.thread.reply",
      "collaboration.thread.read", "collaboration.recipients", "collaboration.storage.version",
      "collaboration.selection.create", "collaboration.selection.version", "collaboration.work.list"],
    namespaces: ["cases", "preferences", "documents", "contributions", "receipts", "outbox", "atlas", "threads", "relations", "confirmations"],
    initialize: initializeSourcesAndExplicitRecipient }, async (harness) => {
    const initial = await harness.open("initial", async (context) => {
      expect(context.principalRef).toBe(principalRef)
      const scenario = await prepareWp12QuestionCase(context)
      const pending = scenario.alternative.result.costCoverage.entries.find((entry) => entry.categoryId === "training" && entry.status === "pending")
      const source = scenario.source
      if (!pending || pending.status !== "pending" || !source || source.kind !== "record" || !source.target.period)
        throw new Error("The focused real C10 producer did not preserve the human pending category and its selected source")
      expect(pending.reason).toBe(WP12_QUESTION_PENDING_REASON)
      expect(scenario.alternative.result.costCoverage.derivedMissingCategoryIds).toEqual([])
      expect(scenario.alternative.result.total).toBeNull()
      expect(scenario.alternative.result.comparisonStatus).toBe("conditioned")
      const recipients = await collaborationHttp(context, "recipients", {})
      expect(recipients.response.status).toBe(200)
      expect(recipients.body.status).toBe("ok")
      if (!Array.isArray(recipients.body.value)) throw new Error("The installed recipient directory returned no collection")
      expect(recipients.body.value.filter((person) => object(person).id === context.principalRef)).toHaveLength(1)

      // The principal explicitly asks themself to verify the real unresolved
      // category. This creates a UI preparation, never a model contribution.
      const question = { caseRef: encodeCaseRef(scenario.caseRef),
        question: { text: "Qual é o custo de treinamento desta alternativa? A resposta é necessária para completar a comparação do custo total." },
        sourceRefs: [source], recipientRef: context.principalRef }
      const prepared = await context.ui("sf_question_prepare", question, (call) => context.services.dispatch("sf_question_prepare", question, call))
      expect(prepared.status).toBe("ok")
      if (prepared.status !== "ok" || prepared.receipt.kind !== "ui") throw new Error("Question consumption requires a real bound UI preparation")
      const output = decodeSfOperationOutput("sf_question_prepare", prepared.result)
      if (!output.ok) throw new Error("The installed question capability returned an invalid preparation")
      expect(output.value.recipientRef).toBe(context.principalRef)
      expect(output.value.evidenceRefs).toEqual([source])
      expect(output.value.expectedCaseVersion).toBe(scenario.caseRef.version)
      const consumption: QuestionConsumption = { proposal: { kind: "prepared", result: output.value, receipt: prepared.receipt },
        sourceRef: source.refId, period: source.target.period,
        mutation: { expectedStorageVersion: await storageVersion(context, "threads"), idempotencyKey: randomUUID() } }
      const first = await collaborationHttp(context, "question-consume", consumption)
      expect(first.response.status).toBe(200)
      expect(first.body.status).toBe("ok")
      if (!isConsumedQuestion(first.body.value)) throw new Error("The installed consumer did not persist its canonical question origin")
      const thread = first.body.value
      expect(thread.recipientRef).toBe(context.principalRef)
      expect(thread.questionOrigin.provenance.kind).toBe("prepared")
      if (thread.questionOrigin.provenance.kind !== "prepared") throw new Error("A human preparation was relabelled as a native contribution")
      expect(thread.questionOrigin.provenance.callId).toBe(prepared.receipt.callId)
      expect(thread.questionOrigin.caseRef).toEqual(scenario.caseRef)
      expect(thread.messages).toHaveLength(1)
      expect(thread.messages[0]?.body).toBe(output.value.question)
      expect(thread.evidenceRefs).toEqual([source])

      const versionAfterFirst = await storageVersion(context, "threads")
      const retry = await collaborationHttp(context, "question-consume", consumption)
      expect(retry.response.status).toBe(200)
      expect(retry.body.status).toBe("ok")
      expect(digestSfValue(retry.body.value)).toBe(digestSfValue(thread))
      expect(await storageVersion(context, "threads")).toBe(versionAfterFirst)

      const changed = await collaborationHttp(context, "question-consume", { ...consumption,
        proposal: { ...consumption.proposal, result: { ...consumption.proposal.result, question: "Unobserved replacement question" } } })
      expect(changed.response.status).toBe(400)
      expect(changed.body).toMatchObject({ status: "needs-input", reason: "invalid-question-consumption" })
      expect(await storageVersion(context, "threads")).toBe(versionAfterFirst)

      const answer = "Ainda não há evidência confirmada para esse custo. A categoria continua pendente."
      const reply = await collaborationHttp(context, "thread-reply", { id: thread.id, body: answer,
        mutation: { expectedStorageVersion: versionAfterFirst, idempotencyKey: randomUUID() } })
      expect(reply.response.status).toBe(200)
      expect(reply.body.status).toBe("ok")
      const answered = await readThread(context, thread.id)
      expect(answered.messages).toHaveLength(2)
      expect(answered.messages[1]?.body).toBe(answer)
      expect(answered.messages[1]?.authorRef).toBe(context.principalRef)
      // Public thread reads omit private origin metadata. The canonical
      // consumer's real retry is the source for the persisted provenance.
      const afterReply = await collaborationHttp(context, "question-consume", consumption)
      expect(afterReply.response.status).toBe(200)
      if (!isConsumedQuestion(afterReply.body.value)) throw new Error("The canonical retry lost the consumed question provenance")
      expect(afterReply.body.value.questionOrigin).toEqual(thread.questionOrigin)
      expectPublicThread(answered, afterReply.body.value)
      await expectCasePreserved(context, scenario.case)
      expect(await wp12QuestionSourceDigest(context)).toBe(scenario.plannerSourceDigest)
      await expectNoNativeRuns(context, scenario.caseRef)

      const selectionVersion = await collaborationHttp(context, "selection-version", {})
      expect(selectionVersion.response.status).toBe(200)
      expect(selectionVersion.body.status).toBe("ok")
      if (typeof selectionVersion.body.value !== "number" || !Number.isSafeInteger(selectionVersion.body.value))
        throw new Error("The real case selection returned no storage version")
      const selected = await collaborationHttp(context, "selection-create", {
        draft: { caseRef: encodeCaseRef(scenario.caseRef), period: WP12_QUESTION_PERIOD, sourceRefs: [source] },
        mutation: { expectedStorageVersion: selectionVersion.body.value, idempotencyKey: randomUUID() } })
      expect(selected.response.status).toBe(200)
      expect(selected.body.status).toBe("ok")
      const selectionRef = object(selected.body.value).selectionRef
      if (typeof selectionRef !== "string" || !selectionRef.startsWith("sf:case-work-selection:"))
        throw new Error("The real case selection did not publish its owned reference")
      const work = await observeWorkProjection(context, selectionRef, thread.id)
      console.log("SF_WP12_HUMAN_QUESTION_CONSUMER:" + JSON.stringify({ scope: "real-ui-preparation-and-canonical-thread",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: scenario.caseRef, threadId: thread.id,
        sourceRefIds: [source.refId], recipientRef: context.principalRef, preparationCallId: prepared.receipt.callId,
        preparationDigest: digestSfValue(output.value), canonicalOriginDigest: digestSfValue(thread.questionOrigin),
        conditionCategory: pending.categoryId, conditionReason: pending.reason, conditionFrom: "human-classified-pending-in-real-c10", derivedOmissionProof: false,
        route: "collaboration-question-consume", observedActions: ["create", "same-receipt-retry", "changed-preparation-refused", "human-reply"],
        threadCountFromThisPreparation: 1, messages: answered.messages.length, provenanceKind: "prepared",
        workProjection: work, inferenceExecuted: false, nativeOutputRef: null, gnativeAccepted: false }))
      return { consumption, thread: afterReply.body.value, case: scenario.case, caseRef: scenario.caseRef, answer, selectionRef, plannerSourceDigest: scenario.plannerSourceDigest }
    })

    await harness.open("reopened", async (context) => {
      const current = await readThread(context, initial.thread.id)
      expectPublicThread(current, initial.thread)
      const before = await storageVersion(context, "threads")
      const retry = await collaborationHttp(context, "question-consume", initial.consumption)
      expect(retry.response.status).toBe(200)
      expect(retry.body.status).toBe("ok")
      expect(digestSfValue(retry.body.value)).toBe(digestSfValue(initial.thread))
      expect(await storageVersion(context, "threads")).toBe(before)
      const input = { questionRef: initial.thread.id }
      const answer = await context.ui("sf_answer_read", input, (call) => context.services.dispatch("sf_answer_read", input, call))
      expect(answer.status).toBe("ok")
      if (answer.status !== "ok" || answer.receipt.kind !== "ui") throw new Error("The installed answer reader did not return a bound UI observation")
      const result = decodeSfOperationOutput("sf_answer_read", answer.result)
      if (!result.ok) throw new Error("The installed answer reader returned an invalid schema")
      expect(result.value.questionRef).toBe(initial.thread.id)
      expect(result.value.answer).toBe(initial.answer)
      expect(result.value.state).toBe("unconfirmed")
      expect(result.value.evidenceRefs).toEqual(initial.thread.evidenceRefs)
      await expectCasePreserved(context, initial.case)
      expect(await wp12QuestionSourceDigest(context)).toBe(initial.plannerSourceDigest)
      await expectNoNativeRuns(context, initial.caseRef)
      const work = await observeWorkProjection(context, initial.selectionRef, initial.thread.id)
      console.log("SF_WP12_HUMAN_QUESTION_REOPEN:" + JSON.stringify({ scope: "persisted-human-thread-and-answer-consumed-after-host-reload",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: initial.caseRef, threadId: initial.thread.id,
        observedActions: ["thread-read", "same-preparation-retry", "sf_answer_read"], replyCount: current.messages.length - 1,
        provenanceKind: initial.thread.questionOrigin.provenance.kind, answerState: result.value.state,
        answerReceiptKind: answer.receipt.kind, workProjection: work, nativeOutputRef: null,
        inferenceExecuted: false, gnativeAccepted: false }))
    })
  })
}, 180_000)

async function initializeSourcesAndExplicitRecipient(persistence: Wp12NativeMissionContext["persistence"]) {
  await initializeWp12QuestionSource(persistence)
  // Synthetic application input for the same test principal that the private
  // authenticator admits. No other person's Request or source authority is made.
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.access = { ...object(snapshot.data.access), [principalRef]: { role: "admin" } }
    return { commit: true, value: undefined }
  })
}

async function collaborationHttp(context: Wp12NativeMissionContext, route: string, payload: unknown) {
  if (!context.services.productHttp) throw new Error("The installed host did not publish product HTTP")
  const response = await context.services.productHttp(context.request(payload, `/sucafina/planner?sf=collaboration-${route}`), "planner")
  if (!response) throw new Error(`The installed host did not mount collaboration-${route}`)
  return { response, body: object(await response.json()) }
}

async function storageVersion(context: Wp12NativeMissionContext, namespace: "threads") {
  const current = await collaborationHttp(context, "storage-version", { namespace })
  expect(current.response.status).toBe(200)
  expect(current.body.status).toBe("ok")
  if (typeof current.body.value !== "number" || !Number.isSafeInteger(current.body.value) || current.body.value < 0)
    throw new Error("The canonical thread store did not return its version")
  return current.body.value
}

async function readThread(context: Wp12NativeMissionContext, id: string) {
  const result = await collaborationHttp(context, "thread-read", { id })
  expect(result.response.status).toBe(200)
  expect(result.body.status).toBe("ok")
  if (!isThread(result.body.value)) throw new Error("The public consumer did not return its real thread projection")
  return result.body.value
}

function expectPublicThread(current: CollaborationThread, canonical: ConsumedQuestion) {
  expect(current.id).toBe(canonical.id)
  expect(current.kind).toBe(canonical.kind)
  expect(current.state).toBe(canonical.state)
  expect(current.recipientRef).toBe(canonical.recipientRef)
  expect(current.sourceRef).toBe(canonical.sourceRef)
  expect(current.sourceIncarnation).toBe(canonical.sourceIncarnation)
  expect(current.observedVersion).toBe(canonical.observedVersion)
  expect(current.period).toEqual(canonical.period)
  expect(current.evidenceRefs).toEqual(canonical.evidenceRefs)
  expect(current.messages).toEqual(canonical.messages)
}

async function expectCasePreserved(context: Wp12NativeMissionContext, original: Awaited<ReturnType<typeof prepareWp12QuestionCase>>["case"]) {
  const input = { caseRef: encodeCaseRef(original) }
  const read = await context.ui("sf_case_read", input, (call) => context.business.cases.read(input, call))
  expect(read.status).toBe("ok")
  if (read.status !== "ok") throw new Error("Question consumption made the current case inaccessible")
  expect(digestSfValue(read.value.case)).toBe(digestSfValue(original))
}

async function expectNoNativeRuns(context: Wp12NativeMissionContext, caseRef: Awaited<ReturnType<typeof prepareWp12QuestionCase>>["caseRef"]) {
  const analyses = context.services.analyses
  if (!analyses) throw new Error("The installed host did not publish its analysis reader")
  expect(await context.human("analysis.read", { caseRef }, (call) => analyses.list(call, caseRef))).toEqual({ status: "ok", value: [] })
}

async function observeWorkProjection(context: Wp12NativeMissionContext, selectionRef: string, threadId: string) {
  const result = await collaborationHttp(context, "work-list", { selectionRef, period: WP12_QUESTION_PERIOD })
  if (result.body.status !== "ok") {
    // The current host omits workSignals. Preserve this observed dependency;
    // neither a directory entry nor the successful thread is a work-list proof.
    expect(result.response.status).toBe(503)
    expect(result.body).toMatchObject({ status: "unavailable", reason: "work-signals-unavailable" })
    return { status: "unavailable", reason: "work-signals-unavailable", consumerAccepted: false }
  }
  expect(result.response.status).toBe(200)
  const value = object(result.body.value)
  const items = Array.isArray(result.body.value) ? result.body.value : value.items
  if (!Array.isArray(items)) throw new Error("The real work list returned no presentation items")
  const matching = items.filter((item) => object(item).actionRef === threadId)
  expect(matching).toHaveLength(1)
  expect(object(matching[0]).kind).toBe("clarification")
  return { status: "ok", threadId, consumerAccepted: true }
}
