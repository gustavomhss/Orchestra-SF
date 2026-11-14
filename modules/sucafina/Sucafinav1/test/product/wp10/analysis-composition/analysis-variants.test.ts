import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfAnalysisSelectionScope } from "../../../../../../../apps/cli/src/sucafina-product/analysis-selection-scope.ts"
import { createSfAnalysisConfirmationReader } from "../../../../../../../apps/cli/src/sucafina-product/analysis-confirmation-readers.ts"
import { createSfDependencyInputProducer } from "../../../../../../../apps/cli/src/sucafina-product/input-producer-dependency.ts"
import { createSfDependencyVerifier } from "../../../../../../../apps/cli/src/sucafina-product/analysis-verifier-collaboration.ts"
import { createSfExecutiveInputProducer } from "../../../../../../../apps/cli/src/sucafina-product/input-producer-executive.ts"
import { createSfExecutiveReviewVerifier } from "../../../../../../../apps/cli/src/sucafina-product/analysis-verifier-routines.ts"
import type { SfAnalysisRequest, SfAnalysisVerifier } from "../../../../../../../apps/cli/src/sucafina-product/analysis-verifier.ts"
import type { SfInputProducer } from "../../../../../../../apps/cli/src/sucafina-product/input-producer-intent.ts"
import type { SfAnalysisPreparation } from "../../../../../../../apps/cli/src/sucafina-product/analysis-services.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createChoiceSnapshot } from "../../../../product/decisions/choice.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { createReviewPort } from "../../../../product/reviews/port.ts"
import { digestSfContribution, digestSfValue } from "../../../../product/contracts/canonical.ts"
import { decodeSfContributionOutput } from "../../../../product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { ConfirmationCommand, ConfirmationScope } from "../../../../product/contracts/context.ts"
import type { DecisionCase, ScenarioResult } from "../../../../product/contracts/decisions.ts"
import type { DependencyReviewInput, ExecutiveReviewInput } from "../../../../product/contracts/skill-inputs.ts"
import type { ContributionEnvelope } from "../../../../product/contracts/resident-ai.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfStateResult } from "../../../../product/contracts/state.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { domain as portfolio } from "../../../../runtime/dashboard-portfolio.ts"
import { compositionTestDeadline } from "../integration/composition-test-deadline.ts"
import { contributionPayloadMetadata } from "./contribution-payload-fixture.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const at = "2026-11-14T00:00:00Z"
const milestoneId = "milestone:project%3A1:ms%2F1"
const declaration = "  Equipe exige revisão humana da capacidade; 2 FTE não significam disponibilidade.  "
function ok<T>(result: PortResult<T> | SfStateResult<T>): T {
  if (result.status !== "ok") throw new Error(`Real composition boundary unavailable: ${JSON.stringify(result)}`)
  return result.value
}

