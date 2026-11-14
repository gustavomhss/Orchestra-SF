import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { plannerValueRef } from "../../../../product/planner/scenario-inputs.ts"
import { createSfScenarioOperationAccess } from "../../../../../../../apps/cli/src/sucafina-product/scenario-operation-access.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

// SQLite, authenticated source issuance, the Planner simulator and the composed
// case reader are real. Pending coverage and storing the produced alternative
// are explicit C08 fixtures; this is no human promotion or complete-cost proof.
test("stored Planner selectors use the exact domain projection without reopening coverage", async () => {
  const deadline = compositionTestDeadline("scenario-operation-access")
  try {
    const fixture = await scenarioFixture(deadline)
    const { access, business, call, decision, reads } = fixture
    const before = reads.coverage
    expect(await access(decision, call)).toBe(true)
    expect(reads.coverage).toBe(before)
    expect((await business.cases.read({ caseRef: encodeCaseRef(decision) }, call)).status).toBe("ok")
    expect(reads.coverage).toBe(before)
    expect(decision.alternatives[0]!.result).toMatchObject({ comparisonStatus: "conditioned", total: null,
      costCoverage: { coverageState: "pending" } })
    expect(decision.alternatives[0]!.result.components.find((item) => item.id === "line:2")?.amount).toBe(80)

    const wrongTarget = structuredClone(decision)
    wrongTarget.alternatives[0]!.scenario.operations[0]!.targetRef = "missing-line:2"
    expect(await access(wrongTarget, call)).toBe(false)
    const wrongCurrency = structuredClone(decision)
    wrongCurrency.alternatives[0]!.result.currency = "EUR"
    expect(await access(wrongCurrency, call)).toBe(false)
    const partialMonth = structuredClone(decision)
    partialMonth.alternatives[0]!.result.horizon = { start: "2026-01-02", end: "2026-12-31" }
    expect(await access(partialMonth, call)).toBe(false)
    const absentEvidence = structuredClone(decision)
    absentEvidence.sourceRefs = []
    absentEvidence.alternatives[0]!.result.sourceRefs = []
    absentEvidence.alternatives[0]!.result.costCoverage.evaluatedSourceRefs = []
    expect(await access(absentEvidence, call)).toBe(false)
    expect(reads.coverage).toBe(before)

    // A replacement keeps its real amount resolver and context checks. Its
    // producer still performs coverage work; only target selection avoids it.
    const replacements = await business.withCase(call, { id: decision.id, incarnation: decision.incarnation, version: decision.version }, {}, async () => {
      const operation = { kind: "replace" as const, targetRef: "line:2",
        replacementRef: plannerValueRef(decision.alternatives[0]!.scenario.baseRef, "line:2:forecast") }
      const scenario = { baseRef: decision.alternatives[0]!.scenario.baseRef, operations: [operation], assumptions: [] }
      const result = await business.planner.simulateScenario(scenario, call)
      expect(result.status).toBe("ok")
      if (result.status !== "ok") throw new Error(result.reason)
      const replacement: DecisionCase = { ...decision, alternatives: [{ id: "replacement", version: 1, title: "Actual amount reference", scenario, result: result.value }] }
      expect(await access(replacement, call)).toBe(true)
      for (const changed of [
        { ...operation, amount: 100 },
        { ...operation, currency: "EUR" },
        { ...operation, period: { start: "2026-03-01", end: "2026-03-31" } },
        { ...operation, replacementRef: plannerValueRef(scenario.baseRef, "missing-line:2:forecast") },
      ]) expect(await access({ ...replacement, alternatives: [{ ...replacement.alternatives[0]!, scenario: { ...scenario, operations: [changed] } }] }, call)).toBe(false)
      return { status: "ok", value: true }
    })
    expect(replacements).toEqual({ status: "ok", value: true })
  } finally { await deadline.close() }
}, 120_000)

