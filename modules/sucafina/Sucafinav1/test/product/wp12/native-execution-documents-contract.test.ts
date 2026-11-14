import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import type { DocumentEvidence } from "../../../product/contracts/decisions.ts"
import { parseSfDocumentScenarioRequest } from "../../../product/documents/scenario-inputs.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import { initializeWp12DocumentSources, prepareWp12Document, wp12PersistedDocumentServices, WP12_DOCUMENT_NAME, WP12_DOCUMENT_TEXT } from "./native-document-preparation.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12CompletedNativeMission, Wp12NativeMissionContext } from "./native-mission-harness.ts"
import { prepareWp12ProcurementCase, selectWp12ProcurementPeriod } from "./native-procurement-preparation.ts"
import { WP12_SCENARIO_HUMAN_ACTIONS, WP12_SCENARIO_OPERATIONS } from "./native-scenario-preparation.ts"

test("native document extraction uses real private bytes and schema; contract review retains the actual issued source surface", async () => {
  await withWp12NativeMissionHost({ label: "document-contract", assets: wp12PersistedDocumentServices(),
    operations: [...WP12_SCENARIO_OPERATIONS, "sf_work_list", "sf_request_read", "sf_contract_read", "sf_document_extract", "sf_evidence_get", "sf_knowledge_search", "sf_source_get"],
    humanActions: [...WP12_SCENARIO_HUMAN_ACTIONS, "documents.schema", "documents.confirm", "planner.preview"], initialize: initializeWp12DocumentSources }, async ({ open }) => {
    const completed = await open("initial", async (context) => {
      const document = await prepareWp12Document(context)
      const preparedCase = await prepareWp12ProcurementCase(context, { selected: "complete", includeContract: true })
      const caseDigest = digestSfValue(preparedCase.case)
      const selected = context.services.selected.find((entry) => entry.profile.id === "sf_procurement")
      const extraction = selected?.skills.find((entry) => entry.id === "sf-extrair-evidencias")
      const contractSkill = selected?.skills.find((entry) => entry.id === "sf-revisar-condicoes-contratuais")
      const productHttp = context.services.productHttp, inputs = context.services.analysisInputs
      if (!selected || !extraction || !contractSkill || !productHttp || !inputs || !preparedCase.contract)
        throw new Error("The installed document missions and actual contract source must be present")
      const base = { caseRef: preparedCase.caseRef, profileId: selected.profile.id, profileVersion: selected.profile.version,
        manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1" }
      const extractRequest = { ...base, skillId: extraction.id, skillVersion: extraction.version,
        objective: `Extraia a evidência definida pelo schema autorizado usando sf_document_extract. Releia a referência exata retornada pela extração com sf_evidence_get e pesquise o trecho com sf_knowledge_search. Use documentRef e fieldSchemaRef da seleção autorizada: ${document.documentRef}, ${document.schemaRef}. Preserve revisão, trecho e status de candidato sem confirmar ou aplicar.`,
        requestedOperationScope: ["sf_document_extract", "sf_evidence_get", "sf_knowledge_search"] }
      const extractIncoming = { request: extractRequest, selection: { caseRef: preparedCase.caseRef, documentRef: document.documentRef, fieldSchemaRef: document.schemaRef } }
      const extractResponse = await productHttp(context.request({ action: "prepare", input: extractIncoming }, "/sucafina/dashboard?sf=workbench-analysis"), "dashboard")
      if (!extractResponse) throw new Error("The actual extraction preparation route is missing")
      const extractResult = object(await extractResponse.json())
      if (extractResponse.status !== 200 || extractResult.status !== "ok") throw new Error(`Actual extraction input preparation failed: ${String(extractResult.reason)}`)
      const extractionInput = decodeSfSkillInput("EvidenceExtractionInput", extractResult.value)
      if (!extractionInput.ok) throw new Error("Actual extraction input failed its canonical schema")
      expect(extractionInput.value.authorizedFileRef).toBe(document.documentRef)
      expect(extractionInput.value.targetFieldSchema).toEqual({ id: document.schemaId, version: document.schemaVersion, fields: document.fields })
      expect(extractionInput.value.documentRevision).toBeGreaterThan(0)
      const wrongSchema = { ...extractIncoming, selection: { ...extractIncoming.selection, fieldSchemaRef: `${document.schemaRef.slice(0, -1)}2` } }
      expect((await context.human("analysis.prepare", wrongSchema, (call) => inputs.prepare(call, wrongSchema))).status).not.toBe("ok")
      const wrongFile = { ...extractIncoming, selection: { ...extractIncoming.selection, documentRef: "absent-authorized-file" } }
      expect((await context.human("analysis.prepare", wrongFile, (call) => inputs.prepare(call, wrongFile))).status).not.toBe("ok")
      const contractIncoming = { request: { ...base, skillId: contractSkill.id, skillVersion: contractSkill.version,
        objective: "Revise a projeção contratual selecionada com sf_contract_read, resolva contractProjectionRef usando sf_evidence_get e abra sua fonte com sf_source_get. Entregue CommercialGap apenas para uma lacuna observada, preservando pergunta, campo, fonte e escopo; não confirme conteúdo documental nem produza parecer conclusivo.",
        requestedOperationScope: ["sf_contract_read", "sf_evidence_get", "sf_source_get", "sf_freshness_check"] },
        selection: { documentIds: [], contractRefId: preparedCase.contract.evidence.refId, fieldSchemaRef: document.schemaRef,
          coverage: { kind: "alternative", id: preparedCase.candidate.alternative.id } } }
      const contractResponse = await productHttp(context.request({ action: "prepare", input: contractIncoming }, "/sucafina/procurement?sf=workbench-analysis"), "procurement")
      if (!contractResponse) throw new Error("The actual contract preparation route is missing")
      const contractResult = object(await contractResponse.json())
      const contractInput = contractResult.status === "ok" ? decodeSfSkillInput("ContractReviewInput", contractResult.value) : undefined
      if (contractInput && !contractInput.ok) throw new Error("The real contract input failed its canonical schema")
      if (contractResult.status !== "ok") {
        expect(contractResponse.status).toBe(503)
        expect(contractResult).toMatchObject({ status: "unavailable", reason: "analysis-source-unavailable" })
        expect(preparedCase.contract.evidence.target.surface).toBe("dashboard")
        console.log("SF_WP12_NATIVE_CONTRACT_BOUNDARY:" + JSON.stringify({ scope: "actual-issued-contract-and-mounted-input-producer",
          githubSha: process.env.GITHUB_SHA ?? null, skillId: contractSkill.id, status: contractResult.status, reason: contractResult.reason,
          sourceRef: preparedCase.contract.evidence.refId, sourceSurface: preparedCase.contract.evidence.target.surface,
          sourceType: preparedCase.contract.evidence.target.recordType, sourceDigest: preparedCase.contract.evidence.refDigest,
          missingFields: preparedCase.contract.projection.missing, costCoverageDigest: digestSfValue(preparedCase.candidate.alternative.result.costCoverage),
          inputPrepared: false, inferenceExecuted: false, gnativeAccepted: false, outputRef: null,
          knownBoundary: "mounted-contract-producer-requires-procurement-but-contract-issuer-uses-dashboard" }))
      }
      console.log("SF_WP12_NATIVE_DOCUMENT_INPUT:" + JSON.stringify({ scope: "real-persisted-attachment-admission-parser-schema-and-input",
        githubSha: process.env.GITHUB_SHA ?? null, documentRef: document.documentRef, schemaRef: document.schemaRef,
        documentRevision: extractionInput.value.documentRevision, inputDigest: digestSfValue(extractionInput.value),
        scannerQualification: false, uploadExercised: false, inferenceExecuted: false }))
      const before = await documentDomainDigest(context)
      const witnesses: Wp12CompletedNativeMission[] = []
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: extractRequest, skillInput: extractionInput.value })
        if (contractInput?.ok) observeWp12UnavailableMission(context, { request: contractIncoming.request, skillInput: contractInput.value })
      } else {
        await selectWp12ProcurementPeriod(context)
        const restored = await context.human("analysis.prepare", extractIncoming, (call) => inputs.prepare(call, extractIncoming))
        if (restored.status !== "ok") throw new Error("The real document selection changed before native execution")
        expectSpawn(import.meta.path)
        const extracted = await executeWp12NativeMission(context, { request: extractRequest, skillInput: restored.value, expectedKind: "DocumentEvidence",
          requiredTools: [{ operation: "sf_document_extract", handlerExport: "extractDocumentEvidence" }, { operation: "sf_evidence_get" }, { operation: "sf_knowledge_search", handlerExport: "searchDocumentEvidence" }] })
        if (extracted.output.kind !== "DocumentEvidence") throw new Error("The native extractor returned another kind")
        expect(extracted.output.payload.fieldCandidate).toBe("Price")
        expect(extracted.output.payload.value).toBe(42)
        expect(extracted.output.payload.unit).toBe("USD")
        expect(extracted.output.payload.status).toBe("extracted")
        expect(extracted.output.payload.fileRef).toBe(document.documentRef)
        const range = extracted.output.payload.textRange
        expect(WP12_DOCUMENT_TEXT.slice(range.start, range.end)).toBe("42")
        expect(extracted.output.payload.ref.target.revision).toBe(extractionInput.value.documentRevision)
        witnesses.push(extracted)
        if (contractInput?.ok) {
          await selectWp12ProcurementPeriod(context)
          const fresh = await context.human("analysis.prepare", contractIncoming, (call) => inputs.prepare(call, contractIncoming))
          if (fresh.status !== "ok") throw new Error("The actual contract selection changed before native execution")
          const contract = await executeWp12NativeMission(context, { request: contractIncoming.request, skillInput: fresh.value,
            expectedKind: "CommercialGap", requiredTools: [{ operation: "sf_contract_read" }, { operation: "sf_evidence_get" }, { operation: "sf_source_get" }] })
          if (contract.output.kind !== "CommercialGap") throw new Error("The actual contract review returned another kind")
          expect(contract.output.payload.recordRef).toBe(preparedCase.contract.evidence.refId)
          expect(contract.output.payload.field).toBe("notice")
          expect(contract.output.payload.issue).toBe("missing")
          expect(contract.output.payload.question.trim().length).toBeGreaterThan(0)
          witnesses.push(contract)
        }
      }
      const author = witnesses.find((entry) => entry.output.kind === "DocumentEvidence")
      await selectWp12ProcurementPeriod(context)
      const reviewer = await reviewCurrentDocumentClaims(context, preparedCase.caseRef, author)
      if (reviewer) witnesses.push(reviewer)
      if (context.models.length && author?.output.kind !== "DocumentEvidence") throw new Error("Native document execution did not publish its candidate")
      // A host without a model still exercises the real document consumer from
      // the ordinary HTTP parser; this is explicitly separate from native proof.
      const candidate = author?.output.kind === "DocumentEvidence" ? author.output.payload :
        await extractDocumentCandidateThroughHttp(context, document)
      expect(candidate.status).toBe("extracted")
      expect(candidate.ref.target.confirmationVersion).toBeUndefined()
      expect(candidate.fieldCandidate).toBe("Price")
      expect(candidate.value).toBe(42)
      expect(candidate.unit).toBe("USD")
      expect(candidate.fileRef).toBe(document.documentRef)
      expect(candidate.ref.target.revision).toBe(extractionInput.value.documentRevision)
      expect(WP12_DOCUMENT_TEXT.slice(candidate.textRange.start, candidate.textRange.end)).toBe("42")
      const unchanged = await readCaseAnalysisProjection(context.request(), context.services, preparedCase.caseRef)
      if (unchanged.status !== "ok") throw new Error("The actual document case cannot be read after analysis")
      expect(digestSfValue(unchanged.value.case)).toBe(caseDigest)
      expect(await documentDomainDigest(context)).toBe(before)
      return { document, witnesses, before, caseRef: preparedCase.caseRef, caseDigest, candidate,
        candidateOrigin: author ? "native" as const : "ui" as const }
    })
    const confirmed = await open("reopened", async (context) => {
      await selectWp12ProcurementPeriod(context)
      const productHttp = context.services.productHttp
      if (!productHttp) throw new Error("The reopened document routes are missing")
      const schemas = await productHttp(context.request(undefined, `/sucafina/dashboard?sf=document-schemas&documentRef=${encodeURIComponent(completed.document.documentRef)}`, "GET"), "dashboard")
      if (!schemas) throw new Error("The real schema reload route is missing")
      expect(schemas.status).toBe(200)
      expect(object(await schemas.json()).value).toEqual([{ id: completed.document.schemaId, ref: completed.document.schemaRef, version: 1, fields: completed.document.fields }])
      const unchanged = await readCaseAnalysisProjection(context.request(), context.services, completed.caseRef)
      if (unchanged.status !== "ok") throw new Error("The actual document case cannot be reopened")
      expect(digestSfValue(unchanged.value.case)).toBe(completed.caseDigest)
      for (const witness of completed.witnesses) {
        const consumed = await readWp12NativeMissionAfterReload(context, witness)
        if (consumed.output.kind === "DocumentEvidence") {
          expect(consumed.html).toContain("Document evidence")
          const presentation = await productHttp(context.request(undefined, `/sucafina/dashboard?sf=document-open&ref=${encodeURIComponent(JSON.stringify(consumed.output.payload.ref))}`, "GET"), "dashboard")
          if (!presentation) throw new Error("The real document source consumer is missing")
          expect(presentation.status).toBe(200)
          const value = object(object(await presentation.json()).value)
          expect(value.title).toBe(WP12_DOCUMENT_NAME)
          expect(typeof value.href === "string" && value.href.startsWith("/sucafina/dashboard?asset=")).toBe(true)
          expect(consumed.output.payload.status).toBe("extracted")
        } else expect(consumed.html).toContain(consumed.output.kind === "CommercialGap" ? "Commercial gap" : "Evidence review")
      }
      expect(await documentDomainDigest(context)).toBe(completed.before)
      const reopenedCandidate = await readDocumentCandidateThroughHttp(context, completed.document.documentRef, completed.candidate.id)
      expect(digestSfValue(reopenedCandidate)).toBe(digestSfValue(completed.candidate))
      expect(reopenedCandidate.status).toBe("extracted")
      expect(reopenedCandidate.ref.target.confirmationVersion).toBeUndefined()
      console.log("SF_WP12_NATIVE_DOCUMENT_CONSUMER:" + JSON.stringify({ scope: "real-schema-case-and-optional-native-document-reopened",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: completed.caseRef, documentRef: completed.document.documentRef,
        schemaConsumerRef: "createSfDocumentHttp:document-schemas", schemaRef: completed.document.schemaRef, caseUnchanged: true,
        outputRefs: completed.witnesses.map((entry) => entry.output.id), inferenceExecuted: completed.witnesses.length > 0,
        documentSourceConsumerRef: completed.witnesses.some((entry) => entry.output.kind === "DocumentEvidence") ? "createSfDocumentHttp:document-open" : null,
        gnativeAccepted: false }))
      const confirmation = await productHttp(context.request(reopenedCandidate, "/sucafina/dashboard?sf=document-confirm"), "dashboard")
      if (!confirmation) throw new Error("The real human document-confirm route is missing")
      const confirmationBody = object(await confirmation.json())
      const decoded = decodeSfOperationOutput("sf_document_extract", confirmationBody.value)
      if (confirmation.status !== 200 || confirmationBody.status !== "ok" || !decoded.ok)
        throw new Error(`Human document confirmation failed: ${String(confirmationBody.status)}`)
      const evidence = decoded.value
      if (typeof evidence.value !== "number" || typeof evidence.unit !== "string") throw new Error("The confirmed Price is not an actual currency amount")
      expect(evidence.status).toBe("confirmed")
      expect(evidence.ref.target.confirmationVersion).toBe(1)
      expect({ ...evidence, status: reopenedCandidate.status, ref: reopenedCandidate.ref }).toEqual(reopenedCandidate)
      expect(evidence.ref).toEqual({ ...reopenedCandidate.ref, refDigest: evidence.ref.refDigest,
        target: { ...reopenedCandidate.ref.target, confirmationVersion: 1 } })
      expect(evidence.ref.refDigest).toBe(digestSfEvidenceRef(evidence.ref))
      expect(evidence.ref.refDigest).not.toBe(reopenedCandidate.ref.refDigest)
      expect(await readDocumentCandidateThroughHttp(context, completed.document.documentRef, evidence.id)).toEqual(evidence)
      const afterConfirmation = await readCaseAnalysisProjection(context.request(), context.services, completed.caseRef)
      if (afterConfirmation.status !== "ok") throw new Error("The case is unavailable after human document confirmation")
      expect(digestSfValue(afterConfirmation.value.case)).toBe(completed.caseDigest)
      expect(await documentDomainDigest(context)).toBe(completed.before)

      // The destination and reference come from the real producer. The preview
      // request supplies no amount, assumption, scenario result or case claim.
      const targetsResponse = await productHttp(context.request(undefined,
        `/sucafina/planner?sf=document-scenario-targets&ref=${encodeURIComponent(JSON.stringify(evidence.ref))}`, "GET"), "planner")
      if (!targetsResponse) throw new Error("The real document scenario destination route is missing")
      const targets = object(await targetsResponse.json())
      if (targetsResponse.status !== 200 || targets.status !== "ok" || !Array.isArray(targets.value) || !targets.value.length)
        throw new Error(`The confirmed document has no actual Planner destination: ${String(targets.reason)}`)
      const target = object(targets.value[0])
      const request = parseSfDocumentScenarioRequest({ documentRef: evidence.ref, baseRef: target.baseRef, targetRef: target.targetRef, period: target.period })
      if (!request || target.currency !== evidence.unit) throw new Error("The producer returned an incompatible document scenario destination")
      const previewResponse = await productHttp(context.request(request, "/sucafina/planner?sf=document-scenario-preview"), "planner")
      if (!previewResponse) throw new Error("The real document scenario preview route is missing")
      const preview = object(await previewResponse.json()), value = object(preview.value)
      const scenarioRequest = decodeSfOperationInput("sf_scenario_simulate", value.request)
      const scenario = decodeSfOperationOutput("sf_scenario_simulate", value.scenario)
      if (previewResponse.status !== 200 || preview.status !== "ok" || !scenarioRequest.ok || !scenario.ok)
        throw new Error(`The real confirmed-document scenario was refused: ${String(preview.reason)}`)
      expect(value.domainApplied).toBe(false)
      expect(value.evidence).toEqual(evidence)
      expect(scenarioRequest.value.baseRef).toBe(request.baseRef)
      expect(scenarioRequest.value.operations).toEqual([{ kind: "replace", targetRef: request.targetRef,
        amount: evidence.value, currency: evidence.unit, period: request.period }])
      expect(scenarioRequest.value.assumptions).toEqual([{ id: `document:${evidence.id}`, value: evidence.value,
        evidenceRefs: [evidence.ref], state: "confirmed" }])
      expect(scenario.value.sourceRefs).toContainEqual(evidence.ref)
      expect(scenario.value.total).toBeNull()
      expect(scenario.value.costCoverage.coverageState).toBe("pending")
      expect(scenario.value.costCoverage.issues).toContain("inventory-unavailable")
      const afterPreview = await readCaseAnalysisProjection(context.request(), context.services, completed.caseRef)
      if (afterPreview.status !== "ok") throw new Error("The case is unavailable after document scenario preview")
      expect(digestSfValue(afterPreview.value.case)).toBe(completed.caseDigest)
      expect(await documentDomainDigest(context)).toBe(completed.before)
      console.log("SF_WP12_DOCUMENT_HUMAN_CONSUMER:" + JSON.stringify({ scope: "real-human-confirmation-and-document-backed-planner-preview",
        githubSha: process.env.GITHUB_SHA ?? null, candidateOrigin: completed.candidateOrigin, candidateId: evidence.id,
        candidateDigest: digestSfValue(completed.candidate), confirmedDigest: digestSfValue(evidence), documentRef: evidence.ref,
        confirmationVersion: evidence.ref.target.confirmationVersion, consumerRefs: ["createSfDocumentHttp:document-confirm", "createSfDocumentScenarioHttp:document-scenario-preview"],
        scenarioRequestDigest: digestSfValue(scenarioRequest.value), scenarioResultDigest: digestSfValue(scenario.value),
        sourceUsedByScenario: true, caseUnchanged: true, caseClaimsCreated: 0, domainApplied: value.domainApplied,
        coverageState: scenario.value.costCoverage.coverageState, inferenceExecuted: false, gnativeAccepted: false }))
      return evidence
    })
    await open("reopened", async (context) => {
      const evidence = await readDocumentCandidateThroughHttp(context, completed.document.documentRef, confirmed.id)
      expect(evidence).toEqual(confirmed)
      const productHttp = context.services.productHttp
      if (!productHttp) throw new Error("The confirmed document consumer is not mounted after reload")
      const response = await productHttp(context.request(undefined,
        `/sucafina/dashboard?sf=document-open&ref=${encodeURIComponent(JSON.stringify(evidence.ref))}`, "GET"), "dashboard")
      if (!response) throw new Error("The confirmed document source route is missing after reload")
      expect(response.status).toBe(200)
      const presentation = object(object(await response.json()).value)
      expect(presentation.title).toBe(WP12_DOCUMENT_NAME)
      expect(typeof presentation.href === "string" && presentation.href.startsWith("/sucafina/dashboard?asset=")).toBe(true)
      await selectWp12ProcurementPeriod(context)
      const unchanged = await readCaseAnalysisProjection(context.request(), context.services, completed.caseRef)
      if (unchanged.status !== "ok") throw new Error("The case cannot be reopened after document confirmation")
      expect(digestSfValue(unchanged.value.case)).toBe(completed.caseDigest)
      expect(await documentDomainDigest(context)).toBe(completed.before)
      for (const witness of completed.witnesses) {
        const stored = await context.services.state.read(context.request(), "contributions", (state, authority) =>
          authority.principalRef === context.principalRef ? state.contributions[witness.output.id] : undefined)
        if (stored.status !== "ok") throw new Error("The original native contribution could not be inspected after human confirmation")
        expect(stored.value).toEqual(witness.output)
      }
      console.log("SF_WP12_DOCUMENT_CONFIRMATION_REOPEN:" + JSON.stringify({ scope: "real-confirmation-persisted-and-source-opened-after-reload",
        githubSha: process.env.GITHUB_SHA ?? null, candidateOrigin: completed.candidateOrigin, candidateId: evidence.id,
        confirmedDigest: digestSfValue(evidence), confirmationVersion: evidence.ref.target.confirmationVersion,
        consumerRefs: ["createSfDocumentHttp:document-candidates", "createSfDocumentHttp:document-open"],
        caseUnchanged: true, originalContributionsUnchanged: true, domainApplied: false, inferenceExecuted: false, gnativeAccepted: false }))
    })
  })
}, 600_000)

