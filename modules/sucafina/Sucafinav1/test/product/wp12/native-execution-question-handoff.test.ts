import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import type { HandoffProposal } from "../../../product/contracts/outputs.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { isConsumedQuestion } from "../../../product/collaboration/question-consumer.ts"
import type { QuestionConsumption, QuestionContribution } from "../../../product/collaboration/question-consumer.ts"
import { isThread } from "../../../product/collaboration/threads.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import { dispatchWp12Ui, executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12CompletedNativeMission, Wp12NativeMissionContext } from "./native-mission-harness.ts"
import { initializeWp12QuestionSource, prepareWp12QuestionCase, wp12QuestionSourceDigest, WP12_QUESTION_HUMAN_ACTIONS,
  WP12_QUESTION_OPERATIONS, WP12_QUESTION_PENDING_REASON, WP12_QUESTION_PERIOD } from "./native-question-preparation.ts"

type Preparation = Parameters<NonNullable<SfHostServices["analysisInputs"]>["prepare"]>[1]
const label = "question-handoff"
const principalRef = `wp12-synthetic-${label}-principal`
const nativeOperations = ["sf_case_read", "sf_handoff_prepare", "sf_question_prepare", "sf_relation_read"] as const

/** The action selector is an actual relation endpoint in QuestionPlanningInput.
 * A human creates and confirms that action through C06. No private action ID,
 * fabricated receipt, predecessor answer or work-selection ID enters the model. */
