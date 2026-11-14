import { digestSfValue } from "../contracts/canonical.ts"
import { createDecisionBaselineFence } from "./baseline-fence.ts"
import { createDecisionEvidenceChecks } from "./host-evidence.ts"
import { createDecisionIntentFences } from "./intent-fences.ts"
import { createDecisionProduct } from "./product.ts"
import type { DecisionMutationOperation } from "./mutations.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createDecisionReviewAdmission } from "./review-admission.ts"

type Product = Parameters<typeof createDecisionProduct>[0]
type Intent = Parameters<typeof createDecisionIntentFences>[0]
type BaselineFence = Parameters<typeof createDecisionBaselineFence>[0]
type Checks = Parameters<typeof createDecisionEvidenceChecks>[0]
type MutationAction = "decisions.promote-alternative" | "decisions.prepare-changes" | "decisions.choose" | "decisions.promote-portfolio" | "decisions.prepare-portfolio" | "decisions.add-question" | "decisions.answer-question"

/** Wire authority and current evidence once; domain-specific producers remain explicit inputs. */
export function createDecisionHostProduct(input: Omit<Product, "management" | "baseline" | "criteria" | "selection" | "acceptance" | "application" | "mutations" | "hotTopic" | "promotion" | "currentChoice"> & {
  human: Intent["human"]
  ui: Intent["ui"]
  reviewAdmission: ReturnType<typeof createDecisionReviewAdmission>
  reviewProducer: Product["application"]["revalidateProducer"]
  readSourceFences: Intent["readSourceFences"]
  lockedSourceFences: Intent["lockedSourceFences"]
  resolveActor: BaselineFence["resolveActor"]
  evidence: Checks["evidence"]
  recomputeMetric: Checks["recomputeMetric"]
  verifyPromotionSourcesLocked: Product["promotion"]["verifySnapshot"]
  promotion: Omit<Product["promotion"], "authorizePromotion" | "verifySnapshot">
  currentChoice: {
    preview: Omit<Product["currentChoice"]["preview"], "authorizePreview" | "verifySnapshot">
    promotion: Omit<Product["currentChoice"]["promotion"], "authorizePromotion" | "verifySnapshot">
  }
  verifyCurrentChoicePreviewSourcesLocked: Product["currentChoice"]["preview"]["verifySnapshot"]
  verifyCurrentChoicePromotionSourcesLocked: Product["currentChoice"]["promotion"]["verifySnapshot"]
  verifyHotTopicSourcesLocked: Product["hotTopic"]["verifySnapshot"]
  hotTopic: Omit<Product["hotTopic"], "authorizeDraft" | "verifySnapshot">
  verifyRuleSource: Product["criteria"]["verifyEvidence"]
  verifyRuleSourcesLocked: Product["criteria"]["verifySnapshot"]
  verifyEditSourcesLocked: Product["management"]["verifyEdit"]
  verifyAcceptanceSourcesLocked: Product["acceptance"]["verifyAcceptance"]
  verifySelectionSourcesLocked: Product["selection"]["verifySnapshot"]
  verifyMutationSourcesLocked: Product["mutations"]["verifyMutation"]
  mutationGrant: (operation: DecisionMutationOperation, payload: unknown, context: TrustedDomainContext) => { action: MutationAction; payload: unknown } | undefined
  management: Omit<Product["management"], "authorizeEdit" | "verifyEvidence" | "verifyEdit">
  baseline: Omit<Product["baseline"], "authorizeCoverage" | "resolveEvidence" | "verifySnapshot">
  criteria: Omit<Product["criteria"], "authorizeRule" | "verifyEvidence" | "verifyMetric" | "verifySnapshot">
  selection: Omit<Product["selection"], "authorizeSelection" | "verifySnapshot">
  acceptance: Omit<Product["acceptance"], "authorizeAcceptance" | "confirmAcceptance" | "verifyAcceptance">
  application: Omit<Product["application"], "authorizeApplication" | "confirmApplication" | "reviewDigestFor" | "revalidateProducer"> & { confirmReview: Product["application"]["confirmApplication"] }
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
    const action = operation === "add-alternative" ? "decisions.promote-alternative" : operation === "prepare-changes" || operation === "reject-change" ? "decisions.prepare-changes" : operation === "record-choice" ? "decisions.choose" : operation === "add-question" ? "decisions.add-question" : operation === "answer-question" ? "decisions.answer-question" : undefined
    return action ? { action, payload } : undefined
  }
  const matchesCaptured = (context: TrustedDomainContext, action: "decisions.edit" | "decisions.accept-analysis") => {
    const payload = intent.payload(context, action)
    return payload !== undefined && intent.verify(context, action, payload)
  }
  return createDecisionProduct({
    ...input,
    promotion: { ...input.promotion, authorizePromotion: (request, context) => intent.authorize(context, "decisions.promote-analysis", request), verifySnapshot: (snapshot, request, output, run, context) => intent.verify(context, "decisions.promote-analysis", request) && input.verifyPromotionSourcesLocked(snapshot, request, output, run, context) },
    currentChoice: {
      preview: { ...input.currentChoice.preview, authorizePreview: (request, context) => intent.authorize(context, "decisions.promote-alternative", request), verifySnapshot: (snapshot, request, binding, context) => intent.verify(context, "decisions.promote-alternative", request) && input.verifyCurrentChoicePreviewSourcesLocked(snapshot, request, binding, context) },
      promotion: { ...input.currentChoice.promotion, authorizePromotion: (request, context) => intent.authorize(context, "decisions.promote-alternative", request), verifySnapshot: (snapshot, request, choice, result, context) => intent.verify(context, "decisions.promote-alternative", request) && input.verifyCurrentChoicePromotionSourcesLocked(snapshot, request, choice, result, context) },
    },
    hotTopic: { ...input.hotTopic, authorizeDraft: (request, context) => intent.authorize(context, "decisions.draft-hot-topic", request), verifySnapshot: (snapshot, request, draft, context) => intent.verify(context, "decisions.draft-hot-topic", request) && input.verifyHotTopicSourcesLocked(snapshot, request, draft, context) },
    management: { ...input.management, authorizeEdit: (request, context) => intent.authorize(context, "decisions.edit", request), verifyEvidence: evidence.refs, verifyEdit: (snapshot, before, after, context) => matchesCaptured(context, "decisions.edit") && input.verifyEditSourcesLocked(snapshot, before, after, context) },
    baseline: { ...input.baseline, authorizeCoverage: (request, context) => intent.authorize(context, "decisions.coverage", request), resolveEvidence: (refs, context) => input.evidence.context({ refs }, context), verifySnapshot: (snapshot, request, record, context) => baselineFence(snapshot, request, record, context) },
    criteria: { ...input.criteria, authorizeRule: (request, context) => intent.authorize(context, "decisions.criteria", request), verifyEvidence: async (rule, context) => await evidence.rule(rule, context) && await input.verifyRuleSource(rule, context), verifyMetric: evidence.metric, verifySnapshot: (snapshot, request, rule, context) => intent.verify(context, "decisions.criteria", request) && input.verifyRuleSourcesLocked(snapshot, request, rule, context) },
    selection: { ...input.selection, authorizeSelection: (request, context) => intent.authorize(context, "decisions.select-portfolio", request), verifySnapshot: (snapshot, request, selection, context) => intent.verify(context, "decisions.select-portfolio", request) && input.verifySelectionSourcesLocked(snapshot, request, selection, context) },
    acceptance: { ...input.acceptance, authorizeAcceptance: (request, context) => intent.authorize(context, "decisions.accept-analysis", request), confirmAcceptance: (request, _output, context) => input.human.authorize(context, "decisions.accept-analysis", request), verifyAcceptance: (snapshot, request, output, context) => matchesCaptured(context, "decisions.accept-analysis") && input.verifyAcceptanceSourcesLocked(snapshot, request, output, context) },
    application: { ...input.application, reviewDigestFor: input.reviewAdmission.get, revalidateProducer: input.reviewProducer, authorizeApplication: (request, _change, context) => { const payload = context.kind === "ui" ? input.reviewAdmission.payload(context, request) : undefined; return payload ? intent.authorize(context, "decisions.apply", payload) : Promise.resolve(false) }, confirmApplication: async (request, context) => { const payload = context.kind === "ui" ? input.reviewAdmission.payload(context, request) : undefined; return !!payload && await input.human.authorize(context, "decisions.apply", payload) && await input.application.confirmReview(request, context) } },
    mutations: { ...input.mutations, portfolioParent: (operation, payload, context) => { const grant = mutationIntent(operation, payload, context); return grant && (grant.action === "decisions.promote-portfolio" || grant.action === "decisions.prepare-portfolio") ? grant.payload : undefined }, authorizeMutation: (operation, payload, context) => { const grant = mutationIntent(operation, payload, context); return grant ? intent.authorize(context, grant.action, grant.payload) : Promise.resolve(false) }, verifyMutation: (snapshot, operation, payload, context) => { const grant = mutationIntent(operation, payload, context); return !!grant && intent.verify(context, grant.action, grant.payload) && input.verifyMutationSourcesLocked(snapshot, operation, payload, context) }, confirmChoice: async (caseRef, alternativeId, context) => { const payload = intent.payload(context, "decisions.choose"); return !!payload && typeof payload === "object" && "caseRef" in payload && "alternativeId" in payload && digestSfValue(payload.caseRef) === digestSfValue(caseRef) && payload.alternativeId === alternativeId && await input.human.authorize(context, "decisions.choose", payload) } },
  })
}
