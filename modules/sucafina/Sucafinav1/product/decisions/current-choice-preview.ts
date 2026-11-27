import { digestSfValue, sfCanonicalSerializerUnhooked } from "../contracts/canonical.ts"
import { currentLocalReadonlyAuthorityData, hasLocalSnapshotScope, observeLocalSnapshotStability } from "../../runtime/local-store.ts"
import type { ReadonlyAuthorityData } from "../../runtime/local-store.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ChoiceRecord, DecisionCase, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import { AsyncLocalStorage } from "node:async_hooks"
import { types } from "node:util"
import type { AssetPersistence, BlobTransaction } from "../../runtime/assets.ts"
import type { Persistence, Snapshot, TransactionOptions } from "../../runtime/contract.ts"
import type { Surface } from "../../src/identity.ts"
import type { CurrentChoicePromotion, CurrentChoicePromotionReceipt } from "./current-choice-promotion.ts"
import type { createSfDecisionResultStore, StoredDecisionResult } from "./result-store.ts"
import type { createDecisionMutations } from "./mutations.ts"
import type { RegisteredProposalCoverage } from "./proposal-coverage.ts"
import { encodeCaseRef } from "./case-port.ts"
import { reassessScenarioCoverage, validateScenarioCoverage } from "./cost-coverage.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
export type CurrentChoicePreviewRequest = { caseRef: CaseRef; choiceId: string; alternativeRef: { id: string; version: number }; coverageRef: string }
type PreviewRequest = CurrentChoicePreviewRequest
type StoredScenario = Extract<StoredDecisionResult, { kind: "scenario" }>
type PreparedPreview = { promotion: CurrentChoicePromotion; bindingDigest: string }
type VerifiedPreview = PreparedPreview & { result: StoredScenario; caseDigest: string; historical: ScenarioResult }
export type CurrentChoiceBinding = { schema: "sf-current-choice-binding-v1"; promotion: CurrentChoicePromotion; originalSource: RecordEvidence; source: RecordEvidence; producerResultRef: string; producerResultDigest: string; coverageDigest?: string; coverageRecordDigest?: string; recordDigest: string }
const key = (resultRef: string) => `sf:proposal-coverage:current-choice:${digestSfValue(resultRef)}`
const digest = (value: CurrentChoiceBinding) => digestSfValue(Object.fromEntries(Object.entries(value).filter(([name]) => name !== "recordDigest")))

