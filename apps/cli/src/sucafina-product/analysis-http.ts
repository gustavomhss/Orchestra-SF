import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { SfHostServices } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { SfSkillInputMap } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { SfAnalysisInputPort, SfAnalysisRequest } from "../../../../modules/sucafina/Sucafinav1/product/interface/analysis-input-port.ts"
import type { TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"

type Analyses = NonNullable<SfHostServices["analyses"]>
export type SfReviewAuthorSelection = { runRef: string; outputDigest: string }
export type SfAnalysisStartInput = Parameters<Analyses["start"]>[1] & { authorAnalysis?: SfReviewAuthorSelection }
type Runtime = Pick<SfHostServices, "human" | "selected" | "models"> & {
  inputs: SfAnalysisInputPort
  start: (context: TrustedUiContext, input: SfAnalysisStartInput) => ReturnType<Analyses["start"]>
  choices?: (request: Request) => Promise<PortResult<unknown>>
}

/** Prepare/start use the complete host registry. Existing history/output routes remain in WP01.
 * Reviewers select an author result; native sessions and review bindings are derived privately.
 */
export function createSfAnalysisHttp(input: { origin: string; mount: string; runtime: () => Runtime | undefined }) {
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.searchParams.get("sf") !== "workbench-analysis") return undefined
    if (url.origin !== input.origin || !["dashboard", "planner", "procurement"].includes(surface) || url.pathname !== `${input.mount}/${surface}` ||
      request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "denied" }, 403)
    if (request.method !== "POST") return reply({ status: "needs-input", reason: "analysis-post-required" }, 405)
    if ([...url.searchParams.keys()].some((key) => key !== "sf") || url.searchParams.getAll("sf").length !== 1 ||
      request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json" ||
      !/^[A-Za-z0-9._:-]{8,128}$/.test(request.headers.get("idempotency-key") ?? "")) return reply({ status: "needs-input", reason: "analysis-request-invalid" }, 400)
    const bytes = await bounded(request.clone(), 65536).catch(() => undefined)
    if (!bytes) { void request.body?.cancel().catch(() => undefined); return reply({ status: "needs-input", reason: "analysis-request-too-large" }, 413) }
    const body: unknown = await Promise.resolve().then(() => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))).catch(() => undefined)
    if (!record(body)) return reply({ status: "needs-input", reason: "analysis-request-invalid" }, 400)
    if (body.action === "choices") {
      if (!closed(body, ["action"])) return reply({ status: "needs-input", reason: "analysis-request-invalid" }, 400)
      const runtime = input.runtime()
      if (!runtime?.choices) return reply({ status: "unavailable", reason: "analysis-choices-unavailable" }, 503)
      const result = await runtime.choices(request).catch(() => ({ status: "unavailable" as const, reason: "analysis-choices-unavailable" }))
      return resultReply(result)
    }
    if (body.action !== "prepare" && body.action !== "start") return undefined
    if (!closed(body, ["action", "input"]) || !record(body.input)) return reply({ status: "needs-input", reason: "analysis-request-invalid" }, 400)
    const runtime = input.runtime()
    if (!runtime) return reply({ status: "unavailable", reason: "analysis-runtime-unavailable" }, 503)
    const wanted = body.input
    const analysis = readRequest(wanted.request)
    if (!analysis) return reply({ status: "needs-input", reason: "analysis-request-invalid" }, 400)
    const parent = runtime.selected.find((entry) => entry.profile.id === analysis.profileId && entry.profile.version === analysis.profileVersion && entry.manifestDigest === analysis.manifestDigest)
    const skill = parent?.skills.find((entry) => entry.id === analysis.skillId && entry.version === analysis.skillVersion)
    if (!parent || !skill || new Set(analysis.requestedOperationScope).size !== analysis.requestedOperationScope.length ||
      analysis.requestedOperationScope.some((operation) => !skill.allowedOperations.includes(operation) || !parent.operationIds.includes(operation))) return reply({ status: "denied", reason: "analysis-selection-unavailable" }, 403)
    if (body.action === "prepare") {
      if (!closed(wanted, ["request", "selection"]) || !record(wanted.selection)) return reply({ status: "needs-input", reason: "analysis-selection-invalid" }, 400)
      const selected = { request: analysis, selection: wanted.selection }
      const admitted = await runtime.human.admit(request, "analysis.prepare", selected)
      if (admitted.status !== "ok") return resultReply(admitted)
      try {
        const result = await runtime.inputs.prepare(admitted.value, selected)
        if (!await runtime.human.authorize(admitted.value, "analysis.prepare", selected)) return reply({ status: "denied", reason: "analysis-authority-changed" }, 403)
        if (result.status === "ok" && !decodeSfSkillInput(skill.inputSchemaRef as keyof SfSkillInputMap, result.value).ok) return reply({ status: "unavailable", reason: "analysis-input-invalid" }, 503)
        return resultReply(result)
      } catch { return reply({ status: "unavailable", reason: "analysis-input-unavailable" }, 503) }
      finally { runtime.human.finish(admitted.value) }
    }
    if (!closed(wanted, ["request", "skillInput", "model"], ["authorAnalysis"])) return reply({ status: "needs-input", reason: "analysis-start-invalid" }, 400)
    const author = wanted.authorAnalysis === undefined ? undefined : readReviewAuthor(wanted.authorAnalysis)
    if (wanted.authorAnalysis !== undefined && (!author || skill.id !== "sf-revisar-evidencias") || skill.id === "sf-revisar-evidencias" && !author) return reply({ status: "needs-input", reason: "review-author-selection-required" }, 400)
    if (!decodeSfSkillInput(skill.inputSchemaRef as keyof SfSkillInputMap, wanted.skillInput).ok) return reply({ status: "needs-input", reason: "analysis-input-invalid" }, 400)
    const model = (await runtime.models().catch(() => [])).find((entry) => digestSfValue(entry) === digestSfValue(wanted.model))
    if (!model) return reply({ status: "unavailable", reason: "analysis-model-unavailable" }, 503)
    const selected: SfAnalysisStartInput = { request: analysis, skillInput: wanted.skillInput, model, ...(author ? { authorAnalysis: author } : {}) }
    const admitted = await runtime.human.admit(request, "analysis.start", selected)
    if (admitted.status !== "ok") return resultReply(admitted)
    try {
      const result = await runtime.start(admitted.value, selected)
      if (!await runtime.human.authorize(admitted.value, "analysis.start", selected)) return reply({ status: "denied", reason: "analysis-authority-changed" }, 403)
      return resultReply(result)
    } catch { return reply({ status: "unavailable", reason: "analysis-start-unavailable" }, 503) }
    finally { runtime.human.finish(admitted.value) }
  }
}

