import { expect, test } from "bun:test"
import { createPortfolioContribution } from "../../../product/portfolio/contribution.ts"
import type { DecisionCasePort, PlannerPort } from "../../../product/contracts/ports.ts"
import type { PortfolioPort } from "../../../product/portfolio/port.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const unavailable = async () => ({ status: "unavailable" as const, reason: "producer-not-connected" })

test("composition does not advertise disabled operations or fabricate a scenario", async () => {
  const planner: PlannerPort = { compareForecast: unavailable, simulateScenario: unavailable, compareScenarios: unavailable, evaluateSensitivity: unavailable }
  const operations = [{ kind: "replace" as const, targetRef: "line:1", amount: 50 }]
  const scenario = { baseRef: "base", operations, assumptions: [] }
  const cases = { read: async () => ({ status: "ok", value: { case: { version: 1, alternatives: [{ id: "alt", version: 1, scenario }] } } }) } as unknown as DecisionCasePort
  const contribution = createPortfolioContribution({ cases, enabledOperations: [], plannerHost: { planner, revalidate: async () => true, revalidateEvaluation: async () => true, scenarioRequest: async () => ({ status: "ok", value: scenario }), assess: unavailable }, createReceipt: async () => undefined, decisions: { prepareChanges: unavailable } })
  expect(contribution.capabilities).toEqual([])
  const context = {} as TrustedDomainContext
  const result = await contribution.port.evaluate({ scope: { horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD" }, candidateRefs: ["portfolio-candidate:case%3Aa%3Ai:1:alt:1"], operations: [], constraints: [], priorities: [], explorationLimit: 1 }, context)
  expect(result).toEqual({ status: "unavailable", reason: "producer-not-connected" })
})

test("canonical portfolio handler is unavailable without persistence", async () => {
  const { createPortfolioCapabilities } = await import("../../../product/portfolio/capabilities.ts")
  const portfolio = { evaluate: unavailable, sensitivity: unavailable } as PortfolioPort
  const descriptors = createPortfolioCapabilities(portfolio, async (_context, operation, inputDigest) => ({ kind: "ui", operation, handlerExport: "evaluatePortfolio", inputDigest, principalRef: "principal", callId: "call", requestId: "request", accessRevision: "access", at: "2026-11-13T00:00:00Z" }))
  const descriptor = descriptors.find((item) => item.id === "sf_portfolio_evaluate")!
  expect(descriptor.handlerExport).toBe("evaluatePortfolio")
  const result = await descriptor.handler({ scope: { horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD" }, candidateRefs: ["candidate"], operations: [], constraints: [], priorities: [], explorationLimit: 1 }, { kind: "ui", binding: { principalRef: "principal", accessRevision: "access" }, lease: {} } as unknown as TrustedDomainContext)
  expect(result.status).toBe("unavailable")
  if (result.status !== "ok") expect(result.reason).toBe("portfolio-persistence-unavailable")
})

test("canonical handler rejects a mismatched receipt before persistence", async () => {
  const { evaluatePortfolio } = await import("../../../product/portfolio/capabilities.ts")
  const calls = { n: 0 }
  const context = { kind: "ui", binding: { principalRef: "principal", accessRevision: "access" }, lease: {} } as unknown as TrustedDomainContext
  const request = { scope: { horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD" }, candidateRefs: ["candidate"], operations: [], constraints: [], priorities: [], explorationLimit: 1 }
  const result = await evaluatePortfolio(request, context, { evaluate: unavailable, sensitivity: unavailable }, async (_context, operation, inputDigest) => ({ kind: "ui", operation, handlerExport: "different", inputDigest, principalRef: "principal", callId: "call", requestId: "request", accessRevision: "access", at: "2026-11-13T00:00:00Z" }), { caseFor: async () => ({ status: "ok", value: { id: "case", incarnation: "inc", version: 1 } }), evaluateAndStore: async () => { calls.n++; return { status: "unavailable", reason: "unexpected" } } })
  expect(result.status).toBe("unavailable")
  expect(calls.n).toBe(0)
})
