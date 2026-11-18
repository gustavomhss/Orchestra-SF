import { digestSfEvidenceRef, digestSfValue, sfEvidenceSourceMaps } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { DomainPortHost, PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import { plannerScenarioDigest } from "./preview-comparison.ts"

type CalculationEvidence = Extract<BusinessEvidenceRef, { kind: "calculation" }>

/** Record-only replay closes over all coverage evidence; recursive resolver calls fail closed. */
export function createPlannerCalculationEvidence(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  readForCalculation: ReturnType<typeof createSfDecisionResultStore>["read"]
  loadRecordOnlyRequest: (runId: string, context: TrustedDomainContext) => Promise<PortResult<{ resultRef: string; request: ScenarioRequest; engineVersion: string }>>
  replayRecordOnly: PlannerPort["simulateScenario"]
}) {
  const active = new Map<string, Set<string>>()
  const replay = async (runId: string, context: TrustedDomainContext): Promise<PortResult<CalculationEvidence>> => {
    const http = input.host.requestFor(context)
    if (!http || http.signal.aborted || !runId.trim() || !await input.host.revalidate(context)) return { status: "denied", reason: "calculation-authority-unavailable" }
    if (!input.readForCalculation || !input.loadRecordOnlyRequest || !input.replayRecordOnly) return { status: "unavailable", reason: "calculation-safe-replay-unavailable" }
    const binding = structuredClone(await input.loadRecordOnlyRequest(runId, context))
    if (binding.status !== "ok") return binding
    if (binding.value.resultRef !== runId || binding.value.engineVersion !== "planner-runtime-v1") return { status: "unavailable", reason: "calculation-binding-unavailable" }
    if (!binding.value.request || !Array.isArray(binding.value.request.assumptions) || !Array.isArray(binding.value.request.operations) || binding.value.request.assumptions.length || binding.value.request.operations.some((operation) => !operation || operation.replacementRef)) return { status: "unavailable", reason: "calculation-nested-evidence-unavailable" }
    if (!decodeSfOperationInput("sf_scenario_simulate", binding.value.request).ok) return { status: "unavailable", reason: "calculation-request-invalid" }
    const stored = structuredClone(await input.readForCalculation({ resultRef: runId, kind: "scenario" }, context))
    if (stored.status !== "ok") return stored
    if (stored.value.kind !== "scenario" || !recordOnlyEvidence(stored.value.result, stored.value.sourceRefs, context)) return { status: "unavailable", reason: "calculation-source-closure-invalid" }
    if (stored.value.kind !== "scenario" || stored.value.requestDigest !== digestSfValue(binding.value.request) || stored.value.resultDigest !== digestSfValue(stored.value.result) || !stored.value.sourceRefs.length) return { status: "stale", reason: "calculation-binding-changed" }
    const reproduced = structuredClone(await input.replayRecordOnly(structuredClone(binding.value.request), context))
    if (reproduced.status !== "ok") return reproduced
    if (!recordOnlyEvidence(reproduced.value, stored.value.sourceRefs, context) || plannerScenarioDigest(reproduced.value) !== plannerScenarioDigest(stored.value.result)) return { status: "stale", reason: "calculation-replay-changed" }
    const latestBinding = structuredClone(await input.loadRecordOnlyRequest(runId, context))
    const latest = structuredClone(await input.readForCalculation({ resultRef: runId, kind: "scenario" }, context))
    const replayAgain = structuredClone(await input.replayRecordOnly(structuredClone(binding.value.request), context))
    if (latestBinding.status !== "ok" || digestSfValue(latestBinding.value) !== digestSfValue(binding.value) || latest.status !== "ok" || digestSfValue(latest.value) !== digestSfValue(stored.value) || replayAgain.status !== "ok" || !recordOnlyEvidence(replayAgain.value, stored.value.sourceRefs, context) || plannerScenarioDigest(replayAgain.value) !== plannerScenarioDigest(reproduced.value) || http.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "calculation-or-authority-changed" }
    const value: CalculationEvidence = { schema: "sf-evidence-v1", kind: "calculation", refId: `planner-calculation:${encodeURIComponent(runId)}`, installationId: context.binding.installationId, projectId: context.binding.projectId, refDigest: "", evidenceLevel: "proposal", target: { calculationId: "planner:scenario", runId, engineVersion: binding.value.engineVersion, inputDigest: stored.value.requestDigest, resultDigest: stored.value.resultDigest, sourceRefs: stored.value.sourceRefs, period: stored.value.result.horizon, currency: stored.value.result.currency } }
    return { status: "ok", value: { ...value, refDigest: digestSfEvidenceRef(value) } }
  }
  const issue = async (runId: string, context: TrustedDomainContext): Promise<PortResult<CalculationEvidence>> => {
    if (typeof runId !== "string" || !runId.trim()) return { status: "denied", reason: "calculation-authority-unavailable" }
    const key = digestSfValue(context.binding)
    const runs = active.get(key) ?? new Set<string>()
    if (runs.has(runId) || runs.size >= 16) return { status: "unavailable", reason: "calculation-replay-cycle" }
    runs.add(runId)
    active.set(key, runs)
    try { return await replay(runId, context) }
    catch { return { status: "unavailable", reason: "calculation-replay-unavailable" } }
    finally { runs.delete(runId); if (!runs.size) active.delete(key) }
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

function recordOnlyEvidence(result: ScenarioResult, sources: readonly BusinessEvidenceRef[], context: TrustedDomainContext) {
  if (!decodeSfOperationOutput("sf_scenario_simulate", result).ok || !decodeSfOperationOutput("sf_scenario_simulate", { ...result, sourceRefs: sources }).ok) return false
  const refs = [...result.sourceRefs, ...result.costCoverage.evaluatedSourceRefs, ...result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
  if (!sources.length || !refs.length || [...sources, ...refs].some((ref) => ref.kind !== "record" || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId)) return false
  // The shared traversal rejects cyclic/tampered graphs before a canonical digest can recurse.
  sfEvidenceSourceMaps([...sources, ...refs])
  if (refs.some((ref) => !sources.some((source) => source.refDigest === ref.refDigest))) return false
  return result.components.every((component) => component.sourceRefs.every((ref) => sources.some((source) => source.kind === "record" && source.target.surface === ref.surface && source.target.recordType === ref.type && source.target.recordId === ref.id && source.target.incarnation === ref.incarnation && source.target.version === ref.version && ref.fields.every((field) => source.target.fields.includes(field)))))
}
