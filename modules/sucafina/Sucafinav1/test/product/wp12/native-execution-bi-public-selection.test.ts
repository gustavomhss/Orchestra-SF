import { expect, test } from "bun:test"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { SfBiArtifact } from "../../../product/contracts/state.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { dashboardMetricSelector } from "../../../product/dashboard/sources.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { object } from "../../../runtime/contract.ts"
import { dispatchWp12Ui, executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12CompletedNativeMission, Wp12NativeMissionContext } from "./native-mission-harness.ts"

type CaseRef = SfBiArtifact["caseRef"]
type Preparation = Parameters<NonNullable<Wp12NativeMissionContext["services"]["analysisInputs"]>["prepare"]>[1]
const period = { start: "2027-01-01", end: "2027-12-31" }
const amounts = [1_000, 2_000, 3_000, 4_000, 5_000, 6_000, 7_000, 8_000, 9_000, 10_000, 11_000, 12_000]
const missionOperations = ["sf_case_read", "sf_dashboard_read", "sf_bi_view", "sf_kpi_explain", "sf_source_get"]

test("native contextual BI uses publicly saved and selected artifact handles with real case isolation and consumers after reload", async () => {
  const startedAt = Date.now()
  const phase = (name: string) => console.log("SF_WP12_BI_PUBLIC_PHASE:" + JSON.stringify({ phase: name,
    elapsedMs: Date.now() - startedAt, githubSha: process.env.GITHUB_SHA ?? null }))
  await withWp12NativeMissionHost({ label: "bi-public-selection", operations: ["sf_case_draft", "sf_context_get", ...missionOperations],
    humanActions: ["analysis.prepare", "analysis.start", "analysis.read", "analysis.cancel", "bi.artifact.save", "bi.artifact.read", "bi.selection.set", "bi.selection.read"],
    namespaces: ["cases", "preferences", "contributions", "bi-artifacts", "atlas", "receipts", "outbox"],
    initialize: async (persistence) => {
      await persistence.transaction("dashboard", async (snapshot) => {
        // Business input only; the host produces every source, artifact, choice,
        // input and receipt. The annual owner amount differs from the overrides.
        snapshot.data.opexOwners = [{ id: "wp12-bi-public-owner", name: "Selected public budget", budget: 120_000 }]
        snapshot.data.opexEntries = amounts.map((budget, index) => ({ id: `wp12-bi-public-${index + 1}`,
          ownerId: "wp12-bi-public-owner", year: 2027, month: index + 1, budget,
          ...(index === 1 ? {} : { actual: index === 0 ? 0 : 500 * (index + 1) }),
          ...(index === 3 ? {} : { forecast: budget + 100 }),
        }))
        snapshot.data.capexProjects = []
        snapshot.data.capexEntries = []
        return { commit: true, value: undefined }
      })
    },
  }, async ({ open }) => {
    const initial = await open("initial", async (context) => {
      const profile = context.services.selected.find((entry) => entry.profile.id === "sf_finance")
      const skill = profile?.skills.find((entry) => entry.id === "sf-produzir-bi-contextual")
      if (!profile || !skill || !context.services.analysisInputs) throw new Error("The installed BI mission is unavailable")
      for (const operation of missionOperations) {
        expect(profile.operationIds).toContain(operation)
        expect(profile.profile.allowedOperations).toContain(operation)
        expect(skill.allowedOperations).toContain(operation)
      }
      const domainDigest = await budgetDigest(context)
      const series = await issueBudget(context, "budgetSeries")
      const metric = await issueBudget(context, "budgetMetrics")
      const sources = [series.ref, metric.ref]
      const objective = "Review the selected effective monthly budget and its equivalent BI01 table. Preserve explicit zero, unknown actual/forecast, producer currency and source provenance."
      const created = await draftCase(context, objective, sources)
      const other = await draftCase(context, "A different human case must not adopt the first case's BI artifacts.", sources)
      expect(other.caseRef.id).not.toBe(created.caseRef.id)
      const projection = await readDashboard(context, series.selection)
      assertBudget(projection, series.ref)
      const kpiRequest = { metricRef: dashboardMetricSelector(metric.ref.refId, "total-budget"), period }
      const kpi = await readKpi(context, kpiRequest)
      assertKpi(kpi, metric.ref)
      phase("real-sources-cases-and-budget-returned")

      // C08 provides only the CAS revision here. No private artifact identifier
      // or source value is read from state for the mission objective.
      const saved = await post(context, "bi-artifact-save", { selection: { caseRef: created.caseRef,
        selection: { viewId: "BI01", version: 1, filters: [] }, dashboardSelection: series.selection, period },
        mutation: { expectedStorageVersion: await storageVersion(context, "bi-artifacts"), idempotencyKey: "wp12-public-bi-artifact" } })
      const handles = publicHandles(ok(saved, "bi-artifact-save"))
      expect(handles.projectionRef).not.toBe(handles.tableRef)
      const artifact = await readArtifact(context, handles.projectionRef)
      expect(artifact.projectionRef).toBe(handles.projectionRef)
      expect(artifact.tableRef).toBe(handles.tableRef)
      expect(artifact.caseRef).toEqual(created.caseRef)
      expect(artifact.projection.values).toEqual(projection.values)
      expect(artifact.projectionRefs).toEqual([series.ref])
      expect(artifact.sourceRefs).toEqual([series.ref])
      const selected = await post(context, "bi-selection-set", { caseRef: created.caseRef, ...handles,
        mutation: { expectedStorageVersion: await storageVersion(context, "preferences"), idempotencyKey: "wp12-public-bi-choice" } })
      expect(publicHandles(ok(selected, "bi-selection-set"))).toEqual(handles)
      const choice = await readChoice(context, created.caseRef)
      expect(choice).toEqual({ ...handles, selection: { viewId: "BI01", version: 1, filters: [] } })
      phase("public-artifact-and-durable-human-choice-returned")

      const preferenceVersion = await storageVersion(context, "preferences")
      const outside = await post(context, "bi-selection-set", { caseRef: other.caseRef, ...handles,
        mutation: { expectedStorageVersion: preferenceVersion, idempotencyKey: "wp12-public-bi-other-case" } })
      expect(outside.status).toBe(409)
      expect(outside.body).toMatchObject({ status: "denied", reason: "bi-selection-scope-mismatch" })
      expect(await storageVersion(context, "preferences")).toBe(preferenceVersion)
      expect(await readChoice(context, created.caseRef)).toEqual(choice)
      const absentChoice = await post(context, "bi-selection-read", { caseRef: other.caseRef })
      expect(absentChoice.status).toBe(409)
      expect(absentChoice.body).toMatchObject({ status: "needs-input", reason: "analysis-selection-not-created" })
      const untrusted = await context.services.productHttp?.(new Request(new URL("/sucafina/dashboard?sf=bi-artifact-read", context.origin), {
        method: "POST", headers: { origin: context.origin, "content-type": "application/json" }, body: JSON.stringify({ reference: handles.tableRef }),
      }), "dashboard")
      if (!untrusted) throw new Error("The public artifact read route is absent")
      expect(untrusted.status).toBe(403)

      // These are values returned by authenticated public routes and selected
      // explicitly by the human. No autonomous artifact discovery is asserted.
      const missionObjective = `${objective} A pessoa salvou e escolheu esta projeção e tabela pelas rotas públicas bi-artifact-save e bi-selection-set, e releu a seleção: ${JSON.stringify(choice)}. Use esses identificadores públicos para a proposta do mesmo caso. Leia o caso, sf_dashboard_read, sf_bi_view e sf_source_get; confira o total efetivo com sf_kpi_explain usando a seleção humana adicional ${JSON.stringify(kpiRequest)}. Preserve a moeda unspecified do produtor e mantenha a fonte auxiliar do KPI fora das fontes da proposta BI. Não aplique dados nem crie uma tabela ou referência substituta.`
      const incoming: Preparation = { request: { caseRef: created.caseRef, objective: missionObjective,
        profileId: profile.profile.id, profileVersion: profile.profile.version, skillId: skill.id, skillVersion: skill.version,
        manifestDigest: profile.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: missionOperations },
        selection: { selectionKey: "bi" } }
      const input = await prepare(context, incoming)
      expect(input.businessQuestion).toBe(missionObjective)
      expect(input.dashboardSelection).toEqual(series.selection)
      expect(input.authorizedFilters).toEqual([])
      expect(input.projectionRefs).toEqual([series.ref])
      expect(input.approvedViews).toContainEqual({ id: "BI01", version: 1, allowedFilters: [] })
      const wrongInput = await post(context, "workbench-analysis", { action: "prepare", input: {
        request: { ...incoming.request, caseRef: other.caseRef }, selection: { selectionKey: "bi" } } })
      expect(wrongInput.body.status).not.toBe("ok")
      const restored = await prepare(context, incoming)
      expect(digestSfValue(restored)).toBe(digestSfValue(input))
      await assertPresentation(context, series.selection.selectionRef, artifact.projection)
      expect(digestSfValue((await readCase(context, created.caseRef)).case)).toBe(created.digest)
      expect(digestSfValue((await readCase(context, other.caseRef)).case)).toBe(other.digest)
      expect(await budgetDigest(context)).toBe(domainDigest)
      phase("input-consumers-and-isolation-returned")
      console.log("SF_WP12_BI_PUBLIC_INPUT:" + JSON.stringify({ githubSha: process.env.GITHUB_SHA ?? null,
        scope: "real-public-artifact-save-choice-input-and-ui-consumers", caseRef: created.caseRef, publicChoice: choice,
        artifactDigest: artifact.digest, inputDigest: digestSfValue(input), otherCaseRef: other.caseRef,
        selectionOrigin: "authenticated-human-http", privateIdentifiersSuppliedToModel: false, autonomousDiscovery: false,
        inferenceExecuted: false, gnativeAccepted: false }))
      let witness: Wp12CompletedNativeMission | undefined
      let audit: Awaited<ReturnType<typeof nativeAudit>> | undefined
      if (!context.models.length) observeWp12UnavailableMission(context, { request: incoming.request, skillInput: restored })
      else {
        expectSpawn(import.meta.path)
        witness = await executeWp12NativeMission(context, { request: incoming.request, skillInput: restored, expectedKind: "ContextualBIProposal",
          requiredTools: [{ operation: "sf_case_read" }, { operation: "sf_dashboard_read", handlerExport: "readDashboard" },
            { operation: "sf_bi_view", handlerExport: "readBiView" }, { operation: "sf_kpi_explain", handlerExport: "explainKpi" },
            { operation: "sf_source_get", handlerExport: "resolveSfSource" }] })
        if (witness.output.kind !== "ContextualBIProposal") throw new Error("The native BI output kind changed")
        expect(witness.output.payload).toEqual({ approvedViewId: "BI01", canonicalProjectionRefs: [choice.projectionRef],
          tableRef: choice.tableRef, filters: [], sourceRefs: [series.ref] })
        expect(witness.output.evidenceRefs).toEqual([series.ref])
        audit = await nativeAudit(context, witness, { caseRef: created.caseRef, series, metric, kpiRequest, projection })
        // Consume identifiers actually returned by the native contribution.
        expect((await readArtifact(context, witness.output.payload.tableRef)).digest).toBe(artifact.digest)
        expect((await readArtifact(context, witness.output.payload.canonicalProjectionRefs[0]!)).digest).toBe(artifact.digest)
      }
      expect(digestSfValue((await readCase(context, created.caseRef)).case)).toBe(created.digest)
      expect(await budgetDigest(context)).toBe(domainDigest)
      return { incoming, inputDigest: digestSfValue(input), choice, artifact, series, metric, kpiRequest,
        caseDigest: created.digest, other, domainDigest, witness, audit }
    })
    await open("reopened", async (context) => {
      const caseRef = initial.incoming.request.caseRef
      expect(await readChoice(context, caseRef)).toEqual(initial.choice)
      const artifact = await readArtifact(context, initial.choice.tableRef)
      expect(artifact.digest).toBe(initial.artifact.digest)
      expect(digestSfValue(await prepare(context, initial.incoming))).toBe(initial.inputDigest)
      await assertPresentation(context, initial.series.selection.selectionRef, artifact.projection)
      assertKpi(await readKpi(context, initial.kpiRequest), initial.metric.ref)
      const witness = initial.witness
      if (witness) {
        const consumed = await readWp12NativeMissionAfterReload(context, witness)
        if (consumed.output.kind !== "ContextualBIProposal") throw new Error("The reopened native BI kind changed")
        expect(consumed.html).toContain("Contextual BI")
        expect((await readArtifact(context, consumed.output.payload.tableRef)).digest).toBe(artifact.digest)
        expect(digestSfValue(await nativeAudit(context, witness, { caseRef, series: initial.series,
          metric: initial.metric, kpiRequest: initial.kpiRequest, projection: artifact.projection }))).toBe(digestSfValue(initial.audit))
      }
      expect(digestSfValue((await readCase(context, caseRef)).case)).toBe(initial.caseDigest)
      expect(digestSfValue((await readCase(context, initial.other.caseRef)).case)).toBe(initial.other.digest)
      expect(await budgetDigest(context)).toBe(initial.domainDigest)
      phase("reopened-public-choice-artifact-input-and-consumers-returned")
      console.log("SF_WP12_BI_PUBLIC_REOPEN:" + JSON.stringify({ githubSha: process.env.GITHUB_SHA ?? null,
        scope: "durable-public-human-selection-and-conditional-native-consumer", caseRef, publicChoice: initial.choice,
        artifactDigest: artifact.digest, inputDigest: initial.inputDigest, nativeOutputRef: witness?.output.id ?? null,
        nativeSessionId: witness?.receipt.nativeSessionId ?? null, nativeContributionConsumed: Boolean(witness),
        consumerRefs: ["bi-selection-read", "bi-artifact-read", "bi-data", "bi-source"],
        humanSelectionReopened: true, caseUnchanged: true, domainApplied: false, autonomousDiscovery: false,
        inferenceExecuted: Boolean(witness), gnativeAccepted: false }))

      // A real source change invalidates its public selection and artifacts;
      // no private scope or cached output is substituted after withdrawal.
      await context.persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.opexOwners = []
        snapshot.data.opexEntries = []
        return { commit: true, value: undefined }
      })
      const removed = await post(context, "bi-artifact-read", { reference: initial.choice.tableRef })
      expect(removed.status).toBe(409)
      expect(removed.body.status).not.toBe("ok")
      const removedChoice = await post(context, "bi-selection-read", { caseRef })
      expect(removedChoice.status).toBe(409)
      expect(removedChoice.body.status).not.toBe("ok")
      const removedInput = await post(context, "workbench-analysis", { action: "prepare", input: initial.incoming })
      expect(removedInput.body.status).not.toBe("ok")
      if (witness) expect((await context.human("analysis.read", { runRef: witness.runRef }, (call) =>
        context.services.analyses!.output(call, witness.runRef))).status).not.toBe("ok")
      phase("source-withdrawal-refused")
      console.log("SF_WP12_BI_PUBLIC_WITHDRAWAL:" + JSON.stringify({ githubSha: process.env.GITHUB_SHA ?? null,
        scope: "actual-source-withdrawal", artifactStatus: removed.body.status, choiceStatus: removedChoice.body.status,
        inputStatus: removedInput.body.status, nativeOutputReadRefused: Boolean(witness),
        principalAclRevocationExercised: false, gnativeAccepted: false }))
    })
  })
}, 360_000)

