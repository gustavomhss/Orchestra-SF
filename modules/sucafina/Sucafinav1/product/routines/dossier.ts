import { resolveSfDocumentEvidence } from "../documents/evidence-resolver.ts"
import type { SfDocumentReader } from "../documents/evidence-resolver.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DocumentEvidence } from "../contracts/decisions.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { CommercialComparison } from "../contracts/outputs.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { createProcurementSourcingEvidence } from "../procurement/sourcing-evidence.ts"

type DocumentRef = Extract<BusinessEvidenceRef, { kind: "document" }>
type SourcingFacts = Extract<Awaited<ReturnType<ReturnType<typeof createProcurementSourcingEvidence>>>, { status: "ok" }>["value"]
export type ProcurementPreparation = { request: DomainProjection; comparison: CommercialComparison | null; limitations: readonly string[]; sourcing?: SourcingFacts }

export type SourcingDossierHost = {
  prepareProcurement: (requestRef: string, context: TrustedDomainContext) => Promise<PortResult<ProcurementPreparation>>
  /** The WP06 Request-document bridge authorizes the relation and resolves the current candidates. */
  selectedDocuments: (requestRef: string, context: TrustedDomainContext) => Promise<PortResult<readonly DocumentRef[]>>
  reader: SfDocumentReader
  revalidate: (refs: readonly DocumentRef[], context: TrustedDomainContext) => Promise<boolean>
  revalidateProcurement: (material: ProcurementPreparation, context: TrustedDomainContext) => Promise<boolean>
}

/** Assemble the dossier from the procurement and document producers, revalidating all material at egress. */
export async function prepareSourcingDossier(input: SourcingDossierHost & {
  requestRef: string
  context: TrustedDomainContext
}) {
  if (!input.requestRef.trim()) return { status: "needs-input", reason: "request-required" } as const
  const prepared = await input.prepareProcurement(input.requestRef, input.context)
  if (prepared.status !== "ok") return prepared
  if (prepared.value.comparison && (prepared.value.comparison.requestRef !== input.requestRef || prepared.value.comparison.requestVersion !== prepared.value.request.version)) return { status: "stale", reason: "comparison-request-mismatch" } as const
  const comparison = prepared.value.comparison
  if (comparison && (new Set(comparison.proposals.map((proposal) => proposal.proposalRef)).size !== comparison.proposals.length || new Set(comparison.ranking).size !== comparison.ranking.length || comparison.ranking.some((ref) => !comparison.proposals.some((proposal) => proposal.proposalRef === ref && proposal.eligible)))) return { status: "unavailable", reason: "comparison-identity-invalid" } as const
  const selected = await input.selectedDocuments(input.requestRef, input.context)
  if (selected.status !== "ok") return selected
  const refs = selected.value
  const evidence = await prepareDossierEvidence({ refs, reader: input.reader, context: input.context, revalidate: input.revalidate })
  if (evidence.status !== "ok") return evidence
  const currentSelection = await input.selectedDocuments(input.requestRef, input.context)
  if (currentSelection.status !== "ok") return currentSelection
  const selectionKey = (items: readonly DocumentRef[]) => digestSfValue([...new Set(items.map((ref) => digestSfValue(ref)))].sort())
  if (selectionKey(selected.value) !== selectionKey(currentSelection.value)) return { status: "stale", reason: "document-selection-changed" } as const
  if (!await input.revalidateProcurement(prepared.value, input.context) || !await input.revalidate(refs, input.context)) return { status: "denied", reason: "access-changed" } as const
  const currentEvidence = await prepareDossierEvidence({ refs, reader: input.reader, context: input.context, revalidate: input.revalidate })
  if (currentEvidence.status !== "ok") return currentEvidence
  if (digestSfValue(currentEvidence.value) !== digestSfValue(evidence.value)) return { status: "stale", reason: "document-evidence-changed" } as const
  const documentGaps = evidence.value.entries.flatMap((entry) => entry.state === "confirmed" ? [] : [entry.state === "pending" ? "document-needs-confirmation" : entry.state === "rejected" ? "document-rejected" : "document-source-unavailable"])
  const gaps = [...new Set([
    ...prepared.value.limitations,
    ...(!comparison ? ["comparison-unavailable"] : comparison.proposals.length < 2 ? ["comparison-needs-multiple-proposals"] : []),
    ...(comparison?.proposals.flatMap((proposal) => proposal.issues) ?? []),
    ...(evidence.value.entries.length === 0 ? ["document-evidence-unavailable"] : []),
    ...documentGaps,
  ])]
  const sourceRefs = [...(comparison?.sourceRefs ?? []), ...(prepared.value.sourcing ? [prepared.value.sourcing.evidence] : []), ...prepared.value.request.values.flatMap((value) => value.sourceRefs ?? []), ...evidence.value.entries.flatMap((entry) => entry.state === "confirmed" ? [entry.evidence.ref] : [])]
  return { status: "ok", value: {
    ...prepared.value,
    documents: evidence.value.entries,
    summary: { proposalCount: comparison?.proposals.length ?? 0, comparisonAvailable: comparison !== null, ranking: comparison?.ranking ?? [], confirmedDocumentCount: evidence.value.entries.filter((entry) => entry.state === "confirmed").length, pendingDocumentCount: documentGaps.length },
    draft: { requestRef: input.requestRef, requestVersion: prepared.value.request.version, alternatives: comparison?.ranking ?? [], conditions: comparison?.conditions ?? [], sourceRefs: sourceRefs.filter((ref, index) => sourceRefs.findIndex((candidate) => candidate.refId === ref.refId && candidate.refDigest === ref.refDigest) === index), gaps, domainApplied: false as const },
    complete: comparison !== null && comparison.proposals.length >= 2 && comparison.conditions.length === 0 && gaps.length === 0,
    synthesisIncluded: false as const,
  } } as const
}

