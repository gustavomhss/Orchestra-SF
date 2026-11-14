import { expect, test } from "bun:test"
import { digestSfContribution, digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { Persistence } from "../../../runtime/contract.ts"
import type { HistoricalCalculationRead } from "../../../product/decisions/calculation-history.ts"
import { createAnalysisAcceptance } from "../../../product/decisions/analysis-acceptance.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createScenarioRequestStore } from "../../../product/decisions/scenario-request-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerCalculationEvidence } from "../../../product/planner/calculation-evidence.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { domain } from "../../../runtime/planner.ts"
import { plannerFixture, plannerAt, plannerPeriod } from "../wp03/planner-fixture.ts"

test("an accepted C17 reference reopens through the explicit ledger lane after the case advances, without becoming a current result", async () => {
  const fixture = await plannerFixture()
  try {
    for (const surface of ["dashboard", "procurement"] as const) await fixture.persistence.initializeSources(surface)
    const context = await fixture.admit("sf-human:planner.read", {})
    const http = fixture.host.requestFor(context)
    if (!http) throw new Error("Real UI authority unavailable")
    const issuedSource = await fixture.issueSource("v0", context)
    if (issuedSource.status !== "ok") throw new Error(issuedSource.reason)
    const sourceRef = issuedSource.value.evidence
    const basis = { id: "historical-scenario", version: 1, decisionType: "unknown", categoryIds: [], additionalCategoryIds: [], sourceRefs: [sourceRef] }
    const sources = { ...fixture.sources, resolveForecastCoverage: async () => ({ status: "ok" as const, value: { coverageRef: "historical-scenario", basis, assessment: { basisId: basis.id, basisVersion: basis.version, alternativeId: "scenario", alternativeVersion: 1, currency: "USD", horizon: plannerPeriod, coverageState: "pending" as const, entries: [], derivedMissingCategoryIds: [], issues: ["inventory-unavailable"], evaluatedSourceRefs: [sourceRef] } } }) }
    const planner = createPlannerPort({ host: fixture.host, sources })
    const scenario: ScenarioRequest = { baseRef: sourceRef.refId, operations: [{ kind: "replace", targetRef: "line:11", amount: 42, currency: "USD", period: { start: "2027-11-01", end: "2027-11-30" } }], assumptions: [] }
    const originalCaseRef = { id: "calculation-case", incarnation: "calculation-inc", version: 1 }
    const decision: DecisionCase = { ...originalCaseRef, state: "investigating", objective: "Inspect an actual Planner calculation", horizon: plannerPeriod, currency: "USD", criteria: [], participants: [context.binding.principalRef], sourceRefs: [sourceRef], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const hooks: { beforeSources?: () => Promise<void>; observeSources?: () => Promise<void>; observeRequestSources?: () => Promise<void> } = {}
    const compose = (persistence: Persistence) => {
      const writes = new WeakSet<object>()
      const state = createSfProductState({ persistence, proposalCoverageWrites: writes, createId: () => "history-state", resolveTarget: async (_request, snapshot, _namespace, targetRef) => {
        const value = snapshot.data.__sfProductV1
        if (value && typeof value === "object" && "cases" in value && value.cases && typeof value.cases === "object" && targetRef in value.cases) {
          const selected: unknown = Reflect.get(value.cases, targetRef)
          if (selected && typeof selected === "object" && "incarnation" in selected && typeof selected.incarnation === "string") return { incarnation: selected.incarnation }
        }
        return targetRef === originalCaseRef.id ? { incarnation: originalCaseRef.incarnation } : undefined
      }, authorize: async (request) => request === http && await fixture.host.revalidate(context) ? context.binding : undefined })
      const authorizeCase = async (value: DecisionCase, trusted: TrustedDomainContext) => value.participants.includes(trusted.binding.principalRef) && await fixture.host.revalidate(trusted)
      const verifySource = async (ref: BusinessEvidenceRef, trusted: TrustedDomainContext) => {
        if (ref.kind !== "record" || ref.installationId !== trusted.binding.installationId || ref.projectId !== trusted.binding.projectId) return false
        const current = await fixture.sources.resolveForecastSource(ref.refId, trusted)
        return current.status === "ok" && digestSfValue(current.value.evidence) === digestSfValue(ref)
      }
      const results = createSfDecisionResultStore({ state, host: fixture.host, authorizeCase, verifySources: async (_result, refs, trusted) => {
        const hook = hooks.beforeSources
        hooks.beforeSources = undefined
        await hook?.()
        await hooks.observeSources?.()
        for (const ref of refs) if (!await verifySource(ref, trusted)) return false
        return true
      }, createId: () => "history-result", now: () => plannerAt })
      // This contract fixture supplies the private producer-capture and human-grant boundaries.
      // The source fence, C08 stores, analysis mutation and Planner replay are production implementations.
      const captured: { resultRef?: string; requestDigest?: string; sourceFence?: string } = {}
      const requests: ReturnType<typeof createScenarioRequestStore> = createScenarioRequestStore({ state, results, host: fixture.host, authorizeCase, authorizeProducer: async (request, resultRef, engineVersion) => captured.resultRef === resultRef && captured.requestDigest === digestSfValue(request) && engineVersion === "planner-runtime-v1", verifyRequestSources: async (request, stored, trusted) => {
        await hooks.observeRequestSources?.()
        return producer.verifyCalculationRequestSources(request, stored, trusted)
      }, verifySnapshot: (snapshot, record) => captured.resultRef === record.resultRef && captured.requestDigest === record.requestDigest && captured.sourceFence === sfRunSourceFence(snapshot), operationIdentity: () => "history-request", writes })
      const producer = createPlannerCalculationEvidence({ host: fixture.host, readForCalculation: (request, trusted) => results.readForCalculation(request, trusted), loadRecordOnlyRequest: requests.read, replayRecordOnly: planner.simulateScenario })
      const historicalProducer = (selection: HistoricalCalculationRead) => createPlannerCalculationEvidence({ host: fixture.host,
        readForCalculation: (request, trusted) => request.resultRef === selection.reference.target.runId ? results.readHistoricalCalculation(selection, trusted) : Promise.resolve({ status: "denied", reason: "historical-calculation-outside-ledger-selection" }),
        loadRecordOnlyRequest: (runId, trusted) => runId === selection.reference.target.runId ? requests.readHistorical(selection, trusted) : Promise.resolve({ status: "denied", reason: "historical-calculation-outside-ledger-selection" }),
        replayRecordOnly: planner.simulateScenario,
      })
      const readCase = async () => {
        const value = await state.read(http, "cases", (stored) => stored.cases[originalCaseRef.id])
        if (value.status !== "ok" || !value.value) throw new Error("Persisted case unavailable")
        return value.value
      }
      const selectionFor = async (reference: HistoricalCalculationRead["reference"]): Promise<HistoricalCalculationRead> => {
        const value = await readCase()
        return { caseRef: { id: value.id, incarnation: value.incarnation, version: value.version }, eventId: "accepted-calculation", reference }
      }
      const resolve: BusinessContextService["resolve"] = async (ref, trusted): Promise<BusinessEvidenceResolution> => {
        if (ref.kind !== "calculation") return { ref, state: await verifySource(ref, trusted) ? "fresh" : "unavailable", accessRevision: trusted.binding.accessRevision, checkedAt: plannerAt }
        const selection = await selectionFor(ref)
        const replayed = await historicalProducer(selection).issue(ref.target.runId, trusted)
        return { ref, state: replayed.status === "ok" && digestSfValue(replayed.value) === digestSfValue(ref) ? "historical" : "unavailable", accessRevision: trusted.binding.accessRevision, checkedAt: plannerAt }
      }
      const evidence: BusinessContextService = { resolve, context: async ({ refs }, trusted) => Promise.all(refs.map((ref) => resolve(ref, trusted))), recall: async () => [], emitFromLedger: async () => { throw new Error("No Atlas publication in this fixture") } }
      const cases = createDecisionCasePort({ state, host: fixture.host, authorizeCase, evidence, creationTarget: { ref: originalCaseRef.id, incarnation: originalCaseRef.incarnation }, operationIdentity: () => "history-case", verifyScenarioOperations: async (value) => value.alternatives.length === 0, createId: () => "unused", now: () => plannerAt })
      return { state, results, requests, producer, historicalProducer, readCase, selectionFor, cases, captured, authorizeCase }
    }
    const first = compose(fixture.persistence)
    const seed = await first.state.transaction(http, { namespace: "cases", expectedStorageVersion: 0, targetRef: decision.id, targetIncarnation: decision.incarnation, idempotencyKey: "history-case", commandDigest: digestSfValue(decision) }, async (staged) => { staged.cases[decision.id] = decision; return { commit: true, value: true } })
    expect(seed.status).toBe("ok")
    const produced = await planner.simulateScenario(scenario, context)
    if (produced.status !== "ok") throw new Error(produced.reason)
    const stored = await first.results.write({ kind: "scenario", result: produced.value, caseRef: originalCaseRef, sourceRefs: produced.value.sourceRefs, requestDigest: digestSfValue(scenario), idempotencyKey: "historical-scenario" }, context)
    if (stored.status !== "ok") throw new Error(stored.reason)
    Object.assign(first.captured, { resultRef: stored.value.resultRef, requestDigest: digestSfValue(scenario), sourceFence: sfRunSourceFence(await fixture.readSnapshot()) })
    expect((await first.requests.register({ resultRef: stored.value.resultRef, request: scenario, engineVersion: "planner-runtime-v1" }, context)).status).toBe("ok")
    const calculation = await first.producer.issue(stored.value.resultRef, context)
    expect(calculation.status).toBe("ok")
    if (calculation.status !== "ok") throw new Error(calculation.reason)

    const receipt = { runId: "fixture-run", nativeSessionId: "fixture-session", profileId: "sf_finance", profileVersion: "1", profileDigest: "a".repeat(64), skillId: "fixture-skill", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "fixture-message", loadedAt: plannerAt, manifestDigest: "d".repeat(64) } as const
    const envelope = { id: "fixture-output", caseRef: originalCaseRef, kind: "MatchExplanation", schemaVersion: "sf-contribution-v1", state: "ready", payload: { candidateCaseRef: originalCaseRef, matchedCriteria: [], currentDifferences: [], sourceStates: [], limitations: ["Contract fixture; no resident-runtime claim"] }, evidenceRefs: [calculation.value], runProvenance: { ...receipt, actualModel: "fixture-model", contextFingerprint: "fixture-context" }, accessRevision: context.binding.accessRevision, createdAt: plannerAt, outputDigest: "" } as const
    const output: ContributionEnvelope = { ...envelope, outputDigest: digestSfContribution(envelope) }
    const run: SfNativeRunRecord = { schema: "sf-native-run-v1", runRef: receipt.runId, version: 1, state: "ready", requestDigest: "e".repeat(64), skillInputDigest: "f".repeat(64), principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, caseRef: originalCaseRef,
      selection: { profile: { id: "sf_finance", version: "1", mission: "Contract fixture", allowedSkills: [], allowedOperations: [], outputTypes: ["MatchExplanation"], contextBudgetTokens: 1, maxSteps: 1, maxDelegations: 0, modelClass: "fixture", resumePolicy: "fixture", sourcePath: "fixture", sourceDigest: "b".repeat(64) }, skills: [], operationIds: [], manifestDigest: receipt.manifestDigest },
      model: { providerID: "fixture", id: "fixture-model" }, skillId: receipt.skillId, objective: "Preserve calculation continuity", contextFingerprint: "fixture-context", createdAt: plannerAt, updatedAt: plannerAt, native: { sessionID: receipt.nativeSessionId, skillReceipt: receipt }, outputRef: output.id }
    const contributionState = await first.state.read(http, "contributions", () => null)
    if (contributionState.status !== "ok") throw new Error("Contribution state unavailable")
    expect((await first.state.transaction(http, { namespace: "contributions", expectedStorageVersion: contributionState.storageVersion, targetRef: decision.id, targetIncarnation: decision.incarnation, idempotencyKey: "fixture-contribution", commandDigest: digestSfValue({ output, run }) }, async (staged) => { staged.contributions[output.id] = output; staged.nativeRuns = { [run.runRef]: run }; return { commit: true, value: true } })).status).toBe("ok")
    const accept = createAnalysisAcceptance({ state: first.state, host: fixture.host, authorizeCase: first.authorizeCase, authorizeAcceptance: async () => true, confirmAcceptance: async () => true, verifyAcceptance: () => true, operationIdentity: () => "fixture-human-acceptance", createId: () => "accepted-calculation", now: () => plannerAt,
      readContribution: async () => {
        const value = await first.state.read(http, "contributions", (staged) => ({ output: staged.contributions[output.id], run: staged.nativeRuns?.[run.runRef] }))
        return value.status === "ok" && value.value.output && value.value.run ? { status: "ok", value: { output: value.value.output, run: value.value.run } } : { status: "unavailable", reason: "contribution-unavailable" }
      },
    })
    expect(await accept({ caseRef: originalCaseRef, outputRef: output.id, runRef: run.runRef, rationale: "Accept the referenced analysis without applying its scenario" }, context)).toEqual({ status: "ok", value: { caseRef: { ...originalCaseRef, version: 2 } } })
    const acceptedCase = await first.readCase()
    expect(acceptedCase.ledger).toHaveLength(1)
    expect(acceptedCase.ledger[0]!.evidenceRefs).toEqual([calculation.value])
    expect((await first.results.readForCalculation({ resultRef: stored.value.resultRef }, context)).status).toBe("denied")
    expect((await first.requests.read(stored.value.resultRef, context)).status).toBe("unavailable")
    expect((await first.producer.issue(stored.value.resultRef, context)).status).not.toBe("ok")
    const selection = await first.selectionFor(calculation.value)
    expect(await first.results.readHistoricalCalculation(selection, context)).toEqual(stored)
    expect(await first.requests.readHistorical(selection, context)).toMatchObject({ status: "ok", value: { caseRef: originalCaseRef, request: scenario, requestDigest: digestSfValue(scenario), resultDigest: stored.value.resultDigest } })
    expect((await first.cases.read({ caseRef: encodeCaseRef(originalCaseRef) }, context)).status).toBe("ok")

    const reopened = await openLocalStore(fixture.directory)
    try {
      const second = compose(reopened)
      expect(await second.historicalProducer(selection).issue(stored.value.resultRef, context)).toEqual(calculation)
      const projection = await second.cases.read({ caseRef: encodeCaseRef(originalCaseRef) }, context)
      expect(projection.status).toBe("ok")
      if (projection.status !== "ok") throw new Error(projection.reason)
      expect(projection.value.events).toEqual(acceptedCase.ledger)
      expect(projection.value.case.version).toBe(2)
      const changedOrigin = { ...calculation.value, projectId: "foreign-project", refDigest: "" }
      const foreign = { ...changedOrigin, refDigest: digestSfEvidenceRef(changedOrigin) }
      for (const rejected of [
        { ...selection, eventId: "missing-event" },
        { ...selection, caseRef: { ...selection.caseRef, id: "another-case" } },
        { ...selection, caseRef: { ...selection.caseRef, incarnation: "another-incarnation" } },
        { ...selection, caseRef: { ...selection.caseRef, version: 3 } },
        { ...selection, reference: foreign },
      ]) {
        expect(await second.results.readHistoricalCalculation(rejected, context)).toEqual({ status: "denied", reason: "historical-calculation-unavailable" })
        expect((await second.requests.readHistorical(rejected, context)).status).not.toBe("ok")
      }
      let mutation = 0
      const changeCase = async (update: (value: DecisionCase) => DecisionCase) => {
        const current = await first.state.read(http, "cases", (staged) => staged.cases[originalCaseRef.id])
        if (current.status !== "ok" || !current.value) throw new Error("Case unavailable")
        const next = update(structuredClone(current.value))
        expect((await first.state.transaction(http, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: current.value.id, targetIncarnation: current.value.incarnation, idempotencyKey: `history-negative-${++mutation}`, commandDigest: digestSfValue(next) }, async (staged) => { staged.cases[next.id] = next; return { commit: true, value: true } })).status).toBe("ok")
      }
      // The second callback runs after the reader's earlier case re-observation.
      // A concurrent commit there must be caught by the final C08 read fence.
      const finalSourceRace = { calls: 0 }
      hooks.observeSources = async () => {
        if (++finalSourceRace.calls === 2) await changeCase((value) => ({ ...value, version: value.version + 1, ledger: [] }))
      }
      const finalRaceResult = await second.results.readHistoricalCalculation(selection, context)
      expect(finalSourceRace.calls).toBe(2)
      expect(finalRaceResult).toEqual({ status: "denied", reason: "historical-calculation-changed" })
      expect(finalRaceResult).not.toHaveProperty("value")
      hooks.observeSources = undefined
      await changeCase((value) => ({ ...value, version: value.version + 1, ledger: acceptedCase.ledger }))
      const restoredSelection = await second.selectionFor(calculation.value)
      expect(await second.results.readHistoricalCalculation(restoredSelection, context)).toEqual(stored)
      const finalRequestRace = { calls: 0 }
      hooks.observeRequestSources = async () => {
        if (++finalRequestRace.calls === 2) await changeCase((value) => ({ ...value, version: value.version + 1, ledger: [] }))
      }
      const requestRaceResult = await second.requests.readHistorical(restoredSelection, context)
      expect(finalRequestRace.calls).toBe(2)
      expect(requestRaceResult).toEqual({ status: "stale", reason: "scenario-request-case-changed" })
      expect(requestRaceResult).not.toHaveProperty("value")
      hooks.observeRequestSources = undefined
      await changeCase((value) => ({ ...value, version: value.version + 1, ledger: acceptedCase.ledger }))
      const requestRestoredSelection = await second.selectionFor(calculation.value)
      expect(await second.requests.readHistorical(requestRestoredSelection, context)).toMatchObject({ status: "ok", value: { caseRef: originalCaseRef, request: scenario, requestDigest: digestSfValue(scenario), resultDigest: stored.value.resultDigest } })
      hooks.beforeSources = () => changeCase((value) => ({ ...value, version: value.version + 1, ledger: [] }))
      expect(await second.results.readHistoricalCalculation(requestRestoredSelection, context)).toEqual({ status: "denied", reason: "historical-calculation-changed" })
      expect((await second.results.readHistoricalCalculation(await second.selectionFor(calculation.value), context)).status).toBe("denied")
      await changeCase((value) => ({ ...value, version: value.version + 1, ledger: acceptedCase.ledger, horizon: { start: "2026-01-01", end: "2026-12-31" } }))
      expect(await second.results.readHistoricalCalculation(await second.selectionFor(calculation.value), context)).toEqual({ status: "denied", reason: "historical-calculation-unavailable" })
      await changeCase((value) => ({ ...value, version: value.version + 1, horizon: plannerPeriod }))
      const currentSelection = await second.selectionFor(calculation.value)
      fixture.access.allowed = false
      expect((await second.results.readHistoricalCalculation(currentSelection, context)).status).toBe("denied")
      fixture.access.allowed = true
      const changed = await fixture.persistence.transaction("planner", async (snapshot) => {
        const result = domain.execute(snapshot, { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }, { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", f10: 43 } }, { at: plannerAt, id: () => "source-change", directory: [] })
        return { commit: result.ok, value: result }
      })
      expect(changed.ok).toBe(true)
      expect((await second.results.readHistoricalCalculation(currentSelection, context)).status).not.toBe("ok")
      expect((await second.historicalProducer(currentSelection).issue(stored.value.resultRef, context)).status).not.toBe("ok")
      expect((await second.cases.read({ caseRef: encodeCaseRef(originalCaseRef) }, context)).status).not.toBe("ok")
      await changeCase((value) => ({ ...value, version: value.version + 1, incarnation: "replaced-case" }))
      expect(await second.results.readHistoricalCalculation(await second.selectionFor(calculation.value), context)).toEqual({ status: "denied", reason: "historical-calculation-unavailable" })
    } finally { await reopened.dispose() }
  } finally { await fixture.close() }
}, 180000)
