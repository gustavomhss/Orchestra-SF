import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfDecisionDomainServices } from "./decision-domain-services.ts"
import { htmlPolicy } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import { readSfDecisionControls, sfDecisionControlsHtml } from "./decision-controls.ts"

export type SfDecisionHttpRuntime = { authority: ReturnType<typeof createSfProductAuthority>; business: ReturnType<typeof createSfBusinessServices>; domain: ReturnType<typeof createSfDecisionDomainServices> }
type CaseRef = { id: string; incarnation: string; version: number }
type Edit = Parameters<ReturnType<typeof createSfDecisionDomainServices>["management"]["edit"]>[0]
type Compare = Parameters<ReturnType<typeof createSfDecisionDomainServices>["compare"]>[0]
const actions = { "decision-coverage": "decisions.coverage", "decision-criteria": "decisions.criteria",
  "decision-select-portfolio": "decisions.select-portfolio", "decision-condition": "decisions.condition.record",
  "decision-edit": "decisions.edit", "decision-compare": "decisions.portfolio.read",
  "decision-portfolio-catalog": "decisions.portfolio.read" } as const

/** Human registry writes use the complete payload and the installation's current case. */
export function createSfDecisionDomainHttp(input: { origin: string; mount: string; runtime: () => SfDecisionHttpRuntime | undefined }) {
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    const mode = url.searchParams.get("sf")
    if (!mode || !Object.hasOwn(actions, mode) && mode !== "decision-controls" && mode !== "decision-list") return undefined
    const reply = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (surface !== "dashboard" && surface !== "planner" && surface !== "procurement" || url.origin !== input.origin || url.pathname !== `${input.mount}/${surface}` || request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "denied" }, 403)
    // GET lists only the cases this principal can read; never a public catalogue.
    if (mode === "decision-list") {
      if (request.method !== "GET") return reply({ status: "needs-input", reason: "method-not-allowed" }, 405)
      if (url.searchParams.size !== 1 || url.searchParams.getAll("sf").length !== 1)
        return reply({ status: "needs-input", reason: "invalid-decision-request" }, 400)
      const runtime = input.runtime()
      if (!runtime) return reply({ status: "unavailable", reason: "decision-list-unavailable" }, 503)
      const operation = "sf-human:decisions.portfolio.read"
      const digest = digestSfValue({ purpose: "decision-list" })
      const admitted = await runtime.authority.ui.admit(request, operation, digest)
      if (admitted.status !== "ok") return reply(admitted, replyStatus(admitted))
      try {
        if (!await runtime.authority.ui.validate(admitted.value, operation, digest))
          return reply({ status: "denied", reason: "decision-list-authority-unavailable" }, 403)
        const result = await runtime.domain.management.list(admitted.value)
        if (!await runtime.authority.ui.revalidate(admitted.value))
          return reply({ status: "denied", reason: "decision-list-authority-changed" }, 403)
        return reply(result, replyStatus(result))
      } catch { return reply({ status: "unavailable", reason: "decision-list-unavailable" }, 503) }
      finally { runtime.authority.ui.finish(admitted.value) }
    }
    if (mode === "decision-controls") {
      if (request.method !== "GET" && request.method !== "HEAD") return reply({ status: "needs-input", reason: "method-not-allowed" }, 405)
      const allowed = ["sf", "case", "source", "scenario", "baseline", "parameter", "format"]
      if ([...url.searchParams.keys()].some((key) => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1) || url.searchParams.has("format") && url.searchParams.get("format") !== "json") return reply({ status: "needs-input", reason: "invalid-decision-request" }, 400)
      const runtime = input.runtime()
      if (!runtime) return reply({ status: "unavailable" }, 503)
      try {
        const result = await readSfDecisionControls(runtime, request)
        if (result.status !== "ok" || url.searchParams.get("format") === "json") return reply(result, result.status === "ok" ? 200 : result.status === "denied" ? 403 : result.status === "stale" ? 409 : 503)
        const html = sfDecisionControlsHtml(result.value, surface)
        return new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff" } })
      } catch { return reply({ status: "unavailable", reason: "decision-controls-unavailable" }, 503) }
    }
    if (request.headers.get("origin") !== input.origin) return reply({ status: "denied" }, 403)
    if (request.method !== "POST") return reply({ status: "needs-input", reason: "method-not-allowed" }, 405)
    if ([...url.searchParams.keys()].some((key) => key !== "sf") || url.searchParams.getAll("sf").length !== 1 || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ status: "needs-input", reason: "invalid-decision-request" }, 400)
    const payload = await boundedJson(request)
    if (!record(payload) || !valid(mode, payload)) return reply({ status: "needs-input", reason: "invalid-decision-input" }, 400)
    const runtime = input.runtime()
    if (!runtime) return reply({ status: "unavailable" }, 503)
    const admitted = await runtime.authority.human.admit(request, actions[mode as keyof typeof actions], payload)
    if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
    try {
      const call = admitted.value
      if (mode === "decision-portfolio-catalog") {
        if (!validCatalog(payload)) return reply({ status: "needs-input", reason: "invalid-portfolio-catalog" }, 400)
        const catalog = await runtime.domain.portfolio.http.catalog(payload.caseRefs, call)
        if (!await runtime.authority.host.revalidate(call)) return reply({ status: "denied" }, 403)
        return reply(catalog, replyStatus(catalog))
      }
      if (!validCaseRef(payload.caseRef)) return reply({ status: "needs-input", reason: "invalid-case-ref" }, 400)
      const result = await runtime.business.withCase<unknown>(call, payload.caseRef,
        { allowHistoricalRetry: mode === "decision-edit" }, async (): Promise<PortResult<unknown>> => {
        if (mode === "decision-edit") return validEdit(payload)
          ? runtime.domain.management.edit(payload, call) : { status: "needs-input", reason: "invalid-case-edit" }
        if (mode === "decision-compare") return validCompare(payload)
          ? runtime.domain.compare(payload, call) : { status: "needs-input", reason: "invalid-comparison" }
        if (mode === "decision-coverage") return runtime.domain.baselineCoverage.register(payload as Parameters<typeof runtime.domain.baselineCoverage.register>[0], call)
        if (mode === "decision-criteria") return runtime.domain.criteria.register(payload as Parameters<typeof runtime.domain.criteria.register>[0], call)
        if (mode === "decision-select-portfolio") return runtime.domain.selection.register(payload as Parameters<typeof runtime.domain.selection.register>[0], call)
        const registered = await runtime.domain.conditions.register(payload as Parameters<typeof runtime.domain.conditions.register>[0], call)
        return registered.status === "ok" ? { status: "ok", value: { registered: true } } : { status: "unavailable", reason: "condition-selection-unavailable" }
      })
      if (!await runtime.authority.host.revalidate(call)) return reply({ status: "denied" }, 403)
      return reply(result, replyStatus(result))
    } catch { return reply({ status: "unavailable", reason: "decision-domain-unavailable" }, 503) }
    finally { runtime.authority.human.finish(admitted.value) }
  }
}

