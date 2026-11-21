import { htmlPolicy } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import type { CreateSfHostRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createSfRequestDocumentEvidence } from "../../../../modules/sucafina/Sucafinav1/product/documents/request-evidence.ts"
import { prepareSourcingDossier } from "../../../../modules/sucafina/Sucafinav1/product/routines/dossier.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfDocumentServices } from "./document-services.ts"
import { sfDossierWorkbench } from "./dossier-workbench.ts"

/** Compose WP09's dossier with the same Request authority and WP06 document reader used by the product. */
export function createSfDossierServices(input: {
  runtime: Parameters<CreateSfHostRuntime>[0]
  authority: ReturnType<typeof createSfProductAuthority>
  business: Pick<ReturnType<typeof createSfBusinessServices>, "procurement" | "sourcingEvidence" | "resolveProcurement" | "procurementSelections" | "registry">
  documents: NonNullable<ReturnType<typeof createSfDocumentServices>>
}) {
  if (!input.runtime.assets) return undefined
  const selectedDocuments = createSfRequestDocumentEvidence({ host: input.authority.host, state: input.authority.state,
    services: input.runtime.assets.services, resolveRequest: input.business.resolveProcurement, list: input.documents.documents.list })
  const prepareProcurement: Parameters<typeof prepareSourcingDossier>[0]["prepareProcurement"] = async (requestRef, call) => {
    const request = await input.business.procurement.read({ requestRef }, call)
    if (request.status !== "ok") return request
    const source = await input.business.sourcingEvidence(requestRef, call)
    if (source.status !== "ok") return source
    if (request.value.version !== source.value.evidence.target.version || digestSfValue(request.value.context) !== digestSfValue(source.value.context) ||
      !request.value.values.length || request.value.values.some((value) => !value.sourceRefs.length || value.sourceRefs.some((ref) => digestSfValue(ref) !== digestSfValue(source.value.evidence))))
      return { status: "stale", reason: "request-projection-changed" }
    return { status: "ok", value: { request: request.value, comparison: source.value.comparison, sourcing: source.value,
      limitations: source.value.comparison ? [] : ["commercial-comparison-unavailable"] } }
  }
  const prepare = async (requestRef: string, call: TrustedDomainContext) => prepareSourcingDossier({ requestRef, context: call,
    prepareProcurement, selectedDocuments, reader: input.documents.documents.reader,
    revalidate: async (refs, context) => {
      const current = await selectedDocuments(requestRef, context)
      const identity = (entries: typeof refs) => entries.map((ref) => `${ref.refId}:${ref.refDigest}`).sort()
      return current.status === "ok" && digestSfValue(identity(current.value)) === digestSfValue(identity(refs)) && await input.authority.host.revalidate(context)
    },
    revalidateProcurement: async (material, context) => {
      const current = await prepareProcurement(requestRef, context)
      if (current.status !== "ok") return false
      // Age in days is clock-derived; source refs, context, comparison and proposal facts fence the material inputs.
      const identity = (value: typeof material) => ({ version: value.request.version, engineVersion: value.request.engineVersion,
        context: value.request.context, sources: value.request.values.map((entry) => ({ id: entry.id, refs: entry.sourceRefs })),
        comparison: value.comparison, sourcing: value.sourcing, limitations: value.limitations })
      return digestSfValue(identity(current.value)) === digestSfValue(identity(material)) && await input.authority.host.revalidate(context)
    },
  })
  const http = async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    const mode = url.searchParams.get("sf")
    if (!mode || !["sourcing-dossier", "sourcing-dossier-requests", "sourcing-dossier-read"].includes(mode)) return undefined
    const reply = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (surface !== "procurement" || url.origin !== input.runtime.origin || url.pathname !== `${input.runtime.mount}/procurement` || request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "denied" }, 403)
    if (request.method !== "GET") return reply({ status: "denied" }, 405)
    const allowed = mode === "sourcing-dossier-requests" ? ["sf", "start", "end"] : mode === "sourcing-dossier-read" ? ["sf", "requestRef"] : ["sf"]
    if ([...url.searchParams.keys()].some((key) => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return reply({ status: "invalid" }, 400)
    const period = { start: url.searchParams.get("start") ?? "", end: url.searchParams.get("end") ?? "" }
    const requestRef = url.searchParams.get("requestRef") ?? ""
    if (mode === "sourcing-dossier-requests" && !isSfPeriod(period) || mode === "sourcing-dossier-read" && (!requestRef.trim() || requestRef.length > 512)) return reply({ status: "invalid" }, 400)
    const operation = mode === "sourcing-dossier-requests" ? "sf_work_list" : "sf_request_read"
    const payload = mode === "sourcing-dossier-requests" ? { purpose: "work-selection", period } : mode === "sourcing-dossier-read" ? { requestRef } : { purpose: "sourcing-dossier" }
    const digest = digestSfValue(payload)
    const admitted = await input.authority.ui.admit(request, operation, digest)
    if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
    try {
      if (!await input.authority.ui.validate(admitted.value, operation, digest)) return reply({ status: "denied" }, 403)
      if (mode === "sourcing-dossier") {
        const html = sfDossierWorkbench()
        if (!await input.authority.host.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff" } })
      }
      if (mode === "sourcing-dossier-requests") {
        const selected = await input.business.procurementSelections.create(admitted.value, period)
        if (selected.status !== "ok") return reply({ status: selected.status }, selected.status === "denied" ? 403 : 503)
        const collection = await input.business.registry.resolveRequestCollection(selected.value.selectionRef, admitted.value)
        if (collection.status !== "ok") return reply({ status: collection.status }, collection.status === "denied" ? 403 : 409)
        if (!await input.authority.host.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
        return reply({ status: "ok", value: collection.value.requests.map((ref) => ({ requestRef: ref.refId, label: `Request ${ref.target.recordId}` })) }, 200)
      }
      const result = await prepare(requestRef, admitted.value)
      if (result.status !== "ok") return reply({ status: result.status }, result.status === "denied" ? 403 : result.status === "stale" ? 409 : 503)
      if (!await input.authority.host.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
      return reply(result, 200)
    } finally { input.authority.ui.finish(admitted.value) }
  }
  return { prepare, http }
}
