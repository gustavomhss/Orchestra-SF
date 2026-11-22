import { beginSfReadonlyDiagnostic, endSfReadonlyDiagnostic } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/diagnostic-timing.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection, SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { ScenarioOperation } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { PlannerScenarioInputs } from "../../../../modules/sucafina/Sucafinav1/product/planner/scenario-port.ts"
import { procurementRequestFields } from "../../../../modules/sucafina/Sucafinav1/product/procurement/source-projection.ts"
import type { createSfPlannerEvidence } from "./planner-evidence.ts"
import type { createSfRecordedPlannerOperationAccess } from "./recorded-planner-operation-access.ts"
import type { createSfScenarioProcurementProofScope } from "./scenario-procurement-proof-scope.ts"

/** Authorize selectors concealed inside a stored scenario without recursively reopening its case. */
export function createSfScenarioOperationAccess(input: {
  host: DomainPortHost
  sources: PlannerSourceHost
  projectPlanner: ReturnType<typeof createSfPlannerEvidence>
  scenarioInputs: PlannerScenarioInputs
  readSourceFences: (call: TrustedDomainContext) => Promise<unknown | undefined>
  resolveProcurementEvidence: BusinessContextService["resolve"]
  recordedPlanner?: ReturnType<typeof createSfRecordedPlannerOperationAccess>
  procurementProof?: ReturnType<typeof createSfScenarioProcurementProofScope>
  externalOperation: (request: { caseRef: { id: string; incarnation: string; version: number }; draftRef: string; operation: ScenarioOperation }, call: TrustedDomainContext) => Promise<PortResult<{ operationDigest: string; sourceRefs: readonly BusinessEvidenceRef[] }>>
}) {
  return async (value: DecisionCase, call: TrustedDomainContext): Promise<boolean> => {
    const sfDiagnosticOpsTotal = beginSfReadonlyDiagnostic("operations.total")
    try {
    const request = input.host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    const requestDigest = request && digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] })
    const currentAuthority = () => !!request && !request.signal.aborted && input.host.requestFor(call) === request && binding === digestSfValue([call.kind, call.binding]) &&
      requestDigest === digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] })
    if (!currentAuthority() || !await input.host.revalidate(call)) return false
    const captured = structuredClone(value)
    const original = digestSfValue(captured)
    const selected = [...captured.alternatives, ...captured.choices].filter((item) => item.scenario.operations.length)
    if (!selected.length) return digestSfValue(value) === original && await input.host.revalidate(call) && currentAuthority()
    const sfDiagnosticOpsFencesBefore = beginSfReadonlyDiagnostic("operations.fences.before")
    try {
    const fences = await input.readSourceFences(call)
    endSfReadonlyDiagnostic(sfDiagnosticOpsFencesBefore)
    if (!fences) return false
    const caseRef = { id: captured.id, incarnation: captured.incarnation, version: captured.version }
    const groupKey = (item: (typeof selected)[number]) => digestSfValue({ scenario: item.scenario, result: item.result })
    const duplicates = new Set(selected.map(groupKey).filter((key, index, all) => all.indexOf(key) !== index))
    const scope = duplicates.size ? input.procurementProof?.(value, call) : undefined
    // Invocation-local completed proofs only. No pending Promise or authority
    // is shared with the next guard pass, another request or overlapping work.
    const proofs = new Map<string, string>()
    try {
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
        const key = digestSfValue({ group: groupKey(item), refs: unique })
        const before = scope && duplicates.has(groupKey(item)) ? await scope.snapshot() : undefined
        if (before?.kind === "changed") return false
        const proof = proofs.get(key)
        if (proof) {
          if (before?.kind !== "sf-scenario-procurement-fence" || before.digest !== proof || !scope?.current()) return false
          continue
        }
        const read = () => Promise.all(unique.map((ref) => input.resolveProcurementEvidence(ref, call)))
        const first = await read()
        if (first.some((result, index) => (result.state !== "fresh" && result.state !== "historical") || !result.authorizedProjection || !result.currentRef ||
          digestSfValue(result.ref) !== digestSfValue(unique[index]) || result.accessRevision !== call.binding.accessRevision ||
          !("components" in result.authorizedProjection) || result.authorizedProjection.context.currency !== item.result.currency ||
          digestSfValue(result.authorizedProjection.context.period) !== digestSfValue(item.result.horizon))) return false
        const second = await read()
        const material = (results: typeof first) => results.map(({ checkedAt: _at, ...value }) => value)
        if (digestSfValue(material(first)) !== digestSfValue(material(second)) || !await input.host.revalidate(call)) return false
        if (scope && before?.kind === "sf-scenario-procurement-fence" && [...first, ...second].every((result) =>
          result.state === "fresh" && result.currentRef && digestSfValue(result.currentRef) === digestSfValue(result.ref))) {
          const after = await scope.snapshot()
          if (after.kind === "changed") return false
          if (after.kind === "sf-scenario-procurement-fence" && after.digest === before.digest && scope.current()) proofs.set(key, after.digest)
          else if (proofs.size) return false
          // Source metadata may materialize during the first complete reader.
          // In that case keep the canonical observation without storing a proof.
        }
        continue
      }
      const external = domain.filter((operation) => operation.targetRef.startsWith("sf-procurement:"))
      if (external.length && !await authorizeSfCompositeProcurementOperations({ host: input.host, resolve: input.resolveProcurementEvidence }, captured, item, call)) return false
      const plannerOperations = domain.filter((operation) => !operation.targetRef.startsWith("sf-procurement:"))
      const sfDiagnosticOpsSourceBefore = beginSfReadonlyDiagnostic("operations.source.before", "planner")
      try {
      const source = await input.sources.resolveForecastSource(item.scenario.baseRef, call)
      endSfReadonlyDiagnostic(sfDiagnosticOpsSourceBefore)
      if (source.status !== "ok") {
        if (source.status !== "stale" || !input.recordedPlanner || !await input.recordedPlanner(captured, item, call)) return false
        continue
      }
      if (!refs.some((ref) => digestSfValue(ref) === digestSfValue(source.value.evidence))) return false
      if (item.result.currency !== "USD") return false
      // This guard authorizes component selectors against the real domain
      // projection. Comparing a forecast with itself also reopens its coverage,
      // which can recursively revisit this same case during every case read.
      const sfDiagnosticOpsProject = beginSfReadonlyDiagnostic("operations.project", "planner")
      try {
      const current = await input.projectPlanner(source.value.evidence, call, { period: item.result.horizon, currency: item.result.currency })
      endSfReadonlyDiagnostic(sfDiagnosticOpsProject)
      if (current.status !== "ok" || current.value.engineVersion !== "planner-runtime-v1" || current.value.version !== source.value.evidence.target.version ||
        current.value.context.installationId !== call.binding.installationId || current.value.context.projectId !== call.binding.projectId ||
        current.value.context.principalRef !== call.binding.principalRef || current.value.context.accessRevision !== call.binding.accessRevision ||
        current.value.context.policyVersion !== call.binding.policyVersion || current.value.context.surface !== "planner" || current.value.context.currency !== item.result.currency ||
        digestSfValue(current.value.context.period) !== digestSfValue(item.result.horizon) || !current.value.context.sourceRefs.length ||
        current.value.context.sourceRefs.some((ref) => !covered(ref, [source.value.evidence])) ||
        new Set(current.value.values.map((entry) => entry.id)).size !== current.value.values.length) return false
      for (const operation of plannerOperations) {
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
      const sfDiagnosticOpsSourceAfter = beginSfReadonlyDiagnostic("operations.source.after", "planner")
      try {
      const again = await input.sources.resolveForecastSource(item.scenario.baseRef, call)
      endSfReadonlyDiagnostic(sfDiagnosticOpsSourceAfter)
      if (again.status !== "ok" || digestSfValue(again.value.evidence) !== digestSfValue(source.value.evidence)) return false
      } finally { endSfReadonlyDiagnostic(sfDiagnosticOpsSourceAfter) }
      } finally { endSfReadonlyDiagnostic(sfDiagnosticOpsProject) }
      } finally { endSfReadonlyDiagnostic(sfDiagnosticOpsSourceBefore) }
    }
    if (digestSfValue(value) !== original) return false
    const sfDiagnosticOpsFencesAfter = beginSfReadonlyDiagnostic("operations.fences.after")
    try {
    const sfObservedSourceFences = await input.readSourceFences(call)
    endSfReadonlyDiagnostic(sfDiagnosticOpsFencesAfter)
    if (digestSfValue(sfObservedSourceFences) !== digestSfValue(fences) || !await input.host.revalidate(call) || !currentAuthority()) return false
    if (!proofs.size) return true
    const final = await scope!.snapshot()
    return final.kind === "sf-scenario-procurement-fence" && [...proofs.values()].every((proof) => proof === final.digest) && scope!.current() && currentAuthority()
    } finally { endSfReadonlyDiagnostic(sfDiagnosticOpsFencesAfter) }
    } finally { scope?.close(); proofs.clear() }
    } finally { endSfReadonlyDiagnostic(sfDiagnosticOpsFencesBefore) }
    } finally { endSfReadonlyDiagnostic(sfDiagnosticOpsTotal) }
  }
}

