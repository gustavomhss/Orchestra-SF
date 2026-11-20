import type { SfHostServices } from "../contracts/host-context.ts"
import type { SfAnalysisRequest } from "./analysis-input-port.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfSkillInput } from "../contracts/schema-admission.ts"
import { contribution } from "../ui/components.ts"
import { hasCaseAnalysisInput, prepareCaseAnalysisInput } from "./case-analysis-input.ts"
import { prepareReviewAnalysisInput, reviewAnalysisOffer } from "./review-analysis-input.ts"

type AnalysisHttpRuntime = Pick<SfHostServices, "human" | "ui" | "models" | "analyses" | "analysisInputs" | "selected" | "dispatch">

/** The host owns authorization and execution; this boundary exposes no native binding. */
export async function handleSfAnalysis(request: Request, origin: string, runtime: AnalysisHttpRuntime) {
  const reply = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
  if (request.method !== "POST") return reply({ status: "denied" }, 405)
  if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "denied" }, 403)
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json") || !/^[A-Za-z0-9._:-]{8,128}$/.test(request.headers.get("idempotency-key") ?? "")) return reply({ status: "invalid" }, 400)
  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > 65536) return reply({ status: "invalid" }, 413)
  const parsed: unknown = await Promise.resolve().then(() => JSON.parse(body)).catch(() => undefined)
  if (!record(parsed) || (parsed.action !== "prepare" && parsed.action !== "start" && parsed.action !== "read" && parsed.action !== "cancel" && parsed.action !== "list" && parsed.action !== "output")) return reply({ status: "invalid" }, 400)
  if (!runtime.analyses) return reply({ status: "unavailable" }, 503)
  const action = parsed.action
  const input = action === "prepare" ? prepareInput(parsed.input) : action === "start" ? await analysisInput(parsed.input, runtime) : action === "list" ? caseInput(parsed.caseRef) : nonempty(parsed.runRef) ? { runRef: parsed.runRef } : undefined
  if (!input || Object.keys(parsed).some((key) => key !== "action" && key !== (action === "start" || action === "prepare" ? "input" : action === "list" ? "caseRef" : "runRef"))) return reply({ status: "invalid" }, 400)
  const admitted = await runtime.human.admit(request, action === "list" || action === "output" ? "analysis.read" : `analysis.${action}`, input)
  if (admitted.status !== "ok") return reply({ status: admitted.status }, admitted.status === "unavailable" ? 503 : 403)
  try {
    if (action === "prepare" && "selection" in input) {
      if (!selectedRequest(runtime, input.request)) return reply({ status: "denied" }, 403)
      const prepared = await (hasCaseAnalysisInput(input.request.skillId)
        ? prepareCaseAnalysisInput(request, runtime, input)
        : input.request.skillId === "sf-contestar-decisao"
          ? prepareReviewAnalysisInput(request, runtime, input)
          : runtime.analysisInputs?.prepare(admitted.value, input) ?? Promise.resolve(undefined)).catch(() => undefined)
      if (!prepared) return reply({ status: "unavailable" }, 503)
      if (prepared.status !== "ok") return reply({ status: prepared.status }, statusCode(prepared.status))
      const decoded = preparedInput(input.request.skillId, prepared.value)
      if (!decoded?.ok) return reply({ status: "unavailable" }, 503)
      if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
      return reply({ status: "ok", value: decoded.value }, 200)
    }
    const result = await (action === "start" && "request" in input && "skillInput" in input ? runtime.analyses.start(admitted.value, input)
      : action === "read" && "runRef" in input ? runtime.analyses.read(admitted.value, input.runRef)
      : action === "output" && "runRef" in input ? runtime.analyses.output(admitted.value, input.runRef)
      : action === "list" && "caseRef" in input ? runtime.analyses.list(admitted.value, input.caseRef)
      : action === "cancel" && "runRef" in input ? runtime.analyses.cancel(admitted.value, input.runRef) : Promise.resolve(undefined)).catch(() => undefined)
    if (!result) return reply({ status: "unavailable" }, 503)
    if (result.status !== "ok") return reply({ status: result.status }, statusCode(result.status))
    if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
    if (action === "read" && runRead(result.value)) {
      const value = result.value
      return reply({ status: "ok", value: { runRef: value.runRef, state: value.state, version: value.version, ...(typeof value.outputRef === "string" ? { outputRef: value.outputRef } : {}) } }, 200)
    }
    if (action === "output" && "runRef" in input && "kind" in result.value) {
      const output = result.value
      const html = await Promise.resolve().then(() => contribution(output)).catch(() => undefined)
      if (!html) return reply({ status: "unavailable" }, 503)
      const review = await reviewAnalysisOffer(request, runtime, input.runRef, output).catch(() => undefined)
      // Optional discovery reads current case/author/model policy too. Its await
      // cannot revive an output whose original read admission has been revoked.
      if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
      return reply({ status: "ok", value: { html, ...(output.state === "ready" ? { outputRef: output.id } : {}),
        ...(review ? { review } : { reviewUnavailable: true }) } }, 200)
    }
    return reply({ status: "ok", value: result.value }, 200)
  } finally { runtime.human.finish(admitted.value) }
}