// These tests execute real C08, selection receipts, Dashboard/Planner source issuance, C06,
// producers and verifiers. Seeded choices and candidate financial values are declared fixtures;
// no model execution, native receipt, or global acceptance is asserted by this suite.
async function fixture(withChoice = true, duplicateMilestone = false, withRelation = false, phaseScope?: string) {
  const deadline = compositionTestDeadline(`analysis-variants.${phaseScope ?? (withRelation ? "DependencyConflict" : "standard")}`, withRelation ? 50_000 : 25_000)
  const metrics = { transactions: 0, allTransactions: 0, snapshotCopies: 0, authentications: 0, environments: 0,
    caseReads: 0, relationReads: 0, dashboardReads: 0, evidenceContexts: 0, evidenceResolutions: 0 }
  const phase = <T>(label: string, work: () => Promise<T>) => {
    const before = { ...metrics }
    return deadline.phase(label, async () => {
      try { return await work() }
      finally {
        console.info("SF_ANALYSIS_VARIANTS_COUNTERS", JSON.stringify({ phase: label,
          delta: Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, value - before[key as keyof typeof before]])), total: { ...metrics } }))
      }
    })
  }
  const close = async () => {
    console.info("SF_ANALYSIS_VARIANTS_CLEANUP", JSON.stringify({ state: "started", ...metrics }))
    try { await deadline.close() }
    finally { console.info("SF_ANALYSIS_VARIANTS_CLEANUP", JSON.stringify({ state: "returned", ...metrics })) }
  }
  try {
    const directory = await phase("fixture.directory", async () => {
      const value = await mkdtemp(path.join(await realpath(tmpdir()), "sf-analysis-variants-"))
      deadline.own(() => rm(value, { recursive: true, force: true }))
      return value
    })
    const driver = await phase("fixture.store", async () => {
      const value = await openLocalStore(path.join(directory, "store"))
      deadline.own(() => value.dispose())
      return value
    })
    // Observe actual work without replacing a transaction, snapshot, access
    // decision or producer output. Phase deltas are inclusive of nested phases.
    const allTransactions: typeof driver.transactionAll = driver.transactionAll
      ? async (work, options) => { metrics.allTransactions++; deadline.check(); return driver.transactionAll!(work, options) } : undefined
    const metered: typeof driver = { ...driver,
      transaction: async (surface, work, options) => { metrics.transactions++; deadline.check(); return driver.transaction(surface, work, options) },
      ...(allTransactions ? { transactionAll: allTransactions } : {}),
      ...(driver.currentSnapshots ? { currentSnapshots: () => { metrics.snapshotCopies++; deadline.check(); return driver.currentSnapshots!() } } : {}),
    }
    const persistence = { ...metered, ...createSfSourcePersistence({ persistence: metered, createId: randomUUID, enumerate: enumerateSfSources,
      projectScope: createSfSourceScopeProjector(() => at) }) }
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("dashboard", async (snapshot) => {
      const milestone = { id: "ms/1", name: "Release", date: "2026-12-20", status: "upcoming" }
      snapshot.data.projects = [{ id: "project:1", name: "Selected project", status: "In Progress", risk: "Low", budget: 0, spent: 0, pct: 0,
        milestones: duplicateMilestone ? [milestone, { ...milestone }] : [milestone] }]
      if (withRelation) {
        snapshot.data.capexProjects = [{ id: "capex:1", name: "Selected investment", year: 2026, budget: 1200, spent: 0, status: "Approved", owner: "person" }]
        ;(snapshot.data.projects as unknown[]).push({ id: "project:2", name: "Other selected project", status: "In Progress", risk: "Low", budget: 0, spent: 0, pct: 0,
          milestones: [{ id: "ms/2", name: "Separate release", date: "2026-12-21", status: "upcoming" }] })
      }
      snapshot.versions["projects:project:1"] = { version: 1, by: "person" }
      return { commit: true, value: true }
    })
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "v0", year: 2026, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: true }
    })
    await persistence.initializeSources("dashboard")
    await persistence.initializeSources("planner")
    const control = { active: true }
    const selectionWrites = new WeakSet<object>()
    const identity = { installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const request = new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test" }, signal: deadline.signal })
    const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test", policyVersion: "policy", persistence,
      grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "reviews", "confirmations", "relations"],
        operations: ["sf_dashboard_read", "sf_forecast_compare", "sf_case_read"], humanActions: ["analysis.prepare", "collaboration.confirmation.confirm", "collaboration.relation.confirm"] }],
      analysisSelectionWrites: selectionWrites, now: Date.now, createId: randomUUID,
      authenticate: async (_request, scope) => { metrics.authentications++; deadline.check(); return control.active && scope ? { id: "person", canWrite: true, roles: [{ surface: scope.surface, role: "admin" }] } : null },
      environment: async () => { metrics.environments++; deadline.check(); return { at, id: randomUUID, directory: [] } },
      commandIdentity: async (_request, operation, digest) => { deadline.check(); return `${operation}:${digest}` },
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
      providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
    const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet() })
    deadline.own(() => business.dispose())
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "a".repeat(64), manifestVersion: "b".repeat(64), skillVersion: "c".repeat(64) })
    const call = ok(await authority.ui.admit(request, "sf_dashboard_read", digestSfValue("fixture")))
    deadline.own(() => authority.ui.finish(call))
    if (!await authority.ui.validate(call, "sf_dashboard_read", digestSfValue("fixture"))) throw new Error("Read admission unavailable")
    let source = ok(await phase("fixture.dashboard-source", () => business.dashboardServices.issue({ recordType: "dashboard-page", recordId: "Portfolio Dashboard", fields: ["projects"], period }, call)))
    const relationRecords: Extract<BusinessEvidenceRef, { kind: "record" }>[] = []
    if (withRelation) {
      relationRecords.push(ok(await business.dashboardRecords.issue({ page: "Portfolio Dashboard", recordType: "projects", recordId: "project:1", fields: ["name"], period }, call)))
      relationRecords.push(ok(await business.dashboardRecords.issue({ page: "CAPEX Projects", recordType: "capexProjects", recordId: "capex:1", fields: ["name"], period }, call)))
    }
    const caseRef = { id: "case", incarnation: "case-inc", version: 1 }
    const result: ScenarioResult = { id: "fixture-result", version: 1, currency: "USD", horizon: period, components: [], sourceRefs: [source],
      unresolvedConditions: ["Cost coverage has not been evaluated by this boundary fixture"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: null, total: null,
      costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "candidate", alternativeVersion: 1, currency: "USD", horizon: period,
        issues: ["Coverage pending"], evaluatedSourceRefs: [source], coverageState: "pending", entries: [{ status: "pending", categoryId: "service", reason: "Not evaluated" }], derivedMissingCategoryIds: ["service"] } }
    const decision: DecisionCase = { ...caseRef, state: withChoice ? "chosen" : "draft", objective: "Review exact selected product variants", horizon: period, currency: "USD", participants: ["person"], criteria: [{ id: "cost", description: "Cost coverage", required: true }],
      sourceRefs: withChoice ? [source, ...relationRecords] : [], assumptions: [], questions: [], alternatives: withChoice ? [{ id: "candidate", version: 1, title: "Selected candidate", scenario: { baseRef: source.refId, operations: [], assumptions: [] }, result }] : [],
      costCoverageBases: withChoice ? [{ id: "basis", version: 1, decisionType: "fixture", categoryIds: ["service"], additionalCategoryIds: [], sourceRefs: [source] }] : [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    if (withChoice) {
      const chosen = createChoiceSnapshot({ case: decision, alternativeId: "candidate", alternativeVersion: 1,
        comparison: { baselineResultRef: "baseline-fixture", alternativeResultRef: result.id, costCoverageRefs: [], criterionResults: [], unresolvedConditions: result.unresolvedConditions, comparisonStatus: "conditioned", knownDifference: null, completeDifference: null },
        criteria: ["cost"], values: [], evidenceRefs: [source], id: "chosen", principalRef: "person", reason: "Explicit human choice fixture", at })
      if (chosen.status !== "ok") throw new Error(chosen.reason)
      decision.choices = [chosen.choice]
    }
    ok(await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
      idempotencyKey: "seed", commandDigest: digestSfValue(decision) }, async (state) => { state.cases.case = decision; return { commit: true, value: true } }))
    const relationPair = withRelation ? { fromRef: relationRecords[0]!.refId, toRef: relationRecords[1]!.refId, kind: "pmo-capex", evidenceRefs: [...relationRecords, source] } : undefined
    const relation = await phase("fixture.relation-confirm", async () => {
      if (!relationPair) return undefined
      const mutation = { expectedStorageVersion: ok(await business.collaboration.relations.storageVersion(call)), idempotencyKey: "confirm-dependency" }
      const human = ok(await authority.human.admit(request, "collaboration.relation.confirm", { operation: "create", pair: relationPair, mutation }))
      try { return ok(await business.collaboration.relations.create(relationPair, mutation, human)) }
      finally { authority.human.finish(human) }
    })
    const removeRelation = () => phase("relation.remove", async () => {
      if (!relation || !relationPair) throw new Error("No confirmed relation selected")
      const mutation = { expectedStorageVersion: ok(await business.collaboration.relations.storageVersion(call)), idempotencyKey: "remove-dependency" }
      const human = ok(await authority.human.admit(request, "collaboration.relation.confirm", { operation: "remove", id: relation.id, pair: relationPair, mutation }))
      try { return ok(await business.collaboration.relations.remove(relation.id, relationPair, mutation, human)) }
      finally { authority.human.finish(human) }
    })
    const cases = { ...business.cases, read: async (...args: Parameters<typeof business.cases.read>) => {
      metrics.caseReads++; deadline.check(); return business.cases.read(...args)
    } }
    const context = { ...business.context,
      context: async (...args: Parameters<typeof business.context.context>) => { metrics.evidenceContexts++; deadline.check(); return business.context.context(...args) },
      resolve: async (...args: Parameters<typeof business.context.resolve>) => { metrics.evidenceResolutions++; deadline.check(); return business.context.resolve(...args) },
    }
    const collaboration = { ...business.collaboration, relations: { ...business.collaboration.relations,
      readVersioned: async (...args: Parameters<typeof business.collaboration.relations.readVersioned>) => {
        metrics.relationReads++; deadline.check(); return business.collaboration.relations.readVersioned(...args)
      },
    } }
    const dashboard = { ...business.dashboard, read: async (...args: Parameters<typeof business.dashboard.read>) => {
      metrics.dashboardReads++; deadline.check(); return business.dashboard.read(...args)
    } }
    const scoped = createSfAnalysisSelectionScope({ authority, cases, selectionWrites, skills: ["sf-revisar-dependencias", "sf-preparar-revisao-executiva"] })
    const base = { cases, planner: business.planner, procurement: business.procurement, context, host: authority.host }
    const dependency = { ...base, collaboration, dashboard, readHumanSelection: scoped.read }
    const dependencies = { producer: createSfDependencyInputProducer(dependency), verifier: createSfDependencyVerifier(dependency) }
    const fresh = async (currentCall: TrustedDomainContext) => (await business.context.resolve(source, currentCall)).state === "fresh" && await authority.host.revalidate(currentCall)
    // The test's explicit review selector is backed by the real Dashboard read and ReviewPort.
    const reviews = createReviewPort({ state: authority.state, creationTarget: authority.creationTarget, now: () => at, requestFor: authority.host.requestFor,
      select: async (selectionRef, sectionRefs, currentCall, selectedPeriod) => {
        if (selectionRef !== source.refId || digestSfValue(sectionRefs) !== digestSfValue(["projects"]) || digestSfValue(selectedPeriod) !== digestSfValue(period)) return { status: "denied", reason: "fixture-review-not-selected" }
        const projected = await business.dashboard.read({ selectionRef, fields: ["projects"], period }, currentCall)
        return projected.status === "ok" ? { status: "ok", value: [{ id: "projects", title: "Portfolio", period, recordCount: 1, projection: projected.value }] } : projected
      },
      authorizeSections: fresh, revalidate: fresh, revalidateEvidence: async (currentCall, refs) => {
        const values = await business.context.context({ refs }, currentCall)
        return values.every((value) => value.state === "fresh") && await fresh(currentCall)
      },
      authorizeComments: async (currentCall, values) => !values.length && await fresh(currentCall), authorizeOutcomeComparison: async (currentCall, values) => !values.length && await fresh(currentCall),
      authorizeOutcome: async (currentCall, values) => !values.length && await fresh(currentCall), authorizeDecision: async (currentCall, values) => !values.length && await fresh(currentCall),
      authorizeSensitivity: async (currentCall, values) => !values.length && await fresh(currentCall) })
    const confirmation = business.collaboration.confirmation
    if (!confirmation) throw new Error("Real confirmation composition is missing")
    const confirmations = createSfAnalysisConfirmationReader({ host: authority.host, state: authority.state, confirmation })
    const executive = { ...base, reviews, confirmations, readHumanSelection: scoped.read }
    const executives = { producer: createSfExecutiveInputProducer(executive), verifier: createSfExecutiveReviewVerifier(executive) }
    const confirm = (scope: ConfirmationScope) => phase("confirmation.confirm", async () => {
      const displayed = ok(await confirmation.prepare(scope, call))
      const before = await authority.state.read(request, "confirmations", () => true)
      if (before.status !== "ok") throw new Error("C08 namespace unavailable")
      const command: ConfirmationCommand = { scope, observedSourceVersion: displayed.sourceVersion, expectedScopeFingerprint: displayed.scopeFingerprint, expectedStorageVersion: before.storageVersion, idempotencyKey: randomUUID() }
      const human = ok(await authority.human.admit(request, "collaboration.confirmation.confirm", command))
      try { return ok(await confirmation.confirm(command, human)) } finally { authority.human.finish(human) }
    })
    const confirmDashboard = () => confirm({ sourceRef: { surface: "dashboard", type: "dashboard-page", id: "Portfolio Dashboard", incarnation: source.target.incarnation }, fields: ["projects"], period, materialDependencies: [], scopeDefinitionVersion: "dashboard-c06-v1" })
    const editDate = (date: string) => phase("dashboard.edit-date", async () => {
      const edited = await persistence.transaction("dashboard", async (snapshot) => {
        const result = portfolio.execute(snapshot, { id: "person", canWrite: true, roles: ["admin"] }, { page: "Portfolio Dashboard", action: "save-milestone", id: "project:1", version: snapshot.versions["projects:project:1"]!.version,
          values: { milestoneId: "ms/1", name: "Release", date, status: "upcoming" } }, { at, id: randomUUID, directory: [] })
        return { commit: result.ok, value: result }
      })
      if (!edited.ok) throw new Error(`Domain edit failed: ${edited.status}`)
    })
    const refresh = () => phase("dashboard.refresh", async () => { source = ok(await business.dashboardServices.issue({ recordType: "dashboard-page", recordId: "Portfolio Dashboard", fields: ["projects"], period }, call)); return source })
    const admit = async (skillId: string, selection: unknown) => {
      const analysis: SfAnalysisRequest = { caseRef, profileId: skillId === "sf-revisar-dependencias" ? "sf_portfolio" : "sf_maestro", profileVersion: "1", skillId, skillVersion: "1", manifestDigest: "a".repeat(64), outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_case_read"], objective: decision.objective }
      const incoming: SfAnalysisPreparation = { request: analysis, selection }
      const human = ok(await phase("analysis.admit", () => authority.human.admit(request, "analysis.prepare", incoming)))
      deadline.own(() => authority.human.finish(human))
      return { incoming, call: human }
    }
    const attempts = { prepare: 0, accept: 0 }
    const prepare = (pair: { producer: SfInputProducer; verifier: SfAnalysisVerifier }, incoming: SfAnalysisPreparation, human: TrustedUiContext) => phase(`prepare.${++attempts.prepare}`, () => scoped.selectionScope.prepare(incoming, human, async () => {
      const result = await phase("prepare.producer", () => pair.producer.prepare(incoming.selection, incoming.request, human))
      if (result.status !== "ok") return result
      const proof = await phase("prepare.verify", () => scoped.selectionScope.verify(result.value, incoming.request, human, () => pair.verifier.verify(result.value, incoming.request, human)))
      return proof.status === "ok" ? result : proof
    }))
    const accept = (pair: { verifier: SfAnalysisVerifier }, value: unknown, incoming: SfAnalysisPreparation, human: TrustedUiContext, output: ContributionEnvelope) => phase(`accept.${++attempts.accept}`, () => scoped.selectionScope.verify(value, incoming.request, human, async () => {
      const proof = await phase("accept.verify", () => pair.verifier.verify(value, incoming.request, human))
      return proof.status === "ok" ? phase("accept.output", () => proof.value.acceptsOutput(output, human)) : proof
    }))
    return { control, authority, business, request, call, caseRef, source: () => source, relation, removeRelation, dependencies, executives, confirmations, confirmation, scoped, confirm, confirmDashboard, editDate, refresh, admit, prepare, accept, close }
  } catch (error) { await close(); throw error }
}

