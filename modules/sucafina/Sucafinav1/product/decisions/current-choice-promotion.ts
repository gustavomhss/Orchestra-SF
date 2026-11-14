import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { ChoiceRecord, DecisionCase } from "../contracts/decisions.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { StoredDecisionResult } from "./result-store.ts"
import { validateScenarioCoverage } from "./cost-coverage.ts"
import { decisionScenarioResultRef } from "./mutations.ts"

type CaseRef = { id: string; incarnation: string; version: number }
export type CurrentChoicePromotion = { caseRef: CaseRef; choiceId: string; choiceDigest: string; alternativeRef: { id: string; version: number }; resultRef: string; resultDigest: string; scenario: ScenarioRequest; coverageRef: string }

/** Adopts the exact reviewed result, leaving the historical choice unchanged. */
export function createCurrentChoicePromotion(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  sources: Pick<PlannerSourceHost, "resolveForecastCoverage">
  authorizeCase: (decision: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizePromotion: (request: CurrentChoicePromotion, context: TrustedDomainContext) => Promise<boolean>
  verifyProvenance: (request: CurrentChoicePromotion, choice: ChoiceRecord, result: StoredDecisionResult, context: TrustedDomainContext) => Promise<boolean>
  verifySnapshot: (snapshot: Snapshot, request: CurrentChoicePromotion, choice: ChoiceRecord, result: StoredDecisionResult, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  now: () => string
}) {
  return async (incoming: CurrentChoicePromotion, context: TrustedDomainContext): Promise<PortResult<{ caseRef: CaseRef; resultRef: string }>> => {
    try {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (context.kind !== "ui" || !source || !operation || !request.choiceId.trim() || !request.resultRef.trim() || !request.coverageRef.trim() || !/^[a-f0-9]{64}$/.test(request.choiceDigest) || !/^[a-f0-9]{64}$/.test(request.resultDigest) || !decodeSfOperationInput("sf_scenario_simulate", request.scenario).ok || !await input.authorizePromotion(request, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "choice-promotion-access-unavailable" }
      const loaded = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? { decision: state.cases[request.caseRef.id], result: state.decisionResults?.[request.resultRef], prior: state.transactions[JSON.stringify([authority.principalRef, "cases", request.caseRef.id, `${operation}:promote-current-choice`])] } : undefined)
      if (loaded.status !== "ok" || !loaded.value?.decision || loaded.value.decision.incarnation !== request.caseRef.incarnation || !loaded.value.decision.participants.includes(context.binding.principalRef) || !await input.authorizeCase(loaded.value.decision, context)) return { status: "denied", reason: "choice-promotion-access-unavailable" }
      const decision = loaded.value.decision
      if (loaded.value.prior) {
        const prior = loaded.value.prior
        if (prior.commandDigest !== digestSfValue(request) || prior.targetIncarnation !== request.caseRef.incarnation) return { status: "conflict", reason: "idempotency-content-changed" }
        const saved = prior.value
        if (!saved || typeof saved !== "object" || !("caseRef" in saved) || !("resultRef" in saved) || typeof saved.resultRef !== "string" || !saved.caseRef || typeof saved.caseRef !== "object" || !("id" in saved.caseRef) || saved.caseRef.id !== request.caseRef.id || !("incarnation" in saved.caseRef) || saved.caseRef.incarnation !== request.caseRef.incarnation || !("version" in saved.caseRef) || !Number.isSafeInteger(saved.caseRef.version)) return { status: "unavailable", reason: "choice-promotion-receipt-unavailable" }
        const savedRef = saved.resultRef
        const savedVersion = Number(saved.caseRef.version)
        const checked = await input.state.read(source, "cases", (state) => state.decisionResults?.[savedRef])
        if (checked.status !== "ok" || !checked.value || checked.value.kind !== "scenario" || checked.value.resultDigest !== request.resultDigest || checked.value.resultDigest !== digestSfValue(checked.value.result) || checked.value.caseRef.id !== request.caseRef.id || checked.value.caseRef.incarnation !== request.caseRef.incarnation || checked.value.caseRef.version !== savedVersion || !await input.host.revalidate(context)) return { status: "unavailable", reason: "choice-promotion-receipt-unavailable" }
        return { status: "ok", value: { caseRef: { id: request.caseRef.id, incarnation: request.caseRef.incarnation, version: savedVersion }, resultRef: savedRef } }
      }
      if (decision.version !== request.caseRef.version) return { status: "stale", reason: "case-changed" }
      const choices = decision.choices.filter((choice) => choice.id === request.choiceId && digestSfValue(choice) === request.choiceDigest)
      const alternatives = decision.alternatives.filter((item) => item.id === request.alternativeRef.id && item.version === request.alternativeRef.version)
      const result = loaded.value.result
      if (choices.length !== 1 || alternatives.length !== 1 || !result || result.kind !== "scenario" || result.caseRef.id !== request.caseRef.id || result.caseRef.incarnation !== request.caseRef.incarnation || result.caseRef.version !== request.caseRef.version || result.resultRef !== request.resultRef || result.requestDigest !== digestSfValue(request.scenario) || result.resultDigest !== request.resultDigest || result.resultDigest !== digestSfValue(result.result) || result.result.costCoverage.alternativeId !== request.alternativeRef.id || result.result.costCoverage.alternativeVersion !== request.alternativeRef.version + 1 || result.result.currency !== decision.currency || digestSfValue(result.result.horizon) !== digestSfValue(decision.horizon)) return { status: "conflict", reason: "choice-result-mismatch" }
      const choice = choices[0]!
      if (choice.alternativeId !== request.alternativeRef.id) return { status: "conflict", reason: "choice-alternative-mismatch" }
      if (!await input.verifyProvenance(request, choice, result, context)) return { status: "denied", reason: "choice-provenance-unavailable" }
      const coverage = await input.sources.resolveForecastCoverage(request.coverageRef, context)
      if (coverage.status !== "ok") return coverage
      if (coverage.value.coverageRef !== request.coverageRef || digestSfValue(coverage.value.assessment) !== digestSfValue(result.result.costCoverage) || validateScenarioCoverage(result.result, coverage.value.basis, coverage.value.assessment)) return { status: "conflict", reason: "choice-coverage-changed" }
      const existingBasis = decision.costCoverageBases.find((basis) => basis.id === coverage.value.basis.id && basis.version === coverage.value.basis.version)
      if (existingBasis && digestSfValue(existingBasis) !== digestSfValue(coverage.value.basis)) return { status: "conflict", reason: "coverage-inventory-version-conflict" }
      const caseRef = { ...request.caseRef, version: request.caseRef.version + 1 }
      const resultRef = decisionScenarioResultRef(caseRef, result.requestDigest)
      const createdAt = input.now()
      if (!Number.isFinite(Date.parse(createdAt)) || !await input.authorizePromotion(request, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "choice-promotion-access-unavailable" }
      const saved = await input.state.transaction(source, { namespace: "cases", domainSurface: "planner", expectedStorageVersion: loaded.storageVersion, targetRef: decision.id, targetIncarnation: decision.incarnation, idempotencyKey: `${operation}:promote-current-choice`, commandDigest: digestSfValue(request) }, async (state, authority, snapshot) => {
        const actual = state.cases[decision.id]
        const stored = state.decisionResults?.[request.resultRef]
        if (authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision || !actual || actual.incarnation !== decision.incarnation || actual.version !== decision.version || !actual.participants.includes(context.binding.principalRef) || !stored || digestSfValue(stored) !== digestSfValue(result) || actual.choices.filter((item) => item.id === choice.id && digestSfValue(item) === request.choiceDigest).length !== 1 || actual.alternatives.filter((item) => item.id === request.alternativeRef.id && item.version === request.alternativeRef.version).length !== 1 || state.decisionResults?.[resultRef] || !input.verifySnapshot(snapshot, request, choice, result, context)) return { commit: false, value: null }
        state.cases[decision.id] = { ...actual, version: caseRef.version, state: "reconsidering", alternatives: actual.alternatives.map((item) => item.id === request.alternativeRef.id ? { ...item, version: request.alternativeRef.version + 1, scenario: request.scenario, result: result.result } : item), costCoverageBases: existingBasis ? actual.costCoverageBases : [...actual.costCoverageBases, coverage.value.basis] }
        const results = state.decisionResults ??= {}
        results[resultRef] = { ...result, caseRef, resultRef, createdAt }
        return { commit: true, value: { caseRef, resultRef } }
      })
      if (saved.status !== "ok" || !saved.value) return { status: saved.status === "conflict" || saved.status === "preview" ? "conflict" : "unavailable", reason: "choice-promotion-unavailable" }
      const confirmed = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? { decision: state.cases[request.caseRef.id], result: state.decisionResults?.[resultRef] } : undefined)
      if (confirmed.status !== "ok" || !confirmed.value?.decision || confirmed.value.decision.incarnation !== request.caseRef.incarnation || confirmed.value.decision.version !== caseRef.version || !confirmed.value.decision.participants.includes(context.binding.principalRef) || confirmed.value.decision.choices.filter((item) => item.id === choice.id && digestSfValue(item) === request.choiceDigest).length !== 1 || confirmed.value.decision.alternatives.filter((item) => item.id === request.alternativeRef.id && item.version === request.alternativeRef.version + 1 && digestSfValue(item.scenario) === result.requestDigest && digestSfValue(item.result) === request.resultDigest).length !== 1 || !confirmed.value.result || confirmed.value.result.resultDigest !== request.resultDigest || !await input.authorizeCase(confirmed.value.decision, context) || !await input.authorizePromotion(request, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "choice-promotion-access-unavailable" }
      return { status: "ok", value: saved.value }
    } catch { return { status: "unavailable", reason: "choice-promotion-unavailable" } }
  }
}
