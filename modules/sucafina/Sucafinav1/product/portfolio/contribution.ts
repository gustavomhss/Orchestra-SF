import { createDecisionCandidateResolver } from "./candidates.ts"
import { createPortfolioCapabilities } from "./capabilities.ts"
import { createPortfolioPlannerHost } from "./planner-host.ts"
import { createPortfolioPort } from "./port.ts"
import { createPersistentPortfolioPort } from "./result-store.ts"
import { createPersistentSensitivityPort } from "./sensitivity-store.ts"
import { createPersistentPortfolioCapabilities } from "./persistent-capabilities.ts"
import { preparePortfolioChoice } from "./handoff.ts"
import type { DecisionCasePort } from "../contracts/ports.ts"

/** One port is shared by UI and capability dispatch; all authority remains host-provided. */
export function createPortfolioContribution(input: {
  cases: DecisionCasePort
  enabledOperations: readonly ("sf_portfolio_evaluate" | "sf_sensitivity_evaluate")[]
  plannerHost: Omit<Parameters<typeof createPortfolioPlannerHost>[0], "resolveCandidate">
  createReceipt: Parameters<typeof createPortfolioCapabilities>[1]
  decisions: Parameters<typeof preparePortfolioChoice>[0]["decisions"]
  persistence?: Omit<Parameters<typeof createPersistentPortfolioPort>[0], "portfolio"> & Pick<Parameters<typeof createPersistentPortfolioCapabilities>[0], "caseFor">
}) {
  const host = createPortfolioPlannerHost({ ...input.plannerHost, resolveCandidate: createDecisionCandidateResolver(input.cases) })
  const port = createPortfolioPort(host)
  const persistent = input.persistence ? createPersistentPortfolioPort({ portfolio: port, results: input.persistence.results, idempotencyKey: input.persistence.idempotencyKey }) : undefined
  const persistentSensitivity = input.persistence ? createPersistentSensitivityPort({ portfolio: port, results: input.persistence.results, idempotencyKey: input.persistence.idempotencyKey }) : undefined
  const capabilities = persistent && persistentSensitivity && input.persistence ? createPersistentPortfolioCapabilities({ portfolio: port, persistent, sensitivity: persistentSensitivity, caseFor: input.persistence.caseFor, createReceipt: input.createReceipt }) : createPortfolioCapabilities(port, input.createReceipt).filter((descriptor) => descriptor.id !== "sf_portfolio_evaluate" && descriptor.id !== "sf_sensitivity_evaluate")
  return {
    port,
    persistent,
    persistentSensitivity,
    capabilities: capabilities.filter((descriptor) => input.enabledOperations.some((operation) => operation === descriptor.id)),
    prepareChoice: (request: Omit<Parameters<typeof preparePortfolioChoice>[0], "portfolio" | "host" | "cases" | "decisions">, context: Parameters<typeof preparePortfolioChoice>[1]) => preparePortfolioChoice({ ...request, portfolio: port, host, cases: input.cases, decisions: input.decisions }, context),
  }
}
