import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfEvidenceRef, digestSfValue, sfEvidenceSourceMaps } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { DomainPortHost, PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { StoredDecisionResult, createSfDecisionResultStore } from "../decisions/result-store.ts"
import { plannerScenarioDigest } from "./preview-comparison.ts"

type CalculationEvidence = Extract<BusinessEvidenceRef, { kind: "calculation" }>
type StoredScenario = Extract<StoredDecisionResult, { kind: "scenario" }>

/** Nested evidence is an explicit host composition; every calculation still needs canonical replay. */
export function createPlannerCalculationEvidence(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  readForCalculation: ReturnType<typeof createSfDecisionResultStore>["read"]
  loadRecordOnlyRequest: (runId: string, context: TrustedDomainContext) => Promise<PortResult<{ resultRef: string; request: ScenarioRequest; engineVersion: string }>>
  replayRecordOnly: PlannerPort["simulateScenario"]
  nested?: { replayScenario: PlannerPort["simulateScenario"]; evidence: Pick<BusinessContextService, "resolve"> }
}) {
  // These are ancestors of one asynchronous replay, not a lock or an authorization cache.
  // Immutable sets keep parallel callbacks descended from the same caller independent.
  const ancestry = new AsyncLocalStorage<{ binding: string; runs: ReadonlySet<string>; checks: ReadonlySet<string> }>()
  const verifyCalculationSources = async (incoming: StoredScenario, requested: readonly BusinessEvidenceRef[], context: TrustedDomainContext): Promise<boolean> => {
    const key = digestSfValue(context.binding)
    const value = structuredClone(incoming)
    const refs = structuredClone(requested)
    const parent = ancestry.getStore()
    const runs = parent?.binding === key ? parent.runs : new Set<string>()
    const checks = parent?.binding === key ? parent.checks : new Set<string>()
    const ownsRun = !runs.has(value.resultRef)
    if (checks.has(value.resultRef) || ownsRun && runs.size >= 16) return false
    return ancestry.run({ binding: key, runs: new Set([...runs, value.resultRef]), checks: new Set([...checks, value.resultRef]) }, async () => {
      try {
        const http = input.host.requestFor(context)
        if (!http || http.signal.aborted || !await input.host.revalidate(context) || !value.resultRef.trim() || value.resultDigest !== digestSfValue(value.result) || !sourceClosure(value.result, value.sourceRefs, context, !!input.nested)) return false
        const complete = completeSources(value.result, value.sourceRefs)
        if (digestSfValue(refs.map((ref) => ref.refDigest).sort()) !== digestSfValue(complete.map((ref) => ref.refDigest).sort())) return false
        sfEvidenceSourceMaps(refs)
        if (!input.nested) return complete.every((ref) => ref.kind === "record")
        for (const ref of evidenceGraph(complete)) {
          if (ref.kind === "calculation") {
            if (ref.target.runId === value.resultRef || ref.target.calculationId !== "planner:scenario" || ref.target.engineVersion !== "planner-runtime-v1") return false
            const issued = await issue(ref.target.runId, context)
            if (issued.status !== "ok" || digestSfValue(issued.value) !== digestSfValue(ref)) return false
            continue
          }
          const resolved = structuredClone(await input.nested.evidence.resolve(structuredClone(ref), context))
          if (resolved.state !== "fresh" || resolved.accessRevision !== context.binding.accessRevision || !resolved.currentRef || !resolved.authorizedProjection || digestSfValue(resolved.ref) !== digestSfValue(ref) || digestSfValue(resolved.currentRef) !== digestSfValue(ref)) return false
        }
        return !http.signal.aborted && await input.host.revalidate(context)
      } catch { return false }
    })
  }
  const verifyCalculationRequestSources = async (request: ScenarioRequest, stored: StoredScenario, context: TrustedDomainContext): Promise<boolean> => {
    try {
      if (!decodeSfOperationInput("sf_scenario_simulate", request).ok || digestSfValue(request) !== stored.requestDigest || !input.nested && (request.assumptions.length > 0 || request.operations.some((operation) => operation.replacementRef))) return false
      const refs = completeSources(stored.result, stored.sourceRefs)
      const graph = evidenceGraph(refs)
      if (request.assumptions.flatMap((assumption) => assumption.evidenceRefs).some((ref) => !graph.some((source) => digestSfValue(source) === digestSfValue(ref)))) return false
      // Opaque replacement references remain the canonical Planner input resolver's job.
      // Reading this binding is not issuance: issue() must still replay its actual request twice.
      return verifyCalculationSources(stored, refs, context)
    } catch { return false }
  }
  const replay = async (runId: string, context: TrustedDomainContext): Promise<PortResult<CalculationEvidence>> => {
    const http = input.host.requestFor(context)
    if (!http || http.signal.aborted || !runId.trim() || !await input.host.revalidate(context)) return { status: "denied", reason: "calculation-authority-unavailable" }
    if (!input.readForCalculation || !input.loadRecordOnlyRequest || !input.replayRecordOnly) return { status: "unavailable", reason: "calculation-safe-replay-unavailable" }
    const binding = structuredClone(await input.loadRecordOnlyRequest(runId, context))
    if (binding.status !== "ok") return binding
    if (binding.value.resultRef !== runId || binding.value.engineVersion !== "planner-runtime-v1") return { status: "unavailable", reason: "calculation-binding-unavailable" }
    if (!binding.value.request || !Array.isArray(binding.value.request.assumptions) || !Array.isArray(binding.value.request.operations) || !input.nested && (binding.value.request.assumptions.length || binding.value.request.operations.some((operation) => !operation || operation.replacementRef))) return { status: "unavailable", reason: "calculation-nested-evidence-unavailable" }
    if (!decodeSfOperationInput("sf_scenario_simulate", binding.value.request).ok) return { status: "unavailable", reason: "calculation-request-invalid" }
    const stored = structuredClone(await input.readForCalculation({ resultRef: runId, kind: "scenario" }, context))
    if (stored.status !== "ok") return stored
    if (stored.value.kind !== "scenario" || !sourceClosure(stored.value.result, stored.value.sourceRefs, context, !!input.nested)) return { status: "unavailable", reason: "calculation-source-closure-invalid" }
    if (stored.value.resultRef !== runId || stored.value.requestDigest !== digestSfValue(binding.value.request) || stored.value.resultDigest !== digestSfValue(stored.value.result) || !stored.value.sourceRefs.length) return { status: "stale", reason: "calculation-binding-changed" }
    if (input.nested && !await verifyCalculationRequestSources(binding.value.request, stored.value, context)) return { status: "unavailable", reason: "calculation-nested-evidence-unproven" }
    const simulate = input.nested?.replayScenario ?? input.replayRecordOnly
    const reproduced = structuredClone(await simulate(structuredClone(binding.value.request), context))
    if (reproduced.status !== "ok") return reproduced
    if (!sourceClosure(reproduced.value, stored.value.sourceRefs, context, !!input.nested) || plannerScenarioDigest(reproduced.value) !== plannerScenarioDigest(stored.value.result)) return { status: "stale", reason: "calculation-replay-changed" }
    const latestBinding = structuredClone(await input.loadRecordOnlyRequest(runId, context))
    const latest = structuredClone(await input.readForCalculation({ resultRef: runId, kind: "scenario" }, context))
    const replayAgain = structuredClone(await simulate(structuredClone(binding.value.request), context))
    if (latestBinding.status !== "ok" || digestSfValue(latestBinding.value) !== digestSfValue(binding.value) || latest.status !== "ok" || digestSfValue(latest.value) !== digestSfValue(stored.value) || replayAgain.status !== "ok" || !sourceClosure(replayAgain.value, stored.value.sourceRefs, context, !!input.nested) || plannerScenarioDigest(replayAgain.value) !== plannerScenarioDigest(reproduced.value) || input.nested && !await verifyCalculationRequestSources(binding.value.request, stored.value, context) || http.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "calculation-or-authority-changed" }
    const value: CalculationEvidence = { schema: "sf-evidence-v1", kind: "calculation", refId: `planner-calculation:${encodeURIComponent(runId)}`, installationId: context.binding.installationId, projectId: context.binding.projectId, refDigest: "", evidenceLevel: "proposal", target: { calculationId: "planner:scenario", runId, engineVersion: binding.value.engineVersion, inputDigest: stored.value.requestDigest, resultDigest: stored.value.resultDigest, sourceRefs: stored.value.sourceRefs, period: stored.value.result.horizon, currency: stored.value.result.currency } }
    return { status: "ok", value: { ...value, refDigest: digestSfEvidenceRef(value) } }
  }
  const issue = async (runId: string, context: TrustedDomainContext): Promise<PortResult<CalculationEvidence>> => {
    if (typeof runId !== "string" || !runId.trim()) return { status: "denied", reason: "calculation-authority-unavailable" }
    const key = digestSfValue(context.binding)
    const parent = ancestry.getStore()
    const runs = parent?.binding === key ? parent.runs : new Set<string>()
    if (runs.has(runId) || runs.size >= 16) return { status: "unavailable", reason: "calculation-replay-cycle" }
    return ancestry.run({ binding: key, runs: new Set([...runs, runId]), checks: parent?.binding === key ? parent.checks : new Set<string>() }, async (): Promise<PortResult<CalculationEvidence>> => {
      try { return await replay(runId, context) }
      catch { return { status: "unavailable", reason: "calculation-replay-unavailable" } }
    })
  }
  const resolve = async (reference: string, context: TrustedDomainContext): Promise<PortResult<CalculationEvidence>> => {
    const match = /^planner-calculation:([^:]+)$/.exec(reference)
    if (!match) return { status: "unavailable", reason: "calculation-reference-invalid" }
    const runId = (() => { try { return decodeURIComponent(match[1]!) } catch { return "" } })()
    if (!runId || encodeURIComponent(runId) !== match[1]) return { status: "unavailable", reason: "calculation-reference-invalid" }
    return issue(runId, context)
  }
  return { issue, resolve, verifyCalculationSources, verifyCalculationRequestSources }
}

