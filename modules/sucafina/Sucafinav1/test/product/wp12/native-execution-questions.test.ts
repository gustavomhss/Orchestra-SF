import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { isConsumedQuestion } from "../../../product/collaboration/question-consumer.ts"
import type { QuestionConsumption, QuestionContribution } from "../../../product/collaboration/question-consumer.ts"
import { isThread } from "../../../product/collaboration/threads.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import { esc } from "../../../src/screen-shell.ts"
import { dispatchWp12Ui, executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12CompletedNativeMission, Wp12NativeMissionContext } from "./native-mission-harness.ts"
import { initializeWp12QuestionSource, prepareWp12QuestionCase, wp12QuestionSourceDigest, WP12_QUESTION_HUMAN_ACTIONS, WP12_QUESTION_OPERATIONS,
  WP12_QUESTION_PENDING_REASON, WP12_QUESTION_PERIOD } from "./native-question-preparation.ts"

type Preparation = Parameters<NonNullable<SfHostServices["analysisInputs"]>["prepare"]>[1]
const label = "question-coordination"
const principalRef = `wp12-synthetic-${label}-principal`
const projectId = "wp12-question-project"
const capexId = "wp12-question-capex"
const unrelatedProjectId = "wp12-question-homonym"
const priorAnswer = "Ainda não há documento confirmado que estabeleça o custo necessário. A revisão anterior continua sem evidência suficiente."

