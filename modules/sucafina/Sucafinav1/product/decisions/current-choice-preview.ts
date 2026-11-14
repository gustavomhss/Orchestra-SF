import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ChoiceRecord, DecisionCase, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { CurrentChoicePromotion } from "./current-choice-promotion.ts"
import type { createSfDecisionResultStore } from "./result-store.ts"
import type { createDecisionMutations } from "./mutations.ts"
import { encodeCaseRef } from "./case-port.ts"
import { reassessScenarioCoverage, validateScenarioCoverage } from "./cost-coverage.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
type Request = { caseRef: CaseRef; choiceId: string; alternativeRef: { id: string; version: number }; coverageRef: string }
export type CurrentChoiceBinding = { schema: "sf-current-choice-binding-v1"; promotion: CurrentChoicePromotion; originalSource: RecordEvidence; source: RecordEvidence; producerResultRef: string; producerResultDigest: string; recordDigest: string }
const key = (resultRef: string) => `sf:proposal-coverage:current-choice:${digestSfValue(resultRef)}`
const digest = (value: CurrentChoiceBinding) => digestSfValue(Object.fromEntries(Object.entries(value).filter(([name]) => name !== "recordDigest")))

/** Checks the private preview binding inside a caller's case transaction. */
export function verifyCurrentChoiceBinding(state: SfProductState, request: CurrentChoicePromotion, expectedDigest: string) {
  const value = state.preferences[key(request.resultRef)] as CurrentChoiceBinding | undefined
  return !!value && value.schema === "sf-current-choice-binding-v1" && value.recordDigest === digest(value) && digestSfValue(value) === expectedDigest && digestSfValue(value.promotion) === digestSfValue(request)
}

