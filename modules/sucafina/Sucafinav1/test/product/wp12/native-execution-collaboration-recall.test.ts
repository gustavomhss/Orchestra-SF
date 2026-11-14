import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { object } from "../../../runtime/contract.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12NativeMissionContext } from "./native-mission-harness.ts"
import { initializeWp12ScenarioSources, prepareWp12ScenarioCase, WP12_SCENARIO_HUMAN_ACTIONS, WP12_SCENARIO_OPERATIONS } from "./native-scenario-preparation.ts"

type Preparation = Parameters<NonNullable<SfHostServices["analysisInputs"]>["prepare"]>[1]
const period = { start: "2027-01-01", end: "2027-12-31" }
const operations = ["sf_case_draft", "sf_case_read", "sf_context_get", "sf_source_get", "sf_evidence_get", "sf_freshness_check",
  "sf_decision_recall", "sf_knowledge_search", "sf_question_prepare", "sf_answer_read", "sf_relation_read", "sf_work_list", "sf_handoff_prepare"]

test("real Recall preparation preserves an explicit empty scope and the native empty result reopens when a model exists", async () => {
  await withWp12NativeMissionHost({ label: "collaboration-recall", operations, initialize: initializeMissionSources }, async (harness) => {
    const initial = await harness.open("initial", async (context) => {
      const objective = "Consulte somente o escopo explícito de precedentes deste caso. Use sf_decision_recall, sf_knowledge_search, sf_context_get e sf_freshness_check. O escopo escolhido está vazio: retorne CaseRecall com o vazio canônico observado, sem inventar caso anterior, fonte, match ou resultado de Atlas."
      const decision = await createMissionCase(context, objective)
      const caseRef = { id: decision.id, incarnation: decision.incarnation, version: decision.version }
      const incoming = { request: missionRequest(context, "sf-consultar-memoria-decisoria", caseRef, objective),
        selection: { currentCase: caseRef, query: objective, recallScope: { cases: [], period, includeHistorical: false } } }
      const prepared = await prepareThroughHost(context, incoming)
      expect(prepared.response.status).toBe(200)
      expect(prepared.body.status).toBe("ok")
      const decoded = decodeSfSkillInput("DecisionRecallInput", prepared.body.value)
      if (!decoded.ok) throw new Error("The real Recall producer did not return DecisionRecallInput")
      expect(decoded.value).toEqual(incoming.selection)

      const invalidQuery = await prepareThroughHost(context, { ...incoming, selection: { ...incoming.selection, query: "A different unadmitted objective" } })
      expect(invalidQuery.response.status).toBe(400)
      expect(invalidQuery.body).toMatchObject({ status: "needs-input", reason: "invalid-analysis-input" })
      const replacedCase = await prepareThroughHost(context, { ...incoming,
        selection: { ...incoming.selection, currentCase: { ...caseRef, incarnation: "never-issued-incarnation" } } })
      expect(replacedCase.response.status).toBe(400)
      expect(replacedCase.body).toMatchObject({ status: "needs-input", reason: "invalid-analysis-input" })
      const unknownPrecedent = await prepareThroughHost(context, { ...incoming,
        selection: { ...incoming.selection, recallScope: { ...incoming.selection.recallScope,
          cases: [{ id: "never-issued-case", incarnation: "never-issued-incarnation", version: 1 }] } } })
      expect(unknownPrecedent.response.status).toBe(503)
      expect(unknownPrecedent.body).toMatchObject({ status: "unavailable", reason: "analysis-source-unavailable" })
      await expectCaseUnchanged(context, decision)
      await expectNoNativeRuns(context, caseRef)
      console.log("SF_WP12_NATIVE_RECALL_INPUT:" + JSON.stringify({ scope: "real-host-prepare-empty-recall-scope",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef, inputDigest: digestSfValue(decoded.value),
        consumerRef: "createSfAnalysisHttp:prepare", route: "/sucafina/planner?sf=workbench-analysis",
        negativeDiscriminators: ["query-mismatch", "case-incarnation-mismatch", "unknown-explicit-precedent"],
        actualPrecedentObserved: false, atlasReadWitness: false, inferenceExecuted: false }))

      // Negative preparations have their own human intentions. Reprepare the
      // original explicit selection before starting any native mission.
      const current = await prepareThroughHost(context, incoming)
      expect(current.response.status).toBe(200)
      expect(current.body.status).toBe("ok")
      expect(digestSfValue(current.body.value)).toBe(digestSfValue(decoded.value))
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: current.body.value })
        return { decision, incoming, inputDigest: digestSfValue(decoded.value), completed: undefined }
      }
      expectSpawn(import.meta.path)
      const completed = await executeWp12NativeMission(context, { request: incoming.request, skillInput: current.body.value,
        expectedKind: "CaseRecall", requiredTools: ["sf_decision_recall", "sf_knowledge_search", "sf_context_get", "sf_freshness_check"].map((operation) => ({ operation })) })
      if (completed.output.kind !== "CaseRecall" || completed.output.state !== "ready") throw new Error("Recall did not return its observed empty-result kind")
      expect(completed.output.payload.matches).toEqual([])
      expect(completed.output.evidenceRefs).toEqual([])
      return { decision, incoming, inputDigest: digestSfValue(decoded.value), completed }
    })

    await harness.open("reopened", async (context) => {
      await expectCaseUnchanged(context, initial.decision)
      const prepared = await prepareThroughHost(context, initial.incoming)
      expect(prepared.response.status).toBe(200)
      expect(prepared.body.status).toBe("ok")
      expect(digestSfValue(prepared.body.value)).toBe(initial.inputDigest)
      if (!initial.completed) {
        await expectNoNativeRuns(context, initial.incoming.request.caseRef)
        console.log("SF_WP12_NATIVE_RECALL_REOPEN:" + JSON.stringify({ scope: "real-input-reopened-without-inference",
          githubSha: process.env.GITHUB_SHA ?? null, caseRef: initial.incoming.request.caseRef, inputDigest: initial.inputDigest,
          consumerRef: "createSfAnalysisHttp:prepare", inputReopened: true, outputRef: null,
          actualPrecedentObserved: false, atlasReadWitness: false, inferenceExecuted: false, gnativeAccepted: false }))
        return
      }
      const reopened = await readWp12NativeMissionAfterReload(context, initial.completed)
      if (reopened.output.kind !== "CaseRecall") throw new Error("Reopened Recall changed its output kind")
      expect(reopened.output.payload.matches).toEqual([])
      expect(reopened.html).toContain("Related decisions")
      expect(reopened.html).toContain("None recorded.")
      console.log("SF_WP12_NATIVE_RECALL_EMPTY_CONSUMER:" + JSON.stringify({ scope: "explicit-empty-recall-result-consumed",
        githubSha: process.env.GITHUB_SHA ?? null, runRef: initial.completed.runRef, outputRef: reopened.output.id,
        consumerRef: "handleSfAnalysis:output", observedAction: "reopened-empty-related-decisions",
        actualPrecedentObserved: false, historicalPrecedentAccepted: false, allEighteenSkillsAccepted: false }))
    })
  })
}, 240_000)

