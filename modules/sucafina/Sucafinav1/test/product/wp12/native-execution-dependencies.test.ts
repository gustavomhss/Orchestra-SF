import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import { chooseWp12Alternative } from "./native-choice-preparation.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12NativeMissionContext } from "./native-mission-harness.ts"
import { initializeWp12PortfolioSources, prepareWp12PortfolioCase, prepareWp12PortfolioMission, wp12PortfolioMissionRequest,
  WP12_PORTFOLIO_HUMAN_ACTIONS, WP12_PORTFOLIO_OPERATIONS, WP12_PORTFOLIO_PERIOD } from "./native-portfolio-preparation.ts"

const projectId = "wp12-delivery-project"
const otherProjectId = "wp12-homonymous-project"
const capexId = "wp12-capex-plan"
const milestoneId = `milestone:${encodeURIComponent(projectId)}:release`

async function initializeDependencies(persistence: Wp12NativeMissionContext["persistence"]) {
  await initializeWp12PortfolioSources(persistence)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.projects = [
      { id: projectId, name: "Shared delivery name", status: "Planning", risk: "Low", budget: 0, spent: 0, pct: 0,
        milestones: [{ id: "release", name: "Delivery checkpoint", date: "2027-05-15", status: "upcoming" }] },
      { id: otherProjectId, name: "Shared delivery name", status: "Planning", risk: "Low", budget: 0, spent: 0, pct: 0, milestones: [] },
    ]
    snapshot.data.capexProjects = [{ id: capexId, name: "Shared delivery name", year: 2027, ownerId: "wp12-source-owner" }]
    snapshot.data.capexEntries = []
    return { commit: true, value: undefined }
  })
}

async function collaboration(context: Wp12NativeMissionContext, mode: string, payload: unknown) {
  const response = await context.services.productHttp?.(context.request(payload, `/sucafina/dashboard?sf=collaboration-${mode}`), "dashboard")
  if (!response) throw new Error(`The real collaboration ${mode} route is missing`)
  const result = object(await response.json())
  if (response.status !== 200 || result.status !== "ok") throw new Error(`Real collaboration ${mode} failed: ${String(result.reason)}`)
  return result.value
}

