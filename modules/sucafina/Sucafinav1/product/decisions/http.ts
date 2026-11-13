import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { PortfolioRequest, SensitivityRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedUiContext } from "../contracts/sf-execution.ts"
import type { CriterionRuleInput, createCriterionRuleRegistry } from "./criterion-rules.ts"
import type { createDecisionCaseManagement } from "./case-management.ts"
import type { createDecisionMutations } from "./mutations.ts"
import type { createAnalysisAcceptance } from "./analysis-acceptance.ts"
import type { createPreparedExecution } from "./apply.ts"
import type { createDecisionChoiceCatalog } from "./choice-catalog.ts"
import type { createDecisionCoverageCatalog } from "./coverage-catalog.ts"
import type { createDecisionComparisonService } from "./comparison.ts"
import type { BaselineCoverageRequest, createDecisionBaselineCoverage } from "./baseline-coverage.ts"
import type { PortfolioSelectionRequest, createDecisionPortfolioSelection } from "./portfolio-selection.ts"
import { encodeCaseRef } from "./case-port.ts"

type PortfolioAction = { caseRef: CaseRef; request: PortfolioRequest; selectedCandidateRefs: readonly string[]; combinationId: string; expectedEvaluationDigest: string }
type CaseRef = { id: string; incarnation: string; version: number }
type HumanAction = "decisions.edit" | "decisions.promote-alternative" | "decisions.prepare-changes" | "decisions.choose" | "decisions.accept-analysis" | "decisions.apply" | "decisions.criteria" | "decisions.coverage" | "decisions.select-portfolio" | "decisions.promote-portfolio" | "decisions.prepare-portfolio" | "decisions.portfolio.read" | "decisions.portfolio.evaluate" | "decisions.sensitivity.evaluate"
type Edit = Parameters<ReturnType<typeof createDecisionCaseManagement>["edit"]>[0]
type Promote = Parameters<ReturnType<typeof createDecisionMutations>["addAlternative"]>[0]
type Prepare = Parameters<ReturnType<typeof createDecisionMutations>["prepareChanges"]>[0]
type Choose = Parameters<ReturnType<typeof createDecisionMutations>["recordChoice"]>[0]
type Accept = Parameters<ReturnType<typeof createAnalysisAcceptance>>[0]
type Apply = Parameters<ReturnType<typeof createPreparedExecution>>[0]
type Compare = Parameters<ReturnType<typeof createDecisionComparisonService>>[0]

