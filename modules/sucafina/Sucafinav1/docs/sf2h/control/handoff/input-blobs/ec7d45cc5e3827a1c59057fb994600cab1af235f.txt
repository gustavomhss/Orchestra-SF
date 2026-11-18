import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { SfOperationOutputMap } from "../contracts/outputs.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"

type ResultMap = { scenario: SfOperationOutputMap["sf_scenario_simulate"]; comparison: SfOperationOutputMap["sf_scenario_compare"]; sensitivity: SfOperationOutputMap["sf_sensitivity_evaluate"]; portfolio: SfOperationOutputMap["sf_portfolio_evaluate"] }
type Result = { [K in keyof ResultMap]: { kind: K; result: ResultMap[K] } }[keyof ResultMap]
type CaseRef = { id: string; incarnation: string; version: number }
export type StoredDecisionResult = Result & { schema: "sf-decision-result-v1"; resultRef: string; caseRef: CaseRef; principalRef: string; accessRevision: string; policyVersion: string; requestDigest: string; resultDigest: string; sourceRefs: readonly BusinessEvidenceRef[]; createdAt: string }
type Write = Result & { caseRef: CaseRef; requestDigest: string; sourceRefs: readonly BusinessEvidenceRef[]; idempotencyKey: string }

export function createSfDecisionResultStore(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  verifySources: (value: Result, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
  createId: () => string
  now: () => string
}) {
  const readResult = async (request: { resultRef: string; kind: keyof ResultMap }, context: TrustedDomainContext, historical: boolean): Promise<PortResult<StoredDecisionResult>> => {
    const source = input.host.requestFor(context)
    if (!source || !request.resultRef.trim() || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "invalid-authority" }
    const current = await input.state.read(source, "cases", (state, authority) => {
      if (!sameAuthority(authority, context)) return undefined
      const stored = (state as typeof state & { decisionResults?: Record<string, StoredDecisionResult> }).decisionResults?.[request.resultRef]
      return stored ? { stored, current: state.cases[stored.caseRef.id] } : undefined
    }).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
    if (current.status !== "ok") return { status: current.status === "preview" ? "unavailable" : current.status, reason: "result-unavailable" }
    const value = current.value
    if (!value || value.stored.kind !== request.kind || !validResult(value.stored) || value.stored.resultRef !== request.resultRef || value.stored.resultDigest !== digestSfValue(value.stored.result)) return { status: "unavailable", reason: "result-unavailable" }
    if (!allowedCase(value.current, value.stored.caseRef, context, historical) || !await input.authorizeCase(value.current!, context).catch(() => false) || !await input.verifySources(value.stored, value.stored.sourceRefs, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "result-access-unavailable" }
    const again = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { current: state.cases[value.stored.caseRef.id], stored: (state as typeof state & { decisionResults?: Record<string, StoredDecisionResult> }).decisionResults?.[request.resultRef] } : undefined).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
    if (again.status !== "ok") return { status: "unavailable", reason: "result-unavailable" }
    if (!again.value || !allowedCase(again.value.current, value.stored.caseRef, context, historical) || again.value.current?.version !== value.current?.version || !again.value.stored || digestSfValue(again.value.stored) !== digestSfValue(value.stored) || !await input.authorizeCase(again.value.current!, context).catch(() => false) || !await input.verifySources(again.value.stored, again.value.stored.sourceRefs, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "result-access-unavailable" }
    return { status: "ok", value: structuredClone(value.stored) }
  }
  const read = (request: { resultRef: string; kind: keyof ResultMap }, context: TrustedDomainContext) => readResult(request, context, false)
  const readHistoricalScenario = (request: { resultRef: string }, context: TrustedDomainContext) => readResult({ resultRef: request.resultRef, kind: "scenario" }, context, true)
  const readByRequest = async (request: { caseRef: CaseRef; kind: keyof ResultMap; idempotencyKey: string; requestDigest: string }, context: TrustedDomainContext): Promise<PortResult<{ state: "found"; result: StoredDecisionResult } | { state: "not-found" }>> => {
    const source = input.host.requestFor(context)
    if (!source || !request.idempotencyKey.trim() || !/^[a-f0-9]{64}$/.test(request.requestDigest) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "invalid-authority" }
    const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { decision: state.cases[request.caseRef.id], prior: state.transactions[JSON.stringify([authority.principalRef, "cases", request.caseRef.id, `decision-result:${request.idempotencyKey}`])] } : undefined).catch(() => undefined)
    if (!current || current.status !== "ok" || !current.value) return { status: "unavailable", reason: "result-unavailable" }
    if (!allowedCase(current.value.decision, request.caseRef, context) || !await input.authorizeCase(current.value.decision!, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "result-access-unavailable" }
    if (!current.value.prior) {
      const again = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { decision: state.cases[request.caseRef.id], prior: state.transactions[JSON.stringify([authority.principalRef, "cases", request.caseRef.id, `decision-result:${request.idempotencyKey}`])] } : undefined).catch(() => undefined)
      if (!again || again.status !== "ok" || !again.value || again.value.prior || !allowedCase(again.value.decision, request.caseRef, context) || !await input.authorizeCase(again.value.decision!, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "stale", reason: "result-state-changed" }
      return { status: "ok", value: { state: "not-found" } }
    }
    const saved = current.value.prior.value
    if (!saved || typeof saved !== "object" || !("resultRef" in saved) || typeof saved.resultRef !== "string" || !("requestDigest" in saved) || saved.requestDigest !== request.requestDigest || !("kind" in saved) || saved.kind !== request.kind || current.value.prior.targetIncarnation !== request.caseRef.incarnation) return { status: "conflict", reason: "idempotency-content-changed" }
    const result = await read({ resultRef: saved.resultRef, kind: request.kind }, context)
    if (result.status !== "ok") return result
    if (result.value.requestDigest !== request.requestDigest || digestSfValue(result.value.caseRef) !== digestSfValue(request.caseRef) || digestSfValue(result.value) !== digestSfValue(saved)) return { status: "conflict", reason: "idempotency-content-changed" }
    return { status: "ok", value: { state: "found", result: result.value } }
  }
  const write = async (incoming: Write, context: TrustedDomainContext): Promise<PortResult<StoredDecisionResult>> => {
    const request = structuredClone(incoming)
    if (!validResult(request) || !/^[a-f0-9]{64}$/.test(request.requestDigest) || !request.idempotencyKey.trim() || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version) || request.caseRef.version < 0) return { status: "needs-input", reason: "invalid-result" }
    const source = input.host.requestFor(context)
    if (!source || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "invalid-authority" }
    const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
    if (current.status !== "ok") return { status: current.status === "preview" ? "unavailable" : current.status, reason: "case-unavailable" }
    if (!allowedCase(current.value, request.caseRef, context) || !await input.authorizeCase(current.value!, context).catch(() => false) || !await input.verifySources(request, request.sourceRefs, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "result-access-unavailable" }
    const id = input.createId()
    if (!id.trim()) return { status: "unavailable", reason: "result-identity-unavailable" }
    const stored = { schema: "sf-decision-result-v1" as const, resultRef: `decision-result:${encodeURIComponent(id)}`, caseRef: request.caseRef, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, requestDigest: request.requestDigest, resultDigest: digestSfValue(request.result), sourceRefs: request.sourceRefs, createdAt: input.now(), kind: request.kind, result: request.result } as StoredDecisionResult
    const saved = await input.state.transaction(source, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey: `decision-result:${request.idempotencyKey}`, commandDigest: digestSfValue({ kind: request.kind, result: request.result, caseRef: request.caseRef, requestDigest: request.requestDigest, sourceRefs: request.sourceRefs }) }, async (state, authority) => {
      if (!sameAuthority(authority, context) || !allowedCase(state.cases[request.caseRef.id], request.caseRef, context)) return { commit: false, value: null }
      const results = state as typeof state & { decisionResults?: Record<string, StoredDecisionResult> }
      results.decisionResults ??= {}
      if (results.decisionResults[stored.resultRef]) return { commit: false, value: null }
      results.decisionResults[stored.resultRef] = structuredClone(stored)
      return { commit: true, value: stored }
    }).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
    if (saved.status !== "ok") return { status: saved.status === "preview" ? "conflict" : saved.status, reason: "result-write-unavailable" }
    if (!saved.value) return { status: "conflict", reason: "result-identity-conflict" }
    return read({ resultRef: saved.value.resultRef, kind: request.kind }, context)
  }
  return { write, read, readHistoricalScenario, readByRequest }
}

function sameAuthority(authority: { principalRef: string; policyVersion: string; accessRevision: string }, context: TrustedDomainContext) {
  return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision
}

function allowedCase(value: DecisionCase | undefined, ref: CaseRef, context: TrustedDomainContext, historical = false) {
  return !!value && value.id === ref.id && value.incarnation === ref.incarnation && (historical ? value.version >= ref.version : value.version === ref.version) && value.participants.includes(context.binding.principalRef) && (context.kind !== "native" || (context.binding.caseId === ref.id && context.binding.caseIncarnation === ref.incarnation && context.binding.caseVersion === value.version))
}

function validResult(value: Result) {
  if (value.kind === "scenario") return decodeSfOperationOutput("sf_scenario_simulate", value.result).ok
  if (value.kind === "comparison") return decodeSfOperationOutput("sf_scenario_compare", value.result).ok
  if (value.kind === "sensitivity") return decodeSfOperationOutput("sf_sensitivity_evaluate", value.result).ok
  if (value.kind === "portfolio") return decodeSfOperationOutput("sf_portfolio_evaluate", value.result).ok
  return false
}
