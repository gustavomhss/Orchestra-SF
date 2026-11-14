import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfDecisionDomainServices } from "../../../../../../../apps/cli/src/sucafina-product/decision-domain-services.ts"
import { createSfDecisionPlannerActors } from "../../../../../../../apps/cli/src/sucafina-product/decision-baseline-services.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { BaselineCoverageRequest } from "../../../../product/decisions/baseline-coverage.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"

// Real SQLite, C08, authority and domain factories. These checks do not execute a native model.
async function fixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-decision-domain-"))
  const driver = await openLocalStore(path.join(directory, "store"))
  const persistence = { ...driver, ...createSfSourcePersistence({ persistence: driver, createId: randomUUID, enumerate: enumerateSfSources,
    projectScope: createSfSourceScopeProjector(() => "2026-11-14T00:00:00Z") }) }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  const actor = { active: true, canWrite: true }
  const proposalCoverageWrites = new WeakSet<object>()
  const signalRegistryWrites = new WeakSet<object>()
  const identity = { installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test", policyVersion: "policy", persistence,
    grants: [{ principalRef: "person", namespaces: ["cases", "preferences"], operations: ["sf_forecast_compare", "sf_sensitivity_evaluate", "sf_portfolio_evaluate", "sf_alternative_draft", "sf_change_prepare"],
      humanActions: ["decisions.coverage", "decisions.criteria", "decisions.select-portfolio", "decisions.condition.record", "decisions.prepare-changes"] }],
    proposalCoverageWrites, signalRegistryWrites, now: Date.now, createId: randomUUID,
    authenticate: async (_request, scope) => actor.active && scope ? { id: "person", canWrite: actor.canWrite, roles: [{ surface: scope.surface, role: actor.canWrite ? "admin" : "viewer" }] } : null,
    environment: async () => ({ at: "2026-11-14T00:00:00Z", id: randomUUID, directory: [] }), commandIdentity: async (_request, operation, digest) => `${operation}:${digest}`,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const request = new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test" } })
  const caseRef = { id: "case", incarnation: "case-inc", version: 1 }
  const seeded = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref,
    targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "seed-domain-case", commandDigest: digestSfValue(caseRef) }, async (state) => {
    state.cases.case = { ...caseRef, state: "draft", objective: "Explicit selection", horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD",
      criteria: [{ id: "cost", description: "Known subtotal difference", required: true }], participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [],
      assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("Domain fixture could not initialize C08")
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites })
  const domain = createSfDecisionDomainServices({ authority, business, baseline: business.baselineCoverage, proposalCoverageWrites, signalRegistryWrites, selectedCase: business.selectedCase })
  business.bindDecisionDomain(domain)
  const readCall = async () => {
    const admitted = await authority.ui.admit(request, "sf_forecast_compare", digestSfValue({ caseRef }))
    if (admitted.status !== "ok") throw new Error("Real UI read admission unavailable")
    return admitted.value
  }
  const close = async () => { domain.dispose(); business.dispose(); await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
  return { actor, authority, persistence, request, caseRef, business, domain, readCall, close }
}

test("real decision composition mounts four unique descriptors and keeps missing facts unavailable", async () => {
  const state = await fixture()
  try {
    expect(state.domain.descriptors.map((value) => value.id).sort()).toEqual(["sf_alternative_draft", "sf_change_prepare", "sf_portfolio_evaluate", "sf_sensitivity_evaluate"])
    expect(new Set([...state.business.descriptors, ...state.domain.descriptors].map((value) => value.id)).size).toBe(state.business.descriptors.length + state.domain.descriptors.length)
    const call = await state.readCall()
    expect((await state.business.selectedCase(call)).status).toBe("unavailable")
    const checked = await state.business.withCase(call, state.caseRef, {}, async () => {
      expect(await state.business.selectedCase(call)).toEqual({ status: "ok", value: state.caseRef })
      expect(await state.domain.criteria.resolve({ caseRef: state.caseRef, criterionId: "cost" }, call)).toEqual({ status: "needs-input", reason: "criterion-rule-unavailable" })
      expect(await state.domain.selection.read({ caseRef: state.caseRef }, call)).toEqual({ status: "needs-input", reason: "selection-not-created" })
      expect((await state.domain.materiality.registry.list(state.caseRef, call)).status).toBe("ok")
      expect((await state.domain.proposalCoverage.resolveForecastCoverage(`proposal-coverage:${"a".repeat(64)}`, call)).status).toBe("unavailable")
      expect((await state.domain.change({ caseRef: encodeCaseRef(state.caseRef), choiceRef: "not-chosen", operations: [{ kind: "replace", targetRef: "not-selected", amount: 3 }] }, call)).status).toBe("denied")
      return { status: "ok", value: true }
    })
    expect(checked.status).toBe("ok")
    expect((await state.business.selectedCase(call)).status).toBe("unavailable")
    state.authority.ui.finish(call)
  } finally { await state.close() }
})

test("read admission cannot register criterion or portfolio selection, including for a viewer", async () => {
  const state = await fixture()
  try {
    const call = await state.readCall()
    const criterion = { caseRef: state.caseRef, criterionId: "cost", metricRef: "planner:known-subtotal-difference", operator: "lte" as const,
      value: 100, unit: "USD", period: { start: "2026-01-01", end: "2026-12-31" }, evidenceRefs: [], expectedRuleVersion: 0 }
    const selection = { caseRef: state.caseRef, baselineAlternativeId: "baseline", alternativeId: "alternative", criteria: ["cost"], expectedVersion: 0 }
    expect((await state.domain.criteria.register(criterion, call)).status).toBe("denied")
    expect((await state.domain.selection.register(selection, call)).status).toBe("denied")
    state.authority.ui.finish(call)
    state.actor.canWrite = false
    expect((await state.authority.human.admit(state.request, "decisions.criteria", criterion)).status).toBe("denied")
    expect((await state.authority.human.admit(state.request, "decisions.select-portfolio", selection)).status).toBe("denied")
  } finally { await state.close() }
})

