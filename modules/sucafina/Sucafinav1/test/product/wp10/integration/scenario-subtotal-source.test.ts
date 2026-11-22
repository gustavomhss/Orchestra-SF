import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfPortfolioServices } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-services.ts"
import { createSfBiServices } from "../../../../../../../apps/cli/src/sucafina-product/bi-services.ts"
import { sfDecisionBiSelection } from "../../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DomainProjection } from "../../../../product/contracts/context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { plannerScenarioBiPresentation } from "../../../../product/planner/scenario-bi.ts"
import { resolvePlannerScenarioBatch } from "../../../../product/planner/scenario-comparison-port.ts"
import type { ResolvedScenario } from "../../../../product/planner/scenario-comparison-port.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

test("BI known subtotals retain their proven primary source within an annual forecast", async () => {
  const deadline = compositionTestDeadline("scenario-subtotal-source")
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-subtotal-source-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(join(directory, "store"))
  deadline.own(() => store.dispose())
  const at = "2027-02-02T00:00:00Z", period = { start: "2027-02-01", end: "2027-02-28" }
  const control = { active: true }
  const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID,
    enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) }) }
  const request = () => new Request("https://example.test/planner", { method: "POST", signal: deadline.signal, headers: { origin: "https://example.test" } })
  const identity = { installationId: "subtotal-installation", hostId: "host", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const writes = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId,
    origin: "https://example.test", policyVersion: "subtotal-policy", persistence, proposalCoverageWrites: writes,
    grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
      operations: ["sf_scenario_simulate", "sf_scenario_compare", "sf_evidence_get", "sf_forecast_compare", "sf_bi_view"],
      humanActions: ["decisions.coverage", "decisions.promote-alternative"] }],
    authenticate: async (_request, scope) => control.active && scope ? { id: "person", canWrite: true,
      roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null,
    environment: async () => ({ at, id: randomUUID, directory: [] }), createId: randomUUID, now: Date.now,
    commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: writes })
  const portfolio = createSfPortfolioServices({ authority, business, proposalCoverageWrites: writes })
  const bi = createSfBiServices({ authority, business, portfolio })
  deadline.own(() => { portfolio.dispose(); business.dispose() })
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data = { versions: [100, 0].map((amount, index) => ({ id: "v" + index, name: "Forecast " + index,
        year: 2027, closed: 0, lines: [
          { id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
            b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) },
          { id: "unknown", name: "Unpriced", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
            b: Array(12).fill(null), a: Array(12).fill(null), f: Array(12).fill(null) },
        ], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })),
        officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
      return { commit: true, value: undefined }
    })
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
    const admissionDigest = digestSfValue({})
    const admitted = ok(await authority.ui.admit(request(), "sf_scenario_simulate", admissionDigest))
    deadline.own(() => authority.ui.finish(admitted))
    expect(await authority.ui.validate(admitted, "sf_scenario_simulate", admissionDigest)).toBe(true)
    const baseline = ok(await business.plannerProduct.issueSource("v0", admitted)).evidence
    const candidate = ok(await business.plannerProduct.issueSource("v1", admitted)).evidence
    expect(baseline.target.period).toEqual({ start: "2027-01-01", end: "2027-12-31" })
    let ref = { id: "subtotal-case", incarnation: "case-inc", version: 1 }
    const basis: CostCoverageBasis = { id: "basis", version: 1, decisionType: "renewal-transition-v1",
      categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [baseline, candidate] }
    const decision: DecisionCase = { ...ref, state: "comparing", objective: "Trace known monthly subtotals", horizon: period,
      currency: "USD", criteria: [], participants: ["person"], sourceRefs: basis.sourceRefs, alternatives: [],
      costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    expect((await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
      idempotencyKey: "seed", commandDigest: digestSfValue(decision) }, async (state) => {
      state.cases[ref.id] = decision
      return { commit: true, value: true }
    })).status).toBe("ok")
    const results: { reference: string }[] = []
    for (const [id, source] of [["baseline", baseline], ["candidate", candidate]] as const) {
      const registration = { caseRef: ref, source, basis, entries: [], expectedVersion: 0 }
      const coverageCall = ok(await authority.human.admit(request(), "decisions.coverage", registration))
      let coverageRef: string
      try {
        coverageRef = ok(await business.withCase(coverageCall, ref, {}, () => business.baselineCoverage.register(registration, coverageCall))).coverageRef
      } finally { authority.human.finish(coverageCall) }
      const scenario = { baseRef: source.refId, operations: [], assumptions: [] }
      const promotion = { caseRef: ref, title: id, scenario, coverageRef }
      const promoteCall = ok(await authority.human.admit(request(), "decisions.promote-alternative", promotion))
      try {
        const promoted = ok(await business.withCase(promoteCall, ref, {}, () => portfolio.mutations.addAlternative(promotion, promoteCall)))
        ref = promoted.caseRef
        if (!promoted.resultRef) throw new Error("Promotion did not persist its scenario")
        results.push({ reference: promoted.resultRef })
        const saved = ok(await business.withCase(admitted, ref, {}, () => business.results.read({ kind: "scenario", resultRef: promoted.resultRef! }, admitted)))
        if (saved.kind !== "scenario") throw new Error("Expected the actual promoted scenario")
        expect(saved.result.sourceRefs).toHaveLength(2)
        expect(saved.result.total).toBeNull()
        expect(saved.result.comparisonStatus).toBe("conditioned")
      } finally { authority.human.finish(promoteCall) }
    }
    const pairRequest = { scenarioRefs: results.map((value) => value.reference), criteria: [] }
    const comparison = ok(await business.withCase(admitted, ref, {}, () => business.planner.compareScenarios(pairRequest, admitted)))
    const stored = ok(await business.withCase(admitted, ref, {}, () => business.results.write({ kind: "comparison", result: comparison,
      caseRef: ref, requestDigest: digestSfValue(pairRequest), sourceRefs: basis.sourceRefs, idempotencyKey: "comparison" }, admitted)))
    const scenarios = business.plannerProduct.scenarios
    if (!scenarios) throw new Error("Canonical scenario reader unavailable")
    const resolved = ok(await business.withCase(admitted, ref, {}, async () => ({
      status: "ok" as const, value: await resolvePlannerScenarioBatch(scenarios, pairRequest.scenarioRefs, admitted),
    })))
    const pair = { baseline: ok(resolved[0]!), candidate: ok(resolved[1]!) }
    expect(pair.baseline.result.knownSubtotal).toBe(100)
    expect(pair.candidate.result.knownSubtotal).toBe(0)
    expect(pair.baseline.projection.context.period).toEqual(period)
    expect(pair.baseline.result.components[0]!.sourceRefs[0]!.period).toEqual(period)
    const selectionRef = sfDecisionBiSelection({ scenarioResultRef: results[1]!.reference, comparisonRef: stored.resultRef })
    for (const viewId of ["BI09", "BI10"] as const) {
      const payload = { viewId, selectionRef, period }
      const call = ok(await authority.ui.admit(request(), "sf_bi_view", digestSfValue(payload)))
      try {
        expect(await authority.ui.validate(call, "sf_bi_view", digestSfValue(payload))).toBe(true)
        const view = ok(await business.withCase(call, ref, {}, () => bi.readForReview(payload, call)))
        const before = view.projection.values.find((value) => value.id === "scenario:baseline-known-subtotal")!
        const after = view.projection.values.find((value) => value.id === "scenario:candidate-known-subtotal")!
        // Extra coverage evidence does not change the origin of these untransformed amounts.
        expect(before.drilldown).toEqual(baseline)
        expect(after.drilldown).toEqual(candidate)
        expect(before).toMatchObject({ value: 100, currency: "USD", period, sourceRefs: [...pair.baseline.result.sourceRefs] })
        expect(after).toMatchObject({ value: 0, currency: "USD", period, sourceRefs: [...pair.candidate.result.sourceRefs] })
        expect(view.projection.values.find((value) => value.id === "scenario:candidate-complete-total"))
          .toMatchObject({ value: null, drilldown: null })
        expect(view.projection.decision?.kind).toBe("scenario")
        expect(view.presentation.viewId).toBe(viewId)
      } finally { authority.ui.finish(call) }
    }
    const projection: DomainProjection = { ...pair.candidate.projection, decision: { kind: "scenario",
      scenarioResultRef: results[1]!.reference, scenario: pair.candidate.result, comparisonRef: stored.resultRef, comparison } }
    const foreign = pair.candidate.result.components[0]!.sourceRefs[0]!
    const variants: { name: string; change: (entry: ResolvedScenario) => ResolvedScenario }[] = [
      { name: "transformed", change: (entry) => changeFirst(entry, (component) => ({ ...component, evidenceState: "hypothetical" })) },
      { name: "changed amount", change: (entry) => changeFirst(entry, (component) => ({ ...component, amount: 101 })) },
      { name: "mixed sources", change: (entry) => changeFirst(entry, (component) => ({ ...component, sourceRefs: [...component.sourceRefs, foreign] })) },
      { name: "no component source", change: (entry) => changeFirst(entry, (component) => ({ ...component, sourceRefs: [] })) },
      { name: "changed version", change: (entry) => changeFirst(entry, (component) => ({ ...component,
        sourceRefs: component.sourceRefs.map((source) => ({ ...source, version: source.version + 1 })) })) },
      { name: "changed fields", change: (entry) => changeFirst(entry, (component) => ({ ...component,
        sourceRefs: component.sourceRefs.map((source) => ({ ...source, fields: ["other"] })) })) },
      { name: "unobserved period", change: (entry) => changeFirst(entry, (component) => ({ ...component,
        sourceRefs: component.sourceRefs.map((source) => ({ ...source, period: baseline.target.period! })) })) },
      { name: "missing primary evidence", change: (entry) => ({ ...entry, result: { ...entry.result, sourceRefs: [candidate] } }) },
      { name: "foreign owner", change: (entry) => ({ ...entry, source: { ...entry.source, projectId: "other" } }) },
      { name: "source excludes the observed month", change: (entry) => {
        const source = { ...entry.source, target: { ...entry.source.target, period: { start: "2027-01-01", end: "2027-01-31" } } }
        return { ...entry, source, result: { ...entry.result, sourceRefs: entry.result.sourceRefs.map((ref) => ref.refId === source.refId ? source : ref) } }
      } },
      { name: "null subtotal", change: (entry) => ({ ...entry, result: { ...entry.result, knownSubtotal: null, total: null, comparisonStatus: "conditioned" } }) },
      { name: "no priced component", change: (entry) => ({ ...entry, result: { ...entry.result,
        components: entry.result.components.map((component) => ({ ...component, amount: null, evidenceState: "absent" })) } }) },
    ]
    for (const variant of variants) {
      const changed = variant.change(structuredClone(pair.baseline))
      const view = ok(plannerScenarioBiPresentation(projection, { ...pair, baseline: changed }, "BI09"))
      const subtotal = view.projection.values.find((value) => value.id === "scenario:baseline-known-subtotal")!
      expect({ variant: variant.name, drilldown: subtotal.drilldown }).toEqual({ variant: variant.name, drilldown: null })
      expect(subtotal.sourceRefs).toEqual([...changed.result.sourceRefs])
    }
    const snapshot = digestSfValue(pair)
    const detached = ok(plannerScenarioBiPresentation(projection, pair, "BI10"))
    const origin = detached.projection.values.find((value) => value.id === "scenario:baseline-known-subtotal")!.drilldown
    if (origin?.kind !== "record") throw new Error("Expected a detached primary source")
    origin.target.fields = ["caller mutation"]
    expect(digestSfValue(pair)).toBe(snapshot)
    control.active = false
    const payload = { viewId: "BI09", selectionRef, period }
    expect((await business.withCase(admitted, ref, {}, () => bi.readForReview(payload, admitted))).status).not.toBe("ok")
  } finally { await deadline.close() }
}, 120_000)

function changeFirst(entry: ResolvedScenario,
  update: (component: DomainProjection["components"][number]) => DomainProjection["components"][number]): ResolvedScenario {
  return { ...entry, result: { ...entry.result, components: entry.result.components.map((component, index) => index === 0 ? update(component) : component) } }
}

function ok<Value>(result: PortResult<Value>) {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}