/** Select only claims the current case producer actually persisted. Absence is
 * observed explicitly; a native document candidate never manufactures a claim. */
async function reviewCurrentDocumentClaims(context: Wp12NativeMissionContext, caseRef: Wp12CompletedNativeMission["caseRef"], author?: Wp12CompletedNativeMission) {
  const selected = context.services.selected.find((entry) => entry.profile.id === "sf_reviewer")
  const skill = selected?.skills.find((entry) => entry.id === "sf-revisar-evidencias")
  const inputs = context.services.analysisInputs
  const read = await readCaseAnalysisProjection(context.request(), context.services, caseRef)
  if (!selected || !skill || !inputs || read.status !== "ok") throw new Error("The real evidence-review selection cannot be read")
  const incoming = { request: { caseRef, profileId: selected.profile.id, profileVersion: selected.profile.version,
    skillId: skill.id, skillVersion: skill.version, manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1",
    objective: "Revise independentemente as afirmações materiais atualmente registradas no caso. Leia sf_case_read, resolva as evidenceRefs das afirmações com sf_evidence_get, verifique sua atualidade com sf_freshness_check e abra suas fontes com sf_source_get. Use sf_knowledge_search para conferir os trechos documentais autorizados. Classifique somente uma questão sustentada pelas fontes atuais e não confirme evidência documental.",
    requestedOperationScope: ["sf_case_read", "sf_evidence_get", "sf_freshness_check", "sf_knowledge_search", "sf_source_get"] },
    selection: { claimIds: read.value.case.assumptions.map((claim) => claim.id), documentEvidenceIds: [] } }
  const prepared = await context.human("analysis.prepare", incoming, (call) => inputs.prepare(call, incoming))
  if (!incoming.selection.claimIds.length) {
    expect(prepared).toMatchObject({ status: "needs-input", reason: "invalid-analysis-input" })
    console.log("SF_WP12_NATIVE_EVIDENCE_REVIEW_BOUNDARY:" + JSON.stringify({ scope: "current-case-claim-selection",
      githubSha: process.env.GITHUB_SHA ?? null, skillId: skill.id, caseRef, authorRunRef: author?.runRef ?? null,
      currentClaimCount: 0, observedStatus: prepared.status, reason: "current-case-has-no-persisted-claim-selector",
      inputPrepared: false, inferenceExecuted: false, gnativeAccepted: false, outputRef: null }))
    return undefined
  }
  if (prepared.status !== "ok") throw new Error(`Actual evidence-review input failed: ${prepared.reason}`)
  const decoded = decodeSfSkillInput("EvidenceReviewInput", prepared.value)
  if (!decoded.ok) throw new Error("Actual evidence-review input failed its canonical schema")
  if (!context.models.length) { observeWp12UnavailableMission(context, { request: incoming.request, skillInput: decoded.value }); return undefined }
  if (!author) throw new Error("Evidence review needs the actual independent author run")
  const reviewer = await executeWp12NativeMission(context, { request: incoming.request, skillInput: decoded.value,
    expectedKind: "ClaimIssue", requiredTools: ["sf_case_read", "sf_evidence_get", "sf_freshness_check", "sf_source_get", "sf_knowledge_search"].map((operation) => ({ operation })), authorAnalysis: { runRef: author.runRef, outputDigest: author.output.outputDigest } })
  expect(reviewer.runRef).not.toBe(author.runRef)
  expect(reviewer.output.runProvenance.nativeSessionId).not.toBe(author.output.runProvenance.nativeSessionId)
  if (reviewer.output.kind !== "ClaimIssue") throw new Error("The independent evidence reviewer returned another kind")
  expect(incoming.selection.claimIds).toContain(reviewer.output.payload.claimRef)
  return reviewer
}

