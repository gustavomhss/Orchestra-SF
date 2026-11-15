import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../product/contracts/schema-admission.ts"
import { object } from "../../../../runtime/contract.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload,
  withWp12NativeMissionHost } from "../../wp12/native-mission-harness.ts"
import { initializeWp12ScenarioSources, prepareWp12ScenarioCase, WP12_SCENARIO_HUMAN_ACTIONS,
  WP12_SCENARIO_OPERATIONS, WP12_SCENARIO_PERIOD } from "../../wp12/native-scenario-preparation.ts"

const operations = [...WP12_SCENARIO_OPERATIONS, "sf_decision_recall", "sf_knowledge_search", "sf_evidence_get", "sf_source_get"] as const

/** AM01-PORTFOLIO covers the shared recall skill under sf_portfolio itself.
 * The preexisting native recall mission exercises sf_maestro, and its
 * empty-result test cannot be relabelled as a portfolio skill execution.
 * A real scenario case and domain-produced C10 omission are reused; no
 * provider, successful output, permission or Atlas match is injected. */
test("AM01 portfolio loads shared recall under its own profile and consumes the native empty result without granting hidden precedents", async () => {
  await withWp12NativeMissionHost({ label: "am01-portfolio-recall",
    initialize: initializeWp12ScenarioSources, operations, humanActions: WP12_SCENARIO_HUMAN_ACTIONS }, async ({ open }) => {
    const initial = await open("initial", async (context) => {
      const scenario = await prepareWp12ScenarioCase(context, {
        objective: "Inspect the authorized renewal scenario without treating unrecorded training as zero or assuming a related decision exists.",
      })
      expect(scenario.pending.result.knownSubtotal).toBe(210_000)
      expect(scenario.pending.result.costCoverage.derivedMissingCategoryIds).toContain("training")
      const selection = context.services.selected.find((item) => item.profile.id === "sf_portfolio")
      const skill = selection?.skills.find((item) => item.id === "sf-consultar-memoria-decisoria")
      if (!selection || !skill || !context.services.productHttp || !context.services.analyses)
        throw new Error("The real host lacks the portfolio selection, shared skill, HTTP or analysis service")
      const objective = "Consult only the explicitly selected current case and empty authorized precedent scope. Use sf_decision_recall, sf_knowledge_search, sf_context_get and sf_freshness_check. Return CaseRecall with zero matches when no authorized precedent exists. Preserve the real missing training condition and never manufacture a related case or financial total."
      const request = { caseRef: scenario.caseRef, objective, profileId: selection.profile.id,
        profileVersion: selection.profile.version, skillId: skill.id, skillVersion: skill.version,
        manifestDigest: selection.manifestDigest, outputSchemaVersion: "sf-contribution-v1" as const,
        requestedOperationScope: [...skill.allowedOperations] }
      const input = { request, selection: { currentCase: scenario.caseRef, query: objective,
        recallScope: { cases: [], period: WP12_SCENARIO_PERIOD, includeHistorical: false } } }
      const prepare = async (value: unknown) => {
        const response = await context.services.productHttp!(context.request({ action: "prepare", input: value },
          "/sucafina/planner?sf=workbench-analysis"), "planner")
        if (!response) throw new Error("No installed analysis HTTP producer")
        return { response, body: object(await response.json()) }
      }
      const produced = await prepare(input)
      expect(produced.response.status).toBe(200)
      expect(produced.body.status).toBe("ok")
      const decoded = decodeSfSkillInput("DecisionRecallInput", produced.body.value)
      if (!decoded.ok) throw new Error("The installed portfolio recall input failed its skill schema")
      expect(decoded.value).toEqual(input.selection)

      // These are real HTTP/host boundaries; no test-supplied grant or
      // bypass is accepted even when the same case has a current source.
      const unauthorizedOperation = await prepare({ ...input,
        request: { ...request, requestedOperationScope: [...request.requestedOperationScope, "sf_change_prepare"] } })
      expect(unauthorizedOperation.response.status).not.toBe(200)
      expect(unauthorizedOperation.body.status).not.toBe("ok")
      const wrongIncarnation = await prepare({ ...input, selection: { ...input.selection,
        currentCase: { ...scenario.caseRef, incarnation: "forged-incarnation" } } })
      expect(wrongIncarnation.response.status).not.toBe(200)
      expect(wrongIncarnation.body.status).not.toBe("ok")
      const unknownPrecedent = await prepare({ ...input, selection: { ...input.selection,
        recallScope: { ...input.selection.recallScope,
          cases: [{ id: "unissued-case", incarnation: "unissued-incarnation", version: 1 }] } } })
      expect(unknownPrecedent.response.status).not.toBe(200)
      expect(unknownPrecedent.body.status).not.toBe("ok")
      const before = await context.human("analysis.read", { caseRef: scenario.caseRef },
        (call) => context.services.analyses!.list(call, scenario.caseRef))
      expect(before).toEqual({ status: "ok", value: [] })

      // Failed preparation has a separate human intention. Re-admit the
      // original selection on the native route before any provider execution.
      const current = await prepare(input)
      expect(current.response.status).toBe(200)
      expect(digestSfValue(current.body.value)).toBe(digestSfValue(decoded.value))
      console.log("SF_AM01_PORTFOLIO_RECALL_NEGATIVE:" + JSON.stringify({
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: scenario.caseRef,
        profileId: "sf_portfolio", skillId: skill.id, inputDigest: digestSfValue(decoded.value),
        operations: ["sf_change_prepare"], refused: ["operation-outside-skill-grant", "wrong-case-incarnation", "unissued-precedent"],
        deniedBeforeInference: true, unrelatedTrainingRemainsMissing: true, inferenceExecuted: false,
      }))
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request, skillInput: current.body.value })
        return { scenario, input, digest: digestSfValue(decoded.value), completed: undefined }
      }
      expectSpawn(import.meta.path)
      const completed = await executeWp12NativeMission(context, { request, skillInput: current.body.value,
        expectedKind: "CaseRecall",
        requiredTools: ["sf_decision_recall", "sf_knowledge_search", "sf_context_get", "sf_freshness_check"]
          .map((operation) => ({ operation })) })
      if (completed.output.kind !== "CaseRecall" || completed.output.state !== "ready")
        throw new Error("Real portfolio shared recall did not publish a ready CaseRecall")
      expect(completed.receipt.profileId).toBe("sf_portfolio")
      expect(completed.receipt.skillId).toBe("sf-consultar-memoria-decisoria")
      expect(completed.output.payload.matches).toEqual([])
      expect(completed.output.evidenceRefs).toEqual([])
      return { scenario, input, digest: digestSfValue(decoded.value), completed }
    })

    await open("reopened", async (context) => {
      const scenario = initial.scenario
      const checked = await context.ui("sf_case_read", { caseRef: scenario.caseRef }, (call) =>
        context.business.cases.read({ caseRef: scenario.caseRef }, call))
      expect(checked.status).toBe("ok")
      if (checked.status !== "ok") throw new Error("The actual scenario case became unavailable after reopen")
      expect(digestSfValue(checked.value.case)).toBe(digestSfValue(scenario.case))
      const http = context.services.productHttp
      if (!http) throw new Error("Reopened host lost its analysis input endpoint")
      const response = await http(context.request({ action: "prepare", input: initial.input },
        "/sucafina/planner?sf=workbench-analysis"), "planner")
      if (!response) throw new Error("Reopened input was not handled")
      const body = object(await response.json())
      expect(response.status).toBe(200)
      expect(digestSfValue(body.value)).toBe(initial.digest)
      if (!initial.completed) {
        console.log("SF_AM01_PORTFOLIO_RECALL_UNAVAILABLE:" + JSON.stringify({
          githubSha: process.env.GITHUB_SHA ?? null, profileId: "sf_portfolio",
          skillId: "sf-consultar-memoria-decisoria", caseRef: scenario.caseRef,
          inferenceExecuted: false, outputRef: null, consumerRef: null, status: "NOT_RUN",
          reason: "installed-native-model-unavailable",
        }))
        return
      }
      const reopened = await readWp12NativeMissionAfterReload(context, initial.completed)
      expect(reopened.output.kind).toBe("CaseRecall")
      if (reopened.output.kind !== "CaseRecall" || reopened.output.state !== "ready")
        throw new Error("Durable portfolio recall is no longer ready")
      expect(reopened.output.payload.matches).toEqual([])
      expect(reopened.html).toContain("Related decisions")
      expect(reopened.html).toContain("None recorded.")
      console.log("SF_AM01_PORTFOLIO_RECALL_CONSUMED:" + JSON.stringify({
        githubSha: process.env.GITHUB_SHA ?? null, profileId: initial.completed.receipt.profileId,
        profileVersion: initial.completed.receipt.profileVersion,
        profileDigest: initial.completed.receipt.profileDigest,
        skillId: initial.completed.receipt.skillId, skillVersion: initial.completed.receipt.skillVersion,
        sourceDigest: initial.completed.receipt.sourceDigest, instructionsDigest: initial.completed.receipt.instructionsDigest,
        manifestDigest: initial.completed.receipt.manifestDigest, nativeSessionId: initial.completed.receipt.nativeSessionId,
        runRef: initial.completed.runRef, caseRef: scenario.caseRef, actualModel: initial.completed.actualModel,
        accessRevision: initial.completed.accessRevision,
        inputDigest: initial.completed.inputDigest, outputRef: reopened.output.id, outputDigest: reopened.output.outputDigest,
        toolCallIds: initial.completed.toolCallIds, consumerRef: "handleSfAnalysis:output",
        consumerObservedAction: "reopened-host-rendered-persisted-output",
        unrelatedTrainingRemainsMissing: true, actualPrecedentObserved: false,
        inferenceExecuted: true, sourceGrantExpanded: false, negativeProbesObserved: true,
      }))
    })
  })
}, 240_000)
