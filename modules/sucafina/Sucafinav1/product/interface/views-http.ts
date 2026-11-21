import type { SfHostServices } from "../contracts/host-context.ts"
import type { SfPersonalViewRemove, SfPersonalViewSave } from "./personal-views.ts"

/** The host owns both the current principal and destination reauthorization. */
export async function handleSfViews(request: Request, origin: string, runtime: SfHostServices) {
  const reply = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
  if (request.method !== "POST") return reply({ status: "denied" }, 405)
  if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "denied" }, 403)
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json") || !/^[A-Za-z0-9._:-]{8,128}$/.test(request.headers.get("idempotency-key") ?? "")) return reply({ status: "invalid" }, 400)
  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > 65536) return reply({ status: "invalid" }, 413)
  const value: unknown = await Promise.resolve().then(() => JSON.parse(body)).catch(() => undefined)
  if (!value || typeof value !== "object" || Array.isArray(value) || !("action" in value) || !["list", "open", "save", "remove"].some((action) => action === value.action) || Object.keys(value).some((key) => !["action", "input"].includes(key)) || !("input" in value) || !value.input || typeof value.input !== "object" || Array.isArray(value.input)) return reply({ status: "invalid" }, 400)
  if (!runtime.personalViews) return reply({ status: "unavailable" }, 503)
  const action = value.action
  if (action === "list" && Object.keys(value.input).length) return reply({ status: "invalid" }, 400)
  if (action === "open" && (!("id" in value.input) || typeof value.input.id !== "string" || Object.keys(value.input).some((key) => key !== "id"))) return reply({ status: "invalid" }, 400)
  const humanAction = action === "save" ? "views.save" : action === "remove" ? "views.remove" : "views.read"
  const admitted = await runtime.human.admit(request, humanAction, value.input)
  if (admitted.status !== "ok") return reply({ status: admitted.status }, admitted.status === "unavailable" ? 503 : 403)
  try {
    const result = await (action === "list" ? runtime.personalViews.list(admitted.value)
      : action === "open" && "id" in value.input && typeof value.input.id === "string" ? runtime.personalViews.open({ id: value.input.id }, admitted.value)
      : action === "save" ? runtime.personalViews.save(value.input as SfPersonalViewSave, admitted.value)
      : action === "remove" ? runtime.personalViews.remove(value.input as SfPersonalViewRemove, admitted.value) : Promise.resolve(undefined)).catch(() => undefined)
    if (!result) return reply({ status: "unavailable" }, 503)
    if (result.status !== "ok") return reply({ status: result.status }, result.status === "denied" ? 403 : result.status === "conflict" || result.status === "stale" ? 409 : result.status === "needs-input" ? 400 : 503)
    if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
    return reply({ status: "ok", value: result.value }, 200)
  } finally { runtime.human.finish(admitted.value) }
}
