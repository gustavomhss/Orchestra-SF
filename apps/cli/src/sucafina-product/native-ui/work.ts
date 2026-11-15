/**
 * A12 native work projections. This is a *server-only* adapter: the Request
 * that reaches the real SF host is never recreated, and the existing UI
 * admission, source ports, redaction and finishing discipline remain in force.
 *
 * Detail uses the real producer's read+verify through a narrowly exposed
 * private host port. If I00 has not installed that port, it fails closed;
 * no authority, grant or trusted context is synthesized here.
 */
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { isSfPeriod } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { encodeCaseRef } from "../../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { WorkPresentationItem } from "../../../../../modules/sucafina/Sucafinav1/product/collaboration/work-port.ts"
import type { SfNativeHostDependencies, SfProjectionHandler } from "./router"

type WorkProjection = "home" | "search" | "work" | "work-item" | "work-selection"
type WorkError = "denied" | "unavailable" | "invalid" | "stale" | "conflict" | "needs-input"

const keys: Readonly<Record<WorkProjection, readonly string[]>> = {
  home: [],
  search: [],
  work: ["selectionRef", "start", "end"],
  "work-item": ["selectionRef", "actionRef", "start", "end"],
  "work-selection": ["start", "end"],
}

/** Public source status only. Never send a private authority reason or snapshot. */
function failure(request: Request, status: WorkError, revision?: string): Response {
  const httpStatus = status === "denied" ? 403
    : status === "invalid" || status === "needs-input" ? 400
    : status === "stale" || status === "conflict" ? 409 : 503
  return response(request, { status }, httpStatus, revision)
}

function response(request: Request, value: unknown, status = 200, revision?: string): Response {
  return new Response(request.method === "HEAD" ? null : JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-SF-Contract-Revision": "sf-native-ui/1",
      ...(revision ? { "X-SF-Access-Revision": revision } : {}),
    },
  })
}

function producerFailure(request: Request, value: { readonly status: string } | undefined, revision?: string) {
  switch (value?.status) {
    case "denied": return failure(request, "denied", revision)
    case "conflict": return failure(request, "conflict", revision)
    case "stale": return failure(request, "stale", revision)
    case "needs-input": return failure(request, "needs-input", revision)
    default: return failure(request, "unavailable", revision)
  }
}

function query(
  request: Request, deps: SfNativeHostDependencies, mode: WorkProjection,
): URLSearchParams | Response {
  const url = new URL(request.url)
  if (url.origin !== deps.origin || url.pathname !==
    String(deps.mount).replace(/\/$/, "") + "/api/ui/projections/" + mode ||
    request.headers.get("sec-fetch-site") === "cross-site" || request.signal.aborted) {
    return failure(request, "denied")
  }
  if (url.username || url.password || url.hash) return failure(request, "invalid")
  // NAV-01: GET/HEAD search and *any* URL query for search are forbidden.
  // The original Request (including abort signal and headers) is preserved.
  if (mode === "search") {
    if (request.method !== "POST" || url.search || !request.body ||
      !/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "") ||
      !/^[A-Za-z0-9._:-]{8,128}$/.test(request.headers.get("Idempotency-Key") ?? "") ||
      request.headers.get("origin") && request.headers.get("origin") !== deps.origin) return failure(request, "invalid")
    return url.searchParams
  }
  if (request.method !== "GET" && request.method !== "HEAD") return failure(request, "invalid")
  if (request.body !== null) return failure(request, "invalid")
  const expected = keys[mode]
  if ([...url.searchParams.keys()].some((key) =>
    !expected.includes(key) || url.searchParams.getAll(key).length !== 1) ||
    expected.some((key) => !url.searchParams.has(key))) return failure(request, "invalid")
  if (mode === "work" || mode === "work-selection" || mode === "work-item") {
    const period = { start: url.searchParams.get("start"), end: url.searchParams.get("end") }
    if (!isSfPeriod(period)) return failure(request, "invalid")
  }
  if ((mode === "work" || mode === "work-item") &&
    (!(url.searchParams.get("selectionRef") ?? "").trim() || (url.searchParams.get("selectionRef") ?? "").length > 16_384)) return failure(request, "invalid")
  if (mode === "work-item" &&
    (!(url.searchParams.get("actionRef") ?? "").trim() || (url.searchParams.get("actionRef") ?? "").length > 16_384)) return failure(request, "invalid")
  return url.searchParams
}

