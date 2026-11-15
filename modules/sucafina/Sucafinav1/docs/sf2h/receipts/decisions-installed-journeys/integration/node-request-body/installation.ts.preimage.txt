import path from "node:path"
import { realpath } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import type { Host } from "@orchestra/core/host"
import { Effect } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { createSfHostRuntime } from "./host-context"

export type SfInstallation = {
  mount: `/${string}`
  handler: (request: Request) => Promise<Response | undefined>
  dispose: () => void | Promise<void>
  host?: ReadonlyArray<Host.Contribution>
}

/** Explicit trusted-code factory, selected by the owner; never derived from an HTTP request. */
export async function loadSfInstallation(file: string, origin: string) {
  if (!path.isAbsolute(file) || new URL(origin).origin !== origin) throw new Error("SF_INSTALLATION_ABSOLUTE_PATH_AND_ORIGIN_REQUIRED")
  const module = await import(pathToFileURL(await realpath(file)).href)
  if (typeof module.default !== "function") throw new Error("SF_INSTALLATION_FACTORY_REQUIRED")
  const value: unknown = await module.default({ origin, createHostRuntime: createSfHostRuntime })
  if (!value || typeof value !== "object" || !("mount" in value) || typeof value.mount !== "string" || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(value.mount) || !("handler" in value) || typeof value.handler !== "function" || !("dispose" in value) || typeof value.dispose !== "function" || ("host" in value && !Array.isArray(value.host))) throw new Error("SF_INSTALLATION_FACTORY_INVALID")
  const installation = value as SfInstallation
  const route = Effect.gen(function* () {
    const incoming = yield* HttpServerRequest.HttpServerRequest
    if (incoming.headers.host?.toLowerCase() !== new URL(origin).host.toLowerCase()) return HttpServerResponse.empty({ status: 403 })
    const web = yield* HttpServerRequest.toWeb(incoming)
    if (new URL(web.url).origin !== origin) return HttpServerResponse.empty({ status: 403 })
    const response = yield* Effect.tryPromise({ try: (signal) => installation.handler(new Request(web, { signal })), catch: () => "installation-unavailable" as const })
    return response ? HttpServerResponse.fromWeb(response) : HttpServerResponse.empty({ status: 404 })
  }).pipe(Effect.catch(() => Effect.succeed(HttpServerResponse.empty({ status: 503 }))))
  // Effect registers a trailing wildcard at both the subtree and its base path.
  return { ...installation, layer: HttpRouter.add("*", `${installation.mount}/*`, route) }
}
