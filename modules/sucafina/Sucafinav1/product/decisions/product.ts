import { createAnalysisAcceptance } from "./analysis-acceptance.ts"
import { createPreparedExecution } from "./apply.ts"
import { createDecisionBaselineCoverage } from "./baseline-coverage.ts"
import { createDecisionCaseManagement } from "./case-management.ts"
import { createDecisionChoiceCatalog } from "./choice-catalog.ts"
import { createDecisionCoverageCatalog } from "./coverage-catalog.ts"
import { createDecisionComparisonService } from "./comparison.ts"
import { createCriterionComparisonBindings } from "./criterion-comparison.ts"
import { createCriterionResultBindings, createCriterionRuleRegistry } from "./criterion-rules.ts"
import { createDecisionMutations } from "./mutations.ts"
import { createDecisionPreparedReview } from "./prepared-review.ts"
import { createPortfolioResultBindings } from "./portfolio-bindings.ts"
import { createDecisionPortfolioSelection } from "./portfolio-selection.ts"
import type { createSfDecisionResultStore } from "./result-store.ts"
import type { DecisionCasePort, PlannerPort, PlannerSourceHost } from "../contracts/ports.ts"

type Common = Pick<Parameters<typeof createDecisionCaseManagement>[0], "state" | "host" | "authorizeCase" | "operationIdentity">
type Shared = "state" | "host" | "authorizeCase" | "operationIdentity"
type Evidence = { proposalCoverageWrites: WeakSet<object>; now: () => string }

/** Compose the existing Decisions services with explicit host authority and evidence producers. */
export function createDecisionProduct(input: Common & Evidence & {
  reviewDomain: Parameters<typeof createDecisionPreparedReview>[0]["reviewDomain"]
  cases: DecisionCasePort
  results: ReturnType<typeof createSfDecisionResultStore>
  planner: PlannerPort
  sources: PlannerSourceHost
  baseline: Omit<Parameters<typeof createDecisionBaselineCoverage>[0], Shared | keyof Evidence>
  management: Omit<Parameters<typeof createDecisionCaseManagement>[0], Shared>
  mutations: Omit<Parameters<typeof createDecisionMutations>[0], Shared | "planner" | "sources">
  acceptance: Omit<Parameters<typeof createAnalysisAcceptance>[0], Shared>
  application: Omit<Parameters<typeof createPreparedExecution>[0], Shared>
  criteria: Omit<Parameters<typeof createCriterionRuleRegistry>[0], Shared | keyof Evidence>
  sensitivityBindings: Omit<Parameters<typeof createCriterionResultBindings>[0], Shared | keyof Evidence | "rules" | "results">
  comparisonBindings: Omit<Parameters<typeof createCriterionComparisonBindings>[0], Shared | keyof Evidence | "rules" | "results">
  selection: Omit<Parameters<typeof createDecisionPortfolioSelection>[0], Shared | keyof Evidence | "compare">
  portfolioBindings: Omit<Parameters<typeof createPortfolioResultBindings>[0], Shared | keyof Evidence | "results" | "selection">
}) {
  const common = { state: input.state, host: input.host, authorizeCase: input.authorizeCase, operationIdentity: input.operationIdentity }
  const evidence = { proposalCoverageWrites: input.proposalCoverageWrites, now: input.now }
  const baseline = createDecisionBaselineCoverage({ ...input.baseline, ...common, ...evidence })
  const management = createDecisionCaseManagement({ ...input.management, ...common })
  const mutations = createDecisionMutations({ ...input.mutations, ...common, planner: input.planner, sources: input.sources })
  const accept = createAnalysisAcceptance({ ...input.acceptance, ...common })
  const apply = createPreparedExecution({ ...input.application, ...common })
  const criteria = createCriterionRuleRegistry({ ...input.criteria, ...common, ...evidence })
  const sensitivityBindings = createCriterionResultBindings({ ...input.sensitivityBindings, ...common, ...evidence, rules: criteria, results: input.results })
  const comparisonBindings = createCriterionComparisonBindings({ ...input.comparisonBindings, ...common, ...evidence, rules: criteria, results: input.results })
  const reviewChange = createDecisionPreparedReview({ state: input.state, cases: input.cases, host: input.host, reviewDomain: input.reviewDomain })
  const choiceCatalog = createDecisionChoiceCatalog({ cases: input.cases, host: input.host })
  const coverageCatalog = createDecisionCoverageCatalog({ cases: input.cases, host: input.host, sources: input.sources })
  const compare = createDecisionComparisonService({ cases: input.cases, state: input.state, host: input.host, results: input.results, planner: input.planner })
  const selection = createDecisionPortfolioSelection({ ...input.selection, ...common, ...evidence, compare })
  const portfolioBindings = createPortfolioResultBindings({ ...input.portfolioBindings, ...common, ...evidence, selection, results: input.results })
  return { baseline, management, mutations, accept, apply, criteria, sensitivityBindings, comparisonBindings, compare, selection, portfolioBindings, coverageCatalog, choiceCatalog, reviewChange }
}
