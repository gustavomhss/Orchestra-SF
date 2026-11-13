import type { SfDomainValidation } from "../contracts/runtime.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { BiViewRequest } from "../contracts/operations.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { createBiDescriptor, createBiSourceRouter, readBiPresentation } from "./capabilities.ts"
import type { BiPresentationPort } from "./capabilities.ts"
import type { BiViewId } from "./catalog.ts"
import { bindDashboardBiPort, createDashboardBiSource } from "./dashboard.ts"
import { bindPlannerBiPort, createPlannerBiSource } from "./planner.ts"
import { bindProjectedPlannerBiPort, createProjectedPlannerBiSource } from "./planner-projected.ts"
import { createProcurementBiSource } from "./procurement.ts"
import type { ProcurementBiHost } from "./procurement.ts"
import { bindStoredPortfolioBiPort, createPortfolioBiSource } from "./portfolio.ts"
import { bindStoredScenarioBiPort, createScenarioBiSource } from "./scenario.ts"

export type BiProducer = "dashboard" | "planner" | "procurement" | "portfolio" | "scenario"

type Routes<T> = { views: readonly BiViewId[]; host: T }

/** Composition accepts only host-resolved domain ports; it does not grant authority or discover sources. */
export function createSfBiFactory(input: {
  authority: SfDomainValidation
  select?: (request: BiViewRequest, context: TrustedDomainContext, candidates: readonly BiProducer[]) => Promise<PortResult<BiProducer>>
  dashboard?: Routes<Parameters<typeof bindDashboardBiPort>[0]>
  planner?: Routes<Parameters<typeof bindPlannerBiPort>[0]>
  projectedPlanner?: Routes<Parameters<typeof bindProjectedPlannerBiPort>[0]>
  procurement?: Routes<ProcurementBiHost>
  portfolio?: Routes<Parameters<typeof bindStoredPortfolioBiPort>[0]>
  scenario?: Routes<Parameters<typeof bindStoredScenarioBiPort>[0]>
}) {
  const bindings: { producer: BiProducer; views: readonly BiViewId[]; allowed: readonly BiViewId[]; source: BiPresentationPort }[] = [
    ...(input.dashboard ? [{ producer: "dashboard" as const, views: input.dashboard.views, allowed: ["BI01", "BI02", "BI03", "BI04", "BI07", "BI08"] as const, source: createDashboardBiSource(bindDashboardBiPort(input.dashboard.host)) }] : []),
    ...(input.planner ? [{ producer: "planner" as const, views: input.planner.views, allowed: ["BI01", "BI02", "BI03", "BI04"] as const, source: createPlannerBiSource(bindPlannerBiPort(input.planner.host)) }] : []),
    ...(input.projectedPlanner ? [{ producer: "planner" as const, views: input.projectedPlanner.views, allowed: ["BI02", "BI03"] as const, source: createProjectedPlannerBiSource(bindProjectedPlannerBiPort(input.projectedPlanner.host)) }] : []),
    ...(input.procurement ? [{ producer: "procurement" as const, views: input.procurement.views, allowed: ["BI05", "BI06"] as const, source: createProcurementBiSource(input.procurement.host) }] : []),
    ...(input.scenario ? [{ producer: "scenario" as const, views: input.scenario.views, allowed: ["BI09", "BI10", "BI11"] as const, source: createScenarioBiSource(bindStoredScenarioBiPort(input.scenario.host)) }] : []),
    ...(input.portfolio ? [{ producer: "portfolio" as const, views: input.portfolio.views, allowed: ["BI09", "BI10", "BI11"] as const, source: createPortfolioBiSource(bindStoredPortfolioBiPort(input.portfolio.host)) }] : []),
  ]
  const entries = bindings.flatMap((binding) => binding.views.map((view) => ({ view, producer: binding.producer, allowed: binding.allowed.includes(view), source: binding.source })))
  if (entries.some((entry) => !entry.allowed) || bindings.some((binding) => new Set(binding.views).size !== binding.views.length) || new Set(entries.map((entry) => `${entry.view}:${entry.producer}`)).size !== entries.length || (!input.select && new Set(entries.map((entry) => entry.view)).size !== entries.length)) throw new Error("BI_ROUTE_CONFIGURATION_INVALID")
  const views = [...new Set(entries.map((entry) => entry.view))]
  const routes: Partial<Record<BiViewId, BiPresentationPort>> = Object.fromEntries(views.map((view) => {
    const candidates = entries.filter((entry) => entry.view === view)
    const resolve = async (request: BiViewRequest, context: TrustedDomainContext): Promise<PortResult<BiPresentationPort>> => {
      if (candidates.length === 1) return { status: "ok", value: candidates[0]!.source }
      if (!input.select) return { status: "unavailable", reason: "producer-selection-unavailable" }
      const selected = await input.select(request, context, candidates.map((candidate) => candidate.producer))
      if (selected.status !== "ok") return selected
      const candidate = candidates.find((entry) => entry.producer === selected.value)
      return candidate ? { status: "ok", value: candidate.source } : { status: "denied", reason: "producer-selection-invalid" }
    }
    const route: BiPresentationPort = {
      async read(request, context) {
        const selected = await resolve(request, context)
        return selected.status === "ok" ? selected.value.read(request, context) : selected
      },
      async describe(request, context, projection) {
        const selected = await resolve(request, context)
        return selected.status === "ok" ? selected.value.describe(request, context, projection) : selected
      },
      async revalidate(request, context, projection) {
        const selected = await resolve(request, context)
        return selected.status === "ok" && await selected.value.revalidate(request, context, projection)
      },
    }
    return [view, route]
  }))
  const source = createBiSourceRouter(routes)
  return {
    source,
    descriptor: createBiDescriptor(source, input.authority),
    readPresentation: (request: BiViewRequest, context: TrustedDomainContext) => readBiPresentation(request, context, source, input.authority),
  }
}
