import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { readCaseAnalysisProjection } from "../../../../product/interface/case-analysis-input.ts"
import { withWp12NativeMissionHost } from "../../wp12/native-mission-harness.ts"
import { initializeWp12ScenarioSources, prepareWp12ScenarioCase, WP12_SCENARIO_HUMAN_ACTIONS,
  WP12_SCENARIO_OPERATIONS } from "../../wp12/native-scenario-preparation.ts"

const cases = [
  { key: "baseline", subtotal: 240_000, observedTotal: 240_000, coverage: "complete" },
  { key: "pending", subtotal: 210_000, observedTotal: null, coverage: "pending" },
  { key: "complete", subtotal: 250_000, observedTotal: 250_000, coverage: "complete" },
] as const

/** Regression for CI200-AM01-HYPOTHETICAL-TOTAL: empty operations are a
 * valid Planner observation, not a preview. Only an actual, source-derived
 * operation exercises hypothetical semantics; no fake producer, grant or
 * inference output is installed by this fixture. */
test("AM01 source observation differs from the persisted, un-applied hypothetical renewal preview", async () => {
  await withWp12NativeMissionHost({ label: "am01-hypothetical-closure212", initialize: initializeWp12ScenarioSources,
    operations: WP12_SCENARIO_OPERATIONS, humanActions: WP12_SCENARIO_HUMAN_ACTIONS }, async ({ open }) => {
    const initial = await open("initial", async (context) => {
      const prepared = await prepareWp12ScenarioCase(context)
      const resultDigests: Record<string, string> = {}
      for (const variant of cases) {
        const alternative = prepared[variant.key]
        const source = prepared.sources.find((entry) => entry.key === variant.key)
        if (!source) throw new Error("The original Planner source was not issued for " + variant.key)
        const request = { baseRef: source.evidence.refId, operations: [], assumptions: [] }
        const observed = await context.ui("sf_scenario_simulate", request, (call) =>
          context.business.planner.simulateScenario(request, call))
        if (observed.status !== "ok") throw new Error("The real Planner observation failed: " + observed.reason)

        // This is the precise producer branch that returned 240000 in run
        // 43775802204. It is CORRECT for complete source observations only.
        expect(observed.value.knownSubtotal).toBe(variant.subtotal)
        expect(observed.value.total).toBe(variant.observedTotal)
        expect(observed.value.comparisonStatus).toBe(variant.observedTotal === null ? "conditioned" : "complete")
        expect(observed.value.restrictions).not.toContain("preview-not-applied")
        expect(observed.value.unresolvedConditions).not.toContain("scenario-is-hypothetical")

        // In contrast, C09 stores a source-derived identity operation that
        // does not change a cost, but must be treated as an unapplied preview.
        expect(alternative.scenario.baseRef).toBe(source.evidence.refId)
        expect(alternative.scenario.assumptions).toEqual([])
        expect(alternative.scenario.operations).toHaveLength(1)
        const operation = alternative.scenario.operations[0]!
        expect(operation.kind).toBe("replace")
        expect(operation.targetRef).toBe("wp12-cost-service:1")
        const altered = alternative.result.components.filter((component) => component.evidenceState === "hypothetical")
        expect(altered).toHaveLength(1)
        expect(altered[0]?.id).toBe(operation.targetRef)
        expect(altered[0]?.amount).toBe(operation.amount)
        expect(alternative.result.knownSubtotal).toBe(variant.subtotal)
        expect(alternative.result.total).toBeNull()
        expect(alternative.result.comparisonStatus).toBe("conditioned")
        expect(alternative.result.unresolvedConditions).toContain("scenario-is-hypothetical")
        expect(alternative.result.restrictions).toContain("preview-not-applied")
        expect(alternative.result.costCoverage.coverageState).toBe(variant.coverage)
        expect(alternative.result.components.every((component) =>
          component.amount !== null && Number.isFinite(component.amount))).toBe(true)
        const training = alternative.result.components.filter((component) => component.id.startsWith("wp12-cost-training:"))
        if (variant.key === "pending") {
          expect(training).toHaveLength(0)
          expect(alternative.result.costCoverage.derivedMissingCategoryIds).toContain("training")
          expect(alternative.result.costCoverage.entries).toContainEqual(
            expect.objectContaining({ categoryId: "training", status: "pending", reason: "missing-category" }))
        } else {
          expect(training).toHaveLength(12)
          expect(alternative.result.costCoverage.derivedMissingCategoryIds).toEqual([])
          expect(alternative.result.costCoverage.entries.every((entry) => entry.status === "included")).toBe(true)
          expect(training.every((component) => component.evidenceState === "confirmed")).toBe(true)
          expect(training.filter((component) => component.amount === (variant.key === "baseline" ? 0 : 40_000)))
            .toHaveLength(variant.key === "baseline" ? 12 : 1)
        }
        resultDigests[variant.key] = digestSfValue(alternative.result)
      }
      expect(await context.persistence.transaction("planner", async (snapshot) => ({
        commit: false, value: digestSfValue(snapshot.data.versions),
      }))).toBe(prepared.plannerSourceDigest)
      return { caseRef: prepared.caseRef, caseDigest: digestSfValue(prepared.case),
        plannerSourceDigest: prepared.plannerSourceDigest, resultDigests, resultRefs: prepared.resultRefs,
        baseRefs: { baseline: prepared.baseline.scenario.baseRef, pending: prepared.pending.scenario.baseRef,
          complete: prepared.complete.scenario.baseRef } }
    })

    await open("reopened", async (context) => {
      const read = await readCaseAnalysisProjection(context.request(), context.services, initial.caseRef)
      if (read.status !== "ok") throw new Error("The saved C09 case was not readable after a fresh host open")
      expect(digestSfValue(read.value.case)).toBe(initial.caseDigest)
      expect(read.value.case.alternatives).toHaveLength(3)
      for (const variant of cases) {
        // The issued reference is opaque. Match the saved exact reference,
        // then require the same typed C09 result and operation after reopening.
        const matches = read.value.case.alternatives.filter((item) =>
          item.scenario.baseRef === initial.baseRefs[variant.key])
        expect(matches).toHaveLength(1)
        const alternative = matches[0]!
        expect(digestSfValue(alternative.result)).toBe(initial.resultDigests[variant.key])
        expect(alternative.scenario.operations).toHaveLength(1)
        expect(alternative.result.total).toBeNull()
        expect(alternative.result.unresolvedConditions).toContain("scenario-is-hypothetical")
        expect(alternative.result.restrictions).toContain("preview-not-applied")
      }

      // The last promotion shares the current case version, so its canonical
      // resultRef can be read through the real case-scoped C09 result store.
      const result = await context.ui("sf_case_read", { caseRef: encodeCaseRef(initial.caseRef) }, (call) =>
        context.business.withCase(call, initial.caseRef, {}, () =>
          context.business.results.read({ kind: "scenario", resultRef: initial.resultRefs.complete }, call)))
      if (result.status !== "ok" || result.value.status !== "ok" || result.value.value.kind !== "scenario")
        throw new Error("The persisted complete-preview resultRef was not readable under current case authority")
      expect(result.value.value.resultDigest).toBe(initial.resultDigests.complete)
      expect(result.value.value.result.total).toBeNull()
      expect(result.value.value.result.unresolvedConditions).toContain("scenario-is-hypothetical")
      expect(await context.persistence.transaction("planner", async (snapshot) => ({
        commit: false, value: digestSfValue(snapshot.data.versions),
      }))).toBe(initial.plannerSourceDigest)
      console.log("SF_AM01_HYPOTHETICAL_CLOSURE212:" + JSON.stringify({
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: initial.caseRef,
        sourceObservations: cases.map((item) => ({ key: item.key, total: item.observedTotal })),
        savedResultRefs: initial.resultRefs, resultDigests: initial.resultDigests,
        persistedReadback: true, sourceUnchanged: true, inferenceExecuted: false, gnativeAccepted: false,
      }))
    })
  })
}, 300_000)
