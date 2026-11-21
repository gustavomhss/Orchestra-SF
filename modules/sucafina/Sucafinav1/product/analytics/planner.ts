import type { DomainProjection } from "../contracts/context.ts"
import type { BiViewRequest, ForecastCompareRequest } from "../contracts/operations.ts"
import type { FinancialAnalysis, PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sameBiProjection } from "./projection.ts"
import type { BiPresentationPort } from "./capabilities.ts"
import type { BiPresentation } from "./semantics.ts"

/** The host resolves the selected planner versions and calls the real compareForecast port. */
export type PlannerBiHost = {
  readView: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<{ analysis: FinancialAnalysis; side: "baseline" | "candidate"; presentation: BiPresentation }>>
  revalidate: BiPresentationPort["revalidate"]
}

export function createPlannerBiSource(host: PlannerBiHost): BiPresentationPort {
  return {
    revalidate: host.revalidate,
    async read(request, context) {
      const result = await host.readView(request, context)
      if (result.status !== "ok") return result
      if (result.value.presentation.viewId !== request.viewId) return { status: "unavailable", reason: "view-mismatch" }
      return { status: "ok", value: result.value.analysis[result.value.side] }
    },
    async describe(request, context, projection: DomainProjection) {
      const result = await host.readView(request, context)
      if (result.status !== "ok") return result
      if (result.value.presentation.viewId !== request.viewId || !sameBiProjection(result.value.analysis[result.value.side], projection)) return { status: "stale", reason: "projection-changed" }
      return { status: "ok", value: result.value.presentation }
    },
  }
}

/** Resolves a business selection to a real planner comparison without interpreting it in BI. */
export function bindPlannerBiPort(input: {
  planner: PlannerPort
  resolve: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<{ comparison: ForecastCompareRequest; side: "baseline" | "candidate"; present: (analysis: FinancialAnalysis) => BiPresentation }>>
  revalidate: BiPresentationPort["revalidate"]
}): PlannerBiHost {
  return {
    revalidate: input.revalidate,
    async readView(request, context) {
      const binding = await input.resolve(request, context)
      if (binding.status !== "ok") return binding
      if (binding.value.comparison.period.start !== request.period.start || binding.value.comparison.period.end !== request.period.end) return { status: "stale", reason: "period-mismatch" }
      const analysis = await input.planner.compareForecast(binding.value.comparison, context)
      if (analysis.status !== "ok") return analysis
      const projection = analysis.value[binding.value.side]
      if (projection.context.period.start !== request.period.start || projection.context.period.end !== request.period.end) return { status: "stale", reason: "period-mismatch" }
      return { status: "ok", value: { analysis: analysis.value, side: binding.value.side, presentation: binding.value.present(analysis.value) } }
    },
  }
}
