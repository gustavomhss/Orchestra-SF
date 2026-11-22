export * as BodyLimit from "./body-limit"

import { Effect, FileSystem } from "effect"
import { HttpRouter, HttpServerError, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

const MiB = 1024 * 1024

/** Most routes carry small JSON; relay documents and config are the largest of them. */
export const DEFAULT_LIMIT = 16 * MiB

/**
 * Routes that carry user files as base64 inside JSON. The desktop picker allows 20 MiB of attachments per prompt and the
 * board allows 25 MiB per file; base64 adds a third, so 64 MiB leaves headroom for both.
 */
export const UPLOAD_LIMIT = 64 * MiB
const UPLOAD_ROUTES = [
  /^\/api\/session\/[^/]+\/(?:prompt|command|synthetic)$/,
  /^\/api\/board\/[^/]+\/issue\/[^/]+\/attachment$/,
]

export function limitFor(pathname: string) {
  return UPLOAD_ROUTES.some((route) => route.test(pathname)) ? UPLOAD_LIMIT : DEFAULT_LIMIT
}

/**
 * Caps every request body. A declared `Content-Length` over the limit is refused with 413 before a byte is read; a body
 * with no length (chunked) is cut off once it passes the limit through `HttpServerRequest.MaxBodySize`, which the Node
 * server enforces while it reads, so memory stays bounded either way.
 */
export const withLimit = (override?: (request: HttpServerRequest.HttpServerRequest) => number | undefined) => HttpRouter.middleware(
  (effect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const limit = override?.(request) ?? limitFor(request.url.split("?", 1)[0])
      const declared = Number(request.headers["content-length"])
      if (declared > limit) return tooLarge(limit)
      return yield* effect.pipe(
        // The API reads its payload with `orDie`, and JSON syntax failures also arrive as defects.
        Effect.catchDefect((defect) => (exceeded(defect) ? Effect.succeed(tooLarge(limit)) : malformedJson(request, defect))),
        Effect.provideService(HttpServerRequest.MaxBodySize, FileSystem.Size(limit)),
      )
    }),
  { global: true },
)

/** Preserve the canonical upload cap when the installed adapter prefixes its routes. */
export const layerWithMount = (mount: string) => withLimit((request) => {
  const pathname = request.url.split("?", 1)[0]!
  return limitFor(pathname.startsWith(mount + "/") ? pathname.slice(mount.length) : pathname)
})

export const layer = withLimit()

function exceeded(defect: unknown) {
  return (
    HttpServerError.isHttpServerError(defect) &&
    defect.reason._tag === "RequestParseError" &&
    defect.reason.cause instanceof Error &&
    defect.reason.cause.message === "maxBytes exceeded"
  )
}

function malformedJson(request: HttpServerRequest.HttpServerRequest, defect: unknown) {
  const contentType = request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase()
  if (!(defect instanceof SyntaxError) || contentType !== "application/json") return Effect.die(defect)
  // The API has already cached this bounded text. Confirm syntax so a handler's own SyntaxError stays a 500.
  return Effect.flatMap(Effect.orDie(request.text), (text) => {
    try { JSON.parse(text) } catch (error) {
      if (error instanceof SyntaxError) return Effect.succeed(HttpServerResponse.jsonUnsafe(
        { _tag: "InvalidRequestError", message: "Invalid JSON request body", kind: "Payload" },
        { status: 400 },
      ))
    }
    return Effect.die(defect)
  })
}

function tooLarge(limit: number) {
  return HttpServerResponse.jsonUnsafe(
    { _tag: "PayloadTooLargeError", message: `Request body exceeds the ${limit / MiB} MiB limit` },
    // The unread body is dropped with the connection instead of being drained.
    { status: 413, headers: { connection: "close" } },
  )
}
