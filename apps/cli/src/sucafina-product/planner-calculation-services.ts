import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue, sfEvidenceSourceMaps } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
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
import { createSfPlannerCalculationHistory } from "./planner-calculation-history.ts"
import { createSfPlannerCalculationReadScope } from "./planner-calculation-read-scope.ts"
import type { SfCalculationObservedReads } from "./planner-calculation-read-scope.ts"
import type { SfCalculationCaseScope } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-recall-scope.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"

type SourceFences = { dashboard: string; planner: string; procurement: string }
type ProducerInput = Parameters<typeof createScenarioRequestStore>[0]
type Persist = ReturnType<typeof createPlannerResultPersistence>
type CalculationVerifier = ReturnType<typeof createPlannerCalculationEvidence>
type StoredScenario = Parameters<CalculationVerifier["verifyCalculationSources"]>[0]
type PlannerRecord = Extract<BusinessEvidenceRef, { kind: "record" }>
type Calculation = Extract<BusinessEvidenceRef, { kind: "calculation" }>
type ReadObservation = NonNullable<Awaited<ReturnType<ReturnType<typeof createSfPlannerCalculationReadScope>["open"]>>>

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
  withCalculationCase: SfCalculationCaseScope
  withHistoricalCalculationCase: SfCalculationCaseScope
  resolveHistoricalForecastCoverage: PlannerSourceHost["resolveForecastCoverage"]
}) {
  const captures = new WeakMap<TrustedDomainContext, { requestDigest: string; resultDigest: string; resultRef?: string; sources: SourceFences }>()
  // Track ancestors of one invocation; parallel readers of the same real run
  // must not be mistaken for a persisted cycle or borrow each other's proof.
  type ReplayScope = { call: TrustedDomainContext; request: Request; requestDigest: string; binding: string; runs: ReadonlySet<string>; runId: string; open: boolean; observation?: ReadObservation }
  const replaying = new AsyncLocalStorage<ReplayScope>()
  const readScope = createSfPlannerCalculationReadScope({ host: input.host, state: input.state, lockedSourceFences: input.lockedSourceFences })
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
  const recordOnlyFor = (coverageFor: PlannerSourceHost["resolveForecastCoverage"]) => createPlannerPort({ host: input.host, sources: { ...input.sources,
    resolveForecastCoverage: async (reference, call) => {
      const coverage = await coverageFor(reference, call)
      if (coverage.status !== "ok") return coverage
      const refs = [...coverage.value.basis.sourceRefs, ...coverage.value.assessment.evaluatedSourceRefs,
        ...coverage.value.assessment.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
      if (!refs.length || refs.some((ref) => ref.kind !== "record")) return { status: "unavailable", reason: "calculation-source-closure-unsupported" }
      try { sfEvidenceSourceMaps(refs) } catch { return { status: "unavailable", reason: "calculation-source-closure-invalid" } }
      return coverage
    },
  } })
  const recordOnly = recordOnlyFor(input.sources.resolveForecastCoverage)
  const historicalRecordOnly = recordOnlyFor(input.resolveHistoricalForecastCoverage)
  const historical = createSfPlannerCalculationHistory({ host: input.host, state: input.state, authorizeCase: input.authorizeCase, evidence: input.evidence,
    replayRecordOnly: historicalRecordOnly.simulateScenario, withCalculationCase: input.withHistoricalCalculationCase, lockedSourceFences: input.lockedSourceFences,
    verifyCurrentPlannerRecords: (refs, call) => freshRecordSources(refs, call) })
  const loadRequest: Parameters<typeof createPlannerCalculationEvidence>[0]["loadRecordOnlyRequest"] = async (runId, call) => {
    const frame = replaying.getStore()
    const found = await requests.read(runId, call)
    if (found.status === "ok" && frame?.open && frame === replaying.getStore() && frame.call === call && frame.runId === runId)
      frame.observation?.request(found.value)
    return found
  }
  const loadResult: Parameters<typeof createPlannerCalculationEvidence>[0]["readForCalculation"] = async (request, call) => {
    if (request.kind !== "scenario") return { status: "unavailable", reason: "calculation-result-kind-unsupported" }
    const frame = replaying.getStore()
    const found = await input.results.readForCalculation({ resultRef: request.resultRef }, call)
    if (found.status === "ok" && found.value.kind === "scenario" && frame?.open && frame === replaying.getStore() &&
      frame.call === call && frame.runId === request.resultRef) frame.observation?.result(found.value)
    return found
  }
  const recordCalculation = createPlannerCalculationEvidence({ host: input.host,
    loadRecordOnlyRequest: loadRequest, readForCalculation: loadResult,
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
    loadRecordOnlyRequest: loadRequest, readForCalculation: loadResult,
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
  const issueObserved = async <Value>(runId: string, call: TrustedDomainContext,
    finish: (reference: Calculation, observed: SfCalculationObservedReads | undefined) => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
    if (typeof runId !== "string" || !runId.trim()) return { status: "denied", reason: "calculation-authority-unavailable" }
    // Bound the selector admission too: canonical readers may resolve ancestors
    // before the producer's own replay guard starts.
    const request = input.host.requestFor(call), binding = digestSfValue([call.kind, call.binding]), parent = replaying.getStore()
    if (!request || request.signal.aborted) return { status: "denied", reason: "calculation-authority-unavailable" }
    const requestDigest = requestIdentity(request)
    const ancestors = parent?.open && parent.call === call && parent.request === request && parent.binding === binding ? parent.runs : new Set<string>()
    if (ancestors.has(runId) || ancestors.size >= 16) return { status: "unavailable", reason: "calculation-replay-cycle" }
    const scope: ReplayScope = { call, request, requestDigest, binding, runId, runs: new Set([...ancestors, runId]), open: true }
    const current = () => scope.open && replaying.getStore() === scope && input.host.requestFor(call) === request && !request.signal.aborted &&
      requestIdentity(request) === requestDigest && digestSfValue([call.kind, call.binding]) === binding
    return replaying.run(scope, async (): Promise<PortResult<Value>> => {
      try {
        const selected = await readScope.select(runId, call)
        if (selected.status !== "ok") return selected
        if (!current()) return { status: "denied", reason: "calculation-authority-changed" }
        // Enter the actual persisted case before request-store callbacks can
        // turn a precise scope refusal into a generic unavailable request.
        return await input.withCalculationCase<Value>(call, selected.value.stored.caseRef, async () => {
          if (!current()) return { status: "denied", reason: "calculation-authority-changed" }
          const eligible = call.kind === "ui" && plannerCalculationClosure(selected.value.stored)
          if (eligible) {
            scope.observation = await readScope.open(selected.value, call, current)
            if (!scope.observation) return { status: "unavailable", reason: "calculation-observation-unavailable" }
          }
          const parsed = decodeSfOperationInput("sf_scenario_simulate", object(selected.value.request).request)
          const recordOnly = call.kind === "ui" && parsed.ok && !parsed.value.assumptions.length &&
            !parsed.value.operations.some((operation) => operation.replacementRef) && !!plannerRecordSources(selected.value.stored)
          const issued = await (recordOnly ? recordCalculation : calculation).issue(runId, call)
          if (issued.status !== "ok") return issued
          const observed = scope.observation?.completed()
          if (scope.observation && !observed) return { status: "unavailable", reason: "calculation-observation-incomplete" }
          return finish(issued.value, observed)
        }, async (result) => {
          if (!current()) return { status: "denied", reason: "calculation-authority-changed" }
          return result.status !== "ok" || !scope.observation ? result : await scope.observation.verify()
            ? result : { status: "unavailable", reason: "calculation-observation-changed" }
        })
      } catch { return { status: "unavailable", reason: "calculation-replay-unavailable" } }
      finally { scope.observation?.close(); scope.open = false }
    })
  }
  const issue: typeof calculation.issue = (runId, call) => issueObserved(runId, call, async (value) => ({ status: "ok", value }))
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
      const captured = structuredClone(ref)
      const resolved = await issueObserved<BusinessEvidenceResolution>(captured.target.runId, call, async (issued, observed) => {
        const refused = (): PortResult<BusinessEvidenceResolution> => ({ status: "unavailable", reason: "calculation-evidence-unavailable" })
        if (digestSfValue(issued) !== digestSfValue(captured) || digestSfValue(ref) !== digestSfValue(captured)) return refused()
        // These are the actual outputs of the producer's two independent loaders,
        // not a memoized read. Native and mixed closures retain their old readers.
        const stored = observed ? { status: "ok" as const, value: observed.stored }
          : await input.results.readForCalculation({ resultRef: captured.target.runId }, call)
        const binding = observed ? { status: "ok" as const, value: observed.request } : await requests.read(captured.target.runId, call)
        if (stored.status !== "ok" || stored.value.kind !== "scenario" || binding.status !== "ok" ||
          stored.value.requestDigest !== ref.target.inputDigest || stored.value.resultDigest !== ref.target.resultDigest ||
          digestSfValue(stored.value.result) !== ref.target.resultDigest || binding.value.engineVersion !== ref.target.engineVersion ||
          digestSfValue(stored.value.sourceRefs) !== digestSfValue(ref.target.sourceRefs) || digestSfValue(stored.value.result.horizon) !== digestSfValue(ref.target.period) || stored.value.result.currency !== ref.target.currency)
          return refused()
        const sources = await input.evidence.context({ refs: ref.target.sourceRefs }, call)
        if (sources.length !== ref.target.sourceRefs.length || sources.some((source, index) => source.state !== "fresh" || !source.currentRef || !source.authorizedProjection ||
          source.accessRevision !== call.binding.accessRevision || digestSfValue(source.ref) !== digestSfValue(ref.target.sourceRefs[index]) || digestSfValue(source.currentRef) !== digestSfValue(source.ref))) return refused()
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
        if (!observed) {
          const latest = await input.results.readForCalculation({ resultRef: captured.target.runId }, call)
          const latestBinding = await requests.read(captured.target.runId, call)
          if (latest.status !== "ok" || digestSfValue(latest.value) !== digestSfValue(stored.value) || latestBinding.status !== "ok" ||
            digestSfValue(latestBinding.value) !== digestSfValue(binding.value) || input.host.requestFor(call)?.signal.aborted || !await input.host.revalidate(call)) return refused()
        }
        // The observed lane's final C08 witness runs after withCalculationCase's
        // last selectedCase await, retaining its exact owner until egress.
        return { status: "ok", value: { state: "fresh", ref: captured, currentRef: issued, authorizedProjection: projection,
          accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() } }
      })
      return resolved.status === "ok" && digestSfValue(ref) === digestSfValue(captured) ? resolved.value : unavailable()
    } catch { return unavailable() }
  }
  return { persist, issue, resolveEvidence, resolveHistoricalEvidence: historical.resolve, verifyCalculationSources, requests: { read: requests.read } }
}

function plannerRecordSources(stored: StoredScenario): readonly PlannerRecord[] | undefined {
  const refs = [...stored.sourceRefs, ...stored.result.sourceRefs, ...stored.result.costCoverage.evaluatedSourceRefs,
    ...stored.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
  if (!refs.length || !refs.every((ref): ref is PlannerRecord => ref.kind === "record" && ref.target.surface === "planner" && ref.target.recordType === "planner-version")) return undefined
  return refs.filter((ref, index, all) => all.findIndex((other) => digestSfValue(other) === digestSfValue(ref)) === index)
}

/** Only the Planner record/ledger graph is covered by this host witness. */
function plannerCalculationClosure(stored: StoredScenario): boolean {
  const refs = [...stored.sourceRefs, ...stored.result.sourceRefs, ...stored.result.costCoverage.evaluatedSourceRefs,
    ...stored.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
  const visit = (ref: BusinessEvidenceRef, ancestors: ReadonlySet<string>): boolean => {
    if (ancestors.size >= 16 || ancestors.has(ref.refDigest)) return false
    if (ref.kind === "record") return ref.target.surface === "planner" && ref.target.recordType === "planner-version"
    const next = new Set([...ancestors, ref.refDigest])
    if (ref.kind === "case-event") return ref.target.evidenceRefs.length > 0 && ref.target.evidenceRefs.every((source) => visit(source, next))
    if (ref.kind === "calculation") return ref.target.calculationId === "planner:scenario" && ref.target.engineVersion === "planner-runtime-v1" &&
      ref.target.sourceRefs.length > 0 && ref.target.sourceRefs.every((source) => visit(source, next))
    return false
  }
  try { sfEvidenceSourceMaps(refs); return refs.length > 0 && refs.every((ref) => visit(ref, new Set())) }
  catch { return false }
}

function requestIdentity(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers.entries()] }) }