/** Checks the private preview binding inside a caller's case transaction. */
export function verifyCurrentChoiceBinding(state: Readonly<SfProductState>, request: CurrentChoicePromotion, expectedDigest: string) {
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
  /** Mandatory at runtime; compose it below source lifecycle and every producer. */
  fence?: CurrentChoiceFence
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  sources: Pick<PlannerSourceHost, "resolveForecastCoverage">
  results: ReturnType<typeof createSfDecisionResultStore>
  coverageEvidence: NonNullable<Parameters<typeof createDecisionMutations>[0]["coverageEvidence"]>
  authorizeCase: (decision: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizePreview: (request: PreviewRequest, context: TrustedDomainContext) => Promise<boolean>
  resimulate: (request: { caseRef: CaseRef; choice: ChoiceRecord }, context: TrustedDomainContext) => Promise<PortResult<{ resultRef: string; scenario: ScenarioRequest; result: ScenarioResult; choiceDigest: string; requestDigest: string; resultDigest: string; originalSource: RecordEvidence; source: RecordEvidence; fenceSnapshot: (snapshot: Snapshot) => boolean }>>
  registerCoverage: (request: { caseRef: string; expectedCaseVersion: number; basis: import("../contracts/decisions.ts").CostCoverageBasis; assessment: import("../contracts/decisions.ts").CostCoverageAssessment; result: ScenarioResult; scenario: ScenarioRequest }, context: TrustedDomainContext) => Promise<PortResult<{ coverageRef: string; readback?: RegisteredProposalCoverage["readback"] }>>
  verifySnapshot: (snapshot: Snapshot, request: PreviewRequest, binding: CurrentChoiceBinding, context: TrustedDomainContext) => boolean
  verifySources: (binding: CurrentChoiceBinding, context: TrustedDomainContext, producer?: StoredScenario, freshBinding?: boolean) => Promise<boolean>
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  writes: WeakSet<object>
}) {
  const prepare = async (incoming: PreviewRequest, context: TrustedDomainContext): Promise<PortResult<VerifiedPreview>> => {
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
      const idempotencyKey = `choice-preview-binding:${operation}`
      const commandDigest = digestSfValue(request)
      const receiptKey = JSON.stringify([context.binding.principalRef, "preferences", request.caseRef.id, idempotencyKey])
      const prior = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context)
        ? { receipt: state.transactions[receiptKey] }
        : undefined)
      if (prior.status !== "ok" || !prior.value) return { status: "unavailable", reason: "choice-preview-receipt-unavailable" }
      if (prior.value.receipt) {
        const receipt = prior.value.receipt
        if (receipt.commandDigest !== commandDigest || receipt.targetIncarnation !== request.caseRef.incarnation)
          return { status: "conflict", reason: "choice-preview-idempotency-changed" }
        // Run C08's original replay checks, including write authority for both
        // namespaces. If the receipt has disappeared, this callback never writes.
        const replay = await input.state.transaction<PreparedPreview | undefined>(source, {
          namespace: "preferences", domainSurface: "planner", expectedStorageVersion: prior.storageVersion,
          additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: current.storageVersion }],
          targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey, commandDigest,
        }, async () => ({ commit: false, value: undefined }))
        if (replay.status !== "ok" || !replay.value || digestSfValue(replay.value) !== digestSfValue(receipt.value))
          return { status: "conflict", reason: "choice-preview-receipt-changed" }
        const saved = replay.value
        const published = saved.promotion
        if (!published || digestSfValue(published.caseRef) !== digestSfValue(request.caseRef) ||
            published.choiceId !== request.choiceId || published.choiceDigest !== digestSfValue(choices[0]) ||
            digestSfValue(published.alternativeRef) !== digestSfValue(request.alternativeRef))
          return { status: "conflict", reason: "choice-preview-receipt-changed" }
        input.fence!.observe(context, (snapshots) => {
          const state = snapshots.dashboard.data.__sfProductV1 as SfProductState | undefined
          return !!state && digestSfValue(state.transactions[receiptKey]) === digestSfValue(receipt)
        })
        const verified = await read(published, context)
        if (verified.status !== "ok" || digestSfValue(verified.value.binding) !== saved.bindingDigest || !await input.fence!.check(context))
          return { status: "unavailable", reason: "choice-preview-receipt-unavailable" }
        return { status: "ok", value: { ...saved, result: verified.value.result, caseDigest: verified.value.caseDigest, historical: verified.value.historical } }
      }
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
      input.fence!.observe(context, (snapshots) => preview.value.fenceSnapshot(snapshots.planner) && input.coverageEvidence.verifySnapshot(snapshots.planner, result, baseline.value.basis, context))
      const coverage = await input.registerCoverage({ caseRef: encodeCaseRef(request.caseRef), expectedCaseVersion: request.caseRef.version, basis: baseline.value.basis, assessment: result.costCoverage, result, scenario: preview.value.scenario }, context)
      if (coverage.status !== "ok") return coverage
      const readback = coverage.value.readback
      const coverageProof = readback ? { status: "ok" as const, value: readback.coverage } :
        await input.sources.resolveForecastCoverage(coverage.value.coverageRef, context)
      const coverageRecord = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[`sf:proposal-coverage:${coverage.value.coverageRef}`] : undefined)
      if (coverageProof.status !== "ok" || coverageProof.value.coverageRef !== coverage.value.coverageRef || digestSfValue(coverageProof.value.basis) !== digestSfValue(baseline.value.basis) || digestSfValue(coverageProof.value.assessment) !== digestSfValue(result.costCoverage) || coverageRecord.status !== "ok" || !coverageRecord.value) return { status: "unavailable", reason: "choice-preview-coverage-unavailable" }
      const coverageRecordDigest = digestSfValue(coverageRecord.value)
      if (readback && readback.storedRecordDigest !== coverageRecordDigest) return { status: "unavailable", reason: "choice-preview-coverage-unavailable" }
      const stored = await input.results.write({ kind: "scenario", caseRef: request.caseRef, requestDigest: digestSfValue(preview.value.scenario), result, sourceRefs: [...baseline.value.basis.sourceRefs, ...result.sourceRefs, ...result.costCoverage.evaluatedSourceRefs, ...result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)].filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index), idempotencyKey: `choice-preview:${operation}` }, context)
      if (stored.status !== "ok") return stored
      const promotion = { caseRef: request.caseRef, choiceId: request.choiceId, choiceDigest: preview.value.choiceDigest, alternativeRef: request.alternativeRef, resultRef: stored.value.resultRef, resultDigest: digestSfValue(result), scenario: preview.value.scenario, coverageRef: coverage.value.coverageRef }
      const initial: CurrentChoiceBinding = { schema: "sf-current-choice-binding-v1", promotion, originalSource: preview.value.originalSource, source: preview.value.source, producerResultRef: preview.value.resultRef, producerResultDigest: preview.value.resultDigest, coverageDigest: digestSfValue(coverageProof.value), coverageRecordDigest, recordDigest: "" }
      const binding = { ...initial, recordDigest: digest(initial) }
      const preferences = await input.state.read(source, "preferences", (_state, authority) => sameAuthority(authority, context))
      const latest = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      if (preferences.status !== "ok" || !preferences.value || latest.status !== "ok" || !latest.value || digestSfValue(latest.value) !== digestSfValue(decision) || !await input.authorizeCase(latest.value, context) || !await input.authorizePreview(request, context) || !await input.host.revalidate(context)) return { status: "stale", reason: "choice-preview-changed" }
      const write = { applied: false }
      const lease = context.lease
      const bindingDigest = digestSfValue(context.binding)
      const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
        const actual = state.cases[request.caseRef.id]
        const saved = state.decisionResults?.[promotion.resultRef]
        const previous = state.preferences[key(promotion.resultRef)]
        if (!sameAuthority(authority, context) || !actual || digestSfValue(actual) !== digestSfValue(decision) || !saved || digestSfValue(saved) !== digestSfValue(stored.value) || previous && digestSfValue(previous) !== digestSfValue(binding) || !preview.value.fenceSnapshot(snapshot) || !input.coverageEvidence.verifySnapshot(snapshot, result, baseline.value.basis, context) || !input.verifySnapshot(snapshot, request, binding, context)) return { commit: false, value: null }
        state.preferences[key(promotion.resultRef)] = binding
        // Runs after C08's last async authorization/target resolution, against
        // the same snapshots the real driver will commit.
        input.fence!.observe(context, (snapshots) => {
          const actualState = snapshots.dashboard.data.__sfProductV1 as SfProductState | undefined
          return !!actualState && digestSfValue(actualState.cases[decision.id]) === digestSfValue(decision) &&
            digestSfValue(actualState.decisionResults?.[promotion.resultRef]) === digestSfValue(stored.value) &&
            verifyCurrentChoiceBinding(actualState, promotion, digestSfValue(binding)) &&
            digestSfValue(actualState.preferences[`sf:proposal-coverage:${promotion.coverageRef}`]) === binding.coverageRecordDigest &&
            input.verifySnapshot(snapshots.planner, request, binding, context)
        })
        write.applied = true
        return { commit: true, value: { promotion, bindingDigest: digestSfValue(binding) } }
      }
      input.writes.add(work)
      const saved = await input.state.transaction(source, { namespace: "preferences", domainSurface: "planner", expectedStorageVersion: preferences.storageVersion, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: latest.storageVersion }], targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey, commandDigest }, work).finally(() => input.writes.delete(work))
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" || saved.status === "preview" ? "conflict" : "unavailable", reason: "choice-preview-unavailable" }
      // Keep the producer, coverage and binding guards on the preparation fence
      // until the installed caller publishes its response.
      const freshBinding = write.applied && input.host.requestFor(context) === source && !source.signal.aborted &&
        context.lease === lease && digestSfValue(context.binding) === bindingDigest && input.operationIdentity(context) === operation &&
        digestSfValue(saved.value.promotion) === digestSfValue(promotion) && saved.value.bindingDigest === digestSfValue(binding)
      if (write.applied && !freshBinding) return { status: "unavailable", reason: "choice-preview-unavailable" }
      const verified = await read(promotion, context, undefined, freshBinding)
      if (verified.status !== "ok" || digestSfValue(verified.value.binding) !== saved.value.bindingDigest || !await input.fence!.check(context))
        return { status: "unavailable", reason: "choice-preview-unavailable" }
      return { status: "ok", value: { ...saved.value, result: verified.value.result, caseDigest: verified.value.caseDigest, historical: verified.value.historical } }
    } catch { return { status: "unavailable", reason: "choice-preview-unavailable" } }
  }
  const read = async (incoming: CurrentChoicePromotion, context: TrustedDomainContext, promoted?: CurrentChoicePromotionReceipt,
    freshBinding = false): Promise<PortResult<{ binding: CurrentChoiceBinding; result: StoredScenario; caseDigest: string; historical: ScenarioResult }>> => {
    try {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "choice-preview-access-unavailable" }
      const stored = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[key(request.resultRef)] : undefined)
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined)
      const receipt = promoted ? await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.transactions[JSON.stringify([authority.principalRef, "cases", request.caseRef.id, `${input.operationIdentity(context)}:promote-current-choice`])] : undefined) : undefined
      if (promoted && (receipt?.status !== "ok" || !receipt.value || receipt.value.commandDigest !== digestSfValue(request) || receipt.value.targetIncarnation !== request.caseRef.incarnation || digestSfValue(receipt.value.value) !== digestSfValue(promoted) || promoted.caseRef.id !== request.caseRef.id || promoted.caseRef.incarnation !== request.caseRef.incarnation || promoted.caseRef.version !== request.caseRef.version + 1)) return { status: "unavailable", reason: "choice-preview-receipt-unavailable" }
      const result = promoted ? await input.results.readHistoricalScenario({ resultRef: request.resultRef }, context) : await input.results.read({ resultRef: request.resultRef, kind: "scenario" }, context)
      if (stored.status !== "ok" || !stored.value || typeof stored.value !== "object" || current.status !== "ok" || !current.value || current.value.incarnation !== request.caseRef.incarnation || current.value.version !== (promoted?.caseRef.version ?? request.caseRef.version) || !current.value.participants.includes(context.binding.principalRef) || !await input.authorizeCase(current.value, context) || result.status !== "ok" || result.value.kind !== "scenario") return { status: "unavailable", reason: "choice-preview-unavailable" }
      const binding = structuredClone(stored.value) as CurrentChoiceBinding
      const choice = current.value.choices.filter((item) => item.id === request.choiceId && item.alternativeId === request.alternativeRef.id && digestSfValue(item) === request.choiceDigest)
      if (binding.schema !== "sf-current-choice-binding-v1" || binding.recordDigest !== digest(binding) || digestSfValue(binding.promotion) !== digestSfValue(request) || result.value.resultDigest !== request.resultDigest || result.value.requestDigest !== digestSfValue(request.scenario) || choice.length !== 1 || current.value.alternatives.filter((item) => item.id === request.alternativeRef.id && item.version === request.alternativeRef.version + (promoted ? 1 : 0) && (!promoted || digestSfValue(item.scenario) === digestSfValue(request.scenario) && digestSfValue(item.result) === request.resultDigest)).length !== 1 || digestSfValue({ ...choice[0]!.scenario, baseRef: binding.source.refId }) !== digestSfValue(request.scenario) || !choice[0]!.result.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(binding.originalSource))) return { status: "unavailable", reason: "choice-preview-unavailable" }
      const producer = promoted ? await input.results.readHistoricalScenario({ resultRef: binding.producerResultRef }, context) : await input.results.read({ resultRef: binding.producerResultRef, kind: "scenario" }, context)
      if (producer.status !== "ok" || producer.value.kind !== "scenario" || producer.value.resultDigest !== binding.producerResultDigest || producer.value.requestDigest !== digestSfValue(request.scenario) || digestSfValue(producer.value.caseRef) !== digestSfValue(request.caseRef) || !producer.value.result.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(binding.source)) || !await input.verifySources(structuredClone(binding), context, promoted ? undefined : structuredClone(producer.value), freshBinding) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "unavailable", reason: "choice-preview-unavailable" }
      if (!await input.authorizeCase(current.value, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "choice-preview-changed" }
      // Reauthorize the private namespace after external callbacks; a case read
      // alone does not grant access to its preference-backed binding.
      const bindingAgain = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? readCurrentChoiceBinding(state, request) : undefined)
      if (bindingAgain.status !== "ok" || !bindingAgain.value || digestSfValue(bindingAgain.value) !== digestSfValue(binding)) return { status: "stale", reason: "choice-preview-changed" }
      if (binding.coverageRecordDigest) {
        const coverageRecord = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[`sf:proposal-coverage:${request.coverageRef}`] : undefined)
        if (coverageRecord.status !== "ok" || !coverageRecord.value || digestSfValue(coverageRecord.value) !== binding.coverageRecordDigest) return { status: "stale", reason: "choice-preview-changed" }
      }
      input.fence!.observe(context, (snapshots) => {
        const state = snapshots.dashboard.data.__sfProductV1 as SfProductState | undefined
        const savedReceipt = promoted && state?.transactions[JSON.stringify([context.binding.principalRef, "cases", request.caseRef.id, `${input.operationIdentity(context)}:promote-current-choice`])]
        const promotedResult = promoted && state?.decisionResults?.[promoted.resultRef]
        return !!state && digestSfValue(state.cases[request.caseRef.id]) === digestSfValue(current.value) &&
          digestSfValue(state.decisionResults?.[request.resultRef]) === digestSfValue(result.value) &&
          digestSfValue(state.decisionResults?.[binding.producerResultRef]) === digestSfValue(producer.value) &&
          verifyCurrentChoiceBinding(state, request, digestSfValue(binding)) &&
          (!binding.coverageRecordDigest || digestSfValue(state.preferences[`sf:proposal-coverage:${request.coverageRef}`]) === binding.coverageRecordDigest) &&
          (!promoted || !!savedReceipt && receipt?.status === "ok" && digestSfValue(savedReceipt) === digestSfValue(receipt.value) &&
            !!promotedResult && promotedResult.resultRef === promoted.resultRef && digestSfValue(promotedResult.caseRef) === digestSfValue(promoted.caseRef) &&
            promotedResult.resultDigest === request.resultDigest && digestSfValue(promotedResult.result) === request.resultDigest) &&
          input.verifySnapshot(snapshots.planner, request, binding, context)
      })
      // Observe the case, both results and the binding together after callbacks
      // and namespace authorization, with no external callback after this fence.
      const final = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { decision: state.cases[request.caseRef.id], result: state.decisionResults?.[request.resultRef], producer: state.decisionResults?.[binding.producerResultRef], binding: readCurrentChoiceBinding(state, request) } : undefined)
      if (final.status !== "ok" || !final.value?.decision || digestSfValue(final.value.decision) !== digestSfValue(current.value) || digestSfValue(final.value.result) !== digestSfValue(result.value) || digestSfValue(final.value.producer) !== digestSfValue(producer.value) || !final.value.binding || digestSfValue(final.value.binding) !== digestSfValue(bindingAgain.value) || source.signal.aborted || input.host.requestFor(context) !== source || !input.fence!.current(context)) return { status: "stale", reason: "choice-preview-changed" }
      return { status: "ok", value: { binding: structuredClone(final.value.binding), result: structuredClone(result.value),
        caseDigest: digestSfValue(final.value.decision), historical: structuredClone(choice[0]!.result) } }
    } catch { return { status: "stale", reason: "choice-preview-changed" } }
  }
  const guardedRead = async (request: CurrentChoicePromotion, context: TrustedDomainContext, promoted?: CurrentChoicePromotionReceipt): Promise<PortResult<CurrentChoiceBinding>> => {
    if (!isCurrentChoiceFence(input.fence)) return { status: "unavailable", reason: "choice-fence-unavailable" }
    try {
      const receipt = promoted ? structuredClone(promoted) : undefined
      const verified = await input.fence.run(context, () => read(request, context, receipt))
      return verified.status === "ok" ? { status: "ok", value: verified.value.binding } : verified
    }
    catch { return { status: "stale", reason: "choice-preview-changed" } }
  }
  return {
    read: guardedRead,
    prepareInFence: async (request: PreviewRequest, context: TrustedDomainContext): Promise<PortResult<VerifiedPreview>> => {
      if (!isCurrentChoiceFence(input.fence) || !input.fence.current(context)) return { status: "unavailable", reason: "choice-fence-unavailable" }
      return prepare(request, context)
    },
    prepare: async (request: PreviewRequest, context: TrustedDomainContext): Promise<PortResult<PreparedPreview>> => {
      if (!isCurrentChoiceFence(input.fence)) return { status: "unavailable", reason: "choice-fence-unavailable" }
      try {
        const prepared = await input.fence.run(context, () => prepare(request, context))
        return prepared.status === "ok" ? { status: "ok", value: { promotion: prepared.value.promotion, bindingDigest: prepared.value.bindingDigest } } : prepared
      }
      catch { return { status: "unavailable", reason: "choice-preview-unavailable" } }
    },
  }
}

