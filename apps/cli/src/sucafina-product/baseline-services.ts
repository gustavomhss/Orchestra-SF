import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { requiredSfCostCategories } from "../../../../modules/sucafina/Sucafinav1/product/contracts/coverage-inventory.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { CostCoverageEntry } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { createDecisionBaselineCoverage } from "../../../../modules/sucafina/Sucafinav1/product/decisions/baseline-coverage.ts"
import type { BaselineCoverageRequest } from "../../../../modules/sucafina/Sucafinav1/product/decisions/baseline-coverage.ts"
import { createDecisionBaselineFence, verifyDecisionPlannerSources } from "../../../../modules/sucafina/Sucafinav1/product/decisions/baseline-fence.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { createDecisionIntentFences } from "../../../../modules/sucafina/Sucafinav1/product/decisions/intent-fences.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { createSfBusinessServices } from "./business-services.ts"

/** Human classifications bind actual Planner components, current C08 and the exact admitted command. */
export function createSfBaselineServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  proposalCoverageWrites: WeakSet<object>
  origin: string
  mount: string
}) {
  const { authority, business } = input
  const host = authority.host
  const actors = new WeakMap<TrustedDomainContext, { actor: Actor; requestDigest: string }>()
  const intent = createDecisionIntentFences({ human: authority.human, ui: authority.ui,
    readSourceFences: business.readSourceFences, lockedSourceFences: business.lockedSourceFences })
  const fence = createDecisionBaselineFence({
    resolveActor: (_snapshot, call) => actors.get(call)?.actor,
    matchesIntent: (call, action, payload) => intent.verify(call, action, payload),
  })
  const core = createDecisionBaselineCoverage({ state: authority.state, host, resolveCase: business.resolveCase,
    authorizeCase: business.authorizeCase, operationIdentity: business.operationIdentity, proposalCoverageWrites: input.proposalCoverageWrites,
    now: () => new Date().toISOString(),
    authorizeCoverage: async (request, call) => {
      const http = host.requestFor(call)
      if (!http || !await intent.authorize(call, "decisions.coverage", request)) return false
      const selected = await business.resolveCase(call)
      if (selected.status !== "ok" || digestSfValue(selected.value) !== digestSfValue(request.caseRef)) return false
      const actor = await host.persistence.transaction("planner", async (snapshot) => {
        const principal = await host.authenticate(http, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
        if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
        const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
        const access = object(object(snapshot.data.access)[principal.id])
        if ([access.assigned, access.domains].some((value) => value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))))
          return { commit: false, value: undefined }
        const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
        const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: strings(access.assigned), domains: strings(access.domains) }
        return { commit: false, value: verifyDecisionPlannerSources(snapshot, coverageRefs(request), actor, call) ? actor : undefined }
      }, { signal: http.signal })
      if (!actor || http.signal.aborted || !await authority.human.authorize(call, "decisions.coverage", request) || !await host.revalidate(call)) return false
      const prior = actors.get(call), requestDigest = digestSfValue(request)
      if (prior && (prior.requestDigest !== requestDigest || digestSfValue(prior.actor) !== digestSfValue(actor))) return false
      actors.set(call, { actor: structuredClone(actor), requestDigest })
      return true
    },
    projectForecast: async (sourceRef, caseRef, call) => {
      const selected = await business.resolveCase(call)
      if (selected.status !== "ok" || digestSfValue(selected.value) !== digestSfValue(caseRef)) return { status: "denied", reason: "baseline-case-selection-mismatch" }
      const current = await business.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
      if (current.status !== "ok") return current
      if (current.value.case.version !== caseRef.version) return { status: "stale", reason: "baseline-case-changed" }
      const source = await business.plannerSources.resolveForecastSource(sourceRef, call)
      if (source.status !== "ok") return source
      if (current.value.case.currency !== "USD") return { status: "needs-input", reason: "planner-requires-usd" }
      // Use the producer's projection for the exact case period. compareForecast reads coverage,
      // so calling it here would recurse while validating an already registered partial year.
      return business.projectPlannerEvidence(source.value.evidence, call, { period: current.value.case.horizon, currency: "USD" })
    },
    resolveEvidence: (refs, call) => business.context.context({ refs }, call),
    // Registration rejects non-applicability below until a category-specific producer exists.
    // Included entries are verified by the published classification/component verifier instead.
    supports: () => false,
    verifySnapshot: (snapshot, request, record, call) => actors.get(call)?.requestDigest === digestSfValue(request) &&
      intent.verify(call, "decisions.coverage", request) && fence(snapshot, request, record, call),
  })
  const register = async (request: BaselineCoverageRequest, call: TrustedDomainContext): ReturnType<typeof core.register> => {
    if (!isSfBaselineCoverageRequest(request)) return { status: "needs-input", reason: "invalid-baseline-coverage-request" }
    if (!await authority.human.authorize(call, "decisions.coverage", request)) return { status: "denied", reason: "human-baseline-coverage-required" }
    if (!requiredSfCostCategories(request.basis)) return { status: "needs-input", reason: "baseline-coverage-inventory-unavailable" }
    if (request.entries.some((entry) => entry.status === "not-applicable")) return { status: "needs-input", reason: "baseline-non-applicability-producer-unavailable" }
    if (coverageRefs(request).some((ref) => ref.kind !== "record" || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version"))
      return { status: "needs-input", reason: "baseline-external-source-fence-unavailable" }
    return core.register(request, call)
  }
  const baseline = { ...core, register }
  const productHttp = async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.searchParams.get("sf") !== "baseline-coverage") return undefined
    if (url.origin !== input.origin || !["dashboard", "planner"].includes(surface) || url.pathname !== `${input.mount}/${surface}` ||
      request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site" || request.signal.aborted)
      return reply({ status: "denied", reason: "baseline-coverage-origin-unavailable" })
    if (request.method !== "POST") return reply({ status: "needs-input", reason: "method-not-allowed" }, 405)
    if (url.searchParams.getAll("sf").length !== 1 || [...url.searchParams.keys()].some((key) => key !== "sf")) return reply({ status: "needs-input", reason: "invalid-query" }, 400)
    if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return reply({ status: "needs-input", reason: "invalid-content-type" }, 415)
    const decoded = await readRequest(request)
    if (decoded.status !== "ok") return reply(decoded, decoded.reason === "body-too-large" ? 413 : 400)
    const admitted = await authority.human.admit(request, "decisions.coverage", decoded.value)
    if (admitted.status !== "ok") return reply(admitted)
    try {
      const result = await business.withCase(admitted.value, decoded.value.caseRef, {}, () => register(decoded.value, admitted.value))
      return reply(result)
    } catch { return reply({ status: "unavailable", reason: "baseline-coverage-request-unavailable" }) }
    finally { actors.delete(admitted.value); authority.human.finish(admitted.value) }
  }
  return { baseline, productHttp }
}

