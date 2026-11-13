import type { SfHostServices } from "../contracts/host-context.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { contribution } from "../ui/components.ts"

/** The host owns authorization and execution; this boundary exposes no native binding. */
export async function handleSfAnalysis(request: Request, origin: string, runtime: SfHostServices) {
  const reply = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
  if (request.method !== "POST") return reply({ status: "denied" }, 405)
  if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "denied" }, 403)
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json") || !/^[A-Za-z0-9._:-]{8,128}$/.test(request.headers.get("idempotency-key") ?? "")) return reply({ status: "invalid" }, 400)
  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > 65536) return reply({ status: "invalid" }, 413)
  const parsed: unknown = await Promise.resolve().then(() => JSON.parse(body)).catch(() => undefined)
  if (!record(parsed) || (parsed.action !== "start" && parsed.action !== "read" && parsed.action !== "cancel" && parsed.action !== "list" && parsed.action !== "output")) return reply({ status: "invalid" }, 400)
  if (!runtime.analyses) return reply({ status: "unavailable" }, 503)
  const action = parsed.action
  const input = action === "start" ? await analysisInput(parsed.input, runtime) : action === "list" ? caseInput(parsed.caseRef) : typeof parsed.runRef === "string" && parsed.runRef.trim() ? { runRef: parsed.runRef } : undefined
  if (!input || Object.keys(parsed).some((key) => key !== "action" && key !== (action === "start" ? "input" : action === "list" ? "caseRef" : "runRef"))) return reply({ status: "invalid" }, 400)
  const admitted = await runtime.human.admit(request, action === "list" || action === "output" ? "analysis.read" : `analysis.${action}`, input)
  if (admitted.status !== "ok") return reply({ status: admitted.status }, admitted.status === "unavailable" ? 503 : 403)
  try {
    const result = await (action === "start" && "request" in input ? runtime.analyses.start(admitted.value, input)
      : action === "read" && "runRef" in input ? runtime.analyses.read(admitted.value, input.runRef)
      : action === "output" && "runRef" in input ? runtime.analyses.output(admitted.value, input.runRef)
      : action === "list" && "caseRef" in input ? runtime.analyses.list(admitted.value, input.caseRef)
      : action === "cancel" && "runRef" in input ? runtime.analyses.cancel(admitted.value, input.runRef) : Promise.resolve(undefined)).catch(() => undefined)
    if (!result) return reply({ status: "unavailable" }, 503)
    if (result.status !== "ok") return reply({ status: result.status }, result.status === "denied" ? 403 : result.status === "stale" || result.status === "conflict" ? 409 : result.status === "needs-input" ? 400 : 503)
    if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
    if (action === "read" && "runRef" in result.value && "version" in result.value && "state" in result.value) return reply({ status: "ok", value: { runRef: result.value.runRef, state: result.value.state, version: result.value.version, ...("outputRef" in result.value && typeof result.value.outputRef === "string" ? { outputRef: result.value.outputRef } : {}) } }, 200)
    if (action === "output" && "kind" in result.value) {
      const output = result.value
      const html = await Promise.resolve().then(() => contribution(output)).catch(() => undefined)
      if (!html || !await runtime.ui.revalidate(admitted.value)) return reply({ status: "unavailable" }, 503)
      return reply({ status: "ok", value: { html } }, 200)
    }
    return reply({ status: "ok", value: result.value }, 200)
  } finally { runtime.human.finish(admitted.value) }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function caseInput(value: unknown) {
  if (!record(value) || Object.keys(value).some((key) => !["id", "incarnation", "version"].includes(key)) || typeof value.id !== "string" || typeof value.incarnation !== "string" || typeof value.version !== "number" || !Number.isSafeInteger(value.version)) return undefined
  return { caseRef: { id: value.id, incarnation: value.incarnation, version: value.version } }
}

async function analysisInput(value: unknown, runtime: SfHostServices) {
  if (!record(value) || Object.keys(value).some((key) => !["request", "skillInput", "model"].includes(key)) || !("skillInput" in value) || !record(value.request)) return undefined
  const request = value.request
  const caseRef = request.caseRef
  if (!record(caseRef)) return undefined
  if (Object.keys(request).some((key) => !["caseRef", "profileId", "profileVersion", "skillId", "skillVersion", "manifestDigest", "outputSchemaVersion", "requestedOperationScope", "objective"].includes(key)) ||
    Object.keys(caseRef).some((key) => !["id", "incarnation", "version"].includes(key)) ||
    typeof caseRef.id !== "string" || typeof caseRef.incarnation !== "string" || !Number.isSafeInteger(caseRef.version) ||
    typeof request.profileId !== "string" || typeof request.profileVersion !== "string" || typeof request.skillId !== "string" || typeof request.skillVersion !== "string" ||
    typeof request.manifestDigest !== "string" || typeof request.outputSchemaVersion !== "string" || typeof request.objective !== "string" ||
    !Array.isArray(request.requestedOperationScope) || !request.requestedOperationScope.every((item) => typeof item === "string")) return undefined
  const model = (await runtime.models().catch(() => [])).find((item) => digestSfValue(item) === digestSfValue(value.model))
  if (!model) return undefined
  return { request: { caseRef: { id: caseRef.id, incarnation: caseRef.incarnation, version: caseRef.version as number }, profileId: request.profileId, profileVersion: request.profileVersion, skillId: request.skillId, skillVersion: request.skillVersion, manifestDigest: request.manifestDigest, outputSchemaVersion: request.outputSchemaVersion, requestedOperationScope: request.requestedOperationScope, objective: request.objective }, skillInput: value.skillInput, model }
}