function dependencySelection() { return { relationRefIds: [], commitmentIds: ["chosen"], milestoneIds: [milestoneId], declaredConstraints: [declaration] } }
function delivery(caseRef: SfAnalysisRequest["caseRef"], refs: readonly BusinessEvidenceRef[]): ContributionEnvelope {
  // Only the output payload boundary is exercised here; this is not a native contribution receipt.
  const output: ContributionEnvelope = { ...contributionPayloadMetadata(caseRef), state: "ready", kind: "DeliveryAssessment", evidenceRefs: refs, payload: { caseRef: encodeCaseRef(caseRef), candidateRefs: ["candidate"], dependencies: [], capacityConstraints: [declaration],
    unresolvedConditions: [{ id: "coverage-service", category: "service", reason: "Cost coverage pending", evidenceRefs: [] },
      { id: "human-declared-constraint:0", category: "human-declared-constraint", reason: `Unverified human declaration: ${declaration}`, evidenceRefs: [] }] } }
  output.outputDigest = digestSfContribution(output)
  return output
}

test("dependency variants reopen exact C09 choice and Dashboard milestone and preserve human declarations", async () => {
  const state = await fixture()
  try {
    const human = await state.admit("sf-revisar-dependencias", dependencySelection())
    const input = ok(await state.prepare(state.dependencies, human.incoming, human.call)) as DependencyReviewInput
    expect(input.commitments).toEqual([{ id: "chosen", case: state.caseRef, evidenceRefs: [state.source()] }])
    expect(input.milestones).toEqual([{ id: milestoneId, projectRef: state.source(), at: "2026-12-20", state: "upcoming" }])
    expect(input.declaredConstraints).toEqual([declaration])
    expect(await state.accept(state.dependencies, input, human.incoming, human.call, delivery(state.caseRef, [state.source()]))).toEqual({ status: "ok", value: true })
    const injected = { ...input, declaredConstraints: ["2 FTE of free capacity"] }
    expect((await state.accept(state.dependencies, injected, human.incoming, human.call, delivery(state.caseRef, [state.source()]))).status).toBe("unavailable")
    const promoted = delivery(state.caseRef, [state.source()])
    if (promoted.state !== "ready" || promoted.kind !== "DeliveryAssessment") throw new Error("Fixture kind mismatch")
    promoted.payload.capacityConstraints = ["2 FTE of free capacity"]
    expect((await state.accept(state.dependencies, input, human.incoming, human.call, promoted)).status).toBe("unavailable")
    const erased = delivery(state.caseRef, [state.source()])
    if (erased.state !== "ready" || erased.kind !== "DeliveryAssessment") throw new Error("Fixture kind mismatch")
    erased.payload.unresolvedConditions = erased.payload.unresolvedConditions.filter((condition) => condition.category !== "human-declared-constraint")
    expect((await state.accept(state.dependencies, input, human.incoming, human.call, erased)).status).toBe("unavailable")
    state.authority.human.finish(human.call)
  } finally { await state.close() }
}, 30_000)

