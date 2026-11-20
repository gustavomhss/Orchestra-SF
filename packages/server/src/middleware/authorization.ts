import { ServerAuth } from "../auth"
import type { SessionOwner } from "@orchestra/core/session/owner"
import { guardSessionEndpoint } from "../session-access"
import { parseSfInstallationSelector, readSfInstallations, type SfTrustedInstallationSource } from "../sucafina-installations"
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

export const authorizationLayerWith = (installed?: SfTrustedInstallationSource, owners?: SessionOwner.Interface) => Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const config = yield* ServerAuth.Config
    const protect = <A, E, R>(effect: Effect.Effect<A, E, R>, group: string, endpoint: string) =>
      Effect.gen(function* () {
        // Technical health contains no profile data. Corporate administration
        // remains on its separately authenticated installation mount.
        if (group === "server.health") return yield* effect
        if (installed) {
          const observed = yield* Effect.promise((signal) => installed.current(signal)).pipe(
            Effect.catchCause(() => Effect.succeed(undefined)),
          )
          // A failed/missing configured source is not evidence of a local host.
          if (!observed || observed.authMode !== "local-operator")
            return yield* new UnauthorizedError({ message: "Corporate installation admission required" })
        }
        if (owners) {
          const scope = yield* owners.open().pipe(Effect.mapError(() =>
            new UnauthorizedError({ message: "Corporate installation admission required" })))
          const value = yield* guardSessionEndpoint(owners, group, endpoint, effect)
          yield* owners.verify(scope).pipe(Effect.mapError(() =>
            new UnauthorizedError({ message: "Corporate installation admission required" })))
          return value
        }
        return yield* effect
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
        // Only the configured current Microsoft metadata endpoint is public; the descriptor grants no admission.
        if (installed && (yield* Effect.promise((signal) => publicBootstrap(request, installed, signal)))) return yield* effect
        if (!ServerAuth.required(config)) return yield* protect(effect, options.group.identifier, options.endpoint.name)
        const credential = yield* credentialFromRequest(request)
        if (ServerAuth.authorized(credential, config)) return yield* protect(effect, options.group.identifier, options.endpoint.name)
        if (process.env.SF_AUTH_DIAG === "1" && /^\/sucafina\/(?:dashboard|planner|procurement)$/.test(url.pathname)) {
          console.error("SF_AUTH_DIAG_LAYER", JSON.stringify({ layer: "server-middleware", stage: "authorization-denied", path: url.pathname }))
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(HttpServerResponse.setHeader(response, "x-sf-auth-layer", "server-middleware")),
          )
        }
        yield* HttpEffect.appendPreResponseHandler((_request, response) =>
          Effect.succeed(HttpServerResponse.setHeader(response, "www-authenticate", WWW_AUTHENTICATE)),
        )
        return yield* new UnauthorizedError({ message: "Authentication required" })
      }),
    )
  }),
)

export const authorizationLayer = authorizationLayerWith()

async function publicBootstrap(request: HttpServerRequest.HttpServerRequest, installed: SfTrustedInstallationSource, signal: AbortSignal) {
  if (request.method !== "GET" && request.method !== "HEAD") return false
  const url = new URL(request.url, "http://localhost")
  if (url.pathname !== "/api/sucafina/installations" || url.username || url.password || url.hash ||
    request.headers["sec-fetch-site"] === "cross-site" || request.headers["transfer-encoding"] !== undefined ||
    request.headers["content-length"] !== undefined && request.headers["content-length"] !== "0") return false
  try {
    const selector = parseSfInstallationSelector(request.url)
    if (selector.select !== "current") return false
    const result = await readSfInstallations(installed, selector, signal)
    const descriptor = result.installations.length === 1 ? result.installations[0] : undefined
    if (signal.aborted || !descriptor || descriptor.authMode !== "microsoft" ||
      descriptor.contractRevision !== "sf-team-profile/1") return false
    const source = request.source instanceof Request ? new URL(request.source.url) : undefined
    const host = request.headers.host ?? source?.host
    const origin = new URL(descriptor.publicOrigin)
    // Host comes from the actual transport. Forwarded hints never widen this exception.
    return host?.toLowerCase() === origin.host.toLowerCase() &&
      (!source || source.origin === descriptor.publicOrigin) &&
      (request.headers.origin === undefined || request.headers.origin === descriptor.publicOrigin)
  } catch { return false }
}
