import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService } from "../contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import type { createDecisionPortfolioSelection } from "../decisions/portfolio-selection.ts"
import type { createCriterionRuleRegistry, createCriterionResultBindings } from "../decisions/criterion-rules.ts"
import type { createCriterionComparisonBindings } from "../decisions/criterion-comparison.ts"
import type { createPortfolioResultBindings } from "../decisions/portfolio-bindings.ts"
import { encodeCaseRef, parseCaseRef } from "../decisions/case-port.ts"
import { decisionCoverageRef } from "../decisions/coverage-access.ts"
import { createPlannerSensitivityUnits } from "../planner/sensitivity-units.ts"
import { createPlannerResultPersistence } from "../planner/persistence.ts"
import { comparePlannerPreview } from "../planner/preview-comparison.ts"
import type { PlannerScenarioHost } from "../planner/scenario-comparison-port.ts"
import { createPortfolioAnalysis } from "./analysis.ts"
import { createProductionPortfolio } from "./production.ts"
import { createPlannerSensitivity } from "./planner-sensitivity.ts"
import { createPortfolioSelectionResolver } from "./selection.ts"
import { createPortfolioCoveragePreview } from "./coverage-preview.ts"
import { createPortfolioReconciliation } from "./reconciliation.ts"
import type { PortfolioReconciliationHost, PortfolioReconciliationRequest } from "./reconciliation.ts"

type CaseRef = { id: string; incarnation: string; version: number }

