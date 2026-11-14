import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, CostCoverageEntry } from "../../../product/contracts/decisions.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { isConsumedQuestion } from "../../../product/collaboration/question-consumer.ts"
import type { ConsumedQuestion, QuestionConsumption, QuestionContribution } from "../../../product/collaboration/question-consumer.ts"
import type { PreparedQuestion } from "../../../product/collaboration/question-preparations.ts"
import { isThread } from "../../../product/collaboration/threads.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import { esc } from "../../../src/screen-shell.ts"
import { dispatchWp12Ui, executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12CompletedNativeMission, Wp12NativeMissionContext } from "./native-mission-harness.ts"
import { initializeWp12QuestionSource, wp12QuestionSourceDigest, WP12_QUESTION_HUMAN_ACTIONS, WP12_QUESTION_OPERATIONS,
  WP12_QUESTION_PENDING_REASON, WP12_QUESTION_PERIOD } from "./native-question-preparation.ts"

type Preparation = Parameters<NonNullable<SfHostServices["analysisInputs"]>["prepare"]>[1]
type CaseRef = Preparation["request"]["caseRef"]
type PreparedCase = Awaited<ReturnType<typeof prepareDashboardAnswerCase>>
type Consumed = { consumption: QuestionConsumption; thread: ConsumedQuestion; answer: string }
const label = "dashboard-answer-context"
const principalRef = `wp12-synthetic-${label}-principal`
const versionId = "wp12-question-source"
const projectId = "wp12-answer-project"
const capexId = "wp12-answer-capex"
const unrelatedCapexId = "wp12-answer-unrelated-capex"
const priorAnswer = "A solicitação do investimento foi recebida; ainda não há documento que confirme o custo de treinamento."
const followupAnswer = "O documento solicitado continua pendente. Esta mensagem não confirma valor, benefício ou cobertura de treinamento."
const humanQuestion = "Qual documento desta dotação CAPEX esclarece o custo de treinamento ainda pendente no caso?"

/** The human selects a real CAPEX conversation as context for the same pending
 * decision. This does not replace or repair the separate Planner answer scope. */
