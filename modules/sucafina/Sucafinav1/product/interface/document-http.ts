import { htmlPolicy } from "../../runtime/application.ts"
import { sfDocumentWorkbench } from "../documents/workbench.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { createSfUiAuthority } from "../integration/ui-authority.ts"
import type { createSfDocumentHost } from "../documents/host.ts"
import type { createSfDocumentSchemas, DocumentSchemaInput } from "../documents/schemas.ts"
import type { createSfHumanAuthority } from "../integration/human-authority.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { CapabilityResult, TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfDocumentAssetCatalogEntry } from "../documents/byte-port.ts"

/** Private same-origin presentation route; the signed asset endpoint rechecks access when opened. */
export function createSfDocumentHttp(input: { origin: string; mount: string; runtime: () => { ui: ReturnType<typeof createSfUiAuthority>; human: ReturnType<typeof createSfHumanAuthority>; documents: Pick<ReturnType<typeof createSfDocumentHost>, "resolvePresentation" | "extract" | "confirm" | "list" | "search">; schemas: ReturnType<typeof createSfDocumentSchemas>; dispatch: (operation: "sf_document_extract" | "sf_knowledge_search", payload: unknown, context: TrustedDomainContext) => Promise<CapabilityResult>; discoverRequests: (context: TrustedDomainContext) => Promise<PortResult<readonly { selectionRef: string; label: string }[]>>; discover: (context: TrustedDomainContext, requestSelectionRef?: string) => Promise<PortResult<readonly { selectionRef: string; label: string; surface: "dashboard" | "procurement" }[]>>; admitSelection: (selectionRef: string, context: TrustedDomainContext) => Promise<PortResult<SfDocumentAssetCatalogEntry>> } | undefined }) {
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    const mode = url.searchParams.get("sf")
    if (!mode || !["documents", "document-requests", "document-search", "document-open", "document-schemas", "document-schema", "document-sources", "document-admit", "document-extract", "document-confirm", "document-candidates"].includes(mode)) return undefined
    const reply = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (url.origin !== input.origin || !["dashboard", "planner", "procurement"].includes(surface) || url.pathname !== `${input.mount}/${surface}`) return reply({ status: "denied" }, 403)
    if (request.method !== (["document-schema", "document-admit", "document-extract", "document-confirm", "document-search"].includes(mode) ? "POST" : "GET")) return reply({ status: "denied" }, 405)
    const allowed = mode === "document-open" ? ["sf", "ref"] : mode === "document-sources" ? ["sf", "requestSelectionRef"] : ["document-schemas", "document-candidates"].includes(mode) ? ["sf", "documentRef"] : ["sf"]
    if ([...url.searchParams.keys()].some((key) => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return reply({ status: "invalid" }, 400)
    if (mode === "documents" || mode === "document-requests") {
      const runtime = input.runtime()
      if (!runtime) return reply({ status: "unavailable" }, 503)
      const digest = digestSfValue({ purpose: mode })
      const admitted = await runtime.ui.admit(request, "sf_document_extract", digest)
      if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
      try {
        if (!await runtime.ui.validate(admitted.value, "sf_document_extract", digest)) return reply({ status: "denied" }, 403)
        if (mode === "document-requests") {
          const result = await runtime.discoverRequests(admitted.value)
          if (result.status !== "ok") return reply({ status: result.status, reason: documentFailure(result.reason) }, result.status === "denied" ? 403 : 503)
          if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
          return reply({ status: "ok", value: result.value }, 200)
        }
        const html = sfDocumentWorkbench(surface)
        if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff" } })
      } finally { runtime.ui.finish(admitted.value) }
    }
    if (mode === "document-search") {
      if (request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site" || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ status: "denied" }, 403)
      const bytes = await bounded(request, 65536)
      if (!bytes) return reply({ status: "invalid" }, 413)
      const payload: unknown = await Promise.resolve().then(() => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))).catch(() => undefined)
      const decoded = decodeSfOperationInput("sf_knowledge_search", payload)
      if (!decoded.ok) return reply({ status: "invalid" }, 400)
      const runtime = input.runtime()
      if (!runtime) return reply({ status: "unavailable" }, 503)
      const digest = digestSfValue(decoded.value)
      const admitted = await runtime.ui.admit(request, "sf_knowledge_search", digest)
      if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
      try {
        const result = await runtime.dispatch("sf_knowledge_search", decoded.value, admitted.value)
        if (result.status !== "ok") return reply({ status: result.status, reason: documentFailure(result.reason) }, result.status === "denied" ? 403 : 503)
        if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
        return reply({ status: "ok", value: result.result }, 200)
      } finally { runtime.ui.finish(admitted.value) }
    }
    if (mode === "document-sources" || mode === "document-admit") {
      if (mode === "document-admit" && (request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site" || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))) return reply({ status: "denied" }, 403)
      const requestSelectionRef = url.searchParams.get("requestSelectionRef") ?? undefined
      if (requestSelectionRef !== undefined && (!requestSelectionRef || requestSelectionRef.length > 128)) return reply({ status: "invalid" }, 400)
      const bytes = mode === "document-admit" ? await bounded(request, 4096) : undefined
      const payload: unknown = bytes ? await Promise.resolve().then(() => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))).catch(() => undefined) : (requestSelectionRef ? { requestSelectionRef } : {})
      if (!payload || typeof payload !== "object" || Array.isArray(payload) || (mode === "document-admit" ? Object.keys(payload).length !== 1 || !("selectionRef" in payload) || typeof payload.selectionRef !== "string" || !payload.selectionRef : Object.keys(payload).some((key) => key !== "requestSelectionRef"))) return reply({ status: "invalid" }, 400)
      const runtime = input.runtime()
      if (!runtime) return reply({ status: "unavailable" }, 503)
      const digest = digestSfValue(payload)
      const admitted = await runtime.ui.admit(request, "sf_document_extract", digest)
      if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
      try {
        if (!await runtime.ui.validate(admitted.value, "sf_document_extract", digest)) return reply({ status: "denied" }, 403)
        const result = mode === "document-sources" ? await runtime.discover(admitted.value, requestSelectionRef) : await runtime.admitSelection((payload as { selectionRef: string }).selectionRef, admitted.value)
        if (result.status !== "ok") return reply({ status: result.status, reason: documentFailure(result.reason) }, result.status === "denied" ? 403 : result.status === "stale" ? 409 : 503)
        if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
        return reply({ status: "ok", value: mode === "document-sources" ? result.value : { documentRef: (result.value as SfDocumentAssetCatalogEntry).documentId } }, 200)
      } finally { runtime.ui.finish(admitted.value) }
    }
    if (mode === "document-extract" || mode === "document-confirm") {
      if (request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site" || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ status: "denied" }, 403)
      const bytes = await bounded(request, 65536)
      if (!bytes) return reply({ status: "invalid" }, 413)
      const payload: unknown = await Promise.resolve().then(() => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))).catch(() => undefined)
      const runtime = input.runtime()
      if (!runtime) return reply({ status: "unavailable" }, 503)
      if (mode === "document-confirm") {
        const evidence = decodeSfOperationOutput("sf_document_extract", payload)
        if (!evidence.ok || evidence.value.status !== "extracted") return reply({ status: "invalid" }, 400)
        const human = await runtime.human.admit(request, "documents.confirm", evidence.value)
        if (human.status !== "ok") return reply({ status: human.status }, 403)
        try { const result = await runtime.documents.confirm(evidence.value.id, human.value); return result.status === "ok" ? reply({ status: "ok", value: result.value }, 200) : reply({ status: result.status, reason: documentFailure(result.reason) }, result.status === "denied" ? 403 : result.status === "conflict" || result.status === "stale" ? 409 : 503) } finally { runtime.human.finish(human.value) }
      }
      const parsed = decodeSfOperationInput("sf_document_extract", payload)
      if (!parsed.ok) return reply({ status: "invalid" }, 400)
      const digest = digestSfValue(parsed.value)
      const admitted = await runtime.ui.admit(request, "sf_document_extract", digest)
      if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
      try { const result = await runtime.dispatch("sf_document_extract", parsed.value, admitted.value); return result.status === "ok" ? reply({ status: "ok", value: result.result }, 200) : reply({ status: result.status, reason: documentFailure(result.reason) }, result.status === "denied" ? 403 : result.status === "stale" ? 409 : 503) } finally { runtime.ui.finish(admitted.value) }
    }
    if (mode === "document-candidates") {
      const documentRef = url.searchParams.get("documentRef")
      if (!documentRef || documentRef.length > 1024) return reply({ status: "invalid" }, 400)
      const runtime = input.runtime()
      if (!runtime) return reply({ status: "unavailable" }, 503)
      const digest = digestSfValue({ documentRef })
      const admitted = await runtime.ui.admit(request, "sf_document_extract", digest)
      if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
      try { if (!await runtime.ui.validate(admitted.value, "sf_document_extract", digest)) return reply({ status: "denied" }, 403); const result = await runtime.documents.list(documentRef, admitted.value); return result.status === "ok" ? reply({ status: "ok", value: result.value }, 200) : reply({ status: result.status, reason: documentFailure(result.reason) }, result.status === "denied" ? 403 : 503) } finally { runtime.ui.finish(admitted.value) }
    }
    if (mode === "document-schema") {
      if (request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site" || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ status: "denied" }, 403)
      const bytes = await bounded(request, 65536)
      if (!bytes) return reply({ status: "invalid" }, 413)
      const payload: unknown = await Promise.resolve().then(() => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))).catch(() => undefined)
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return reply({ status: "invalid" }, 400)
      const runtime = input.runtime()
      if (!runtime) return reply({ status: "unavailable" }, 503)
      const human = await runtime.human.admit(request, "documents.schema", payload)
      if (human.status !== "ok") return reply({ status: human.status }, 403)
      try { const result = await runtime.schemas.register(payload as DocumentSchemaInput, human.value); return result.status === "ok" ? reply({ status: "ok", value: result.value }, 200) : reply({ status: result.status, reason: documentFailure(result.reason) }, result.status === "denied" ? 403 : result.status === "conflict" || result.status === "stale" ? 409 : 400) } finally { runtime.human.finish(human.value) }
    }
    if (mode === "document-schemas") {
      const documentRef = url.searchParams.get("documentRef")
      if (!documentRef || documentRef.length > 1024) return reply({ status: "invalid" }, 400)
      const runtime = input.runtime()
      if (!runtime) return reply({ status: "unavailable" }, 503)
      const digest = digestSfValue({ documentRef })
      const admitted = await runtime.ui.admit(request, "sf_document_extract", digest)
      if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
      try { if (!await runtime.ui.validate(admitted.value, "sf_document_extract", digest)) return reply({ status: "denied" }, 403); const result = await runtime.schemas.list(documentRef, admitted.value); return result.status === "ok" ? reply({ status: "ok", value: result.value }, 200) : reply({ status: result.status, reason: documentFailure(result.reason) }, result.status === "denied" ? 403 : 503) } finally { runtime.ui.finish(admitted.value) }
    }
    const raw = url.searchParams.get("ref")
    if (!raw || new TextEncoder().encode(raw).byteLength > 8192) return reply({ status: "invalid" }, 400)
    const ref: unknown = await Promise.resolve().then(() => JSON.parse(raw)).catch(() => undefined)
    const decoded = decodeSfOperationInput("sf_evidence_get", { evidenceRef: ref })
    if (!decoded.ok || decoded.value.evidenceRef.kind !== "document") return reply({ status: "invalid" }, 400)
    const runtime = input.runtime()
    if (!runtime) return reply({ status: "unavailable" }, 503)
    const digest = digestSfValue(decoded.value)
    const admitted = await runtime.ui.admit(request, "sf_evidence_get", digest)
    if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
    try {
      if (!await runtime.ui.validate(admitted.value, "sf_evidence_get", digest)) return reply({ status: "denied" }, 403)
      const result = await runtime.documents.resolvePresentation(decoded.value.evidenceRef, admitted.value)
      if (result.status !== "ok") return reply({ status: result.status, reason: documentFailure(result.reason) }, result.status === "denied" ? 403 : result.status === "stale" ? 409 : 503)
      if (!await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
      return reply({ status: "ok", value: result.value }, 200)
    } finally { runtime.ui.finish(admitted.value) }
  }
}

