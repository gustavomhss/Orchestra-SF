import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { chooseWp12Alternative } from "./native-choice-preparation.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import { initializeWp12PortfolioSources, postWp12Portfolio, postWp12PortfolioSelection, prepareWp12PortfolioCase,
  prepareWp12PortfolioMission, wp12PortfolioMissionRequest, wp12PreferenceVersion, WP12_PORTFOLIO_HUMAN_ACTIONS, WP12_PORTFOLIO_OPERATIONS } from "./native-portfolio-preparation.ts"

test("portfolio uses real operations, bounded domain combinations and explicit human alternative selection before native publication", async () => {
  await withWp12NativeMissionHost({ label: "portfolio-composition", operations: WP12_PORTFOLIO_OPERATIONS,
    humanActions: WP12_PORTFOLIO_HUMAN_ACTIONS, initialize: initializeWp12PortfolioSources }, async (harness) => {
    const initial = await harness.open("initial", async (context) => {
      const preparedCase = await prepareWp12PortfolioCase(context)
      const criterionId = preparedCase.case.criteria[0]?.id
      if (!criterionId) throw new Error("The actual portfolio case has no human criterion")
      const chosen = await chooseWp12Alternative(context, { caseRef: preparedCase.caseRef,
        baselineResultRef: preparedCase.baseline.resultRef, alternativeResultRef: preparedCase.lowerCost.resultRef,
        alternativeId: preparedCase.lowerCost.alternative.id, alternativeVersion: preparedCase.lowerCost.alternative.version,
        parameterRef: preparedCase.parameterRef, criterionId, threshold: -20_000,
        reason: "Human choice for a bounded comparison; the proposed values remain hypothetical and require confirmation before application." })
      const caseRef = chosen.caseRef
      await postWp12Portfolio(context, "decision-select-portfolio", { caseRef, baselineAlternativeId: preparedCase.baseline.alternative.id,
        alternativeId: preparedCase.lowerCost.alternative.id, criteria: [criterionId], expectedVersion: 0 })
      const candidateRefs = [preparedCase.lowerCost, preparedCase.trainingChange].map(({ alternative }) => portfolioCandidateRef({
        caseRef: encodeCaseRef(caseRef), caseVersion: caseRef.version, alternativeId: alternative.id, alternativeVersion: alternative.version }))
      const selection = { candidateRefs, constraints: [criterionId], priorities: [criterionId], explorationLimit: 2, operations: [] }
      const request = { scope: { horizon: chosen.case.horizon, currency: chosen.case.currency }, ...selection }
      const stored = await postWp12Portfolio(context, "decision-portfolio-evaluate", { caseRef, request })
      const portfolio = decodeSfOperationOutput("sf_portfolio_evaluate", stored.portfolio)
      if (!portfolio.ok || typeof stored.portfolioResultRef !== "string") throw new Error("The real portfolio route did not return its persisted domain result")
      expect(portfolio.value.combinations).toHaveLength(2)
      expect(portfolio.value.limitations).toContain("Finite exploration; no global optimum is asserted.")
      expect(portfolio.value.limitations).toContain("Exploration limit 2 reached.")
      expect(portfolio.value.combinations.every((combination) => combination.eligibility !== "eligible-complete")).toBe(true)
      expect(portfolio.value.combinations.every((combination) => combination.restrictions.length > 0)).toBe(true)

      const duplicate = await postWp12Portfolio(context, "decision-portfolio-preview", { caseRef,
        request: { ...request, candidateRefs: [candidateRefs[0]!], operations: [preparedCase.operations.reduction], explorationLimit: 1 } })
      const duplicateResult = decodeSfOperationOutput("sf_portfolio_evaluate", duplicate.portfolio)
      if (!duplicateResult.ok) throw new Error("The real portfolio duplicate-operation preview is invalid")
      expect(duplicateResult.value.combinations).toHaveLength(1)
      expect(duplicateResult.value.combinations[0]).toMatchObject({ eligibility: "ineligible", comparisonStatus: "incompatible",
        conflicts: [`duplicate-target:${preparedCase.parameterRef}`] })

      const alternativeRequest = { caseRef: encodeCaseRef(caseRef), proposal: { title: "Candidate to review",
        description: "Human-selected combination of the two existing proposed operations; no official amount or date is changed.", sourceRefs: [preparedCase.source] },
        sourceRefs: [preparedCase.source] }
      const alternativeSelection = await postWp12PortfolioSelection(context, "alternative-selection-set", { caseRef,
        request: alternativeRequest, scenario: preparedCase.combined.alternative.scenario, coverageRef: preparedCase.coverageRef,
        mutation: { expectedStorageVersion: await wp12PreferenceVersion(context), idempotencyKey: randomUUID() } })
      expect(alternativeSelection.request).toEqual(alternativeRequest)
      const objective = "Compare as combinações usando sf_portfolio_evaluate e o request exato do input. Preserve todas as restrições, o limite de exploração e a ausência de ótimo global. Use também sf_scenario_simulate no cenário selecionado e sf_alternative_draft com o pedido humano exato abaixo. Retorne PortfolioComparison com o resultado real da ferramenta, sem transformar subtotal condicionado em custo total completo. Pedido humano: " +
        JSON.stringify(alternativeRequest) + "; cenário selecionado: " + JSON.stringify(preparedCase.combined.alternative.scenario)
      const incoming = { request: wp12PortfolioMissionRequest(context, "sf_portfolio", "sf-compor-portfolio", caseRef, objective), selection }
      const prepared = await prepareWp12PortfolioMission(context, incoming)
      expect(prepared.response.status).toBe(200)
      const input = decodeSfSkillInput("PortfolioCompositionInput", prepared.body.value)
      if (!input.ok) throw new Error("The mounted portfolio producer did not return PortfolioCompositionInput")
      expect(input.value.request).toEqual(request)
      expect(input.value.candidates.map((entry) => entry.alternativeRef)).toEqual(candidateRefs)
      expect(input.value.candidates.every((entry) => entry.result.total === null && entry.result.comparisonStatus === "conditioned")).toBe(true)
      const repeatedCandidate = await prepareWp12PortfolioMission(context, { ...incoming,
        selection: { ...selection, candidateRefs: [candidateRefs[0]!, candidateRefs[0]!] } })
      expect(repeatedCandidate.response.status).toBe(503)
      expect(repeatedCandidate.body).toMatchObject({ status: "unavailable", reason: "analysis-source-unavailable" })
      const invalidLimit = await prepareWp12PortfolioMission(context, { ...incoming, selection: { ...selection, explorationLimit: 0 } })
      expect(invalidLimit.response.status).toBe(400)
      expect(invalidLimit.body).toMatchObject({ status: "needs-input", reason: "invalid-analysis-input" })
      const current = await prepareWp12PortfolioMission(context, incoming)
      expect(current.response.status).toBe(200)
      expect(digestSfValue(current.body.value)).toBe(digestSfValue(input.value))
      const before = await readCaseAnalysisProjection(context.request(), context.services, caseRef)
      if (before.status !== "ok") throw new Error("The portfolio case disappeared after read-only preparation")
      expect(digestSfValue(before.value.case)).toBe(digestSfValue(chosen.case))
      console.log("SF_WP12_NATIVE_PORTFOLIO_INPUT:" + JSON.stringify({ scope: "real-operations-portfolio-and-human-alternative-binding",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef, inputDigest: digestSfValue(input.value), portfolioResultRef: stored.portfolioResultRef,
        portfolioDigest: digestSfValue(portfolio.value), combinations: portfolio.value.combinations.length,
        limitations: portfolio.value.limitations, duplicateTargetRefused: true, candidateDuplicationRefused: true,
        alternativeSelectionDigest: digestSfValue(alternativeSelection), inferenceExecuted: false, domainApplied: false }))
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: current.body.value })
        return { incoming, inputDigest: digestSfValue(input.value), caseDigest: digestSfValue(chosen.case),
          resultRef: stored.portfolioResultRef, portfolio: portfolio.value, completed: undefined, alternative: undefined }
      }
      expectSpawn(import.meta.path)
      const requiredTools = ["sf_portfolio_evaluate", "sf_scenario_simulate", "sf_alternative_draft"].map((operation) => ({ operation }))
      const completed = await executeWp12NativeMission(context, { request: incoming.request, skillInput: current.body.value,
        expectedKind: "PortfolioComparison", requiredTools })
      if (completed.output.kind !== "PortfolioComparison" || completed.output.state !== "ready") throw new Error("Portfolio output kind changed")
      expect(completed.output.payload.limitations).toEqual(portfolio.value.limitations)
      expect(completed.output.payload.combinations.every((combination) => combination.eligibility !== "eligible-complete")).toBe(true)
      const draftIncoming = { ...incoming, request: { ...incoming.request,
        objective: "Use sf_portfolio_evaluate e sf_scenario_simulate para verificar a combinação humana. Execute sf_alternative_draft com este pedido exato e retorne AlternativeDraft com o resultado real, mantendo domainApplied=false e toda proveniência. Pedido: " + JSON.stringify(alternativeRequest) + "; cenário: " + JSON.stringify(preparedCase.combined.alternative.scenario) } }
      const draftInput = await prepareWp12PortfolioMission(context, draftIncoming)
      expect(draftInput.response.status).toBe(200)
      const alternative = await executeWp12NativeMission(context, { request: draftIncoming.request, skillInput: draftInput.body.value,
        expectedKind: "AlternativeDraft", requiredTools })
      if (alternative.output.kind !== "AlternativeDraft" || alternative.output.state !== "ready") throw new Error("The native alternative did not retain its own kind")
      expect(alternative.output.payload.domainApplied).toBe(false)
      expect(alternative.output.payload.proposal.scenario).toEqual(preparedCase.combined.alternative.scenario)
      return { incoming, inputDigest: digestSfValue(input.value), caseDigest: digestSfValue(chosen.case),
        resultRef: stored.portfolioResultRef, portfolio: portfolio.value, completed, alternative }
    })
    await harness.open("reopened", async (context) => {
      const stored = await postWp12Portfolio(context, "decision-portfolio-read", { caseRef: initial.incoming.request.caseRef, resultRef: initial.resultRef })
      expect(stored.portfolioResultRef).toBe(initial.resultRef)
      expect(digestSfValue(stored.portfolio)).toBe(digestSfValue(initial.portfolio))
      const prepared = await prepareWp12PortfolioMission(context, initial.incoming)
      expect(prepared.response.status).toBe(200)
      expect(digestSfValue(prepared.body.value)).toBe(initial.inputDigest)
      const current = await readCaseAnalysisProjection(context.request(), context.services, initial.incoming.request.caseRef)
      if (current.status !== "ok") throw new Error("The portfolio case cannot be reopened")
      expect(digestSfValue(current.value.case)).toBe(initial.caseDigest)
      if (initial.completed && initial.alternative) {
        const result = await readWp12NativeMissionAfterReload(context, initial.completed)
        const alternative = await readWp12NativeMissionAfterReload(context, initial.alternative)
        expect(result.output.kind).toBe("PortfolioComparison")
        expect(alternative.output.kind).toBe("AlternativeDraft")
      }
      console.log("SF_WP12_NATIVE_PORTFOLIO_CONSUMER:" + JSON.stringify({ scope: "real-portfolio-domain-result-and-optional-native-output-reopened",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: initial.incoming.request.caseRef, portfolioResultRef: initial.resultRef,
        consumerRef: "createSfPortfolioHttp:decision-portfolio-read", inputReopened: true, domainApplied: false,
        inferenceExecuted: !!initial.completed, outputRef: initial.completed?.output.id ?? null,
        alternativeOutputRef: initial.alternative?.output.id ?? null, gnativeAccepted: false }))
    })
  })
}, 420_000)