async function post(context: Wp12NativeMissionContext, mode: string, payload: unknown) {
  const response = await context.services.productHttp?.(context.request(payload, `/sucafina/dashboard?sf=${mode}`), "dashboard")
  if (!response) throw new Error(`The actual ${mode} route is missing`)
  return { status: response.status, body: object(await response.json()) }
}
function ok(response: Awaited<ReturnType<typeof post>>, route: string) {
  if (response.status !== 200 || response.body.status !== "ok") throw new Error(`Public ${route} failed: ${String(response.body.reason)}`)
  return response.body.value
}
function publicHandles(raw: unknown) {
  const value = object(raw)
  if (typeof value.projectionRef !== "string" || !value.projectionRef.trim() || typeof value.tableRef !== "string" || !value.tableRef.trim())
    throw new Error("The public producer did not return both artifact handles")
  return { projectionRef: value.projectionRef, tableRef: value.tableRef }
}
async function readChoice(context: Wp12NativeMissionContext, caseRef: CaseRef) {
  const value = object(ok(await post(context, "bi-selection-read", { caseRef }), "bi-selection-read"))
  return { ...publicHandles(value), selection: value.selection }
}
async function readArtifact(context: Wp12NativeMissionContext, reference: string) {
  const value = object(ok(await post(context, "bi-artifact-read", { reference }), "bi-artifact-read"))
  const projection = decodeSfOperationOutput("sf_bi_view", value.projection)
  if (!projection.ok || !Array.isArray(value.rows) || typeof value.projectionDigest !== "string" || typeof value.tableDigest !== "string")
    throw new Error("The public artifact read returned an invalid canonical projection/table")
  expect(value.projectionDigest).toBe(digestSfValue(projection.value))
  expect(value.tableDigest).toBe(digestSfValue({ rows: value.rows, period: value.period, presentation: value.presentation }))
  expect<readonly unknown[]>(value.rows).toEqual(projection.value.values)
  return { ...publicHandles(value), projection: projection.value, tableDigest: value.tableDigest, caseRef: value.caseRef,
    projectionRefs: value.projectionRefs, sourceRefs: value.sourceRefs, digest: digestSfValue(value) }
}
async function storageVersion(context: Wp12NativeMissionContext, namespace: "bi-artifacts" | "preferences") {
  const read = await context.services.state.read(context.request(), namespace, () => null)
  if (read.status !== "ok") throw new Error(`The public ${namespace} CAS revision is unavailable`)
  return read.storageVersion
}
async function prepare(context: Wp12NativeMissionContext, incoming: Preparation) {
  const value = ok(await post(context, "workbench-analysis", { action: "prepare", input: incoming }), "workbench-analysis")
  const decoded = decodeSfSkillInput("ContextualBIInput", value)
  if (!decoded.ok) throw new Error("The actual selected-artifact input failed its canonical schema")
  return decoded.value
}
async function issueBudget(context: Wp12NativeMissionContext, field: "budgetSeries" | "budgetMetrics") {
  const request = { page: "Budget Overview", fields: [field], period }
  const issued = await context.ui("sf_dashboard_read", request, (call) => createDashboardSourceIssuer({ host: context.business.host, scopedSources: context.persistence })(request, call))
  if (issued.status !== "ok") throw new Error(`The selected ${field} source was refused: ${issued.reason}`)
  expect(issued.value.selectionRef).toBe(issued.value.evidence.refId)
  return { ref: issued.value.evidence, selection: { selectionRef: issued.value.selectionRef, fields: [field], period } }
}
async function draftCase(context: Wp12NativeMissionContext, objective: string, sourceRefs: readonly BusinessEvidenceRef[]) {
  const draft = { objective, horizon: period, currency: "USD", criteria: ["Keep the human selection, source currency and missing values explicit"], sourceRefs }
  const result = await context.ui("sf_case_draft", draft, (call) => context.business.cases.draft(draft, call))
  if (result.status !== "ok") throw new Error(`The actual BI case was refused: ${result.reason}`)
  return { caseRef: { id: result.value.id, incarnation: result.value.incarnation, version: result.value.version }, digest: digestSfValue(result.value) }
}
async function readCase(context: Wp12NativeMissionContext, caseRef: CaseRef) {
  const result = await dispatchWp12Ui(context, "sf_case_read", { caseRef: encodeCaseRef(caseRef) })
  if (result.status !== "ok") throw new Error(`The actual BI case cannot be read: ${result.reason}`)
  const decoded = decodeSfOperationOutput("sf_case_read", result.result)
  if (!decoded.ok) throw new Error("The real case result failed its schema")
  return decoded.value
}
async function readDashboard(context: Wp12NativeMissionContext, request: Awaited<ReturnType<typeof issueBudget>>["selection"]) {
  const result = await dispatchWp12Ui(context, "sf_dashboard_read", request)
  if (result.status !== "ok") throw new Error(`The actual budget source was refused: ${result.reason}`)
  const decoded = decodeSfOperationOutput("sf_dashboard_read", result.result)
  if (!decoded.ok) throw new Error("The actual Dashboard result failed its schema")
  return decoded.value
}
async function readKpi(context: Wp12NativeMissionContext, request: { metricRef: string; period: typeof period }) {
  const result = await dispatchWp12Ui(context, "sf_kpi_explain", request)
  if (result.status !== "ok") throw new Error(`The actual KPI source was refused: ${result.reason}`)
  const decoded = decodeSfOperationOutput("sf_kpi_explain", result.result)
  if (!decoded.ok) throw new Error("The actual KPI result failed its schema")
  expect(result.receipt).toMatchObject({ kind: "ui", operation: "sf_kpi_explain", inputDigest: digestSfValue(request), resultDigest: digestSfValue(decoded.value) })
  return decoded.value
}
function assertBudget(projection: DomainProjection, source: BusinessEvidenceRef) {
  expect(projection.context.period).toEqual(period)
  expect(projection.context.currency).toBe("unspecified")
  expect(projection.values.filter((value) => /^budget:2027-\d\d:effective$/.test(value.id)).toSorted((a, b) => a.id.localeCompare(b.id)).map((value) => value.value)).toEqual(amounts)
  expect(projection.values.find((value) => value.id === "budget:2027-01:actual")).toMatchObject({ value: 0, evidenceState: "confirmed" })
  expect(projection.values.find((value) => value.id === "budget:2027-02:actual")).toMatchObject({ value: null, evidenceState: "absent" })
  expect(projection.values.find((value) => value.id === "budget:2027-04:forecast")).toMatchObject({ value: null, evidenceState: "absent" })
  for (const value of projection.values) expect(value.sourceRefs).toEqual([source])
}
function assertKpi(projection: DomainProjection, source: BusinessEvidenceRef) {
  expect(projection.context.currency).toBe("unspecified")
  expect(projection.context.period).toEqual(period)
  expect(projection.values).toHaveLength(1)
  expect(projection.values[0]).toMatchObject({ id: "budgetMetrics.2027.totalBudget", value: 78_000, currency: "unspecified", evidenceState: "estimated" })
  expect(projection.values[0]!.sourceRefs).toEqual([source])
  expect(projection.components.toSorted((a, b) => a.id.localeCompare(b.id)).map((component) => component.amount)).toEqual(amounts)
}
async function budgetDigest(context: Wp12NativeMissionContext) {
  return context.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: digestSfValue({
    opexOwners: snapshot.data.opexOwners, opexEntries: snapshot.data.opexEntries, capexProjects: snapshot.data.capexProjects, capexEntries: snapshot.data.capexEntries }) }))
}
async function assertPresentation(context: Wp12NativeMissionContext, selectionRef: string, projection: DomainProjection) {
  const query = new URLSearchParams({ sf: "bi-data", viewId: "BI01", selectionRef, start: period.start, end: period.end })
  const response = await context.services.productHttp?.(context.request(undefined, `/sucafina/dashboard?${query}`, "GET"), "dashboard")
  if (!response) throw new Error("The real WP05 BI data route is missing")
  const body = object(await response.json()), decoded = decodeSfOperationOutput("sf_bi_view", body.projection)
  expect(response.status).toBe(200)
  expect(object(body.receipt)).toMatchObject({ kind: "ui", operation: "sf_bi_view" })
  if (!decoded.ok) throw new Error("The actual WP05 projection failed its schema")
  expect(decoded.value.values).toEqual(projection.values)
  query.set("sf", "bi-source")
  query.set("valueId", "budget:2027-01:effective")
  const linksResponse = await context.services.productHttp?.(context.request(undefined, `/sucafina/dashboard?${query}`, "GET"), "dashboard")
  if (!linksResponse) throw new Error("The real WP05 source route is missing")
  expect(linksResponse.status).toBe(200)
  const linksBody = object(await linksResponse.json())
  const links = Array.isArray(linksBody.links) ? linksBody.links.map(object) : []
  expect(links.some((link) => typeof link.url === "string" && (link.url.includes("Budget+Overview") || link.url.includes("Budget%20Overview")))).toBe(true)
}
async function nativeAudit(context: Wp12NativeMissionContext, witness: Wp12CompletedNativeMission, expected: {
  caseRef: CaseRef; series: Awaited<ReturnType<typeof issueBudget>>; metric: Awaited<ReturnType<typeof issueBudget>>;
  kpiRequest: { metricRef: string; period: typeof period }; projection: DomainProjection
}) {
  const messages = await Effect.runPromise(context.session.messages({ sessionID: SessionSchema.ID.make(witness.receipt.nativeSessionId), order: "asc" }))
  const calls = messages.flatMap((message) => message.type !== "assistant" || !message.time.completed || message.error ? [] : message.content.flatMap((part) => {
    if (part.type !== "tool" || part.state.status !== "completed" || !witness.tools.some((tool) => tool.operation === part.name && tool.toolCallId === part.id)) return []
    const receipt = object(part.state.structured.receipt)
    expect(receipt).toMatchObject({ kind: "native", operation: part.name, runId: witness.runRef, nativeSessionId: witness.receipt.nativeSessionId,
      principalRef: context.principalRef, callId: part.id, resultDigest: digestSfValue(part.state.structured.result) })
    return [{ operation: part.name, callId: part.id, messageId: message.id, receipt, result: part.state.structured.result }]
  }))
  const exact = (operation: string, payload: unknown) => {
    const call = calls.find((value) => value.operation === operation && value.receipt.inputDigest === digestSfValue(payload))
    if (!call) throw new Error(`The native ${operation} did not use the exact public human selection`)
    return call
  }
  const caseCall = exact("sf_case_read", { caseRef: encodeCaseRef(expected.caseRef) })
  const current = decodeSfOperationOutput("sf_case_read", caseCall.result)
  if (!current.ok) throw new Error("The native case read failed its schema")
  expect(digestSfValue(current.value.case.sourceRefs)).toBe(digestSfValue([expected.series.ref, expected.metric.ref]))
  const dashboard = exact("sf_dashboard_read", expected.series.selection)
  const dashboardResult = decodeSfOperationOutput("sf_dashboard_read", dashboard.result)
  if (!dashboardResult.ok) throw new Error("The native Dashboard read failed its schema")
  assertBudget(dashboardResult.value, expected.series.ref)
  const bi = exact("sf_bi_view", { viewId: "BI01", selectionRef: expected.series.selection.selectionRef, period })
  const biResult = decodeSfOperationOutput("sf_bi_view", bi.result)
  if (!biResult.ok) throw new Error("The native BI read failed its schema")
  expect(biResult.value.values).toEqual(expected.projection.values)
  const kpi = exact("sf_kpi_explain", expected.kpiRequest)
  const kpiResult = decodeSfOperationOutput("sf_kpi_explain", kpi.result)
  if (!kpiResult.ok) throw new Error("The native KPI read failed its schema")
  assertKpi(kpiResult.value, expected.metric.ref)
  const sources = [expected.series.ref, expected.metric.ref].map((reference) => {
    const call = exact("sf_source_get", { evidenceRef: reference })
    const result = decodeSfOperationOutput("sf_source_get", call.result)
    if (!result.ok) throw new Error("The native source read failed its schema")
    expect(result.value.state).toBe("fresh")
    expect(digestSfValue(result.value.ref)).toBe(digestSfValue(reference))
    expect(digestSfValue(result.value.currentRef)).toBe(digestSfValue(reference))
    return { callId: call.callId, receipt: call.receipt, resultDigest: digestSfValue(result.value) }
  })
  return { caseCallId: caseCall.callId, dashboardCallId: dashboard.callId, biCallId: bi.callId,
    kpiCallId: kpi.callId, kpiReceipt: kpi.receipt, kpiResult: kpiResult.value, sources }
}