test("QuestionPlanningInput carries real C06 support and its native proposal is consumed once after reload when a model exists", async () => {
  await withWp12NativeMissionHost({ label,
    operations: [...WP12_QUESTION_OPERATIONS, "sf_question_prepare", "sf_relation_read", "sf_work_list"],
    humanActions: [...WP12_QUESTION_HUMAN_ACTIONS, "collaboration.relation.confirm", "collaboration.storage.version", "collaboration.recipients",
      "collaboration.thread.create", "collaboration.thread.reply", "collaboration.thread.read", "collaboration.question.confirm",
      "collaboration.question.output", "collaboration.selection.create", "collaboration.selection.version", "collaboration.work.list"],
    namespaces: ["cases", "preferences", "documents", "contributions", "receipts", "outbox", "atlas", "threads", "relations", "confirmations"],
    initialize: initializeQuestionSources }, async (harness) => {
    const initial = await harness.open("initial", async (context) => {
      const objective = "Releia o caso com sf_case_read e as relações confirmadas com sf_relation_read. Consulte com sf_answer_read a resposta da questão referenciada pela condição. Prepare com sf_question_prepare uma pergunta pertinente para esclarecer a informação ainda necessária à decisão, usando somente as fontes do caso e o destinatário explicitamente autorizado. Preserve o estado observado da resposta e retorne a QuestionProposal da preparação, sem enviar a pergunta, confirmar fatos ausentes ou aplicar a decisão."
      const preparedCase = await prepareWp12QuestionCase(context, { objective, support: (source) => prepareQuestionSupport(context, source) })
      if (!preparedCase.questionRef) throw new Error("The focused question case has no real predecessor answer")
      const relationRequest = { recordRefs: preparedCase.case.sourceRefs.filter((ref) => ref.kind === "record" &&
        ref.target.surface === "dashboard" && [projectId, capexId].includes(ref.target.recordId)).map((ref) => ref.refId) }
      expect(relationRequest.recordRefs).toHaveLength(2)
      const relationRead = await dispatchWp12Ui(context, "sf_relation_read", relationRequest)
      if (relationRead.status !== "ok" || relationRead.receipt.kind !== "ui") throw new Error("The real relation was not readable before native preparation")
      const relationOutput = decodeSfOperationOutput("sf_relation_read", relationRead.result)
      if (!relationOutput.ok) throw new Error("The C06 relation output did not satisfy its schema")
      expect(relationOutput.value.relations).toHaveLength(1)

      const incoming = { request: questionRequest(context, preparedCase.caseRef, objective),
        selection: { relationRefIds: relationRequest.recordRefs, directoryRefs: [context.principalRef] } }
      const prepared = await prepareQuestionInput(context, incoming)
      expect(prepared.response.status).toBe(200)
      const decoded = decodeSfSkillInput("QuestionPlanningInput", prepared.body.value)
      if (!decoded.ok) throw new Error("The real question producer did not return its typed input")
      expect(decoded.value.case).toEqual(preparedCase.caseRef)
      expect(decoded.value.unresolvedConditions).toHaveLength(1)
      expect(decoded.value.unresolvedConditions[0]).toMatchObject({ category: "training", reason: WP12_QUESTION_PENDING_REASON,
        questionRef: preparedCase.questionRef, evidenceRefs: [] })
      expect(decoded.value.relations).toHaveLength(1)
      expect(decoded.value.relations[0]?.id).toBe(relationOutput.value.relations[0]?.id)
      expect(decoded.value.relations[0]?.state).toBe("confirmed")
      expect(decoded.value.relations[0]?.evidenceRefs.some((ref) => digestSfValue(ref) === digestSfValue(preparedCase.source))).toBe(true)
      expect(decoded.value.authorizedDirectoryRefs).toEqual([context.principalRef])

      const unrelated = await context.ui("sf_context_get", { purpose: "question-unrelated-source" }, async (call) => {
        const issued = await context.business.dashboardRecords.issue({ page: "Portfolio Dashboard", recordType: "projects",
          recordId: unrelatedProjectId, fields: ["name"], period: projectObservationPeriod(context) }, call)
        if (issued.status !== "ok") return issued
        const projection = await context.business.dashboardRecords.read(issued.value.refId, call)
        if (projection.status !== "ok") throw new Error(`The actual homonymous source is unreadable: ${projection.reason}`)
        expect(projection.value.values).toHaveLength(1)
        expect(projection.value.values[0]?.value).toBe("Shared question project")
        expect(projection.value.values[0]?.sourceRefs).toEqual([issued.value])
        return issued
      })
      if (unrelated.status !== "ok") throw new Error("The real homonymous negative source was not issued")
      expect(unrelated.value.target.recordId).toBe(unrelatedProjectId)
      expect(unrelated.value.target.period).toEqual(projectObservationPeriod(context))
      const outsideCase = await prepareQuestionInput(context, { ...incoming, selection: { ...incoming.selection, relationRefIds: [unrelated.value.refId] } })
      expect(outsideCase.response.status).toBe(503)
      expect(outsideCase.body).toMatchObject({ status: "unavailable", reason: "analysis-input-producer-unavailable" })
      const recipientName = await prepareQuestionInput(context, { ...incoming, selection: { ...incoming.selection, recipientName: "Shared question project" } })
      expect(recipientName.response.status).toBe(400)
      expect(recipientName.body).toMatchObject({ status: "needs-input", reason: "invalid-analysis-input" })
      const injectedCondition = await prepareQuestionInput(context, { ...incoming, selection: { ...incoming.selection,
        unresolvedConditions: [{ ...decoded.value.unresolvedConditions[0], evidenceRefs: [preparedCase.source] }] } })
      expect(injectedCondition.response.status).toBe(400)
      expect(injectedCondition.body).toMatchObject({ status: "needs-input", reason: "invalid-analysis-input" })

      const selectionVersion = await collaborationValue(context, "selection-version", {})
      if (typeof selectionVersion !== "number") throw new Error("The real case work selection has no storage version")
      const workSelection = object(await collaborationValue(context, "selection-create", { draft: { caseRef: encodeCaseRef(preparedCase.caseRef),
        period: WP12_QUESTION_PERIOD, sourceRefs: [preparedCase.source] },
        mutation: { expectedStorageVersion: selectionVersion, idempotencyKey: randomUUID() } }))
      if (typeof workSelection.selectionRef !== "string" || !workSelection.selectionRef.startsWith("sf:case-work-selection:"))
        throw new Error("The real work selection was not published")
      const work = await observeQuestionWork(context, workSelection.selectionRef)
      // The typed question input has no work-selection field. This UI-selected
      // ID is not inserted into the model prompt or relabelled as a native call.
      const current = await prepareQuestionInput(context, incoming)
      expect(current.response.status).toBe(200)
      expect(digestSfValue(current.body.value)).toBe(digestSfValue(decoded.value))
      const caseDigest = digestSfValue(preparedCase.case)
      const beforeThreads = await storageVersion(context, "threads")
      console.log("SF_WP12_NATIVE_QUESTION_SUPPORTED_INPUT:" + JSON.stringify({ scope: "one-real-c10-pending-condition-c06-relation-and-answered-thread",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: preparedCase.caseRef, inputDigest: digestSfValue(decoded.value),
        conditionOrigin: "human-classification", derivedOmissionProof: false, conditionEvidenceRefCount: 0,
        relationId: decoded.value.relations[0]?.id, relationEvidenceRefIds: decoded.value.relations[0]?.evidenceRefs.map((ref) => ref.refId),
        questionRef: preparedCase.questionRef, authorizedRecipientRefs: decoded.value.authorizedDirectoryRefs,
        work, inferenceExecuted: false, gnativeAccepted: false }))
      const base = { incoming, preparedCase, inputDigest: digestSfValue(decoded.value), caseDigest,
        workSelectionRef: workSelection.selectionRef, relationId: decoded.value.relations[0]!.id, work }
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: current.body.value })
        return { ...base, completed: undefined }
      }
      expectSpawn(import.meta.path)
      const completed = await executeWp12NativeMission(context, { request: incoming.request, skillInput: current.body.value,
        expectedKind: "QuestionProposal", requiredTools: ["sf_question_prepare", "sf_answer_read", "sf_relation_read"].map((operation) => ({ operation })) })
      if (completed.output.kind !== "QuestionProposal" || completed.output.state !== "ready") throw new Error("The native question output changed its kind")
      expect(completed.output.payload.recipientRef).toBe(context.principalRef)
      expect(completed.output.payload.evidenceRefs.some((ref) => digestSfValue(ref) === digestSfValue(preparedCase.source))).toBe(true)
      expect(completed.output.payload.question.toLowerCase()).toMatch(/trein|training/)
      await expectNativeQuestionCalls(context, completed, preparedCase.questionRef, base.relationId)
      expect(await storageVersion(context, "threads")).toBe(beforeThreads)
      expect(await wp12QuestionSourceDigest(context)).toBe(preparedCase.plannerSourceDigest)
      console.log("SF_WP12_NATIVE_QUESTION_PROPOSAL:" + JSON.stringify({ scope: "native-question-prepared-without-human-consumption",
        runRef: completed.runRef, outputRef: completed.output.id, nativeSessionId: completed.receipt.nativeSessionId,
        tools: completed.tools, requiredOperationsAccepted: ["sf_question_prepare", "sf_answer_read", "sf_relation_read"],
        requiredOperationsNotAccepted: ["sf_work_list"], am02NotAccepted: ["sf_handoff_prepare"],
        threadCreated: false, inferenceExecuted: true, gnativeAccepted: false }))
      return { ...base, completed }
    })

    const consumed = await harness.open("reopened", async (context) => {
      const prepared = await prepareQuestionInput(context, initial.incoming)
      expect(prepared.response.status).toBe(200)
      expect(digestSfValue(prepared.body.value)).toBe(initial.inputDigest)
      await expectQuestionCase(context, initial.preparedCase.caseRef, initial.caseDigest)
      expect(await wp12QuestionSourceDigest(context)).toBe(initial.preparedCase.plannerSourceDigest)
      const prior = await readAnswer(context, initial.preparedCase.questionRef!)
      expect(prior.answer).toBe(priorAnswer)
      expect(prior.state).toBe("unconfirmed")
      if (!initial.completed) {
        console.log("SF_WP12_NATIVE_QUESTION_INPUT_REOPEN:" + JSON.stringify({ scope: "real-question-input-relation-and-answer-reopened-without-inference",
          githubSha: process.env.GITHUB_SHA ?? null, caseRef: initial.preparedCase.caseRef, inputDigest: initial.inputDigest,
          relationId: initial.relationId, questionRef: initial.preparedCase.questionRef,
          outputRef: null, inferenceExecuted: false, gnativeAccepted: false }))
        return undefined
      }
      const reopened = await readWp12NativeMissionAfterReload(context, initial.completed)
      if (reopened.output.kind !== "QuestionProposal" || reopened.output.state !== "ready") throw new Error("The durable native question lost its kind")
      expect(reopened.html).toContain(esc(reopened.output.payload.question))
      const raw = object(await collaborationValue(context, "question-output", { outputRef: reopened.output.id, caseRef: reopened.output.caseRef }))
      const result = decodeSfOperationOutput("sf_question_prepare", raw.result)
      if (!result.ok) throw new Error("The real question-output consumer returned an invalid proposal")
      const proposal: QuestionContribution = { kind: "contribution", outputRef: reopened.output.id, outputDigest: reopened.output.outputDigest,
        caseRef: reopened.output.caseRef, result: result.value }
      expect(raw).toEqual(proposal)
      expect(result.value).toEqual(reopened.output.payload)
      const consumption: QuestionConsumption = { proposal, sourceRef: initial.preparedCase.source.refId, period: WP12_QUESTION_PERIOD,
        mutation: { expectedStorageVersion: await storageVersion(context, "threads"), idempotencyKey: randomUUID() } }
      const thread = await collaborationValue(context, "question-consume", consumption)
      if (!isConsumedQuestion(thread) || thread.questionOrigin.provenance.kind !== "contribution") throw new Error("The actual consumer lost native contribution provenance")
      expect(thread.questionOrigin.provenance.outputRef).toBe(reopened.output.id)
      expect(thread.questionOrigin.provenance.outputDigest).toBe(reopened.output.outputDigest)
      expect(thread.questionOrigin.provenance.runRef).toBe(initial.completed.runRef)
      expect(thread.messages).toHaveLength(1)
      expect(thread.messages[0]?.body).toBe(reopened.output.payload.question)
      expect(thread.recipientRef).toBe(context.principalRef)
      const version = await storageVersion(context, "threads")
      const retry = await collaborationValue(context, "question-consume", consumption)
      expect(digestSfValue(retry)).toBe(digestSfValue(thread))
      expect(await storageVersion(context, "threads")).toBe(version)
      const changed = await collaborationHttp(context, "question-consume", { ...consumption,
        proposal: { ...proposal, result: { ...proposal.result, question: "An unobserved replacement question" } } })
      expect(changed.response.status).toBe(409)
      expect(changed.body).toMatchObject({ status: "conflict", reason: "question-consumption-changed" })
      expect(await storageVersion(context, "threads")).toBe(version)
      const answer = "A solicitação foi recebida; ainda não existe confirmação documental do custo."
      await collaborationValue(context, "thread-reply", { id: thread.id, body: answer,
        mutation: { expectedStorageVersion: version, idempotencyKey: randomUUID() } })
      const answered = await collaborationValue(context, "question-consume", consumption)
      if (!isConsumedQuestion(answered)) throw new Error("The persisted native question lost its canonical origin after the human reply")
      expect(answered.questionOrigin).toEqual(thread.questionOrigin)
      expect(answered.messages).toHaveLength(2)
      expect(answered.messages[1]?.body).toBe(answer)
      const work = await observeQuestionWork(context, initial.workSelectionRef, thread.id)
      await expectQuestionCase(context, initial.preparedCase.caseRef, initial.caseDigest)
      expect(await wp12QuestionSourceDigest(context)).toBe(initial.preparedCase.plannerSourceDigest)
      console.log("SF_WP12_NATIVE_QUESTION_HUMAN_CONSUMER:" + JSON.stringify({ scope: "native-contribution-consumed-after-reload-with-human-confirmation",
        githubSha: process.env.GITHUB_SHA ?? null, outputRef: reopened.output.id, runRef: initial.completed.runRef, threadId: thread.id,
        predecessorThreadId: initial.preparedCase.questionRef, originKind: thread.questionOrigin.provenance.kind,
        observedActions: ["question-output", "question-consume", "same-contribution-retry", "changed-command-refused", "human-reply"],
        threadCountFromThisContribution: 1, work, confirmedAnswerReused: false, inferenceExecuted: true, gnativeAccepted: false }))
      return { consumption, thread: answered, answer }
    })
    if (!consumed) return
    await harness.open("reopened", async (context) => {
      const version = await storageVersion(context, "threads")
      const retry = await collaborationValue(context, "question-consume", consumed.consumption)
      expect(digestSfValue(retry)).toBe(digestSfValue(consumed.thread))
      expect(await storageVersion(context, "threads")).toBe(version)
      const publicThread = await collaborationValue(context, "thread-read", { id: consumed.thread.id })
      if (!isThread(publicThread)) throw new Error("The public native-question consumer did not return its thread")
      expect(publicThread.id).toBe(consumed.thread.id)
      expect(publicThread.messages).toEqual(consumed.thread.messages)
      expect(publicThread.evidenceRefs).toEqual(consumed.thread.evidenceRefs)
      const answer = await readAnswer(context, consumed.thread.id)
      expect(answer.answer).toBe(consumed.answer)
      expect(answer.state).toBe("unconfirmed")
      await expectQuestionCase(context, initial.preparedCase.caseRef, initial.caseDigest)
      expect(await wp12QuestionSourceDigest(context)).toBe(initial.preparedCase.plannerSourceDigest)
      console.log("SF_WP12_NATIVE_QUESTION_THREAD_REOPEN:" + JSON.stringify({ scope: "canonical-native-origin-thread-and-unconfirmed-answer-reopened",
        githubSha: process.env.GITHUB_SHA ?? null, threadId: consumed.thread.id,
        outputRef: consumed.consumption.proposal.kind === "contribution" ? consumed.consumption.proposal.outputRef : null,
        observedActions: ["same-contribution-retry", "thread-read", "sf_answer_read"], answerState: answer.state,
        inferenceExecuted: true, gnativeAccepted: false }))
    })
  })
}, 300_000)

