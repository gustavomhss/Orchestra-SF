import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService } from "../contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost, PlannerPort, PlannerSourceHost } from "../contracts/ports.ts"
import type { PortfolioRequest } from "../contracts/operations.ts"
import type { PortfolioResult } from "../contracts/decisions.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { sfRunSourceFence } from "../ai/run-store.ts"
import type { StoredDecisionResult, createSfDecisionResultStore } from "../decisions/result-store.ts"
import type { PortfolioBinding } from "../decisions/portfolio-bindings.ts"
import type { CriterionResultBinding } from "../decisions/criterion-rules.ts"
import type { PlannerDirectIntervalProof } from "../decisions/coverage-interval.ts"
import type { createPlannerSensitivityUnits } from "../planner/sensitivity-units.ts"
import { createPlannerIntervalProof } from "../planner/interval-proof.ts"
import { plannerScenarioDigest } from "../planner/preview-comparison.ts"
import { createSensitivityEvaluator, quantifiedSensitivityScenario } from "./sensitivity.ts"
import { finalizePlannerSensitivity, plannerSensitivityScenario } from "./planner-sensitivity.ts"
import { validatePlannerThreshold } from "./threshold-proof.ts"
import type { KnownSubtotalThreshold } from "./threshold-proof.ts"
import type { createPlannerSensitivity, SensitivityDisclosureFormat } from "./planner-sensitivity.ts"
import type { CriterionComparisonBinding } from "../decisions/criterion-comparison.ts"
import { createProductionPortfolio } from "./production.ts"
import { portfolioResultDigest } from "./result-store.ts"

