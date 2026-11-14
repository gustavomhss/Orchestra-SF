import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { createPortfolioProduct } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/product.ts"
import { createDecisionMutations } from "../../../../modules/sucafina/Sucafinav1/product/decisions/mutations.ts"
import type { DecisionMutationOperation } from "../../../../modules/sucafina/Sucafinav1/product/decisions/mutations.ts"
import { decisionCoverageRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-access.ts"
import { parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { createPlannerSensitivityUnits } from "../../../../modules/sucafina/Sucafinav1/product/planner/sensitivity-units.ts"
import { comparePlannerPreview } from "../../../../modules/sucafina/Sucafinav1/product/planner/preview-comparison.ts"
import { createPortfolioProofVerifier } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/verification.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import { createSfPortfolioAuthority } from "./portfolio-authority.ts"

type Mutations = Parameters<typeof createDecisionMutations>[0]
export type SfPortfolioPreparation = Pick<Mutations, "prepareDomainCommands" | "resolveChoiceValues" | "confirmChoice" | "confirmAnswer"> &
  Partial<Pick<Mutations, "portfolioParent" | "authorizeMutation" | "verifyMutation" | "coverageEvidence">>

/** Evaluation works from stored human criteria; absent domain preparation cannot become a successful handoff. */
export function createSfPortfolioServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  proposalCoverageWrites: WeakSet<object>
  preparation?: SfPortfolioPreparation
}) {
  const { authority, business } = input
  const verification: { proof?: ReturnType<typeof createPortfolioProofVerifier> } = {}
  const registries = createSfPortfolioAuthority({ ...input, proof: () => verification.proof })
  const action = (operation: DecisionMutationOperation) => operation === "add-alternative" ? "decisions.promote-alternative" : operation === "prepare-changes" ? "decisions.prepare-changes" : operation === "record-choice" ? "decisions.choose" : operation === "add-question" ? "decisions.add-question" : "decisions.answer-question"
  const mutations = createDecisionMutations({ state: authority.state, host: authority.host, planner: registries.planner, sources: business.plannerSources,
    authorizeCase: registries.authorizeCase, operationIdentity: business.operationIdentity,
    authorizeMutation: input.preparation?.authorizeMutation ?? ((operation, request, call) => registries.intent.authorize(call, action(operation), request)),
    verifyMutation: input.preparation?.verifyMutation ?? ((_snapshot, operation, request, call) => registries.intent.verify(call, action(operation), request)),
    ...(input.preparation?.portfolioParent ? { portfolioParent: input.preparation.portfolioParent } : {}),
    ...(input.preparation?.coverageEvidence ? { coverageEvidence: input.preparation.coverageEvidence } : {}),
    confirmChoice: input.preparation?.confirmChoice ?? (async () => false),
    confirmAnswer: input.preparation?.confirmAnswer ?? (async () => false),
    resolveQuestion: business.collaboration.resolveQuestion,
    resolveAnswer: business.collaboration.resolveAnswer,
    resolveChoiceValues: input.preparation?.resolveChoiceValues ?? (async () => ({ status: "unavailable", reason: "portfolio-human-choice-values-unavailable" })),
    prepareDomainCommands: input.preparation?.prepareDomainCommands ?? (async () => ({ status: "unavailable", reason: "portfolio-domain-command-preparation-unavailable" })),
    readScenarioResult: (resultRef, call) => business.results.read({ resultRef, kind: "scenario" }, call),
    createId: randomUUID, now: () => new Date().toISOString(),
  })
  const scenarios = business.plannerProduct.scenarios
  const idempotencyKey: Parameters<typeof createPortfolioProduct>[0]["idempotencyKey"] = async (digest, call) => {
    const identity = business.operationIdentity(call)
    return identity && await authority.host.revalidate(call) ? `extended:${digestSfValue({ identity, digest })}` : undefined
  }
  const units = scenarios ? createPlannerSensitivityUnits({ host: authority.host, cases: business.cases, scenarios, store: business.results,
    evidence: business.context, rules: registries.rules }) : undefined
  const createReceipt: Parameters<typeof createPortfolioProduct>[0]["createReceipt"] = async (call, operation, digest, result) => business.receipt(call, operation, digest, result)
  if (scenarios && units) verification.proof = createPortfolioProofVerifier({ cases: business.cases, planner: registries.planner,
    sources: business.plannerSources, evidence: business.context, results: business.results, revalidate: authority.host.revalidate,
    readSourceFences: business.readSourceFences, lockedSourceFences: business.lockedSourceFences, caseFor: business.resolveCase,
    idempotencyKey, decisions: mutations, createReceipt, units,
    candidateCoverageRefFor: async (candidate) => {
      const ref = parseCaseRef(candidate.caseRef)
      return ref && candidate.result ? { status: "ok", value: decisionCoverageRef(ref, candidate.result.costCoverage.alternativeId, candidate.result.costCoverage.alternativeVersion) }
        : { status: "unavailable", reason: "candidate-coverage-unavailable" }
    },
    revalidateAnalysis: async (analysis, call) => {
      const scenario = await business.results.read({ kind: "scenario", resultRef: analysis.scenarioResultRef }, call)
      const comparison = await business.results.read({ kind: "comparison", resultRef: analysis.comparisonRef }, call)
      if (scenario.status !== "ok" || comparison.status !== "ok" || scenario.value.kind !== "scenario" || comparison.value.kind !== "comparison" ||
        digestSfValue(scenario.value.result) !== digestSfValue(analysis.scenario) || digestSfValue(comparison.value.result) !== digestSfValue(analysis.comparison)) return false
      const bound = await registries.comparisonBindings.read({ caseRef: comparison.value.caseRef, resultRef: analysis.comparisonRef }, call)
      return bound.status === "ok" && await authority.host.revalidate(call)
    },
    sensitivityPreview: (request, call) => comparePlannerPreview({ host: authority.host, sources: business.plannerSources, scenarios, planner: registries.planner }, request, call),
  })
  const product = scenarios ? createPortfolioProduct({ host: authority.host, cases: business.cases, evidence: business.context,
    planner: { planner: registries.planner, sources: business.plannerSources, scenarios }, results: business.results,
    rules: registries.rules, selection: registries.selection, sensitivityBindings: registries.sensitivityBindings,
    comparisonBindings: registries.comparisonBindings, portfolioBindings: registries.portfolioBindings,
    decisions: mutations, createReceipt, caseFor: business.resolveCase,
    idempotencyKey,
  }) : undefined
  return { ...registries, mutations, product, units, proof: verification.proof, descriptors: product?.contribution.capabilities ?? [],
    unavailable: [...(scenarios ? [] : ["portfolio-planner-stored-scenarios-unavailable"]),
      ...(input.preparation ? [] : ["portfolio-domain-command-preparation-unavailable", "portfolio-human-choice-values-unavailable"])],
  }
}
