import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue, sfEvidenceSourceMaps } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection, ProjectionValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { ScenarioRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import { sfRunSourceFence } from "../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import { createScenarioRequestStore } from "../../../../modules/sucafina/Sucafinav1/product/decisions/scenario-request-store.ts"
import { createPlannerCalculationEvidence } from "../../../../modules/sucafina/Sucafinav1/product/planner/calculation-evidence.ts"
import { createPlannerPort } from "../../../../modules/sucafina/Sucafinav1/product/planner/port.ts"
import { plannerScenarioDigest } from "../../../../modules/sucafina/Sucafinav1/product/planner/preview-comparison.ts"
import type { createPlannerResultPersistence } from "../../../../modules/sucafina/Sucafinav1/product/planner/persistence.ts"
import { createSfPlannerCalculationHistory } from "./planner-calculation-history.ts"
import { createSfPlannerCalculationReadScope, plannerRequestIdentity } from "./planner-calculation-read-scope.ts"
import { createSfPlannerCalculationRoot } from "./planner-calculation-root.ts"
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
type LocalSourcePlan = { record: PlannerRecord; calculations: readonly Calculation[] }
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
  const rootHost = input.host, rootState = input.state, rootResults = input.results, rootSources = input.sources
  const sourceReader = rootSources.resolveForecastSource, coverageReader = rootSources.resolveForecastCoverage
  const rootReplay = input.replayScenario, rootEvidence = input.evidence
  const readRoot = createSfPlannerCalculationRoot({ host: rootHost })
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
  const prepareMixedSources = async (plan: LocalSourcePlan, owner: StoredScenario, request: ScenarioRequest,
    call: TrustedDomainContext, current: () => boolean): Promise<boolean | "unsupported"> => {
    const pending = [...plan.calculations], seen = new Map<string, string>()
    // Inspect only authenticated selectors. These observations never replace the
    // request/result loaders, ledger authorization or canonical replays below.
    for (let index = 0; index < pending.length; index++) {
      const reference = pending[index]!, runId = reference.target.runId, identity = digestSfValue(reference)
      if (runId === owner.resultRef) return false
      const prior = seen.get(runId)
      if (prior !== undefined) { if (prior !== identity) return false; continue }
      if (seen.size >= 16) return "unsupported"
      seen.set(runId, identity)
      const found = await readScope.select(runId, call)
      if (!current() || found.status !== "ok") return false
      const selection = structuredClone(found.value)
      const bound = object(selection.request), stored = selection.stored
      const parsed = decodeSfOperationInput("sf_scenario_simulate", bound.request)
      if (!parsed.ok || bound.schema !== "sf-scenario-request-v1" || bound.resultRef !== runId ||
        bound.engineVersion !== "planner-runtime-v1" || bound.requestDigest !== digestSfValue(bound.request) ||
        bound.requestDigest !== stored.requestDigest || bound.resultDigest !== stored.resultDigest ||
        digestSfValue(bound.caseRef) !== digestSfValue(stored.caseRef) ||
        stored.resultDigest !== reference.target.resultDigest || stored.requestDigest !== reference.target.inputDigest ||
        reference.target.engineVersion !== bound.engineVersion ||
        digestSfValue(stored.sourceRefs) !== digestSfValue(reference.target.sourceRefs)) return false
      if (digestSfValue(stored.caseRef) !== digestSfValue(owner.caseRef) || parsed.value.baseRef !== request.baseRef ||
        parsed.value.assumptions.some((assumption) => assumption.state !== "hypothetical") ||
        parsed.value.operations.some((operation) => operation.replacementRef)) return "unsupported"
      const nested = plannerLocalSourcePlan(stored, request.baseRef)
      if (!nested) return "unsupported"
      if (digestSfValue(nested.record) !== digestSfValue(plan.record)) return false
      pending.push(...nested.calculations)
    }
    if (!current()) return false
    // Real readers may create auxiliary source metadata here, before the full
    // witness opens. Their observations are not carried into the producer.
    const source = await input.sources.resolveForecastSource(plan.record.refId, call)
    if (!current() || source.status !== "ok" || digestSfValue(source.value.evidence) !== digestSfValue(plan.record)) return false
    const coverage = await input.sources.resolveForecastCoverage(request.baseRef, call)
    return current() && coverage.status === "ok"
  }
  const issueObserved = async <Value>(runId: string, call: TrustedDomainContext,
    finish: (reference: Calculation, observed: SfCalculationObservedReads | undefined) => Promise<PortResult<Value>>, cited = false, sealFinish = false): Promise<PortResult<Value>> => {
    if (typeof runId !== "string" || !runId.trim()) return { status: "denied", reason: "calculation-authority-unavailable" }
    if (!readRoot.allows(call)) return { status: "unavailable", reason: "calculation-read-root-unavailable" }
    // Bound the selector admission too: canonical readers may resolve ancestors
    // before the producer's own replay guard starts.
    const request = input.host.requestFor(call), binding = digestSfValue([call.kind, call.binding]), parent = replaying.getStore()
    if (!request || request.signal.aborted) return { status: "denied", reason: "calculation-authority-unavailable" }
    const requestDigest = plannerRequestIdentity(request)
    const ancestors = parent?.open && parent.call === call && parent.request === request && parent.binding === binding ? parent.runs : new Set<string>()
    if (ancestors.has(runId) || ancestors.size >= 16) return { status: "unavailable", reason: "calculation-replay-cycle" }
    const scope: ReplayScope = { call, request, requestDigest, binding, runId, runs: new Set([...ancestors, runId]), open: true }
    const current = () => scope.open && replaying.getStore() === scope && input.host.requestFor(call) === request && !request.signal.aborted &&
      plannerRequestIdentity(request) === requestDigest && digestSfValue([call.kind, call.binding]) === binding
    return replaying.run(scope, async (): Promise<PortResult<Value>> => {
      try {
        const selected = await readScope.select(runId, call)
        if (selected.status !== "ok") return selected
        // Adapters never receive this copy, so nested replays can use the
        // original owner checks without rehashing its detached input.
        const selection = structuredClone(selected.value)
        if (!current()) return { status: "denied", reason: "calculation-authority-changed" }
        // Enter the actual persisted case before request-store callbacks can
        // turn a precise scope refusal into a generic unavailable request.
        return await input.withCalculationCase<Value>(call, structuredClone(selection.stored.caseRef), async () => {
          if (!current()) return { status: "denied", reason: "calculation-authority-changed" }
          let preparedRoot: Awaited<ReturnType<typeof readRoot.prepare>> | undefined
          let prepareFinish: (() => ReturnType<typeof readRoot.prepare>) | undefined
          // Direct record-only issues retain their concurrent path. Cited
          // record-only calculations are resolved in evidence order and can
          // run their producer in a single root, like local mixed closures.
          const inheritedOwner = !!parent?.open && parent.call === call && parent.request === request &&
            parent.requestDigest === requestDigest && parent.binding === binding
          if (call.kind === "ui" && (!parent || inheritedOwner) && input.host === rootHost &&
            input.state === rootState && input.results === rootResults && input.sources === rootSources &&
            rootSources.resolveForecastSource === sourceReader && rootSources.resolveForecastCoverage === coverageReader) {
            const preparedInput = decodeSfOperationInput("sf_scenario_simulate", object(selection.request).request)
            const records = preparedInput.ok && !preparedInput.value.assumptions.length &&
              !preparedInput.value.operations.some((operation) => operation.replacementRef) ? plannerRecordSources(selection.stored) : undefined
            const mixed = preparedInput.ok && !records &&
              !preparedInput.value.assumptions.some((assumption) => assumption.state !== "hypothetical") &&
              !preparedInput.value.operations.some((operation) => operation.replacementRef) &&
              input.replayScenario === rootReplay && input.evidence === rootEvidence
            if (preparedInput.ok && ((inheritedOwner || cited) && records || mixed)) {
              const stateReader = rootState.read, resultReader = rootResults.readForCalculation
              const evidenceResolve = rootEvidence.resolve, evidenceContext = rootEvidence.context
              const sameOwner = () => scope.open && !request.signal.aborted && input.host.requestFor(call) === request &&
                plannerRequestIdentity(request) === requestDigest && digestSfValue([call.kind, call.binding]) === binding &&
                (!parent || parent.open && parent.call === call && parent.request === request &&
                  parent.requestDigest === requestDigest && parent.binding === binding) && input.host === rootHost &&
                input.state === rootState && input.results === rootResults && input.sources === rootSources &&
                rootState.read === stateReader && rootResults.readForCalculation === resultReader &&
                rootSources.resolveForecastSource === sourceReader && rootSources.resolveForecastCoverage === coverageReader &&
                (!mixed || input.replayScenario === rootReplay && input.evidence === rootEvidence &&
                  rootEvidence.resolve === evidenceResolve && rootEvidence.context === evidenceContext)
              const sameReaders = () => current() && sameOwner()
              // Own and foreign C08 scopes skip this initializer entirely. All
              // extra selectors and any source warming belong before baseline.
              const initialize = async () => {
                if (mixed) {
                  const plan = plannerLocalSourcePlan(selection.stored, preparedInput.value.baseRef)
                  return plan ? prepareMixedSources(plan, selection.stored, preparedInput.value, call, sameReaders) : "unsupported" as const
                }
                if (!records || !await freshRecordSources(records, call) || !sameReaders()) return false
                const coverage = await coverageReader(preparedInput.value.baseRef, call)
                return coverage.status === "ok" && sameReaders()
              }
              preparedRoot = await readRoot.prepare(call, initialize, sameReaders, sameOwner)
              if (!preparedRoot) return { status: "unavailable", reason: "calculation-read-root-unavailable" }
              if (sealFinish && mixed) prepareFinish = () => readRoot.prepare(call, initialize, sameReaders, sameOwner)
            }
          }
          const eligible = call.kind === "ui" && plannerCalculationClosure(selection.stored)
          if (eligible) {
            scope.observation = await readScope.open(selection, call, current)
            if (!scope.observation) return { status: "unavailable", reason: "calculation-observation-unavailable" }
          }
          const parsed = decodeSfOperationInput("sf_scenario_simulate", object(selection.request).request)
          const recordOnly = call.kind === "ui" && parsed.ok && !parsed.value.assumptions.length &&
            !parsed.value.operations.some((operation) => operation.replacementRef) && !!plannerRecordSources(selection.stored)
          const produce = () => (recordOnly ? recordCalculation : calculation).issue(runId, call)
          // Stage the value until the physical root is accepted. The original
          // completed/finish/final witness below still run after this boundary.
          const issued = preparedRoot ? await preparedRoot.run(produce) : await produce()
          if (issued.status !== "ok") return issued
          const observed = scope.observation?.completed()
          if (scope.observation && !observed) return { status: "unavailable", reason: "calculation-observation-incomplete" }
          if (!prepareFinish) return finish(issued.value, observed)
          // Projection/source checks remain a separate observation, with a
          // fresh read root after the producer's root has settled.
          const egress = await prepareFinish()
          return egress ? egress.run(() => finish(issued.value, observed))
            : { status: "unavailable", reason: "calculation-read-root-unavailable" }
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
  const persistAndIssue = async (incoming: Extract<Parameters<Persist>[0], { kind: "scenario" }>, callId: string,
    call: TrustedDomainContext, comparisonReplay?: Parameters<Persist>[3]): Promise<PortResult<{ resultRef: string; calculation: Calculation }>> => {
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
      // The issue producer owns its observation and revalidates it after the
      // post-CAS registration has returned.
      const issued = await issue(saved.value.resultRef, call)
      return issued.status === "ok" ? { status: "ok", value: { resultRef: saved.value.resultRef, calculation: issued.value } } : issued
    } catch { return { status: "unavailable", reason: "calculation-publication-unavailable" } }
    finally { captures.delete(call) }
  }
  const persist: Persist = async (incoming, callId, call, comparisonReplay) => {
    if (incoming.kind !== "scenario") return input.persist(incoming, callId, call, comparisonReplay)
    const published = await persistAndIssue(incoming, callId, call, comparisonReplay)
    return published.status === "ok" ? { status: "ok", value: { resultRef: published.value.resultRef } } : published
  }
  const resolveEvidence = async (ref: BusinessEvidenceRef, call: TrustedDomainContext, cited?: boolean): Promise<BusinessEvidenceResolution> => {
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
      }, cited, true)
      return resolved.status === "ok" && digestSfValue(ref) === digestSfValue(captured) ? resolved.value : unavailable()
    } catch { return unavailable() }
  }
  return { persist, persistAndIssue, issue, resolveEvidence, resolveHistoricalEvidence: historical.resolve, verifyCalculationSources, requests: { read: requests.read } }
}

function plannerRecordSources(stored: StoredScenario): readonly PlannerRecord[] | undefined {
  const refs = [...stored.sourceRefs, ...stored.result.sourceRefs, ...stored.result.costCoverage.evaluatedSourceRefs,
    ...stored.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
  if (!refs.length || !refs.every((ref): ref is PlannerRecord => ref.kind === "record" && ref.target.surface === "planner" && ref.target.recordType === "planner-version")) return undefined
  return refs.filter((ref, index, all) => all.findIndex((other) => digestSfValue(other) === digestSfValue(ref)) === index)
}

/** Conservative preparation shape; this never authenticates a ledger or a calculation. */
function plannerLocalSourcePlan(stored: StoredScenario, baseRef: string): LocalSourcePlan | undefined {
  if (!plannerCalculationClosure(stored)) return undefined
  const records = new Map<string, PlannerRecord>(), calculations = new Map<string, Calculation>()
  const visit = (ref: BusinessEvidenceRef): boolean => {
    if (ref.kind === "record") {
      if (ref.refId !== baseRef) return false
      records.set(digestSfValue(ref), ref)
      return true
    }
    if (ref.kind === "case-event") return ref.target.evidenceRefs.every(visit)
    if (ref.kind === "calculation") {
      const previous = calculations.get(ref.target.runId)
      if (previous && digestSfValue(previous) !== digestSfValue(ref)) return false
      calculations.set(ref.target.runId, ref)
      return ref.target.sourceRefs.every(visit)
    }
    return false
  }
  const refs = [...stored.sourceRefs, ...stored.result.sourceRefs, ...stored.result.costCoverage.evaluatedSourceRefs,
    ...stored.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
  if (!refs.every(visit) || records.size !== 1 || calculations.size > 16) return undefined
  const record = records.values().next().value
  return record ? { record, calculations: [...calculations.values()] } : undefined
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