function covered(source: SourceRef, refs: readonly BusinessEvidenceRef[]) {
  return refs.some((ref) => ref.kind === "record" && ref.target.surface === source.surface && ref.target.recordType === source.type && ref.target.recordId === source.id &&
    ref.target.incarnation === source.incarnation && ref.target.version === source.version && !!ref.target.period && ref.target.period.start <= source.period.start && ref.target.period.end >= source.period.end &&
    source.fields.every((field) => ref.kind === "record" && ref.target.fields.includes(field)))
}

/** Reauthorize every explicit external selector against C17; a condition is never an approval.
 * A retained choice owns its original evidence even when the case attaches a newer source. */
export async function authorizeSfCompositeProcurementOperations(input: {
  host: Pick<DomainPortHost, "revalidate" | "requestFor">
  resolve: BusinessContextService["resolve"]
}, decision: DecisionCase, item: Pick<DecisionCase["alternatives"][number], "scenario" | "result">, call: TrustedDomainContext) {
  const request = input.host.requestFor(call)
  const binding = digestSfValue([call.kind, call.binding])
  const requestDigest = request && digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] })
  const currentAuthority = () => !!request && !request.signal.aborted && input.host.requestFor(call) === request && binding === digestSfValue([call.kind, call.binding]) &&
    requestDigest === digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] })
  const operations = item.scenario.operations.filter((operation) => operation.targetRef.startsWith("sf-procurement:"))
  if (!currentAuthority() || !operations.length || new Set(operations.map((operation) => operation.targetRef)).size !== operations.length ||
    item.result.comparisonStatus !== "conditioned" || item.result.total !== null || item.result.currency !== decision.currency ||
    digestSfValue(item.result.horizon) !== digestSfValue(decision.horizon) ||
    ![...decision.alternatives, ...decision.choices].some((stored) => digestSfValue(stored.scenario) === digestSfValue(item.scenario) && digestSfValue(stored.result) === digestSfValue(item.result)) ||
    !await input.host.revalidate(call) || !currentAuthority()) return false
  const refs = operations.map((operation) => {
    const matches = item.result.sourceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record" &&
      ref.refId === operation.targetRef && ref.target.surface === "procurement" && ref.target.recordType === "procurement-request")
    const ref = matches[0]
    return ref && matches.every((other) => digestSfValue(other) === digestSfValue(ref)) && ref.refDigest === digestSfEvidenceRef(ref) &&
      ref.installationId === call.binding.installationId && ref.projectId === call.binding.projectId && ref.target.fields.includes("originalAmount") &&
      digestSfValue(ref.target.period) === digestSfValue(item.result.horizon) ? ref : undefined
  })
  if (refs.some((ref) => !ref) || operations.some((operation) => operation.kind !== "replace" || operation.replacementRef !== undefined ||
    typeof operation.amount !== "number" || !Number.isFinite(operation.amount) || operation.amount < 0 || operation.currency !== item.result.currency ||
    digestSfValue(operation.period) !== digestSfValue(item.result.horizon) || !item.result.unresolvedConditions.includes(`external-operation:${digestSfValue(operation)}:procurement-replacement-cost-unresolved`))) return false
  const read = () => Promise.all(refs.map((ref) => input.resolve(ref!, call)))
  const first = await read()
  if (!currentAuthority() || first.some((resolution, index) => {
    const ref = refs[index]!, current = resolution.currentRef, projection = resolution.authorizedProjection
    // C17 proves physical continuity. Reissuing the current actor's scope may
    // rotate its scoped incarnation; the fresh branch still requires the exact ref.
    return (resolution.state !== "fresh" && resolution.state !== "historical") || digestSfValue(resolution.ref) !== digestSfValue(ref) ||
      resolution.accessRevision !== call.binding.accessRevision || !current || current.kind !== "record" || current.refDigest !== digestSfEvidenceRef(current) ||
      current.installationId !== ref.installationId || current.projectId !== ref.projectId || current.target.surface !== "procurement" ||
      current.target.recordType !== ref.target.recordType || current.target.recordId !== ref.target.recordId ||
      digestSfValue(current.target.fields) !== digestSfValue(ref.target.fields) || digestSfValue(current.target.period) !== digestSfValue(ref.target.period) ||
      !projection || !("components" in projection) || !canonicalProcurementProjection(projection, ref) || projection.version !== ref.target.version || projection.context.surface !== "procurement" ||
      projection.context.installationId !== ref.installationId || projection.context.projectId !== ref.projectId || projection.context.currency !== item.result.currency ||
      digestSfValue(projection.context.period) !== digestSfValue(item.result.horizon) ||
      resolution.state === "historical" && !resolution.differences || resolution.state === "fresh" &&
      (digestSfValue(current) !== digestSfValue(ref) || projection.context.principalRef !== call.binding.principalRef ||
        projection.context.accessRevision !== call.binding.accessRevision || projection.context.policyVersion !== call.binding.policyVersion)
  })) return false
  const material = (values: typeof first) => values.map(({ checkedAt: _checkedAt, ...value }) => {
    const projection = value.authorizedProjection
    if (value.state !== "fresh" || !projection || !("components" in projection)) return value
    const source = ({ observedAt: _observedAt, ...ref }: SourceRef) => ref
    return { ...value, authorizedProjection: { ...projection, context: { ...projection.context, sourceRefs: projection.context.sourceRefs.map(source) },
      components: projection.components.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map(source) })) } }
  })
  const second = await read()
  return currentAuthority() && digestSfValue(material(first)) === digestSfValue(material(second)) && await input.host.revalidate(call) && currentAuthority()
}