test("dependency variants refuse absent choices, noncanonical IDs, ambiguous milestones, stale evidence and revocation", async () => {
  const state = await fixture()
  try {
    for (const selection of [{ ...dependencySelection(), commitmentIds: ["not-the-human-choice"] }, { ...dependencySelection(), milestoneIds: ["ms/1"] }, { ...dependencySelection(), milestoneIds: ["milestone:project%3a1:ms%2f1"] }]) {
      const human = await state.admit("sf-revisar-dependencias", selection)
      expect((await state.prepare(state.dependencies, human.incoming, human.call)).status).toBe("unavailable")
      state.authority.human.finish(human.call)
    }
    const human = await state.admit("sf-revisar-dependencias", dependencySelection())
    const input = ok(await state.prepare(state.dependencies, human.incoming, human.call))
    await state.editDate("2026-12-21")
    expect((await state.accept(state.dependencies, input, human.incoming, human.call, delivery(state.caseRef, [state.source()]))).status).toBe("unavailable")
    state.control.active = false
    expect((await state.dependencies.producer.prepare(dependencySelection(), human.incoming.request, human.call)).status).toBe("unavailable")
    state.authority.human.finish(human.call)
  } finally { await state.close() }
  const ambiguous = await fixture(true, true)
  try {
    const human = await ambiguous.admit("sf-revisar-dependencias", dependencySelection())
    expect((await ambiguous.prepare(ambiguous.dependencies, human.incoming, human.call)).status).toBe("unavailable")
    ambiguous.authority.human.finish(human.call)
  } finally { await ambiguous.close() }
}, 30_000)

