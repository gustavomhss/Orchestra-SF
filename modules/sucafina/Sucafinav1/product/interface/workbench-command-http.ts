import { RequestBodyError, readRequestBody } from "../../runtime/request-body.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { SfHostServices } from "../contracts/host-context.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"

export async function handleSfWorkbenchCommand(
  request: Request,
  origin: string,
  runtime: Pick<SfHostServices, "ui" | "dispatch">,
  allowed?: (operation: string) => boolean,
): Promise<Response> {
  const url = new URL(request.url)
  const reply = (value: unknown, status: number) => Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  })
  if (request.method !== "POST") return reply({ status: "denied" }, 405)
  if (url.origin !== origin || request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "denied" }, 403)
  if (url.searchParams.get("sf") !== "workbench-command" || [...url.searchParams.keys()].some((key) => key !== "sf") || url.searchParams.getAll("sf").length !== 1 || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ status: "invalid" }, 400)
  const bytes = await readRequestBody(request, 65536).catch((error) => error)
  if (bytes instanceof RequestBodyError) return reply({ status: "invalid" }, bytes.status)
  if (!(bytes instanceof Uint8Array)) return reply({ status: "invalid" }, 400)
  const body = await Promise.resolve().then(() => new TextDecoder("utf-8", { fatal: true }).decode(bytes)).catch(() => undefined)
  if (body === undefined) return reply({ status: "invalid" }, 400)
  const parsed: unknown = await Promise.resolve().then(() => JSON.parse(body)).catch(() => undefined)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).some((key) => !["operation", "input"].includes(key)) || !("operation" in parsed) || !("input" in parsed)) return reply({ status: "invalid" }, 400)
  const operation = parsed.operation
  if (operation !== "sf_case_draft" && operation !== "sf_question_prepare" && operation !== "sf_change_prepare") return reply({ status: "denied" }, 403)
  if (allowed && !allowed(operation)) return reply({ status: "denied" }, 403)
  const decoded = decodeSfOperationInput(operation, parsed.input)
  if (!decoded.ok) return reply({ status: "invalid" }, 400)
  const admitted = await runtime.ui.admit(request, operation, digestSfValue(decoded.value))
  if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
  try {
    const result = await runtime.dispatch(operation, decoded.value, admitted.value).catch(() => undefined)
    if (!result) return reply({ status: "unavailable", reason: "workbench-unavailable" }, 503)
    if (result.status !== "ok") return reply({ status: result.status }, result.status === "denied" ? 403 : result.status === "stale" ? 409 : 503)
    const output = decodeSfOperationOutput(operation, result.result)
    if (!output.ok || !await runtime.ui.revalidate(admitted.value)) return reply({ status: "unavailable" }, 503)
    return reply({ status: "ok", value: output.value, outputRef: result.outputRef }, 200)
  } finally { runtime.ui.finish(admitted.value) }
}
