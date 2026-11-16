import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { object } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import { createChoiceSnapshot } from "../../../product/decisions/choice.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { comparePlannerScenarios } from "../../../product/planner/comparison.ts"
import { createProcurementScenarioDraftPreparation, createProcurementScenarioPreparation } from "../../../product/procurement/scenario-preparation.ts"
import { scenarioAt, scenarioPeriod } from "../procurement-decision-producer/fixture.ts"
import { createApprovalFixture } from "./fixture.ts"

test("a persisted C08 choice supplies the exact draft value while remaining distinct from approval and C12 Apply", async () => {
  const fixture = await createApprovalFixture()
  try {
    const draft = await fixture.review()
    const request: ScenarioRequest = { baseRef: draft.sourceRef, operations: [{ kind: "replace", targetRef: draft.sourceRef, amount: 140, currency: "USD", period: scenarioPeriod }], assumptions: [{ id: "procurement-cost-inventory", value: "renewal-transition-v1", evidenceRefs: [], state: "hypothetical" }] }
    const businessBeforePreview = await fixture.snapshot()
    const previewWrites = fixture.writes.length
    const baseline = await fixture.producer.preview({ ...request, operations: [] }, draft.context)
    const preview = await fixture.producer.preview(request, draft.context)
    if (baseline.status !== "ok" || preview.status !== "ok") throw new Error("Current Procurement scenario unavailable")
    expect(baseline.value.scenario.knownSubtotal).toBe(100)
    expect(preview.value.scenario).toMatchObject({ knownSubtotal: 140, total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending" } })
    expect(preview.value.scenario.sourceRefs).toEqual([draft.review.source])
    expect(await fixture.snapshot()).toEqual(businessBeforePreview)
    expect(fixture.writes).toHaveLength(previewWrites)

    const caseRef = { id: "approval-composition-case", incarnation: "approval-composition-incarnation", version: 1 }
    const decision: DecisionCase = { ...caseRef, state: "comparing", objective: "Review an explicit draft estimate of 140 USD", currency: "USD", horizon: scenarioPeriod, criteria: [{ id: "amount", description: "Known estimate", required: true }], participants: ["alice"], sourceRefs: [draft.review.source], alternatives: [{ id: preview.value.assessment.alternativeId, version: preview.value.assessment.alternativeVersion, title: "Reviewed 140 USD proposal", scenario: request, result: preview.value.scenario }], costCoverageBases: [preview.value.basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const comparison = comparePlannerScenarios({ baselineRef: baseline.value.scenario.id, alternativeRef: preview.value.scenario.id, baselineCoverageRef: baseline.value.coverageRef, alternativeCoverageRef: preview.value.coverageRef, baseline: baseline.value.scenario, alternative: preview.value.scenario })
    const chosen = createChoiceSnapshot({ case: decision, alternativeId: preview.value.assessment.alternativeId, alternativeVersion: preview.value.assessment.alternativeVersion, comparison, criteria: ["amount"], values: [{ criterionRef: "amount", value: 140, unit: "currency", currency: "USD", horizon: scenarioPeriod }], evidenceRefs: [draft.review.source], id: "human-choice-140", principalRef: "alice", reason: "Prepare this estimate for a separate draft edit", at: scenarioAt })
    if (chosen.status !== "ok") throw new Error(`Human choice snapshot unavailable: ${chosen.reason}`)
    expect(chosen.choice).toMatchObject({ comparisonStatus: "conditioned", costCoverage: { coverageState: "pending" }, result: { knownSubtotal: 140, total: null } })
    const state = createSfProductState({ persistence: fixture.persistence, createId: randomUUID, resolveTarget: async (_request, _snapshot, namespace, target) => namespace === "cases" && target === caseRef.id ? { incarnation: caseRef.incarnation } : undefined, authorize: async (incoming) => {
      const principal = await fixture.host.authenticate(incoming)
      return principal ? { principalRef: principal.id, accessRevision: "access-1", policyVersion: "policy-1" } : undefined
    } })
    const seeded = await state.transaction(draft.request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "persist-fixture-choice", commandDigest: digestSfValue(chosen.choice), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (current) => {
      current.cases[caseRef.id] = { ...decision, state: "chosen", choices: [chosen.choice] }
      return { commit: true, value: chosen.choice.id }
    })
    expect(seeded.status).toBe("ok")
    const results = createSfDecisionResultStore({ state, host: fixture.host, authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef) && fixture.host.revalidate(context), verifySources: async (_value, refs, context) => {
      const verified = await Promise.all(refs.map(async (ref) => {
        const source = await fixture.sources.resolveForPreparation(ref.refId, context)
        return source.status === "ok" && digestSfValue(source.value.evidence) === digestSfValue(ref)
      }))
      return refs.length > 0 && verified.every(Boolean)
    }, createId: randomUUID, now: () => scenarioAt })
    const write = { kind: "scenario" as const, result: preview.value.scenario, caseRef, requestDigest: digestSfValue(request), sourceRefs: preview.value.scenario.sourceRefs, idempotencyKey: "persist-approved-cycle-scenario" }
    const stored = await results.write(write, draft.context)
    if (stored.status !== "ok") throw new Error(`Canonical scenario persistence unavailable: ${stored.reason}`)
    const storedWrites = fixture.writes.length
    expect(await results.write(write, draft.context)).toEqual(stored)
    expect(fixture.writes).toHaveLength(storedWrites)
    expect(await results.read({ kind: "scenario", resultRef: stored.value.resultRef }, draft.context)).toEqual(stored)
    const persisted = await state.read(draft.request, "cases", (current) => structuredClone(current))
    if (persisted.status !== "ok") throw new Error("Persisted C08 case unavailable")
    expect(Object.keys(object(persisted.value.decisionResults))).toHaveLength(1)
    const choice = persisted.value.cases[caseRef.id]!.choices[0]!
    expect(choice).toEqual(chosen.choice)
    expect(persisted.value.cases[caseRef.id]?.receipts).toEqual([])
    expect(persisted.value.cases[caseRef.id]?.preparedChanges).toEqual([])

    const prepareDraft = createProcurementScenarioDraftPreparation({ host: fixture.host })
    const prepareC12 = createProcurementScenarioPreparation({ host: fixture.host, sources: fixture.sources })
    const operation = choice.scenario.operations[0]!
    const beforePreparation = await fixture.snapshot()
    const writes = fixture.writes.length
    const prepared = await prepareDraft({ operation, choice, review: draft.review }, draft.context)
    if (prepared.status !== "ok") throw new Error(`Chosen draft plan unavailable: ${prepared.reason}`)
    expect(prepared.value).toMatchObject({ kind: "procurement-pr-lifecycle-v1", approvalGranted: false, receipt: null, requiresExplicitAction: true, command: { page: "Requests", action: "save", version: draft.review.domainVersion, values: { pr: { estAmount: 140 } } } })
    expect(await prepareDraft({ operation: { ...operation, amount: 160 }, choice, review: draft.review }, draft.context)).toEqual({ status: "denied", reason: "operation-not-in-choice" })
    expect(await prepareDraft({ operation, choice: { ...choice, result: { ...choice.result, currency: "EUR" } }, review: draft.review }, draft.context)).toEqual({ status: "needs-input", reason: "requisition-basis-mismatch" })
    expect(await prepareDraft({ operation, choice: { ...choice, result: { ...choice.result, sourceRefs: [] } }, review: draft.review }, draft.context)).toEqual({ status: "denied", reason: "preview-source-unavailable" })
    // C12 may now prepare the same canonical draft save, not a submit or approval.
    const c12 = await prepareC12({ operation, choice, operationId: "c12-approved-draft-preparation", idempotencyKey: "c12-approved-draft-preparation" }, draft.context)
    if (c12.status !== "ok") throw new Error(`C12 draft producer unavailable: ${c12.status}`)
    expect(c12.value.command.command).toMatchObject({ page: "Requests", action: "save", confirmed: false, values: { pr: { estAmount: 140 } } })
    expect(c12.value.command.requiredAuthority).toContain("procurement:write")
    expect(c12.value.command.expectedVersion).toBe(draft.review.domainVersion)
    expect(c12.value.targetEvidence).toEqual(draft.review.source)
    expect(c12.value.preview).toEqual(choice.result)
    expect(await fixture.snapshot()).toEqual(beforePreparation)
    expect(await state.read(draft.request, "cases", (current) => structuredClone(current))).toEqual(persisted)
    expect(fixture.writes).toHaveLength(writes)

    expect((await fixture.post("alice", prepared.value.command)).status).toBe(200)
    const saved = await fixture.snapshot()
    const savedWrites = fixture.writes.length
    expect(await fixture.current()).toMatchObject({ status: "draft", pr: { estAmount: 140 }, prApproval: null })
    expect((await prepareDraft({ operation, choice, review: draft.review }, draft.context)).status).toBe("stale")
    expect((await fixture.post("alice", prepared.value.command)).status).toBe(409)
    expect(await fixture.snapshot()).toEqual(saved)
    expect(fixture.writes).toHaveLength(savedWrites)

    const submission = await fixture.review()
    expect(await fixture.lifecycle.prepare({ review: submission.review, action: { kind: "save-estimate", amount: 140 } }, submission.context)).toEqual({ status: "needs-input", reason: "requisition-already-matches" })
    const submit = await fixture.lifecycle.prepare({ review: submission.review, action: { kind: "submit-current", amount: 140 } }, submission.context)
    if (submit.status !== "ok") throw new Error("Fresh canonical submission unavailable")
    expect((await fixture.post("alice", submit.value.command)).status).toBe(200)
    const approval = await fixture.review("bob")
    const approve = await fixture.lifecycle.prepare({ review: approval.review, action: { kind: "approve-submitted", amount: 140, holderId: "bob", comment: "Approve this submitted snapshot" } }, approval.context)
    if (approve.status !== "ok") throw new Error("Fresh canonical approval unavailable")
    expect((await fixture.post("bob", approve.value.command)).status).toBe(200)
    expect(await fixture.current()).toMatchObject({ status: "sourcing", pr: { estAmount: 140 }, prApproval: { amount: 140 } })

    // This checks stored provenance bytes, not authorization to reuse the old source as a current preview.
    expect(await state.read(draft.request, "cases", (current) => structuredClone(current))).toEqual(persisted)
    expect(choice.result).toEqual(preview.value.scenario)
    expect(choice.result.sourceRefs).toEqual([draft.review.source])
    expect(choice.result.total).toBeNull()
    expect(choice.costCoverage.coverageState).toBe("pending")
  } finally { await fixture.dispose() }
})
