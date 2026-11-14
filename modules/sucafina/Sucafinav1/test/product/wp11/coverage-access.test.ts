import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"
import type { ScenarioComparison } from "../../../product/contracts/decisions.ts"
import { assessCostCoverage } from "../../../product/decisions/cost-coverage.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

const horizon = { start: "2027-01-01", end: "2027-12-31" }
const evidenceRef: BusinessEvidenceRef = {
  schema: "sf-evidence-v1", refId: "planner-quote", installationId: "install", projectId: "project",
  refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record",
  target: { surface: "planner", recordType: "quote", recordId: "quote-1", incarnation: "quote-inc-1", version: 3, fields: ["amount"], period: horizon, projectionDigest: "b".repeat(64) },
}
const basis = { id: "renewal-v1", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, sourceRefs: [evidenceRef], additionalCategoryIds: [] }

function resolution(ref: BusinessEvidenceRef, state: BusinessEvidenceResolution["state"] = "fresh"): BusinessEvidenceResolution {
  return { ref, state, accessRevision: "access-1", checkedAt: "2026-11-13T00:00:00Z" }
}

function coveredEntries(except?: string) {
  return RENEWAL_TRANSITION_CATEGORIES.filter((category) => category !== except && category !== "training").map((categoryId) => ({
    status: "not-applicable" as const, categoryId, justification: "The reviewed scope excludes this cost", evidenceRefs: [evidenceRef],
  }))
}

test("C10 derives omitted renewal costs, distinguishes supported zero, and fails closed on bad evidence", () => {
  const common = { basis, alternativeId: "replacement", alternativeVersion: 2, currency: "USD", horizon, evidence: [resolution(evidenceRef)], supports: () => true }
  const omitted = assessCostCoverage({ ...common, entries: coveredEntries("training"), components: [] })
  expect(omitted).toMatchObject({ coverageState: "pending", derivedMissingCategoryIds: ["training"], entries: [{ categoryId: "training", status: "pending", reason: "missing-category" }] })

  const trainingSource: SourceRef = { surface: "planner", type: "quote", id: "quote-1", incarnation: "quote-inc-1", version: 3, fields: ["amount"], period: horizon, observedAt: "2026-11-13T00:00:00Z" }
  const zero = assessCostCoverage({ ...common,
    entries: [...coveredEntries(), { status: "included", categoryId: "training", componentRefs: ["training-zero"], evidenceRefs: [evidenceRef], scopeNote: "Confirmed no charge" }],
    components: [{ id: "training-zero", amount: 0, currency: "USD", period: horizon, evidenceState: "confirmed", sourceRefs: [trainingSource] }],
  })
  expect(zero.coverageState).toBe("complete")
  expect(zero.derivedMissingCategoryIds).toEqual([])

  const unsupportedNa = assessCostCoverage({ ...common, supports: () => false, entries: coveredEntries(), components: [] })
  expect(unsupportedNa).toMatchObject({ coverageState: "pending", entries: [{ categoryId: "service", status: "pending", reason: "scope-not-supported" }] })
  const missingValue = assessCostCoverage({ ...common,
    entries: [...coveredEntries(), { status: "included", categoryId: "training", componentRefs: ["training-null"], evidenceRefs: [evidenceRef], scopeNote: "Unpriced" }],
    components: [{ id: "training-null", amount: null, currency: "USD", period: horizon, evidenceState: "absent", sourceRefs: [trainingSource] }],
  })
  expect(missingValue).toMatchObject({ coverageState: "pending", entries: [{ categoryId: "training", status: "pending", reason: "component-unresolved" }] })
  const revoked = assessCostCoverage({ ...common, evidence: [resolution(evidenceRef, "revoked")], entries: coveredEntries(), components: [] })
  expect(revoked).toMatchObject({ coverageState: "unavailable", issues: ["evidence-unavailable"] })
  const invalidInventory = assessCostCoverage({ ...common, basis: { ...basis, categoryIds: RENEWAL_TRANSITION_CATEGORIES.slice(1) }, entries: [], components: [] })
  expect(invalidInventory).toMatchObject({ coverageState: "pending", issues: ["inventory-unavailable"] })
})

