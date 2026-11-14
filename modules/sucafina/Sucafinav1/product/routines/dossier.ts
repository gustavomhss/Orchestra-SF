import { resolveSfDocumentEvidence } from "../documents/evidence-resolver.ts"
import type { SfDocumentReader } from "../documents/evidence-resolver.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DocumentEvidence } from "../contracts/decisions.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { CommercialComparison } from "../contracts/outputs.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

type DocumentRef = Extract<BusinessEvidenceRef, { kind: "document" }>
type ProcurementPreparation = { request: DomainProjection; comparison: CommercialComparison | null; limitations: readonly string[] }

/** Assemble the dossier from the procurement and document producers, revalidating all material at egress. */
export async function prepareSourcingDossier(input: {
  requestRef: string
  prepareProcurement: (requestRef: string, context: TrustedDomainContext) => Promise<PortResult<ProcurementPreparation>>
  /** Resolve the documents explicitly selected for this Request and authorize their relation. */
  selectedDocuments: (requestRef: string, context: TrustedDomainContext) => Promise<PortResult<readonly DocumentRef[]>>
  reader: SfDocumentReader
  context: TrustedDomainContext
  revalidate: (refs: readonly DocumentRef[], context: TrustedDomainContext) => Promise<boolean>
  revalidateProcurement: (material: ProcurementPreparation, context: TrustedDomainContext) => Promise<boolean>
}) {
  if (!input.requestRef.trim()) return { status: "needs-input", reason: "request-required" } as const
  const prepared = await input.prepareProcurement(input.requestRef, input.context)
  if (prepared.status !== "ok") return prepared
  if (prepared.value.comparison && (prepared.value.comparison.requestRef !== input.requestRef || prepared.value.comparison.requestVersion !== prepared.value.request.version)) return { status: "stale", reason: "comparison-request-mismatch" } as const
  const selected = await input.selectedDocuments(input.requestRef, input.context)
  if (selected.status !== "ok") return selected
  const refs = selected.value
  const evidence = await prepareDossierEvidence({ refs, reader: input.reader, context: input.context, revalidate: input.revalidate })
  if (evidence.status !== "ok") return evidence
  const currentSelection = await input.selectedDocuments(input.requestRef, input.context)
  if (currentSelection.status !== "ok") return currentSelection
  const selectionKey = (items: readonly DocumentRef[]) => JSON.stringify(items.map((ref) => [ref.refId, ref.refDigest]).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))))
  if (selectionKey(selected.value) !== selectionKey(currentSelection.value)) return { status: "stale", reason: "document-selection-changed" } as const
  if (!await input.revalidateProcurement(prepared.value, input.context) || !await input.revalidate(refs, input.context)) return { status: "denied", reason: "access-changed" } as const
  return { status: "ok", value: { ...prepared.value, documents: evidence.value.entries } } as const
}

/** Resolve candidate references through WP06's private document reader on every use. */
export async function prepareDossierEvidence(input: {
  refs: readonly Extract<BusinessEvidenceRef, { kind: "document" }>[]
  reader: SfDocumentReader
  context: TrustedDomainContext
  revalidate: (refs: readonly Extract<BusinessEvidenceRef, { kind: "document" }>[], context: TrustedDomainContext) => Promise<boolean>
}) {
  const refs = input.refs.filter((ref, index) => input.refs.findIndex((other) => other.refId === ref.refId && other.refDigest === ref.refDigest) === index)
  const entries = await Promise.all(refs.map(async (ref) => {
    const resolution = await resolveSfDocumentEvidence(ref, input.context, input.reader)
    if (resolution.state !== "fresh" || !isDocumentEvidence(resolution.authorizedProjection) || resolution.authorizedProjection.ref.refId !== ref.refId || resolution.authorizedProjection.ref.refDigest !== ref.refDigest) return { state: "unavailable" } as const
    if (resolution.authorizedProjection.status === "confirmed") return { state: "confirmed", evidence: resolution.authorizedProjection } as const
    if (resolution.authorizedProjection.status === "extracted") return { state: "pending", evidence: resolution.authorizedProjection } as const
    return { state: "unavailable" } as const
  }))
  if (!(await input.revalidate(refs, input.context))) return { status: "denied", reason: "access-changed" } as const
  return { status: "ok", value: { entries } } as const
}

function isDocumentEvidence(value: unknown): value is DocumentEvidence {
  return !!value && typeof value === "object" && "fieldCandidate" in value && "ref" in value && value.ref !== null && typeof value.ref === "object" && "kind" in value.ref && value.ref.kind === "document"
}
