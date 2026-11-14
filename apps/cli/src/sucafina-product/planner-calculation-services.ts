import { digestSfValue, sfEvidenceSourceMaps } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection, ProjectionValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { sfRunSourceFence } from "../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import { createScenarioRequestStore } from "../../../../modules/sucafina/Sucafinav1/product/decisions/scenario-request-store.ts"
import { createPlannerCalculationEvidence } from "../../../../modules/sucafina/Sucafinav1/product/planner/calculation-evidence.ts"
import { createPlannerPort } from "../../../../modules/sucafina/Sucafinav1/product/planner/port.ts"
import { plannerScenarioDigest } from "../../../../modules/sucafina/Sucafinav1/product/planner/preview-comparison.ts"
import type { createPlannerResultPersistence } from "../../../../modules/sucafina/Sucafinav1/product/planner/persistence.ts"

type SourceFences = { dashboard: string; planner: string; procurement: string }
type ProducerInput = Parameters<typeof createScenarioRequestStore>[0]
type Persist = ReturnType<typeof createPlannerResultPersistence>

/** Bind actual persisted Planner outputs to their original request and the published record-only replay. */
export function createSfPlannerCalculationServices(input: {
  host: DomainPortHost
  state: ProducerInput["state"]
  results: ProducerInput["results"]
  authorizeCase: ProducerInput["authorizeCase"]
  operationIdentity: ProducerInput["operationIdentity"]
  writes: WeakSet<object>
  sources: PlannerSourceHost
  evidence: BusinessContextService
  persist: Persist
  readSourceFences: (call: TrustedDomainContext) => Promise<SourceFences | undefined>
  lockedSourceFences: () => SourceFences | undefined
  withCalculationCase: <T>(call: TrustedDomainContext, caseRef: { id: string; incarnation: string; version: number }, work: () => Promise<PortResult<T>>) => Promise<PortResult<T>>
}) {
  const captures = new WeakMap<TrustedDomainContext, { requestDigest: string; resultDigest: string; resultRef?: string; sources: SourceFences }>()
  const requests = createScenarioRequestStore({ state: input.state, results: input.results, host: input.host,
    authorizeCase: input.authorizeCase, operationIdentity: input.operationIdentity, writes: input.writes,
    authorizeProducer: async (request, resultRef, engineVersion, call) => {
      const captured = captures.get(call)
      return !!captured && captured.resultRef === resultRef && captured.requestDigest === digestSfValue(request) && engineVersion === "planner-runtime-v1" && await input.host.revalidate(call)
    },
    verifySnapshot: (snapshot, record, call) => {
      const captured = captures.get(call)
      const current = input.lockedSourceFences()
      const request = input.host.requestFor(call)
      return !!captured && !!current && !!request && !request.signal.aborted && captured.resultRef === record.resultRef &&
        captured.requestDigest === record.requestDigest && captured.resultDigest === record.resultDigest && record.engineVersion === "planner-runtime-v1" &&
        sfRunSourceFence(snapshot) === captured.sources.planner && digestSfValue(current) === digestSfValue(captured.sources)
    },
  })
  // Reuse the native Planner engine. This lane cannot accept assumptions, replacement
  // references, or a coverage closure containing another calculation or ledger event.
  const recordOnly = createPlannerPort({ host: input.host, sources: { ...input.sources,
    resolveForecastCoverage: async (reference, call) => {
      const coverage = await input.sources.resolveForecastCoverage(reference, call)
      if (coverage.status !== "ok") return coverage
      const refs = [...coverage.value.basis.sourceRefs, ...coverage.value.assessment.evaluatedSourceRefs,
        ...coverage.value.assessment.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
      if (!refs.length || refs.some((ref) => ref.kind !== "record")) return { status: "unavailable", reason: "calculation-source-closure-unsupported" }
      try { sfEvidenceSourceMaps(refs) } catch { return { status: "unavailable", reason: "calculation-source-closure-invalid" } }
      return coverage
    },
  } })
  const calculation = createPlannerCalculationEvidence({ host: input.host,
    loadRecordOnlyRequest: requests.read,
    readForCalculation: (request, call) => request.kind === "scenario"
      ? input.results.readForCalculation({ resultRef: request.resultRef }, call)
      : Promise.resolve({ status: "unavailable", reason: "calculation-result-kind-unsupported" }),
    replayRecordOnly: recordOnly.simulateScenario,
  })
  const issuing = new WeakMap<TrustedDomainContext, ReturnType<typeof calculation.issue>>()
  const issue: typeof calculation.issue = async (runId, call) => {
    const previous = issuing.get(call)
    // Parallel BCS branches can reach the same calculation in one call. Let
    // each perform its complete record-only replay after the previous branch
    // releases the private case binding; a concurrent read is not recursion.
    const pending = (async () => {
      await previous?.catch(() => undefined)
      const binding = await requests.read(runId, call)
      return binding.status === "ok" ? input.withCalculationCase(call, binding.value.caseRef, () => calculation.issue(runId, call)) : binding
    })()
    issuing.set(call, pending)
    try { return await pending }
    finally { if (issuing.get(call) === pending) issuing.delete(call) }
  }
  const persist: Persist = async (incoming, callId, call, comparisonReplay) => {
    if (incoming.kind !== "scenario" || incoming.request.assumptions.length || incoming.request.operations.some((operation) => operation.replacementRef))
      return input.persist(incoming, callId, call, comparisonReplay)
    const closure = [...incoming.result.sourceRefs, ...incoming.result.costCoverage.evaluatedSourceRefs,
      ...incoming.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
    if (closure.some((ref) => ref.kind !== "record")) return input.persist(incoming, callId, call, comparisonReplay)
    if (captures.has(call)) return { status: "unavailable", reason: "calculation-publication-already-active" }
    const value = structuredClone(incoming)
    const fences = await input.readSourceFences(call)
    if (!fences) return { status: "unavailable", reason: "calculation-source-fence-unavailable" }
    const replay = await recordOnly.simulateScenario(value.request, call)
    if (replay.status !== "ok") return replay
    if (plannerScenarioDigest(replay.value) !== plannerScenarioDigest(value.result)) return { status: "stale", reason: "calculation-result-replay-changed" }
    const captured = { requestDigest: digestSfValue(value.request), resultDigest: digestSfValue(value.result), resultRef: undefined as string | undefined, sources: fences }
    captures.set(call, captured)
    try {
      const saved = await input.persist(value, callId, call, comparisonReplay)
      if (saved.status !== "ok") return saved
      captured.resultRef = saved.value.resultRef
      const registered = await requests.register({ resultRef: saved.value.resultRef, request: value.request, engineVersion: "planner-runtime-v1" }, call)
      if (registered.status !== "ok") return { status: registered.status, reason: "calculation-request-binding-unavailable" }
      const issued = await issue(saved.value.resultRef, call)
      return issued.status === "ok" ? saved : issued
    } catch { return { status: "unavailable", reason: "calculation-publication-unavailable" } }
    finally { captures.delete(call) }
  }
  const resolveEvidence = async (ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> => {
    const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() })
    try {
      if (ref.kind !== "calculation" || ref.target.calculationId !== "planner:scenario" || !await input.host.revalidate(call)) return unavailable()
      sfEvidenceSourceMaps([ref])
      const issued = await issue(ref.target.runId, call)
      if (issued.status !== "ok" || digestSfValue(issued.value) !== digestSfValue(ref)) return unavailable()
      const stored = await input.results.readForCalculation({ resultRef: ref.target.runId }, call)
      const binding = await requests.read(ref.target.runId, call)
      if (stored.status !== "ok" || stored.value.kind !== "scenario" || binding.status !== "ok" ||
        stored.value.requestDigest !== ref.target.inputDigest || stored.value.resultDigest !== ref.target.resultDigest ||
        digestSfValue(stored.value.result) !== ref.target.resultDigest || binding.value.engineVersion !== ref.target.engineVersion ||
        digestSfValue(stored.value.sourceRefs) !== digestSfValue(ref.target.sourceRefs) || digestSfValue(stored.value.result.horizon) !== digestSfValue(ref.target.period) || stored.value.result.currency !== ref.target.currency)
        return unavailable()
      const sources = await input.evidence.context({ refs: ref.target.sourceRefs }, call)
      if (sources.length !== ref.target.sourceRefs.length || sources.some((source, index) => source.state !== "fresh" || !source.currentRef || !source.authorizedProjection ||
        !("context" in source.authorizedProjection) || !("sourceRefs" in source.authorizedProjection.context) || digestSfValue(source.ref) !== digestSfValue(ref.target.sourceRefs[index]) || digestSfValue(source.currentRef) !== digestSfValue(source.ref))) return unavailable()
      const result = stored.value.result
      const metadata = sources.flatMap((source) => source.authorizedProjection && "context" in source.authorizedProjection && "sourceRefs" in source.authorizedProjection.context ? source.authorizedProjection.context.sourceRefs : [])
      const sourceRefs = [...metadata, ...result.components.flatMap((component) => component.sourceRefs)]
        .filter((source, index, all) => all.findIndex((other) => digestSfValue(other) === digestSfValue(source)) === index)
      const value = (id: string, amount: ProjectionValue["value"], unit?: string): ProjectionValue => ({ id, value: amount, ...(unit ? { unit } : {}),
        period: result.horizon, granularity: "aggregate", sourceRefs: stored.value.sourceRefs, drilldown: null, evidenceState: amount === null ? "absent" : "hypothetical" })
      // The persisted JSON keeps coverage, restrictions and nulls losslessly. It is
      // a scenario projection, with no invented comparison or completeness claim.
      const projection: DomainProjection = {
        context: { installationId: call.binding.installationId, projectId: call.binding.projectId, principalRef: call.binding.principalRef,
          accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion, surface: "planner", period: result.horizon,
          currency: result.currency, sourceRefs, capabilities: [] },
        version: result.version, engineVersion: binding.value.engineVersion, components: structuredClone(result.components),
        values: [value("scenario:result-ref", stored.value.resultRef), value("scenario:request-digest", stored.value.requestDigest),
          value("scenario:result-digest", stored.value.resultDigest), value("scenario:result", JSON.stringify(result), "application/json"),
          value("scenario:known-subtotal", result.knownSubtotal, result.currency), value("scenario:total", result.total, result.currency)],
        missing: [...result.unresolvedConditions.map((field) => ({ field, reason: "unconfirmed" as const })),
          ...(result.total === null ? [{ field: "scenario:total", reason: "unavailable" as const }] : []),
          ...(result.costCoverage.coverageState !== "complete" ? [{ field: "scenario:cost-coverage", reason: "unconfirmed" as const }] : [])],
      }
      const latest = await input.results.readForCalculation({ resultRef: ref.target.runId }, call)
      const latestBinding = await requests.read(ref.target.runId, call)
      if (latest.status !== "ok" || digestSfValue(latest.value) !== digestSfValue(stored.value) || latestBinding.status !== "ok" ||
        digestSfValue(latestBinding.value) !== digestSfValue(binding.value) || input.host.requestFor(call)?.signal.aborted || !await input.host.revalidate(call)) return unavailable()
      return { state: "fresh", ref, currentRef: issued.value, authorizedProjection: projection, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() }
    } catch { return unavailable() }
  }
  return { persist, issue, resolveEvidence, requests: { read: requests.read } }
}