test("native question reads the same-case public CAPEX answer without confirming pending training and reopens its real thread consumer", async () => {
  const started = Date.now()
  const phase = async <T>(name: string, work: () => Promise<T>): Promise<T> => {
    const at = Date.now()
    console.log("SF_WP12_DASHBOARD_ANSWER_PHASE:" + JSON.stringify({ stage: name, state: "started", elapsedMs: at - started }))
    try {
      const value = await work()
      console.log("SF_WP12_DASHBOARD_ANSWER_PHASE:" + JSON.stringify({ stage: name, state: "returned", durationMs: Date.now() - at, elapsedMs: Date.now() - started }))
      return value
    } catch (error) {
      console.log("SF_WP12_DASHBOARD_ANSWER_PHASE:" + JSON.stringify({ stage: name, state: "failed", durationMs: Date.now() - at,
        elapsedMs: Date.now() - started, message: error instanceof Error ? error.message : String(error) }))
      throw error
    }
  }
  await withWp12NativeMissionHost({ label,
    operations: [...WP12_QUESTION_OPERATIONS, "sf_question_prepare", "sf_relation_read"],
    humanActions: [...WP12_QUESTION_HUMAN_ACTIONS, "collaboration.relation.confirm", "collaboration.storage.version", "collaboration.recipients",
      "collaboration.thread.create", "collaboration.thread.reply", "collaboration.thread.read", "collaboration.question.confirm", "collaboration.question.output"],
    namespaces: ["cases", "preferences", "documents", "contributions", "receipts", "outbox", "atlas", "threads", "relations", "confirmations"],
    initialize: initializeSources }, async ({ open }) => {
    const initial = await open("initial", async (context) => {
      const prepared = await phase("actual-case-and-predecessor", () => prepareDashboardAnswerCase(context))
      const incoming = { request: questionRequest(context, prepared.caseRef, prepared.objective),
        selection: { relationRefIds: [prepared.project.refId, prepared.capex.refId], directoryRefs: [context.principalRef] } }
      const input = await phase("actual-question-input", () => prepareInput(context, incoming))
      expect(input.response.status).toBe(200)
      const decoded = decodeSfSkillInput("QuestionPlanningInput", input.body.value)
      if (!decoded.ok) throw new Error("The installed producer did not return the CAPEX-context QuestionPlanningInput")
      expect(decoded.value.case).toEqual(prepared.caseRef)
      expect(decoded.value.unresolvedConditions).toHaveLength(1)
      expect(decoded.value.unresolvedConditions[0]).toMatchObject({ category: "training", reason: WP12_QUESTION_PENDING_REASON,
        questionRef: prepared.predecessor.id, evidenceRefs: [] })
      expect(decoded.value.relations).toHaveLength(1)
      expect(decoded.value.relations[0]?.id).toBe(prepared.relationId)
      expect(decoded.value.relations[0]?.state).toBe("confirmed")
      expect(decoded.value.relations[0]?.evidenceRefs.some((ref) => digestSfValue(ref) === digestSfValue(prepared.planner))).toBe(true)
      expect(decoded.value.authorizedDirectoryRefs).toEqual([context.principalRef])
      const beforeThreads = await storageVersion(context, "threads")
      const outside = await dispatchWp12Ui(context, "sf_question_prepare", { caseRef: encodeCaseRef(prepared.caseRef),
        question: { text: humanQuestion }, sourceRefs: [prepared.unrelated], recipientRef: context.principalRef })
      expect(outside.status).toBe("denied")
      if (outside.status === "ok") throw new Error("A homonymous CAPEX record outside the case became an authorized question source")
      expect(outside.reason).toBe("source-access-unavailable")
      expect(await storageVersion(context, "threads")).toBe(beforeThreads)
      await expectUnadmittedThreadRefused(context, prepared.predecessor.id)
      console.log("SF_WP12_DASHBOARD_ANSWER_INPUT:" + JSON.stringify({ scope: "same-case-public-capex-context-and-real-unconfirmed-predecessor",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: prepared.caseRef, inputDigest: digestSfValue(decoded.value),
        predecessorThreadId: prepared.predecessor.id, selectedSource: prepared.capex, relationId: prepared.relationId,
        conditionOrigin: "human-classification", conditionQuestionRef: decoded.value.unresolvedConditions[0]?.questionRef,
        conditionEvidenceRefCount: 0, sourceSubsetSelectedByHuman: true, answerState: "unconfirmed", pendingTrainingResolved: false,
        derivedOmissionProof: false, plannerAnswerScopeRepaired: false, inferenceExecuted: false, gnativeAccepted: false }))

      let completed: Wp12CompletedNativeMission | undefined
      let uiConsumer: Consumed | undefined
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: input.body.value })
        uiConsumer = await phase("actual-ui-question-consumer", async () => {
          const result = await dispatchWp12Ui(context, "sf_question_prepare", { caseRef: encodeCaseRef(prepared.caseRef),
            question: { text: humanQuestion }, sourceRefs: [prepared.capex], recipientRef: context.principalRef })
          if (result.status !== "ok" || result.receipt.kind !== "ui") throw new Error("The selected CAPEX question has no real UI preparation receipt")
          const question = decodeSfOperationOutput("sf_question_prepare", result.result)
          if (!question.ok) throw new Error("The real UI question result failed its closed schema")
          const proposal: PreparedQuestion = { kind: "prepared", result: question.value, receipt: result.receipt }
          return consumeAndReply(context, prepared, proposal)
        })
      } else {
        expectSpawn(import.meta.path)
        completed = await phase("actual-native-question", () => executeWp12NativeMission(context, { request: incoming.request,
          skillInput: input.body.value, expectedKind: "QuestionProposal", requiredTools: ["sf_case_read", "sf_answer_read", "sf_relation_read", "sf_question_prepare"].map((operation) => ({ operation })) }))
        if (completed.output.kind !== "QuestionProposal" || completed.output.state !== "ready") throw new Error("The native CAPEX question changed its output kind")
        expect(completed.output.payload.recipientRef).toBe(context.principalRef)
        expect(completed.output.payload.evidenceRefs).toEqual([prepared.capex])
        expect(completed.output.evidenceRefs).toEqual([prepared.capex])
        expect(completed.output.payload.question.toLowerCase()).toMatch(/trein|training/)
        await inspectNativeCalls(context, completed, prepared)
        expect(await storageVersion(context, "threads")).toBe(beforeThreads)
      }
      await expectCaseAndSourcesUnchanged(context, prepared)
      return { prepared, incoming, completed, uiConsumer, inputDigest: digestSfValue(decoded.value) }
    })

    const consumed = await open("reopened", async (context) => {
      await phase("reopened-predecessor-answer", () => expectPredecessor(context, initial.prepared))
      await expectCaseAndSourcesUnchanged(context, initial.prepared)
      if (!initial.completed) {
        if (!initial.uiConsumer) throw new Error("The unavailable-model branch lost its actual UI consumer")
        await phase("reopened-ui-thread-consumer", () => expectConsumedAfterReload(context, initial.uiConsumer!, initial.prepared))
        await phase("selected-capex-source-withdrawal", () => withdrawSelectedSource(context, initial.prepared, initial.uiConsumer))
        return undefined
      }
      const completed = initial.completed
      const reopened = await phase("reopened-native-contribution", () => readWp12NativeMissionAfterReload(context, completed))
      if (reopened.output.kind !== "QuestionProposal" || reopened.output.state !== "ready") throw new Error("The native CAPEX contribution did not reopen as a ready question")
      expect(reopened.html).toContain(esc(reopened.output.payload.question))
      await inspectNativeCalls(context, completed, initial.prepared)
      const raw = object(await collaborationValue(context, "question-output", { outputRef: reopened.output.id, caseRef: reopened.output.caseRef }))
      const result = decodeSfOperationOutput("sf_question_prepare", raw.result)
      if (!result.ok) throw new Error("The real C11-to-C06 reader returned no typed QuestionProposal")
      const proposal: QuestionContribution = { kind: "contribution", outputRef: reopened.output.id, outputDigest: reopened.output.outputDigest,
        caseRef: reopened.output.caseRef, result: result.value }
      expect(raw).toEqual(proposal)
      expect(result.value).toEqual(reopened.output.payload)
      const consumer = await phase("actual-native-question-consumer", () => consumeAndReply(context, initial.prepared, proposal))
      if (consumer.thread.questionOrigin.provenance.kind !== "contribution") throw new Error("The native question consumer lost contribution provenance")
      expect(consumer.thread.questionOrigin.provenance.outputRef).toBe(completed.output.id)
      expect(consumer.thread.questionOrigin.provenance.runRef).toBe(completed.runRef)
      return consumer
    })
    if (consumed && initial.completed) await open("reopened", async (context) => {
      // A newly consumed native thread is durable state that needs its own
      // reopen. This path remains mandatory if model availability later changes.
      await phase("reopened-native-thread-answer", () => expectConsumedAfterReload(context, consumed, initial.prepared))
      await expectCaseAndSourcesUnchanged(context, initial.prepared)
      await phase("native-output-source-withdrawal", () => withdrawSelectedSource(context, initial.prepared, consumed, initial.completed))
    })
    console.log("SF_WP12_DASHBOARD_ANSWER_COMPLETION:" + JSON.stringify({ githubSha: process.env.GITHUB_SHA ?? null,
      elapsedMs: Date.now() - started, inferenceExecuted: !!initial.completed, hostOpenCount: consumed ? 3 : 2,
      consumerOrigin: consumed ? "actual-native-contribution" : "actual-ui-preparation", confirmedAnswerReuseAccepted: false,
      pendingTrainingResolved: false, plannerAnswerScopeRepaired: false, allSkillRequiredOperationsAccepted: false,
      unexercisedRequiredOperations: ["sf_work_list"], separateHandoffAm02Accepted: false, gnativeAccepted: false }))
  })
}, 360_000)