test("real question preparation preserves absent conditions and refuses an unverified recipient before any native run", async () => {
  await withWp12NativeMissionHost({ label: "collaboration-question", operations,
    namespaces: ["cases", "preferences", "documents", "contributions", "receipts", "outbox", "atlas", "threads", "relations"],
    initialize: initializeMissionSources }, async (harness) => {
    const initial = await harness.open("initial", async (context) => {
      const objective = "Prepare perguntas apenas para condições reais do caso e destinatários explicitamente autorizados; a ausência de condição não autoriza inventá-la."
      const decision = await createMissionCase(context, objective)
      const caseRef = { id: decision.id, incarnation: decision.incarnation, version: decision.version }
      const incoming = { request: missionRequest(context, "sf-coordenar-perguntas", caseRef, objective),
        selection: { relationRefIds: [], directoryRefs: [] } }
      const prepared = await prepareThroughHost(context, incoming)
      expect(prepared.response.status).toBe(200)
      expect(prepared.body.status).toBe("ok")
      const decoded = decodeSfSkillInput("QuestionPlanningInput", prepared.body.value)
      if (!decoded.ok) throw new Error("The real question producer did not return QuestionPlanningInput")
      expect(decoded.value).toEqual({ case: caseRef, unresolvedConditions: [], relations: [], authorizedDirectoryRefs: [] })
      const unknownRecipient = await prepareThroughHost(context, { ...incoming,
        selection: { ...incoming.selection, directoryRefs: ["never-authorized-recipient"] } })
      expect(unknownRecipient.response.status).toBe(503)
      expect(unknownRecipient.body).toMatchObject({ status: "unavailable", reason: "analysis-input-producer-unavailable" })
      const nameInsteadOfSelection = await prepareThroughHost(context, { ...incoming,
        selection: { ...incoming.selection, recipientName: "Explicit synthetic native mission principal" } })
      expect(nameInsteadOfSelection.response.status).toBe(400)
      expect(nameInsteadOfSelection.body).toMatchObject({ status: "needs-input", reason: "invalid-analysis-input" })
      await expectCaseUnchanged(context, decision)
      await expectNoNativeRuns(context, caseRef)
      console.log("SF_WP12_NATIVE_QUESTION_INPUT:" + JSON.stringify({ scope: "real-question-input-and-negative-selection",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef, inputDigest: digestSfValue(decoded.value),
        consumerRef: "createSfAnalysisHttp:prepare", route: "/sucafina/planner?sf=workbench-analysis",
        unresolvedConditionCount: 0, authorizedRecipientCount: 0,
        missingPositivePrerequisites: ["persisted-alternative-or-choice-with-real-pending-cost-coverage", "confirmed-source-relation-and-authorized-recipient"],
        proposalCreated: false, assignmentCreated: false, inferenceExecuted: false, outputRef: null, gnativeAccepted: false }))
      return { decision, incoming, inputDigest: digestSfValue(decoded.value) }
    })
    await harness.open("reopened", async (context) => {
      await expectCaseUnchanged(context, initial.decision)
      const prepared = await prepareThroughHost(context, initial.incoming)
      expect(prepared.response.status).toBe(200)
      expect(prepared.body.status).toBe("ok")
      expect(digestSfValue(prepared.body.value)).toBe(initial.inputDigest)
      await expectNoNativeRuns(context, initial.incoming.request.caseRef)
    })
  })
}, 120_000)

