import type { DomainProjection } from "../contracts/context.ts"
import type { BiViewRequest, ForecastCompareRequest } from "../contracts/operations.ts"
import type { FinancialAnalysis, PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { BiPresentation } from "./semantics.ts"
import type { BiPresentationPort } from "./capabilities.ts"
import { sameBiProjection } from "./projection.ts"

export type ProjectedPlannerBiHost = {
  readView: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<{ projection: DomainProjection; presentation: BiPresentation }>>
  revalidate: BiPresentationPort["revalidate"]
}

/** The producer projects and labels the already-authorized comparison; BI does not calculate it. */
export function bindProjectedPlannerBiPort(input: {
  planner: PlannerPort
  resolve: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<{ comparison: ForecastCompareRequest; project: (analysis: FinancialAnalysis) => PortResult<{ projection: DomainProjection; presentation: BiPresentation }> | Promise<PortResult<{ projection: DomainProjection; presentation: BiPresentation }>> }>>
  revalidate: BiPresentationPort["revalidate"]
}): ProjectedPlannerBiHost {
  return {
    revalidate: input.revalidate,
    async readView(request, context) {
      const selection = await input.resolve(request, context)
      if (selection.status !== "ok") return selection
      if (selection.value.comparison.period.start !== request.period.start || selection.value.comparison.period.end !== request.period.end) return { status: "stale", reason: "period-mismatch" }
      const analysis = await input.planner.compareForecast(selection.value.comparison, context)
      if (analysis.status !== "ok") return analysis
      const projections = [analysis.value.baseline, analysis.value.candidate]
      if (projections.some((projection) => projection.context.installationId !== context.binding.installationId || projection.context.projectId !== context.binding.projectId || projection.context.principalRef !== context.binding.principalRef || projection.context.accessRevision !== context.binding.accessRevision || projection.context.policyVersion !== context.binding.policyVersion)) return { status: "denied", reason: "context-mismatch" }
      if (projections.some((projection) => projection.context.period.start !== request.period.start || projection.context.period.end !== request.period.end)) return { status: "stale", reason: "period-mismatch" }
      if (projections.some((projection) => projection.context.currency !== selection.value.comparison.currency)) return { status: "unavailable", reason: "currency-mismatch" }
      const result = await selection.value.project(analysis.value)
      if (result.status !== "ok") return result
      if (result.value.presentation.viewId !== request.viewId) return { status: "unavailable", reason: "view-mismatch" }
      if (result.value.projection.context.installationId !== context.binding.installationId || result.value.projection.context.projectId !== context.binding.projectId || result.value.projection.context.principalRef !== context.binding.principalRef || result.value.projection.context.accessRevision !== context.binding.accessRevision || result.value.projection.context.policyVersion !== context.binding.policyVersion) return { status: "denied", reason: "context-mismatch" }
      if (result.value.projection.context.period.start !== request.period.start || result.value.projection.context.period.end !== request.period.end) return { status: "stale", reason: "period-mismatch" }
      if (result.value.projection.context.currency !== selection.value.comparison.currency) return { status: "unavailable", reason: "currency-mismatch" }
      return result
    },
  }
}

export function createProjectedPlannerBiSource(host: ProjectedPlannerBiHost): BiPresentationPort {
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
