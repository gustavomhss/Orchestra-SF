import { AsyncLocalStorage } from "node:async_hooks"
import type { CriterionMetric } from "../decisions/criterion-rules.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { CostCoverageBasis, ScenarioComparison, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioCompareRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import { comparePlannerScenarios, plannerComponentDigest } from "./comparison.ts"

export type ResolvedScenario = { result: ScenarioResult; coverageRef: string; basis: CostCoverageBasis; projection: DomainProjection; source: Extract<BusinessEvidenceRef, { kind: "record" }> }
export type PlannerScenarioHost = {
  resolve: (reference: string, context: TrustedDomainContext) => Promise<PortResult<ResolvedScenario>>
  /** One fresh observation of siblings; callers must start a new batch for every later phase. */
  resolveMany?: (references: readonly string[], context: TrustedDomainContext) => Promise<readonly PortResult<ResolvedScenario>[]>
}
export type PlannerCriteriaHost = { evaluate: (request: { scenarioRef: string; baselineRef: string; criterionId: string }, context: TrustedDomainContext) => Promise<PortResult<{ criterionId: string; state: "satisfied" | "failed" | "unknown"; reason: string; ruleRef?: string; evidenceRefs: readonly BusinessEvidenceRef[] }>> }


type ComparisonInput = { host: DomainPortHost; sources: PlannerSourceHost; scenarios: PlannerScenarioHost; criteria?: PlannerCriteriaHost }
type ComparisonFactoryInput = Omit<ComparisonInput, "scenarios"> & { scenarios?: PlannerScenarioHost }
type MetricRequest = Pick<CriterionMetric, "caseRef" | "criterionId" | "ruleRef" | "ruleVersion" | "metricRef" | "scenarioRef" | "baselineRef">
type ConditionedMetric = Pick<CriterionMetric, "value" | "unit" | "period" | "evidenceRefs" | "engineVersion"> & { state: "conditioned" }
export type PlannerCriterionObservation = {
  scenarioRefs: readonly string[]
  resultDigests: readonly string[]
  sources: readonly Extract<BusinessEvidenceRef, { kind: "record" }>[]
  coverage: readonly { coverageRef: string; basisDigest: string; assessmentDigest: string }[]
  metric: ConditionedMetric
}
type ObservationReader = { current: () => boolean; active: WeakMap<TrustedDomainContext, CriterionFrame> }
type ComparisonOwner = { input: ComparisonFactoryInput; current: () => boolean; readers: Set<ObservationReader> }
type CriterionInvocation = {
  owner: ComparisonOwner; readers: readonly ObservationReader[]; usedReaders: Set<ObservationReader>; call: TrustedDomainContext; current: () => boolean
}
type CriterionFrame = {
  invocation: CriterionInvocation; criterionId: string; observation: PlannerCriterionObservation
  active: boolean; claimed: boolean; invalid: boolean; reader?: ObservationReader
}
// Function provenance only. The calculation is created below after the
// canonical producer's second scenario/source observation, never at registration.
const comparisonOwners = new WeakMap<PlannerPort["compareScenarios"], ComparisonOwner>()
const criterionExecution = new AsyncLocalStorage<CriterionFrame | undefined>()

// CI-only observation diagnostics. Never emit a request, authority, value, ref or digest.
function criterionChannelProbe(phase: string, values: Record<string, unknown> = {}) {
  if (process.env.SF_REPORTS_TRACE !== "1") return
  const statuses: Record<string, number> = { ok: 1, denied: 2, stale: 3, unavailable: 4, "needs-input": 5, preview: 6 }
  const fields = Object.entries(values).map(([key, value]) => {
    const numeric = typeof value === "boolean" ? Number(value) : typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : typeof value === "string" ? statuses[value] ?? 0 : 0
    return key.toUpperCase() + "_" + numeric
  }).join("__")
  console.info("SF_REPORTS_TRACE_CRITERION_CHANNEL_" + phase.toUpperCase().replace(/[^A-Z0-9_]/g, "_") + "__" + fields)
}