/** Compose the portfolio from host-issued authority, case services and durable proof registries. */
export function createPortfolioProduct(input: {
  host: DomainPortHost
  cases: DecisionCasePort
  evidence: BusinessContextService
  // Portfolio consumes the public ports; optional producer projection capabilities are not used here.
  planner: { planner: PlannerPort; sources: PlannerSourceHost; scenarios: PlannerScenarioHost }
  results: ReturnType<typeof createSfDecisionResultStore>
  rules: ReturnType<typeof createCriterionRuleRegistry>
  selection: ReturnType<typeof createDecisionPortfolioSelection>
  portfolioBindings: ReturnType<typeof createPortfolioResultBindings>
  comparisonBindings: ReturnType<typeof createCriterionComparisonBindings>
  sensitivityBindings: ReturnType<typeof createCriterionResultBindings>
  decisions: Parameters<typeof createProductionPortfolio>[0]["decisions"]
  createReceipt: Parameters<typeof createProductionPortfolio>[0]["createReceipt"]
  caseFor: (context: TrustedDomainContext) => Promise<PortResult<CaseRef>>
  idempotencyKey: (requestDigest: string, context: TrustedDomainContext) => Promise<string | undefined>
  exactThreshold?: Parameters<typeof createPlannerSensitivity>[0]["exactThreshold"]
  resolveCoverageAuthority?: Parameters<typeof createPortfolioCoveragePreview>[0]["resolveAuthority"]
  reconciliation?: PortfolioReconciliationHost
}) {
  const units = createPlannerSensitivityUnits({ host: input.host, cases: input.cases, scenarios: input.planner.scenarios, store: input.results, evidence: input.evidence, rules: input.rules })
  const preview = (request: Parameters<typeof comparePlannerPreview>[1], context: TrustedDomainContext) => comparePlannerPreview({ host: input.host, sources: input.planner.sources, scenarios: input.planner.scenarios, planner: input.planner.planner }, request, context)
  const coveragePreview = input.resolveCoverageAuthority ? createPortfolioCoveragePreview({ units, preview, resolveAuthority: input.resolveCoverageAuthority }) : undefined
  const sensitivity = createPlannerSensitivity({ results: input.results, resolve: units.resolve, revalidate: units.revalidate, preview, coveragePreview, exactThreshold: input.exactThreshold, idempotencyKey: input.idempotencyKey })
  const analysis = createPortfolioAnalysis({ planner: input.planner.planner, results: input.results, bindings: input.comparisonBindings, persist: createPlannerResultPersistence({ store: input.results, scenarios: input.planner.scenarios, comparisonBindings: input.comparisonBindings, replay: input.planner.planner, resolveCase: input.caseFor }), select: createPortfolioSelectionResolver({ selection: input.selection, results: input.results, caseFor: input.caseFor }), idempotencyKey: input.idempotencyKey })
  const contribution = createProductionPortfolio({ cases: input.cases, planner: input.planner.planner, sources: input.planner.sources, evidence: input.evidence, revalidate: input.host.revalidate, analysis, sensitivity, candidateCoverageRefFor: async (candidate) => {
    const ref = parseCaseRef(candidate.caseRef)
    if (!ref || !candidate.result) return { status: "unavailable", reason: "candidate-coverage-unavailable" }
    return { status: "ok", value: decisionCoverageRef(ref, candidate.result.costCoverage.alternativeId, candidate.result.costCoverage.alternativeVersion) }
  }, decisions: input.decisions, createReceipt: input.createReceipt, persistence: { results: input.results, portfolioBindings: input.portfolioBindings, sensitivityBindings: input.sensitivityBindings, resolveSensitivity: units.resolve, caseFor: input.caseFor, idempotencyKey: input.idempotencyKey }, enabledOperations: ["sf_portfolio_evaluate", "sf_sensitivity_evaluate"] })
  const authorized = async (caseRef: CaseRef, context: TrustedDomainContext) => {
    const current = await input.caseFor(context)
    return current.status === "ok" && digestSfValue(current.value) === digestSfValue(caseRef) && await input.host.revalidate(context)
  }
  const reconcile = input.reconciliation ? createPortfolioReconciliation({ ...input.reconciliation, cases: input.cases, evidence: input.evidence, host: input.host, caseFor: input.caseFor }) : undefined
  const reconcileHttp = async (incoming: PortfolioReconciliationRequest, context: TrustedDomainContext) => {
    try {
      const authorityDigest = digestSfValue({ kind: context.kind, binding: context.binding })
      const authorityUnchanged = () => digestSfValue({ kind: context.kind, binding: context.binding }) === authorityDigest
      const request = structuredClone(incoming)
      if (!await authorized(request.caseRef, context) || !authorityUnchanged()) return { status: "denied", reason: "portfolio-case-unavailable" } as const
      if (!reconcile) return { status: "unavailable", reason: "portfolio-reconciliation-producer-unavailable" } as const
      const result = await reconcile(request, context)
      if (!authorityUnchanged()) return { status: "denied", reason: "portfolio-case-unavailable" } as const
      return result
    } catch { return { status: "unavailable", reason: "portfolio-reconciliation-unavailable" } as const }
  }
  const catalog = async (refs: readonly CaseRef[], context: TrustedDomainContext) => {
    if (!refs.length || new Set(refs.map((ref) => encodeCaseRef(ref))).size !== refs.length) return { status: "needs-input", reason: "invalid-portfolio-cases" } as const
    const checked = await Promise.all(refs.map((ref) => input.cases.read({ caseRef: encodeCaseRef(ref) }, context)))
    if (checked.some((item, index) => item.status !== "ok" || item.value.case.version !== refs[index]?.version)) return { status: "denied", reason: "portfolio-case-unavailable" } as const
    const result = await contribution.catalog({ caseRefs: refs.map((ref) => encodeCaseRef(ref)) }, context)
    if (result.status !== "ok") return result
    const entries = result.value.cases.map((entry) => {
      const ref = refs.find((item) => encodeCaseRef(item) === entry.caseRef)
      return ref && ref.version === entry.caseVersion ? { ...entry, caseRef: ref } : undefined
    })
    if (entries.some((entry) => !entry) || !await input.host.revalidate(context)) return { status: "stale", reason: "portfolio-catalog-changed" } as const
    return { status: "ok", value: { ...result.value, cases: entries.filter((entry): entry is NonNullable<typeof entry> => entry !== undefined) } } as const
  }
  return {
    contribution,
    sensitivity: contribution.port.sensitivity,
    issueSensitivityUnits: units.issue,
    reconciliation: reconcile,
    http: {
      list: async (caseRef: CaseRef, context: TrustedDomainContext) => await authorized(caseRef, context) ? input.portfolioBindings.list({ caseRef }, context) : { status: "denied" as const, reason: "portfolio-case-unavailable" },
      catalog,
      preview: async (request: Parameters<typeof contribution.preview>[0], caseRef: CaseRef, context: TrustedDomainContext) => await authorized(caseRef, context) ? contribution.preview(request, context) : { status: "denied" as const, reason: "portfolio-case-unavailable" },
      evaluate: async (request: Parameters<NonNullable<typeof contribution.persistent>["evaluateAndStore"]>[0], caseRef: CaseRef, context: TrustedDomainContext) => await authorized(caseRef, context) && contribution.persistent ? contribution.persistent.evaluateAndStore(request, caseRef, context) : { status: "denied" as const, reason: "portfolio-case-unavailable" },
      read: async (ref: string, caseRef: CaseRef, context: TrustedDomainContext) => {
        if (!await authorized(caseRef, context) || !contribution.persistent) return { status: "denied", reason: "portfolio-case-unavailable" } as const
        const result = await contribution.persistent.read(ref, context)
        return result.status !== "ok" || digestSfValue(result.value.caseRef) === digestSfValue(caseRef) ? result : { status: "denied" as const, reason: "portfolio-case-unavailable" }
      },
      sensitivityUnits: async (request: Parameters<typeof units.issue>[0] & { caseRef: CaseRef }, context: TrustedDomainContext) => {
        if (!await authorized(request.caseRef, context)) return { status: "denied", reason: "portfolio-case-unavailable" } as const
        const result = await units.issue({ scenarioRef: request.scenarioRef, baselineRef: request.baselineRef, parameterRef: request.parameterRef }, context)
        return result.status !== "ok" || digestSfValue(result.value.caseRef) === digestSfValue(request.caseRef) ? result : { status: "denied" as const, reason: "portfolio-case-unavailable" }
      },
      sensitivity: async (request: Parameters<NonNullable<typeof contribution.persistentSensitivity>["evaluateAndStore"]>[0], caseRef: CaseRef, context: TrustedDomainContext) => await authorized(caseRef, context) && contribution.persistentSensitivity ? contribution.persistentSensitivity.evaluateAndStore(request, caseRef, context) : { status: "denied" as const, reason: "portfolio-case-unavailable" },
      readSensitivity: async (ref: string, caseRef: CaseRef, context: TrustedDomainContext) => {
        if (!await authorized(caseRef, context) || !contribution.persistentSensitivity) return { status: "denied", reason: "portfolio-case-unavailable" } as const
        const result = await contribution.persistentSensitivity.read(ref, context)
        return result.status !== "ok" || digestSfValue(result.value.caseRef) === digestSfValue(caseRef) ? result : { status: "denied" as const, reason: "portfolio-case-unavailable" }
      },
      promote: async (request: Parameters<typeof contribution.promoteAlternative>[0], context: TrustedDomainContext) => await authorized(request.caseRef, context) ? contribution.promoteAlternative(request, context) : { status: "denied" as const, reason: "portfolio-case-unavailable" },
      prepare: async (request: Parameters<typeof contribution.prepareChoice>[0], context: TrustedDomainContext) => await authorized(request.caseRef, context) ? contribution.prepareChoice(request, context) : { status: "denied" as const, reason: "portfolio-case-unavailable" },
      reconcile: reconcileHttp,
    },
  }
}
