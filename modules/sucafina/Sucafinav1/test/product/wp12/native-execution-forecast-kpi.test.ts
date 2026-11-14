import { expect, test } from "bun:test"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { withoutObservationTimes } from "../../../../../../apps/cli/src/sucafina-product/analysis-verifier.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { BusinessContextRequest, ForecastCompareRequest, KpiExplainRequest } from "../../../product/contracts/operations.ts"
import type { FinancialAnalysis } from "../../../product/contracts/ports.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { dashboardMetricSelector } from "../../../product/dashboard/sources.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { object } from "../../../runtime/contract.ts"
import { dispatchWp12Ui, executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload,
  withWp12NativeMissionHost, type Wp12CompletedNativeMission, type Wp12NativeMissionContext } from "./native-mission-harness.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const ownerId = "wp12-forecast-kpi-owner"
const lineId = "wp12-forecast-kpi-service"
const annual = (first = 50_000) => [first, ...Array<number>(10).fill(50_000), 40_000]
const nativeOperations = ["sf_context_get", "sf_kpi_explain", "sf_forecast_compare", "sf_source_get"] as const
const normativeRequired = ["sf_forecast_compare", "sf_kpi_explain", "sf_source_get", "sf_import_preview"]
const purpose = "Conferir a natureza e a base de unidade do indicador orçamentário selecionado pela pessoa antes de distingui-lo da mudança contra o forecast de referência."

