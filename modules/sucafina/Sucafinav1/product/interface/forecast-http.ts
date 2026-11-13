import type { SfHostServices } from "../contracts/host-context.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"

/** Assemble a forecast skill input only from the current case and domain producer. */
export async function handleSfForecastInput(request: Request, origin: string, runtime: SfHostServices) {
  const reply = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
  if (request.method !== "POST") return reply({ status: "denied" }, 405)
  if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "denied" }, 403)
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json") || !/^[A-Za-z0-9._:-]{8,128}$/.test(request.headers.get("idempotency-key") ?? "")) return reply({ status: "invalid" }, 400)
  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > 65536) return reply({ status: "invalid" }, 413)
  const value: unknown = await Promise.resolve().then(() => JSON.parse(body)).catch(() => undefined)
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !["baseRef", "candidateRef", "period", "currency", "caseRef"].includes(key)) || !("caseRef" in value)) return reply({ status: "invalid" }, 400)
  const caseRef = value.caseRef
  if (!caseRef || typeof caseRef !== "object" || Array.isArray(caseRef) || Object.keys(caseRef).some((key) => !["id", "incarnation", "version"].includes(key)) || !("id" in caseRef) || typeof caseRef.id !== "string" || !("incarnation" in caseRef) || typeof caseRef.incarnation !== "string" || !("version" in caseRef) || typeof caseRef.version !== "number" || !Number.isSafeInteger(caseRef.version)) return reply({ status: "invalid" }, 400)
  const comparison = decodeSfOperationInput("sf_forecast_compare", Object.fromEntries(Object.entries(value).filter(([key]) => key !== "caseRef")))
  if (!comparison.ok) return reply({ status: "invalid" }, 400)
  if (!runtime.forecastInputs) return reply({ status: "unavailable" }, 503)
  const input = { ...comparison.value, caseRef: { id: caseRef.id, incarnation: caseRef.incarnation, version: caseRef.version } }
  const digest = digestSfValue(input)
  const admitted = await runtime.ui.admit(request, "sf_forecast_compare", digest)
  if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
  try {
    if (!await runtime.ui.validate(admitted.value, "sf_forecast_compare", digest)) return reply({ status: "denied" }, 403)
    const result = await runtime.forecastInputs.prepare(admitted.value, input).catch(() => undefined)
    if (!result) return reply({ status: "unavailable" }, 503)
    if (result.status !== "ok") return reply({ status: result.status }, result.status === "denied" ? 403 : result.status === "stale" || result.status === "conflict" ? 409 : result.status === "needs-input" ? 400 : 503)
    if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
    return reply({ status: "ok", value: result.value }, 200)
  } finally { runtime.ui.finish(admitted.value) }
}
