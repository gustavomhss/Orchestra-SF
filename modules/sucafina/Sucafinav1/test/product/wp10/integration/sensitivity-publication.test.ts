import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { CriterionResultBinding } from "../../../../product/decisions/criterion-rules.ts"
import { createPlannerExactThreshold } from "../../../../product/planner/exact-threshold.ts"
import { comparePlannerPreview } from "../../../../product/planner/preview-comparison.ts"
import { createPortfolioProofVerifier } from "../../../../product/portfolio/verification.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"
import { sensitivityObservationFixture, sensitivityOk } from "./sensitivity-observation-fixture.ts"

// This new budget covers native production/persistence plus three independent
// recertifications. Existing test deadlines and physical read paths are unchanged.
test("unscoped sensitivity publishes only after final authorization and rejects late borrowed input changes", async () => {
  const deadline = compositionTestDeadline("sensitivity-publication", 285_000)
  try {
    const fixture = await deadline.phase("native-fixture", () => sensitivityObservationFixture(deadline, "all", "eq"))
    const saved = sensitivityOk(await deadline.phase("native-persist", () =>
      fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
        fixture.product.http.sensitivity(fixture.input, fixture.caseRef, fixture.call))))
    expect(saved.sensitivity).toMatchObject({ comparisonStatus: "conditioned", thresholdEvidence: { state: "unavailable" } })
    expect(saved.sensitivity.evaluated.map((point) => [point.parameterValue, point.value])).toEqual([[80, -20], [120, 20]])
    expect(saved.sensitivity.threshold).toBeNull()
    expect(saved.sensitivity.unresolvedConditions.some((condition) => condition.reason.includes("training"))).toBe(true)
    const durable = sensitivityOk(await fixture.authority.state.read(fixture.transport, "cases", (state) => state))
    const binding = sensitivityOk(await fixture.authority.state.read(fixture.transport, "preferences", (state) =>
      Object.values(state.preferences).find((value): value is CriterionResultBinding =>
        !!value && typeof value === "object" && "schema" in value && value.schema === "sf-criterion-result-v1" &&
        "resultRef" in value && value.resultRef === saved.sensitivityResultRef)))
    if (!binding) throw new Error("The native producer did not persist its criterion binding")
    const stored = sensitivityOk(await fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      fixture.business.results.read({ kind: "sensitivity", resultRef: saved.sensitivityResultRef }, fixture.call)))
    expect(stored.resultDigest).toBe(digestSfValue(saved.sensitivity))
    expect(binding.requestDigest).toBe(digestSfValue(fixture.input))
    const units = fixture.portfolio.units, scenarios = fixture.business.plannerProduct.scenarios
    if (!units || !scenarios) throw new Error("Native sensitivity sources unavailable")
    const preview = (request: Parameters<typeof comparePlannerPreview>[1], call: Parameters<typeof comparePlannerPreview>[2]) =>
      comparePlannerPreview({ host: fixture.authority.host, sources: fixture.business.plannerSources,
        scenarios, planner: fixture.portfolio.planner }, request, call)
    const threshold = createPlannerExactThreshold({ units, preview })
    const observation: { calls: number; afterAuthority?: (call: number, allowed: boolean) => Promise<void> } = { calls: 0 }
    const verifier = createPortfolioProofVerifier({ cases: fixture.business.cases, planner: fixture.portfolio.planner,
      sources: fixture.business.plannerSources, evidence: fixture.business.context, results: fixture.business.results,
      revalidate: async (call) => {
        const allowed = await fixture.authority.host.revalidate(call)
        await observation.afterAuthority?.(++observation.calls, allowed)
        return allowed
      },
      readSourceFences: fixture.business.readSourceFences, lockedSourceFences: fixture.business.lockedSourceFences,
      caseFor: fixture.business.resolveCase, idempotencyKey: async (digest, call) => {
        const identity = fixture.business.operationIdentity(call)
        return identity && await fixture.authority.host.revalidate(call) ? "publication:" + digestSfValue({ identity, digest }) : undefined
      },
      decisions: fixture.portfolio.mutations,
      createReceipt: async (call, operation, digest, result) => fixture.business.receipt(call, operation, digest, result),
      candidateCoverageRefFor: async () => ({ status: "unavailable", reason: "unused-portfolio-candidate" }),
      revalidateAnalysis: async () => false,
      units, sensitivityPreview: preview, exactThreshold: (request, resolved, call) => threshold(request, resolved.baselineRef, call),
      // The current native composition has no sensitivityReadScope. Pending
      // training also makes the optional complete-coverage interval unavailable.
    })
    const replay = (bound: CriterionResultBinding, result: typeof stored) =>
      fixture.business.withCase(fixture.call, fixture.caseRef, {}, async () =>
        ({ status: "ok" as const, value: await verifier.verifySensitivity(bound, result, fixture.call) }))
    const hasGrant = () => fixture.persistence.transaction("planner", async (snapshot) =>
      ({ commit: false, value: verifier.verifySnapshot(snapshot, binding, fixture.call) }))
    const duringAuthorization: boolean[] = []
    observation.afterAuthority = async (_call, allowed) => {
      expect(allowed).toBe(true)
      duringAuthorization.push(await hasGrant())
    }
    expect(sensitivityOk(await deadline.phase("positive-recertification", () => replay(binding, stored)))).toBe(true)
    const authorizationCalls = observation.calls
    expect(authorizationCalls).toBeGreaterThan(0)
    expect(duringAuthorization.every((visible) => !visible)).toBe(true)
    expect(await hasGrant()).toBe(true)
    // A rejected new attempt invalidates the previous grant immediately, while
    // that positive grant is still within its thirty-second lifetime.
    const invalid = { ...structuredClone(stored), requestDigest: "f".repeat(64) }
    expect(sensitivityOk(await replay(binding, invalid))).toBe(false)
    expect(await hasGrant()).toBe(false)

    for (const fault of ["stored", "binding"] as const) {
      const borrowedBinding = structuredClone(binding), borrowedStored = structuredClone(stored)
      observation.calls = 0
      const injected = { count: 0 }
      observation.afterAuthority = async (call, allowed) => {
        expect(allowed).toBe(true)
        if (call !== authorizationCalls) return
        expect(await hasGrant()).toBe(false)
        injected.count++
        if (fault === "stored") borrowedStored.requestDigest = "f".repeat(64)
        else borrowedBinding.request.parameterBounds.maximum++
      }
      expect(sensitivityOk(await deadline.phase("late-" + fault + "-mutation", () =>
        replay(borrowedBinding, borrowedStored)))).toBe(false)
      expect(injected.count).toBe(1)
      expect(await hasGrant()).toBe(false)
    }
    observation.afterAuthority = undefined
    expect(sensitivityOk(await fixture.authority.state.read(fixture.transport, "cases", (state) => state))).toEqual(durable)
    expect(binding.requestDigest).toBe(digestSfValue(fixture.input))
    expect(stored.resultDigest).toBe(digestSfValue(saved.sensitivity))
    fixture.control.active = false
    expect(await fixture.authority.host.revalidate(fixture.call)).toBe(false)
    expect((await fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      fixture.product.http.readSensitivity(saved.sensitivityResultRef, fixture.caseRef, fixture.call))).status).not.toBe("ok")
  } finally { await deadline.close() }
}, 300_000)
