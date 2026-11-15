import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../product/contracts/schema-admission.ts"
import { object } from "../../../../runtime/contract.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission,
  readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "../../wp12/native-mission-harness.ts"
import type { Wp12CompletedNativeMission } from "../../wp12/native-mission-harness.ts"
import { initializeWp12ScenarioSources, prepareWp12ScenarioCase,
  WP12_SCENARIO_HUMAN_ACTIONS, WP12_SCENARIO_OPERATIONS,
  WP12_SCENARIO_PERIOD } from "../../wp12/native-scenario-preparation.ts"

const profiles = ["sf_finance", "sf_procurement", "sf_portfolio", "sf_maestro", "sf_reviewer"] as const
const skillId = "sf-consultar-memoria-decisoria"
const requiredTools = ["sf_decision_recall", "sf_knowledge_search", "sf_context_get", "sf_freshness_check"] as const

/** Five independent native runs of the same distributed skill, on one genuine
 * authorized C09 case with C10's omitted training category. This extends
 * portfolio-recall-proof.test.ts; it does not create a second WP12 harness.
 * It is not a substitute for the other seventeen specialist skill executions.
 */
test("AM01 shared recall runs under all five real profiles and reopens five separately persisted outputs", async () => {
  await withWp12NativeMissionHost({
    label: "am01-five-profile-recall",
    initialize: initializeWp12ScenarioSources,
    operations: [...WP12_SCENARIO_OPERATIONS, ...requiredTools, "sf_evidence_get"],
    humanActions: WP12_SCENARIO_HUMAN_ACTIONS,
  }, async ({ open }) => {
    const first = await open("initial", async (context) => {
      const scenario = await prepareWp12ScenarioCase(context, {
        objective: "Compare only current confirmed sources. Training is absent from one candidate; no historical decision is pre-authorized.",
      })
      expect(scenario.pending.result.knownSubtotal).toBe(210_000)
      expect(scenario.pending.result.costCoverage.derivedMissingCategoryIds).toContain("training")
      if (!context.services.productHttp || !context.services.analyses)
        throw new Error("Installed source host lacks real analysis HTTP or persistence")
      const completed: Wp12CompletedNativeMission[] = []
      const unavailable: string[] = []
      for (const profileId of profiles) {
        const selected = context.services.selected.find((entry) => entry.profile.id === profileId)
        const skill = selected?.skills.find((entry) => entry.id === skillId)
        if (!selected || !skill) throw new Error(`Host did not distribute ${profileId}/${skillId}`)
        for (const operation of requiredTools)
          expect(skill.allowedOperations.includes(operation) && selected.operationIds.includes(operation)).toBe(true)
        const objective = `Under ${profileId}, search ONLY the selected current case ${scenario.caseRef.id} and an explicitly EMPTY authorized historical precedent scope. Use sf_decision_recall, sf_knowledge_search, sf_context_get, and sf_freshness_check. Return a ready CaseRecall with zero matches and zero evidence refs. Preserve missing training as unknown, never infer a previous case or complete cost.`
        const request = {
          caseRef: scenario.caseRef, objective, profileId: selected.profile.id,
          profileVersion: selected.profile.version, skillId: skill.id, skillVersion: skill.version,
          manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1" as const,
          requestedOperationScope: [...skill.allowedOperations],
        }
        const incoming = {
          request, selection: { currentCase: scenario.caseRef, query: objective,
            recallScope: { cases: [], period: WP12_SCENARIO_PERIOD, includeHistorical: false } },
        }
        const prepare = async (value: unknown) => {
          const response = await context.services.productHttp!(
            context.request({ action: "prepare", input: value }, "/sucafina/planner?sf=workbench-analysis"), "planner")
          if (!response) throw new Error("Installed analysis prepare route was not handled")
          return { response, body: object(await response.json()) }
        }
        const current = await prepare(incoming)
        if (current.response.status !== 200 || current.body.status !== "ok")
          throw new Error(`Host refused authorized ${profileId} recall preparation: ${String(current.body.reason)}`)
        const decoded = decodeSfSkillInput("DecisionRecallInput", current.body.value)
        if (!decoded.ok) throw new Error(`Installed ${profileId} recall input failed its source schema`)
        expect(decoded.value).toEqual(incoming.selection)
        const wrongOperation = await prepare({ ...incoming, request: { ...request,
          requestedOperationScope: [...request.requestedOperationScope, "sf_change_prepare"] } })
        const wrongCase = await prepare({ ...incoming, selection: { ...incoming.selection,
          currentCase: { ...scenario.caseRef, incarnation: "other-incarnation" } } })
        const unknownCase = await prepare({ ...incoming, selection: { ...incoming.selection,
          recallScope: { ...incoming.selection.recallScope,
            cases: [{ id: "unauthorized-case", version: 1, incarnation: "unissued" }] } } })
        for (const denial of [wrongOperation, wrongCase, unknownCase]) {
          expect(denial.response.status).not.toBe(200)
          expect(denial.body.status).not.toBe("ok")
        }
        console.info("SF_AM01_PROFILE_RECALL_NEGATIVE:" + JSON.stringify({
          githubSha: process.env.GITHUB_SHA ?? null, profileId, skillId, caseRef: scenario.caseRef,
          inputDigest: digestSfValue(decoded.value), outsideGrantDenied: true,
          wrongIncarnationDenied: true, unissuedPrecedentDenied: true,
          missingTrainingWasNotConvertedToZero: true, inferenceExecuted: false,
        }))
        // A refused selection is never reused as authority for a later native run.
        // Obtain a fresh preparation of the exact original human selection.
        const restored = await prepare(incoming)
        expect(restored.response.status).toBe(200)
        expect(restored.body.status).toBe("ok")
        expect(digestSfValue(restored.body.value)).toBe(digestSfValue(decoded.value))
        const before = await context.human("analysis.read", { caseRef: scenario.caseRef },
          (call) => context.services.analyses!.list(call, scenario.caseRef))
        expect(before.status).toBe("ok")
        if (before.status !== "ok") throw new Error("Analysis list denied for the real case")
        if (!context.models.length) {
          observeWp12UnavailableMission(context, { request, skillInput: decoded.value })
          unavailable.push(profileId)
          continue
        }
        expectSpawn(import.meta.path)
        const actual = await executeWp12NativeMission(context, {
          request, skillInput: decoded.value, expectedKind: "CaseRecall",
          requiredTools: requiredTools.map((operation) => ({ operation })),
        })
        expect(actual.receipt.profileId).toBe(profileId)
        expect(actual.receipt.skillId).toBe(skillId)
        expect(actual.receipt.runId).toBe(actual.runRef)
        expect(actual.receipt.sourceDigest).toBe(skill.sourceDigest)
        expect(actual.receipt.instructionsDigest).toBe(skill.instructionsDigest)
        expect(actual.receipt.profileDigest).toBe(selected.profile.sourceDigest)
        if (actual.output.kind !== "CaseRecall" || actual.output.state !== "ready")
          throw new Error(`Provider returned a different or non-ready ${profileId} contribution`)
        expect(actual.output.payload.matches).toEqual([])
        expect(actual.output.evidenceRefs).toEqual([])
        completed.push(actual)
      }
      if (!context.models.length) expect(unavailable).toEqual([...profiles])
      else {
        expect(completed.map((value) => value.receipt.profileId)).toEqual([...profiles])
        expect(new Set(completed.map((value) => value.receipt.nativeSessionId)).size).toBe(5)
        expect(new Set(completed.map((value) => value.runRef)).size).toBe(5)
        expect(new Set(completed.map((value) => value.output.id)).size).toBe(5)
      }
      return { scenario, completed, unavailable }
    })
    await open("reopened", async (context) => {
      const checked = await context.ui("sf_case_read", { caseRef: first.scenario.caseRef },
        (call) => context.business.cases.read({ caseRef: first.scenario.caseRef }, call))
      expect(checked.status).toBe("ok")
      if (checked.status !== "ok") throw new Error("Case was not readable on a fresh product host")
      expect(digestSfValue(checked.value.case)).toBe(digestSfValue(first.scenario.case))
      for (const completed of first.completed) {
        const actual = await readWp12NativeMissionAfterReload(context, completed)
        expect(actual.output.id).toBe(completed.output.id)
        expect(actual.output.outputDigest).toBe(completed.output.outputDigest)
        expect(actual.html).toContain("Related decisions")
        expect(actual.html).toContain("None recorded.")
        console.info("SF_AM01_PROFILE_RECALL_CONSUMED:" + JSON.stringify({
          githubSha: process.env.GITHUB_SHA ?? null, profileId: completed.receipt.profileId,
          skillId, caseRef: completed.caseRef, runRef: completed.runRef,
          nativeSessionId: completed.receipt.nativeSessionId,
          sourceDigest: completed.receipt.sourceDigest, instructionsDigest: completed.receipt.instructionsDigest,
          manifestDigest: completed.receipt.manifestDigest, receipt: completed.receipt,
          actualModel: completed.actualModel, toolCallIds: completed.toolCallIds,
          outputRef: actual.output.id, outputDigest: actual.output.outputDigest,
          consumerRef: "handleSfAnalysis:output", observedAction: "reopened-host-rendered-persisted-output",
          negativeProbes: ["outside-grant", "wrong-incarnation", "unissued-precedent"],
          inferenceExecuted: true, missingTrainingRemainsUnknown: true,
        }))
      }
      if (first.unavailable.length)
        console.info("SF_AM01_PROFILE_RECALL_NOT_RUN:" + JSON.stringify({
          githubSha: process.env.GITHUB_SHA ?? null, profiles: first.unavailable,
          reason: "no-installed-model-compatible-with-native-host",
          noOutputOrConsumerClaim: true,
        }))
    })
  })
}, 900_000)
