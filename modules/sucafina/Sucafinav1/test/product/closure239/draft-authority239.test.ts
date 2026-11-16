import { expect, test } from "bun:test"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import { createChoiceSnapshot } from "../../../product/decisions/choice.ts"
import { comparePlannerScenarios } from "../../../product/planner/comparison.ts"
import { createProcurementScenarioPreparation } from "../../../product/procurement/scenario-preparation.ts"
import { createScenarioFixture, scenarioAt, scenarioPeriod } from "../procurement-decision-producer/fixture.ts"
import { createApprovalFixture } from "../procurement-approval-closure/fixture.ts"

// This is a source-level regression on a synthetic SQLite installation.
// It deliberately does not claim an installed corporate identity or a CI PASS.
async function selectedDraft(fixture: Awaited<ReturnType<typeof createScenarioFixture>>) {
  const scenario: ScenarioRequest = {
    baseRef: fixture.sourceRef,
    operations: [{ kind: "replace", targetRef: fixture.sourceRef, amount: 140, currency: "USD", period: scenarioPeriod }],
    assumptions: [{ id: "procurement-cost-inventory", value: "renewal-transition-v1", evidenceRefs: [], state: "hypothetical" }],
  }
  const baseline = await fixture.producer.preview({ ...scenario, operations: [] }, fixture.context)
  const proposed = await fixture.producer.preview(scenario, fixture.context)
  if (baseline.status !== "ok" || proposed.status !== "ok") throw new Error("Canonical scenario preview unavailable")
  const alternative = { id: proposed.value.assessment.alternativeId, version: proposed.value.assessment.alternativeVersion, title: "Draft estimate", scenario, result: proposed.value.scenario }
  const comparison = comparePlannerScenarios({
    baselineRef: baseline.value.scenario.id, alternativeRef: alternative.result.id,
    baselineCoverageRef: baseline.value.coverageRef, alternativeCoverageRef: proposed.value.coverageRef,
    baseline: baseline.value.scenario, alternative: alternative.result,
  })
  const decisionCase: DecisionCase = {
    id: "closure239-choice", incarnation: "closure239-incarnation", version: 1, state: "comparing",
    objective: "Review a draft estimate without approval", currency: "USD", horizon: scenarioPeriod,
    criteria: [{ id: "amount", description: "Known draft estimate", required: true }],
    participants: ["alice"], sourceRefs: [fixture.evidence], alternatives: [alternative],
    costCoverageBases: [proposed.value.basis], assumptions: [], questions: [], choices: [],
    preparedChanges: [], receipts: [], ledger: [],
  }
  const selected = createChoiceSnapshot({
    case: decisionCase, alternativeId: alternative.id, alternativeVersion: alternative.version,
    comparison, criteria: ["amount"], values: [{ criterionRef: "amount", value: 140, unit: "currency", currency: "USD", horizon: scenarioPeriod }],
    evidenceRefs: [fixture.evidence], id: "closure239-human-choice", principalRef: "alice",
    reason: "Prepare a revised estimate as draft only", at: scenarioAt,
  })
  if (selected.status !== "ok") throw new Error(`Canonical choice unavailable: ${selected.reason}`)
  return { operation: scenario.operations[0]!, choice: selected.choice }
}

