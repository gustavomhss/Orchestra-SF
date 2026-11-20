import type { Host } from "@orchestra/core/host"
import type { Location } from "@orchestra/core/location"
import { isInstalledSessionPath, makeInstalledSessionHttp } from "@orchestra/server/session-http"
import { Effect, Layer } from "effect"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"

/** Private bridge installed only after the single host graph and native reference overrides exist. */
export function createSfSessionHttp(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  origin: string
  mount: string
  authMode?: "microsoft" | "local-operator"
  location: () => Location.Ref | undefined
}) {
  const live: { handler?: (request: Request) => Promise<Response> } = {}
  const runtime = Layer.effectDiscard(Effect.gen(function* () {
    if (input.authMode !== "microsoft") return
    const handler = yield* makeInstalledSessionHttp({
      origin: input.origin, mount: input.mount, location: input.location,
      readAdmission: (request) => input.authority.readCoreSessionAdmission(request),
    })
    live.handler = handler
    yield* Effect.addFinalizer(() => Effect.sync(() => {
      if (live.handler === handler) live.handler = undefined
    }))
  }))
  const contribution: Host.Contribution = { id: "sucafina-session-http", runtime }
  const sessionHttp = async (original: Request) => {
    if (!isInstalledSessionPath(new URL(original.url).pathname, input.mount)) return undefined
    if (!live.handler) return new Response("Session runtime unavailable", {
      status: 503, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    })
    return live.handler(original)
  }
  return { contribution, sessionHttp }
}