test("question input derives a real pending training condition and the human preview preserves its actual source", async () => {
  await withWp12NativeMissionHost({ label: "collaboration-pending-training",
    operations: [...new Set([...operations, ...WP12_SCENARIO_OPERATIONS])], humanActions: WP12_SCENARIO_HUMAN_ACTIONS,
    namespaces: ["cases", "preferences", "documents", "contributions", "receipts", "outbox", "atlas", "threads", "relations"],
    initialize: initializeWp12ScenarioSources }, async (harness) => {
    const initial = await harness.open("initial", async (context) => {
      const objective = "Identifique nas alternativas calculadas as informações necessárias para completar a decisão e prepare uma pergunta verificável, sem preencher lacunas como fatos ou atribuir destinatário não verificado."
      const scenario = await prepareWp12ScenarioCase(context, { objective })
      const condition = scenario.pending.result.costCoverage.entries.find((entry) => entry.categoryId === "training" && entry.status === "pending")
      const source = scenario.sources.find((value) => value.key === "pending")
      if (!condition || condition.status !== "pending" || !source) throw new Error("The real C09/C10 path did not provide its pending training condition and source")
      const incoming = { request: missionRequest(context, "sf-coordenar-perguntas", scenario.caseRef, objective),
        selection: { relationRefIds: [], directoryRefs: [] } }
      const prepared = await prepareThroughHost(context, incoming)
      expect(prepared.response.status).toBe(200)
      expect(prepared.body.status).toBe("ok")
      const decoded = decodeSfSkillInput("QuestionPlanningInput", prepared.body.value)
      if (!decoded.ok) throw new Error("The real question producer rejected the calculated pending cost condition")
      const pending = decoded.value.unresolvedConditions.filter((value) => value.category === "training")
      expect(pending).toHaveLength(1)
      expect(pending[0]?.reason).toBe(condition.reason)
      expect(decoded.value.authorizedDirectoryRefs).toEqual([])

      // This is an explicitly human preparation through the installed domain
      // capability. It is never labelled as a native/model-produced output.
      const question = { caseRef: encodeCaseRef(scenario.caseRef),
        question: { text: "Qual é o custo de treinamento desta alternativa? Esse valor é necessário para completar a comparação de custo total." },
        sourceRefs: [source.evidence] }
      const proposal = await context.ui("sf_question_prepare", question, (call) => context.services.dispatch("sf_question_prepare", question, call))
      expect(proposal.status).toBe("ok")
      if (proposal.status !== "ok") throw new Error(`The real human question preparation failed: ${proposal.reason}`)
      const output = decodeSfOperationOutput("sf_question_prepare", proposal.result)
      if (!output.ok) throw new Error("The real question capability returned an invalid proposal")
      expect(proposal.receipt.kind).toBe("ui")
      expect(output.value.expectedCaseVersion).toBe(scenario.caseRef.version)
      expect(output.value.evidenceRefs).toEqual([source.evidence])
      expect(output.value.recipientRef).toBeUndefined()
      await expectCaseUnchanged(context, scenario.case)
      await expectNoNativeRuns(context, scenario.caseRef)
      console.log("SF_WP12_REAL_QUESTION_PENDING_INPUT:" + JSON.stringify({ scope: "real-cost-condition-input-and-human-domain-preview",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: scenario.caseRef,
        inputDigest: digestSfValue(decoded.value), conditionIds: pending.map((value) => value.id),
        conditionEvidenceRefCounts: pending.map((value) => value.evidenceRefs.length), confirmedRelationCount: decoded.value.relations.length,
        conditionSource: "real-c09-c10-pending-training", knownSubtotal: scenario.pending.result.knownSubtotal, total: scenario.pending.result.total,
        producerRef: "createSfAnalysisHttp:prepare", domainPreviewRef: "sf_question_prepare:prepareQuestion",
        domainPreviewDigest: digestSfValue(output.value), receiptKind: proposal.receipt.kind,
        sourceRefIds: output.value.evidenceRefs.map((ref) => ref.refId), assigned: false,
        nativeMissionPrerequisites: ["verified-recipient-and-source-bearing-question-selection", "real-answer-or-confirmed-no-answer-context"],
        modelOutputRef: null, inferenceExecuted: false, gnativeAccepted: false }))
      return { case: scenario.case, incoming, inputDigest: digestSfValue(decoded.value) }
    })
    await harness.open("reopened", async (context) => {
      await expectCaseUnchanged(context, initial.case)
      const prepared = await prepareThroughHost(context, initial.incoming)
      expect(prepared.response.status).toBe(200)
      expect(prepared.body.status).toBe("ok")
      expect(digestSfValue(prepared.body.value)).toBe(initial.inputDigest)
      await expectNoNativeRuns(context, initial.incoming.request.caseRef)
    })
  })
}, 120_000)

