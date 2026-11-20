import type { Host } from "@orchestra/core/host"
import { Location } from "@orchestra/core/location"
import { SessionOwner } from "@orchestra/core/session/owner"
import { Authorization } from "@orchestra/protocol/middleware/authorization"
import { Context, Effect, Layer, Schema, Scope } from "effect"
import { HttpEffect, HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "./api"
import { BodyLimit } from "./body-limit"
import { EventHandler } from "./handlers/event"
import { MessageHandler } from "./handlers/message"
import { ReferenceHandler } from "./handlers/reference"
import { SessionHandler } from "./handlers/session"
import { layer } from "./location"
import { schemaErrorLayer } from "./middleware/schema-error"
import { sessionLocationLayer } from "./middleware/session-location"
import { guardSessionEndpoint, InstalledSession, unauthorized } from "./session-access"

const sessionApi = HttpApi.make("server")
  .add(Api.groups["server.session"])
  .add(Api.groups["server.message"])
  .add(Api.groups["server.event"])
  .add(Api.groups["server.reference"])

export interface InstalledSessionOptions {
  readonly origin: string
  readonly mount: string
  /** Server-private producer. The same original Request reaches Microsoft admission and every recheck. */
  readonly readAdmission: (original: Request) => Promise<SessionOwner.Admission | undefined>
  readonly location: () => Location.Ref | undefined
}

export const isInstalledSessionPath = (pathname: string, mount: string) =>
  pathname === mount + "/api/session" || pathname.startsWith(mount + "/api/session/") ||
  pathname === mount + "/api/event" || pathname === mount + "/api/reference"

/**
 * Build only HTTP adapters over the root's existing services and reference overrides.
 * The calling Host runtime owns disposal before its application graph is released.
 */
export const makeInstalledSessionHttp = (options: InstalledSessionOptions) => Effect.gen(function* () {
  const services = (yield* Effect.context<Host.RuntimeServices>()).pipe(Context.omit(Scope.Scope))
  const owners = yield* SessionOwner.Service
  const authorization = Layer.succeed(Authorization, Authorization.of((effect, metadata) => Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    yield* HttpEffect.appendPreResponseHandler((_request, response) => Effect.succeed(
      HttpServerResponse.setHeaders(response, { "cache-control": "no-store", "x-content-type-options": "nosniff" }),
    ))
    const original = request.source
    if (!(original instanceof Request) || original.signal.aborted) return yield* unauthorized()
    const url = new URL(original.url)
    const host = original.headers.get("host")
    if (url.origin !== options.origin || host !== null && host.toLowerCase() !== new URL(options.origin).host.toLowerCase() ||
      !isInstalledSessionPath(url.pathname, options.mount) ||
      original.headers.has("authorization") || url.searchParams.has("auth_token") ||
      original.headers.get("sec-fetch-site") === "cross-site" ||
      original.headers.has("origin") && original.headers.get("origin") !== options.origin ||
      !["GET", "HEAD"].includes(original.method) && original.headers.get("origin") !== options.origin) return yield* unauthorized()
    const observed: { admission?: SessionOwner.Admission } = {}
    const lease = yield* owners.capture(() => Effect.promise(() => options.readAdmission(original)).pipe(
      Effect.tap((admission) => Effect.sync(() => { observed.admission = admission })),
    )).pipe(Effect.mapError(unauthorized))
    const admission = observed.admission
    const placement = options.location()
    if (!lease || !admission || !placement || original.signal.aborted) return yield* unauthorized()
    const location = yield* Schema.decodeUnknownEffect(Location.Ref)(placement).pipe(Effect.mapError(unauthorized))
    return yield* SessionOwner.withLease(lease, Effect.gen(function* () {
      const scope = yield* owners.open().pipe(Effect.mapError(unauthorized))
      return yield* guardSessionEndpoint(owners, metadata.group.identifier, metadata.endpoint.name, effect).pipe(
        Effect.provideService(InstalledSession, Object.freeze({ scope, binding: admission.binding, location })),
      )
    }))
  })))
  // Prefix only the Effect routing view. HttpServerRequest.source remains the
  // identical original Web Request admitted above; no authenticated Request is rebuilt.
  const prefix = Layer.effect(HttpRouter.HttpRouter,
    Effect.map(HttpRouter.HttpRouter, (router) => router.prefixed(options.mount)))
  const routes = HttpApiBuilder.layer(sessionApi).pipe(
    Layer.provide(Layer.mergeAll(SessionHandler, MessageHandler, EventHandler, ReferenceHandler)),
    Layer.provide(sessionLocationLayer),
    Layer.provide(layer),
    Layer.provide(authorization),
    Layer.provide(schemaErrorLayer),
    Layer.provide(BodyLimit.layerWithMount(options.mount)),
    Layer.provide(Layer.succeedContext(services)),
    Layer.provide(prefix),
    Layer.provide(HttpServer.layerServices),
  )
  const http = yield* Effect.acquireRelease(
    Effect.sync(() => HttpRouter.toWebHandler(routes, { disableLogger: true })),
    (value) => Effect.promise(() => value.dispose()),
  )
  return http.handler
})
