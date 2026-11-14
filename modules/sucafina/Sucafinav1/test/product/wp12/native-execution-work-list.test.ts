import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import type { AuthorizedWorkList } from "../../../product/contracts/outputs.ts"
import type { WorkListRequest } from "../../../product/contracts/operations.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { isConsumedQuestion } from "../../../product/collaboration/question-consumer.ts"
import type { QuestionConsumption, QuestionContribution } from "../../../product/collaboration/question-consumer.ts"
import { isThread } from "../../../product/collaboration/threads.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createSfWorkbenchHttp } from "../../../product/interface/http.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import { dispatchWp12Ui, executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload,
  withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12CompletedNativeMission, Wp12NativeMissionContext } from "./native-mission-harness.ts"
import { initializeWp12QuestionSource, prepareWp12QuestionCase, wp12QuestionSourceDigest, WP12_QUESTION_HUMAN_ACTIONS,
  WP12_QUESTION_OPERATIONS, WP12_QUESTION_PENDING_REASON, WP12_QUESTION_PERIOD } from "./native-question-preparation.ts"

type Preparation = Parameters<NonNullable<SfHostServices["analysisInputs"]>["prepare"]>[1]
type CaseRef = Preparation["request"]["caseRef"]
type SelectedWork = Awaited<ReturnType<typeof createLinkedWork>>
type PublicWork = Awaited<ReturnType<typeof selectPublicWork>>
const period = WP12_QUESTION_PERIOD
const requestId = "WP12-WORK-REQUEST"
const unrelatedRequestId = "WP12-WORK-HOMONYM"
const requestTitle = "Renewal training request"
const actionText = "Obtain training cost evidence for the selected renewal request"
const questionOperations = ["sf_case_read", "sf_work_list", "sf_relation_read", "sf_question_prepare"] as const
const executiveOperations = ["sf_case_read", "sf_work_list", "sf_review_prepare", "sf_source_get"] as const
const collaborationActions = ["collaboration.handoff.confirm", "collaboration.recipients", "collaboration.storage.version",
  "collaboration.question.output", "collaboration.question.confirm", "collaboration.thread.read"] as const
const namespaces = ["cases", "preferences", "documents", "contributions", "receipts", "outbox", "atlas", "threads", "relations", "confirmations", "reviews"] as const

/** The public Workbench selection is an explicit human choice. Its Procurement
 * request, C06 action and pending decision all concern the same renewal. A raw
 * homonymous request has neither the selected action nor the case membership. */
