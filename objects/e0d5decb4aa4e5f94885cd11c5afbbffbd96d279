import { enterSfE15Route, currentSfE15Route, runSfE15Route, returnedSfE15Route, markSfE15Route, finishSfE15Route } from "../../runtime/preview-progress-e15-diagnostic.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ScenarioComparison, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioCompareRequest, ScenarioRequest } from "../contracts/operations.ts"
import type { PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore, StoredDecisionResult } from "../decisions/result-store.ts"
import type { createCriterionComparisonBindings } from "../decisions/criterion-comparison.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { PlannerScenarioHost } from "./scenario-comparison-port.ts"
import { comparePlannerScenarios } from "./comparison.ts"
import { plannerScenarioDigest } from "./preview-comparison.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type Input = { kind: "scenario"; request: ScenarioRequest; result: ScenarioResult } | { kind: "comparison"; request: ScenarioCompareRequest; result: ScenarioComparison }
type Replay = Partial<Pick<PlannerPort, "simulateScenario" | "compareScenarios">>
type ObserveScenarioWrite = (stored: Extract<StoredDecisionResult, { kind: "scenario" }>) => void

/** Persist produced outputs only under a host-authorized, current case. */
export function createPlannerResultPersistence(input: {
  store: ReturnType<typeof createSfDecisionResultStore>
  scenarios?: PlannerScenarioHost
  comparisonBindings?: Pick<ReturnType<typeof createCriterionComparisonBindings>, "proofs" | "bind" | "read">
  replay?: Replay
  resolveCase: (context: TrustedDomainContext) => Promise<PortResult<CaseRef>>
}) {
  const persist = async (incoming: Input, callId: string, context: TrustedDomainContext, replay = input.replay,
    observeScenario?: ObserveScenarioWrite): Promise<PortResult<{ resultRef: string }>> => {
    const value = structuredClone(incoming)
    if (!callId.trim()) return { status: "denied", reason: "missing-call-identity" }
    const operation = value.kind === "scenario" ? "sf_scenario_simulate" : "sf_scenario_compare"
    if (!decodeSfOperationInput(operation, value.request).ok || !decodeSfOperationOutput(operation, value.result).ok) return { status: "needs-input", reason: "invalid-result-persistence-input" }
    const selected = structuredClone(await input.resolveCase(context))
    if (selected.status !== "ok") return selected
    const requestDigest = digestSfValue(value.request)
    if (value.kind === "scenario") {
      const simulate = replay?.simulateScenario
      if (!simulate) return { status: "unavailable", reason: "scenario-replay-unavailable" }
      const selectedDigest = digestSfValue(selected.value)
      const expectedScenario = plannerScenarioDigest(value.result)
      const validate = async (): Promise<PortResult<true>> => {
        const current = structuredClone(await simulate(structuredClone(value.request), context))
        if (current.status !== "ok") return current
        if (plannerScenarioDigest(current.value) !== expectedScenario) return { status: "stale", reason: "scenario-replay-changed" }
        const latestCase = await input.resolveCase(context)
        if (latestCase.status !== "ok") return latestCase
        if (digestSfValue(latestCase.value) !== selectedDigest) return { status: "stale", reason: "scenario-case-changed" }
        return { status: "ok", value: true }
      }
      const current = await validate()
      if (current.status !== "ok") return current
      const refs = [...value.result.sourceRefs, ...value.result.costCoverage.evaluatedSourceRefs, ...value.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
      const sourceRefs = refs.filter((ref, index) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index)
      const saved = await input.store.write({ kind: "scenario", result: value.result, caseRef: selected.value, requestDigest, sourceRefs, idempotencyKey: callId }, context)
      if (saved.status !== "ok") return saved
      const latest = await validate()
      if (latest.status !== "ok") return latest
      if (saved.value.kind === "scenario") observeScenario?.(saved.value)
      return { status: "ok", value: { resultRef: saved.value.resultRef } }
    }
    const scenarios = input.scenarios
    if (!scenarios) return { status: "unavailable", reason: "scenario-validation-unavailable" }
    if (value.request.scenarioRefs.length !== 2 || value.request.scenarioRefs[0] === value.request.scenarioRefs[1] || value.result.baselineResultRef !== value.request.scenarioRefs[0] || value.result.alternativeResultRef !== value.request.scenarioRefs[1]) return { status: "conflict", reason: "comparison-reference-mismatch" }
    const records = structuredClone(await Promise.all(value.request.scenarioRefs.map((resultRef) => input.store.readHistoricalScenario({ resultRef }, context))))
    const failed = records.find((record) => record.status !== "ok")
    if (failed) return failed
    if (records.some((record) => record.status !== "ok" || record.value.caseRef.id !== selected.value.id || record.value.caseRef.incarnation !== selected.value.incarnation || record.value.caseRef.version > selected.value.version)) return { status: "denied", reason: "scenario-outside-case" }
    const bindings = input.comparisonBindings
    const compare = replay?.compareScenarios
    if (value.request.criteria.length && (!bindings || !compare)) return { status: "unavailable", reason: "comparison-criterion-binding-unavailable" }
    const rules = bindings && value.request.criteria.length ? structuredClone(await bindings.proofs(selected.value, value.request.criteria, context)) : undefined
    if (rules && rules.status !== "ok") return rules
    const validate = async (): Promise<PortResult<true>> => {
      const current = structuredClone(await Promise.all(value.request.scenarioRefs.map((reference) => scenarios.resolve(reference, context))))
      const failure = current.find((item) => item.status !== "ok")
      if (failure) return failure
      if (current.some((item, index) => {
        const record = records[index]
        return item.status !== "ok" || !record || record.status !== "ok" || digestSfValue(item.value.result) !== record.value.resultDigest
      })) return { status: "stale", reason: "scenario-changed" }
      const baseline = current[0]
      const alternative = current[1]
      if (!baseline || baseline.status !== "ok" || !alternative || alternative.status !== "ok") return { status: "unavailable", reason: "scenario-validation-unavailable" }
      const expected = compare
        ? await compare(structuredClone(value.request), context)
        : { status: "ok" as const, value: comparePlannerScenarios({ baselineRef: value.request.scenarioRefs[0]!, alternativeRef: value.request.scenarioRefs[1]!, baselineCoverageRef: baseline.value.coverageRef, alternativeCoverageRef: alternative.value.coverageRef, baseline: baseline.value.result, alternative: alternative.value.result, baselineProof: baseline.value, alternativeProof: alternative.value }) }
      if (expected.status !== "ok") return expected
      if (digestSfValue(expected.value) !== digestSfValue(value.result)) return { status: "stale", reason: "comparison-replay-changed" }
      const latestCase = await input.resolveCase(context)
      if (latestCase.status !== "ok") return latestCase
      if (digestSfValue(latestCase.value) !== digestSfValue(selected.value)) return { status: "stale", reason: "comparison-case-changed" }
      if (rules?.status === "ok" && bindings) {
        const latestRules = await bindings.proofs(selected.value, value.request.criteria, context)
        if (latestRules.status !== "ok" || digestSfValue(latestRules.value) !== digestSfValue(rules.value)) return { status: "stale", reason: "comparison-rules-changed" }
      }
      return { status: "ok", value: true }
    }
    const current = await validate()
    if (current.status !== "ok") return current
    const refs: BusinessEvidenceRef[] = records.flatMap((record) => record.status === "ok" ? record.value.sourceRefs : [])
    const sourceRefs = refs.filter((ref, index) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index)
    const e15Persistence = currentSfE15Route()
    const saved = returnedSfE15Route(e15Persistence, "store-write-returned", await runSfE15Route(e15Persistence, "store-write", () => input.store.write({ kind: "comparison", result: value.result, caseRef: selected.value, requestDigest, sourceRefs, idempotencyKey: callId }, context)))
    if (saved.status !== "ok") return saved
    if (rules?.status === "ok" && bindings) {
      markSfE15Route(e15Persistence, "binding-enter")
      const bound = returnedSfE15Route(e15Persistence, "binding-returned", await bindings.bind({ caseRef: selected.value, resultRef: saved.value.resultRef, request: value.request, expectedRules: rules.value }, context))
      if (bound.status !== "ok") return { status: bound.status, reason: "comparison-persisted-but-binding-unavailable" }
    }
    markSfE15Route(e15Persistence, "validation-enter")
    const latest = returnedSfE15Route(e15Persistence, "validation-returned", await validate())
    if (latest.status !== "ok") return latest
    if (rules?.status === "ok" && bindings) {
      const checked = returnedSfE15Route(e15Persistence, "binding-read-returned", await bindings.read({ caseRef: selected.value, resultRef: saved.value.resultRef }, context))
      if (checked.status !== "ok") return checked
    }
    return { status: "ok", value: { resultRef: saved.value.resultRef } }
  }
  return async (incoming: Input, callId: string, context: TrustedDomainContext, replay?: Replay,
    observeScenario?: ObserveScenarioWrite): Promise<PortResult<{ resultRef: string }>> => {
    const e15Persistence = enterSfE15Route("persistence")
    let e15Threw = false
    try { return await runSfE15Route(e15Persistence, "persist-body", () => persist(incoming, callId, context, replay ?? input.replay, observeScenario)) }
    catch { e15Threw = true; return { status: "unavailable", reason: "planner-result-persistence-unavailable" } }
    finally { finishSfE15Route(e15Persistence, e15Threw) }
  }
}
