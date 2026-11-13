import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import { plannerScenarioDigest } from "./preview-comparison.ts"

type CalculationEvidence = Extract<BusinessEvidenceRef, { kind: "calculation" }>

/** The host must reject nested evidence before any resolver is called in each callback. */
export function createPlannerCalculationEvidence(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  readForCalculation: ReturnType<typeof createSfDecisionResultStore>["read"]
  loadRecordOnlyRequest: (runId: string, context: TrustedDomainContext) => Promise<PortResult<{ resultRef: string; request: ScenarioRequest; engineVersion: string }>>
  replayRecordOnly: PlannerPort["simulateScenario"]
}) {
  const issue = async (runId: string, context: TrustedDomainContext): Promise<PortResult<CalculationEvidence>> => {
    const http = input.host.requestFor(context)
    if (!http || http.signal.aborted || !runId.trim() || !await input.host.revalidate(context)) return { status: "denied", reason: "calculation-authority-unavailable" }
    if (!input.readForCalculation || !input.loadRecordOnlyRequest || !input.replayRecordOnly) return { status: "unavailable", reason: "calculation-safe-replay-unavailable" }
    const binding = await input.loadRecordOnlyRequest(runId, context)
    if (binding.status !== "ok") return binding
    if (binding.value.resultRef !== runId || binding.value.engineVersion !== "planner-runtime-v1") return { status: "unavailable", reason: "calculation-binding-unavailable" }
    if (!binding.value.request || !Array.isArray(binding.value.request.assumptions) || !Array.isArray(binding.value.request.operations) || binding.value.request.assumptions.length || binding.value.request.operations.some((operation) => !operation || operation.replacementRef)) return { status: "unavailable", reason: "calculation-nested-evidence-unavailable" }
    const stored = await input.readForCalculation({ resultRef: runId, kind: "scenario" }, context)
    if (stored.status !== "ok") return stored
    if (stored.value.kind !== "scenario" || stored.value.requestDigest !== digestSfValue(binding.value.request) || stored.value.resultDigest !== digestSfValue(stored.value.result) || !stored.value.sourceRefs.length) return { status: "stale", reason: "calculation-binding-changed" }
    const replay = await input.replayRecordOnly(binding.value.request, context)
    if (replay.status !== "ok") return replay
    if (plannerScenarioDigest(replay.value) !== plannerScenarioDigest(stored.value.result)) return { status: "stale", reason: "calculation-replay-changed" }
    const latestBinding = await input.loadRecordOnlyRequest(runId, context)
    const latest = await input.readForCalculation({ resultRef: runId, kind: "scenario" }, context)
    const replayAgain = await input.replayRecordOnly(binding.value.request, context)
    if (latestBinding.status !== "ok" || digestSfValue(latestBinding.value) !== digestSfValue(binding.value) || latest.status !== "ok" || digestSfValue(latest.value) !== digestSfValue(stored.value) || replayAgain.status !== "ok" || plannerScenarioDigest(replayAgain.value) !== plannerScenarioDigest(replay.value) || http.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "calculation-or-authority-changed" }
    const value: CalculationEvidence = { schema: "sf-evidence-v1", kind: "calculation", refId: `planner-calculation:${encodeURIComponent(runId)}`, installationId: context.binding.installationId, projectId: context.binding.projectId, refDigest: "", evidenceLevel: "proposal", target: { calculationId: "planner:scenario", runId, engineVersion: binding.value.engineVersion, inputDigest: stored.value.requestDigest, resultDigest: stored.value.resultDigest, sourceRefs: stored.value.sourceRefs, period: stored.value.result.horizon, currency: stored.value.result.currency } }
    return { status: "ok", value: { ...value, refDigest: digestSfEvidenceRef(value) } }
  }
  const resolve = async (reference: string, context: TrustedDomainContext): Promise<PortResult<CalculationEvidence>> => {
    const match = /^planner-calculation:([^:]+)$/.exec(reference)
    if (!match) return { status: "unavailable", reason: "calculation-reference-invalid" }
    const runId = (() => { try { return decodeURIComponent(match[1]!) } catch { return "" } })()
    if (!runId || encodeURIComponent(runId) !== match[1]) return { status: "unavailable", reason: "calculation-reference-invalid" }
    return issue(runId, context)
  }
  return { issue, resolve }
}
