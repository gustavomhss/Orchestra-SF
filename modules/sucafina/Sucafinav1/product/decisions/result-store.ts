import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { SfOperationOutputMap } from "../contracts/outputs.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import { historicalCalculationMatches } from "./calculation-history.ts"
import type { HistoricalCalculationRead } from "./calculation-history.ts"

type ResultMap = { scenario: SfOperationOutputMap["sf_scenario_simulate"]; comparison: SfOperationOutputMap["sf_scenario_compare"]; sensitivity: SfOperationOutputMap["sf_sensitivity_evaluate"]; portfolio: SfOperationOutputMap["sf_portfolio_evaluate"] }
type Result = { [K in keyof ResultMap]: { kind: K; result: ResultMap[K] } }[keyof ResultMap]
type CaseRef = { id: string; incarnation: string; version: number }
export type StoredDecisionResult = Result & { schema: "sf-decision-result-v1"; resultRef: string; caseRef: CaseRef; principalRef: string; accessRevision: string; policyVersion: string; requestDigest: string; resultDigest: string; sourceRefs: readonly BusinessEvidenceRef[]; createdAt: string }
type Write = Result & { caseRef: CaseRef; requestDigest: string; sourceRefs: readonly BusinessEvidenceRef[]; idempotencyKey: string }

type HistoricalScenarioReader = (request: { resultRef: string }, context: TrustedDomainContext) => Promise<PortResult<StoredDecisionResult>>
type HistoricalScenarioBatch = (references: readonly string[], context: TrustedDomainContext) => Promise<PortResult<StoredDecisionResult>[]>
// Function provenance only. No result, source observation or authorization survives a call.
const historicalScenarioBatches = new WeakMap<HistoricalScenarioReader, HistoricalScenarioBatch>()

/** Internal sibling reader for stored-scenarios. Only C08 read envelopes are grouped;
 * per-result source checks remain independent, and the caller retains its complete
 * case/projection/final-case observations. This is not an atomic domain-source read. */
export async function readHistoricalScenarios(
  store: Pick<ReturnType<typeof createSfDecisionResultStore>, "read"> & { readHistoricalScenario?: HistoricalScenarioReader },
  incoming: readonly string[],
  context: TrustedDomainContext,
): Promise<PortResult<StoredDecisionResult>[]> {
  const references = [...incoming]
  if (!references.length) return []
  const scalar = store.readHistoricalScenario
  const batch = scalar && historicalScenarioBatches.get(scalar)
  if (batch) {
    const observed = await batch(references, context)
    // A facade that replaces the scalar during an await cannot inherit a grant
    // from the old reader. Never fall back after starting this observation.
    if (store.readHistoricalScenario !== scalar) return references.map(() => ({ status: "denied", reason: "historical-reader-changed" }))
    return observed
  }
  const observed: PortResult<StoredDecisionResult>[] = []
  // Overriding scalar readers may add checks/interleavings. Forward every
  // occurrence in the original order; even duplicates keep their callbacks.
  for (const resultRef of references) observed.push(structuredClone(await (store.readHistoricalScenario
    ? store.readHistoricalScenario({ resultRef }, context)
    : store.read({ resultRef, kind: "scenario" }, context))))
  return observed
}