test("native Finance checks a human-selected budget KPI without replacing forecast delta or inventing comparable currency", async () => {
  const startedAt = Date.now()
  const phase = (name: string) => console.log("SF_WP12_FORECAST_KPI_PHASE:" + JSON.stringify({ phase: name, elapsedMs: Date.now() - startedAt }))
  await withWp12NativeMissionHost({ label: "forecast-auxiliary-kpi",
    operations: ["sf_case_draft", "sf_case_read", "sf_dashboard_read", ...nativeOperations],
    initialize: async (persistence) => {
      // These are explicit raw business inputs. The two producers remain
      // distinct: coincident numbers do not establish a shared currency/FX or
      // a producer-owned financial relation between Dashboard and Planner.
      await persistence.transaction("planner", async (snapshot) => {
        snapshot.data = { versions: [annual(), annual(56_000)].map((amounts, index) => ({
          id: `wp12-forecast-kpi-${index}`, name: `Human-selected forecast ${index}`, year: 2027, closed: 0,
          lines: [{ id: lineId, name: "Selected operating service", ownerId, sec: "opex", el: "licenses", cur: "USD",
            b: Array<number>(12).fill(50_000), a: Array<null>(12).fill(null), f: [...amounts] }],
          fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })),
          officials: { "2027": "wp12-forecast-kpi-0" }, entities: [], allocations: [], roster: [] }
        return { commit: true, value: undefined }
      })
      await persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.opexOwners = [{ id: ownerId, name: "Human-selected budget scope", budget: 600_000 }]
        snapshot.data.opexEntries = Array.from({ length: 12 }, (_, index) => ({ id: `wp12-forecast-kpi-budget-${index + 1}`,
          ownerId, year: 2027, month: index + 1, budget: 50_000, ...(index === 0 ? { actual: 0 } : {}) }))
        snapshot.data.capexProjects = []
        snapshot.data.capexEntries = []
        return { commit: true, value: undefined }
      })
    },
  }, async ({ open }) => {
    const initial = await open("initial", async (context) => {
      const selected = context.services.selected.find((entry) => entry.profile.id === "sf_finance")
      const skill = selected?.skills.find((entry) => entry.id === "sf-explicar-forecast")
      if (!selected || !skill || !context.services.productHttp || !context.services.analysisInputs) throw new Error("The installed Finance/forecast input path is incomplete")
      expect(selected.profile.allowedSkills).toContain(skill.id)
      expect(skill.allowedProfiles).toContain(selected.profile.id)
      for (const operation of nativeOperations) {
        expect(selected.profile.allowedOperations).toContain(operation)
        expect(skill.allowedOperations).toContain(operation)
        expect(selected.operationIds).toContain(operation)
      }
      const before = await domainDigests(context)
      const metric = await issueMetric(context)
      const sources = await context.ui("sf_forecast_compare", { purpose: "issue-human-selected-forecast-sources" }, async (call) => {
        const base = await context.business.plannerProduct.issueSource("wp12-forecast-kpi-0", call)
        const candidate = await context.business.plannerProduct.issueSource("wp12-forecast-kpi-1", call)
        if (base.status !== "ok" || candidate.status !== "ok") throw new Error("Actual Planner forecast source issuance failed")
        return { base: base.value.evidence, candidate: candidate.value.evidence }
      })
      // The auxiliary reference is selected by the human before drafting the
      // case. It is a public source selector, not a private result/table handle.
      const objective = `Explique a mudança contra a base dos forecasts selecionados. A pessoa também escolheu explicitamente o indicador de orçamento Budget Overview da seleção pública ${metric.ref.refId}, no mesmo período, para conferir se ele é uma medida comparável ou uma grandeza distinta. Leia essa seleção por sf_context_get com purpose ${JSON.stringify(purpose)} e period do caso; qualifique total-budget por dashboard-metric:<encodeURIComponent(refId)>:total-budget e use sf_kpi_explain. Verifique as três fontes por sf_source_get e os forecasts por sf_forecast_compare. Preserve moeda, unidade e limites de cada produtor; não infira relação financeira, FX, margem ou causa entre fontes apenas porque pertencem ao caso ou têm números parecidos. FinancialAnalysis deve conservar exatamente o replay e as duas referências de forecast; o resultado e recibo auxiliares ficam separados na Session, sem campo ou fonte extra no output.`
      const draft = { objective, horizon: period, currency: "USD", criteria: [
        "Distinguir mudança contra a base de indicador orçamentário selecionado",
        "Preservar limites de moeda/unidade e não substituir valores dos produtores",
      ], sourceRefs: [sources.base, sources.candidate, metric.ref] }
      const created = await context.ui("sf_case_draft", draft, (call) => context.business.cases.draft(draft, call))
      if (created.status !== "ok") throw new Error(`The actual three-source Finance case was refused: ${created.reason}`)
      const caseRef = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
      const current = await readCase(context, caseRef)
      expect(refSet(current.case.sourceRefs)).toBe(refSet(draft.sourceRefs))
      const caseDigest = digestSfValue(current.case)
      const contextRequest: BusinessContextRequest = { selectionRefs: [metric.ref.refId], purpose, period }
      const kpiRequest: KpiExplainRequest = { metricRef: dashboardMetricSelector(metric.ref.refId, "total-budget"), period }
      await expectSelectedContext(context, contextRequest, metric.ref)
      const kpi = await readUiKpi(context, kpiRequest)
      expectKpi(kpi.projection, metric.ref)
      for (const reference of draft.sourceRefs) await expectSource(context, reference)

      // This refusal is returned by the real KPI producer. Even an identical
      // selected metric cannot be compared monetarily without a defined basis;
      // the driver does not manufacture a converted amount or a margin.
      const uncomparable = await dispatchWp12Ui(context, "sf_kpi_explain", { ...kpiRequest, comparisonRef: kpiRequest.metricRef })
      expect(uncomparable.status).toBe("unavailable")
      if (uncomparable.status === "ok") throw new Error("The producer accepted an unspecified-currency comparison")
      expect(uncomparable.reason).toBe("comparison-basis-unavailable")
      for (const invalid of [
        { request: { metricRef: dashboardMetricSelector(sources.base.refId, "total-budget"), period }, status: "needs-input", reason: "invalid-dashboard-source-selector" },
        { request: { ...kpiRequest, period: { start: "2026-01-01", end: "2026-12-31" } }, status: "denied", reason: "source-unavailable" },
      ]) {
        const refused = await dispatchWp12Ui(context, "sf_kpi_explain", invalid.request)
        expect(refused.status).toBe(invalid.status)
        if (refused.status === "ok") throw new Error("An unrelated producer or unselected period became a KPI source")
        expect(refused.reason).toBe(invalid.reason)
      }
      const unadmitted = new Request(new URL("/sucafina/planner?sf=workbench-analysis", context.origin), { method: "POST", headers: { origin: context.origin } })
      const denied = await context.services.ui.admit(unadmitted, "sf_kpi_explain", digestSfValue(kpiRequest))
      expect(denied.status).not.toBe("ok")
      phase("public-sources-case-kpi-and-refusals-returned")

      const comparisonRequest: ForecastCompareRequest = { baseRef: sources.base.refId, candidateRef: sources.candidate.refId, period, currency: "USD" }
      const incoming = { request: { caseRef, objective, profileId: selected.profile.id, profileVersion: selected.profile.version,
        skillId: skill.id, skillVersion: skill.version, manifestDigest: selected.manifestDigest,
        outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [...nativeOperations] }, selection: { caseRef, ...comparisonRequest } }
      const response = await context.services.productHttp(context.request({ action: "prepare", input: incoming }, "/sucafina/planner?sf=workbench-analysis"), "planner")
      if (!response) throw new Error("The installed Forecast input route is absent")
      const body = object(await response.json())
      expect(response.status).toBe(200)
      expect(body.status).toBe("ok")
      const input = decodeSfSkillInput("ForecastExplainInput", body.value)
      if (!input.ok) throw new Error("The actual Forecast input failed its closed schema")
      expectForecast(input.value.forecastComparison, [sources.base, sources.candidate])
      expect(refSet(input.value.sourceRefs)).toBe(refSet([sources.base, sources.candidate]))
      expect(input.value.registeredReasons).toEqual([])
      expect(input.value.currency).toBe("USD")
      expect(kpi.projection.context.currency).not.toBe(input.value.currency)
      expect(digestSfValue((await readCase(context, caseRef)).case)).toBe(caseDigest)
      expect(await domainDigests(context)).toEqual(before)
      console.log("SF_WP12_FORECAST_KPI_INPUT:" + JSON.stringify({ githubSha: process.env.GITHUB_SHA ?? null,
        profileId: selected.profile.id, skillId: skill.id, caseRef, humanSelectedAuxiliaryRef: metric.ref,
        objectiveDigest: digestSfValue(objective), inputDigest: digestSfValue(input.value),
        forecastRefs: input.value.sourceRefs, knownDifference: input.value.forecastComparison.knownDifference,
        completeDifference: input.value.forecastComparison.completeDifference, forecastCurrency: input.value.currency,
        auxiliaryKpiCurrency: kpi.projection.context.currency, auxiliaryKpi: kpi.projection.values, auxiliaryUiReceipt: kpi.receipt,
        monetaryComparison: uncomparable.reason, auxiliaryIsForecastEvidence: false, crossProducerMarginComputed: false,
        nativeExecution: false, originalObligationIndices: [6, 12] }))
      phase("forecast-input-returned")
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: input.value })
        return { incoming, input: input.value, sources, metric, contextRequest, kpiRequest, comparisonRequest, kpi,
          caseDigest, before, completed: undefined, audit: undefined }
      }
      expectSpawn(import.meta.path)
      const completed = await executeWp12NativeMission(context, { request: incoming.request, skillInput: input.value,
        expectedKind: "FinancialAnalysis", requiredTools: [{ operation: "sf_context_get", handlerExport: "readSfBusinessContext" },
          { operation: "sf_kpi_explain", handlerExport: "explainKpi" }, { operation: "sf_forecast_compare", handlerExport: "compareForecast" },
          { operation: "sf_source_get", handlerExport: "resolveSfSource" }] })
      if (completed.output.kind !== "FinancialAnalysis") throw new Error("The real Finance output changed kind")
      expectReplay(completed.output.payload, input.value.forecastComparison)
      expect(refSet(completed.output.evidenceRefs)).toBe(refSet([sources.base, sources.candidate]))
      const audit = await readNativeAudit(context, completed, { metric: metric.ref, contextRequest, kpiRequest, comparisonRequest,
        forecastRefs: [sources.base, sources.candidate], comparison: input.value.forecastComparison, kpi: kpi.projection })
      expect(await domainDigests(context)).toEqual(before)
      expect(digestSfValue((await readCase(context, caseRef)).case)).toBe(caseDigest)
      phase("native-receipts-and-closed-output-returned")
      return { incoming, input: input.value, sources, metric, contextRequest, kpiRequest, comparisonRequest, kpi,
        caseDigest, before, completed, audit }
    })

    await open("reopened", async (context) => {
      const prepared = await context.human("analysis.prepare", initial.incoming, (call) => context.services.analysisInputs!.prepare(call, initial.incoming))
      if (prepared.status !== "ok") throw new Error(`The actual Forecast input could not be reopened: ${prepared.reason}`)
      expect(digestSfValue(withoutObservationTimes(prepared.value))).toBe(digestSfValue(withoutObservationTimes(initial.input)))
      await expectSelectedContext(context, initial.contextRequest, initial.metric.ref)
      const kpi = await readUiKpi(context, initial.kpiRequest)
      expectKpi(kpi.projection, initial.metric.ref)
      expectReplay(kpi.projection, initial.kpi.projection)
      for (const reference of [initial.sources.base, initial.sources.candidate, initial.metric.ref]) await expectSource(context, reference)
      expect(digestSfValue((await readCase(context, initial.incoming.request.caseRef)).case)).toBe(initial.caseDigest)
      expect(await domainDigests(context)).toEqual(initial.before)
      if (initial.completed) {
        const rendered = await readWp12NativeMissionAfterReload(context, initial.completed)
        if (rendered.output.kind !== "FinancialAnalysis") throw new Error("The reopened contribution changed kind")
        expectReplay(rendered.output.payload, initial.input.forecastComparison)
        expectForecast(rendered.output.payload, [initial.sources.base, initial.sources.candidate])
        expect(refSet(rendered.output.evidenceRefs)).toBe(refSet([initial.sources.base, initial.sources.candidate]))
        expect(rendered.html).toContain("Known difference: 6000")
        expect(rendered.html).toContain("conditioned")
        const audit = await readNativeAudit(context, initial.completed, { metric: initial.metric.ref, contextRequest: initial.contextRequest,
          kpiRequest: initial.kpiRequest, comparisonRequest: initial.comparisonRequest, forecastRefs: [initial.sources.base, initial.sources.candidate],
          comparison: initial.input.forecastComparison, kpi: initial.kpi.projection })
        expect(digestSfValue(audit)).toBe(digestSfValue(initial.audit))
      }
      phase("reopened-producers-and-consumers-returned")
      const observed = [...new Set(initial.completed?.tools.map((tool) => tool.operation) ?? [])]
      console.log("SF_WP12_FORECAST_KPI_REOPEN:" + JSON.stringify({ githubSha: process.env.GITHUB_SHA ?? null,
        profileId: "sf_finance", skillId: "sf-explicar-forecast", caseRef: initial.incoming.request.caseRef,
        nativeObservedOperations: observed, missingNormativeOperations: normativeRequired.filter((operation) => !observed.includes(operation)),
        forecastConsumer: initial.completed ? "handleSfAnalysis:output actual persisted FinancialAnalysis after reload" : "real Forecast input only; no FinancialAnalysis contribution manufactured",
        auxiliaryConsumer: initial.completed ? "actual sf_kpi_explain result and receipt in durable Session" : "authenticated UI dispatcher result only",
        nativeAudit: initial.audit ?? null, humanSelectedAuxiliarySource: true, autonomousDiscoveryClaimed: false,
        auxiliaryInsertedIntoFinancialAnalysis: false, crossProducerMarginComputed: false,
        gnativeAccepted: false, independentGnativeReview: false }))

      // Remove the actually selected raw auxiliary source only after the real
      // consumers. Reuse of the old public ref must not silently read a new
      // scope. Planner values remain unchanged; no ACL/lease is weakened.
      await context.persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.opexOwners = []
        snapshot.data.opexEntries = []
        return { commit: true, value: undefined }
      })
      const removed = await dispatchWp12Ui(context, "sf_kpi_explain", initial.kpiRequest)
      expect(removed.status).not.toBe("ok")
      const removedContext = await dispatchWp12Ui(context, "sf_context_get", initial.contextRequest)
      expect(removedContext.status).not.toBe("ok")
      expect((await domainDigests(context)).planner).toBe(initial.before.planner)
      // A completed run must be checked even if this reopened host currently
      // reports no model. Availability never suppresses a current-source fence.
      if (initial.completed) {
        const output = await context.human("analysis.read", { runRef: initial.completed.runRef }, (call) => context.services.analyses!.output(call, initial.completed!.runRef))
        expect(output.status).not.toBe("ok")
      }
      console.log("SF_WP12_FORECAST_KPI_REMOVED:" + JSON.stringify({ githubSha: process.env.GITHUB_SHA ?? null,
        auxiliaryRefId: initial.metric.ref.refId, kpiStatus: removed.status, contextStatus: removedContext.status,
        nativeOutputRechecked: Boolean(initial.completed), plannerUnchanged: true, negativeScope: "selected auxiliary source removal, not an ACL-revision simulation" }))
    })
  })
}, 360_000)