// Each group owns the full real setup and a positive baseline. Separating the
// independent output counterexamples keeps each existing 60s budget meaningful;
// no verification result, authority or source read is shared between tests.
for (const group of [
  { kind: "states", name: "DependencyConflict preserves a real confirmed relation and selected unverified constraint as needs-input", invalid: [0, 1] },
  { kind: "relations", name: "DependencyConflict refuses reversed relations and unselected or unrelated constraints", invalid: [2, 3, 4, 5] },
  { kind: "declarations", name: "DependencyConflict preserves the literal declaration without inventing capacity", invalid: [6, 7] },
  { kind: "evidence", name: "DependencyConflict requires exact payload and envelope evidence", invalid: [8, 9] },
  { kind: "scope", name: "DependencyConflict revalidates selected input and actual relation removal", invalid: [] },
] as const) test(group.name, async () => {
  const state = await fixture(true, false, true, `DependencyConflict.${group.kind}`)
  try {
    const relation = state.relation
    if (!relation) throw new Error("Actual human-confirmed relation is missing")
    const unrelatedMilestone = "milestone:project%3A2:ms%2F2"
    const selected = { ...dependencySelection(), relationRefIds: [relation.fromRef, relation.toRef], milestoneIds: [milestoneId, unrelatedMilestone] }
    const human = await state.admit("sf-revisar-dependencias", selected)
    try {
      const input = ok(await state.prepare(state.dependencies, human.incoming, human.call)) as DependencyReviewInput
      expect(input.relations).toMatchObject([{ id: relation.id, version: 1, state: "confirmed" }])
      const output: ContributionEnvelope = { ...contributionPayloadMetadata(state.caseRef), state: "ready", kind: "DependencyConflict", evidenceRefs: relation.evidenceRefs,
        payload: { fromRef: relation.fromRef, toRef: relation.toRef, constraintRef: "human-declared-constraint:0",
          reason: `Unverified human declaration: ${declaration}`, evidenceRefs: relation.evidenceRefs, state: "needs-input" } }
      output.outputDigest = digestSfContribution(output)
      if (output.state !== "ready" || output.kind !== "DependencyConflict") throw new Error("Fixture kind mismatch")
      expect(decodeSfContributionOutput("DependencyConflict", output.payload).ok).toBe(true)
      expect(await state.accept(state.dependencies, input, human.incoming, human.call, output)).toEqual({ status: "ok", value: true })
      if (group.kind === "states") {
        const milestone = structuredClone(output)
        milestone.payload.constraintRef = milestoneId
        milestone.payload.reason = `Unverified dependency constraint for selected milestone ${milestoneId} at 2026-12-20 (upcoming); required delivery date or capacity rule is unavailable`
        expect(await state.accept(state.dependencies, input, human.incoming, human.call, milestone)).toEqual({ status: "ok", value: true })
      }
      const invalid: (typeof output.payload)[] = [
        { ...output.payload, state: "conflict" },
        { ...output.payload, state: "unavailable" },
        { ...output.payload, fromRef: relation.toRef, toRef: relation.fromRef },
        { ...output.payload, constraintRef: "human-declared-constraint:1" },
        { ...output.payload, constraintRef: "milestone:outside:unselected" },
        { ...output.payload, constraintRef: unrelatedMilestone, reason: `Unverified dependency constraint for selected milestone ${unrelatedMilestone} at 2026-12-21 (upcoming); required delivery date or capacity rule is unavailable` },
        { ...output.payload, reason: "2 FTE prove available capacity" },
        { ...output.payload, reason: `Unverified human declaration: ${declaration.trim()}` },
        { ...output.payload, evidenceRefs: relation.evidenceRefs.slice(1) },
        { ...output.payload, evidenceRefs: [...relation.evidenceRefs, relation.evidenceRefs[0]!] },
      ]
      for (const index of group.invalid) {
        const payload = invalid[index]!
        expect((await state.accept(state.dependencies, input, human.incoming, human.call, { ...output, payload })).status).toBe("unavailable")
      }
      if (group.kind === "evidence") expect((await state.accept(state.dependencies, input, human.incoming, human.call, { ...output, evidenceRefs: [] })).status).toBe("unavailable")
      if (group.kind === "scope") {
        expect((await state.accept(state.dependencies, { ...input, declaredConstraints: [declaration.trim()] }, human.incoming, human.call, output)).status).toBe("unavailable")
        // Real C06 removal after admission must invalidate the same output at egress.
        await state.removeRelation()
        expect((await state.accept(state.dependencies, input, human.incoming, human.call, output)).status).toBe("unavailable")
      }
    } finally { state.authority.human.finish(human.call) }
  } finally { await state.close() }
}, 60_000)

