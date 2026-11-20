import type { Host } from "@orchestra/core/host"
import { SessionOwner } from "@orchestra/core/session/owner"
import { ProviderAccess } from "@orchestra/schema/provider-access"
import { Context, Effect, Schema, Scope } from "effect"

type Options = Readonly<{
  origin: string
  mount: string
  readAdmission: (original: Request) => Promise<SessionOwner.Admission | undefined>
}>
type Failure = Readonly<{ status: "denied" | "unavailable" | "invalid-request" }>
const respond = (value: ProviderAccess.Catalog | Failure, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
    "x-content-type-options": "nosniff", ...extra,
  } })
export const isInstalledProviderCatalogPath = (pathname: string, mount: string) =>
  pathname === mount + "/api/provider/catalog"

/** Read only current private provider metadata; selection cannot construct a provider capability. */
export const makeInstalledProviderCatalogHttp = (options: Options) => Effect.gen(function* () {
  if (!URL.canParse(options.origin) || new URL(options.origin).origin !== options.origin ||
      new URL(options.origin).protocol !== "https:" ||
      !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(options.mount))
    throw new Error("Invalid installed provider catalog HTTP binding")
  const services = (yield* Effect.context<Host.RuntimeServices>()).pipe(Context.omit(Scope.Scope))
  const owners = yield* SessionOwner.Service
  const origin = options.origin
  const mount = options.mount
  const readAdmission = options.readAdmission
  return async (original: Request): Promise<Response> => {
    const url = new URL(original.url)
    const host = original.headers.get("host")
    if (!isInstalledProviderCatalogPath(url.pathname, mount)) return respond({ status: "invalid-request" }, 404)
    if (url.origin !== origin || url.username || url.password || host !== null && host.toLowerCase() !== new URL(origin).host.toLowerCase() ||
        original.headers.has("authorization") || original.headers.get("sec-fetch-site") === "cross-site" ||
        original.headers.has("origin") && original.headers.get("origin") !== origin || original.signal.aborted)
      return respond({ status: "denied" }, 403)
    if (original.method !== "GET") return respond({ status: "invalid-request" }, 405, { allow: "GET" })
    if (original.url.includes("?") || original.url.includes("#") || original.body !== null ||
        original.headers.has("transfer-encoding") || original.headers.has("content-encoding") ||
        original.headers.has("content-length") && original.headers.get("content-length") !== "0")
      return respond({ status: "invalid-request" }, 400)
    const effect = Effect.gen(function* () {
      const lease = yield* owners.capture(() => Effect.promise(() => readAdmission(original)))
      if (!lease || original.signal.aborted) return respond({ status: "denied" }, 403)
      return yield* SessionOwner.withLease(lease, Effect.gen(function* () {
        const scope = yield* owners.open()
        const catalog = yield* owners.providerCatalog(scope).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(ProviderAccess.Catalog)),
        )
        yield* owners.assertCurrent(scope)
        if (original.signal.aborted) return respond({ status: "denied" }, 403)
        return respond(catalog, 200)
      }))
    }).pipe(
      Effect.catchIf((error) => error instanceof SessionOwner.Denied, (error) => Effect.succeed(
        error.reason === "storage-unavailable" ? respond({ status: "unavailable" }, 503) : respond({ status: "denied" }, 403),
      )),
      Effect.catchCause(() => Effect.succeed(respond({ status: "unavailable" }, 503))),
    )
    return Effect.runPromiseWith(services)(effect)
  }
})