async function initializeSources(persistence: Wp12NativeMissionContext["persistence"]) {
  await initializeWp12QuestionSource(persistence)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.access = { ...object(snapshot.data.access), [principalRef]: { role: "admin" } }
    snapshot.data.projects = [{ id: projectId, name: "Selected investment project", status: "Planning", risk: "Low",
      budget: 0, spent: 0, pct: 0, milestones: [] }]
    snapshot.data.capexProjects = [capexId, unrelatedCapexId].map((id) => ({ id, name: "Investment allocation", year: 2027, ownerId: "wp12-source-owner" }))
    snapshot.data.capexEntries = []
    return { commit: true, value: undefined }
  })
}

/** Separate preparation preserves the Planner helper's stronger original
 * assertion. Only this new mission selects its predecessor on real CAPEX. */
async function prepareDashboardAnswerCase(context: Wp12NativeMissionContext) {
  const plannerDigest = await wp12QuestionSourceDigest(context), dashboardDigest = await rawDashboardDigest(context)
  const issued = await context.ui("sf_case_draft", { purpose: "dashboard-answer-planner-source" }, (call) => context.business.plannerProduct.issueSource(versionId, call))
  if (issued.status !== "ok" || issued.value.evidence.kind !== "record") throw new Error("The actual Planner source was not issued")
  const planner = issued.value.evidence
  const projection = await context.ui("sf_context_get", { sourceRef: planner.refId }, (call) =>
    context.business.projectPlannerEvidence(planner, call, { period: WP12_QUESTION_PERIOD, currency: "USD" }))
  if (projection.status !== "ok") throw new Error("The actual Planner projection is unavailable")
  const at = new Date(context.at)
  if (!Number.isFinite(at.getTime())) throw new Error("The current project observation time is invalid")
  const projectPeriod = { start: `${at.getUTCFullYear()}-01-01`, end: `${at.getUTCFullYear()}-12-31` }
  const sources = await context.ui("sf_context_get", { purpose: "public-capex-answer-context" }, async (call) => {
    const project = await context.business.dashboardRecords.issue({ page: "Portfolio Dashboard", recordType: "projects",
      recordId: projectId, fields: ["name"], period: projectPeriod }, call)
    const capex = await context.business.dashboardRecords.issue({ page: "CAPEX Projects", recordType: "capexProjects",
      recordId: capexId, fields: ["name"], period: WP12_QUESTION_PERIOD }, call)
    const unrelated = await context.business.dashboardRecords.issue({ page: "CAPEX Projects", recordType: "capexProjects",
      recordId: unrelatedCapexId, fields: ["name"], period: WP12_QUESTION_PERIOD }, call)
    if (project.status !== "ok" || capex.status !== "ok" || unrelated.status !== "ok") throw new Error("The real public Dashboard source selections were not issued")
    for (const ref of [project.value, capex.value, unrelated.value]) {
      const read = await context.business.dashboardRecords.read(ref.refId, call)
      if (read.status !== "ok") throw new Error("The real selected Dashboard record cannot be read")
      expect(read.value.values).toHaveLength(1)
      expect(read.value.values[0]?.value).toBe(ref.target.recordType === "projects" ? "Selected investment project" : "Investment allocation")
      expect(read.value.values[0]?.sourceRefs).toEqual([ref])
    }
    return { project: project.value, capex: capex.value, unrelated: unrelated.value }
  })
  expect(sources.capex.target.period).toEqual(WP12_QUESTION_PERIOD)
  expect(sources.capex.target.fields).toEqual(["name"])
  const directory = await collaborationValue(context, "recipients", {})
  if (!Array.isArray(directory)) throw new Error("The real recipient directory did not return a collection")
  expect(directory.filter((person) => object(person).id === context.principalRef)).toHaveLength(1)
  const pair = { fromRef: sources.project.refId, toRef: sources.capex.refId, kind: "pmo-capex",
    evidenceRefs: [sources.project, sources.capex, planner] }
  const relation = object(await collaborationValue(context, "relation-create", { operation: "create", pair,
    mutation: { expectedStorageVersion: await storageVersion(context, "relations"), idempotencyKey: randomUUID() } }))
  if (typeof relation.id !== "string") throw new Error("The actual project-to-CAPEX relation has no identifier")
  expect(relation.confirmedBy).toBe(context.principalRef)
  expect(relation.evidenceRefs).toEqual(pair.evidenceRefs)
  const draft = { kind: "review", sourceRef: sources.capex.refId, sourceIncarnation: sources.capex.target.incarnation,
    observedVersion: sources.capex.target.version, period: WP12_QUESTION_PERIOD, recipientRef: context.principalRef,
    evidenceRefs: [sources.capex], body: "Há documento desta dotação CAPEX que esclareça o treinamento do projeto selecionado?" }
  const predecessor = await collaborationValue(context, "thread-create", { draft,
    mutation: { expectedStorageVersion: await storageVersion(context, "threads"), idempotencyKey: randomUUID() } })
  if (!isThread(predecessor)) throw new Error("The real CAPEX predecessor thread was not created")
  await collaborationValue(context, "thread-reply", { id: predecessor.id, body: priorAnswer,
    mutation: { expectedStorageVersion: await storageVersion(context, "threads"), idempotencyKey: randomUUID() } })
  const answer = await readAnswer(context, predecessor.id)
  expect(answer.answer).toBe(priorAnswer)
  expect(answer.state).toBe("unconfirmed")
  expect(answer.evidenceRefs).toEqual([sources.capex])
  const objective = `A pessoa selecionou a conversa sobre a dotação CAPEX ${sources.capex.refId}, de 2027, como contexto de uma dúvida de treinamento do mesmo caso. Leia o caso com sf_case_read e a relação confirmada com sf_relation_read. Consulte com sf_answer_read a questão referenciada pela condição. Use a resposta observada para preparar com sf_question_prepare uma pergunta de acompanhamento pertinente, ancorada somente nessa dotação CAPEX e dirigida a ${context.principalRef}. A seleção é humana; não trate a resposta como confirmação de valor ou resolução da cobertura. Retorne a QuestionProposal da preparação, sem enviar nem aplicar.`
  const caseDraft = { objective, horizon: WP12_QUESTION_PERIOD, currency: "USD", criteria: ["Assess cost coverage before a human decision"],
    sourceRefs: [planner, sources.project, sources.capex] }
  const created = await context.ui("sf_case_draft", caseDraft, (call) => context.business.cases.draft(caseDraft, call))
  if (created.status !== "ok") throw new Error("The actual same-source question case was not created")
  const initialCaseRef = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
  const basis: CostCoverageBasis = { id: `wp12-dashboard-answer-inventory:${created.value.id}`, version: 1,
    decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: [planner] }
  const entries: CostCoverageEntry[] = RENEWAL_TRANSITION_CATEGORIES.map((category): CostCoverageEntry => {
    if (category === "training") return { categoryId: category, status: "pending", reason: WP12_QUESTION_PENDING_REASON, questionRef: predecessor.id }
    const components = projection.value.components.filter((component) => component.id.startsWith(`wp12-question-${category}:`))
    expect(components).toHaveLength(12)
    expect(components.every((component) => component.amount !== null && component.currency === "USD" && component.evidenceState === "confirmed")).toBe(true)
    return { categoryId: category, status: "included", componentRefs: components.map((component) => component.id), evidenceRefs: [planner],
      scopeNote: `Human classification of twelve observed ${category} amounts, including explicit zeros.` }
  })
  const coverage = await productValue(context, "baseline-coverage", { caseRef: initialCaseRef, source: planner, basis, entries, expectedVersion: 0 })
  if (typeof coverage.coverageRef !== "string" || coverage.version !== 1) throw new Error("The actual C10 coverage has no versioned reference")
  const promoted = await productValue(context, "decision-promote", { caseRef: initialCaseRef, title: "Candidate",
    scenario: { baseRef: planner.refId, operations: [], assumptions: [] }, coverageRef: coverage.coverageRef })
  const next = object(promoted.caseRef)
  if (typeof promoted.resultRef !== "string" || next.id !== initialCaseRef.id || next.incarnation !== initialCaseRef.incarnation || next.version !== initialCaseRef.version + 1)
    throw new Error("The real pending alternative did not advance the same case exactly once")
  const caseRef = { ...initialCaseRef, version: Number(next.version) }
  const read = await readCaseAnalysisProjection(context.request(), context.services, caseRef)
  if (read.status !== "ok") throw new Error("The actual CAPEX-context decision cannot be read")
  expect(read.value.case.sourceRefs).toHaveLength(3)
  expect(read.value.case.sourceRefs.map((ref) => digestSfValue(ref)).sort()).toEqual([planner, sources.project, sources.capex].map((ref) => digestSfValue(ref)).sort())
  expect(read.value.case.alternatives).toHaveLength(1)
  const alternative = read.value.case.alternatives[0]!
  expect(alternative.scenario.baseRef).toBe(planner.refId)
  expect(alternative.result.knownSubtotal).toBe(210_000)
  expect(alternative.result.total).toBeNull()
  expect(alternative.result.comparisonStatus).toBe("conditioned")
  expect(alternative.result.unresolvedConditions).toContain("scenario-is-hypothetical")
  expect(alternative.result.restrictions).toContain("preview-not-applied")
  expect(alternative.result.costCoverage.coverageState).toBe("pending")
  expect(alternative.result.costCoverage.entries).toEqual(entries)
  expect(alternative.result.costCoverage.derivedMissingCategoryIds).toEqual([])
  expect(alternative.result.costCoverage.issues).toEqual([])
  expect(alternative.result.components).toHaveLength((RENEWAL_TRANSITION_CATEGORIES.length - 1) * 12)
  expect(alternative.result.components.every((component) => component.amount !== null && component.evidenceState === "confirmed")).toBe(true)
  expect(alternative.result.components.filter((component) => component.id.startsWith("wp12-question-training:"))).toHaveLength(0)
  expect(await wp12QuestionSourceDigest(context)).toBe(plannerDigest)
  expect(await rawDashboardDigest(context)).toBe(dashboardDigest)
  return { ...sources, planner, predecessor, relationId: relation.id, caseRef, case: read.value.case,
    caseDigest: digestSfValue(read.value.case), plannerDigest, dashboardDigest, objective }
}

