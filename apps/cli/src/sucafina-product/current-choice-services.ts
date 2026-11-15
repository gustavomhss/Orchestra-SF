import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { CostCoverageEntry, ScenarioResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductState, SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { object, type Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { sfRunSourceFence } from "../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import { encodeCaseRef, parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { createCurrentPlannerChoice } from "../../../../modules/sucafina/Sucafinav1/product/planner/current-choice.ts"
import { createCurrentChoicePreview, isCurrentChoiceFence, readCurrentChoiceBinding } from "../../../../modules/sucafina/Sucafinav1/product/decisions/current-choice-preview.ts"
import type { CurrentChoiceBinding, CurrentChoiceFence, CurrentChoicePreviewRequest } from "../../../../modules/sucafina/Sucafinav1/product/decisions/current-choice-preview.ts"
import { createCurrentChoicePromotion } from "../../../../modules/sucafina/Sucafinav1/product/decisions/current-choice-promotion.ts"
import type { CurrentChoicePromotion } from "../../../../modules/sucafina/Sucafinav1/product/decisions/current-choice-promotion.ts"
import { createProposalCoverageRegistry } from "../../../../modules/sucafina/Sucafinav1/product/decisions/proposal-coverage.ts"
import { supportsCoverageClassification } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-classification.ts"
import type { CoverageClassification } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-classification.ts"
import { verifyDecisionPlannerSources } from "../../../../modules/sucafina/Sucafinav1/product/decisions/baseline-fence.ts"
import { reassessScenarioCoverage } from "../../../../modules/sucafina/Sucafinav1/product/decisions/cost-coverage.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createSfDecisionPlannerActors } from "./decision-baseline-services.ts"
import type { createSfBusinessServices } from "./business-services.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
type SourceFences = Record<"dashboard" | "planner" | "procurement", string>
type Scope = { context: TrustedDomainContext; preparation?: CurrentChoicePreviewRequest; binding?: CurrentChoiceBinding; currentSource?: RecordEvidence; sources?: SourceFences; classificationDigest?: string }
export type SfCurrentChoiceOptions = { cases: readonly { ref: string; title: string; version: number }[]; selected?: {
  caseRef: CaseRef; title: string; choices: readonly { id: string; title: string; reason: string; request?: CurrentChoicePreviewRequest }[]
} }
export type SfCurrentChoiceReview = { promotion: CurrentChoicePromotion; bindingDigest: string; historical: ScenarioResult; current: ScenarioResult }

/** Host composition for human prepare/review/promote; no native capability or policy is added. */
export function createSfCurrentChoiceServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  fence: CurrentChoiceFence
  proposalCoverageWrites: WeakSet<object>
}) {
  if (!isCurrentChoiceFence(input.fence)) throw new Error("SF_CURRENT_CHOICE_REAL_FENCE_REQUIRED")
  const { authority, business, fence } = input
  const host = authority.host
  const scopes = new AsyncLocalStorage<Scope>()
  const actors = createSfDecisionPlannerActors(authority)
  const classifications = new WeakMap<object, CoverageClassification>()
  const scope = (call: TrustedDomainContext) => {
    const value = scopes.getStore()
    return value?.context === call && fence.current(call) ? value : undefined
  }
  const unavailable = (reason = "current-choice-unavailable") => ({ status: "unavailable" as const, reason })
  const sourceFences = (snapshots: Parameters<Parameters<CurrentChoiceFence["observe"]>[1]>[0]): SourceFences => ({
    dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement),
  })
  // Cohort writes append their own records, but never change the human's
  // baseline classification. Fence this private dependency as well as sources.
  const classificationInventory = (preferences: Readonly<SfProductState["preferences"]>) => Object.fromEntries(Object.entries(preferences).filter(([key]) =>
    key.startsWith("sf:proposal-coverage:baseline:") || key.startsWith("sf:proposal-coverage:classification:")))
  const readClassificationInventory = async (call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    if (!request) return undefined
    const found = await authority.state.read(request, "preferences", (state, actor) => sameActor(actor, call) ? classificationInventory(state.preferences) : undefined)
    return found.status === "ok" ? found.value : undefined
  }
  const captureSources = async (call: TrustedDomainContext, work: () => Promise<boolean>) => {
    const active = scope(call)
    const inventory = await readClassificationInventory(call)
    const before = await business.readSourceFences(call)
    if (!active || !inventory || !before || !await work()) return false
    const afterInventory = await readClassificationInventory(call)
    const after = await business.readSourceFences(call)
    if (!after || !afterInventory || !same(before, after) || !same(inventory, afterInventory) || scope(call) !== active) return false
    const captured = structuredClone(after)
    const privateDigest = digestSfValue(inventory)
    active.sources = captured
    active.classificationDigest = privateDigest
    fence.observe(call, (snapshots) => same(sourceFences(snapshots), captured) &&
      digestSfValue(classificationInventory(object(object(snapshots.dashboard.data.__sfProductV1).preferences))) === privateDigest)
    return true
  }
  const publicationFence = (snapshot: Snapshot, call: TrustedDomainContext) => {
    const expected = scope(call)?.sources
    // This callback also runs from final observers: it must remain synchronous
    // and side-effect-free, including no registration of another observer.
    return !!expected && sfRunSourceFence(snapshot) === expected.planner && same(business.lockedSourceFences(), expected) && fence.current(call)
  }
  const freshRefs = async (refs: readonly BusinessEvidenceRef[], call: TrustedDomainContext) => {
    const values = await business.context.context({ refs }, call)
    return values.length === refs.length && values.every((value, index) => value.state === "fresh" &&
      value.accessRevision === call.binding.accessRevision && !!value.authorizedProjection && !!value.currentRef &&
      same(value.ref, refs[index]) && same(value.currentRef, value.ref)) && fence.current(call)
  }
  const currentPlanner = (snapshot: Snapshot, source: RecordEvidence, call: TrustedDomainContext) => {
    const actor = actors.locked(snapshot, call)
    return !!actor && verifyDecisionPlannerSources(snapshot, [source], actor, call)
  }
  const lineage = (snapshot: Snapshot, original: RecordEvidence) => {
    const physical = snapshot.sfSources?.records[JSON.stringify([original.target.recordType, original.target.recordId])]
    const old = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.incarnation === original.target.incarnation &&
      entry.scope.recordType === original.target.recordType && entry.scope.recordId === original.target.recordId)
    return !!physical?.alive && old.length === 1 && old[0]!.sourceIncarnation === physical.incarnation && old[0]!.version >= original.target.version
  }
  const continuity: Parameters<typeof createCurrentPlannerChoice>[0]["verifyContinuity"] = async (original, current, call) => {
    if (!scope(call) || original.target.recordId !== current.target.recordId || original.target.recordType !== "planner-version" ||
      current.target.recordType !== "planner-version" || !await business.atlasRecall()?.proveContinuity(original, current, call) || !await actors.capture(call))
      return unavailable("current-choice-continuity-unavailable")
    const active = scope(call)
    if (!active) return unavailable()
    active.currentSource = structuredClone(current)
    const revalidate = async () => {
      const again = await business.plannerProduct.issueSource(current.target.recordId, call)
      return again.status === "ok" && same(again.value.evidence, current) &&
        !!await business.atlasRecall()?.proveContinuity(original, current, call) && fence.current(call)
    }
    return { status: "ok", value: { fence: revalidate, revalidate,
      fenceSnapshot: (snapshot) => fence.current(call) && lineage(snapshot, original) && currentPlanner(snapshot, current, call) } }
  }
  const resimulate = createCurrentPlannerChoice({ host, fence, planner: business.planner, issueSource: business.plannerProduct.issueSource,
    persist: business.calculations.persist, store: business.results, operationIdentity: business.operationIdentity,
    authorizeChoice: async (caseRef, choice, call) => {
      const active = scope(call)
      if (!active?.preparation || !same(active.preparation.caseRef, caseRef) || active.preparation.choiceId !== choice.id ||
        !await authority.human.authorize(call, "planner.preview", active.preparation)) return false
      const current = await business.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
      return current.status === "ok" && current.value.case.version === caseRef.version &&
        current.value.case.choices.filter((item) => same(item, choice)).length === 1 && fence.current(call)
    }, verifyContinuity: continuity })
  const coverageEvidence: Parameters<typeof createCurrentChoicePreview>[0]["coverageEvidence"] = {
    entries: async (scenario, baseline, call) => {
      const active = scope(call)
      const source = active?.currentSource
      if (!source || !scenario.sourceRefs.some((ref) => same(ref, source))) return unavailable("current-choice-coverage-source-unavailable")
      const classification = await business.baselineCoverage.readClassification(source.refId, call)
      if (classification.status !== "ok") return classification
      if (classification.value.basis.id !== baseline.basisId || classification.value.basis.version !== baseline.basisVersion) return { status: "needs-input", reason: "current-choice-coverage-classification-required" }
      const entries: readonly CostCoverageEntry[] = structuredClone(baseline.entries)
      for (const entry of entries) if (entry.status !== "pending") classifications.set(entry, classification.value)
      const refs = [classification.value.source, ...classification.value.basis.sourceRefs, ...scenario.sourceRefs,
        ...baseline.evaluatedSourceRefs, ...entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
        .filter((ref, index, all) => all.findIndex((other) => same(other, ref)) === index)
      // Resolve once to establish any real source scopes, then bracket the
      // canonical re-read. Owned preview observes this fence before registry
      // registration begins, so the publication basis must already exist here.
      if (!await freshRefs(refs, call) || !await captureSources(call, () => freshRefs(refs, call))) return unavailable("current-choice-coverage-evidence-unavailable")
      return { status: "ok", value: entries }
    },
    resolve: (refs, call) => business.context.context({ refs }, call),
    supports: (entry, evidence) => {
      const classification = classifications.get(entry)
      return !!classification && supportsCoverageClassification(classification, entry, evidence)
    },
    verifySnapshot: (snapshot, _result, _basis, call) => publicationFence(snapshot, call),
  }
  const coverage = createProposalCoverageRegistry({ state: authority.state, host, authorizeCase: business.authorizeCase,
    operationIdentity: business.operationIdentity, proposalCoverageWrites: input.proposalCoverageWrites, now: () => new Date().toISOString(),
    verifyEvidence: (record, call) => captureSources(call, async () => {
      const original = await business.baselineCoverage.resolveForecastCoverage(record.scenario.baseRef, call)
      const computed = await business.planner.simulateScenario(record.scenario, call)
      if (original.status !== "ok" || computed.status !== "ok" || !same(original.value.basis, record.basis)) return false
      const entries = await coverageEvidence.entries(computed.value, original.value.assessment, call)
      if (entries.status !== "ok") return false
      const attributed = { ...computed.value, costCoverage: { ...computed.value.costCoverage,
        alternativeId: record.assessment.alternativeId, alternativeVersion: record.assessment.alternativeVersion } } as ScenarioResult
      const evaluated = await reassessScenarioCoverage({ scenario: attributed, basis: original.value.basis, baseline: original.value.assessment,
        entries: entries.value, resolveEvidence: (refs) => coverageEvidence.resolve(refs, call), supports: coverageEvidence.supports })
      return !!evaluated && same(evaluated, record.result) && record.sourceRefs.length > 0 && await freshRefs(record.sourceRefs, call)
    }),
    verifySnapshot: (snapshot, _record, call) => publicationFence(snapshot, call),
  })
  const preview = createCurrentChoicePreview({ state: authority.state, host, fence, sources: {
    resolveForecastCoverage: (ref, call) => ref.startsWith("proposal-coverage:") ? coverage.resolveForecastCoverage(ref, call) : business.plannerSources.resolveForecastCoverage(ref, call),
  }, results: business.results,
    coverageEvidence, authorizeCase: business.authorizeCase,
    authorizePreview: (request, call) => authority.human.authorize(call, "planner.preview", request),
    resimulate, registerCoverage: coverage.registerProposalCoverage,
    verifySnapshot: (snapshot, _request, binding, call) => currentPlanner(snapshot, binding.source, call) && publicationFence(snapshot, call),
    verifySources: (binding, call) => captureSources(call, async () => {
      const active = scope(call)
      if (!active) return false
      const current = await business.plannerProduct.issueSource(binding.source.target.recordId, call)
      if (current.status !== "ok" || !same(current.value.evidence, binding.source)) return false
      const proof = await continuity(binding.originalSource, binding.source, call)
      if (proof.status !== "ok" || !await proof.value.revalidate()) return false
      const producer = await business.results.readHistoricalScenario({ resultRef: binding.producerResultRef }, call)
      const replay = await business.planner.simulateScenario(binding.promotion.scenario, call)
      if (producer.status !== "ok" || producer.value.kind !== "scenario" || replay.status !== "ok" ||
        producer.value.resultDigest !== binding.producerResultDigest || !same(producer.value.result, replay.value) || !await freshRefs(replay.value.sourceRefs, call)) return false
      active.binding = structuredClone(binding)
      return true
    }), operationIdentity: business.operationIdentity, writes: input.proposalCoverageWrites })
  const promote = createCurrentChoicePromotion({ state: authority.state, host, fence, sources: coverage,
    authorizeCase: business.authorizeCase, authorizePromotion: (request, call) => authority.human.authorize(call, "decisions.promote-alternative", request),
    verifyProvenance: async (request, _choice, _result, call, receipt) => (await preview.read(request, call, receipt)).status === "ok",
    verifySnapshot: (snapshot, _request, _choice, _result, call) => {
      const binding = scope(call)?.binding
      return !!binding && currentPlanner(snapshot, binding.source, call) && publicationFence(snapshot, call)
    }, operationIdentity: business.operationIdentity, now: () => new Date().toISOString() })
  const pinPrivateRead = async (call: TrustedDomainContext, caseId?: string, matches: (state: Readonly<SfProductState>) => boolean = () => true) => {
    const request = host.requestFor(call)
    if (!request || !fence.current(call)) return false
    const admitted = await authority.state.read(request, "preferences", (_state, actor) => sameActor(actor, call))
    if (admitted.status !== "ok" || !admitted.value) return false
    const found = await authority.state.read(request, "cases", (state, actor) => {
      if (!sameActor(actor, call) || !matches(state)) return false
      const active = scope(call)
      if (!active || active.classificationDigest && digestSfValue(classificationInventory(state.preferences)) !== active.classificationDigest) return false
      const expectedSources = active.sources && structuredClone(active.sources)
      if (expectedSources) fence.observe(call, (snapshots) => same(sourceFences(snapshots), expectedSources))
      const select = (value: Readonly<SfProductState>) => ({ cases: caseId ? value.cases[caseId] : value.cases,
        results: value.decisionResults, preferences: value.preferences })
      const expected = digestSfValue(select(state))
      fence.observe(call, (snapshots) => digestSfValue(select(object(snapshots.dashboard.data.__sfProductV1) as unknown as SfProductState)) === expected)
      return true
    })
    return found.status === "ok" && found.value && fence.current(call)
  }
  const run = async <T>(call: TrustedDomainContext, work: () => Promise<PortResult<T>>): Promise<PortResult<T>> => {
    if (call.kind !== "ui") return { status: "denied", reason: "current-choice-human-action-required" }
    try { return await scopes.run({ context: call }, () => fence.run(call, work)) }
    catch { return unavailable() }
    finally { actors.release(call) }
  }
  return {
    options: (wanted: string | undefined, call: TrustedDomainContext): Promise<PortResult<SfCurrentChoiceOptions>> => run(call, async () => {
      const request = host.requestFor(call)
      if (!request) return unavailable()
      const candidates = await authority.state.read(request, "cases", (state, actor) => sameActor(actor, call)
        ? Object.values(state.cases).filter((value) => value.participants.includes(actor.principalRef)).map((value) => encodeCaseRef(value)) : undefined)
      if (candidates.status !== "ok" || !candidates.value || candidates.value.length > 100) return unavailable()
      const cases: { ref: string; title: string; version: number }[] = []
      for (const ref of candidates.value) {
        const found = await business.cases.read({ caseRef: ref }, call)
        if (found.status === "ok") cases.push({ ref, title: found.value.case.objective, version: found.value.case.version })
      }
      const matchesCases = (state: Readonly<SfProductState>) => cases.every((item) => Object.values(state.cases).some((current) =>
        encodeCaseRef(current) === item.ref && current.version === item.version && current.objective === item.title && current.participants.includes(call.binding.principalRef)))
      if (!wanted) return await pinPrivateRead(call, undefined, matchesCases) ? { status: "ok", value: { cases } } : unavailable()
      if (!parseCaseRef(wanted) || !cases.some((value) => value.ref === wanted)) return { status: "denied", reason: "current-choice-case-unavailable" }
      const current = await business.cases.read({ caseRef: wanted }, call)
      if (current.status !== "ok") return current
      const decision = current.value.case
      const caseRef = { id: decision.id, incarnation: decision.incarnation, version: decision.version }
      return business.withCase(call, caseRef, {}, async () => {
        const choices: NonNullable<SfCurrentChoiceOptions["selected"]>["choices"][number][] = []
        const ready: { request: CurrentChoicePreviewRequest; original: RecordEvidence; source: RecordEvidence; coverageDigest: string }[] = []
        for (const choice of decision.choices) {
          const alternative = decision.alternatives.filter((value) => value.id === choice.alternativeId)
          const original = choice.result.sourceRefs.filter((ref): ref is RecordEvidence => ref.kind === "record" && ref.refId === choice.scenario.baseRef && ref.target.surface === "planner" && ref.target.recordType === "planner-version")
          const option = { id: choice.id, title: alternative[0]?.title ?? choice.alternativeId, reason: "A fonte ou a cobertura vigente requer revisão." }
          if (original.length !== 1 || alternative.length !== 1) { choices.push(option); continue }
          const source = await business.plannerProduct.issueSource(original[0]!.target.recordId, call)
          if (source.status !== "ok" || !await business.atlasRecall()?.proveContinuity(original[0]!, source.value.evidence, call)) { choices.push(option); continue }
          const baseline = await business.baselineCoverage.resolveForecastCoverage(source.value.evidence.refId, call)
          if (baseline.status !== "ok") { choices.push(option); continue }
          const selectedRequest: CurrentChoicePreviewRequest = { caseRef, choiceId: choice.id,
            alternativeRef: { id: alternative[0]!.id, version: alternative[0]!.version }, coverageRef: baseline.value.coverageRef }
          ready.push({ request: structuredClone(selectedRequest), original: structuredClone(original[0]!),
            source: structuredClone(source.value.evidence), coverageDigest: digestSfValue(baseline.value) })
          choices.push({ ...option, reason: "Recalcular com a fonte vigente e revisar antes de promover.", request: selectedRequest })
        }
        // Discovery is also a publication: a ready action must refer to the
        // exact sources and coverage observed above, including the final reads.
        // Initially unavailable choices remain disabled; changed ready proofs
        // invalidate this response instead of silently upgrading or replacing it.
        if (ready.length && !await captureSources(call, async () => {
          for (const expected of ready) {
            const emitted = choices.filter((choice) => choice.id === expected.request.choiceId && !!choice.request && same(choice.request, expected.request))
            if (emitted.length !== 1) return false
            const source = await business.plannerProduct.issueSource(expected.original.target.recordId, call)
            if (source.status !== "ok" || !same(source.value.evidence, expected.source) ||
              !await business.atlasRecall()?.proveContinuity(expected.original, source.value.evidence, call)) return false
            const baseline = await business.baselineCoverage.resolveForecastCoverage(source.value.evidence.refId, call)
            if (baseline.status !== "ok" || baseline.value.coverageRef !== expected.request.coverageRef ||
              digestSfValue(baseline.value) !== expected.coverageDigest || !same(emitted[0]!.request, expected.request)) return false
          }
          return true
        })) return unavailable("current-choice-options-changed")
        const after = await business.cases.read({ caseRef: wanted }, call)
        if (after.status !== "ok" || !same(after.value.case, decision) || !await pinPrivateRead(call, decision.id, (state) => matchesCases(state) && sameCaseProjection(state.cases[decision.id], decision))) return unavailable()
        return { status: "ok", value: { cases, selected: { caseRef, title: decision.objective, choices } } }
      })
    }),
    prepare: (request: CurrentChoicePreviewRequest, call: TrustedDomainContext): Promise<PortResult<SfCurrentChoiceReview>> => run(call, async () => {
      const active = scope(call)
      if (!active) return unavailable()
      active.preparation = structuredClone(request)
      return business.withCase(call, request.caseRef, {}, async () => {
        const prepared = await preview.prepare(request, call)
        if (prepared.status !== "ok") return prepared
        const verified = await preview.read(prepared.value.promotion, call)
        const result = await business.results.read({ resultRef: prepared.value.promotion.resultRef, kind: "scenario" }, call)
        const current = await business.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
        if (verified.status !== "ok" || result.status !== "ok" || result.value.kind !== "scenario" || current.status !== "ok") return unavailable()
        const history = current.value.case.choices.filter((choice) => choice.id === request.choiceId && digestSfValue(choice) === prepared.value.promotion.choiceDigest)
        if (history.length !== 1 || !await pinPrivateRead(call, request.caseRef.id, (state) => sameCaseProjection(state.cases[request.caseRef.id], current.value.case) &&
          same(state.decisionResults?.[result.value.resultRef], result.value) && same(readCurrentChoiceBinding(state, prepared.value.promotion), verified.value))) return unavailable()
        return { status: "ok", value: { ...prepared.value, historical: history[0]!.result, current: result.value.result } }
      })
    }),
    promote: (request: CurrentChoicePromotion, call: TrustedDomainContext) => run(call, async () => {
      // A retried operation keeps its original receipt selector while canonical
      // readers receive the current authorized case version for source checks.
      const current = await business.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
      if (current.status !== "ok") return current
      const selected = { id: current.value.case.id, incarnation: current.value.case.incarnation, version: current.value.case.version }
      return business.withCase(call, selected, {}, async () => {
        const result = await promote(request, call)
        if (result.status !== "ok") return result
        return await pinPrivateRead(call, request.caseRef.id, (state) => {
          const decision = state.cases[request.caseRef.id]
          const adopted = state.decisionResults?.[result.value.resultRef]
          return !!decision && decision.incarnation === result.value.caseRef.incarnation && decision.version === result.value.caseRef.version &&
            same(decision.choices, current.value.case.choices) && !!adopted && adopted.resultRef === result.value.resultRef &&
            same(adopted.caseRef, result.value.caseRef) && adopted.resultDigest === request.resultDigest && digestSfValue(adopted.result) === request.resultDigest
        }) ? result : unavailable()
      })
    }),
  }
}
function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
function sameActor(actor: SfStateAuthority, call: TrustedDomainContext) {
  return actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
}

/** The authorized port hides commands and receipt internals; this UI emits neither. */
function sameCaseProjection(raw: unknown, projected: unknown) {
  const shared = (value: unknown) => Object.fromEntries(Object.entries(object(value)).filter(([key]) => key !== "preparedChanges" && key !== "receipts"))
  return same(shared(raw), shared(projected))
}
