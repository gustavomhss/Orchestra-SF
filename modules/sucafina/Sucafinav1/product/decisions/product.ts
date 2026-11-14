import { createAnalysisAlternativePromotion } from "./analysis-promotion.ts"
import { createAnalysisAcceptance } from "./analysis-acceptance.ts"
import { createAssumptionDivergenceService } from "./assumption-divergence.ts"
import { createPreparedExecution } from "./apply.ts"
import { createPreparedApplicationStatus } from "./application-status.ts"
import { createDecisionBaselineCoverage } from "./baseline-coverage.ts"
import { createDecisionCaseManagement } from "./case-management.ts"
import { createHotTopicDraftStore } from "./hot-topic-draft.ts"
import { createDecisionChoiceResultLookup } from "./choice-result-lookup.ts"
import { createChangeProposalStore } from "./change-proposal-store.ts"
import { createChangeProposalService } from "./proposals.ts"
import { createDecisionChoiceCatalog } from "./choice-catalog.ts"
import { createCurrentChoicePreview } from "./current-choice-preview.ts"
import { createCurrentChoicePromotion } from "./current-choice-promotion.ts"
import { createDecisionCoverageCatalog } from "./coverage-catalog.ts"
import { createDecisionComparisonService } from "./comparison.ts"
import { createCriterionComparisonBindings } from "./criterion-comparison.ts"
import { createCriterionResultBindings, createCriterionRuleRegistry } from "./criterion-rules.ts"
import { createDecisionMutations } from "./mutations.ts"
import { createDecisionPreparedReview } from "./prepared-review.ts"
import { createPortfolioHistory } from "./portfolio-history.ts"
import { createPortfolioResultBindings } from "./portfolio-bindings.ts"
import { createDecisionPortfolioSelection } from "./portfolio-selection.ts"
import type { createSfDecisionResultStore } from "./result-store.ts"
import type { DecisionCasePort, PlannerPort, PlannerSourceHost } from "../contracts/ports.ts"

type Common = Pick<Parameters<typeof createDecisionCaseManagement>[0], "state" | "host" | "authorizeCase" | "operationIdentity">
type Shared = "state" | "host" | "authorizeCase" | "operationIdentity"
type Evidence = { proposalCoverageWrites: WeakSet<object>; now: () => string }

/** Compose the existing Decisions services with explicit host authority and evidence producers. */
export function createDecisionProduct(input: Common & Evidence & {
  hotTopic: Omit<Parameters<typeof createHotTopicDraftStore>[0], Shared | keyof Evidence | "createId">
  changeStore: Omit<Parameters<typeof createChangeProposalStore>[0], Shared | keyof Evidence>
  changeProposal: Omit<Parameters<typeof createChangeProposalService>[0], "cases" | "host" | "store" | "resolvePreview" | "authorizeProposal">
  reviewDomain: Parameters<typeof createDecisionPreparedReview>[0]["reviewDomain"]
  verifyHistoricalProvenance: Parameters<typeof createPortfolioHistory>[0]["verifyHistoricalProvenance"]
  cases: DecisionCasePort
  results: ReturnType<typeof createSfDecisionResultStore>
  planner: PlannerPort
  sources: PlannerSourceHost
  observeAssumption: Parameters<typeof createAssumptionDivergenceService>[0]["observe"]
  baseline: Omit<Parameters<typeof createDecisionBaselineCoverage>[0], Shared | keyof Evidence>
  management: Omit<Parameters<typeof createDecisionCaseManagement>[0], Shared>
  mutations: Omit<Parameters<typeof createDecisionMutations>[0], Shared | "planner" | "sources" | "resolveHotTopicDraft">
  promotion: Omit<Parameters<typeof createAnalysisAlternativePromotion>[0], Shared | "sources" | "createId" | "now">
  currentChoice: {
    preview: Omit<Parameters<typeof createCurrentChoicePreview>[0], Shared | "sources" | "results" | "writes">
    promotion: Omit<Parameters<typeof createCurrentChoicePromotion>[0], Shared | "sources" | "now">
  }
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
  const assumptionDivergence = createAssumptionDivergenceService({ cases: input.cases, host: input.host, observe: input.observeAssumption })
  const hotTopicDraft = createHotTopicDraftStore({ ...input.hotTopic, ...common, ...evidence, createId: input.mutations.createId })
  const mutations = createDecisionMutations({ ...input.mutations, ...common, planner: input.planner, sources: input.sources, resolveHotTopicDraft: hotTopicDraft.readCurrent })
  const promoteAnalysis = createAnalysisAlternativePromotion({ ...input.promotion, ...common, sources: input.sources, createId: input.mutations.createId, now: input.now })
  const currentChoicePreview = createCurrentChoicePreview({ ...input.currentChoice.preview, ...common, sources: input.sources, results: input.results, writes: input.proposalCoverageWrites })
  const promoteCurrentChoice = createCurrentChoicePromotion({ ...input.currentChoice.promotion, ...common, sources: input.sources, now: input.now, verifyProvenance: async (request, choice, result, context) => (await currentChoicePreview.read(request, context)).status === "ok" && await input.currentChoice.promotion.verifyProvenance(request, choice, result, context) })
  const accept = createAnalysisAcceptance({ ...input.acceptance, ...common })
  const apply = createPreparedExecution({ ...input.application, ...common })
  const applicationStatus = createPreparedApplicationStatus({ ...common, receipts: { readReceipt: input.application.apply.readReceipt } })
  const criteria = createCriterionRuleRegistry({ ...input.criteria, ...common, ...evidence })
  const sensitivityBindings = createCriterionResultBindings({ ...input.sensitivityBindings, ...common, ...evidence, rules: criteria, results: input.results })
  const comparisonBindings = createCriterionComparisonBindings({ ...input.comparisonBindings, ...common, ...evidence, rules: criteria, results: input.results })
  const changeStore = createChangeProposalStore({ ...input.changeStore, ...common, ...evidence })
  const resolvePreview = createDecisionChoiceResultLookup({ cases: input.cases, state: input.state, results: input.results, host: input.host })
  const changeProposal = createChangeProposalService({ ...input.changeProposal, cases: input.cases, host: input.host, store: changeStore, resolvePreview, authorizeProposal: input.changeStore.authorizeProposal })
  const history = createPortfolioHistory({ state: input.state, host: input.host, authorizeCase: input.authorizeCase, verifyHistoricalProvenance: input.verifyHistoricalProvenance })
  const reviewChange = createDecisionPreparedReview({ state: input.state, cases: input.cases, host: input.host, reviewDomain: input.reviewDomain })
  const choiceCatalog = createDecisionChoiceCatalog({ cases: input.cases, host: input.host })
  const coverageCatalog = createDecisionCoverageCatalog({ cases: input.cases, host: input.host, sources: input.sources })
  const compare = createDecisionComparisonService({ cases: input.cases, state: input.state, host: input.host, results: input.results, planner: input.planner })
  const selection = createDecisionPortfolioSelection({ ...input.selection, ...common, ...evidence, compare })
  const portfolioBindings = createPortfolioResultBindings({ ...input.portfolioBindings, ...common, ...evidence, selection, results: input.results })
  return { baseline, management, assumptionDivergence, mutations, accept, promoteAnalysis, currentChoicePreview, promoteCurrentChoice, apply, applicationStatus, criteria, sensitivityBindings, comparisonBindings, compare, selection, portfolioBindings, coverageCatalog, choiceCatalog, reviewChange, history, changeStore, changeProposal, hotTopicDraft }
}