async function bounded(request: Request, limit: number) {
  if (!request.body) return undefined
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const part = await reader.read()
    if (part.done) break
    length += part.value.byteLength
    if (length > limit) { await reader.cancel(); return undefined }
    chunks.push(part.value)
  }
  const bytes = new Uint8Array(length)
  chunks.reduce((offset, chunk) => { bytes.set(chunk, offset); return offset + chunk.byteLength }, 0)
  return bytes
}

function documentFailure(reason: string | undefined) {
  if (reason === "field-missing-or-ambiguous") return "A field is missing or ambiguous. Use an exact label and an unambiguous number or ISO date."
  if (["PDF has no text layer", "document has no extractable text"].includes(reason ?? "")) return "The document has no text layer. Scanned documents are not supported."
  if (["invalid or protected document", "protected DOCX", "invalid, protected, or oversized DOCX", "invalid PDF", "invalid UTF-8 document", "DOCX document XML missing"].includes(reason)) return "The document is invalid, protected, or cannot be decoded."
  if (["PDF page limit exceeded", "DOCX entry limit exceeded", "document size exceeds limits or is empty", "document text exceeds limits"].includes(reason)) return "The document exceeds the supported size, page, or text limit."
  if (["document-parser-busy", "document-parser-timeout", "document-parser-start-timeout"].includes(reason)) return "Document processing is busy or timed out. Try again."
  if (["document-selection-changed", "document-request-changed", "document-changed", "document-or-schema-changed", "schema-source-changed", "candidate-changed"].includes(reason)) return "The source or its Request changed. Refresh and review the current document."
  return "Document operation unavailable. Refresh the source and check your access."
}
