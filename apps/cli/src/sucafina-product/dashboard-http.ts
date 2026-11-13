import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { HotTopicDraftRequest } from "../../../../modules/sucafina/Sucafinav1/product/decisions/hot-topic-draft.ts"
import type { AdmittedApply, PreparedApplyRequest } from "../../../../modules/sucafina/Sucafinav1/product/decisions/receipt-review-binding.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { SfHumanAction } from "../../../../modules/sucafina/Sucafinav1/product/integration/human-authority.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { createSfDashboardServices, DashboardAgendaRequest, DashboardReviewRequest } from "./dashboard-services.ts"
import type { createSfDashboardDecisions, DashboardPrepareRequest } from "./dashboard-decisions.ts"

type Runtime = { authority: ReturnType<typeof createSfProductAuthority>; dashboard: ReturnType<typeof createSfDashboardServices>; decisions: ReturnType<typeof createSfDashboardDecisions> }
const modes = ["dashboard-agenda", "dashboard-review-preserve", "dashboard-review", "dashboard-capture", "dashboard-history", "dashboard-hot-topic-source",
  "dashboard-hot-topic-draft", "dashboard-hot-topic-drafts", "dashboard-hot-topic-operation", "dashboard-hot-topic-prepare", "dashboard-hot-topic-review", "dashboard-hot-topic-apply"] as const