async function initializeMissionSources(persistence: Wp12NativeMissionContext["persistence"]) {
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data = { versions: [{ id: "wp12-collaboration-reference", name: "Explicit synthetic collaboration source", year: 2027, closed: 0,
      lines: [{ id: "wp12-source-line", name: "Current authorized service", ownerId: "wp12-owner", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(120), a: Array(12).fill(null), f: Array(12).fill(120) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
      officials: { "2027": "wp12-collaboration-reference" }, entities: [], allocations: [], roster: [] }
    return { commit: true, value: undefined }
  })
}

async function createMissionCase(context: Wp12NativeMissionContext, objective: string) {
  return context.ui("sf_case_draft", { purpose: "collaboration-mission-source-selection" }, async (call) => {
    const source = await context.business.plannerProduct.issueSource("wp12-collaboration-reference", call)
    if (source.status !== "ok") throw new Error(`The real mission source issuer failed: ${source.reason}`)
    const draft = { objective, horizon: period, currency: "USD", criteria: ["Usar somente fontes atuais e escopo humano explícito"], sourceRefs: [source.value.evidence] }
    const created = await context.ui("sf_case_draft", draft, (create) => context.business.cases.draft(draft, create))
    if (created.status !== "ok") throw new Error(`The real mission case was not persisted: ${created.reason}`)
    return created.value
  })
}

function missionRequest(context: Wp12NativeMissionContext, skillId: string, caseRef: Preparation["request"]["caseRef"], objective: string) {
  const profile = context.services.selected.find((value) => value.profile.id === "sf_maestro")
  const skill = profile?.skills.find((value) => value.id === skillId)
  if (!profile || !skill) throw new Error(`The installed Maestro profile does not publish ${skillId}`)
  return { caseRef, objective, profileId: profile.profile.id, profileVersion: profile.profile.version,
    skillId: skill.id, skillVersion: skill.version, manifestDigest: profile.manifestDigest,
    outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [...skill.allowedOperations] }
}

async function prepareThroughHost(context: Wp12NativeMissionContext, incoming: Preparation) {
  if (!context.services.productHttp) throw new Error("The composed host did not install its analysis HTTP route")
  const response = await context.services.productHttp(context.request({ action: "prepare", input: incoming }, "/sucafina/planner?sf=workbench-analysis"), "planner")
  if (!response) throw new Error("The composed host did not handle the workbench analysis preparation")
  return { response, body: object(await response.json()) }
}

async function expectCaseUnchanged(context: Wp12NativeMissionContext,
  original: Awaited<ReturnType<typeof createMissionCase>> | Awaited<ReturnType<typeof prepareWp12ScenarioCase>>["case"]) {
  const request = { caseRef: encodeCaseRef(original) }
  const read = await context.ui("sf_case_read", request, (call) => context.business.cases.read(request, call))
  expect(read.status).toBe("ok")
  if (read.status !== "ok") throw new Error("The mission's current case became unavailable")
  expect(digestSfValue(read.value.case)).toBe(digestSfValue(original))
}

async function expectNoNativeRuns(context: Wp12NativeMissionContext, caseRef: Preparation["request"]["caseRef"]) {
  if (!context.services.analyses) throw new Error("The composed host did not install its analysis service")
  const runs = await context.human("analysis.read", { caseRef }, (call) => context.services.analyses!.list(call, caseRef))
  expect(runs).toEqual({ status: "ok", value: [] })
}