function coverageRefs(request: BaselineCoverageRequest): readonly BusinessEvidenceRef[] {
  return [request.source, ...request.basis.sourceRefs, ...request.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
}

/** Same closed shape as the published decision-coverage command, with bounded HTTP collections. */
export function isSfBaselineCoverageRequest(value: unknown): value is BaselineCoverageRequest {
  if (!record(value) || !closed(value, ["caseRef", "source", "basis", "entries", "expectedVersion"]) ||
    !record(value.caseRef) || !closed(value.caseRef, ["id", "incarnation", "version"]) || !text(value.caseRef.id) || !text(value.caseRef.incarnation) || !version(value.caseRef.version) ||
    !Number.isSafeInteger(value.expectedVersion) || Number(value.expectedVersion) < 0 || !record(value.source) || value.source.kind !== "record" ||
    !decodeSfOperationInput("sf_source_get", { evidenceRef: value.source }).ok || !record(value.basis) ||
    !closed(value.basis, ["id", "version", "decisionType", "categoryIds", "additionalCategoryIds", "sourceRefs"]) || !text(value.basis.id) || !version(value.basis.version) ||
    !text(value.basis.decisionType) || !texts(value.basis.categoryIds, 128) || !texts(value.basis.additionalCategoryIds, 128) || !refs(value.basis.sourceRefs) ||
    !Array.isArray(value.entries) || value.entries.length > 256 || !value.entries.every(coverageEntry)) return false
  return true
}

function coverageEntry(value: unknown): value is CostCoverageEntry {
  if (!record(value) || !text(value.categoryId)) return false
  if (value.status === "pending") return closed(value, ["categoryId", "status", "reason"], ["questionRef"]) && text(value.reason) && (value.questionRef === undefined || text(value.questionRef))
  if (value.status === "not-applicable") return closed(value, ["categoryId", "status", "justification", "evidenceRefs"]) && text(value.justification) && refs(value.evidenceRefs)
  if (value.status === "included") return closed(value, ["categoryId", "status", "componentRefs", "evidenceRefs", "scopeNote"]) && texts(value.componentRefs, 4096) && value.componentRefs.length > 0 && refs(value.evidenceRefs) && text(value.scopeNote)
  return false
}

async function readRequest(request: Request): Promise<PortResult<BaselineCoverageRequest>> {
  const reader = request.body?.getReader()
  if (!reader) return { status: "needs-input", reason: "body-required" }
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      if (request.signal.aborted) return { status: "unavailable", reason: "cancelled" }
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 256 * 1024) { void reader.cancel().catch(() => undefined); return { status: "needs-input", reason: "body-too-large" } }
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
    return isSfBaselineCoverageRequest(value) ? { status: "ok", value } : { status: "needs-input", reason: "invalid-baseline-coverage-request" }
  } catch { return { status: "needs-input", reason: "invalid-body" } }
  finally { reader.releaseLock() }
}

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype }
function closed(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) { return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key)) }
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= 16384 }
function texts(value: unknown, limit: number): value is string[] { return Array.isArray(value) && value.length <= limit && value.every(text) }
function version(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0 }
function refs(value: unknown) { return Array.isArray(value) && value.length <= 256 && value.every((ref) => decodeSfOperationInput("sf_source_get", { evidenceRef: ref }).ok) }
function reply(result: PortResult<unknown>, status?: number) {
  return new Response(JSON.stringify(result), { status: status ?? (result.status === "ok" ? 200 : result.status === "needs-input" ? 400 : result.status === "denied" ? 403 : result.status === "stale" || result.status === "conflict" ? 409 : 503),
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
}
