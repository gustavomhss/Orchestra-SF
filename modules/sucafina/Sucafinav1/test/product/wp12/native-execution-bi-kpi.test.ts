import { expect, test } from "bun:test"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { DashboardReadRequest, KpiExplainRequest } from "../../../product/contracts/operations.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import type { SfBiArtifact } from "../../../product/contracts/state.ts"
import { dashboardMetricSelector } from "../../../product/dashboard/sources.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { object } from "../../../runtime/contract.ts"
import { dispatchWp12Ui, executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12CompletedNativeMission, Wp12NativeMissionContext } from "./native-mission-harness.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const effectiveAmounts = [1_000, 2_000, 3_000, 4_000, 5_000, 6_000, 7_000, 8_000, 9_000, 10_000, 11_000, 12_000]
const annualBudget = 78_000
const firstEffectiveId = "budget:2027-01:effective"
const zeroActualId = "budget:2027-01:actual"
const absentActualId = "budget:2027-02:actual"
const absentForecastId = "budget:2027-04:forecast"
const requiredOperations = ["sf_bi_view", "sf_kpi_explain", "sf_source_get", "sf_dashboard_read"]
const missionOperations = ["sf_case_read", ...requiredOperations]

test("native contextual BI01 discovers its auxiliary KPI source through the real case and preserves separate chart and tool provenance after reload", async () => {
  const startedAt = Date.now()
  const phase = (name: string) => console.log("SF_WP12_NATIVE_BI_KPI_PHASE:" + JSON.stringify({ phase: name, elapsedMs: Date.now() - startedAt }))
  await withWp12NativeMissionHost({ label: "contextual-bi-kpi", operations: ["sf_case_draft", "sf_context_get", ...missionOperations],
    namespaces: ["cases", "preferences", "contributions", "bi-artifacts", "atlas", "receipts", "outbox"],
    initialize: async (persistence) => {
      // Only explicit raw business records are supplied. Both source scopes,
      // projections, cases, BI artifacts and all receipts come from real ports.
      await persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.opexOwners = [{ id: "wp12-bi-kpi-owner", name: "Synthetic selected budget owner", budget: 120_000 }]
        snapshot.data.opexEntries = effectiveAmounts.map((budget, index) => ({ id: `wp12-bi-kpi-entry-${index + 1}`,
          ownerId: "wp12-bi-kpi-owner", year: 2027, month: index + 1, budget,
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
      const selected = context.services.selected.find((entry) => entry.profile.id === "sf_finance")
      const skill = selected?.skills.find((entry) => entry.id === "sf-produzir-bi-contextual")
      if (!selected || !skill || !context.services.analysisInputs || !context.services.productHttp) throw new Error("The real BI01/KPI mission is not composed")
      expect(selected.profile.allowedSkills).toContain(skill.id)
      expect(skill.allowedProfiles).toContain(selected.profile.id)
      for (const operation of missionOperations) {
        expect(selected.profile.allowedOperations).toContain(operation)
        expect(skill.allowedOperations).toContain(operation)
        expect(selected.operationIds).toContain(operation)
      }
      const domainDigest = await budgetDataDigest(context)
      const series = await issueSelection(context, "budgetSeries")
      const metric = await issueSelection(context, "budgetMetrics")
      expect(series.ref.refId).not.toBe(metric.ref.refId)
      expect(series.ref.target.fields).toEqual(["budgetSeries"])
      expect(metric.ref.target.fields).toEqual(["budgetMetrics"])
      expect(series.ref.target.period).toEqual(metric.ref.target.period)
      const seriesRead = await context.ui("sf_dashboard_read", series.selection, (call) => context.business.dashboard.read(series.selection, call))
      if (seriesRead.status !== "ok") throw new Error(`The actual BI01 series was refused: ${seriesRead.reason}`)
      expectSeries(seriesRead.value, series.ref)
      phase("sources-and-series-returned")

      const objective = "Mostre o orçamento efetivo mensal do recorte selecionado em BI01 e sua tabela equivalente. Leia o caso atual por sf_case_read e descubra a referência autorizada Budget Overview com fields budgetMetrics para conferir o total anual por sf_kpi_explain. O seletor público de métrica é dashboard-metric:<encodeURIComponent(refId)>:total-budget, qualificado apenas a partir dessa referência lida do caso. Use sf_dashboard_read, sf_bi_view e sf_source_get para verificar as fontes e o período. Confira a coerência do total com a série sem recalcular ou substituir o produtor, preserve zeros observados e ausências de actual/forecast, e mantenha a moeda informada pelo produtor. Produza ContextualBIProposal com a fonte da série BI; a conferência auxiliar do KPI permanece no resultado e recibo da ferramenta, sem acrescentar campos ao contrato."
      const draft = { objective, horizon: period, currency: "USD", criteria: [
        "Preserve the producer period, non-uniform monthly effective values and distinct unknown measurements",
        "The case currency is an explicit human choice; do not relabel the Dashboard unspecified currency or invent FX",
      ], sourceRefs: [series.ref, metric.ref] }
      const created = await context.ui("sf_case_draft", draft, (call) => context.business.cases.draft(draft, call))
      if (created.status !== "ok") throw new Error(`The actual two-source BI case was refused: ${created.reason}`)
      const caseRef = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
      const caseDigest = digestSfValue(created.value)
      const current = await readCase(context, caseRef)
      expect(refSet(current.case.sourceRefs)).toBe(refSet([series.ref, metric.ref]))
      // The second public ref is discovered from the real case projection, not
      // reconstructed from storage or injected as an opaque ID into the prompt.
      const discovered = current.case.sourceRefs.find((ref) => ref.kind === "record" && ref.target.surface === "dashboard" &&
        ref.target.recordType === "dashboard-page" && ref.target.recordId === "Budget Overview" &&
        digestSfValue(ref.target.fields) === digestSfValue(["budgetMetrics"]) && digestSfValue(ref.target.period) === digestSfValue(period))
      if (!discovered) throw new Error("The real case did not expose the selected KPI source")
      expect(digestSfValue(discovered)).toBe(digestSfValue(metric.ref))
      const kpiRequest = { metricRef: dashboardMetricSelector(discovered.refId, "total-budget"), period }
      const kpi = await readUiKpi(context, kpiRequest)
      expectKpi(kpi.projection, metric.ref, seriesRead.value)
      for (const reference of [series.ref, metric.ref]) await expectSource(context, reference)
      // A formatter conveys no authority: a source for budgetSeries cannot be
      // used as budgetMetrics, and its exact authorized period cannot be changed.
      for (const invalid of [
        { metricRef: dashboardMetricSelector(series.ref.refId, "total-budget"), period },
        { ...kpiRequest, period: { start: "2026-01-01", end: "2026-12-31" } },
      ]) {
        const refused = await dispatchWp12Ui(context, "sf_kpi_explain", invalid)
        expect(refused.status).not.toBe("ok")
        if (refused.status === "ok") throw new Error("An incompatible KPI selection was accepted")
        expect(refused.reason).toBe("source-unavailable")
      }
      phase("case-kpi-and-scope-negatives-returned")
      const incoming = { request: { caseRef, objective, profileId: selected.profile.id, profileVersion: selected.profile.version,
        skillId: skill.id, skillVersion: skill.version, manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1",
        requestedOperationScope: missionOperations },
        selection: { viewId: "BI01", version: 1, filters: [{ field: "period", values: [period.start, period.end] }], dashboardSelection: series.selection } }
      const response = await context.services.productHttp(context.request({ action: "prepare", input: incoming }, "/sucafina/dashboard?sf=workbench-analysis"), "dashboard")
      if (!response) throw new Error("The actual BI01 input HTTP route is missing")
      const body = object(await response.json())
      if (response.status !== 200 || body.status !== "ok") throw new Error(`The actual BI01 input producer failed: ${String(body.reason)}`)
      const input = decodeSfSkillInput("ContextualBIInput", body.value)
      if (!input.ok) throw new Error("The actual BI01 input failed its canonical schema")
      expect(input.value.dashboardSelection).toEqual(series.selection)
      expect(refSet(input.value.projectionRefs)).toBe(refSet([series.ref]))
      expect(input.value.approvedViews).toContainEqual({ id: "BI01", version: 1, allowedFilters: ["period"] })
      phase("bi-input-returned")
      const artifact = await readProducedArtifact(context, caseRef)
      expectArtifact(artifact, series.ref, seriesRead.value)
      const presentation = await readPresentation(context, series.selection.selectionRef)
      expect(presentation.values).toEqual(artifact.projection.values)
      expectSeries(presentation, series.ref)
      expect((await readSourceLinks(context, series.selection.selectionRef)).length).toBeGreaterThan(0)
      expect(digestSfValue((await readCase(context, caseRef)).case)).toBe(caseDigest)
      expect(await budgetDataDigest(context)).toBe(domainDigest)
      phase("initial-wp05-consumers-returned")
      console.log("SF_WP12_NATIVE_BI_KPI_INPUT:" + JSON.stringify({ scope: "real-two-source-budget-input-wp05-and-ui-kpi", githubSha: process.env.GITHUB_SHA ?? null,
        profileId: selected.profile.id, skillId: skill.id, caseRef, inputDigest: digestSfValue(input.value),
        seriesSource: series.ref, auxiliaryKpiSource: metric.ref, uiKpiReceipt: kpi.receipt,
        effectiveAmounts, annualBudget, actualZero: zeroActualId, actualAbsent: absentActualId, forecastAbsent: absentForecastId,
        producerCurrency: kpi.projection.context.currency, caseCurrency: created.value.currency,
        projectionRef: artifact.projectionRef, tableRef: artifact.tableRef, tableDigest: artifact.tableDigest,
        privateArtifactIdsSuppliedToModel: false, auxiliaryKpiConsumedByWp05: false, inferenceExecuted: false, gnativeAccepted: false }))
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: input.value })
        return { incoming, inputDigest: digestSfValue(input.value), series, metric, kpiRequest, artifact, caseDigest, domainDigest, witness: undefined, nativeAudit: undefined }
      }
      expectSpawn(import.meta.path)
      const witness = await executeWp12NativeMission(context, { request: incoming.request, skillInput: input.value, expectedKind: "ContextualBIProposal",
        requiredTools: [{ operation: "sf_case_read" }, { operation: "sf_dashboard_read", handlerExport: "readDashboard" },
          { operation: "sf_bi_view", handlerExport: "readBiView" }, { operation: "sf_source_get", handlerExport: "resolveSfSource" },
          { operation: "sf_kpi_explain", handlerExport: "explainKpi" }] })
      if (witness.output.kind !== "ContextualBIProposal") throw new Error("The actual native BI01 output kind changed")
      expect(witness.output.payload).toEqual({ approvedViewId: "BI01", canonicalProjectionRefs: [artifact.projectionRef], filters: incoming.selection.filters,
        tableRef: artifact.tableRef, sourceRefs: [series.ref] })
      expect(refSet(witness.output.evidenceRefs)).toBe(refSet([series.ref]))
      const nativeAudit = await readNativeAudit(context, witness, { caseRef, series, metric, kpiRequest, projection: artifact.projection })
      expect(digestSfValue((await readCase(context, caseRef)).case)).toBe(caseDigest)
      expect(await budgetDataDigest(context)).toBe(domainDigest)
      phase("native-session-audit-returned")
      return { incoming, inputDigest: digestSfValue(input.value), series, metric, kpiRequest, artifact, caseDigest, domainDigest, witness, nativeAudit }
    })
    await open("reopened", async (context) => {
      const restored = await context.human("analysis.prepare", initial.incoming, (call) => context.services.analysisInputs!.prepare(call, initial.incoming))
      if (restored.status !== "ok") throw new Error(`The actual BI01 input could not be reopened: ${restored.reason}`)
      expect(digestSfValue(restored.value)).toBe(initial.inputDigest)
      phase("reopened-input-returned")
      const artifact = await readProducedArtifact(context, initial.incoming.request.caseRef)
      expect(digestSfValue(artifact)).toBe(digestSfValue(initial.artifact))
      const presentation = await readPresentation(context, initial.series.selection.selectionRef)
      expect(presentation.values).toEqual(artifact.projection.values)
      expectSeries(presentation, initial.series.ref)
      expect((await readSourceLinks(context, initial.series.selection.selectionRef)).length).toBeGreaterThan(0)
      const kpi = await readUiKpi(context, initial.kpiRequest)
      expectKpi(kpi.projection, initial.metric.ref, presentation)
      for (const reference of [initial.series.ref, initial.metric.ref]) await expectSource(context, reference)
      expect(digestSfValue((await readCase(context, initial.incoming.request.caseRef)).case)).toBe(initial.caseDigest)
      expect(await budgetDataDigest(context)).toBe(initial.domainDigest)
      phase("reopened-wp05-and-ui-kpi-returned")
      if (initial.witness) {
        const consumed = await readWp12NativeMissionAfterReload(context, initial.witness)
        expect(consumed.output.kind).toBe("ContextualBIProposal")
        expect(refSet(consumed.output.evidenceRefs)).toBe(refSet([initial.series.ref]))
        const audit = await readNativeAudit(context, initial.witness, { caseRef: initial.incoming.request.caseRef,
          series: initial.series, metric: initial.metric, kpiRequest: initial.kpiRequest, projection: artifact.projection })
        expect(digestSfValue(audit)).toBe(digestSfValue(initial.nativeAudit))
        phase("reopened-native-session-audit-returned")
      }
      const observedOperations = [...new Set(initial.witness?.tools.map((tool) => tool.operation) ?? [])]
      const missingRequiredOperations = requiredOperations.filter((operation) => !observedOperations.includes(operation))
      console.log("SF_WP12_NATIVE_BI_KPI_REOPEN:" + JSON.stringify({ scope: "real-bi01-wp05-consumer-and-separate-session-kpi-evidence", githubSha: process.env.GITHUB_SHA ?? null,
        profileId: "sf_finance", skillId: "sf-produzir-bi-contextual", tableRef: artifact.tableRef, tableDigest: artifact.tableDigest,
        requiredOperations, observedOperations, missingRequiredOperations, normativeSkillWitnessComplete: missingRequiredOperations.length === 0,
        chartConsumer: "WP05 bi-data/bi-source", auxiliaryKpiConsumer: initial.witness ? "actual model tool result and durable Session receipt" : "authenticated UI dispatcher only",
        auxiliaryKpiConsumedByWp05: false, nativeContributionConsumed: Boolean(initial.witness),
        nativeAudit: initial.nativeAudit ?? null, gnativeAccepted: false, independentGnativeReview: false }))
    })
  })
}, 360_000)

