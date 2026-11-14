import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Schema } from "effect"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionSchema } from "@orchestra/core/session/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfDecisionDomainServices } from "../../../../../../../apps/cli/src/sucafina-product/decision-domain-services.ts"
import { createSfPortfolioServices } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-services.ts"
import { createSfNativeAnalysisInputs } from "../../../../../../../apps/cli/src/sucafina-product/analysis-native-inputs.ts"
import type { SfAdmittedAnalysisInput } from "../../../../../../../apps/cli/src/sucafina-product/analysis-native-inputs.ts"
import { createSfScenarioComparisonInput } from "../../../../../../../apps/cli/src/sucafina-product/analysis-inputs.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { ScenarioRequest, AlternativeDraftRequest } from "../../../../product/contracts/operations.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfHostServices } from "../../../../product/contracts/host-context.ts"
import type { ResidentProfile, SkillLoadReceipt, SkillManifest } from "../../../../product/contracts/resident-ai.ts"
import type { SfSelectedRuntime } from "../../../../product/contracts/runtime.ts"
import type { SfStateResult } from "../../../../product/contracts/state.ts"
import type { TrustedDomainContext, TrustedExecutionBinding } from "../../../../product/contracts/sf-execution.ts"
import type { BaselineCoverageRequest } from "../../../../product/decisions/baseline-coverage.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { captureAlternativeProvenance } from "../../../../product/decisions/alternative-provenance.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"

function ok<T>(result: PortResult<T> | SfStateResult<T>): T {
  if (result.status !== "ok") throw new Error(`Expected a real producer result: ${JSON.stringify(result)}`)
  return result.value
}