function currentHost(deps: SfNativeHostDependencies): SfHostServices | undefined {
  // This dependency is the live installed host, not a module-local singleton.
  return deps.runtime()
}

/** Consume the original JSON body with a hard byte limit even for chunked IO.
 * This read-only operation never writes search text into a URL, referrer or log. */
async function privateSearchBody(request: Request): Promise<{ q: string } | undefined> {
  if (!request.body) return undefined
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      total += chunk.value.byteLength
      if (total > 4096) {
        await reader.cancel().catch(() => undefined)
        return undefined
      }
      chunks.push(chunk.value)
    }
    if (!total) return undefined
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    // Exactly one literal q property: reject duplicate JSON keys before JSON.parse
    // can silently select the last value. The bounded UTF-8 decoder is strict.
    if (!/^\s*\{\s*"q"\s*:\s*"(?:\\.|[^"\\])*"\s*\}\s*$/.test(json)) return undefined
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      Object.keys(parsed).length !== 1 || !Object.hasOwn(parsed, "q")) return undefined
    const q = (parsed as { q: unknown }).q
    return typeof q === "string" && q.trim() && q.length <= 3800 ? { q } : undefined
  } catch { return undefined }
  finally { reader.releaseLock() }
}

async function search(
  request: Request, runtime: SfHostServices, payload: { q: string },
): Promise<Response> {
  const decoded = decodeSfOperationInput("sf_knowledge_search", {
    query: payload.q, limit: 20,
  })
  if (!decoded.ok) return failure(request, "invalid")
  const digest = digestSfValue(decoded.value)
  const admission = await runtime.ui.admit(request, "sf_knowledge_search", digest)
  if (admission.status !== "ok") return producerFailure(request, admission)
  const call = admission.value
  try {
    // dispatch owns its one-shot validateDomainContext; do not double-consume.
    const read = await runtime.dispatch("sf_knowledge_search", decoded.value, call)
    if (read.status !== "ok") return producerFailure(request, read, call.binding.accessRevision)
    const output = decodeSfOperationOutput("sf_knowledge_search", read.result)
    if (!output.ok) return failure(request, "unavailable")
    if (!await runtime.ui.revalidate(call)) return failure(request, "denied")
    return response(request, { status: "ok", value: {
      matches: output.value.matches, limitations: output.value.limitations,
    } }, 200, call.binding.accessRevision)
  } finally {
    runtime.ui.finish(call)
  }
}

function safeWorkItem(item: WorkPresentationItem) {
  // Field-by-field allowlist. No reviewContext, sourceRefs or trusted ports.
  return {
    kind: item.kind, actionRef: item.actionRef, title: item.title,
    ownerRef: item.ownerRef,
    ...(item.ownerLabel === undefined ? {} : { ownerLabel: item.ownerLabel }),
    ...(item.approvalStage === undefined ? {} : { approvalStage: item.approvalStage }),
    ...(item.reason === undefined ? {} : { reason: item.reason }),
    ...(item.due === undefined ? {} : { due: item.due }),
    ...(item.period === undefined ? {} : { period: item.period }),
    ...(item.sourceVersion === undefined ? {} : { sourceVersion: item.sourceVersion }),
    ...(item.observedVersion === undefined ? {} : { observedVersion: item.observedVersion }),
    state: item.state,
    ...(item.destination === undefined ? {} : { destination: item.destination }),
  }
}

async function work(
  request: Request, runtime: SfHostServices, params: URLSearchParams,
): Promise<Response> {
  if (!runtime.work) return failure(request, "unavailable")
  const decoded = decodeSfOperationInput("sf_work_list", {
    selectionRef: params.get("selectionRef") ?? "",
    period: { start: params.get("start") ?? "", end: params.get("end") ?? "" },
  })
  if (!decoded.ok) return failure(request, "invalid")
  const digest = digestSfValue(decoded.value)
  const admission = await runtime.ui.admit(request, "sf_work_list", digest)
  if (admission.status !== "ok") return producerFailure(request, admission)
  const call = admission.value
  try {
    if (!await runtime.ui.validate(call, "sf_work_list", digest)) return failure(request, "denied")
    const read = await runtime.work.listPresentation(decoded.value, call)
    if (read.status !== "ok") return producerFailure(request, read, call.binding.accessRevision)
    if (!await runtime.ui.revalidate(call)) return failure(request, "denied")
    return response(request, { status: "ok", value: {
      items: read.value.items.map(safeWorkItem),
    } }, 200, call.binding.accessRevision)
  } finally {
    runtime.ui.finish(call)
  }
}