async function issueSelection(context: Wp12NativeMissionContext, field: "budgetSeries" | "budgetMetrics") {
  const request = { page: "Budget Overview", fields: [field], period }
  const issued = await context.ui("sf_dashboard_read", request, (call) => createDashboardSourceIssuer({ host: context.business.host, scopedSources: context.persistence })(request, call))
  if (issued.status !== "ok") throw new Error(`The actual ${field} source was refused: ${issued.reason}`)
  expect(issued.value.selectionRef).toBe(issued.value.evidence.refId)
  return { ref: issued.value.evidence, selection: { selectionRef: issued.value.selectionRef, fields: request.fields, period } }
}

function refSet(refs: readonly BusinessEvidenceRef[]) { return digestSfValue(refs.map((ref) => digestSfValue(ref)).sort()) }

function sumObserved(values: readonly unknown[]) {
  return values.reduce<number>((sum, value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("An absent or non-numeric producer value cannot be summed as zero")
    return sum + value
  }, 0)
}

function expectSeries(projection: DomainProjection, reference: BusinessEvidenceRef) {
  const values = projection.values.filter((value) => /^budget:2027-\d\d:effective$/.test(value.id)).toSorted((a, b) => a.id.localeCompare(b.id))
  expect(values.map((value) => value.value)).toEqual(effectiveAmounts)
  expect(sumObserved(values.map((value) => value.value))).toBe(annualBudget)
  expect(projection.context.currency).toBe("unspecified")
  expect(projection.context.period).toEqual(period)
  expect(new Set(projection.values.map((value) => value.id)).size).toBe(projection.values.length)
  expect(projection.values.find((value) => value.id === zeroActualId)).toMatchObject({ value: 0, evidenceState: "confirmed", currency: "unspecified" })
  expect(projection.values.find((value) => value.id === absentActualId)).toMatchObject({ value: null, evidenceState: "absent" })
  expect(projection.values.find((value) => value.id === absentForecastId)).toMatchObject({ value: null, evidenceState: "absent" })
  expect(projection.missing).toContainEqual({ field: absentActualId, reason: "missing" })
  expect(projection.missing).toContainEqual({ field: absentForecastId, reason: "missing" })
  for (const value of projection.values) expect(refSet(value.sourceRefs)).toBe(refSet([reference]))
  for (const value of values) expect(value.evidenceState).toBe("estimated")
}