// Real SQLite/C08, Planner, source issuance, human selection and one-use native binding.
// Session/skill observations are declared boundary fixtures; no model or native session execution is claimed.
// The authority proof selects January from the unchanged annual Planner source.
// It does not qualify annual composition latency or complete financial coverage.
async function fixture() {
  const deadline = performance.now() + 105_000
  const deadlineError = new Error("Alternative-selection fixture exceeded its 105000ms cooperative deadline")
  const cancellation = new AbortController()
  const timer = setTimeout(() => cancellation.abort(deadlineError), 105_000)
  const checkDeadline = () => {
    // Repeated synchronous work and promise microtasks can delay Bun's timer.
    // Check the clock at actual host boundaries as well as propagating abort.
    if (performance.now() >= deadline && !cancellation.signal.aborted) cancellation.abort(deadlineError)
    cancellation.signal.throwIfAborted()
  }
  const cleanups: (() => void | Promise<void>)[] = []
  const disposal: { pending?: Promise<void> } = {}
  const close = () => disposal.pending ??= (async () => {
    clearTimeout(timer)
    cancellation.abort(new Error("Alternative-selection fixture closed"))
    const failures: unknown[] = []
    for (const cleanup of cleanups.toReversed()) {
      try { await cleanup() } catch (error) { failures.push(error) }
    }
    // Product ports may translate a boundary exception to a denied result. A
    // deadline must still fail a negative test after all resources are released.
    if (cancellation.signal.reason === deadlineError || performance.now() >= deadline) failures.unshift(deadlineError)
    if (failures.length) throw new AggregateError(failures, "Alternative-selection fixture cleanup or deadline failed")
  })()
  try {
    checkDeadline()
    const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-alternative-selection-"))
    cleanups.push(() => rm(directory, { recursive: true, force: true }))
    const driver = await openLocalStore(path.join(directory, "store"))
    cleanups.push(() => driver.dispose())
    checkDeadline()
    const metrics = { transactions: 0, allTransactions: 0, snapshotCopies: 0, authentications: 0, selectionReads: 0, simulations: 0 }
    const phase = async <T>(name: string, work: () => Promise<T>) => {
      const started = performance.now()
      const before = { ...metrics }
      console.info("SF_ALTERNATIVE_PHASE", JSON.stringify({ phase: name, state: "started", ...before }))
      try { return await work() } finally {
        console.info("SF_ALTERNATIVE_PHASE", JSON.stringify({ phase: name, state: "returned", elapsedMs: Math.round(performance.now() - started),
          ...Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, value - before[key as keyof typeof before]])) }))
      }
    }
    // Count actual calls without replacing data, authorization or producer results.
    const allTransactions: typeof driver.transactionAll = driver.transactionAll
      ? async (work, options) => { metrics.allTransactions++; return driver.transactionAll!(work, options) } : undefined
    const metered: typeof driver = { ...driver,
      transaction: async (surface, work, options) => { metrics.transactions++; return driver.transaction(surface, work, options) },
      ...(allTransactions ? { transactionAll: allTransactions } : {}),
      ...(driver.currentSnapshots ? { currentSnapshots: () => { metrics.snapshotCopies++; return driver.currentSnapshots!() } } : {}),
    }
    const persistence = { ...metered, ...createSfSourcePersistence({ persistence: metered, createId: randomUUID, enumerate: enumerateSfSources,
      projectScope: createSfSourceScopeProjector(() => "2026-11-14T00:00:00Z") }) }
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "v0", year: 2026, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: true }
    })
    await persistence.initializeSources("planner")
    const control = { active: true, generation: 1 }
    const proposalCoverageWrites = new WeakSet<object>()
    const identity = { installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const request = new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test" }, signal: cancellation.signal })
    const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Finance", sourcePath: "profile.json", sourceDigest: "a".repeat(64),
      allowedSkills: ["sf-comparar-cenarios"], allowedOperations: ["sf_alternative_draft"], outputTypes: ["ScenarioComparison", "AlternativeDraft"],
      contextBudgetTokens: 1000, maxSteps: 4, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" }
    const skill: SkillManifest = { id: "sf-comparar-cenarios", version: "1", sourcePath: "skill.md", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64),
      inputSchemaRef: "ScenarioComparisonInput", outputSchemaRefs: ["ScenarioComparison"], allowedProfiles: [profile.id], allowedOperations: ["sf_alternative_draft"],
      workflow: ["compare"], limits: { maxSteps: 4, contextBudgetTokens: 1000 }, positiveAcceptance: ["compare"], negativeAcceptance: ["deny"] }
    const selected: SfSelectedRuntime = { profile, manifestDigest: "d".repeat(64), skills: [skill], operationIds: ["sf_alternative_draft"] }
    const sessionID = SessionSchema.ID.make("ses_comparison_alternative_boundary")
    const receipt: SkillLoadReceipt = { runId: "run", nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version, profileDigest: profile.sourceDigest,
      skillId: skill.id, skillVersion: skill.version, sourceDigest: skill.sourceDigest, instructionsDigest: skill.instructionsDigest, loadedMessageId: "msg_boundary",
      loadedAt: "2026-11-14T00:00:00Z", manifestDigest: selected.manifestDigest }
    const session = Schema.decodeUnknownSync(SessionSchema.Info)({ id: sessionID, projectID: identity.projectId, agent: profile.id, location: identity.location,
      model: { providerID: "openai", id: "model" }, cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: Date.now(), updated: Date.now() }, title: "Comparison alternative authority fixture" })
    const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test", policyVersion: "policy", persistence,
      grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions"], operations: ["sf_forecast_compare", "sf_alternative_draft"],
        humanActions: ["decisions.coverage", "decisions.select-portfolio", "analysis.prepare", "analysis.start"] }], proposalCoverageWrites,
      now: Date.now, createId: randomUUID,
      authenticate: async (_request, scope) => { metrics.authentications++; checkDeadline(); return control.active && scope ? { id: "person", canWrite: true, roles: [{ surface: scope.surface, role: "admin" }] } : null },
      environment: async () => { checkDeadline(); return { at: "2026-11-14T00:00:00Z", id: randomUUID, directory: [] } },
      commandIdentity: async (_request, operation, digest) => { checkDeadline(); return `${operation}:${digest}` },
      inspectSession: async (id) => { checkDeadline(); return id === sessionID ? session : undefined },
      verifySelection: async (value) => { checkDeadline(); return digestSfValue(value) === digestSfValue(selected) },
      verifySkillReceipt: async (value) => { checkDeadline(); return value.sessionID === sessionID && value.runId === receipt.runId && digestSfValue(value.skillReceipts) === digestSfValue([receipt]) },
      providerGeneration: async () => { checkDeadline(); return control.generation }, authorizeDocument: async () => { checkDeadline(); return undefined } })
    const live: { binding?: TrustedExecutionBinding; call?: Extract<TrustedDomainContext, { kind: "native" }> } = {}
    cleanups.push(() => {
      if (live.call) authority.native.finish(live.call)
      if (live.binding) authority.native.revoke(live.binding)
    })
    const initial = { id: "case", incarnation: "case-inc", version: 1 }
    ok(await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref,
      targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "case", commandDigest: digestSfValue(initial) }, async (state) => {
      state.cases.case = { ...initial, state: "draft", objective: "Explicit alternative", horizon: { start: "2026-01-01", end: "2026-01-31" }, currency: "USD",
        criteria: [], participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
      return { commit: true, value: true }
    }))
    const interleavings: { beforeSimulation?: () => Promise<void> } = {}
    const realBusiness = createSfBusinessServices({ authority, persistence, proposalCoverageWrites })
    cleanups.push(() => realBusiness.dispose())
    const business = { ...realBusiness, planner: { ...realBusiness.planner,
      simulateScenario: async (...args: Parameters<typeof realBusiness.planner.simulateScenario>) => {
        metrics.simulations++
        const interleave = interleavings.beforeSimulation
        interleavings.beforeSimulation = undefined
        await interleave?.()
        return realBusiness.planner.simulateScenario(...args)
      },
    } }
    const admitted: { value?: SfAdmittedAnalysisInput } = {}
    const replayContexts = new WeakMap<TrustedDomainContext, string>()
    const readers = createSfNativeAnalysisInputs({ authority, selectedCase: business.selectedCase, requestForRun: (id) => id === "run" ? request : undefined,
      runForContext: (call) => replayContexts.get(call), admittedInput: (id) => id === "run" ? admitted.value : undefined, captures: () => [], revalidateCapture: async () => false })
    const actualPortfolio = createSfPortfolioServices({ authority, business, proposalCoverageWrites })
    cleanups.push(() => actualPortfolio.dispose())
    const sharedPortfolio = { ...actualPortfolio, selection: { ...actualPortfolio.selection,
      read: async (...args: Parameters<typeof actualPortfolio.selection.read>) => { metrics.selectionReads++; return actualPortfolio.selection.read(...args) },
    } }
    const domain = createSfDecisionDomainServices({ authority, business, baseline: business.baselineCoverage, proposalCoverageWrites, signalRegistryWrites: new WeakSet(),
      selectedCase: business.selectedCase, verifiedInputFor: readers.verifiedInputFor, verifiedAlternativeSelectionFor: readers.verifiedAlternativeSelectionFor,
      hasAdmittedInputContext: readers.hasAdmittedInputContext, sharedPortfolio })
    cleanups.push(() => domain.dispose())
    business.bindDecisionDomain(domain)
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "a".repeat(64), manifestVersion: "b".repeat(64), skillVersion: "c".repeat(64) })
    const readCall = async () => {
      const digest = digestSfValue(initial)
      const call = ok(await authority.ui.admit(request, "sf_forecast_compare", digest))
      cleanups.push(() => authority.ui.finish(call))
      if (!await authority.ui.validate(call, "sf_forecast_compare", digest)) throw new Error("Real read admission unavailable")
      return call
    }
    const read = await readCall()
    const source = ok(await phase("fixture.source", () => business.plannerProduct.issueSource("v0", read))).evidence
    const horizon = { start: "2026-01-01", end: "2026-01-31" }
    const forecast = ok(await phase("fixture.forecast", () => business.planner.compareForecast({ baseRef: source.refId, candidateRef: source.refId, period: horizon, currency: "USD" }, read)))
    expect(source.target.period).toEqual({ start: "2026-01-01", end: "2026-12-31" })
    expect(forecast.baseline.context.period).toEqual(horizon)
    authority.ui.finish(read)
    const coverage: BaselineCoverageRequest = { caseRef: initial, source, expectedVersion: 0,
      basis: { id: "renewal", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [source] },
      entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service"
        ? { categoryId, status: "included", componentRefs: forecast.baseline.components.map((component) => component.id), evidenceRefs: [source], scopeNote: "Explicit human classification" }
        : { categoryId, status: "pending", reason: "Human review required" }) }
    const coverageCall = ok(await authority.human.admit(request, "decisions.coverage", coverage))
    cleanups.push(() => authority.human.finish(coverageCall))
    ok(await phase("fixture.coverage", () => business.withCase(coverageCall, initial, {}, () => domain.baselineCoverage.register(coverage, coverageCall))))
    const alternatives: DecisionCase["alternatives"][number][] = []
    ok(await business.withCase(coverageCall, initial, {}, async () => {
      for (const id of ["first", "chosen", "outside"]) {
        const scenario: ScenarioRequest = { baseRef: source.refId, operations: [], assumptions: [{ id: "hypothesis", value: id, state: "hypothetical", evidenceRefs: [] }] }
        const result = ok(await phase(`fixture.scenario.${id}`, () => business.planner.simulateScenario(scenario, coverageCall)))
        expect(result.horizon).toEqual(horizon)
        // Only the fixture's case identities are assigned; financial results and source evidence come from the actual Planner.
        alternatives.push({ id, version: 1, title: "Same title", scenario, result: { ...result, costCoverage: { ...result.costCoverage, alternativeId: id, alternativeVersion: 1 } } })
      }
      return { status: "ok", value: true }
    }))
    authority.human.finish(coverageCall)
    const caseRef = { ...initial, version: 2 }
    const caseState = await authority.state.read(request, "cases", (state) => state.cases.case)
    if (caseState.status !== "ok" || !caseState.value) throw new Error("Case fixture unavailable")
    ok(await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: caseState.storageVersion, targetRef: initial.id, targetIncarnation: initial.incarnation,
      idempotencyKey: "alternatives", commandDigest: digestSfValue(alternatives) }, async (state) => {
      state.cases.case = { ...state.cases.case!, version: caseRef.version, sourceRefs: [source], alternatives, costCoverageBases: [coverage.basis] }
      return { commit: true, value: true }
    }))
    const storing = await readCall()
    ok(await business.withCase(storing, caseRef, {}, async () => {
      for (const alternative of alternatives) ok(await business.results.write({ kind: "scenario", caseRef, requestDigest: digestSfValue(alternative.scenario),
        result: alternative.result, sourceRefs: alternative.result.sourceRefs, idempotencyKey: `scenario:${alternative.id}` }, storing))
      return { status: "ok", value: true }
    }))
    authority.ui.finish(storing)
    const selectedAlternatives = { caseRef, alternatives: [{ id: "first", version: 1 }, { id: "chosen", version: 1 }] as const }
    const preparing = ok(await authority.human.admit(request, "analysis.prepare", selectedAlternatives))
    cleanups.push(() => authority.human.finish(preparing))
    const producer = createSfScenarioComparisonInput({ cases: business.cases, planner: sharedPortfolio.planner, scenarioLookup: business.scenarioLookup, context: business.context,
      revalidate: authority.host.revalidate, authorizeSelection: (call, wanted) => authority.human.authorize(call, "analysis.prepare", wanted) })
    const skillInput = ok(await phase("fixture.input", () => business.withCase(preparing, caseRef, {}, () => producer.prepare(preparing, selectedAlternatives))))
    authority.human.finish(preparing)
    const start: Parameters<NonNullable<SfHostServices["analyses"]>["start"]>[1] = { request: { caseRef, profileId: profile.id, profileVersion: profile.version, skillId: skill.id,
      skillVersion: skill.version, manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_alternative_draft"], objective: "Compare exact alternatives" },
      skillInput, model: { providerID: "openai", id: "model" } }
    const fullRequest = { ...start.request, contextFingerprint: digestSfValue({ caseRef, skillInput }) }
    const select = async (baselineAlternativeId: string, alternativeId: string, expectedVersion: number) => {
      const selection = { caseRef, baselineAlternativeId, alternativeId, criteria: [], expectedVersion }
      const call = ok(await authority.human.admit(request, "decisions.select-portfolio", selection))
      cleanups.push(() => authority.human.finish(call))
      try { return await phase("selection.register", () => business.withCase(call, caseRef, {}, () => domain.selection.register(selection, call))) } finally { authority.human.finish(call) }
    }
    const capture = async (incoming = start, full = fullRequest) => {
      const call = ok(await authority.human.admit(request, "analysis.start", incoming))
      cleanups.push(() => authority.human.finish(call))
      try { return await phase("selection.capture", () => business.withCase(call, caseRef, {}, () => domain.captureAlternativeSelection(full, incoming, call))) } finally { authority.human.finish(call) }
    }
    const draftRequest: AlternativeDraftRequest = { caseRef: encodeCaseRef(caseRef), proposal: { title: "Same title", description: "A name does not select a scenario", sourceRefs: [source] }, sourceRefs: [source] }
    const bind = async (includeSelection = true) => {
      const selection = includeSelection ? ok(await capture()) : undefined
      admitted.value = { request: structuredClone(fullRequest), input: structuredClone(skillInput), ...(selection ? { alternativeSelection: selection } : {}) }
      const prior = await authority.state.read(request, "contributions", (_state, actor) => actor)
      if (prior.status !== "ok") throw new Error("Run authority unavailable")
      const seeded = await authority.state.transaction(request, { namespace: "contributions", expectedStorageVersion: prior.storageVersion, targetRef: caseRef.id,
        targetIncarnation: caseRef.incarnation, idempotencyKey: "run", commandDigest: digestSfValue(admitted.value) }, async (state) => {
        state.nativeRuns ??= {}
        state.nativeRuns.run = { schema: "sf-native-run-v1", runRef: "run", version: 1, requestDigest: digestSfValue(fullRequest), skillInputDigest: digestSfValue(skillInput),
          principalRef: "person", accessRevision: prior.value.accessRevision, policyVersion: prior.value.policyVersion, caseRef, selection: selected, model: start.model,
          skillId: skill.id, objective: fullRequest.objective, contextFingerprint: fullRequest.contextFingerprint, createdAt: "2026-11-14T00:00:00Z", updatedAt: "2026-11-14T00:00:00Z", state: "preparing" }
        return { commit: true, value: true }
      })
      if (seeded.status !== "ok") throw new Error("Run initialization unavailable")
      live.binding = ok(await authority.native.bind({ request, selected, sessionID, runId: "run", caseRef, profile, manifestDigest: selected.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" }))
      ok(await authority.state.transaction(request, { namespace: "contributions", expectedStorageVersion: seeded.storageVersion, targetRef: caseRef.id,
        targetIncarnation: caseRef.incarnation, idempotencyKey: "running", commandDigest: digestSfValue(receipt) }, async (state) => {
        state.nativeRuns!.run = { ...state.nativeRuns!.run!, version: 2, state: "running", native: { sessionID, skillReceipt: receipt } }
        return { commit: true, value: true }
      }))
      const tool = { sessionID, agent: profile.id, assistantMessageID: "msg_draft", toolCallID: "call_draft" } as Parameters<typeof authority.native.lease>[0]
      const digest = digestSfValue(draftRequest)
      const call = ok(await authority.native.lease(tool, "sf_alternative_draft", digest))
      if (!authority.native.consume(call, "sf_alternative_draft", digest)) throw new Error("Real capability lease unavailable")
      live.call = call
      return call
    }
    checkDeadline()
    return { authority, business, domain, sharedPortfolio, readers, replayContexts, request, caseRef, start, fullRequest, alternatives, skillInput, draftRequest, admitted, control, select, capture, bind, readCall, close, phase,
      beforeSimulation: (work: () => Promise<void>) => { interleavings.beforeSimulation = work } }
  } catch (error) {
    try { await close() } catch (cleanupError) { throw new AggregateError([error, cleanupError], "Alternative-selection fixture initialization failed") }
    throw error
  }
}

test("canonical comparison drafts the exact human-selected second alternative and supports only the private replay context", async () => {
  const state = await fixture()
  try {
    expect(state.domain.selection.read).toBe(state.sharedPortfolio.selection.read)
    expect(state.domain.portfolio).toBe(state.sharedPortfolio.product)
    expect(state.domain.descriptors.map((descriptor) => descriptor.id).sort()).toEqual(["sf_alternative_draft", "sf_change_prepare"])
    ok(await state.select("first", "chosen", 0))
    const call = await state.bind()
    const selection = ok(await state.readers.verifiedAlternativeSelectionFor(call))
    expect(selection.selection.alternativeId).toBe("chosen")
    expect(selection.requestDigest).toBe(digestSfValue(state.fullRequest))
    expect(selection.inputDigest).toBe(digestSfValue(state.skillInput))
    const draft = ok(await state.phase("draft", () => state.domain.alternative(state.draftRequest, call)))
    expect(draft.domainApplied).toBe(false)
    expect(draft.proposal.scenario).toEqual(state.alternatives[1]!.scenario)
    expect(draft.proposal.scenario).not.toEqual(state.alternatives[0]!.scenario)
    const receipt = state.business.receipt(call, "sf_alternative_draft", digestSfValue(state.draftRequest), digestSfValue(draft))
    const operation = state.business.operationIdentity(call)
    if (!receipt || !operation) throw new Error("Real capability provenance unavailable")
    const record = captureAlternativeProvenance(state.draftRequest, draft, receipt, call, operation)
    if (!record) throw new Error("Producer capture invalid")
    const ui = ok(await state.authority.human.admit(state.request, "analysis.start", state.start))
    try {
      expect((await state.readers.verifiedAlternativeSelectionFor(ui)).status).toBe("unavailable")
      state.replayContexts.set(ui, "run")
      const replay = await state.phase("replay", () => state.business.withCase(ui, state.caseRef, {}, () => state.domain.replayAlternative(record, ui)))
      expect(ok(replay).output).toEqual(draft)
    } finally { state.replayContexts.delete(ui); state.authority.human.finish(ui) }
    state.control.generation = 2
    expect((await state.domain.alternative(state.draftRequest, call)).status).not.toBe("ok")
  } finally { await state.close() }
}, 120_000)

test("comparison capture refuses missing or outside selections and a running draft cannot adopt a newer human selection", async () => {
  const state = await fixture()
  try {
    expect(await state.capture()).toMatchObject({ status: "needs-input", reason: "selection-not-created" })
    ok(await state.select("first", "outside", 0))
    expect(await state.capture()).toMatchObject({ status: "denied", reason: "alternative-comparison-selection-outside-input" })
    ok(await state.select("first", "chosen", 1))
    const call = await state.bind()
    const captured = structuredClone(state.admitted.value!.alternativeSelection)
    // Commit a real new human selection after the running invocation has resolved
    // its original selection, during the awaited Planner step. Cached proof must not survive it.
    state.beforeSimulation(async () => { ok(await state.select("chosen", "first", 2)) })
    expect(await state.phase("draft.selection-change", () => state.domain.alternative(state.draftRequest, call)))
      .toMatchObject({ status: "stale", reason: "alternative-admitted-selection-changed" })
    expect(state.admitted.value!.alternativeSelection).toEqual(captured)
    state.authority.native.revoke(call.binding)
    expect((await state.readers.verifiedAlternativeSelectionFor(call)).status).toBe("unavailable")
  } finally { await state.close() }
}, 120_000)

test("a missing admission snapshot stays missing and request/input digests cannot reuse a capture", async () => {
  const state = await fixture()
  try {
    const call = await state.bind(false)
    ok(await state.select("first", "chosen", 0))
    expect(await state.domain.alternative(state.draftRequest, call)).toMatchObject({ status: "needs-input", reason: "alternative-comparison-selection-required" })
    const captured = ok(await state.capture())
    // This assignment deliberately attacks the private holder; request/input mismatches must still fail closed.
    state.admitted.value!.alternativeSelection = { ...captured, requestDigest: digestSfValue({ ...state.fullRequest, objective: "Different request" }) }
    expect((await state.readers.verifiedAlternativeSelectionFor(call)).status).toBe("unavailable")
    state.admitted.value!.alternativeSelection = { ...captured, inputDigest: digestSfValue({ ...state.skillInput, alternatives: [...state.skillInput.alternatives].reverse() }) }
    expect((await state.readers.verifiedAlternativeSelectionFor(call)).status).toBe("unavailable")
    const changed = { ...state.start, skillInput: { ...state.skillInput, alternatives: state.skillInput.alternatives.map((alternative) => ({ ...alternative, version: alternative.version + 1 })) } }
    expect((await state.capture(changed)).status).not.toBe("ok")
    for (const changedInput of [
      { ...state.skillInput, currency: "EUR" },
      { ...state.skillInput, horizon: { ...state.skillInput.horizon, end: "2027-12-31" } },
      { ...state.skillInput, costCoverageBases: state.skillInput.costCoverageBases.map((basis) => ({ ...basis, version: basis.version + 1 })) },
      { ...state.skillInput, alternatives: state.skillInput.alternatives.map((alternative) => ({ ...alternative, result: { ...alternative.result, knownSubtotal: 999999 } })) },
    ]) expect((await state.capture({ ...state.start, skillInput: changedInput })).status).not.toBe("ok")
    state.control.active = false
    expect((await state.readers.verifiedInputFor(call)).status).toBe("unavailable")
  } finally { await state.close() }
}, 120_000)
