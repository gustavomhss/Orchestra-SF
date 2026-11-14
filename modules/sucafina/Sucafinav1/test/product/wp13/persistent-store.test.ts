import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { createPersistentPortfolioCapabilities } from "../../../product/portfolio/persistent-capabilities.ts"
import { createPersistentPortfolioPort } from "../../../product/portfolio/result-store.ts"
import { createPersistentSensitivityPort } from "../../../product/portfolio/sensitivity-store.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { PortfolioPort } from "../../../product/portfolio/port.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("portfolio uses the C08 decision store for durable refs and revalidates access", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-portfolio-result-"))
  await chmod(directory, 0o700)
  const request = new Request("https://example.test")
  const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const access = { allowed: true }
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const caseRef = { id: "case", incarnation: "inc", version: 1 }
  const decision = { ...caseRef, state: "comparing", objective: "transition", currency: "USD", horizon, criteria: [], participants: ["principal"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] } as const
  const open = async () => {
    const store = await openLocalStore(directory)
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => access.allowed ? { principalRef: "principal", policyVersion: "policy", accessRevision: "access" } : undefined })
    const results = createSfDecisionResultStore({ state, host: { requestFor: () => request, revalidate: async () => access.allowed }, authorizeCase: async () => access.allowed, verifySources: async () => access.allowed, createId: () => "result-id", now: () => "2026-11-13T00:00:00Z" })
    const portfolio: PortfolioPort = { evaluate: async () => ({ status: "ok", value: { combinations: [], limitations: ["finite"], evidenceRefs: [] } }), sensitivity: async () => ({ status: "unavailable", reason: "not-connected" }) }
    return { store, state, portfolio, port: createPersistentPortfolioPort({ portfolio, results, idempotencyKey: async () => "operation" }) }
  }
  try {
    const first = await open()
    const seed = await first.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "b".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => { state.cases.case = decision; return { commit: true, value: true } })
    expect(seed.status).toBe("ok")
    const input = { scope: { horizon, currency: "USD" }, candidateRefs: ["candidate"], operations: [], constraints: [], priorities: [], explorationLimit: 1 }
    const saved = await first.port.evaluateAndStore(input, caseRef, context)
    expect(saved.status).toBe("ok")
    if (saved.status !== "ok") return
    expect(saved.value.portfolioResultRef).toBe("decision-result:result-id")
    await first.store.dispose()
    const reopened = await open()
    expect((await reopened.port.read(saved.value.portfolioResultRef, context)).status).toBe("ok")
    expect(await reopened.port.evaluateAndStore(input, caseRef, context)).toEqual(saved)
    const receiptFor = (_context: TrustedDomainContext, operation: string, inputDigest: string, resultDigest?: string) => ({ kind: "ui" as const, operation, handlerExport: "evaluatePortfolio", inputDigest, resultDigest, principalRef: "principal", callId: "call", requestId: "request", accessRevision: "access", at: "2026-11-13T00:00:00Z" })
    const capabilities = createPersistentPortfolioCapabilities({ portfolio: reopened.portfolio, persistent: reopened.port, caseFor: async () => ({ status: "ok", value: caseRef }), createReceipt: async (...args) => receiptFor(...args) })
    expect(capabilities.find((item) => item.id === "sf_portfolio_evaluate")?.handlerExport).toBe("evaluatePortfolio")
    const capability = await capabilities.find((item) => item.id === "sf_portfolio_evaluate")!.handler(input, context)
    expect(capability.status).toBe("ok")
    if (capability.status === "ok") {
      expect(capability.outputRef).toBe(saved.value.portfolioResultRef)
      expect(capability.receipt.handlerExport).toBe("evaluatePortfolio")
    }
    const dispatched = await dispatchSfCapability({ operation: "sf_portfolio_evaluate", payload: input, context, descriptors: capabilities, authority: { validateDomainContext: async () => access.allowed, revalidateDomainContext: async () => access.allowed, receiptFor }, validateInput: (_descriptor, payload) => decodeSfOperationInput("sf_portfolio_evaluate", payload).ok, validateOutput: (_descriptor, result) => result.status !== "ok" || decodeSfOperationOutput("sf_portfolio_evaluate", result.result).ok })
    expect(dispatched.status).toBe("ok")
    if (dispatched.status === "ok") {
      expect(dispatched.receipt.handlerExport).toBe("evaluatePortfolio")
      expect(dispatched.outputRef).toBe(saved.value.portfolioResultRef)
    }
    access.allowed = false
    expect((await dispatchSfCapability({ operation: "sf_portfolio_evaluate", payload: input, context, descriptors: capabilities, authority: { validateDomainContext: async () => access.allowed, revalidateDomainContext: async () => access.allowed, receiptFor }, validateInput: (_descriptor, payload) => decodeSfOperationInput("sf_portfolio_evaluate", payload).ok, validateOutput: (_descriptor, result) => result.status !== "ok" || decodeSfOperationOutput("sf_portfolio_evaluate", result.result).ok })).status).toBe("denied")
    expect((await reopened.port.read(saved.value.portfolioResultRef, context)).status).toBe("denied")
    await reopened.store.dispose()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("refuses to persist analysis whose referenced scenario differs", async () => {
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const caseRef = { id: "case", incarnation: "inc", version: 1 }
  const scenario = { id: "scenario", version: 1, components: [], currency: "USD", horizon, sourceRefs: [], unresolvedConditions: [], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 10, total: null, costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alt", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: [], coverageState: "pending", entries: [], derivedMissingCategoryIds: [] } } as const
  const comparison = { baselineResultRef: "baseline", alternativeResultRef: "scenario-ref", costCoverageRefs: ["coverage"], criterionResults: [], unresolvedConditions: [], comparisonStatus: "conditioned", knownDifference: 1, completeDifference: null } as const
  const portfolio: PortfolioPort = { evaluate: async () => ({ status: "ok", value: { combinations: [{ id: "combination", caseRefs: ["case:case:inc"], components: [], costCoverageRefs: ["coverage"], conflicts: [], restrictions: [], eligibility: "conditioned", comparisonStatus: "conditioned", analysis: { scenarioResultRef: "scenario-ref", scenario, comparisonRef: "comparison-ref", comparison } }], limitations: [], evidenceRefs: [] } }), sensitivity: async () => ({ status: "unavailable", reason: "unused" }) }
  const writes = { count: 0 }
  const results = { read: async (request: { kind: string }) => ({ status: "ok", value: request.kind === "scenario" ? { kind: "scenario", caseRef, resultRef: "scenario-ref", result: { ...scenario, knownSubtotal: 11 }, sourceRefs: [] } : { kind: "comparison", caseRef, resultRef: "comparison-ref", result: comparison, sourceRefs: [] } }), write: async () => { writes.count++; return { status: "unavailable", reason: "unexpected" } } } as unknown as ReturnType<typeof createSfDecisionResultStore>
  const port = createPersistentPortfolioPort({ portfolio, results, idempotencyKey: async () => "operation" })
  const result = await port.evaluateAndStore({ scope: { horizon, currency: "USD" }, candidateRefs: ["candidate"], operations: [], constraints: [], priorities: [], explorationLimit: 1 }, caseRef, {} as TrustedUiContext)
  expect(result).toEqual({ status: "stale", reason: "portfolio-analysis-changed" })
  expect(writes.count).toBe(0)
})

test("sensitivity closes sample rereads with the bound reader and denies authority revoked during those reads", async () => {
  // This isolates the read ordering, not numerical calculation; renewal tests use the real C08 reader.
  const caseRef = { id: "case", incarnation: "inc", version: 1 }
  const context = {} as TrustedUiContext
  const request = { scenarioRef: "source", parameterBounds: { parameterRef: "price", minimum: 0, maximum: 1, steps: 1 }, criterion: { id: "criterion", operator: "lte" as const, value: 0 } }
  const sensitivity = { scenarioRef: "source", evaluated: [{ resultRef: "sample", parameterValue: 0, value: null }] }
  const stored = { kind: "sensitivity", resultRef: "sensitivity", resultDigest: digestSfValue(sensitivity), requestDigest: digestSfValue(request), result: sensitivity, caseRef }
  let revokeOnSample = false
  let allowed = true
  const reads: string[] = []
  const results = {
    read: async ({ kind, resultRef }: { kind: string; resultRef: string }) => {
      reads.push(`${kind}:${resultRef}`)
      if (kind === "sensitivity") return { status: "ok", value: structuredClone(stored) }
      if (revokeOnSample) allowed = false
      return { status: "ok", value: { kind: "scenario", resultRef, caseRef, sourceRefs: [] } }
    },
    readHistoricalScenario: async () => { reads.push("source"); return { status: "ok", value: { kind: "scenario", caseRef, sourceRefs: [] } } },
  } as unknown as ReturnType<typeof createSfDecisionResultStore>
  const bindings = {
    read: async () => {
      reads.push("binding-current-proof")
      return allowed ? { status: "ok", value: { resultRef: stored.resultRef, resultDigest: stored.resultDigest, caseRef, request } } : { status: "denied", reason: "criterion-result-access-unavailable" }
    },
  } as unknown as Parameters<typeof createPersistentSensitivityPort>[0]["bindings"]
  const port = createPersistentSensitivityPort({ results, bindings, portfolio: { evaluate: async () => ({ status: "unavailable", reason: "read-only" }), sensitivity: async () => ({ status: "unavailable", reason: "read-only" }) }, resolveBinding: async () => ({ status: "unavailable", reason: "read-only" }), idempotencyKey: async () => undefined })
  expect((await port.read(stored.resultRef, context)).status).toBe("ok")
  expect(reads).toEqual(["sensitivity:sensitivity", "source", "scenario:sample", "sensitivity:sensitivity", "binding-current-proof"])
  reads.length = 0
  revokeOnSample = true
  expect(await port.read(stored.resultRef, context)).toEqual({ status: "denied", reason: "criterion-result-access-unavailable" })
  expect(reads.at(-1)).toBe("binding-current-proof")
})
