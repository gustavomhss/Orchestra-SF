import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createDecisionMutations, DecisionMutationOperation } from "../../../../modules/sucafina/Sucafinav1/product/decisions/mutations.ts"
import { createDecisionCandidateResolver } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/candidates.ts"
import type { createPortfolioProduct } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/product.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfPortfolioAuthority } from "./portfolio-authority.ts"

type Mutations = ReturnType<typeof createDecisionMutations>
type Product = ReturnType<typeof createPortfolioProduct>
type Parent = Parameters<Product["http"]["prepare"]>[0] | Parameters<Product["http"]["promote"]>[0]
type Receipt = { caseRef: { id: string; incarnation: string; version: number }; resultRef?: string }
type ParentAction = "decisions.prepare-portfolio" | "decisions.promote-portfolio"

/** A private, short-lived parent grant can authorize only its producer-derived child command. */
export function createSfPortfolioHandoff(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: Pick<ReturnType<typeof createSfBusinessServices>, "cases" | "operationIdentity">
  registries: Pick<ReturnType<typeof createSfPortfolioAuthority>, "intent">
}) {
  const { authority, business, registries } = input
  const records = new WeakMap<TrustedDomainContext, { operation: "prepare-changes" | "add-alternative"; action: ParentAction; payload: Parent; childDigest: string }>()
  const candidate = createDecisionCandidateResolver(business.cases)
  const captured = (operation: DecisionMutationOperation, payload: unknown, call: TrustedDomainContext) => {
    const value = records.get(call)
    return value && value.operation === operation && digestSfValue(payload) === value.childDigest ? value : undefined
  }
  const parent = (operation: DecisionMutationOperation, payload: unknown, call: TrustedDomainContext) => {
    const value = captured(operation, payload, call)
    return value ? structuredClone(value.payload) : undefined
  }
  const authorize = async (operation: DecisionMutationOperation, payload: unknown, call: TrustedDomainContext) => {
    const value = captured(operation, payload, call)
    return !!value && await registries.intent.authorize(call, value.action, value.payload) && await authority.host.revalidate(call)
  }
  const verify = (operation: DecisionMutationOperation, payload: unknown, call: TrustedDomainContext) => {
    const value = captured(operation, payload, call)
    return !!value && registries.intent.verify(call, value.action, value.payload)
  }
  const run = async (action: ParentAction, incoming: Parent, call: TrustedDomainContext,
    perform: () => Promise<PortResult<Receipt>>, replay: Mutations["replayPortfolio"]): Promise<PortResult<Receipt>> => {
    const payload = structuredClone(incoming)
    const operation = action === "decisions.prepare-portfolio" ? "prepare-changes" : "add-alternative"
    const source = authority.host.requestFor(call)
    const identity = business.operationIdentity(call)
    if (call.kind !== "ui" || !source || !identity || records.has(call) || !await registries.intent.authorize(call, action, payload)) return { status: "denied", reason: "portfolio-human-intent-required" }
    // Reopen the committed receipt before re-evaluating mutable inputs on a lost-reply retry.
    const prior = await authority.state.read(source, "cases", (state, actor) => actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
      ? state.transactions[JSON.stringify([actor.principalRef, "cases", payload.caseRef.id, `${identity}:${operation}`])] : undefined)
    if (prior.status !== "ok") return { status: "unavailable", reason: "portfolio-receipt-unavailable" }
    if (prior.value) {
      const saved = object(prior.value.value)
      const proof = object(saved.portfolioReplay)
      if (prior.value.namespace !== "cases" || prior.value.principalRef !== call.binding.principalRef || prior.value.targetRef !== payload.caseRef.id ||
        prior.value.targetIncarnation !== payload.caseRef.incarnation || proof.parentDigest !== digestSfValue(payload) || proof.child === undefined ||
        prior.value.commandDigest !== digestSfValue(proof.child)) return { status: "conflict", reason: "idempotency-content-changed" }
      records.set(call, { operation, action, payload, childDigest: prior.value.commandDigest })
      try {
        const result = await replay({ operation, caseRef: payload.caseRef, payload }, call)
        return result.status !== "ok" ? result : result.value.state === "found" ? { status: "ok", value: result.value.receipt }
          : { status: "stale", reason: "portfolio-receipt-changed" }
      } finally { records.delete(call) }
    }
    if (!payload.selectedCandidateRefs.length || new Set(payload.selectedCandidateRefs).size !== payload.selectedCandidateRefs.length ||
      payload.selectedCandidateRefs.some((ref) => !payload.request.candidateRefs.includes(ref))) return { status: "needs-input", reason: "invalid-portfolio-selection" }
    const selected = await Promise.all(payload.selectedCandidateRefs.map((ref) => candidate(ref, call)))
    const failed = selected.find((result) => result.status !== "ok")
    if (failed) return failed
    const candidates = selected.flatMap((result) => result.status === "ok" ? [result.value] : [])
    const operations = [...payload.request.operations, ...candidates.flatMap((value) => value.operations)]
    if (digestSfValue({ candidates: candidates.map((value) => value.ref), operations }) !== payload.combinationId) return { status: "stale", reason: "portfolio-combination-changed" }
    let child: unknown
    if (action === "decisions.prepare-portfolio" && "choiceId" in payload) child = { caseRef: payload.caseRef, choiceId: payload.choiceId, operations }
    else if (action === "decisions.promote-portfolio" && "title" in payload) {
      const first = candidates[0]
      const assumptions = candidates.flatMap((value) => value.scenario.assumptions)
      if (!first || candidates.some((value) => value.scenario.baseRef !== first.scenario.baseRef) ||
        assumptions.some((value) => assumptions.some((other) => other.id === value.id && digestSfValue(other) !== digestSfValue(value)))) return { status: "conflict", reason: "portfolio-scenario-conflict" }
      child = { caseRef: payload.caseRef, title: payload.title, coverageRef: payload.coverageRef,
        scenario: { baseRef: first.scenario.baseRef, operations, assumptions: assumptions.filter((value, index) => assumptions.findIndex((other) => digestSfValue(other) === digestSfValue(value)) === index) } }
    } else return { status: "denied", reason: "portfolio-action-payload-mismatch" }
    if (!await authority.human.authorize(call, action, payload) || !await authority.host.revalidate(call)) return { status: "denied", reason: "portfolio-human-intent-changed" }
    records.set(call, { operation, action, payload, childDigest: digestSfValue(child) })
    try { return await perform() } finally { records.delete(call) }
  }
  return { parent, authorize, verify, run }
}
