import { createPortfolioCatalog } from "./catalog.ts"
import { createDecisionCandidateResolver } from "./candidates.ts"
import { createPortfolioCapabilities } from "./capabilities.ts"
import { createPortfolioPlannerHost } from "./planner-host.ts"
import { createPortfolioPort } from "./port.ts"
import { createPersistentPortfolioPort } from "./result-store.ts"
import { createPersistentSensitivityPort } from "./sensitivity-store.ts"
import { createPersistentPortfolioCapabilities } from "./persistent-capabilities.ts"
import { portfolioEvaluationDigest, preparePortfolioChoice, promotePortfolioAlternative } from "./handoff.ts"
import type { DecisionCasePort } from "../contracts/ports.ts"

/** One port is shared by UI and capability dispatch; all authority remains host-provided. */
export function createPortfolioContribution(input: {
  cases: DecisionCasePort
  enabledOperations: readonly ("sf_portfolio_evaluate" | "sf_sensitivity_evaluate")[]
  plannerHost: Omit<Parameters<typeof createPortfolioPlannerHost>[0], "resolveCandidate">
  createReceipt: Parameters<typeof createPortfolioCapabilities>[1]
  decisions: Parameters<typeof preparePortfolioChoice>[0]["decisions"] & Partial<Parameters<typeof promotePortfolioAlternative>[0]["decisions"]>
  persistence?: Omit<Parameters<typeof createPersistentPortfolioPort>[0], "portfolio" | "bindings"> & Pick<Parameters<typeof createPersistentPortfolioCapabilities>[0], "caseFor"> & { portfolioBindings?: Parameters<typeof createPersistentPortfolioPort>[0]["bindings"]; sensitivityBindings?: Parameters<typeof createPersistentSensitivityPort>[0]["bindings"]; resolveSensitivity?: Parameters<typeof createPersistentSensitivityPort>[0]["resolveBinding"] }
}) {
  const host = createPortfolioPlannerHost({ ...input.plannerHost, resolveCandidate: createDecisionCandidateResolver(input.cases) })
  const port = createPortfolioPort(host)
  const persistent = input.persistence ? createPersistentPortfolioPort({ portfolio: port, results: input.persistence.results, bindings: input.persistence.portfolioBindings, requireBindings: input.persistence.requireBindings, idempotencyKey: input.persistence.idempotencyKey, revalidateAnalysis: input.persistence.revalidateAnalysis, revalidatePortfolio: input.persistence.revalidatePortfolio }) : undefined
  const persistentSensitivity = input.persistence?.sensitivityBindings && input.persistence.resolveSensitivity ? createPersistentSensitivityPort({ portfolio: port, results: input.persistence.results, idempotencyKey: input.persistence.idempotencyKey, bindings: input.persistence.sensitivityBindings, resolveBinding: input.persistence.resolveSensitivity }) : undefined
  const capabilities = persistent && input.persistence ? createPersistentPortfolioCapabilities({ portfolio: port, persistent, sensitivity: persistentSensitivity, caseFor: input.persistence.caseFor, createReceipt: input.createReceipt }) : createPortfolioCapabilities(port, input.createReceipt).filter((descriptor) => descriptor.id !== "sf_portfolio_evaluate" && descriptor.id !== "sf_sensitivity_evaluate")
  return {
    port,
    catalog: createPortfolioCatalog({ cases: input.cases, revalidate: input.plannerHost.revalidate }),
    persistent,
    persistentSensitivity,
    preview: async (request: Parameters<typeof port.evaluate>[0], context: Parameters<typeof port.evaluate>[1]) => {
      const result = await port.evaluateWithSelections(request, context)
      if (result.status !== "ok") return result
      return { status: "ok" as const, value: { ...result.value, evaluationDigest: portfolioEvaluationDigest(request, result.value.portfolio) } }
    },
    capabilities: capabilities.filter((descriptor) => input.enabledOperations.some((operation) => operation === descriptor.id)),
    promoteAlternative: (request: Omit<Parameters<typeof promotePortfolioAlternative>[0], "portfolio" | "host" | "decisions">, context: Parameters<typeof promotePortfolioAlternative>[1]) => input.decisions.addAlternative ? promotePortfolioAlternative({ ...request, portfolio: port, host, decisions: { addAlternative: input.decisions.addAlternative } }, context) : Promise.resolve({ status: "unavailable" as const, reason: "alternative-promotion-unavailable" }),
    prepareChoice: (request: Omit<Parameters<typeof preparePortfolioChoice>[0], "portfolio" | "host" | "cases" | "decisions">, context: Parameters<typeof preparePortfolioChoice>[1]) => preparePortfolioChoice({ ...request, portfolio: port, host, cases: input.cases, decisions: input.decisions }, context),
  }
}
