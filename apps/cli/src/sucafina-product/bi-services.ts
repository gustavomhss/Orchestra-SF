import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BiPresentation, DomainProjection } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { BiViewRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { createSfBiFactory } from "../../../../modules/sucafina/Sucafinav1/product/analytics/factory.ts"
import { dispatchBiPresentation } from "../../../../modules/sucafina/Sucafinav1/product/analytics/consumer.ts"
import type { BiPresentationPort } from "../../../../modules/sucafina/Sucafinav1/product/analytics/capabilities.ts"
import { createStoredScenarioBiProjection } from "../../../../modules/sucafina/Sucafinav1/product/analytics/stored-scenario.ts"
import type { StoredScenarioSelection } from "../../../../modules/sucafina/Sucafinav1/product/analytics/stored-scenario.ts"
import { sameBiProjection } from "../../../../modules/sucafina/Sucafinav1/product/analytics/projection.ts"
import { resolveBiPresentation } from "../../../../modules/sucafina/Sucafinav1/product/analytics/semantics.ts"
import { createStoredPortfolioProjection } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/projection.ts"
import { dashboardBiPresentation } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/bi.ts"
import { resolveDashboardBiSelection } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/bi-metadata.ts"
import { plannerCapacityPresentation, plannerMonthlyPresentation } from "../../../../modules/sucafina/Sucafinav1/product/planner/bi.ts"
import { plannerDifferencePresentation } from "../../../../modules/sucafina/Sucafinav1/product/planner/bi-difference.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfPortfolioServices } from "./portfolio-services.ts"
import { readSfDecisionBiSelection, readSfPlannerBiSelection, sameSfBiPeriod } from "./bi-selections.ts"
import { createSfBiCallScope } from "./bi-call-scope.ts"

export function createSfBiServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  portfolio: ReturnType<typeof createSfPortfolioServices>
}) {
  const { authority, business, portfolio } = input
  const host = authority.host
  const callScope = createSfBiCallScope({ authority, sources: business.plannerSources, lockedSourceFences: business.lockedSourceFences })
  const caseFor = async (selectionRef: string, call: TrustedDomainContext) => {
    const parsed = readSfDecisionBiSelection(selectionRef), request = host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    if (!parsed || !request || request.signal.aborted || !await host.revalidate(call)) return undefined
    const reference = "scenarioResultRef" in parsed ? parsed.scenarioResultRef : parsed.portfolioResultRef
    const result = await authority.state.read(request, "cases", (state, actor) => {
      if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return undefined
      const result = state.decisionResults?.[reference]
      const current = result && state.cases[result.caseRef.id]
      return current && current.incarnation === result.caseRef.incarnation && current.participants.includes(actor.principalRef)
        ? { id: current.id, incarnation: current.incarnation, version: current.version } : undefined
    })
    return result.status === "ok" && await host.revalidate(call) && host.requestFor(call) === request && !request.signal.aborted &&
      binding === digestSfValue([call.kind, call.binding]) ? result.value : undefined
  }
  const revalidate = async (request: BiViewRequest, call: TrustedDomainContext, expected?: DomainProjection): Promise<boolean> => {
    if (!await host.revalidate(call)) return false
    const current = await factory.source.read(request, call)
    return current.status === "ok" && (!expected || sameBiProjection(current.value, expected)) && await host.revalidate(call)
  }
  const readProjection = async (selectionRef: string, call: TrustedDomainContext): Promise<PortResult<DomainProjection>> => {
    const selection = readSfDecisionBiSelection(selectionRef)
    const scenarios = business.plannerProduct.scenarios
    if (!selection || !scenarios) return { status: "unavailable", reason: "bi-decision-selection-unavailable" }
    const reference = "scenarioResultRef" in selection ? selection.scenarioResultRef : selection.sourceScenarioRef
    const result = await scenarios.resolve(reference, call)
    return result.status === "ok" ? { status: "ok", value: result.value.projection } : result
  }
  const sensitivity = portfolio.product?.contribution.persistentSensitivity
  const scenarioProjection = createSfAuthorizedScenarioBiProjection({ host, results: business.results,
    ...(sensitivity ? { readSensitivity: sensitivity.read } : {}), readProjection })
  const persistedPortfolio = portfolio.product?.contribution.persistent
  const portfolioProjection = persistedPortfolio ? createStoredPortfolioProjection({ readPortfolio: persistedPortfolio.read, readProjection,
    revalidateProjection: async (selectionRef, projection, result, call) => {
      const parsed = readSfDecisionBiSelection(selectionRef)
      if (!parsed || !("portfolioResultRef" in parsed) || parsed.portfolioResultRef !== result.portfolioResultRef ||
        !result.portfolio.combinations.some((combination) => combination.analysis?.scenarioResultRef === parsed.sourceScenarioRef)) return false
      const stored = await business.results.read({ kind: "scenario", resultRef: parsed.sourceScenarioRef }, call)
      const current = await readProjection(selectionRef, call)
      return stored.status === "ok" && digestSfValue(stored.value.caseRef) === digestSfValue(result.caseRef) && current.status === "ok" &&
        sameBiProjection(current.value, projection) && await host.revalidate(call)
    },
  }) : undefined
  const decisionPresentation = (request: BiViewRequest): BiPresentation => ({ viewId: request.viewId === "BI09" ? "BI09" : request.viewId === "BI10" ? "BI10" : "BI11",
    series: [], limitations: ["The persisted decision result supplies the detailed cost, period and sensitivity tables.",
      ...(request.viewId === "BI09" || request.viewId === "BI10" ? ["A producer-owned waterfall or timeline plan is not available for this selection."] : [])] })
  const factory = createSfBiFactory({ authority: authority.authority,
    select: async (request, call, candidates) => {
      if (!await host.revalidate(call)) return { status: "denied", reason: "bi-authority-unavailable" }
      const selected = request.selectionRef.startsWith("sf-bi-planner:") ? "planner" : readSfDecisionBiSelection(request.selectionRef)
      const producer = typeof selected === "string" ? selected : selected ? "portfolioResultRef" in selected ? "portfolio" : "scenario" : "dashboard"
      return candidates.includes(producer) ? { status: "ok", value: producer } : { status: "unavailable", reason: "bi-producer-selection-unavailable" }
    },
    dashboard: { views: ["BI01", "BI07", "BI08"], host: { dashboard: business.dashboard, revalidate,
      resolve: async (request, call) => {
        if (request.viewId !== "BI01" && request.viewId !== "BI07" && request.viewId !== "BI08") return { status: "unavailable", reason: "dashboard-bi-view-unavailable" }
        const viewId = request.viewId
        const selected = resolveDashboardBiSelection(viewId, request.period)
        if (!selected) return { status: "needs-input", reason: "dashboard-bi-period-unavailable" }
        const source = await business.dashboardSources.resolveDashboardSource(request.selectionRef, call, { fields: selected.fields, period: request.period })
        if (source.status !== "ok") return source
        return source.value.page === selected.page ? { status: "ok", value: { fields: selected.fields, present: (projection) => dashboardBiPresentation(viewId, projection) } }
          : { status: "denied", reason: "dashboard-bi-selection-outside-view" }
      },
    } },
    planner: { views: ["BI01", "BI04"], host: { planner: portfolio.planner, revalidate,
      resolve: async (request) => {
        const comparison = readSfPlannerBiSelection(request.selectionRef)
        return comparison && sameSfBiPeriod(comparison.period, request.period) ? { status: "ok", value: { comparison, side: "candidate",
          present: (analysis) => request.viewId === "BI04" ? plannerCapacityPresentation(analysis.candidate) : plannerMonthlyPresentation(analysis.candidate) } }
          : { status: "needs-input", reason: "planner-bi-selection-unavailable" }
      },
    } },
    projectedPlanner: { views: ["BI02", "BI03"], host: { planner: portfolio.planner, revalidate,
      resolve: async (request) => {
        const comparison = readSfPlannerBiSelection(request.selectionRef)
        return comparison && sameSfBiPeriod(comparison.period, request.period) ? { status: "ok", value: { comparison,
          project: (analysis) => plannerDifferencePresentation(analysis, request.viewId === "BI02" ? "BI02" : "BI03") } }
          : { status: "needs-input", reason: "planner-bi-selection-unavailable" }
      },
    } },
    procurement: { views: ["BI05", "BI06"], host: { list: business.procurement.list, revalidate } },
    scenario: { views: ["BI09", "BI10", "BI11"], host: { readProjection: (selection, call) => selection.advantageComparisonRef === undefined
      ? callScope.read(selection, call, () => scenarioProjection(selection, call)) : scenarioProjection(selection, call), revalidate,
      resolve: async (request) => {
        const selected = readSfDecisionBiSelection(request.selectionRef)
        return selected && "scenarioResultRef" in selected ? { status: "ok", value: { ...selected, present: () => decisionPresentation(request) } }
          : { status: "needs-input", reason: "scenario-bi-selection-unavailable" }
      },
    } },
    ...(portfolioProjection ? { portfolio: { views: ["BI09", "BI10"] as const, host: { readProjection: portfolioProjection,
      revalidate: (request: BiViewRequest, call: TrustedDomainContext, _bundle?: unknown, projection?: DomainProjection) => revalidate(request, call, projection),
      resolve: async (request: BiViewRequest) => {
        const selected = readSfDecisionBiSelection(request.selectionRef)
        return selected && "portfolioResultRef" in selected ? { status: "ok" as const, value: { portfolioResultRef: selected.portfolioResultRef, present: () => decisionPresentation(request) } }
          : { status: "needs-input" as const, reason: "portfolio-bi-selection-unavailable" }
      },
    } } } : {}),
  })
  // C16 consumes the UI admission before any source callback. Bind the private
  // case inside those callbacks, where requestFor can prove that consumption;
  // prebinding an unconsumed context would deny every decision BI invocation.
  const withinCase = async <Value>(request: BiViewRequest, call: TrustedDomainContext, read: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
    if (call.kind !== "ui" || !readSfDecisionBiSelection(request.selectionRef)) return read()
    const selected = await caseFor(request.selectionRef, call)
    return selected ? business.withCase(call, selected, {}, read) : { status: "denied", reason: "bi-case-selection-unavailable" }
  }
  const presentationSource: BiPresentationPort = {
    read: (request, call) => withinCase(request, call, () => factory.source.read(request, call)),
    describe: (request, call, projection) => withinCase(request, call, () => factory.source.describe(request, call, projection)),
    revalidate: async (request, call, projection) => {
      const result = await withinCase(request, call, async () => ({ status: "ok", value: await factory.source.revalidate(request, call, projection) }))
      return result.status === "ok" && result.value === true
    },
  }
  const dispatchPresentation = (request: BiViewRequest, call: TrustedDomainContext) => {
    const selected = readSfDecisionBiSelection(request.selectionRef)
    const dispatch = () => dispatchBiPresentation(request, call, presentationSource, authority.authority)
    // The completed-proof scope covers the original pair. An inverse result can
    // have additional evidence; keep all canonical reads for this new selection.
    return selected && "scenarioResultRef" in selected && selected.advantageComparisonRef !== undefined
      ? dispatch() : callScope.run(request, call, dispatch)
  }
  // Review is an authenticated consumer of domain producers, not a second C16 BI invocation.
  const readForReview = async (request: BiViewRequest, call: TrustedDomainContext): Promise<PortResult<{ projection: DomainProjection; presentation: BiPresentation }>> => {
    if (!decodeSfOperationInput("sf_bi_view", request).ok || !host.requestFor(call) || !await host.revalidate(call)) return { status: "denied", reason: "bi-review-authority-unavailable" }
    const projected = await factory.source.read(request, call)
    if (projected.status !== "ok") return projected
    const projectedCopy = structuredClone(projected.value)
    const context = projectedCopy.context
    if (!decodeSfOperationOutput("sf_bi_view", projectedCopy).ok || context.installationId !== call.binding.installationId || context.projectId !== call.binding.projectId ||
      context.principalRef !== call.binding.principalRef || context.accessRevision !== call.binding.accessRevision || context.policyVersion !== call.binding.policyVersion ||
      !sameSfBiPeriod(context.period, request.period)) return { status: "denied", reason: "bi-review-context-mismatch" }
    const presentation = await factory.source.describe(request, call, projectedCopy)
    if (presentation.status !== "ok") return presentation
    if (presentation.value.viewId !== request.viewId || resolveBiPresentation(projectedCopy, presentation.value).status !== "ok" ||
      !await factory.source.revalidate(request, call, projectedCopy) || !await host.revalidate(call)) return { status: "stale", reason: "bi-review-source-changed" }
    return { status: "ok", value: { projection: projectedCopy, presentation: structuredClone(presentation.value) } }
  }
  return { ...factory, dispatchPresentation, caseFor, readForReview, unavailable: ["decision-bi-waterfall-plan-unavailable", "decision-bi-timeline-plan-unavailable"] }
}