/** Reproduce a bound portfolio or comparison using only authorized reads and Planner previews. */
export function createPortfolioProofVerifier(input: {
  cases: DecisionCasePort
  planner: PlannerPort
  sources: PlannerSourceHost
  evidence: BusinessContextService
  results: ReturnType<typeof createSfDecisionResultStore>
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
  readSourceFences: (context: TrustedDomainContext) => Promise<{ dashboard: string; planner: string; procurement: string } | undefined>
  lockedSourceFences: () => { dashboard: string; planner: string; procurement: string } | undefined
  caseFor: Parameters<typeof createProductionPortfolio>[0]["persistence"]["caseFor"]
  idempotencyKey: Parameters<typeof createProductionPortfolio>[0]["persistence"]["idempotencyKey"]
  decisions: Parameters<typeof createProductionPortfolio>[0]["decisions"]
  createReceipt: Parameters<typeof createProductionPortfolio>[0]["createReceipt"]
  candidateCoverageRefFor: NonNullable<Parameters<typeof createProductionPortfolio>[0]["candidateCoverageRefFor"]>
  coverageRefFor?: Parameters<typeof createProductionPortfolio>[0]["coverageRefFor"]
  revalidateAnalysis: NonNullable<Parameters<typeof createProductionPortfolio>[0]["analysis"]>["revalidate"]
  units: ReturnType<typeof createPlannerSensitivityUnits>
  sensitivityPreview: Parameters<typeof createPlannerSensitivity>[0]["preview"]
  exactThreshold?: Parameters<typeof createPlannerSensitivity>[0]["exactThreshold"]
  coveragePreview?: Parameters<typeof createPlannerSensitivity>[0]["coveragePreview"]
  /** Private root composition only. Every reader/producer must use this same
   * LocalStore, whose nested transactions are detached read-only snapshots.
   * One invocation gets one new scope; no numerical or authority proof is reused.
   * Providers outside that store still require all existing fresh checks. */
  sensitivityReadScope?: Pick<DomainPortHost, "persistence" | "requestFor" | "revalidate">
}) {
  const proveSensitivityInterval = createPlannerIntervalProof({ units: input.units, preview: (request, context) => input.sensitivityPreview(request, context) })
  type SourceFenceCapture = { digest: string; planner: string; expires: number }
  type StagedCapture = { key: string; value: SourceFenceCapture }
  const fences = new Map<string, SourceFenceCapture>()
  const sensitivityAttempts = new Map<string, symbol>()
  const key = (binding: PortfolioBinding | CriterionComparisonBinding | CriterionResultBinding, context: TrustedDomainContext) => digestSfValue({ binding: binding.bindingDigest, installation: context.binding.installationId, project: context.binding.projectId, principal: context.binding.principalRef, revision: context.binding.accessRevision, policy: context.binding.policyVersion })
  const capture = async (binding: PortfolioBinding | CriterionComparisonBinding | CriterionResultBinding, context: TrustedDomainContext, expected: string, stage?: (capture: StagedCapture) => void) => {
    const current = await input.readSourceFences(context)
    if (!current || digestSfValue(current) !== expected || !await input.revalidate(context)) return false
    const now = Date.now()
    for (const [ref, fence] of fences) if (fence.expires <= now) fences.delete(ref)
    if (fences.size >= 2048 && !fences.has(key(binding, context))) return false
    const entry = { key: key(binding, context), value: { digest: expected, planner: current.planner, expires: now + 30_000 } }
    if (stage) stage(entry)
    else fences.set(entry.key, entry.value)
    return await input.revalidate(context)
  }
  const replayPortfolio = async (request: PortfolioRequest, portfolio: PortfolioResult, context: TrustedDomainContext) => {
    const initial = await input.readSourceFences(context)
    if (!initial) return false
    const initialFence = digestSfValue(initial)
    const analysis: NonNullable<Parameters<typeof createProductionPortfolio>[0]["analysis"]> = {
      evaluate: async (request, trusted) => {
        const id = digestSfValue({ candidates: request.candidates.map((candidate) => candidate.ref), operations: request.scenario.operations })
        const found = portfolio.combinations.filter((combination) => combination.id === id)
        if (found.length !== 1) return { status: "stale", reason: "portfolio-combination-changed" }
        const item = found[0]!
        if (!item.analysis) return { status: "unavailable", reason: "portfolio-analysis-not-yet-persisted" }
        if (!await input.revalidateAnalysis(item.analysis, trusted)) return { status: "stale", reason: "portfolio-analysis-changed" }
        const comparison = item.analysis.comparison
        if (request.portfolio.constraints.some((ref) => !comparison.criterionResults.some((criterion) => criterion.criterionId === ref))) return { status: "stale", reason: "portfolio-criteria-changed" }
        return { status: "ok", value: { analysis: item.analysis, constraints: request.portfolio.constraints.map((ref) => { const criterion = comparison.criterionResults.find((value) => value.criterionId === ref)!; return { ref, state: criterion.state, reason: criterion.reason } }) } }
      },
      revalidate: input.revalidateAnalysis,
    }
    const port = createProductionPortfolio({ cases: input.cases, planner: input.planner, sources: input.sources, evidence: input.evidence, revalidate: input.revalidate, analysis, candidateCoverageRefFor: input.candidateCoverageRefFor, coverageRefFor: input.coverageRefFor, decisions: input.decisions, createReceipt: input.createReceipt, persistence: { results: input.results, caseFor: input.caseFor, idempotencyKey: input.idempotencyKey }, enabledOperations: [] }).port
    const replay = await port.evaluate(request, context)
    const latest = await input.readSourceFences(context)
    return replay.status === "ok" && portfolioResultDigest(replay.value) === portfolioResultDigest(portfolio) && !!latest && digestSfValue(latest) === initialFence && await input.revalidate(context)
  }
  const verifyPortfolio = async (binding: PortfolioBinding, stored: StoredDecisionResult, context: TrustedDomainContext) => {
    if (stored.kind !== "portfolio" || stored.resultRef !== binding.resultRef || stored.requestDigest !== digestSfValue(binding.request) || stored.resultDigest !== digestSfValue(stored.result) || digestSfValue(stored.caseRef) !== digestSfValue(binding.caseRef)) return false
    const initial = await input.readSourceFences(context)
    if (!initial) return false
    const initialFence = digestSfValue(initial)
    return await replayPortfolio(binding.request, stored.result, context) && await capture(binding, context, initialFence)
  }
  const verifyComparison = async (binding: CriterionComparisonBinding, stored: StoredDecisionResult, context: TrustedDomainContext) => {
    if (stored.kind !== "comparison" || stored.resultRef !== binding.resultRef || stored.requestDigest !== digestSfValue(binding.request) || stored.resultDigest !== digestSfValue(stored.result) || digestSfValue(stored.caseRef) !== digestSfValue(binding.caseRef)) return false
    const initial = await input.readSourceFences(context)
    if (!initial) return false
    const initialFence = digestSfValue(initial)
    const current = await input.planner.compareScenarios(binding.request, context)
    return current.status === "ok" && digestSfValue(current.value) === stored.resultDigest && await capture(binding, context, initialFence)
  }
  const replaySensitivity = async (binding: CriterionResultBinding, stored: StoredDecisionResult, context: TrustedDomainContext, stage?: (capture: StagedCapture) => void) => {
    if (stored.kind !== "sensitivity" || stored.resultRef !== binding.resultRef || stored.requestDigest !== digestSfValue(binding.request) || stored.resultDigest !== digestSfValue(stored.result) || digestSfValue(stored.caseRef) !== digestSfValue(binding.caseRef)) return false
    const expectedResult = stored.result
    const initial = await input.readSourceFences(context)
    if (!initial) return false
    const initialFence = digestSfValue(initial)
    const issued = structuredClone(await input.units.resolve(binding.request, context))
    if (issued.status !== "ok" || issued.value.ruleRef !== binding.ruleRef || issued.value.ruleVersion !== binding.ruleVersion || digestSfValue(issued.value.caseRef) !== digestSfValue(binding.caseRef)) return false
    const unitBinding = issued.value
    const source = structuredClone(await input.results.readHistoricalScenario({ resultRef: binding.request.scenarioRef }, context))
    const baseline = structuredClone(await input.results.readHistoricalScenario({ resultRef: unitBinding.baselineRef }, context))
    if (source.status !== "ok" || baseline.status !== "ok" || source.value.kind !== "scenario" || baseline.value.kind !== "scenario" || source.value.resultRef !== binding.request.scenarioRef || baseline.value.resultRef !== unitBinding.baselineRef || source.value.requestDigest !== digestSfValue(unitBinding.scenario) || [source.value, baseline.value].some((value) => value.resultDigest !== digestSfValue(value.result) || value.caseRef.id !== binding.caseRef.id || value.caseRef.incarnation !== binding.caseRef.incarnation || value.caseRef.version > binding.caseRef.version)) return false
    const sourceScenario = source.value.result
    const baselineScenario = baseline.value.result
    const interval = input.coveragePreview ? structuredClone(await input.coveragePreview.issue(structuredClone(binding.request), unitBinding.baselineRef, context)) : undefined
    if (interval && interval.status !== "ok" && interval.status !== "unavailable") return false
    const samples: { resultRef: string; coverageRefs: readonly string[]; conditions: readonly string[]; complete: boolean }[] = []
    const exact: { value?: KnownSubtotalThreshold; structural?: PlannerDirectIntervalProof } = {}
    const certify = (certificate: Parameters<typeof validatePlannerThreshold>[0]["certificate"], trusted: TrustedDomainContext) => validatePlannerThreshold({ request: binding.request, binding: unitBinding, source: sourceScenario, baseline: baselineScenario, certificate, structural: exact.structural, preview: input.sensitivityPreview, context: trusted })
    const evaluate = createSensitivityEvaluator({
      sample: async (_request, value, trusted) => {
        const point = expectedResult.evaluated[samples.length]
        if (!point || point.parameterValue !== value) return { status: "stale", reason: "sensitivity-sample-changed" }
        const scenario = plannerSensitivityScenario(unitBinding, binding.request.parameterBounds.parameterRef, value)
        const saved = structuredClone(await input.results.read({ kind: "scenario", resultRef: point.resultRef }, trusted))
        if (saved.status !== "ok") return saved
        const preview = structuredClone(await input.sensitivityPreview({ baselineRef: unitBinding.baselineRef, scenario: structuredClone(scenario) }, trusted))
        if (preview.status !== "ok") return preview
        if (saved.value.kind !== "scenario" || digestSfValue(saved.value.caseRef) !== digestSfValue(binding.caseRef) || saved.value.requestDigest !== digestSfValue(scenario) || plannerScenarioDigest(saved.value.result) !== plannerScenarioDigest(preview.value.sample) || preview.value.metric.metricRef !== "planner:known-subtotal-difference" || preview.value.metric.state !== "conditioned" || !preview.value.metric.evidenceRefs.length || digestSfValue(preview.value.metric.period) !== digestSfValue(preview.value.sample.horizon) || digestSfValue(preview.value.comparison.costCoverageRefs) !== digestSfValue([unitBinding.baselineCoverageRef]) || preview.value.comparison.comparisonStatus === "incompatible" || preview.value.comparison.comparisonStatus === "unavailable" || preview.value.metric.unit !== unitBinding.resultUnit || preview.value.metric.engineVersion !== unitBinding.engineVersion || preview.value.metric.value !== point.value || preview.value.comparison.knownDifference !== point.value || preview.value.comparison.baselineResultRef !== unitBinding.baselineRef || preview.value.comparison.alternativeResultRef !== preview.value.sample.id) return { status: "stale", reason: "sensitivity-sample-changed" }
        const qualified = interval?.status === "ok" && input.coveragePreview ? structuredClone(await input.coveragePreview.qualify(interval.value.intervalRef, value, preview.value, trusted)) : undefined
        if (qualified && qualified.status !== "ok") return qualified
        const qualification = qualified?.status === "ok" ? qualified.value : undefined
        samples.push({ resultRef: point.resultRef, coverageRefs: preview.value.comparison.costCoverageRefs, conditions: qualification ? preview.value.comparison.unresolvedConditions.filter((condition) => ![...qualification.resolvedCoverageConditions, ...qualification.hypotheticalConditions].includes(condition)) : preview.value.comparison.unresolvedConditions, complete: !!qualification || (preview.value.comparison.comparisonStatus === "complete" && preview.value.sample.costCoverage.coverageState === "complete") })
        return { status: "ok", value: { resultRef: point.resultRef, scenario: saved.value.result, criterionValue: point.value, parameterUnit: unitBinding.parameterUnit, resultUnit: unitBinding.resultUnit, unitMetadataRef: unitBinding.unitMetadataRef, unitMetadataVersion: unitBinding.unitMetadataVersion, ...(qualification ? { coverageQualification: qualification } : {}) } }
      },
      exactThreshold: async (_request, trusted) => {
        if (!input.exactThreshold || !quantifiedSensitivityScenario(sourceScenario) || !quantifiedSensitivityScenario(baselineScenario)) return { status: "unavailable", reason: "exact-threshold-not-proven" }
        if (expectedResult.thresholdEvidence.state === "exact") {
          // The persisted number is a candidate, never a reused proof. Rebuild
          // its current domain and verify its accepted/rejected IEEE boundary.
          if (expectedResult.threshold !== expectedResult.thresholdEvidence.value) return { status: "unavailable", reason: "exact-threshold-certificate-incompatible" }
          const structural = interval?.status === "ok"
            ? { status: "ok" as const, value: structuredClone(interval.value.structural) }
            : structuredClone(await proveSensitivityInterval(structuredClone(binding.request), unitBinding.baselineRef, trusted))
          if (structural.status !== "ok") return structural
          exact.structural = structural.value
          // Finance's finalizer reconstructs the complete evidence union below;
          // neither the stored refs nor their self-hash authorize this candidate.
          const certificate = await certify({ value: expectedResult.thresholdEvidence.value, evidenceRefs: structural.value.sourceRefs }, trusted)
          if (certificate.status === "ok") exact.value = certificate.value
          return certificate
        }
        const result = structuredClone(await input.exactThreshold(structuredClone(binding.request), structuredClone(unitBinding), trusted))
        if (result.status !== "ok") return result
        const certificate = await certify(result.value, trusted)
        if (certificate.status === "ok") exact.value = certificate.value
        return certificate
      },
      revalidate: async (_samples, _threshold, trusted) => {
        if (!await input.units.revalidate(unitBinding, trusted) || samples.length !== expectedResult.evaluated.length) return false
        const currentSource = structuredClone(await input.results.readHistoricalScenario({ resultRef: binding.request.scenarioRef }, trusted))
        const currentBaseline = structuredClone(await input.results.readHistoricalScenario({ resultRef: unitBinding.baselineRef }, trusted))
        if (currentSource.status !== "ok" || currentBaseline.status !== "ok" || digestSfValue(currentSource.value) !== digestSfValue(source.value) || digestSfValue(currentBaseline.value) !== digestSfValue(baseline.value)) return false
        if (interval?.status === "ok" && (!input.coveragePreview || !await input.coveragePreview.revalidate(interval.value.intervalRef, trusted))) return false
        if (!exact.value) return true
        if (!input.exactThreshold) return false
        if (exact.structural) {
          const structural = structuredClone(await proveSensitivityInterval(structuredClone(binding.request), unitBinding.baselineRef, trusted))
          if (structural.status !== "ok" || digestSfValue(structural.value) !== digestSfValue(exact.structural)) return false
          const certificate = await certify({ value: exact.value.value, evidenceRefs: structural.value.sourceRefs }, trusted)
          return certificate.status === "ok" && digestSfValue(certificate.value) === digestSfValue(exact.value) && await input.units.revalidate(structuredClone(unitBinding), trusted)
        }
        const current = structuredClone(await input.exactThreshold(structuredClone(binding.request), structuredClone(unitBinding), trusted))
        if (current.status !== "ok") return false
        const certificate = await certify(current.value, trusted)
        return certificate.status === "ok" && digestSfValue(certificate.value) === digestSfValue(exact.value)
      },
      verifyCoverageQualification: input.coveragePreview?.verify,
    })
    const sampled = await evaluate(binding.request, context)
    if (sampled.status !== "ok") return false
    // Reconstruct only explicit historical serializers from current domain inputs.
    // No stored condition/evidence array is used as a producer, and each candidate
    // must match the full stored digest after all Finance certification callbacks.
    const componentsDisclosure = expectedResult.unresolvedConditions.some((condition) => condition.id === "known-components-threshold")
    const subtotalDisclosure = expectedResult.unresolvedConditions.some((condition) => condition.id === "known-subtotal-threshold")
    const formats: readonly SensitivityDisclosureFormat[] = componentsDisclosure
      ? [subtotalDisclosure ? "union-v1" : "pr37-v1"]
      : subtotalDisclosure ? ["intelligence-v1"] : ["union-v1", "bundle-v1", "intelligence-v1"]
    const originalScenarios = sampled.value.comparisonStatus === "complete" ? [] : [{ resultRef: binding.request.scenarioRef, scenario: sourceScenario, coverageRef: unitBinding.scenarioCoverageRef }, { resultRef: unitBinding.baselineRef, scenario: baselineScenario, coverageRef: unitBinding.baselineCoverageRef }]
    const matches = formats.some((disclosureFormat) => {
      const result = finalizePlannerSensitivity({ request: binding.request, binding: unitBinding, result: sampled.value, samples, baselineRefs: baseline.value.sourceRefs, exact: exact.value, originalScenarios, disclosureFormat })
      return result.status === "ok" && digestSfValue(result.value) === stored.resultDigest
    })
    return matches && await capture(binding, context, initialFence, stage)
  }
  const verifySensitivity = async (incomingBinding: CriterionResultBinding, incomingStored: StoredDecisionResult, context: TrustedDomainContext) => {
    const host = input.sensitivityReadScope
    if (!host) return replaySensitivity(incomingBinding, incomingStored, context)
    let fenceKey: string | undefined
    let attempt: symbol | undefined
    let published = false
    try {
      // A failed new attempt must not leave a prior successful grant usable for
      // the same binding/authority. Concurrent attempts cannot publish out of order.
      fenceKey = key(incomingBinding, context)
      fences.delete(fenceKey)
      if (sensitivityAttempts.size >= 2048 && !sensitivityAttempts.has(fenceKey)) return false
      attempt = Symbol("sensitivity-read-scope")
      sensitivityAttempts.set(fenceKey, attempt)
      const bindingDigest = digestSfValue(incomingBinding)
      const storedDigest = digestSfValue(incomingStored)
      const authorityDigest = digestSfValue({ kind: context.kind, binding: context.binding })
      const binding = structuredClone(incomingBinding)
      const stored = structuredClone(incomingStored)
      const persistence = host.persistence
      const transaction = persistence.transaction
      const currentSnapshots = persistence.currentSnapshots
      const requestFor = host.requestFor
      const revalidate = host.revalidate
      const request = host.requestFor(context)
      // A nested read can finish before its owner's root subsequently fails.
      // Only a new root owned by this invocation can authorize publication here.
      if (!request || request.signal.aborted || !currentSnapshots || currentSnapshots.call(persistence) !== undefined) return false
      const requestFingerprint = () => {
        const headers: [string, string][] = []
        request.headers.forEach((value, name) => headers.push([name, value]))
        return digestSfValue({ method: request.method, url: request.url, headers: headers.sort(([left], [right]) => left.localeCompare(right)) })
      }
      const requestDigest = requestFingerprint()
      const unchanged = () => !request.signal.aborted && input.sensitivityReadScope === host && host.persistence === persistence &&
        persistence.transaction === transaction && persistence.currentSnapshots === currentSnapshots &&
        host.requestFor === requestFor && host.revalidate === revalidate && host.requestFor(context) === request && requestFingerprint() === requestDigest &&
        sensitivityAttempts.get(fenceKey!) === attempt && digestSfValue({ kind: context.kind, binding: context.binding }) === authorityDigest &&
        digestSfValue(incomingBinding) === bindingDigest && digestSfValue(incomingStored) === storedDigest &&
        digestSfValue(binding) === bindingDigest && digestSfValue(stored) === storedDigest
      let invocations = 0
      let workAccepted = false
      const staged: { capture?: StagedCapture } = {}
      const accepted = await persistence.transaction("planner", async () => {
        invocations++
        if (invocations !== 1 || !currentSnapshots.call(persistence) || !unchanged() || !await host.revalidate(context) || !unchanged()) return { commit: false, value: false }
        const replayed = await replaySensitivity(binding, stored, context, (entry) => {
          if (staged.capture || entry.key !== fenceKey) throw new Error("Sensitivity source fence capture changed")
          staged.capture = entry
        })
        // All asynchronous authority observations finish inside the immutable root.
        // LocalStore can still refuse this value for a swallowed nested write.
        workAccepted = replayed && unchanged() && await host.revalidate(context) && unchanged() && !!currentSnapshots.call(persistence)
        return { commit: false, value: workAccepted }
      }, { signal: request.signal })
      const entry = staged.capture
      if (!accepted || !workAccepted || invocations !== 1 || !entry || entry.key !== fenceKey || !unchanged()) return false
      const now = Date.now()
      for (const [ref, value] of fences) if (value.expires <= now) fences.delete(ref)
      if (entry.value.expires <= now || fences.size >= 2048 && !fences.has(fenceKey)) return false
      // No awaited callback follows publication. A rejected/aborted/poisoned root
      // never publishes its staged capture and never reuses an earlier grant.
      fences.set(fenceKey, entry.value)
      published = true
      return true
    } catch {
      return false
    } finally {
      if (fenceKey && attempt && sensitivityAttempts.get(fenceKey) === attempt) {
        sensitivityAttempts.delete(fenceKey)
        if (!published) fences.delete(fenceKey)
      }
    }
  }
  const verifySnapshot = (snapshot: Snapshot, binding: PortfolioBinding | CriterionComparisonBinding | CriterionResultBinding, context: TrustedDomainContext) => {
    const saved = fences.get(key(binding, context))
    const current = input.lockedSourceFences()
    return !!saved && !!current && saved.expires > Date.now() && saved.planner === sfRunSourceFence(snapshot) && saved.digest === digestSfValue(current)
  }
  return { replayPortfolio, verifyPortfolio, verifyComparison, verifySensitivity, verifySnapshot }
}