/** Same-origin host routes. Browser payloads contain selections and human intent, never private commands. */
export function createSfDashboardHttp(input: { origin: string; mount: string; runtime: () => Runtime | undefined }) {
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    const mode = url.searchParams.get("sf")
    if (!modes.some((value) => value === mode)) return undefined
    const reply = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (surface !== "dashboard" || url.origin !== input.origin || url.pathname !== `${input.mount}/dashboard`) return reply({ status: "denied" }, 403)
    const read = ["dashboard-review", "dashboard-history", "dashboard-hot-topic-drafts"].includes(mode!)
    if (request.method !== (read ? "GET" : "POST")) return reply({ status: "denied" }, 405)
    const allowed = mode === "dashboard-hot-topic-drafts" ? ["sf", "id", "incarnation", "version"] : read ? ["sf", "id"] : ["sf"]
    if ([...url.searchParams.keys()].some((key) => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return reply({ status: "invalid" }, 400)
    if (!read && (request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site" || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))) return reply({ status: "denied" }, 403)
    const payload: unknown = read ? mode === "dashboard-hot-topic-drafts" ? { caseRef: { id: url.searchParams.get("id"), incarnation: url.searchParams.get("incarnation"), version: Number(url.searchParams.get("version")) } } : { id: url.searchParams.get("id") } : await boundedJson(request)
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return reply({ status: "invalid" }, 400)
    const runtime = input.runtime()
    if (!runtime) return reply({ status: "unavailable" }, 503)
    const action: SfHumanAction | undefined = ["dashboard-review-preserve", "dashboard-capture"].includes(mode!) ? "reviews.preserve" :
      mode === "dashboard-hot-topic-draft" ? "decisions.edit" : mode === "dashboard-hot-topic-prepare" ? "decisions.prepare-changes" : mode === "dashboard-hot-topic-apply" ? "decisions.apply" : undefined
    const digest = digestSfValue(payload)
    const admitted = action ? await runtime.authority.human.admit(request, action, payload) : await runtime.authority.ui.admit(request, "sf_dashboard_read", digest)
    if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
    try {
      if (!action && !await runtime.authority.ui.validate(admitted.value, "sf_dashboard_read", digest)) return reply({ status: "denied" }, 403)
      const result = await dispatch(runtime, mode!, payload, admitted.value)
      if (!result) return reply({ status: "invalid" }, 400)
      if (!await runtime.authority.host.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
      return reply(result, result.status === "ok" ? 200 : result.status === "denied" ? 403 : result.status === "stale" || result.status === "conflict" ? 409 : result.status === "needs-input" ? 400 : 503)
    } catch { return reply({ status: "unavailable", reason: "dashboard-operation-unavailable" }, 503) }
    finally { runtime.authority.ui.finish(admitted.value) }
  }
}

async function dispatch(runtime: Runtime, mode: string, value: unknown, context: TrustedDomainContext) {
  const payload = object(value)
  if (mode === "dashboard-agenda" && isAgenda(value)) return runtime.dashboard.agenda(value, context)
  if (mode === "dashboard-review-preserve" && isReview(value)) return runtime.dashboard.preserveReview(value, context)
  if (mode === "dashboard-review" && keys(payload, ["id"]) && text(payload.id)) return runtime.dashboard.readReview(payload.id, context)
  if (mode === "dashboard-history" && keys(payload, ["id"]) && text(payload.id)) return runtime.dashboard.reopen(payload.id, context)
  if (mode === "dashboard-capture" && keys(payload, ["sourceRef"]) && text(payload.sourceRef)) return runtime.dashboard.capture({ sourceRef: payload.sourceRef }, context)
  if (mode === "dashboard-hot-topic-source" && keys(payload, ["recordId", "period"]) && text(payload.recordId) && isSfPeriod(payload.period)) {
    const result = await runtime.dashboard.issue({ surface: "dashboard", recordType: "hotTopics", recordId: payload.recordId, fields: ["action", "due", "notes", "owner", "priority"], period: payload.period }, context)
    if (result.status !== "ok") return result
    const request = runtime.authority.host.requestFor(context)
    if (!request) return { status: "denied" as const, reason: "source-access-unavailable" }
    const environment = await runtime.authority.host.environment(request)
    return { status: "ok" as const, value: { targetEvidence: result.value, target: { surface: "dashboard" as const, type: "hotTopics", id: result.value.target.recordId,
      incarnation: result.value.target.incarnation, version: result.value.target.version, fields: result.value.target.fields, period: payload.period, observedAt: environment.at } } }
  }
  if (mode === "dashboard-hot-topic-draft" && isDraft(value)) return runtime.decisions.drafts.register(value, context)
  if (mode === "dashboard-hot-topic-drafts" && keys(payload, ["caseRef"]) && isCaseRef(payload.caseRef)) return runtime.decisions.drafts.list({ caseRef: payload.caseRef }, context)
  if (mode === "dashboard-hot-topic-operation" && keys(payload, ["caseRef", "draftRef", "operation"]) && isCaseRef(payload.caseRef) && text(payload.draftRef)) {
    const operation = object(payload.operation)
    if (keys(operation, ["kind", "targetRef", "replacementRef"]) && operation.kind === "replace" && text(operation.targetRef) && text(operation.replacementRef))
      return runtime.decisions.resolveOperation({ caseRef: payload.caseRef, draftRef: payload.draftRef, operation: { kind: "replace", targetRef: operation.targetRef, replacementRef: operation.replacementRef } }, context)
  }
  if (mode === "dashboard-hot-topic-prepare" && isPrepare(value)) return runtime.decisions.prepare(value, context)
  if (mode === "dashboard-hot-topic-review" && isApplyRef(value)) return runtime.decisions.review(value, context)
  if (mode === "dashboard-hot-topic-apply" && isApply(value)) return runtime.decisions.apply(value, context)
  return undefined
}
function text(value: unknown): value is string { return typeof value === "string" && !!value.trim() && value.length <= 16_384 }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.length <= 512 && value.every(text) && new Set(value).size === value.length }
function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) { return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key)) }
function isCaseRef(value: unknown): value is PreparedApplyRequest["caseRef"] {
  const ref = object(value)
  return keys(ref, ["id", "incarnation", "version"]) && text(ref.id) && text(ref.incarnation) && typeof ref.version === "number" && Number.isSafeInteger(ref.version) && ref.version >= 0
}
function isApplyRef(value: unknown): value is PreparedApplyRequest { const request = object(value); return keys(request, ["caseRef", "choiceId", "changeId"]) && isCaseRef(request.caseRef) && text(request.choiceId) && text(request.changeId) }
function isApply(value: unknown): value is AdmittedApply { const request = object(value); return keys(request, ["caseRef", "choiceId", "changeId", "reviewDigest"]) && isApplyRef({ caseRef: request.caseRef, choiceId: request.choiceId, changeId: request.changeId }) && typeof request.reviewDigest === "string" && /^[a-f0-9]{64}$/.test(request.reviewDigest) }
function isPrepare(value: unknown): value is DashboardPrepareRequest { const request = object(value); return keys(request, ["caseRef", "choiceId", "draftRef"]) && isCaseRef(request.caseRef) && text(request.choiceId) && text(request.draftRef) }
function isReview(value: unknown): value is DashboardReviewRequest { const request = object(value); return keys(request, ["selectionRef", "sectionRefs"], ["previousReviewRef"]) && text(request.selectionRef) && strings(request.sectionRefs) && (request.previousReviewRef === undefined || text(request.previousReviewRef)) }
function isAgenda(value: unknown): value is DashboardAgendaRequest {
  const request = object(value)
  return keys(request, ["sections"]) && Array.isArray(request.sections) && request.sections.length > 0 && request.sections.length <= 30 && request.sections.every((value) => {
    const section = object(value)
    return keys(section, ["id", "title", "selectionRef", "topic", "period"], ["recordRefs"]) && text(section.id) && text(section.title) && text(section.selectionRef) && text(section.topic) && isSfPeriod(section.period) && (section.recordRefs === undefined || strings(section.recordRefs))
  })
}
function isDraft(value: unknown): value is HotTopicDraftRequest {
  const request = object(value)
  const target = object(request.target)
  const evidence = object(request.targetEvidence)
  const fields = object(request.fields)
  const record = object(evidence.target)
  return keys(request, ["caseRef", "target", "targetEvidence", "fields", "sourceRefs", "expectedVersion"], ["draftRef"]) && isCaseRef(request.caseRef) &&
    keys(target, ["surface", "type", "id", "incarnation", "version", "fields", "period", "observedAt"]) && target.surface === "dashboard" && target.type === "hotTopics" && text(target.id) && text(target.incarnation) && typeof target.version === "number" && Number.isSafeInteger(target.version) && target.version >= 0 && strings(target.fields) && isSfPeriod(target.period) && text(target.observedAt) &&
    evidence.schema === "sf-evidence-v1" && evidence.kind === "record" && text(evidence.refId) && text(evidence.refDigest) && text(evidence.installationId) && text(evidence.projectId) && record.surface === "dashboard" && record.recordType === "hotTopics" && text(record.recordId) && text(record.incarnation) && typeof record.version === "number" && strings(record.fields) && isSfPeriod(record.period) && text(record.projectionDigest) &&
    keys(fields, ["action", "owner", "due", "priority", "notes"]) && text(fields.action) && text(fields.owner) && text(fields.due) && ["critical", "high", "normal"].includes(String(fields.priority)) && typeof fields.notes === "string" && fields.notes.length <= 16_384 &&
    Array.isArray(request.sourceRefs) && request.sourceRefs.length > 0 && request.sourceRefs.length <= 100 && request.sourceRefs.every((ref) => object(ref).kind === "record" && text(object(ref).refId)) &&
    typeof request.expectedVersion === "number" && Number.isSafeInteger(request.expectedVersion) && request.expectedVersion >= 0 && (request.draftRef === undefined || text(request.draftRef))
}
async function boundedJson(request: Request): Promise<unknown> {
  if (!request.body) return undefined
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.length
      if (size > 65_536) { await reader.cancel(); return undefined }
      chunks.push(part.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch { return undefined }
  finally { reader.releaseLock() }
}
