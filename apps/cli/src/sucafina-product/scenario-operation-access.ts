import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { ScenarioOperation } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { PlannerScenarioInputs } from "../../../../modules/sucafina/Sucafinav1/product/planner/scenario-port.ts"

/** Authorize selectors concealed inside a stored scenario without recursively reopening its case. */
export function createSfScenarioOperationAccess(input: {
  host: DomainPortHost
  sources: PlannerSourceHost
  planner: PlannerPort
  scenarioInputs: PlannerScenarioInputs
  readSourceFences: (call: TrustedDomainContext) => Promise<unknown | undefined>
  externalOperation: (request: { caseRef: { id: string; incarnation: string; version: number }; draftRef: string; operation: ScenarioOperation }, call: TrustedDomainContext) => Promise<PortResult<{ operationDigest: string; sourceRefs: readonly BusinessEvidenceRef[] }>>
}) {
  return async (value: DecisionCase, call: TrustedDomainContext): Promise<boolean> => {
    if (!await input.host.revalidate(call)) return false
    const captured = structuredClone(value)
    const original = digestSfValue(captured)
    const selected = [...captured.alternatives, ...captured.choices].filter((item) => item.scenario.operations.length)
    if (!selected.length) return digestSfValue(value) === original && await input.host.revalidate(call)
    const fences = await input.readSourceFences(call)
    if (!fences) return false
    const caseRef = { id: captured.id, incarnation: captured.incarnation, version: captured.version }
    for (const item of selected) {
      const refs = [...captured.sourceRefs, ...item.result.sourceRefs, ...item.result.costCoverage.evaluatedSourceRefs,
        ...item.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
      const domain = item.scenario.operations.filter((operation) => !operation.replacementRef?.startsWith("hot-topic-draft:"))
      for (const operation of item.scenario.operations.filter((entry) => entry.replacementRef?.startsWith("hot-topic-draft:"))) {
        const external = await input.externalOperation({ caseRef, draftRef: operation.replacementRef!, operation }, call)
        if (external.status !== "ok" || external.value.operationDigest !== digestSfValue(operation) || !external.value.sourceRefs.length ||
          external.value.sourceRefs.some((ref) => !refs.some((allowed) => digestSfValue(allowed) === digestSfValue(ref)))) return false
      }
      if (!domain.length) continue
      const source = await input.sources.resolveForecastSource(item.scenario.baseRef, call)
      if (source.status !== "ok" || !refs.some((ref) => digestSfValue(ref) === digestSfValue(source.value.evidence))) return false
      const current = await input.planner.compareForecast({ baseRef: item.scenario.baseRef, candidateRef: item.scenario.baseRef, period: item.result.horizon, currency: item.result.currency }, call)
      if (current.status !== "ok" || current.value.analysisBasis !== "domain" || current.value.sourceRefs.some((ref) => !refs.some((allowed) => digestSfValue(ref) === digestSfValue(allowed)))) return false
      for (const operation of domain) {
        const targets = current.value.baseline.components.filter((component) => component.id === operation.targetRef)
        if (targets.length !== 1 || !targets[0]!.sourceRefs.length || targets[0]!.sourceRefs.some((ref) => !covered(ref, refs))) return false
        if (operation.replacementRef) {
          const replacement = await input.scenarioInputs.resolveAmount(operation.replacementRef, call)
          if (replacement.status !== "ok" || !Number.isFinite(replacement.value.amount) || !covered(replacement.value.source, refs) ||
            !refs.some((ref) => digestSfValue(ref) === digestSfValue(replacement.value.evidence)) ||
            replacement.value.currency !== item.result.currency || replacement.value.period.start < item.result.horizon.start || replacement.value.period.end > item.result.horizon.end ||
            operation.amount !== undefined || operation.currency !== undefined && operation.currency !== replacement.value.currency ||
            operation.period !== undefined && digestSfValue(operation.period) !== digestSfValue(replacement.value.period)) return false
        }
      }
      const again = await input.sources.resolveForecastSource(item.scenario.baseRef, call)
      if (again.status !== "ok" || digestSfValue(again.value.evidence) !== digestSfValue(source.value.evidence)) return false
    }
    return digestSfValue(value) === original && digestSfValue(await input.readSourceFences(call)) === digestSfValue(fences) && await input.host.revalidate(call)
  }
}

function covered(source: SourceRef, refs: readonly BusinessEvidenceRef[]) {
  return refs.some((ref) => ref.kind === "record" && ref.target.surface === source.surface && ref.target.recordType === source.type && ref.target.recordId === source.id &&
    ref.target.incarnation === source.incarnation && ref.target.version === source.version && !!ref.target.period && ref.target.period.start <= source.period.start && ref.target.period.end >= source.period.end &&
    source.fields.every((field) => ref.kind === "record" && ref.target.fields.includes(field)))
}