function expectKpi(projection: DomainProjection, reference: BusinessEvidenceRef, series: DomainProjection) {
  expect(projection.context.period).toEqual(period)
  expect(projection.context.currency).toBe("unspecified")
  expect(projection.context.capabilities).toEqual(["sf_kpi_explain"])
  expect(projection.values).toHaveLength(1)
  expect(projection.values[0]).toMatchObject({ id: "budgetMetrics.2027.totalBudget", value: annualBudget, currency: "unspecified", granularity: "year", evidenceState: "estimated", period })
  expect(refSet(projection.values[0]!.sourceRefs)).toBe(refSet([reference]))
  expect(projection.components.toSorted((a, b) => a.id.localeCompare(b.id)).map((component) => component.amount)).toEqual(effectiveAmounts)
  expect(projection.components.map(({ id, amount, currency, period }) => ({ id, amount, currency, period }))).toEqual(series.components.map(({ id, amount, currency, period }) => ({ id, amount, currency, period })))
  expect(projection.missing).toContainEqual({ field: "budgetMetrics.2027.totalActual", reason: "missing" })
  expect(projection.missing).toContainEqual({ field: "budgetMetrics.2027.totalForecast", reason: "missing" })
  expect(projection.values[0]!.value).toBe(sumObserved(series.components.map((component) => component.amount)))
}