async function initializeQuestionSources(persistence: Wp12NativeMissionContext["persistence"]) {
  await initializeWp12QuestionSource(persistence)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.access = { ...object(snapshot.data.access), [principalRef]: { role: "admin" } }
    snapshot.data.projects = [projectId, unrelatedProjectId].map((id) => ({ id, name: "Shared question project", status: "Planning",
      risk: "Low", budget: 0, spent: 0, pct: 0, milestones: [] }))
    snapshot.data.capexProjects = [{ id: capexId, name: "Selected question funding", year: 2027, ownerId: "wp12-source-owner" }]
    snapshot.data.capexEntries = []
    return { commit: true, value: undefined }
  })
}

async function prepareQuestionSupport(context: Wp12NativeMissionContext, source: Extract<BusinessEvidenceRef, { kind: "record" }>) {
  const directory = await collaborationValue(context, "recipients", {})
  if (!Array.isArray(directory)) throw new Error("The real recipient directory returned no collection")
  expect(directory.filter((person) => object(person).id === context.principalRef)).toHaveLength(1)
  const observationPeriod = projectObservationPeriod(context)
  const sources = await context.ui("sf_context_get", { purpose: "question-confirmed-support" }, async (call) => {
    // C06 needs the actual endpoint identity. Its current record projection
    // accepts scalar fields; the raw milestones array is not a readable value.
    const project = await context.business.dashboardRecords.issue({ page: "Portfolio Dashboard", recordType: "projects", recordId: projectId,
      fields: ["name"], period: observationPeriod }, call)
    if (project.status !== "ok") throw new Error(`The real relation project source was not issued: ${project.reason}`)
    const capex = await context.business.dashboardRecords.issue({ page: "CAPEX Projects", recordType: "capexProjects", recordId: capexId,
      fields: ["name"], period: WP12_QUESTION_PERIOD }, call)
    if (capex.status !== "ok") throw new Error(`The real relation CAPEX source was not issued: ${capex.reason}`)
    expect(project.value.target.surface).toBe("dashboard")
    expect(project.value.target.recordType).toBe("projects")
    expect(project.value.target.recordId).toBe(projectId)
    expect(project.value.target.period).toEqual(observationPeriod)
    expect(capex.value.target.surface).toBe("dashboard")
    expect(capex.value.target.recordType).toBe("capexProjects")
    expect(capex.value.target.recordId).toBe(capexId)
    expect(capex.value.target.period).toEqual(WP12_QUESTION_PERIOD)
    for (const ref of [project.value, capex.value]) {
      const projection = await context.business.dashboardRecords.read(ref.refId, call)
      if (projection.status !== "ok") throw new Error(`The actual C06 endpoint is unreadable: ${projection.reason}`)
      expect(projection.value.values).toHaveLength(1)
      expect(projection.value.values[0]?.value).toBe(ref.target.recordType === "projects" ? "Shared question project" : "Selected question funding")
      expect(projection.value.values[0]?.sourceRefs).toEqual([ref])
      expect(projection.value.values[0]?.drilldown).toEqual(ref)
    }
    console.log("SF_WP12_NATIVE_QUESTION_RELATION_ENDPOINTS:" + JSON.stringify({ scope: "actual-current-project-and-selected-capex-year",
      githubSha: process.env.GITHUB_SHA ?? null, observedAt: context.at, projectObservationPeriod: observationPeriod,
      financialHorizon: WP12_QUESTION_PERIOD, endpoints: [project.value, capex.value].map((ref) => ({ sourceRef: ref.refId,
        recordType: ref.target.recordType, recordId: ref.target.recordId, fields: ref.target.fields, period: ref.target.period })),
      inferenceExecuted: false, gnativeAccepted: false }))
    return [project.value, capex.value] as const
  })
  const pair = { fromRef: sources[0].refId, toRef: sources[1].refId, kind: "pmo-capex", evidenceRefs: [...sources, source] }
  const relation = object(await collaborationValue(context, "relation-create", { operation: "create", pair,
    mutation: { expectedStorageVersion: await storageVersion(context, "relations"), idempotencyKey: randomUUID() } }))
  expect(relation.confirmedBy).toBe(context.principalRef)
  expect(relation.fromRef).toBe(pair.fromRef)
  expect(relation.toRef).toBe(pair.toRef)
  expect(relation.evidenceRefs).toEqual(pair.evidenceRefs)
  const draft = { kind: "review", sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version,
    period: WP12_QUESTION_PERIOD, recipientRef: context.principalRef, evidenceRefs: [source],
    body: "Existe evidência confirmada para o custo de treinamento deste planejamento?" }
  const thread = await collaborationValue(context, "thread-create", { draft,
    mutation: { expectedStorageVersion: await storageVersion(context, "threads"), idempotencyKey: randomUUID() } })
  if (!isThread(thread)) throw new Error("The predecessor review was not created by the canonical thread port")
  await collaborationValue(context, "thread-reply", { id: thread.id, body: priorAnswer,
    mutation: { expectedStorageVersion: await storageVersion(context, "threads"), idempotencyKey: randomUUID() } })
  const answer = await readAnswer(context, thread.id)
  expect(answer.answer).toBe(priorAnswer)
  expect(answer.state).toBe("unconfirmed")
  return { evidenceRefs: sources, questionRef: thread.id }
}

