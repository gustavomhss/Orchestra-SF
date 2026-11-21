import path from "node:path"
import type { openCorporateRecoveryRegister } from "../runtime/corporate-recovery-register.ts"
import { loadMicrosoftIngressAuthorizer } from "../runtime/microsoft-configuration.ts"
import { microsoftRequest, prepareMicrosoftInstallation } from "../runtime/microsoft-installation.ts"
import type { EntraOptions, EntraTeamsSessionResult } from "../runtime/local-contract.ts"
import { createTeamProfileAccess } from "../runtime/team-profile-access.ts"
import { runTeamBusiness } from "../runtime/team-business.ts"
import { teamBusinessRoute } from "../runtime/team-profile-selector.ts"
import { esc } from "../src/screen-shell.ts"
import { openLocalStore } from "../runtime/local-store.ts"

export default function installation(context: { origin: string }) {
  return createMicrosoftInstallation(context, process.env.SUCAFINA_MICROSOFT_CONFIG)
}

/** Mount Microsoft authentication and make the Teams reader available to the server. */
export async function createMicrosoftInstallation(
  context: { origin: string },
  file: string | undefined,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  overrides: Pick<EntraOptions, "fetch" | "now"> & {
    openRecoveryRegister?: typeof openCorporateRecoveryRegister
  } = {},
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
    const now = overrides.now ?? (() => new Date())
    const registerPath = environment.SUCAFINA_CORPORATE_RECOVERY_REGISTER
    const recovery = registerPath === undefined ? undefined : await (async () => {
      if (!process.getuid?.() || !config.supremeAdminGroupId || !identity.observeCorporateRecoveryActor)
        throw new Error("Corporate recovery requires a non-root service and explicit Microsoft Teams administration")
      const { createCorporateRecoveryHttp } = await import("../runtime/corporate-recovery-http.ts")
      const { openCorporateRecoveryRegister } = await import("../runtime/corporate-recovery-register.ts")
      const register = await (overrides.openRecoveryRegister ?? openCorporateRecoveryRegister)(registerPath, directory)
      return createCorporateRecoveryHttp({ config, directory, identity, now, register })
    })()
    const readTeams = identity.teamDirectory
    const teamAccess = identity.observeTeams && createTeamProfileAccess({
      origin: config.origin, mount: config.mount, directory, tenantId: config.tenantId,
      enabledTeamIds: config.enabledTeamIds ?? [], prepare: identity.prepare, observeTeams: identity.observeTeams,
    })
    const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
    const htmlHeaders = { ...headers, "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'; base-uri 'none'" }
    return {
      mount: config.mount,
      trustedIngress: Object.freeze({ origin: prepared.transport.ingressOrigin, authorize }),
      async handler(incoming: Request) {
        const request = microsoftRequest(incoming, prepared.transport)
        if (!request) return new Response(null, { status: 403, headers })
        const url = new URL(request.url)
        if (teamAccess && url.pathname === config.mount + "/auth/signed-out") {
          if (request.method !== "GET" && request.method !== "HEAD")
            return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } })
          return new Response(request.method === "HEAD" ? null :
            `<!doctype html><html lang="en"><meta charset="utf-8"><title>Signed out</title><h1>Signed out</h1><a href="${esc(config.mount + "/auth/login")}">Sign in</a></html>`,
          { headers: htmlHeaders })
        }
        const auth = await identity.handle(request)
        if (auth) return auth
        const recovered = await recovery?.(request)
        if (recovered) return recovered
        const route = teamAccess ? teamBusinessRoute(url.pathname, config.mount) : undefined
        const landing = url.pathname === config.mount || url.pathname === config.mount + "/dashboard" ||
          (!!teamAccess && (url.pathname === config.mount + "/planner" || url.pathname === config.mount + "/procurement"))
        if (!route && !landing) return undefined
        const read = request.method === "GET" || request.method === "HEAD"
        if (!read && !(route && request.method === "POST")) {
          return new Response(null, { status: 405, headers: { ...headers, Allow: route ? "GET, HEAD, POST" : "GET, HEAD" } })
        }
        if (request.method === "POST" && request.headers.get("origin") !== config.origin)
          return new Response(null, { status: 403, headers })
        const surface = url.pathname === config.mount ? "dashboard" : url.pathname.slice(config.mount.length + 1)
        if (route) {
          const actions = ["download", "upload", "asset", "asset-link"].filter((key) => url.searchParams.has(key))
          if (actions.length > 1 || actions.length && (actions[0] === "upload") !== !read)
            return new Response(null, { status: 400, headers })
        }
        const loginPath = config.mount + "/auth/login" +
          (route || (teamAccess && surface !== "dashboard") ? "?returnTo=" + encodeURIComponent(url.pathname) : "")
        const signIn = () => new Response(null, { status: 303, headers: { ...headers, Location: loginPath } })
        if (!teamAccess) {
          await identity.prepare(request)
          return await identity.person(request) ? new Response(null, { status: 204, headers }) : signIn()
        }
        const access = await teamAccess(request, route?.teamObjectId)
        if (access.status === "allowed") {
          if (route) return runTeamBusiness({
            request, route, admission: access, authorizeTeam: teamAccess, identity, config, directory,
            keys: prepared.loaded.keys, now,
            decisionIntentions: environment.SUCAFINA_NATIVE_TEAM_DECISIONS === "1" ? store : undefined,
          })
          return new Response(null, { status: 303, headers: {
            ...headers, Location: config.mount + "/teams/" + access.profile.teamObjectId + "/" + surface,
          } })
        }
        if (access.status === "selection-required") {
          if (request.method === "HEAD") return new Response(null, { status: 409, headers })
          if (!request.headers.get("accept")?.includes("text/html")) return Response.json(access, { status: 409, headers })
          const choices = access.choices.map((choice) =>
            `<li><a href="${esc(config.mount + "/teams/" + choice.profile.teamObjectId + "/" + surface)}">${esc(choice.displayName)}</a></li>`,
          ).join("")
          return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Select a Team</title><h1>Select a Team</h1><ul>${choices}</ul></html>`, {
            status: 409, headers: htmlHeaders,
          })
        }
        if (access.status === "unauthenticated") return read ? signIn() : new Response(null, { status: 401, headers })
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