function statusCode(status: string) {
  return status === "denied" ? 403 : status === "stale" || status === "conflict" ? 409 : status === "needs-input" ? 400 : 503
}

function selectedRequest(runtime: AnalysisHttpRuntime, request: SfAnalysisRequest) {
  const parents = runtime.selected.filter((item) => item.profile.id === request.profileId && item.profile.version === request.profileVersion && item.manifestDigest === request.manifestDigest)
  if (parents.length !== 1 || request.outputSchemaVersion !== "sf-contribution-v1") return false
  const parent = parents[0]!
  const skills = parent.skills.filter((item) => item.id === request.skillId && item.version === request.skillVersion)
  if (skills.length !== 1 || new Set(request.requestedOperationScope).size !== request.requestedOperationScope.length) return false
  const skill = skills[0]!
  const kind = inputKind(request.skillId)
  return !!kind && skill.input_type === kind && request.requestedOperationScope.every((operation) =>
    parent.operationIds.includes(operation) && parent.profile.allowedOperations.includes(operation) && skill.allowedOperations.includes(operation))
}

function inputKind(skillId: string) {
  if (skillId === "sf-enquadrar-decisao") return "DecisionIntentInput"
  if (skillId === "sf-comparar-cenarios") return "ScenarioComparisonInput"
  if (skillId === "sf-contestar-decisao") return "DecisionCritiqueInput"
  if (skillId === "sf-explicar-forecast") return "ForecastExplainInput"
}

function preparedInput(skillId: string, value: unknown) {
  const kind = inputKind(skillId)
  return kind ? decodeSfSkillInput(kind, value) : undefined
}

function runRead(value: unknown): value is { runRef: string; state: unknown; version: unknown; outputRef?: string } {
  return !!value && typeof value === "object" && "runRef" in value && typeof value.runRef === "string" && "state" in value && "version" in value
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && !!value.trim()
}

function caseInput(value: unknown) {
  if (!record(value) || Object.keys(value).some((key) => !["id", "incarnation", "version"].includes(key)) ||
    !nonempty(value.id) || !nonempty(value.incarnation) || typeof value.version !== "number" || !Number.isSafeInteger(value.version) || value.version < 0) return undefined
  return { caseRef: { id: value.id, incarnation: value.incarnation, version: value.version } }
}

async function analysisInput(value: unknown, runtime: AnalysisHttpRuntime) {
  if (!record(value) || Object.keys(value).some((key) => !["request", "skillInput", "model"].includes(key)) || !("skillInput" in value) || !record(value.request)) return undefined
  const request = analysisRequest(value.request)
  if (!request) return undefined
  const model = (await runtime.models().catch(() => [])).find((item) => digestSfValue(item) === digestSfValue(value.model))
  if (!model) return undefined
  return { request, skillInput: value.skillInput, model }
}

function prepareInput(value: unknown) {
  if (!record(value) || Object.keys(value).some((key) => !["request", "selection"].includes(key)) || !record(value.selection)) return undefined
  const request = analysisRequest(value.request)
  if (!request || !inputKind(request.skillId)) return undefined
  return { request, selection: value.selection }
}

function analysisRequest(value: unknown): SfAnalysisRequest | undefined {
  if (!record(value) || Object.keys(value).some((key) => !["caseRef", "profileId", "profileVersion", "skillId", "skillVersion", "manifestDigest", "outputSchemaVersion", "requestedOperationScope", "objective"].includes(key))) return undefined
  const parsed = caseInput(value.caseRef)
  if (!parsed || !nonempty(value.profileId) || !nonempty(value.profileVersion) || !nonempty(value.skillId) || !nonempty(value.skillVersion) ||
    !nonempty(value.manifestDigest) || !nonempty(value.outputSchemaVersion) || !nonempty(value.objective) ||
    !Array.isArray(value.requestedOperationScope) || !value.requestedOperationScope.every(nonempty)) return undefined
  return { caseRef: parsed.caseRef, profileId: value.profileId, profileVersion: value.profileVersion, skillId: value.skillId, skillVersion: value.skillVersion,
    manifestDigest: value.manifestDigest, outputSchemaVersion: value.outputSchemaVersion, requestedOperationScope: value.requestedOperationScope, objective: value.objective }
}
