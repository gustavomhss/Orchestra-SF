import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { SensitivityRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost, PortfolioPort } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { comparePlannerPreview } from "../../../product/planner/preview-comparison.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { createPlannerSensitivity } from "../../../product/portfolio/planner-sensitivity.ts"
import { createPersistentSensitivityPort } from "../../../product/portfolio/sensitivity-store.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"

const horizon = { start: "2027-01-01", end: "2027-12-31" }
const november = { start: "2027-11-01", end: "2027-11-30" }
const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
const caseRef = { id: "case", incarnation: "case-incarnation", version: 1 }
const initial = (): Snapshot => ({
  data: {
    roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }],
    versions: [{ id: "v0", year: 2027, closed: 9, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "EUR", b: Array(12).fill(100000), a: Array(12).fill(null), f: [null, null, null, null, null, null, null, null, null, 100000, 112000, 100000] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
  },
  versions: {}, sequences: {}, audit: [], notices: [],
})

test("real Planner sensitivity keeps EUR input separate from USD output and leaves missing FX conditioned in C08", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-sensitivity-boundary-"))
  await chmod(directory, 0o700)
  const request = new Request("https://example.test")
  const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "finance", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const access = { allowed: true }
  const store = await openLocalStore(directory)
  try {
    const seededPlanner = await store.transaction("planner", async (snapshot) => {
      snapshot.data = initial().data
      return { commit: true, value: true }
    })
    expect(seededPlanner).toBe(true)
    const snapshot = initial()
    const projection = projectPlannerSource(snapshot, actor, "v0")!
    const evidenceIdentity: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: "v0", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: "v0", incarnation: "planner-v0", version: 1, fields: Object.keys(projection), period: horizon, projectionDigest: digestSfValue({ versionId: "v0", projection }) } }
    const evidence = { ...evidenceIdentity, refDigest: digestSfEvidenceRef(evidenceIdentity) }
    const basis: CostCoverageBasis = { id: "renewal-transition", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [evidence] }
    const sourceCoverage: CostCoverageAssessment = { basisId: basis.id, basisVersion: basis.version, alternativeId: "v0", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: [evidence], coverageState: "pending", entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "training" ? { status: "pending", categoryId, reason: "missing-category" } : { status: "not-applicable", categoryId, justification: "No category disposition is present in this Planner source.", evidenceRefs: [evidence] }), derivedMissingCategoryIds: ["training"] }
    const baseline = { result: undefined as ScenarioResult | undefined }
    const host: DomainPortHost = {
      persistence: store,
      authenticate: async (_request, input) => resolve("finance", [...input!.roleMap], (group) => group === "finance-group"),
      environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }),
      requestFor: () => request,
      revalidate: async () => access.allowed,
    }
    const sources: PlannerSourceHost = {
      resolveForecastSource: async (reference) => reference === "v0" ? { status: "ok", value: { versionId: "v0", evidence } } : { status: "unavailable", reason: "planner-source-unavailable" },
      resolveForecastCoverage: async (reference) => reference === "coverage-v0" && baseline.result
        ? { status: "ok", value: { coverageRef: "coverage-v0", basis, assessment: baseline.result.costCoverage } }
        : reference === "v0"
          ? { status: "ok", value: { coverageRef: "coverage-v0", basis, assessment: sourceCoverage } }
          : { status: "unavailable", reason: "planner-coverage-unavailable" },
    }
    const planner = createPlannerPort({ host, sources })
    const comparison = await planner.compareForecast({ baseRef: "v0", candidateRef: "v0", period: horizon, currency: "USD" }, context)
    expect(comparison.status).toBe("ok")
    if (comparison.status !== "ok") return
    expect(comparison.value.baseline.missing.some((item) => item.reason === "missing-fx")).toBe(true)
    const state = createSfProductState({ persistence: store, createId: () => "state-incarnation", resolveTarget: async () => ({ incarnation: caseRef.incarnation }), authorize: async () => access.allowed ? { principalRef: "finance", policyVersion: "policy", accessRevision: "access" } : undefined })
    const decision = { ...caseRef, state: "comparing" as const, objective: "renewal", currency: "USD", horizon, criteria: [], participants: ["finance"], sourceRefs: [evidence], alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seededCase = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed-case", commandDigest: "c".repeat(64), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (value) => { value.cases[caseRef.id] = decision; return { commit: true, value: true } })
    expect(seededCase.status).toBe("ok")
    const ids = { value: 0 }
    const results = createSfDecisionResultStore({ state, host, authorizeCase: async () => access.allowed, verifySources: async (_value, refs) => access.allowed && refs.every((ref) => ref.refDigest === evidence.refDigest), createId: () => `decision-result-${++ids.value}`, now: () => "2026-11-13T00:00:00Z" })
    const scenario = { baseRef: "v0", operations: [{ kind: "replace" as const, targetRef: "line:11", amount: 112000, currency: "EUR", period: november }], assumptions: [] }
    const baselineResult = await planner.simulateScenario(scenario, context)
    expect(baselineResult.status).toBe("ok")
    if (baselineResult.status !== "ok") return
    baseline.result = baselineResult.value
    const baselineStored = await results.write({ kind: "scenario", result: baseline.result, caseRef, requestDigest: digestSfValue(scenario), sourceRefs: [evidence], idempotencyKey: "sensitivity-baseline" }, context)
    expect(baselineStored.status).toBe("ok")
    if (baselineStored.status !== "ok") return
    const baselineRef = baselineStored.value.resultRef
    const scenarios = {
      resolve: async (resultRef: string) => {
        const stored = await results.read({ kind: "scenario", resultRef }, context)
        if (stored.status !== "ok") return stored
        if (stored.value.kind !== "scenario" || !baseline.result || resultRef !== baselineRef) return { status: "unavailable" as const, reason: "baseline-scenario-unavailable" }
        return { status: "ok" as const, value: { result: stored.value.result, coverageRef: "coverage-v0", basis, projection: comparison.value.baseline, source: evidence } }
      },
    }
    const evaluate = createPlannerSensitivity({
      results,
      resolve: async (input: SensitivityRequest) => ({ status: "ok", value: { caseRef, scenario, baselineRef, criterionId: input.criterion.id, metric: "alternative-minus-baseline-known-subtotal", parameterUnit: "EUR", resultUnit: "USD", unit: "USD", unitMetadataRef: evidence.refId, unitMetadataVersion: 1, engineVersion: "planner-runtime-v1", evidenceRefs: [evidence] } }),
      revalidate: async () => access.allowed,
      preview: (input, trusted) => comparePlannerPreview({ host, sources, scenarios, planner }, input, trusted),
      idempotencyKey: async (digest) => `sensitivity-${digest}`,
    })
    const portfolio: PortfolioPort = { evaluate: async () => ({ status: "unavailable", reason: "unused-by-sensitivity-test" }), sensitivity: evaluate }
    const persistent = createPersistentSensitivityPort({ portfolio, results, idempotencyKey: async (digest) => `persisted-${digest}` })
    const sensitivityRequest: SensitivityRequest = { scenarioRef: baselineRef, parameterBounds: { parameterRef: "line:11", minimum: 100000, maximum: 120000, steps: 2 }, criterion: { id: "renewal-difference", operator: "gte", value: 0 } }
    const saved = await persistent.evaluateAndStore(sensitivityRequest, caseRef, context)
    expect(saved.status).toBe("ok")
    if (saved.status !== "ok") return
    expect(saved.value.sensitivity.parameterUnit).toBe("EUR")
    expect(saved.value.sensitivity.resultUnit).toBe("USD")
    expect(saved.value.sensitivity.unit).toBe("USD")
    expect(saved.value.sensitivity.evaluated.map((point) => point.parameterValue)).toEqual([100000, 110000, 120000])
    expect(saved.value.sensitivity.evaluated.every((point) => point.value === null)).toBe(true)
    expect(saved.value.sensitivity.threshold).toBeNull()
    expect(saved.value.sensitivity.thresholdEvidence).toEqual({ state: "unavailable", reason: "exact-threshold-not-proven" })
    expect(saved.value.sensitivity.costCoverageRefs).toEqual(["coverage-v0"])
    expect(saved.value.sensitivity.comparisonStatus).toBe("conditioned")
    expect(saved.value.sensitivity.unresolvedConditions.some((condition) => condition.reason === "missing-category:training")).toBe(true)
    expect(saved.value.sensitivity.unresolvedConditions.some((condition) => condition.reason.includes("known subtotal differences do not establish a complete threshold"))).toBe(true)
    expect((await persistent.read(saved.value.sensitivityResultRef, context)).status).toBe("ok")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