async function readUiKpi(context: Wp12NativeMissionContext, request: KpiExplainRequest) {
  const dispatched = await dispatchWp12Ui(context, "sf_kpi_explain", request)
  if (dispatched.status !== "ok") throw new Error(`The mounted KPI dispatcher refused the actual metric: ${dispatched.reason}`)
  const decoded = decodeSfOperationOutput("sf_kpi_explain", dispatched.result)
  if (!decoded.ok) throw new Error("The actual KPI result failed its canonical schema")
  expect(dispatched.receipt).toMatchObject({ kind: "ui", operation: "sf_kpi_explain", handlerExport: "explainKpi", principalRef: context.principalRef,
    inputDigest: digestSfValue(request), resultDigest: digestSfValue(decoded.value) })
  return { projection: decoded.value, receipt: dispatched.receipt }
}

async function expectSource(context: Wp12NativeMissionContext, reference: BusinessEvidenceRef) {
  const read = await dispatchWp12Ui(context, "sf_source_get", { evidenceRef: reference })
  if (read.status !== "ok") throw new Error(`The actual BI/KPI source was refused: ${read.reason}`)
  const decoded = decodeSfOperationOutput("sf_source_get", read.result)
  if (!decoded.ok) throw new Error("The actual BI/KPI source result failed its schema")
  expect(decoded.value.state).toBe("fresh")
  expect(digestSfValue(decoded.value.ref)).toBe(digestSfValue(reference))
  expect(digestSfValue(decoded.value.currentRef)).toBe(digestSfValue(reference))
}