/** Binds the producer's two persisted observations to one exact selection and Request. */
export function createSfAuthorizedScenarioBiProjection(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  results: Parameters<typeof createStoredScenarioBiProjection>[0]["results"]
  readProjection: Parameters<typeof createStoredScenarioBiProjection>[0]["readProjection"]
  readSensitivity?: Parameters<typeof createStoredScenarioBiProjection>[0]["readSensitivity"]
}) {
  return async (incoming: StoredScenarioSelection, call: TrustedDomainContext): Promise<PortResult<DomainProjection>> => {
    const selection = structuredClone(incoming), selected = readSfDecisionBiSelection(selection.selectionRef)
    if (!selected || !("scenarioResultRef" in selected) || selected.scenarioResultRef !== selection.scenarioResultRef ||
      selected.comparisonRef !== selection.comparisonRef || selected.sensitivityResultRef !== selection.sensitivityResultRef ||
      selected.advantageComparisonRef !== selection.advantageComparisonRef) return { status: "denied", reason: "bi-scenario-selection-mismatch" }
    const request = input.host.requestFor(call), binding = digestSfValue([call.kind, call.binding]), expected = digestSfValue(selection)
    const current = () => request !== undefined && input.host.requestFor(call) === request && !request.signal.aborted &&
      binding === digestSfValue([call.kind, call.binding]) && expected === digestSfValue(incoming) && expected === digestSfValue(selection)
    const denied = (): PortResult<never> => ({ status: "denied", reason: "bi-scenario-authority-changed" })
    if (!current() || !await input.host.revalidate(call) || !current()) return denied()
    // C08 owns the exact direct/inverse pair, current case and source authority.
    // The host adds selection equality and checks its Request after every await.
    const read = createStoredScenarioBiProjection({ results: input.results, readProjection: input.readProjection,
      ...(input.readSensitivity ? { readSensitivity: input.readSensitivity } : {}),
      revalidateProjection: async (observed, projection, caseRef, context) => {
        if (context !== call || !current() || digestSfValue(observed) !== expected) return false
        const source = await input.readProjection(selection.selectionRef, call)
        if (!current() || source.status !== "ok" || !sameBiProjection(source.value, projection)) return false
        const stored = await input.results.read({ kind: "scenario", resultRef: selected.scenarioResultRef }, call)
        if (!current() || stored.status !== "ok" || digestSfValue(stored.value.caseRef) !== digestSfValue(caseRef)) return false
        return await input.host.revalidate(call) && current()
      },
    })
    const projected = await read(selection, call)
    if (!current() || !await input.host.revalidate(call) || !current()) return denied()
    return projected
  }
}
