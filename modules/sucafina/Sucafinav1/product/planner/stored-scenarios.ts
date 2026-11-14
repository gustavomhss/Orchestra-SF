import { digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCasePort, PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { readHistoricalScenarios } from "../decisions/result-store.ts"
import type { createSfDecisionResultStore, StoredDecisionResult } from "../decisions/result-store.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import type { PlannerScenarioHost, ResolvedScenario } from "./scenario-comparison-port.ts"

type StoredScenario = Extract<StoredDecisionResult, { kind: "scenario" }>
type CaseObservation = Awaited<ReturnType<DecisionCasePort["read"]>>
type PreparedScenario = { reference: string; stored: StoredScenario; caseDigest: string; value: ResolvedScenario }

/** Resolve stored scenarios only when they are exact current, authorized case alternatives. */
export function createStoredPlannerScenarioHost(input: {
  store: ReturnType<typeof createSfDecisionResultStore> & { readHistoricalScenario?: (request: { resultRef: string }, context: TrustedDomainContext) => ReturnType<ReturnType<typeof createSfDecisionResultStore>["read"]> }
  cases: DecisionCasePort
  planner: Pick<PlannerPort, "compareForecast">
  coverageRefFor: (caseRef: { id: string; incarnation: string; version: number }, alternative: { id: string; version: number }) => string
}): PlannerScenarioHost {
  const read = async (references: readonly string[], context: TrustedDomainContext) => {
    const store = input.store
    const observed = await readHistoricalScenarios(store, references, context)
    // A changed facade may add admission checks. Refuse this phase instead of
    // releasing observations made through the earlier store or replaying it.
    if (input.store !== store) return references.map(() => ({ status: "denied" as const, reason: "historical-reader-changed" }))
    return structuredClone(observed)
  }
  const observeCase = async (stored: StoredScenario, observations: Map<string, CaseObservation>, context: TrustedDomainContext) => {
    // Historical producer versions may differ. They remain separate groups, not a refusal.
    const key = digestSfValue(stored.caseRef)
    if (!observations.has(key)) observations.set(key, structuredClone(await input.cases.read({ caseRef: encodeCaseRef(stored.caseRef) }, context)))
    return structuredClone(observations.get(key)!)
  }
  const resolveMany = async (incoming: readonly string[], context: TrustedDomainContext): Promise<PortResult<ResolvedScenario>[]> => {
    const references = [...incoming]
    // Group only this phase's C08 envelopes. Every occurrence still receives
    // its own result/source checks, including repeated refs and scalar facades.
    const stored = await read(references, context)
    const initialCases = new Map<string, CaseObservation>()
    const prepared: PortResult<PreparedScenario>[] = []
    for (const [index, entry] of stored.entries()) {
      if (entry.status !== "ok") { prepared.push(entry); continue }
      if (entry.value.kind !== "scenario") { prepared.push({ status: "unavailable", reason: "scenario-unavailable" }); continue }
      const current = await observeCase(entry.value, initialCases, context)
      if (current.status !== "ok") { prepared.push(current); continue }
      if (current.value.case.id !== entry.value.caseRef.id || current.value.case.incarnation !== entry.value.caseRef.incarnation || current.value.case.version < entry.value.caseRef.version) { prepared.push({ status: "stale", reason: "case-changed" }); continue }
      const caseDigest = digestSfValue(current.value.case)
      const alternatives = current.value.case.alternatives.filter((alternative) => digestSfValue(alternative.scenario) === entry.value.requestDigest && digestSfValue(alternative.result) === entry.value.resultDigest)
      if (alternatives.length !== 1) { prepared.push({ status: "unavailable", reason: "scenario-not-current-case-alternative" }); continue }
      const alternative = alternatives[0]!
      const bases = current.value.case.costCoverageBases.filter((basis) => basis.id === alternative.result.costCoverage.basisId && basis.version === alternative.result.costCoverage.basisVersion)
      const refs = alternative.result.sourceRefs.filter((ref) => ref.kind === "record" && ref.refId === alternative.scenario.baseRef && ref.target.surface === "planner" && ref.target.recordType === "planner-version")
      if (bases.length !== 1 || refs.length !== 1 || refs[0].kind !== "record") { prepared.push({ status: "unavailable", reason: "scenario-proof-unavailable" }); continue }
      const projection = structuredClone(await input.planner.compareForecast({ baseRef: refs[0].refId, candidateRef: refs[0].refId, period: structuredClone(alternative.result.horizon), currency: alternative.result.currency }, context))
      if (projection.status !== "ok") { prepared.push(projection); continue }
      const coverageRef = input.coverageRefFor({ ...entry.value.caseRef, version: current.value.case.version }, structuredClone(alternative))
      if (!coverageRef.trim()) { prepared.push({ status: "unavailable", reason: "scenario-coverage-unavailable" }); continue }
      prepared.push({ status: "ok", value: { reference: references[index]!, stored: entry.value, caseDigest, value: structuredClone({ result: alternative.result, coverageRef, basis: bases[0]!, projection: projection.value.baseline, source: refs[0] }) } })
    }
    const checked: PortResult<PreparedScenario>[] = []
    const rereadReferences = prepared.flatMap((entry) => entry.status === "ok" ? [entry.value.reference] : [])
    // This is a new result observation after all projections. Finish every
    // per-result reread before the separate final complete-case observation.
    const reread = await read(rereadReferences, context)
    let rereadIndex = 0
    for (const entry of prepared) {
      if (entry.status !== "ok") { checked.push(entry); continue }
      const again = reread[rereadIndex++]!
      if (again.status !== "ok") { checked.push(again); continue }
      checked.push(digestSfValue(again.value) === digestSfValue(entry.value.stored) ? entry : { status: "stale", reason: "scenario-changed" })
    }
    const finalCases = new Map<string, CaseObservation>()
    const result: PortResult<ResolvedScenario>[] = []
    for (const entry of checked) {
      if (entry.status !== "ok") { result.push(structuredClone(entry)); continue }
      const current = await observeCase(entry.value.stored, finalCases, context)
      if (current.status !== "ok") { result.push(current); continue }
      result.push(digestSfValue(current.value.case) === entry.value.caseDigest ? { status: "ok", value: structuredClone(entry.value.value) } : { status: "stale", reason: "case-changed" })
    }
    return result
  }
  return { resolveMany, resolve: async (reference, context) => (await resolveMany([reference], context))[0]! }
}