test("native question work list uses a public Procurement selection for its own pending case and reopens its real consumers", async () => {
  const label = "question-work-list"
  await withWp12NativeMissionHost({ label, namespaces,
    operations: [...WP12_QUESTION_OPERATIONS, "sf_request_read", "sf_work_list", "sf_relation_read", "sf_question_prepare"],
    humanActions: [...WP12_QUESTION_HUMAN_ACTIONS, ...collaborationActions],
    initialize: async (persistence) => { await initializeWp12QuestionSource(persistence); await initializeWorkSources(persistence, label) },
  }, async ({ open }) => {
    const initial = await open("initial", async (context) => {
      const publicWork = await selectPublicWork(context)
      const objective = `Clarifique a informação de custo ainda pendente da renovação registrada no caso. A pessoa escolheu explicitamente a seleção pública de Meu Trabalho ${publicWork.selection.selectionRef}, período ${period.start} a ${period.end}. Use sf_case_read e sf_relation_read para conferir a ligação entre a solicitação de compra, a ação humana já existente e o planejamento. Leia essa seleção por sf_work_list e confira a ação atribuída ao destinatário autorizado; não crie outra ação. Prepare com sf_question_prepare uma pergunta pertinente à condição de custo ainda pendente e retorne QuestionProposal com as fontes da relação. A seleção pública foi escolhida pela pessoa; não alegue descoberta autônoma ou confirmação de custo ausente.`
      const holder: { value?: SelectedWork } = {}
      const preparedCase = await prepareWp12QuestionCase(context, { objective, support: async (source) => {
        holder.value = await createLinkedWork(context, [source])
        return { evidenceRefs: [holder.value.requestRef, holder.value.topicRef] }
      } })
      const selected = holder.value
      if (!selected) throw new Error("The actual question work producer did not return its selected request and action")
      const incoming = { request: missionRequest(context, preparedCase.caseRef, "sf-coordenar-perguntas", objective, questionOperations),
        selection: { relationRefIds: [selected.requestRef.refId, selected.topicRef.refId], directoryRefs: [context.principalRef] } }
      const input = decodeSfSkillInput("QuestionPlanningInput", await prepareInput(context, incoming))
      if (!input.ok) throw new Error("The actual work-linked question input failed its schema")
      expect(input.value.unresolvedConditions).toHaveLength(1)
      expect(input.value.unresolvedConditions[0]).toMatchObject({ category: "training", reason: WP12_QUESTION_PENDING_REASON, evidenceRefs: [] })
      expect(input.value.unresolvedConditions[0]?.questionRef).toBeUndefined()
      expect(input.value.relations).toHaveLength(1)
      expect(input.value.relations[0]).toMatchObject({ id: selected.relationId, state: "confirmed", from: selected.requestRef, to: selected.topicRef })
      expect(refSet(input.value.relations[0]!.evidenceRefs)).toBe(refSet(selected.evidenceRefs))
      expect(input.value.authorizedDirectoryRefs).toEqual([context.principalRef])
      await expectCaseSources(context, preparedCase.caseRef, [preparedCase.source, selected.requestRef, selected.topicRef])
      const caseDigest = digestSfValue(preparedCase.case)
      const domainDigest = await workSourceDigest(context)
      const ui = await readUiWork(context, publicWork, selected)
      await expectWorkbenchConsumer(context, publicWork, selected)
      await expectUnauthenticatedWorkRefused(context, publicWork)
      console.log("SF_WP12_QUESTION_WORK_INPUT:" + JSON.stringify({ scope: "real-same-case-request-action-condition-and-public-ui-work-selection",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: preparedCase.caseRef, inputDigest: digestSfValue(input.value), selectionRef: publicWork.selection.selectionRef,
        selectionOrigin: "actual-workbench-work-select-html", requestRef: selected.requestRef, actionRef: selected.topicRef, relationId: selected.relationId,
        conditionOrigin: "actual-C10-explicit-human-pending-coverage", conditionId: input.value.unresolvedConditions[0]!.id,
        uiWorkReceipt: ui.receipt, uiWorkItems: ui.value.items, autonomousDiscovery: false, privateSelectorInjected: false,
        inferenceExecuted: false, gnativeAccepted: false }))
      let completed: Wp12CompletedNativeMission | undefined
      let nativeWork: Awaited<ReturnType<typeof readNativeWork>> | undefined
      if (!context.models.length) observeWp12UnavailableMission(context, { request: incoming.request, skillInput: input.value })
      else {
        expectSpawn(import.meta.path)
        completed = await executeWp12NativeMission(context, { request: incoming.request, skillInput: input.value, expectedKind: "QuestionProposal",
          requiredTools: [{ operation: "sf_case_read" }, { operation: "sf_work_list", handlerExport: "listWork" },
            { operation: "sf_relation_read", handlerExport: "readRelations" }, { operation: "sf_question_prepare", handlerExport: "prepareQuestion" }] })
        nativeWork = await readNativeWork(context, completed, publicWork.selection, selected)
        expect(nativeWork.value).toEqual(ui.value)
        if (completed.output.kind !== "QuestionProposal" || completed.output.state !== "ready") throw new Error("The actual work mission changed its question output")
        expect(completed.output.payload.recipientRef).toBe(context.principalRef)
        expect(refSet(completed.output.payload.evidenceRefs)).toBe(refSet(selected.evidenceRefs))
      }
      await expectCaseDigest(context, preparedCase.caseRef, caseDigest)
      expect(await workSourceDigest(context)).toBe(domainDigest)
      expect(await wp12QuestionSourceDigest(context)).toBe(preparedCase.plannerSourceDigest)
      return { publicWork, selected, incoming, inputDigest: digestSfValue(input.value), caseDigest, domainDigest, preparedCase, completed, nativeWork }
    })
    const consumed = await open("reopened", async (context) => {
      await expectExpiredHostSelectionRefused(context, initial.publicWork)
      const publicWork = await selectPublicWork(context)
      const input = await prepareInput(context, initial.incoming)
      expect(digestSfValue(input)).toBe(initial.inputDigest)
      await readUiWork(context, publicWork, initial.selected)
      await expectWorkbenchConsumer(context, publicWork, initial.selected)
      await consumeExistingAction(context, initial.selected)
      let question: Awaited<ReturnType<typeof consumeNativeQuestion>> | undefined
      if (initial.completed) {
        await readWp12NativeMissionAfterReload(context, initial.completed)
        expect(digestSfValue(await readNativeWork(context, initial.completed, initial.publicWork.selection, initial.selected))).toBe(digestSfValue(initial.nativeWork))
        question = await consumeNativeQuestion(context, initial.completed, initial.selected)
        await readUiWork(context, publicWork, initial.selected, question.thread.id)
        await expectWorkbenchConsumer(context, publicWork, initial.selected, question.thread.id, question.thread.messages[0]?.body)
      }
      await expectCaseDigest(context, initial.preparedCase.caseRef, initial.caseDigest)
      expect(await workSourceDigest(context)).toBe(initial.domainDigest)
      console.log("SF_WP12_QUESTION_WORK_CONSUMER:" + JSON.stringify({ scope: "real-workbench-and-c06-consumers-after-explicit-public-reselection",
        githubSha: process.env.GITHUB_SHA ?? null, selectionRef: publicWork.selection.selectionRef, priorHostSelectionRefused: true,
        actionId: initial.selected.topicId, questionId: question?.thread.id ?? null, outputRef: initial.completed?.output.id ?? null,
        nativeCallId: initial.nativeWork?.callId ?? null, nativeReceipt: initial.nativeWork?.receipt ?? null,
        inferenceExecuted: !!initial.completed, questionConsumerOrigin: question ? "actual-native-contribution" : null,
        allSkillRequiredOperationsAccepted: false, unexercisedRequiredOperations: ["sf_answer_read"], confirmedAnswerReuseAccepted: false, gnativeAccepted: false }))
      return { question }
    })
    await open("reopened", async (context) => {
      const publicWork = await selectPublicWork(context)
      await consumeExistingAction(context, initial.selected)
      if (consumed.question) {
        const retry = await collaborationValue(context, "question-consume", consumed.question.consumption)
        expect(digestSfValue(retry)).toBe(digestSfValue(consumed.question.thread))
        const thread = await collaborationValue(context, "thread-read", { id: consumed.question.thread.id })
        if (!isThread(thread)) throw new Error("The canonical question work thread was lost after reload")
        expect(thread.messages).toEqual(consumed.question.thread.messages)
        expect(thread.evidenceRefs).toEqual(consumed.question.thread.evidenceRefs)
      }
      await readUiWork(context, publicWork, initial.selected, consumed.question?.thread.id)
      await expectWorkbenchConsumer(context, publicWork, initial.selected, consumed.question?.thread.id, consumed.question?.thread.messages[0]?.body)
      await expectCaseDigest(context, initial.preparedCase.caseRef, initial.caseDigest)
      expect(await wp12QuestionSourceDigest(context)).toBe(initial.preparedCase.plannerSourceDigest)
      await proveSourceLossRefusal(context, publicWork, initial.selected, initial.completed)
    })
  })
}, 360_000)