for (const changed of ["planner", "dashboard", "procurement", "principal", "case-input"] as const) test(`stored scenario rejects ${changed} changes across the actual projection await`, async () => {
  const deadline = compositionTestDeadline(`scenario-operation-access-${changed}`)
  const during: { action?: () => Promise<void> } = {}
  try {
    const fixture = await scenarioFixture(deadline, async () => {
      const action = during.action
      delete during.action
      await action?.()
    })
    const before = fixture.reads.coverage
    during.action = changed === "principal" ? async () => { fixture.active.value = false }
      : changed === "case-input" ? async () => { fixture.decision.objective = "Changed while the projection was suspended" }
      : async () => { await fixture.persistence.transaction(changed, async (snapshot) => {
        snapshot.data.scenarioAccessRace = changed
        return { commit: true, value: undefined }
      }) }
    expect(await fixture.access(fixture.decision, fixture.call)).toBe(false)
    expect(during.action).toBeUndefined()
    expect(fixture.reads.coverage).toBe(before)
  } finally { await deadline.close() }
}, 120_000)

async function scenarioFixture(deadline: ReturnType<typeof compositionTestDeadline>, beforeEnvironment?: () => Promise<void>) {
  const fixture = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => {
    deadline.check()
    await beforeEnvironment?.()
    deadline.check()
  } })
  deadline.own(() => fixture.dispose())
  const call = await fixture.read()
  deadline.own(() => fixture.authority.ui.finish(call))
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const caseRef = { id: "selector-case", incarnation: "selector-incarnation", version: 1 }
  const initial: DecisionCase = { ...caseRef, state: "comparing", objective: "Authorize stored scenario selectors", horizon: period, currency: "USD",
    criteria: [], participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  await fixture.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [{ id: "v0", name: "Selector forecast", year: 2026, closed: 0,
      lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
    return { commit: true, value: undefined }
  })
  const seeded = await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
    idempotencyKey: "selector-case", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[caseRef.id] = initial
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("Selector case fixture unavailable")
  const reads = { coverage: 0 }
  fixture.business.bindForecastCoverage(async (reference, context) => {
    reads.coverage++
    const source = await fixture.business.plannerSources.resolveForecastSource(reference, context)
    if (source.status !== "ok") return source
    return { status: "ok", value: { coverageRef: "fixture:selector-pending-coverage", basis: { id: "selector-basis", version: 1,
      decisionType: "renewal-transition-v1", categoryIds: ["training"], additionalCategoryIds: [], sourceRefs: [source.value.evidence] },
      assessment: { basisId: "selector-basis", basisVersion: 1, alternativeId: "selector", alternativeVersion: 1, currency: "USD", horizon: period,
        issues: ["fixture-training-unresolved"], evaluatedSourceRefs: [source.value.evidence], coverageState: "pending",
        entries: [{ status: "pending", categoryId: "training", reason: "Fixture has no training evidence" }], derivedMissingCategoryIds: ["training"] } } }
  })
  const produced = await fixture.business.withCase(call, caseRef, {}, async () => {
    const source = await fixture.business.plannerProduct.issueSource("v0", call)
    if (source.status !== "ok") return source
    const scenario = { baseRef: source.value.evidence.refId, operations: [{ kind: "replace" as const, targetRef: "line:2", amount: 80,
      currency: "USD", period: { start: "2026-02-01", end: "2026-02-28" } }], assumptions: [] }
    const result = await fixture.business.planner.simulateScenario(scenario, call)
    if (result.status !== "ok") return result
    return { status: "ok", value: { ...initial, sourceRefs: [source.value.evidence],
      alternatives: [{ id: "selector", version: 1, title: "Produced alternative", scenario, result: result.value }] } }
  })
  if (produced.status !== "ok") throw new Error(produced.reason)
  const decision = produced.value
  const current = await fixture.authority.state.read(fixture.request(), "cases", (state) => state.cases[caseRef.id])
  if (current.status !== "ok") throw new Error("Selector case storage unavailable")
  const stored = await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
    targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "selector-alternative", commandDigest: digestSfValue(decision) }, async (state) => {
    state.cases[caseRef.id] = decision
    return { commit: true, value: true }
  })
  if (stored.status !== "ok") throw new Error("Produced selector alternative unavailable")
  const access = createSfScenarioOperationAccess({ host: fixture.authority.host, sources: fixture.business.plannerSources,
    projectPlanner: fixture.business.projectPlannerEvidence, scenarioInputs: fixture.business.plannerProduct.scenarioInputs,
    readSourceFences: fixture.business.readSourceFences, resolveProcurementEvidence: fixture.business.context.resolve,
    externalOperation: fixture.business.dashboardDecisions.resolveOperation })
  return { ...fixture, call, decision, reads, access }
}
