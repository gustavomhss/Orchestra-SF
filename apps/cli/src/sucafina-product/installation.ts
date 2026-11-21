import { realpath } from "node:fs/promises"
import { isIP } from "node:net"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Effect } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

type Installation = {
  mount: string
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
  const route = Effect.gen(function* () {
    const incoming = yield* HttpServerRequest.HttpServerRequest
    if (incoming.headers.host?.toLowerCase() !== origin.host) return HttpServerResponse.empty({ status: 403 })
    const request = yield* HttpServerRequest.toWeb(incoming)
    const url = new URL(request.url)
    if (url.origin !== origin.origin) return HttpServerResponse.empty({ status: 403 })
    if (url.pathname !== installation.mount && !url.pathname.startsWith(`${installation.mount}/`)) {
      return HttpServerResponse.empty({ status: 404 })
    }
    const response = yield* Effect.tryPromise((signal) =>
      installation.handler(new Request(request, { signal: AbortSignal.any([request.signal, signal]) })),
    )
    return response ? HttpServerResponse.fromWeb(response) : HttpServerResponse.empty({ status: 404 })
  }).pipe(Effect.catch(() => Effect.succeed(HttpServerResponse.empty({ status: 503 }))))
  return {
    dispose: () => installation.dispose(),
    // Effect registers a trailing wildcard for both the mount and its subtree.
    layer: HttpRouter.add("*", `${installation.mount}/*`, route),
  }
}