test("generic preferences writes cannot forge domain proof or signal registries", async () => {
  const state = await fixture()
  try {
    for (const [prefix, reason] of [["sf:proposal-coverage:forged", "proposal-coverage-write-outside-authority"],
      ["sf:criterion-rule:forged", "proposal-coverage-write-outside-authority"], ["sf:memory-condition:forged", "signal-registry-write-outside-authority"]] as const) {
      const before = await state.authority.state.read(state.request, "preferences", (stored) => stored.preferences)
      if (before.status !== "ok") throw new Error("Preferences unavailable")
      const attempted = await state.authority.state.transaction(state.request, { namespace: "preferences", expectedStorageVersion: before.storageVersion,
        targetRef: state.caseRef.id, targetIncarnation: state.caseRef.incarnation, idempotencyKey: prefix, commandDigest: digestSfValue(prefix) }, async (stored) => {
        stored.preferences[prefix] = { fabricated: true }
        return { commit: true, value: true }
      })
      expect(attempted).toMatchObject({ status: "denied", reason })
      const after = await state.authority.state.read(state.request, "preferences", (stored) => stored.preferences)
      expect(after.status === "ok" && after.value).toEqual(before.value)
    }
  } finally { await state.close() }
})

test("the Planner actor fence accepts its real snapshot and rejects changed access or revocation", async () => {
  const state = await fixture()
  try {
    const call = await state.readCall()
    const actors = createSfDecisionPlannerActors(state.authority)
    expect(await actors.capture(call)).toBe(true)
    const checked = await state.persistence.transaction("planner", async (snapshot) => {
      expect(actors.locked(snapshot, call)?.id).toBe("person")
      const changed = structuredClone(snapshot)
      changed.data.access = { person: { assigned: ["new-assignment"] } }
      expect(actors.locked(changed, call)).toBeUndefined()
      return { commit: false, value: true }
    })
    expect(checked).toBe(true)
    actors.release(call)
    state.actor.active = false
    expect(await actors.capture(call)).toBe(false)
    state.authority.ui.finish(call)
  } finally { await state.close() }
})

test("human classification over a real issued Planner source enables conditioned simulation and rejects revocation", async () => {
  const state = await fixture()
  try {
    await state.persistence.transaction("planner", async (snapshot) => {
      // Data shape from WP13's published fixture; all sources and authority below are issued by the real host.
      snapshot.data.versions = [{ id: "v0", year: 2026, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: true }
    })
    await state.persistence.initializeSources("planner")
    state.business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "a".repeat(64), manifestVersion: "b".repeat(64), skillVersion: "c".repeat(64) })
    const reader = await state.readCall()
    const issued = await state.business.plannerProduct.issueSource("v0", reader)
    if (issued.status !== "ok") throw new Error(`Planner source unavailable: ${issued.reason}`)
    const horizon = { start: "2026-01-01", end: "2026-12-31" }
    const forecast = await state.business.planner.compareForecast({ baseRef: issued.value.evidence.refId, candidateRef: issued.value.evidence.refId, period: horizon, currency: "USD" }, reader)
    if (forecast.status !== "ok" || !forecast.value.baseline.components.length) throw new Error("Real Planner projection unavailable")
    state.authority.ui.finish(reader)
    const request: BaselineCoverageRequest = { caseRef: state.caseRef, source: issued.value.evidence, expectedVersion: 0,
      basis: { id: "renewal", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [issued.value.evidence] },
      entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service"
        ? { categoryId, status: "included", componentRefs: forecast.value.baseline.components.map((component) => component.id), evidenceRefs: [issued.value.evidence], scopeNote: "Explicit human service classification" }
        : { categoryId, status: "pending", reason: "Human review required" }) }
    const admitted = await state.authority.human.admit(state.request, "decisions.coverage", request)
    if (admitted.status !== "ok") throw new Error("Human coverage admission unavailable")
    const call = admitted.value
    const saved = await state.business.withCase(call, state.caseRef, {}, () => state.domain.baselineCoverage.register(request, call))
    expect(saved.status).toBe("ok")
    const checked = await state.business.withCase(call, state.caseRef, {}, async () => {
      const coverage = await state.domain.baselineCoverage.resolveForecastCoverage(issued.value.evidence.refId, call)
      if (coverage.status !== "ok") throw new Error(`Registered coverage unavailable: ${coverage.reason}`)
      expect(coverage.value.assessment.coverageState).toBe("pending")
      expect(coverage.value.assessment.entries.some((entry) => entry.categoryId === "service" && entry.status === "included")).toBe(true)
      const simulation = await state.business.planner.simulateScenario({ baseRef: issued.value.evidence.refId, operations: [], assumptions: [] }, call)
      expect(simulation.status).toBe("ok")
      if (simulation.status === "ok") expect(simulation.value.comparisonStatus).toBe("conditioned")
      state.actor.active = false
      expect((await state.domain.baselineCoverage.resolveForecastCoverage(issued.value.evidence.refId, call)).status).not.toBe("ok")
      return { status: "ok", value: true }
    })
    expect(checked.status).toBe("ok")
    state.authority.human.finish(call)
  } finally { await state.close() }
})
