import { expect } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfPortfolioServices } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-services.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, CostCoverageEntry, DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { SensitivityRequest } from "../../../../product/contracts/operations.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfStateResult } from "../../../../product/contracts/state.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { compositionTestDeadline } from "./composition-test-deadline.ts"

/** Current native composition: real C08, sources, human classification/promotion,
 * criterion, UI admission and sensitivity producer. Only the initial case is seeded. */
export async function sensitivityObservationFixture(deadline: ReturnType<typeof compositionTestDeadline>,
  assessment: "all" | "partial" | "pending" = "all", operator: "lte" | "eq" = "lte") {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-sensitivity-observation-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(join(directory, "store"))
  deadline.own(() => store.dispose())
  const at = "2027-02-02T00:00:00Z", period = { start: "2027-01-01", end: "2027-01-31" }
  const control = { active: true }
  const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID,
    enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) }) }
  const request = () => new Request("https://example.test/planner", { method: "POST", signal: deadline.signal,
    headers: { origin: "https://example.test" } })
  const identity = { installationId: "sensitivity-installation", hostId: "host", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const writes = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId,
    origin: "https://example.test", policyVersion: "sensitivity-policy", persistence, proposalCoverageWrites: writes,
    grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
      operations: ["sf_scenario_simulate", "sf_scenario_compare", "sf_evidence_get", "sf_forecast_compare", "sf_sensitivity_evaluate"],
      humanActions: ["decisions.coverage", "decisions.promote-alternative", "decisions.criteria"] }],
    authenticate: async (_request, scope) => control.active && scope ? { id: "person", canWrite: true,
      roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null,
    environment: async () => { deadline.check(); return { at, id: randomUUID, directory: [] } },
    createId: randomUUID, now: Date.now, commandIdentity: async () => randomUUID(),
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: writes })
  const portfolio = createSfPortfolioServices({ authority, business, proposalCoverageWrites: writes })
  deadline.own(() => { portfolio.dispose(); business.dispose() })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data = { versions: [100, 80].map((amount, index) => ({ id: "v" + index, name: "Forecast " + index,
      year: 2027, closed: 0, lines: [
        { id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) },
        { id: "other", name: "Support", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(20), a: Array(12).fill(null), f: Array(12).fill(20) },
      ], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })),
      officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
    return { commit: true, value: undefined }
  })
  business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
  const admissionDigest = digestSfValue({})
  const admitted = sensitivityOk(await authority.ui.admit(request(), "sf_scenario_simulate", admissionDigest))
  deadline.own(() => authority.ui.finish(admitted))
  expect(await authority.ui.validate(admitted, "sf_scenario_simulate", admissionDigest)).toBe(true)
  const baseline = sensitivityOk(await business.plannerProduct.issueSource("v0", admitted)).evidence
  const candidate = sensitivityOk(await business.plannerProduct.issueSource("v1", admitted)).evidence
  let ref = { id: "sensitivity-case", incarnation: "case-inc", version: 1 }
  const basis: CostCoverageBasis = { id: "basis", version: 1, decisionType: "renewal-transition-v1",
    categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [baseline, candidate] }
  const decision: DecisionCase = { ...ref, state: "comparing", objective: "Certify only classified known subtotals", horizon: period,
    currency: "USD", criteria: [{ id: "cost", description: "Known subtotal difference", required: true }], participants: ["person"],
    sourceRefs: basis.sourceRefs, alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [],
    choices: [], preparedChanges: [], receipts: [], ledger: [] }
  expect((await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
    idempotencyKey: "seed", commandDigest: digestSfValue(decision) }, async (state) => {
    state.cases[ref.id] = decision
    return { commit: true, value: true }
  })).status).toBe("ok")
  const references: string[] = []
  for (const [id, source] of [["baseline", baseline], ["candidate", candidate]] as const) {
    const projection = sensitivityOk(await business.withCase(admitted, ref, {}, () => business.planner.compareForecast({
      baseRef: source.refId, candidateRef: source.refId, period, currency: "USD",
    }, admitted))).baseline
    expect(projection.components.map((component) => component.id).sort()).toEqual(["line:1", "other:1"])
    const entries: CostCoverageEntry[] = [
      ...(assessment === "pending" ? [] : [{ status: "included" as const, categoryId: "service",
        componentRefs: projection.components.filter((component) => assessment === "all" || component.id === "line:1").map((component) => component.id),
        evidenceRefs: [source], scopeNote: "Human classification of the observed monthly service components." }]),
      { status: "pending", categoryId: "training", reason: "No training evidence supplied" },
    ]
    const registration = { caseRef: ref, source, basis, entries, expectedVersion: 0 }
    const coverageCall = sensitivityOk(await authority.human.admit(request(), "decisions.coverage", registration))
    let coverageRef: string
    try {
      const registered = sensitivityOk(await business.withCase(coverageCall, ref, {}, () => business.baselineCoverage.register(registration, coverageCall)))
      coverageRef = registered.coverageRef
      const observed = sensitivityOk(await business.withCase(coverageCall, ref, {}, () =>
        business.baselineCoverage.resolveForecastCoverage(coverageRef, coverageCall)))
      expect(observed.assessment.coverageState).toBe("pending")
      expect(observed.assessment.entries.filter((entry) => entry.status !== "pending")).toEqual(
        assessment === "pending" ? [] : [entries[0]!])
    } finally { authority.human.finish(coverageCall) }
    const scenario = { baseRef: source.refId, operations: [], assumptions: [] }
    const promotion = { caseRef: ref, title: id, scenario, coverageRef }
    const promoteCall = sensitivityOk(await authority.human.admit(request(), "decisions.promote-alternative", promotion))
    try {
      const promoted = sensitivityOk(await business.withCase(promoteCall, ref, {}, () => portfolio.mutations.addAlternative(promotion, promoteCall)))
      ref = promoted.caseRef
      if (!promoted.resultRef) throw new Error("Promotion did not persist its actual scenario")
      references.push(promoted.resultRef)
    } finally { authority.human.finish(promoteCall) }
  }
  const product = portfolio.product
  if (!product) throw new Error("Native Portfolio product unavailable")
  const units = sensitivityOk(await business.withCase(admitted, ref, {}, () => product.http.sensitivityUnits({
    caseRef: ref, scenarioRef: references[1]!, baselineRef: references[0]!, parameterRef: "line:1",
  }, admitted)))
  expect(units.parameterOperation).toMatchObject({ kind: "replace", targetRef: "line:1", amount: 80, currency: "USD" })
  const ruleInput = { caseRef: ref, criterionId: "cost", metricRef: "planner:known-subtotal-difference", operator,
    value: 0, unit: "USD", period, evidenceRefs: basis.sourceRefs, expectedRuleVersion: 0, sensitivity: units.units }
  const human = sensitivityOk(await authority.human.admit(request(), "decisions.criteria", ruleInput))
  try {
    sensitivityOk(await business.withCase(human, ref, {}, () => portfolio.rules.register(ruleInput, human)))
  } finally { authority.human.finish(human) }
  const input: SensitivityRequest = { scenarioRef: references[1]!,
    parameterBounds: { parameterRef: "line:1", minimum: 80, maximum: 120, steps: 1 },
    criterion: { id: "cost", operator, value: 0 } }
  const transport = request()
  const call = sensitivityOk(await authority.ui.admit(transport, "sf_sensitivity_evaluate", digestSfValue(input)))
  deadline.own(() => authority.ui.finish(call))
  expect(await authority.ui.validate(call, "sf_sensitivity_evaluate", digestSfValue(input))).toBe(true)
  return { authority, business, portfolio, product, persistence, writes, control, call, transport, caseRef: ref,
    sources: [baseline, candidate], input, references }
}

export function sensitivityOk<Value>(result: PortResult<Value> | SfStateResult<Value>): Value {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}