export function createSfDecisionResultStore(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  verifySources: (value: Result, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
  /** The host supplies the canonical producer replay with ancestry tracking; freshness alone cannot authenticate nested calculations. */
  verifyCalculationSources?: (value: Extract<StoredDecisionResult, { kind: "scenario" }>, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
  createId: () => string
  now: () => string
}) {
  const authorizeCase = async (value: DecisionCase, context: TrustedDomainContext) => {
    try {
      const candidate = structuredClone(value)
      const expected = digestSfValue(candidate)
      return await input.authorizeCase(candidate, context) && digestSfValue(candidate) === expected
    } catch { return false }
  }
  const verifySources = async (value: Result, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
    try {
      const candidate = structuredClone(value)
      const sources = structuredClone(refs)
      const expected = digestSfValue({ candidate, sources })
      return await input.verifySources(candidate, sources, context) && digestSfValue({ candidate, sources }) === expected
    } catch { return false }
  }
  const verifyCalculationSources = async (value: Extract<StoredDecisionResult, { kind: "scenario" }>, context: TrustedDomainContext) => {
    try {
      const candidate = structuredClone(value)
      const sources = structuredClone(calculationSources(value))
      const expected = digestSfValue({ candidate, sources })
      return !!input.verifyCalculationSources && await input.verifyCalculationSources(candidate, sources, context) && digestSfValue({ candidate, sources }) === expected
    } catch { return false }
  }
  const readResult = async (incoming: { resultRef: string; kind: keyof ResultMap }, context: TrustedDomainContext, historical: boolean, calculation = false, ledger?: HistoricalCalculationRead): Promise<PortResult<StoredDecisionResult>> => {
    const request = structuredClone(incoming)
    const historicalRequest = ledger ? structuredClone(ledger) : undefined
    const source = input.host.requestFor(context)
    if (!source || !request.resultRef.trim() || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "invalid-authority" }
    const current = await input.state.read(source, "cases", (state, authority) => {
      if (!sameAuthority(authority, context)) return undefined
      const stored = (state as typeof state & { decisionResults?: Record<string, StoredDecisionResult> }).decisionResults?.[request.resultRef]
      return stored ? { stored, current: state.cases[stored.caseRef.id] } : undefined
    }).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
    if (current.status !== "ok") return { status: current.status === "preview" ? "unavailable" : current.status, reason: "result-unavailable" }
    const value = structuredClone(current.value)
    if (!value || value.stored.kind !== request.kind || !validResult(value.stored) || value.stored.resultRef !== request.resultRef || value.stored.resultDigest !== digestSfValue(value.stored.result)) return { status: "unavailable", reason: "result-unavailable" }
    if (historicalRequest && !historicalCalculationMatches(value.current, value.stored, historicalRequest, context)) return { status: "denied", reason: "historical-calculation-unavailable" }
    if (calculation && (value.stored.kind !== "scenario" || !input.verifyCalculationSources && calculationSources(value.stored).some((ref) => ref.kind !== "record"))) return { status: "unavailable", reason: "calculation-source-unsupported" }
    if (!allowedCase(value.current, value.stored.caseRef, context, historical) || !await authorizeCase(value.current!, context).catch(() => false) || !await verifySources(value.stored, calculation && value.stored.kind === "scenario" ? calculationSources(value.stored) : value.stored.sourceRefs, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "result-access-unavailable" }
    if (calculation && value.stored.kind === "scenario" && input.verifyCalculationSources && !await verifyCalculationSources(value.stored, context).catch(() => false)) return { status: "unavailable", reason: "calculation-source-unproven" }
    const again = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { current: state.cases[value.stored.caseRef.id], stored: (state as typeof state & { decisionResults?: Record<string, StoredDecisionResult> }).decisionResults?.[request.resultRef] } : undefined).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
    if (again.status !== "ok") return { status: "unavailable", reason: "result-unavailable" }
    const latest = structuredClone(again.value)
    if (historicalRequest && (!latest?.stored || !historicalCalculationMatches(latest.current, latest.stored, historicalRequest, context) || digestSfValue(latest.current) !== digestSfValue(value.current))) return { status: "denied", reason: "historical-calculation-changed" }
    if (!latest || !allowedCase(latest.current, value.stored.caseRef, context, historical) || latest.current?.version !== value.current?.version || !latest.stored || digestSfValue(latest.stored) !== digestSfValue(value.stored) || !await authorizeCase(latest.current!, context).catch(() => false) || !await verifySources(latest.stored, calculation && latest.stored.kind === "scenario" ? calculationSources(latest.stored) : latest.stored.sourceRefs, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "result-access-unavailable" }
    if (calculation && latest.stored.kind === "scenario" && input.verifyCalculationSources && !await verifyCalculationSources(latest.stored, context).catch(() => false)) return { status: "unavailable", reason: "calculation-source-unproven" }
    if (source.signal.aborted || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "result-access-unavailable" }
    // Source replay can await domain reads. Observe the same authorized case and result
    // after that last callback, under C08's read fence, before releasing the value.
    const final = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { current: state.cases[value.stored.caseRef.id], stored: (state as typeof state & { decisionResults?: Record<string, StoredDecisionResult> }).decisionResults?.[request.resultRef] } : undefined).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
    if (final.status !== "ok") return { status: "unavailable", reason: "result-unavailable" }
    const observed = structuredClone(final.value)
    if (historicalRequest && (!observed?.stored || !historicalCalculationMatches(observed.current, observed.stored, historicalRequest, context) || digestSfValue(observed.current) !== digestSfValue(latest.current))) return { status: "denied", reason: "historical-calculation-changed" }
    if (!observed || !allowedCase(observed.current, value.stored.caseRef, context, historical) || digestSfValue(observed.current) !== digestSfValue(latest.current) || !observed.stored || digestSfValue(observed.stored) !== digestSfValue(latest.stored) || source.signal.aborted || input.host.requestFor(context) !== source) return { status: "denied", reason: "result-access-unavailable" }
    return { status: "ok", value: structuredClone(observed.stored) }
  }
  const read = (request: { resultRef: string; kind: keyof ResultMap }, context: TrustedDomainContext) => readResult(request, context, false)
  const readForCalculation = (request: { resultRef: string }, context: TrustedDomainContext) => readResult({ resultRef: request.resultRef, kind: "scenario" }, context, false, true)
  const readHistoricalCalculation = (request: HistoricalCalculationRead, context: TrustedDomainContext) => readResult({ resultRef: request.reference.target.runId, kind: "scenario" }, context, true, true, request)
  const readHistoricalScenario = (request: { resultRef: string }, context: TrustedDomainContext) => readResult({ resultRef: request.resultRef, kind: "scenario" }, context, true)

  const readHistoricalScenarioBatch: HistoricalScenarioBatch = async (incoming, context) => {
    const references = [...incoming]
    if (!references.length) return []
    const host = input.host
    const requestFor = host.requestFor
    const revalidate = host.revalidate
    const source = requestFor.call(host, context)
    const binding = context.binding
    const lease = context.lease
    const authorityDigest = digestSfValue({ kind: context.kind, binding })
    const requestFingerprint = () => {
      const headers: [string, string][] = []
      source?.headers.forEach((value, name) => headers.push([name, value]))
      return digestSfValue({ method: source?.method, url: source?.url, headers: headers.sort(([left], [right]) => left.localeCompare(right)) })
    }
    const requestDigest = requestFingerprint()
    const sameRequest = () => !!source && !source.signal.aborted && input.host === host && host.requestFor === requestFor && host.revalidate === revalidate && requestFor.call(host, context) === source && context.binding === binding && context.lease === lease && digestSfValue({ kind: context.kind, binding: context.binding }) === authorityDigest && requestFingerprint() === requestDigest
    const failures: (PortResult<never> | undefined)[] = references.map(() => undefined)
    const denied = (): PortResult<never> => ({ status: "denied", reason: "result-access-unavailable" })
    const unavailable = (): PortResult<never> => ({ status: "unavailable", reason: "result-unavailable" })
    const remaining = () => failures.some((failure) => failure === undefined)
    const failRemaining = (failure: PortResult<never>) => references.map((_, index) => failures[index] ?? failure)
    // Keep the singleton reader's admission callback for every occurrence.
    for (const [index, reference] of references.entries()) {
      if (!source || typeof reference !== "string" || !reference.trim() || !await input.host.revalidate(context).catch(() => false))
        failures[index] = { status: "denied", reason: "invalid-authority" }
    }
    if (!source || !remaining()) return failRemaining(denied())
    const observe = () => input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context)
      ? references.map((reference, index) => {
        if (failures[index]) return undefined
        const stored = state.decisionResults?.[reference]
        return stored ? { stored, current: state.cases[stored.caseRef.id] } : undefined
      }) : undefined).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
    const first = await observe()
    if (first.status !== "ok") return failRemaining({ status: first.status === "preview" ? "unavailable" : first.status, reason: "result-unavailable" })
    const values = structuredClone(first.value)
    for (const [index, reference] of references.entries()) {
      if (failures[index]) continue
      const value = values?.[index]
      if (!value || value.stored.kind !== "scenario" || !validResult(value.stored) || value.stored.resultRef !== reference || value.stored.resultDigest !== digestSfValue(value.stored.result)) {
        failures[index] = unavailable()
        continue
      }
      if (!allowedCase(value.current, value.stored.caseRef, context, true) || !await authorizeCase(value.current!, context).catch(() => false) || !await verifySources(value.stored, value.stored.sourceRefs, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) failures[index] = denied()
    }
    if (!remaining()) return failRemaining(denied())
    // This is a second C08 snapshot, after every initial per-result callback.
    const again = await observe()
    if (again.status !== "ok") return failRemaining(unavailable())
    const latest = structuredClone(again.value)
    for (const index of references.keys()) {
      if (failures[index]) continue
      const value = values?.[index]
      const current = latest?.[index]
      if (!value || !current || !allowedCase(current.current, value.stored.caseRef, context, true) || current.current?.version !== value.current?.version || digestSfValue(current.stored) !== digestSfValue(value.stored) || !await authorizeCase(current.current!, context).catch(() => false) || !await verifySources(current.stored, current.stored.sourceRefs, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) {
        failures[index] = denied()
        continue
      }
      // Preserve the original pre-final authority callback for each result too.
      if (source.signal.aborted || !await input.host.revalidate(context).catch(() => false)) failures[index] = denied()
    }
    if (!remaining()) return failRemaining(denied())
    // Finish all external source/authority callbacks before the common final
    // namespace fence. Each surviving item still compares its own entire case
    // and stored result against the second observation.
    const final = await observe()
    if (final.status !== "ok") return failRemaining(unavailable())
    const observed = structuredClone(final.value)
    if (!sameRequest()) return failRemaining(denied())
    return references.map((_, index): PortResult<StoredDecisionResult> => {
      const failure = failures[index]
      if (failure) return failure
      const value = values?.[index]
      const previous = latest?.[index]
      const current = observed?.[index]
      if (!value || !previous || !current || !allowedCase(current.current, value.stored.caseRef, context, true) || digestSfValue(current.current) !== digestSfValue(previous.current) || digestSfValue(current.stored) !== digestSfValue(previous.stored)) return denied()
      return { status: "ok", value: structuredClone(current.stored) }
    })
  }
  historicalScenarioBatches.set(readHistoricalScenario, readHistoricalScenarioBatch)
  const readByRequest = async (incoming: { caseRef: CaseRef; kind: keyof ResultMap; idempotencyKey: string; requestDigest: string }, context: TrustedDomainContext): Promise<PortResult<{ state: "found"; result: StoredDecisionResult } | { state: "not-found" }>> => {
    const request = structuredClone(incoming)
    const source = input.host.requestFor(context)
    if (!source || !request.idempotencyKey.trim() || !/^[a-f0-9]{64}$/.test(request.requestDigest) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "invalid-authority" }
    const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { decision: state.cases[request.caseRef.id], prior: state.transactions[JSON.stringify([authority.principalRef, "cases", request.caseRef.id, `decision-result:${request.idempotencyKey}`])] } : undefined).catch(() => undefined)
    if (!current || current.status !== "ok" || !current.value) return { status: "unavailable", reason: "result-unavailable" }
    if (!allowedCase(current.value.decision, request.caseRef, context) || !await authorizeCase(current.value.decision!, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "result-access-unavailable" }
    if (!current.value.prior) {
      const again = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { decision: state.cases[request.caseRef.id], prior: state.transactions[JSON.stringify([authority.principalRef, "cases", request.caseRef.id, `decision-result:${request.idempotencyKey}`])] } : undefined).catch(() => undefined)
      if (!again || again.status !== "ok" || !again.value || again.value.prior || !allowedCase(again.value.decision, request.caseRef, context) || !await authorizeCase(again.value.decision!, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "stale", reason: "result-state-changed" }
      return { status: "ok", value: { state: "not-found" } }
    }
    const saved = current.value.prior.value
    if (!saved || typeof saved !== "object" || !("resultRef" in saved) || typeof saved.resultRef !== "string" || !("requestDigest" in saved) || saved.requestDigest !== request.requestDigest || !("kind" in saved) || saved.kind !== request.kind || current.value.prior.targetIncarnation !== request.caseRef.incarnation) return { status: "conflict", reason: "idempotency-content-changed" }
    const result = await read({ resultRef: saved.resultRef, kind: request.kind }, context)
    if (result.status !== "ok") return result
    if (result.value.requestDigest !== request.requestDigest || digestSfValue(result.value.caseRef) !== digestSfValue(request.caseRef) || digestSfValue(result.value) !== digestSfValue(saved)) return { status: "conflict", reason: "idempotency-content-changed" }
    return { status: "ok", value: { state: "found", result: result.value } }
  }
  const write = async (incoming: Write, context: TrustedDomainContext): Promise<PortResult<StoredDecisionResult>> => {
    const request = structuredClone(incoming)
    if (!validResult(request) || !/^[a-f0-9]{64}$/.test(request.requestDigest) || !request.idempotencyKey.trim() || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version) || request.caseRef.version < 0) return { status: "needs-input", reason: "invalid-result" }
    const source = input.host.requestFor(context)
    if (!source || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "invalid-authority" }
    const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
    if (current.status !== "ok") return { status: current.status === "preview" ? "unavailable" : current.status, reason: "case-unavailable" }
    if (!allowedCase(current.value, request.caseRef, context) || !await authorizeCase(current.value!, context).catch(() => false) || !await verifySources(request, request.sourceRefs, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "result-access-unavailable" }
    const id = input.createId()
    if (!id.trim()) return { status: "unavailable", reason: "result-identity-unavailable" }
    const stored = { schema: "sf-decision-result-v1" as const, resultRef: `decision-result:${encodeURIComponent(id)}`, caseRef: request.caseRef, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, requestDigest: request.requestDigest, resultDigest: digestSfValue(request.result), sourceRefs: request.sourceRefs, createdAt: input.now(), kind: request.kind, result: request.result } as StoredDecisionResult
    const saved = await input.state.transaction(source, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey: `decision-result:${request.idempotencyKey}`, commandDigest: digestSfValue({ kind: request.kind, result: request.result, caseRef: request.caseRef, requestDigest: request.requestDigest, sourceRefs: request.sourceRefs }) }, async (state, authority) => {
      if (!sameAuthority(authority, context) || !allowedCase(state.cases[request.caseRef.id], request.caseRef, context)) return { commit: false, value: null }
      const results = state as typeof state & { decisionResults?: Record<string, StoredDecisionResult> }
      results.decisionResults ??= {}
      if (results.decisionResults[stored.resultRef]) return { commit: false, value: null }
      results.decisionResults[stored.resultRef] = structuredClone(stored)
      return { commit: true, value: stored }
    }).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
    if (saved.status !== "ok") return { status: saved.status === "preview" ? "conflict" : saved.status, reason: "result-write-unavailable" }
    if (!saved.value) return { status: "conflict", reason: "result-identity-conflict" }
    return read({ resultRef: saved.value.resultRef, kind: request.kind }, context)
  }
  return { write, read, readForCalculation, readHistoricalCalculation, readHistoricalScenario, readByRequest }
}

