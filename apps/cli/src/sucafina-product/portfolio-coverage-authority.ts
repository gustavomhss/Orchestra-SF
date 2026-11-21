import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { projectionDigest, resolvePlannerScenarioBatch } from "../../../../modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts"
import type { createPortfolioCoveragePreview, PortfolioCoverageAuthority } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/coverage-preview.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfPortfolioAuthority } from "./portfolio-authority.ts"

type Resolver = Parameters<typeof createPortfolioCoveragePreview>[0]["resolveAuthority"]
type Data = Omit<PortfolioCoverageAuthority, "isStillValid">
type Observation = { data: Data; digest: string }

/** Read original C08 records and public producers afresh; no completeness is inferred here. */
export function createSfPortfolioCoverageAuthority(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  registries: Pick<ReturnType<typeof createSfPortfolioAuthority>, "selection" | "rules">
}): Resolver {
  const { authority, business, registries } = input
  const host = authority.host
  return async (incoming, baselineRef, call) => {
    try {
      const request = structuredClone(incoming)
      const source = host.requestFor(call)
      const binding = digestSfValue([call.kind, call.binding])
      const transport = source && requestDigest(source)
      const intact = (trusted: TrustedDomainContext) => trusted === call && !!source && host.requestFor(trusted) === source &&
        !source.signal.aborted && requestDigest(source) === transport && digestSfValue([trusted.kind, trusted.binding]) === binding &&
        digestSfValue(incoming) === digestSfValue(request)
      const scenarios = business.plannerProduct.scenarios
      if (!source || !scenarios || !intact(call) || !await host.revalidate(call)) return { status: "denied", reason: "portfolio-coverage-authority-unavailable" }
      const observe = async (): Promise<PortResult<Observation>> => {
        if (!intact(call) || !await host.revalidate(call)) return { status: "denied", reason: "portfolio-coverage-authority-unavailable" }
        const selected = await business.resolveCase(call)
        if (selected.status !== "ok") return selected
        const caseRef = structuredClone(selected.value)
        const fences = await business.readSourceFences(call)
        const authorized = await business.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
        if (authorized.status !== "ok") return authorized
        // The public case projection redacts prepared commands. The certificate
        // receives the exact full case only after current C17 and C08 admission.
        const current = await authority.state.read(source, "cases", (state, actor) => {
          const decision = state.cases[caseRef.id]
          return decision && actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision &&
            actor.policyVersion === call.binding.policyVersion && decision.incarnation === caseRef.incarnation && decision.version === caseRef.version &&
            decision.participants.includes(actor.principalRef) && intact(call)
            ? { decision: structuredClone(decision), stateDigest: digestSfValue(state) } : undefined
        })
        if (!fences || current.status !== "ok" || !current.value || authorized.value.case.id !== caseRef.id ||
          authorized.value.case.incarnation !== caseRef.incarnation || authorized.value.case.version !== caseRef.version)
          return { status: "denied", reason: "portfolio-coverage-case-unavailable" }
        const decision = current.value.decision
        const selection = await registries.selection.read({ caseRef }, call)
        if (selection.status !== "ok") return selection.status === "needs-input" && selection.reason === "selection-not-created"
          ? { status: "unavailable", reason: "portfolio-coverage-selection-unavailable" } : selection
        if (selection.value.baselineRef !== baselineRef || selection.value.alternativeRef !== request.scenarioRef ||
          !selection.value.criteria.includes(request.criterion.id)) return { status: "unavailable", reason: "portfolio-coverage-selection-mismatch" }
        const rule = await registries.rules.resolve({ caseRef, criterionId: request.criterion.id }, call)
        if (rule.status !== "ok") return rule
        if (rule.value.operator !== request.criterion.operator || rule.value.value !== request.criterion.value)
          return { status: "unavailable", reason: "portfolio-coverage-rule-mismatch" }
        const stored = await business.results.readHistoricalScenario({ resultRef: request.scenarioRef }, call)
        const baselineStored = await business.results.readHistoricalScenario({ resultRef: baselineRef }, call)
        if (stored.status !== "ok") return stored
        if (baselineStored.status !== "ok") return baselineStored
        if (stored.value.kind !== "scenario" || baselineStored.value.kind !== "scenario" || [stored.value, baselineStored.value].some((value) =>
          value.caseRef.id !== caseRef.id || value.caseRef.incarnation !== caseRef.incarnation || value.caseRef.version > caseRef.version ||
          value.resultDigest !== digestSfValue(value.result))) return { status: "unavailable", reason: "portfolio-coverage-result-unbound" }
        const alternatives = decision.alternatives.filter((value) => value.id === selection.value.alternativeId)
        const baselines = decision.alternatives.filter((value) => value.id === selection.value.baselineAlternativeId)
        const alternative = alternatives[0]
        const baseline = baselines[0]
        if (alternatives.length !== 1 || baselines.length !== 1 || !alternative || !baseline || alternative.id === baseline.id ||
          digestSfValue(alternative.scenario) !== stored.value.requestDigest || digestSfValue(alternative.result) !== stored.value.resultDigest ||
          digestSfValue(baseline.scenario) !== baselineStored.value.requestDigest || digestSfValue(baseline.result) !== baselineStored.value.resultDigest)
          return { status: "unavailable", reason: "portfolio-coverage-alternatives-unbound" }
        const [resolved, baselineResolved] = await resolvePlannerScenarioBatch(scenarios, [request.scenarioRef, baselineRef], call)
        if (resolved.status !== "ok") return resolved
        if (baselineResolved.status !== "ok") return baselineResolved
        if (digestSfValue(resolved.value.result) !== stored.value.resultDigest || digestSfValue(baselineResolved.value.result) !== baselineStored.value.resultDigest)
          return { status: "stale", reason: "portfolio-coverage-scenarios-changed" }
        const classification = await business.baselineCoverage.readClassification(alternative.scenario.baseRef, call)
        const baselineClassification = await business.baselineCoverage.readClassification(baseline.scenario.baseRef, call)
        if (classification.status !== "ok") return classification
        if (baselineClassification.status !== "ok") return baselineClassification
        const bases = decision.costCoverageBases.filter((basis) => basis.id === alternative.result.costCoverage.basisId && basis.version === alternative.result.costCoverage.basisVersion)
        const basis = bases[0]
        if (bases.length !== 1 || !basis || [classification.value.basis, baselineClassification.value.basis, resolved.value.basis, baselineResolved.value.basis]
          .some((value) => digestSfValue(value) !== digestSfValue(basis))) return { status: "unavailable", reason: "portfolio-coverage-basis-mismatch" }
        const refs = uniqueRefs([...decision.sourceRefs, ...basis.sourceRefs, ...rule.value.evidenceRefs, ...(rule.value.sensitivity?.sourceRefs ?? []),
          classification.value.source, baselineClassification.value.source, ...[alternative.result, baseline.result].flatMap((result) =>
            [...result.sourceRefs, ...result.costCoverage.evaluatedSourceRefs, ...result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]),
          ...[classification.value, baselineClassification.value].flatMap((value) => [...value.mappings.flatMap((mapping) => mapping.entry.evidenceRefs),
            ...(value.notApplicableEntries?.flatMap((entry) => entry.evidenceRefs) ?? [])])])
        if (!refs.length || refs.some((ref) => ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId ||
          ref.refDigest !== digestSfEvidenceRef(ref))) return { status: "denied", reason: "portfolio-coverage-evidence-unbound" }
        const evidence = structuredClone(await business.context.context({ refs: structuredClone(refs) }, call))
        const evidenceDigests = new Set(evidence.map((item) => digestSfValue(item.ref)))
        if (evidence.length !== refs.length || evidenceDigests.size !== refs.length ||
          refs.some((ref) => !evidenceDigests.has(digestSfValue(ref))) ||
          evidence.some((item) => item.state !== "fresh" || item.accessRevision !== call.binding.accessRevision || !item.currentRef ||
            digestSfValue(item.currentRef) !== digestSfValue(item.ref) || !Number.isFinite(Date.parse(item.checkedAt))))
          return { status: "unavailable", reason: "portfolio-coverage-evidence-unavailable" }
        const latest = await business.resolveCase(call)
        const finalFences = await business.readSourceFences(call)
        if (latest.status !== "ok" || digestSfValue(latest.value) !== digestSfValue(caseRef) || !finalFences ||
          digestSfValue(finalFences) !== digestSfValue(fences) || !await host.revalidate(call) || !intact(call))
          return { status: "stale", reason: "portfolio-coverage-authority-changed" }
        const stateDigest = current.value.stateDigest
        const finalState = await authority.state.read(source, "cases", (state, actor) => actor.principalRef === call.binding.principalRef &&
          actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion &&
          digestSfValue(state) === stateDigest && digestSfValue(business.lockedSourceFences()) === digestSfValue(fences) && intact(call))
        if (finalState.status !== "ok" || !finalState.value || !intact(call)) return { status: "stale", reason: "portfolio-coverage-authority-changed" }
        const data: Data = { decision, selection: selection.value, scenario: alternative.scenario, storedResult: stored.value.result,
          rule: rule.value, basis, classification: classification.value, baseline: { result: baselineStored.value.result, classification: baselineClassification.value }, evidence }
        return { status: "ok", value: { data, digest: digestSfValue({ ...data, evidence: evidence.map(evidenceIdentity), fences,
          stored: stored.value, baselineStored: baselineStored.value, scenarioProjection: projectionDigest(resolved.value.projection),
          baselineProjection: projectionDigest(baselineResolved.value.projection) }) } }
      }
      const first = await observe()
      if (first.status !== "ok") return first
      const second = await observe()
      if (second.status !== "ok") return second
      if (first.value.digest !== second.value.digest || !intact(call)) return { status: "stale", reason: "portfolio-coverage-authority-changed" }
      const expected = second.value.digest
      return { status: "ok", value: { ...structuredClone(second.value.data), isStillValid: async (trusted) => {
        if (!intact(trusted)) return false
        const latest = await observe()
        return latest.status === "ok" && latest.value.digest === expected && intact(trusted)
      } } }
    } catch { return { status: "unavailable", reason: "portfolio-coverage-authority-unavailable" } }
  }
}

function requestDigest(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers.entries()].sort(([a], [b]) => a.localeCompare(b)) }) }
function uniqueRefs(refs: readonly BusinessEvidenceRef[]) {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    const digest = digestSfValue(ref)
    if (seen.has(digest)) return false
    seen.add(digest)
    return true
  })
}
// checkedAt is an observation clock. Ref digests and current domain source fences
// bind the content; every observation still performs the actual authorization.
function evidenceIdentity(item: BusinessEvidenceResolution) { return { ref: item.ref, currentRef: item.currentRef, state: item.state, accessRevision: item.accessRevision, differences: item.differences } }
