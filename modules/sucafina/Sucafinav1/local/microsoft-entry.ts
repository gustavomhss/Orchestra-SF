import path from "node:path"
import { loadMicrosoftIngressAuthorizer } from "../runtime/microsoft-configuration.ts"
import { microsoftRequest, prepareMicrosoftInstallation } from "../runtime/microsoft-installation.ts"
import type { EntraOptions, EntraTeamsSessionResult } from "../runtime/local-contract.ts"
import { createTeamProfileAccess } from "../runtime/team-profile-access.ts"
import { openLocalStore } from "../runtime/local-store.ts"

export default function installation(context: { origin: string }) {
  return createMicrosoftInstallation(context, process.env.SUCAFINA_MICROSOFT_CONFIG)
}

/** Mount Microsoft authentication and make the Teams reader available to the server. */
export async function createMicrosoftInstallation(
  context: { origin: string },
  file: string | undefined,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  overrides: Pick<EntraOptions, "fetch" | "now"> = {},
) {
  const listener = new URL(context.origin)
  if (listener.hostname !== "127.0.0.1" && listener.hostname !== "[::1]")
    throw new Error("Microsoft installation requires a concrete loopback listener")
  const prepared = await prepareMicrosoftInstallation(context, file, environment, overrides)
  const { config, directory } = prepared.loaded
  const authorize = await loadMicrosoftIngressAuthorizer(directory)
  const store = await openLocalStore(path.join(directory, "business-microsoft"))
  try {
    const identity = prepared.createIdentity(store.secrets)
    const readTeams = identity.teamDirectory
    const teamAccess = readTeams && createTeamProfileAccess({
      origin: config.origin, mount: config.mount, directory, tenantId: config.tenantId,
      enabledTeamIds: config.enabledTeamIds ?? [], prepare: identity.prepare, readTeams,
    })
    const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
    return {
      mount: config.mount,
      trustedIngress: Object.freeze({ origin: prepared.transport.ingressOrigin, authorize }),
      async handler(incoming: Request) {
        const request = microsoftRequest(incoming, prepared.transport)
        if (!request) return new Response(null, { status: 403, headers })
        const auth = await identity.handle(request)
        if (auth) return auth
        const pathname = new URL(request.url).pathname
        if (pathname !== config.mount && pathname !== config.mount + "/dashboard") return undefined
        if (request.method !== "GET" && request.method !== "HEAD") {
          return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } })
        }
        const signIn = () => new Response(null, { status: 303, headers: { ...headers, Location: config.mount + "/auth/login" } })
        if (!teamAccess) {
          await identity.prepare(request)
          return await identity.person(request) ? new Response(null, { status: 204, headers }) : signIn()
        }
        const access = await teamAccess(request)
        if (access.status === "allowed") return new Response(null, { status: 204, headers })
        if (access.status === "selection-required") return Response.json(access, { status: 409, headers })
        if (access.status === "unauthenticated") return signIn()
        return new Response(null, { status: access.status === "denied" ? 403 : 503, headers })
      },
      ...(readTeams ? { async teamDirectory(incoming: Request): Promise<EntraTeamsSessionResult> {
        const request = microsoftRequest(incoming, prepared.transport)
        return request ? readTeams(request) : { state: "unauthenticated" }
      } } : {}),
      dispose: () => store.dispose(),
    }
  } catch (error) {
    await store.dispose()
    throw error
  }
}