function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) {
  return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision
}


type CurrentChoiceSnapshots = Readonly<Record<Surface, Snapshot>>
type CurrentChoiceSnapshotGuard = (snapshots: CurrentChoiceSnapshots) => boolean
type CurrentChoicePersistence = AssetPersistence & Pick<Persistence, "transactionAll" | "currentSnapshots">

export type CurrentChoiceFence = {
  persistence: CurrentChoicePersistence
  run: <T>(context: TrustedDomainContext, work: () => Promise<T>) => Promise<T>
  observe: (context: TrustedDomainContext, guard: CurrentChoiceSnapshotGuard, once?: boolean) => void
  check: (context: TrustedDomainContext) => Promise<boolean>
  current: (context: TrustedDomainContext) => boolean
}
const currentChoiceFences = new WeakSet<object>()
const currentChoiceStorage = new WeakMap<CurrentChoiceFence, () => CurrentChoicePersistence | undefined>()
const currentChoiceReadonlyReaders = new WeakMap<object, <S extends Surface>(surfaces: readonly S[], mode?: "unfenced") => ReadonlyAuthorityData<S> | undefined>()

/** Query only the exact forwarding object emitted by this factory. Unfenced
 * admission requires its direct transaction route and no CurrentChoice scope;
 * it never grants authority. */
