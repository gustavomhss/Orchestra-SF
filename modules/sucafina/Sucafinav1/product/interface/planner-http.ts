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
  // WP03/WP00 have not published extended operations in the composed host contract.
  // Reject them before admission instead of pretending an operation/entity is a MonthlyDraft.
  if (record(parsed) && record(parsed.input) && ("operation" in parsed.input || "entity" in parsed.input)) return reply({ status: "needs-input", reason: "planner-operation-not-published" }, 400)
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
  if (!record(value) || Object.keys(value).some((key) => !["page", "versionId", "drafts"].includes(key)) || (value.page !== "OPEX" && value.page !== "CAPEX") || typeof value.versionId !== "string" || !value.versionId.trim()) return false
  return Array.isArray(value.drafts) && value.drafts.length > 0 && value.drafts.length <= 500 &&
    value.drafts.every((draft: unknown) => record(draft) && Object.keys(draft).every((key) => ["rowId", "revision", "cells"].includes(key)) &&
      typeof draft.rowId === "string" && !!draft.rowId.trim() && typeof draft.revision === "number" && Number.isSafeInteger(draft.revision) && draft.revision >= 0 && Array.isArray(draft.cells) && draft.cells.length > 0 && draft.cells.length <= 36 &&
      draft.cells.every((cell: unknown) => record(cell) && Object.keys(cell).every((key) => ["measure", "month", "text"].includes(key)) &&
        (cell.measure === "budget" || cell.measure === "actual" || cell.measure === "forecast") && typeof cell.month === "number" && Number.isInteger(cell.month) && cell.month >= 1 && cell.month <= 12 && typeof cell.text === "string"))
}

