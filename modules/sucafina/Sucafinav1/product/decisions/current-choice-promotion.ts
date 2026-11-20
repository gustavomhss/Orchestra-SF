import { sfTransactionLookup } from "../host-binding/state-provider.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { ChoiceRecord, DecisionCase } from "../contracts/decisions.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { StoredDecisionResult } from "./result-store.ts"
import { validateScenarioCoverage } from "./cost-coverage.ts"
import { decisionScenarioResultRef } from "./mutations.ts"
import { isCurrentChoiceFence, readCurrentChoiceBinding, verifyCurrentChoiceBinding, type CurrentChoiceFence } from "./current-choice-preview.ts"

type CaseRef = { id: string; incarnation: string; version: number }
export type CurrentChoicePromotion = { caseRef: CaseRef; choiceId: string; choiceDigest: string; alternativeRef: { id: string; version: number }; resultRef: string; resultDigest: string; scenario: ScenarioRequest; coverageRef: string }
export type CurrentChoicePromotionReceipt = { caseRef: CaseRef; resultRef: string }

/** Adopts the exact reviewed result, leaving every historical choice byte intact. */
export function createCurrentChoicePromotion(input: {
  state: SfProductStatePort
  /** Mandatory at runtime; use the same fence as the real provider and producers. */
  fence?: CurrentChoiceFence
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  sources: Pick<PlannerSourceHost, "resolveForecastCoverage">
  authorizeCase: (decision: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizePromotion: (request: CurrentChoicePromotion, context: TrustedDomainContext) => Promise<boolean>
  verifyProvenance: (request: CurrentChoicePromotion, choice: ChoiceRecord, result: StoredDecisionResult, context: TrustedDomainContext, promoted?: CurrentChoicePromotionReceipt) => Promise<boolean>
  verifySnapshot: (snapshot: Snapshot, request: CurrentChoicePromotion, choice: ChoiceRecord, result: StoredDecisionResult, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  now: () => string
}) {
  const promote = async (incoming: CurrentChoicePromotion, context: TrustedDomainContext): Promise<PortResult<CurrentChoicePromotionReceipt>> => {
    const request = structuredClone(incoming)
    const source = input.host.requestFor(context)
    const operation = input.operationIdentity(context)
    if (context.kind !== "ui" || !source || !operation || !request.choiceId.trim() || !request.resultRef.trim() || !request.coverageRef.trim() ||
      !Number.isSafeInteger(request.caseRef.version) || request.caseRef.version < 1 || !Number.isSafeInteger(request.alternativeRef.version) || request.alternativeRef.version < 1 ||
      !/^[a-f0-9]{64}$/.test(request.choiceDigest) || !/^[a-f0-9]{64}$/.test(request.resultDigest) || !decodeSfOperationInput("sf_scenario_simulate", request.scenario).ok ||
      !await input.authorizePromotion(request, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "choice-promotion-access-unavailable" }
    const transaction = { namespace: "cases" as const, targetRef: request.caseRef.id, idempotencyKey: `${operation}:promote-current-choice` }
    const loaded = await input.state.read(source, "cases", (state, authority) => {
      if (!sameAuthority(authority, context)) return undefined
      const savedIntent = sfTransactionLookup(state, authority, transaction)
      if (savedIntent.status === "ambiguous") return undefined
      return { decision: state.cases[request.caseRef.id], result: state.decisionResults?.[request.resultRef], binding: readCurrentChoiceBinding(state, request),
        prior: savedIntent.status === "found" ? savedIntent.receipt : undefined, receiptAuthority: authority }
    })
    if (loaded.status !== "ok" || !loaded.value?.decision || loaded.value.decision.incarnation !== request.caseRef.incarnation ||
      !loaded.value.decision.participants.includes(context.binding.principalRef) || !await input.authorizeCase(loaded.value.decision, context)) return { status: "denied", reason: "choice-promotion-access-unavailable" }
    const { decision, result, binding, prior, receiptAuthority } = loaded.value
    let receipt: CurrentChoicePromotionReceipt | undefined
    if (prior) {
      if (prior.commandDigest !== digestSfValue(request) || prior.targetIncarnation !== request.caseRef.incarnation) return { status: "conflict", reason: "idempotency-content-changed" }
      const saved = prior.value as CurrentChoicePromotionReceipt | undefined
      if (!saved || typeof saved !== "object" || typeof saved.resultRef !== "string" || !saved.caseRef || saved.caseRef.id !== request.caseRef.id ||
        saved.caseRef.incarnation !== request.caseRef.incarnation || saved.caseRef.version !== request.caseRef.version + 1) return { status: "unavailable", reason: "choice-promotion-receipt-unavailable" }
      receipt = structuredClone(saved)
    }
    if (decision.version !== (receipt?.caseRef.version ?? request.caseRef.version)) return { status: "stale", reason: "case-changed" }
    const choices = decision.choices.filter((choice) => choice.id === request.choiceId && digestSfValue(choice) === request.choiceDigest)
    const alternatives = decision.alternatives.filter((item) => item.id === request.alternativeRef.id && item.version === request.alternativeRef.version + (receipt ? 1 : 0))
    if (!binding || !binding.coverageDigest || !binding.coverageRecordDigest) return { status: "denied", reason: "choice-preview-binding-unavailable" }
    if (choices.length !== 1 || alternatives.length !== 1 || !result || result.kind !== "scenario" || result.caseRef.id !== request.caseRef.id ||
      result.caseRef.incarnation !== request.caseRef.incarnation || result.caseRef.version !== request.caseRef.version || result.resultRef !== request.resultRef ||
      result.requestDigest !== digestSfValue(request.scenario) || result.resultDigest !== request.resultDigest || result.resultDigest !== digestSfValue(result.result) ||
      result.result.costCoverage.alternativeId !== request.alternativeRef.id || result.result.costCoverage.alternativeVersion !== request.alternativeRef.version + 1 ||
      result.result.currency !== decision.currency || digestSfValue(result.result.horizon) !== digestSfValue(decision.horizon) ||
      receipt && (digestSfValue(alternatives[0]!.scenario) !== result.requestDigest || digestSfValue(alternatives[0]!.result) !== result.resultDigest)) return { status: "conflict", reason: "choice-result-mismatch" }
    const choice = choices[0]!
    if (choice.alternativeId !== request.alternativeRef.id) return { status: "conflict", reason: "choice-alternative-mismatch" }
    // A receipt is an authorized read, never a shortcut around live provenance.
    if (!await input.verifyProvenance(request, choice, result, context, receipt)) return { status: "denied", reason: "choice-provenance-unavailable" }
    const privateCoverage = await input.state.read(source, "preferences", (state, authority) => sameAuthority(authority, context)
      ? state.preferences[`sf:proposal-coverage:${request.coverageRef}`] : undefined)
    if (privateCoverage.status !== "ok" || !privateCoverage.value || digestSfValue(privateCoverage.value) !== binding.coverageRecordDigest) return { status: "denied", reason: "choice-coverage-changed" }
    // The ordinary registry intentionally requires its original case version.
    // On replay, use only the exact basis already adopted into the current case,
    // pinned to the canonical coverage proof and private record minted at prepare.
    const adoptedBasis = receipt ? decision.costCoverageBases.find((basis) => basis.id === result.result.costCoverage.basisId && basis.version === result.result.costCoverage.basisVersion) : undefined
    const coverage = receipt
      ? adoptedBasis ? { status: "ok" as const, value: { coverageRef: request.coverageRef, basis: adoptedBasis, assessment: result.result.costCoverage } } : { status: "unavailable" as const, reason: "choice-coverage-unavailable" }
      : await input.sources.resolveForecastCoverage(request.coverageRef, context)
    if (coverage.status !== "ok") return coverage
    if (digestSfValue(coverage.value) !== binding.coverageDigest || coverage.value.coverageRef !== request.coverageRef ||
      digestSfValue(coverage.value.assessment) !== digestSfValue(result.result.costCoverage) || validateScenarioCoverage(result.result, coverage.value.basis, coverage.value.assessment)) return { status: "conflict", reason: "choice-coverage-changed" }
    const existingBasis = decision.costCoverageBases.find((basis) => basis.id === coverage.value.basis.id && basis.version === coverage.value.basis.version)
    if (existingBasis && digestSfValue(existingBasis) !== digestSfValue(coverage.value.basis)) return { status: "conflict", reason: "coverage-inventory-version-conflict" }
    input.fence!.observe(context, (snapshots) => {
      const state = snapshots.dashboard.data.__sfProductV1 as SfProductState | undefined
      return !!state && verifyCurrentChoiceBinding(state, request, digestSfValue(binding)) &&
        digestSfValue(state.preferences[`sf:proposal-coverage:${request.coverageRef}`]) === binding.coverageRecordDigest &&
        input.verifySnapshot(snapshots.planner, request, choice, result, context)
    })
    const caseRef = receipt?.caseRef ?? { ...request.caseRef, version: request.caseRef.version + 1 }
    const resultRef = receipt?.resultRef ?? decisionScenarioResultRef(caseRef, result.requestDigest)
    const expectedReceipt = { caseRef, resultRef }
    const observeAdoption = (expectedDecision: DecisionCase, expectedResult: StoredDecisionResult) => {
      input.fence!.observe(context, (snapshots) => {
        const state = snapshots.dashboard.data.__sfProductV1 as SfProductState | undefined
        const savedIntent = state ? sfTransactionLookup(state, receiptAuthority, transaction) : undefined
        const saved = savedIntent?.status === "found" ? savedIntent.receipt : undefined
        return !!state && digestSfValue(state.cases[request.caseRef.id]) === digestSfValue(expectedDecision) &&
          digestSfValue(state.decisionResults?.[resultRef]) === digestSfValue(expectedResult) &&
          digestSfValue(state.decisionResults?.[request.resultRef]) === digestSfValue(result) &&
          !!saved && saved.commandDigest === digestSfValue(request) && saved.targetIncarnation === request.caseRef.incarnation &&
          digestSfValue(saved.value) === digestSfValue(expectedReceipt)
      })
    }
    if (receipt) {
      const checked = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.decisionResults?.[resultRef] : undefined)
      if (checked.status !== "ok" || !checked.value || checked.value.kind !== "scenario" || checked.value.resultRef !== resultRef ||
        digestSfValue(checked.value.caseRef) !== digestSfValue(caseRef) || checked.value.resultDigest !== request.resultDigest ||
        digestSfValue(checked.value.result) !== request.resultDigest || checked.value.requestDigest !== result.requestDigest) return { status: "unavailable", reason: "choice-promotion-receipt-unavailable" }
      observeAdoption(decision, checked.value)
    } else {
      const createdAt = input.now()
      if (!Number.isFinite(Date.parse(createdAt)) || !await input.authorizePromotion(request, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "choice-promotion-access-unavailable" }
      const saved = await input.state.transaction(source, { namespace: "cases", domainSurface: "planner", expectedStorageVersion: loaded.storageVersion,
        targetRef: decision.id, targetIncarnation: decision.incarnation, idempotencyKey: `${operation}:promote-current-choice`, commandDigest: digestSfValue(request) }, async (state, authority, snapshot) => {
        const actual = state.cases[decision.id]
        const stored = state.decisionResults?.[request.resultRef]
        if (!sameAuthority(authority, context) || !actual || digestSfValue(actual) !== digestSfValue(decision) || !stored || digestSfValue(stored) !== digestSfValue(result) ||
          state.decisionResults?.[resultRef] || !verifyCurrentChoiceBinding(state, request, digestSfValue(binding)) ||
          digestSfValue(state.preferences[`sf:proposal-coverage:${request.coverageRef}`]) !== binding.coverageRecordDigest ||
          !input.verifySnapshot(snapshot, request, choice, result, context)) return { commit: false, value: null }
        const adopted: DecisionCase = { ...actual, version: caseRef.version, state: "reconsidering",
          alternatives: actual.alternatives.map((item) => item.id === request.alternativeRef.id
            ? { ...item, version: request.alternativeRef.version + 1, scenario: request.scenario, result: result.result } : item),
          costCoverageBases: existingBasis ? actual.costCoverageBases : [...actual.costCoverageBases, coverage.value.basis] }
        const adoptedResult: StoredDecisionResult = { ...result, caseRef, resultRef, createdAt }
        state.cases[decision.id] = adopted
        const results = state.decisionResults ??= {}
        results[resultRef] = adoptedResult
        // The provider still has asynchronous authority and target checks to run.
        // This guard checks their final staged bytes immediately before SQLite commit.
        observeAdoption(adopted, adoptedResult)
        return { commit: true, value: expectedReceipt }
      })
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" || saved.status === "preview" ? "conflict" : "unavailable", reason: "choice-promotion-unavailable" }
    }
    if (!await input.authorizeCase(decision, context) || !await input.authorizePromotion(request, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "choice-promotion-access-unavailable" }
    const confirmed = await input.state.read(source, "cases", (state, authority) => {
      if (!sameAuthority(authority, context)) return undefined
      const savedIntent = sfTransactionLookup(state, authority, transaction)
      if (savedIntent.status !== "found") return undefined
      return { decision: state.cases[request.caseRef.id], result: state.decisionResults?.[resultRef], receipt: savedIntent.receipt }
    })
    if (confirmed.status !== "ok" || !confirmed.value?.decision || confirmed.value.decision.incarnation !== request.caseRef.incarnation || confirmed.value.decision.version !== caseRef.version ||
      digestSfValue(confirmed.value.decision.choices) !== digestSfValue(decision.choices) || !confirmed.value.result || confirmed.value.result.resultDigest !== request.resultDigest ||
      !confirmed.value.receipt || digestSfValue(confirmed.value.receipt.value) !== digestSfValue(expectedReceipt) || source.signal.aborted ||
      input.host.requestFor(context) !== source || !input.fence!.current(context)) return { status: "denied", reason: "choice-promotion-access-unavailable" }
    return { status: "ok", value: expectedReceipt }
  }
  return async (request: CurrentChoicePromotion, context: TrustedDomainContext): Promise<PortResult<CurrentChoicePromotionReceipt>> => {
    if (!isCurrentChoiceFence(input.fence)) return { status: "unavailable", reason: "choice-fence-unavailable" }
    try { return await input.fence.run(context, () => promote(request, context)) }
    catch { return { status: "unavailable", reason: "choice-promotion-unavailable" } }
  }
}

function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) {
  return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision
}
