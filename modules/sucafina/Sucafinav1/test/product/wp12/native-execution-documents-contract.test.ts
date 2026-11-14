import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
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
    humanActions: [...WP12_SCENARIO_HUMAN_ACTIONS, "documents.schema", "documents.confirm"], initialize: initializeWp12DocumentSources }, async ({ open }) => {
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
        objective: `Extraia a evidência definida pelo schema autorizado usando sf_document_extract e leia a fonte com sf_knowledge_search. Use documentRef e fieldSchemaRef da seleção autorizada: ${document.documentRef}, ${document.schemaRef}. Preserve revisão, trecho e status de candidato sem confirmar ou aplicar.`,
        requestedOperationScope: ["sf_document_extract", "sf_knowledge_search"] }
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
        objective: "Revise a projeção contratual selecionada com sf_contract_read e as referências atuais. Entregue CommercialGap apenas para uma lacuna observada, preservando pergunta, campo, fonte e escopo; não confirme conteúdo documental nem produza parecer conclusivo.",
        requestedOperationScope: ["sf_contract_read", "sf_source_get", "sf_freshness_check"] },
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
          requiredTools: [{ operation: "sf_document_extract", handlerExport: "extractDocumentEvidence" }, { operation: "sf_knowledge_search", handlerExport: "searchDocumentEvidence" }] })
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
            expectedKind: "CommercialGap", requiredTools: [{ operation: "sf_contract_read" }] })
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
      const unchanged = await readCaseAnalysisProjection(context.request(), context.services, preparedCase.caseRef)
      if (unchanged.status !== "ok") throw new Error("The actual document case cannot be read after analysis")
      expect(digestSfValue(unchanged.value.case)).toBe(caseDigest)
      expect(await documentDomainDigest(context)).toBe(before)
      return { document, witnesses, before, caseRef: preparedCase.caseRef, caseDigest }
    })
    await open("reopened", async (context) => {
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
      console.log("SF_WP12_NATIVE_DOCUMENT_CONSUMER:" + JSON.stringify({ scope: "real-schema-case-and-optional-native-document-reopened",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: completed.caseRef, documentRef: completed.document.documentRef,
        schemaConsumerRef: "createSfDocumentHttp:document-schemas", schemaRef: completed.document.schemaRef, caseUnchanged: true,
        outputRefs: completed.witnesses.map((entry) => entry.output.id), inferenceExecuted: completed.witnesses.length > 0,
        documentSourceConsumerRef: completed.witnesses.some((entry) => entry.output.kind === "DocumentEvidence") ? "createSfDocumentHttp:document-open" : null,
        gnativeAccepted: false }))
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
    objective: "Revise independentemente as afirmações materiais atualmente registradas no caso. Leia sf_case_read e as referências disponíveis; classifique somente uma questão sustentada pelas fontes atuais e não confirme evidência documental.",
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
    expectedKind: "ClaimIssue", requiredTools: [{ operation: "sf_case_read" }], authorAnalysis: { runRef: author.runRef, outputDigest: author.output.outputDigest } })
  expect(reviewer.runRef).not.toBe(author.runRef)
  expect(reviewer.output.runProvenance.nativeSessionId).not.toBe(author.output.runProvenance.nativeSessionId)
  if (reviewer.output.kind !== "ClaimIssue") throw new Error("The independent evidence reviewer returned another kind")
  expect(incoming.selection.claimIds).toContain(reviewer.output.payload.claimRef)
  return reviewer
}

async function documentDomainDigest(context: Wp12NativeMissionContext) {
  return context.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
    value: digestSfValue({ contracts: snapshot.data.contracts, assets: snapshot.data.assets }) }))
}
