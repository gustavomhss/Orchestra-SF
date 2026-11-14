import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { createDecisionMutations } from "../../../../modules/sucafina/Sucafinav1/product/decisions/mutations.ts"
import type { createPortfolioProduct } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/product.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import { createSfPortfolioReconciliationHttp, validSfPortfolioReconciliationRequest } from "./portfolio-reconciliation-http.ts"
import type { createSfPortfolioReconciliationServices } from "./portfolio-reconciliation-services.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type Mutations = ReturnType<typeof createDecisionMutations>
type Portfolio = ReturnType<typeof createPortfolioProduct>
const actions = { "decision-choose": "decisions.choose", "decision-add-question": "decisions.add-question", "decision-answer-question": "decisions.answer-question",
  "decision-promote": "decisions.promote-alternative", "decision-prepare-changes": "decisions.prepare-changes",
  "decision-promote-portfolio": "decisions.promote-portfolio", "decision-prepare-portfolio": "decisions.prepare-portfolio",
  "decision-review": "decisions.portfolio.read", "decision-portfolio-results": "decisions.portfolio.read", "decision-portfolio-read": "decisions.portfolio.read",
  "decision-portfolio-preview": "decisions.portfolio.read", "decision-portfolio-evaluate": "decisions.portfolio.evaluate",
  "decision-portfolio-reconcile": "decisions.portfolio.read",
  "decision-sensitivity-units": "decisions.portfolio.read", "decision-sensitivity-read": "decisions.portfolio.read", "decision-sensitivity-evaluate": "decisions.sensitivity.evaluate" } as const
type Mode = keyof typeof actions

/** Implements the published WP11 consumer route names with the host's actual WP13/C12 instances. */
export function createSfPortfolioHttp(input: {
  origin: string
  mount: string
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  product?: Portfolio
  mutations: Mutations
  reconciliation?: ReturnType<typeof createSfPortfolioReconciliationServices>
}) {
  const reconciliation = createSfPortfolioReconciliationHttp(input)
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const page = await reconciliation(request, surface)
    if (page) return page
    const url = new URL(request.url)
    const selected = url.searchParams.get("sf")
    if (!selected || !Object.hasOwn(actions, selected)) return undefined
    if (!["dashboard", "planner", "procurement"].includes(surface) || url.origin !== input.origin || url.pathname !== `${input.mount}/${surface}` || request.headers.get("origin") !== input.origin ||
      request.headers.get("sec-fetch-site") === "cross-site" || request.signal.aborted) return reply({ status: "denied", reason: "decision-origin-unavailable" })
    if (request.method !== "POST") return reply({ status: "needs-input", reason: "method-not-allowed" }, 405)
    if (url.searchParams.getAll("sf").length !== 1 || [...url.searchParams.keys()].some((key) => key !== "sf") || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ status: "needs-input", reason: "invalid-decision-request" })
    const mode = selected as Mode
    const payload = await boundedJson(request)
    if (!valid(mode, payload)) return reply({ status: "needs-input", reason: "invalid-decision-input" })
    const admitted = await input.authority.human.admit(request, actions[mode], payload)
    if (admitted.status !== "ok") return reply(admitted)
    try {
      const call = admitted.value
      const binding = digestSfValue([call.kind, call.binding]), transport = digestSfValue({ method: request.method, url: request.url, headers: [...request.headers.entries()] })
      const allowHistoricalRetry = ["decision-promote", "decision-choose", "decision-add-question", "decision-answer-question", "decision-prepare-changes", "decision-promote-portfolio", "decision-prepare-portfolio"].includes(mode)
      const result = await input.business.withCase<unknown>(call, payload.caseRef, { allowHistoricalRetry }, async () => {
        if (mode === "decision-choose") return input.mutations.recordChoice(payload as Parameters<Mutations["recordChoice"]>[0], call)
        if (mode === "decision-add-question") return input.mutations.addQuestion(payload as Parameters<Mutations["addQuestion"]>[0], call)
        if (mode === "decision-answer-question") return input.mutations.answerQuestion(payload as Parameters<Mutations["answerQuestion"]>[0], call)
        if (mode === "decision-promote") return input.mutations.addAlternative(payload as Parameters<Mutations["addAlternative"]>[0], call)
        if (mode === "decision-prepare-changes") return input.mutations.prepareChanges(payload as Parameters<Mutations["prepareChanges"]>[0], call)
        if (mode === "decision-review") return input.business.procurementDecisions.reviewChange(payload as Parameters<typeof input.business.procurementDecisions.reviewChange>[0], call)
        const product = input.product
        if (!product) return { status: "unavailable", reason: "portfolio-planner-stored-scenarios-unavailable" }
        if (mode === "decision-portfolio-reconcile") return product.http.reconcile(payload as Parameters<Portfolio["http"]["reconcile"]>[0], call)
        if (mode === "decision-promote-portfolio") return product.http.promote(payload as Parameters<Portfolio["http"]["promote"]>[0], call)
        if (mode === "decision-prepare-portfolio") return product.http.prepare(payload as Parameters<Portfolio["http"]["prepare"]>[0], call)
        if (mode === "decision-portfolio-results") return product.http.list(payload.caseRef, call)
        if (mode === "decision-portfolio-read") return product.http.read(String(payload.resultRef), payload.caseRef, call)
        if (mode === "decision-sensitivity-read") return product.http.readSensitivity(String(payload.resultRef), payload.caseRef, call)
        if (mode === "decision-sensitivity-units") return product.http.sensitivityUnits(payload as Parameters<Portfolio["http"]["sensitivityUnits"]>[0], call)
        if (mode === "decision-sensitivity-evaluate") return product.http.sensitivity(payload.request as Parameters<Portfolio["http"]["sensitivity"]>[0], payload.caseRef, call)
        if (mode === "decision-portfolio-preview") return product.http.preview(payload.request as Parameters<Portfolio["http"]["preview"]>[0], payload.caseRef, call)
        return product.http.evaluate(payload.request as Parameters<Portfolio["http"]["evaluate"]>[0], payload.caseRef, call)
      })
      if (!await input.authority.host.revalidate(call)) return reply({ status: "denied", reason: "decision-authority-changed" })
      if (mode === "decision-portfolio-reconcile" && (input.authority.host.requestFor(call) !== request || request.signal.aborted ||
        binding !== digestSfValue([call.kind, call.binding]) || transport !== digestSfValue({ method: request.method, url: request.url, headers: [...request.headers.entries()] })))
        return reply({ status: "denied", reason: "portfolio-reconciliation-authority-changed" })
      return reply(result)
    } catch { return reply({ status: "unavailable", reason: mode === "decision-review" ? "procurement-prepared-review-producer-unavailable" : "decision-request-unavailable" }) }
    finally { input.authority.human.finish(admitted.value) }
  }
}