function calculationSources(value: Extract<StoredDecisionResult, { kind: "scenario" }>) {
  return [...value.sourceRefs, ...value.result.sourceRefs, ...value.result.costCoverage.evaluatedSourceRefs, ...value.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)].filter((ref, index, refs) => refs.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
}

function sameAuthority(authority: { principalRef: string; policyVersion: string; accessRevision: string }, context: TrustedDomainContext) {
  return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision
}

function allowedCase(value: DecisionCase | undefined, ref: CaseRef, context: TrustedDomainContext, historical = false) {
  return !!value && value.id === ref.id && value.incarnation === ref.incarnation && (historical ? value.version >= ref.version : value.version === ref.version) && value.participants.includes(context.binding.principalRef) && (context.kind !== "native" || (context.binding.caseId === ref.id && context.binding.caseIncarnation === ref.incarnation && context.binding.caseVersion === value.version))
}

function validResult(value: Result) {
  if (value.kind === "scenario") return decodeSfOperationOutput("sf_scenario_simulate", value.result).ok
  if (value.kind === "comparison") return decodeSfOperationOutput("sf_scenario_compare", value.result).ok
  if (value.kind === "sensitivity") return decodeSfOperationOutput("sf_sensitivity_evaluate", value.result).ok
  if (value.kind === "portfolio") return decodeSfOperationOutput("sf_portfolio_evaluate", value.result).ok
  return false
}