/** The selected review is the very Hot Topic returned by the same PR handoff.
 * The auxiliary work list remains in its actual tool result/receipt; it does not
 * expand DecisionBrief or pretend to provide the missing C07 routine results. */
test("native executive work list matches its selected real Hot Topic review and reopens the existing human action", async () => {
  const label = "executive-work-list"
  await withWp12NativeMissionHost({ label, namespaces,
    operations: ["sf_case_draft", "sf_case_read", "sf_context_get", "sf_request_read", "sf_work_list", "sf_relation_read", "sf_question_prepare", "sf_dashboard_read", "sf_review_prepare", "sf_source_get"],
    humanActions: ["analysis.prepare", "analysis.start", "analysis.read", "analysis.cancel", "reviews.preserve", ...collaborationActions],
    initialize: (persistence) => initializeWorkSources(persistence, label),
  }, async ({ open }) => {
    const initial = await open("initial", async (context) => {
      const publicWork = await selectPublicWork(context)
      const selected = await createLinkedWork(context, [])
      const day = new Date(context.at).toISOString().slice(0, 10)
      const reviewPeriod = { start: day, end: day }
      const page = await context.ui("sf_dashboard_read", { page: "Hot Topics & Actions", fields: ["hotTopics"], period: reviewPeriod }, (call) =>
        createDashboardSourceIssuer({ host: context.business.host, scopedSources: context.persistence })({ page: "Hot Topics & Actions", fields: ["hotTopics"], period: reviewPeriod }, call))
      if (page.status !== "ok") throw new Error(`The actual Hot Topic review source was unavailable: ${page.reason}`)
      const agenda = object((await productValue(context, "review-agenda", { items: [{ id: "selected-request-action", kind: "dashboard", topic: "hot-topics",
        selectionRef: page.value.selectionRef, period: reviewPeriod, recordRefs: [selected.topicRef.refId] }] })).value)
      if (typeof agenda.selectionRef !== "string" || !Array.isArray(agenda.sectionRefs) || agenda.sectionRefs.length !== 1 || agenda.sectionRefs.some((ref) => typeof ref !== "string"))
        throw new Error("The real Hot Topic agenda did not expose its public selection")
      const reviewSelection = { selectionRef: agenda.selectionRef, sectionRefs: agenda.sectionRefs.map(String), period: reviewPeriod }
      const prepared = await productValue(context, "review-preview", reviewSelection)
      const preview = decodeSfOperationOutput("sf_review_prepare", prepared.result)
      if (!preview.ok) throw new Error("The real Hot Topic review preview failed its schema")
      expect(preview.value.sectionRefs).toEqual(reviewSelection.sectionRefs)
      const preserved = await productValue(context, "review-preserve", { selectionRef: reviewSelection.selectionRef, sectionRefs: reviewSelection.sectionRefs })
      const review = readActionReview(preserved.value, selected)
      const objective = `Prepare a revisão executiva da ação humana já registrada para a solicitação de renovação. A pessoa selecionou a fila pública de Meu Trabalho ${publicWork.selection.selectionRef}, período ${period.start} a ${period.end}. Leia o caso com sf_case_read, confira a ação atribuída por sf_work_list e confronte seu id, estado, destinatário e fonte de compra com a ação do recorte Hot Topics atual. Use sf_review_prepare com a seleção do input e sf_source_get para verificar as fontes. Retorne DecisionBrief preservando exatamente as seções e lacunas; não crie ações, não atribua aprovação a IA e não invente resultados de rotinas. O período da solicitação e a data de observação da ação são diferentes e devem permanecer explícitos.`
      const draft = { objective, horizon: period, currency: "USD", criteria: ["Review the current assigned action for the selected renewal request without duplicating or approving it"],
        sourceRefs: uniqueRefs([selected.requestRef, selected.topicRef, page.value.evidence, ...preview.value.sourceRefs]) }
      const created = await context.ui("sf_case_draft", draft, (call) => context.business.cases.draft(draft, call))
      if (created.status !== "ok") throw new Error(`The actual executive work case could not be created: ${created.reason}`)
      const caseRef = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
      const incoming = { request: missionRequest(context, caseRef, "sf-preparar-revisao-executiva", objective, executiveOperations),
        selection: { ...reviewSelection, decisionRefs: [caseRef], includeConfirmations: false, includeRoutineResults: false } }
      const decoded = decodeSfSkillInput("ExecutiveReviewInput", await prepareInput(context, incoming, "dashboard"))
      if (!decoded.ok) throw new Error("The real executive work input failed its canonical schema")
      expect(decoded.value.reviewSelection).toEqual(reviewSelection)
      expect(decoded.value.decisionRefs).toEqual([caseRef])
      expect(decoded.value.factualRoutineResults).toEqual([])
      expect(decoded.value.confirmations).toEqual([])
      await expectCaseSources(context, caseRef, draft.sourceRefs)
      const ui = await readUiWork(context, publicWork, selected)
      await expectWorkbenchConsumer(context, publicWork, selected)
      await expectUnauthenticatedWorkRefused(context, publicWork)
      const caseDigest = digestSfValue(created.value), domainDigest = await workSourceDigest(context)
      console.log("SF_WP12_EXECUTIVE_WORK_INPUT:" + JSON.stringify({ scope: "same-actual-request-action-work-item-and-selected-review",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef, inputDigest: digestSfValue(decoded.value), selectionRef: publicWork.selection.selectionRef,
        selectionOrigin: "actual-workbench-work-select-html", requestRef: selected.requestRef, actionRef: selected.topicRef,
        reviewRef: review.id, reviewSelection, capturedAction: review.action, uiWorkReceipt: ui.receipt,
        auxiliaryWorkInsideDecisionBrief: false, inferenceExecuted: false, gnativeAccepted: false }))
      let completed: Wp12CompletedNativeMission | undefined
      let nativeWork: Awaited<ReturnType<typeof readNativeWork>> | undefined
      if (!context.models.length) observeWp12UnavailableMission(context, { request: incoming.request, skillInput: decoded.value })
      else {
        expectSpawn(import.meta.path)
        completed = await executeWp12NativeMission(context, { request: incoming.request, skillInput: decoded.value, expectedKind: "DecisionBrief",
          requiredTools: [{ operation: "sf_case_read" }, { operation: "sf_work_list", handlerExport: "listWork" }, { operation: "sf_review_prepare" }, { operation: "sf_source_get" }] })
        nativeWork = await readNativeWork(context, completed, publicWork.selection, selected)
        expect(nativeWork.value).toEqual(ui.value)
        const nativePreview = await readNativeOperation(context, completed, "sf_review_prepare", reviewSelection)
        const output = decodeSfOperationOutput("sf_review_prepare", nativePreview.result)
        if (!output.ok) throw new Error("The native executive review did not return its actual preview")
        expect(output.value).toEqual(preview.value)
        if (completed.output.kind !== "DecisionBrief" || completed.output.state !== "ready") throw new Error("The actual executive work output kind changed")
        expect(completed.output.payload.conditions).toEqual(preview.value.gaps)
        expect(completed.output.payload.orderedResultRefs).toEqual([])
        expect(refSet(completed.output.evidenceRefs)).toBe(refSet(preview.value.sourceRefs))
        await consumeExecutive(context, completed)
      }
      await expectCaseDigest(context, caseRef, caseDigest)
      expect(await workSourceDigest(context)).toBe(domainDigest)
      return { publicWork, selected, caseRef, caseDigest, domainDigest, review, completed, nativeWork }
    })
    await open("reopened", async (context) => {
      await expectExpiredHostSelectionRefused(context, initial.publicWork)
      const publicWork = await selectPublicWork(context)
      await readUiWork(context, publicWork, initial.selected)
      await expectWorkbenchConsumer(context, publicWork, initial.selected)
      await consumeExistingAction(context, initial.selected)
      const response = await context.services.productHttp?.(context.request(undefined,
        `/sucafina/dashboard?sf=review-read&reviewRef=${encodeURIComponent(initial.review.id)}`, "GET"), "dashboard")
      if (!response) throw new Error("The real preserved Hot Topic review reader is absent")
      expect(response.status).toBe(200)
      const body = object(await response.json())
      expect(body.status).toBe("ok")
      expect(digestSfValue(readActionReview(body.value, initial.selected))).toBe(digestSfValue(initial.review))
      if (initial.completed) {
        await readWp12NativeMissionAfterReload(context, initial.completed)
        expect(digestSfValue(await readNativeWork(context, initial.completed, initial.publicWork.selection, initial.selected))).toBe(digestSfValue(initial.nativeWork))
        await consumeExecutive(context, initial.completed)
      }
      await expectCaseDigest(context, initial.caseRef, initial.caseDigest)
      expect(await workSourceDigest(context)).toBe(initial.domainDigest)
      console.log("SF_WP12_EXECUTIVE_WORK_REOPEN:" + JSON.stringify({ scope: "real-workbench-action-and-preserved-review-reopened",
        githubSha: process.env.GITHUB_SHA ?? null, actionId: initial.selected.topicId, reviewRef: initial.review.id,
        selectionRef: publicWork.selection.selectionRef, priorHostSelectionRefused: true, outputRef: initial.completed?.output.id ?? null,
        nativeCallId: initial.nativeWork?.callId ?? null, nativeReceipt: initial.nativeWork?.receipt ?? null,
        nativeContributionConsumed: !!initial.completed, c07Executed: false, allSkillRequiredOperationsAccepted: false,
        inferenceExecuted: !!initial.completed, gnativeAccepted: false }))
      await proveSourceLossRefusal(context, publicWork, initial.selected, initial.completed)
    })
  })
}, 360_000)

