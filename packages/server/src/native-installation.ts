export * as NativeInstallation from "./native-installation"

import { Context, Effect, Layer } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

export interface Interface {
  readonly handle: (request: Request) => Promise<Response | undefined>
}

export const Service = Context.Reference<Interface>("@orchestra/server/NativeInstallation", {
  defaultValue: () => ({ handle: async () => undefined }),
})

const mount = "/api/sucafina"
const bridgeName = "sucafina_host_bridge"
const nativePair = /^(sucafina_operator_[a-f0-9]{24})=([a-f0-9]{64})$/

function bridgePair(request: Request) {
  const cookies = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim())
    .filter((part) => part.startsWith(`${bridgeName}=`))
  if (cookies.length !== 1) return undefined
  const value = cookies[0]!.slice(bridgeName.length + 1)
  const match = /^(sucafina_operator_[a-f0-9]{24})\.([a-f0-9]{64})$/.exec(value)
  return match ? `${match[1]}=${match[2]}` : undefined
}

async function status(installation: Interface, request: Request, pair: string) {
  const url = new URL(request.url)
  const response = await installation.handle(new Request(new URL(`${mount}/status`, url.origin), {
    headers: { cookie: pair },
    signal: request.signal,
  })).catch(() => undefined)
  if (!response || response.status !== 200) return undefined
  const value: unknown = await response.json().catch(() => undefined)
  if (!value || typeof value !== "object" || !("configured" in value) || value.configured !== true ||
    !("authenticated" in value) || value.authenticated !== true || !("authentication" in value) ||
    value.authentication !== "local-operator" || !("principal" in value) || !value.principal ||
    typeof value.principal !== "object" || !("id" in value.principal) || typeof value.principal.id !== "string" ||
    !value.principal.id.trim() || !("name" in value.principal) || typeof value.principal.name !== "string" ||
    !value.principal.name.trim() || !("sessionScope" in value) || typeof value.sessionScope !== "string" ||
    !value.sessionScope.trim()) return undefined
  return { id: value.principal.id, name: value.principal.name, scope: value.sessionScope }
}

export async function verifyBridge(installation: Interface, request: Request) {
  const url = new URL(request.url)
  const origin = request.headers.get("origin")
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") return undefined
  if (origin !== null && origin !== url.origin) return undefined
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && origin !== url.origin) return undefined
  const pair = bridgePair(request)
  if (!pair) return undefined
  return status(installation, request, pair)
}

async function delegate(installation: Interface, request: Request) {
  const url = new URL(request.url)
  const response = await installation.handle(request).catch(() => undefined)
  if (!response) return new Response(null, { status: 503, headers: { "cache-control": "no-store" } })
  if (url.pathname === `${mount}/auth/local` && request.method === "GET" && response.status === 303) {
    const cookies = response.headers.getSetCookie().filter((cookie) => /(?:^|;)\s*Path=\/api\/sucafina(?:;|$)/i.test(cookie))
    const match = cookies.length === 1 ? nativePair.exec(cookies[0]!.split(";", 1)[0]!) : null
    if (!match || !await status(installation, request, `${match[1]}=${match[2]}`)) return response
    const headers = new Headers(response.headers)
    headers.append("set-cookie", `${bridgeName}=${match[1]}.${match[2]}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=28800`)
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  }
  if (url.pathname === `${mount}/auth/logout` && request.method === "POST" && response.status === 204) {
    const headers = new Headers(response.headers)
    headers.append("set-cookie", `${bridgeName}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0`)
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  }
  if (url.pathname !== `${mount}/status` || request.method !== "GET" || response.status !== 200) return response
  const identity = await verifyBridge(installation, request)
  const value: unknown = await response.clone().json().catch(() => undefined)
  if (!value || typeof value !== "object" || Array.isArray(value)) return response
  const matching = identity !== undefined && "principal" in value && !!value.principal && typeof value.principal === "object" &&
    "id" in value.principal && value.principal.id === identity.id && "name" in value.principal &&
    value.principal.name === identity.name && "sessionScope" in value && value.sessionScope === identity.scope
  const headers = new Headers(response.headers)
  headers.delete("content-length")
  return new Response(JSON.stringify({ ...value, hostAuthenticated: matching }), {
    status: response.status, statusText: response.statusText, headers,
  })
}

export function middleware(installation: Interface) {
  return HttpRouter.middleware(
    (effect) => Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const pathname = request.url.split("?", 1)[0]!
      if (pathname !== mount && !pathname.startsWith(`${mount}/`)) return yield* effect
      const signal = yield* Effect.abortSignal
      const web = yield* HttpServerRequest.toWeb(request, { signal }).pipe(Effect.orDie)
      const response = yield* Effect.promise(() => delegate(installation, web))
      return HttpServerResponse.fromWeb(response)
    }),
    { global: true },
  )
}

export function layer(installation: Interface) {
  return Layer.succeed(Service, installation)
}