async function readCase(context: Wp12NativeMissionContext, caseRef: SfBiArtifact["caseRef"]) {
  const result = await dispatchWp12Ui(context, "sf_case_read", { caseRef: encodeCaseRef(caseRef) })
  if (result.status !== "ok") throw new Error(`The actual BI/KPI case was refused: ${result.reason}`)
  const decoded = decodeSfOperationOutput("sf_case_read", result.result)
  if (!decoded.ok) throw new Error("The actual BI/KPI case result failed its schema")
  return decoded.value
}

async function budgetDataDigest(context: Wp12NativeMissionContext) {
  return context.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: digestSfValue({
    opexOwners: snapshot.data.opexOwners, opexEntries: snapshot.data.opexEntries,
    capexProjects: snapshot.data.capexProjects, capexEntries: snapshot.data.capexEntries }) }))
}

async function readProducedArtifact(context: Wp12NativeMissionContext, caseRef: SfBiArtifact["caseRef"]) {
  // Read-only assertion, never a source of identifiers supplied to the model.
  const stored = await context.services.state.read(context.request(), "bi-artifacts", (state, authority) => authority.principalRef === context.principalRef
    ? Object.values(state.biArtifacts ?? {}).filter((artifact) => digestSfValue(artifact.caseRef) === digestSfValue(caseRef)) : [])
  if (stored.status !== "ok" || stored.value.length !== 1) throw new Error("The real BI01 producer did not persist exactly one artifact")
  return stored.value[0]!
}

