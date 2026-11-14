import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ScenarioComparison, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioCompareRequest, ScenarioRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import type { PlannerScenarioHost } from "./scenario-comparison-port.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type Input = { kind: "scenario"; request: ScenarioRequest; result: ScenarioResult } | { kind: "comparison"; request: ScenarioCompareRequest; result: ScenarioComparison }

/** Persist produced outputs only under a host-authorized, current case. */
export function createPlannerResultPersistence(input: { store: ReturnType<typeof createSfDecisionResultStore> & { readHistoricalScenario?: (request: { resultRef: string }, context: TrustedDomainContext) => ReturnType<ReturnType<typeof createSfDecisionResultStore>["read"]> }; scenarios?: PlannerScenarioHost; resolveCase: (context: TrustedDomainContext) => Promise<PortResult<CaseRef>> }) {
  return async (incoming: Input, callId: string, context: TrustedDomainContext): Promise<PortResult<{ resultRef: string }>> => {
    const value = structuredClone(incoming)
    if (!callId.trim()) return { status: "denied", reason: "missing-call-identity" }
    const selected = await input.resolveCase(context)
    if (selected.status !== "ok") return selected
    const requestDigest = digestSfValue(value.request)
    if (value.kind === "scenario") {
      const refs = [...value.result.sourceRefs, ...value.result.costCoverage.evaluatedSourceRefs, ...value.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
      const sourceRefs = refs.filter((ref, index) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index)
      const saved = await input.store.write({ kind: "scenario", result: value.result, caseRef: selected.value, requestDigest, sourceRefs, idempotencyKey: callId }, context)
      if (saved.status !== "ok") return saved
      return { status: "ok", value: { resultRef: saved.value.resultRef } }
    }
    const scenarios = input.scenarios
    if (!scenarios) return { status: "unavailable", reason: "scenario-validation-unavailable" }
    if (value.request.scenarioRefs.length !== 2 || value.request.scenarioRefs[0] === value.request.scenarioRefs[1] || value.result.baselineResultRef !== value.request.scenarioRefs[0] || value.result.alternativeResultRef !== value.request.scenarioRefs[1]) return { status: "conflict", reason: "comparison-reference-mismatch" }
    const records = await Promise.all(value.request.scenarioRefs.map((resultRef) => input.store.readHistoricalScenario ? input.store.readHistoricalScenario({ resultRef }, context) : input.store.read({ resultRef, kind: "scenario" }, context)))
    const failed = records.find((record) => record.status !== "ok")
    if (failed) return failed
    if (records.some((record) => record.status !== "ok" || record.value.caseRef.id !== selected.value.id || record.value.caseRef.incarnation !== selected.value.incarnation || record.value.caseRef.version > selected.value.version)) return { status: "denied", reason: "scenario-outside-case" }
    {
      const current = await Promise.all(value.request.scenarioRefs.map((reference) => scenarios.resolve(reference, context)))
      const failure = current.find((item) => item.status !== "ok")
      if (failure) return failure
      if (current.some((item, index) => {
        const record = records[index]
        return item.status !== "ok" || !record || record.status !== "ok" || digestSfValue(item.value.result) !== record.value.resultDigest
      })) return { status: "stale", reason: "scenario-changed" }
    }
    const refs: BusinessEvidenceRef[] = records.flatMap((record) => record.status === "ok" ? record.value.sourceRefs : [])
    const sourceRefs = refs.filter((ref, index) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index)
    const saved = await input.store.write({ kind: "comparison", result: value.result, caseRef: selected.value, requestDigest, sourceRefs, idempotencyKey: callId }, context)
    if (saved.status !== "ok") return saved
    return { status: "ok", value: { resultRef: saved.value.resultRef } }
  }
}
