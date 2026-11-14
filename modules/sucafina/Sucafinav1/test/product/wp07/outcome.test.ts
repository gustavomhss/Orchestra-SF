import { expect, test } from "bun:test"
import type { ObservedResultProjection } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createReviewOutcomeComparisonAccess } from "../../../product/reviews/outcome-access.ts"
import { reviewOutcomeComparisonLines, reviewOutcomeLines, validOutcomeComparison, validReviewOutcome } from "../../../product/reviews/outcome.ts"
import type { ReviewOutcomeComparison } from "../../../product/reviews/outcome.ts"

const context = { kind: "ui", binding: { principalRef: "principal", installationId: "install", projectId: "project", accessRevision: "access", policyVersion: "policy" } } as unknown as TrustedDomainContext
const period = { start: "2026-01-01", end: "2026-12-31" }
const evidence = { schema: "sf-evidence-v1", refId: "actual-source", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "actual", recordId: "one", incarnation: "physical-original", version: 3, fields: ["actual"], period, projectionDigest: "b".repeat(64) } } as const
const observation: ObservedResultProjection = { caseRef: { id: "case", incarnation: "original", version: 3 }, expected: 100, observed: 95, cutoff: "2026-11-13T00:00:00Z", currency: "USD", sourceRefs: [evidence], limitations: ["Observed amounts do not explain their cause."] }
const comparison: ReviewOutcomeComparison = { status: "comparable", caseRef: observation.caseRef, choiceId: "choice", criterionRef: "cost", unit: "USD", currency: "USD", period, expected: 100, observed: 95, delta: -5, cutoff: observation.cutoff, sourceRefs: observation.sourceRefs, baselineRefs: [evidence], limitations: observation.limitations, compatibility: { metric: true, unit: true, period: true, currency: true, coverage: "complete", compatible: true }, summary: { facts: ["Values from the authorized observation."], pending: ["The cause is not attributed."], causality: "not-attributed" }, observation }

test("missing actual remains unavailable and a zero actual remains an observed zero", () => {
  const missing = { ...observation, observed: null }
  const zero = { ...observation, observed: 0 }
  expect(validReviewOutcome(missing)).toBe(true)
  expect(validReviewOutcome(zero)).toBe(true)
  expect(reviewOutcomeLines(missing)).toContain("Observed: unavailable USD")
  expect(reviewOutcomeLines(zero)).toContain("Observed: 0 USD")
  expect(validOutcomeComparison({ ...comparison, observation: missing })).toBe(false)
  expect(validOutcomeComparison({ ...comparison, observed: 0, delta: -100, observation: zero })).toBe(true)
})

test("meeting outcome lines show cutoff, coverage and sources without assigning a cause", () => {
  expect(validOutcomeComparison(comparison)).toBe(true)
  const lines = reviewOutcomeComparisonLines(comparison)
  expect(lines).toContain(`Observation cutoff: ${observation.cutoff} · coverage complete`)
  expect(lines).toContain("Observed source: actual-source")
  expect(lines).toContain("Preserved baseline source: actual-source")
  expect(lines).toContain("The observation does not establish causality.")
  expect(validOutcomeComparison({ ...comparison, delta: 0 })).toBe(false)
  expect(validOutcomeComparison({ ...comparison, compatibility: { ...comparison.compatibility, coverage: "partial" } })).toBe(false)
  expect(validOutcomeComparison({ ...comparison, period: { start: "2026-02-31", end: "2026-12-31" } })).toBe(false)
})

test("outcome access requests the preserved cutoff and refuses a producer that returns a later current observation", async () => {
  const state = { current: false, calls: 0, available: true }
  const authorize = createReviewOutcomeComparisonAccess({ host: { revalidate: async () => state.available }, read: async (request) => {
    state.calls++
    expect(request).toEqual({ caseRef: observation.caseRef, choiceId: comparison.choiceId, cutoff: observation.cutoff })
    if (!state.available) return { status: "unavailable" }
    const selected = state.current ? { ...observation, observed: 80, cutoff: "2026-11-14T00:00:00Z" } : observation
    return { status: "ready", observation: selected, comparison: state.current ? { ...comparison, observed: 80, delta: -20, cutoff: selected.cutoff, observation: selected } : comparison }
  } })
  expect(await authorize(context, [comparison])).toBe(true)
  expect(state.calls).toBe(2)
  state.current = true
  expect(await authorize(context, [comparison])).toBe(false)
  state.current = false
  state.available = false
  expect(await authorize(context, [comparison])).toBe(false)
  expect(comparison.observed).toBe(95)
})

test("outcome reader failure and mid-read source changes fail closed", async () => {
  const throwing = createReviewOutcomeComparisonAccess({ host: { revalidate: async () => true }, read: async () => { throw new Error("producer unavailable") } })
  expect(await throwing(context, [comparison])).toBe(false)
  let calls = 0
  const changing = createReviewOutcomeComparisonAccess({ host: { revalidate: async () => true }, read: async () => ++calls === 1 ? { status: "ready", observation, comparison } : { status: "unavailable" } })
  expect(await changing(context, [comparison])).toBe(false)
})
