import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createDashboardConfirmationObserver } from "./confirmation.ts"
import type { createDashboardRecordEvidenceHost } from "./sources.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
export type DashboardHistoricalCapture = {
  schema: "sf-dashboard-historical-capture-v1"
  id: string
  source: RecordEvidence
  projection: DomainProjection
  projectionDigest: string
  capturedBy: string
  capturedAt: string
  receiptDigest: string
}

/** The host persists the prepared receipt only while its fence passes under the capture transaction. */
export function createDashboardHistoricalBindings(input: {
  host: DomainPortHost
  observer: Pick<ReturnType<typeof createDashboardConfirmationObserver>, "prepareReissueScope" | "prepareHistoricalReissue">
  records: Pick<ReturnType<typeof createDashboardRecordEvidenceHost>, "read">
  readProtectedCapture: (captureId: string, context: TrustedDomainContext) => Promise<PortResult<DashboardHistoricalCapture>>
}) {
  const prepare = async (request: { captureId: string; source: RecordEvidence }, context: TrustedDomainContext): Promise<PortResult<{ receipt: DashboardHistoricalCapture; fence: () => Promise<boolean> }>> => {
    const selected = structuredClone(request)
    const source = input.host.requestFor(context)
    if (!selected.captureId.trim() || !source || source.signal.aborted || !await input.host.revalidate(context) || selected.source.kind !== "record" || selected.source.target.surface !== "dashboard" || selected.source.target.recordType === "dashboard-page" || selected.source.refDigest !== digestSfEvidenceRef(selected.source) || selected.source.installationId !== context.binding.installationId || selected.source.projectId !== context.binding.projectId) return { status: "denied", reason: "historical-capture-unavailable" }
    const observed = await input.records.read(selected.source.refId, context)
    if (observed.status !== "ok") return observed
    const projection = observed.value
    if (projection.context.principalRef !== context.binding.principalRef || projection.context.accessRevision !== context.binding.accessRevision || projection.context.policyVersion !== context.binding.policyVersion || !recordProjectionMatches(projection, selected.source)) return { status: "stale", reason: "historical-capture-source-changed" }
    const proof = await input.observer.prepareReissueScope(selected.source, selected.source, context)
    if (proof.status !== "ok") return proof
    const environment = await input.host.environment(source)
    if (!Number.isFinite(Date.parse(environment.at)) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "historical-capture-unavailable" }
    const initial: DashboardHistoricalCapture = { schema: "sf-dashboard-historical-capture-v1", id: selected.captureId, source: selected.source,
      projection: structuredClone(projection), projectionDigest: digestSfValue(projection), capturedBy: context.binding.principalRef,
      capturedAt: new Date(environment.at).toISOString(), receiptDigest: "" }
    const receipt = { ...initial, receiptDigest: captureDigest(initial) }
    const expected = digestSfValue(receipt)
    return { status: "ok", value: { receipt, fence: () => digestSfValue(receipt) === expected ? proof.value.fence() : Promise.resolve(false) } }
  }
  const reopen = async (captureId: string, context: TrustedDomainContext): Promise<PortResult<{ state: "historical"; captureId: string; capturedAt: string; capturedBy: string; projection: DomainProjection }>> => {
    const request = input.host.requestFor(context)
    const transaction = input.host.persistence.transactionAll
    if (!captureId.trim() || !request || request.signal.aborted || !transaction || !await input.host.revalidate(context)) return { status: "denied", reason: "historical-capture-unavailable" }
    // This callback is a host-authorized durable lookup, never a receipt supplied in browser/model arguments.
    const stored = await input.readProtectedCapture(captureId, context)
    if (stored.status !== "ok") return stored
    const receipt = structuredClone(stored.value)
    if (receipt.schema !== "sf-dashboard-historical-capture-v1" || receipt.id !== captureId || receipt.receiptDigest !== captureDigest(receipt) || receipt.projectionDigest !== digestSfValue(receipt.projection) || receipt.source.target.recordType === "dashboard-page" || receipt.source.installationId !== context.binding.installationId || receipt.source.projectId !== context.binding.projectId || !recordProjectionMatches(receipt.projection, receipt.source)) return { status: "unavailable", reason: "historical-capture-invalid" }
    const proof = await input.observer.prepareHistoricalReissue(receipt.source, context)
    if (proof.status !== "ok") return proof
    // The durable capture and the live source are checked under the same final host lock.
    const current = await transaction(async () => {
      const again = await input.readProtectedCapture(captureId, context)
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(receipt) || request.signal.aborted || !await input.host.revalidate(context) || !await proof.value.fence()) return { commit: false, value: undefined }
      return { commit: false, value: structuredClone(again.value) }
    }).catch(() => undefined)
    if (!current) return { status: "unavailable", reason: "historical-capture-changed-or-inaccessible" }
    return { status: "ok", value: { state: "historical", captureId, capturedAt: current.capturedAt, capturedBy: current.capturedBy, projection: current.projection } }
  }
  return { prepare, reopen }
}

function captureDigest(receipt: DashboardHistoricalCapture) {
  return digestSfValue(Object.fromEntries(Object.entries(receipt).filter(([name]) => name !== "receiptDigest")))
}

function recordProjectionMatches(projection: DomainProjection, source: RecordEvidence) {
  const identity = projection.context.sourceRefs[0]
  return source.refDigest === digestSfEvidenceRef(source) && projection.context.surface === "dashboard" && projection.context.installationId === source.installationId && projection.context.projectId === source.projectId &&
    projection.version === source.target.version && projection.context.sourceRefs.length === 1 && !!identity && identity.surface === "dashboard" && identity.type === source.target.recordType && identity.id === source.target.recordId && identity.incarnation === source.target.incarnation && identity.version === source.target.version && digestSfValue(identity.fields) === digestSfValue(source.target.fields) && digestSfValue(identity.period) === digestSfValue(source.target.period) &&
    projection.values.length === source.target.fields.length && new Set(projection.values.map((value) => value.id)).size === projection.values.length && projection.values.every((value) => value.sourceRefs.length === 1 && digestSfValue(value.sourceRefs[0]) === digestSfValue(source)) && projection.components.length === 0
}
