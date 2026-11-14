import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import { chooseWp12Alternative } from "./native-choice-preparation.ts"
import { dispatchWp12Ui, executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12NativeMissionContext } from "./native-mission-harness.ts"
import { initializeWp12PortfolioSources, prepareWp12PortfolioCase, prepareWp12PortfolioMission, wp12PortfolioMissionRequest,
  WP12_PORTFOLIO_HUMAN_ACTIONS, WP12_PORTFOLIO_OPERATIONS, WP12_PORTFOLIO_PERIOD } from "./native-portfolio-preparation.ts"

async function readMemory(context: Wp12NativeMissionContext, route: "memory-conditions" | "memory-materiality",
  caseRef: { id: string; incarnation: string; version: number }, conditionId?: string) {
  const query = new URLSearchParams({ sf: route, caseId: caseRef.id, incarnation: caseRef.incarnation, version: String(caseRef.version),
    ...(conditionId ? { conditionId } : {}) })
  const response = await context.services.productHttp?.(context.request(undefined, `/sucafina/dashboard?${query}`, "GET"), "dashboard")
  if (!response) throw new Error(`The real ${route} route is missing`)
  const body = object(await response.json())
  if (response.status !== 200 || body.status !== "ok") throw new Error(`Real ${route} failed: ${String(body.reason)}`)
  return body
}

