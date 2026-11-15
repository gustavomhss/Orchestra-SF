import type { DomainProjection } from "../contracts/context.ts"
import type { BiViewRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { BiPresentationPort } from "./capabilities.ts"
import type { BiPresentation } from "./semantics.ts"
import type { StoredScenarioSelection } from "./stored-scenario.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { sameBiProjection } from "./projection.ts"
import { readHistoricalScenarios } from "../decisions/result-store.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import { plannerScenarioBiPresentation } from "../planner/scenario-bi.ts"
import { projectionDigest, resolvePlannerScenarioBatch } from "../planner/scenario-comparison-port.ts"
import type { PlannerScenarioHost, ResolvedScenario } from "../planner/scenario-comparison-port.ts"
import { readPortfolioSnapshot } from "../portfolio/read-snapshot.ts"

export type ScenarioBiHost = {
  readView: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<{ projection: DomainProjection; presentation: BiPresentation }>>
  revalidate: BiPresentationPort["revalidate"]
}

/** Select persisted result references through the authenticated host; no result is recomputed here. */
export function bindStoredScenarioBiPort(input: {
  readProjection: (request: StoredScenarioSelection, context: TrustedDomainContext) => Promise<PortResult<DomainProjection>>
  resolve: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<{ scenarioResultRef: string; comparisonRef: string; sensitivityResultRef?: string; advantageComparisonRef?: string; present: (projection: DomainProjection) => BiPresentation }>>
  revalidate: BiPresentationPort["revalidate"]
}): ScenarioBiHost {
  return {
    revalidate: input.revalidate,
    async readView(incoming, context) {
      const request = structuredClone(incoming)
      const forwarded = structuredClone(request)
      const resolved = await input.resolve(forwarded, context)
      if (resolved.status !== "ok") return resolved
      if (digestSfValue(forwarded) !== digestSfValue(request)) return { status: "stale", reason: "selection-changed" }
      const present = resolved.value.present
      const selection: StoredScenarioSelection = { selectionRef: request.selectionRef, scenarioResultRef: resolved.value.scenarioResultRef, comparisonRef: resolved.value.comparisonRef, ...(resolved.value.sensitivityResultRef ? { sensitivityResultRef: resolved.value.sensitivityResultRef } : {}), ...(resolved.value.advantageComparisonRef !== undefined ? { advantageComparisonRef: resolved.value.advantageComparisonRef } : {}) }
      if (!selection.scenarioResultRef.trim() || !selection.comparisonRef.trim() || (request.viewId === "BI11" && !selection.sensitivityResultRef?.trim())) return { status: "unavailable", reason: "decision-unavailable" }
      const selected = structuredClone(selection)
      const projection = structuredClone(await input.readProjection(selected, context))
      if (projection.status !== "ok") return projection
      if (digestSfValue(selected) !== digestSfValue(selection)) return { status: "stale", reason: "selection-changed" }
      if (projection.value.context.period.start !== request.period.start || projection.value.context.period.end !== request.period.end) return { status: "stale", reason: "period-mismatch" }
      const decision = projection.value.decision
      if (decision?.kind !== "scenario" || decision.scenarioResultRef !== selection.scenarioResultRef || decision.comparisonRef !== selection.comparisonRef || (selection.sensitivityResultRef && (!("sensitivityResultRef" in decision) || decision.sensitivityResultRef !== selection.sensitivityResultRef || !decision.sensitivity)) || (request.viewId === "BI11" && !decision.sensitivity)) return { status: "stale", reason: "decision-reference-mismatch" }
      if (selection.advantageComparisonRef !== undefined && projection.value.comparison?.comparisonRef !== selection.advantageComparisonRef) return { status: "stale", reason: "advantage-reference-mismatch" }
      const presentationInput = structuredClone(projection.value)
      const presentation = structuredClone(present(presentationInput))
      if (!sameBiProjection(presentationInput, projection.value)) return { status: "stale", reason: "projection-changed-by-presentation" }
      return { status: "ok", value: { projection: projection.value, presentation } }
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

/** Mount the canonical cost and period producers over persisted C08 observations. Earlier
 * baseline case versions remain historical; their identities are never rewritten. */
export function createScenarioCostBiHost(input: {
  host: DomainPortHost
  results: Pick<ReturnType<typeof createSfDecisionResultStore>, "read" | "readHistoricalScenario">
  scenarios: PlannerScenarioHost
  scenario: ScenarioBiHost
}): ScenarioBiHost {
  type Pair = { baseline: ResolvedScenario; candidate: ResolvedScenario }
  type Observation = { pair: Pair; receipts: string }
  type View = { projection: DomainProjection; presentation: BiPresentation }
  const readView = (incoming: BiViewRequest, context: TrustedDomainContext): Promise<PortResult<View>> => readPortfolioSnapshot<PortResult<View>>(input.host, context, incoming, async () => {
    const request = structuredClone(incoming)
    if (request.viewId !== "BI09" && request.viewId !== "BI10") return { status: "unavailable", reason: "unsupported-cost-view" }
    if (!await input.host.revalidate(context)) return { status: "denied", reason: "scenario-cost-authority-unavailable" }
    const readSource = async () => {
      const forwarded = structuredClone(request)
      const source = structuredClone(await input.scenario.readView(forwarded, context))
      return digestSfValue(forwarded) === digestSfValue(request) ? source : { status: "stale" as const, reason: "scenario-cost-selection-changed" }
    }
    const source = await readSource()
    if (source.status !== "ok") return source
    const projection = source.value.projection, decision = projection.decision
    if (decision?.kind !== "scenario" || decision.comparison.alternativeResultRef !== decision.scenarioResultRef ||
      decision.comparison.baselineResultRef === decision.scenarioResultRef) return { status: "stale", reason: "scenario-cost-pair-mismatch" }
    if ((["installationId", "projectId", "principalRef", "accessRevision", "policyVersion"] as const).some((field) => projection.context[field] !== context.binding[field]) ||
      digestSfValue(projection.context.period) !== digestSfValue(request.period)) return { status: "denied", reason: "scenario-cost-context-mismatch" }
    const references = [decision.comparison.baselineResultRef, decision.scenarioResultRef]
    const observe = async (): Promise<PortResult<Observation>> => {
      const comparison = structuredClone(await input.results.read({ kind: "comparison", resultRef: decision.comparisonRef }, context))
      if (comparison.status !== "ok") return comparison
      if (comparison.value.kind !== "comparison" || comparison.value.resultRef !== decision.comparisonRef ||
        digestSfValue(comparison.value.result) !== digestSfValue(decision.comparison)) return { status: "stale", reason: "scenario-cost-comparison-changed" }
      const records = await readHistoricalScenarios(input.results, references, context)
      const first = records[0], second = records[1]
      if (records.length !== 2 || !first || !second) return { status: "unavailable", reason: "scenario-cost-pair-unavailable" }
      if (first.status !== "ok") return first
      if (second.status !== "ok") return second
      const currentCase = comparison.value.caseRef
      if (first.value.kind !== "scenario" || second.value.kind !== "scenario" || first.value.resultRef !== references[0] || second.value.resultRef !== references[1] ||
        first.value.caseRef.id !== currentCase.id || first.value.caseRef.incarnation !== currentCase.incarnation || first.value.caseRef.version > currentCase.version ||
        digestSfValue(second.value.caseRef) !== digestSfValue(currentCase) || digestSfValue(second.value.result) !== digestSfValue(decision.scenario)) return { status: "stale", reason: "scenario-cost-case-mismatch" }
      const resolved = await resolvePlannerScenarioBatch(input.scenarios, references, context)
      const baseline = resolved[0], candidate = resolved[1]
      if (resolved.length !== 2 || !baseline || !candidate) return { status: "unavailable", reason: "scenario-cost-pair-unavailable" }
      if (baseline.status !== "ok") return baseline
      if (candidate.status !== "ok") return candidate
      if (digestSfValue(baseline.value.result) !== digestSfValue(first.value.result) || digestSfValue(candidate.value.result) !== digestSfValue(second.value.result)) return { status: "stale", reason: "scenario-cost-results-changed" }
      return { status: "ok", value: { pair: { baseline: baseline.value, candidate: candidate.value }, receipts: digestSfValue([first.value, second.value, comparison.value]) } }
    }
    const observed = await observe()
    if (observed.status !== "ok") return observed
    // All financial values, deltas and running endpoints come from this producer.
    const planned = plannerScenarioBiPresentation(projection, observed.value.pair, request.viewId)
    if (planned.status !== "ok") return planned
    const again = await readSource()
    if (again.status !== "ok") return again
    const latest = await observe()
    if (latest.status !== "ok") return latest
    const stamp = (pair: Pair) => digestSfValue(Object.fromEntries(Object.entries(pair).map(([key, value]) => [key, { ...value, projection: projectionDigest(value.projection) }])))
    if (!sameBiProjection(projection, again.value.projection) || observed.value.receipts !== latest.value.receipts || stamp(observed.value.pair) !== stamp(latest.value.pair))
      return { status: "stale", reason: "scenario-cost-observation-changed" }
    return planned
  }, { status: "denied", reason: "scenario-cost-read-scope-unavailable" })
  return {
    readView,
    async revalidate(request, context, projection) {
      if (!projection) return input.host.revalidate(context)
      const observed = await readView(structuredClone(request), context)
      return observed.status === "ok" && sameBiProjection(observed.value.projection, projection)
    },
  }
}
