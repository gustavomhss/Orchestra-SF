import { Layer, Option, Schema } from "effect"
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
import { createSfActionSource } from "../../../../../apps/cli/src/sucafina-product/native-ui/action-source.ts"
import { mountSfNativeProjections } from "../../../../../apps/cli/src/sucafina-product/native-ui/router.ts"
import { contributions } from "../../index.ts"
import { createApplication } from "../../runtime/application.ts"
import { createTeamProfileIdentityBoundary } from "../../runtime/team-profile-identity.ts"
import { createTeamProfileHttp } from "../../runtime/team-profile-http.ts"
import { teamProductFixture } from "./product-fixture.ts"

/** Real private fixture files, signed OIDC, role/grant readers, SQLite and the installed
 * public handlers. No browser-supplied principal, admission handle or access revision. */
export async function nativeTeamWebFixture(input: Parameters<typeof teamProductFixture>[0] = {}) {
  const f = await teamProductFixture(input)
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
  const application = {
    authenticate: boundary.identity.authenticate, persistence: f.persistence, domains: contributions, maxJsonBytes: 8 * 1024 * 1024,
    environment: async (request: Request) => ({ ...await f.options.environment(request), directory: await f.identity.directory(request) }),
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
      ...await actions.operational(request, stamp),
    ],
  })
  const services = Object.freeze({ nativeUiProducts: live })
  const context = createSfContextHandler({ origin: f.binding.origin, mount: f.binding.mount,
    runtime: () => services })
  const deps = { origin: f.binding.origin, mount: f.binding.mount, application,
    runtime: () => undefined, readContext: context.readContext }
  const handlers = createSfPlannerProjectionHandlers(deps)
  actions = createSfActionSource(deps, handlers)
  const native = mountSfNativeProjections({ mount: f.binding.mount, context, handlers })
  const admin = createTeamProfileHttp({ ...f.binding, resolver: f.resolver })
  const business = createApplication(f.binding.mount, application)
  const handle = async (request: Request) => {
    if (new URL(request.url).pathname === "/api/sucafina/installations") return metadata.handler(request)
    const identity = await f.identity.handle(request)
    if (identity) return identity
    await f.identity.prepare(request)
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
  return { ...f, descriptor, handle, seedPlannerVersion, metadataCalls,
    close: async () => { await metadata.dispose(); await f.close() } }
}
