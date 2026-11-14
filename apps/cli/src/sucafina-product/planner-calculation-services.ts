import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue, sfEvidenceSourceMaps } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection, ProjectionValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
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
type CalculationVerifier = ReturnType<typeof createPlannerCalculationEvidence>
type StoredScenario = Parameters<CalculationVerifier["verifyCalculationSources"]>[0]
type PlannerRecord = Extract<BusinessEvidenceRef, { kind: "record" }>

/** Bind persisted Planner outputs and every ancestor to the installation's canonical replay. */
export function createSfPlannerCalculationServices(input: {
  host: DomainPortHost
  state: ProducerInput["state"]
  results: ProducerInput["results"]
  authorizeCase: ProducerInput["authorizeCase"]
  operationIdentity: ProducerInput["operationIdentity"]
  writes: WeakSet<object>
  sources: PlannerSourceHost
  replayScenario: PlannerPort["simulateScenario"]
  evidence: BusinessContextService
  persist: Persist
  readSourceFences: (call: TrustedDomainContext) => Promise<SourceFences | undefined>
  lockedSourceFences: () => SourceFences | undefined
  withCalculationCase: <T>(call: TrustedDomainContext, caseRef: { id: string; incarnation: string; version: number }, work: () => Promise<PortResult<T>>) => Promise<PortResult<T>>
}) {
  const captures = new WeakMap<TrustedDomainContext, { requestDigest: string; resultDigest: string; resultRef?: string; sources: SourceFences }>()
  // Track ancestors of one invocation; parallel readers of the same real run
  // must not be mistaken for a persisted cycle or borrow each other's proof.
  const replaying = new AsyncLocalStorage<{ call: TrustedDomainContext; request: Request; binding: string; runs: ReadonlySet<string>; open: boolean }>()
  const requests = createScenarioRequestStore({ state: input.state, results: input.results, host: input.host,
    authorizeCase: input.authorizeCase, operationIdentity: input.operationIdentity, writes: input.writes,
    verifyRequestSources: async (request, stored, call): Promise<boolean> => {
      const records = plannerRecordSources(stored)
      const checked = await input.withCalculationCase(call, stored.caseRef, async () => ({ status: "ok", value:
        !request.assumptions.length && !request.operations.some((operation) => operation.replacementRef) && records
          ? await recordCalculation.verifyCalculationRequestSources(request, stored, call) && await freshRecordSources(records, call)
          : await calculation.verifyCalculationRequestSources(request, stored, call) }))
      return checked.status === "ok" && checked.value
    },
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
  // Keep the conservative producer lane available. Nested issuance uses the actual
  // Planner product below, including its input resolvers and live evidence service.
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
  const recordCalculation = createPlannerCalculationEvidence({ host: input.host,
    loadRecordOnlyRequest: requests.read,
    readForCalculation: (request, call) => request.kind === "scenario"
      ? input.results.readForCalculation({ resultRef: request.resultRef }, call)
      : Promise.resolve({ status: "unavailable", reason: "calculation-result-kind-unsupported" }),
    replayRecordOnly: recordOnly.simulateScenario,
  })
  const freshRecordSources = async (refs: readonly PlannerRecord[], call: TrustedDomainContext): Promise<boolean> => {
    const request = input.host.requestFor(call), binding = digestSfValue([call.kind, call.binding]), selected = digestSfValue(refs)
    if (!request || request.signal.aborted || call.binding.principalRef.startsWith("local:") || !await input.host.revalidate(call)) return false
    const before = await input.readSourceFences(call)
    if (!before) return false
    // These are actual source admissions, not saved authorization decisions.
    // The source reader brackets its current projection and compares the full
    // reference digest; mixed/nested closures keep the full BCS verifier below.
    for (const ref of refs) {
      const current = await input.sources.resolveForecastSource(ref.refId, call)
      if (current.status !== "ok" || digestSfValue(current.value.evidence) !== digestSfValue(ref) || input.host.requestFor(call) !== request ||
        request.signal.aborted || binding !== digestSfValue([call.kind, call.binding]) || selected !== digestSfValue(refs)) return false
    }
    const after = await input.readSourceFences(call)
    return !!after && digestSfValue(after) === digestSfValue(before) && await input.host.revalidate(call) && input.host.requestFor(call) === request && !request.signal.aborted &&
      binding === digestSfValue([call.kind, call.binding]) && selected === digestSfValue(refs)
  }
  const calculation = createPlannerCalculationEvidence({ host: input.host,
    loadRecordOnlyRequest: requests.read,
    readForCalculation: (request, call) => request.kind === "scenario"
      ? input.results.readForCalculation({ resultRef: request.resultRef }, call)
      : Promise.resolve({ status: "unavailable", reason: "calculation-result-kind-unsupported" }),
    replayRecordOnly: recordOnly.simulateScenario,
    nested: { replayScenario: input.replayScenario, evidence: input.evidence },
  })
  const verifyCalculationSources: typeof calculation.verifyCalculationSources = async (stored, refs, call) => {
    const records = plannerRecordSources(stored)
    const checked = await input.withCalculationCase(call, stored.caseRef, async () => ({ status: "ok", value: records
      ? await recordCalculation.verifyCalculationSources(stored, refs, call) && await freshRecordSources(records, call)
      : await calculation.verifyCalculationSources(stored, refs, call) }))
    return checked.status === "ok" && checked.value
  }
  const issue: typeof calculation.issue = async (runId, call) => {
    if (typeof runId !== "string" || !runId.trim()) return { status: "denied", reason: "calculation-authority-unavailable" }
    // The first request read can itself resolve a persisted calculation ancestor,
    // before the producer's own replay guard has started. Bound that admission too.
    const request = input.host.requestFor(call), binding = digestSfValue([call.kind, call.binding]), parent = replaying.getStore()
    if (!request || request.signal.aborted) return { status: "denied", reason: "calculation-authority-unavailable" }
    const ancestors = parent?.open && parent.call === call && parent.request === request && parent.binding === binding ? parent.runs : new Set<string>()
    if (ancestors.has(runId) || ancestors.size >= 16) return { status: "unavailable", reason: "calculation-replay-cycle" }
    const scope = { call, request, binding, runs: new Set([...ancestors, runId]), open: true }
    return replaying.run(scope, async (): ReturnType<typeof calculation.issue> => {
      try {
        const selected = await requests.read(runId, call)
        return selected.status === "ok" ? await input.withCalculationCase(call, selected.value.caseRef, () => calculation.issue(runId, call)) : selected
      } catch { return { status: "unavailable", reason: "calculation-replay-unavailable" } }
      finally { scope.open = false }
    })
  }
  const persist: Persist = async (incoming, callId, call, comparisonReplay) => {
    if (incoming.kind !== "scenario") return input.persist(incoming, callId, call, comparisonReplay)
    if (captures.has(call)) return { status: "unavailable", reason: "calculation-publication-already-active" }
    const value = structuredClone(incoming)
    const fences = await input.readSourceFences(call)
    if (!fences) return { status: "unavailable", reason: "calculation-source-fence-unavailable" }
    const replay = await input.replayScenario(value.request, call)
    if (replay.status !== "ok") return replay
    if (plannerScenarioDigest(replay.value) !== plannerScenarioDigest(value.result)) return { status: "stale", reason: "calculation-result-replay-changed" }
    const captured = { requestDigest: digestSfValue(value.request), resultDigest: digestSfValue(value.result), resultRef: undefined as string | undefined, sources: fences }
    captures.set(call, captured)
    try {
      const saved = await input.persist(value, callId, call, { ...comparisonReplay, simulateScenario: input.replayScenario })
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
        source.accessRevision !== call.binding.accessRevision || digestSfValue(source.ref) !== digestSfValue(ref.target.sourceRefs[index]) || digestSfValue(source.currentRef) !== digestSfValue(source.ref))) return unavailable()
      const result = stored.value.result
      // Ledger/document/policy projections retain their typed evidence above. Only
      // domain projections contribute record metadata; no numeric value is inferred.
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
  return { persist, issue, resolveEvidence, verifyCalculationSources, requests: { read: requests.read } }
}

function plannerRecordSources(stored: StoredScenario): readonly PlannerRecord[] | undefined {
  const refs = [...stored.sourceRefs, ...stored.result.sourceRefs, ...stored.result.costCoverage.evaluatedSourceRefs,
    ...stored.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
  if (!refs.length || !refs.every((ref): ref is PlannerRecord => ref.kind === "record" && ref.target.surface === "planner" && ref.target.recordType === "planner-version")) return undefined
  return refs.filter((ref, index, all) => all.findIndex((other) => digestSfValue(other) === digestSfValue(ref)) === index)
}
