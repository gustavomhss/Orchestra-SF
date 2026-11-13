import { digestSfValue, sfEvidenceSourceMaps } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../contracts/business-context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDashboardSourceAccess, createSfCaseEventSourceAccess, createSfDashboardContinuityProof, createSfSourceContinuityProof } from "../decision-memory/source-access.ts"

/** All source readers and memory operations are host-bound; references are selectors, not authority. */
export function createSfBusinessContext(host: {
  revalidate: (call: TrustedDomainContext) => Promise<boolean>
  resolveSource: (ref: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<BusinessEvidenceResolution>
  proveContinuity: (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<boolean>
  recall: BusinessContextService["recall"]
  emitFromLedger: BusinessContextService["emitFromLedger"]
}): BusinessContextService {
  async function resolve(ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> {
    const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() })
    if (!(await host.revalidate(call))) return unavailable()
    if (ref.schema !== "sf-evidence-v1" || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId) return { ...unavailable(), state: "invalid" }
    try {
      sfEvidenceSourceMaps([ref])
    } catch {
      return { ...unavailable(), state: "invalid" }
    }
    const result = await host.resolveSource(ref, call)
    if (!(await host.revalidate(call)) || result.accessRevision !== call.binding.accessRevision || result.ref.refDigest !== ref.refDigest) return unavailable()
    try {
      sfEvidenceSourceMaps([result.ref, ...(result.currentRef ? [result.currentRef] : [])])
    } catch {
      return unavailable()
    }
    if (result.state === "fresh") return result
    if (result.state === "historical") {
      const current = result.currentRef
      if (!result.authorizedProjection || !current || !result.differences || !sameHistoricalSource(ref, current) || current.installationId !== call.binding.installationId || current.projectId !== call.binding.projectId) return unavailable()
      if (!(await host.proveContinuity(ref, current, call)) || !(await host.revalidate(call))) return unavailable()
      return result
    }
    return { state: result.state, ref, accessRevision: result.accessRevision, checkedAt: result.checkedAt }
  }

  return {
    resolve,
    context: async (request, call) => Promise.all(request.refs.map((ref) => resolve(ref, call))),
    async recall(request, call) {
      if (!(await host.revalidate(call))) return []
      const records = await host.recall(request, call)
      const allowed = await Promise.all(records.map(async (record) => {
        const caseRef = record.envelope.caseRef
        if (!caseRef || !request.caseRefs.some((ref) => ref.id === caseRef.id && ref.incarnation === caseRef.incarnation)) return false
        const refs = [...record.envelope.evidenceRefs, ...record.envelope.dependencies]
        try {
          const maps = sfEvidenceSourceMaps(refs)
          if (digestSfValue(maps.sourceVersions) !== digestSfValue(record.envelope.sourceVersions) || digestSfValue(maps.sourceIncarnations) !== digestSfValue(record.envelope.sourceIncarnations)) return false
        } catch {
          return false
        }
        const resolved = await Promise.all(refs.map((ref) => resolve(ref, call)))
        return refs.length > 0 && resolved.every((item) => item.state === "fresh" || (item.state === "historical" && item.differences !== undefined))
      }))
      if (!(await host.revalidate(call))) return []
      return records.filter((_, index) => allowed[index])
    },
    async emitFromLedger(ref, call) {
      const source = await resolve(ref, call)
      if (ref.kind !== "case-event" || source.state !== "fresh" || !(await host.revalidate(call))) {
        return { status: "unavailable", sourceEventId: ref.kind === "case-event" ? ref.target.eventId : "", scanner: { name: "", version: "", status: "unavailable" }, reason: "source unavailable" }
      }
      const receipt = await host.emitFromLedger(ref, call)
      if (!(await host.revalidate(call))) return { status: "unavailable", sourceEventId: ref.target.eventId, scanner: { name: "", version: "", status: "unavailable" }, reason: "authority unavailable" }
      return receipt
    },
  }
}

/** Textual IDs cannot carry historical authorization across replacement incarnations. */
function sameHistoricalSource(original: BusinessEvidenceRef, current: BusinessEvidenceRef): boolean {
  if (original.kind === "record" && current.kind === "record") return original.target.surface === current.target.surface && original.target.recordType === current.target.recordType && original.target.recordId === current.target.recordId && (original.target.surface === "dashboard" || original.target.incarnation === current.target.incarnation)
  if (original.kind === "document" && current.kind === "document") return original.target.documentId === current.target.documentId && original.target.incarnation === current.target.incarnation
  if (original.kind === "receipt" && current.kind === "receipt") return original.target.surface === current.target.surface && original.target.receiptId === current.target.receiptId && original.target.targetIncarnation === current.target.targetIncarnation
  if (original.kind === "case-event" && current.kind === "case-event") return original.target.caseId === current.target.caseId && original.target.caseIncarnation === current.target.caseIncarnation && original.target.eventId === current.target.eventId
  return false
}

/** Dispatches only to explicitly wired domain authorities; unsupported sources fail closed. */
export function createSfEvidenceRouter(input: {
  dashboard: ReturnType<typeof createSfDashboardSourceAccess>
  caseEvent: ReturnType<typeof createSfCaseEventSourceAccess>
  dashboardProof: ReturnType<typeof createSfDashboardContinuityProof>
  caseEventProof: ReturnType<typeof createSfSourceContinuityProof>
}) {
  return {
    resolveSource(ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> {
      if (ref.kind === "record" && ref.target.surface === "dashboard") return input.dashboard(ref, call)
      if (ref.kind === "case-event") return input.caseEvent(ref, call)
      return Promise.resolve({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() })
    },
    proveContinuity(original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext): Promise<boolean> {
      if (original.kind === "record" && original.target.surface === "dashboard") return input.dashboardProof(original, current, call)
      if (original.kind === "case-event") return input.caseEventProof(original, current, call)
      return Promise.resolve(false)
    },
  }
}
