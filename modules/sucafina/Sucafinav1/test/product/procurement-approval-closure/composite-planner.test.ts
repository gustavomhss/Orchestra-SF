import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CostCoverageBasis, DecisionCase } from "../../../product/contracts/decisions.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import { assessCostCoverage } from "../../../product/decisions/cost-coverage.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { createPlannerCapabilities } from "../../../product/planner/capabilities.ts"
import { comparePlannerScenarios } from "../../../product/planner/comparison.ts"
import { plannerScenarioDigest } from "../../../product/planner/preview-comparison.ts"
import { createProcurementReadonlySourceResolver } from "../../../product/procurement/scenario-producer.ts"
import { decisionAlternativesForm, decisionAlternativesScript } from "../../../product/ui/decision-alternatives.ts"
import { createSfProcurementCompositePlanner } from "../../../../../../apps/cli/src/sucafina-product/procurement-composite-planner.ts"
import { createSfScenarioOperationAccess } from "../../../../../../apps/cli/src/sucafina-product/scenario-operation-access.ts"
import { createSfPlannerEvidence } from "../../../../../../apps/cli/src/sucafina-product/planner-evidence.ts"
import { createScenarioFixture, scenarioPeriod } from "../procurement-decision-producer/fixture.ts"

// Complementary evidence only. The original mission52 helper/spec remains byte-for-byte unchanged.
// Synthetic source membership, real SQLite/Planner/Procurement/composition/UI authority; no approval is performed.
test("mixed original52 shape retains Planner 2400, difference 1200 and an unresolved external Procurement operation without writes", async () => {
  const fixture = await createCompositeFixture()
  try {
    const before = await fixture.snapshots(), writes = fixture.writes.length
    const proposal = fixture.proposal(140)
    const base = await fixture.raw.simulateScenario({ baseRef: "baseline", operations: [], assumptions: [] }, fixture.context)
    const result = await fixture.composite.planner.simulateScenario(proposal, fixture.context)
    expect(base.status).toBe("ok")
    expect(result.status).toBe("ok")
    if (base.status !== "ok" || result.status !== "ok") throw new Error(`Real composed producer failed: ${JSON.stringify({ base, result })}`)
    expect(base.value.knownSubtotal).toBe(1200)
    expect(result.value).toMatchObject({ knownSubtotal: 2400, total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending" } })
    expect(result.value.sourceRefs).toContainEqual(fixture.evidence)
    expect(result.value.components.some((component) => component.sourceRefs.some((ref) => ref.surface === "procurement"))).toBe(false)
    expect(result.value.unresolvedConditions).toContain(`external-operation:${digestSfValue(proposal.operations[0])}:procurement-replacement-cost-unresolved`)
    const comparison = comparePlannerScenarios({ baselineRef: "baseline-result", alternativeRef: "mixed-result", baselineCoverageRef: "coverage:baseline", alternativeCoverageRef: "coverage:candidate", baseline: base.value, alternative: result.value })
    expect(comparison).toMatchObject({ comparisonStatus: "conditioned", knownDifference: 1200, completeDifference: null })
    expect(comparison.unresolvedConditions).toContain(`external-operation:${digestSfValue(proposal.operations[0])}:procurement-replacement-cost-unresolved`)
    expect(await fixture.snapshots()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)

    fixture.clock.at = "2026-11-14T12:00:01Z"
    const repeated = await fixture.composite.planner.simulateScenario(proposal, fixture.context)
    expect(repeated.status).toBe("ok")
    if (repeated.status !== "ok") throw new Error("Repeated readonly composition failed")
    expect(repeated.value.id).toBe(result.value.id)
    expect(plannerScenarioDigest(repeated.value)).toBe(plannerScenarioDigest(result.value))
    expect(await fixture.snapshots()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)

    const mutable = fixture.proposal(140)
    const pending = fixture.composite.planner.simulateScenario(mutable, fixture.context)
    mutable.operations[0]!.amount = 999
    const captured = await pending
    expect(captured.status).toBe("ok")
    if (captured.status !== "ok") throw new Error("Captured mixed request unavailable")
    expect(plannerScenarioDigest(captured.value)).toBe(plannerScenarioDigest(result.value))
    expect(await fixture.snapshots()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)
  } finally { await fixture.dispose() }
})

test("mixed capability is transient and current case guards authorize the explicit external selector", async () => {
  const fixture = await createCompositeFixture()
  try {
    const proposal = fixture.proposal(140), digest = digestSfValue(proposal)
    const transport = new Request("https://scenario.invalid/procurement", { headers: { authorization: "Bearer alice" } })
    const admitted = await fixture.ui.admit(transport, "sf_scenario_simulate", digest)
    if (admitted.status !== "ok" || !await fixture.ui.validate(admitted.value, "sf_scenario_simulate", digest)) throw new Error("Real UI admission unavailable")
    let persisted = 0
    const descriptors = createPlannerCapabilities(fixture.composite.planner, (call, operation, inputDigest, outputDigest) => call.kind === "ui" ? fixture.ui.receiptFor(call, operation, inputDigest, outputDigest) : undefined,
      async () => { persisted++; throw new Error("Mixed preview attempted to publish a result") }, { readOnlyScenario: fixture.composite.supports })
    const descriptor = descriptors.find((entry) => entry.id === "sf_scenario_simulate")
    if (!descriptor) throw new Error("Scenario descriptor missing")
    const before = await fixture.snapshots(), writes = fixture.writes.length
    const preview = await descriptor.handler(proposal, admitted.value)
    expect(preview.status).toBe("ok")
    expect(Object.hasOwn(preview, "outputRef")).toBe(false)
    expect(persisted).toBe(0)
    const scenario = await fixture.composite.planner.simulateScenario(proposal, fixture.context)
    if (scenario.status !== "ok") throw new Error("Mixed scenario unavailable")
    const decision: DecisionCase = { ...fixture.decision, alternatives: [{ id: "mixed", version: 1, title: "Human proposal", scenario: proposal, result: scenario.value }] }
    expect(await fixture.guard(decision, fixture.context)).toBe(true)
    // The protected recorded alternative retains its exact source when top-level attachments move on.
    expect(await fixture.guard({ ...decision, sourceRefs: fixture.plannerRefs }, fixture.context)).toBe(true)
    const changed = structuredClone(decision)
    changed.alternatives[0]!.scenario.operations[0]!.amount = 100
    expect(await fixture.guard(changed, fixture.context)).toBe(false)
    const missing = structuredClone(decision)
    missing.alternatives[0]!.result.sourceRefs = missing.alternatives[0]!.result.sourceRefs.filter((ref) => ref.refId !== fixture.sourceRef)
    expect(await fixture.guard(missing, fixture.context)).toBe(false)
    expect(await fixture.snapshots()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)
    fixture.ui.finish(admitted.value)
  } finally { await fixture.dispose() }
})

test("mixed preview rejects another holder, unbound currency, duplicated targets and stale Procurement source without writes", async () => {
  const fixture = await createCompositeFixture()
  try {
    const before = await fixture.snapshots(), writes = fixture.writes.length
    const foreign = await fixture.admit("bob")
    expect((await fixture.composite.planner.simulateScenario(fixture.proposal(140), foreign.context)).status).toBe("denied")
    fixture.ui.finish(foreign.context)
    const currency = fixture.proposal(140)
    currency.operations[0]!.currency = "EUR"
    expect(await fixture.composite.planner.simulateScenario(currency, fixture.context)).toMatchObject({ status: "needs-input", reason: "explicit-composite-requisition-amount-required" })
    const duplicate = fixture.proposal(140)
    duplicate.operations = [...duplicate.operations, structuredClone(duplicate.operations[0]!)]
    expect(await fixture.composite.planner.simulateScenario(duplicate, fixture.context)).toMatchObject({ status: "needs-input", reason: "duplicate-composite-procurement-target" })
    expect(await fixture.snapshots()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)
    const current = await fixture.snapshot()
    expect((await fixture.execute(fixture.requester, { page: "Requests", action: "save", id: fixture.requestId, version: current.versions[`requests:${fixture.requestId}`]!.version, values: { pr: { estAmount: 120 } } })).ok).toBe(true)
    const after = await fixture.snapshots(), afterWrites = fixture.writes.length
    expect(await fixture.composite.planner.simulateScenario(fixture.proposal(140), fixture.context)).toMatchObject({ status: "stale", reason: "composite-procurement-source-changed" })
    expect(await fixture.snapshots()).toEqual(after)
    expect(fixture.writes).toHaveLength(afterWrites)
  } finally { await fixture.dispose() }
})

test("mixed form offers explicit request and amount controls only for attached Procurement evidence", async () => {
  const fixture = await createCompositeFixture()
  try {
    const binding = fixture.context.binding
    if (fixture.decision.preparedChanges.length || fixture.decision.receipts.length) throw new Error("Unexecuted form fixture must have no committed effects")
    const projection: AuthorizedCaseProjection = { context: { kind: "ui", installationId: binding.installationId, projectId: binding.projectId, principalRef: binding.principalRef, accessRevision: binding.accessRevision, policyVersion: binding.policyVersion }, case: { ...fixture.decision, preparedChanges: [], receipts: [] }, events: [], evidenceRefs: fixture.decision.sourceRefs, checkedAt: fixture.clock.at }
    const before = structuredClone(projection)
    const html = decisionAlternativesForm(projection)
    expect(html).toContain('Procurement request<select name="procurement-request" disabled')
    expect(html).toContain('Proposed estimated amount<input name="procurement-proposed-amount" type="number" min="0" step="any" disabled')
    expect(html).toContain("does not save or submit the requisition or grant financial approval")
    expect(decisionAlternativesForm({ ...projection, case: { ...projection.case, sourceRefs: fixture.plannerRefs } })).not.toContain('name="procurement-proposed-amount"')
    expect(projection).toEqual(before)
    // Parse in Actions only. This file is delivered inert and is never executed locally.
    expect(() => new Bun.Transpiler({ loader: "js" }).transformSync(decisionAlternativesScript)).not.toThrow()
  } finally { await fixture.dispose() }
})

async function createCompositeFixture() {
  const fixture = await createScenarioFixture()
  try {
    const host: DomainPortHost = { ...fixture.host, authenticate: async (request, scope) => {
      const principal = await fixture.host.authenticate(request, scope)
      return principal ? { ...principal, roles: [...principal.roles, { surface: "planner", role: "finance" }] } : null
    } }
    const reader = { id: "alice", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
    const plannerSnapshot = await fixture.persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [100, 200].map((amount, index) => ({ id: index ? "candidate" : "baseline", year: 2026, closed: 0,
        lines: [{ id: "service", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
      return { commit: true, value: structuredClone(snapshot) }
    })
    const plannerRefs = ["baseline", "candidate"].map((id): Extract<BusinessEvidenceRef, { kind: "record" }> => {
      const projection = projectPlannerSource(plannerSnapshot, reader, id)
      if (!projection) throw new Error("Real Planner projection unavailable")
      const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: id, installationId: fixture.context.binding.installationId, projectId: fixture.context.binding.projectId, refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: id, incarnation: `fixture-${id}`, version: 1, fields: Object.keys(projection), period: scenarioPeriod, projectionDigest: digestSfValue({ versionId: id, projection }) } }
      return { ...ref, refDigest: digestSfEvidenceRef(ref) }
    })
    const basis: CostCoverageBasis = { id: "fixture-cost-inventory", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: plannerRefs }
    const sources: PlannerSourceHost = {
      resolveForecastSource: async (reference, call) => {
        const ref = plannerRefs.find((value) => value.refId === reference)
        const projection = ref ? await fixture.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: projectPlannerSource(snapshot, reader, reference) })) : undefined
        return ref && projection && await host.revalidate(call) && digestSfValue({ versionId: reference, projection }) === ref.target.projectionDigest
          ? { status: "ok", value: { versionId: reference, evidence: ref } } : { status: "stale", reason: "fixture-planner-source-changed" }
      },
      resolveForecastCoverage: async (reference, call) => {
        const source = await sources.resolveForecastSource(reference, call)
        if (source.status !== "ok") return source
        return { status: "ok", value: { coverageRef: `coverage:${reference}`, basis, assessment: assessCostCoverage({ basis, alternativeId: reference, alternativeVersion: 1, currency: "USD", horizon: scenarioPeriod,
          entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ categoryId, status: "pending", reason: "human-review-pending" })), components: [],
          evidence: plannerRefs.map((ref) => ({ state: "fresh", ref, accessRevision: call.binding.accessRevision, checkedAt: fixture.clock.at })), supports: () => false }) } }
      },
    }
    const caseRef = { id: "fixture-composite-case", incarnation: "fixture-case-incarnation", version: 1 }
    const decision: DecisionCase = { ...caseRef, state: "draft", objective: "Planner alternatives plus explicit Procurement operation", currency: "USD", horizon: scenarioPeriod, criteria: [], participants: ["alice"], sourceRefs: [...plannerRefs, fixture.evidence], alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const state = createSfProductState({ persistence: fixture.persistence, createId: randomUUID, resolveTarget: async () => ({ incarnation: caseRef.incarnation }), authorize: async (request) => {
      const actor = await host.authenticate(request)
      return actor ? { principalRef: actor.id, accessRevision: "access-1", policyVersion: "policy-1" } : undefined
    } })
    const saved = await state.transaction(fixture.request, { namespace: "cases", expectedStorageVersion: 0, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "seed-composite", commandDigest: digestSfValue(decision) }, async (current) => { current.cases[caseRef.id] = structuredClone(decision); return { commit: true, value: true } })
    if (saved.status !== "ok") throw new Error("Synthetic case membership unavailable")
    const snapshots = () => Promise.all((["dashboard", "planner", "procurement"] as const).map((surface) => fixture.persistence.transaction(surface, async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))))
    const readSourceFences = async () => digestSfValue(await snapshots())
    const raw = createPlannerPort({ host, sources })
    const composite = createSfProcurementCompositePlanner({ host, state, planner: raw, selectedCase: async () => ({ status: "ok", value: caseRef }), readSourceFences })
    const readonly = createProcurementReadonlySourceResolver({ host })
    const resolve: BusinessContextService["resolve"] = async (ref, call) => {
      const source = await readonly.resolveSource(ref.refId, call), projection = await readonly.readProjection(ref.refId, call)
      return source.status === "ok" && projection.status === "ok" && digestSfValue(source.value.evidence) === digestSfValue(ref)
        ? { state: "fresh", ref, currentRef: source.value.evidence, authorizedProjection: projection.value, accessRevision: call.binding.accessRevision, checkedAt: fixture.clock.at }
        : { state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: fixture.clock.at }
    }
    const unused = async (): Promise<never> => { throw new Error("Unexpected replacement or external-domain resolver") }
    const guard = createSfScenarioOperationAccess({ host, sources, projectPlanner: createSfPlannerEvidence({ host, sources }), scenarioInputs: { resolveAmount: unused, verifyAssumption: unused }, readSourceFences, resolveProcurementEvidence: resolve, externalOperation: unused })
    const proposal = (amount: number): ScenarioRequest => ({ baseRef: "candidate", operations: [{ kind: "replace", targetRef: fixture.sourceRef, amount, currency: "USD", period: scenarioPeriod }], assumptions: [] })
    return { ...fixture, raw, composite, snapshots, guard, proposal, decision, plannerRefs }
  } catch (error) { await fixture.dispose(); throw error }
}
