import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfPortfolioServices } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-services.ts"
import { createSfPortfolioCoverage } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-coverage.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, DecisionCase, ScenarioResult } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import { reassessScenarioCoverage } from "../../../../product/decisions/cost-coverage.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

test("C08 no-op coverage retains the private producer order and closes on revocation", async () => {
  const deadline = compositionTestDeadline("coverage-proof-order")
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-coverage-order-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(join(directory, "store"))
  deadline.own(() => store.dispose())
  const at = "2027-02-02T00:00:00Z", horizon = { start: "2027-01-01", end: "2027-12-31" }
  const control = { active: true }
  const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID,
    enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) }) }
  const request = () => new Request("https://example.test/planner", { method: "POST", signal: deadline.signal, headers: { origin: "https://example.test" } })
  const identity = { installationId: "coverage-installation", hostId: "host", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const writes = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId,
    origin: "https://example.test", policyVersion: "coverage-policy", persistence, proposalCoverageWrites: writes,
    grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
      operations: ["sf_scenario_simulate", "sf_evidence_get", "sf_forecast_compare"],
      humanActions: ["decisions.coverage", "decisions.promote-alternative"] }],
    authenticate: async (_request, scope) => control.active && scope ? { id: "person", canWrite: true,
      roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null,
    environment: async () => ({ at, id: randomUUID, directory: [] }), createId: randomUUID, now: Date.now,
    commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: writes })
  const portfolio = createSfPortfolioServices({ authority, business, proposalCoverageWrites: writes })
  deadline.own(() => { portfolio.dispose(); business.dispose() })
  const proof = createSfPortfolioCoverage({ authority, business,
    verifyIntent: (_snapshot, operation, payload, call) => operation === "add-alternative" &&
      portfolio.intent.verify(call, "decisions.promote-alternative", payload) })
  deadline.own(() => proof.dispose())
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data = { versions: [100, 80].map((amount, index) => ({ id: "v" + index, name: "Forecast " + index,
        year: 2027, closed: 0, lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })),
        officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
      return { commit: true, value: undefined }
    })
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
    const digest = digestSfValue({})
    const sourceCall = ok(await authority.ui.admit(request(), "sf_scenario_simulate", digest))
    deadline.own(() => authority.ui.finish(sourceCall))
    expect(await authority.ui.validate(sourceCall, "sf_scenario_simulate", digest)).toBe(true)
    const source = ok(await business.plannerProduct.issueSource("v0", sourceCall)).evidence
    const other = ok(await business.plannerProduct.issueSource("v1", sourceCall)).evidence
    const ref = { id: "coverage-case", incarnation: "coverage-inc", version: 1 }
    // The basis intentionally has the opposite order from the baseline producer's source-first assessment.
    const basis: CostCoverageBasis = { id: "basis", version: 1, decisionType: "renewal-transition-v1",
      categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [other, source] }
    const decision: DecisionCase = { ...ref, state: "comparing", objective: "Keep the observed coverage proof", horizon,
      currency: "USD", criteria: [], participants: ["person"], sourceRefs: basis.sourceRefs, alternatives: [],
      costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    expect((await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
      idempotencyKey: "seed", commandDigest: digestSfValue(decision) }, async (state) => {
      state.cases[ref.id] = decision
      return { commit: true, value: true }
    })).status).toBe("ok")
    const registration = { caseRef: ref, source, basis, entries: [], expectedVersion: 0 }
    const coverageCall = ok(await authority.human.admit(request(), "decisions.coverage", registration))
    let coverageRef: string
    try {
      coverageRef = ok(await business.withCase(coverageCall, ref, {}, () => business.baselineCoverage.register(registration, coverageCall))).coverageRef
    } finally { authority.human.finish(coverageCall) }
    const coverage = ok(await business.withCase(sourceCall, ref, {}, () => business.plannerSources.resolveForecastCoverage(coverageRef, sourceCall)))
    expect(coverage.assessment.evaluatedSourceRefs).toEqual([source, other])
    const scenario = { baseRef: source.refId, operations: [], assumptions: [] }
    const promotion = { caseRef: ref, title: "Original no-op", scenario, coverageRef }
    const promoteCall = ok(await authority.human.admit(request(), "decisions.promote-alternative", promotion))
    let currentRef: typeof ref
    try {
      currentRef = ok(await business.withCase(promoteCall, ref, {}, () => portfolio.mutations.addAlternative(promotion, promoteCall))).caseRef
    } finally { authority.human.finish(promoteCall) }
    const saved = await authority.state.read(request(), "cases", (state) => state.cases[ref.id])
    if (saved.status !== "ok" || !saved.value) throw new Error("Promoted case unavailable")
    expect(saved.value.alternatives).toHaveLength(1)
    const result = saved.value.alternatives[0]!.result
    expect(digestSfValue({ ...result.costCoverage, alternativeId: coverage.assessment.alternativeId,
      alternativeVersion: coverage.assessment.alternativeVersion })).toBe(digestSfValue(coverage.assessment))

    const selected = { ...promotion, caseRef: currentRef, title: "Proof probe" }
    const call = ok(await authority.human.admit(request(), "decisions.promote-alternative", selected))
    try {
      const observed = await business.withCase(call, currentRef, {}, () => proof.runPromotion(selected, call, async () => {
        expect(await portfolio.intent.authorize(call, "decisions.promote-alternative", selected)).toBe(true)
        expect(proof.remember(selected, call)).toBe(true)
        const alternativeId = proof.createMutationId()
        const simulated = await business.planner.simulateScenario(scenario, call)
        const prepared = ok(await proof.prepareNoop(scenario, simulated, call))
        if (prepared.comparisonStatus === "complete") throw new Error("The fixture has no complete classification")
        const attributed: ScenarioResult = { ...prepared, costCoverage: { ...prepared.costCoverage, alternativeId, alternativeVersion: 1 } }
        const entries = ok(await proof.evidence.entries(attributed, coverage.assessment, call))
        const resolved = await proof.evidence.resolve(basis.sourceRefs, call)
        expect(resolved.map((value) => value.ref)).toEqual(coverage.assessment.evaluatedSourceRefs)
        const reassessed = await reassessScenarioCoverage({ scenario: attributed, basis,
          baseline: { ...coverage.assessment, evaluatedSourceRefs: [...coverage.assessment.evaluatedSourceRefs].reverse() },
          entries, resolveEvidence: (refs) => proof.evidence.resolve(refs, call), supports: proof.evidence.supports })
        expect(reassessed).toEqual(attributed)
        const missing = await proof.evidence.resolve([source], call)
        const duplicates = await proof.evidence.resolve([source, source], call)
        expect(missing).toEqual([])
        expect(duplicates).toEqual([])
        return { status: "ok" as const, value: true }
      }))
      expect(observed).toEqual({ status: "ok", value: true })
      expect(await proof.evidence.resolve(basis.sourceRefs, call)).toEqual([])
      expect(proof.remember(selected, call)).toBe(true)
      expect(await business.withCase(call, currentRef, {}, () => proof.evidence.entries(result, coverage.assessment, call)))
        .toEqual({ status: "unavailable", reason: "promotion-coverage-authority-unavailable" })
    } finally { authority.human.finish(call) }

    const revokedCall = ok(await authority.human.admit(request(), "decisions.promote-alternative", selected))
    try {
      const revoked = await business.withCase(revokedCall, currentRef, {}, () => proof.runPromotion(selected, revokedCall, async () => {
        expect(await portfolio.intent.authorize(revokedCall, "decisions.promote-alternative", selected)).toBe(true)
        expect(proof.remember(selected, revokedCall)).toBe(true)
        const alternativeId = proof.createMutationId()
        const prepared = ok(await proof.prepareNoop(scenario, await business.planner.simulateScenario(scenario, revokedCall), revokedCall))
        if (prepared.comparisonStatus === "complete") throw new Error("The fixture has no complete classification")
        const attributed: ScenarioResult = { ...prepared, costCoverage: { ...prepared.costCoverage, alternativeId, alternativeVersion: 1 } }
        control.active = false
        return proof.evidence.entries(attributed, coverage.assessment, revokedCall)
      }))
      expect(revoked.status).not.toBe("ok")
    } finally { control.active = true; authority.human.finish(revokedCall) }
    const unchanged = await authority.state.read(request(), "cases", (state) => state.cases[ref.id])
    expect(unchanged.status === "ok" ? unchanged.value : undefined).toEqual(saved.value)
  } finally { await deadline.close() }
}, 120_000)

function ok<Value>(result: PortResult<Value>) {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}
