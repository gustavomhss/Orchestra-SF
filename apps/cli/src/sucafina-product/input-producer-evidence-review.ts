import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { EvidenceReviewInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { DocumentEvidenceHost } from "../../../../modules/sucafina/Sucafinav1/product/documents/capabilities.ts"
import { readDocumentEvidence } from "../../../../modules/sucafina/Sucafinav1/product/documents/store.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"

const unavailable = { status: "unavailable", reason: "analysis-input-producer-unavailable" } as const

function humanSelection(value: unknown): { claimIds: readonly string[]; documentEvidenceIds: readonly string[] } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.some(([key]) => key !== "claimIds" && key !== "documentEvidenceIds")) return undefined
  const claimIds = entries.find(([key]) => key === "claimIds")?.[1]
  const documentEvidenceIds = entries.find(([key]) => key === "documentEvidenceIds")?.[1]
  if (!Array.isArray(claimIds) || !Array.isArray(documentEvidenceIds)) return undefined
  if (!claimIds.length || claimIds.some((id) => typeof id !== "string" || !id.trim()) || new Set(claimIds).size !== claimIds.length) return undefined
  if (documentEvidenceIds.some((id) => typeof id !== "string" || !id.trim()) || new Set(documentEvidenceIds).size !== documentEvidenceIds.length) return undefined
  return { claimIds, documentEvidenceIds }
}

function uniqueRefs(refs: readonly BusinessEvidenceRef[]) {
  return refs.filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
}

function revision(ref: BusinessEvidenceRef): { ref: BusinessEvidenceRef; incarnation: string; version: number } | undefined {
  if (ref.kind === "record") return { ref, incarnation: ref.target.incarnation, version: ref.target.version }
  if (ref.kind === "document") return { ref, incarnation: ref.target.incarnation, version: ref.target.revision }
  return undefined
}

export function createSfEvidenceReviewInputProducer(dependencies: SfAnalysisDependencies & { documentHost: DocumentEvidenceHost }): SfInputProducer {
  return {
    skillIds: ["sf-revisar-evidencias"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = humanSelection(selection)
      if (!human) return { status: "needs-input", reason: "invalid-analysis-input" }
      if (request.profileId !== "sf_reviewer" || request.caseRef.version < 1) return unavailable
      const loaded = await load(dependencies, human, request, call)
      if (!loaded) return unavailable
      const again = await load(dependencies, human, request, call)
      if (!again || digestSfValue(again.input) !== digestSfValue(loaded.input) || again.accessRevision !== loaded.accessRevision || again.accessRevision !== call.binding.accessRevision) return unavailable
      const decoded = decodeSfSkillInput("EvidenceReviewInput", again.input)
      return decoded.ok ? { status: "ok", value: decoded.value } : unavailable
    },
  }
}

async function load(
  dependencies: SfAnalysisDependencies & { documentHost: DocumentEvidenceHost },
  human: { claimIds: readonly string[]; documentEvidenceIds: readonly string[] },
  request: SfAnalysisRequest,
  call: TrustedDomainContext,
): Promise<{ input: EvidenceReviewInput; accessRevision: string } | undefined> {
  const host = dependencies.documentHost
  if (!(await host.host.revalidate(call)) || !(await dependencies.host.revalidate(call))) return undefined
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
  if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
  const claims = human.claimIds.flatMap((id) => current.value.case.assumptions.filter((item) => item.id === id))
  if (claims.length !== human.claimIds.length) return undefined
  const documents = []
  for (const id of human.documentEvidenceIds) {
    const first = await readDocumentEvidence(id, call, { state: host.state, documents: host.documents, requestFor: host.host.requestFor, revalidate: host.host.revalidate })
    if (first.status !== "ok") return undefined
    const ref = first.value.evidence.ref
    if (!current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref))) return undefined
    const resolved = await dependencies.context.context({ refs: [ref] }, call)
    if (resolved.length !== 1 || resolved[0]?.state !== "fresh" || !resolved[0].authorizedProjection || !resolved[0].currentRef || digestSfValue(resolved[0].ref) !== digestSfValue(ref) || digestSfValue(resolved[0].currentRef) !== digestSfValue(ref) || resolved[0].accessRevision !== call.binding.accessRevision || digestSfValue(resolved[0].authorizedProjection) !== digestSfValue(first.value.evidence)) return undefined
    const second = await readDocumentEvidence(id, call, { state: host.state, documents: host.documents, requestFor: host.host.requestFor, revalidate: host.host.revalidate })
    if (second.status !== "ok" || digestSfValue(second.value.evidence) !== digestSfValue(first.value.evidence) || !(await host.host.revalidate(call))) return undefined
    documents.push(second.value.evidence)
  }
  const claimRefs = claims.flatMap((claim) => claim.evidenceRefs)
  if (claimRefs.some((ref) => !current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref)) || !revision(ref))) return undefined
  const refs = uniqueRefs([...claimRefs, ...documents.map((item) => item.ref)])
  const sources = await dependencies.context.context({ refs }, call)
  if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(refs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref) || item.accessRevision !== call.binding.accessRevision) || !(await dependencies.host.revalidate(call))) return undefined
  const currentSourceRevisions = refs.flatMap((ref) => {
    const entry = revision(ref)
    return entry ? [entry] : []
  })
  if (currentSourceRevisions.length !== refs.length) return undefined
  const input: EvidenceReviewInput = {
    claims: claims.map((claim) => ({ id: claim.id, text: claim.text, evidenceRefs: claim.evidenceRefs })),
    documentEvidence: documents,
    businessEvidenceRefs: claimRefs.filter((ref) => ref.kind !== "document"),
    currentSourceRevisions,
  }
  return { input, accessRevision: call.binding.accessRevision }
}
