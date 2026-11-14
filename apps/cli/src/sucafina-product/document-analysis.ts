import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { DocumentEvidence } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { EvidenceExtractionInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { DocumentEvidenceHost } from "../../../../modules/sucafina/Sucafinav1/product/documents/capabilities.ts"
import { resolveSfDocumentEvidence } from "../../../../modules/sucafina/Sucafinav1/product/documents/evidence-resolver.ts"
import { sfDocumentLimits } from "../../../../modules/sucafina/Sucafinav1/product/documents/limits.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies } from "./analysis-verifier.ts"

export const sfDocumentAnalysisLimits: EvidenceExtractionInput["limits"] = Object.freeze({
  formats: ["text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] as const,
  maxBytes: sfDocumentLimits.maxBytes, maxPages: sfDocumentLimits.maxPages, maxTextLength: sfDocumentLimits.maxTextLength,
  maxXmlBytes: sfDocumentLimits.maxXmlBytes, maxZipEntries: sfDocumentLimits.maxZipEntries, timeoutMs: sfDocumentLimits.timeoutMs,
})

/** Resolves a human selection through the installed document authority before native admission. */
export function createSfDocumentAnalysisInput(input: Pick<SfAnalysisDependencies, "cases" | "host"> & {
  documents: DocumentEvidenceHost
  authorize: (call: TrustedDomainContext) => Promise<boolean>
}) {
  return async (call: TrustedDomainContext, selection: {
    caseRef: { id: string; incarnation: string; version: number }; documentRef: string; fieldSchemaRef: string
  }): Promise<PortResult<EvidenceExtractionInput>> => {
    const wanted = structuredClone(selection)
    if (call.kind !== "ui" || !await input.authorize(call)) return { status: "denied", reason: "document-analysis-authority-unavailable" }
    const current = await input.cases.read({ caseRef: encodeCaseRef(wanted.caseRef) }, call)
    if (current.status !== "ok" || current.value.case.version !== wanted.caseRef.version) return { status: "unavailable", reason: "analysis-case-unavailable" }
    const schema = await input.documents.resolveFieldSchema(wanted.fieldSchemaRef, call, wanted.documentRef)
    if (schema.status !== "ok") return schema
    const source = await input.documents.documents.read(wanted.documentRef, call)
    if (source.status !== "ok") return source
    if (!sfDocumentAnalysisLimits.formats.includes(source.value.mediaType) || source.value.bytes.length === 0 || source.value.bytes.length > sfDocumentAnalysisLimits.maxBytes ||
      new Bun.CryptoHasher("sha256").update(source.value.bytes).digest("hex") !== source.value.blobDigest.value)
      return { status: "unavailable", reason: "analysis-document-unavailable" }
    const schemaAgain = await input.documents.resolveFieldSchema(wanted.fieldSchemaRef, call, wanted.documentRef)
    const again = await input.cases.read({ caseRef: encodeCaseRef(wanted.caseRef) }, call)
    if (schemaAgain.status !== "ok" || digestSfValue(schemaAgain.value) !== digestSfValue(schema.value) || again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(current.value.case) ||
      !await input.documents.documents.revalidate(wanted.documentRef, { incarnation: source.value.incarnation, revision: source.value.revision, blobDigest: source.value.blobDigest.value }, call) ||
      !await input.host.revalidate(call) || !await input.authorize(call)) return { status: "denied", reason: "analysis-source-changed" }
    return { status: "ok", value: { authorizedFileRef: wanted.documentRef, documentRevision: source.value.revision, targetFieldSchema: schema.value, limits: sfDocumentAnalysisLimits } }
  }
}

/** Native extraction publishes a candidate; BCS continues to accept confirmed premises only. */
export async function readSfDocumentAnalysisCandidate(evidence: DocumentEvidence, call: TrustedDomainContext, host: DocumentEvidenceHost): Promise<PortResult<DocumentEvidence>> {
  if (!host.reader || evidence.status !== "extracted" || !await host.host.revalidate(call)) return { status: "unavailable", reason: "analysis-document-unavailable" }
  const source = await resolveSfDocumentEvidence(evidence.ref, call, host.reader)
  if (source.state !== "fresh" || source.accessRevision !== call.binding.accessRevision || digestSfValue(source.ref) !== digestSfValue(evidence.ref) ||
    digestSfValue(source.authorizedProjection) !== digestSfValue(evidence) || !await host.host.revalidate(call)) return { status: "unavailable", reason: "analysis-source-changed" }
  return { status: "ok", value: evidence }
}