/** C17 retains the canonical read projection: evidence belongs to its typed
 * values; context SourceRefs and financial components may both be empty. */
function canonicalProcurementProjection(projection: DomainProjection, ref: Extract<BusinessEvidenceRef, { kind: "record" }>) {
  if (projection.engineVersion !== "procurement-v1" || !projection.context || !projection.context.period || !Array.isArray(projection.context.sourceRefs) ||
    !Array.isArray(projection.components) || projection.components.length || projection.decision !== undefined || projection.comparison !== undefined ||
    !Array.isArray(projection.values) || !Array.isArray(projection.missing) ||
    ref.target.fields.some((field) => !procurementRequestFields.some((allowed) => field === allowed)) ||
    projection.context.sourceRefs.some((source) => !source || !source.period || !Array.isArray(source.fields) || !source.fields.length ||
      typeof source.observedAt !== "string" || !Number.isFinite(Date.parse(source.observedAt)) || !covered(source, [ref]))) return false
  const fields = ref.target.fields.filter((field) => field !== "sourcing")
  const numeric = ["ageDays", "baseAmount", "submittedAmount", "submittedFxRate", "originalAmount", "fxRate"]
  if (new Set(fields).size !== fields.length || projection.values.length !== fields.length || new Set(projection.values.map((value) => value?.id)).size !== fields.length ||
    projection.values.some((value) => !value || !fields.includes(value.id) || value.granularity !== "record" || !value.period ||
      digestSfValue(value.period) !== digestSfValue(ref.target.period) || !Array.isArray(value.sourceRefs) || value.sourceRefs.length !== 1 || !value.sourceRefs[0] ||
      digestSfValue(value.sourceRefs[0]) !== digestSfValue(ref) || !value.drilldown || digestSfValue(value.drilldown) !== digestSfValue(ref) ||
      !["confirmed", "estimated", "absent"].includes(value.evidenceState) ||
      value.value !== null && (numeric.includes(value.id) ? typeof value.value !== "number" || !Number.isFinite(value.value) : typeof value.value !== "string") ||
      value.currency !== undefined && (!/^[A-Z]{3}$/.test(value.currency) || !["baseAmount", "submittedAmount", "originalAmount"].includes(value.id)) ||
      value.id === "baseAmount" && value.currency !== projection.context.currency ||
      value.unit !== undefined && (value.id !== "ageDays" || value.unit !== "days")) ||
    projection.missing.some((entry) => !entry || !fields.includes(entry.field) || !["missing", "unavailable", "missing-fx"].includes(entry.reason))) return false
  const amount = projection.values.find((value) => value.id === "originalAmount")
  const currency = projection.values.find((value) => value.id === "originalCurrency")
  return !!amount && (amount.value === null ? amount.evidenceState === "absent" : amount.evidenceState === "confirmed" || amount.evidenceState === "estimated") &&
    (!currency || (currency.value === null ? amount.currency === undefined : typeof currency.value === "string" && /^[A-Z]{3}$/.test(currency.value) && amount.currency === currency.value))
}