async function initializeWorkSources(persistence: Wp12NativeMissionContext["persistence"], label: string) {
  const principalRef = `wp12-synthetic-${label}-principal`
  await persistence.transaction("procurement", async (snapshot) => {
    // Explicit raw business records only; no case, action, relation, thread,
    // selection, source identity, native receipt or work result is seeded.
    snapshot.data.store = { settings: { currency: "USD", fxRates: [], minQuotes: 1, techWeight: 80, commWeight: 20,
      criteria: [{ name: "Technical suitability", weight: 1 }], commCriteria: [{ name: "Price", weight: 1, auto: true }], requireActiveSupplier: true },
      suppliers: [], requests: Object.fromEntries([requestId, unrelatedRequestId].map((id) => [id, { version: 1,
        by: id === requestId ? principalRef : "wp12-unrelated-owner", request: { number: id, status: "draft",
          createdBy: id === requestId ? principalRef : "wp12-unrelated-owner", createdAt: "2027-01-01T00:00:00.000Z",
          pr: { title: requestTitle, type: "service", description: "Training evidence is still required for this renewal decision",
            estAmount: 210_000, costCenter: "WP12", needBy: period.end, justification: "Clarify the training cost before a human renewal decision", recurring: false } } }])) }
    return { commit: true, value: undefined }
  })
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.access = { ...object(snapshot.data.access), [principalRef]: { role: "admin" } }
    snapshot.data.hotTopics = []
    return { commit: true, value: undefined }
  })
}