test("real Dashboard confirmations preserve stale and executive output cannot erase the confirmation gap", async () => {
  const state = await fixture(false)
  try {
    const record = await state.confirmDashboard()
    expect(ok(await state.confirmations({ refs: [state.source()], period }, state.call))).toMatchObject([{ confirmationId: record.id, state: "valid", reason: "unchanged-scope" }])
    await state.editDate("2026-12-21")
    await state.refresh()
    const selection = { selectionRef: state.source().refId, sectionRefs: ["projects"], decisionRefs: [state.caseRef], period, includeConfirmations: true, includeRoutineResults: false }
    const human = await state.admit("sf-preparar-revisao-executiva", selection)
    const input = ok(await state.prepare(state.executives, human.incoming, human.call)) as ExecutiveReviewInput
    expect(input.confirmations).toMatchObject([{ confirmationId: record.id, state: "stale", reason: "material-change" }])
    expect(input.factualRoutineResults).toEqual([])
    const output: ContributionEnvelope = { ...contributionPayloadMetadata(state.caseRef), state: "ready", kind: "DecisionBrief", evidenceRefs: [state.source()], payload: { caseRef: encodeCaseRef(state.caseRef), caseVersion: 1, objective: human.incoming.request.objective,
      orderedResultRefs: [], evidenceRefs: [state.source()], conditions: [{ id: `confirmation:${record.id}`, category: "confirmation", reason: "material-change", evidenceRefs: [] }] } }
    output.outputDigest = digestSfContribution(output)
    expect(await state.accept(state.executives, input, human.incoming, human.call, output)).toEqual({ status: "ok", value: true })
    if (output.state !== "ready" || output.kind !== "DecisionBrief") throw new Error("Fixture kind mismatch")
    output.payload.conditions = []
    expect((await state.accept(state.executives, input, human.incoming, human.call, output)).status).toBe("unavailable")
    expect(await state.executives.producer.prepare({ ...selection, includeRoutineResults: true }, human.incoming.request, human.call)).toEqual({ status: "unavailable", reason: "review-result-link-unavailable" })
    state.authority.human.finish(human.call)
  } finally { await state.close() }
}, 30_000)

