import { expect, test } from "bun:test"
import { compareSfExpectedObserved } from "../../../product/decision-memory/outcome.ts"
import { reconcileSfSignal } from "../../../product/decision-memory/signals.ts"
import { classifySfMaterialChange } from "../../../product/decision-memory/materiality.ts"
import type { ChoiceRecord, ObservedResultProjection } from "../../../product/contracts/decisions.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const ref = { schema: "sf-evidence-v1", refId: "r", installationId: "i", projectId: "p", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "item", recordId: "1", incarnation: "inc", version: 1, fields: ["price"], projectionDigest: "b".repeat(64) } } as const
const coverage = { basisId: "basis", basisVersion: 1, alternativeId: "alt", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [ref], coverageState: "complete", entries: [], derivedMissingCategoryIds: [] } as const
const result = { id: "r", version: 1, components: [], currency: "USD", horizon: period, sourceRefs: [ref], unresolvedConditions: [], restrictions: [], comparisonStatus: "complete", costCoverage: coverage, knownSubtotal: 100, total: 100 } as const
const comparison = { comparisonStatus: "complete", knownDifference: 10, completeDifference: 10, baselineResultRef: "base", alternativeResultRef: "r", costCoverageRefs: [], criterionResults: [{ criterionId: "cost", state: "satisfied", reason: "cost" }], unresolvedConditions: [] } as const
const choice = { id: "choice", alternativeId: "alt", alternativeVersion: 1, basisVersion: 1, criteria: ["cost"], values: [{ criterionRef: "cost", value: 100, unit: "USD", currency: "USD", horizon: period }], evidenceRefs: [ref], principalRef: "p", reason: "baseline", at: "2026-01-01T00:00:00Z", scenario: { baseRef: "base", operations: [], assumptions: [] }, result, comparison, comparisonStatus: "complete", costCoverage: coverage } as const satisfies ChoiceRecord
const observation = { caseRef: { id: "case", incarnation: "inc", version: 1 }, expected: 100, observed: 90, cutoff: "2026-12-31T00:00:00Z", currency: "USD", sourceRefs: [ref], limitations: [] } satisfies ObservedResultProjection
const metric = { criterionRef: "cost", unit: "USD", period, coverage: "complete" } as const

test("outcome comparison requires a compatible complete authorized basis", () => {
  const input = { caseRef: observation.caseRef, choice, observation, metric }
  const compared = compareSfExpectedObserved(input)
  expect(compared.status).toBe("comparable")
  if (compared.status === "comparable") { expect(compared.delta).toBe(-10); expect(compared.limitations.join()).toContain("não estabelece causalidade") }
  expect(compareSfExpectedObserved({ ...input, observation: { ...observation, observed: null } }).status).toBe("unavailable")
  expect(compareSfExpectedObserved({ ...input, metric: { ...metric, coverage: "partial" } }).status).toBe("unavailable")
  expect(compareSfExpectedObserved({ ...input, observation: { ...observation, currency: "EUR" } }).status).toBe("unavailable")
  expect(compareSfExpectedObserved({ ...input, metric: { ...metric, period: { start: "2027-01-01", end: "2027-12-31" } } }).status).toBe("unavailable")
  expect(compareSfExpectedObserved({ ...input, observation: { ...observation, expected: 99 } }).status).toBe("unavailable")
  const extraPeriod = { ...choice, values: [...choice.values, { ...choice.values[0], value: 200, horizon: { start: "2027-01-01", end: "2027-12-31" } }] }
  expect(compareSfExpectedObserved({ ...input, choice: extraPeriod }).status).toBe("comparable")
  expect(compareSfExpectedObserved({ ...input, choice: { ...choice, values: [...choice.values, choice.values[0]] } }).status).toBe("unavailable")
})

test("signal policy deduplicates, resolves and reopens without carrying revoked data", () => {
  const source = { surface: "planner" as const, type: "item", id: "1", incarnation: "inc", version: 1, fields: ["price"], period, observedAt: "2026-01-01" }
  const signal = classifySfMaterialChange({ id: "condition", source, fields: ["price"], period, criterionId: "cost", choice }, { source: { ...source, incarnation: "replacement" }, fields: ["price"], period, before: [ref], after: [ref], availability: "available" }).signal
  expect(signal).toBeDefined()
  if (!signal) return
  const first = reconcileSfSignal(undefined, { kind: "signal", signal })
  expect(first.action).toBe("open")
  if (!("state" in first) || !first.state) return
  expect(reconcileSfSignal(first.state, { kind: "signal", signal }).action).toBe("none")
  expect(reconcileSfSignal(first.state, { kind: "signal", signal: { ...signal, correlationKey: "later" } }).action).toBe("update")
  const resolved = reconcileSfSignal(first.state, { kind: "resolved", conditionId: signal.conditionId, resolutionKey: "resolved" })
  expect(resolved.action).toBe("resolve")
  if (!("state" in resolved) || !resolved.state) return
  expect(reconcileSfSignal(resolved.state, { kind: "signal", signal }).action).toBe("none")
  expect(reconcileSfSignal(resolved.state, { kind: "signal", signal: { ...signal, correlationKey: "new-change" } }).action).toBe("open")
  expect(reconcileSfSignal(first.state, { kind: "revoked" })).toEqual({ action: "remove" })
  expect(reconcileSfSignal(first.state, { kind: "unavailable" })).toEqual({ action: "unavailable" })
})

