import { Effect, Layer, Option, Schema } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi"
import { SfTeamInstallationDescriptor, type SfContextStamp } from "@orchestra/schema/sucafina/context"
import { SucafinaGroup } from "../../../../../packages/protocol/src/groups/sucafina.ts"
import { Authorization } from "../../../../../packages/protocol/src/middleware/authorization.ts"
import { SchemaErrorMiddleware } from "../../../../../packages/protocol/src/middleware/schema-error.ts"
import { ServerAuth } from "../../../../../packages/server/src/auth.ts"
import { SucafinaHandler } from "../../../../../packages/server/src/handlers/sucafina.ts"
import { authorizationLayerWith } from "../../../../../packages/server/src/middleware/authorization.ts"
import { schemaErrorLayer } from "../../../../../packages/server/src/middleware/schema-error.ts"
import { SfInstallationSource, type SfTrustedInstallationSource } from "../../../../../packages/server/src/sucafina-installations.ts"
import { createSfContextHandler } from "../../../../../apps/cli/src/sucafina-product/native-ui/context.ts"
import { createSfLiveContext, sfContextDestinationsFromPages } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { createSfPlannerProjectionHandlers, observeSfPlannerPages } from "../../../../../apps/cli/src/sucafina-product/native-ui/planner.ts"
import { createSfProcurementProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/procurement.ts"
import { observeSfDomainHealth } from "../../../../../apps/cli/src/sucafina-product/native-ui/domain-health.ts"
import { createSfBusinessServices } from "../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfActionSource } from "../../../../../apps/cli/src/sucafina-product/native-ui/action-source.ts"
import { mountSfNativeProjections } from "../../../../../apps/cli/src/sucafina-product/native-ui/router.ts"
import { contributions } from "../../index.ts"
import { createApplication } from "../../runtime/application.ts"
import { initialProcurementSettings } from "../../src/initial-settings.ts"
import { createTeamProfileIdentityBoundary } from "../../runtime/team-profile-identity.ts"
import { createTeamProfileHttp } from "../../runtime/team-profile-http.ts"
import type { SessionAccess } from "@orchestra/schema/session-access"
import type { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { productGrant, type teamProductFixture } from "./product-fixture.ts"
import { profileA } from "./installation-fixture.ts"
import { teamSessionFixture } from "../../../../../packages/core/test/fixture/team-session.ts"
import { applicationServices } from "../../../../../packages/server/src/routes.ts"
import { isInstalledSessionPath, makeInstalledSessionHttp } from "../../../../../packages/server/src/session-http.ts"

/** Real private fixture files, signed OIDC, role/grant readers, SQLite and the installed
 * public handlers. No browser-supplied principal, admission handle or access revision. */
export async function nativeTeamWebFixture(input: NonNullable<Parameters<typeof teamProductFixture>[0]> & {
  /** Explicit only in the conversation fixture; existing browser cases receive no Session action grant. */
  sessionActions?: readonly SessionAccess.Action[]
  procurement?: boolean
} = {}) {
  const enabled = input.enabled ?? (input.teams === false ? [] : [profileA])
  const f = await teamSessionFixture({ ...input, enabled, actions: input.sessionActions ?? [], extraNodes: [applicationServices] })
  const descriptor = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
    installationId: f.technical.installationId, projectId: f.technical.projectId, hostId: f.technical.hostId,
    tenantId: f.binding.tenantId, publicOrigin: f.binding.origin, mount: f.binding.mount,
    contractRevision: "sf-team-profile/1", authMode: "microsoft",
  })
  const metadataCalls = { locations: 0 }
  const source: SfTrustedInstallationSource = {
    current: async (signal) => signal.aborted ? undefined : {
      publicOrigin: descriptor.publicOrigin, mount: descriptor.mount, tenantId: descriptor.tenantId,
      authMode: "microsoft",
      identity: () => ({ installationId: descriptor.installationId, projectId: descriptor.projectId, hostId: descriptor.hostId }),
    },
    forAdmittedLocation: async () => { metadataCalls.locations++; throw new Error("A Team window cannot bootstrap a Location") },
  }
  const api = HttpApi.make("server").add(SucafinaGroup).middleware(Authorization).middleware(SchemaErrorMiddleware)
  const metadata = HttpRouter.toWebHandler(HttpApiBuilder.layer(api).pipe(
    Layer.provide(SucafinaHandler),
    Layer.provide(Layer.succeed(SfInstallationSource, source)),
    Layer.provide(authorizationLayerWith(source)),
    Layer.provide(schemaErrorLayer),
    Layer.provide(ServerAuth.Config.configLayer({ username: "orchestra", password: Option.some("synthetic-unused-host-basic") })),
    Layer.provide(HttpServer.layerServices),
  ), { disableLogger: true })
  const boundary = createTeamProfileIdentityBoundary({ identity: f.identity, resolver: f.resolver, ...f.binding })
  const procurement = input.procurement ? createSfBusinessServices({ authority: f.authority, persistence: f.persistence,
    proposalCoverageWrites: new WeakSet(), procurementEvidenceWrites: new WeakSet() }) : undefined
  const application = {
    authenticate: boundary.identity.authenticate, persistence: f.persistence, domains: contributions, maxJsonBytes: 8 * 1024 * 1024,
    environment: async (request: Request) => ({ ...await f.options.environment(request), directory: await f.identity.directory(request) }),
    ...(procurement ? { productView: procurement.procurementQueueView } : {}),
  }
  let actions: ReturnType<typeof createSfActionSource>
  const destinations = async (request: Request, stamp: SfContextStamp, pages: Parameters<typeof sfContextDestinationsFromPages>[0]) =>
    sfContextDestinationsFromPages(pages, await actions.actions(request, stamp, pages))
  const live = createSfLiveContext({
    origin: f.binding.origin, mount: f.binding.mount, currentBinding: () => f.technical,
    admit: async (request) => {
      const admitted = await f.authority.readContextAdmission(request)
      if (admitted.status !== "ok") return admitted
      const available = await destinations(request, admitted.stamp, admitted.pages)
      return available ? { status: "ok", stamp: admitted.stamp, authMode: "microsoft", destinations: available }
        : { status: "unavailable", reason: "contract-mismatch" }
    },
    teams: {
      tenantId: descriptor.tenantId,
      admit: async (request) => {
        const admitted = await f.authority.readTeamContextAdmission(request)
        if (admitted.status !== "ok") return admitted
        const stamp = { ...admitted.technical, ...(admitted.binding ? { team: admitted.binding } : {}) }
        const available = admitted.binding ? await destinations(request, stamp, admitted.pages) : []
        return available ? { ...admitted, destinations: available } : { status: "unavailable", reason: "contract-mismatch" }
      },
    },
    operational: async (request, stamp) => [
      ...await observeSfPlannerPages(application, request, stamp),
      ...(procurement ? await observeSfDomainHealth(deps, handlers, request, stamp) : []),
      ...await actions.operational(request, stamp),
    ],
  })
  const services = Object.freeze({ nativeUiProducts: live })
  const context = createSfContextHandler({ origin: f.binding.origin, mount: f.binding.mount,
    runtime: () => services })
  const deps = { origin: f.binding.origin, mount: f.binding.mount, application,
    runtime: () => procurement ? { ...f.authority, productView: procurement.procurementQueueView } : undefined,
    readContext: context.readContext }
  const handlers = [...createSfPlannerProjectionHandlers(deps), ...(procurement ? createSfProcurementProjectionHandlers(deps) : [])]
  actions = createSfActionSource(deps, handlers)
  const native = mountSfNativeProjections({ mount: f.binding.mount, context, handlers })
  const admin = createTeamProfileHttp({ ...f.binding, resolver: f.resolver })
  const business = createApplication(f.binding.mount, application)
  // Shared data is configured through the actual confidential admin endpoint before any request lease.
  // These tests only record prompt admission; they never supply a model/provider execution replacement.
  const configured: TeamProfile.Ref[] = []
  try {
    if (procurement) {
      await f.persistence.transaction("procurement", async (snapshot) => {
        snapshot.data.store = { settings: initialProcurementSettings(), issued: { pr: [], po: [] }, suppliers: [], requests: {} }
        return { commit: true, value: undefined }
      })
      await f.persistence.initializeSources("procurement")
    }
    for (const profile of enabled) {
      const query = new URLSearchParams({ contractRevision: "sf-team-profile/1",
        installationId: f.binding.installationId, tenantId: f.binding.tenantId })
      const document: TeamProfile.ConfigurationDocument = { version: 1, settings: {
        default_agent: "analyst", agents: { analyst: { name: "Shared conversation",
          system: "Synthetic approved Team conversation instructions." } },
      } }
      const request = f.request(`/api/ui/team-profiles/configuration?${query}`, f.cookie, {
        method: "POST", headers: { origin: f.binding.origin, "content-type": "application/json" },
        body: JSON.stringify({ profile, expectedRevision: (await f.profiles.read()).configRevision, document }),
      })
      await f.identity.prepare(request)
      const response = await admin(request)
      if (!response || response.status !== 200 || (await response.json()).status !== "ok")
        throw new Error("Actual admin configuration admission required before the conversation fixture")
      configured.push(profile)
    }
  } catch (error) {
    procurement?.dispose()
    await metadata.dispose()
    await f[Symbol.asyncDispose]()
    throw error
  }
  const ready = Promise.withResolvers<(request: Request) => Promise<Response>>()
  const release = Promise.withResolvers<void>()
  const sessionRequests: Request[] = []
  const runtimeState = { opened: false, closed: false }
  // f.run keeps this one AppNodeBuilder graph and its Scope alive until close awaits every finalizer.
  const runtime = f.run(Effect.gen(function* () {
    yield* Effect.addFinalizer(() => Effect.sync(() => { runtimeState.closed = true }))
    const mounted = yield* makeInstalledSessionHttp({
      origin: f.binding.origin, mount: f.binding.mount, location: () => f.location,
      readAdmission: (original) => { sessionRequests.push(original); return f.authority.readCoreSessionAdmission(original) },
    })
    runtimeState.opened = true
    ready.resolve(mounted)
    yield* Effect.promise(() => release.promise)
  }))
  void runtime.catch(ready.reject)
  const session = await ready.promise.catch(async (error) => {
    release.resolve()
    await runtime.catch(() => undefined)
    procurement?.dispose()
    await metadata.dispose()
    await f[Symbol.asyncDispose]()
    throw error
  })
  const handle = async (request: Request) => {
    if (new URL(request.url).pathname === "/api/sucafina/installations") return metadata.handler(request)
    const identity = await f.identity.handle(request)
    if (identity) return identity
    await f.identity.prepare(request)
    if (isInstalledSessionPath(new URL(request.url).pathname, f.binding.mount)) return session(request)
    return await admin(request) ?? await native(request) ?? await business(request) ?? new Response(null, { status: 404 })
  }
  const seedPlannerVersion = async () => f.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [{
      id: "version-native", name: "Original version", year: 2026, locked: false, closed: 0,
      lines: [], projects: [], hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} }, fx: [], lists: {},
    }]
    snapshot.data.officials = {}
    return { commit: true, value: undefined }
  })
  const closing: { result?: Promise<void> } = {}
  const close = () => closing.result ??= (async () => {
    release.resolve()
    const results = await Promise.allSettled([runtime, metadata.dispose()])
    procurement?.dispose()
    await f[Symbol.asyncDispose]()
    const failure = results.find((result) => result.status === "rejected")
    if (failure?.status === "rejected") throw failure.reason
  })()
  return { ...f, descriptor, handle, seedPlannerVersion, metadataCalls, configured: Object.freeze(configured),
    sessionRequests, runtimeState, sessionCalls: f.calls, sessionActions: Object.freeze([...input.sessionActions ?? []]), close,
  [Symbol.asyncDispose]: close }
}

export function nativeProcurementWebFixture(eligibleTeams: readonly TeamProfile.Ref[] = [profileA]) {
  const grant = productGrant()
  return nativeTeamWebFixture({ procurement: true, enabled: eligibleTeams, direct: eligibleTeams,
    grants: [{ ...grant, operations: [...grant.operations, "sf_request_read"] }] })
}