test("native question handoff uses a real selected Hot Topic and its human consumer preserves one action after reload", async () => {
  await withWp12NativeMissionHost({ label,
    operations: [...WP12_QUESTION_OPERATIONS, "sf_handoff_prepare", "sf_question_prepare", "sf_relation_read"],
    humanActions: [...WP12_QUESTION_HUMAN_ACTIONS, "collaboration.handoff.confirm", "collaboration.storage.version",
      "collaboration.recipients", "collaboration.question.output", "collaboration.question.confirm", "collaboration.thread.read"],
    namespaces: ["cases", "preferences", "documents", "contributions", "receipts", "outbox", "atlas", "threads", "relations", "confirmations"],
    initialize: async (persistence) => {
      await initializeWp12QuestionSource(persistence)
      await persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.access = { ...object(snapshot.data.access), [principalRef]: { role: "admin" } }
        snapshot.data.hotTopics = []
        return { commit: true, value: undefined }
      })
    } }, async (harness) => {
    const initial = await harness.open("initial", async (context) => {
      const objective = "Releia o caso com sf_case_read e a relação confirmada com sf_relation_read. Identifique a ação corrente pelo endpoint Hot Topics da relação, sem criar outra ação. Prepare com sf_handoff_prepare o encaminhamento dessa ação para o destinatário autorizado, usando a fonte do planejamento e a ação observada. Prepare também com sf_question_prepare uma pergunta pertinente sobre a informação ainda pendente da decisão, preservando essas duas fontes, e retorne a QuestionProposal. As preparações não enviam mensagens, confirmam dados ausentes nem aplicam a decisão."
      const support: { value?: Awaited<ReturnType<typeof createSelectedHandoff>> } = {}
      const preparedCase = await prepareWp12QuestionCase(context, { objective, support: async (source) => {
        support.value = await createSelectedHandoff(context, source)
        return { evidenceRefs: [support.value.topicRef] }
      } })
      const selected = support.value
      if (!selected) throw new Error("The real handoff producer did not publish its action and relation")
      const sourceRefs = [preparedCase.source, selected.topicRef]
      const incoming = { request: questionRequest(context, preparedCase.caseRef, objective),
        selection: { relationRefIds: sourceRefs.map((ref) => ref.refId), directoryRefs: [context.principalRef] } }
      const prepared = await prepareInput(context, incoming)
      expect(prepared.response.status).toBe(200)
      const input = decodeSfSkillInput("QuestionPlanningInput", prepared.body.value)
      if (!input.ok) throw new Error("The installed question producer rejected its real handoff relation")
      expect(input.value.case).toEqual(preparedCase.caseRef)
      expect(input.value.unresolvedConditions).toHaveLength(1)
      expect(input.value.unresolvedConditions[0]).toMatchObject({ category: "training", reason: WP12_QUESTION_PENDING_REASON, evidenceRefs: [] })
      expect(input.value.unresolvedConditions[0]?.questionRef).toBeUndefined()
      expect(input.value.relations).toHaveLength(1)
      expect(input.value.relations[0]?.id).toBe(selected.relationId)
      expect(input.value.relations[0]?.from).toEqual(preparedCase.source)
      expect(input.value.relations[0]?.to).toEqual(selected.topicRef)
      expect(input.value.relations[0]?.state).toBe("confirmed")
      expect(input.value.authorizedDirectoryRefs).toEqual([context.principalRef])
      expect(refSet(input.value.relations[0]!.evidenceRefs)).toBe(refSet(sourceRefs))

      const caseDigest = digestSfValue(preparedCase.case)
      const domainDigest = await hotTopicsDigest(context)
      const relationsVersion = await storageVersion(context, "relations")
      const threadsVersion = await storageVersion(context, "threads")
      const handoffRequest = { caseRef: encodeCaseRef(preparedCase.caseRef), actionRef: selected.topicRef.refId,
        recipientRef: context.principalRef, sourceRefs }
      const ui = await dispatchWp12Ui(context, "sf_handoff_prepare", handoffRequest)
      if (ui.status !== "ok" || ui.receipt.kind !== "ui") throw new Error("The real handoff preparation was unavailable to its authenticated human caller")
      const preparedHandoff = decodeSfOperationOutput("sf_handoff_prepare", ui.result)
      if (!preparedHandoff.ok) throw new Error("The real handoff preparation failed its canonical output schema")
      expect(preparedHandoff.value).toEqual({ ...handoffRequest, domainApplied: false })
      expect(ui.receipt.operation).toBe("sf_handoff_prepare")
      expect(ui.receipt.resultDigest).toBe(digestSfValue(preparedHandoff.value))
      const wrongKind = await dispatchWp12Ui(context, "sf_handoff_prepare", { ...handoffRequest, actionRef: preparedCase.source.refId })
      expect(wrongKind).toMatchObject({ status: "needs-input", reason: "action-unavailable" })
      const missingAction = await dispatchWp12Ui(context, "sf_handoff_prepare", { ...handoffRequest, sourceRefs: [preparedCase.source] })
      expect(missingAction).toMatchObject({ status: "needs-input", reason: "action-unavailable" })
      const unknownRecipient = await dispatchWp12Ui(context, "sf_handoff_prepare", { ...handoffRequest, recipientRef: "unselected-recipient" })
      expect(unknownRecipient).toMatchObject({ status: "needs-input", reason: "recipient-unavailable" })
      await expectUnchanged(context, preparedCase, caseDigest, domainDigest, relationsVersion, threadsVersion)

      console.log("SF_WP12_HANDOFF_INPUT:" + JSON.stringify({ scope: "actual-human-created-action-and-confirmed-relation-in-question-input",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: preparedCase.caseRef, inputDigest: digestSfValue(input.value),
        actionRef: selected.topicRef.refId, actionId: selected.topicId, relationId: selected.relationId,
        selectedRefs: sourceRefs.map((ref) => ref.refId), recipientRef: context.principalRef,
        observedPreparation: "sf_handoff_prepare", preparationReceiptKind: ui.receipt.kind,
        privateSelectorInjected: false, domainApplied: false, inferenceExecuted: false, gnativeAccepted: false }))
      let completed: Wp12CompletedNativeMission | undefined
      let nativeHandoff: HandoffProposal | undefined
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: input.value })
      } else {
        expectSpawn(import.meta.path)
        completed = await executeWp12NativeMission(context, { request: incoming.request, skillInput: input.value,
          expectedKind: "QuestionProposal", requiredTools: ["sf_handoff_prepare", "sf_question_prepare", "sf_relation_read"].map((operation) => ({ operation })) })
        nativeHandoff = await readNativeHandoff(context, completed, selected.topicRef.refId, sourceRefs)
        expect(nativeHandoff.caseRef).toBe(handoffRequest.caseRef)
        expect(nativeHandoff.recipientRef).toBe(context.principalRef)
        expect(nativeHandoff.domainApplied).toBe(false)
        if (completed.output.kind !== "QuestionProposal" || completed.output.state !== "ready") throw new Error("The native handoff mission changed its final output kind")
        expect(completed.output.payload.recipientRef).toBe(context.principalRef)
        expect(refSet(completed.output.payload.evidenceRefs)).toBe(refSet(sourceRefs))
        await expectUnchanged(context, preparedCase, caseDigest, domainDigest, relationsVersion, threadsVersion)
      }
      return { incoming, inputDigest: digestSfValue(input.value), preparedCase, selected, caseDigest, domainDigest,
        relationsVersion, threadsVersion, uiHandoff: preparedHandoff.value, completed, nativeHandoff }
    })

    const consumed = await harness.open("reopened", async (context) => {
      const prepared = await prepareInput(context, initial.incoming)
      expect(prepared.response.status).toBe(200)
      expect(digestSfValue(prepared.body.value)).toBe(initial.inputDigest)
      await expectUnchanged(context, initial.preparedCase, initial.caseDigest, initial.domainDigest, initial.relationsVersion, initial.threadsVersion)
      const proposal = initial.nativeHandoff ?? initial.uiHandoff
      const command = { topicRef: proposal.actionRef, sourceRefs: proposal.sourceRefs,
        sourceRef: initial.preparedCase.source.refId, recipientRef: proposal.recipientRef, relationKey: randomUUID() }
      // The existing human C06 route consumes the actual preparation values.
      // It reauthorizes the current source/action/recipient; it does not claim to
      // store the native receipt. That receipt remains audited in the Session.
      const linked = object(await collaborationValue(context, "handoff-link", command))
      expect(linked.state).toBe("linked")
      expect(linked.relationId).toBe(initial.selected.relationId)
      expect(object(linked.topic).id).toBe(initial.selected.topicId)
      expect(digestSfValue(linked.topic)).toBe(initial.selected.topicDigest)
      const retry = await collaborationValue(context, "handoff-link", command)
      expect(digestSfValue(retry)).toBe(digestSfValue(linked))
      await expectUnchanged(context, initial.preparedCase, initial.caseDigest, initial.domainDigest, initial.relationsVersion, initial.threadsVersion)
      const wrongTarget = await collaborationHttp(context, "handoff-link", { ...command, topicRef: initial.preparedCase.source.refId })
      expect(wrongTarget.response.status).toBe(400)
      expect(wrongTarget.body).toMatchObject({ status: "needs-input", reason: "invalid-handoff-link" })
      await expectUnchanged(context, initial.preparedCase, initial.caseDigest, initial.domainDigest, initial.relationsVersion, initial.threadsVersion)
      console.log("SF_WP12_HANDOFF_CONSUMER:" + JSON.stringify({ scope: "real-human-confirmed-handoff-link-and-idempotent-retry-after-reload",
        githubSha: process.env.GITHUB_SHA ?? null, actionId: initial.selected.topicId, relationId: initial.selected.relationId,
        inputOrigin: initial.nativeHandoff ? "actual-native-tool-result" : "actual-ui-tool-result",
        runRef: initial.completed?.runRef ?? null, nativeSessionId: initial.completed?.receipt.nativeSessionId ?? null,
        observedActions: ["handoff-link", "same-link-retry", "wrong-target-refused"],
        actionCount: 1, relationCount: 1, domainMutationFromPreparation: false, nativeReceiptStoredByLink: false,
        inferenceExecuted: !!initial.completed, gnativeAccepted: false }))
      if (!initial.completed) return { command, linkedDigest: digestSfValue(linked), question: undefined }

      const reopened = await readWp12NativeMissionAfterReload(context, initial.completed)
      if (reopened.output.kind !== "QuestionProposal" || reopened.output.state !== "ready") throw new Error("The native handoff question was not durable")
      const raw = object(await collaborationValue(context, "question-output", { outputRef: reopened.output.id, caseRef: reopened.output.caseRef }))
      const result = decodeSfOperationOutput("sf_question_prepare", raw.result)
      if (!result.ok) throw new Error("The existing C11 consumer did not return the native question")
      const source: QuestionContribution = { kind: "contribution", outputRef: reopened.output.id, outputDigest: reopened.output.outputDigest,
        caseRef: reopened.output.caseRef, result: result.value }
      expect<unknown>(raw).toEqual(source)
      expect(result.value).toEqual(reopened.output.payload)
      const consumption: QuestionConsumption = { proposal: source, sourceRef: initial.preparedCase.source.refId, period: WP12_QUESTION_PERIOD,
        mutation: { expectedStorageVersion: await storageVersion(context, "threads"), idempotencyKey: randomUUID() } }
      const thread = await collaborationValue(context, "question-consume", consumption)
      if (!isConsumedQuestion(thread) || thread.questionOrigin.provenance.kind !== "contribution") throw new Error("The question consumer lost its actual native provenance")
      expect(thread.questionOrigin.provenance.outputRef).toBe(reopened.output.id)
      expect(thread.questionOrigin.provenance.outputDigest).toBe(reopened.output.outputDigest)
      expect(thread.questionOrigin.provenance.runRef).toBe(initial.completed.runRef)
      expect(thread.messages).toHaveLength(1)
      expect(thread.messages[0]?.body).toBe(reopened.output.payload.question)
      expect(refSet(thread.evidenceRefs)).toBe(refSet([initial.preparedCase.source, initial.selected.topicRef]))
      const version = await storageVersion(context, "threads")
      expect(digestSfValue(await collaborationValue(context, "question-consume", consumption))).toBe(digestSfValue(thread))
      expect(await storageVersion(context, "threads")).toBe(version)
      expect(await hotTopicsDigest(context)).toBe(initial.domainDigest)
      expect(await wp12QuestionSourceDigest(context)).toBe(initial.preparedCase.plannerSourceDigest)
      return { command, linkedDigest: digestSfValue(linked), question: { consumption, thread, version } }
    })
    await harness.open("reopened", async (context) => {
      const linked = await collaborationValue(context, "handoff-link", consumed.command)
      expect(digestSfValue(linked)).toBe(consumed.linkedDigest)
      expect(await hotTopicsDigest(context)).toBe(initial.domainDigest)
      expect(await storageVersion(context, "relations")).toBe(initial.relationsVersion)
      const current = await readCaseAnalysisProjection(context.request(), context.services, initial.preparedCase.caseRef)
      if (current.status !== "ok") throw new Error("The handoff consumer lost its authorized case")
      expect(digestSfValue(current.value.case)).toBe(initial.caseDigest)
      expect(await wp12QuestionSourceDigest(context)).toBe(initial.preparedCase.plannerSourceDigest)
      if (consumed.question) {
        const retry = await collaborationValue(context, "question-consume", consumed.question.consumption)
        expect(digestSfValue(retry)).toBe(digestSfValue(consumed.question.thread))
        const thread = await collaborationValue(context, "thread-read", { id: consumed.question.thread.id })
        if (!isThread(thread)) throw new Error("The native handoff question did not reopen through C06")
        expect(thread.messages).toEqual(consumed.question.thread.messages)
        expect(await storageVersion(context, "threads")).toBe(consumed.question.version)
      }
      console.log("SF_WP12_HANDOFF_REOPEN:" + JSON.stringify({ scope: "existing-action-relation-and-optional-native-question-consumers-reopened",
        githubSha: process.env.GITHUB_SHA ?? null, actionId: initial.selected.topicId, relationId: initial.selected.relationId,
        questionId: consumed.question?.thread.id ?? null, nativeOutputRef: initial.completed?.output.id ?? null,
        nativeOperationWitness: initial.completed ? "sf_handoff_prepare" : null,
        allSkillRequiredOperationsAccepted: false, unexercisedRequiredOperations: ["sf_answer_read", "sf_work_list"],
        confirmedAnswerReuseAccepted: false, inferenceExecuted: !!initial.completed, gnativeAccepted: false }))
    })
  })
}, 300_000)

