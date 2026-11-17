import path from "node:path"
import { realpath } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { NodeHttpServerRequest, NodeStream } from "@effect/platform-node"
import type { Host } from "@orchestra/core/host"
import { Effect, Layer, Option, Stream } from "effect"
import { Headers, HttpMiddleware, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { limitRequestBody, requestBodyLength, RequestBodyError } from "../../../../modules/sucafina/Sucafinav1/runtime/request-body.ts"
import type { MicrosoftTransport } from "../../../../modules/sucafina/Sucafinav1/runtime/microsoft-installation.ts"
import type { SfFilesHostSources } from "./native-ui/files"
import { mountSfFilesOriginalRoutes } from "./native-ui/files-routing"

export type SfInstallation = {
  mount: `/${string}`
  handler: (request: Request) => Promise<Response | undefined>
  dispose: () => void | Promise<void>
  host?: ReadonlyArray<Host.Contribution>
  transport?: MicrosoftTransport
  /** Private owner-injected ORIGINAL producers; absence remains fail-closed. */
  nativeFiles?: SfFilesHostSources
}

/** Explicit trusted-code factory, selected by the owner; never derived from an HTTP request. */
export async function loadSfInstallation(file: string, origin: string) {
  if (!path.isAbsolute(file) || new URL(origin).origin !== origin) throw new Error("SF_INSTALLATION_ABSOLUTE_PATH_AND_ORIGIN_REQUIRED")
  const { createSfHostRuntime } = await import("./host-context")
  const module = await import(pathToFileURL(await realpath(file)).href)
  if (typeof module.default !== "function") throw new Error("SF_INSTALLATION_FACTORY_REQUIRED")
  const value: unknown = await module.default({ origin, createHostRuntime: createSfHostRuntime })
  return composeSfInstallation(value, origin)
}

/** The normal loader and hosted composition fixtures use the same transport and route fences. */
export async function composeSfInstallation(value: unknown, origin: string) {
  if (new URL(origin).origin !== origin) throw new Error("SF_INSTALLATION_ORIGIN_REQUIRED")
  if (!value || typeof value !== "object" || !("mount" in value) || typeof value.mount !== "string" || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(value.mount) || !("handler" in value) || typeof value.handler !== "function" || !("dispose" in value) || typeof value.dispose !== "function" || ("host" in value && !Array.isArray(value.host))) throw new Error("SF_INSTALLATION_FACTORY_INVALID")
  const installation = value as SfInstallation
  const transport = readTransport("transport" in value ? value.transport : undefined, origin)
  const { microsoftRequest } = transport ? await import("../../../../modules/sucafina/Sucafinav1/runtime/microsoft-installation.ts") : { microsoftRequest: undefined }
  const requestOrigin = transport?.ingressOrigin ?? origin
  const files = installation.nativeFiles ? mountSfFilesOriginalRoutes({
    origin: requestOrigin, mount: installation.mount, sources: installation.nativeFiles,
  }) : undefined
  // Effect starts its HTTP span before route middleware and includes the full query.
  // Disable listener tracing for this explicit cloud installation, including malformed callbacks.
  const privacy = transport ? Layer.succeed(HttpMiddleware.TracerDisabledWhen)(() => true) : Layer.empty
  const route = Effect.gen(function* () {
    const incoming = yield* HttpServerRequest.HttpServerRequest
    if (incoming.headers.host?.toLowerCase() !== new URL(requestOrigin).host.toLowerCase()) return rejectIncoming(incoming, 403)
    // Forwarded hints are removed before either Node URL conversion or Microsoft admission.
    const sanitized = transport ? incoming.modify({ headers: Headers.fromInput(Object.entries(incoming.headers).filter(([name]) => name !== "forwarded" && !name.startsWith("x-forwarded-"))) }) : incoming
    const source = sanitized.source instanceof Request ? sanitized.source : undefined
    const url = source ? new URL(source.url) : Option.getOrUndefined(HttpServerRequest.toURL(sanitized))
    if (!url || url.origin !== requestOrigin) return rejectIncoming(incoming, 403)
    const authTrace = process.env.SF_AUTH_DIAG === "1" &&
      ["dashboard", "planner", "procurement"].some((surface) => url.pathname === `${installation.mount}/${surface}`)
    if (authTrace) console.error("SF_AUTH_DIAG_LAYER", JSON.stringify({ layer: "sf-route", stage: "enter", path: url.pathname }))
    if ((incoming.method === "GET" || incoming.method === "HEAD") && (sanitized.headers["transfer-encoding"] !== undefined || Number(sanitized.headers["content-length"]) > 0)) return rejectIncoming(incoming, 400)
    const configured = yield* HttpServerRequest.MaxBodySize
    const maximum = Number(configured ?? 16 * 1024 * 1024)
    const mode = url.searchParams.get("sf")
    // Keep the domain's 25MiB contract stream budget, while honoring smaller explicit host limits.
    // Original import HTTP consumes up to 16MiB of file bytes PLUS the
    // bounded multipart envelope. Do not disable a smaller explicit ingress cap.
    const originalImport = incoming.method === "POST" &&
      (url.pathname === `${installation.mount}/planner` ||
        url.pathname === `${installation.mount}/dashboard`) &&
      url.searchParams.size === 1 && url.searchParams.get("sf") === "import-admit"
    const maxImportEnvelope = 16 * 1024 * 1024 + 64 * 1024
    const limit = mode === "workbench" || mode?.startsWith("workbench-")
      ? Math.min(maximum, 65536)
      : originalImport
        ? maximum === 16 * 1024 * 1024
          ? maxImportEnvelope : Math.min(maximum, maxImportEnvelope)
      : incoming.method === "POST" && url.pathname === `${installation.mount}/dashboard` && !url.searchParams.has("sf") && url.searchParams.getAll("upload").length === 1 && url.searchParams.get("upload") === "contract"
        ? maximum === 16 * 1024 * 1024 ? 25 * 1024 * 1024 : Math.min(maximum, 25 * 1024 * 1024)
        : maximum
    const response = yield* Effect.tryPromise({
      try: async (signal) => {
        const node = source ? undefined : NodeHttpServerRequest.toIncomingMessage(sanitized)
        const nodeAbort = node ? new AbortController() : undefined
        const nodeState = { released: false, immediate: undefined as ReturnType<typeof setImmediate> | undefined }
        const absorbNodeError = () => {}
        const abortNode = () => nodeAbort?.abort()
        const releaseNode = () => {
          if (nodeState.released) return
          nodeState.released = true
          if (nodeState.immediate) {
            clearImmediate(nodeState.immediate)
            nodeState.immediate = undefined
          }
          node?.off("aborted", abortNode)
          node?.off("error", absorbNodeError)
          node?.off("close", releaseNode)
        }
        const releaseClosedNode = () => {
          // closed can become true before Node emits its queued error and close.
          if (node?.closed && !nodeState.released && !nodeState.immediate) {
            nodeState.immediate = setImmediate(releaseNode)
            nodeState.immediate.unref()
          }
        }
        try {
          // Body cancellation can remove the adapter's error listener before the
          // transport emits its queued error. Keep this guard until actual close.
          node?.on("error", absorbNodeError)
          node?.once("close", releaseNode)
          node?.once("aborted", abortNode)
          if (node?.aborted) abortNode()
          releaseClosedNode()
          // Reject the hint before creating a stream/fiber or allocating from caller-controlled sizes.
          const declared = (() => {
            try { return requestBodyLength(sanitized.headers["content-length"] ?? null, limit) }
            catch (error) {
              if (source?.body && !source.body.locked) void source.body.cancel().catch(() => undefined)
              throw error
            }
          })()
          const boundSignal = source ? AbortSignal.any([signal, source.signal]) : nodeAbort ? AbortSignal.any([signal, nodeAbort.signal]) : signal
          if (boundSignal.aborted) {
            if (source?.body && !source.body.locked) void source.body.cancel().catch(() => undefined)
            return bodyFailure(400)
          }
          const raw = incoming.method === "GET" || incoming.method === "HEAD" ? null : source ? source.body : Stream.toReadableStream(
            NodeStream.fromReadable<Uint8Array, RequestBodyError>({
              evaluate: () => NodeHttpServerRequest.toIncomingMessage(sanitized),
              // Cancelling the reader must not destroy the socket before the 413 response is flushed.
              closeOnDone: false,
              onError: () => new RequestBodyError(400),
            }), { strategy: { highWaterMark: 0 } },
          )
          const bounded = limitRequestBody(raw, { limit, declared, signal: boundSignal })
          try {
            if (bounded.failure()) return bodyFailure(bounded.failure()!.status)
            const web = new Request(url, { method: incoming.method, headers: sanitized.headers, body: bounded.body, signal: boundSignal, redirect: source?.redirect ?? "follow", ...(bounded.body ? { duplex: "half" } : {}) })
            const request = transport && microsoftRequest ? microsoftRequest(web, transport) : web
            // The same ORIGINAL authenticated Request flows to the installed
            // domain producer; never invoke a synthetic Request or bypass ingress.
            const result = request ? await (async () => {
              try {
                return (files ? await files(request) : undefined) ??
                  await installation.handler(request)
              } catch {
                return new Response(null, { status: 503, headers: {
                  "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
                } })
              }
            })() : new Response(null, { status: 403 })
            // Some domain parsers classify reader errors themselves. Only this private budget can override them.
            const failure = bounded.failure()
            if (failure) return bodyFailure(failure.status)
            const reply = result ?? new Response(null, { status: request ? 404 : 403 })
            if (bounded.complete()) return reply
            const closed = new Response(reply.body, reply)
            closed.headers.set("connection", "close")
            return closed
          } finally { bounded.dispose() }
        } finally {
          node?.off("aborted", abortNode)
          releaseClosedNode()
        }
      },
      catch: (error) => error instanceof RequestBodyError ? error : "installation-unavailable" as const,
    }).pipe(Effect.catch((error) => Effect.succeed(error instanceof RequestBodyError ? bodyFailure(error.status) : new Response(null, { status: 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", connection: "close" } }))))
    if (authTrace) console.error("SF_AUTH_DIAG_LAYER", JSON.stringify({ layer: "sf-route", stage: "exit", status: response.status }))
    return HttpServerResponse.fromWeb(response)
  }).pipe(Effect.catchCause(() => Effect.succeed(HttpServerResponse.empty({ status: 503, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", connection: "close" } }))))
  // The listener must install privacy before HttpRouter.serve, outside the request route.
  // Effect registers a trailing wildcard at both the subtree and its base path.
  return { ...installation, ...(transport ? { transport } : {}), privacy, layer: HttpRouter.add("*", `${installation.mount}/*`, route) }
}

function bodyFailure(status: 400 | 413) {
  return Response.json({ status: "invalid" }, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", connection: "close" } })
}

function rejectIncoming(request: HttpServerRequest.HttpServerRequest, status: 400 | 403) {
  const source = request.source
  if (source instanceof Request && source.body && !source.body.locked) void source.body.cancel().catch(() => undefined)
  return HttpServerResponse.empty({ status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", connection: "close" } })
}

function readTransport(value: unknown, origin: string): MicrosoftTransport | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== "object" || Object.keys(value).length !== 4 ||
    !("kind" in value) || value.kind !== "explicit-https-proxy" ||
    !("listenerOrigin" in value) || typeof value.listenerOrigin !== "string" ||
    !("ingressOrigin" in value) || typeof value.ingressOrigin !== "string" ||
    !("publicOrigin" in value) || typeof value.publicOrigin !== "string" ||
    value.listenerOrigin !== origin || !exactOrigin(value.listenerOrigin, "http:") ||
    !exactOrigin(value.ingressOrigin, "http:") || !exactOrigin(value.publicOrigin, "https:")) throw new Error("SF_INSTALLATION_TRANSPORT_INVALID")
  return Object.freeze({ kind: "explicit-https-proxy", listenerOrigin: value.listenerOrigin, ingressOrigin: value.ingressOrigin, publicOrigin: value.publicOrigin })
}

function exactOrigin(value: string, protocol: string): boolean {
  try {
    const url = new URL(value)
    return url.origin === value && url.protocol === protocol
  } catch {
    return false
  }
}
