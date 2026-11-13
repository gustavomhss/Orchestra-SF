import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { EvidenceExtractionInput, SfSkillInputMap } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { DocumentEvidenceHost } from "../../../../modules/sucafina/Sucafinav1/product/documents/capabilities.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

function humanExtractionSelection(value: unknown): { authorizedFileRef: string; fieldSchemaRef: string; limits: unknown } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.length !== 3 || entries.some(([key]) => key !== "authorizedFileRef" && key !== "fieldSchemaRef" && key !== "limits")) return undefined
  const authorizedFileRef = entries.find(([key]) => key === "authorizedFileRef")?.[1]
  const fieldSchemaRef = entries.find(([key]) => key === "fieldSchemaRef")?.[1]
  const limits = entries.find(([key]) => key === "limits")?.[1]
  if (typeof authorizedFileRef !== "string" || !authorizedFileRef.trim() || typeof fieldSchemaRef !== "string" || !fieldSchemaRef.trim() || limits === undefined) return undefined
  return { authorizedFileRef, fieldSchemaRef, limits }
}

async function compose(dependencies: SfAnalysisDependencies & { documentHost: DocumentEvidenceHost; documentLimits: SfSkillInputMap["EvidenceExtractionInput"]["limits"] }, human: ReturnType<typeof humanExtractionSelection> & object, request: SfAnalysisRequest, call: TrustedDomainContext): Promise<EvidenceExtractionInput | undefined> {
  if (!same(human.limits, dependencies.documentLimits)) return undefined
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
  if (current.status !== "ok" || current.value.case.id !== request.caseRef.id || current.value.case.incarnation !== request.caseRef.incarnation || current.value.case.version !== request.caseRef.version) return undefined
  const schema = await dependencies.documentHost.resolveFieldSchema(human.fieldSchemaRef, call)
  if (schema.status !== "ok" || schema.value.id !== human.fieldSchemaRef) return undefined
  const document = await dependencies.documentHost.documents.read(human.authorizedFileRef, call)
  if (document.status !== "ok" || !dependencies.documentLimits.formats.includes(document.value.mediaType) || document.value.bytes.length === 0 || document.value.bytes.length > dependencies.documentLimits.maxBytes || new Bun.CryptoHasher("sha256").update(document.value.bytes).digest("hex") !== document.value.blobDigest.value) return undefined
  if (!await dependencies.documentHost.documents.revalidate(human.authorizedFileRef, { incarnation: document.value.incarnation, revision: document.value.revision, blobDigest: document.value.blobDigest.value }, call) || !await dependencies.host.revalidate(call)) return undefined
  return { authorizedFileRef: human.authorizedFileRef, documentRevision: document.value.revision, targetFieldSchema: schema.value, limits: dependencies.documentLimits }
}

export function createSfExtractionInputProducer(dependencies: SfAnalysisDependencies & { documentHost: DocumentEvidenceHost; documentLimits: SfSkillInputMap["EvidenceExtractionInput"]["limits"] }): SfInputProducer {
  return {
    skillIds: ["sf-extrair-evidencias"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = humanExtractionSelection(selection)
      if (!human || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version)) return { status: "needs-input", reason: "invalid-analysis-input" }
      if (!same(human.limits, dependencies.documentLimits)) return { status: "needs-input", reason: "document-limits-mismatch" }
      const first = await compose(dependencies, human, request, call)
      const second = await compose(dependencies, human, request, call)
      if (!first || !second || !same(first, second)) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const decoded = decodeSfSkillInput("EvidenceExtractionInput", first)
      return decoded.ok ? { status: "ok", value: decoded.value } : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
    },
  }
}