/** Private HTTP boundary. Human action grants bind the complete decoded payload. */
export function createDecisionHttp(input: {
  origin: string
  mount: string
  human: { admit: (request: Request, action: HumanAction, payload: unknown) => Promise<PortResult<TrustedUiContext>>; finish: (context: TrustedUiContext) => void }
  withCase: <T>(context: TrustedUiContext, caseRef: CaseRef, options: { allowHistoricalRetry: boolean }, action: () => Promise<PortResult<T>>) => Promise<PortResult<T>>
  admitList: (request: Request) => Promise<PortResult<TrustedUiContext>>
  admitComparison: (request: Request, payload: Compare) => Promise<PortResult<TrustedUiContext>>
  admitSelection: (request: Request, payload: { caseRef: CaseRef }) => Promise<PortResult<TrustedUiContext>>
  portfolio: {
    sensitivityUnits: (request: { caseRef: CaseRef; scenarioRef: string; baselineRef: string; parameterRef: string }, context: TrustedUiContext) => Promise<PortResult<unknown>>
    list: (caseRef: CaseRef, context: TrustedUiContext) => Promise<PortResult<unknown>>
    catalog: (caseRefs: readonly CaseRef[], context: TrustedUiContext) => Promise<PortResult<unknown>>
    preview: (request: PortfolioRequest, caseRef: CaseRef, context: TrustedUiContext) => Promise<PortResult<unknown>>
    evaluate: (request: PortfolioRequest, caseRef: CaseRef, context: TrustedUiContext) => Promise<PortResult<unknown>>
    read: (ref: string, caseRef: CaseRef, context: TrustedUiContext) => Promise<PortResult<unknown>>
    sensitivity: (request: SensitivityRequest, caseRef: CaseRef, context: TrustedUiContext) => Promise<PortResult<unknown>>
    readSensitivity: (ref: string, caseRef: CaseRef, context: TrustedUiContext) => Promise<PortResult<unknown>>
    promote: (request: PortfolioAction & { title: string; coverageRef: string }, context: TrustedUiContext) => Promise<PortResult<unknown>>
    prepare: (request: PortfolioAction & { choiceId: string }, context: TrustedUiContext) => Promise<PortResult<unknown>>
  }
  choiceCatalog: ReturnType<typeof createDecisionChoiceCatalog>
  coverageCatalog: ReturnType<typeof createDecisionCoverageCatalog>
  reviewChange: (request: { caseRef: CaseRef; choiceId: string; changeId: string }, context: TrustedUiContext) => Promise<PortResult<unknown>>
  selection: ReturnType<typeof createDecisionPortfolioSelection>
  baseline: ReturnType<typeof createDecisionBaselineCoverage>
  compare: ReturnType<typeof createDecisionComparisonService>
  management: ReturnType<typeof createDecisionCaseManagement>
  mutations: ReturnType<typeof createDecisionMutations>
  accept: ReturnType<typeof createAnalysisAcceptance>
  apply: ReturnType<typeof createPreparedExecution>
  criteria: ReturnType<typeof createCriterionRuleRegistry>
}) {
  return async (request: Request): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.origin !== input.origin || url.pathname !== input.mount) return undefined
    const action = url.searchParams.get("sf")
    if (action === "decision-list") {
      if (request.method !== "GET") return response({ status: "needs-input", reason: "method-not-allowed" }, 405)
      const admitted = await input.admitList(request)
      if (admitted.status !== "ok") return response(admitted)
      try { return response(await input.management.list(admitted.value)) } finally { input.human.finish(admitted.value) }
    }
    const operations = { "decision-edit": "decisions.edit", "decision-promote": "decisions.promote-alternative", "decision-prepare-changes": "decisions.prepare-changes", "decision-choose": "decisions.choose", "decision-accept-analysis": "decisions.accept-analysis", "decision-apply": "decisions.apply", "decision-criteria": "decisions.criteria", "decision-coverage": "decisions.coverage", "decision-select-portfolio": "decisions.select-portfolio", "decision-promote-portfolio": "decisions.promote-portfolio", "decision-prepare-portfolio": "decisions.prepare-portfolio", "decision-choice-catalog": "decisions.portfolio.read", "decision-coverage-catalog": "decisions.portfolio.read", "decision-review": "decisions.portfolio.read", "decision-sensitivity-units": "decisions.portfolio.read", "decision-portfolio-results": "decisions.portfolio.read", "decision-criterion-read": "decisions.portfolio.read", "decision-portfolio-catalog": "decisions.portfolio.read", "decision-portfolio-preview": "decisions.portfolio.read", "decision-portfolio-evaluate": "decisions.portfolio.evaluate", "decision-portfolio-read": "decisions.portfolio.read", "decision-sensitivity-evaluate": "decisions.sensitivity.evaluate", "decision-sensitivity-read": "decisions.portfolio.read" } as const
    if (!action || action !== "decision-compare" && action !== "decision-portfolio-selection" && !Object.hasOwn(operations, action)) return undefined
    if (request.method !== "POST") return response({ status: "needs-input", reason: "method-not-allowed" }, 405)
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return response({ status: "needs-input", reason: "invalid-content-type" }, 415)
    try {
      const body = await request.text()
      if (body.length > 1_000_000) return response({ status: "needs-input", reason: "request-too-large" }, 413)
      const payload: unknown = JSON.parse(body)
      if (!valid(action, payload)) return response({ status: "needs-input", reason: "invalid-decision-input" })
      if ((action === "decision-compare" || action === "decision-portfolio-selection") && (request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site")) return response({ status: "denied", reason: "decision-origin-unavailable" })
      const admitted = action === "decision-compare" ? await input.admitComparison(request, payload as Compare) : action === "decision-portfolio-selection" ? await input.admitSelection(request, payload as { caseRef: CaseRef }) : await input.human.admit(request, operations[action as keyof typeof operations], payload)
      if (admitted.status !== "ok") return response(admitted)
      try {
        const context = admitted.value
        const dispatch = async (): Promise<Response> => {
        if (action === "decision-choice-catalog") return response(await input.choiceCatalog(payload as { caseRef: CaseRef }, context))
        if (action === "decision-coverage-catalog") return response(await input.coverageCatalog(payload as { caseRef: CaseRef }, context))
        if (action === "decision-review") { const body = payload as { caseRef: CaseRef; choiceId: string; changeId: string }; return response(await input.reviewChange({ caseRef: body.caseRef, choiceId: body.choiceId, changeId: body.changeId }, context)) }
        if (action === "decision-sensitivity-units") { const body = payload as { caseRef: CaseRef; scenarioRef: string; baselineRef: string; parameterRef: string }; return response(await input.portfolio.sensitivityUnits({ caseRef: body.caseRef, scenarioRef: body.scenarioRef, baselineRef: body.baselineRef, parameterRef: body.parameterRef }, context)) }
        if (action === "decision-portfolio-results") return response(await input.portfolio.list((payload as { caseRef: CaseRef }).caseRef, context))
        if (action === "decision-criterion-read") {
          const body = payload as { caseRef: CaseRef; criterionId: string }
          const rule = await input.criteria.resolve(body, context)
          if (rule.status !== "ok") return response(rule)
          const value = rule.value
          return response({ status: "ok", value: { criterionId: value.criterionId, metricRef: value.metricRef, operator: value.operator, value: value.value, unit: value.unit, period: value.period, version: value.version, ...(value.sensitivity ? { sensitivity: { baselineRef: value.sensitivity.baselineRef, parameterRef: value.sensitivity.parameterRef, parameterUnit: value.sensitivity.parameterUnit, resultUnit: value.sensitivity.resultUnit, engineVersion: value.sensitivity.engineVersion } } : {}) } })
        }
        if (action === "decision-portfolio-catalog") return response(await input.portfolio.catalog((payload as { caseRefs: CaseRef[] }).caseRefs, context))
        if (action === "decision-portfolio-preview") { const body = payload as { caseRef: CaseRef; request: PortfolioRequest }; return response(await input.portfolio.preview(body.request, body.caseRef, context)) }
        if (action === "decision-portfolio-evaluate") { const body = payload as { caseRef: CaseRef; request: PortfolioRequest }; return response(await input.portfolio.evaluate(body.request, body.caseRef, context)) }
        if (action === "decision-portfolio-read") { const body = payload as { caseRef: CaseRef; resultRef: string }; return response(await input.portfolio.read(body.resultRef, body.caseRef, context)) }
        if (action === "decision-sensitivity-evaluate") { const body = payload as { caseRef: CaseRef; request: SensitivityRequest }; return response(await input.portfolio.sensitivity(body.request, body.caseRef, context)) }
        if (action === "decision-sensitivity-read") { const body = payload as { caseRef: CaseRef; resultRef: string }; return response(await input.portfolio.readSensitivity(body.resultRef, body.caseRef, context)) }
        if (action === "decision-promote-portfolio") return response(await input.portfolio.promote(payload as PortfolioAction & { title: string; coverageRef: string }, context))
        if (action === "decision-prepare-portfolio") return response(await input.portfolio.prepare(payload as PortfolioAction & { choiceId: string }, context))
        if (action === "decision-portfolio-selection") return response(await input.selection.inspect(payload as { caseRef: CaseRef }, context))
        if (action === "decision-compare") return response(await input.compare(payload as Compare, context))
        if (action === "decision-edit") return response(await input.management.edit(payload as Edit, context))
        if (action === "decision-promote") return response(await input.mutations.addAlternative(payload as Promote, context))
        if (action === "decision-prepare-changes") return response(await input.mutations.prepareChanges(payload as Prepare, context))
        if (action === "decision-choose") return response(await input.mutations.recordChoice(payload as Choose, context))
        if (action === "decision-accept-analysis") return response(await input.accept(payload as Accept, context))
        if (action === "decision-criteria") return response(await input.criteria.register(payload as CriterionRuleInput, context))
        if (action === "decision-select-portfolio") return response(await input.selection.register(payload as PortfolioSelectionRequest, context))
        if (action === "decision-coverage") return response(await input.baseline.register(payload as BaselineCoverageRequest, context))
        const result = await input.apply(payload as Apply, context)
        return result.status === "ok" ? response({ status: "ok", value: { receiptId: result.value.id, surface: result.value.surface, version: result.value.version } }) : response(result)
        }
        if (!object(payload) || !caseRef(payload.caseRef)) return await dispatch()
        const allowHistoricalRetry = ["decision-edit", "decision-promote", "decision-prepare-changes", "decision-choose", "decision-accept-analysis", "decision-apply"].includes(action)
        const scoped = await input.withCase(context, payload.caseRef, { allowHistoricalRetry }, async () => ({ status: "ok", value: await dispatch() }))
        return scoped.status === "ok" ? scoped.value : response(scoped)
      } finally { input.human.finish(admitted.value) }
    } catch {
      return response({ status: "unavailable", reason: "decision-request-unavailable" })
    }
  }
}

