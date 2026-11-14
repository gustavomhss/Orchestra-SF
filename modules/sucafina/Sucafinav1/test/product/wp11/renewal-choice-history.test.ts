import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createCoverageIntervalCertificate } from "../../../product/decisions/coverage-interval.ts"
import type { PortfolioSelection } from "../../../product/decisions/portfolio-selection.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerIntervalProof } from "../../../product/planner/interval-proof.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createRenewalChoiceHistory } from "./renewal-choice-fixture.ts"

test("the same durable choice preserves omitted training while a confirmed source revision reverses cost and criterion", async () => {
  const history = await createRenewalChoiceHistory()
  try {
    const before = history.before
    expect(before.selectedResult).toMatchObject({ knownSubtotal: 210000, total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending", derivedMissingCategoryIds: ["training"] } })
    expect(before.comparison).toMatchObject({ knownDifference: -30000, completeDifference: null, comparisonStatus: "conditioned" })
    expect(before.advantageComparison.knownDifference).toBe(30000)
    await history.checkpoint("threshold-before:start")
    const thresholdBefore = await before.exact(before.sensitivityRequest, before.baselineRef, history.fixture.context)
    await history.checkpoint("threshold-before:complete")
    expect(thresholdBefore.status).toBe("ok")
    if (thresholdBefore.status !== "ok") throw new Error(thresholdBefore.reason)
    expect(thresholdBefore.value.value).toBeCloseTo(55000, 8)
    const chosen = await history.choose()
    await history.checkpoint("choice-recorded")
    const choiceDigest = digestSfValue(chosen.choice)
    expect(chosen.choice).toMatchObject({ result: { knownSubtotal: 210000, total: null }, costCoverage: { coverageState: "pending", derivedMissingCategoryIds: ["training"] } })
    expect((await history.readCase()).preparedChanges).toEqual([])
    expect((await history.readCase()).receipts).toEqual([])
    const after = await history.resolveTraining()
    await history.checkpoint("training-revised")
    expect(after.caseRef.id).toBe(before.caseRef.id)
    expect(after.caseRef.incarnation).toBe(before.caseRef.incarnation)
    expect(after.caseRef.version).toBeGreaterThan(chosen.caseRef.version)
    expect(after.scenario.operations).toEqual([])
    expect(after.selectedResult.id.startsWith("source-scenario:")).toBe(true)
    const training = after.selectedResult.components.filter((component) => component.id.startsWith("training:"))
    expect(training).toHaveLength(12)
    expect(training.filter((component) => component.amount === 0 && component.evidenceState === "confirmed")).toHaveLength(11)
    expect(training.find((component) => component.id === "training:11")).toMatchObject({ amount: 40000, currency: "USD", evidenceState: "confirmed" })
    expect(after.selectedResult).toMatchObject({ knownSubtotal: 250000, total: 250000, comparisonStatus: "complete", costCoverage: { coverageState: "complete", derivedMissingCategoryIds: [] } })
    expect(after.selectedResult.components.every((component) => component.evidenceState === "confirmed")).toBe(true)
    expect(after.comparison).toMatchObject({ knownDifference: 10000, completeDifference: 10000, comparisonStatus: "complete", criterionResults: [{ criterionId: "renewal-difference", state: "failed" }] })
    expect(after.advantageComparison.completeDifference).toBe(-10000)
    await history.checkpoint("threshold-after:start")
    const thresholdAfter = await after.exact(after.sensitivityRequest, after.baselineRef, history.fixture.context)
    await history.checkpoint("threshold-after:complete")
    expect(thresholdAfter.status).toBe("ok")
    if (thresholdAfter.status !== "ok") throw new Error(thresholdAfter.reason)
    expect(thresholdAfter.value.value).toBeCloseTo(15000, 8)
    const decision = await history.readCase()
    expect(decision.choices).toHaveLength(1)
    expect(digestSfValue(decision.choices[0])).toBe(choiceDigest)
    expect(decision.state).toBe("reconsidering")
    expect(decision.preparedChanges).toEqual([])
    expect(decision.receipts).toEqual([])
    expect((await history.rejectLockedSourceCheck()).status).toBe("conflict")
    expect(digestSfValue(await history.readCase())).toBe(digestSfValue(decision))
    expect(await chosen.retry()).toEqual({ status: "ok", value: { caseRef: chosen.caseRef } })
    expect((await history.readCase()).ledger.filter((event) => event.kind === "choice-recorded")).toHaveLength(1)
    // An interval certificate can use a source-only scenario only with the producer's current-value parameter proof.
    const structural = await createPlannerIntervalProof({ units: after.issuer, preview: after.preview })(after.sensitivityRequest, after.baselineRef, history.fixture.context)
    await history.checkpoint("interval-proof:complete")
    if (structural.status !== "ok") throw new Error(structural.reason)
    const body = { schema: "sf-portfolio-selection-v1" as const, selectionRef: "history-selection", caseRef: after.caseRef, baselineAlternativeId: "baseline", alternativeId: "selected", baselineRef: after.baselineRef, alternativeRef: after.selectedRef, criteria: [after.rule.criterionId], comparisonDigest: digestSfValue(after.comparison), version: 1, principalRef: "finance", accessRevision: "access", policyVersion: "policy", createdAt: "2026-11-13T02:00:00Z" }
    const selection: PortfolioSelection = { ...body, selectionDigest: digestSfValue(body) }
    const refs = [...structural.value.sourceRefs, ...after.basis.sourceRefs, ...after.selectedResult.costCoverage.evaluatedSourceRefs, ...after.rule.evidenceRefs, ...after.rule.sensitivity!.sourceRefs]
    const evidence = await after.evidence.context({ refs }, history.fixture.context)
    const input = { decision, selection, scenario: after.scenario, storedResult: after.selectedResult, rule: after.rule, structural: structural.value, assessment: after.selectedResult.costCoverage, basis: after.basis, classification: after.classification, evidence, context: history.fixture.context }
    expect(createCoverageIntervalCertificate(input)?.bounds).toEqual({ parameterRef: "implementation:11", minimum: 10000, maximum: 70000 })
    expect(createCoverageIntervalCertificate({ ...input, structural: { ...structural.value, parameterOperation: undefined } })).toBeUndefined()
    const reopened = await openLocalStore(history.fixture.directory)
    try {
      const state = createSfProductState({ persistence: reopened, createId: () => "reopened-state", resolveTarget: async () => ({ incarnation: after.caseRef.incarnation }), authorize: async () => history.fixture.context.binding })
      const persisted = await state.read(history.fixture.request, "cases", (value) => ({ decision: value.cases[after.caseRef.id], result: value.decisionResults?.[after.selectedRef] }))
      if (persisted.status !== "ok") throw new Error("Reopened decision unavailable")
      expect(digestSfValue(persisted.value.decision?.choices[0])).toBe(choiceDigest)
      expect(persisted.value.result).toMatchObject({ caseRef: after.caseRef, kind: "scenario", result: { total: 250000, comparisonStatus: "complete" } })
    } finally { await reopened.dispose() }
    await history.checkpoint("history-reopened:complete")
    // Dispose the original store/UI, rebuild the reader from SQLite, and read the
    // SAME financial choice with the second explicitly authorized participant.
    const restarted = await history.restart()
    try {
      expect(await history.fixture.host.revalidate(history.fixture.context)).toBe(false)
      const collaborator = await restarted.read()
      expect(collaborator.status).toBe("ok")
      if (collaborator.status !== "ok") throw new Error(`Collaborator read failed:${collaborator.reason}`)
      expect(collaborator.value.context.principalRef).toBe("collaborator")
      expect(collaborator.value.case).toMatchObject({ id: decision.id, incarnation: decision.incarnation, version: decision.version, state: "reconsidering", choices: [chosen.choice], preparedChanges: [], receipts: [] })
      expect(digestSfValue(collaborator.value.case.choices[0])).toBe(choiceDigest)
      expect(collaborator.value.case.alternatives.find((alternative) => alternative.id === "selected")?.result).toMatchObject({ knownSubtotal: 250000, total: 250000, comparisonStatus: "complete" })
      expect(collaborator.value.events.filter((event) => event.kind === "choice-recorded")).toHaveLength(1)
      expect(await restarted.read("outsider")).toMatchObject({ status: "denied", reason: "case-access-unavailable" })
      await restarted.checkpoint("history-restarted-collaborator:complete")
      restarted.revoke()
      expect((await restarted.read()).status).toBe("denied")
    } finally { await restarted.close() }
  } finally { await history.cleanup() }
}, 180000)
