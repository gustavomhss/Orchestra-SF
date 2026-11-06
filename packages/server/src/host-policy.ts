import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

/** Restricts the actual HTTP Host authority; omission preserves the embedding default. */
export function hostPolicyLayer(allowedHosts: readonly string[] | undefined) {
  if (allowedHosts === undefined) return Layer.empty
  const hosts = new Set(allowedHosts.map((host) => {
    const normalized = hostname(host)
    if (!normalized) throw new Error("Invalid allowed host")
    return normalized
  }))
  return HttpRouter.middleware(
    (effect) => Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const host = hostname(request.headers.host)
      if (!host || !hosts.has(host)) return HttpServerResponse.empty({ status: 421 })
      return yield* effect
    }),
    { global: true },
  )
}

function hostname(authority: string | undefined) {
  if (!authority || /[\s\u0000-\u001f\u007f\\/?#,@*]/.test(authority)) return undefined
  const input = `http://${authority}`
  if (!URL.canParse(input)) return undefined
  const url = new URL(input)
  if (!url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return undefined
  return url.hostname.toLowerCase().replace(/\.$/, "") || undefined
}
