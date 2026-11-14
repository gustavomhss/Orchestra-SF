import { digestSfValue } from "../contracts/canonical.ts"
import type { SensitivityResult } from "../contracts/outputs.ts"
import type { SensitivityRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore, StoredDecisionResult } from "../decisions/result-store.ts"
import type { PortfolioPort } from "./port.ts"
import type { PlannerSensitivityBinding } from "./planner-sensitivity.ts"
import type { createCriterionResultBindings } from "../decisions/criterion-rules.ts"

/** Persist sensitivity only after every referenced sample remains readable in the same case. */
export function createPersistentSensitivityPort(input: {
  portfolio: PortfolioPort
  bindings: ReturnType<typeof createCriterionResultBindings>
  resolveBinding: (request: SensitivityRequest, context: TrustedDomainContext) => Promise<PortResult<PlannerSensitivityBinding>>
  results: ReturnType<typeof createSfDecisionResultStore> & { readHistoricalScenario?: (request: { resultRef: string }, context: TrustedDomainContext) => ReturnType<ReturnType<typeof createSfDecisionResultStore>["read"]>; readByRequest?: (request: { caseRef: { id: string; incarnation: string; version: number }; kind: "sensitivity"; idempotencyKey: string; requestDigest: string }, context: TrustedDomainContext) => Promise<PortResult<{ state: "found"; result: StoredDecisionResult } | { state: "not-found" }>> }
  idempotencyKey: (requestDigest: string, context: TrustedDomainContext) => Promise<string | undefined>
}) {
  const validateSamples = async (result: SensitivityResult, caseRef: { id: string; incarnation: string; version: number }, context: TrustedDomainContext) => {
    const source = input.results.readHistoricalScenario ? await input.results.readHistoricalScenario({ resultRef: result.scenarioRef }, context) : await input.results.read({ kind: "scenario", resultRef: result.scenarioRef }, context)
    if (source.status !== "ok") return source
    if (source.value.kind !== "scenario" || source.value.caseRef.id !== caseRef.id || source.value.caseRef.incarnation !== caseRef.incarnation || source.value.caseRef.version > caseRef.version) return { status: "stale", reason: "sensitivity-sample-case-changed" } as const
    const samples = await Promise.all(result.evaluated.map((point) => input.results.read({ kind: "scenario", resultRef: point.resultRef }, context)))
    const failed = samples.find((sample) => sample.status !== "ok")
    if (failed) return failed
    if (samples.some((sample) => sample.status !== "ok" || sample.value.kind !== "scenario" || digestSfValue(sample.value.caseRef) !== digestSfValue(caseRef))) return { status: "stale", reason: "sensitivity-sample-case-changed" } as const
    return { status: "ok", value: [...source.value.sourceRefs, ...samples.flatMap((sample) => sample.status === "ok" ? sample.value.sourceRefs : [])] } as const
  }
  const read = async (resultRef: string, context: TrustedDomainContext) => {
    const stored = structuredClone(await input.results.read({ kind: "sensitivity", resultRef }, context))
    if (stored.status !== "ok") return stored
    if (stored.value.kind !== "sensitivity" || stored.value.resultRef !== resultRef || stored.value.resultDigest !== digestSfValue(stored.value.result)) return { status: "unavailable", reason: "sensitivity-reference-mismatch" } as const
    const binding = structuredClone(await input.bindings.read({ caseRef: stored.value.caseRef, resultRef }, context))
    if (binding.status !== "ok") return binding
    const request = binding.value.request
    if (binding.value.resultRef !== resultRef || binding.value.resultDigest !== stored.value.resultDigest || digestSfValue(binding.value.caseRef) !== digestSfValue(stored.value.caseRef) || stored.value.requestDigest !== digestSfValue(request)) return { status: "stale", reason: "sensitivity-request-changed" } as const
    const samples = await validateSamples(stored.value.result, stored.value.caseRef, context)
    if (samples.status !== "ok") return samples
    const latest = structuredClone(await input.results.read({ kind: "sensitivity", resultRef }, context))
    if (latest.status !== "ok") return latest
    if (latest.value.kind !== "sensitivity" || digestSfValue(latest.value) !== digestSfValue(stored.value)) return { status: "stale", reason: "sensitivity-result-changed" } as const
    const bindingAgain = await input.bindings.read({ caseRef: latest.value.caseRef, resultRef }, context)
    if (bindingAgain.status !== "ok") return bindingAgain
    if (digestSfValue(bindingAgain.value) !== digestSfValue(binding.value)) return { status: "stale", reason: "sensitivity-binding-changed" } as const
    return { status: "ok", value: { sensitivityResultRef: latest.value.resultRef, sensitivity: latest.value.result, caseRef: latest.value.caseRef } } as const
  }
  return {
    read,
    evaluateAndStore: async (incoming: SensitivityRequest, caseIdentity: { id: string; incarnation: string; version: number }, context: TrustedDomainContext) => {
      const request = structuredClone(incoming)
      const caseRef = structuredClone(caseIdentity)
      const requestDigest = digestSfValue(request)
      const key = await input.idempotencyKey(requestDigest, context)
      if (!key?.trim()) return { status: "denied", reason: "operation-identity-unavailable" } as const
      const proof = structuredClone(await input.resolveBinding(structuredClone(request), context))
      if (proof.status !== "ok") return proof
      if (digestSfValue(proof.value.caseRef) !== digestSfValue(caseRef) || digestSfValue(proof.value.sensitivityRequest) !== requestDigest) return { status: "stale", reason: "sensitivity-binding-changed" } as const
      const evaluated = structuredClone(await input.portfolio.sensitivity(structuredClone(request), context))
      if (evaluated.status !== "ok") return evaluated
      const samples = await validateSamples(evaluated.value, caseRef, context)
      if (samples.status !== "ok") return samples
      const sourceRefs = [...evaluated.value.evidenceRefs, ...samples.value].filter((ref, index, refs) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index)
      const idempotencyKey = `sensitivity:${key}`
      const existing = input.results.readByRequest ? await input.results.readByRequest({ caseRef, kind: "sensitivity", idempotencyKey, requestDigest }, context) : undefined
      if (existing && existing.status !== "ok") return existing
      const saved = structuredClone(existing?.status === "ok" && existing.value.state === "found" ? { status: "ok" as const, value: existing.value.result } : await input.results.write(structuredClone({ kind: "sensitivity", result: evaluated.value, caseRef, requestDigest, sourceRefs, idempotencyKey }), context))
      if (saved.status !== "ok") return saved
      if (saved.value.kind !== "sensitivity" || saved.value.requestDigest !== requestDigest || digestSfValue(saved.value.caseRef) !== digestSfValue(caseRef) || digestSfValue(saved.value.result) !== digestSfValue(evaluated.value)) return { status: "conflict", reason: "sensitivity-result-mismatch" } as const
      const previousBinding = existing?.status === "ok" && existing.value.state === "found" ? await input.bindings.read({ caseRef, resultRef: saved.value.resultRef }, context) : undefined
      if (previousBinding && previousBinding.status !== "ok" && previousBinding.status !== "unavailable") return previousBinding
      if (!previousBinding || previousBinding.status !== "ok") {
        const binding = await input.bindings.bind(structuredClone({ caseRef, resultRef: saved.value.resultRef, criterionId: request.criterion.id, expectedRuleRef: proof.value.ruleRef, expectedRuleVersion: proof.value.ruleVersion, expectedRuleDigest: proof.value.ruleDigest, request }), context)
        if (binding.status !== "ok") return binding
      }
      return read(saved.value.resultRef, context)
    },
  }
}
