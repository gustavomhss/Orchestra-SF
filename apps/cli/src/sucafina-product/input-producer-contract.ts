import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { CostCoverageAssessment } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { ContractReviewInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { DocumentEvidenceHost } from "../../../../modules/sucafina/Sucafinav1/product/documents/capabilities.ts"
import { readDocumentEvidence } from "../../../../modules/sucafina/Sucafinav1/product/documents/store.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

function ids(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0) && new Set(value).size === value.length ? value : undefined
}

function humanContractSelection(value: unknown): { documentIds: readonly string[]; contractRefId: string; fieldSchemaRef: string; coverage: { kind: "alternative" | "choice"; id: string } } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.length !== 4 || entries.some(([key]) => key !== "documentIds" && key !== "contractRefId" && key !== "fieldSchemaRef" && key !== "coverage")) return undefined
  const documentIds = ids(entries.find(([key]) => key === "documentIds")?.[1])
  const contractRefId = entries.find(([key]) => key === "contractRefId")?.[1]
  const fieldSchemaRef = entries.find(([key]) => key === "fieldSchemaRef")?.[1]
  const coverage = entries.find(([key]) => key === "coverage")?.[1]
  if (!documentIds || typeof contractRefId !== "string" || !contractRefId.trim() || typeof fieldSchemaRef !== "string" || !fieldSchemaRef.trim() || !coverage || typeof coverage !== "object" || Array.isArray(coverage)) return undefined
  const coverageFields = Object.entries(coverage)
  const kind = coverageFields.find(([key]) => key === "kind")?.[1]
  const id = coverageFields.find(([key]) => key === "id")?.[1]
  if (coverageFields.length !== 2 || (kind !== "alternative" && kind !== "choice") || typeof id !== "string" || !id.trim()) return undefined
  return { documentIds, contractRefId, fieldSchemaRef, coverage: { kind, id } }
}

function coverageOf(current: AuthorizedCaseProjection, selected: { kind: "alternative" | "choice"; id: string }): CostCoverageAssessment | undefined {
  const found = selected.kind === "alternative"
    ? current.case.alternatives.filter((item) => item.id === selected.id).map((item) => item.result.costCoverage)
    : current.case.choices.filter((item) => item.id === selected.id).map((item) => item.costCoverage)
  return found.length === 1 ? found[0] : undefined
}

async function compose(dependencies: SfAnalysisDependencies & { documentHost: DocumentEvidenceHost }, human: ReturnType<typeof humanContractSelection> & object, request: SfAnalysisRequest, call: TrustedDomainContext): Promise<ContractReviewInput | undefined> {
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
  if (current.status !== "ok" || current.value.case.id !== request.caseRef.id || current.value.case.incarnation !== request.caseRef.incarnation || current.value.case.version !== request.caseRef.version || !current.value.case.currency.trim() || current.value.case.horizon.start > current.value.case.horizon.end) return undefined
  const costCoverage = coverageOf(current.value, human.coverage)
  const matches = current.value.evidenceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.refId === human.contractRefId && ref.kind === "record" && ref.target.surface === "procurement")
  const contractRef = matches.length === 1 ? matches[0] : undefined
  if (!costCoverage || !contractRef) return undefined
  const schema = await dependencies.documentHost.resolveFieldSchema(human.fieldSchemaRef, call)
  if (schema.status !== "ok" || schema.value.id !== human.fieldSchemaRef) return undefined
  const stored = await Promise.all(human.documentIds.map((id) => readDocumentEvidence(id, call, { state: dependencies.documentHost.state, documents: dependencies.documentHost.documents, requestFor: dependencies.documentHost.host.requestFor, revalidate: dependencies.documentHost.host.revalidate })))
  if (stored.some((item) => item.status !== "ok" || item.value.schemaRef !== schema.value.id || item.value.schemaVersion !== schema.value.version || item.value.evidence.id !== item.value.snapshot.evidence?.id)) return undefined
  const documentEvidence = stored.flatMap((item) => item.status === "ok" ? [item.value.evidence] : [])
  const contract = await dependencies.procurement.readContract({ contractRef: contractRef.refId, fields: contractRef.target.fields }, call)
  if (contract.status !== "ok" || !contract.value.values.some((item) => item.sourceRefs.some((ref) => same(ref, contractRef)))) return undefined
  const refs = [contractRef, ...documentEvidence.map((item) => item.ref)]
  if (refs.some((ref) => !current.value.evidenceRefs.some((item) => same(item, ref)))) return undefined
  const sources = await dependencies.context.context({ refs }, call)
  if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, refs[index]) || !same(item.currentRef, item.ref)) || !await dependencies.host.revalidate(call)) return undefined
  return { documentEvidence, contractProjectionRef: contractRef, decisionScope: { case: request.caseRef, horizon: current.value.case.horizon, currency: current.value.case.currency }, costCoverage }
}

export function createSfContractInputProducer(dependencies: SfAnalysisDependencies & { documentHost: DocumentEvidenceHost }): SfInputProducer {
  return {
    skillIds: ["sf-revisar-condicoes-contratuais"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = humanContractSelection(selection)
      if (!human || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version)) return { status: "needs-input", reason: "invalid-analysis-input" }
      const first = await compose(dependencies, human, request, call)
      const second = await compose(dependencies, human, request, call)
      if (!first || !second || !same(first, second)) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const decoded = decodeSfSkillInput("ContractReviewInput", first)
      return decoded.ok ? { status: "ok", value: decoded.value } : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
    },
  }
}
