import { expect, test } from "bun:test"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import { createChoiceSnapshot } from "../../../product/decisions/choice.ts"
import { comparePlannerScenarios } from "../../../product/planner/comparison.ts"
import { createProcurementScenarioPreparation } from "../../../product/procurement/scenario-preparation.ts"
import { createScenarioFixture, scenarioAt, scenarioPeriod } from "./fixture.ts"

test("a real hypothetical choice cannot prepare an unapproved financial effect or acquire approval by retry", async () => {
  const fixture = await createScenarioFixture()
  try {
    const scenario: ScenarioRequest = { baseRef: fixture.sourceRef, operations: [{ kind: "replace", targetRef: fixture.sourceRef, amount: 140, currency: "USD", period: scenarioPeriod }], assumptions: [{ id: "procurement-cost-inventory", value: "renewal-transition-v1", evidenceRefs: [], state: "hypothetical" }] }
    const baseline = await fixture.producer.preview({ ...scenario, operations: [] }, fixture.context)
    const proposed = await fixture.producer.preview(scenario, fixture.context)
    if (baseline.status !== "ok" || proposed.status !== "ok") throw new Error("Canonical Procurement preview unavailable")
    const alternative = { id: proposed.value.assessment.alternativeId, version: proposed.value.assessment.alternativeVersion, title: "Proposed amount", scenario, result: proposed.value.scenario }
    const comparison = comparePlannerScenarios({ baselineRef: baseline.value.scenario.id, alternativeRef: alternative.result.id, baselineCoverageRef: baseline.value.coverageRef, alternativeCoverageRef: proposed.value.coverageRef, baseline: baseline.value.scenario, alternative: alternative.result })
    expect(comparison).toMatchObject({ comparisonStatus: "conditioned", knownDifference: 40, completeDifference: null })
    const decisionCase: DecisionCase = { id: "synthetic-choice-case", incarnation: "case-incarnation", version: 1, state: "comparing", objective: "Compare the proposed requisition estimate", currency: "USD", horizon: scenarioPeriod, criteria: [{ id: "amount", description: "Known requisition estimate", required: true }], participants: ["alice"], sourceRefs: [fixture.evidence], alternatives: [alternative], costCoverageBases: [proposed.value.basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const selected = createChoiceSnapshot({ case: decisionCase, alternativeId: alternative.id, alternativeVersion: alternative.version, comparison, criteria: ["amount"], values: [{ criterionRef: "amount", value: alternative.result.knownSubtotal, unit: "currency", currency: "USD", horizon: scenarioPeriod }], evidenceRefs: [fixture.evidence], id: "human-choice", principalRef: "alice", reason: "Explore the proposed estimate with the unresolved cost categories visible", at: scenarioAt })
    if (selected.status !== "ok") throw new Error(`Canonical choice rejected: ${selected.reason}`)
    expect(selected.choice.result.knownSubtotal).toBe(140)
    expect(selected.choice.costCoverage.coverageState).toBe("pending")
    const prepare = createProcurementScenarioPreparation({ host: fixture.host, sources: fixture.sources })
    const selection = { operation: scenario.operations[0]!, choice: selected.choice, operationId: "unapproved-change", idempotencyKey: "same-human-choice" }
    const before = await fixture.snapshot()
    const blocked = { status: "needs-input", reason: "financial-approval-command-unavailable" }
    expect(await prepare(selection, fixture.context)).toEqual(blocked)
    expect(await prepare(selection, fixture.context)).toEqual(blocked)
    expect(await fixture.snapshot()).toEqual(before)
    expect(await prepare({ ...selection, operation: { ...selection.operation, amount: 160 } }, fixture.context)).toEqual({ status: "denied", reason: "operation-not-in-choice" })
    const other = await fixture.admit("bob")
    expect((await prepare(selection, other.context)).status).not.toBe("ok")
    expect(await fixture.snapshot()).toEqual(before)

    expect((await fixture.execute(fixture.requester, { page: "Requests", action: "save", id: fixture.requestId, version: before.versions[`requests:${fixture.requestId}`]!.version, values: { pr: { title: "Changed after the human choice" } } })).ok).toBe(true)
    const changed = await fixture.snapshot()
    expect((await prepare(selection, fixture.context)).status).toBe("stale")
    expect(await fixture.snapshot()).toEqual(changed)
  } finally { await fixture.dispose() }
})