async function issueMetric(context: Wp12NativeMissionContext) {
  const request = { page: "Budget Overview", fields: ["budgetMetrics"], period }
  const issued = await context.ui("sf_dashboard_read", request, (call) => createDashboardSourceIssuer({ host: context.business.host, scopedSources: context.persistence })(request, call))
  if (issued.status !== "ok") throw new Error(`The actual human-selected budget source was refused: ${issued.reason}`)
  const ref = issued.value.evidence
  if (ref.kind !== "record") throw new Error("The budget selector did not return a record source")
  expect(issued.value.selectionRef).toBe(ref.refId)
  expect(ref.target.fields).toEqual(["budgetMetrics"])
  expect(ref.target.period).toEqual(period)
  return { ref, selectionRef: issued.value.selectionRef }
}

function refSet(refs: readonly BusinessEvidenceRef[]) { return digestSfValue(refs.map((ref) => digestSfValue(ref)).sort()) }
function expectReplay(actual: unknown, expected: unknown) { expect(digestSfValue(withoutObservationTimes(actual))).toBe(digestSfValue(withoutObservationTimes(expected))) }

function expectForecast(value: FinancialAnalysis, refs: readonly BusinessEvidenceRef[]) {
  expect(refSet(value.sourceRefs)).toBe(refSet(refs))
  expect(value.sourceRefs).toHaveLength(2)
  expect(value.knownDifference).toBe(6_000)
  expect(value.comparison.knownDifference).toBe(6_000)
  expect(value.completeDifference).toBeNull()
  expect(value.comparison.completeDifference).toBeNull()
  expect(value.comparison.comparisonStatus).toBe("conditioned")
  expect(value.gaps).toContain("cost-coverage-unavailable")
  expect(value.analysisBasis).toBe("domain")
  expect(value.baseline.context.currency).toBe("USD")
  expect(value.candidate.context.currency).toBe("USD")
  expect(value.baseline.context.period).toEqual(period)
  expect(value.candidate.context.period).toEqual(period)
  expect(value.baseline.components.map((component) => component.amount)).toEqual(annual())
  expect(value.candidate.components.map((component) => component.amount)).toEqual(annual(56_000))
  expect(value.baseline.components.every((component) => component.currency === "USD" && component.evidenceState === "confirmed")).toBe(true)
  expect(value.candidate.components.every((component) => component.currency === "USD" && component.evidenceState === "confirmed")).toBe(true)
}