/** Prepare the exact C10 result for human review without modifying the original choice. */
export function createCurrentChoicePreview(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  sources: Pick<PlannerSourceHost, "resolveForecastCoverage">
  results: ReturnType<typeof createSfDecisionResultStore>
  coverageEvidence: NonNullable<Parameters<typeof createDecisionMutations>[0]["coverageEvidence"]>
  authorizeCase: (decision: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizePreview: (request: Request, context: TrustedDomainContext) => Promise<boolean>
  resimulate: (request: { caseRef: CaseRef; choice: ChoiceRecord }, context: TrustedDomainContext) => Promise<PortResult<{ resultRef: string; scenario: ScenarioRequest; result: ScenarioResult; choiceDigest: string; requestDigest: string; resultDigest: string; originalSource: RecordEvidence; source: RecordEvidence; fenceSnapshot: (snapshot: Snapshot) => boolean }>>
  registerCoverage: (request: { caseRef: string; expectedCaseVersion: number; basis: import("../contracts/decisions.ts").CostCoverageBasis; assessment: import("../contracts/decisions.ts").CostCoverageAssessment; result: ScenarioResult; scenario: ScenarioRequest }, context: TrustedDomainContext) => Promise<PortResult<{ coverageRef: string }>>
  verifySnapshot: (snapshot: Snapshot, request: Request, binding: CurrentChoiceBinding, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  writes: WeakSet<object>
}) {
  const prepare = async (incoming: Request, context: TrustedDomainContext): Promise<PortResult<{ promotion: CurrentChoicePromotion; bindingDigest: string }>> => {
    try {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (context.kind !== "ui" || !source || !operation || !request.choiceId.trim() || !request.coverageRef.trim() || !await input.authorizePreview(request, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "choice-preview-access-unavailable" }
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      if (current.status !== "ok" || !current.value || current.value.incarnation !== request.caseRef.incarnation || current.value.version !== request.caseRef.version || !current.value.participants.includes(context.binding.principalRef) || !await input.authorizeCase(current.value, context)) return { status: "denied", reason: "choice-preview-access-unavailable" }
      const decision = current.value
      const choices = decision.choices.filter((choice) => choice.id === request.choiceId && choice.alternativeId === request.alternativeRef.id)
      const alternatives = decision.alternatives.filter((item) => item.id === request.alternativeRef.id && item.version === request.alternativeRef.version)
      if (choices.length !== 1 || alternatives.length !== 1) return { status: "stale", reason: "choice-or-alternative-changed" }
      const preview = await input.resimulate({ caseRef: request.caseRef, choice: choices[0]! }, context)
      if (preview.status !== "ok") return preview
      if (preview.value.choiceDigest !== digestSfValue(choices[0]) || preview.value.requestDigest !== digestSfValue(preview.value.scenario) || preview.value.resultDigest !== digestSfValue(preview.value.result) || !preview.value.result.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(preview.value.source))) return { status: "conflict", reason: "choice-preview-mismatch" }
      const baseline = await input.sources.resolveForecastCoverage(request.coverageRef, context)
      if (baseline.status !== "ok") return baseline
      if (baseline.value.coverageRef !== request.coverageRef || preview.value.result.currency !== decision.currency || digestSfValue(preview.value.result.horizon) !== digestSfValue(decision.horizon)) return { status: "conflict", reason: "choice-preview-basis-mismatch" }
      const attributed = { ...preview.value.result, costCoverage: { ...preview.value.result.costCoverage, alternativeId: request.alternativeRef.id, alternativeVersion: request.alternativeRef.version + 1 } }
      const entries = await input.coverageEvidence.entries(attributed, baseline.value.assessment, context)
      if (entries.status !== "ok") return entries
      const result = await reassessScenarioCoverage({ scenario: attributed, basis: baseline.value.basis, baseline: baseline.value.assessment, entries: entries.value, resolveEvidence: (refs) => input.coverageEvidence.resolve(refs, context), supports: input.coverageEvidence.supports })
      if (!result || validateScenarioCoverage(result, baseline.value.basis, result.costCoverage)) return { status: "unavailable", reason: "choice-preview-coverage-unavailable" }
      const coverage = await input.registerCoverage({ caseRef: encodeCaseRef(request.caseRef), expectedCaseVersion: request.caseRef.version, basis: baseline.value.basis, assessment: result.costCoverage, result, scenario: preview.value.scenario }, context)
      if (coverage.status !== "ok") return coverage
      const stored = await input.results.write({ kind: "scenario", caseRef: request.caseRef, requestDigest: digestSfValue(preview.value.scenario), result, sourceRefs: [...result.sourceRefs, ...result.costCoverage.evaluatedSourceRefs, ...result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)].filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index), idempotencyKey: `choice-preview:${operation}` }, context)
      if (stored.status !== "ok") return stored
      const promotion = { caseRef: request.caseRef, choiceId: request.choiceId, choiceDigest: preview.value.choiceDigest, alternativeRef: request.alternativeRef, resultRef: stored.value.resultRef, resultDigest: digestSfValue(result), scenario: preview.value.scenario, coverageRef: coverage.value.coverageRef }
      const initial: CurrentChoiceBinding = { schema: "sf-current-choice-binding-v1", promotion, originalSource: preview.value.originalSource, source: preview.value.source, producerResultRef: preview.value.resultRef, producerResultDigest: preview.value.resultDigest, recordDigest: "" }
      const binding = { ...initial, recordDigest: digest(initial) }
      const preferences = await input.state.read(source, "preferences", (_state, authority) => sameAuthority(authority, context))
      const latest = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      if (preferences.status !== "ok" || !preferences.value || latest.status !== "ok" || !latest.value || digestSfValue(latest.value) !== digestSfValue(decision) || !await input.authorizeCase(latest.value, context) || !await input.authorizePreview(request, context) || !await input.host.revalidate(context)) return { status: "stale", reason: "choice-preview-changed" }
      const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
        const actual = state.cases[request.caseRef.id]
        const saved = state.decisionResults?.[promotion.resultRef]
        const previous = state.preferences[key(promotion.resultRef)]
        if (!sameAuthority(authority, context) || !actual || digestSfValue(actual) !== digestSfValue(decision) || !saved || digestSfValue(saved) !== digestSfValue(stored.value) || previous && digestSfValue(previous) !== digestSfValue(binding) || !preview.value.fenceSnapshot(snapshot) || !input.coverageEvidence.verifySnapshot(snapshot, result, baseline.value.basis, context) || !input.verifySnapshot(snapshot, request, binding, context)) return { commit: false, value: null }
        state.preferences[key(promotion.resultRef)] = binding
        return { commit: true, value: { promotion, bindingDigest: digestSfValue(binding) } }
      }
      input.writes.add(work)
      const saved = await input.state.transaction(source, { namespace: "preferences", domainSurface: "planner", expectedStorageVersion: preferences.storageVersion, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: latest.storageVersion }], targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey: `choice-preview-binding:${operation}`, commandDigest: digestSfValue(request) }, work).finally(() => input.writes.delete(work))
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" || saved.status === "preview" ? "conflict" : "unavailable", reason: "choice-preview-unavailable" }
      const verified = await read(promotion, context)
      if (verified.status !== "ok" || digestSfValue(verified.value) !== saved.value.bindingDigest) return { status: "unavailable", reason: "choice-preview-unavailable" }
      return { status: "ok", value: saved.value }
    } catch { return { status: "unavailable", reason: "choice-preview-unavailable" } }
  }
  const read = async (request: CurrentChoicePromotion, context: TrustedDomainContext): Promise<PortResult<CurrentChoiceBinding>> => {
    try {
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "choice-preview-access-unavailable" }
      const stored = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[key(request.resultRef)] : undefined)
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const result = await input.results.read({ resultRef: request.resultRef, kind: "scenario" }, context)
      if (stored.status !== "ok" || !stored.value || typeof stored.value !== "object" || current.status !== "ok" || !current.value || current.value.incarnation !== request.caseRef.incarnation || current.value.version !== request.caseRef.version || !current.value.participants.includes(context.binding.principalRef) || !await input.authorizeCase(current.value, context) || result.status !== "ok") return { status: "unavailable", reason: "choice-preview-unavailable" }
      const binding = stored.value as CurrentChoiceBinding
      if (binding.schema !== "sf-current-choice-binding-v1" || binding.recordDigest !== digest(binding) || digestSfValue(binding.promotion) !== digestSfValue(request) || result.value.resultDigest !== request.resultDigest || result.value.requestDigest !== digestSfValue(request.scenario) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "choice-preview-unavailable" }
      return { status: "ok", value: structuredClone(binding) }
    } catch { return { status: "unavailable", reason: "choice-preview-unavailable" } }
  }
  return { prepare, read }
}

function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) {
  return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision
}