function questionRequest(context: Wp12NativeMissionContext, caseRef: CaseRef, objective: string) {
  const selected = context.services.selected.find((entry) => entry.profile.id === "sf_maestro")
  const skill = selected?.skills.find((entry) => entry.id === "sf-coordenar-perguntas")
  if (!selected || !skill) throw new Error("The installed host has no actual Question profile/skill selection")
  return { caseRef, profileId: selected.profile.id, profileVersion: selected.profile.version, skillId: skill.id, skillVersion: skill.version,
    objective, manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1",
    requestedOperationScope: ["sf_case_read", "sf_answer_read", "sf_relation_read", "sf_question_prepare"] }
}

async function prepareInput(context: Wp12NativeMissionContext, incoming: Preparation) {
  const response = await context.services.productHttp?.(context.request({ action: "prepare", input: incoming }, "/sucafina/planner?sf=workbench-analysis"), "planner")
  if (!response) throw new Error("The actual question input HTTP route is not mounted")
  return { response, body: object(await response.json()) }
}

async function productValue(context: Wp12NativeMissionContext, route: string, payload: unknown) {
  const response = await context.services.productHttp?.(context.request(payload, `/sucafina/planner?sf=${route}`), "planner")
  if (!response) throw new Error(`The actual ${route} route is not mounted`)
  const body = object(await response.json())
  if (response.status !== 200 || body.status !== "ok") throw new Error(`Actual ${route} refused: ${String(body.reason)}`)
  return object(body.value)
}