function replyStatus(value: { status: string }) {
  return value.status === "ok" ? 200 : value.status === "denied" ? 403 :
    value.status === "needs-input" || value.status === "invalid" ? 400 :
    value.status === "stale" || value.status === "conflict" ? 409 : 503
}
function validCaseRef(value: unknown): value is CaseRef {
  return record(value) && keys(value, ["id", "incarnation", "version"]) &&
    text(value.id) && text(value.incarnation) && integer(value.version, 1)
}
function validCatalog(value: Record<string, unknown>): value is Record<string, unknown> & { purpose: "catalog"; caseRefs: CaseRef[] } {
  return keys(value, ["purpose", "caseRefs"]) && value.purpose === "catalog" &&
    Array.isArray(value.caseRefs) && value.caseRefs.length > 0 && value.caseRefs.length <= 50 &&
    value.caseRefs.every(validCaseRef) &&
    new Set(value.caseRefs.map((ref: CaseRef) => JSON.stringify(ref))).size === value.caseRefs.length
}
function validCompare(value: Record<string, unknown>): value is Record<string, unknown> & Compare {
  return keys(value, ["caseRef", "baselineAlternativeId", "alternativeId", "criteria"]) &&
    validCaseRef(value.caseRef) && text(value.baselineAlternativeId) && text(value.alternativeId) &&
    value.baselineAlternativeId !== value.alternativeId && strings(value.criteria) && value.criteria.length > 0
}
function validEdit(value: Record<string, unknown>): value is Record<string, unknown> & Edit {
  return keys(value, ["caseRef", "objective", "criteria", "sourceRefs"], ["horizon", "currency", "assumptions"]) &&
    validCaseRef(value.caseRef) && text(value.objective) &&
    Array.isArray(value.criteria) && value.criteria.length > 0 && value.criteria.length <= 100 &&
    value.criteria.every((item: unknown) => record(item) &&
      keys(item, ["id", "description", "required"]) && text(item.id) && text(item.description) &&
      typeof item.required === "boolean") &&
    new Set(value.criteria.map((item: { id: string }) => item.id)).size === value.criteria.length &&
    Array.isArray(value.sourceRefs) && value.sourceRefs.length <= 100 && value.sourceRefs.every(record) &&
    (value.horizon === undefined || isSfPeriod(value.horizon)) &&
    (value.currency === undefined || typeof value.currency === "string" && /^[A-Z]{3}$/.test(value.currency)) &&
    (value.assumptions === undefined || Array.isArray(value.assumptions) && value.assumptions.length <= 100 &&
      value.assumptions.every((item: unknown) => record(item) && text(item.id) && text(item.text) &&
        ["open", "confirmed", "rejected"].includes(String(item.state)) && Array.isArray(item.evidenceRefs) &&
        item.evidenceRefs.every(record)))
}

