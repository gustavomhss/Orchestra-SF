import type { SfHostServices, SfPlannerMonthlyInput } from "../contracts/host-context.ts"

/** The host resolves the current actor and Planner snapshot for each operation. */
export async function handleSfPlannerMonthly(request: Request, origin: string, runtime: SfHostServices) {
  const reply = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
  if (request.method !== "POST") return reply({ status: "denied" }, 405)
  if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "denied" }, 403)
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json") || !/^[A-Za-z0-9._:-]{8,128}$/.test(request.headers.get("idempotency-key") ?? "")) return reply({ status: "invalid" }, 400)
  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > 65536) return reply({ status: "invalid" }, 413)
  const parsed: unknown = await Promise.resolve().then(() => JSON.parse(body)).catch(() => undefined)
  if (!record(parsed) || (parsed.action !== "preview" && parsed.action !== "apply") || Object.keys(parsed).some((key) => !["action", "input"].includes(key)) || !monthlyInput(parsed.input)) return reply({ status: "invalid" }, 400)
  if (!runtime.plannerMonthly) return reply({ status: "unavailable" }, 503)
  const admitted = await runtime.human.admit(request, `planner.${parsed.action}`, parsed.input)
  if (admitted.status !== "ok") return reply({ status: admitted.status }, admitted.status === "unavailable" ? 503 : 403)
  try {
    const result = await runtime.plannerMonthly[parsed.action](admitted.value, parsed.input).catch(() => undefined)
    if (!result) return reply({ status: "unavailable" }, 503)
    if (result.status !== "ok") return reply({ status: result.status }, result.status === "denied" ? 403 : result.status === "stale" || result.status === "conflict" ? 409 : result.status === "needs-input" ? 400 : 503)
    if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
    return reply({ status: "ok", value: result.value }, 200)
  } finally { runtime.human.finish(admitted.value) }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function monthlyInput(value: unknown): value is SfPlannerMonthlyInput {
  if (!record(value) || Object.keys(value).some((key) => !["page", "versionId", "drafts", "operation", "entity"].includes(key)) || (value.page !== "OPEX" && value.page !== "CAPEX") || typeof value.versionId !== "string" || !value.versionId.trim()) return false
  if ([value.drafts, value.operation, value.entity].filter((item) => item !== undefined).length !== 1) return false
  if (record(value.operation)) return Object.keys(value.operation).every((key) => ["rowId", "revision", "kind", "annual"].includes(key)) && typeof value.operation.rowId === "string" && !!value.operation.rowId.trim() && typeof value.operation.revision === "number" && Number.isSafeInteger(value.operation.revision) && value.operation.revision >= 0 && (value.operation.kind === "annual" || value.operation.kind === "spread" || value.operation.kind === "reset") && (value.operation.kind === "annual" ? typeof value.operation.annual === "number" && Number.isFinite(value.operation.annual) : value.operation.annual === undefined)
  if (record(value.entity)) return Object.keys(value.entity).every((key) => ["collection", "kind", "id", "revision", "values"].includes(key)) && (value.entity.collection === "lines" || value.entity.collection === "projects") && (value.entity.kind === "create" || value.entity.kind === "edit" || value.entity.kind === "delete") && typeof value.entity.revision === "number" && Number.isSafeInteger(value.entity.revision) && value.entity.revision >= 0 && (value.entity.kind === "create" ? value.entity.id === undefined : typeof value.entity.id === "string" && !!value.entity.id.trim()) && (value.entity.kind === "delete" ? value.entity.values === undefined : record(value.entity.values))
  return Array.isArray(value.drafts) && value.drafts.length > 0 && value.drafts.length <= 500 &&
    value.drafts.every((draft: unknown) => record(draft) && Object.keys(draft).every((key) => ["rowId", "revision", "cells"].includes(key)) &&
      typeof draft.rowId === "string" && typeof draft.revision === "number" && Number.isSafeInteger(draft.revision) && Array.isArray(draft.cells) && draft.cells.length > 0 && draft.cells.length <= 36 &&
      draft.cells.every((cell: unknown) => record(cell) && Object.keys(cell).every((key) => ["measure", "month", "text"].includes(key)) &&
        (cell.measure === "budget" || cell.measure === "actual" || cell.measure === "forecast") && typeof cell.month === "number" && typeof cell.text === "string"))
}