export function currentChoiceReadonlyAuthorityData<S extends Surface>(owner: object, surfaces: readonly S[], mode?: "unfenced"): ReadonlyAuthorityData<S> | undefined {
  return currentChoiceReadonlyReaders.get(owner)?.(surfaces, mode)
}

/** Prove that the factory's original wrappers still delegate to this driver. */
export function currentChoiceOwnsSnapshotTransactions(fence: CurrentChoiceFence, driver: CurrentChoicePersistence) {
  return currentChoiceStorage.get(fence)?.() === driver
}

export function isCurrentChoiceFence(value: unknown): value is CurrentChoiceFence {
  return !!value && typeof value === "object" && currentChoiceFences.has(value)
}

/**
 * Install immediately above the real persistence driver, before source-lifecycle
 * and product-authority are built. Every canonical producer must use that same
 * chain. This preserves provider admission, blob capabilities and SQLite's
 * nested-write prohibition; it does not implement another state store.
 *
 * A scope is one invocation, not cached authority. Independent successful
 * producer writes remain separate durable steps; this is not a multi-step
 * rollback mechanism. The final promotion stays one canonical transaction.
 */
export function createCurrentChoiceFence<P extends CurrentChoicePersistence>(input: {
  persistence: P
  host: () => Pick<DomainPortHost, "requestFor" | "revalidate">
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  identity: () => { installationId: string; projectId: string } | undefined
  authorizeCommit?: () => Promise<boolean>
}): CurrentChoiceFence & { persistence: P } {
  type Scope = {
    context: TrustedDomainContext
    request: Request
    requestDigest: string
    host: Pick<DomainPortHost, "requestFor" | "revalidate">
    command: string
    bindingDigest: string
    identityDigest: string
    guards: CurrentChoiceSnapshotGuard[]
    parent?: Scope
    open: boolean
    pending: number
  }
  const scopes = new AsyncLocalStorage<Scope>()
  const directTransactions = new AsyncLocalStorage<boolean>()
  const denied = () => new Error("SF_CURRENT_CHOICE_FENCE_CHANGED")
  const currentScope = (scope: Scope): boolean => {
    const identity = input.identity()
    return scope.open && (!scope.parent || currentScope(scope.parent)) &&
      !scope.request.signal.aborted && scope.host.requestFor(scope.context) === scope.request &&
      digestSfValue({ method: scope.request.method, url: scope.request.url, headers: [...scope.request.headers] }) === scope.requestDigest &&
      input.operationIdentity(scope.context) === scope.command &&
      digestSfValue(scope.context.binding) === scope.bindingDigest &&
      !!identity && identity.installationId === scope.context.binding.installationId &&
      identity.projectId === scope.context.binding.projectId && digestSfValue(identity) === scope.identityDigest
  }
  const current = (context: TrustedDomainContext) => {
    const scope = scopes.getStore()
    return !!scope && scope.context === context && currentScope(scope)
  }
  const verify = (scope: Scope, snapshots: CurrentChoiceSnapshots | undefined): boolean => {
    if (!snapshots || !snapshots.dashboard || !snapshots.planner || !snapshots.procurement || !currentScope(scope)) return false
    // Each observer gets private bytes, so it cannot rewrite a later observer's
    // basis. Async observers return a Promise and fail the strict true check.
    const valid = (!scope.parent || verify(scope.parent, snapshots)) &&
      scope.guards.every((guard) => guard(structuredClone(snapshots)) === true)
    return valid && currentScope(scope)
  }
  type SnapshotObservation = { kind: "stable"; owner: P; current: () => boolean; mutable?: { surface: Surface; digest: string } }
    | { kind: "complete"; digest: string }
  const authorizeSnapshot = async (scope: Scope): Promise<SnapshotObservation | undefined> => {
    if (!currentScope(scope)) return undefined
    const owner = input.persistence
    const ownerCurrent = () => {
      if (owner !== driver || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) return false
      const property = Object.getOwnPropertyDescriptor(input, "persistence")
      return !!property && Object.hasOwn(property, "value") && property.value === owner
    }
    const stability = sfCanonicalSerializerUnhooked() && ownerCurrent() ? observeLocalSnapshotStability(owner) : undefined
    if (stability) {
      const target = stability.mutable
      const mutable = target && { surface: target.surface, digest: digestSfValue(target.snapshot) }
      if (!await scope.host.revalidate(scope.context)) return undefined
      return { kind: "stable", owner, current: () => ownerCurrent() && stability.current() && sfCanonicalSerializerUnhooked(), mutable }
    }
    const snapshots = owner.currentSnapshots?.()
    if (!snapshots || !currentScope(scope)) return undefined
    // Opaque storage and multi-surface writers still require all bytes on
    // both sides of the real reauthorization, including role/access maps.
    const observed = digestSfValue(snapshots)
    if (!await scope.host.revalidate(scope.context)) return undefined
    return { kind: "complete", digest: observed }
  }
  const publication = (scope: Scope, authorized: SnapshotObservation | undefined): boolean => {
    if (!authorized) return false
    if (authorized.kind === "stable" && !authorized.current()) return false
    const owner = authorized.kind === "stable" ? authorized.owner : input.persistence
    const snapshots = owner.currentSnapshots?.()
    if (!snapshots) return false
    const unchanged = authorized.kind === "complete" ? digestSfValue(snapshots) === authorized.digest
      : !authorized.mutable || digestSfValue(snapshots[authorized.mutable.surface]) === authorized.mutable.digest
    return unchanged && verify(scope, snapshots) && (authorized.kind === "complete" || authorized.current())
  }
  const count = (scope: Scope, change: number) => {
    scope.pending += change
    if (scope.parent) count(scope.parent, change)
  }
  const track = async <T>(scope: Scope, work: () => Promise<T>): Promise<T> => {
    if (!currentScope(scope)) throw denied()
    count(scope, 1)
    try { return await work() } finally { count(scope, -1) }
  }
  const persistence: P = {
    ...input.persistence,
    transaction: <T>(
      surface: Surface,
      work: (snapshot: Snapshot, blobs: BlobTransaction) => Promise<{ commit: boolean; value: T }>,
      options?: TransactionOptions,
    ) => {
      const scope = scopes.getStore()
      if (!scope && !input.authorizeCommit) return directTransactions.run(true, () => input.persistence.transaction(surface, work, options))
      const run = () => input.persistence.transaction(surface, async (snapshot, blobs) => {
        if (scope && !currentScope(scope)) throw denied()
        const result = await work(snapshot, blobs)
        if (result.commit && input.authorizeCommit && !await input.authorizeCommit()) throw denied()
        if (!scope) return result
        // The shipped SQLite driver holds one serialized transaction and exposes
        // all three current snapshots, including this callback's staged writes.
        const authorized = await authorizeSnapshot(scope)
        if (!publication(scope, authorized)) throw denied()
        return result
      }, options)
      return directTransactions.run(false, () => scope ? track(scope, run) : run())
    },
    ...(input.persistence.transactionAll ? {
      transactionAll: <T>(work: (snapshots: Record<Surface, Snapshot>) => Promise<{ commit: boolean; value: T }>, options?: TransactionOptions) => {
        const scope = scopes.getStore()
        if (!scope && !input.authorizeCommit) return input.persistence.transactionAll!(work, options)
        const run = () => input.persistence.transactionAll!(async (snapshots) => {
          if (scope && !currentScope(scope)) throw denied()
          const result = await work(snapshots)
          if (result.commit && input.authorizeCommit && !await input.authorizeCommit()) throw denied()
          if (!scope) return result
          const authorized = await authorizeSnapshot(scope)
          if (!publication(scope, authorized)) throw denied()
          return result
        }, options)
        return scope ? track(scope, run) : run()
      },
    } : {}),
  }
  const check = async (context: TrustedDomainContext): Promise<boolean> => {
    const scope = scopes.getStore()
    if (!scope || scope.context !== context || !currentScope(scope)) return false
    const inspect = async () => {
      const authorized = await authorizeSnapshot(scope)
      return publication(scope, authorized)
    }
    // Reuse an existing real read scope instead of opening a nested writer.
    if (hasLocalSnapshotScope(input.persistence) ?? !!input.persistence.currentSnapshots?.()) return inspect()
    if (!input.persistence.transactionAll) return false
    return input.persistence.transactionAll(async () => ({ commit: false, value: await inspect() }), { signal: scope.request.signal })
  }
  const fence: CurrentChoiceFence & { persistence: P } = {
    persistence, current, check,
    observe: (context, guard, once) => {
      const scope = scopes.getStore()
      if (!scope || scope.context !== context || !currentScope(scope)) throw denied()
      if (!once || !scope.guards.includes(guard)) scope.guards.push(guard)
    },
    run: async <T>(context: TrustedDomainContext, work: () => Promise<T>): Promise<T> => {
      const parent = scopes.getStore()
      const host = input.host()
      const request = host.requestFor(context)
      const command = input.operationIdentity(context)
      const identity = input.identity()
      if (!request || !command || !identity || !Object.isFrozen(context) || !Object.isFrozen(context.binding) ||
        (parent && (parent.context !== context || !currentScope(parent)))) throw denied()
      const scope: Scope = { context, request, requestDigest: digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }), host, command, bindingDigest: digestSfValue(context.binding),
        identityDigest: digestSfValue(identity), guards: [], parent, open: true, pending: 0 }
      if (!currentScope(scope)) throw denied()
      try {
        return await scopes.run(scope, async () => {
          const value = await work()
          // Unawaited provider calls retain this closed scope and cannot commit.
          if (scope.pending || !await check(context) || scope.pending || !currentScope(scope)) throw denied()
          return value
        })
      } finally { scope.open = false }
    },
  }
  currentChoiceFences.add(fence)
  const driver = input.persistence
  const methods = ["transaction", "transactionAll", "currentSnapshots"] as const
  const originals = methods.map((name) => ({ base: driver[name], wrapped: persistence[name] }))
  currentChoiceStorage.set(fence, () => {
    if (input.persistence !== driver || fence.persistence !== persistence) return undefined
    const exact = methods.every((name, index) => {
      const base = Object.getOwnPropertyDescriptor(driver, name)
      const wrapped = Object.getOwnPropertyDescriptor(persistence, name)
      return !!base && Object.hasOwn(base, "value") && base.value === originals[index]?.base &&
        !!wrapped && Object.hasOwn(wrapped, "value") && wrapped.value === originals[index]?.wrapped
    })
    return exact ? driver : undefined
  })
  // This separate attestation cannot register an external callback or promote a
  // writer's preimage. LocalStore alone decides whether its real root is readonly.
  const readonlyMethods = ["currentSnapshots", "currentSnapshot", "hasCurrentSnapshots", "transaction", "transactionAll", "readSnapshotRoot", "currentSnapshotScope"] as const
  const plain = () => [input, driver, persistence, fence].every((owner) =>
    !types.isProxy(owner) && Object.getPrototypeOf(owner) === Object.prototype)
  if (plain()) {
    const originals = readonlyMethods.map((name) => ({
      base: Object.getOwnPropertyDescriptor(driver, name),
      wrapped: Object.getOwnPropertyDescriptor(persistence, name),
    }))
    const pinned = () => {
      if (!plain()) return false
      const provider = Object.getOwnPropertyDescriptor(input, "persistence")
      const forwarding = Object.getOwnPropertyDescriptor(fence, "persistence")
      return !!provider && Object.hasOwn(provider, "value") && provider.value === driver &&
        !!forwarding && Object.hasOwn(forwarding, "value") && forwarding.value === persistence &&
        readonlyMethods.every((name, index) => {
          const base = Object.getOwnPropertyDescriptor(driver, name)
          const wrapped = Object.getOwnPropertyDescriptor(persistence, name)
          return !!base && Object.hasOwn(base, "value") && typeof base.value === "function" && base.value === originals[index]?.base?.value &&
            !!wrapped && Object.hasOwn(wrapped, "value") && typeof wrapped.value === "function" && wrapped.value === originals[index]?.wrapped?.value
        })
    }
    if (originals.every(({ base, wrapped }) => !!base && Object.hasOwn(base, "value") && typeof base.value === "function" &&
      !!wrapped && Object.hasOwn(wrapped, "value") && typeof wrapped.value === "function") && pinned()) {
      currentChoiceReadonlyReaders.set(persistence, <S extends Surface>(surfaces: readonly S[], mode?: "unfenced"): ReadonlyAuthorityData<S> | undefined => {
        if (!pinned()) return undefined
        const scope = scopes.getStore()
        if (mode === "unfenced" && (directTransactions.getStore() !== true || scope)) return undefined
        // Keep LocalStore's error for a known closed or aborted scope. Unknown
        // drivers and mutable roots retain the original, unsupported path.
        const observed = currentLocalReadonlyAuthorityData(driver, surfaces)
        if (!observed) return undefined
        const integrity = { failed: false }
        const current = (requirement?: "unpoisoned") => {
          // An initially absent fence may be entered by work. Its wrappers still
          // enforce that fence; the native observation retains its exact scope.
          const valid = observed.current(requirement) && !integrity.failed && pinned() &&
            (mode === "unfenced" || scopes.getStore() === scope && (!scope || currentScope(scope)))
          if (!valid) integrity.failed = true
          return valid
        }
        if (!current()) throw denied()
        return { ...observed, current }
      })
    }
  }
  return Object.freeze(fence)
}
