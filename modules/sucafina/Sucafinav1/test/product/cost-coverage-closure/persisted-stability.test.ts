import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { CostCoverageEntry } from "../../../product/contracts/decisions.ts"
import { createDecisionBaselineCoverage } from "../../../product/decisions/baseline-coverage.ts"
import { reassessScenarioCoverage, validateScenarioCoverage } from "../../../product/decisions/cost-coverage.ts"
import { supportsCoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { wp05Horizon } from "../wp05/engine-fixture.ts"
import { numericCoverageFixture } from "./numeric-fixture.ts"

// Real C08 registration, classification lookup and Planner observation reproduce
// the persisted included-null -> pending round trip from assessment62. The
// existing quote declarations and the exact human grant are synthetic boundaries.
test("C10 persisted null registration survives canonical no-op reassessment without changing its case or classification", async () => {
  const value = await numericCoverageFixture("null")
  try {
    const { fixture, source, coverage, resolveEvidence } = value
    const writes = new WeakSet<object>()
    const state = createSfProductState({ persistence: fixture.store, proposalCoverageWrites: writes,
      createId: () => "mission80-baseline-state", resolveTarget: async () => ({ incarnation: fixture.caseRef.incarnation }),
      authorize: async (request) => request === fixture.request ? fixture.context.binding : undefined })
    const registration = { caseRef: fixture.caseRef, source, basis: fixture.basis, entries: coverage.entries, expectedVersion: 0 }
    const registrationDigest = digestSfValue(registration)
    const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
    const baseline = createDecisionBaselineCoverage({ state, host: fixture.host,
      resolveCase: async (call) => {
        if (call !== fixture.context || !await fixture.host.revalidate(call)) return { status: "denied", reason: "fixture-case-access-unavailable" }
        const loaded = await state.read(fixture.request, "cases", (current) => current.cases[fixture.caseRef.id])
        if (loaded.status !== "ok" || !loaded.value) return { status: "unavailable", reason: "fixture-case-unavailable" }
        const decision = loaded.value
        return { status: "ok", value: { id: decision.id, incarnation: decision.incarnation, version: decision.version } }
      },
      authorizeCase: async (decision, call) => decision.id === fixture.caseRef.id && decision.incarnation === fixture.caseRef.incarnation &&
        decision.version === fixture.caseRef.version && decision.participants.includes(call.binding.principalRef) && await fixture.host.revalidate(call),
      authorizeCoverage: async (request, call) => call === fixture.context && digestSfValue(request) === registrationDigest && await fixture.host.revalidate(call),
      projectForecast: async (reference, _caseRef, call) => {
        const result = await fixture.planner.compareForecast({ baseRef: reference, candidateRef: reference, period: wp05Horizon, currency: "USD" }, call)
        return result.status === "ok" ? { status: "ok", value: result.value.candidate } : result
      },
      resolveEvidence, supports: coverage.supports,
      verifySnapshot: (snapshot, request, record, call) => call === fixture.context && digestSfValue(request) === registrationDigest &&
        [request.source, ...record.basis.sourceRefs, ...record.assessment.evaluatedSourceRefs].every((ref) => {
          if (digestSfValue(ref) === digestSfValue(coverage.statement)) return true
          if (ref.kind !== "record" || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version" ||
            !fixture.sourceRefs.some((expected) => digestSfValue(expected) === digestSfValue(ref))) return false
          const projection = projectPlannerSource(snapshot, actor, ref.target.recordId)
          return !!projection && digestSfValue({ versionId: ref.target.recordId, projection }) === ref.target.projectionDigest
        }),
      operationIdentity: (call) => call === fixture.context ? "mission80-persisted-null" : undefined,
      proposalCoverageWrites: writes, now: () => "2026-11-13T00:00:00Z" })
    const beforeCase = await state.read(fixture.request, "cases", (current) => current.cases[fixture.caseRef.id])
    expect(beforeCase.status).toBe("ok")
    expect(coverage.entries.find((entry) => entry.categoryId === "training")?.status).toBe("included")
    expect(coverage.actual.components.find((component) => component.id === "training:11")).toMatchObject({ amount: null, evidenceState: "absent" })
    const registered = await baseline.register(registration, fixture.context)
    expect(registered.status).toBe("ok")
    if (registered.status !== "ok") throw new Error(`C08 baseline registration: ${registered.reason}`)
    const registeredCase = await state.read(fixture.request, "cases", (current) => current.cases[fixture.caseRef.id])
    if (beforeCase.status !== "ok" || registeredCase.status !== "ok") throw new Error("Persisted case unavailable")
    expect(registeredCase.value).toEqual(beforeCase.value)
    const persisted = await baseline.resolveForecastCoverage(registered.value.coverageRef, fixture.context)
    const classification = await baseline.readClassification(registered.value.coverageRef, fixture.context)
    if (persisted.status !== "ok" || classification.status !== "ok") throw new Error("Persisted baseline or classification unavailable")
    expect(persisted.value.assessment).toMatchObject({ coverageState: "pending", issues: [], derivedMissingCategoryIds: [],
      entries: expect.arrayContaining([{ categoryId: "training", status: "pending", reason: "component-unresolved" }]) })
    const preferences = await state.read(fixture.request, "preferences", (current) => current.preferences)
    expect(preferences.status).toBe("ok")
    const planner = createPlannerPort({ host: fixture.host, sources: { ...fixture.sources, resolveForecastCoverage: baseline.resolveForecastCoverage } })
    const observed = await planner.simulateScenario({ baseRef: source.refId, operations: [], assumptions: [] }, fixture.context)
    if (observed.status !== "ok") throw new Error(`Persisted Planner observation: ${observed.reason}`)
    expect(observed.value).toMatchObject({ knownSubtotal: 210000, total: null, comparisonStatus: "conditioned", costCoverage: persisted.value.assessment })
    const entries = structuredClone(persisted.value.assessment.entries)
    const classifications = new WeakMap<CostCoverageEntry, typeof classification.value>(entries.map((entry) => [entry, classification.value] as const))
    const before = digestSfValue({ scenario: observed.value, baseline: persisted.value, entries })
    const reassessed = await reassessScenarioCoverage({ scenario: observed.value, basis: persisted.value.basis,
      baseline: persisted.value.assessment, entries, resolveEvidence,
      supports: (entry, evidence) => {
        const current = classifications.get(entry)
        return !!current && supportsCoverageClassification(current, entry, evidence)
      } })
    expect(reassessed).toEqual(observed.value)
    if (!reassessed) throw new Error("C08 normalized coverage became unavailable during no-op reassessment")
    expect(validateScenarioCoverage(reassessed, persisted.value.basis, persisted.value.assessment)).toBeUndefined()
    expect(digestSfValue({ scenario: observed.value, baseline: persisted.value, entries })).toBe(before)
    expect(await baseline.readClassification(registered.value.coverageRef, fixture.context)).toEqual(classification)
    expect(await state.read(fixture.request, "preferences", (current) => current.preferences)).toEqual(preferences)
    expect(await state.read(fixture.request, "cases", (current) => current.cases[fixture.caseRef.id])).toEqual(registeredCase)
  } finally { await value.fixture.cleanup() }
}, 180000)