function readReviewAuthor(value: unknown): SfReviewAuthorSelection | undefined {
  return record(value) && closed(value, ["runRef", "outputDigest"]) && typeof value.runRef === "string" && !!value.runRef.trim() &&
    typeof value.outputDigest === "string" && /^[a-f0-9]{64}$/.test(value.outputDigest) ? { runRef: value.runRef, outputDigest: value.outputDigest } : undefined
}
function readRequest(value: unknown): SfAnalysisRequest | undefined {
  if (!record(value) || !closed(value, ["caseRef", "objective", "profileId", "profileVersion", "skillId", "skillVersion", "manifestDigest", "outputSchemaVersion", "requestedOperationScope"]) ||
    !record(value.caseRef) || !closed(value.caseRef, ["id", "incarnation", "version"]) || typeof value.caseRef.id !== "string" || !value.caseRef.id.trim() ||
    typeof value.caseRef.incarnation !== "string" || !value.caseRef.incarnation.trim() || typeof value.caseRef.version !== "number" || !Number.isSafeInteger(value.caseRef.version) || value.caseRef.version < 1 ||
    typeof value.objective !== "string" || !value.objective.trim() || typeof value.profileId !== "string" || typeof value.profileVersion !== "string" ||
    typeof value.skillId !== "string" || typeof value.skillVersion !== "string" || typeof value.manifestDigest !== "string" || value.outputSchemaVersion !== "sf-contribution-v1" ||
    !Array.isArray(value.requestedOperationScope) || value.requestedOperationScope.length > 39 || value.requestedOperationScope.some((operation) => typeof operation !== "string" || !operation.trim())) return undefined
  return { caseRef: { id: value.caseRef.id, incarnation: value.caseRef.incarnation, version: value.caseRef.version }, objective: value.objective,
    profileId: value.profileId, profileVersion: value.profileVersion, skillId: value.skillId, skillVersion: value.skillVersion, manifestDigest: value.manifestDigest,
    outputSchemaVersion: value.outputSchemaVersion, requestedOperationScope: value.requestedOperationScope }
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype }
function closed(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) { return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key)) }
function reply(value: unknown, status: number) { return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }) }
function resultReply(value: { status: string }) { return reply(value, value.status === "ok" ? 200 : value.status === "denied" ? 403 : value.status === "needs-input" ? 400 : ["stale", "conflict", "provider-conflict"].includes(value.status) ? 409 : 503) }
async function bounded(request: Request, limit: number) {
  if (!request.body) return undefined
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const part = await reader.read()
    if (part.done) break
    length += part.value.byteLength
    if (length > limit) { void reader.cancel().catch(() => undefined); return undefined }
    chunks.push(part.value)
  }
  const bytes = new Uint8Array(length)
  chunks.reduce((offset, chunk) => { bytes.set(chunk, offset); return offset + chunk.byteLength }, 0)
  return bytes
}
