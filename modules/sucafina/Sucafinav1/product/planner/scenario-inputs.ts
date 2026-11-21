import type { PlannerPort, PlannerSourceHost } from "../contracts/ports.ts"
import type { PlannerScenarioInputs } from "./scenario-port.ts"

/** Select a current, source-authorized monthly Planner measure without granting access. */
export function plannerValueRef(sourceRef: string, valueId: string) {
  return `planner-value:${encodeURIComponent(sourceRef)}:${encodeURIComponent(valueId)}`
}

export function createPlannerScenarioInputs(input: { planner: Pick<PlannerPort, "compareForecast">; sources: PlannerSourceHost; verifyAssumption?: PlannerScenarioInputs["verifyAssumption"] }): PlannerScenarioInputs {
  return {
    verifyAssumption: input.verifyAssumption ?? (async () => ({ status: "unavailable", reason: "human-confirmation-required" })),
    async resolveAmount(reference, context) {
      const parts = /^planner-value:([^:]+):([^:]+)$/.exec(reference)
      if (!parts) return { status: "needs-input", reason: "invalid-planner-value-reference" }
      const decoded = parts.slice(1).map(decode)
      if (!decoded[0] || !decoded[1] || plannerValueRef(decoded[0], decoded[1]) !== reference || !/:(?:[1-9]|1[0-2]):(?:budget|actual|forecast)$/.test(decoded[1])) return { status: "needs-input", reason: "invalid-planner-value-reference" }
      const source = await input.sources.resolveForecastSource(decoded[0], context)
      if (source.status !== "ok") return source
      if (source.value.evidence.refId !== decoded[0] || source.value.evidence.target.recordId !== source.value.versionId) return { status: "stale", reason: "source-identity-mismatch" }
      const period = source.value.evidence.target.period
      if (!period) return { status: "unavailable", reason: "source-period-unavailable" }
      const analysis = await input.planner.compareForecast({ baseRef: decoded[0], candidateRef: decoded[0], period, currency: "USD" }, context)
      if (analysis.status !== "ok") return analysis
      const projection = analysis.value.baseline
      const values = projection.values.filter((value) => value.id === decoded[1])
      const refs = projection.context.sourceRefs.filter((ref) => ref.surface === "planner" && ref.id === source.value.versionId && ref.incarnation === source.value.evidence.target.incarnation && ref.version === source.value.evidence.target.version)
      const value = values[0]
      if (values.length !== 1 || refs.length !== 1 || !value || typeof value.value !== "number" || !Number.isFinite(value.value) || !value.currency || value.evidenceState !== "confirmed" || value.granularity !== "month" || !value.sourceRefs.some((ref) => ref.refDigest === source.value.evidence.refDigest)) return { status: "unavailable", reason: "planner-value-unavailable" }
      return { status: "ok", value: { amount: value.value, currency: value.currency, period: value.period, source: { ...refs[0]!, period: value.period }, evidence: source.value.evidence } }
    },
  }
}

function decode(value: string) {
  try { return decodeURIComponent(value) } catch { return undefined }
}