function expectKpi(value: DomainProjection, reference: BusinessEvidenceRef) {
  expect(value.context.period).toEqual(period)
  expect(value.context.currency).toBe("unspecified")
  expect(value.context.capabilities).toEqual(["sf_kpi_explain"])
  expect(value.values).toHaveLength(1)
  expect(value.values[0]).toMatchObject({ id: "budgetMetrics.2027.totalBudget", value: 600_000, currency: "unspecified", granularity: "year", evidenceState: "estimated", period })
  expect(refSet(value.values[0]!.sourceRefs)).toBe(refSet([reference]))
  expect(value.components).toHaveLength(12)
  expect(value.components.map((component) => component.amount)).toEqual(Array<number>(12).fill(50_000))
  expect(value.components.every((component) => component.currency === "unspecified")).toBe(true)
  expect(value.missing).toContainEqual({ field: "budgetMetrics.2027.totalActual", reason: "missing" })
  expect(value.missing).toContainEqual({ field: "budgetMetrics.2027.totalForecast", reason: "missing" })
  expect(value.comparison).toBeUndefined()
}

async function readUiKpi(context: Wp12NativeMissionContext, request: KpiExplainRequest) {
  const result = await dispatchWp12Ui(context, "sf_kpi_explain", request)
  if (result.status !== "ok") throw new Error(`The actual KPI producer was refused: ${result.reason}`)
  const decoded = decodeSfOperationOutput("sf_kpi_explain", result.result)
  if (!decoded.ok) throw new Error("The KPI output failed its real schema")
  expect(result.receipt).toMatchObject({ kind: "ui", operation: "sf_kpi_explain", handlerExport: "explainKpi", principalRef: context.principalRef,
    inputDigest: digestSfValue(request), resultDigest: digestSfValue(decoded.value) })
  return { projection: decoded.value, receipt: result.receipt }
}