async function collaborationHttp(context: Wp12NativeMissionContext, route: string, payload: unknown) {
  const response = await context.services.productHttp?.(context.request(payload, `/sucafina/planner?sf=collaboration-${route}`), "planner")
  if (!response) throw new Error(`The actual collaboration-${route} route is not mounted`)
  return { response, body: object(await response.json()) }
}

async function collaborationValue(context: Wp12NativeMissionContext, route: string, payload: unknown) {
  const result = await collaborationHttp(context, route, payload)
  if (result.response.status !== 200 || result.body.status !== "ok") throw new Error(`Actual C06 ${route} refused: ${String(result.body.reason)}`)
  return result.body.value
}

async function storageVersion(context: Wp12NativeMissionContext, namespace: "threads" | "relations") {
  const value = await collaborationValue(context, "storage-version", { namespace })
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("The real C06 store returned no version")
  return value
}

async function readAnswer(context: Wp12NativeMissionContext, questionRef: string) {
  const result = await dispatchWp12Ui(context, "sf_answer_read", { questionRef })
  console.log("SF_WP12_DASHBOARD_ANSWER_READ:" + JSON.stringify({ githubSha: process.env.GITHUB_SHA ?? null, questionRef,
    status: result.status, reason: result.status === "ok" ? null : result.reason, receiptKind: result.receipt.kind,
    inferenceExecuted: false, gnativeAccepted: false }))
  if (result.status !== "ok" || result.receipt.kind !== "ui") throw new Error("The real CAPEX answer reader did not return an authorized UI observation")
  const decoded = decodeSfOperationOutput("sf_answer_read", result.result)
  if (!decoded.ok) throw new Error("The actual CAPEX answer failed the closed output schema")
  expect(decoded.value.questionRef).toBe(questionRef)
  return decoded.value
}