async function createSelectedHandoff(context: Wp12NativeMissionContext, source: Extract<BusinessEvidenceRef, { kind: "record" }>) {
  const directory = await collaborationValue(context, "recipients", {})
  if (!Array.isArray(directory)) throw new Error("The real handoff recipient directory was unavailable")
  const people = directory.map(object).filter((person) => person.id === context.principalRef)
  expect(people).toHaveLength(1)
  const name = people[0]?.name
  if (typeof name !== "string" || !name.trim()) throw new Error("The selected human recipient has no authorized directory name")
  const created = object(await collaborationValue(context, "handoff-create", { sourceRef: source.refId,
    recipientRef: context.principalRef, relationKey: randomUUID(), intent: { correlationKey: randomUUID(), sourceRefs: [source],
      action: "Esclarecer a informação pendente da decisão com a pessoa selecionada", owner: name,
      due: WP12_QUESTION_PERIOD.end, priority: "normal", notes: "" } }))
  const topic = object(created.topic)
  const topicStatus = topic.status
  if (created.state !== "created" || typeof created.relationId !== "string" || typeof topic.id !== "string" || !topic.id.trim())
    throw new Error("The real C06 handoff did not create its canonical action and relation")
  if (typeof topicStatus !== "string") throw new Error("The real C06 handoff did not return its canonical action status")
  const read = await dispatchWp12Ui(context, "sf_relation_read", { recordRefs: [source.refId] })
  if (read.status !== "ok" || read.receipt.kind !== "ui") throw new Error("The human-confirmed handoff relation cannot be read")
  const relation = decodeSfOperationOutput("sf_relation_read", read.result)
  if (!relation.ok) throw new Error("The actual handoff relation does not satisfy the public schema")
  expect(relation.value.relations).toHaveLength(1)
  const row = relation.value.relations[0]!
  expect(row.id).toBe(created.relationId)
  expect(row.kind).toBe("handoff")
  expect(row.fromRef).toBe(source.refId)
  expect(row.confirmedBy).toBe(context.principalRef)
  const topicRef = row.evidenceRefs.find((ref) => ref.refId === row.toRef)
  if (topicRef?.kind !== "record" || topicRef.target.surface !== "dashboard" || topicRef.target.recordType !== "hotTopics" || topicRef.target.recordId !== topic.id)
    throw new Error("The action selector was not emitted by the actual Hot Topic producer")
  expect(row.evidenceRefs).toHaveLength(2)
  expect(row.evidenceRefs.some((ref) => digestSfValue(ref) === digestSfValue(source))).toBe(true)
  const day = new Date(context.at).toISOString().slice(0, 10)
  expect(topicRef.target.period).toEqual({ start: day, end: day })
  expect(topicRef.target.fields).toEqual(["status"])
  const projection = await context.ui("sf_context_get", { actionRef: topicRef.refId }, (call) => context.business.dashboardRecords.read(topicRef.refId, call))
  if (projection.status !== "ok") throw new Error(`The issued action source is not readable: ${projection.reason}`)
  expect(projection.value.values).toHaveLength(1)
  expect(projection.value.values[0]?.value).toBe(topicStatus)
  expect(projection.value.values[0]?.sourceRefs).toEqual([topicRef])
  return { topicRef, topicId: topic.id, topicDigest: digestSfValue(topic), relationId: created.relationId }
}