function workbench(context: Wp12NativeMissionContext) {
  return createSfWorkbenchHttp({ origin: context.origin, mount: "/sucafina", runtime: () => context.services })
}

async function selectPublicWork(context: Wp12NativeMissionContext) {
  const query = new URLSearchParams({ sf: "workbench-work-select", start: period.start, end: period.end })
  const response = await workbench(context)(context.request(undefined, `/sucafina/procurement?${query}`, "GET"), "procurement")
  if (!response) throw new Error("The actual public work-selection route is absent")
  expect(response.status).toBe(200)
  const html = await response.text()
  const urls = [...html.matchAll(/href="([^"]+)"/g)].map((match) => new URL(match[1]!.replaceAll("&amp;", "&"), `${context.origin}/sucafina/procurement`))
    .filter((url) => url.searchParams.get("sf") === "workbench-work")
  expect(urls).toHaveLength(1)
  const url = urls[0]!
  const selectionRef = url.searchParams.get("selectionRef")
  if (!selectionRef || !selectionRef.trim()) throw new Error("The real Workbench HTML did not publish a work selector")
  expect(url.origin).toBe(context.origin)
  expect(url.pathname).toBe("/sucafina/procurement")
  expect(url.searchParams.get("start")).toBe(period.start)
  expect(url.searchParams.get("end")).toBe(period.end)
  expect(selectionRef.startsWith("sf:case-work-selection:")).toBe(false)
  // The auxiliary source reader has its own registry. Select its period through
  // its public port; never use that registry's handle for the mounted services.
  const intent = { purpose: "work-selection", period }
  const sourcePeriod = await context.ui("sf_work_list", intent, (call) => context.business.procurementSelections.create(call, period))
  if (sourcePeriod.status !== "ok") throw new Error(`The actual auxiliary source period was unavailable: ${sourcePeriod.reason}`)
  return { selection: { selectionRef, period }, path: url.pathname + url.search }
}

async function createLinkedWork(context: Wp12NativeMissionContext, additional: readonly BusinessEvidenceRef[]) {
  const requestRef = await context.ui("sf_request_read", { purpose: "same-case-work-request", requestId }, async (call) => {
    const issued = await context.business.individual.issue("procurement-request", requestId, call)
    if (issued.status !== "ok") throw new Error(`The actual work request source was not issued: ${issued.reason}`)
    const resolved = await context.business.individual.resolve(issued.value, call)
    if (resolved.status !== "ok") throw new Error(`The issued work request is unreadable: ${resolved.reason}`)
    expect(resolved.value.evidence.target.recordId).toBe(requestId)
    expect(resolved.value.evidence.target.recordType).toBe("procurement-request")
    expect(resolved.value.evidence.target.period).toEqual(period)
    return resolved.value.evidence
  })
  const directory = await collaborationValue(context, "recipients", {})
  if (!Array.isArray(directory)) throw new Error("The actual C06 recipient directory was unavailable")
  const people = directory.map(object).filter((person) => person.id === context.principalRef)
  expect(people).toHaveLength(1)
  const owner = people[0]?.name
  if (typeof owner !== "string" || !owner.trim()) throw new Error("The actual selected recipient has no name")
  const origins = [requestRef, ...additional]
  const created = object(await collaborationValue(context, "handoff-create", { sourceRef: requestRef.refId,
    recipientRef: context.principalRef, relationKey: randomUUID(), intent: { correlationKey: randomUUID(), sourceRefs: origins,
      action: actionText, owner, due: period.end, priority: "normal", notes: "" } }))
  const topic = object(created.topic)
  if (created.state !== "created" || typeof created.relationId !== "string" || typeof topic.id !== "string" || typeof topic.status !== "string")
    throw new Error("The real C06 handoff did not create its canonical action and relation")
  const relation = await dispatchWp12Ui(context, "sf_relation_read", { recordRefs: [requestRef.refId] })
  if (relation.status !== "ok") throw new Error(`The actual request/action relation is unavailable: ${relation.reason}`)
  const decoded = decodeSfOperationOutput("sf_relation_read", relation.result)
  if (!decoded.ok) throw new Error("The actual work relation failed its canonical schema")
  expect(decoded.value.relations).toHaveLength(1)
  const row = decoded.value.relations[0]!
  expect(row).toMatchObject({ id: created.relationId, kind: "handoff", fromRef: requestRef.refId, confirmedBy: context.principalRef })
  const topicRef = row.evidenceRefs.find((ref) => ref.refId === row.toRef)
  if (topicRef?.kind !== "record" || topicRef.target.surface !== "dashboard" || topicRef.target.recordType !== "hotTopics" || topicRef.target.recordId !== topic.id)
    throw new Error("The real work action was not the relation's published Hot Topic endpoint")
  expect(refSet(row.evidenceRefs)).toBe(refSet([...origins, topicRef]))
  expect(row.evidenceRefs.some((ref) => ref.kind === "record" && ref.target.recordId === unrelatedRequestId)).toBe(false)
  return { requestRef, topicRef, topicId: topic.id, topicStatus: topic.status, topicDigest: digestSfValue(topic), relationId: created.relationId,
    evidenceRefs: row.evidenceRefs, link: { topicRef: topicRef.refId, sourceRefs: row.evidenceRefs, sourceRef: requestRef.refId,
      recipientRef: context.principalRef, relationKey: randomUUID() } }
}