async function expectPredecessor(context: Wp12NativeMissionContext, prepared: PreparedCase) {
  const value = await readAnswer(context, prepared.predecessor.id)
  expect(value.answer).toBe(priorAnswer)
  expect(value.state).toBe("unconfirmed")
  expect(value.evidenceRefs).toEqual([prepared.capex])
}

async function consumeAndReply(context: Wp12NativeMissionContext, prepared: PreparedCase, proposal: PreparedQuestion | QuestionContribution): Promise<Consumed> {
  expect(proposal.result.evidenceRefs).toEqual([prepared.capex])
  expect(proposal.result.recipientRef).toBe(context.principalRef)
  expect(proposal.result.expectedCaseVersion).toBe(prepared.caseRef.version)
  const consumption: QuestionConsumption = { proposal, sourceRef: prepared.capex.refId, period: WP12_QUESTION_PERIOD,
    mutation: { expectedStorageVersion: await storageVersion(context, "threads"), idempotencyKey: randomUUID() } }
  const raw = await collaborationValue(context, "question-consume", consumption)
  if (!isConsumedQuestion(raw)) throw new Error("The real CAPEX question consumer returned no canonical origin")
  expect(raw.questionOrigin.provenance.kind).toBe(proposal.kind)
  expect(raw.questionOrigin.caseRef).toEqual(prepared.caseRef)
  expect(raw.sourceRef).toBe(prepared.capex.refId)
  expect(raw.period).toEqual(WP12_QUESTION_PERIOD)
  expect(raw.evidenceRefs).toEqual([prepared.capex])
  expect(raw.messages).toHaveLength(1)
  expect(raw.messages[0]?.body).toBe(proposal.result.question)
  const version = await storageVersion(context, "threads")
  const retry = await collaborationValue(context, "question-consume", consumption)
  expect(digestSfValue(retry)).toBe(digestSfValue(raw))
  expect(await storageVersion(context, "threads")).toBe(version)
  const reply = await collaborationValue(context, "thread-reply", { id: raw.id, body: followupAnswer,
    mutation: { expectedStorageVersion: version, idempotencyKey: randomUUID() } })
  if (!isThread(reply)) throw new Error("The real human reply did not persist in the canonical thread")
  expect(reply.messages).toHaveLength(2)
  expect(reply.messages[1]?.body).toBe(followupAnswer)
  expect(reply.messages[1]?.authorRef).toBe(context.principalRef)
  const answered = await collaborationValue(context, "question-consume", consumption)
  if (!isConsumedQuestion(answered)) throw new Error("The actual replied thread lost its question origin")
  expect(answered.questionOrigin).toEqual(raw.questionOrigin)
  expect(answered.messages).toEqual(reply.messages)
  console.log("SF_WP12_DASHBOARD_ANSWER_CONSUMER:" + JSON.stringify({ scope: "real-question-confirmation-idempotence-and-human-reply",
    githubSha: process.env.GITHUB_SHA ?? null, caseRef: prepared.caseRef, predecessorThreadId: prepared.predecessor.id,
    threadId: answered.id, sourceRef: answered.sourceRef, provenanceKind: answered.questionOrigin.provenance.kind,
    outputRef: proposal.kind === "contribution" ? proposal.outputRef : null,
    inferenceExecuted: proposal.kind === "contribution", humanReplyConfirmsCost: false, gnativeAccepted: false }))
  return { consumption, thread: answered, answer: followupAnswer }
}