function questionRequest(context: Wp12NativeMissionContext, caseRef: Preparation["request"]["caseRef"], objective: string) {
  const selected = context.services.selected.find((entry) => entry.profile.id === "sf_maestro")
  const skill = selected?.skills.find((entry) => entry.id === "sf-coordenar-perguntas")
  if (!selected || !skill) throw new Error("The installed host did not publish the question handoff skill")
  for (const operation of nativeOperations) {
    expect(selected.profile.allowedOperations).toContain(operation)
    expect(skill.allowedOperations).toContain(operation)
    expect(selected.operationIds).toContain(operation)
  }
  return { caseRef, profileId: selected.profile.id, profileVersion: selected.profile.version, skillId: skill.id, skillVersion: skill.version,
    objective, manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [...nativeOperations] }
}

async function prepareInput(context: Wp12NativeMissionContext, incoming: Preparation) {
  const response = await context.services.productHttp?.(context.request({ action: "prepare", input: incoming }, "/sucafina/planner?sf=workbench-analysis"), "planner")
  if (!response) throw new Error("The real handoff question analysis route is missing")
  return { response, body: object(await response.json()) }
}

async function collaborationHttp(context: Wp12NativeMissionContext, route: string, payload: unknown) {
  const response = await context.services.productHttp?.(context.request(payload, `/sucafina/planner?sf=collaboration-${route}`), "planner")
  if (!response) throw new Error(`The installed host did not mount collaboration-${route}`)
  return { response, body: object(await response.json()) }
}

