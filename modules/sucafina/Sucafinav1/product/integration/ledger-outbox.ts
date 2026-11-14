import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { CaseLedgerEvent } from "../contracts/decisions.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { SfProductState, SfStateAuthority } from "../contracts/state.ts"

/** Runs inside the same authorized cases+outbox transaction as the official ledger append. */
export function enqueueSfLedgerEvent(state: SfProductState, event: CaseLedgerEvent, scope: {
  installationId: string
  projectId: string
  authority: SfStateAuthority
}) {
  const current = state.cases[event.caseRef.id]
  if (!current || current.incarnation !== event.caseRef.incarnation || current.version !== event.caseRef.version ||
      event.principalRef !== scope.authority.principalRef || !current.ledger.some((entry) => entry.id === event.id && digestSfValue(entry) === digestSfValue(event)))
    return { status: "conflict", reason: "ledger-event-not-committed-in-staging" } as const
  const key = JSON.stringify([event.caseRef.id, event.caseRef.incarnation, event.id])
  const value: Extract<BusinessEvidenceRef, { kind: "case-event" }> = {
    schema: "sf-evidence-v1", kind: "case-event", refId: `case-event:${encodeURIComponent(event.caseRef.id)}:${encodeURIComponent(event.caseRef.incarnation)}:${encodeURIComponent(event.id)}`,
    installationId: scope.installationId, projectId: scope.projectId, refDigest: "", evidenceLevel: "decision",
    target: { caseId: event.caseRef.id, caseIncarnation: event.caseRef.incarnation, caseVersion: event.caseRef.version, eventId: event.id, outputDigest: event.outputDigest, evidenceRefs: structuredClone(event.evidenceRefs) },
  }
  const eventRef = { ...value, refDigest: digestSfEvidenceRef(value) }
  const prior = state.outbox[key]
  if (prior && prior.accessRevision !== scope.authority.accessRevision)
    return { status: "denied", reason: "ledger-outbox-authority-changed" } as const
  if (prior && (digestSfValue(prior.eventRef) !== digestSfValue(eventRef) || prior.writerPrincipalRef !== scope.authority.principalRef))
    return { status: "conflict", reason: "ledger-outbox-content-changed" } as const
  if (!prior) state.outbox[key] = {
    eventRef, writerPrincipalRef: scope.authority.principalRef, accessRevision: scope.authority.accessRevision,
    createdAt: event.at, attempts: 0, state: "pending",
  }
  return { status: "ok", value: { key, eventRef } } as const
}