function missionRequest(context: Wp12NativeMissionContext, caseRef: CaseRef, skillId: string, objective: string, operations: readonly string[]) {
  const selected = context.services.selected.find((entry) => entry.profile.id === "sf_maestro")
  const skill = selected?.skills.find((entry) => entry.id === skillId)
  if (!selected || !skill) throw new Error(`The real host did not publish ${skillId}`)
  for (const operation of operations) {
    expect(selected.profile.allowedOperations).toContain(operation)
    expect(skill.allowedOperations).toContain(operation)
    expect(selected.operationIds).toContain(operation)
  }
  return { caseRef, profileId: selected.profile.id, profileVersion: selected.profile.version, skillId: skill.id, skillVersion: skill.version,
    objective, manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [...operations] }
}

async function prepareInput(context: Wp12NativeMissionContext, incoming: Preparation, surface: "planner" | "dashboard" = "planner") {
  const response = await context.services.productHttp?.(context.request({ action: "prepare", input: incoming }, `/sucafina/${surface}?sf=workbench-analysis`), surface)
  if (!response) throw new Error("The actual work-linked analysis input route is absent")
  const body = object(await response.json())
  if (response.status !== 200 || body.status !== "ok") throw new Error(`The real work-linked input was refused: ${String(body.reason)}`)
  return body.value
}

function expectSelectedWork(value: AuthorizedWorkList, context: Wp12NativeMissionContext, selected: SelectedWork, questionId?: string) {
  expect(value.items).toHaveLength(questionId ? 2 : 1)
  const action = value.items.filter((item) => item.actionRef === selected.topicRef.refId)
  expect(action).toHaveLength(1)
  expect(action[0]).toMatchObject({ ownerRef: context.principalRef, state: selected.topicStatus })
  expect(refSet(action[0]!.sourceRefs)).toBe(refSet(selected.evidenceRefs))
  expect(value.items.every((item) => item.ownerRef === context.principalRef)).toBe(true)
  expect(value.items.flatMap((item) => item.sourceRefs).some((ref) => ref.kind === "record" && ref.target.recordId === unrelatedRequestId)).toBe(false)
  if (questionId) {
    const question = value.items.filter((item) => item.actionRef === questionId)
    expect(question).toHaveLength(1)
    expect(question[0]).toMatchObject({ ownerRef: context.principalRef, state: "clarification-open" })
    expect(refSet(question[0]!.sourceRefs)).toBe(refSet(selected.evidenceRefs))
  }
}

async function readUiWork(context: Wp12NativeMissionContext, publicWork: PublicWork, selected: SelectedWork, questionId?: string) {
  const result = await dispatchWp12Ui(context, "sf_work_list", publicWork.selection)
  if (result.status !== "ok") throw new Error(`The actual selected work list was unavailable: ${result.reason}`)
  const decoded = decodeSfOperationOutput("sf_work_list", result.result)
  if (!decoded.ok) throw new Error("The actual work list failed its canonical schema")
  expect(result.receipt).toMatchObject({ kind: "ui", operation: "sf_work_list", handlerExport: "listWork", principalRef: context.principalRef,
    inputDigest: digestSfValue(publicWork.selection), resultDigest: digestSfValue(decoded.value) })
  expectSelectedWork(decoded.value, context, selected, questionId)
  return { value: decoded.value, receipt: result.receipt }
}