function methodIdentity(object: object, key: string) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key)
  return descriptor && "value" in descriptor ? descriptor.value : undefined
}
function comparisonIdentity(input: ComparisonFactoryInput) {
  const { host, sources, scenarios, criteria } = input
  const methods: readonly (readonly [object, string])[] = [
    [host, "requestFor"], [host, "revalidate"], [sources, "resolveForecastSource"], [sources, "resolveForecastCoverage"],
    ...(scenarios ? [[scenarios, "resolve"] as const, [scenarios, "resolveMany"] as const] : []),
    ...(criteria ? [[criteria, "evaluate"] as const] : []),
  ]
  const expected = methods.map(([object, key]) => methodIdentity(object, key))
  const supported = methods.every(([object, key], index) => typeof expected[index] === "function" ||
    key === "resolveMany" && !Object.getOwnPropertyDescriptor(object, key))
  return () => supported && input.host === host && input.sources === sources && input.scenarios === scenarios && input.criteria === criteria &&
    methods.every(([object, key], index) => methodIdentity(object, key) === expected[index])
}

/** The actual comparator owns its observation channel. A wrapper does not
 * inherit it, and public compareScenarios never issues a channel. */
export function createPlannerScenarioComparator(input: ComparisonFactoryInput): PlannerPort["compareScenarios"] {
  const owner: ComparisonOwner = { input, current: comparisonIdentity(input), readers: new Set() }
  const compare: PlannerPort["compareScenarios"] = (request, call) => criterionExecution.run(undefined, () =>
    input.scenarios ? compareScenariosObserved({ ...input, scenarios: input.scenarios }, request, call, owner)
      : Promise.resolve({ status: "unavailable", reason: "scenario-comparison-not-connected" }))
  comparisonOwners.set(compare, owner)
  return compare
}

/** Read-only access to a completed calculation, never a proof issuer. No
 * parameter accepts a comparison, numeric metric or caller-supplied token.
 * The consumer must still verify current C08 and granular domain authority. */
export function createPlannerCriterionObservationReader(compare: PlannerPort["compareScenarios"], current: () => boolean) {
  const owner = comparisonOwners.get(compare)
  const reader: ObservationReader = { current, active: new WeakMap() }
  criterionChannelProbe("reader-registration", { registeredOwner: !!owner })
  owner?.readers.add(reader)
  return async (
    request: MetricRequest,
    call: TrustedDomainContext,
    verify: (observation: PlannerCriterionObservation, current: () => boolean) => Promise<boolean | "unsupported">,
  ): Promise<PortResult<ConditionedMetric> | undefined> => {
    if (!owner) { criterionChannelProbe("reader-fallback-no-owner"); return undefined }
    const frame = criterionExecution.getStore()
    const active = reader.active.get(call)
    if (!frame || frame.invocation.owner !== owner || !frame.invocation.readers.includes(reader)) {
      criterionChannelProbe("reader-owner-unavailable", { hasFrame: !!frame, activeOwner: !!active, fallback: !active })
      return active ? { status: "denied", reason: "criterion-observation-owner-unavailable" } : undefined
    }
    const unchanged = () => frame.active && !frame.invalid && frame.invocation.call === call &&
      criterionExecution.getStore() === frame && reader.active.get(call) === frame && frame.invocation.current() && reader.current()
    try {
      if (!unchanged() || frame.claimed || request.criterionId !== frame.criterionId ||
        request.baselineRef !== frame.observation.scenarioRefs[0] || request.scenarioRef !== frame.observation.scenarioRefs[1] ||
        request.metricRef !== "planner:known-subtotal-difference") {
        frame.invalid = true
        return { status: "stale", reason: "criterion-observation-changed" }
      }
      criterionChannelProbe("claimed")
      frame.claimed = true
      frame.reader = reader
      frame.invocation.usedReaders.add(reader)
      const expectedRequest = digestSfValue(request)
      const borrowed = structuredClone(frame.observation)
      const expectedObservation = digestSfValue(borrowed)
      const pinned = () => unchanged() && digestSfValue(request) === expectedRequest && digestSfValue(borrowed) === expectedObservation && unchanged()
      const verificationStarted = performance.now()
      const verified = await verify(borrowed, pinned)
      criterionChannelProbe("verification-returned", { durationMs: performance.now() - verificationStarted, accepted: verified === true, unsupported: verified === "unsupported" })
      if (!pinned() || verified !== true && verified !== "unsupported") {
        frame.invalid = true
        return { status: "stale", reason: "criterion-observation-changed" }
      }
      // Unsupported dependency kinds retain the full producer. Observed drift
      // is false/stale; it cannot use this unsupported-input branch.
      if (verified === "unsupported") { criterionChannelProbe("reader-fallback-unsupported"); return undefined }
      criterionChannelProbe("consumed")
      return { status: "ok", value: structuredClone(frame.observation.metric) }
    } catch {
      frame.invalid = true
      return { status: "stale", reason: "criterion-observation-changed" }
    }
  }
}