async function documentDomainDigest(context: Wp12NativeMissionContext) {
  const dashboard = await context.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
    value: digestSfValue({ contracts: snapshot.data.contracts, assets: snapshot.data.assets }) }))
  const planner = await context.persistence.transaction("planner", async (snapshot) => ({ commit: false,
    value: digestSfValue({ versions: snapshot.data.versions, officials: snapshot.data.officials,
      entities: snapshot.data.entities, allocations: snapshot.data.allocations, roster: snapshot.data.roster }) }))
  const procurement = await context.persistence.transaction("procurement", async (snapshot) => ({ commit: false,
    value: digestSfValue(snapshot.data.store) }))
  return digestSfValue({ dashboard, planner, procurement })
}

async function extractDocumentCandidateThroughHttp(context: Wp12NativeMissionContext,
  document: { documentRef: string; schemaRef: string }): Promise<DocumentEvidence> {
  const response = await context.services.productHttp?.(context.request({ documentRef: document.documentRef,
    fieldSchemaRef: document.schemaRef }, "/sucafina/dashboard?sf=document-extract"), "dashboard")
  if (!response) throw new Error("The actual UI extraction consumer is not mounted")
  const body = object(await response.json())
  const decoded = decodeSfOperationOutput("sf_document_extract", body.value)
  if (response.status !== 200 || body.status !== "ok" || !decoded.ok) throw new Error("The real HTTP parser did not persist its document candidate")
  console.log("SF_WP12_DOCUMENT_UI_EXTRACTION:" + JSON.stringify({ scope: "real-http-parser-without-native-model",
    githubSha: process.env.GITHUB_SHA ?? null, candidateId: decoded.value.id, candidateDigest: digestSfValue(decoded.value),
    sourceRef: decoded.value.ref, input: { documentRef: document.documentRef, fieldSchemaRef: document.schemaRef },
    consumerRef: "createSfDocumentHttp:document-extract", inferenceExecuted: false, nativeRunRef: null, gnativeAccepted: false }))
  return decoded.value
}

async function readDocumentCandidateThroughHttp(context: Wp12NativeMissionContext, documentRef: string, candidateId: string): Promise<DocumentEvidence> {
  const response = await context.services.productHttp?.(context.request(undefined,
    `/sucafina/dashboard?sf=document-candidates&documentRef=${encodeURIComponent(documentRef)}`, "GET"), "dashboard")
  if (!response) throw new Error("The document candidate consumer is not mounted")
  const body = object(await response.json())
  if (response.status !== 200 || body.status !== "ok" || !Array.isArray(body.value)) throw new Error("The actual persisted document candidates are unavailable")
  const candidates: unknown[] = body.value
  const decoded = candidates.map((value) => decodeSfOperationOutput("sf_document_extract", value))
  if (decoded.some((value) => !value.ok)) throw new Error("The real document candidate consumer returned an invalid schema")
  const matches = decoded.flatMap((value) => value.ok && value.value.id === candidateId ? [value.value] : [])
  if (matches.length !== 1) throw new Error("The exact extracted document candidate is not uniquely persisted")
  return matches[0]!
}
