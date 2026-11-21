import type { DomainProjection } from "../contracts/context.ts"
import type { BiViewRequest } from "../contracts/operations.ts"
import type { DashboardPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sameBiProjection } from "./projection.ts"
import type { BiPresentationPort } from "./capabilities.ts"
import type { BiPresentation } from "./semantics.ts"

/** The host supplies a DashboardPort.read result and producer-defined series metadata. */
export type DashboardBiHost = {
  readView: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<{ projection: DomainProjection; presentation: BiPresentation }>>
  revalidate: BiPresentationPort["revalidate"]
}

export function createDashboardBiSource(host: DashboardBiHost): BiPresentationPort {
  return {
    revalidate: host.revalidate,
    async read(request, context) {
      const result = await host.readView(request, context)
      if (result.status !== "ok") return result
      if (result.value.presentation.viewId !== request.viewId) return { status: "unavailable", reason: "view-mismatch" }
      return { status: "ok", value: result.value.projection }
    },
    async describe(request, context, projection) {
      const result = await host.readView(request, context)
      if (result.status !== "ok") return result
      if (result.value.presentation.viewId !== request.viewId || !sameBiProjection(result.value.projection, projection)) return { status: "stale", reason: "projection-changed" }
      return { status: "ok", value: result.value.presentation }
    },
  }
}

/** Connects the dashboard read port using a host-authorized view/field resolver. */
export function bindDashboardBiPort(input: {
  dashboard: DashboardPort
  resolve: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<{ fields: readonly string[]; present: (projection: DomainProjection) => BiPresentation }>>
  revalidate: BiPresentationPort["revalidate"]
}): DashboardBiHost {
  return {
    revalidate: input.revalidate,
    async readView(request, context) {
      const binding = await input.resolve(request, context)
      if (binding.status !== "ok") return binding
      const projection = await input.dashboard.read({ selectionRef: request.selectionRef, period: request.period, fields: binding.value.fields }, context)
      if (projection.status !== "ok") return projection
      if (projection.value.context.period.start !== request.period.start || projection.value.context.period.end !== request.period.end) return { status: "stale", reason: "period-mismatch" }
      return { status: "ok", value: { projection: projection.value, presentation: binding.value.present(projection.value) } }
    },
  }
}