function sourceClosure(result: ScenarioResult, sources: readonly BusinessEvidenceRef[], context: TrustedDomainContext, nested: boolean) {
  if (!decodeSfOperationOutput("sf_scenario_simulate", result).ok || !decodeSfOperationOutput("sf_scenario_simulate", { ...result, sourceRefs: sources }).ok) return false
  const refs = [...result.sourceRefs, ...result.costCoverage.evaluatedSourceRefs, ...result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
  if (!sources.length || !refs.length || !nested && [...sources, ...refs].some((ref) => ref.kind !== "record")) return false
  // The shared traversal rejects cyclic/tampered graphs before a canonical digest can recurse.
  sfEvidenceSourceMaps([...sources, ...refs])
  const graph = evidenceGraph([...sources, ...refs])
  if (graph.some((ref) => ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId)) return false
  if (refs.some((ref) => !sources.some((source) => source.refDigest === ref.refDigest))) return false
  return result.components.every((component) => component.sourceRefs.every((ref) => graph.some((source) => source.kind === "record" && source.target.surface === ref.surface && source.target.recordType === ref.type && source.target.recordId === ref.id && source.target.incarnation === ref.incarnation && source.target.version === ref.version && ref.fields.every((field) => source.target.fields.includes(field)))))
}

function completeSources(result: ScenarioResult, sources: readonly BusinessEvidenceRef[]) {
  return [...sources, ...result.sourceRefs, ...result.costCoverage.evaluatedSourceRefs, ...result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
    .filter((ref, index, refs) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index)
}

function evidenceGraph(refs: readonly BusinessEvidenceRef[]): readonly BusinessEvidenceRef[] {
  sfEvidenceSourceMaps(refs)
  return refs.flatMap((ref) => [ref, ...(ref.kind === "calculation" ? evidenceGraph(ref.target.sourceRefs) : ref.kind === "case-event" ? evidenceGraph(ref.target.evidenceRefs) : [])])
    .filter((ref, index, all) => all.findIndex((other) => other.refDigest === ref.refDigest) === index)
}
