import { digestSfValue } from "../contracts/canonical.ts"
import { createDecisionBaselineFence } from "./baseline-fence.ts"
import { createDecisionEvidenceChecks } from "./host-evidence.ts"
import { createDecisionIntentFences } from "./intent-fences.ts"
import { createDecisionProduct } from "./product.ts"
import type { DecisionMutationOperation } from "./mutations.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

type Product = Parameters<typeof createDecisionProduct>[0]
type Intent = Parameters<typeof createDecisionIntentFences>[0]
type BaselineFence = Parameters<typeof createDecisionBaselineFence>[0]
type Checks = Parameters<typeof createDecisionEvidenceChecks>[0]
type MutationAction = "decisions.promote-alternative" | "decisions.prepare-changes" | "decisions.choose" | "decisions.promote-portfolio" | "decisions.prepare-portfolio"

/** Wire authority and current evidence once; domain-specific producers remain explicit inputs. */
export function createDecisionHostProduct(input: Omit<Product, "management" | "baseline" | "criteria" | "selection" | "acceptance" | "application" | "mutations"> & {
  human: Intent["human"]
  ui: Intent["ui"]
  readSourceFences: Intent["readSourceFences"]
  lockedSourceFences: Intent["lockedSourceFences"]
  resolveActor: BaselineFence["resolveActor"]
  evidence: Checks["evidence"]
  recomputeMetric: Checks["recomputeMetric"]
  verifyRuleSource: Product["criteria"]["verifyEvidence"]
  mutationGrant: (operation: DecisionMutationOperation, payload: unknown, context: TrustedDomainContext) => { action: MutationAction; payload: unknown } | undefined
  management: Omit<Product["management"], "authorizeEdit" | "verifyEvidence" | "verifyEdit">
  baseline: Omit<Product["baseline"], "authorizeCoverage" | "resolveEvidence" | "verifySnapshot">
  criteria: Omit<Product["criteria"], "authorizeRule" | "verifyEvidence" | "verifyMetric" | "verifySnapshot">
  selection: Omit<Product["selection"], "authorizeSelection" | "verifySnapshot">
  acceptance: Omit<Product["acceptance"], "authorizeAcceptance" | "confirmAcceptance" | "verifyAcceptance">
  application: Omit<Product["application"], "authorizeApplication" | "confirmApplication"> & { confirmReview: Product["application"]["confirmApplication"] }
  mutations: Omit<Product["mutations"], "authorizeMutation" | "verifyMutation" | "confirmChoice">
}) {
  const intent = createDecisionIntentFences({ human: input.human, ui: input.ui, readSourceFences: input.readSourceFences, lockedSourceFences: input.lockedSourceFences })
  const evidence = createDecisionEvidenceChecks({ host: input.host, evidence: input.evidence, recomputeMetric: input.recomputeMetric })
  const baselineFence = createDecisionBaselineFence({ resolveActor: input.resolveActor, matchesIntent: (context, action, payload) => intent.verify(context, action, payload) })
  const mutationIntent = (operation: DecisionMutationOperation, payload: unknown, context: TrustedDomainContext) => {
    const derived = input.mutationGrant(operation, payload, context)
    if (derived) {
      if (operation === "add-alternative" && derived.action === "decisions.promote-portfolio" || operation === "prepare-changes" && derived.action === "decisions.prepare-portfolio") return derived
      return undefined
    }
    const action = operation === "add-alternative" ? "decisions.promote-alternative" : operation === "prepare-changes" ? "decisions.prepare-changes" : operation === "record-choice" ? "decisions.choose" : undefined
    return action ? { action, payload } : undefined
  }
  const matchesCaptured = (context: TrustedDomainContext, action: "decisions.edit" | "decisions.accept-analysis") => {
    const payload = intent.payload(context, action)
    return payload !== undefined && intent.verify(context, action, payload)
  }
  return createDecisionProduct({
    ...input,
    management: { ...input.management, authorizeEdit: (request, context) => intent.authorize(context, "decisions.edit", request), verifyEvidence: evidence.refs, verifyEdit: (_snapshot, _before, _after, context) => matchesCaptured(context, "decisions.edit") },
    baseline: { ...input.baseline, authorizeCoverage: (request, context) => intent.authorize(context, "decisions.coverage", request), resolveEvidence: (refs, context) => input.evidence.context({ refs }, context), verifySnapshot: (snapshot, request, record, context) => baselineFence(snapshot, request, record, context) },
    criteria: { ...input.criteria, authorizeRule: (request, context) => intent.authorize(context, "decisions.criteria", request), verifyEvidence: async (rule, context) => await evidence.rule(rule, context) && await input.verifyRuleSource(rule, context), verifyMetric: evidence.metric, verifySnapshot: (_snapshot, request, _rule, context) => intent.verify(context, "decisions.criteria", request) },
    selection: { ...input.selection, authorizeSelection: (request, context) => intent.authorize(context, "decisions.select-portfolio", request), verifySnapshot: (_snapshot, request, _selection, context) => intent.verify(context, "decisions.select-portfolio", request) },
    acceptance: { ...input.acceptance, authorizeAcceptance: (request, context) => intent.authorize(context, "decisions.accept-analysis", request), confirmAcceptance: (request, _output, context) => input.human.authorize(context, "decisions.accept-analysis", request), verifyAcceptance: (_snapshot, _request, _output, context) => matchesCaptured(context, "decisions.accept-analysis") },
    application: { ...input.application, authorizeApplication: (request, _change, context) => intent.authorize(context, "decisions.apply", request), confirmApplication: async (request, context) => await input.human.authorize(context, "decisions.apply", request) && await input.application.confirmReview(request, context) },
    mutations: { ...input.mutations, authorizeMutation: (operation, payload, context) => { const grant = mutationIntent(operation, payload, context); return grant ? intent.authorize(context, grant.action, grant.payload) : Promise.resolve(false) }, verifyMutation: (_snapshot, operation, payload, context) => { const grant = mutationIntent(operation, payload, context); return !!grant && intent.verify(context, grant.action, grant.payload) }, confirmChoice: async (caseRef, alternativeId, context) => { const payload = intent.payload(context, "decisions.choose"); return !!payload && typeof payload === "object" && "caseRef" in payload && "alternativeId" in payload && digestSfValue(payload.caseRef) === digestSfValue(caseRef) && payload.alternativeId === alternativeId && await input.human.authorize(context, "decisions.choose", payload) } },
  })
}