test("C06 Planner summary uses the selected subperiod of annual source evidence", async () => {
  const state = await fixture(false)
  try {
    const source = ok(await state.business.plannerProduct.issueSource("v0", state.call)).evidence
    const quarter = { start: "2026-04-01", end: "2026-06-30" }
    expect(source.target.period).toEqual(period)
    expect(source.target.fields).not.toEqual(["summary"])
    const record = await state.confirm({ sourceRef: { surface: "planner", type: "planner-version", id: "v0", incarnation: source.target.incarnation }, fields: ["summary"], period: quarter, materialDependencies: [], scopeDefinitionVersion: "planner-c06-v1" })
    expect(ok(await state.confirmations({ refs: [source], period: quarter }, state.call))).toMatchObject([{ confirmationId: record.id, state: "valid" }])
    expect(ok(await state.confirmations({ refs: [source], period }, state.call))).toEqual([])
    expect(ok(await state.confirmations({ refs: [], period: quarter }, state.call))).toEqual([])
    state.control.active = false
    expect((await state.confirmations({ refs: [source], period: quarter }, state.call)).status).toBe("unavailable")
  } finally { await state.close() }
}, 30_000)

test("confirmation composition rejects a real source change between observations and never skips unavailable matches", async () => {
  const state = await fixture(false)
  try {
    const record = await state.confirmDashboard()
    let reads = 0
    const confirmation = { ...state.confirmation, project: async (...args: Parameters<typeof state.confirmation.project>) => {
      const value = await state.confirmation.project(...args)
      if (++reads === 1) await state.editDate("2026-12-22")
      return value
    } }
    const reader = createSfAnalysisConfirmationReader({ host: state.authority.host, state: state.authority.state, confirmation })
    expect((await reader({ refs: [state.source()], period }, state.call)).status).toBe("unavailable")
    expect(reads).toBeGreaterThanOrEqual(2)
    await state.refresh()
    expect(ok(await state.confirmations({ refs: [state.source()], period }, state.call))).toMatchObject([{ confirmationId: record.id, state: "stale" }])
    const invalid = { ...state.source(), refDigest: "0".repeat(64) }
    expect((await state.confirmations({ refs: [invalid], period }, state.call)).status).toBe("unavailable")
    state.control.active = false
    expect((await state.confirmations({ refs: [state.source()], period }, state.call)).status).toBe("unavailable")
  } finally { await state.close() }
}, 30_000)
