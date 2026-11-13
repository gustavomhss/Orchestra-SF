import { digestSfValue } from "../contracts/canonical.ts"
import type { SensitivityResult } from "../contracts/outputs.ts"
import type { SensitivityRequest } from "../contracts/operations.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import type { PortfolioPort } from "./port.ts"

/** Persist sensitivity only after every referenced sample remains readable in the same case. */
export function createPersistentSensitivityPort(input: {
  portfolio: PortfolioPort
  results: ReturnType<typeof createSfDecisionResultStore> & { readHistoricalScenario?: (request: { resultRef: string }, context: TrustedDomainContext) => ReturnType<ReturnType<typeof createSfDecisionResultStore>["read"]> }
  idempotencyKey: (requestDigest: string, context: TrustedDomainContext) => Promise<string | undefined>
}) {
  const validateSamples = async (result: SensitivityResult, caseRef: { id: string; incarnation: string; version: number }, context: TrustedDomainContext) => {
    const source = input.results.readHistoricalScenario ? await input.results.readHistoricalScenario({ resultRef: result.scenarioRef }, context) : await input.results.read({ kind: "scenario", resultRef: result.scenarioRef }, context)
    if (source.status !== "ok") return source
    if (source.value.kind !== "scenario" || source.value.caseRef.id !== caseRef.id || source.value.caseRef.incarnation !== caseRef.incarnation || source.value.caseRef.version > caseRef.version) return { status: "stale", reason: "sensitivity-sample-case-changed" } as const
    const samples = await Promise.all(result.evaluated.map((point) => input.results.read({ kind: "scenario", resultRef: point.resultRef }, context)))
    const failed = samples.find((sample) => sample.status !== "ok")
    if (failed && failed.status !== "ok") return failed
    if (samples.some((sample) => sample.status !== "ok" || sample.value.kind !== "scenario" || digestSfValue(sample.value.caseRef) !== digestSfValue(caseRef))) return { status: "stale", reason: "sensitivity-sample-case-changed" } as const
    return { status: "ok", value: [...source.value.sourceRefs, ...samples.flatMap((sample) => sample.status === "ok" ? sample.value.sourceRefs : [])] } as const
  }
  const read = async (resultRef: string, context: TrustedDomainContext) => {
    const stored = await input.results.read({ kind: "sensitivity", resultRef }, context)
    if (stored.status !== "ok") return stored
    if (stored.value.kind !== "sensitivity") return { status: "unavailable", reason: "sensitivity-reference-mismatch" } as const
    const samples = await validateSamples(stored.value.result, stored.value.caseRef, context)
    if (samples.status !== "ok") return samples
    const latest = await input.results.read({ kind: "sensitivity", resultRef }, context)
    if (latest.status !== "ok") return latest
    if (latest.value.kind !== "sensitivity" || digestSfValue(latest.value) !== digestSfValue(stored.value)) return { status: "stale", reason: "sensitivity-result-changed" } as const
    return { status: "ok", value: { sensitivityResultRef: latest.value.resultRef, sensitivity: latest.value.result, caseRef: latest.value.caseRef } } as const
  }
  return {
    read,
    evaluateAndStore: async (request: SensitivityRequest, caseRef: { id: string; incarnation: string; version: number }, context: TrustedDomainContext) => {
      const requestDigest = digestSfValue(request)
      const key = await input.idempotencyKey(requestDigest, context)
      if (!key?.trim()) return { status: "denied", reason: "operation-identity-unavailable" } as const
      const evaluated = await input.portfolio.sensitivity(request, context)
      if (evaluated.status !== "ok") return evaluated
      const samples = await validateSamples(evaluated.value, caseRef, context)
      if (samples.status !== "ok") return samples
      const sourceRefs = [...evaluated.value.evidenceRefs, ...samples.value].filter((ref, index, refs) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index)
      const saved = await input.results.write({ kind: "sensitivity", result: evaluated.value, caseRef, requestDigest, sourceRefs, idempotencyKey: `sensitivity:${key}` }, context)
      if (saved.status !== "ok") return saved
      if (saved.value.kind !== "sensitivity" || saved.value.requestDigest !== requestDigest || digestSfValue(saved.value.caseRef) !== digestSfValue(caseRef) || digestSfValue(saved.value.result) !== digestSfValue(evaluated.value)) return { status: "conflict", reason: "sensitivity-result-mismatch" } as const
      return read(saved.value.resultRef, context)
    },
  }
}
