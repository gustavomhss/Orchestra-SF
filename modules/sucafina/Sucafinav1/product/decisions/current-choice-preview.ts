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
export type CurrentChoicePreviewRequest = { caseRef: CaseRef; choiceId: string; alternativeRef: { id: string; version: number }; coverageRef: string }
type Request = CurrentChoicePreviewRequest
export type CurrentChoiceBinding = { schema: "sf-current-choice-binding-v1"; promotion: CurrentChoicePromotion; originalSource: RecordEvidence; source: RecordEvidence; producerResultRef: string; producerResultDigest: string; recordDigest: string }
const key = (resultRef: string) => `sf:proposal-coverage:current-choice:${digestSfValue(resultRef)}`
const digest = (value: CurrentChoiceBinding) => digestSfValue(Object.fromEntries(Object.entries(value).filter(([name]) => name !== "recordDigest")))

/** Checks the private preview binding inside a caller's case transaction. */
export function verifyCurrentChoiceBinding(state: SfProductState, request: CurrentChoicePromotion, expectedDigest: string) {
  const value = readCurrentChoiceBinding(state, request)
  return !!value && digestSfValue(value) === expectedDigest
}

export function readCurrentChoiceBinding(state: Readonly<SfProductState>, request: CurrentChoicePromotion) {
  const value = state.preferences[key(request.resultRef)] as CurrentChoiceBinding | undefined
  return value && value.schema === "sf-current-choice-binding-v1" && value.recordDigest === digest(value) && digestSfValue(value.promotion) === digestSfValue(request) ? value : undefined
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
  verifySources: (binding: CurrentChoiceBinding, context: TrustedDomainContext) => Promise<boolean>
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
      if (preview.value.choiceDigest !== digestSfValue(choices[0]) || preview.value.requestDigest !== digestSfValue(preview.value.scenario) || preview.value.resultDigest !== digestSfValue(preview.value.result) || digestSfValue(preview.value.scenario) !== digestSfValue({ ...choices[0]!.scenario, baseRef: preview.value.source.refId }) || preview.value.originalSource.refId !== choices[0]!.scenario.baseRef || !choices[0]!.result.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(preview.value.originalSource)) || !preview.value.result.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(preview.value.source))) return { status: "conflict", reason: "choice-preview-mismatch" }
      const baseline = await input.sources.resolveForecastCoverage(request.coverageRef, context)
      if (baseline.status !== "ok") return baseline
      if (baseline.value.coverageRef !== request.coverageRef || preview.value.result.currency !== decision.currency || digestSfValue(preview.value.result.horizon) !== digestSfValue(decision.horizon)) return { status: "conflict", reason: "choice-preview-basis-mismatch" }
      const computed = preview.value.result
      const attributed: ScenarioResult = computed.comparisonStatus === "complete" ? { ...computed, costCoverage: { ...computed.costCoverage, alternativeId: request.alternativeRef.id, alternativeVersion: request.alternativeRef.version + 1 } } : { ...computed, costCoverage: { ...computed.costCoverage, alternativeId: request.alternativeRef.id, alternativeVersion: request.alternativeRef.version + 1 } }
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
  const read = async (incoming: CurrentChoicePromotion, context: TrustedDomainContext): Promise<PortResult<CurrentChoiceBinding>> => {
    try {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "choice-preview-access-unavailable" }
      const stored = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[key(request.resultRef)] : undefined)
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const result = await input.results.read({ resultRef: request.resultRef, kind: "scenario" }, context)
      if (stored.status !== "ok" || !stored.value || typeof stored.value !== "object" || current.status !== "ok" || !current.value || current.value.incarnation !== request.caseRef.incarnation || current.value.version !== request.caseRef.version || !current.value.participants.includes(context.binding.principalRef) || !await input.authorizeCase(current.value, context) || result.status !== "ok") return { status: "unavailable", reason: "choice-preview-unavailable" }
      const binding = structuredClone(stored.value) as CurrentChoiceBinding
      const choice = current.value.choices.filter((item) => item.id === request.choiceId && item.alternativeId === request.alternativeRef.id && digestSfValue(item) === request.choiceDigest)
      if (binding.schema !== "sf-current-choice-binding-v1" || binding.recordDigest !== digest(binding) || digestSfValue(binding.promotion) !== digestSfValue(request) || result.value.resultDigest !== request.resultDigest || result.value.requestDigest !== digestSfValue(request.scenario) || choice.length !== 1 || current.value.alternatives.filter((item) => item.id === request.alternativeRef.id && item.version === request.alternativeRef.version).length !== 1 || digestSfValue({ ...choice[0]!.scenario, baseRef: binding.source.refId }) !== digestSfValue(request.scenario) || !choice[0]!.result.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(binding.originalSource))) return { status: "unavailable", reason: "choice-preview-unavailable" }
      const producer = await input.results.read({ resultRef: binding.producerResultRef, kind: "scenario" }, context)
      if (producer.status !== "ok" || producer.value.kind !== "scenario" || producer.value.resultDigest !== binding.producerResultDigest || producer.value.requestDigest !== digestSfValue(request.scenario) || digestSfValue(producer.value.caseRef) !== digestSfValue(request.caseRef) || !producer.value.result.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(binding.source)) || !await input.verifySources(structuredClone(binding), context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "unavailable", reason: "choice-preview-unavailable" }
      if (!await input.authorizeCase(current.value, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "choice-preview-changed" }
      // Reauthorize the private namespace after external callbacks; a case read
      // alone does not grant access to its preference-backed binding.
      const bindingAgain = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? readCurrentChoiceBinding(state, request) : undefined)
      if (bindingAgain.status !== "ok" || !bindingAgain.value || digestSfValue(bindingAgain.value) !== digestSfValue(binding)) return { status: "stale", reason: "choice-preview-changed" }
      // Observe the case, both results and the binding together after callbacks
      // and namespace authorization, with no external callback after this fence.
      const final = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { decision: state.cases[request.caseRef.id], result: state.decisionResults?.[request.resultRef], producer: state.decisionResults?.[binding.producerResultRef], binding: readCurrentChoiceBinding(state, request) } : undefined)
      if (final.status !== "ok" || !final.value?.decision || digestSfValue(final.value.decision) !== digestSfValue(current.value) || digestSfValue(final.value.result) !== digestSfValue(result.value) || digestSfValue(final.value.producer) !== digestSfValue(producer.value) || !final.value.binding || digestSfValue(final.value.binding) !== digestSfValue(bindingAgain.value) || source.signal.aborted) return { status: "stale", reason: "choice-preview-changed" }
      return { status: "ok", value: structuredClone(final.value.binding) }
    } catch { return { status: "unavailable", reason: "choice-preview-unavailable" } }
  }
  return { prepare, read }
}

function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) {
  return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision
}