function expectArtifact(artifact: SfBiArtifact, reference: BusinessEvidenceRef, projection: DomainProjection) {
  expect(artifact.projectionDigest).toBe(digestSfValue(artifact.projection))
  expect(artifact.tableDigest).toBe(digestSfValue({ rows: artifact.rows, period: artifact.period, presentation: artifact.presentation }))
  expect(artifact.projection.values).toEqual(projection.values)
  expect(artifact.rows).toEqual(projection.values)
  expect(refSet(artifact.projectionRefs)).toBe(refSet([reference]))
  expect(refSet(artifact.sourceRefs)).toBe(refSet([reference]))
  expectSeries(artifact.projection, reference)
}

async function readPresentation(context: Wp12NativeMissionContext, selectionRef: string) {
  const query = new URLSearchParams({ sf: "bi-data", viewId: "BI01", selectionRef, start: period.start, end: period.end })
  const response = await context.services.productHttp?.(context.request(undefined, `/sucafina/dashboard?${query}`, "GET"), "dashboard")
  if (!response) throw new Error("The actual WP05 BI01 consumer is not mounted")
  const body = object(await response.json())
  expect(response.status).toBe(200)
  expect(object(body.receipt)).toMatchObject({ kind: "ui", operation: "sf_bi_view" })
  expect(object(body.presentation).viewId).toBe("BI01")
  const decoded = decodeSfOperationOutput("sf_bi_view", body.projection)
  if (!decoded.ok) throw new Error(`The actual WP05 BI01 projection failed: ${String(body.reason)}`)
  return decoded.value
}

async function readSourceLinks(context: Wp12NativeMissionContext, selectionRef: string) {
  const query = new URLSearchParams({ sf: "bi-source", viewId: "BI01", selectionRef, valueId: firstEffectiveId, start: period.start, end: period.end })
  const response = await context.services.productHttp?.(context.request(undefined, `/sucafina/dashboard?${query}`, "GET"), "dashboard")
  if (!response) throw new Error("The actual WP05 BI01 source consumer is not mounted")
  const body = object(await response.json())
  expect(response.status).toBe(200)
  const links = Array.isArray(body.links) ? body.links.map(object) : []
  expect(links.some((entry) => String(entry.url).includes("Budget+Overview") || String(entry.url).includes("Budget%20Overview"))).toBe(true)
  return links
}

