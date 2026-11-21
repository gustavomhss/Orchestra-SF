import { randomUUID } from "node:crypto"
import path from "node:path"
import { createModule } from "../index.ts"
import { initializeConfiguredMicrosoftRoleMaps } from "../runtime/local-bootstrap.ts"
import { scanLocalFile } from "../runtime/local-scanner.ts"
import { loadMicrosoftIngressAuthorizer } from "../runtime/microsoft-configuration.ts"
import { microsoftRequest, prepareMicrosoftInstallation } from "../runtime/microsoft-installation.ts"
import type { EntraOptions, EntraTeamsSessionResult } from "../runtime/local-contract.ts"
import { createTeamProfileAccess } from "../runtime/team-profile-access.ts"
import { openLocalStore } from "../runtime/local-store.ts"

export default function installation(context: { origin: string }) {
  return createMicrosoftInstallation(context, process.env.SUCAFINA_MICROSOFT_CONFIG)
}

/** Mount the Sucafina product behind Microsoft authentication and the trusted proxy. */
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
    const business = createModule(config.mount, {
      persistence: store,
      authenticate: identity.authenticate,
      environment: async (request) => ({
        at: (overrides.now?.() ?? new Date()).toISOString(), id: randomUUID,
        directory: await identity.directory(request), bankKey: prepared.loaded.keys.bank, microsoftGroupIdsOnly: true,
      }),
      maxJsonBytes: 2 * 1024 * 1024,
      assets: { persistence: store, services: {
        signingKey: prepared.loaded.keys.assets, scan: (bytes) => scanLocalFile(bytes, config.scanner),
      } },
    })
    await initializeConfiguredMicrosoftRoleMaps({ groups: config.groups, store, now: overrides.now })
    const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
    return {
      mount: config.mount,
      trustedIngress: Object.freeze({ origin: prepared.transport.ingressOrigin, authorize }),
      async handler(incoming: Request) {
        const request = microsoftRequest(incoming, prepared.transport)
        if (!request) return new Response(null, { status: 403, headers })
        if (request.method === "POST" && (request.headers.get("origin") !== config.origin || request.headers.get("sec-fetch-site") === "cross-site")) {
          return new Response(null, { status: 403, headers })
        }
        const auth = await identity.handle(request)
        if (auth) return auth
        const url = new URL(request.url)
        if (url.pathname === `${config.mount}/status`) {
          if (request.method !== "GET" && request.method !== "HEAD") {
            return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } })
          }
          return new Response(request.method === "HEAD" ? null : JSON.stringify({
            login: "configured-unverified",
            uploads: config.scanner ? "scanner-configured-unverified" : "unavailable-scanner-not-configured",
          }), { headers: { ...headers, "Content-Type": "application/json" } })
        }
        const root = url.pathname === config.mount || url.pathname === `${config.mount}/`
        const surface = url.pathname.slice(config.mount.length + 1)
        if (!root && surface !== "dashboard" && surface !== "planner" && surface !== "procurement") return undefined
        if (root && request.method !== "GET" && request.method !== "HEAD") {
          return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } })
        }
        if (teamAccess && (root || surface === "dashboard")) {
          const access = await teamAccess(request)
          if (access.status === "selection-required") return Response.json(access, { status: 409, headers })
          if (access.status === "unauthenticated") {
            return request.method === "GET" || request.method === "HEAD"
              ? new Response(null, { status: 303, headers: { ...headers, Location: `${config.mount}/auth/login` } })
              : new Response(null, { status: 401, headers })
          }
          if (access.status !== "allowed") return new Response(null, { status: access.status === "denied" ? 403 : 503, headers })
          if (root) return new Response(null, { status: 204, headers })
          return business(request)
        }
        await identity.prepare(request)
        if (request.method === "GET" || request.method === "HEAD") {
          const target = root ? `${config.mount}/dashboard` : url.pathname + url.search
          if (!await identity.person(request)) return new Response(null, { status: 303, headers: {
            ...headers, Location: `${config.mount}/auth/login?returnTo=${encodeURIComponent(target)}`,
          } })
          if (root) return new Response(null, { status: 303, headers: { ...headers, Location: target } })
        }
        return business(request)
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