test("sensitivity uses an actual human choice, issued units and persisted samples before native explanation", async () => {
  await withWp12NativeMissionHost({ label: "portfolio-sensitivity", operations: WP12_PORTFOLIO_OPERATIONS,
    humanActions: WP12_PORTFOLIO_HUMAN_ACTIONS, initialize: initializeWp12PortfolioSources }, async (harness) => {
    const initial = await harness.open("initial", async (context) => {
      const preparedCase = await prepareWp12PortfolioCase(context)
      const criterionId = preparedCase.case.criteria[0]?.id
      if (!criterionId) throw new Error("The actual sensitivity case has no criterion")
      const chosen = await chooseWp12Alternative(context, { caseRef: preparedCase.caseRef,
        baselineResultRef: preparedCase.baseline.resultRef, alternativeResultRef: preparedCase.lowerCost.resultRef,
        alternativeId: preparedCase.lowerCost.alternative.id, alternativeVersion: preparedCase.lowerCost.alternative.version,
        parameterRef: preparedCase.parameterRef, criterionId, threshold: -20_000,
        reason: "Human selection of a hypothetical amount range; no total or breakpoint may be asserted beyond the domain evidence." })
      const request = { scenarioRef: preparedCase.lowerCost.resultRef,
        parameterBounds: { parameterRef: preparedCase.parameterRef, minimum: 180_000, maximum: 260_000, steps: 4 },
        criterion: { id: criterionId, operator: "lte" as const, value: -20_000 } }
      const stored = await postWp12Portfolio(context, "decision-sensitivity-evaluate", { caseRef: chosen.caseRef, request })
      const sensitivity = decodeSfOperationOutput("sf_sensitivity_evaluate", stored.sensitivity)
      if (!sensitivity.ok || typeof stored.sensitivityResultRef !== "string") throw new Error("The real sensitivity route did not persist its calculated result")
      expect(sensitivity.value.parameterUnit).toBe(chosen.units.parameterUnit)
      expect(sensitivity.value.resultUnit).toBe(chosen.units.resultUnit)
      expect(sensitivity.value.engineVersion).toBe(chosen.units.engineVersion)
      expect(sensitivity.value.bounds).toEqual({ minimum: 180_000, maximum: 260_000, steps: 4 })
      expect(sensitivity.value.costCoverageRefs.length).toBeGreaterThan(0)
      expect(sensitivity.value.evaluated.length).toBeGreaterThan(0)
      expect(sensitivity.value.comparisonStatus).not.toBe("complete")
      expect(sensitivity.value.unresolvedConditions.length).toBeGreaterThan(0)
      if (sensitivity.value.thresholdEvidence.state !== "exact") expect(sensitivity.value.threshold).toBeNull()
      const selected = await postWp12PortfolioSelection(context, "sensitivity-selection-set", { caseRef: chosen.caseRef,
        resultRef: stored.sensitivityResultRef,
        mutation: { expectedStorageVersion: await wp12PreferenceVersion(context), idempotencyKey: randomUUID() } })
      expect(selected).toHaveProperty("binding")
      const objective = "Explique a sensibilidade da escolha humana somente com os resultados reais de sf_sensitivity_evaluate e sf_scenario_simulate e os metadados de sf_source_get. Preserve unidades, limites, amostras, condições e a distinção entre limiar exato, intervalo amostrado e indisponibilidade. Retorne SensitivityResult sem inventar breakpoint. Request de domínio: " + JSON.stringify(request) + "; cenário: " + JSON.stringify(preparedCase.lowerCost.alternative.scenario)
      const incoming = { request: wp12PortfolioMissionRequest(context, "sf_finance", "sf-avaliar-sensibilidade", chosen.caseRef, objective),
        selection: { choiceRef: chosen.choice.id, request, parameterRanges: [request.parameterBounds] } }
      const prepared = await prepareWp12PortfolioMission(context, incoming)
      expect(prepared.response.status).toBe(200)
      const input = decodeSfSkillInput("SensitivityInput", prepared.body.value)
      if (!input.ok) throw new Error("The mounted sensitivity producer did not return SensitivityInput")
      expect(input.value.comparison).toEqual(chosen.choice.comparison)
      expect(input.value.parameterRanges).toEqual([request.parameterBounds])
      const wrongChoice = await prepareWp12PortfolioMission(context, { ...incoming,
        selection: { ...incoming.selection, choiceRef: "never-issued-choice" } })
      expect(wrongChoice.response.status).toBe(503)
      expect(wrongChoice.body).toMatchObject({ status: "unavailable", reason: "analysis-source-unavailable" })
      const changedRange = await prepareWp12PortfolioMission(context, { ...incoming,
        selection: { ...incoming.selection, parameterRanges: [{ ...request.parameterBounds, maximum: 300_000 }] } })
      expect(changedRange.response.status).toBe(400)
      expect(changedRange.body).toMatchObject({ status: "needs-input", reason: "invalid-analysis-input" })
      const current = await prepareWp12PortfolioMission(context, incoming)
      expect(current.response.status).toBe(200)
      expect(digestSfValue(current.body.value)).toBe(digestSfValue(input.value))
      console.log("SF_WP12_NATIVE_SENSITIVITY_INPUT:" + JSON.stringify({ scope: "real-choice-units-samples-and-human-selection",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: chosen.caseRef, choiceId: chosen.choice.id, ruleRef: chosen.ruleRef,
        sensitivityResultRef: stored.sensitivityResultRef, inputDigest: digestSfValue(input.value), unitsDigest: digestSfValue(chosen.units),
        sampleResultRefs: sensitivity.value.evaluated.map((point) => point.resultRef), thresholdEvidence: sensitivity.value.thresholdEvidence.state,
        comparisonStatus: sensitivity.value.comparisonStatus, inferenceExecuted: false, domainApplied: false }))
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: current.body.value })
        return { incoming, inputDigest: digestSfValue(input.value), caseDigest: digestSfValue(chosen.case),
          resultRef: stored.sensitivityResultRef, sensitivity: sensitivity.value, completed: undefined }
      }
      expectSpawn(import.meta.path)
      const completed = await executeWp12NativeMission(context, { request: incoming.request, skillInput: current.body.value,
        expectedKind: "SensitivityResult", requiredTools: ["sf_sensitivity_evaluate", "sf_scenario_simulate", "sf_source_get"].map((operation) => ({ operation })) })
      if (completed.output.kind !== "SensitivityResult" || completed.output.state !== "ready") throw new Error("Sensitivity output changed its kind")
      expect(completed.output.payload.parameterUnit).toBe(chosen.units.parameterUnit)
      expect(completed.output.payload.resultUnit).toBe(chosen.units.resultUnit)
      if (completed.output.payload.thresholdEvidence.state !== "exact") expect(completed.output.payload.threshold).toBeNull()
      return { incoming, inputDigest: digestSfValue(input.value), caseDigest: digestSfValue(chosen.case),
        resultRef: stored.sensitivityResultRef, sensitivity: sensitivity.value, completed }
    })
    await harness.open("reopened", async (context) => {
      const stored = await postWp12Portfolio(context, "decision-sensitivity-read", { caseRef: initial.incoming.request.caseRef, resultRef: initial.resultRef })
      expect(digestSfValue(stored.sensitivity)).toBe(digestSfValue(initial.sensitivity))
      const selected = await postWp12PortfolioSelection(context, "sensitivity-selection-read", { caseRef: initial.incoming.request.caseRef })
      expect(selected).toHaveProperty("binding")
      const prepared = await prepareWp12PortfolioMission(context, initial.incoming)
      expect(prepared.response.status).toBe(200)
      expect(digestSfValue(prepared.body.value)).toBe(initial.inputDigest)
      const current = await readCaseAnalysisProjection(context.request(), context.services, initial.incoming.request.caseRef)
      if (current.status !== "ok") throw new Error("The sensitivity case cannot be reopened")
      expect(digestSfValue(current.value.case)).toBe(initial.caseDigest)
      if (initial.completed) expect((await readWp12NativeMissionAfterReload(context, initial.completed)).output.kind).toBe("SensitivityResult")
      console.log("SF_WP12_NATIVE_SENSITIVITY_CONSUMER:" + JSON.stringify({ scope: "real-sensitivity-result-and-selection-reopened",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: initial.incoming.request.caseRef, sensitivityResultRef: initial.resultRef,
        consumerRef: "createSfPortfolioHttp:decision-sensitivity-read", selectionConsumerRef: "createSfAnalysisChoiceHttp:sensitivity-selection-read",
        inputReopened: true, inferenceExecuted: !!initial.completed, outputRef: initial.completed?.output.id ?? null,
        domainApplied: false, gnativeAccepted: false }))
    })
  })
}, 300_000)
