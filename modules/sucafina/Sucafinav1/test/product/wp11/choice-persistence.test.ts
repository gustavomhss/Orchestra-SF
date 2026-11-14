import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createWp05SensitivityFixture, wp05Horizon } from "../wp05/engine-fixture.ts"

test("explicit human choice persists the producer result, survives reopen, and never applies the simulated Planner operations", async () => {
  const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "omitted", composed: true })
  try {
    const human = { confirmed: false, nextId: 0 }
    const mutation = createDecisionMutations({
      state: fixture.state, host: fixture.host, planner: fixture.plannerWithCriteria, sources: fixture.sources,
      authorizeCase: async () => true, authorizeMutation: async () => true, verifyMutation: () => true,
      operationIdentity: () => "wp11-explicit-choice",
      confirmChoice: async () => human.confirmed,
      confirmAnswer: async () => false,
      resolveQuestion: async () => ({ status: "unavailable", reason: "not-requested" }),
      resolveAnswer: async () => ({ status: "unavailable", reason: "not-requested" }),
      prepareDomainCommands: async () => ({ status: "unavailable", reason: "separate-domain-confirmation-required" }),
      resolveChoiceValues: async (_caseRef, comparison, context) => {
        const result = await fixture.plannerWithCriteria.compareScenarios(comparison, context)
        return result.status === "ok" ? { status: "ok", value: [{ criterionRef: fixture.sensitivityRequest.criterion.id, value: result.value.knownDifference, unit: "USD", currency: "USD", horizon: wp05Horizon }] } : result
      },
      readScenarioResult: (resultRef, context) => fixture.results.read({ kind: "scenario", resultRef }, context),
      createId: () => `wp11-choice-${++human.nextId}`, now: () => "2026-11-13T00:00:00Z",
    })
    const request = { caseRef: fixture.caseRef, alternativeId: "selected", alternativeVersion: 1, comparison: { scenarioRefs: [fixture.baselineRef, fixture.selectedRef], criteria: [fixture.sensitivityRequest.criterion.id] }, criteria: [fixture.sensitivityRequest.criterion.id], reason: "Human accepts this conditioned analysis while training remains unknown; no approval or application." }
    const plannerBefore = await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    expect(await mutation.recordChoice(request, fixture.context)).toEqual({ status: "denied", reason: "human-choice-required" })
    human.confirmed = true
    const recorded = await mutation.recordChoice(request, fixture.context)
    expect(recorded.status).toBe("ok")
    if (recorded.status !== "ok") throw new Error(recorded.reason)
    expect(recorded.value.caseRef.version).toBe(2)
    const saved = await fixture.state.read(fixture.request, "cases", (state) => state.cases[fixture.caseRef.id])
    if (saved.status !== "ok" || !saved.value) throw new Error("Choice persistence unavailable")
    expect(saved.value.choices).toHaveLength(1)
    const choice = structuredClone(saved.value.choices[0]!)
    expect(choice).toMatchObject({ principalRef: "finance", alternativeVersion: 1, basisVersion: 1, comparisonStatus: "conditioned", result: { knownSubtotal: 210000, total: null } })
    expect(choice.result).toEqual(fixture.selectedResult)
    expect(choice.scenario.operations).toHaveLength(3)
    expect(choice.costCoverage.derivedMissingCategoryIds).toContain("training")
    expect(saved.value.preparedChanges).toEqual([])
    expect(saved.value.receipts).toEqual([])
    expect(await mutation.recordChoice(request, fixture.context)).toEqual(recorded)
    expect((await mutation.recordChoice({ ...request, reason: "Different content on the same operation identity" }, fixture.context)).status).toBe("conflict")
    expect(await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(plannerBefore)
    // A distinct state-provider instance reads the committed C08 record through a reopened store.
    const reopened = await openLocalStore(fixture.directory)
    try {
      const state = createSfProductState({ persistence: reopened, createId: () => "unused", resolveTarget: async () => ({ incarnation: fixture.caseRef.incarnation }), authorize: async () => ({ principalRef: "finance", policyVersion: "policy", accessRevision: "access" }) })
      const restored = await state.read(fixture.request, "cases", (value) => value.cases[fixture.caseRef.id])
      if (restored.status !== "ok" || !restored.value) throw new Error("Persisted choice unavailable after reopen")
      expect(restored.value.choices).toEqual([choice])
      expect(restored.value.version).toBe(2)
      expect(restored.value.ledger.filter((event) => event.kind === "choice-recorded")).toHaveLength(1)
      const originalDigest = digestSfValue(choice)
      const changed = await state.transaction(fixture.request, { namespace: "cases", expectedStorageVersion: restored.storageVersion, idempotencyKey: "wp11-later-review", commandDigest: digestSfValue({ objective: "Review the newly received training quote" }), targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation }, async (value) => {
        value.cases[fixture.caseRef.id] = { ...value.cases[fixture.caseRef.id]!, version: 3, state: "reconsidering", objective: "Review the newly received training quote" }
        return { commit: true, value: true }
      })
      expect(changed.status).toBe("ok")
      const historical = await state.read(fixture.request, "cases", (value) => value.cases[fixture.caseRef.id]?.choices[0])
      if (historical.status !== "ok") throw new Error("Historical choice unavailable")
      expect(digestSfValue(historical.value)).toBe(originalDigest)
    } finally { await reopened.dispose() }
  } finally { await fixture.cleanup() }
}, 180000)