function projectObservationPeriod(context: Pick<Wp12NativeMissionContext, "at">) {
  const observedAt = new Date(context.at)
  if (!Number.isFinite(observedAt.getTime())) throw new Error("The host project observation time is invalid")
  // Projects are current snapshots; the selected CAPEX record and Planner
  // planning horizon retain their own financial year.
  const year = observedAt.getUTCFullYear()
  return { start: `${year}-01-01`, end: `${year}-12-31` }
}

function questionRequest(context: Wp12NativeMissionContext, caseRef: Preparation["request"]["caseRef"], objective: string) {
  const selected = context.services.selected.find((entry) => entry.profile.id === "sf_maestro")
  const skill = selected?.skills.find((entry) => entry.id === "sf-coordenar-perguntas")
  if (!selected || !skill) throw new Error("The installed host did not publish the question skill")
  return { caseRef, profileId: selected.profile.id, profileVersion: selected.profile.version, skillId: skill.id, skillVersion: skill.version,
    objective, manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1",
    requestedOperationScope: ["sf_answer_read", "sf_case_read", "sf_question_prepare", "sf_relation_read", "sf_work_list"] }
}

async function prepareQuestionInput(context: Wp12NativeMissionContext, incoming: Preparation) {
  const response = await context.services.productHttp?.(context.request({ action: "prepare", input: incoming }, "/sucafina/planner?sf=workbench-analysis"), "planner")
  if (!response) throw new Error("The real question analysis preparation route is missing")
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

async function storageVersion(context: Wp12NativeMissionContext, namespace: "threads" | "relations") {
  const value = await collaborationValue(context, "storage-version", { namespace })
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("The canonical collaboration store returned no version")
  return value
}

async function readAnswer(context: Wp12NativeMissionContext, questionRef: string) {
  const request = { questionRef }
  const answer = await dispatchWp12Ui(context, "sf_answer_read", request)
  if (answer.status !== "ok" || answer.receipt.kind !== "ui") throw new Error("The actual question has no bound answer observation")
  const result = decodeSfOperationOutput("sf_answer_read", answer.result)
  if (!result.ok) throw new Error("The real answer reader returned an invalid schema")
  return result.value
}

async function expectQuestionCase(context: Wp12NativeMissionContext, caseRef: Preparation["request"]["caseRef"], digest: string) {
  const read = await readCaseAnalysisProjection(context.request(), context.services, caseRef)
  if (read.status !== "ok") throw new Error("The question case is no longer readable")
  expect(digestSfValue(read.value.case)).toBe(digest)
}

async function expectNativeQuestionCalls(context: Wp12NativeMissionContext, completed: Wp12CompletedNativeMission, questionRef: string, relationId: string) {
  if (completed.output.kind !== "QuestionProposal" || completed.output.state !== "ready") throw new Error("Native question call inspection requires its real ready output")
  const output = completed.output.payload
  const messages = await Effect.runPromise(context.session.messages({ sessionID: SessionSchema.ID.make(completed.receipt.nativeSessionId) }))
  const calls = messages.flatMap((message) => message.type !== "assistant" ? [] : message.content.flatMap((part) =>
    part.type === "tool" && part.state.status === "completed" && completed.tools.some((tool) => tool.toolCallId === part.id)
      ? [{ operation: part.name, result: part.state.structured.result }] : []))
  const answers = calls.flatMap((call) => {
    if (call.operation !== "sf_answer_read") return []
    const decoded = decodeSfOperationOutput("sf_answer_read", call.result)
    return decoded.ok ? [decoded.value] : []
  })
  expect(answers.some((answer) => answer.questionRef === questionRef && answer.state === "unconfirmed" && answer.answer === priorAnswer)).toBe(true)
  const relations = calls.flatMap((call) => {
    if (call.operation !== "sf_relation_read") return []
    const decoded = decodeSfOperationOutput("sf_relation_read", call.result)
    return decoded.ok ? decoded.value.relations : []
  })
  expect(relations.some((relation) => relation.id === relationId)).toBe(true)
  const questions = calls.flatMap((call) => {
    if (call.operation !== "sf_question_prepare") return []
    const decoded = decodeSfOperationOutput("sf_question_prepare", call.result)
    return decoded.ok ? [decoded.value] : []
  })
  expect(questions.some((question) => digestSfValue(question) === digestSfValue(output))).toBe(true)
}

async function observeQuestionWork(context: Wp12NativeMissionContext, selectionRef: string, threadId?: string) {
  const result = await collaborationHttp(context, "work-list", { selectionRef, period: WP12_QUESTION_PERIOD })
  if (result.body.status !== "ok") {
    expect(result.response.status).toBe(503)
    expect(result.body).toMatchObject({ status: "unavailable", reason: "work-signals-unavailable" })
    return { status: "unavailable", reason: "work-signals-unavailable", nativeWitnessAccepted: false, consumerAccepted: false }
  }
  expect(result.response.status).toBe(200)
  const value = object(result.body.value)
  const items = Array.isArray(result.body.value) ? result.body.value : value.items
  if (!Array.isArray(items)) throw new Error("The actual work list returned no presentation items")
  if (threadId) expect(items.filter((item) => object(item).actionRef === threadId)).toHaveLength(1)
  return { status: "ok", nativeWitnessAccepted: false, consumerAccepted: !!threadId }
}