function response(result: PortResult<unknown>, status?: number) {
  return Response.json(result, { status: status ?? (result.status === "ok" ? 200 : result.status === "needs-input" ? 400 : result.status === "denied" ? 403 : result.status === "stale" || result.status === "conflict" ? 409 : 503), headers: { "cache-control": "no-store" } })
}
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype }
function closed(value: Record<string, unknown>, allowed: readonly string[], required: readonly string[]) { return Object.keys(value).every((key) => allowed.includes(key)) && required.every((key) => Object.hasOwn(value, key)) }
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0 }
function version(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 1 }
function caseRef(value: unknown): value is CaseRef { return object(value) && closed(value, ["id", "incarnation", "version"], ["id", "incarnation", "version"]) && text(value.id) && text(value.incarnation) && version(value.version) }
function refs(value: unknown) { return decodeSfOperationInput("sf_case_draft", { objective: "validate", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: ["validate"], sourceRefs: value }).ok }
function valid(action: string, value: unknown) {
  if (!object(value)) return false
  if (action === "decision-portfolio-catalog") return closed(value, ["purpose", "caseRefs"], ["purpose", "caseRefs"]) && value.purpose === "catalog" && Array.isArray(value.caseRefs) && value.caseRefs.length > 0 && value.caseRefs.length <= 64 && value.caseRefs.every(caseRef) && new Set(value.caseRefs.map((ref) => JSON.stringify([ref.id, ref.incarnation, ref.version]))).size === value.caseRefs.length
  if (!caseRef(value.caseRef)) return false
  if (action === "decision-choice-catalog") return closed(value, ["purpose", "caseRef"], ["purpose", "caseRef"]) && value.purpose === "choice-catalog"
  if (action === "decision-coverage-catalog") return closed(value, ["purpose", "caseRef"], ["purpose", "caseRef"]) && value.purpose === "coverage-catalog"
  if (action === "decision-review") return closed(value, ["purpose", "caseRef", "choiceId", "changeId"], ["purpose", "caseRef", "choiceId", "changeId"]) && value.purpose === "review" && text(value.choiceId) && text(value.changeId)
  if (action === "decision-sensitivity-units") return closed(value, ["purpose", "caseRef", "scenarioRef", "baselineRef", "parameterRef"], ["purpose", "caseRef", "scenarioRef", "baselineRef", "parameterRef"]) && value.purpose === "sensitivity-units" && text(value.scenarioRef) && text(value.baselineRef) && text(value.parameterRef)
  if (action === "decision-portfolio-results") return closed(value, ["purpose", "caseRef"], ["purpose", "caseRef"]) && value.purpose === "results"
  if (action === "decision-criterion-read") return closed(value, ["purpose", "caseRef", "criterionId"], ["purpose", "caseRef", "criterionId"]) && value.purpose === "criterion" && text(value.criterionId)
  if (action === "decision-portfolio-preview") return closed(value, ["purpose", "caseRef", "request"], ["purpose", "caseRef", "request"]) && value.purpose === "preview" && decodeSfOperationInput("sf_portfolio_evaluate", value.request).ok
  if (action === "decision-portfolio-evaluate" || action === "decision-sensitivity-evaluate") return closed(value, ["caseRef", "request"], ["caseRef", "request"]) && decodeSfOperationInput(action === "decision-portfolio-evaluate" ? "sf_portfolio_evaluate" : "sf_sensitivity_evaluate", value.request).ok
  if (action === "decision-portfolio-read" || action === "decision-sensitivity-read") return closed(value, ["caseRef", "resultRef"], ["caseRef", "resultRef"]) && text(value.resultRef)
  if (action === "decision-promote-portfolio" || action === "decision-prepare-portfolio") { const extra = action === "decision-promote-portfolio" ? ["title", "coverageRef"] : ["choiceId"]; const fields = ["caseRef", "request", "selectedCandidateRefs", "combinationId", "expectedEvaluationDigest", ...extra]; return closed(value, fields, fields) && decodeSfOperationInput("sf_portfolio_evaluate", value.request).ok && Array.isArray(value.selectedCandidateRefs) && value.selectedCandidateRefs.length > 0 && value.selectedCandidateRefs.every(text) && text(value.combinationId) && typeof value.expectedEvaluationDigest === "string" && /^[a-f0-9]{64}$/.test(value.expectedEvaluationDigest) && extra.every((key) => text(value[key])) }
  if (action === "decision-portfolio-selection") return closed(value, ["caseRef"], ["caseRef"])
  if (action === "decision-compare") return closed(value, ["caseRef", "baselineAlternativeId", "alternativeId", "criteria"], ["caseRef", "baselineAlternativeId", "alternativeId", "criteria"]) && text(value.baselineAlternativeId) && text(value.alternativeId) && Array.isArray(value.criteria) && value.criteria.every(text)
  if (action === "decision-select-portfolio") return closed(value, ["caseRef", "baselineAlternativeId", "alternativeId", "criteria", "expectedVersion"], ["caseRef", "baselineAlternativeId", "alternativeId", "criteria", "expectedVersion"]) && text(value.baselineAlternativeId) && text(value.alternativeId) && Array.isArray(value.criteria) && value.criteria.every(text) && Number.isSafeInteger(value.expectedVersion) && Number(value.expectedVersion) >= 0
  if (action === "decision-edit") return closed(value, ["caseRef", "objective", "criteria", "sourceRefs", "horizon", "currency", "assumptions"], ["caseRef", "objective", "criteria", "sourceRefs"]) && text(value.objective) && Array.isArray(value.criteria) && value.criteria.length > 0 && value.criteria.every((item) => object(item) && closed(item, ["id", "description", "required"], ["id", "description", "required"]) && text(item.id) && text(item.description) && typeof item.required === "boolean") && refs(value.sourceRefs) && (value.horizon === undefined || isSfPeriod(value.horizon)) && (value.currency === undefined || typeof value.currency === "string" && /^[A-Z]{3}$/.test(value.currency)) && (value.assumptions === undefined || Array.isArray(value.assumptions) && value.assumptions.every((item) => object(item) && closed(item, ["id", "text", "state", "evidenceRefs"], ["id", "text", "state", "evidenceRefs"]) && text(item.id) && text(item.text) && ["open", "confirmed", "rejected"].includes(String(item.state)) && refs(item.evidenceRefs)))
  if (action === "decision-promote") return closed(value, ["caseRef", "title", "scenario", "coverageRef", "alternativeRef"], ["caseRef", "title", "scenario", "coverageRef"]) && text(value.title) && text(value.coverageRef) && decodeSfOperationInput("sf_scenario_simulate", value.scenario).ok && (value.alternativeRef === undefined || object(value.alternativeRef) && closed(value.alternativeRef, ["id", "version"], ["id", "version"]) && text(value.alternativeRef.id) && version(value.alternativeRef.version))
  if (action === "decision-prepare-changes") return closed(value, ["caseRef", "choiceId", "operations"], ["caseRef", "choiceId", "operations"]) && text(value.choiceId) && decodeSfOperationInput("sf_change_prepare", { caseRef: encodeCaseRef(value.caseRef), choiceRef: value.choiceId, operations: value.operations }).ok
  if (action === "decision-choose") return closed(value, ["caseRef", "alternativeId", "alternativeVersion", "comparison", "criteria", "reason"], ["caseRef", "alternativeId", "alternativeVersion", "comparison", "criteria", "reason"]) && text(value.alternativeId) && version(value.alternativeVersion) && text(value.reason) && Array.isArray(value.criteria) && value.criteria.every(text) && decodeSfOperationInput("sf_scenario_compare", value.comparison).ok
  if (action === "decision-accept-analysis") return closed(value, ["caseRef", "outputRef", "runRef", "rationale"], ["caseRef", "outputRef", "runRef", "rationale"]) && text(value.outputRef) && text(value.runRef) && text(value.rationale)
  if (action === "decision-apply") return closed(value, ["caseRef", "changeId", "choiceId"], ["caseRef", "changeId", "choiceId"]) && text(value.changeId) && text(value.choiceId)
  if (action === "decision-coverage") return closed(value, ["caseRef", "source", "basis", "entries", "expectedVersion"], ["caseRef", "source", "basis", "entries", "expectedVersion"]) && decodeSfOperationInput("sf_source_get", { evidenceRef: value.source }).ok && object(value.basis) && closed(value.basis, ["id", "version", "decisionType", "categoryIds", "additionalCategoryIds", "sourceRefs"], ["id", "version", "decisionType", "categoryIds", "additionalCategoryIds", "sourceRefs"]) && text(value.basis.id) && version(value.basis.version) && text(value.basis.decisionType) && Array.isArray(value.basis.categoryIds) && value.basis.categoryIds.every(text) && Array.isArray(value.basis.additionalCategoryIds) && value.basis.additionalCategoryIds.every(text) && refs(value.basis.sourceRefs) && Array.isArray(value.entries) && value.entries.every(coverageEntry) && Number.isSafeInteger(value.expectedVersion) && Number(value.expectedVersion) >= 0
  if (action === "decision-criteria") return closed(value, ["caseRef", "criterionId", "metricRef", "operator", "value", "unit", "period", "evidenceRefs", "expectedRuleVersion", "sensitivity"], ["caseRef", "criterionId", "metricRef", "operator", "value", "unit", "period", "evidenceRefs", "expectedRuleVersion"]) && text(value.criterionId) && text(value.metricRef) && ["lte", "gte", "eq"].includes(String(value.operator)) && typeof value.value === "number" && Number.isFinite(value.value) && text(value.unit) && isSfPeriod(value.period) && refs(value.evidenceRefs) && Number.isSafeInteger(value.expectedRuleVersion) && Number(value.expectedRuleVersion) >= 0 && (value.sensitivity === undefined || object(value.sensitivity) && closed(value.sensitivity, ["baselineRef", "parameterRef", "parameterUnit", "resultUnit", "engineVersion", "sourceRefs"], ["baselineRef", "parameterRef", "parameterUnit", "resultUnit", "engineVersion", "sourceRefs"]) && text(value.sensitivity.baselineRef) && text(value.sensitivity.parameterRef) && text(value.sensitivity.parameterUnit) && text(value.sensitivity.resultUnit) && text(value.sensitivity.engineVersion) && refs(value.sensitivity.sourceRefs))
  return false
}

function coverageEntry(value: unknown) {
  if (!object(value) || !text(value.categoryId)) return false
  if (value.status === "pending") return closed(value, ["categoryId", "status", "reason", "questionRef"], ["categoryId", "status", "reason"]) && text(value.reason) && (value.questionRef === undefined || text(value.questionRef))
  if (value.status === "not-applicable") return closed(value, ["categoryId", "status", "justification", "evidenceRefs"], ["categoryId", "status", "justification", "evidenceRefs"]) && text(value.justification) && refs(value.evidenceRefs)
  if (value.status === "included") return closed(value, ["categoryId", "status", "componentRefs", "evidenceRefs", "scopeNote"], ["categoryId", "status", "componentRefs", "evidenceRefs", "scopeNote"]) && Array.isArray(value.componentRefs) && value.componentRefs.length > 0 && value.componentRefs.every(text) && refs(value.evidenceRefs) && text(value.scopeNote)
  return false
}