async function expectConsumedAfterReload(context: Wp12NativeMissionContext, consumed: Consumed, prepared: PreparedCase) {
  const version = await storageVersion(context, "threads")
  const retry = await collaborationValue(context, "question-consume", consumed.consumption)
  expect(digestSfValue(retry)).toBe(digestSfValue(consumed.thread))
  expect(await storageVersion(context, "threads")).toBe(version)
  const thread = await collaborationValue(context, "thread-read", { id: consumed.thread.id })
  if (!isThread(thread)) throw new Error("The actual CAPEX question thread did not reopen")
  expect(thread.messages).toEqual(consumed.thread.messages)
  expect(thread.evidenceRefs).toEqual([prepared.capex])
  const answer = await readAnswer(context, consumed.thread.id)
  expect(answer.answer).toBe(consumed.answer)
  expect(answer.state).toBe("unconfirmed")
  expect(answer.evidenceRefs).toEqual([prepared.capex])
  console.log("SF_WP12_DASHBOARD_ANSWER_REOPEN:" + JSON.stringify({ scope: "same-real-capex-thread-origin-answer-and-pending-case-after-reload",
    githubSha: process.env.GITHUB_SHA ?? null, caseRef: prepared.caseRef, threadId: consumed.thread.id,
    originKind: consumed.thread.questionOrigin.provenance.kind, answerState: answer.state,
    originalQuestionRef: prepared.predecessor.id, pendingTrainingResolved: false,
    inferenceExecuted: consumed.thread.questionOrigin.provenance.kind === "contribution", gnativeAccepted: false }))
}

async function expectCaseAndSourcesUnchanged(context: Wp12NativeMissionContext, prepared: PreparedCase) {
  const current = await readCaseAnalysisProjection(context.request(), context.services, prepared.caseRef)
  if (current.status !== "ok") throw new Error("The actual pending case cannot be reauthorized")
  expect(digestSfValue(current.value.case)).toBe(prepared.caseDigest)
  expect(current.value.case.alternatives[0]?.result.costCoverage.coverageState).toBe("pending")
  expect(current.value.case.alternatives[0]?.result.costCoverage.entries.find((entry) => entry.categoryId === "training"))
    .toEqual({ categoryId: "training", status: "pending", reason: WP12_QUESTION_PENDING_REASON, questionRef: prepared.predecessor.id })
  expect(await wp12QuestionSourceDigest(context)).toBe(prepared.plannerDigest)
  expect(await rawDashboardDigest(context)).toBe(prepared.dashboardDigest)
}

async function rawDashboardDigest(context: Wp12NativeMissionContext) {
  return context.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
    value: digestSfValue({ projects: snapshot.data.projects, capexProjects: snapshot.data.capexProjects, capexEntries: snapshot.data.capexEntries }) }))
}

async function expectUnadmittedThreadRefused(context: Wp12NativeMissionContext, id: string) {
  const response = await context.services.productHttp?.(new Request(context.origin + "/sucafina/planner?sf=collaboration-thread-read", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }), "planner")
  if (!response) throw new Error("The installed thread HTTP consumer is not mounted")
  expect(response.status).toBe(403)
  expect(await response.text()).not.toContain(priorAnswer)
}

async function withdrawSelectedSource(context: Wp12NativeMissionContext, prepared: PreparedCase, consumer?: Consumed, completed?: Wp12CompletedNativeMission) {
  await context.persistence.transaction("dashboard", async (snapshot) => {
    const rows = Array.isArray(snapshot.data.capexProjects) ? snapshot.data.capexProjects : []
    expect(rows.filter((row) => object(row).id === capexId)).toHaveLength(1)
    expect(rows.filter((row) => object(row).id === unrelatedCapexId)).toHaveLength(1)
    snapshot.data.capexProjects = rows.filter((row) => object(row).id !== capexId)
    return { commit: true, value: undefined }
  })
  const unaffected = await context.ui("sf_context_get", { sourceRef: prepared.unrelated.refId }, (call) =>
    context.business.dashboardRecords.read(prepared.unrelated.refId, call))
  expect(unaffected.status).toBe("ok")
  const refusals: { questionRef: string; status: string; reason: string; httpStatus: number }[] = []
  const questions = [{ id: prepared.predecessor.id, body: priorAnswer }, ...(consumer ? [{ id: consumer.thread.id, body: consumer.answer }] : [])]
  for (const question of questions) {
    const answer = await dispatchWp12Ui(context, "sf_answer_read", { questionRef: question.id })
    expect(answer.status).not.toBe("ok")
    if (answer.status === "ok") throw new Error("The withdrawn CAPEX source still disclosed its answer")
    const thread = await collaborationHttp(context, "thread-read", { id: question.id })
    expect(thread.response.status).not.toBe(200)
    expect(JSON.stringify(thread.body)).not.toContain(question.body)
    refusals.push({ questionRef: question.id, status: answer.status, reason: answer.reason, httpStatus: thread.response.status })
  }
  let nativeOutputStatus: string | null = null
  if (completed) {
    const output = await context.human("analysis.read", { runRef: completed.runRef }, (call) => context.services.analyses!.output(call, completed.runRef))
    nativeOutputStatus = output.status
    expect(output.status).not.toBe("ok")
  }
  expect(await wp12QuestionSourceDigest(context)).toBe(prepared.plannerDigest)
  console.log("SF_WP12_DASHBOARD_ANSWER_SOURCE_REFUSAL:" + JSON.stringify({ scope: "actual-selected-capex-withdrawal-not-principal-acl-revocation",
    githubSha: process.env.GITHUB_SHA ?? null, predecessorThreadId: prepared.predecessor.id, sourceRef: prepared.capex.refId,
    refusals, unaffectedHomonymousSourceStatus: unaffected.status,
    nativeOutputReadAttempted: !!completed, nativeOutputStatus, inferenceExecuted: !!completed, gnativeAccepted: false }))
}

