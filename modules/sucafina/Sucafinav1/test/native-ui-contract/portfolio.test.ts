import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfPortfolio } from "../../../../../packages/schema/src/sucafina/portfolio"
import { createSfPortfolioClient } from "../../../../../packages/client/src/sucafina/portfolio"
import { sfPortfolioNativeOperations } from "../../../../../apps/cli/src/sucafina-product/native-ui/portfolio"
import type { SfTransport } from "../../../../../packages/client/src/sucafina/transport"

const caseRef = { id: "case-p", incarnation: "inc-1", version: 7 }
const period = { start: "2026-01-01", end: "2026-12-31" }
const request = {
  scope: { horizon: period, currency: "USD" },
  candidateRefs: ["case-p:alt-1"], operations: [], constraints: [], priorities: [], explorationLimit: 8,
}
const digest = "a".repeat(64)
const read = (value: unknown) => Schema.decodeUnknownSync(SfPortfolio["portfolio.decision-portfolio-read"].input)(value)

describe("A05 portfolio/sensitivity source-locked contracts", () => {
  test("one exact contract exists for every original source action, no generic dispatch", () => {
    expect(Object.keys(SfPortfolio).sort()).toEqual(Object.keys(sfPortfolioNativeOperations).sort())
    expect(Object.keys(SfPortfolio)).toHaveLength(10)
    for (const [id, operation] of Object.entries(SfPortfolio)) {
      expect(operation.operationId).toBe(id)
      expect(sfPortfolioNativeOperations[id as keyof typeof sfPortfolioNativeOperations]).toBe(id.slice("portfolio.".length))
    }
    expect(Object.hasOwn(SfPortfolio, "portfolio.decision-approve")).toBe(false)
  })

  test("case CAS requires id, incarnation, positive version; rejects extra authority", () => {
    expect(read({ caseRef, resultRef: "result-1" })).toEqual({ caseRef, resultRef: "result-1" })
    for (const bad of [
      { caseRef: { id: "case-p", incarnation: "inc-1" }, resultRef: "result-1" },
      { caseRef: { ...caseRef, version: 0 }, resultRef: "result-1" },
      { caseRef: { ...caseRef, version: 1.2 }, resultRef: "result-1" },
      { caseRef: { ...caseRef, installationId: "forged" }, resultRef: "result-1" },
      { caseRef, resultRef: "" },
      { caseRef, resultRef: "result-1", auth: "forged" },
    ]) expect(() => read(bad)).toThrow()
  })

  test("closed selection keeps exact digest/unique-ref source validation boundary", () => {
    const schema = SfPortfolio["portfolio.decision-prepare-portfolio"].input
    const valid = {
      caseRef, request, selectedCandidateRefs: ["case-p:alt-1"],
      combinationId: digest, expectedEvaluationDigest: digest, choiceId: "choice-1",
    }
    expect(Schema.decodeUnknownSync(schema)(valid)).toEqual(valid)
    for (const bad of [
      { ...valid, combinationId: "not-sha256" },
      { ...valid, expectedEvaluationDigest: digest.toUpperCase() },
      { ...valid, choiceId: "" },
      { ...valid, selectedCandidateRefs: ["a"], extra: "ignored" },
      { ...valid, request: { ...request, assumeApproval: true } },
      { ...valid, request: { ...request, explorationLimit: 0 } },
    ]) expect(() => Schema.decodeUnknownSync(schema)(bad)).toThrow()
  })

  test("all canonical refusal statuses stay distinct and require a reason", () => {
    const result = SfPortfolio["portfolio.decision-portfolio-evaluate"].output
    for (const status of ["needs-input", "stale", "denied", "unavailable", "conflict", "provider-conflict", "failed"]) {
      expect(Schema.decodeUnknownSync(result)({ status, reason: "source-refused" }))
        .toEqual({ status, reason: "source-refused" })
    }
    for (const invalid of [
      { status: "approved", value: {} },
      { status: "denied" },
      { status: "ok", value: [] },
      { status: "stale", reason: "stale", previousPrincipal: "private" },
    ]) expect(() => Schema.decodeUnknownSync(result)(invalid)).toThrow()
  })

  test("all ten operation boundaries reject injected unknown input fields by default", () => {
    const evaluate = SfPortfolio["portfolio.decision-portfolio-evaluate"].input
    const valid = { caseRef, request }
    expect(Schema.decodeUnknownSync(evaluate)(valid)).toEqual(valid)
    for (const bad of [
      { ...valid, principalRef: "forged-actor" },
      { ...valid, caseRef: { ...caseRef, authorization: "forged" } },
      { ...valid, request: { ...request, scope: { ...request.scope, grant: "admin" } } },
      { ...valid, request: { ...request, operations: [{ kind: "include", targetRef: "source-1", privileged: true }] } },
    ]) expect(() => Schema.decodeUnknownSync(evaluate)(bad)).toThrow()

    const units = SfPortfolio["portfolio.decision-sensitivity-units"].input
    const correct = { caseRef, scenarioRef: "scenario-1", baselineRef: "baseline-1", parameterRef: "parameter-1" }
    expect(Schema.decodeUnknownSync(units)(correct)).toEqual(correct)
    expect(() => Schema.decodeUnknownSync(units)({ ...correct, expectedPrincipal: "forged" })).toThrow()
  })

  test("result envelopes remain closed without conflating source refusals or dropping fields", () => {
    const results = SfPortfolio["portfolio.decision-portfolio-results"].output
    const ok = { status: "ok", value: [{ resultRef: "result-1", createdAt: "2026-11-15" }] }
    expect(Schema.decodeUnknownSync(results)(ok)).toEqual(ok)
    expect(() => Schema.decodeUnknownSync(results)({
      status: "ok", value: [{ ...ok.value[0], privateAuthority: "forged" }],
    })).toThrow()
    for (const status of ["needs-input", "stale", "denied", "unavailable", "conflict", "provider-conflict", "failed"]) {
      const refusal = { status, reason: "original reason with source evidence" }
      expect(Schema.decodeUnknownSync(results)(refusal)).toEqual(refusal)
      expect(() => Schema.decodeUnknownSync(results)({ ...refusal, approval: "injected" })).toThrow()
    }
  })

  test("zero and null component amounts remain different in portfolio previews", () => {
    const preview = SfPortfolio["portfolio.decision-portfolio-preview"].output
    const output = (amount: number | null) => ({
      status: "ok", value: {
        portfolio: {
          combinations: [{
            id: digest, caseRefs: ["case-p"], components: [{
              id: "priced-component", amount, currency: "USD", period, sourceRefs: [],
              evidenceState: amount === null ? "absent" : "confirmed",
            }],
            costCoverageRefs: [], conflicts: [], restrictions: [],
            eligibility: "ineligible", comparisonStatus: "incompatible",
          }],
          limitations: ["No complete coverage"], evidenceRefs: [],
        },
        selections: [], evaluationDigest: digest,
      },
    })
    const zero = Schema.decodeUnknownSync(preview)(output(0))
    const missing = Schema.decodeUnknownSync(preview)(output(null))
    expect(zero.status).toBe("ok")
    expect(missing.status).toBe("ok")
    if (zero.status === "ok" && missing.status === "ok") {
      expect(zero.value.portfolio.combinations[0]?.components[0]?.amount).toBe(0)
      expect(missing.value.portfolio.combinations[0]?.components[0]?.amount).toBeNull()
    }
  })

  test("sampled, exact zero, and unavailable sensitivity thresholds are not conflated", () => {
    const result = SfPortfolio["portfolio.decision-sensitivity-read"].output
    const sensitivity = {
      scenarioRef: "scenario-1", parameterRef: "price",
      bounds: { minimum: 0, maximum: 10, steps: 10 },
      evaluated: [{ parameterValue: 0, resultRef: "sample-1", value: null }],
      threshold: null, thresholdEvidence: { state: "unavailable", reason: "rule-unavailable" },
      unit: "USD", engineVersion: "engine-1", costCoverageRefs: [],
      comparisonStatus: "conditioned", unresolvedConditions: [], evidenceRefs: [],
    }
    for (const [threshold, thresholdEvidence] of [
      [null, { state: "unavailable", reason: "rule-unavailable" }],
      [0, { state: "exact", value: 0, evidenceRefs: [] }],
      [null, { state: "sampled", interval: { minimum: 0, maximum: 10 }, evidenceRefs: [] }],
    ] as const) {
      const parsed = Schema.decodeUnknownSync(result)({
        status: "ok", value: { sensitivityResultRef: "saved", sensitivity: { ...sensitivity, threshold, thresholdEvidence }, caseRef },
      })
      expect(parsed.status).toBe("ok")
      if (parsed.status === "ok") {
        expect(parsed.value.sensitivity.threshold).toBe(threshold)
        expect(parsed.value.sensitivity.thresholdEvidence.state).toBe(thresholdEvidence.state)
      }
    }
  })

  test("a transport outcome-unknown is not turned into retry or false failure", async () => {
    const seen: { operationId: string; idempotencyKey?: string }[] = []
    const transport: SfTransport = {
      async execute(operation, _input, options) {
        seen.push({ operationId: operation.operationId, idempotencyKey: options.idempotencyKey })
        return { kind: "transport-error", reason: "outcome-unknown" }
      },
    }
    const client = createSfPortfolioClient(transport)
    const value = await client["portfolio.decision-promote-portfolio"]({
      caseRef, request, selectedCandidateRefs: ["case-p:alt-1"],
      combinationId: digest, expectedEvaluationDigest: digest,
      title: "Proposed alternative", coverageRef: "coverage-1",
    }, { signal: new AbortController().signal, idempotencyKey: "intention-012345678" })
    expect(value).toEqual({ kind: "transport-error", reason: "outcome-unknown" })
    expect(seen).toEqual([{ operationId: "portfolio.decision-promote-portfolio", idempotencyKey: "intention-012345678" }])
  })
})
