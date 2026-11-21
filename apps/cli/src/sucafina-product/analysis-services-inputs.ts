import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { sfPlannerSourceSelector } from "../../../../modules/sucafina/Sucafinav1/product/integration/planner-sources.ts"
import { verifyPlannerImportTarget } from "../../../../modules/sucafina/Sucafinav1/product/imports/source-fences.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfImportServices } from "./import-services.ts"
import { createSfImportForecastAnalysis } from "./import-analysis.ts"
import { createSfScenarioComparisonInput } from "./analysis-inputs.ts"
import { createSfSourcingInput, createSfSourcingVerifier } from "./analysis-verifier-procurement.ts"
import { createSfForecastVerifier } from "./analysis-verifier.ts"
import { createSfScenarioVerifier } from "./analysis-verifier-scenarios.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"
import type { SfAnalysisVerifier, SfAnalysisRequest } from "./analysis-verifier.ts"

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const same = (left: unknown, right: unknown) => digestSfValue(left) === digestSfValue(right)

/** Adapt published business producers to the common selection registry without accepting their outputs as user selections. */
export function createSfAnalysisBusinessInputs(input: { business: ReturnType<typeof createSfBusinessServices>; authority: ReturnType<typeof createSfProductAuthority>; imports?: ReturnType<typeof createSfImportServices> }) {
  const { business, authority } = input
  const dependencies = { cases: business.cases, planner: business.planner, procurement: business.procurement, context: business.context, host: authority.host }
  const authorize = (call: Parameters<SfInputProducer["prepare"]>[2], selection: unknown, request: SfAnalysisRequest) =>
    authority.human.authorize(call, "analysis.prepare", { request, selection })
  const imported = input.imports ? (request?: SfAnalysisRequest, selection?: unknown) => createSfImportForecastAnalysis({ ...dependencies,
    imports: input.imports!.imports, issueSource: business.plannerProduct.issueSource, intentOperation: "analysis.prepare",
    matchesIntent: async (call, operation, digest) => !!request && selection !== undefined && operation === "analysis.prepare" &&
      digest === digestSfValue(selection) && call.kind === "ui" && await authorize(call, selection, request),
    verifyTarget: (snapshot, manifest, actor, call) => {
      const target = manifest.baseIdentity[0]
      return !!target && target.surface === "planner" && verifyPlannerImportTarget(snapshot, { surface: "planner",
        selectionRef: sfPlannerSourceSelector(target.id, target.incarnation, target.version), incarnation: target.incarnation, version: target.version,
        options: { newVersion: false, removeMissing: false, preview: {} } }, actor, call)
    },
  }) : undefined
  const forecast: SfInputProducer = { skillIds: ["sf-explicar-forecast"], prepare: async (raw, request, call) => {
    const selection = object(raw)
    if (selection.previewRef !== undefined || selection.importRequest !== undefined) {
      const preview = decodeSfOperationInput("sf_import_preview", selection.importRequest)
      if (!imported) return { status: "unavailable", reason: "import-analysis-reader-unavailable" }
      if (Object.keys(selection).some((key) => !["caseRef", "previewRef", "importRequest", "period", "currency"].includes(key)) ||
        !same(selection.caseRef, request.caseRef) || typeof selection.previewRef !== "string" || !selection.previewRef.trim() || !preview.ok ||
        !isSfPeriod(selection.period) || typeof selection.currency !== "string" || !selection.currency.trim()) return { status: "needs-input", reason: "import-forecast-selection-invalid" }
      const wanted = { caseRef: request.caseRef, previewRef: selection.previewRef, importRequest: preview.value, period: selection.period, currency: selection.currency }
      if (!same(wanted, raw)) return { status: "needs-input", reason: "import-forecast-selection-invalid" }
      return imported(request, raw).prepare(call, wanted)
    }
    if (Object.keys(selection).some((key) => !["caseRef", "baseRef", "candidateRef", "period", "currency"].includes(key)) ||
      selection.caseRef !== undefined && !same(selection.caseRef, request.caseRef)) return { status: "needs-input", reason: "forecast-selection-invalid" }
    const decoded = decodeSfOperationInput("sf_forecast_compare", { baseRef: selection.baseRef, candidateRef: selection.candidateRef, period: selection.period, currency: selection.currency })
    if (!decoded.ok) return { status: "needs-input", reason: "forecast-selection-invalid" }
    const compared = await business.planner.compareForecast(decoded.value, call)
    if (compared.status !== "ok") return compared
    const value = decodeSfSkillInput("ForecastExplainInput", { forecastComparison: compared.value, selectedPeriod: decoded.value.period,
      currency: decoded.value.currency, sourceRefs: compared.value.sourceRefs, registeredReasons: [] })
    return value.ok ? { status: "ok", value: value.value } : { status: "unavailable", reason: "forecast-analysis-input-unavailable" }
  } }
  const scenario: SfInputProducer = { skillIds: ["sf-comparar-cenarios"], prepare: async (raw, request, call) => {
    const selection = object(raw)
    const refs = Array.isArray(selection.alternatives) ? selection.alternatives.map(object) : []
    if (Object.keys(selection).some((key) => key !== "caseRef" && key !== "alternatives") || !same(selection.caseRef, request.caseRef) || refs.length !== 2 ||
      refs.some((ref) => Object.keys(ref).length !== 2 || Object.keys(ref).some((key) => key !== "id" && key !== "version") ||
        typeof ref.id !== "string" || !ref.id.trim() || typeof ref.version !== "number" || !Number.isSafeInteger(ref.version) || ref.version < 0))
      return { status: "needs-input", reason: "scenario-selection-invalid" }
    const wanted = { caseRef: request.caseRef, alternatives: [{ id: String(refs[0]!.id), version: Number(refs[0]!.version) }, { id: String(refs[1]!.id), version: Number(refs[1]!.version) }] as const }
    if (!same(wanted, raw)) return { status: "needs-input", reason: "scenario-selection-invalid" }
    return createSfScenarioComparisonInput({ cases: business.cases, scenarioLookup: business.scenarioLookup, planner: business.planner, context: business.context,
      revalidate: authority.host.revalidate, authorizeSelection: (context) => authorize(context, raw, request) }).prepare(call, wanted)
  } }
  const sourcing: SfInputProducer = { skillIds: ["sf-comparar-sourcing"], prepare: async (raw, request, call) => {
    const selection = object(raw)
    if (Object.keys(selection).some((key) => key !== "caseRef" && key !== "requestRef") || selection.caseRef !== undefined && !same(selection.caseRef, request.caseRef) ||
      typeof selection.requestRef !== "string" || !selection.requestRef.trim()) return { status: "needs-input", reason: "sourcing-selection-invalid" }
    return createSfSourcingInput({ sourcingEvidence: business.sourcingEvidence })(selection.requestRef, call)
  } }
  const verifiers: SfAnalysisVerifier[] = [imported ? imported().verifier : createSfForecastVerifier(dependencies),
    createSfScenarioVerifier({ ...dependencies, scenarioRef: async (caseRef, alternative, call) => {
      const value = await business.scenarioLookup({ caseRef, alternativeId: alternative.id, alternativeVersion: alternative.version }, call)
      return value.status === "ok" ? { status: "ok", value: value.value.resultRef } : value
    } }), createSfSourcingVerifier({ ...dependencies, sourcingEvidence: business.sourcingEvidence })]
  return { producers: [forecast, scenario, sourcing], verifiers }
}
