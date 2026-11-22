import { ServerAuth } from "../auth"
import type { SessionOwner } from "@orchestra/core/session/owner"
import { guardSessionEndpoint, unauthorized } from "../session-access"
import { UnauthorizedError } from "@orchestra/protocol/errors"
import { Authorization } from "@orchestra/protocol/middleware/authorization"
export { Authorization } from "@orchestra/protocol/middleware/authorization"
import { hasPtyConnectTicketURL } from "@orchestra/protocol/groups/pty"
import { hasCapabilityContentTicketURL } from "@orchestra/protocol/groups/capability-artifacts"
import { Effect, Encoding, Layer, Redacted } from "effect"
import { HttpEffect, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

const AUTH_TOKEN_QUERY = "auth_token"
// EventSource and WebSocket cannot set an Authorization header, so only their routes read credentials
// from the query string. Everywhere else a URL credential would leak into logs and history for nothing.
const AUTH_TOKEN_QUERY_PATH = /^\/api\/(?:event|session\/[^/]+\/event|pty\/[^/]+\/connect)$/
const WWW_AUTHENTICATE = 'Basic realm="Secure Area"'

function emptyCredential() {
  return { username: "", password: Redacted.make("") }
}

function decodeCredential(input: string) {
  return Effect.fromResult(Encoding.decodeBase64String(input)).pipe(
    Effect.match({
      onFailure: emptyCredential,
      onSuccess: (header) => {
        const separator = header.indexOf(":")
        if (separator === -1) return emptyCredential()
        return { username: header.slice(0, separator), password: Redacted.make(header.slice(separator + 1)) }
      },
    }),
  )
}

function credentialFromRequest(request: HttpServerRequest.HttpServerRequest) {
  const url = new URL(request.url, "http://localhost")
  const token = AUTH_TOKEN_QUERY_PATH.test(url.pathname) ? url.searchParams.get(AUTH_TOKEN_QUERY) : null
  if (token) return decodeCredential(token)
  const match = /^Basic\s+(.+)$/i.exec(request.headers.authorization ?? "")
  if (match) return decodeCredential(match[1])
  return Effect.succeed(emptyCredential())
}

export const authorizationLayerWith = (owners?: SessionOwner.Interface) => Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const config = yield* ServerAuth.Config
    const protect = <A, E, R>(effect: Effect.Effect<A, E, R>, group: string, endpoint: string) =>
      Effect.gen(function* () {
        if (!owners || group === "server.health") return yield* effect
        const scope = yield* owners.open().pipe(Effect.mapError(unauthorized))
        const value = yield* guardSessionEndpoint(owners, group, endpoint, effect)
        yield* owners.verify(scope).pipe(Effect.mapError(unauthorized))
        return value
      })
    return Authorization.of((effect, options) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        // Browsers cannot set headers on WebSocket upgrades, so a ticketed PTY connect skips
        // credential checks here; the connect handler consumes and validates the ticket.
        const url = new URL(request.url, "http://localhost")
        if (hasPtyConnectTicketURL(url)) return yield* protect(effect, options.group.identifier, options.endpoint.name)
        // Media elements cannot send headers either; the content handler verifies the HMAC ticket.
        if (hasCapabilityContentTicketURL(url)) return yield* protect(effect, options.group.identifier, options.endpoint.name)
        if (!ServerAuth.required(config)) return yield* protect(effect, options.group.identifier, options.endpoint.name)
        const credential = yield* credentialFromRequest(request)
        if (ServerAuth.authorized(credential, config)) return yield* protect(effect, options.group.identifier, options.endpoint.name)
        yield* HttpEffect.appendPreResponseHandler((_request, response) =>
          Effect.succeed(HttpServerResponse.setHeader(response, "www-authenticate", WWW_AUTHENTICATE)),
        )
        return yield* new UnauthorizedError({ message: "Authentication required" })
      }),
    )
  }),
)

export const authorizationLayer = authorizationLayerWith()
