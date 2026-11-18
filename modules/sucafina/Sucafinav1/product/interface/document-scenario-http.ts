import { htmlPolicy } from "../../runtime/application.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import { parseSfDocumentScenarioRequest } from "../documents/scenario-inputs.ts"
import type { createSfDocumentScenarios } from "../documents/scenario-inputs.ts"
import { sfDocumentScenarioWorkbench } from "../documents/scenario-workbench.ts"
import type { createSfProductAuthority } from "../integration/product-authority.ts"

/** The browser chooses a source and destination; only the document reader supplies the amount. */
export function createSfDocumentScenarioHttp(input: {
  origin: string
  mount: string
  authority: Pick<ReturnType<typeof createSfProductAuthority>, "ui" | "human" | "host">
  service: ReturnType<typeof createSfDocumentScenarios> | undefined
}) {
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    const mode = url.searchParams.get("sf")
    if (!mode || !["document-scenario", "document-scenario-targets", "document-scenario-preview"].includes(mode)) return undefined
    const reply = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (url.origin !== input.origin || !["dashboard", "planner", "procurement"].includes(surface) || url.pathname !== `${input.mount}/${surface}` || request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "denied" }, 403)
    const write = mode === "document-scenario-preview"
    if (request.method !== (write ? "POST" : "GET")) return reply({ status: "denied" }, 405)
    if ([...url.searchParams.keys()].some((key) => !(write ? ["sf"] : ["sf", "ref"]).includes(key) || url.searchParams.getAll(key).length !== 1)) return reply({ status: "invalid" }, 400)
    const service = input.service
    if (!service) return reply({ status: "unavailable", reason: "document-scenario-unavailable" }, 503)
    const code = (status: string) => status === "ok" ? 200 : status === "denied" ? 403 : status === "stale" || status === "conflict" ? 409 : status === "needs-input" ? 400 : 503
    if (write) {
      if (request.headers.get("origin") !== input.origin || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ status: "denied" }, 403)
      const bytes = await bounded(request)
      if (!bytes) return reply({ status: "invalid" }, 413)
      const value: unknown = await Promise.resolve().then(() => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))).catch(() => undefined)
      const payload = parseSfDocumentScenarioRequest(value)
      if (!payload) return reply({ status: "invalid" }, 400)
      const grant = await input.authority.human.admit(request, "planner.preview", payload)
      if (grant.status !== "ok") return reply({ status: grant.status }, 403)
      try {
        const result = await service.preview(payload, grant.value)
        if (!await input.authority.host.revalidate(grant.value)) return reply({ status: "denied" }, 403)
        return reply(result, code(result.status))
      } finally { input.authority.human.finish(grant.value) }
    }
    const raw = url.searchParams.get("ref")
    if (!raw || raw.length > 32768) return reply({ status: "invalid" }, 400)
    const ref = decodeSfOperationInput("sf_evidence_get", { evidenceRef: await Promise.resolve().then(() => JSON.parse(raw)).catch(() => undefined) })
    if (!ref.ok || ref.value.evidenceRef.kind !== "document" || !ref.value.evidenceRef.target.fieldCandidateId) return reply({ status: "invalid" }, 400)
    const digest = digestSfValue({ purpose: mode, documentRef: ref.value.evidenceRef })
    const grant = await input.authority.ui.admit(request, "sf_scenario_simulate", digest)
    if (grant.status !== "ok") return reply({ status: grant.status }, 403)
    try {
      if (!await input.authority.ui.validate(grant.value, "sf_scenario_simulate", digest)) return reply({ status: "denied" }, 403)
      const targets = await service.targets(ref.value.evidenceRef, grant.value)
      if (targets.status !== "ok") return reply(targets, code(targets.status))
      if (!await input.authority.host.revalidate(grant.value)) return reply({ status: "denied" }, 403)
      if (mode === "document-scenario-targets") return reply(targets, 200)
      const html = sfDocumentScenarioWorkbench(surface, ref.value.evidenceRef)
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff" } })
    } finally { input.authority.ui.finish(grant.value) }
  }
}

async function bounded(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) return undefined
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      length += chunk.value.byteLength
      if (length > 65536) { await reader.cancel(); return undefined }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}