function valid(mode: Mode, value: unknown): value is Record<string, unknown> & { caseRef: CaseRef } {
  if (!record(value) || !caseRef(value.caseRef)) return false
  if (mode === "decision-portfolio-reconcile") return validSfPortfolioReconciliationRequest(value)
  if (mode === "decision-choose") return closed(value, ["caseRef", "alternativeId", "alternativeVersion", "comparison", "criteria", "reason"]) && text(value.alternativeId) && integer(value.alternativeVersion) && text(value.reason) && strings(value.criteria) && decodeSfOperationInput("sf_scenario_compare", value.comparison).ok
  if (mode === "decision-add-question") return closed(value, ["caseRef", "questionRef"]) && text(value.questionRef)
  if (mode === "decision-answer-question") return closed(value, ["caseRef", "questionId", "answerRef"]) && text(value.questionId) && text(value.answerRef)
  if (mode === "decision-promote") return closed(value, ["caseRef", "title", "scenario", "coverageRef"], ["alternativeRef"]) && text(value.title) && text(value.coverageRef) && decodeSfOperationInput("sf_scenario_simulate", value.scenario).ok &&
    (value.alternativeRef === undefined || record(value.alternativeRef) && closed(value.alternativeRef, ["id", "version"]) && text(value.alternativeRef.id) && integer(value.alternativeRef.version))
  if (mode === "decision-prepare-changes") return closed(value, ["caseRef", "choiceId", "operations"]) && text(value.choiceId) && decodeSfOperationInput("sf_change_prepare", { caseRef: encodeCaseRef(value.caseRef), choiceRef: value.choiceId, operations: value.operations }).ok
  if (mode === "decision-prepare-portfolio" || mode === "decision-promote-portfolio") {
    const fields = mode === "decision-prepare-portfolio" ? ["choiceId"] : ["title", "coverageRef"]
    return closed(value, ["caseRef", "request", "selectedCandidateRefs", "combinationId", "expectedEvaluationDigest", ...fields]) &&
      decodeSfOperationInput("sf_portfolio_evaluate", value.request).ok && strings(value.selectedCandidateRefs) && value.selectedCandidateRefs.length > 0 &&
      digest(value.combinationId) && digest(value.expectedEvaluationDigest) && fields.every((field) => text(value[field]))
  }
  if (mode === "decision-review") return closed(value, ["caseRef", "choiceId", "changeId"]) && text(value.choiceId) && text(value.changeId)
  if (mode === "decision-portfolio-results") return closed(value, ["caseRef"])
  if (mode === "decision-portfolio-read" || mode === "decision-sensitivity-read") return closed(value, ["caseRef", "resultRef"]) && text(value.resultRef)
  if (mode === "decision-sensitivity-units") return closed(value, ["caseRef", "scenarioRef", "baselineRef", "parameterRef"]) && text(value.scenarioRef) && text(value.baselineRef) && text(value.parameterRef)
  return closed(value, ["caseRef", "request"]) && decodeSfOperationInput(mode === "decision-sensitivity-evaluate" ? "sf_sensitivity_evaluate" : "sf_portfolio_evaluate", value.request).ok
}
function reply(result: PortResult<unknown>, status?: number) {
  return Response.json(result, { status: status ?? (result.status === "ok" ? 200 : result.status === "needs-input" ? 400 : result.status === "denied" ? 403 : result.status === "stale" || result.status === "conflict" ? 409 : 503),
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype }
function text(value: unknown): value is string { return typeof value === "string" && !!value.trim() && value.length <= 16384 }
function integer(value: unknown) { return typeof value === "number" && Number.isSafeInteger(value) && value > 0 }
function digest(value: unknown) { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.length <= 512 && value.every(text) && new Set(value).size === value.length }
function caseRef(value: unknown): value is CaseRef { return record(value) && closed(value, ["id", "incarnation", "version"]) && text(value.id) && text(value.incarnation) && integer(value.version) }
function closed(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) { return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key)) }
async function boundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader()
  if (!reader) return undefined
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      length += part.value.byteLength
      if (length > 262144) { await reader.cancel(); return undefined }
      chunks.push(part.value)
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch { return undefined } finally { reader.releaseLock() }
}
