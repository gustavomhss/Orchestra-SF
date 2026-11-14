import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase, ScenarioResult } from "../../../../product/contracts/decisions.ts"
import type { SfProductState, SfStateAuthority, SfStateNamespace } from "../../../../product/contracts/state.ts"
import { object } from "../../../../runtime/contract.ts"
import { domain } from "../../../../runtime/procurement.ts"
import { initialProcurementSettings } from "../../../../src/initial-settings.ts"
import { createChoiceSnapshot } from "../../../../product/decisions/choice.ts"
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

// These are explicit stored-choice fixtures with pending coverage, not native
// execution or human promotion. C08, SQLite, source issuance, BCS, the original
// archive and both canonical observations are the production implementations.
test("fresh Procurement duplicates retain two canonical observations per guard and recompute on every case read", async () => {
  const deadline = compositionTestDeadline("procurement-scenario-proof")
  try {
    const fixture = await procurementScenarioFixture(deadline)
    for (let attempt = 0; attempt < 2; attempt++) {
      fixture.reset()
      expect((await fixture.read()).status).toBe("ok")
      expect(fixture.counts).toMatchObject({ scenario: 4, context: 2, fences: 8 })
      console.info("SF_SCENARIO_PROOF_COUNTS", JSON.stringify({ attempt, ...fixture.counts }))
    }
    // Whole scenario/result identity matters; a similar target is insufficient.
    for (const changed of ["operation", "result", "coverage", "refs"] as const) {
      const value = structuredClone(fixture.decision)
      const choice = value.choices[0]!
      if (changed === "operation") choice.scenario.operations[0]!.amount = 151
      if (changed === "result") choice.result.knownSubtotal = 151
      if (changed === "coverage") choice.result.costCoverage.issues = [...choice.result.costCoverage.issues, "Different explicit pending coverage"]
      if (changed === "refs") choice.result.sourceRefs = [...choice.result.sourceRefs, fixture.original]
      await fixture.save(value, changed)
      fixture.reset()
      expect((await fixture.read()).status).toBe("ok")
      expect(fixture.counts).toMatchObject({ scenario: 8, context: 2, fences: 0 })
    }
  } finally { await deadline.close() }
}, 120_000)

test("historical Procurement duplicates keep both independent canonical entry observations", async () => {
  const deadline = compositionTestDeadline("procurement-scenario-history")
  try {
    const fixture = await procurementScenarioFixture(deadline)
    await fixture.edit(175)
    expect((await fixture.business.context.resolve(fixture.original, fixture.call)).state).toBe("historical")
    fixture.reset()
    expect((await fixture.read()).status).toBe("ok")
    expect(fixture.counts).toMatchObject({ scenario: 8, context: 2, fences: 0 })
  } finally { await deadline.close() }
}, 120_000)

for (const changed of ["source", "capture", "receipt", "preferences", "case", "principal", "period", "clock", "headers", "lease"] as const)
test(`fresh Procurement duplicate proof rejects ${changed} change after its canonical double observation`, async () => {
  const deadline = compositionTestDeadline(`procurement-scenario-${changed}`)
  try {
    const fixture = await procurementScenarioFixture(deadline)
    expect((await fixture.read()).status).toBe("ok")
    fixture.reset()
    let altered = false
    fixture.interleave.after = { fence: 2, work: async () => {
      expect(fixture.counts.scenario).toBe(2)
      expect(fixture.authority.host.requestFor(fixture.call)).toBe(fixture.sourceRequest)
      expect(fixture.sourceRequest.signal.aborted).toBe(false)
      if (changed === "source") await fixture.edit(175)
      if (["capture", "receipt", "preferences", "case"].includes(changed)) await fixture.persistence.transaction("dashboard", async (snapshot) => {
        const state = object(snapshot.data.__sfProductV1)
        const versions = digestSfValue({ revision: state.revision, versions: state.versions })
        if (changed === "capture") {
          const archived = Object.values(object(state.preferences)).find((value) => object(value).schema === "sf-procurement-evidence-v1")
          if (!archived) throw new Error("Actual protected Procurement archive absent")
          object(archived).projection = { damaged: true }
        }
        if (changed === "receipt") object(state.receipts)["corrupted-fixture-receipt"] = { corrupted: true }
        if (changed === "preferences") object(state.preferences)["changed-proof-preference"] = { changed: true }
        if (changed === "case") object(object(state.cases)[fixture.decision.id]).objective = "Changed without a version bump"
        // Fault injection deliberately preserves C08 version counters. Only a
        // complete protected-state witness can see these byte changes.
        expect(digestSfValue({ revision: state.revision, versions: state.versions })).toBe(versions)
        return { commit: true, value: undefined }
      })
      if (changed === "principal") fixture.active.value = false
      if (changed === "period") expect((await fixture.business.procurementSelections.create(fixture.call,
        { start: "2026-02-01", end: "2026-02-28" })).status).toBe("ok")
      if (changed === "clock") fixture.clock.at = "2026-11-15T00:00:00Z"
      if (changed === "headers") fixture.sourceRequest.headers.set("x-operation", "replaced-request-intent")
      if (changed === "lease") fixture.authority.ui.finish(fixture.call)
      altered = true
    } }
    expect((await fixture.read()).status).not.toBe("ok")
    expect(altered).toBe(true)
  } finally { await deadline.close() }
}, 120_000)