test("a complete label cannot promote a conditioned or mismatched recorded baseline", () => {
  const input = { caseRef: observation.caseRef, choice, observation, metric }
  const conditioned = { ...result, comparisonStatus: "conditioned" as const, total: null }
  expect(compareSfExpectedObserved({ ...input, choice: { ...choice, result: conditioned } }).status).toBe("unavailable")
  const pendingComparison = { ...comparison, comparisonStatus: "conditioned" as const, completeDifference: null }
  expect(compareSfExpectedObserved({ ...input, choice: { ...choice, comparison: pendingComparison } }).status).toBe("unavailable")
  expect(compareSfExpectedObserved({ ...input, choice: { ...choice, costCoverage: { ...coverage, basisVersion: 2 } } }).status).toBe("unavailable")
  expect(compareSfExpectedObserved({ ...input, choice: { ...choice, result: { ...result, currency: "EUR" } } }).status).toBe("unavailable")
})

test("outcome access rechecks source authority before returning the comparison", async () => {
  const { createSfObservedOutcomeAccess } = await import("../../../product/decision-memory/outcome.ts")
  const call: import("../../../product/contracts/sf-execution.ts").TrustedDomainContext = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "p", accessRevision: "1", policyVersion: "1", requestId: "r", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as import("../../../product/contracts/sf-execution.ts").TrustedUiLease }
  const session = { permitted: true, loads: 0 }
  const access = createSfObservedOutcomeAccess({ load: async () => { session.loads += 1; return { caseRef: observation.caseRef, choice, observation, metric } }, authorizeEvidence: async () => session.permitted, revalidate: async () => session.permitted })
  const result = await access({ caseRef: observation.caseRef, choiceId: choice.id }, call)
  expect(result.status).toBe("comparable")
  if (result.status === "comparable") expect(result.observation).toEqual(observation)
  expect(session.loads).toBe(2)
  const racing = createSfObservedOutcomeAccess({ load: async () => ({ caseRef: observation.caseRef, choice, observation, metric }), authorizeEvidence: async () => { session.loads += 1; return session.loads < 4 }, revalidate: async () => true })
  expect(await racing({ caseRef: observation.caseRef, choiceId: choice.id }, call)).toEqual({ status: "unavailable" })
  session.permitted = false
  expect(await access({ caseRef: observation.caseRef, choiceId: choice.id }, call)).toEqual({ status: "unavailable" })
})

test("review adapter returns only the reauthorized matching observation", async () => {
  const { createSfObservedOutcomeAccess } = await import("../../../product/decision-memory/outcome.ts")
  const { createSfReviewOutcomeAdapter } = await import("../../../product/decision-memory/outcome-review.ts")
  const call: import("../../../product/contracts/sf-execution.ts").TrustedDomainContext = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "p", accessRevision: "1", policyVersion: "1", requestId: "r", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as import("../../../product/contracts/sf-execution.ts").TrustedUiLease }
  const authority = { active: true }
  const access = createSfObservedOutcomeAccess({ load: async () => ({ caseRef: observation.caseRef, choice, observation, metric }), authorizeEvidence: async () => authority.active, revalidate: async () => authority.active })
  const review = createSfReviewOutcomeAdapter(access)
  const actual = await review({ caseRef: observation.caseRef, choiceId: choice.id }, call)
  expect(actual.status).toBe("ready")
  if (actual.status === "ready") { expect(actual.observation).toEqual(observation); expect(actual.comparison.delta).toBe(-10) }
  authority.active = false
  expect(await review({ caseRef: observation.caseRef, choiceId: choice.id }, call)).toEqual({ status: "unavailable" })
})