async function inspectNativeCalls(context: Wp12NativeMissionContext, completed: Wp12CompletedNativeMission, prepared: PreparedCase) {
  if (completed.output.kind !== "QuestionProposal" || completed.output.state !== "ready") throw new Error("Native answer audit requires its actual ready QuestionProposal")
  const output = completed.output.payload
  const messages = await Effect.runPromise(context.session.messages({ sessionID: SessionSchema.ID.make(completed.receipt.nativeSessionId), order: "asc" }))
  const calls = messages.flatMap((message, messageIndex) => message.type !== "assistant" || !message.time.completed || message.error ? [] : message.content.flatMap((part) => {
    if (part.type !== "tool" || part.state.status !== "completed" || !completed.tools.some((tool) => tool.operation === part.name && tool.toolCallId === part.id)) return []
    const receipt = object(part.state.structured.receipt)
    expect(receipt).toMatchObject({ kind: "native", operation: part.name, runId: completed.runRef,
      nativeSessionId: completed.receipt.nativeSessionId, principalRef: context.principalRef, callId: part.id,
      inputDigest: digestSfValue(part.state.input), resultDigest: digestSfValue(part.state.structured.result) })
    return [{ operation: part.name, id: part.id, messageIndex, input: part.state.input, receipt, result: part.state.structured.result }]
  }))
  const caseRead = calls.find((call) => call.operation === "sf_case_read" &&
    call.receipt.inputDigest === digestSfValue({ caseRef: encodeCaseRef(prepared.caseRef) }))
  expect(caseRead).toBeDefined()
  if (!caseRead) throw new Error("The native case read did not use the exact pending case and version")
  const answers = calls.flatMap((call) => {
    if (call.operation !== "sf_answer_read") return []
    const decoded = decodeSfOperationOutput("sf_answer_read", call.result)
    return decoded.ok ? [{ ...call, value: decoded.value }] : []
  })
  const answer = answers.find((call) => call.receipt.inputDigest === digestSfValue({ questionRef: prepared.predecessor.id }) &&
    call.value.questionRef === prepared.predecessor.id && call.value.answer === priorAnswer &&
    call.value.state === "unconfirmed" && digestSfValue(call.value.evidenceRefs) === digestSfValue([prepared.capex]))
  expect(answer).toBeDefined()
  if (!answer) throw new Error("The native mission did not read the actual same-case unconfirmed CAPEX answer")
  const relations = calls.flatMap((call) => {
    if (call.operation !== "sf_relation_read") return []
    const decoded = decodeSfOperationOutput("sf_relation_read", call.result)
    return decoded.ok ? decoded.value.relations : []
  })
  expect(relations.some((relation) => relation.id === prepared.relationId && relation.evidenceRefs.some((ref) => digestSfValue(ref) === digestSfValue(prepared.planner)))).toBe(true)
  const question = calls.find((call) => call.operation === "sf_question_prepare" && digestSfValue(call.result) === digestSfValue(output))
  expect(question).toBeDefined()
  if (!question) throw new Error("The actual native output differs from every completed question preparation")
  expect(question.receipt.inputDigest).toBe(digestSfValue({ caseRef: output.caseRef,
    question: { text: output.question, ...(output.criterionRef ? { criterionRef: output.criterionRef } : {}) },
    sourceRefs: output.evidenceRefs, ...(output.recipientRef ? { recipientRef: output.recipientRef } : {}) }))
  expect(answer.messageIndex).toBeLessThan(question.messageIndex)
  console.log("SF_WP12_DASHBOARD_ANSWER_NATIVE_AUDIT:" + JSON.stringify({ scope: "actual-session-answer-before-question-result-and-receipts",
    githubSha: process.env.GITHUB_SHA ?? null, runRef: completed.runRef, nativeSessionId: completed.receipt.nativeSessionId,
    predecessorThreadId: prepared.predecessor.id, sourceRef: prepared.capex.refId, answerCallId: answer.id,
    questionCallId: question.id, answerResultDigest: digestSfValue(answer.value), outputRef: completed.output.id,
    tools: completed.tools, callDigests: calls.map((call) => ({ operation: call.operation, callId: call.id,
      inputDigest: call.receipt.inputDigest, resultDigest: call.receipt.resultDigest })),
    answerState: answer.value.state, inferenceExecuted: true, pendingTrainingResolved: false, gnativeAccepted: false }))
}
