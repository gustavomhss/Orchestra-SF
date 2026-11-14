import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import { chooseWp12Alternative } from "./native-choice-preparation.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12NativeMissionContext } from "./native-mission-harness.ts"
import { initializeWp12ProcurementSources, prepareWp12ProcurementCase, selectWp12ProcurementPeriod, WP12_PROCUREMENT_REQUEST_ID } from "./native-procurement-preparation.ts"
import { WP12_SCENARIO_HUMAN_ACTIONS, WP12_SCENARIO_OPERATIONS } from "./native-scenario-preparation.ts"

for (const variant of ["pending", "complete"] as const) test(`native purchase observes preparation boundaries and reopens the ${variant} human choice without approval or source mutation`, async () => {
  await withWp12NativeMissionHost({ label: `purchase-${variant}`,
    operations: [...WP12_SCENARIO_OPERATIONS, "sf_work_list", "sf_request_read", "sf_supplier_read", "sf_sourcing_compare", "sf_change_prepare", "sf_receipt_get"],
    humanActions: [...WP12_SCENARIO_HUMAN_ACTIONS, "decisions.portfolio.read", "decisions.criteria", "decisions.choose"],
    initialize: initializeWp12ProcurementSources }, async ({ open }) => {
    const completed = await open("initial", async (context) => {
      const prepared = await prepareWp12ProcurementCase(context, { selected: variant })
      const chosen = await chooseWp12Alternative(context, { caseRef: prepared.caseRef,
        baselineResultRef: prepared.baseline.resultRef, alternativeResultRef: prepared.candidate.resultRef,
        alternativeId: prepared.candidate.alternative.id, alternativeVersion: prepared.candidate.alternative.version,
        parameterRef: prepared.parameterRef, criterionId: prepared.criterionId, threshold: 20_000,
        reason: "Explicit human choice for an isolated purchase preparation; unresolved coverage remains part of its basis." })
      expect(chosen.choice.comparisonStatus).toBe(variant === "pending" ? "conditioned" : "complete")
      expect(chosen.choice.costCoverage.derivedMissingCategoryIds).toEqual(variant === "pending" ? ["training"] : [])
      const retainedCase = digestSfValue(chosen.case), before = await procurementDigest(context)
      const selected = context.services.selected.find((entry) => entry.profile.id === "sf_procurement")
      const skill = selected?.skills.find((entry) => entry.id === "sf-preparar-compra")
      const productHttp = context.services.productHttp, inputs = context.services.analysisInputs
      if (!selected || !skill || !productHttp || !inputs) throw new Error("The installed purchase mission is incomplete")
      const projection = await context.ui("sf_request_read", { requestRef: prepared.requestEvidence.refId }, (call) =>
        context.business.procurement.read({ requestRef: prepared.requestEvidence.refId }, call))
      if (projection.status !== "ok") throw new Error(`Actual selected purchase read failed: ${projection.reason}`)
      const target = projection.value.context.sourceRefs.find((ref) => ref.type === "procurement-request" && ref.id === WP12_PROCUREMENT_REQUEST_ID)
      const targetSelection = target ? { id: target.id, fields: target.fields }
        : { id: prepared.requestEvidence.target.recordId, fields: prepared.requestEvidence.target.fields }
      const compareRequest = { requestRef: prepared.requestEvidence.refId, proposalRefs: [], criteria: [] }
      const compared = await context.ui("sf_sourcing_compare", compareRequest, (call) => context.business.procurement.compareSourcing(compareRequest, call))
      if (compared.status !== "ok") throw new Error(`Actual purchase sourcing comparison failed: ${compared.reason}`)
      expect(compared.value.ranking[0]).toBe("wp12-offer-b")
      expect(compared.value.proposals.find((proposal) => proposal.proposalRef === "wp12-offer-a")?.convertedAmount).toBe(100)
      const incoming = { request: { caseRef: chosen.caseRef,
        objective: "Prepare um DossierDraft para a escolha humana atual. Leia sf_case_read e sf_request_read e consulte sf_sourcing_compare com proposalRefs e criteria vazios. Preserve as condições e fontes do domínio; esta missão não seleciona fornecedor, não aprova e não aplica mudanças.",
        profileId: selected.profile.id, profileVersion: selected.profile.version, skillId: skill.id, skillVersion: skill.version,
        manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1",
        requestedOperationScope: ["sf_case_read", "sf_request_read", "sf_sourcing_compare"] },
        selection: { choiceId: chosen.choice.id, requestRef: prepared.requestEvidence.refId,
          targets: [targetSelection], includeCommercialComparisons: false } }
      const response = await productHttp(context.request({ action: "prepare", input: incoming }, "/sucafina/procurement?sf=workbench-analysis"), "procurement")
      if (!response) throw new Error("The installed purchase preparation route is missing")
      const result = object(await response.json())
      const unsupported = { ...incoming, selection: { ...incoming.selection, includeCommercialComparisons: true } }
      expect(await context.human("analysis.prepare", unsupported, (call) => inputs.prepare(call, unsupported))).toMatchObject({ status: "unavailable", reason: "commercial-comparison-binding-unavailable" })
      if (!target) {
        expect(projection.value.context.sourceRefs).toEqual([])
        expect(chosen.case.preparedChanges).toHaveLength(0)
        expect(response.status).toBe(503)
        expect(result).toMatchObject({ status: "unavailable", reason: "analysis-input-producer-unavailable" })
        console.log("SF_WP12_NATIVE_PURCHASE_BOUNDARY:" + JSON.stringify({ scope: "real-choice-request-projection-and-target-selection",
          githubSha: process.env.GITHUB_SHA ?? null, skillId: skill.id, variant, caseRef: chosen.caseRef, choiceId: chosen.choice.id,
          requestEvidenceDigest: prepared.requestEvidence.refDigest, requestContextSourceCount: 0, preparedChangeCount: 0,
          ranking: compared.value.ranking, comparisonDigest: digestSfValue(compared.value), observedStatus: result.status,
          reason: "request-projection-exposes-no-selectable-change-target", unsupportedComparisonReason: "commercial-comparison-binding-unavailable",
          inputPrepared: false, inferenceExecuted: false, gnativeAccepted: false, outputRef: null }))
        await expectCaseDigest(context, chosen.caseRef, retainedCase)
        expect(await procurementDigest(context)).toBe(before)
        return { witness: undefined, retainedCase, before, caseRef: chosen.caseRef, inputPrepared: false }
      }
      if (response.status !== 200 || result.status !== "ok") throw new Error(`Actual PurchasePreparationInput failed: ${String(result.reason)}`)
      const decoded = decodeSfSkillInput("PurchasePreparationInput", result.value)
      if (!decoded.ok) throw new Error("Actual purchase input failed its canonical schema")
      expect(decoded.value.choice).toEqual(chosen.choice)
      expect(decoded.value.request).toEqual({ requestRef: prepared.requestEvidence.refId, version: prepared.requestEvidence.target.version, stage: "src_pending" })
      expect(decoded.value.allowedChangeTargets).toEqual([target])
      expect(decoded.value.commercialComparisons).toEqual([])
      for (const selection of [{ ...incoming.selection, choiceId: "absent-choice" },
        { ...incoming.selection, targets: [{ id: target.id, fields: ["not-an-authorized-target-field"] }] }]) {
        const denied = { ...incoming, selection }
        expect((await context.human("analysis.prepare", denied, (call) => inputs.prepare(call, denied))).status).not.toBe("ok")
      }
      console.log("SF_WP12_NATIVE_PURCHASE_INPUT:" + JSON.stringify({ scope: "real-choice-request-target-and-domain-ranking",
        githubSha: process.env.GITHUB_SHA ?? null, variant, caseRef: chosen.caseRef, choiceId: chosen.choice.id,
        inputDigest: digestSfValue(decoded.value), comparisonDigest: digestSfValue(compared.value), ranking: compared.value.ranking,
        commercialComparisonsIncluded: false, unsupportedSelectionReason: "commercial-comparison-binding-unavailable",
        preparedChangeSetExecuted: false, inferenceExecuted: false }))
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: decoded.value })
        await expectCaseDigest(context, chosen.caseRef, retainedCase)
        expect(await procurementDigest(context)).toBe(before)
        return { witness: undefined, retainedCase, before, caseRef: chosen.caseRef, inputPrepared: true }
      }
      await selectWp12ProcurementPeriod(context)
      const restored = await context.human("analysis.prepare", incoming, (call) => inputs.prepare(call, incoming))
      if (restored.status !== "ok") throw new Error("The real purchase input could not be revalidated before execution")
      expectSpawn(import.meta.path)
      const witness = await executeWp12NativeMission(context, { request: incoming.request, skillInput: restored.value,
        expectedKind: "DossierDraft", requiredTools: ["sf_case_read", "sf_request_read", "sf_sourcing_compare"].map((operation) => ({ operation })) })
      if (witness.output.kind !== "DossierDraft") throw new Error("The purchase mission returned another output kind")
      expect(witness.output.payload.requestRef).toBe(prepared.requestEvidence.refId)
      expect(witness.output.payload.requestVersion).toBe(prepared.requestEvidence.target.version)
      expect(witness.output.payload.alternatives).toEqual([chosen.choice.alternativeId])
      expect(witness.output.payload.gaps).toEqual(chosen.choice.costCoverage.issues)
      expect(witness.output.payload.domainApplied).toBe(false)
      if (variant === "pending") expect(witness.output.payload.conditions.some((condition) => condition.category === "training" && condition.reason === "missing-category")).toBe(true)
      else expect(witness.output.payload.conditions).toHaveLength(0)
      await expectCaseDigest(context, chosen.caseRef, retainedCase)
      expect(await procurementDigest(context)).toBe(before)
      return { witness, retainedCase, before, caseRef: chosen.caseRef, inputPrepared: true }
    })
    await open("reopened", async (context) => {
      await selectWp12ProcurementPeriod(context)
      if (completed.witness) {
        const consumed = await readWp12NativeMissionAfterReload(context, completed.witness)
        if (consumed.output.kind !== "DossierDraft") throw new Error("The reopened purchase contribution changed its kind")
        expect(consumed.html).toContain("Purchase preparation")
      }
      const read = await readCaseAnalysisProjection(context.request(), context.services, completed.caseRef)
      if (read.status !== "ok") throw new Error(`The chosen case cannot be reopened: ${read.reason}`)
      expect(digestSfValue(read.value.case)).toBe(completed.retainedCase)
      expect(read.value.case.preparedChanges).toHaveLength(0)
      expect(read.value.case.receipts).toHaveLength(0)
      expect(await procurementDigest(context)).toBe(completed.before)
      console.log("SF_WP12_NATIVE_PURCHASE_CONSUMER:" + JSON.stringify({ scope: "real-human-choice-and-optional-native-dossier-reopened",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: completed.caseRef, consumerRef: "readCaseAnalysisProjection:sf_case_read",
        inputPrepared: completed.inputPrepared, choiceReopened: true, caseUnchanged: true, domainApplied: false,
        inferenceExecuted: !!completed.witness, outputRef: completed.witness?.output.id ?? null, gnativeAccepted: false }))
    })
  })
}, 360_000)

async function procurementDigest(context: Wp12NativeMissionContext) {
  return context.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.store) }))
}

async function expectCaseDigest(context: Wp12NativeMissionContext, caseRef: { id: string; incarnation: string; version: number }, expected: string) {
  const read = await readCaseAnalysisProjection(context.request(), context.services, caseRef)
  if (read.status !== "ok") throw new Error(`The actual purchase case cannot be read: ${read.reason}`)
  expect(digestSfValue(read.value.case)).toBe(expected)
}
