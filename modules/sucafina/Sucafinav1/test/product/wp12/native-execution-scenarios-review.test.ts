import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12CompletedNativeMission } from "./native-mission-harness.ts"
import { initializeWp12ScenarioSources, prepareWp12ScenarioCase, WP12_SCENARIO_HUMAN_ACTIONS, WP12_SCENARIO_OPERATIONS, WP12_SCENARIO_PERIOD } from "./native-scenario-preparation.ts"

test("native Finance preserves pending versus covered scenario costs and a fresh Reviewer critiques its real author", async () => {
  await withWp12NativeMissionHost({ label: "scenarios-review", initialize: initializeWp12ScenarioSources,
    operations: [...WP12_SCENARIO_OPERATIONS, "sf_evidence_get"], humanActions: WP12_SCENARIO_HUMAN_ACTIONS }, async ({ open }) => {
    const completed = await open("initial", async (context) => {
      const finance = context.services.selected.find((entry) => entry.profile.id === "sf_finance")
      const financeSkill = finance?.skills.find((entry) => entry.id === "sf-comparar-cenarios")
      const reviewer = context.services.selected.find((entry) => entry.profile.id === "sf_reviewer")
      const reviewSkill = reviewer?.skills.find((entry) => entry.id === "sf-contestar-decisao")
      if (!finance || !financeSkill || !reviewer || !reviewSkill || !context.services.productHttp || !context.services.analysisInputs)
        throw new Error("Real scenario/reviewer host selections are incomplete")
      const decision = await prepareWp12ScenarioCase(context)
      const prepared = []
      for (const variant of ["pending", "complete"] as const) {
        const alternative = decision[variant]
        const resultRefs = [decision.resultRefs.baseline, decision.resultRefs[variant]]
        const objective = `Compare somente as duas alternativas selecionadas, USD, ${WP12_SCENARIO_PERIOD.start} a ${WP12_SCENARIO_PERIOD.end}. Use sf_case_read, sf_scenario_simulate para as bases ${decision.baseline.scenario.baseRef} e ${alternative.scenario.baseRef} com operations e assumptions vazios, e sf_scenario_compare para os resultados persistidos ${JSON.stringify(resultRefs)} com criteria vazio. Produza ScenarioComparison idêntico ao resultado da comparação real, inclusive costCoverageRefs, diferença e condições; evidenceRefs deve conter as fontes distintas dessas duas alternativas.`
        const incoming = { request: { caseRef: decision.caseRef, objective, profileId: finance.profile.id, profileVersion: finance.profile.version,
          skillId: financeSkill.id, skillVersion: financeSkill.version, manifestDigest: finance.manifestDigest, outputSchemaVersion: "sf-contribution-v1",
          requestedOperationScope: ["sf_case_read", "sf_scenario_simulate", "sf_scenario_compare"] },
          selection: { caseRef: decision.caseRef, alternatives: [decision.baseline, alternative].map((item) => ({ id: item.id, version: item.version })) } }
        const response = await context.services.productHttp(context.request({ action: "prepare", input: incoming }, "/sucafina/planner?sf=workbench-analysis"), "planner")
        if (!response) throw new Error("The real scenario preparation route is missing")
        const body = object(await response.json())
        if (response.status !== 200 || body.status !== "ok") throw new Error(`Real scenario input preparation failed: ${String(body.reason)}`)
        const decoded = decodeSfSkillInput("ScenarioComparisonInput", body.value)
        if (!decoded.ok) throw new Error("Real scenario input failed its published schema")
        expect(decoded.value.currency).toBe("USD")
        expect(decoded.value.horizon).toEqual(WP12_SCENARIO_PERIOD)
        expect(decoded.value.costCoverageBases).toEqual(decision.case.costCoverageBases)
        expect(decoded.value.alternatives.map((item) => item.result)).toEqual([decision.baseline.result, alternative.result])
        prepared.push({ variant, incoming, input: decoded.value, resultRefs })
        console.log("SF_WP12_NATIVE_SCENARIO_INPUT:" + JSON.stringify({ scope: "real-host-http-input-producer", githubSha: process.env.GITHUB_SHA ?? null,
          caseRef: decision.caseRef, variant, inputDigest: digestSfValue(decoded.value), resultRefs, inferenceExecuted: false }))
      }
      expect(prepared).toHaveLength(2)
      expect(digestSfValue(prepared[0]!.input)).not.toBe(digestSfValue(prepared[1]!.input))
      const first = prepared[0]!
      const wrongVersion = { ...first.incoming, selection: { ...first.incoming.selection,
        alternatives: first.incoming.selection.alternatives.map((item, index) => index ? { ...item, version: item.version + 1 } : item) } }
      const refusedVersion = await context.human("analysis.prepare", wrongVersion, (call) => context.services.analysisInputs!.prepare(call, wrongVersion))
      expect(refusedVersion.status).not.toBe("ok")
      const changed = { ...first.incoming, request: { ...first.incoming.request, objective: "Unapproved scenario objective" } }
      const refusedAuthority = await context.human("analysis.prepare", first.incoming, (call) => context.services.analysisInputs!.prepare(call, changed))
      expect(refusedAuthority).toEqual({ status: "denied", reason: "analysis-input-authority-unavailable" })
      const caseDigest = digestSfValue(decision.case)
      if (!context.models.length) {
        for (const item of prepared) observeWp12UnavailableMission(context, { request: item.incoming.request, skillInput: item.input })
        console.log("SF_WP12_NATIVE_MISSION:" + JSON.stringify({ scope: "reviewer-prerequisite-observation", status: "unavailable", githubSha: process.env.GITHUB_SHA ?? null,
          skillId: reviewSkill.id, profileId: reviewer.profile.id, caseRef: decision.caseRef, reason: "real-author-analysis-not-executed-without-installed-model",
          inputPrepared: false, inferenceExecuted: false, outputRef: null, consumerRef: null, gnativeAccepted: false }))
        return [] satisfies Wp12CompletedNativeMission[]
      }
      expectSpawn(import.meta.path)
      const witnesses: Wp12CompletedNativeMission[] = []
      for (const item of prepared) {
        const restored = await context.human("analysis.prepare", item.incoming, (call) => context.services.analysisInputs!.prepare(call, item.incoming))
        if (restored.status !== "ok") throw new Error("The authorized scenario selection could not be restored")
        const witness = await executeWp12NativeMission(context, { request: item.incoming.request, skillInput: restored.value,
          expectedKind: "ScenarioComparison", requiredTools: [{ operation: "sf_case_read" }, { operation: "sf_scenario_simulate" }, { operation: "sf_scenario_compare" }] })
        if (witness.output.kind !== "ScenarioComparison") throw new Error("Native Finance returned a different kind")
        expect(witness.output.payload.baselineResultRef).toBe(item.resultRefs[0])
        expect(witness.output.payload.alternativeResultRef).toBe(item.resultRefs[1])
        expect(witness.output.payload.knownDifference).toBe(item.variant === "pending" ? -30_000 : 10_000)
        expect(witness.output.payload.completeDifference).toBe(item.variant === "pending" ? null : 10_000)
        expect(witness.output.payload.comparisonStatus).toBe(item.variant === "pending" ? "conditioned" : "complete")
        if (item.variant === "pending") expect(witness.output.payload.unresolvedConditions.length).toBeGreaterThan(0)
        else expect(witness.output.payload.unresolvedConditions).toEqual([])
        witnesses.push(witness)
      }
      const author = witnesses[0]!
      if (author.output.kind !== "ScenarioComparison") throw new Error("Reviewer author must be the persisted scenario comparison")
      const incoming = { request: { caseRef: decision.caseRef,
        objective: `Conteste a comparação autoral sem alterar nem aprovar a decisão. Use sf_case_read e sf_scenario_compare nos resultados ${JSON.stringify(first.resultRefs)} com criteria vazio. Entregue CritiqueReport com objeções e condições materiais descobertas nas fontes e na cobertura autorizadas. O host atribui targetRunId/reviewerRunId; não forneça esses campos no payload do modelo.`,
        profileId: reviewer.profile.id, profileVersion: reviewer.profile.version, skillId: reviewSkill.id, skillVersion: reviewSkill.version,
        manifestDigest: reviewer.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_case_read", "sf_scenario_compare"] },
        selection: { authorRunRef: author.runRef, outputDigest: author.output.outputDigest, choiceRefs: [],
          alternativeRefs: [decision.baseline.id, decision.pending.id], evidenceRefIds: author.output.evidenceRefs.map((ref) => ref.refId) } }
      const reviewResponse = await context.services.productHttp(context.request({ action: "prepare", input: incoming }, "/sucafina/planner?sf=workbench-analysis"), "planner")
      if (!reviewResponse) throw new Error("The real reviewer preparation route is missing")
      const reviewBody = object(await reviewResponse.json())
      if (reviewResponse.status !== 200 || reviewBody.status !== "ok") throw new Error(`Real reviewer input preparation failed: ${String(reviewBody.reason)}`)
      const reviewInput = decodeSfSkillInput("DecisionCritiqueInput", reviewBody.value)
      if (!reviewInput.ok) throw new Error("Real critique producer failed its schema")
      expect(reviewInput.value.authorAnalysis).toEqual({ runRef: author.runRef, outputDigest: author.output.outputDigest })
      expect(reviewInput.value.comparison).toEqual(author.output.payload)
      expect(reviewInput.value.authorizedEvidenceRefs).toEqual(author.output.evidenceRefs)
      const critique = await executeWp12NativeMission(context, { request: incoming.request, skillInput: reviewInput.value,
        expectedKind: "CritiqueReport", requiredTools: [{ operation: "sf_case_read" }, { operation: "sf_scenario_compare" }] })
      if (critique.output.kind !== "CritiqueReport") throw new Error("Native Reviewer returned a different kind")
      expect(critique.receipt.profileId).toBe("sf_reviewer")
      expect(critique.receipt.nativeSessionId).not.toBe(author.receipt.nativeSessionId)
      expect(critique.runRef).not.toBe(author.runRef)
      expect(critique.output.payload.targetRunId).toBe(author.runRef)
      expect(critique.output.payload.targetOutputDigest).toBe(author.output.outputDigest)
      expect(critique.output.payload.reviewerRunId).toBe(critique.runRef)
      expect(critique.output.payload.reviewerSessionId).toBe(critique.receipt.nativeSessionId)
      expect(critique.output.payload.unresolvedConditions.some((condition) => condition.category === "training" && !!condition.reason.trim()) ||
        critique.output.payload.claimIssues.some((issue) => issue.kind === "missing-category" && issue.claimRef === "training" && !!issue.reason.trim())).toBe(true)
      const after = await readCaseAnalysisProjection(context.request(), context.services, decision.caseRef)
      if (after.status !== "ok") throw new Error("The author case became unreadable after critique")
      expect(digestSfValue(after.value.case)).toBe(caseDigest)
      const retainedAuthor = await context.human("analysis.read", { runRef: author.runRef }, (call) => context.services.analyses!.output(call, author.runRef))
      if (retainedAuthor.status !== "ok") throw new Error("Reviewer did not preserve the author contribution")
      expect(digestSfValue(retainedAuthor.value)).toBe(digestSfValue(author.output))
      witnesses.push(critique)
      return witnesses
    })
    if (!completed.length) return
    await open("reopened", async (context) => {
      for (const witness of completed) {
        const consumed = await readWp12NativeMissionAfterReload(context, witness)
        if (consumed.output.kind === "ScenarioComparison") {
          expect(consumed.html).toContain(`Comparison: ${consumed.output.payload.comparisonStatus}`)
          expect(consumed.html).toContain(String(consumed.output.payload.knownDifference))
        } else if (consumed.output.kind === "CritiqueReport") {
          const training = consumed.output.payload.unresolvedConditions.find((condition) => condition.category === "training") ??
            consumed.output.payload.claimIssues.find((issue) => issue.kind === "missing-category" && issue.claimRef === "training")
          if (!training) throw new Error("The reopened critique lost its material training condition")
          expect(consumed.html).toContain(training.reason.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"))
        }
      }
    })
  })
}, 720_000)
