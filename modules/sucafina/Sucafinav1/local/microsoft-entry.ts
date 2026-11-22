import path from "node:path"
import { randomUUID } from "node:crypto"
import { Effect } from "effect"
import type { SfTeamContextQuery } from "@orchestra/schema/sucafina/context"
import type { SfTeamCurrentChoice } from "../../../../apps/cli/src/sucafina-product/team-current-choice.ts"
import { createSfContextHandler } from "../../../../apps/cli/src/sucafina-product/native-ui/context.ts"
import type { openCorporateRecoveryRegister } from "../runtime/corporate-recovery-register.ts"
import { loadMicrosoftIngressAuthorizer } from "../runtime/microsoft-configuration.ts"
import { microsoftRequest, prepareMicrosoftInstallation } from "../runtime/microsoft-installation.ts"
import type { EntraOptions, EntraTeamsSessionResult } from "../runtime/local-contract.ts"
import { createTeamProfileAccess, teamProfileInstallationId } from "../runtime/team-profile-access.ts"
import { createTeamProfileResolver } from "../runtime/team-profile-resolver.ts"
import { createTeamProfileHttp } from "../runtime/team-profile-http.ts"
import { createTeamSessionAdmission } from "../runtime/team-session-admission.ts"
import { runTeamBusiness } from "../runtime/team-business.ts"
import { teamBusinessRoute } from "../runtime/team-profile-selector.ts"
import { esc } from "../src/screen-shell.ts"
import { openLocalStore } from "../runtime/local-store.ts"

export const nativeSfTeamInstallation = true
type InstallationContext = {
  origin: string
  teamCurrentChoice?: SfTeamCurrentChoice
  loadTeamSessionHttp?: () => Promise<typeof import("../../../../apps/cli/src/sucafina-product/team-session-http.ts").createSfTeamSessionHttp>
  loadTeamPurchaseMcp?: () => Promise<typeof import("../../../../apps/cli/src/sucafina-product/team-purchase-mcp.ts").createSfTeamPurchaseMcp>
  loadTeamSupplierMcp?: () => Promise<typeof import("../../../../apps/cli/src/sucafina-product/team-purchase-mcp.ts").createSfTeamSupplierMcp>
  loadTeamContractMcp?: () => Promise<typeof import("../../../../apps/cli/src/sucafina-product/team-purchase-mcp.ts").createSfTeamContractMcp>
}

export default function installation(context: InstallationContext) {
  return createMicrosoftInstallation(context, process.env.SUCAFINA_MICROSOFT_CONFIG)
}