async function collaborationValue(context: Wp12NativeMissionContext, route: string, payload: unknown) {
  const result = await collaborationHttp(context, route, payload)
  if (result.response.status !== 200 || result.body.status !== "ok") throw new Error(`Real collaboration ${route} failed: ${String(result.body.reason)}`)
  return result.body.value
}

async function storageVersion(context: Wp12NativeMissionContext, namespace: "relations" | "threads") {
  const version = await collaborationValue(context, "storage-version", { namespace })
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) throw new Error("The real collaboration storage has no version")
  return version
}

async function hotTopicsDigest(context: Wp12NativeMissionContext) {
  return context.persistence.transaction("dashboard", async (snapshot) => {
    expect(Array.isArray(snapshot.data.hotTopics)).toBe(true)
    expect(snapshot.data.hotTopics).toHaveLength(1)
    return { commit: false, value: digestSfValue(snapshot.data.hotTopics) }
  })
}

function refSet(refs: readonly BusinessEvidenceRef[]) {
  return digestSfValue(refs.map((ref) => digestSfValue(ref)).sort())
}

async function expectUnchanged(context: Wp12NativeMissionContext, prepared: Awaited<ReturnType<typeof prepareWp12QuestionCase>>,
  caseDigest: string, domainDigest: string, relationsVersion: number, threadsVersion: number) {
  const current = await readCaseAnalysisProjection(context.request(), context.services, prepared.caseRef)
  if (current.status !== "ok") throw new Error("The handoff caller cannot read its current case")
  expect(digestSfValue(current.value.case)).toBe(caseDigest)
  expect(await wp12QuestionSourceDigest(context)).toBe(prepared.plannerSourceDigest)
  expect(await hotTopicsDigest(context)).toBe(domainDigest)
  expect(await storageVersion(context, "relations")).toBe(relationsVersion)
  expect(await storageVersion(context, "threads")).toBe(threadsVersion)
}

async function readNativeHandoff(context: Wp12NativeMissionContext, completed: Wp12CompletedNativeMission,
  actionRef: string, sourceRefs: readonly BusinessEvidenceRef[]): Promise<HandoffProposal> {
  const messages = await Effect.runPromise(context.session.messages({ sessionID: SessionSchema.ID.make(completed.receipt.nativeSessionId) }))
  const results = messages.flatMap((message) => message.type !== "assistant" ? [] : message.content.flatMap((part) => {
    if (part.type !== "tool" || part.name !== "sf_handoff_prepare" || part.state.status !== "completed" ||
      !completed.tools.some((tool) => tool.operation === part.name && tool.toolCallId === part.id)) return []
    const decoded = decodeSfOperationOutput("sf_handoff_prepare", part.state.structured.result)
    return decoded.ok ? [decoded.value] : []
  }))
  const selected = results.find((result) => result.actionRef === actionRef && refSet(result.sourceRefs) === refSet(sourceRefs))
  if (!selected) throw new Error("No actually completed native handoff call selected the real case action and both sources")
  return selected
}