/** The C58 destination producer owns authorization and the two real snapshots.
 * No Request reconstruction, copied grant or detail resolution in this adapter. */
async function workItem(
  request: Request, runtime: SfHostServices, params: URLSearchParams,
): Promise<Response> {
  if (!runtime.workDestinations) return failure(request, "unavailable")
  const selection = decodeSfOperationInput("sf_work_list", {
    selectionRef: params.get("selectionRef") ?? "",
    period: { start: params.get("start") ?? "", end: params.get("end") ?? "" },
  })
  if (!selection.ok) return failure(request, "invalid")
  const actionRef = params.get("actionRef") ?? ""
  const intent = { selection: selection.value, actionRef }
  const operation = "sf-human:collaboration.work.destination"
  const digest = digestSfValue(intent)
  const admitted = await runtime.ui.admit(request, operation, digest)
  if (admitted.status !== "ok") return producerFailure(request, admitted)
  const call = admitted.value
  try {
    if (!await runtime.ui.validate(call, operation, digest)) return failure(request, "denied")
    const found = await runtime.workDestinations.read(selection.value, actionRef, call)
    if (found.status !== "ok") return producerFailure(request, found, call.binding.accessRevision)
    const value = found.value.view
    // Period authority remains owned by destinations.read: thread and
    // confirmation item periods need not equal the work-list selector.
    if (value.item.actionRef !== actionRef || value.item.ownerRef !== call.binding.principalRef) {
      return failure(request, "denied", call.binding.accessRevision)
    }
    // Only the original producer's redacted presentation fields may egress.
    // Keep null/zero and version semantics; exclude sourceRefs/authority ports.
    const safe = { status: "ok", value: {
      item: safeWorkItem(value.item),
      details: value.details.map((detail) => ({ label: detail.label, value: detail.value })),
      links: value.links.map((link) => ({ label: link.label, url: link.url })),
    } }
    if (!await runtime.ui.revalidate(call) || !await found.value.verify()) {
      return failure(request, "denied", call.binding.accessRevision)
    }
    return response(request, safe, 200, call.binding.accessRevision)
  } finally { runtime.ui.finish(call) }
}

async function workSelection(
  request: Request, runtime: SfHostServices, params: URLSearchParams,
): Promise<Response> {
  if (!runtime.procurementSelections || !runtime.work) return failure(request, "unavailable")
  const period = { start: params.get("start") ?? "", end: params.get("end") ?? "" }
  if (!isSfPeriod(period)) return failure(request, "invalid")
  const digest = digestSfValue({ purpose: "work-selection", period })
  const admission = await runtime.ui.admit(request, "sf_work_list", digest)
  if (admission.status !== "ok") return producerFailure(request, admission)
  const call = admission.value
  try {
    if (!await runtime.ui.validate(call, "sf_work_list", digest)) return failure(request, "denied")
    const selected = await runtime.procurementSelections.create(call, period)
    if (selected.status !== "ok") return producerFailure(request, selected, call.binding.accessRevision)
    if (!await runtime.ui.revalidate(call)) return failure(request, "denied")
    return response(request, { status: "ok", value: {
      selectionRef: selected.value.selectionRef,
      label: selected.value.label,
      period: selected.value.period,
    } }, 200, call.binding.accessRevision)
  } finally {
    runtime.ui.finish(call)
  }
}

