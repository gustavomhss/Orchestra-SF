import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { SensitivityResult } from "../contracts/outputs.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"

type CaseRef = { id: string; incarnation: string; version: number }
export type StoredScenarioSelection = { selectionRef: string; scenarioResultRef: string; comparisonRef: string; sensitivityResultRef?: string; advantageComparisonRef?: string }
type StoredSensitivity = { sensitivityResultRef: string; sensitivity: SensitivityResult; caseRef: CaseRef }

/** Binds one source projection to persisted C08 results; the host verifies the selection and all sources. */
export function createStoredScenarioBiProjection(input: {
  results: Pick<ReturnType<typeof createSfDecisionResultStore>, "read">
  readSensitivity?: (reference: string, context: TrustedDomainContext) => Promise<PortResult<StoredSensitivity>>
  readProjection: (selectionRef: string, context: TrustedDomainContext) => Promise<PortResult<DomainProjection>>
  revalidateProjection: (selection: StoredScenarioSelection, projection: DomainProjection, caseRef: CaseRef, context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (incoming: StoredScenarioSelection, context: TrustedDomainContext): Promise<PortResult<DomainProjection>> => {
    const selection = structuredClone(incoming)
    if (![selection.selectionRef, selection.scenarioResultRef, selection.comparisonRef].every((reference) => reference.trim()) || [selection.sensitivityResultRef, selection.advantageComparisonRef].some((reference) => reference !== undefined && !reference.trim())) return { status: "needs-input", reason: "scenario-selection-required" }
    // Stores may reuse their objects. Each observation is independent of later reads and fences.
    const scenario = structuredClone(await input.results.read({ kind: "scenario", resultRef: selection.scenarioResultRef }, context))
    if (scenario.status !== "ok") return scenario
    const comparison = structuredClone(await input.results.read({ kind: "comparison", resultRef: selection.comparisonRef }, context))
    if (comparison.status !== "ok") return comparison
    if (scenario.value.kind !== "scenario" || comparison.value.kind !== "comparison" || scenario.value.resultRef !== selection.scenarioResultRef || comparison.value.resultRef !== selection.comparisonRef || digestSfValue(scenario.value.caseRef) !== digestSfValue(comparison.value.caseRef) || comparison.value.result.alternativeResultRef !== scenario.value.resultRef) return { status: "stale", reason: "scenario-reference-mismatch" }
    const advantage = selection.advantageComparisonRef ? structuredClone(await input.results.read({ kind: "comparison", resultRef: selection.advantageComparisonRef }, context)) : undefined
    if (advantage && advantage.status !== "ok") return advantage
    // The producer owns the arithmetic and source authorization. BI only binds the inverse persisted pair.
    if (advantage?.status === "ok" && (advantage.value.kind !== "comparison" || advantage.value.resultRef !== selection.advantageComparisonRef || digestSfValue(advantage.value.caseRef) !== digestSfValue(scenario.value.caseRef) || advantage.value.result.baselineResultRef !== comparison.value.result.alternativeResultRef || advantage.value.result.alternativeResultRef !== comparison.value.result.baselineResultRef)) return { status: "stale", reason: "advantage-reference-mismatch" }
    if (selection.sensitivityResultRef && !input.readSensitivity) return { status: "unavailable", reason: "sensitivity-reader-unavailable" }
    const sensitivity = selection.sensitivityResultRef && input.readSensitivity ? structuredClone(await input.readSensitivity(selection.sensitivityResultRef, context)) : undefined
    if (sensitivity && sensitivity.status !== "ok") return sensitivity
    if (sensitivity?.status === "ok" && (sensitivity.value.sensitivityResultRef !== selection.sensitivityResultRef || sensitivity.value.sensitivity.scenarioRef !== scenario.value.resultRef || digestSfValue(sensitivity.value.caseRef) !== digestSfValue(scenario.value.caseRef))) return { status: "stale", reason: "sensitivity-reference-mismatch" }
    const projection = structuredClone(await input.readProjection(selection.selectionRef, context))
    if (projection.status !== "ok") return projection
    if (projection.value.decision || projection.value.context.installationId !== context.binding.installationId || projection.value.context.projectId !== context.binding.projectId || projection.value.context.principalRef !== context.binding.principalRef || projection.value.context.accessRevision !== context.binding.accessRevision || projection.value.context.policyVersion !== context.binding.policyVersion) return { status: "denied", reason: "projection-scope-mismatch" }
    if (projection.value.context.currency !== scenario.value.result.currency || digestSfValue(projection.value.context.period) !== digestSfValue(scenario.value.result.horizon)) return { status: "stale", reason: "scenario-scope-mismatch" }
    if (advantage && projection.value.comparison) return { status: "stale", reason: "advantage-projection-conflict" }
    const verifyProjection = async () => {
      const forwarded = structuredClone({ selection, projection: projection.value, caseRef: scenario.value.caseRef })
      const digest = digestSfValue(forwarded)
      return await input.revalidateProjection(forwarded.selection, forwarded.projection, forwarded.caseRef, context) && digestSfValue(forwarded) === digest
    }
    if (!await verifyProjection()) return { status: "stale", reason: "projection-changed" }
    const latestScenario = structuredClone(await input.results.read({ kind: "scenario", resultRef: selection.scenarioResultRef }, context))
    if (latestScenario.status !== "ok") return latestScenario
    const latestComparison = structuredClone(await input.results.read({ kind: "comparison", resultRef: selection.comparisonRef }, context))
    if (latestComparison.status !== "ok") return latestComparison
    const latestAdvantage = selection.advantageComparisonRef ? structuredClone(await input.results.read({ kind: "comparison", resultRef: selection.advantageComparisonRef }, context)) : undefined
    if (latestAdvantage && latestAdvantage.status !== "ok") return latestAdvantage
    const latestSensitivity = selection.sensitivityResultRef && input.readSensitivity ? structuredClone(await input.readSensitivity(selection.sensitivityResultRef, context)) : undefined
    if (latestSensitivity && latestSensitivity.status !== "ok") return latestSensitivity
    if (digestSfValue(latestScenario.value) !== digestSfValue(scenario.value) || digestSfValue(latestComparison.value) !== digestSfValue(comparison.value) || digestSfValue(latestAdvantage?.status === "ok" ? latestAdvantage.value : null) !== digestSfValue(advantage?.status === "ok" ? advantage.value : null) || digestSfValue(latestSensitivity?.status === "ok" ? latestSensitivity.value : null) !== digestSfValue(sensitivity?.status === "ok" ? sensitivity.value : null) || !await verifyProjection()) return { status: "stale", reason: "scenario-or-projection-changed" }
    const decision = { kind: "scenario" as const, scenarioResultRef: scenario.value.resultRef, scenario: scenario.value.result, comparisonRef: comparison.value.resultRef, comparison: comparison.value.result, ...(sensitivity?.status === "ok" ? { sensitivity: sensitivity.value.sensitivity, sensitivityResultRef: sensitivity.value.sensitivityResultRef } : {}) }
    if (advantage?.status !== "ok" || advantage.value.kind !== "comparison") return { status: "ok", value: { ...projection.value, decision } }
    const row = { period: scenario.value.result.horizon, granularity: "aggregate" as const, sourceRefs: advantage.value.sourceRefs, drilldown: null }
    return { status: "ok", value: { ...projection.value, decision, comparison: {
      metricRef: "planner:known-subtotal-difference", comparisonRef: advantage.value.resultRef,
      context: structuredClone(projection.value.context), version: projection.value.version, engineVersion: projection.value.engineVersion,
      values: [
        { ...row, id: "scenario:advantage-known-difference", value: advantage.value.result.knownDifference, unit: "money", currency: scenario.value.result.currency, evidenceState: advantage.value.result.knownDifference === null ? "absent" : advantage.value.result.comparisonStatus === "complete" ? "confirmed" : "estimated" },
        { ...row, id: "scenario:advantage-comparison-status", value: advantage.value.result.comparisonStatus, evidenceState: "confirmed" },
      ],
    } } }
  }
}