async function readNativeAudit(context: Wp12NativeMissionContext, completed: Wp12CompletedNativeMission, expected: {
  caseRef: SfBiArtifact["caseRef"]
  series: { ref: BusinessEvidenceRef; selection: DashboardReadRequest }
  metric: { ref: BusinessEvidenceRef; selection: DashboardReadRequest }
  kpiRequest: KpiExplainRequest
  projection: DomainProjection
}) {
  const messages = await Effect.runPromise(context.session.messages({ sessionID: SessionSchema.ID.make(completed.receipt.nativeSessionId), order: "asc" }))
  const calls = messages.flatMap((message, messageIndex) => message.type !== "assistant" || !message.time.completed || message.error ? [] : message.content.flatMap((part) => {
    if (part.type !== "tool" || part.state.status !== "completed" || !completed.tools.some((tool) => tool.operation === part.name && tool.toolCallId === part.id)) return []
    const receipt = object(part.state.structured.receipt)
    expect(receipt).toMatchObject({ kind: "native", operation: part.name, runId: completed.runRef, nativeSessionId: completed.receipt.nativeSessionId,
      principalRef: context.principalRef, callId: part.id, resultDigest: digestSfValue(part.state.structured.result) })
    return [{ operation: part.name, callId: part.id, messageId: message.id, messageIndex, receipt, result: part.state.structured.result }]
  }))
  const exact = (operation: string, payload: unknown) => {
    const call = calls.find((candidate) => candidate.operation === operation && candidate.receipt.inputDigest === digestSfValue(payload))
    if (!call) throw new Error(`No real native ${operation} call used the exact authorized selection`)
    return call
  }
  const caseCall = exact("sf_case_read", { caseRef: encodeCaseRef(expected.caseRef) })
  const current = decodeSfOperationOutput("sf_case_read", caseCall.result)
  if (!current.ok) throw new Error("The native case discovery result failed its schema")
  expect(refSet(current.value.case.sourceRefs)).toBe(refSet([expected.series.ref, expected.metric.ref]))
  const dashboardCall = exact("sf_dashboard_read", expected.series.selection)
  const dashboard = decodeSfOperationOutput("sf_dashboard_read", dashboardCall.result)
  if (!dashboard.ok) throw new Error("The native Dashboard result failed its schema")
  expectSeries(dashboard.value, expected.series.ref)
  const biCall = exact("sf_bi_view", { viewId: "BI01", selectionRef: expected.series.selection.selectionRef, period })
  const bi = decodeSfOperationOutput("sf_bi_view", biCall.result)
  if (!bi.ok) throw new Error("The native BI view result failed its schema")
  expect(bi.value.values).toEqual(expected.projection.values)
  const kpiCall = exact("sf_kpi_explain", expected.kpiRequest)
  // Calls within one assistant message may run in parallel. Discovery must
  // return in an earlier message before the model requests the qualified KPI.
  expect(caseCall.messageIndex).toBeLessThan(kpiCall.messageIndex)
  const kpi = decodeSfOperationOutput("sf_kpi_explain", kpiCall.result)
  if (!kpi.ok) throw new Error("The native KPI result failed its schema")
  expectKpi(kpi.value, expected.metric.ref, bi.value)
  const sourceCalls = [expected.series.ref, expected.metric.ref].map((reference) => {
    const call = exact("sf_source_get", { evidenceRef: reference })
    const source = decodeSfOperationOutput("sf_source_get", call.result)
    if (!source.ok) throw new Error("The native source result failed its schema")
    expect(source.value.state).toBe("fresh")
    expect(digestSfValue(source.value.ref)).toBe(digestSfValue(reference))
    expect(digestSfValue(source.value.currentRef)).toBe(digestSfValue(reference))
    return { callId: call.callId, receipt: call.receipt, source: source.value.ref }
  })
  return { caseCallId: caseCall.callId, caseMessageId: caseCall.messageId, dashboardCallId: dashboardCall.callId, biCallId: biCall.callId,
    kpi: { callId: kpiCall.callId, messageId: kpiCall.messageId, receipt: kpiCall.receipt, result: kpi.value }, sourceCalls,
    proposalSources: completed.output.evidenceRefs, auxiliarySource: expected.metric.ref, auxiliaryKpiConsumedByWp05: false }
}