function criterionInvocation(owner: ComparisonOwner | undefined, input: ComparisonInput, incoming: ScenarioCompareRequest, request: ScenarioCompareRequest, call: TrustedDomainContext): CriterionInvocation | undefined {
  if (!owner || call.kind !== "ui" || !request.criteria.length || !owner.current()) {
    criterionChannelProbe("invocation-ineligible", { registeredOwner: !!owner, ui: call.kind === "ui", criterionCount: request.criteria.length })
    return undefined
  }
  const readers = [...owner.readers].filter((reader) => reader.current())
  criterionChannelProbe("reader-eligibility", { registeredReaders: owner.readers.size, supportedReaders: readers.length })
  if (!readers.length) return undefined
  const transport = input.host.requestFor(call)
  if (!transport || transport.signal.aborted) return undefined
  const binding = call.binding, lease = call.lease
  const bindingDigest = digestSfValue([call.kind, binding])
  const requestDigest = digestSfValue(incoming)
  const transportDigest = () => digestSfValue([transport.url, transport.method, [...transport.headers.entries()]])
  const originalTransport = transportDigest()
  criterionChannelProbe("invocation-ready", { readerCount: readers.length })
  return { owner, readers, usedReaders: new Set(), call, current: () => owner.current() && call.kind === "ui" && call.binding === binding && call.lease === lease &&
    digestSfValue([call.kind, call.binding]) === bindingDigest && digestSfValue(incoming) === requestDigest &&
    input.host.requestFor(call) === transport && !transport.signal.aborted && transportDigest() === originalTransport }
}