async function expectWorkbenchConsumer(context: Wp12NativeMissionContext, publicWork: PublicWork, selected: SelectedWork, questionId?: string, questionText?: string) {
  const response = await workbench(context)(context.request(undefined, publicWork.path, "GET"), "procurement")
  if (!response) throw new Error("The actual My work consumer is absent")
  expect(response.status).toBe(200)
  const html = await response.text()
  expect(html).toContain("My work")
  expect(html).toContain(actionText)
  expect(html).toContain(selected.topicRef.refId)
  expect(html).toContain(selected.topicStatus)
  expect(html).not.toContain(unrelatedRequestId)
  const actions = [...html.matchAll(/data-action-ref="([^"]+)"/g)].map((match) => match[1]!.replaceAll("&amp;", "&"))
  expect(actions).toHaveLength(questionId ? 2 : 1)
  expect(actions.filter((ref) => ref === selected.topicRef.refId)).toHaveLength(1)
  if (questionId) {
    expect(actions.filter((ref) => ref === questionId)).toHaveLength(1)
    if (typeof questionText !== "string" || !questionText) throw new Error("The actual work thread has no displayed question")
    expect(html).toContain(questionText.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"))
  }
}

async function expectUnauthenticatedWorkRefused(context: Wp12NativeMissionContext, publicWork: PublicWork) {
  const response = await workbench(context)(new Request(new URL(publicWork.path, context.origin)), "procurement")
  if (!response) throw new Error("The actual My work authorization route is absent")
  expect(response.status).toBe(403)
  expect(await response.text()).not.toContain(actionText)
}

async function expectExpiredHostSelectionRefused(context: Wp12NativeMissionContext, old: PublicWork) {
  // Registries are host-owned and ephemeral. This is host reload, not a sleep,
  // TTL change or silent recreation of a prior selector.
  const result = await dispatchWp12Ui(context, "sf_work_list", old.selection)
  expect(result).toMatchObject({ status: "unavailable", reason: "Selection unavailable" })
}

async function consumeExistingAction(context: Wp12NativeMissionContext, selected: SelectedWork) {
  const first = object(await collaborationValue(context, "handoff-link", selected.link))
  expect(first.state).toBe("linked")
  expect(first.relationId).toBe(selected.relationId)
  expect(object(first.topic).id).toBe(selected.topicId)
  expect(digestSfValue(first.topic)).toBe(selected.topicDigest)
  expect(digestSfValue(await collaborationValue(context, "handoff-link", selected.link))).toBe(digestSfValue(first))
  await context.persistence.transaction("dashboard", async (snapshot) => {
    expect(snapshot.data.hotTopics).toHaveLength(1)
    return { commit: false, value: undefined }
  })
}

async function consumeNativeQuestion(context: Wp12NativeMissionContext, completed: Wp12CompletedNativeMission, selected: SelectedWork) {
  if (completed.output.kind !== "QuestionProposal" || completed.output.state !== "ready") throw new Error("The work consumer requires the actual native question")
  const raw = object(await collaborationValue(context, "question-output", { outputRef: completed.output.id, caseRef: completed.caseRef }))
  const decoded = decodeSfOperationOutput("sf_question_prepare", raw.result)
  if (!decoded.ok) throw new Error("The real question contribution reader did not return a canonical proposal")
  const proposal: QuestionContribution = { kind: "contribution", outputRef: completed.output.id, outputDigest: completed.output.outputDigest,
    caseRef: completed.caseRef, result: decoded.value }
  expect<unknown>(raw).toEqual(proposal)
  expect(decoded.value).toEqual(completed.output.payload)
  const consumption: QuestionConsumption = { proposal, sourceRef: selected.requestRef.refId, period,
    mutation: { expectedStorageVersion: await storageVersion(context, "threads"), idempotencyKey: randomUUID() } }
  const thread = await collaborationValue(context, "question-consume", consumption)
  if (!isConsumedQuestion(thread) || thread.questionOrigin.provenance.kind !== "contribution") throw new Error("The real C06 consumer lost native question provenance")
  expect(thread.questionOrigin.provenance.outputRef).toBe(completed.output.id)
  expect(thread.questionOrigin.provenance.runRef).toBe(completed.runRef)
  expect(thread.questionOrigin.provenance.outputDigest).toBe(completed.output.outputDigest)
  expect(thread.messages).toHaveLength(1)
  expect(thread.messages[0]?.body).toBe(completed.output.payload.question)
  expect(refSet(thread.evidenceRefs)).toBe(refSet(selected.evidenceRefs))
  const version = await storageVersion(context, "threads")
  expect(digestSfValue(await collaborationValue(context, "question-consume", consumption))).toBe(digestSfValue(thread))
  expect(await storageVersion(context, "threads")).toBe(version)
  return { thread, consumption }
}

async function consumeExecutive(context: Wp12NativeMissionContext, completed: Wp12CompletedNativeMission) {
  const body = await productValue(context, "review-contribution", { outputRef: completed.output.id, caseRef: completed.caseRef, expectedOutputDigest: completed.output.outputDigest })
  const value = object(body.value)
  expect(value.kind).toBe("DecisionBrief")
  expect(digestSfValue(value.output)).toBe(digestSfValue(completed.output))
  expect(value.results).toEqual([])
  expect(value.links).toEqual([])
}

function readActionReview(value: unknown, selected: SelectedWork) {
  const review = object(value)
  if (typeof review.id !== "string" || typeof review.version !== "number" || !Number.isSafeInteger(review.version) || !Array.isArray(review.sections)) throw new Error("The real preserved action review is malformed")
  expect(review.sections).toHaveLength(1)
  const section = object(review.sections[0]), projection = object(section.content)
  if (!Array.isArray(projection.values)) throw new Error("The action review did not capture actual producer values")
  const values = projection.values.map(object)
  const prefix = `hotTopics[id:${encodeURIComponent(selected.topicId)}].`
  expect(values.find((item) => item.id === `${prefix}id`)?.value).toBe(selected.topicId)
  expect(values.find((item) => item.id === `${prefix}action`)?.value).toBe(actionText)
  expect(values.find((item) => item.id === `${prefix}status`)?.value).toBe(selected.topicStatus)
  expect(values.some((item) => typeof item.id === "string" && item.id.startsWith("hotTopics[") && !item.id.startsWith(prefix))).toBe(false)
  return { id: review.id, digest: digestSfValue(value), action: { id: selected.topicId, text: actionText, state: selected.topicStatus }, sectionRef: section.id }
}

async function readNativeOperation(context: Wp12NativeMissionContext, completed: Wp12CompletedNativeMission, operation: string, request: unknown) {
  const messages = await Effect.runPromise(context.session.messages({ sessionID: SessionSchema.ID.make(completed.receipt.nativeSessionId), order: "asc" }))
  const calls = messages.flatMap((message) => message.type !== "assistant" || !message.time.completed || message.error ? [] : message.content.flatMap((part) => {
    if (part.type !== "tool" || part.name !== operation || part.state.status !== "completed" || !completed.tools.some((tool) => tool.operation === part.name && tool.toolCallId === part.id)) return []
    const receipt = object(part.state.structured.receipt)
    if (receipt.inputDigest !== digestSfValue(request)) return []
    expect(receipt).toMatchObject({ kind: "native", operation, callId: part.id, runId: completed.runRef, nativeSessionId: completed.receipt.nativeSessionId,
      principalRef: context.principalRef, resultDigest: digestSfValue(part.state.structured.result) })
    return [{ callId: part.id, messageId: message.id, receipt, result: part.state.structured.result }]
  }))
  const call = calls[0]
  if (!call) throw new Error(`The native ${operation} did not use the actual public human selection`)
  return call
}

async function readNativeWork(context: Wp12NativeMissionContext, completed: Wp12CompletedNativeMission, selection: WorkListRequest, selected: SelectedWork) {
  const call = await readNativeOperation(context, completed, "sf_work_list", selection)
  const decoded = decodeSfOperationOutput("sf_work_list", call.result)
  if (!decoded.ok) throw new Error("The actual native work result failed its canonical schema")
  expect(call.receipt.handlerExport).toBe("listWork")
  expectSelectedWork(decoded.value, context, selected)
  return { callId: call.callId, messageId: call.messageId, receipt: call.receipt, value: decoded.value }
}

async function proveSourceLossRefusal(context: Wp12NativeMissionContext, publicWork: PublicWork, selected: SelectedWork, completed?: Wp12CompletedNativeMission) {
  await expectUnauthenticatedWorkRefused(context, publicWork)
  await context.persistence.transaction("procurement", async (snapshot) => {
    const store = object(snapshot.data.store), requests = object(store.requests)
    expect(Object.hasOwn(requests, requestId)).toBe(true)
    const next = { ...requests }
    delete next[requestId]
    snapshot.data.store = { ...store, requests: next }
    return { commit: true, value: undefined }
  })
  const result = await dispatchWp12Ui(context, "sf_work_list", publicWork.selection)
  expect(result.status).not.toBe("ok")
  if (result.status === "ok") throw new Error("Work remained visible through its revoked source selection")
  const page = await workbench(context)(context.request(undefined, publicWork.path, "GET"), "procurement")
  if (!page) throw new Error("The actual My work source-revocation consumer is absent")
  expect(page.status).not.toBe(200)
  expect(await page.text()).not.toContain(actionText)
  let nativeOutputStatus: string | null = null
  if (completed) {
    // Do not suppress a real native refusal when a model disappears or a source
    // changes after the mission. The completed run must still be reauthorized.
    const output = await context.human("analysis.read", { runRef: completed.runRef }, (call) => context.services.analyses!.output(call, completed.runRef))
    nativeOutputStatus = output.status
    expect(output.status).not.toBe("ok")
  }
  console.log("SF_WP12_WORK_SOURCE_REFUSAL:" + JSON.stringify({ scope: "real-unauthenticated-http-and-selected-request-deletion-refusal",
    githubSha: process.env.GITHUB_SHA ?? null, requestRef: selected.requestRef.refId, actionRef: selected.topicRef.refId,
    uiStatus: result.status, uiReason: result.reason, httpStatus: page.status, nativeOutputStatus,
    nativeOutputReadAttempted: !!completed, inferenceExecuted: !!completed, gnativeAccepted: false }))
}

async function expectCaseSources(context: Wp12NativeMissionContext, caseRef: CaseRef, refs: readonly BusinessEvidenceRef[]) {
  const current = await readCaseAnalysisProjection(context.request(), context.services, caseRef)
  if (current.status !== "ok") throw new Error(`The work case cannot be authorized: ${current.reason}`)
  expect(refSet(current.value.case.sourceRefs)).toBe(refSet(refs))
  expect(current.value.case.sourceRefs.some((ref) => ref.kind === "record" && ref.target.recordId === unrelatedRequestId)).toBe(false)
}

async function expectCaseDigest(context: Wp12NativeMissionContext, caseRef: CaseRef, digest: string) {
  const current = await readCaseAnalysisProjection(context.request(), context.services, caseRef)
  if (current.status !== "ok") throw new Error(`The work case cannot be reread: ${current.reason}`)
  expect(digestSfValue(current.value.case)).toBe(digest)
}

function uniqueRefs(refs: readonly BusinessEvidenceRef[]) { return [...new Map(refs.map((ref) => [digestSfValue(ref), ref])).values()] }
function refSet(refs: readonly BusinessEvidenceRef[]) { return digestSfValue(refs.map((ref) => digestSfValue(ref)).sort()) }

async function workSourceDigest(context: Wp12NativeMissionContext) {
  const procurement = await context.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.store) }))
  const actions = await context.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.hotTopics) }))
  return digestSfValue({ procurement, actions })
}

async function storageVersion(context: Wp12NativeMissionContext, namespace: "threads") {
  const version = await collaborationValue(context, "storage-version", { namespace })
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) throw new Error("The real C06 storage version is unavailable")
  return version
}

async function collaborationValue(context: Wp12NativeMissionContext, route: string, payload: unknown) {
  return (await productValue(context, `collaboration-${route}`, payload, "planner")).value
}

async function productValue(context: Wp12NativeMissionContext, route: string, payload: unknown, surface: "planner" | "dashboard" = "dashboard") {
  const response = await context.services.productHttp?.(context.request(payload, `/sucafina/${surface}?sf=${route}`), surface)
  if (!response) throw new Error(`The actual ${route} route is absent`)
  const body = object(await response.json())
  if (response.status !== 200 || body.status !== "ok") throw new Error(`The actual ${route} consumer failed: ${String(body.reason)}`)
  return body
}
