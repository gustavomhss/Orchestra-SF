import { createSfContextHandler } from "../../../../../apps/cli/src/sucafina-product/native-ui/context.ts"
import { createSfLiveContext, sfContextDestinationsFromPages } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { createSfDomainProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/domain.ts"
import { mountSfNativeProjections } from "../../../../../apps/cli/src/sucafina-product/native-ui/router.ts"
import { createTeamProfileHttp } from "../../runtime/team-profile-http.ts"
import { createTeamProfileIdentityBoundary } from "../../runtime/team-profile-identity.ts"
import type { Application } from "../../runtime/application.ts"
import { contributions } from "../../index.ts"
import { tenant } from "../microsoft-login/oidc-fixture.ts"
import { teamProductFixture } from "./product-fixture.ts"

export async function teamContextFixture(input: Parameters<typeof teamProductFixture>[0] = {}) {
  const f = await teamProductFixture(input)
  const calls: Request[] = []
  const hooks: { operational?: () => Promise<void> } = {}
  const current = { technical: f.technical }
  const live = createSfLiveContext({
    origin: f.binding.origin, mount: f.binding.mount, currentBinding: () => current.technical,
    admit: async (request) => {
      const admitted = await f.authority.readContextAdmission(request)
      if (admitted.status !== "ok") return admitted
      const destinations = sfContextDestinationsFromPages(admitted.pages)
      return destinations ? { status: "ok", stamp: admitted.stamp, authMode: "microsoft", destinations }
        : { status: "unavailable", reason: "contract-mismatch" }
    },
    teams: {
      tenantId: tenant,
      admit: async (request) => {
        calls.push(request)
        const admitted = await f.authority.readTeamContextAdmission(request)
        if (admitted.status !== "ok") return admitted
        const destinations = admitted.binding ? sfContextDestinationsFromPages(admitted.pages) : []
        return destinations ? { ...admitted, destinations } : { status: "unavailable", reason: "contract-mismatch" }
      },
    },
    operational: async () => { await hooks.operational?.(); return [] },
  })
  const services = { nativeUiProducts: live }
  const runtime = { services }
  const handler = createSfContextHandler({
    origin: f.binding.origin, mount: f.binding.mount, runtime: () => runtime.services,
  })
  const boundary = createTeamProfileIdentityBoundary({
    identity: f.identity, resolver: f.resolver, ...f.binding,
  })
  const application: Application = {
    authenticate: boundary.identity.authenticate, persistence: f.persistence,
    environment: f.options.environment, domains: contributions, maxJsonBytes: 8 * 1024 * 1024,
  }
  const native = mountSfNativeProjections({
    mount: f.binding.mount, context: handler,
    handlers: createSfDomainProjectionHandlers({
      origin: f.binding.origin, mount: f.binding.mount, application,
      runtime: () => undefined, readContext: handler.readContext,
    }),
  })
  const admin = createTeamProfileHttp({ ...f.binding, resolver: f.resolver })
  const handle = async (request: Request) => {
    const identity = await f.identity.handle(request)
    if (identity) return identity
    await f.identity.prepare?.(request)
    return await admin(request) ?? await native(request) ?? new Response(null, { status: 404 })
  }
  return { ...f, handler, live, calls, hooks, current, runtime, application, boundary, handle }
}
