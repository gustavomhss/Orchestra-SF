import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { object } from "../../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import { createPlannerConfirmationObserver } from "../../../product/planner/confirmation.ts"
import { dispatchWp12Ui, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12NativeMissionContext } from "./native-mission-harness.ts"
import { initializeWp12QuestionSource, WP12_QUESTION_PERIOD } from "./native-question-preparation.ts"

const label = "planner-answer-scope"

test("Planner answer dispatch and confirmation retain the complete source through host reopen", async () => {
  await withWp12NativeMissionHost({ label,
    operations: ["sf_context_get", "sf_answer_read"],
    humanActions: ["collaboration.thread.create", "collaboration.thread.reply", "collaboration.answer.confirm"],
    namespaces: ["cases", "preferences", "documents", "contributions", "receipts", "outbox", "atlas", "threads", "relations", "confirmations"],
    initialize: async (persistence) => {
      await initializeWp12QuestionSource(persistence)
      // The real recipient directory requires this actor's existing Dashboard
      // access row as well as its authenticated identity and directory entry.
      await persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.access = { ...object(snapshot.data.access), [`wp12-synthetic-${label}-principal`]: { role: "admin" } }
        return { commit: true, value: undefined }
      })
    } }, async (harness) => {
    const initial = await harness.open("initial", async (context) => {
      const recipients = ok(await context.ui("sf_context_get", { purpose: "planner-answer-recipient" },
        (call) => context.business.collaboration.listRecipients(call)), "Planner recipient directory")
      expect(recipients.map((person) => person.id)).toEqual([context.principalRef])
      const source = ok(await context.ui("sf_context_get", { purpose: "planner-answer-source" },
        (call) => context.business.plannerProduct.issueSource("wp12-question-source", call)), "Planner source").evidence
      expect(source.target.surface).toBe("planner")
      expect(source.target.fields).toContain("summary")
      expect(source.target.fields.length).toBeGreaterThan(1)
      const domainBefore = await plannerDigest(context)
      const draft = { kind: "review" as const, sourceRef: source.refId, sourceIncarnation: source.target.incarnation,
        observedVersion: source.target.version, period: WP12_QUESTION_PERIOD, recipientRef: context.principalRef, evidenceRefs: [source],
        body: "Has the training quote been confirmed for this planning source?" }
      const mutation = { expectedStorageVersion: await threadsVersion(context), idempotencyKey: randomUUID() }
      const thread = ok(await context.human("collaboration.thread.create", { draft, mutation },
        (call) => context.business.collaboration.threads.create(draft, mutation, call)), "Planner question")
      const body = "The quote is still pending; this answer does not establish a training cost."
      const replyMutation = { expectedStorageVersion: await threadsVersion(context), idempotencyKey: randomUUID() }
      const replied = ok(await context.human("collaboration.thread.reply", { id: thread.id, body, mutation: replyMutation },
        (call) => context.business.collaboration.threads.reply(thread.id, body, replyMutation, call)), "Planner reply")
      const message = replied.messages[1]
      if (!message) throw new Error("The canonical Planner reply has no message")
      expect(await readAnswer(context, thread.id)).toEqual({ questionRef: thread.id, answer: body, evidenceRefs: [source], state: "unconfirmed" })
      const prepared = await context.ui("sf_answer_read", { questionRef: thread.id }, async (call) => {
        const answer = ok(await context.business.collaboration.answerEvidence.issue(thread.id, message.id, call), "Planner answer evidence")
        const reuse = context.business.collaboration.answerReuse
        if (!reuse) throw new Error("The Planner answer reuse producer is missing")
        return { answerRef: answer.refId, observation: ok(await reuse.prepare(thread.id, answer.refId, call), "Planner answer observation") }
      })
      if (source.target.period === undefined) throw new Error("The canonical Planner source has no period")
      expect(prepared.observation.scope).toEqual({ sourceRef: { surface: "planner", type: source.target.recordType, id: source.target.recordId, incarnation: source.target.incarnation },
        fields: source.target.fields, period: source.target.period, materialDependencies: [], scopeDefinitionVersion: "planner-answer-c06-v1" })
      expect(prepared.observation.observation.state).toBe("available")
      expect(prepared.observation.observation.physicalIncarnation).toBeTruthy()
      const confirmation = { expectedStorageVersion: await threadsVersion(context), idempotencyKey: randomUUID(),
        observationRef: prepared.observation.observationRef, observedSourceVersion: prepared.observation.observedSourceVersion,
        expectedScopeFingerprint: prepared.observation.expectedScopeFingerprint }
      const refused = { ...confirmation, observationRef: "never-issued-observation", idempotencyKey: randomUUID() }
      expect(await context.human("collaboration.answer.confirm", { questionId: thread.id, answerRef: prepared.answerRef, mutation: refused },
        (call) => context.business.collaboration.answerReuse!.confirm(thread.id, prepared.answerRef, refused, call)))
        .toEqual({ status: "denied", reason: "answer-observation-unavailable" })
      expect(await threadsVersion(context)).toBe(confirmation.expectedStorageVersion)
      expect(await context.human("collaboration.answer.confirm", { questionId: thread.id, answerRef: prepared.answerRef, mutation: confirmation },
        (call) => context.business.collaboration.answerReuse!.confirm(thread.id, prepared.answerRef, confirmation, call)))
        .toEqual({ status: "ok", value: { answerRef: prepared.answerRef, observedVersion: source.target.version } })
      expect(await readAnswer(context, thread.id)).toEqual({ questionRef: thread.id, answer: body, evidenceRefs: [source], state: "confirmed" })
      expect(await plannerDigest(context)).toBe(domainBefore)
      return { source, threadId: thread.id, body, scope: prepared.observation.scope, domainBefore }
    })
    await harness.open("reopened", async (context) => {
      expect(await plannerDigest(context)).toBe(initial.domainBefore)
      expect(await readAnswer(context, initial.threadId)).toEqual({ questionRef: initial.threadId, answer: initial.body, evidenceRefs: [initial.source], state: "confirmed" })
      await context.ui("sf_answer_read", { questionRef: initial.threadId }, async (call) => {
        expect(await context.business.collaboration.answerReuse!.read(initial.threadId, structuredClone(call)))
          .toEqual({ status: "denied", reason: "answer-reuse-unavailable" })
        const observer = createPlannerConfirmationObserver({ host: context.business.host, issueSource: context.business.plannerProduct.issueSource,
          planner: context.business.planner })
        const selected = ok(await observer.resolveAnswerScope(initial.source, [initial.source], call), "reopened answer scope")
        expect(selected.scope).toEqual(initial.scope)
        expect(await observer.verifyManifest({ ...selected.scope, fields: ["summary"] }, call)).toBe(false)
        expect(await observer.resolveAnswerScope(initial.source, [initial.source, initial.source], call))
          .toEqual({ status: "unavailable", reason: "answer-scope-unavailable" })
        const narrowed = { ...initial.source, target: { ...initial.source.target, fields: ["summary"] } }
        narrowed.refDigest = digestSfEvidenceRef(narrowed)
        expect(await observer.resolveAnswerScope(narrowed, [narrowed], call))
          .toEqual({ status: "unavailable", reason: "answer-scope-unavailable" })
        const original = await observer.observe(selected.scope, call)
        if (original.state !== "available") throw new Error("The genuine reopened Planner observation is unavailable")
        expect(original.evidence).toEqual(initial.source)
        expect(await context.persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(selected.scope, original, call) }))).toBe(true)
        // The title is outside the numeric financial projection. It still
        // belongs to the exact Planner record named by the question.
        await context.persistence.transaction("planner", async (snapshot) => {
          const versions = snapshot.data.versions as { id: string; name: string }[]
          const version = versions.find((value) => value.id === initial.source.target.recordId)
          if (!version) throw new Error("The real Planner version disappeared")
          version.name = "Planner answer source renamed after confirmation"
          return { commit: true, value: undefined }
        })
        const changed = await observer.observe(selected.scope, call)
        if (changed.state !== "available") throw new Error("The current changed Planner observation is unavailable")
        expect(changed.physicalIncarnation).toBe(original.physicalIncarnation)
        expect(changed.sourceVersion).toBeGreaterThan(original.sourceVersion)
        expect(changed.sourceFingerprint).toBe(original.sourceFingerprint)
        expect(changed.dependencyFingerprint).not.toBe(original.dependencyFingerprint)
        expect(changed.scopeFingerprint).not.toBe(original.scopeFingerprint)
        expect(await context.persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(selected.scope, original, call) }))).toBe(false)
        expect(await context.persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(selected.scope, changed, call) }))).toBe(true)
      })
    })
  })
}, 120_000)

async function readAnswer(context: Wp12NativeMissionContext, questionRef: string) {
  const result = await dispatchWp12Ui(context, "sf_answer_read", { questionRef })
  if (result.status !== "ok") throw new Error("The mounted Planner answer dispatch failed: " + result.status + "/" + result.reason)
  expect(result.receipt.kind).toBe("ui")
  const decoded = decodeSfOperationOutput("sf_answer_read", result.result)
  if (!decoded.ok) throw new Error("The mounted Planner answer has an invalid output schema")
  return decoded.value
}

async function threadsVersion(context: Wp12NativeMissionContext) {
  return ok(await context.ui("sf_context_get", { purpose: "planner-answer-thread-version" },
    (call) => context.business.collaboration.storageVersion("threads", call)), "thread storage version")
}

async function plannerDigest(context: Wp12NativeMissionContext) {
  return context.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.versions) }))
}

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(label + ": " + result.status + "/" + result.reason)
  return result.value
}
