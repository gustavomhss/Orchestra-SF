import type { DomainProjection } from "../contracts/context.ts"
import type { BiViewRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { BiPresentationPort } from "./capabilities.ts"
import type { BiPresentation } from "./semantics.ts"
import type { StoredScenarioSelection } from "./stored-scenario.ts"
import { sameBiProjection } from "./projection.ts"

export type ScenarioBiHost = {
  readView: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<{ projection: DomainProjection; presentation: BiPresentation }>>
  revalidate: BiPresentationPort["revalidate"]
}

/** Select persisted result references through the authenticated host; no result is recomputed here. */
export function bindStoredScenarioBiPort(input: {
  readProjection: (request: StoredScenarioSelection, context: TrustedDomainContext) => Promise<PortResult<DomainProjection>>
  resolve: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<{ scenarioResultRef: string; comparisonRef: string; sensitivityResultRef?: string; present: (projection: DomainProjection) => BiPresentation }>>
  revalidate: BiPresentationPort["revalidate"]
}): ScenarioBiHost {
  return {
    revalidate: input.revalidate,
    async readView(request, context) {
      const selection = await input.resolve(request, context)
      if (selection.status !== "ok") return selection
      if (!selection.value.scenarioResultRef.trim() || !selection.value.comparisonRef.trim() || (request.viewId === "BI11" && !selection.value.sensitivityResultRef?.trim())) return { status: "unavailable", reason: "decision-unavailable" }
      const projection = await input.readProjection({ selectionRef: request.selectionRef, scenarioResultRef: selection.value.scenarioResultRef, comparisonRef: selection.value.comparisonRef, ...(selection.value.sensitivityResultRef ? { sensitivityResultRef: selection.value.sensitivityResultRef } : {}) }, context)
      if (projection.status !== "ok") return projection
      if (projection.value.context.period.start !== request.period.start || projection.value.context.period.end !== request.period.end) return { status: "stale", reason: "period-mismatch" }
      const decision = projection.value.decision
      if (decision?.kind !== "scenario" || decision.scenarioResultRef !== selection.value.scenarioResultRef || decision.comparisonRef !== selection.value.comparisonRef || (selection.value.sensitivityResultRef && (!("sensitivityResultRef" in decision) || decision.sensitivityResultRef !== selection.value.sensitivityResultRef || !decision.sensitivity)) || (request.viewId === "BI11" && !decision.sensitivity)) return { status: "stale", reason: "decision-reference-mismatch" }
      return { status: "ok", value: { projection: projection.value, presentation: selection.value.present(projection.value) } }
    },
  }
}

export function createScenarioBiSource(host: ScenarioBiHost): BiPresentationPort {
  return {
    revalidate: host.revalidate,
    async read(request, context) {
      if (!["BI09", "BI10", "BI11"].includes(request.viewId)) return { status: "unavailable", reason: "unsupported-view" }
      const result = await host.readView(request, context)
      if (result.status !== "ok") return result
      if (result.value.presentation.viewId !== request.viewId || result.value.projection.decision?.kind !== "scenario" || (request.viewId === "BI11" && !result.value.projection.decision.sensitivity)) return { status: "unavailable", reason: "decision-unavailable" }
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
