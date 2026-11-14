import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createPortfolioContribution } from "../../../product/portfolio/contribution.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("portfolio resolves a persisted decision alternative and respects revocation", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-portfolio-test-"))
  await chmod(directory, 0o700)
  const request = new Request("https://example.test")
  const binding = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const access = { allowed: true }
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const scenario = { baseRef: "base", operations: [{ kind: "replace", targetRef: "line:1", amount: 50 }], assumptions: [] } as const
  const result = { id: "result", version: 1, components: [], currency: "USD", horizon, sourceRefs: [], unresolvedConditions: ["training missing"], restrictions: [], comparisonStatus: "conditioned", costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alt", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: [], coverageState: "pending", entries: [], derivedMissingCategoryIds: ["training"] }, knownSubtotal: 50, total: null } as const
  const decision = { id: "case", incarnation: "inc", version: 1, state: "comparing", objective: "transition", currency: "USD", horizon, criteria: [], participants: ["principal"], sourceRefs: [], alternatives: [{ id: "alt", version: 1, title: "Alternative", scenario, result }], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] } as const
  const evidence: BusinessContextService = { context: async () => [], resolve: async () => { throw new Error("unexpected evidence") }, recall: async () => [], emitFromLedger: async () => { throw new Error("unexpected emission") } }
  const open = async () => {
    const store = await openLocalStore(directory)
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => access.allowed ? { principalRef: "principal", policyVersion: "policy", accessRevision: "access" } : undefined })
    const cases = createDecisionCasePort({ state, host: { requestFor: () => request, revalidate: async () => access.allowed }, creationTarget: { ref: "case", incarnation: "inc" }, operationIdentity: () => "operation", authorizeCase: async () => access.allowed, verifyScenarioOperations: async () => access.allowed, evidence, createId: () => "unused", now: () => "2026-11-13T00:00:00Z" })
    return { store, state, cases }
  }
  try {
    const first = await open()
    const seeded = await first.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "b".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => { state.cases.case = decision; return { commit: true, value: true } })
    expect(seeded.status).toBe("ok")
    await first.store.dispose()
    const reopened = await open()
    const ref = portfolioCandidateRef({ caseRef: encodeCaseRef(decision), caseVersion: 1, alternativeId: "alt", alternativeVersion: 1 })
    const resolve = createDecisionCandidateResolver(reopened.cases)
    const actual = await resolve(ref, binding)
    expect(actual.status).toBe("ok")
    if (actual.status === "ok") expect(actual.value.scenario).toEqual(scenario)
    const unavailable = async () => ({ status: "unavailable" as const, reason: "producer-not-connected" })
    const contribution = createPortfolioContribution({ cases: reopened.cases, enabledOperations: [], plannerHost: { planner: { compareForecast: unavailable, simulateScenario: unavailable, compareScenarios: unavailable, evaluateSensitivity: unavailable }, revalidate: async () => access.allowed, revalidateEvaluation: async () => access.allowed, scenarioRequest: async () => ({ status: "ok", value: scenario }), assess: unavailable }, createReceipt: async () => undefined, decisions: { prepareChanges: unavailable } })
    expect(await contribution.port.evaluate({ scope: { horizon, currency: "USD" }, candidateRefs: [ref], operations: [], constraints: [], priorities: [], explorationLimit: 1 }, binding)).toEqual({ status: "unavailable", reason: "producer-not-connected" })
    expect(contribution.capabilities).toEqual([])
    access.allowed = false
    expect((await resolve(ref, binding)).status).toBe("denied")
    await reopened.store.dispose()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
