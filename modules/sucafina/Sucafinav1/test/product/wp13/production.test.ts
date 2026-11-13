import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import { createProductionPortfolio } from "../../../product/portfolio/production.ts"
import { portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { PlannerPort, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("production factory keeps an unbound Planner preview conditional", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-portfolio-production-"))
  await chmod(directory, 0o700)
  const request = new Request("https://example.test")
  const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const identity = { schema: "sf-evidence-v1", refId: "planner-base", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: "base", incarnation: "source-inc", version: 1, fields: ["amount"], period: horizon, projectionDigest: "a".repeat(64) } } as const
  const ref = { ...identity, refDigest: digestSfEvidenceRef(identity) }
  const assumptionRefs: readonly BusinessEvidenceRef[] = [ref]
  const assessment = { basisId: "basis", basisVersion: 1, alternativeId: "alt", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: assumptionRefs, coverageState: "pending", entries: [{ status: "pending", categoryId: "training", reason: "missing-category" }], derivedMissingCategoryIds: ["training"] } as const
  const scenario = { id: "preview", version: 0, components: [], currency: "USD", horizon, sourceRefs: assumptionRefs, unresolvedConditions: ["scenario-coverage-reassessment-required"], restrictions: ["preview-not-applied"], comparisonStatus: "conditioned", costCoverage: { ...assessment, issues: ["scenario-coverage-reassessment-required"] }, knownSubtotal: 210000, total: null } as const
  const scenarioRequest = { baseRef: "planner-base", operations: [{ kind: "replace", targetRef: "line:1", amount: 50 }], assumptions: [] } as const
  const caseRef = { id: "case", incarnation: "inc", version: 1 }
  const decision = { ...caseRef, state: "comparing", objective: "transition", currency: "USD", horizon, criteria: [], participants: ["principal"], sourceRefs: assumptionRefs, alternatives: [{ id: "alt", version: 1, title: "Alternative", scenario: scenarioRequest, result: scenario }], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] } as const
  const access = { allowed: true, simulations: 0 }
  const unavailable = async () => ({ status: "unavailable" as const, reason: "not-connected" })
  const evidence: BusinessContextService = { resolve: async (value) => ({ state: access.allowed ? "fresh" : "revoked", ref: value, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" }), context: async ({ refs }) => refs.map((value) => ({ state: access.allowed ? "fresh" : "revoked", ref: value, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" })), recall: async () => [], emitFromLedger: async () => { throw new Error("unexpected memory") } }
  const planner: PlannerPort = { compareForecast: unavailable, simulateScenario: async () => { access.simulations++; return { status: "ok", value: scenario } }, compareScenarios: unavailable, evaluateSensitivity: unavailable }
  const sources: PlannerSourceHost = { resolveForecastSource: unavailable, resolveForecastCoverage: async () => ({ status: "ok", value: { coverageRef: "base-coverage", basis: { id: "basis", version: 1, decisionType: "unknown", categoryIds: [], additionalCategoryIds: [], sourceRefs: assumptionRefs }, assessment } }) }
  const store = await openLocalStore(directory)
  try {
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => access.allowed ? { principalRef: "principal", policyVersion: "policy", accessRevision: "access" } : undefined })
    const seeded = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "b".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (value) => { value.cases.case = decision; return { commit: true, value: true } })
    expect(seeded.status).toBe("ok")
    const host = { requestFor: () => request, revalidate: async () => access.allowed }
    const cases = createDecisionCasePort({ state, host, creationTarget: { ref: "case", incarnation: "inc" }, operationIdentity: () => "operation", authorizeCase: async () => access.allowed, evidence, createId: () => "unused", now: () => "2026-11-13T00:00:00Z" })
    const results = createSfDecisionResultStore({ state, host, authorizeCase: async () => access.allowed, verifySources: async () => access.allowed, createId: () => "portfolio-id", now: () => "2026-11-13T00:00:00Z" })
    const contribution = createProductionPortfolio({ cases, planner, sources, evidence, revalidate: host.revalidate, createReceipt: async () => undefined, decisions: { prepareChanges: unavailable }, persistence: { results, caseFor: async () => ({ status: "ok", value: caseRef }), idempotencyKey: async () => "operation" }, enabledOperations: ["sf_portfolio_evaluate", "sf_sensitivity_evaluate"] })
    expect(contribution.capabilities).toEqual([])
    if (!contribution.persistent) throw new Error("persistent portfolio unavailable")
    const candidate = portfolioCandidateRef({ caseRef: encodeCaseRef(caseRef), caseVersion: 1, alternativeId: "alt", alternativeVersion: 1 })
    const portfolioRequest = { scope: { horizon, currency: "USD" }, candidateRefs: [candidate], operations: [], constraints: ["max-cost"], priorities: [], explorationLimit: 1 }
    expect(await contribution.persistent.evaluateAndStore(portfolioRequest, caseRef, context)).toEqual({ status: "unavailable", reason: "portfolio-binding-unavailable" })
    const preview = await contribution.preview(portfolioRequest, context)
    expect(preview.status).toBe("ok")
    if (preview.status !== "ok") return
    expect(access.simulations).toBe(1)
    expect(preview.value.portfolio.combinations[0].eligibility).toBe("conditioned")
    expect(preview.value.portfolio.combinations[0].costCoverageRefs).toEqual([])
    expect(preview.value.portfolio.combinations[0].restrictions).toContain("analysis-unavailable")
    const withCandidateCoverage = createProductionPortfolio({ cases, planner, sources: { ...sources, resolveForecastCoverage: async (reference) => reference === "candidate-coverage" ? { status: "ok", value: { coverageRef: reference, basis: { id: "basis", version: 1, decisionType: "unknown", categoryIds: [], additionalCategoryIds: [], sourceRefs: assumptionRefs }, assessment: scenario.costCoverage } } : { status: "unavailable", reason: "unknown-coverage" } }, candidateCoverageRefFor: async () => ({ status: "ok", value: "candidate-coverage" }), evidence, revalidate: host.revalidate, createReceipt: async () => undefined, decisions: { prepareChanges: unavailable }, persistence: { results, caseFor: async () => ({ status: "ok", value: caseRef }), idempotencyKey: async () => "operation" }, enabledOperations: ["sf_portfolio_evaluate"] })
    const covered = await withCandidateCoverage.port.evaluate({ scope: { horizon, currency: "USD" }, candidateRefs: [candidate], operations: [], constraints: [], priorities: [], explorationLimit: 1 }, context)
    expect(covered.status).toBe("ok")
    if (covered.status === "ok") {
      expect(covered.value.combinations[0].costCoverageRefs).toEqual(["candidate-coverage"])
      expect(covered.value.combinations[0].restrictions.some((reason) => reason.includes("missing-category:training"))).toBe(true)
      expect(covered.value.combinations[0].eligibility).toBe("conditioned")
    }
    access.allowed = false
    expect((await contribution.preview(portfolioRequest, context)).status).toBe("denied")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
