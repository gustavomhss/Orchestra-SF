import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { ChoiceRecord } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import { createCurrentChoicePreview } from "../../../product/decisions/current-choice-preview.ts"
import { createCurrentChoicePromotion } from "../../../product/decisions/current-choice-promotion.ts"
import { createPlannerConfirmationObserver } from "../../../product/planner/confirmation.ts"
import { createCurrentPlannerChoice } from "../../../product/planner/current-choice.ts"
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { currentChoiceAuthorityFixture } from "./real-authority-fixture.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>

/** Historical choice and pending baseline coverage come from the authority fixture.
 * Every newly prepared result is made and replayed by the canonical Planner
 * through the real product/UI authority; the pre-seeded results are not adopted.
 */
test("real product authority prepares the canonical current Planner result, binds real coverage, and promotes only a separate exact human command", async () => {
  const fixture = await currentChoiceAuthorityFixture()
  try {
    const baseline = await fixture.registry.resolveForecastCoverage(fixture.promotion.coverageRef, fixture.context)
    if (baseline.status !== "ok") throw new Error(`Canonical baseline coverage unavailable: ${JSON.stringify(baseline)}`)
    const planner = createPlannerProduct({ host: fixture.product.host, scopedSources: fixture.persistence,
      coverageFor: (reference, context) => fixture.registry.resolveForecastCoverage(reference === fixture.currentSource.refId ? fixture.promotion.coverageRef : reference, context),
    })
    const continuity = createPlannerConfirmationObserver({ host: fixture.product.host, issueSource: planner.issueSource, planner: planner.planner })
    const proofs = new WeakMap<TrustedDomainContext, (snapshot: Snapshot) => boolean>()
    const verifyContinuity = async (original: RecordEvidence, current: RecordEvidence, context: TrustedDomainContext) => {
      if (digestSfValue(original) !== digestSfValue(fixture.originalSource) || digestSfValue(current) !== digestSfValue(fixture.currentSource)) return { status: "unavailable", reason: "unexpected-source-lineage" } as const
      const proof = await continuity.prepareResimulationContinuity(original, current, context)
      if (proof.status !== "ok" || !await proof.value.revalidate()) return { status: "unavailable", reason: "source-continuity-unavailable" } as const
      proofs.set(context, proof.value.fenceSnapshot)
      return proof
    }
    const resolveEvidence = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext): Promise<readonly BusinessEvidenceResolution[]> => {
      return Promise.all(refs.map(async (ref) => {
        const resolved = ref.kind === "record" && ref.target.surface === "planner"
          ? await planner.sources.resolveForecastSource(ref.refId, context) : undefined
        const current = resolved?.status === "ok" && digestSfValue(resolved.value.evidence) === digestSfValue(ref) && await fixture.product.host.revalidate(context)
        return { ref, state: current ? "fresh" as const : "unavailable" as const, accessRevision: context.binding.accessRevision, checkedAt: "2026-11-14T00:00:00Z" }
      }))
    }
    const authorizeChoice = async (reference: typeof fixture.caseRef, choice: ChoiceRecord, context: TrustedDomainContext) => {
      const request = fixture.product.host.requestFor(context)
      if (!request) return false
      const current = await fixture.product.state.read(request, "cases", (state) => state.cases[reference.id])
      return current.status === "ok" && !!current.value && current.value.incarnation === reference.incarnation && current.value.version === reference.version &&
        current.value.choices.filter((retained) => retained.id === choice.id && digestSfValue(retained) === digestSfValue(choice)).length === 1 &&
        await fixture.authorizeCase(current.value, context)
    }
    const persist = createPlannerResultPersistence({ store: fixture.results, replay: planner.planner,
      resolveCase: async (context) => {
        const request = fixture.product.host.requestFor(context)
        if (!request) return { status: "denied", reason: "case-authority-unavailable" }
        const current = await fixture.product.state.read(request, "cases", (state) => state.cases[fixture.caseRef.id])
        if (current.status !== "ok" || !current.value || !await fixture.authorizeCase(current.value, context)) return { status: "denied", reason: "case-authority-unavailable" }
        return { status: "ok", value: { id: current.value.id, incarnation: current.value.incarnation, version: current.value.version } }
      },
    })
    const operationIdentity = (context: TrustedDomainContext) => context.kind === "ui" ? fixture.product.ui.operationIdentity(context) : undefined
    const resimulate = createCurrentPlannerChoice({ fence: fixture.fence, host: fixture.product.host, planner: planner.planner, issueSource: planner.issueSource,
      persist, store: fixture.results, authorizeChoice, verifyContinuity, operationIdentity,
    })
    const preview = createCurrentChoicePreview({ state: fixture.product.state, host: fixture.product.host, fence: fixture.fence, results: fixture.results,
      sources: fixture.registry, writes: fixture.writes, authorizeCase: fixture.authorizeCase,
      authorizePreview: (request, context) => fixture.product.human.authorize(context, "decisions.edit", request),
      resimulate, registerCoverage: fixture.registry.registerProposalCoverage, operationIdentity,
      coverageEvidence: {
        entries: async (_scenario, assessment, context) => await fixture.product.host.revalidate(context)
          ? { status: "ok", value: structuredClone(assessment.entries) } : { status: "denied", reason: "coverage-authority-unavailable" },
        resolve: resolveEvidence,
        supports: () => { throw new Error("Pending inventory must not manufacture applicable categories") },
        verifySnapshot: (snapshot, _scenario, basis, context) => digestSfValue(basis) === digestSfValue(baseline.value.basis) && proofs.get(context)?.(snapshot) === true,
      },
      verifySnapshot: (snapshot, request, binding, context) => request.choiceId === fixture.choice.id &&
        digestSfValue(binding.originalSource) === digestSfValue(fixture.originalSource) && digestSfValue(binding.source) === digestSfValue(fixture.currentSource) &&
        proofs.get(context)?.(snapshot) === true,
      verifySources: async (binding, context) => (await verifyContinuity(binding.originalSource, binding.source, context)).status === "ok",
    })
    const request = { caseRef: fixture.caseRef, choiceId: fixture.choice.id, alternativeRef: fixture.promotion.alternativeRef, coverageRef: fixture.promotion.coverageRef }
    const before = await fixture.snapshot()
    expect((await preview.prepare(request, fixture.context)).status).toBe("denied")
    expect(digestSfValue(await fixture.snapshot())).toBe(digestSfValue(before))
    const post = new Request(fixture.request, { method: "POST", headers: { authorization: "cohort-session", origin: "https://example.test", "x-command": "human-prepares-canonical-current" } })
    const admitted = await fixture.product.human.admit(post, "decisions.edit", request)
    if (admitted.status !== "ok") throw new Error(`Exact human preview admission unavailable: ${JSON.stringify(admitted)}`)
    fixture.contexts.push(admitted.value)
    expect(await fixture.product.human.authorize(admitted.value, "decisions.edit", request)).toBe(true)

    const prepared = await preview.prepare(request, admitted.value)
    expect(prepared.status).toBe("ok")
    if (prepared.status !== "ok") throw new Error(`Canonical current-choice preparation unavailable: ${JSON.stringify(prepared)}`)
    expect(prepared.value.promotion.resultRef).not.toBe(fixture.promotion.resultRef)
    expect(prepared.value.promotion.scenario).toEqual({ ...fixture.choice.scenario, baseRef: fixture.currentSource.refId })
    const bound = await preview.read(prepared.value.promotion, admitted.value)
    if (bound.status !== "ok") throw new Error(`New canonical binding unavailable: ${JSON.stringify(bound)}`)
    expect(digestSfValue(bound.value)).toBe(prepared.value.bindingDigest)
    expect(bound.value.producerResultRef).not.toBe(fixture.binding.producerResultRef)
    expect(bound.value.originalSource).toEqual(fixture.originalSource)
    expect(bound.value.source).toEqual(fixture.currentSource)
    expect(bound.value.coverageDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(bound.value.coverageRecordDigest).toMatch(/^[a-f0-9]{64}$/)
    const produced = await fixture.results.read({ kind: "scenario", resultRef: bound.value.producerResultRef }, admitted.value)
    const reviewed = await fixture.results.read({ kind: "scenario", resultRef: prepared.value.promotion.resultRef }, admitted.value)
    if (produced.status !== "ok" || reviewed.status !== "ok" || produced.value.kind !== "scenario" || reviewed.value.kind !== "scenario") throw new Error("Canonical producer or reviewed result unavailable")
    const replay = await planner.planner.simulateScenario(prepared.value.promotion.scenario, admitted.value)
    if (replay.status !== "ok") throw new Error(`Canonical producer replay unavailable: ${JSON.stringify(replay)}`)
    expect(produced.value.result.id).toMatch(/^source-scenario:/)
    expect(digestSfValue(produced.value.result)).toBe(digestSfValue(replay.value))
    expect(produced.value.result.components.find((component) => component.id === "line:1")?.amount).toBe(200)
    expect(produced.value.result.knownSubtotal).toBe(200)
    expect(reviewed.value.result.knownSubtotal).toBe(200)
    expect(reviewed.value.result.total).toBeNull()
    expect(reviewed.value.result.comparisonStatus).toBe("conditioned")
    expect(reviewed.value.result.costCoverage.coverageState).toBe("pending")
    expect(reviewed.value.result.costCoverage.issues).toContain("inventory-unavailable")
    expect(reviewed.value.result.costCoverage.alternativeVersion).toBe(2)
    expect(prepared.value.promotion.coverageRef).not.toBe(fixture.promotion.coverageRef)
    const coverage = await fixture.registry.resolveForecastCoverage(prepared.value.promotion.coverageRef, admitted.value)
    if (coverage.status !== "ok") throw new Error(`New canonical coverage proof unavailable: ${JSON.stringify(coverage)}`)
    expect(coverage.value.assessment).toEqual(reviewed.value.result.costCoverage)
    expect(digestSfValue(coverage.value)).toBe(bound.value.coverageDigest)
    const afterPrepare = await fixture.snapshot()
    const preparedState = afterPrepare.dashboard.data.__sfProductV1 as SfProductState
    expect(preparedState.cases[fixture.caseRef.id]).toEqual(fixture.decision)
    expect(digestSfValue(afterPrepare.planner)).toBe(digestSfValue(before.planner))

    const promote = createCurrentChoicePromotion({ state: fixture.product.state, host: fixture.product.host, fence: fixture.fence, sources: fixture.registry,
      authorizeCase: fixture.authorizeCase, operationIdentity, now: () => "2026-11-14T00:00:00Z",
      authorizePromotion: (payload, context) => fixture.product.human.authorize(context, "decisions.promote-alternative", payload),
      verifyProvenance: async (payload, choice, result, context, receipt) => {
        if (digestSfValue(payload) !== digestSfValue(prepared.value.promotion) || digestSfValue(choice) !== digestSfValue(fixture.choice) || result.resultDigest !== payload.resultDigest) return false
        const current = await preview.read(payload, context, receipt)
        return current.status === "ok" && digestSfValue(current.value) === prepared.value.bindingDigest
      },
      verifySnapshot: (snapshot, payload, choice, result, context) => digestSfValue(payload) === digestSfValue(prepared.value.promotion) &&
        digestSfValue(choice) === digestSfValue(fixture.choice) && result.resultDigest === payload.resultDigest && proofs.get(context)?.(snapshot) === true,
    })
    expect((await promote(prepared.value.promotion, admitted.value)).status).toBe("denied")
    expect(digestSfValue(await fixture.snapshot())).toBe(digestSfValue(afterPrepare))
    const human = await fixture.admitPromotion(prepared.value.promotion, "human-promotes-canonical-current")
    const promoted = await promote(prepared.value.promotion, human.context)
    expect(promoted.status).toBe("ok")
    if (promoted.status !== "ok") throw new Error(`Canonical explicit promotion unavailable: ${JSON.stringify(promoted)}`)
    expect(promoted.value.caseRef).toEqual({ ...fixture.caseRef, version: 3 })
    const after = await fixture.snapshot()
    const state = after.dashboard.data.__sfProductV1 as SfProductState
    const decision = state.cases[fixture.caseRef.id]!
    expect(decision.choices).toEqual(fixture.decision.choices)
    expect(decision.alternatives[0]!.version).toBe(2)
    expect(decision.alternatives[0]!.scenario).toEqual(prepared.value.promotion.scenario)
    expect(decision.alternatives[0]!.result).toEqual(reviewed.value.result)
    expect(decision.preparedChanges).toEqual([])
    expect(decision.receipts).toEqual([])
    expect(decision.ledger).toEqual([])
    expect(state.decisionResults?.[promoted.value.resultRef]?.caseRef).toEqual(promoted.value.caseRef)
    expect(state.decisionResults?.[promoted.value.resultRef]?.resultDigest).toBe(prepared.value.promotion.resultDigest)
    expect(digestSfValue(after.planner)).toBe(digestSfValue(before.planner))
    expect(digestSfValue(after.procurement)).toBe(digestSfValue(before.procurement))
    expect(await promote(prepared.value.promotion, human.context)).toEqual(promoted)
    expect(digestSfValue(await fixture.snapshot())).toBe(digestSfValue(after))
    expect(fixture.events.producerCalls).toBe(0)
  } finally { await fixture.cleanup() }
})