test("persisted comparison results are scoped to current case, principal, and source access", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-result-access-"))
  await chmod(directory, 0o700)
  const db = await openLocalStore(directory)
  const access = { revoked: false }
  const ui = (principalRef: string): TrustedUiContext => ({ kind: "ui", binding: { installationId: "install", projectId: "project", principalRef, requestId: "request", policyVersion: "policy-1", accessRevision: "access-1", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} }) as unknown as TrustedUiContext
  const host = { requestFor: (context: TrustedDomainContext) => new Request("https://example.test/", { headers: { "x-principal": context.binding.principalRef } }), revalidate: async (_context: TrustedDomainContext) => !access.revoked }
  const state = createSfProductState({ persistence: db, createId: () => "state-inc", resolveTarget: async (_request, _snapshot, _namespace, targetRef) => ({ incarnation: targetRef === "case" ? "case-inc" : targetRef }), authorize: async (request) => {
    const principalRef = request.headers.get("x-principal")
    return principalRef === "owner" ? { principalRef, policyVersion: "policy-1", accessRevision: "access-1" } : undefined
  } })
  try {
    const owner = ui("owner")
    const source = host.requestFor(owner)
    await state.transaction(source, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed-case", commandDigest: "c".repeat(64), targetRef: "case", targetIncarnation: "case-inc" }, async (staged) => {
      staged.cases.case = { id: "case", incarnation: "case-inc", version: 1, state: "comparing", objective: "renewal", horizon, currency: "USD", criteria: [], participants: ["owner"], sourceRefs: [evidenceRef], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
      return { commit: true, value: true }
    })
    const results = createSfDecisionResultStore({ state, host, authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef), verifySources: async (_value, refs, context) => !access.revoked && context.binding.principalRef === "owner" && refs.every((ref) => ref.refDigest === evidenceRef.refDigest), createId: () => "comparison-1", now: () => "2026-11-13T00:00:00Z" })
    const result: ScenarioComparison = { baselineResultRef: "baseline-result", alternativeResultRef: "alternative-result", costCoverageRefs: ["coverage-ref"], criterionResults: [], unresolvedConditions: ["training:missing-category"], comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null }
    const written = await results.write({ kind: "comparison", result, caseRef: { id: "case", incarnation: "case-inc", version: 1 }, requestDigest: "d".repeat(64), sourceRefs: [evidenceRef], idempotencyKey: "comparison-run-1" }, owner)
    expect(written.status).toBe("ok")
    if (written.status !== "ok") throw new Error(written.reason)
    expect(await results.read({ resultRef: written.value.resultRef, kind: "comparison" }, owner)).toMatchObject({ status: "ok", value: { result } })
    expect((await results.read({ resultRef: written.value.resultRef, kind: "scenario" }, owner)).status).toBe("unavailable")
    expect((await results.read({ resultRef: written.value.resultRef, kind: "comparison" }, ui("other-person"))).status).toBe("denied")

    const current = await state.read(source, "cases", () => null)
    if (current.status !== "ok") throw new Error("case state unavailable")
    await state.transaction(source, { namespace: "cases", expectedStorageVersion: current.storageVersion, idempotencyKey: "advance-case", commandDigest: "e".repeat(64), targetRef: "case", targetIncarnation: "case-inc" }, async (staged) => {
      staged.cases.case = { ...staged.cases.case!, version: 2 }
      return { commit: true, value: true }
    })
    expect((await results.read({ resultRef: written.value.resultRef, kind: "comparison" }, owner)).status).toBe("denied")

    access.revoked = true
    expect((await results.read({ resultRef: written.value.resultRef, kind: "comparison" }, owner)).status).toBe("denied")
  } finally {
    await db.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