test("reevaluation reopens a real human choice and Planner condition without promoting hypothetical impact or inventing watch admission", async () => {
  await withWp12NativeMissionHost({ label: "portfolio-reevaluation", operations: [...WP12_PORTFOLIO_OPERATIONS, "sf_relation_read", "sf_watch_prepare", "sf_routine_catalog"],
    humanActions: WP12_PORTFOLIO_HUMAN_ACTIONS,
    namespaces: ["cases", "preferences", "documents", "contributions", "receipts", "outbox", "atlas", "relations"],
    initialize: initializeWp12PortfolioSources }, async (harness) => {
    const initial = await harness.open("initial", async (context) => {
      const preparedCase = await prepareWp12PortfolioCase(context)
      const criterionId = preparedCase.case.criteria[0]?.id
      if (!criterionId) throw new Error("The actual reevaluation case has no criterion")
      const chosen = await chooseWp12Alternative(context, { caseRef: preparedCase.caseRef,
        baselineResultRef: preparedCase.baseline.resultRef, alternativeResultRef: preparedCase.lowerCost.resultRef,
        alternativeId: preparedCase.lowerCost.alternative.id, alternativeVersion: preparedCase.lowerCost.alternative.version,
        parameterRef: preparedCase.parameterRef, criterionId, threshold: -20_000,
        reason: "Human selected Candidate A for further review with a proposed cost difference; no source amount or delivery date was applied." })
      const source = chosen.choice.result.components.flatMap((component) => component.sourceRefs).find((entry) =>
        entry.surface === preparedCase.source.target.surface && entry.type === preparedCase.source.target.recordType &&
        entry.id === preparedCase.source.target.recordId && entry.incarnation === preparedCase.source.target.incarnation &&
        entry.version === preparedCase.source.target.version)
      if (!source) throw new Error("The actual choice result has no matching Planner source identity")
      const fields = source.fields.filter((field) => preparedCase.source.target.fields.includes(field))
      if (!fields.length) throw new Error("The real material condition has no observed relevant fields")
      const condition = { caseRef: chosen.caseRef, choiceId: chosen.choice.id,
        scenarioRefs: [preparedCase.baseline.resultRef, preparedCase.combined.resultRef], source, evidence: preparedCase.source,
        fields, period: WP12_PORTFOLIO_PERIOD, criterionId, recipientRef: context.principalRef,
        destination: "/sucafina/planner", label: "Review the current comparison for the selected human criterion" }
      const registration = await context.services.productHttp?.(context.request(condition, "/sucafina/dashboard?sf=memory-condition"), "dashboard")
      if (!registration) throw new Error("The real material condition registration route is missing")
      const registered = object(await registration.json())
      expect(registration.status).toBe(200)
      expect(registered.status).toBe("ok")
      const listed = await readMemory(context, "memory-conditions", chosen.caseRef)
      if (!Array.isArray(listed.value)) throw new Error("The real condition registry did not return its public list")
      const matches = listed.value.map(object).filter((entry) => entry.choiceId === chosen.choice.id && entry.criterionId === criterionId && entry.label === condition.label)
      if (matches.length !== 1 || typeof matches[0]!.conditionId !== "string") throw new Error("The registered real condition is not uniquely discoverable")
      const conditionId = matches[0]!.conditionId
      const materiality = await readMemory(context, "memory-materiality", chosen.caseRef, conditionId)
      const impact = object(materiality.impact), signal = object(materiality.signal), snapshot = object(materiality.snapshot)
      expect(impact.conditionId).toBe(conditionId)
      // Numeric proposed operations remain hypothetical. The real classifier
      // must not turn a conditioned/unknown criterion into a confirmed alert.
      expect(impact.state).toBe("unknown")
      expect(impact.reason).toBe("evidence-unavailable")
      expect(signal.severity).toBe("unknown")
      expect(signal.originalReason).toBe(chosen.choice.reason)
      expect(object(snapshot.condition).choice).toEqual(chosen.choice)

      const objective = "Reavalie a escolha original somente com a condição e as comparações reais. Use sf_freshness_check, sf_context_get e sf_scenario_compare. Distinga evidência confirmada de proposta hipotética e preserve a razão original. Retorne ReconsiderationProposal verificável, sem alterar a escolha humana. Nenhuma rotina, receita ou autorização de watch foi selecionada pelo humano; não invente uma admissão nem afirme que um watch foi criado."
      const incoming = { request: wp12PortfolioMissionRequest(context, "sf_portfolio", "sf-reavaliar-compromissos", chosen.caseRef, objective),
        selection: { choiceId: chosen.choice.id, materialChangeIds: [conditionId], confirmedDependencyRefIds: [] } }
      const prepared = await prepareWp12PortfolioMission(context, incoming)
      expect(prepared.response.status).toBe(200)
      const input = decodeSfSkillInput("CommitmentReevaluationInput", prepared.body.value)
      if (!input.ok) throw new Error("The real reevaluation producer did not return CommitmentReevaluationInput")
      expect(input.value.originalChoice).toEqual(chosen.choice)
      expect(input.value.changes).toHaveLength(1)
      expect<unknown>(input.value.changes[0]).toEqual(impact)
      expect(input.value.currentComparison.baselineResultRef).toBe(preparedCase.baseline.resultRef)
      expect(input.value.currentComparison.alternativeResultRef).toBe(preparedCase.combined.resultRef)
      expect(input.value.currentComparison.knownDifference).toBe(0)
      expect(input.value.confirmedDependencyRefs).toEqual([])
      const unknownCondition = await prepareWp12PortfolioMission(context, { ...incoming,
        selection: { ...incoming.selection, materialChangeIds: ["never-registered-condition"] } })
      expect(unknownCondition.response.status).toBe(503)
      expect(unknownCondition.body).toMatchObject({ status: "unavailable", reason: "analysis-source-unavailable" })
      const absentCondition = await prepareWp12PortfolioMission(context, { ...incoming,
        selection: { ...incoming.selection, materialChangeIds: [] } })
      expect(absentCondition.response.status).toBe(400)
      expect(absentCondition.body).toMatchObject({ status: "needs-input", reason: "materiality-selection-required" })
      const unconfirmedDependency = await prepareWp12PortfolioMission(context, { ...incoming,
        selection: { ...incoming.selection, confirmedDependencyRefIds: [preparedCase.source.refId] } })
      expect(unconfirmedDependency.response.status).toBe(503)
      expect(unconfirmedDependency.body).toMatchObject({ status: "unavailable", reason: "analysis-source-unavailable" })

      const catalogRequest = { purpose: "Reevaluate a registered material condition without applying a decision" }
      const catalog = await dispatchWp12Ui(context, "sf_routine_catalog", catalogRequest)
      const decodedCatalog = catalog.status === "ok" ? decodeSfOperationOutput("sf_routine_catalog", catalog.result) : undefined
      if (catalog.status === "ok" && !decodedCatalog?.ok) throw new Error("The mounted routine catalog returned invalid output")
      if (catalog.status !== "ok") expect(catalog.status).toBe("unavailable")
      const watchGate = { requiredOperation: "sf_watch_prepare", status: "not-executed", admissionRef: null,
        catalogStatus: catalog.status, catalogReason: catalog.status === "ok" ? null : catalog.reason,
        publishedRecipeCount: decodedCatalog?.ok ? decodedCatalog.value.recipes.length : null,
        recipeSelectedByHuman: false,
        publishedSourceFinding: "createSfMemoryServices.prepareWatch returns native-watch-admission-port-unavailable after materiality validation",
        sourceFindingWasExecuted: false, requiredOperationAccepted: false }
      const current = await prepareWp12PortfolioMission(context, incoming)
      expect(current.response.status).toBe(200)
      expect(digestSfValue(current.body.value)).toBe(digestSfValue(input.value))
      console.log("SF_WP12_NATIVE_REEVALUATION_INPUT:" + JSON.stringify({ scope: "real-choice-condition-materiality-and-input",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: chosen.caseRef, choiceId: chosen.choice.id, conditionId,
        inputDigest: digestSfValue(input.value), impact: { state: impact.state, reason: impact.reason },
        beforeKnownDifference: chosen.choice.comparison.knownDifference, currentKnownDifference: input.value.currentComparison.knownDifference,
        consumerRef: "createSfMemoryHttp:memory-materiality", watchGate, inferenceExecuted: false, choiceChanged: false, gnativeAccepted: false }))
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: current.body.value })
        return { incoming, conditionId, inputDigest: digestSfValue(input.value), caseDigest: digestSfValue(chosen.case),
          materialityDigest: digestSfValue(materiality), watchGate, completed: undefined }
      }
      expectSpawn(import.meta.path)
      // This executes only the analysis that has real inputs. The canonical
      // watch requirement stays explicitly blocked and is never labelled PASS.
      const completed = await executeWp12NativeMission(context, { request: incoming.request, skillInput: current.body.value,
        expectedKind: "ReconsiderationProposal", requiredTools: ["sf_freshness_check", "sf_context_get", "sf_scenario_compare"].map((operation) => ({ operation })) })
      if (completed.output.kind !== "ReconsiderationProposal" || completed.output.state !== "ready") throw new Error("The reevaluation output changed its kind")
      expect(completed.output.payload.choiceChanged).toBe(false)
      expect(completed.output.payload.choiceRef).toBe(chosen.choice.id)
      expect(completed.output.payload.impacts).toEqual(input.value.changes)
      expect(completed.output.payload.currentResultRef).toBe(input.value.currentComparison.alternativeResultRef)
      console.log("SF_WP12_NATIVE_REEVALUATION_LIMIT:" + JSON.stringify({ runRef: completed.runRef, outputRef: completed.output.id,
        scope: "native-analysis-without-watch-admission", watchGate, inferenceExecuted: true, gnativeAccepted: false }))
      return { incoming, conditionId, inputDigest: digestSfValue(input.value), caseDigest: digestSfValue(chosen.case),
        materialityDigest: digestSfValue(materiality), watchGate, completed }
    })
    await harness.open("reopened", async (context) => {
      const materiality = await readMemory(context, "memory-materiality", initial.incoming.request.caseRef, initial.conditionId)
      expect(digestSfValue(materiality)).toBe(initial.materialityDigest)
      const prepared = await prepareWp12PortfolioMission(context, initial.incoming)
      expect(prepared.response.status).toBe(200)
      expect(digestSfValue(prepared.body.value)).toBe(initial.inputDigest)
      const current = await readCaseAnalysisProjection(context.request(), context.services, initial.incoming.request.caseRef)
      if (current.status !== "ok") throw new Error("The reevaluation case cannot be reopened")
      expect(digestSfValue(current.value.case)).toBe(initial.caseDigest)
      if (initial.completed) expect((await readWp12NativeMissionAfterReload(context, initial.completed)).output.kind).toBe("ReconsiderationProposal")
      console.log("SF_WP12_NATIVE_REEVALUATION_CONSUMER:" + JSON.stringify({ scope: "real-condition-and-analysis-input-reopened",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: initial.incoming.request.caseRef, conditionId: initial.conditionId,
        consumerRef: "createSfMemoryHttp:memory-materiality", inputReopened: true, inferenceExecuted: !!initial.completed,
        outputRef: initial.completed?.output.id ?? null, choiceChanged: false, watchGate: initial.watchGate, gnativeAccepted: false }))
    })
  })
}, 300_000)