function valid(mode: string, value: Record<string, unknown>) {
  if (mode === "decision-portfolio-catalog") return validCatalog(value)
  if (!validCaseRef(value.caseRef)) return false
  if (mode === "decision-edit") return validEdit(value)
  if (mode === "decision-compare") return validCompare(value)
  if (mode === "decision-coverage") return keys(value, ["caseRef", "source", "basis", "entries", "expectedVersion"]) && record(value.source) && value.source.kind === "record" && record(value.source.target) && record(value.basis) && objects(value.entries) && integer(value.expectedVersion)
  if (mode === "decision-criteria") return keys(value, ["caseRef", "criterionId", "metricRef", "operator", "value", "unit", "period", "evidenceRefs", "expectedRuleVersion"], ["sensitivity"]) &&
    text(value.criterionId) && text(value.metricRef) && ["lte", "gte", "eq"].includes(String(value.operator)) && typeof value.value === "number" && Number.isFinite(value.value) && text(value.unit) && isSfPeriod(value.period) && objects(value.evidenceRefs) && integer(value.expectedRuleVersion) && (value.sensitivity === undefined || record(value.sensitivity))
  if (mode === "decision-select-portfolio") return keys(value, ["caseRef", "baselineAlternativeId", "alternativeId", "criteria", "expectedVersion"]) && text(value.baselineAlternativeId) && text(value.alternativeId) && strings(value.criteria) && integer(value.expectedVersion)
  return keys(value, ["caseRef", "choiceId", "scenarioRefs", "source", "evidence", "fields", "period", "criterionId", "recipientRef", "destination", "label"]) &&
    [value.choiceId, value.criterionId, value.recipientRef, value.destination, value.label].every(text) && strings(value.scenarioRefs) && value.scenarioRefs.length === 2 &&
    record(value.source) && record(value.evidence) && value.evidence.kind === "record" && record(value.evidence.target) && strings(value.fields) && isSfPeriod(value.period)
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value) }
function text(value: unknown): value is string { return typeof value === "string" && !!value.trim() && value.length <= 16384 }
function integer(value: unknown, minimum = 0) { return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.length <= 512 && value.every(text) && new Set(value).size === value.length }
function objects(value: unknown): value is Record<string, unknown>[] { return Array.isArray(value) && value.length <= 512 && value.every(record) }
function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) { return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key)) }
async function boundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader()
  if (!reader) return undefined
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      length += result.value.byteLength
      if (length > 262144) { await reader.cancel(); return undefined }
      chunks.push(result.value)
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch { return undefined } finally { reader.releaseLock() }
}
