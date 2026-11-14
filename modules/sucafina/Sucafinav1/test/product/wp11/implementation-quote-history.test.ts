import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { projectPlannerSource } from "../../../product/planner/port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createRenewalChoiceHistory } from "./renewal-choice-fixture.ts"

test("a confirmed implementation quote of 70000 yields 235000 and 5000 advantage in the same case while preserving shared scope and the human choice", async () => {
  const history = await createRenewalChoiceHistory({ training: "bundled" })
  try {
    const before = history.before
    const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
    const readOriginal = () => history.fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: projectPlannerSource(snapshot, actor, history.fixture.scenario.baseRef) }))
    const original = await readOriginal()
    if (!original) throw new Error("Original source unavailable")
    const originalDigest = digestSfValue(original)
    expect(before.selectedResult.knownSubtotal).toBe(210000)
    expect(before.selectedResult.costCoverage.coverageState).toBe("complete")
    expect(before.advantageComparison.knownDifference).toBe(30000)
    const choice = await history.choose()
    const choiceDigest = digestSfValue(choice.choice)
    const revised = await history.reviseImplementation()
    expect(revised.caseRef.id).toBe(before.caseRef.id)
    expect(revised.caseRef.incarnation).toBe(before.caseRef.incarnation)
    expect(revised.caseRef.version).toBeGreaterThan(choice.caseRef.version)
    expect(revised.scenario).toMatchObject({ baseRef: "transition-implementation70000", operations: [], assumptions: [] })
    expect(revised.selectedResult.id.startsWith("source-scenario:")).toBe(true)
    expect(revised.selectedResult).toMatchObject({ knownSubtotal: 235000, total: 235000, comparisonStatus: "complete", costCoverage: { coverageState: "complete", derivedMissingCategoryIds: [] } })
    expect(revised.selectedResult.components.find((component) => component.id === "implementation:11")).toMatchObject({ amount: 70000, currency: "USD", evidenceState: "confirmed" })
    expect(revised.selectedResult.components.find((component) => component.id === "bridge:11")).toMatchObject({ amount: 60000, evidenceState: "confirmed" })
    expect(revised.selectedResult.components.find((component) => component.id === "new-service:11")).toMatchObject({ amount: 105000, evidenceState: "confirmed" })
    expect(revised.selectedResult.components.some((component) => component.id.startsWith("training:"))).toBe(false)
    expect(revised.comparison).toMatchObject({ comparisonStatus: "complete", knownDifference: -5000, completeDifference: -5000, criterionResults: [{ criterionId: "renewal-difference", state: "failed" }] })
    expect(revised.advantageComparison).toMatchObject({ comparisonStatus: "complete", knownDifference: 5000, completeDifference: 5000 })
    const scope = (entries: typeof before.selectedResult.costCoverage.entries) => entries.map((entry) => entry.status === "included" ? { categoryId: entry.categoryId, status: entry.status, componentRefs: entry.componentRefs, scopeNote: entry.scopeNote } : entry.status === "not-applicable" ? { categoryId: entry.categoryId, status: entry.status, justification: entry.justification } : entry)
    expect(scope(revised.selectedResult.costCoverage.entries)).toEqual(scope(before.selectedResult.costCoverage.entries))
    const shared = revised.selectedResult.costCoverage.entries.filter((entry) => ["implementation", "migration", "training"].includes(entry.categoryId))
    expect(shared).toHaveLength(3)
    expect(shared.every((entry) => entry.status === "included" && entry.componentRefs.includes("implementation:11"))).toBe(true)
    expect(revised.selectedResult.costCoverage.entries.filter((entry) => entry.status === "not-applicable").map((entry) => entry.categoryId)).toEqual(["contract_exit", "internal_costs", "other_relevant_costs"])
    const decision = await history.readCase()
    expect(decision.choices).toHaveLength(1)
    expect(digestSfValue(decision.choices[0])).toBe(choiceDigest)
    expect(decision.preparedChanges).toEqual([])
    expect(decision.receipts).toEqual([])
    expect(digestSfValue(await readOriginal())).toBe(originalDigest)
    expect((await history.fixture.evidence.resolve(history.fixture.sourceRefs.find((ref) => ref.refId === history.fixture.scenario.baseRef)!, history.fixture.context)).state).toBe("fresh")
    const reopened = await openLocalStore(history.fixture.directory)
    try {
      const state = createSfProductState({ persistence: reopened, createId: () => "reopened-implementation-history", resolveTarget: async () => ({ incarnation: revised.caseRef.incarnation }), authorize: async () => history.fixture.context.binding })
      const persisted = await state.read(history.fixture.request, "cases", (value) => ({ decision: value.cases[revised.caseRef.id], result: value.decisionResults?.[revised.selectedRef] }))
      if (persisted.status !== "ok") throw new Error("Persisted implementation revision unavailable")
      expect(persisted.value.decision?.version).toBe(revised.caseRef.version)
      expect(digestSfValue(persisted.value.decision?.choices[0])).toBe(choiceDigest)
      expect(persisted.value.result).toMatchObject({ caseRef: revised.caseRef, kind: "scenario", result: { total: 235000, comparisonStatus: "complete" } })
    } finally { await reopened.dispose() }
  } finally { await history.cleanup() }
}, 180000)