test("C12 draft preparation is read-only, identity-bound, deterministic, and rejects forged choice, revoked access and stale CAS", async () => {
  const fixture = await createScenarioFixture()
  try {
    const { operation, choice } = await selectedDraft(fixture)
    const prepare = createProcurementScenarioPreparation({ host: fixture.host, sources: fixture.sources })
    const selection = { operation, choice, operationId: "closure239-prepare", idempotencyKey: "closure239-idempotency" }
    const before = await fixture.snapshot()
    const writes = fixture.writes.length

    const first = await prepare(selection, fixture.context)
    if (first.status !== "ok") throw new Error(`Explicit draft preparation refused: ${first.reason}`)
    expect(first.value.command.command).toMatchObject({
      page: "Requests", action: "save", id: fixture.requestId, confirmed: false,
      version: before.versions[`requests:${fixture.requestId}`]!.version,
      values: { pr: { estAmount: 140 } },
    })
    expect(first.value.command.requiredAuthority).toContain("procurement:write")
    expect(first.value.command.idempotencyKey).toBe(selection.idempotencyKey)
    expect(first.value.targetEvidence).toEqual(fixture.evidence)
    expect(first.value.preview).toEqual(choice.result)
    expect(choice.result.comparisonStatus).toBe("conditioned")
    expect(await prepare(selection, fixture.context)).toEqual(first)
    expect(await fixture.snapshot()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)

    expect(await prepare({ ...selection, operation: { ...operation, amount: 160 } }, fixture.context))
      .toEqual({ status: "denied", reason: "operation-not-in-choice" })
    expect((await prepare({ ...selection, choice: { ...choice, result: { ...choice.result, sourceRefs: [] } } }, fixture.context)).status)
      .not.toBe("ok")
    const foreign = await fixture.admit("bob")
    expect((await prepare(selection, foreign.context)).status).not.toBe("ok")
    expect(await fixture.snapshot()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)

    // First prove stale CAS, then revoke. UI leases are intentionally destroyed
    // by a failed revalidation; restoring fixture access cannot resurrect them.
    const edit = await fixture.execute(fixture.requester, {
      page: "Requests", action: "save", id: fixture.requestId,
      version: before.versions[`requests:${fixture.requestId}`]!.version,
      values: { pr: { title: "Concurrent authorized draft edit" } },
    })
    expect(edit.ok).toBe(true)
    const changed = await fixture.snapshot()
    expect((await prepare(selection, fixture.context)).status).toBe("stale")
    expect(await fixture.snapshot()).toEqual(changed)
    fixture.access.allowed = false
    expect((await prepare(selection, fixture.context)).status).toBe("denied")
    expect(await fixture.snapshot()).toEqual(changed)
    expect(fixture.writes).toHaveLength(writes + 1)
  } finally {
    await fixture.dispose()
  }
}, 60_000)

test("original Requests policy preserves creator-only draft save, holder-only approval, CAS, stage and unsubmitted state", async () => {
  const fixture = await createApprovalFixture()
  try {
    const selected = await fixture.review("alice")
    const plan = await fixture.lifecycle.prepare({
      review: selected.review, action: { kind: "save-estimate", amount: 140 },
    }, selected.context)
    if (plan.status !== "ok") throw new Error(`Canonical draft review refused: ${plan.reason}`)
    expect(plan.value).toMatchObject({
      requiresExplicitAction: true, approvalGranted: false, receipt: null,
      command: { page: "Requests", action: "save", confirmed: false, values: { pr: { estAmount: 140 } } },
    })
    const before = await fixture.snapshot()
    const notCreator = await fixture.post("bob", plan.value.command)
    expect([403, 404]).toContain(notCreator.status)
    expect(await fixture.snapshot()).toEqual(before)

    expect((await fixture.post("alice", plan.value.command)).status).toBe(200)
    expect(await fixture.current()).toMatchObject({ status: "draft", pr: { estAmount: 140 }, prApproval: null })
    const saved = await fixture.snapshot()
    expect((await fixture.post("alice", plan.value.command)).status).toBe(409)
    expect((await fixture.lifecycle.prepare({ review: selected.review, action: { kind: "save-estimate", amount: 160 } }, selected.context)).status).toBe("stale")
    expect(await fixture.snapshot()).toEqual(saved)

    const fresh = await fixture.review("alice")
    const submit = await fixture.lifecycle.prepare({
      review: fresh.review, action: { kind: "submit-current", amount: 140 },
    }, fresh.context)
    if (submit.status !== "ok") throw new Error(`Original submission unavailable: ${submit.reason}`)
    expect(submit.value.command.action).toBe("submit_pr")
    expect((await fixture.post("alice", submit.value.command)).status).toBe(200)
    expect(await fixture.current()).toMatchObject({ status: "pr_pending", prApproval: { amount: 140, steps: [{ holderId: "bob", status: "pending" }] } })
    const pending = await fixture.snapshot()
    const version = pending.versions[`requests:${fixture.requestId}`]!.version
    const holderCommand = { page: "Requests", action: "approve", id: fixture.requestId, version, values: { comment: "Holder review" } }
    expect((await fixture.post("alice", holderCommand)).status).not.toBe(200)
    expect(await fixture.snapshot()).toEqual(pending)
    expect((await fixture.post("bob", holderCommand)).status).toBe(200)
    expect(await fixture.current()).toMatchObject({ status: "sourcing", pr: { estAmount: 140 }, prApproval: { amount: 140 } })
    const approved = await fixture.snapshot()
    const deniedLateEdit = await fixture.post("alice", {
      page: "Requests", action: "save", id: fixture.requestId,
      version: approved.versions[`requests:${fixture.requestId}`]!.version, confirmed: false,
      values: { pr: { estAmount: 160 } },
    })
    expect([403, 404]).toContain(deniedLateEdit.status)
    expect(await fixture.snapshot()).toEqual(approved)
  } finally {
    await fixture.dispose()
  }
}, 60_000)
