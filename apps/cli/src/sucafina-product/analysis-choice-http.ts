import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import { biViews } from "../../../../modules/sucafina/Sucafinav1/product/analytics/catalog.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBiArtifacts } from "./bi-artifacts.ts"
import type { createSfAnalysisChoiceServices } from "./analysis-choice-services.ts"
import type { createSfAlternativeSelections } from "./alternative-selections.ts"
import type { createSfBusinessServices } from "./business-services.ts"

export function createSfAnalysisChoiceHttp(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  origin: string
  choices: ReturnType<typeof createSfAnalysisChoiceServices>
  artifacts: ReturnType<typeof createSfBiArtifacts>["store"]
  alternatives: ReturnType<typeof createSfAlternativeSelections>
  business: ReturnType<typeof createSfBusinessServices>
}) {
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url), mode = url.searchParams.get("sf")
    const action = mode === "bi-artifact-save" ? "bi.artifact.save" : mode === "bi-artifact-read" ? "bi.artifact.read" :
      mode === "bi-selection-set" ? "bi.selection.set" : mode === "bi-selection-read" ? "bi.selection.read" :
        mode === "sensitivity-selection-set" ? "decisions.sensitivity.select" : mode === "sensitivity-selection-read" ? "decisions.sensitivity.selection.read" :
          mode === "alternative-selection-set" ? "decisions.alternative.select" : undefined
    if (!action) return undefined
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (surface !== "dashboard" || request.method !== "POST" || url.origin !== input.origin || request.headers.get("origin") !== input.origin ||
      request.headers.get("sec-fetch-site") === "cross-site" || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json") ||
      [...url.searchParams.keys()].some((key) => key !== "sf") || url.searchParams.getAll("sf").length !== 1) return json({ status: "denied", reason: "analysis-selection-request-unavailable" }, 403)
    const reader = request.body?.getReader()
    if (!reader) return json({ status: "needs-input", reason: "body-required" }, 400)
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.byteLength
        if (size > 256 * 1024) { void reader.cancel().catch(() => undefined); return json({ status: "needs-input", reason: "body-too-large" }, 413) }
        chunks.push(chunk.value)
      }
    } catch { return json({ status: "needs-input", reason: "body-unavailable" }, 400) }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    let payload: unknown
    try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) } catch { return json({ status: "needs-input", reason: "invalid-json" }, 400) }
    const body = record(payload)
    if (!body) return json({ status: "needs-input", reason: "invalid-selection" }, 400)
    const admitted = await input.authority.human.admit(request, action, payload)
    if (admitted.status !== "ok") return json(admitted, 403)
    const call = admitted.value
    try {
      if (mode === "bi-artifact-read") {
        if (Object.keys(body).length !== 1 || typeof body.reference !== "string") return json({ status: "needs-input", reason: "invalid-reference" }, 400)
        const value = await input.artifacts.read(body.reference, call)
        return json(value, value.status === "ok" ? 200 : 409)
      }
      if (mode === "bi-artifact-save") {
        const selected = record(body.selection), view = record(selected?.selection), mutation = decodeMutation(body.mutation)
        const caseRef = decodeCase(selected?.caseRef), dashboard = decodeSfOperationInput("sf_dashboard_read", selected?.dashboardSelection)
        if (Object.keys(body).some((key) => !["selection", "mutation"].includes(key)) || !selected || Object.keys(selected).some((key) => !["caseRef", "selection", "dashboardSelection", "period"].includes(key)) ||
          !view || Object.keys(view).some((key) => !["viewId", "version", "filters"].includes(key)) || typeof view.viewId !== "string" || view.version !== 1 || !Array.isArray(view.filters) || view.filters.length ||
          !mutation || !caseRef || !dashboard.ok || !isSfPeriod(selected.period)) return json({ status: "needs-input", reason: "invalid-bi-artifact-selection" }, 400)
        const viewRequest = decodeSfOperationInput("sf_bi_view", { viewId: view.viewId, selectionRef: dashboard.value.selectionRef, period: selected.period })
        const viewId = biViews.find((entry) => entry.id === view.viewId)?.id
        if (!viewRequest.ok || !viewId) return json({ status: "needs-input", reason: "invalid-bi-view" }, 400)
        const value = await input.business.withCase(call, caseRef, {}, () => input.artifacts.save({ caseRef, selection: { viewId, version: 1, filters: [] }, dashboardSelection: dashboard.value, period: viewRequest.value.period }, mutation, call))
        return json(value, value.status === "ok" ? 200 : 409)
      }
      const caseRef = decodeCase(body.caseRef)
      if (!caseRef) return json({ status: "needs-input", reason: "invalid-case" }, 400)
      if (mode === "bi-selection-read" || mode === "sensitivity-selection-read") {
        if (Object.keys(body).length !== 1) return json({ status: "needs-input", reason: "invalid-selection" }, 400)
        const value = mode === "bi-selection-read" ? await input.choices.readBi(caseRef, call) : await input.choices.readSensitivity(caseRef, call)
        return json(value, value.status === "ok" ? 200 : 409)
      }
      const mutation = decodeMutation(body.mutation)
      if (!mutation) return json({ status: "needs-input", reason: "invalid-mutation" }, 400)
      if (mode === "alternative-selection-set") {
        const proposal = decodeSfOperationInput("sf_alternative_draft", body.request)
        const scenario = decodeSfOperationInput("sf_scenario_simulate", body.scenario)
        if (Object.keys(body).some((key) => !["caseRef", "request", "scenario", "coverageRef", "mutation"].includes(key)) ||
          !proposal.ok || !scenario.ok || typeof body.coverageRef !== "string" || !body.coverageRef.trim()) return json({ status: "needs-input", reason: "invalid-alternative-selection" }, 400)
        const selected = { caseRef, request: proposal.value, scenario: scenario.value, coverageRef: body.coverageRef, mutation }
        const value = await input.business.withCase(call, caseRef, {}, () => input.alternatives.select(selected, call))
        return json(value, value.status === "ok" ? 200 : 409)
      }
      if (mode === "bi-selection-set") {
        if (Object.keys(body).some((key) => !["caseRef", "projectionRef", "tableRef", "mutation"].includes(key)) || typeof body.projectionRef !== "string" || typeof body.tableRef !== "string") return json({ status: "needs-input", reason: "invalid-bi-choice" }, 400)
        const value = await input.choices.selectBi({ caseRef, projectionRef: body.projectionRef, tableRef: body.tableRef, mutation }, call)
        return json(value, value.status === "ok" ? 200 : 409)
      }
      if (Object.keys(body).some((key) => !["caseRef", "resultRef", "mutation"].includes(key)) || typeof body.resultRef !== "string") return json({ status: "needs-input", reason: "invalid-sensitivity-choice" }, 400)
      const value = await input.choices.selectSensitivity({ caseRef, resultRef: body.resultRef, mutation }, call)
      return json(value, value.status === "ok" ? 200 : 409)
    } finally { input.authority.human.finish(call) }
  }
}

function record(value: unknown): Record<string, unknown> | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined }
function decodeCase(value: unknown) {
  const row = record(value)
  return row && Object.keys(row).length === 3 && typeof row.id === "string" && !!row.id.trim() && typeof row.incarnation === "string" && !!row.incarnation.trim() &&
    typeof row.version === "number" && Number.isSafeInteger(row.version) && row.version > 0 ? { id: row.id, incarnation: row.incarnation, version: row.version } : undefined
}
function decodeMutation(value: unknown) {
  const row = record(value)
  return row && Object.keys(row).length === 2 && typeof row.expectedStorageVersion === "number" && Number.isSafeInteger(row.expectedStorageVersion) && row.expectedStorageVersion >= 0 &&
    typeof row.idempotencyKey === "string" && row.idempotencyKey.trim() ? { expectedStorageVersion: row.expectedStorageVersion, idempotencyKey: row.idempotencyKey } : undefined
}
