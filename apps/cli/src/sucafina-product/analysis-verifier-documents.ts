import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { SfSkillInputMap } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { DocumentEvidenceHost } from "../../../../modules/sucafina/Sucafinav1/product/documents/capabilities.ts"
import { readDocumentEvidence } from "../../../../modules/sucafina/Sucafinav1/product/documents/store.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisVerifier } from "./analysis-verifier.ts"

export function createSfDocumentExtractionVerifier(dependencies: SfAnalysisDependencies & {
  documentHost: DocumentEvidenceHost
  documentLimits: SfSkillInputMap["EvidenceExtractionInput"]["limits"]
}): SfAnalysisVerifier {
  return {
    skillIds: ["sf-extrair-evidencias"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("EvidenceExtractionInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      if (digestSfValue(value.limits) !== digestSfValue(dependencies.documentLimits)) return { status: "needs-input", reason: "document-limits-mismatch" }
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
        const schema = await dependencies.documentHost.resolveFieldSchema(value.targetFieldSchema.id, currentCall)
        if (schema.status !== "ok" || digestSfValue(schema.value) !== digestSfValue(value.targetFieldSchema)) return undefined
        const document = await dependencies.documentHost.documents.read(value.authorizedFileRef, currentCall)
        if (document.status !== "ok" || document.value.revision !== value.documentRevision || !value.limits.formats.includes(document.value.mediaType) ||
          document.value.bytes.length === 0 || document.value.bytes.length > value.limits.maxBytes || new Bun.CryptoHasher("sha256").update(document.value.bytes).digest("hex") !== document.value.blobDigest.value ||
          !await dependencies.documentHost.documents.revalidate(value.authorizedFileRef, { incarnation: document.value.incarnation, revision: document.value.revision, blobDigest: document.value.blobDigest.value }, currentCall) ||
          !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, document: document.value }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: [], acceptsOutput: async (output, currentCall) => {
        if (output.state !== "ready" || output.kind !== "DocumentEvidence") return { status: "unavailable", reason: "analysis-output-unverified" }
        const current = await read(currentCall)
        if (!current || current.document.incarnation !== proof.document.incarnation || current.document.blobDigest.value !== proof.document.blobDigest.value) return { status: "unavailable", reason: "analysis-output-unverified" }
        const stored = await readDocumentEvidence(output.payload.id, currentCall, { state: dependencies.documentHost.state, documents: dependencies.documentHost.documents, requestFor: dependencies.documentHost.host.requestFor, revalidate: dependencies.documentHost.host.revalidate })
        if (stored.status !== "ok" || stored.value.schemaRef !== value.targetFieldSchema.id || stored.value.schemaVersion !== value.targetFieldSchema.version || stored.value.snapshot.documentRef !== value.authorizedFileRef ||
          digestSfValue(stored.value.evidence) !== digestSfValue(output.payload) || output.payload.status !== "extracted" || digestSfValue(output.evidenceRefs) !== digestSfValue([output.payload.ref])) return { status: "unavailable", reason: "analysis-output-unverified" }
        const source = await dependencies.context.resolve(output.payload.ref, currentCall)
        if (source.state !== "fresh" || !source.authorizedProjection || !source.currentRef || digestSfValue(source.ref) !== digestSfValue(output.payload.ref) || digestSfValue(source.currentRef) !== digestSfValue(source.ref) || !await read(currentCall)) return { status: "unavailable", reason: "analysis-output-unverified" }
        return { status: "ok", value: true }
      } } }
    },
  }
}

export function createSfContractReviewVerifier(dependencies: SfAnalysisDependencies & { documentHost: DocumentEvidenceHost }): SfAnalysisVerifier {
  return {
    skillIds: ["sf-revisar-condicoes-contratuais"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("ContractReviewInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      if (digestSfValue(value.decisionScope.case) !== digestSfValue(request.caseRef) || value.contractProjectionRef.kind !== "record" || value.contractProjectionRef.target.surface !== "procurement") return { status: "needs-input", reason: "analysis-input-mismatch" }
      const contractRef = value.contractProjectionRef
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version || current.value.case.currency !== value.decisionScope.currency || digestSfValue(current.value.case.horizon) !== digestSfValue(value.decisionScope.horizon) ||
          ![...current.value.case.alternatives.map((item) => item.result.costCoverage), ...current.value.case.choices.map((item) => item.costCoverage)].some((coverage) => digestSfValue(coverage) === digestSfValue(value.costCoverage))) return undefined
        const refs = [contractRef, ...value.documentEvidence.map((item) => item.ref)]
        if (refs.some((ref) => !current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref)))) return undefined
        const contract = await dependencies.procurement.readContract({ contractRef: contractRef.refId, fields: contractRef.target.fields }, currentCall)
        if (contract.status !== "ok" || !contract.value.values.some((item) => item.sourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(contractRef)))) return undefined
        const documents = await Promise.all(value.documentEvidence.map((item) => readDocumentEvidence(item.id, currentCall, { state: dependencies.documentHost.state, documents: dependencies.documentHost.documents, requestFor: dependencies.documentHost.host.requestFor, revalidate: dependencies.documentHost.host.revalidate })))
        if (documents.some((item, index) => item.status !== "ok" || digestSfValue(item.value.evidence) !== digestSfValue(value.documentEvidence[index]))) return undefined
        const sources = await dependencies.context.context({ refs }, currentCall)
        if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(refs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, contract: contract.value, sources, refs }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        const current = await read(currentCall)
        if (!current || output.state !== "ready") return { status: "unavailable", reason: "analysis-output-unverified" }
        if (output.kind === "EvidenceCandidate") {
          const candidate = output.payload
          const document = value.documentEvidence.find((item) => item.id === candidate.id)
          return document && candidate.state !== "rejected" && digestSfValue(candidate.value) === digestSfValue(document.value) && candidate.unit === document.unit && digestSfValue(candidate.evidenceRefs) === digestSfValue([document.ref]) && digestSfValue(output.evidenceRefs) === digestSfValue(candidate.evidenceRefs)
            ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-unverified" }
        }
        if (output.kind !== "CommercialGap") return { status: "unavailable", reason: "analysis-output-unverified" }
        const gap = output.payload
        if (gap.recordRef !== contractRef.refId || !gap.question.trim() || !current.contract.missing.some((item) => item.field === gap.field && ((gap.issue === "missing" && item.reason === "missing") || (gap.issue === "unavailable" && item.reason === "unavailable"))) ||
          digestSfValue(output.evidenceRefs) !== digestSfValue(gap.evidenceRefs) || gap.evidenceRefs.some((ref) => !current.refs.some((item) => digestSfValue(item) === digestSfValue(ref)))) return { status: "unavailable", reason: "analysis-output-unverified" }
        return { status: "ok", value: true }
      } } }
    },
  }
}
