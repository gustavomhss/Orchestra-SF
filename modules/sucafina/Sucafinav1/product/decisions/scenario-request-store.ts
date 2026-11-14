import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { createSfDecisionResultStore, StoredDecisionResult } from "./result-store.ts"
import type { HistoricalCalculationRead } from "./calculation-history.ts"

type StoredScenarioRequest = { schema: "sf-scenario-request-v1"; resultRef: string; caseRef: { id: string; incarnation: string; version: number }; request: ScenarioRequest; requestDigest: string; resultDigest: string; engineVersion: string; recordDigest: string }
const key = (resultRef: string) => `sf:proposal-coverage:scenario-request:${digestSfValue(resultRef)}`
const digest = (value: StoredScenarioRequest) => digestSfValue(Object.fromEntries(Object.entries(value).filter(([name]) => name !== "recordDigest")))

/** Stores the actual canonical input of a producer-created scenario result, never an inferred request. */
export function createScenarioRequestStore(input: {
  state: SfProductStatePort
  results: ReturnType<typeof createSfDecisionResultStore>
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authorizeCase: (decision: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizeProducer: (request: ScenarioRequest, resultRef: string, engineVersion: string, context: TrustedDomainContext) => Promise<boolean>
  /** Nested input is admitted only with the canonical producer's source-closure and ancestry verifier. */
  verifyRequestSources?: (request: ScenarioRequest, result: Extract<StoredDecisionResult, { kind: "scenario" }>, context: TrustedDomainContext) => Promise<boolean>
  verifySnapshot: (snapshot: Snapshot, record: StoredScenarioRequest, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  writes: WeakSet<object>
}) {
  const readRequest = async (resultRef: string, context: TrustedDomainContext, incoming?: HistoricalCalculationRead): Promise<PortResult<StoredScenarioRequest>> => {
    try {
      const historical = incoming ? structuredClone(incoming) : undefined
      const readResult = () => historical ? input.results.readHistoricalCalculation(historical, context) : input.results.readForCalculation({ resultRef }, context)
      const source = input.host.requestFor(context)
      if (!source || !resultRef.trim() || !await input.host.revalidate(context)) return { status: "denied", reason: "scenario-request-access-unavailable" }
      const loaded = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[key(resultRef)] : undefined)
      if (loaded.status !== "ok" || !loaded.value || typeof loaded.value !== "object") return { status: "unavailable", reason: "scenario-request-unavailable" }
      const record = structuredClone(loaded.value) as StoredScenarioRequest
      if (!decodeSfOperationInput("sf_scenario_simulate", record.request).ok || !input.verifyRequestSources && (record.request.assumptions.some((item) => item.evidenceRefs.some((ref) => ref.kind !== "record")) || record.request.operations.some((item) => item.replacementRef !== undefined))) return { status: "unavailable", reason: "calculation-source-unsupported" }
      const result = await readResult()
      if (result.status !== "ok" || result.value.kind !== "scenario") return { status: "unavailable", reason: "scenario-request-unavailable" }
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[result.value.caseRef.id] : undefined)
      const decision = current.status === "ok" ? structuredClone(current.value) : undefined
      const expectedCase = historical?.caseRef ?? record.caseRef
      if (record.schema !== "sf-scenario-request-v1" || record.resultRef !== resultRef || record.recordDigest !== digest(record) || !decodeSfOperationInput("sf_scenario_simulate", record.request).ok || record.requestDigest !== digestSfValue(record.request) || record.requestDigest !== result.value.requestDigest || record.resultDigest !== result.value.resultDigest || digestSfValue(record.caseRef) !== digestSfValue(result.value.caseRef) || !record.engineVersion.trim() || historical && record.engineVersion !== historical.reference.target.engineVersion || !decision || decision.id !== expectedCase.id || decision.version !== expectedCase.version || decision.incarnation !== expectedCase.incarnation || !decision.participants.includes(context.binding.principalRef) || !await authorizeCase(decision, context)) return { status: "unavailable", reason: "scenario-request-unavailable" }
      if (input.verifyRequestSources && !await verifyRequestSources(record.request, result.value, context)) return { status: "unavailable", reason: "calculation-request-sources-unproven" }
      const again = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[key(resultRef)] : undefined)
      const resultAgain = await readResult()
      const caseAgain = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[result.value.caseRef.id] : undefined)
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(record) || resultAgain.status !== "ok" || digestSfValue(resultAgain.value) !== digestSfValue(result.value) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "scenario-request-changed" }
      if (caseAgain.status !== "ok" || !caseAgain.value || digestSfValue(caseAgain.value) !== digestSfValue(decision) || !await authorizeCase(caseAgain.value, context)) return { status: "stale", reason: "scenario-request-case-changed" }
      if (input.verifyRequestSources && (resultAgain.value.kind !== "scenario" || !await verifyRequestSources(record.request, resultAgain.value, context) || source.signal.aborted || !await input.host.revalidate(context))) return { status: "unavailable", reason: "calculation-request-sources-unproven" }
      // Request-source replay can await work after caseAgain. Reauthorize both
      // namespaces, then fence the request, result and case in one final C08 read.
      const finalRecord = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[key(resultRef)] : undefined)
      if (finalRecord.status !== "ok" || digestSfValue(finalRecord.value) !== digestSfValue(record)) return { status: "stale", reason: "scenario-request-changed" }
      const final = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { decision: state.cases[result.value.caseRef.id], result: state.decisionResults?.[resultRef], record: state.preferences[key(resultRef)] } : undefined)
      if (final.status !== "ok" || !final.value || source.signal.aborted) return { status: "stale", reason: "scenario-request-changed" }
      if (!final.value.decision || digestSfValue(final.value.decision) !== digestSfValue(decision)) return { status: "stale", reason: "scenario-request-case-changed" }
      if (digestSfValue(final.value.record) !== digestSfValue(record) || digestSfValue(final.value.result) !== digestSfValue(resultAgain.value)) return { status: "stale", reason: "scenario-request-changed" }
      return { status: "ok", value: structuredClone(record) }
    } catch { return { status: "unavailable", reason: "scenario-request-unavailable" } }
  }
  const authorizeCase = async (decision: DecisionCase, context: TrustedDomainContext) => {
    const value = structuredClone(decision)
    const expected = digestSfValue(value)
    return await input.authorizeCase(value, context) && digestSfValue(value) === expected
  }
  const verifyRequestSources = async (request: ScenarioRequest, stored: Extract<StoredDecisionResult, { kind: "scenario" }>, context: TrustedDomainContext) => {
    const candidate = { request: structuredClone(request), stored: structuredClone(stored) }
    const expected = digestSfValue(candidate)
    return !!input.verifyRequestSources && await input.verifyRequestSources(candidate.request, candidate.stored, context) && digestSfValue(candidate) === expected
  }
  const read = (resultRef: string, context: TrustedDomainContext) => readRequest(resultRef, context)
  const readHistorical = (request: HistoricalCalculationRead, context: TrustedDomainContext) => readRequest(request.reference.target.runId, context, request)
  const register = async (incoming: { resultRef: string; request: ScenarioRequest; engineVersion: string }, context: TrustedDomainContext): Promise<PortResult<StoredScenarioRequest>> => {
    try {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (!source || !operation || !request.engineVersion.trim() || !decodeSfOperationInput("sf_scenario_simulate", request.request).ok || !await input.authorizeProducer(request.request, request.resultRef, request.engineVersion, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "scenario-request-access-unavailable" }
      const result = await input.results.read({ resultRef: request.resultRef, kind: "scenario" }, context)
      if (result.status !== "ok") return result
      if (result.value.kind !== "scenario" || result.value.requestDigest !== digestSfValue(request.request)) return { status: "conflict", reason: "scenario-request-mismatch" }
      const cases = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[result.value.caseRef.id] : undefined)
      const preferences = await input.state.read(source, "preferences", (_state, authority) => sameAuthority(authority, context))
      if (cases.status !== "ok" || !cases.value || cases.value.version !== result.value.caseRef.version || cases.value.incarnation !== result.value.caseRef.incarnation || !cases.value.participants.includes(context.binding.principalRef) || !await input.authorizeCase(cases.value, context) || preferences.status !== "ok" || !preferences.value) return { status: "denied", reason: "scenario-request-access-unavailable" }
      const value = { schema: "sf-scenario-request-v1" as const, resultRef: request.resultRef, caseRef: result.value.caseRef, request: request.request, requestDigest: result.value.requestDigest, resultDigest: result.value.resultDigest, engineVersion: request.engineVersion, recordDigest: "" }
      const record = { ...value, recordDigest: digest(value) }
      const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
        const actual = state.cases[record.caseRef.id]
        const stored = state.decisionResults?.[record.resultRef]
        const previous = state.preferences[key(record.resultRef)]
        if (!sameAuthority(authority, context) || !actual || actual.incarnation !== record.caseRef.incarnation || actual.version !== record.caseRef.version || !actual.participants.includes(context.binding.principalRef) || !stored || digestSfValue(stored) !== digestSfValue(result.value) || previous && digestSfValue(previous) !== digestSfValue(record) || !input.verifySnapshot(snapshot, record, context)) return { commit: false, value: null }
        state.preferences[key(record.resultRef)] = record
        return { commit: true, value: record }
      }
      input.writes.add(work)
      const saved = await input.state.transaction(source, { namespace: "preferences", domainSurface: "planner", expectedStorageVersion: preferences.storageVersion, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: cases.storageVersion }], targetRef: record.caseRef.id, targetIncarnation: record.caseRef.incarnation, idempotencyKey: `scenario-request:${operation}`, commandDigest: digestSfValue(record) }, work).finally(() => input.writes.delete(work))
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" || saved.status === "preview" ? "conflict" : "unavailable", reason: "scenario-request-unavailable" }
      return read(record.resultRef, context)
    } catch { return { status: "unavailable", reason: "scenario-request-unavailable" } }
  }
  return { register, read, readHistorical }
}

function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) {
  return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision
}
