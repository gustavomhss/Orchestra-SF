/**
 * F02 / CLI native projection router. This is an installation seam only.
 * The original Request has already passed composeSfInstallation ingress,
 * identity.handle / identity.prepare and the requested surface bootstrap.
 * I00 mounts this BEFORE business(request), not as an alternate backend.
 */
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"
import type { SfContextResult } from "@orchestra/schema/sucafina/context"
import type { Application } from "../../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { createSfContextHandler } from "./context.ts"

export type SfNativeHostDependencies = Readonly<{
  origin: string
  mount: string
  application: Application
  runtime: () => SfHostServices | undefined
  readContext: (request: Request) => Promise<SfContextResult>
}>

export type SfProjectionHandler = Readonly<{
  operationId: SfOperationId
  handle: (request: Request) => Promise<Response>
}>

export function mountSfNativeProjections(options: Readonly<{
  mount: string
  context: ReturnType<typeof createSfContextHandler>
  handlers: readonly SfProjectionHandler[]
}>): (request: Request) => Promise<Response | undefined> {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(options.mount)) {
    throw new Error("SF_NATIVE_MOUNT_INVALID")
  }
  const routes = new Map<string, Readonly<{ method: "GET" | "POST"; handler: (request: Request) => Promise<Response>; maxRequestBytes?: number }>>()
  const contextMeta = SfOperationRegistry["ctx.context"]
  if (!contextMeta || contextMeta.method !== "GET" ||
      contextMeta.pathTemplate !== "{mount}/api/ui/context" || contextMeta.responseMode !== "json") {
    throw new Error("SF_NATIVE_CONTEXT_CONTRACT_MISMATCH")
  }
  routes.set(options.mount + "/api/ui/context", { method: "GET", handler: options.context.handle })
  for (const candidate of options.handlers) {
    const meta = SfOperationRegistry[candidate.operationId]
    if (!meta || !["GET", "POST"].includes(meta.method)) {
      throw new Error("SF_NATIVE_UNKNOWN_OPERATION")
    }
    const path = meta.pathTemplate.replaceAll("{mount}", options.mount)
    if (!path.startsWith(options.mount + "/api/ui/") ||
        path.includes("{") || path.includes("}") || path.includes("//") ||
        path.includes("..") || path.includes("?") || path.includes("#")) {
      throw new Error("SF_NATIVE_NOT_A_PROJECTION")
    }
    if (routes.has(path)) throw new Error("SF_NATIVE_DUPLICATE_PROJECTION_ROUTE")
    // The frozen registry is a literal union: body caps exist only on
    // operations that declare them. A POST projection must never mount
    // without its own valid bound; GET projections have no request body.
    const maxRequestBytes = "maxRequestBytes" in meta ? meta.maxRequestBytes : undefined
    if (meta.method === "POST" &&
        (maxRequestBytes === undefined || !Number.isSafeInteger(maxRequestBytes) || maxRequestBytes <= 0)) {
      throw new Error("SF_NATIVE_PROJECTION_LIMIT_MISSING")
    }
    routes.set(path, {
      method: meta.method,
      handler: candidate.handle,
      ...(maxRequestBytes !== undefined ? { maxRequestBytes } : {}),
    })
  }

  return async (request) => {
    const url = new URL(request.url)
    const route = routes.get(url.pathname)
    if (!route) return undefined
    // No URL rewrite/new Request, no body pre-read, no authority from an ID.
    if (request.method !== route.method) return new Response(null, {
      status: 405, headers: { Allow: route.method, "Cache-Control": "no-store" },
    })
    // NAV-01: private search accepts only bounded POST JSON; never URL query.
    // Reject query strings before handing the original Request to the producer.
    if (url.pathname === options.mount + "/api/ui/projections/search" && url.search) {
      return Response.json({ status: "invalid" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    if (url.username || url.password || url.hash || url.search.length > 4096 ||
        [...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length !== 1)) {
      return Response.json({ status: "invalid" }, {
        status: 400, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      })
    }
    const declared = request.headers.get("content-length")
    if (declared !== null && !/^(0|[1-9][0-9]*)$/.test(declared)) {
      return Response.json({ status: "invalid" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    if (route.method === "GET" && (request.headers.has("transfer-encoding") || declared !== null && declared !== "0")) {
      return Response.json({ status: "invalid" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    if (route.maxRequestBytes !== undefined && declared !== null && Number(declared) > route.maxRequestBytes) {
      return Response.json({ status: "invalid" }, { status: 413, headers: { "Cache-Control": "no-store" } })
    }
    // Content-Length is only a preflight hint. The original producer retains
    // ownership of streamed byte limits/admission; never consume or clone Request.
    // The injected handler is owned by its domain and must perform its own
    // current principal/role/field admission and end-of-transaction revalidation.
    return route.handler(request)
  }
}
