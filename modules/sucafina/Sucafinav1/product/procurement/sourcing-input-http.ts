import { digestSfValue } from "../contracts/canonical.ts"
import type { SfHostServices } from "../contracts/host-context.ts"

/** A selector prepares current domain material; it never admits an analysis or writes a decision. */
export async function handleSfSourcingInput(request: Request, origin: string, runtime: Pick<SfHostServices, "ui" | "sourcingInputs">) {
  const reply = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
  if (request.method !== "POST") return reply({ status: "denied" }, 405)
  if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "denied" }, 403)
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json") || !/^[A-Za-z0-9._:-]{8,128}$/.test(request.headers.get("idempotency-key") ?? "")) return reply({ status: "invalid" }, 400)
  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > 65536) return reply({ status: "invalid" }, 413)
  const parsed: unknown = await Promise.resolve().then(() => JSON.parse(body)).catch(() => undefined)
  if (!object(parsed) || Object.keys(parsed).some((key) => key !== "caseRef" && key !== "requestRef") || typeof parsed.requestRef !== "string" || !parsed.requestRef.trim() || !object(parsed.caseRef)) return reply({ status: "invalid" }, 400)
  const caseRef = parsed.caseRef
  if (Object.keys(caseRef).some((key) => !["id", "incarnation", "version"].includes(key)) || typeof caseRef.id !== "string" || !caseRef.id.trim() || typeof caseRef.incarnation !== "string" || !caseRef.incarnation.trim() || typeof caseRef.version !== "number" || !Number.isSafeInteger(caseRef.version) || caseRef.version < 1) return reply({ status: "invalid" }, 400)
  if (!runtime.sourcingInputs) return reply({ status: "unavailable" }, 503)
  const input = { requestRef: parsed.requestRef, caseRef: { id: caseRef.id, incarnation: caseRef.incarnation, version: caseRef.version } }
  const digest = digestSfValue(input)
  const admitted = await runtime.ui.admit(request, "sf_sourcing_compare", digest)
  if (admitted.status !== "ok") return reply({ status: admitted.status }, admitted.status === "unavailable" ? 503 : 403)
  try {
    if (!await runtime.ui.validate(admitted.value, "sf_sourcing_compare", digest)) return reply({ status: "denied" }, 403)
    const result = await runtime.sourcingInputs.prepare(admitted.value, input).catch(() => undefined)
    if (!result) return reply({ status: "unavailable" }, 503)
    if (result.status !== "ok") return reply({ status: result.status }, result.status === "denied" ? 403 : result.status === "stale" || result.status === "conflict" ? 409 : result.status === "needs-input" ? 400 : 503)
    if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
    return reply({ status: "ok", value: result.value }, 200)
  } finally { runtime.ui.finish(admitted.value) }
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