test("dependency review uses a confirmed relation, actual choice and dated milestone while homonyms and FTE declarations confer no authority", async () => {
  await withWp12NativeMissionHost({ label: "portfolio-dependencies", operations: [...WP12_PORTFOLIO_OPERATIONS, "sf_relation_read", "sf_dashboard_read", "sf_work_list"],
    humanActions: [...WP12_PORTFOLIO_HUMAN_ACTIONS, "collaboration.relation.confirm", "collaboration.storage.version"],
    namespaces: ["cases", "preferences", "documents", "contributions", "receipts", "outbox", "atlas", "threads", "relations", "confirmations"],
    initialize: initializeDependencies }, async (harness) => {
    const initial = await harness.open("initial", async (context) => {
      const sources = await context.ui("sf_context_get", { purpose: "native-dependency-sources" }, async (call) => {
        // One page projection carries dates; records are issued separately for
        // the actual C06 relation. Names never act as join keys.
        const page = await createDashboardSourceIssuer({ host: context.business.host, scopedSources: context.persistence })({
          page: "Portfolio Dashboard", fields: ["milestoneDates"], period: WP12_PORTFOLIO_PERIOD }, call)
        const project = await context.business.dashboardRecords.issue({ page: "Portfolio Dashboard", recordType: "projects", recordId: projectId,
          fields: ["name", "milestones"], period: WP12_PORTFOLIO_PERIOD }, call)
        const other = await context.business.dashboardRecords.issue({ page: "Portfolio Dashboard", recordType: "projects", recordId: otherProjectId,
          fields: ["name", "milestones"], period: WP12_PORTFOLIO_PERIOD }, call)
        const capex = await context.business.dashboardRecords.issue({ page: "CAPEX Projects", recordType: "capexProjects", recordId: capexId,
          fields: ["name"], period: WP12_PORTFOLIO_PERIOD }, call)
        if (page.status !== "ok" || project.status !== "ok" || other.status !== "ok" || capex.status !== "ok")
          throw new Error("The real dashboard issuers did not authorize the selected dependency sources")
        return { page: page.value.evidence, project: project.value, other: other.value, capex: capex.value }
      })
      const storageVersion = await collaboration(context, "storage-version", { namespace: "relations" })
      if (typeof storageVersion !== "number") throw new Error("The actual relation storage version is unavailable")
      const pair = { fromRef: sources.project.refId, toRef: sources.capex.refId, kind: "pmo-capex", evidenceRefs: [sources.project, sources.capex] }
      const relation = object(await collaboration(context, "relation-create", { operation: "create", pair,
        mutation: { expectedStorageVersion: storageVersion, idempotencyKey: randomUUID() } }))
      if (typeof relation.id !== "string") throw new Error("The real human confirmation did not create its relation")
      expect(relation.confirmedBy).toBe(context.principalRef)
      expect(relation.fromRef).toBe(sources.project.refId)
      expect(relation.toRef).toBe(sources.capex.refId)
      const preparedCase = await prepareWp12PortfolioCase(context, [sources.page, sources.project, sources.other, sources.capex])
      const criterionId = preparedCase.case.criteria[0]?.id
      if (!criterionId) throw new Error("The actual dependency case has no criterion")
      const chosen = await chooseWp12Alternative(context, { caseRef: preparedCase.caseRef,
        baselineResultRef: preparedCase.baseline.resultRef, alternativeResultRef: preparedCase.lowerCost.resultRef,
        alternativeId: preparedCase.lowerCost.alternative.id, alternativeVersion: preparedCase.lowerCost.alternative.version,
        parameterRef: preparedCase.parameterRef, criterionId, threshold: -20_000,
        reason: "Human choice retained for review of delivery conditions; financial preview does not establish capacity or delivery feasibility." })
      const declaredConstraints = ["Human expects delivery in March 2027; this is an unverified request, not a confirmed due date.",
        "A human mentioned 1 FTE; no available capacity or allocation was confirmed."]
      const selection = { relationRefIds: [sources.project.refId, sources.capex.refId], commitmentIds: [chosen.choice.id],
        milestoneIds: [milestoneId], declaredConstraints }
      const objective = "Revise dependências com sf_case_read, sf_relation_read, sf_context_get e sf_source_get. Use apenas os IDs confirmados, a escolha e o marco do input. Preserve declarações humanas como não verificadas, sem equiparar FTE a capacidade livre ou nomes iguais a relação. Retorne DeliveryAssessment com as restrições e condições reais, sem alterar datas oficiais."
      const incoming = { request: wp12PortfolioMissionRequest(context, "sf_portfolio", "sf-revisar-dependencias", chosen.caseRef, objective), selection }
      const prepared = await prepareWp12PortfolioMission(context, incoming)
      expect(prepared.response.status).toBe(200)
      const input = decodeSfSkillInput("DependencyReviewInput", prepared.body.value)
      if (!input.ok) throw new Error("The mounted dependency producer did not return DependencyReviewInput")
      expect(input.value.relations).toHaveLength(1)
      expect(input.value.relations[0]?.id).toBe(relation.id)
      expect(input.value.commitments.map((entry) => entry.id)).toEqual([chosen.choice.id])
      expect(input.value.milestones).toEqual([{ id: milestoneId, projectRef: sources.page, at: "2027-05-15", state: "upcoming" }])
      expect(input.value.declaredConstraints).toEqual(declaredConstraints)
      const homonym = await prepareWp12PortfolioMission(context, { ...incoming,
        selection: { ...selection, relationRefIds: [sources.other.refId] } })
      expect(homonym.response.status).toBe(503)
      expect(homonym.body).toMatchObject({ status: "unavailable", reason: "analysis-source-unavailable" })
      const unknownChoice = await prepareWp12PortfolioMission(context, { ...incoming,
        selection: { ...selection, commitmentIds: ["never-issued-choice"] } })
      expect(unknownChoice.response.status).toBe(503)
      expect(unknownChoice.body).toMatchObject({ status: "unavailable", reason: "analysis-source-unavailable" })
      const injectedCapacity = await prepareWp12PortfolioMission(context, { ...incoming,
        selection: { ...selection, confirmedCapacityFte: 1 } })
      expect(injectedCapacity.response.status).toBe(400)
      expect(injectedCapacity.body).toMatchObject({ status: "needs-input", reason: "invalid-analysis-input" })
      const current = await prepareWp12PortfolioMission(context, incoming)
      expect(current.response.status).toBe(200)
      expect(digestSfValue(current.body.value)).toBe(digestSfValue(input.value))
      console.log("SF_WP12_NATIVE_DEPENDENCY_INPUT:" + JSON.stringify({ scope: "real-confirmed-relation-choice-and-dashboard-milestone",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: chosen.caseRef, inputDigest: digestSfValue(input.value),
        relationId: relation.id, commitmentId: chosen.choice.id, milestoneId, milestoneDate: "2027-05-15",
        sameNameRelationRefused: true, capacityConfirmed: false, declaredConstraintCount: declaredConstraints.length,
        inferenceExecuted: false, officialDateChanged: false }))
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: current.body.value })
        return { incoming, inputDigest: digestSfValue(input.value), caseDigest: digestSfValue(chosen.case), relationId: relation.id,
          sourceRefs: [sources.project.refId, sources.capex.refId], completed: undefined, conflict: undefined }
      }
      expectSpawn(import.meta.path)
      const requiredTools = ["sf_relation_read", "sf_context_get", "sf_source_get"].map((operation) => ({ operation }))
      const completed = await executeWp12NativeMission(context, { request: incoming.request, skillInput: current.body.value,
        expectedKind: "DeliveryAssessment", requiredTools })
      if (completed.output.kind !== "DeliveryAssessment" || completed.output.state !== "ready") throw new Error("Dependency assessment changed its kind")
      expect(completed.output.payload.capacityConstraints).toEqual(declaredConstraints)
      expect(completed.output.payload.dependencies).toHaveLength(1)
      for (const [index, declaration] of declaredConstraints.entries()) expect(completed.output.payload.unresolvedConditions).toContainEqual({
        id: `human-declared-constraint:${index}`, category: "human-declared-constraint", reason: `Unverified human declaration: ${declaration}`, evidenceRefs: [] })
      const conflictIncoming = { ...incoming, request: { ...incoming.request,
        objective: "Releia com sf_relation_read, sf_context_get e sf_source_get a relação explicitamente confirmada e o marco atual. Avalie a primeira declaração humana selecionada em relação a essas fontes e determine se há evidência suficiente para caracterizar um conflito. Retorne DependencyConflict com a conclusão sustentada pelo input, sem alterar datas oficiais ou tratar uma declaração humana como regra confirmada." } }
      const conflictInput = await prepareWp12PortfolioMission(context, conflictIncoming)
      expect(conflictInput.response.status).toBe(200)
      const conflict = await executeWp12NativeMission(context, { request: conflictIncoming.request, skillInput: conflictInput.body.value,
        expectedKind: "DependencyConflict", requiredTools })
      if (conflict.output.kind !== "DependencyConflict" || conflict.output.state !== "ready") throw new Error("Dependency conflict changed its kind")
      expect(conflict.output.payload.state).toBe("needs-input")
      return { incoming, inputDigest: digestSfValue(input.value), caseDigest: digestSfValue(chosen.case), relationId: relation.id,
        sourceRefs: [sources.project.refId, sources.capex.refId], completed, conflict }
    })
    await harness.open("reopened", async (context) => {
      const prepared = await prepareWp12PortfolioMission(context, initial.incoming)
      expect(prepared.response.status).toBe(200)
      expect(digestSfValue(prepared.body.value)).toBe(initial.inputDigest)
      const request = { recordRefs: initial.sourceRefs }
      const relations = await context.ui("sf_relation_read", request, (call) => context.services.dispatch("sf_relation_read", request, call))
      if (relations.status !== "ok") throw new Error(`The confirmed relation cannot be reopened: ${relations.reason}`)
      const read = decodeSfOperationOutput("sf_relation_read", relations.result)
      if (!read.ok) throw new Error("The mounted relation reader returned invalid output")
      expect(read.value.relations.map((entry) => entry.id)).toEqual([initial.relationId])
      const current = await readCaseAnalysisProjection(context.request(), context.services, initial.incoming.request.caseRef)
      if (current.status !== "ok") throw new Error("The dependency case cannot be reopened")
      expect(digestSfValue(current.value.case)).toBe(initial.caseDigest)
      if (initial.completed && initial.conflict) {
        expect((await readWp12NativeMissionAfterReload(context, initial.completed)).output.kind).toBe("DeliveryAssessment")
        expect((await readWp12NativeMissionAfterReload(context, initial.conflict)).output.kind).toBe("DependencyConflict")
      }
      console.log("SF_WP12_NATIVE_DEPENDENCY_CONSUMER:" + JSON.stringify({ scope: "real-dependency-context-reopened",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: initial.incoming.request.caseRef,
        consumerRef: "sf_relation_read:readConfirmedRelations", relationId: initial.relationId, inputReopened: true,
        inferenceExecuted: !!initial.completed, outputRef: initial.completed?.output.id ?? null,
        conflictOutputRef: initial.conflict?.output.id ?? null, officialDateChanged: false, gnativeAccepted: false }))
    })
  })
}, 420_000)