/** Resolve candidate references through WP06's private document reader on every use. */
export async function prepareDossierEvidence(input: {
  refs: readonly Extract<BusinessEvidenceRef, { kind: "document" }>[]
  reader: SfDocumentReader
  context: TrustedDomainContext
  revalidate: (refs: readonly Extract<BusinessEvidenceRef, { kind: "document" }>[], context: TrustedDomainContext) => Promise<boolean>
}) {
  const refs = input.refs.filter((ref, index) => input.refs.findIndex((other) => other.refId === ref.refId && other.refDigest === ref.refDigest) === index)
  const checks: (() => Promise<boolean>)[] = []
  const reader: SfDocumentReader = async (...args) => {
    const result = await input.reader(...args)
    if (result.status === "ok") checks.push(result.revalidate)
    return result
  }
  const entries = await Promise.all(refs.map(async (ref) => {
    const resolution = await resolveSfDocumentEvidence(ref, input.context, reader)
    if (resolution.state !== "fresh" || !isDocumentEvidence(resolution.authorizedProjection) || resolution.authorizedProjection.ref.refId !== ref.refId || resolution.authorizedProjection.ref.refDigest !== ref.refDigest) return { state: "unavailable" } as const
    if (resolution.authorizedProjection.status === "confirmed") return { state: "confirmed", evidence: resolution.authorizedProjection } as const
    if (resolution.authorizedProjection.status === "extracted") return { state: "pending", evidence: resolution.authorizedProjection } as const
    if (resolution.authorizedProjection.status === "rejected") return { state: "rejected", fieldCandidate: resolution.authorizedProjection.fieldCandidate, evidenceRef: resolution.authorizedProjection.ref } as const
    return { state: "unavailable" } as const
  }))
  if (!(await input.revalidate(refs, input.context)) || (await Promise.all(checks.map((check) => check()))).some((valid) => !valid)) return { status: "denied", reason: "access-changed" } as const
  return { status: "ok", value: { entries } } as const
}

function isDocumentEvidence(value: unknown): value is DocumentEvidence {
  return !!value && typeof value === "object" && "fieldCandidate" in value && "ref" in value && value.ref !== null && typeof value.ref === "object" && "kind" in value.ref && value.ref.kind === "document"
}