/** Mount Microsoft authentication and make the Teams reader available to the server. */
export async function createMicrosoftInstallation(
  context: InstallationContext,
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
  const nativeWeb = environment.SUCAFINA_NATIVE_TEAM_WEB === "1"
  if (nativeWeb && config.teams !== "direct") throw new Error("Native Team Web requires Microsoft Teams admission")
  const authorize = await loadMicrosoftIngressAuthorizer(directory)
  const installationId = teamProfileInstallationId({ origin: config.origin, mount: config.mount, directory })
  const store = await openLocalStore(path.join(directory, "business-microsoft"), config.teams === "direct" ? {
    teamProfilePolicy: {
      binding: { installationId, tenantId: config.tenantId },
      bootstrapEnabledTeamIds: config.enabledTeamIds ?? [],
    },
  } : {})
  try {
    const identity = prepared.createIdentity(store.secrets, nativeWeb)
    const now = overrides.now ?? (() => new Date())
    const registerPath = environment.SUCAFINA_CORPORATE_RECOVERY_REGISTER
    const recovery = registerPath === undefined ? undefined : await (async () => {
      if (!process.getuid?.() || !config.supremeAdminGroupId || !identity.observeCorporateRecoveryActor)
        throw new Error("Corporate recovery requires a non-root service and explicit Microsoft Teams administration")
      const profilePolicy = store.teamProfiles
      if (!profilePolicy) throw new Error("Corporate recovery requires current Team policy")
      const { createCorporateRecoveryHttp } = await import("../runtime/corporate-recovery-http.ts")
      const { openCorporateRecoveryRegister } = await import("../runtime/corporate-recovery-register.ts")
      const register = await (overrides.openRecoveryRegister ?? openCorporateRecoveryRegister)(registerPath, directory)
      return createCorporateRecoveryHttp({ config, readPolicy: prepared.readCurrentConfiguration, directory, identity, now, register, profilePolicy })
    })()
    const readTeams = identity.teamDirectory
    if (config.teams === "direct" && !store.teamProfiles) throw new Error("Microsoft Team policy is unavailable")
    const teamProfiles = store.teamProfiles && identity.observeTeamProfileAdministrator && createTeamProfileResolver({
      installationId, tenantId: config.tenantId, store: store.teamProfiles,
      policy: prepared.readTeamProfilePolicy,
      observeAdministrator: identity.observeTeamProfileAdministrator, prepare: identity.prepare,
      now: () => now().getTime(),
    })
    const profileHttp = teamProfiles && createTeamProfileHttp({
      origin: config.origin, mount: config.mount, installationId, tenantId: config.tenantId, resolver: teamProfiles,
    })
    const checkpoint = config.teams === "direct" && store.teamProfiles ? await (async () => {
      const { createCorporateCheckpointHttp } = await import("../runtime/corporate-checkpoint-http.ts")
      return createCorporateCheckpointHttp({ config, readPolicy: prepared.readCurrentConfiguration, directory, identity, profilePolicy: store.teamProfiles!, now })
    })() : undefined
    const teamAccess = identity.observeTeams && createTeamProfileAccess({
      origin: config.origin, mount: config.mount, directory, tenantId: config.tenantId,
      enabledTeamIds: config.enabledTeamIds ?? [], prepare: identity.prepare, observeTeams: identity.observeTeams,
      profilePolicy: store.teamProfiles,
      ...(teamProfiles ? { observeAdministrator: (request: Request) => teamProfiles.administrator(request, { refreshSession: false }) } : {}),
    })
    if (nativeWeb && !teamAccess) throw new Error("Native Team Web admission is unavailable")
    const readSessionAdmission = nativeWeb && teamAccess && store.teamProfiles ? createTeamSessionAdmission({
      origin: config.origin, mount: config.mount, installationId, tenantId: config.tenantId, directory,
      authorizeTeam: teamAccess, identity, profilePolicy: store.teamProfiles,
      readCurrentConfiguration: prepared.readCurrentConfiguration, readGrants: prepared.readGrants,
      connections: store.teamConnections, readKey: prepared.readConnectionKey, policyVersion: "sf-team-profile/1",
    }) : undefined
    type SessionRuntime = Awaited<ReturnType<typeof import("../../../../apps/cli/src/sucafina-product/team-session-http.ts").createSfTeamSessionHttp>>
    let sessionRuntime: Promise<SessionRuntime> | undefined
    let disposed = false
    const sessionHttp = async (request: Request): Promise<Response | undefined> => {
      const pathname = new URL(request.url).pathname
      if (!nativeWeb || !(pathname === config.mount + "/api/session" || pathname.startsWith(config.mount + "/api/session/") ||
        pathname === config.mount + "/api/event" || pathname === config.mount + "/api/reference")) return undefined
      const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" }
      const unavailable = () => Response.json({ status: "unavailable" }, { status: 503, headers })
      if (disposed || !readSessionAdmission || !context.loadTeamSessionHttp) return unavailable()
      const admission = await readSessionAdmission(request)
      if (!admission || request.signal.aborted)
        return Response.json({ _tag: "UnauthorizedError", message: "Current session authority required" }, { status: 401, headers })
      try {
        const action = request.method === "POST" && pathname === config.mount + "/api/session" ? "create" : "read"
        if (!await Effect.runPromise(admission.authorize(action)) ||
          !await Effect.runPromise(admission.verifyCurrent()) || request.signal.aborted)
          return Response.json({ _tag: "UnauthorizedError", message: "Current session authority required" }, { status: 401, headers })
        const configuration = await Effect.runPromise(admission.configuration?.() ?? Effect.succeed(undefined))
        const profile = admission.binding.owner.profile
        if (!configuration || configuration.origin !== "installation-team-store" ||
          configuration.configRevision !== admission.binding.revisions.configRevision ||
          configuration.profile.installationId !== profile.installationId ||
          configuration.profile.tenantId !== profile.tenantId ||
          configuration.profile.teamObjectId !== profile.teamObjectId ||
          !await Effect.runPromise(admission.verifyCurrent()) || request.signal.aborted) return unavailable()
        // Only a current private Microsoft/Team grant can load and start the Core graph.
        // Each actual HTTP operation still captures and verifies its own opaque owner lease.
        if (!sessionRuntime) {
          const load = context.loadTeamSessionHttp
          sessionRuntime = (async () => {
            const create = await load()
            const runtime = await create({
              origin: config.origin, mount: config.mount, directory,
              workspaceDirectory: config.workspaceDirectory, readAdmission: readSessionAdmission,
            })
            if (disposed) {
              await runtime.dispose()
              throw new Error("Microsoft session runtime disposed")
            }
            return runtime
          })()
        }
        const pending = sessionRuntime
        const runtime = await pending.catch((error) => {
          if (sessionRuntime === pending) sessionRuntime = undefined
          throw error
        })
        if (disposed || request.signal.aborted) return unavailable()
        return await runtime.handler(request)
      } catch (error) {
        console.error("SF_TEAM_SESSION_RUNTIME_UNAVAILABLE", error)
        return unavailable()
      }
    }

    const purchasePeriod = config.clawPurchasePeriod
    const purchaseMcp = purchasePeriod ? await (async () => {
      if (!teamAccess || !context.loadTeamPurchaseMcp) throw new Error("Purchase MCP requires the Microsoft Team host")
      const createPurchaseMcp = await context.loadTeamPurchaseMcp()
      return createPurchaseMcp({ config, directory, identity, authorizeTeam: teamAccess, period: purchasePeriod, now })
    })() : undefined
    const supplierMcp = config.clawSupplierReview ? await (async () => {
      if (!teamAccess || !context.loadTeamSupplierMcp) throw new Error("Supplier MCP requires the Microsoft Team host")
      const createSupplierMcp = await context.loadTeamSupplierMcp()
      return createSupplierMcp({ config, directory, identity, authorizeTeam: teamAccess, now })
    })() : undefined
    const contractMcp = config.clawContractReview ? await (async () => {
      if (!teamAccess || !context.loadTeamContractMcp) throw new Error("Contract MCP requires the Microsoft Team host")
      const createContractMcp = await context.loadTeamContractMcp()
      return createContractMcp({ config, directory, identity, authorizeTeam: teamAccess, now })
    })() : undefined
    const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
    const htmlHeaders = { ...headers, "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'; base-uri 'none'" }
    const web = nativeWeb && teamAccess ? (() => {
      const binding = Object.freeze({ installationId, projectId: installationId, hostId: randomUUID() })
      const runtime = Object.freeze({ nativeUiProducts: {
        currentBinding: () => binding,
        teamTenantId: config.tenantId,
        readTeamContext: (request: Request, query: SfTeamContextQuery) =>
          teamAccess.readContext(request, query, binding),
      } })
      const context = createSfContextHandler({ origin: config.origin, mount: config.mount, runtime: () => runtime })
      const discovered = Object.freeze({
        publicOrigin: config.origin, mount: config.mount, authMode: "microsoft" as const, tenantId: config.tenantId,
        identity: () => ({ ...binding, location: { directory } }),
      })
      return { context, discovery: {
        current: async (signal: AbortSignal) => signal.aborted ? undefined : discovered,
        forAdmittedLocation: async () => [],
      } }
    })() : undefined
    return {
      mount: config.mount,
      trustedIngress: Object.freeze({ origin: prepared.transport.ingressOrigin, authorize }),
      ...(web ? { nativeWeb: true, discovery: web.discovery } : {}),
      async handler(incoming: Request) {
        if (disposed) return new Response(null, { status: 503, headers })
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
        if (web && url.pathname === config.mount + "/api/ui/context") return web.context.handle(request)
        const profiles = await profileHttp?.(request)
        if (profiles) return profiles
        const session = await sessionHttp(request)
        if (session) return session
        const mcp = await purchaseMcp?.(request) ?? await supplierMcp?.(request) ?? await contractMcp?.(request)
        if (mcp) return mcp
        const captured = await checkpoint?.(request)
        if (captured) return captured
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
        const webLanding = web && request.method === "GET" && !url.search && request.headers.get("accept")?.includes("text/html")
        const access = await teamAccess(request, route?.teamObjectId)
        if (access.status === "allowed") {
          if (route) return runTeamBusiness({
            request, route, admission: access, authorizeTeam: teamAccess, identity, config, directory,
            keys: prepared.loaded.keys, now,
            teamCurrentChoice: environment.SUCAFINA_NATIVE_TEAM_DECISIONS === "1" ? context.teamCurrentChoice : undefined,
            decisionIntentions: environment.SUCAFINA_NATIVE_TEAM_DECISIONS === "1" ? store : undefined,
          })
          return new Response(null, { status: 303, headers: {
            ...headers, Location: webLanding ? "/" : config.mount + "/teams/" + access.profile.teamObjectId + "/" + surface,
          } })
        }
        if (access.status === "selection-required") {
          if (webLanding)
            return new Response(null, { status: 303, headers: { ...headers, Location: "/" } })
          if (request.method === "HEAD") return new Response(null, { status: 409, headers })
          if (!request.headers.get("accept")?.includes("text/html")) return Response.json(access, { status: 409, headers })
          const choices = access.choices.map((choice) =>
            `<li><a href="${esc(config.mount + "/teams/" + choice.profile.teamObjectId + "/" + surface)}">${esc(choice.displayName)}</a></li>`,
          ).join("")
          return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Select a Team</title><h1>Select a Team</h1><ul>${choices}</ul></html>`, {
            status: 409, headers: htmlHeaders,
          })
        }
        if (access.status === "unauthenticated") {
          const teamChoice = context.teamCurrentChoice && route?.surface === "dashboard" && context.teamCurrentChoice.handles(request)
          return read ? signIn() : new Response(null, { status: teamChoice ? 403 : 401, headers })
        }
        return new Response(null, { status: access.status === "denied" ? 403 : 503, headers })
      },
      ...(readTeams ? { async teamDirectory(incoming: Request): Promise<EntraTeamsSessionResult> {
        const request = microsoftRequest(incoming, prepared.transport)
        return request ? readTeams(request) : { state: "unauthenticated" }
      } } : {}),
      async dispose() {
        if (disposed) return
        disposed = true
        try {
          // A failed startup owns no live graph; its request already returned an explicit unavailable response.
          const runtime = await sessionRuntime?.catch(() => undefined)
          await runtime?.dispose()
        } finally { await store.dispose() }
      },
    }
  } catch (error) {
    await store.dispose()
    throw error
  }
}
