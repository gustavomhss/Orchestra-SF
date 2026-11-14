import { expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase, ScenarioResult } from "../../../../product/contracts/decisions.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import type { TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import type { SfHumanAction } from "../../../../product/integration/human-authority.ts"
import { createChoiceSnapshot } from "../../../../product/decisions/choice.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { receiptProofTransactionKey } from "../../../../product/decisions/receipt-review-binding.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"

// The chosen, explicitly conditioned scenario is fixture business data. C08,
// source reads, prepare, review, apply, BCS, scenario access and case read are real.
test("composed C12 preserves the original, receipt and case read after apply and rejects broken provenance", async () => {
  const f = await financialCompositionFixture({ humanActions: ["decisions.edit", "decisions.apply"] })
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const initialCaseRef = { id: "dashboard-case", incarnation: "dashboard-case-inc", version: 1 }
  const read = async <T>(work: (call: TrustedUiContext) => Promise<T>) => {
    const call = await f.read()
    try { return await work(call) } finally { f.authority.ui.finish(call) }
  }
  const human = async <T>(action: SfHumanAction, payload: unknown, work: (call: TrustedUiContext) => Promise<T>, operation: string = action) => {
    const admitted = await f.authority.human.admit(f.request(operation), action, payload)
    if (admitted.status !== "ok") throw new Error(`Human admission unavailable: ${action}`)
    try { return await work(admitted.value) } finally { f.authority.human.finish(admitted.value) }
  }
  try {
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.hotTopics = [{ id: "topic", action: "Original action", owner: "Person", due: "2026-12-01", priority: "normal", status: "open", notes: "Before the decision" }]
      return { commit: true, value: undefined }
    })
    const decision: DecisionCase = { ...initialCaseRef, objective: "Review the operational action", state: "investigating", horizon: period, currency: "USD", participants: ["person"],
      criteria: [{ id: "operational", description: "Operational action", required: true }], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seed = await f.authority.state.transaction(f.request("seed-dashboard-case"), { namespace: "cases", expectedStorageVersion: 0, targetRef: f.authority.creationTarget.ref,
      targetIncarnation: f.authority.creationTarget.incarnation, idempotencyKey: "seed-dashboard-case", commandDigest: digestSfValue(decision) }, async (state) => {
        state.cases[decision.id] = decision
        return { commit: true, value: true }
      })
    expect(seed.status).toBe("ok")
    const issued = await read((call) => f.business.dashboardServices.issue({ surface: "dashboard", recordType: "hotTopics", recordId: "topic",
      fields: ["action", "due", "notes", "owner", "priority"], period: { start: "2026-11-14", end: "2026-11-14" } }, call))
    if (issued.status !== "ok") throw new Error(`Dashboard source unavailable: ${issued.reason}`)
    const ref = issued.value
    const original = await read((call) => f.business.context.resolve(ref, call))
    expect(original.state).toBe("fresh")
    const target = { surface: "dashboard" as const, type: ref.target.recordType, id: ref.target.recordId, incarnation: ref.target.incarnation,
      version: ref.target.version, fields: ref.target.fields, period: ref.target.period!, observedAt: f.clock.at }
    const payload = { caseRef: initialCaseRef, target, targetEvidence: ref, sourceRefs: [ref], expectedVersion: 0,
      fields: { action: "Applied action", owner: "Person", due: "2026-12-01", priority: "high" as const, notes: "Explicit operational decision" } }
    const registered = await human("decisions.edit", payload, (call) => f.business.dashboardDecisions.drafts.register(payload, call))
    if (registered.status !== "ok") throw new Error(`Draft unavailable: ${registered.reason}`)
    const draft = await read((call) => f.business.dashboardDecisions.drafts.readCurrent({ caseRef: initialCaseRef, draftRef: registered.value.draftRef }, call))
    if (draft.status !== "ok") throw new Error(`Draft read unavailable: ${draft.reason}`)
    const result: ScenarioResult = { id: "scenario", version: 1, currency: "USD", horizon: period, components: [], sourceRefs: [ref],
      unresolvedConditions: ["Financial impact of the Hot Topic change is not assessed."], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: null, total: null,
      costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period,
        issues: [], evaluatedSourceRefs: [ref], coverageState: "pending", entries: [{ status: "pending", categoryId: "other_relevant_costs", reason: "Financial impact is not assessed" }], derivedMissingCategoryIds: ["other_relevant_costs"] } }
    const operation = { kind: "replace" as const, targetRef: ref.refId, replacementRef: draft.value.draftRef }
    const chosen: DecisionCase = { ...decision, sourceRefs: [ref],
      costCoverageBases: [{ id: "basis", version: 1, decisionType: "operational", categoryIds: ["other_relevant_costs"], additionalCategoryIds: [], sourceRefs: [ref] }],
      alternatives: [{ id: "alternative", version: 1, title: "Update action", scenario: { baseRef: "case-base", operations: [operation], assumptions: [] }, result }] }
    const choice = createChoiceSnapshot({ case: chosen, alternativeId: "alternative", alternativeVersion: 1, id: "choice", principalRef: "person", reason: "Proceed without a financial claim", at: f.clock.at,
      criteria: ["operational"], values: [], evidenceRefs: [ref], comparison: { baselineResultRef: "baseline", alternativeResultRef: result.id, costCoverageRefs: ["basis"], criterionResults: [],
        unresolvedConditions: result.unresolvedConditions, comparisonStatus: "conditioned", knownDifference: null, completeDifference: null } })
    if (choice.status !== "ok") throw new Error(`Choice fixture invalid: ${choice.reason}`)
    const current = await f.authority.state.read(f.request(), "cases", (state) => state.cases[decision.id])
    if (current.status !== "ok") throw new Error("Case fixture unavailable")
    expect((await f.authority.state.transaction(f.request("seed-existing-choice"), { namespace: "cases", expectedStorageVersion: current.storageVersion,
      targetRef: decision.id, targetIncarnation: decision.incarnation, idempotencyKey: "seed-existing-choice", commandDigest: digestSfValue(choice.choice) }, async (state) => {
        state.cases[decision.id] = { ...chosen, version: 2, state: "chosen", choices: [choice.choice] }
        return { commit: true, value: true }
      })).status).toBe("ok")
    const prepareRequest = { caseRef: { ...initialCaseRef, version: 2 }, choiceId: choice.choice.id, draftRef: draft.value.draftRef }
    const prepared = await human("decisions.prepare-changes", prepareRequest, (call) => f.business.dashboardDecisions.prepare(prepareRequest, call))
    if (prepared.status !== "ok") throw new Error(`Prepare failed: ${prepared.reason}`)
    const reviewed = await read((call) => f.business.dashboardDecisions.review(prepared.value, call))
    if (reviewed.status !== "ok") throw new Error(`Review failed: ${reviewed.reason}`)
    expect(reviewed.value.fields).toContainEqual({ field: "action", before: "Original action", after: "Applied action" })
    const applyRequest = { ...prepared.value, reviewDigest: reviewed.value.reviewDigest }
    const applied = await human("decisions.apply", applyRequest, (call) => f.business.dashboardDecisions.apply(applyRequest, call), "apply-once")
    if (applied.status !== "ok") throw new Error(`Apply failed: ${applied.reason}`)
    const stored = await f.authority.state.read(f.request(), "cases", (state) => state.cases[decision.id])
    if (stored.status !== "ok" || !stored.value) throw new Error("Applied case unavailable")
    const after = stored.value
    const receiptRef = after.sourceRefs.find((source) => source.kind === "receipt")
    if (!receiptRef || receiptRef.kind !== "receipt") throw new Error("Actual C12 receipt reference missing")
    const history = await read((call) => f.business.context.resolve(ref, call))
    expect(history.state).toBe("historical")
    expect(history.authorizedProjection).toEqual(original.authorizedProjection)
    expect(history.differences).toContainEqual({ field: "hotTopics:topic:action", before: "Original action", after: "Applied action" })
    expect(history.currentRef?.refDigest).not.toBe(ref.refDigest)
    expect(await read((call) => f.business.context.resolve(receiptRef, call))).toMatchObject({ state: "fresh", ref: receiptRef, currentRef: receiptRef,
      authorizedProjection: { engineVersion: "dashboard-receipt-v1", version: applied.value.version } })
    expect((await read((call) => f.business.cases.read({ caseRef: encodeCaseRef(after) }, call))).status).toBe("ok")
    const actualOperation = { caseRef: { id: after.id, incarnation: after.incarnation, version: after.version }, draftRef: draft.value.draftRef, operation }
    expect((await read((call) => f.business.dashboardDecisions.resolveOperation(actualOperation, call))).status).toBe("ok")
    expect((await read((call) => f.business.dashboardDecisions.resolveOperation({ ...actualOperation, operation: { ...operation, targetRef: "other-target" } }, call))).status).not.toBe("ok")
    expect((await read((call) => f.business.dashboardDecisions.resolveOperation({ ...actualOperation, caseRef: { ...actualOperation.caseRef, id: "other-case" } }, call))).status).not.toBe("ok")
    expect((await human("decisions.apply", applyRequest, (call) => f.business.dashboardDecisions.apply(applyRequest, call), "apply-once"))).toEqual(applied)
    const unmodified = await f.authority.state.read(f.request(), "cases", (state) => state.cases[decision.id])
    expect(unmodified.status === "ok" && unmodified.value).toEqual(after)
    const forged = { ...receiptRef, target: { ...receiptRef.target, commandDigest: "f".repeat(64) } }
    expect((await read((call) => f.business.context.resolve({ ...forged, refDigest: digestSfEvidenceRef(forged) }, call))).state).toBe("unavailable")

    // Fault injection changes protected bytes only in the test store. Production
    // paths cannot write these archives without the host's private capability.
    const saved = await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.__sfProductV1) as SfProductState }))
    const mutate = (change: (state: SfProductState) => void) => f.store.transaction("dashboard", async (snapshot) => {
      snapshot.data.__sfProductV1 = structuredClone(saved)
      change(snapshot.data.__sfProductV1 as SfProductState)
      return { commit: true, value: undefined }
    })
    const proofKey = receiptProofTransactionKey(applied.value.principalRef, after.preparedChanges[0]!.target.id, applied.value.idempotencyKey)
    for (const corrupt of [
      (state: SfProductState) => { state.transactions[proofKey]!.targetIncarnation = "foreign-incarnation" },
      (state: SfProductState) => { state.transactions[proofKey]!.value = { ...applied.value, commandDigest: "a".repeat(64) } },
      (state: SfProductState) => { state.receipts[applied.value.id]!.version++ },
      (state: SfProductState) => { state.cases[decision.id]!.participants = [] },
      (state: SfProductState) => { state.cases[decision.id]!.preparedChanges = [...after.preparedChanges, ...after.preparedChanges] },
    ]) {
      await mutate(corrupt)
      expect((await read((call) => f.business.context.resolve(receiptRef, call))).state).toBe("unavailable")
    }
    await mutate((state) => {
      const key = `sf:dashboard-host:prepared:${prepared.value.changeId}`
      const binding = state.preferences[key] as Record<string, unknown>
      delete binding.sourceCaptures
      binding.recordDigest = digestSfValue(Object.fromEntries(Object.entries(binding).filter(([name]) => name !== "recordDigest")))
    })
    expect((await read((call) => f.business.context.resolve(ref, call))).state).toBe("unavailable")
    expect((await read((call) => f.business.context.resolve(receiptRef, call))).state).toBe("unavailable")
    await mutate(() => {})
    await f.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = []; return { commit: true, value: undefined } })
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.hotTopics = [{ id: "topic", action: "Applied action", owner: "Person", due: "2026-12-01", priority: "high", status: "open", notes: "Explicit operational decision" }]
      return { commit: true, value: undefined }
    })
    expect((await read((call) => f.business.context.resolve(ref, call))).state).toBe("unavailable")
    expect((await read((call) => f.business.context.resolve(receiptRef, call))).state).toBe("unavailable")
    expect((await read((call) => f.business.cases.read({ caseRef: encodeCaseRef(after) }, call))).status).not.toBe("ok")
  } finally { await f.dispose() }
}, 120_000)
