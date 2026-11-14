import { expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { ChoiceRecord, DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { SfProductStatePort } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { reassessScenarioCoverage } from "../../../product/decisions/cost-coverage.ts"
import { createCurrentChoicePreview } from "../../../product/decisions/current-choice-preview.ts"
import { createCurrentChoicePromotion } from "../../../product/decisions/current-choice-promotion.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createProposalCoverageRegistry } from "../../../product/decisions/proposal-coverage.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createCurrentPlannerChoice } from "../../../product/planner/current-choice.ts"
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { projectPlannerSource } from "../../../product/planner/port.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object, type Snapshot } from "../../../runtime/contract.ts"
import { createWp05SensitivityFixture, wp05Horizon } from "../wp05/engine-fixture.ts"
import { renewalCoverage } from "./renewal-coverage-fixture.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>

/** Synthetic quote facts and human grants surround the real Planner, C08, coverage and replay producers. */
test("a current quote replays the same historical choice, requires a separate human promotion, and survives reopen without applying Planner operations", async () => {
  const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "omitted", composed: true })
  try {
    const human = { choose: false, preview: false, promote: false, sourceAllowed: true, raceCase: false, round: 1, nextId: 0 }
    const mutations = createDecisionMutations({
      state: fixture.state, host: fixture.host, planner: fixture.plannerWithCriteria, sources: fixture.sources,
      authorizeCase: async () => true, authorizeMutation: async () => true, verifyMutation: () => true,
      operationIdentity: () => "wp11-lifecycle-record-choice", confirmChoice: async () => human.choose,
      confirmAnswer: async () => false,
      resolveQuestion: async () => ({ status: "unavailable", reason: "not-requested" }),
      resolveAnswer: async () => ({ status: "unavailable", reason: "not-requested" }),
      prepareDomainCommands: async () => ({ status: "unavailable", reason: "domain-application-not-requested" }),
      resolveChoiceValues: async (_caseRef, comparison, context) => {
        const result = await fixture.plannerWithCriteria.compareScenarios(comparison, context)
        return result.status === "ok" ? { status: "ok", value: [{ criterionRef: fixture.sensitivityRequest.criterion.id, value: result.value.knownDifference, unit: "USD", currency: "USD", horizon: wp05Horizon }] } : result
      },
      readScenarioResult: (resultRef, context) => fixture.results.read({ kind: "scenario", resultRef }, context),
      createId: () => `lifecycle-choice-${++human.nextId}`, now: () => "2026-11-13T00:00:00Z",
    })
    const choiceRequest = { caseRef: fixture.caseRef, alternativeId: "selected", alternativeVersion: 1, comparison: { scenarioRefs: [fixture.baselineRef, fixture.selectedRef], criteria: [fixture.sensitivityRequest.criterion.id] }, criteria: [fixture.sensitivityRequest.criterion.id], reason: "Review the conditioned transition while the separate training quote is still missing." }
    expect(await mutations.recordChoice(choiceRequest, fixture.context)).toEqual({ status: "denied", reason: "human-choice-required" })
    human.choose = true
    const recorded = await mutations.recordChoice(choiceRequest, fixture.context)
    if (recorded.status !== "ok") throw new Error(`Original choice: ${JSON.stringify(recorded)}`)
    const historical = await fixture.state.read(fixture.request, "cases", (state) => state.cases[fixture.caseRef.id])
    if (historical.status !== "ok" || !historical.value) throw new Error("Historical choice unavailable")
    const choice = structuredClone(historical.value.choices[0]!)
    expect(historical.value.version).toBe(2)
    expect(choice).toMatchObject({ alternativeVersion: 1, comparisonStatus: "conditioned", result: { knownSubtotal: 210000, total: null } })
    expect(choice.costCoverage.derivedMissingCategoryIds).toContain("training")
    expect(choice.result).toEqual(fixture.selectedResult)
    expect(choice.scenario.operations).toHaveLength(3)
    const originalDigest = digestSfValue(choice)
    const originalSource = structuredClone(fixture.sourceRefs.find((ref) => ref.refId === choice.scenario.baseRef)!)
    const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }

    // This explicit fixture update supplies the newly received quote. The workflow below is read-only in Planner.
    await fixture.store.transaction("planner", async (snapshot) => {
      if (!Array.isArray(snapshot.data.versions)) throw new Error("Planner versions unavailable")
      const version = object(snapshot.data.versions.find((item) => object(item).id === originalSource.target.recordId))
      if (!Array.isArray(version.lines)) throw new Error("Selected Planner lines unavailable")
      version.lines.push({ id: "training", sec: "opex", el: "licenses", cur: "USD", b: Array.from({ length: 12 }, (_, month) => month === 10 ? 40000 : 0), a: Array(12).fill(null), f: Array.from({ length: 12 }, (_, month) => month === 10 ? 40000 : 0) })
      return { commit: true, value: true }
    })
    const projection = await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: projectPlannerSource(snapshot, actor, originalSource.target.recordId) }))
    if (!projection) throw new Error("Current Planner source unavailable")
    const unsigned: RecordEvidence = { ...originalSource, refDigest: "", target: { ...originalSource.target, version: 2, projectionDigest: digestSfValue({ versionId: originalSource.target.recordId, projection }) } }
    const currentSource = { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) }
    fixture.sourceRefs.splice(fixture.sourceRefs.findIndex((ref) => ref.refId === originalSource.refId), 1, currentSource)
    const basis = { ...fixture.basis, version: 2, sourceRefs: structuredClone(fixture.sourceRefs) }
    const coverage = await renewalCoverage({ ...fixture, basis }, "confirmed")
    expect(coverage.assessment.coverageState).toBe("complete")
    // The assertion observes a detached entry; its asymmetric matcher must not
    // share the live classification inputs used by the canonical reassessment.
    const coverageBeforeObservation = digestSfValue({ assessment: coverage.assessment, entries: coverage.entries })
    const trainingObservation = structuredClone(coverage.assessment.entries.find((entry) => entry.categoryId === "training"))
    expect(trainingObservation).toMatchObject({ status: "included", componentRefs: expect.arrayContaining(["training:11"]) })
    expect(digestSfValue({ assessment: coverage.assessment, entries: coverage.entries })).toBe(coverageBeforeObservation)
    const plannerAfterQuote = await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    const writes = new WeakSet<object>()
    const makeState = (store: typeof fixture.store) => createSfProductState({
      persistence: store, proposalCoverageWrites: writes, createId: () => "unused-lifecycle-incarnation",
      resolveTarget: async () => ({ incarnation: fixture.caseRef.incarnation }),
      authorize: async (request) => request === fixture.request && await fixture.host.revalidate(fixture.context) ? { principalRef: "finance", policyVersion: "policy", accessRevision: "access" } : undefined,
    })
    const state = makeState(fixture.store)
    const authorizeCase = async (decision: DecisionCase, context: TrustedDomainContext) => decision.id === fixture.caseRef.id && decision.incarnation === fixture.caseRef.incarnation && decision.participants.includes(context.binding.principalRef) && await fixture.host.revalidate(context)
    const sourceFence = (snapshot: Snapshot) => human.sourceAllowed && digestSfValue({ versionId: currentSource.target.recordId, projection: projectPlannerSource(snapshot, actor, currentSource.target.recordId) }) === currentSource.target.projectionDigest
    const sourceCurrent = async () => human.sourceAllowed && await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: sourceFence(snapshot) }))
    const resolveEvidence = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext): Promise<readonly BusinessEvidenceResolution[]> => {
      const current = await sourceCurrent() && await fixture.host.revalidate(context)
      return Promise.all(refs.map(async (ref) => {
        if (!current) return { state: "revoked" as const, ref, accessRevision: "access", checkedAt: "2026-11-14T00:00:00Z" }
        if (digestSfValue(ref) === digestSfValue(coverage.statement)) return { state: "fresh" as const, ref, accessRevision: "access", checkedAt: "2026-11-14T00:00:00Z" }
        return fixture.evidence.resolve(ref, context)
      }))
    }
    const results = createSfDecisionResultStore({
      state, host: fixture.host, authorizeCase,
      verifySources: async (_result, refs, context) => (await resolveEvidence(refs, context)).every((item) => item.state === "fresh"),
      createId: () => `lifecycle-result-${++human.nextId}`, now: () => "2026-11-14T00:00:00Z",
    })
    const authorizeChoice = async (caseRef: typeof fixture.caseRef, candidate: ChoiceRecord, context: TrustedDomainContext) => {
      const loaded = await state.read(fixture.request, "cases", (value) => value.cases[caseRef.id])
      return loaded.status === "ok" && !!loaded.value && loaded.value.version === caseRef.version && await authorizeCase(loaded.value, context) && loaded.value.choices.filter((item) => item.id === candidate.id && digestSfValue(item) === digestSfValue(candidate)).length === 1
    }
    const persist = createPlannerResultPersistence({
      store: results, replay: fixture.planner,
      resolveCase: async (context) => {
        const loaded = await state.read(fixture.request, "cases", (value) => value.cases[fixture.caseRef.id])
        return loaded.status === "ok" && loaded.value && await authorizeCase(loaded.value, context) ? { status: "ok", value: { id: loaded.value.id, incarnation: loaded.value.incarnation, version: loaded.value.version } } : { status: "denied", reason: "case-unavailable" }
      },
    })
    const resimulate = createCurrentPlannerChoice({
      planner: fixture.planner, persist, store: results, authorizeChoice,
      issueSource: (versionId, context) => fixture.sources.resolveForecastSource(versionId, context),
      verifyContinuity: async (original, current, context) => digestSfValue(original) === digestSfValue(originalSource) && digestSfValue(current) === digestSfValue(currentSource) && await fixture.host.revalidate(context) && await sourceCurrent()
        ? { status: "ok", value: { fence: sourceCurrent, fenceSnapshot: sourceFence, revalidate: sourceCurrent } }
        : { status: "unavailable", reason: "source-continuity-unavailable" },
      operationIdentity: () => `wp11-lifecycle-current-producer-${human.round}`,
    })
    const registry = createProposalCoverageRegistry({
      state, host: fixture.host, authorizeCase, proposalCoverageWrites: writes,
      operationIdentity: () => `wp11-lifecycle-current-coverage-${human.round}`, now: () => "2026-11-14T00:00:00Z",
      verifyEvidence: async (record, context) => {
        if (digestSfValue(record.basis) !== digestSfValue(basis) || !(await resolveEvidence(record.sourceRefs, context)).every((item) => item.state === "fresh")) return false
        const replay = await fixture.planner.simulateScenario(record.scenario, context)
        if (replay.status !== "ok") return false
        const calculated = replay.value
        const attribution = { alternativeId: record.result.costCoverage.alternativeId, alternativeVersion: record.result.costCoverage.alternativeVersion }
        const attributed: ScenarioResult = calculated.comparisonStatus === "complete"
          ? { ...calculated, costCoverage: { ...calculated.costCoverage, ...attribution } }
          : { ...calculated, costCoverage: { ...calculated.costCoverage, ...attribution } }
        const expected = await reassessScenarioCoverage({ scenario: attributed, basis, baseline: coverage.assessment, entries: coverage.entries, resolveEvidence: (refs) => resolveEvidence(refs, context), supports: coverage.supports })
        return !!expected && digestSfValue(expected) === digestSfValue(record.result)
      },
      verifySnapshot: (snapshot, record) => sourceFence(snapshot) && digestSfValue(record.basis) === digestSfValue(basis),
    })
    const sources = {
      resolveForecastCoverage: async (reference: string, context: TrustedDomainContext) => reference === "current-training-inventory"
        ? await sourceCurrent() ? { status: "ok" as const, value: { coverageRef: reference, basis, assessment: coverage.assessment } } : { status: "unavailable" as const, reason: "current-coverage-unavailable" }
        : registry.resolveForecastCoverage(reference, context),
    }
    const preview = createCurrentChoicePreview({
      state, host: fixture.host, sources, results, authorizeCase, resimulate, writes,
      authorizePreview: async () => human.preview,
      registerCoverage: registry.registerProposalCoverage,
      coverageEvidence: { entries: async () => ({ status: "ok", value: coverage.entries }), resolve: resolveEvidence, supports: coverage.supports, verifySnapshot: (snapshot, _result, candidateBasis) => sourceFence(snapshot) && digestSfValue(candidateBasis) === digestSfValue(basis) },
      verifySnapshot: (snapshot, _request, binding) => sourceFence(snapshot) && digestSfValue(binding.originalSource) === digestSfValue(originalSource) && digestSfValue(binding.source) === digestSfValue(currentSource),
      verifySources: async (binding, context) => {
        const valid = digestSfValue(binding.originalSource) === digestSfValue(originalSource) && digestSfValue(binding.source) === digestSfValue(currentSource) && await fixture.host.revalidate(context) && await sourceCurrent()
        if (valid && human.raceCase) {
          human.raceCase = false
          const latest = await state.read(fixture.request, "cases", (value) => value.cases[fixture.caseRef.id])
          if (latest.status !== "ok" || !latest.value) throw new Error("Concurrent case unavailable")
          const changed = await state.transaction(fixture.request, { namespace: "cases", expectedStorageVersion: latest.storageVersion, targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation, idempotencyKey: "wp11-lifecycle-case-race", commandDigest: digestSfValue({ objective: "Review the training quote with updated context" }) }, async (value) => {
            const current = value.cases[fixture.caseRef.id]!
            value.cases[fixture.caseRef.id] = { ...current, version: current.version + 1, objective: "Review the training quote with updated context" }
            return { commit: true, value: true }
          })
          if (changed.status !== "ok") throw new Error("Concurrent case edit failed")
        }
        return valid
      },
      operationIdentity: () => `wp11-lifecycle-preview-${human.round}`,
    })
    const makePromotion = (currentState: SfProductStatePort) => createCurrentChoicePromotion({
      state: currentState, host: fixture.host, sources, authorizeCase,
      authorizePromotion: async () => human.promote,
      verifyProvenance: async (request, candidate, result, context) => {
        const binding = await preview.read(request, context)
        return binding.status === "ok" && digestSfValue(candidate) === originalDigest && result.resultDigest === request.resultDigest && await sourceCurrent()
      },
      verifySnapshot: (snapshot, _request, candidate) => sourceFence(snapshot) && digestSfValue(candidate) === originalDigest,
      operationIdentity: () => "wp11-lifecycle-human-promotion", now: () => "2026-11-14T00:00:00Z",
    })
    const promotion = makePromotion(state)
    const previewRequest = { caseRef: recorded.value.caseRef, choiceId: choice.id, alternativeRef: { id: "selected", version: 1 }, coverageRef: "current-training-inventory" }
    expect((await preview.prepare(previewRequest, fixture.context)).status).toBe("denied")
    human.preview = true
    expect((await preview.prepare({ ...previewRequest, alternativeRef: { id: "selected", version: 9 } }, fixture.context)).status).toBe("stale")
    const firstPrepared = await preview.prepare(previewRequest, fixture.context)
    if (firstPrepared.status !== "ok") throw new Error(`Current choice preview: ${JSON.stringify(firstPrepared)}`)
    const previewResult = await results.read({ kind: "scenario", resultRef: firstPrepared.value.promotion.resultRef }, fixture.context)
    if (previewResult.status !== "ok" || previewResult.value.kind !== "scenario") throw new Error("Current choice result unavailable")
    expect(previewResult.value.result).toMatchObject({ knownSubtotal: 250000, total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "complete", alternativeId: "selected", alternativeVersion: 2 } })
    expect(firstPrepared.value.promotion.scenario).toEqual(choice.scenario)
    expect(await preview.prepare(previewRequest, fixture.context)).toEqual(firstPrepared)
    const beforePromotion = await state.read(fixture.request, "cases", (value) => value.cases[fixture.caseRef.id])
    if (beforePromotion.status !== "ok" || !beforePromotion.value) throw new Error("Case before promotion unavailable")
    expect(beforePromotion.value.version).toBe(2)
    expect(beforePromotion.value.choices).toEqual([choice])
    expect(beforePromotion.value.alternatives.find((item) => item.id === "selected")?.result.knownSubtotal).toBe(210000)
    expect((await promotion(firstPrepared.value.promotion, fixture.context)).status).toBe("denied")
    human.promote = true
    expect((await promotion({ ...firstPrepared.value.promotion, resultDigest: "f".repeat(64) }, fixture.context)).status).toBe("denied")
    human.sourceAllowed = false
    expect((await preview.read(firstPrepared.value.promotion, fixture.context)).status).not.toBe("ok")
    expect((await promotion(firstPrepared.value.promotion, fixture.context)).status).toBe("denied")
    human.sourceAllowed = true
    // The actor remains authorized while another C08 write advances the case during source verification.
    human.raceCase = true
    expect((await preview.read(firstPrepared.value.promotion, fixture.context)).status).not.toBe("ok")
    const raced = await state.read(fixture.request, "cases", (value) => value.cases[fixture.caseRef.id])
    if (raced.status !== "ok" || !raced.value) throw new Error("Concurrent case state unavailable")
    expect(raced.value.version).toBe(3)
    expect(raced.value.choices).toEqual([choice])
    expect((await promotion(firstPrepared.value.promotion, fixture.context)).status).toBe("stale")
    human.round = 2
    const prepared = await preview.prepare({ ...previewRequest, caseRef: { ...recorded.value.caseRef, version: 3 } }, fixture.context)
    if (prepared.status !== "ok") throw new Error(`Refreshed choice preview: ${JSON.stringify(prepared)}`)
    const promoted = await promotion(prepared.value.promotion, fixture.context)
    if (promoted.status !== "ok") throw new Error(`Current choice promotion: ${JSON.stringify(promoted)}`)
    expect(promoted.value.caseRef).toEqual({ ...recorded.value.caseRef, version: 4 })
    expect(await promotion(prepared.value.promotion, fixture.context)).toEqual(promoted)
    expect((await promotion({ ...prepared.value.promotion, choiceDigest: "f".repeat(64) }, fixture.context)).status).toBe("conflict")
    expect(await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(plannerAfterQuote)

    // dispose() is idempotent; fixture.cleanup() can safely repeat it after this real restart.
    await fixture.store.dispose()
    const reopened = await openLocalStore(fixture.directory)
    try {
      const restoredState = makeState(reopened)
      const restored = await restoredState.read(fixture.request, "cases", (value) => ({ decision: value.cases[fixture.caseRef.id], result: value.decisionResults?.[promoted.value.resultRef] }))
      if (restored.status !== "ok" || !restored.value.decision) throw new Error("Current choice after reopen unavailable")
      expect(restored.value.decision.version).toBe(4)
      expect(restored.value.decision.state).toBe("reconsidering")
      expect(restored.value.decision.choices).toEqual([choice])
      expect(digestSfValue(restored.value.decision.choices[0])).toBe(originalDigest)
      expect(restored.value.decision.ledger.filter((event) => event.kind === "choice-recorded")).toHaveLength(1)
      expect(restored.value.decision.alternatives.find((item) => item.id === "selected")).toMatchObject({ version: 2, result: { knownSubtotal: 250000, comparisonStatus: "conditioned", total: null } })
      expect(restored.value.result).toMatchObject({ caseRef: promoted.value.caseRef, resultDigest: prepared.value.promotion.resultDigest })
      expect(restored.value.decision.preparedChanges).toEqual([])
      expect(restored.value.decision.receipts).toEqual([])
      expect(await makePromotion(restoredState)(prepared.value.promotion, fixture.context)).toEqual(promoted)
      const afterRetry = await restoredState.read(fixture.request, "cases", (value) => value.cases[fixture.caseRef.id])
      if (afterRetry.status !== "ok") throw new Error("Reopened retry state unavailable")
      expect(afterRetry.value).toEqual(restored.value.decision)
      expect(await reopened.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(plannerAfterQuote)
    } finally { await reopened.dispose() }
  } finally { await fixture.cleanup() }
}, 180000)
