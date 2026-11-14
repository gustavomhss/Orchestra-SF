import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { ScenarioOperation } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { PlannerScenarioInputs } from "../../../../modules/sucafina/Sucafinav1/product/planner/scenario-port.ts"
import type { createSfPlannerEvidence } from "./planner-evidence.ts"
import type { createSfRecordedPlannerOperationAccess } from "./recorded-planner-operation-access.ts"

/** Authorize selectors concealed inside a stored scenario without recursively reopening its case. */
export function createSfScenarioOperationAccess(input: {
  host: DomainPortHost
  sources: PlannerSourceHost
  projectPlanner: ReturnType<typeof createSfPlannerEvidence>
  scenarioInputs: PlannerScenarioInputs
  readSourceFences: (call: TrustedDomainContext) => Promise<unknown | undefined>
  resolveProcurementEvidence: BusinessContextService["resolve"]
  recordedPlanner?: ReturnType<typeof createSfRecordedPlannerOperationAccess>
  externalOperation: (request: { caseRef: { id: string; incarnation: string; version: number }; draftRef: string; operation: ScenarioOperation }, call: TrustedDomainContext) => Promise<PortResult<{ operationDigest: string; sourceRefs: readonly BusinessEvidenceRef[] }>>
}) {
  return async (value: DecisionCase, call: TrustedDomainContext): Promise<boolean> => {
    const request = input.host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    const currentAuthority = () => !!request && !request.signal.aborted && input.host.requestFor(call) === request && binding === digestSfValue([call.kind, call.binding])
    if (!currentAuthority() || !await input.host.revalidate(call)) return false
    const captured = structuredClone(value)
    const original = digestSfValue(captured)
    const selected = [...captured.alternatives, ...captured.choices].filter((item) => item.scenario.operations.length)
    if (!selected.length) return digestSfValue(value) === original && await input.host.revalidate(call) && currentAuthority()
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
      const procurementBase = refs.filter((ref) => ref.kind === "record" && ref.target.surface === "procurement" && ref.target.recordType === "procurement-request" && ref.refId === item.scenario.baseRef)
      if (procurementBase.length) {
        const selectedRefs = [procurementBase[0]!, ...domain.flatMap((operation) => refs.filter((ref) => ref.kind === "record" && ref.target.surface === "procurement" && ref.target.recordType === "procurement-request" && ref.refId === operation.targetRef))]
        const unique = [...new Map(selectedRefs.map((ref) => [ref.refDigest, ref])).values()]
        if (domain.some((operation) => operation.kind !== "replace" || operation.replacementRef !== undefined || typeof operation.amount !== "number" || !Number.isFinite(operation.amount) || operation.amount < 0 || operation.currency !== item.result.currency || digestSfValue(operation.period) !== digestSfValue(item.result.horizon) ||
          !unique.some((ref) => ref.refId === operation.targetRef))) return false
        const read = () => Promise.all(unique.map((ref) => input.resolveProcurementEvidence(ref, call)))
        const first = await read()
        if (first.some((result, index) => (result.state !== "fresh" && result.state !== "historical") || !result.authorizedProjection || !result.currentRef ||
          digestSfValue(result.ref) !== digestSfValue(unique[index]) || result.accessRevision !== call.binding.accessRevision ||
          !("components" in result.authorizedProjection) || result.authorizedProjection.context.currency !== item.result.currency ||
          digestSfValue(result.authorizedProjection.context.period) !== digestSfValue(item.result.horizon))) return false
        const second = await read()
        const material = (results: typeof first) => results.map(({ checkedAt: _at, ...value }) => value)
        if (digestSfValue(material(first)) !== digestSfValue(material(second)) || !await input.host.revalidate(call)) return false
        continue
      }
      const source = await input.sources.resolveForecastSource(item.scenario.baseRef, call)
      if (source.status !== "ok") {
        if (source.status !== "stale" || !input.recordedPlanner || !await input.recordedPlanner(captured, item, call)) return false
        continue
      }
      if (!refs.some((ref) => digestSfValue(ref) === digestSfValue(source.value.evidence))) return false
      if (item.result.currency !== "USD") return false
      // This guard authorizes component selectors against the real domain
      // projection. Comparing a forecast with itself also reopens its coverage,
      // which can recursively revisit this same case during every case read.
      const current = await input.projectPlanner(source.value.evidence, call, { period: item.result.horizon, currency: item.result.currency })
      if (current.status !== "ok" || current.value.engineVersion !== "planner-runtime-v1" || current.value.version !== source.value.evidence.target.version ||
        current.value.context.installationId !== call.binding.installationId || current.value.context.projectId !== call.binding.projectId ||
        current.value.context.principalRef !== call.binding.principalRef || current.value.context.accessRevision !== call.binding.accessRevision ||
        current.value.context.policyVersion !== call.binding.policyVersion || current.value.context.surface !== "planner" || current.value.context.currency !== item.result.currency ||
        digestSfValue(current.value.context.period) !== digestSfValue(item.result.horizon) || !current.value.context.sourceRefs.length ||
        current.value.context.sourceRefs.some((ref) => !covered(ref, [source.value.evidence])) ||
        new Set(current.value.values.map((entry) => entry.id)).size !== current.value.values.length) return false
      for (const operation of domain) {
        const targets = current.value.components.filter((component) => component.id === operation.targetRef)
        if (targets.length !== 1 || !targets[0]!.sourceRefs.length || targets[0]!.sourceRefs.some((ref) => !covered(ref, refs))) return false
        if (operation.replacementRef) {
          const replacement = await input.scenarioInputs.resolveAmount(operation.replacementRef, call)
          if (replacement.status !== "ok") {
            if (replacement.status !== "stale" || !input.recordedPlanner || !await input.recordedPlanner(captured, item, call)) return false
            // The protected verifier rechecks every stored selector, including
            // any remaining operations and the otherwise still-current base.
            break
          }
          if (!Number.isFinite(replacement.value.amount) || !covered(replacement.value.source, refs) ||
            !refs.some((ref) => digestSfValue(ref) === digestSfValue(replacement.value.evidence)) ||
            replacement.value.currency !== item.result.currency || replacement.value.period.start < item.result.horizon.start || replacement.value.period.end > item.result.horizon.end ||
            operation.amount !== undefined || operation.currency !== undefined && operation.currency !== replacement.value.currency ||
            operation.period !== undefined && digestSfValue(operation.period) !== digestSfValue(replacement.value.period)) return false
        }
      }
      const again = await input.sources.resolveForecastSource(item.scenario.baseRef, call)
      if (again.status !== "ok" || digestSfValue(again.value.evidence) !== digestSfValue(source.value.evidence)) return false
    }
    return digestSfValue(value) === original && digestSfValue(await input.readSourceFences(call)) === digestSfValue(fences) && await input.host.revalidate(call) && currentAuthority()
  }
}

function covered(source: SourceRef, refs: readonly BusinessEvidenceRef[]) {
  return refs.some((ref) => ref.kind === "record" && ref.target.surface === source.surface && ref.target.recordType === source.type && ref.target.recordId === source.id &&
    ref.target.incarnation === source.incarnation && ref.target.version === source.version && !!ref.target.period && ref.target.period.start <= source.period.start && ref.target.period.end >= source.period.end &&
    source.fields.every((field) => ref.kind === "record" && ref.target.fields.includes(field)))
}
