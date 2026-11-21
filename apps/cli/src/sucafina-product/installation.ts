import { realpath } from "node:fs/promises"
import { isIP } from "node:net"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { NodeHttpServerRequest, NodeStream } from "@effect/platform-node"
import { Effect, Option, Stream } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

type Installation = {
  mount: `/${string}`
  handler: (request: Request) => Promise<Response | undefined>
  dispose: () => void | Promise<void>
}

/** The operator selects trusted code at startup. HTTP requests cannot select the factory or its origin. */
export async function loadSfInstallation(file: string, hostname: string, port: number | undefined) {
  if (!path.isAbsolute(file)) throw new Error("--installation requires an absolute factory path")
  if (!port || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("--installation requires an explicit port from 1 to 65535")
  }
  const host = isIP(hostname) === 6 ? `[${hostname}]` : hostname
  if (host === hostname && !/^[a-z0-9.-]+$/i.test(host)) throw new Error("Invalid installation hostname")
  const origin = new URL(`http://${host}:${port}`)
  const factory: unknown = (await import(pathToFileURL(await realpath(file)).href)).default
  if (typeof factory !== "function") throw new Error("Installation factory must be the default export")
  const value: unknown = await factory({ origin: origin.origin })
  if (!value || typeof value !== "object" || !("dispose" in value) || typeof value.dispose !== "function") {
    throw new Error("Installation factory must provide a disposer")
  }
  if (
    !("mount" in value) || typeof value.mount !== "string" ||
    !/^\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+$/i.test(value.mount) || /^\/api(?:\/|$)/i.test(value.mount) ||
    !("handler" in value) || typeof value.handler !== "function"
  ) {
    await value.dispose()
    throw new Error("Installation factory must provide a valid, non-API mount and handler")
  }
  const installation = value as Installation
  const bodyLimit = (incoming: HttpServerRequest.HttpServerRequest) => {
    if (incoming.method !== "POST") return undefined
    const url = Option.getOrUndefined(HttpServerRequest.toURL(incoming))
    if (url?.origin === origin.origin && url.pathname === `${installation.mount}/dashboard` &&
      url.searchParams.getAll("upload").length === 1 && url.searchParams.get("upload") === "contract") {
      return 25 * 1024 * 1024
    }
  }
  const route = Effect.gen(function* () {
    const incoming = yield* HttpServerRequest.HttpServerRequest
    const authority = incoming.headers.host?.toLowerCase()
    if (authority !== origin.host && !(port === 80 && authority === `${origin.host}:80`)) {
      return HttpServerResponse.empty({ status: 403 })
    }
    const source = incoming.source instanceof Request ? incoming.source : undefined
    const url = source ? new URL(source.url) : Option.getOrUndefined(HttpServerRequest.toURL(incoming))
    if (url?.origin !== origin.origin) return HttpServerResponse.empty({ status: 403 })
    if (url.pathname !== installation.mount && !url.pathname.startsWith(`${installation.mount}/`)) {
      return HttpServerResponse.empty({ status: 404 })
    }
    const max = Number((yield* HttpServerRequest.MaxBodySize) ?? 16 * 1024 * 1024)
    return yield* Effect.tryPromise(async (signal) => {
      if (source) {
        const response = await installation.handler(new Request(source, { signal: AbortSignal.any([source.signal, signal]) }))
        return response ? HttpServerResponse.fromWeb(response) : HttpServerResponse.empty({ status: 404 })
      }
      const node = NodeHttpServerRequest.toIncomingMessage(incoming)
      const carriesBody = Boolean(incoming.headers["transfer-encoding"] || Number(incoming.headers["content-length"]) > 0)
      if (carriesBody && (incoming.method === "GET" || incoming.method === "HEAD")) {
        return HttpServerResponse.empty({ status: 400, headers: { connection: "close" } })
      }
      let bytes = 0
      let exceeded = false
      // Cancellation after an early rejection must leave the socket open long enough to write the response.
      const body = carriesBody ? Stream.toReadableStream(
        NodeStream.fromReadable<Uint8Array>({ evaluate: () => node, closeOnDone: false }).pipe(
          Stream.mapEffect((chunk) => {
            bytes += chunk.byteLength
            if (bytes <= max) return Effect.succeed(chunk)
            exceeded = true
            return Effect.fail(new Error("Installation request body exceeds the limit"))
          }),
        ),
        { strategy: { highWaterMark: 0 } },
      ) : null
      if (body && !node.closed) {
        // A disconnect can emit a Node error after the stream adapter releases its listeners.
        const ignoreDisconnect = () => {}
        node.on("error", ignoreDisconnect)
        node.once("close", () => node.off("error", ignoreDisconnect))
      }
      const response = await installation.handler(new Request(url, {
        method: incoming.method, headers: incoming.headers, signal, ...(body ? { body, duplex: "half" } : {}),
      })).catch(() => new Response(null, { status: 503 }))
      if (body && !body.locked) void body.cancel().catch(() => undefined)
      if (exceeded) return HttpServerResponse.empty({ status: 413, headers: { connection: "close" } })
      const result = response ? HttpServerResponse.fromWeb(response) : HttpServerResponse.empty({ status: 404 })
      return body && !node.readableEnded ? HttpServerResponse.setHeader(result, "connection", "close") : result
    })
  }).pipe(Effect.catch(() => Effect.succeed(HttpServerResponse.empty({ status: 503, headers: { connection: "close" } }))))
  return {
    dispose: () => installation.dispose(),
    bodyLimit,
    // Effect registers a trailing wildcard for both the mount and its subtree.
    layer: HttpRouter.add("*", `${installation.mount}/*`, route),
  }
}