async function expectSelectedContext(context: Wp12NativeMissionContext, request: BusinessContextRequest, reference: BusinessEvidenceRef) {
  const result = await dispatchWp12Ui(context, "sf_context_get", request)
  if (result.status !== "ok") throw new Error(`The human-selected public context was refused: ${result.reason}`)
  const decoded = decodeSfOperationOutput("sf_context_get", result.result)
  if (!decoded.ok) throw new Error("The actual context result failed its schema")
  expect(decoded.value.resolutions).toHaveLength(1)
  expect(decoded.value.resolutions[0]!.state).toBe("fresh")
  expect(refSet(decoded.value.resolutions.map((resolution) => resolution.ref))).toBe(refSet([reference]))
}

async function expectSource(context: Wp12NativeMissionContext, reference: BusinessEvidenceRef) {
  const result = await dispatchWp12Ui(context, "sf_source_get", { evidenceRef: reference })
  if (result.status !== "ok") throw new Error(`The selected real source was refused: ${result.reason}`)
  const decoded = decodeSfOperationOutput("sf_source_get", result.result)
  if (!decoded.ok) throw new Error("The actual source result failed its schema")
  expect(decoded.value.state).toBe("fresh")
  expect(digestSfValue(decoded.value.ref)).toBe(digestSfValue(reference))
  expect(digestSfValue(decoded.value.currentRef)).toBe(digestSfValue(reference))
}