test("fresh Procurement proofs do not cross overlapping invocations or survive final Request header replacement", async () => {
  const deadline = compositionTestDeadline("procurement-scenario-isolation")
  try {
    const fixture = await procurementScenarioFixture(deadline)
    expect((await fixture.read()).status).toBe("ok")
    fixture.reset()
    const overlap = await Promise.all([fixture.read(), fixture.read()])
    expect(overlap.every((result) => result.status === "ok")).toBe(true)
    expect(fixture.counts).toMatchObject({ scenario: 8, context: 4, fences: 16 })
    fixture.reset()
    let replaced = false
    // The fourth fence is the first guard's final C08 read. The host's test
    // authenticator ignores this header; only the synchronous Request pin
    // rejects its mutation after the final protected await.
    fixture.interleave.after = { fence: 4, work: async () => {
      expect(fixture.counts.scenario).toBe(2)
      fixture.sourceRequest.headers.set("x-operation", "replaced-at-final-egress")
      replaced = true
    } }
    expect((await fixture.read()).status).not.toBe("ok")
    expect(replaced).toBe(true)
  } finally { await deadline.close() }
}, 120_000)

async function procurementScenarioFixture(deadline: ReturnType<typeof compositionTestDeadline>) {
  const fixture = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() })
  deadline.own(() => fixture.dispose())
  const call = await fixture.read()
  deadline.own(() => fixture.authority.ui.finish(call))
  const sourceRequest = fixture.authority.host.requestFor(call)
  if (!sourceRequest) throw new Error("Actual UI Request absent")
  const period = { start: "2026-01-01", end: "2026-12-31" }
  await fixture.persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = { requests: { "PR-PROOF": { request: { number: "PR-PROOF", createdBy: "person", status: "draft",
      pr: { title: "Stored Procurement proof", justification: "Explicit choice fixture", estAmount: 100 }, history: [], attachments: [] }, version: 0, by: "person" } },
      suppliers: [], settings: initialProcurementSettings(), issued: { pr: ["PR-PROOF"], po: [] } }
    snapshot.versions["requests:PR-PROOF"] = { version: 0, by: "person" }
    return { commit: true, value: undefined }
  })
  expect((await fixture.business.procurementSelections.create(call, period)).status).toBe("ok")
  const issued = await fixture.business.individual.issue("procurement-request", "PR-PROOF", call)
  if (issued.status !== "ok") throw new Error(issued.reason)
  const resolved = await fixture.business.individual.resolve(issued.value, call)
  if (resolved.status !== "ok") throw new Error(resolved.reason)
  const original = resolved.value.evidence
  const caseRef = { id: "procurement-proof-case", incarnation: "procurement-proof-incarnation", version: 1 }
  const operation = { kind: "replace" as const, targetRef: original.refId, amount: 150, currency: "USD", period }
  const result: ScenarioResult = { id: "pending-result", version: 1, currency: "USD", horizon: period, components: [], sourceRefs: [original],
    unresolvedConditions: ["Explicit upstream pending coverage"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 150, total: null,
    costCoverage: { basisId: "pending-basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period,
      issues: ["Coverage pending"], evaluatedSourceRefs: [original], coverageState: "pending", entries: [{ status: "pending", categoryId: "purchase", reason: "No complete cost assertion" }], derivedMissingCategoryIds: ["purchase"] } }
  const initial: DecisionCase = { ...caseRef, state: "chosen", objective: "Authorize duplicate fresh Procurement scenarios", horizon: period, currency: "USD",
    participants: ["person"], criteria: [{ id: "cost", description: "Cost impact", required: true }], sourceRefs: [original], assumptions: [], questions: [],
    alternatives: [{ id: "alternative", version: 1, title: "Explicit replacement", scenario: { baseRef: original.refId, operations: [operation], assumptions: [] }, result }],
    costCoverageBases: [{ id: "pending-basis", version: 1, decisionType: "requisition", categoryIds: ["purchase"], additionalCategoryIds: [], sourceRefs: [original] }],
    choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const choice = createChoiceSnapshot({ case: initial, alternativeId: "alternative", alternativeVersion: 1,
    comparison: { baselineResultRef: "upstream-baseline", alternativeResultRef: result.id, costCoverageRefs: [], criterionResults: [], unresolvedConditions: result.unresolvedConditions,
      comparisonStatus: "conditioned", knownDifference: 50, completeDifference: null }, criteria: ["cost"], values: [], evidenceRefs: [original],
    id: "upstream-choice", principalRef: "person", reason: "Explicit stored-choice fixture", at: fixture.at })
  if (choice.status !== "ok") throw new Error(choice.reason)
  const decision: DecisionCase = { ...initial, choices: [choice.choice] }
  const seed = await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
    idempotencyKey: "procurement-proof-seed", commandDigest: digestSfValue(decision) }, async (state) => {
    state.cases[caseRef.id] = decision
    return { commit: true, value: true }
  })
  expect(seed.status).toBe("ok")
  const preparation = await fixture.authority.human.admit(fixture.request(), "decisions.prepare-changes", { caseRef, choiceId: choice.choice.id, operations: [operation] })
  if (preparation.status !== "ok") throw new Error(preparation.reason)
  try { expect((await fixture.business.procurementDecisions.prepareDomainCommands(caseRef, choice.choice.id, [operation], preparation.value)).status).toBe("ok") }
  finally { fixture.authority.human.finish(preparation.value) }
  const counts = { scenario: 0, context: 0, fences: 0 }
  const interleave: { after?: { fence: number; work: () => Promise<void> } } = {}
  const evidence = fixture.business.evidence.current
  if (!evidence) throw new Error("Actual composed BCS absent")
  const resolve = evidence.resolve, context = evidence.context
  evidence.resolve = async (ref, trusted) => { counts.scenario++; return resolve(ref, trusted) }
  evidence.context = async (request, trusted) => { counts.context += request.refs.length; return context(request, trusted) }
  const readState = fixture.authority.state.read
  fixture.authority.state.read = async <Value>(request: Request, namespace: SfStateNamespace,
    read: (state: Readonly<SfProductState>, actor: SfStateAuthority) => Value | Promise<Value>) => {
    const found = await readState(request, namespace, read)
    if (found.status === "ok" && object(found.value).kind === "sf-scenario-procurement-fence") {
      counts.fences++
      const action = interleave.after
      if (action?.fence === counts.fences) { interleave.after = undefined; await action.work() }
    }
    return found
  }
  const edit = async (amount: number) => {
    const changed = await fixture.persistence.transaction("procurement", async (snapshot) => {
      const outcome = domain.execute(snapshot, { id: "person", canWrite: true, roles: ["admin"], assigned: [], domains: [] },
        { page: "Requests", action: "save", id: "PR-PROOF", version: snapshot.versions["requests:PR-PROOF"]?.version ?? 0,
          values: { pr: { estAmount: amount } } }, await fixture.authority.host.environment(fixture.request()))
      return { commit: outcome.ok, value: outcome }
    })
    if (!changed.ok) throw new Error(`Actual Procurement edit failed: ${changed.status}`)
  }
  const save = async (value: DecisionCase, key: string) => {
    const current = await fixture.authority.state.read(fixture.request(), "cases", () => null)
    if (current.status !== "ok") throw new Error("Actual case storage unavailable")
    const changed = await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
      targetRef: encodeCaseRef(caseRef), targetIncarnation: caseRef.incarnation, idempotencyKey: `proof-${key}`, commandDigest: digestSfValue(value) }, async (state) => {
      state.cases[caseRef.id] = value
      return { commit: true, value: true }
    })
    expect(changed.status).toBe("ok")
  }
  return { ...fixture, call, sourceRequest, decision, original, counts, interleave, edit, save,
    reset: () => { counts.scenario = 0; counts.context = 0; counts.fences = 0 },
    read: () => fixture.business.cases.read({ caseRef: encodeCaseRef(caseRef) }, call) }
}