function conditionedObservation(request: ScenarioCompareRequest, values: readonly ResolvedScenario[], comparison: ScenarioComparison, call: TrustedDomainContext): PlannerCriterionObservation | undefined {
  if (comparison.comparisonStatus !== "conditioned" || comparison.completeDifference !== null ||
    comparison.knownDifference === null || !Number.isFinite(comparison.knownDifference) || values.length !== 2 ||
    values.some((value) => value.result.comparisonStatus !== "conditioned" || value.result.total !== null ||
      value.projection.context.surface !== "planner" || value.source.target.surface !== "planner" || value.source.target.recordType !== "planner-version" ||
      value.projection.engineVersion !== "planner-runtime-v1" || value.projection.context.currency !== value.result.currency ||
      digestSfValue(value.projection.context.period) !== digestSfValue(value.result.horizon) ||
      value.projection.context.installationId !== call.binding.installationId || value.projection.context.projectId !== call.binding.projectId ||
      value.projection.context.principalRef !== call.binding.principalRef || value.projection.context.policyVersion !== call.binding.policyVersion ||
      value.projection.context.accessRevision !== call.binding.accessRevision || value.result.sourceRefs.some((ref) => ref.kind !== "record" || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version"))) return undefined
  const sources = values.map((value) => value.source)
  const evidenceRefs = values.flatMap((value) => value.result.sourceRefs)
    .filter((ref, index, all) => all.findIndex((entry) => entry.refDigest === ref.refDigest) === index)
  if (new Set(sources.map((ref) => ref.refId)).size !== 2 || evidenceRefs.length !== 2 ||
    evidenceRefs.some((ref) => !sources.some((source) => digestSfValue(source) === digestSfValue(ref)))) return undefined
  return structuredClone({ scenarioRefs: request.scenarioRefs, sources,
    resultDigests: values.map((value) => digestSfValue(value.result)),
    coverage: values.map((value) => ({ coverageRef: value.coverageRef, basisDigest: digestSfValue(value.basis), assessmentDigest: digestSfValue(value.result.costCoverage) })),
    metric: { value: comparison.knownDifference, unit: values[1]!.result.currency, period: values[1]!.result.horizon,
      evidenceRefs, state: "conditioned" as const, engineVersion: values[1]!.projection.engineVersion } })
}

async function evaluateObservedCriterion(
  invocation: CriterionInvocation | undefined, observation: PlannerCriterionObservation | undefined, criterionId: string,
  evaluate: () => ReturnType<PlannerCriteriaHost["evaluate"]>,
): ReturnType<PlannerCriteriaHost["evaluate"]> {
  if (!invocation || !observation) {
    criterionChannelProbe("evaluation-without-frame", { invocation: !!invocation, observation: !!observation })
    return criterionExecution.run(undefined, async () => structuredClone(await evaluate()))
  }
  const frame: CriterionFrame = { invocation, criterionId, observation, active: true, claimed: false, invalid: false }
  criterionChannelProbe("issued", { readerCount: invocation.readers.length })
  for (const reader of invocation.readers) {
    const prior = reader.active.get(invocation.call)
    if (prior) { prior.invalid = true; frame.invalid = true }
    else reader.active.set(invocation.call, frame)
  }
  return criterionExecution.run(frame, async () => {
    try {
      if (frame.invalid || !invocation.current()) return { status: "stale", reason: "criterion-observation-changed" }
      const result = structuredClone(await evaluate())
      return !frame.invalid && invocation.current() && (!frame.reader || frame.reader.current())
        ? result : { status: "stale", reason: "criterion-observation-changed" }
    } finally {
      criterionChannelProbe("frame-closed", { claimed: frame.claimed, invalid: frame.invalid, readerUsed: !!frame.reader })
      frame.active = false
      for (const reader of invocation.readers) if (reader.active.get(invocation.call) === frame) reader.active.delete(invocation.call)
    }
  })
}

/** Resolve current, authorized case results and recheck their sources before returning. */
export function compareScenarios(input: ComparisonInput, incoming: ScenarioCompareRequest, binding: TrustedDomainContext): ReturnType<PlannerPort["compareScenarios"]> {
  return criterionExecution.run(undefined, () => compareScenariosObserved(input, incoming, binding))
}

async function compareScenariosObserved(input: ComparisonInput, incoming: ScenarioCompareRequest, binding: TrustedDomainContext, owner?: ComparisonOwner): ReturnType<PlannerPort["compareScenarios"]> {
  const parsed = decodeSfOperationInput("sf_scenario_compare", incoming)
  if (!parsed.ok) return { status: "needs-input", reason: "invalid-scenario-comparison-input" }
  const request = parsed.value
  if (new Set(request.criteria).size !== request.criteria.length) return { status: "needs-input", reason: "duplicate-criteria" }
  if (request.scenarioRefs.length !== 2 || request.scenarioRefs[0] === request.scenarioRefs[1]) return { status: "needs-input", reason: "two-distinct-scenarios-required" }
  const comparisonStarted = performance.now()
  const phase = (phase: string, values: Record<string, unknown> = {}) => criterionChannelProbe(phase, { elapsedMs: performance.now() - comparisonStarted, criterionCount: request.criteria.length, registeredOwner: !!owner, ...values })
  phase("comparison-begin")
  const invocation = criterionInvocation(owner, input, incoming, request, binding)
  if (!(await input.host.revalidate(binding))) return { status: "denied", reason: "invalid-binding" }
  const resolveScenarios = () => resolvePlannerScenarioBatch(input.scenarios, request.scenarioRefs, binding)
  const resolveFirstStarted = performance.now()
  const resolved = await resolveScenarios()
  phase("resolve-first", { durationMs: performance.now() - resolveFirstStarted })
  const failed = resolved.find((result) => result.status !== "ok")
  if (failed) return failed
  if (resolved[0].status !== "ok" || resolved[1].status !== "ok") return { status: "unavailable", reason: "scenario-unavailable" }
  const values = [resolved[0].value, resolved[1].value]
  let sourcePass = 0
  const validateSources = async () => {
    const pass = ++sourcePass, sourceStarted = performance.now()
    const checks: boolean[] = []
    for (const value of values) {
      if (!value.result.sourceRefs.some((ref) => ref.refDigest === value.source.refDigest) || !value.result.costCoverage.evaluatedSourceRefs.some((ref) => ref.kind === "record" && ref.refDigest === value.source.refDigest)) {
        checks.push(false)
        continue
      }
      const source = structuredClone(await input.sources.resolveForecastSource(value.source.refId, binding))
      const coverage = structuredClone(await input.sources.resolveForecastCoverage(value.coverageRef, binding))
      checks.push(source.status === "ok" && source.value.evidence.refDigest === value.source.refDigest && coverage.status === "ok" && coverage.value.coverageRef === value.coverageRef && digestSfValue(coverage.value.basis) === digestSfValue(value.basis) && digestSfValue(coverage.value.assessment) === digestSfValue(value.result.costCoverage))
    }
    phase("validate-sources", { pass, durationMs: performance.now() - sourceStarted, checked: checks.length, accepted: checks.every(Boolean) })
    return checks
  }
  if ((await validateSources()).some((item) => !item)) return { status: "stale", reason: "scenario-source-or-coverage-changed" }
  const comparison = comparePlannerScenarios({ baselineRef: request.scenarioRefs[0], alternativeRef: request.scenarioRefs[1], baselineCoverageRef: values[0].coverageRef, alternativeCoverageRef: values[1].coverageRef, baseline: values[0].result, alternative: values[1].result, baselineProof: values[0], alternativeProof: values[1] })
  const resolveSecondStarted = performance.now()
  const again = await resolveScenarios()
  phase("resolve-second", { durationMs: performance.now() - resolveSecondStarted })
  if (!(await input.host.revalidate(binding)) || again.some((entry, index) => entry.status !== "ok" || !values[index] || digestSfValue({ ...entry.value, projection: undefined }) !== digestSfValue({ ...values[index], projection: undefined }) || projectionDigest(entry.value.projection) !== projectionDigest(values[index].projection)) || (await validateSources()).some((item) => !item) || !(await input.host.revalidate(binding))) return { status: "stale", reason: "scenario-or-authority-changed" }
  if (!request.criteria.length || comparison.comparisonStatus === "incompatible" || comparison.comparisonStatus === "unavailable") {
    phase("comparison-without-criteria-complete")
    return { status: "ok", value: comparison }
  }
  if (!input.criteria) return { status: "ok", value: { ...comparison, criterionResults: request.criteria.map((criterionId) => ({ criterionId, state: "unknown", reason: "criterion-rule-unavailable" })), unresolvedConditions: [...comparison.unresolvedConditions, "criterion-rules-unavailable"] } }
  const criteria = input.criteria
  const observation = invocation ? conditionedObservation(request, values, comparison, binding) : undefined
  phase("observation-ready", { invocation: !!invocation, supported: !!observation, resultCount: values.length,
    conditionedCount: values.filter((value) => value.result.comparisonStatus === "conditioned" && value.result.total === null).length,
    plannerProjectionCount: values.filter((value) => value.projection.context.surface === "planner" && value.projection.engineVersion === "planner-runtime-v1").length })
  let evaluationPass = 0
  const evaluate = async () => {
    const pass = ++evaluationPass, evaluationStarted = performance.now()
    const results: Awaited<ReturnType<PlannerCriteriaHost["evaluate"]>>[] = []
    // A host may reuse a cached result object; retain this observation before its next call.
    for (const criterionId of request.criteria) results.push(await evaluateObservedCriterion(invocation, observation, criterionId,
      () => criteria.evaluate({ scenarioRef: request.scenarioRefs[1], baselineRef: request.scenarioRefs[0], criterionId }, binding)))
    phase("criteria-evaluated", { pass, durationMs: performance.now() - evaluationStarted, resultCount: results.length, okCount: results.filter((result) => result.status === "ok").length })
    return results
  }
  const evaluated = await evaluate()
  const failure = evaluated.find((item) => item.status !== "ok")
  if (failure) return failure
  if (evaluated.some((item, index) => item.status !== "ok" || item.value.criterionId !== request.criteria[index] || !["satisfied", "failed", "unknown"].includes(item.value.state) || typeof item.value.reason !== "string" || !item.value.reason.trim())) return { status: "unavailable", reason: "criterion-result-invalid" }
  const checked = await evaluate()
  const resolveFinalStarted = performance.now()
  const finalScenarios = await resolveScenarios()
  phase("resolve-final", { durationMs: performance.now() - resolveFinalStarted })
  if (checked.some((item, index) => digestSfValue(item) !== digestSfValue(evaluated[index])) || finalScenarios.some((entry, index) => entry.status !== "ok" || !values[index] || digestSfValue({ ...entry.value, projection: undefined }) !== digestSfValue({ ...values[index], projection: undefined }) || projectionDigest(entry.value.projection) !== projectionDigest(values[index].projection)) || !(await input.host.revalidate(binding)) || (await validateSources()).some((item) => !item) || !(await input.host.revalidate(binding))) return { status: "stale", reason: "criterion-or-authority-changed" }
  if (invocation && observation && (!invocation.current() || [...invocation.usedReaders].some((reader) => !reader.current()))) return { status: "stale", reason: "criterion-observation-changed" }
  phase("comparison-complete", { consumedReaders: invocation?.usedReaders.size ?? 0 })
  const criterionResults = evaluated.flatMap((item) => item.status === "ok" ? [{ criterionId: item.value.criterionId, state: item.value.state, reason: item.value.reason }] : [])
  return { status: "ok", value: { ...comparison, criterionResults, unresolvedConditions: criterionResults.some((item) => item.state === "unknown") ? [...comparison.unresolvedConditions, "criterion-rules-unavailable"] : comparison.unresolvedConditions } }
}

export function projectionDigest(projection: DomainProjection) {
  return digestSfValue({ ...projection, context: { ...projection.context, sourceRefs: projection.context.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) }, components: plannerComponentDigest(projection.components) })
}

/** The optional batch belongs to this observation only; no result survives into another call. */
export async function resolvePlannerScenarioBatch(scenarios: PlannerScenarioHost, incoming: readonly string[], context: TrustedDomainContext): Promise<PortResult<ResolvedScenario>[]> {
  const references = [...incoming]
  if (scenarios.resolveMany) {
    const observed = structuredClone(await scenarios.resolveMany([...references], context))
    if (observed.length !== references.length) return references.map(() => ({ status: "unavailable", reason: "scenario-batch-invalid" }))
    return observed.map((entry) => structuredClone(entry))
  }
  const snapshots: PortResult<ResolvedScenario>[] = []
  for (const reference of references) snapshots.push(structuredClone(await scenarios.resolve(reference, context)))
  return snapshots
}
