import { decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import type { PortfolioBinding } from "../../../product/decisions/portfolio-bindings.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { createPortfolioCandidateHistoryReader } from "../../../product/portfolio/proof.ts"
import { createWp13AnalysisFixture } from "./sensitivity-fixture.ts"
import { describe, expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DecisionCasePort, PortResult } from "../../../product/contracts/ports.ts"
import type { SfStoredDecisionResult } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createPortfolioHistoricalProvenance } from "../../../product/portfolio/history-provenance.ts"

const context = { binding: { accessRevision: "access-7" } } as TrustedDomainContext
const originalCase = { id: "case-a", incarnation: "inc-a", version: 3 }
const currentCase = { ...originalCase, version: 5 }
const sourceRef: BusinessEvidenceRef = {
  schema: "sf-evidence-v1",
  refId: "source-a",
  installationId: "install-a",
  projectId: "project-a",
  refDigest: "source-digest",
  evidenceLevel: "observed",
  kind: "record",
  target: { surface: "planner", recordType: "plan", recordId: "plan-a", incarnation: "plan-inc-a", version: 2, fields: ["amount"], projectionDigest: "projection-digest" },
}
const candidateRef = portfolioCandidateRef({ caseRef: encodeCaseRef(originalCase), caseVersion: originalCase.version, alternativeId: "alt-a", alternativeVersion: 2 })
const request = { scope: { horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD" }, candidateRefs: [candidateRef], operations: [], constraints: ["ceiling"], priorities: [], explorationLimit: 8 }
const alternative = {
  id: "alt-a", version: 2, title: "Original alternative",
  scenario: { baseRef: "planner:v1", operations: [{ kind: "replace" as const, targetRef: "line:1", amount: 100, currency: "USD", period: request.scope.horizon }], assumptions: [] },
  result: { id: "scenario-a", version: 1, components: [], currency: "USD", horizon: request.scope.horizon, sourceRefs: [sourceRef], unresolvedConditions: ["training:missing-category"], restrictions: [], comparisonStatus: "conditioned" as const, knownSubtotal: 100, total: null, costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alt-a", alternativeVersion: 2, currency: "USD", horizon: request.scope.horizon, issues: [], evaluatedSourceRefs: [sourceRef], coverageState: "pending" as const, entries: [], derivedMissingCategoryIds: ["training"] } },
}
const stored: Extract<SfStoredDecisionResult, { kind: "portfolio" }> = {
  schema: "sf-decision-result-v1",
  kind: "portfolio",
  resultRef: "decision-result:portfolio-a",
  caseRef: originalCase,
  principalRef: "person-a",
  accessRevision: "access-7",
  policyVersion: "policy-2",
  requestDigest: digestSfValue(request),
  resultDigest: digestSfValue({ combinations: [], limitations: [], evidenceRefs: [sourceRef] }),
  result: { combinations: [], limitations: [], evidenceRefs: [sourceRef] },
  sourceRefs: [sourceRef],
  createdAt: "2027-01-01T00:00:00.000Z",
}

describe("portfolio historical provenance", () => {
  test("accepts an original binding and selection when current case and evidence remain authorized", async () => {
    expect(await createPortfolioHistoricalProvenance(harness())(stored, context)).toBe(true)
  })

  test("allows preserved evidence after a source change while the case remains at the original version", async () => {
    const input = harness()
    input.caseFor = async () => ({ status: "ok", value: originalCase })
    input.cases.read = async () => ({ status: "ok", value: { case: { ...originalCase, alternatives: [alternative] } } } as never)
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(true)
    input.evidence.context = async ({ refs }) => refs.map((ref) => ({ ref, state: "revoked", accessRevision: "access-7", checkedAt: "now" }))
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
  })

  test("rejects a preserved result from a future case version", async () => {
    const input = harness()
    let bindingReads = 0
    const readBinding = input.readHistoricalBinding
    input.readHistoricalBinding = async (request, trusted) => { bindingReads++; return readBinding(request, trusted) }
    input.caseFor = async () => ({ status: "ok", value: { ...originalCase, version: 2 } })
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
    expect(bindingReads).toBe(0)
  })

  test("rejects a candidate whose case incarnation was replaced", async () => {
    const input = harness()
    input.cases.read = async () => ({ status: "ok", value: { case: { id: "case-a", incarnation: "inc-replaced", version: 9 } } } as never)
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
  })

  test("rejects revoked historical sources", async () => {
    const input = harness()
    input.evidence.context = async ({ refs }) => refs.map((ref) => ({ ref, state: "revoked", accessRevision: "access-7", checkedAt: "now" }))
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
  })

  test("rejects a historical candidate missing from the authorized case", async () => {
    const input = harness()
    input.cases.read = async () => ({ status: "ok", value: { case: { ...currentCase, alternatives: [] } } } as never)
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
  })

  test("rejects a same-version alternative whose original payload changed", async () => {
    const input = harness()
    input.cases.read = async () => ({ status: "ok", value: { case: { ...currentCase, alternatives: [{ ...alternative, result: { ...alternative.result, knownSubtotal: 99 } }] } } } as never)
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
  })

  test("rejects ambiguous duplicate alternatives and a case older than the candidate", async () => {
    const input = harness()
    input.cases.read = async () => ({ status: "ok", value: { case: { ...currentCase, alternatives: [alternative, alternative] } } } as never)
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
    input.cases.read = async () => ({ status: "ok", value: { case: { ...currentCase, version: 2, alternatives: [alternative] } } } as never)
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
  })

  test("rejects a binding supplied for a different current owner case", async () => {
    const input = harness()
    input.caseFor = async () => ({ status: "ok", value: { ...currentCase, id: "other" } })
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
  })

  test("keeps the first candidate observation when the provider reuses mutable objects", async () => {
    const input = harness()
    const shared = { case: { ...currentCase, alternatives: [structuredClone(alternative)] } }
    let reads = 0
    input.cases.read = async () => {
      if (++reads > 1) shared.case.version += 1
      return { status: "ok", value: shared } as never
    }
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
  })

  test("keeps the case snapshot before awaiting a historical candidate provider that reuses the same object", async () => {
    const input = harness()
    const shared = { case: { ...currentCase, alternatives: [] } }
    const candidate = { ref: candidateRef, caseRef: encodeCaseRef(originalCase), operations: alternative.scenario.operations, scenario: alternative.scenario, result: alternative.result }
    input.cases.read = async () => ({ status: "ok", value: shared } as never)
    const proof = () => ({ status: "ok" as const, value: { candidate, originalCaseRef: originalCase, currentCaseRef: { id: shared.case.id, incarnation: shared.case.incarnation, version: shared.case.version }, scenarioResultRef: "scenario-a", provenanceDigest: "a".repeat(64) } })
    input.readHistoricalCandidate = async () => proof()
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(true)
    let reads = 0
    input.readHistoricalCandidate = async () => {
      if (++reads === 1) shared.case.version += 1
      return proof()
    }
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
  })

  test("rejects caller mutation during historical provenance verification", async () => {
    const incoming = structuredClone(stored)
    const input = harness()
    input.caseFor = async () => {
      incoming.resultDigest = "0".repeat(64)
      return { status: "ok", value: currentCase }
    }
    expect(await createPortfolioHistoricalProvenance(input)(incoming, context)).toBe(false)
    expect(incoming.resultDigest).toBe("0".repeat(64))
  })

  test("rejects an owner observation changed during the first binding read", async () => {
    const input = harness()
    const shared = { ...currentCase }
    const read = input.readHistoricalBinding
    let reads = 0
    input.caseFor = async () => ({ status: "ok", value: shared })
    input.readHistoricalBinding = async (request, trusted) => {
      if (++reads === 1) shared.version += 1
      return read(request, trusted)
    }
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
    expect(reads).toBe(2)
  })

  test("rejects a binding whose digest does not cover its contents", async () => {
    const input = harness()
    input.readHistoricalBinding = async () => ({ status: "ok", value: { binding: { ...makeBinding(), resultRef: "decision-result:substituted" }, selection: { selectionDigest: "selection-a" } } } as never)
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
  })

  test("rejects a selection that differs from the binding proof", async () => {
    const input = harness()
    input.readHistoricalBinding = async () => ({ status: "ok", value: { binding: makeBinding(), selection: { selectionDigest: "selection-other" } } } as never)
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
  })

  test("rejects a binding that changes between provenance passes", async () => {
    const input = harness()
    let reads = 0
    input.readHistoricalBinding = async () => {
      const binding = makeBinding()
      const changed = ++reads > 1 ? { ...binding, createdAt: "2027-02-01T00:00:00.000Z" } : binding
      return { status: "ok", value: { binding: { ...changed, bindingDigest: bindingDigest(changed) }, selection: { selectionDigest: "selection-a" } } as never }
    }
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
  })
})

function harness(): Parameters<typeof createPortfolioHistoricalProvenance>[0] {
  return {
    readHistoricalBinding: async () => ({ status: "ok", value: { binding: makeBinding(), selection: { selectionDigest: "selection-a" } } } as never),
    caseFor: async () => ({ status: "ok", value: currentCase } as PortResult<typeof currentCase>),
    cases: {
      read: async () => ({ status: "ok", value: { case: { ...currentCase, alternatives: [alternative] } } } as never),
    } as unknown as DecisionCasePort,
    evidence: {
      context: async ({ refs }: { refs: readonly BusinessEvidenceRef[] }) => refs.map((ref) => ({ ref, state: "historical" as const, accessRevision: "access-7", checkedAt: "now" })),
    } as unknown as BusinessContextService,
    host: { revalidate: async () => true },
  }
}

function makeBinding() {
  const value = {
    schema: "sf-portfolio-binding-v1" as const,
    caseRef: originalCase,
    resultRef: stored.resultRef,
    resultDigest: stored.resultDigest,
    request,
    requestDigest: stored.requestDigest,
    proof: { candidates: [{ ref: candidateRef, digest: digestSfValue({ ref: candidateRef, caseRef: encodeCaseRef(originalCase), operations: alternative.scenario.operations, scenario: alternative.scenario, result: alternative.result }) }], selectionDigest: "selection-a" },
    createdAt: "2027-01-02T00:00:00.000Z",
  }
  return { ...value, bindingDigest: bindingDigest(value) }
}

function bindingDigest(value: object) {
  return digestSfValue(Object.fromEntries(Object.entries(value).filter(([name]) => name !== "bindingDigest")))
}

test("historical portfolio reads the original C08 candidate after WP11 replaces alternative v1 with v2", async () => {
  const fixture = await revisedCandidate()
  try {
    const read = createPortfolioCandidateHistoryReader({ state: fixture.world.state, cases: fixture.world.cases, results: fixture.world.results, evidence: fixture.world.evidenceService, host: fixture.world.host })
    const result = await read(fixture.expected, fixture.world.context)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error(`historical candidate unavailable: ${result.reason}`)
    expect(result.value.candidate).toEqual(fixture.candidate)
    expect(result.value.originalCaseRef).toEqual(fixture.originalCaseRef)
    expect(result.value.currentCaseRef).toEqual(fixture.currentCaseRef)
    expect(result.value.scenarioResultRef).toBe(fixture.scenarioResultRef)
    const current = await fixture.world.cases.read({ caseRef: fixture.candidate.caseRef }, fixture.world.context)
    expect(current.status === "ok" && current.value.case.alternatives.some((item) => item.id === fixture.alternativeId && item.version === 1)).toBe(false)
    expect(current.status === "ok" && current.value.case.alternatives.some((item) => item.id === fixture.alternativeId && item.version === 2)).toBe(true)
    const owner = originalPortfolio(fixture)
    const base = { readHistoricalBinding: async () => ({ status: "ok" as const, value: { binding: owner.binding, selection: { selectionDigest: owner.binding.proof.selectionDigest } } }), caseFor: async () => ({ status: "ok" as const, value: fixture.currentCaseRef }), cases: fixture.world.cases, evidence: fixture.world.evidenceService, host: fixture.world.host }
    expect(await createPortfolioHistoricalProvenance(base)(owner.stored, fixture.world.context)).toBe(false)
    expect(await createPortfolioHistoricalProvenance({ ...base, readHistoricalCandidate: read })(owner.stored, fixture.world.context)).toBe(true)
    const wrongProof = { ...owner.binding, proof: { ...owner.binding.proof, candidates: [{ ref: fixture.expected.ref, digest: "0".repeat(64) }] } }
    expect(await createPortfolioHistoricalProvenance({ ...base, readHistoricalCandidate: read, readHistoricalBinding: async () => ({ status: "ok", value: { binding: { ...wrongProof, bindingDigest: bindingDigest(wrongProof) }, selection: { selectionDigest: owner.binding.proof.selectionDigest } } }) })(owner.stored, fixture.world.context)).toBe(false)
  } finally {
    await fixture.world.cleanup()
  }
})

test("historical candidate rejects a naked digest when the original C08 case snapshot and choice are absent", async () => {
  const fixture = await revisedCandidate()
  try {
    const initialRef = portfolioCandidateRef({ caseRef: encodeCaseRef(fixture.world.caseRef), caseVersion: fixture.world.caseRef.version, alternativeId: "selected", alternativeVersion: 1 })
    const initial = { ref: initialRef, caseRef: encodeCaseRef(fixture.world.caseRef), operations: fixture.world.analysisRequest.scenario.operations, scenario: fixture.world.analysisRequest.scenario, result: fixture.world.analysisRequest.result }
    fixture.operation.id = "replace-initial-without-history-snapshot"
    const revised = await fixture.mutations.addAlternative({ caseRef: fixture.currentCaseRef, title: "Revised initial alternative", alternativeRef: { id: "selected", version: 1 }, scenario: { ...initial.scenario, operations: initial.operations.map((item) => ({ ...item, amount: 115000 })) }, coverageRef: decisionCoverageRef(fixture.currentCaseRef, "selected", 1) }, fixture.world.context)
    expect(revised.status).toBe("ok")
    const original = await fixture.world.results.readHistoricalScenario({ resultRef: fixture.world.selectedRef }, fixture.world.context)
    expect(original.status).toBe("ok")
    const read = createPortfolioCandidateHistoryReader({ state: fixture.world.state, cases: fixture.world.cases, results: fixture.world.results, evidence: fixture.world.evidenceService, host: fixture.world.host })
    expect(await read({ ref: initialRef, candidateDigest: digestSfValue(initial) }, fixture.world.context)).toEqual({ status: "unavailable", reason: "portfolio-history-candidate-snapshot-unavailable" })
  } finally {
    await fixture.world.cleanup()
  }
})

test("historical candidate rejects changed C08 request ancestry and revoked evidence", async () => {
  const fixture = await revisedCandidate()
  try {
    const base = { state: fixture.world.state, cases: fixture.world.cases, results: fixture.world.results, evidence: fixture.world.evidenceService, host: fixture.world.host }
    const wrongRequest = createPortfolioCandidateHistoryReader({ ...base, results: { readHistoricalScenario: async (...args) => {
      const result = await fixture.world.results.readHistoricalScenario(...args)
      return result.status === "ok" ? { status: "ok", value: { ...result.value, requestDigest: "f".repeat(64) } } : result
    } } })
    expect(await wrongRequest(fixture.expected, fixture.world.context)).toEqual({ status: "stale", reason: "portfolio-history-scenario-changed" })
    const futureAncestor = createPortfolioCandidateHistoryReader({ ...base, results: { readHistoricalScenario: async (...args) => {
      const result = await fixture.world.results.readHistoricalScenario(...args)
      return result.status === "ok" ? { status: "ok", value: { ...result.value, caseRef: fixture.currentCaseRef } } : result
    } } })
    expect(await futureAncestor(fixture.expected, fixture.world.context)).toEqual({ status: "stale", reason: "portfolio-history-scenario-changed" })
    const deniedScenario = createPortfolioCandidateHistoryReader({ ...base, results: { readHistoricalScenario: async () => ({ status: "denied", reason: "historical-source-revoked" }) } })
    expect(await deniedScenario(fixture.expected, fixture.world.context)).toEqual({ status: "denied", reason: "historical-source-revoked" })
    const revoked = createPortfolioCandidateHistoryReader({ ...base, evidence: { ...fixture.world.evidenceService, context: async ({ refs }) => refs.map((ref) => ({ ref, state: "revoked", accessRevision: fixture.world.context.binding.accessRevision, checkedAt: "2027-01-03T00:00:00Z" })) } })
    expect(await revoked(fixture.expected, fixture.world.context)).toEqual({ status: "denied", reason: "portfolio-history-candidate-evidence-unavailable" })
    const oldAuthority = createPortfolioCandidateHistoryReader({ ...base, evidence: { ...fixture.world.evidenceService, context: async ({ refs }) => refs.map((ref) => ({ ref, state: "historical", accessRevision: "previous-access-revision", checkedAt: "2027-01-03T00:00:00Z" })) } })
    expect(await oldAuthority(fixture.expected, fixture.world.context)).toEqual({ status: "denied", reason: "portfolio-history-candidate-evidence-unavailable" })
    fixture.world.access.allowed = false
    expect((await createPortfolioCandidateHistoryReader(base)(fixture.expected, fixture.world.context)).status).toBe("denied")
  } finally {
    await fixture.world.cleanup()
  }
})

test("historical chosen candidate requires the exact WP11 choice ledger and its original C08 scenario", async () => {
  const world = await createWp13AnalysisFixture()
  try {
    const operation = { id: "history-original-choice" }
    const mutations = historyMutations(world, operation)
    const ref = portfolioCandidateRef({ caseRef: encodeCaseRef(world.caseRef), caseVersion: world.caseRef.version, alternativeId: "selected", alternativeVersion: 1 })
    const candidate = await createDecisionCandidateResolver(world.cases)(ref, world.context)
    if (candidate.status !== "ok") throw new Error("original candidate unavailable")
    const original = await world.results.readHistoricalScenario({ resultRef: world.selectedRef }, world.context)
    if (original.status !== "ok" || original.value.kind !== "scenario") throw new Error("original C08 unavailable")
    const equivalent = await world.results.write({ kind: "scenario", caseRef: world.caseRef, result: original.value.result, requestDigest: original.value.requestDigest, sourceRefs: original.value.sourceRefs, idempotencyKey: "same-scenario-new-result-reference" }, world.context)
    if (equivalent.status !== "ok") throw new Error(`equivalent C08 unavailable: ${equivalent.reason}`)
    expect(equivalent.value.resultRef).not.toBe(world.selectedRef)
    expect(equivalent.value.caseRef).toEqual(original.value.caseRef)
    expect(equivalent.value.resultDigest).toBe(original.value.resultDigest)
    const chosen = await mutations.recordChoice({ caseRef: world.caseRef, alternativeId: "selected", alternativeVersion: 1, comparison: { scenarioRefs: [world.baselineRef, world.selectedRef], criteria: ["renewal-difference"] }, criteria: ["renewal-difference"], reason: "Preserve the original conditioned choice" }, world.context)
    expect(chosen.status).toBe("ok")
    if (chosen.status !== "ok") throw new Error(`choice unavailable: ${chosen.reason}`)
    operation.id = "history-revise-chosen-alternative"
    const revised = await mutations.addAlternative({ caseRef: chosen.value.caseRef, title: "Revised chosen alternative", alternativeRef: { id: "selected", version: 1 }, scenario: { ...candidate.value.scenario, operations: candidate.value.operations.map((item) => ({ ...item, amount: 114000 })) }, coverageRef: decisionCoverageRef(chosen.value.caseRef, "selected", 1) }, world.context)
    expect(revised.status).toBe("ok")
    const read = createPortfolioCandidateHistoryReader({ state: world.state, cases: world.cases, results: world.results, evidence: world.evidenceService, host: world.host })
    const recovered = await read({ ref, candidateDigest: digestSfValue(candidate.value) }, world.context)
    expect(recovered.status).toBe("ok")
    if (recovered.status === "ok") expect(recovered.value.scenarioResultRef).toBe(world.selectedRef)
    const denied = createPortfolioCandidateHistoryReader({ state: world.state, cases: world.cases, results: { readHistoricalScenario: async () => ({ status: "denied", reason: "chosen-scenario-access-revoked" }) }, evidence: world.evidenceService, host: world.host })
    expect(await denied({ ref, candidateDigest: digestSfValue(candidate.value) }, world.context)).toEqual({ status: "denied", reason: "chosen-scenario-access-revoked" })
    const current = await world.state.read(world.request, "cases", (state) => state.cases[world.caseRef.id])
    if (current.status !== "ok" || !current.value) throw new Error("current case unavailable")
    const tampered = await world.state.transaction(world.request, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: world.caseRef.id, targetIncarnation: world.caseRef.incarnation, idempotencyKey: "tamper-choice-witness", commandDigest: digestSfValue("tamper-choice-witness") }, async (state) => {
      const decision = state.cases[world.caseRef.id]!
      state.cases[world.caseRef.id] = { ...decision, ledger: decision.ledger.map((event) => event.kind === "choice-recorded" ? { ...event, outputDigest: "0".repeat(64) } : event) }
      return { commit: true, value: true }
    })
    expect(tampered.status).toBe("ok")
    expect(await read({ ref, candidateDigest: digestSfValue(candidate.value) }, world.context)).toEqual({ status: "unavailable", reason: "portfolio-history-candidate-snapshot-unavailable" })
  } finally {
    await world.cleanup()
  }
})

async function revisedCandidate() {
  const world = await createWp13AnalysisFixture()
  try {
    const operation = { id: "history-alternative-v1" }
    const mutations = historyMutations(world, operation)
    const scenario = { ...world.analysisRequest.scenario, operations: world.analysisRequest.scenario.operations.map((item) => ({ ...item, amount: 113000 })) }
    const first = await mutations.addAlternative({ caseRef: world.caseRef, title: "Historical candidate", scenario, coverageRef: decisionCoverageRef(world.caseRef, "selected", 1) }, world.context)
    if (first.status !== "ok" || !first.value.resultRef) throw new Error(`historical alternative was not created: ${first.status !== "ok" ? first.reason : "missing-result-ref"}`)
    const stored = await world.results.readHistoricalScenario({ resultRef: first.value.resultRef }, world.context)
    if (stored.status !== "ok" || stored.value.kind !== "scenario") throw new Error("historical scenario was not stored")
    const alternativeId = stored.value.result.costCoverage.alternativeId
    const ref = portfolioCandidateRef({ caseRef: encodeCaseRef(first.value.caseRef), caseVersion: first.value.caseRef.version, alternativeId, alternativeVersion: 1 })
    const resolved = await createDecisionCandidateResolver(world.cases)(ref, world.context)
    if (resolved.status !== "ok") throw new Error("historical candidate was not resolved")
    operation.id = "history-alternative-v2"
    const second = await mutations.addAlternative({ caseRef: first.value.caseRef, title: "Revised candidate", alternativeRef: { id: alternativeId, version: 1 }, scenario: { ...scenario, operations: scenario.operations.map((item) => ({ ...item, amount: 114000 })) }, coverageRef: decisionCoverageRef(first.value.caseRef, alternativeId, 1) }, world.context)
    if (second.status !== "ok") throw new Error(`historical alternative was not revised: ${second.reason}`)
    return { world, operation, mutations, alternativeId, candidate: resolved.value, expected: { ref, candidateDigest: digestSfValue(resolved.value) }, originalCaseRef: first.value.caseRef, currentCaseRef: second.value.caseRef, scenarioResultRef: first.value.resultRef }
  } catch (error) {
    await world.cleanup()
    throw error
  }
}

function historyMutations(world: Awaited<ReturnType<typeof createWp13AnalysisFixture>>, operation: { id: string }) {
  let ids = 0
  return createDecisionMutations({
    state: world.state,
    host: world.host,
    planner: world.plannerWithCriteria,
    sources: world.sources,
    coverageEvidence: { entries: async (_scenario, baseline) => ({ status: "ok", value: baseline.entries.filter((entry) => !baseline.derivedMissingCategoryIds.some((categoryId) => categoryId === entry.categoryId)) }), resolve: (refs) => world.evidenceService.context({ refs }, world.context), supports: () => false, verifySnapshot: () => world.access.allowed },
    authorizeCase: async () => world.access.allowed,
    authorizeMutation: async (kind, _request, context) => world.access.allowed && context.kind === "ui" && (kind === "add-alternative" || kind === "record-choice"),
    verifyMutation: () => world.access.allowed,
    operationIdentity: () => operation.id,
    confirmChoice: async () => world.access.allowed,
    resolveQuestion: async () => ({ status: "unavailable", reason: "unused-by-history" }),
    resolveAnswer: async () => ({ status: "unavailable", reason: "unused-by-history" }),
    confirmAnswer: async () => false,
    resolveChoiceValues: async () => ({ status: "ok", value: [{ criterionRef: "renewal-difference", value: null, unit: "USD", currency: "USD", horizon: world.analysisRequest.portfolio.scope.horizon }] }),
    readScenarioResult: (resultRef, context) => world.results.readHistoricalScenario({ resultRef }, context),
    prepareDomainCommands: async () => ({ status: "unavailable", reason: "unused-by-history" }),
    createId: () => `history-id-${++ids}`,
    now: () => "2027-01-02T00:00:00Z",
  })
}

function originalPortfolio(fixture: Awaited<ReturnType<typeof revisedCandidate>>) {
  const request = { ...fixture.world.analysisRequest.portfolio, candidateRefs: [fixture.expected.ref] }
  const portfolio = { combinations: [], limitations: ["finite"], evidenceRefs: [fixture.world.evidence] }
  const stored: Extract<SfStoredDecisionResult, { kind: "portfolio" }> = { schema: "sf-decision-result-v1", kind: "portfolio", resultRef: "decision-result:historical-portfolio", caseRef: fixture.originalCaseRef, principalRef: fixture.world.context.binding.principalRef, accessRevision: fixture.world.context.binding.accessRevision, policyVersion: fixture.world.context.binding.policyVersion, requestDigest: digestSfValue(request), resultDigest: digestSfValue(portfolio), result: portfolio, sourceRefs: [fixture.world.evidence], createdAt: "2027-01-02T00:00:00Z" }
  const value = { schema: "sf-portfolio-binding-v1" as const, caseRef: stored.caseRef, resultRef: stored.resultRef, resultDigest: stored.resultDigest, request, requestDigest: stored.requestDigest, proof: { candidates: [{ ref: fixture.expected.ref, digest: fixture.expected.candidateDigest }], selectionDigest: digestSfValue("original-human-selection") }, createdAt: stored.createdAt }
  const binding: PortfolioBinding = { ...value, bindingDigest: bindingDigest(value) }
  return { stored, binding }
}

test("historical candidate refuses a real case CAS in its last callback while the authority remains live", async () => {
  const fixture = await revisedCandidate()
  try {
    const world = fixture.world
    const initial = await world.state.read(world.request, "cases", (state) => ({ decision: state.cases[world.caseRef.id], result: state.decisionResults?.[fixture.scenarioResultRef] }))
    if (initial.status !== "ok" || !initial.value.decision || !initial.value.result) throw new Error("Historical read counterexample requires the actual persisted case and C08")
    let validations = 0
    let attempts = 0
    let attemptedCommits = 0
    let writeRejected = false
    const host = { ...world.host, revalidate: async (context: TrustedDomainContext) => {
      validations++
      // The reader has completed two full provenance observations. Its final
      // callback tries an authorized, versioned write and swallows the refusal.
      if (validations === 4) {
        attempts++
        await world.state.transaction(world.request, { namespace: "cases", expectedStorageVersion: initial.storageVersion, targetRef: world.caseRef.id, targetIncarnation: world.caseRef.incarnation, idempotencyKey: "wp13-history-final-case-cas", commandDigest: digestSfValue("wp13-history-final-case-cas") }, async (state) => {
          const decision = state.cases[world.caseRef.id]
          if (!decision) throw new Error("Case disappeared")
          attemptedCommits++
          state.cases[world.caseRef.id] = { ...decision, version: decision.version + 1, participants: [] }
          return { commit: true, value: true }
        }).catch(() => { writeRejected = true })
      }
      return world.host.revalidate(context)
    } }
    const read = createPortfolioCandidateHistoryReader({ state: world.state, cases: world.cases, results: world.results, evidence: world.evidenceService, host })
    const rejected = await read(fixture.expected, world.context)
    expect(rejected.status).not.toBe("ok")
    expect(Object.hasOwn(rejected, "value")).toBe(false)
    expect(attempts).toBe(1)
    expect(attemptedCommits).toBe(1)
    expect(writeRejected).toBe(true)
    expect(await world.host.revalidate(world.context)).toBe(true)
    const after = await world.state.read(world.request, "cases", (state) => ({ decision: state.cases[world.caseRef.id], result: state.decisionResults?.[fixture.scenarioResultRef] }))
    expect(after.status === "ok" && after.value).toEqual(initial.value)
    expect(after.status === "ok" && after.storageVersion).toBe(initial.storageVersion)
    // A fresh call executes all readers again; failed root state is never cached.
    const normal = createPortfolioCandidateHistoryReader({ state: world.state, cases: world.cases, results: world.results, evidence: world.evidenceService, host: world.host })
    expect((await normal(fixture.expected, world.context)).status).toBe("ok")
  } finally {
    await fixture.world.cleanup()
  }
}, 120000)