test("outcome access tolerates an advancing clock but rejects changed values", async () => {
  const { createSfObservedOutcomeAccess } = await import("../../../product/decision-memory/outcome.ts")
  const call: import("../../../product/contracts/sf-execution.ts").TrustedDomainContext = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "p", accessRevision: "1", policyVersion: "1", requestId: "r", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as import("../../../product/contracts/sf-execution.ts").TrustedUiLease }
  const clock = { reads: 0, changed: false }
  const access = createSfObservedOutcomeAccess({ load: async () => { clock.reads += 1; return { caseRef: observation.caseRef, choice, observation: { ...observation, cutoff: clock.reads % 2 ? "2026-12-31T00:00:00Z" : "2026-12-31T00:00:01Z", observed: clock.changed && clock.reads % 2 === 0 ? 91 : 90 }, metric } }, authorizeEvidence: async () => true, revalidate: async () => true })
  const current = await access({ caseRef: observation.caseRef, choiceId: choice.id }, call)
  expect(current.status).toBe("comparable")
  if (current.status === "comparable") expect(current.cutoff).toBe("2026-12-31T00:00:01Z")
  clock.changed = true
  expect(await access({ caseRef: observation.caseRef, choiceId: choice.id }, call)).toEqual({ status: "unavailable" })
  const rewind = { reads: 0 }
  const stale = createSfObservedOutcomeAccess({ load: async () => {
    rewind.reads += 1
    return { caseRef: observation.caseRef, choice, observation: { ...observation, cutoff: rewind.reads === 1 ? "2026-12-31T00:00:01Z" : "2026-12-31T00:00:00Z" }, metric }
  }, authorizeEvidence: async () => true, revalidate: async () => true })
  expect(await stale({ caseRef: observation.caseRef, choiceId: choice.id }, call)).toEqual({ status: "unavailable" })
  expect(compareSfExpectedObserved({ caseRef: observation.caseRef, choice, observation: { ...observation, cutoff: "December 31, 2026" }, metric }).status).toBe("unavailable")
})

test("outcome access snapshots reused producer objects and refuses foreign evidence", async () => {
  const { createSfObservedOutcomeAccess } = await import("../../../product/decision-memory/outcome.ts")
  const call: import("../../../product/contracts/sf-execution.ts").TrustedDomainContext = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "p", accessRevision: "1", policyVersion: "1", requestId: "r", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as import("../../../product/contracts/sf-execution.ts").TrustedUiLease }
  const shared = { caseRef: observation.caseRef, choice, observation: { ...observation }, metric }
  const reads = { count: 0 }
  const access = createSfObservedOutcomeAccess({ load: async () => {
    reads.count += 1
    if (reads.count === 2) shared.observation.observed = 80
    return shared
  }, authorizeEvidence: async () => true, revalidate: async () => true })
  expect(await access({ caseRef: observation.caseRef, choiceId: choice.id }, call)).toEqual({ status: "unavailable" })
  expect(reads.count).toBe(2)
  const foreign = createSfObservedOutcomeAccess({ load: async () => ({ caseRef: observation.caseRef, choice, observation: { ...observation, sourceRefs: [{ ...ref, projectId: "other-project" }] }, metric }), authorizeEvidence: async () => true, revalidate: async () => true })
  expect(await foreign({ caseRef: observation.caseRef, choiceId: choice.id }, call)).toEqual({ status: "unavailable" })
})

test("outcome egress rejects changes during its final authorization await", async () => {
  const { createSfObservedOutcomeAccess } = await import("../../../product/decision-memory/outcome.ts")
  for (const mutation of ["binding", "request", "final-evidence", "authorize-evidence"] as const) {
    const call: import("../../../product/contracts/sf-execution.ts").TrustedDomainContext = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "p", accessRevision: "1", policyVersion: "1", requestId: "r", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as import("../../../product/contracts/sf-execution.ts").TrustedUiLease }
    const request = { caseRef: structuredClone(observation.caseRef), choiceId: choice.id }
    const captured: (readonly import("../../../product/contracts/business-context.ts").BusinessEvidenceRef[])[] = []
    const checks = { count: 0 }
    const access = createSfObservedOutcomeAccess({ load: async () => ({ caseRef: observation.caseRef, choice, observation, metric }), authorizeEvidence: async (refs) => {
      captured.push(refs)
      if (mutation === "authorize-evidence") Object.assign(refs[0]!, { refId: "changed-during-evidence-authorization" })
      return true
    }, revalidate: async () => {
      checks.count += 1
      await Promise.resolve()
      if (checks.count === 3 && mutation === "binding") Object.assign(call.binding, { accessRevision: "changed" })
      if (checks.count === 3 && mutation === "request") request.caseRef.version += 1
      if (checks.count === 3 && mutation === "final-evidence") for (const refs of captured) Object.assign(refs[0]!, { refId: "changed-during-final-authorization" })
      return true
    } })
    expect(await access(request, call)).toEqual({ status: "unavailable" })
    expect(checks.count).toBe(mutation === "authorize-evidence" ? 1 : 3)
  }
})

test("outcome refuses a nonrepresentable delta even when both operands are finite", () => {
  for (const expected of [-1e308, 1e308]) {
    const baseline = { ...choice, values: [{ ...choice.values[0], value: expected }] }
    const unavailable = compareSfExpectedObserved({ caseRef: observation.caseRef, choice: baseline, observation: { ...observation, expected, observed: -expected }, metric })
    expect(unavailable).toMatchObject({ status: "unavailable", reason: "observation-out-of-range", compatibility: { compatible: false } })
    expect("delta" in unavailable).toBe(false)
    const comparable = compareSfExpectedObserved({ caseRef: observation.caseRef, choice: baseline, observation: { ...observation, expected, observed: expected / 2 }, metric })
    expect(comparable.status).toBe("comparable")
    if (comparable.status === "comparable") expect(Number.isFinite(comparable.delta)).toBe(true)
  }
})