async function readCase(context: Wp12NativeMissionContext, caseRef: { id: string; incarnation: string; version: number }) {
  const request = { caseRef: encodeCaseRef(caseRef) }
  const result = await context.ui("sf_case_read", request, (call) => context.business.cases.read(request, call))
  if (result.status !== "ok") throw new Error(`The actual Finance case was refused: ${result.reason}`)
  return result.value
}

async function domainDigests(context: Wp12NativeMissionContext) {
  const planner = await context.persistence.transaction("planner", async (snapshot) => ({ commit: false,
    value: digestSfValue({ versions: snapshot.data.versions, officials: snapshot.data.officials }) }))
  const dashboard = await context.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
    value: digestSfValue({ opexOwners: snapshot.data.opexOwners, opexEntries: snapshot.data.opexEntries,
      capexProjects: snapshot.data.capexProjects, capexEntries: snapshot.data.capexEntries }) }))
  return { planner, dashboard }
}

async function readNativeAudit(context: Wp12NativeMissionContext, completed: Wp12CompletedNativeMission, expected: {
  metric: BusinessEvidenceRef; contextRequest: BusinessContextRequest; kpiRequest: KpiExplainRequest; comparisonRequest: ForecastCompareRequest;
  forecastRefs: readonly BusinessEvidenceRef[]; comparison: FinancialAnalysis; kpi: DomainProjection
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
    const call = calls.find((entry) => entry.operation === operation && entry.receipt.inputDigest === digestSfValue(payload))
    if (!call) throw new Error(`No native ${operation} receipt used the exact human-selected authorized scope`)
    return call
  }
  const contextCall = exact("sf_context_get", expected.contextRequest)
  const resolved = decodeSfOperationOutput("sf_context_get", contextCall.result)
  if (!resolved.ok) throw new Error("The native auxiliary context failed its schema")
  expect(resolved.value.resolutions).toHaveLength(1)
  expect(resolved.value.resolutions[0]!.state).toBe("fresh")
  expect(refSet(resolved.value.resolutions.map((item) => item.ref))).toBe(refSet([expected.metric]))
  const kpiCall = exact("sf_kpi_explain", expected.kpiRequest)
  // The human chose the public ref; this only proves subsequent model use of
  // the resolved source result. Parallel calls in one message do not suffice.
  expect(contextCall.messageIndex).toBeLessThan(kpiCall.messageIndex)
  const kpi = decodeSfOperationOutput("sf_kpi_explain", kpiCall.result)
  if (!kpi.ok) throw new Error("The native auxiliary KPI failed its schema")
  expectKpi(kpi.value, expected.metric)
  expectReplay(kpi.value, expected.kpi)
  const forecastCall = exact("sf_forecast_compare", expected.comparisonRequest)
  const forecast = decodeSfOperationOutput("sf_forecast_compare", forecastCall.result)
  if (!forecast.ok) throw new Error("The native Forecast comparison failed its schema")
  expectForecast(forecast.value, expected.forecastRefs)
  expectReplay(forecast.value, expected.comparison)
  expect(kpi.value.context.currency).not.toBe(forecast.value.candidate.context.currency)
  const sourceCalls = [...expected.forecastRefs, expected.metric].map((reference) => {
    const call = exact("sf_source_get", { evidenceRef: reference })
    const decoded = decodeSfOperationOutput("sf_source_get", call.result)
    if (!decoded.ok) throw new Error("The native selected source failed its schema")
    expect(decoded.value.state).toBe("fresh")
    expect(digestSfValue(decoded.value.ref)).toBe(digestSfValue(reference))
    expect(digestSfValue(decoded.value.currentRef)).toBe(digestSfValue(reference))
    return { callId: call.callId, receipt: call.receipt, ref: decoded.value.ref }
  })
  expect(refSet(completed.output.evidenceRefs)).toBe(refSet(expected.forecastRefs))
  return { humanSelectedAuxiliaryRef: expected.metric, contextCallId: contextCall.callId, contextMessageId: contextCall.messageId,
    kpi: { callId: kpiCall.callId, messageId: kpiCall.messageId, result: kpi.value, receipt: kpiCall.receipt },
    forecast: { callId: forecastCall.callId, result: forecast.value, receipt: forecastCall.receipt }, sourceCalls,
    closedOutputRefs: completed.output.evidenceRefs, crossProducerMarginComputed: false, auxiliaryConsumedByForecastChart: false }
}