async function home(request: Request, runtime: SfHostServices): Promise<Response> {
  // Follow the original workbench landing candidate admission. An unreadable
  // case list is explicitly unavailable, not an empty authorized collection.
  let accepted: Awaited<ReturnType<SfHostServices["ui"]["admit"]>> | undefined
  let caseAccess = false
  for (const operation of ["sf_case_read", "sf_work_list", "sf_knowledge_search", "sf_routine_catalog"] as const) {
    const result = await runtime.ui.admit(request, operation, digestSfValue({}))
    if (result.status === "ok") {
      accepted = result
      caseAccess = operation === "sf_case_read"
      break
    }
  }
  if (!accepted || accepted.status !== "ok") return failure(request, "denied")
  const landing = accepted.value
  try {
    let cases: { status: "ok"; items: { caseRef: string; title: string; version: number }[] } | { status: "unavailable" } =
      { status: "unavailable" }
    if (caseAccess) {
      const listed = await runtime.state.read(request, "cases", (state, authority) =>
        Object.values(state.cases).filter((entry) => entry.participants.includes(authority.principalRef))
          .map((entry) => encodeCaseRef(entry)))
      if (listed.status === "ok") {
        const items = await Promise.all(listed.value.map(async (caseRef) => {
          const selection = { caseRef }
          const other = await runtime.ui.admit(request, "sf_case_read", digestSfValue(selection))
          if (other.status !== "ok") return undefined
          try {
            const read = await runtime.dispatch("sf_case_read", selection, other.value)
            if (read.status !== "ok" || !await runtime.ui.revalidate(other.value)) return undefined
            const decoded = decodeSfOperationOutput("sf_case_read", read.result)
            return decoded.ok
              ? { caseRef, title: decoded.value.case.objective, version: decoded.value.case.version }
              : undefined
          } finally {
            runtime.ui.finish(other.value)
          }
        }))
        cases = { status: "ok", items: items.filter((item): item is NonNullable<typeof item> => item !== undefined) }
      } else if (listed.status === "unavailable" && listed.reason === "product-state-uninitialized") {
        cases = { status: "ok", items: [] }
      }
    }

    let routines: { status: "ok"; items: { admission: string; runRef?: string }[] } |
      { status: "unavailable" } = { status: "unavailable" }
    if (runtime.routineRuns) {
      const digest = digestSfValue({ purpose: "routine-discovery" })
      const admitted = await runtime.ui.admit(request, "sf_routine_status", digest)
      if (admitted.status === "ok") {
        try {
          if (await runtime.ui.validate(admitted.value, "sf_routine_status", digest)) {
            const discovered = await runtime.routineRuns.discoverRuns(admitted.value)
            if (discovered.status === "ok" && await runtime.ui.revalidate(admitted.value)) {
              const entries: unknown = discovered.value
              if (Array.isArray(entries) && entries.every((entry) => entry && typeof entry === "object" &&
                typeof entry.admission === "string" && (entry.runRef === undefined || typeof entry.runRef === "string"))) {
                routines = { status: "ok", items: entries.map((entry) => ({
                  admission: entry.admission,
                  ...(entry.runRef === undefined ? {} : { runRef: entry.runRef }),
                })) }
              }
            }
          }
        } finally {
          runtime.ui.finish(admitted.value)
        }
      }
    }
    if (!await runtime.ui.revalidate(landing)) return failure(request, "denied")
    return response(request, { status: "ok", value: {
      cases, routines,
      workProducer: runtime.work && runtime.procurementSelections ? "available" : "unavailable",
      personalViewsProducer: runtime.personalViews ? "available" : "unavailable",
    } }, 200, landing.binding.accessRevision)
  } finally {
    runtime.ui.finish(landing)
  }
}

/** The work-item handler is inert until I00 exposes the real destination read
 * port; the operation ID is fixed and no alternative producer is created. */
export function createSfWorkProjectionHandlers(deps: SfNativeHostDependencies): readonly SfProjectionHandler[] {
  const handler = (mode: WorkProjection): SfProjectionHandler => ({
    operationId: ("projection." + mode) as
      "projection.home" | "projection.search" | "projection.work" | "projection.work-item" | "projection.work-selection",
    handle: async (request) => {
      const parsed = query(request, deps, mode)
      if (parsed instanceof Response) return parsed
      // Search parses a bounded private body before touching the host.
      const privatePayload = mode === "search" ? await privateSearchBody(request) : undefined
      if (mode === "search" && !privatePayload) return failure(request, "invalid")
      const runtime = currentHost(deps)
      if (!runtime) return failure(request, "unavailable")
      try {
        if (mode === "home") return await home(request, runtime)
        if (mode === "search") return privatePayload ? await search(request, runtime, privatePayload) : failure(request, "invalid")
        if (mode === "work") return await work(request, runtime, parsed)
        if (mode === "work-item") return await workItem(request, runtime, parsed)
        return await workSelection(request, runtime, parsed)
      } catch {
        // Never expose internal errors, prior-owner contents or private status.
        return failure(request, "unavailable")
      }
    },
  })
  return [
    handler("home"), handler("search"), handler("work"), handler("work-item"), handler("work-selection"),
  ]
}
