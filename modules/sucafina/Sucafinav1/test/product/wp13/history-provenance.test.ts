import { describe, expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DecisionCasePort, PortResult } from "../../../product/contracts/ports.ts"
import type { SfStoredDecisionResult } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createPortfolioHistoricalProvenance } from "../../../product/portfolio/history-provenance.ts"
import { portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"

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
    input.caseFor = async () => ({ status: "ok", value: { ...originalCase, version: 2 } })
    expect(await createPortfolioHistoricalProvenance(input)(stored, context)).toBe(false)
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
